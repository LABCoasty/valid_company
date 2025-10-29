import { ApplicationLog, BackgroundRequest, BackgroundResponse } from './shared/types';
import { getSettings } from './shared/storage';

interface PopupState {
  queue: ApplicationLog[];
  syncing: boolean;
  sheetUrl: string | null;
}

const state: PopupState = {
  queue: [],
  syncing: false,
  sheetUrl: null
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  hydrateSettings();
  refreshQueue();
});

function bindEvents(): void {
  const flushButton = document.querySelector<HTMLButtonElement>('#flush-queue');
  flushButton?.addEventListener('click', flushQueue);

  const optionsButton = document.querySelector<HTMLButtonElement>('#open-options');
  optionsButton?.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  const sheetButton = document.querySelector<HTMLButtonElement>('#view-sheet');
  sheetButton?.addEventListener('click', () => {
    if (state.sheetUrl) {
      window.open(state.sheetUrl, '_blank');
    }
  });
}

async function hydrateSettings(): Promise<void> {
  try {
    const settings = await getSettings();
    const aliasDomain = document.querySelector('#alias-domain');
    if (aliasDomain) {
      aliasDomain.textContent = settings.aliasDomain;
    }

    const sheetStatus = document.querySelector('#sheet-status');
    const sheetButton = document.querySelector<HTMLButtonElement>('#view-sheet');
    if (settings.sheetId) {
      state.sheetUrl = `https://docs.google.com/spreadsheets/d/${settings.sheetId}`;
      if (sheetStatus) {
        sheetStatus.textContent = 'Connected';
      }
      if (sheetButton) {
        sheetButton.disabled = false;
      }
    } else {
      state.sheetUrl = null;
      if (sheetStatus) {
        sheetStatus.textContent = 'Not connected';
      }
      if (sheetButton) {
        sheetButton.disabled = true;
      }
    }
  } catch (error) {
    console.error('Failed to load settings', error);
  }
}

async function refreshQueue(): Promise<void> {
  const response = await sendBackgroundMessage<ApplicationLog[]>({ type: 'GET_QUEUE_STATUS' });
  if (!response.ok || !response.data) {
    renderError(response.error ?? 'Unable to load queue.');
    return;
  }

  state.queue = response.data;
  renderQueue();
}

async function flushQueue(): Promise<void> {
  if (state.syncing) {
    return;
  }
  state.syncing = true;
  renderQueue();

  const response = await sendBackgroundMessage<ApplicationLog[]>({ type: 'FLUSH_QUEUE' });
  state.syncing = false;

  if (!response.ok || !response.data) {
    renderError(response.error ?? 'Unable to sync queue.');
    return;
  }

  state.queue = response.data;
  renderQueue();
}

function renderQueue(): void {
  const list = document.querySelector<HTMLUListElement>('#queue-items');
  const status = document.querySelector<HTMLElement>('#queue-notice');
  const flushButton = document.querySelector<HTMLButtonElement>('#flush-queue');
  const queueCount = document.querySelector<HTMLElement>('#queue-count');

  if (flushButton) {
    flushButton.disabled = state.syncing;
    flushButton.textContent = state.syncing ? 'Syncing…' : 'Sync queued';
  }

  if (!list || !status) {
    return;
  }

  if (state.queue.length === 0) {
    list.innerHTML = '<li class="empty">No pending applications.</li>';
    status.textContent = 'All caught up!';
    if (queueCount) {
      queueCount.textContent = '0';
    }
    return;
  }

  list.innerHTML = state.queue
    .map((entry) => {
      const statusLabel = entry.status === 'synced' ? 'Synced' : entry.status === 'error' ? 'Error' : 'Queued';
      return `
        <li>
          <div class="title">${entry.jobTitle} · ${entry.companyName}</div>
          <div class="meta">${new Date(entry.submittedAt).toLocaleString()} · ${statusLabel}</div>
        </li>
      `;
    })
    .join('');

  const queued = state.queue.filter((entry) => entry.status !== 'synced').length;
  status.textContent = `${queued} application${queued === 1 ? '' : 's'} waiting to sync.`;
  if (queueCount) {
    queueCount.textContent = String(queued);
  }
}

function renderError(message: string): void {
  const status = document.querySelector<HTMLElement>('#queue-notice');
  if (status) {
    status.textContent = message;
  }
}

async function sendBackgroundMessage<T>(message: BackgroundRequest): Promise<BackgroundResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}
