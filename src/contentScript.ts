interface JobContext {
  companyName: string;
  jobTitle: string;
  jobLocation: string;
  jobUrl: string;
}

type TrustStatus = 'ok' | 'warning' | 'high-risk' | 'unverified' | 'unavailable';

interface TrustBreakdownEntry {
  label: string;
  score: number;
  weight: number;
  notes?: string;
}

interface TrustScore {
  companyName: string;
  score: number | null;
  status: TrustStatus;
  message: string;
  breakdown: TrustBreakdownEntry[];
  lastUpdated: string | null;
}

interface AutofillPayload {
  resume: {
    firstName: string;
    lastName: string;
    preferredName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    linkedin: string;
    website: string;
    summary: string;
    experiences: Array<{
      company: string;
      title: string;
      startDate: string;
      endDate: string;
      description: string;
    }>;
    education: Array<{
      school: string;
      degree: string;
      field: string;
      startDate: string;
      endDate: string;
    }>;
    skills: string[];
  };
  aliasEmail: string;
}

interface ApplicationLog {
  companyName: string;
  jobTitle: string;
  jobLocation: string;
  jobUrl: string;
  submittedAt: string;
  aliasEmail: string;
  status: 'queued' | 'synced' | 'error';
  notes?: string;
}

interface TrustScoreRequest {
  companyName: string;
  jobTitle?: string;
  jobUrl?: string;
  jobLocation?: string;
}

interface AutofillRequest {
  companyName: string;
  jobTitle: string;
  jobLocation?: string;
  jobUrl?: string;
}

type BackgroundRequest =
  | { type: 'FETCH_TRUST_SCORE'; payload: TrustScoreRequest }
  | { type: 'REQUEST_AUTOFILL'; payload: AutofillRequest }
  | { type: 'LOG_APPLICATION'; payload: ApplicationLog }
  | { type: 'FLUSH_QUEUE' }
  | { type: 'GET_QUEUE_STATUS' }
  | { type: 'RESET_ALIAS'; payload: { companyName: string } };

interface BackgroundResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface PanelState {
  context: JobContext | null;
  trustScore: TrustScore | null;
  aliasEmail: string | null;
  lastQueuedAt: string | null;
}

const PANEL_ID = 'company-validator-panel';
const panelState: PanelState = {
  context: null,
  trustScore: null,
  aliasEmail: null,
  lastQueuedAt: null
};

(async function bootstrap() {
  waitForReady().then(initializeContent);
})();

function waitForReady(): Promise<void> {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

async function initializeContent(): Promise<void> {
  panelState.context = extractJobContext();
  if (!panelState.context) {
    console.warn('[Company Validator] unable to determine job context');
    return;
  }

  mountPanel();
  await refreshTrustScore();
  registerMutationObserver();
}

function extractJobContext(): JobContext | null {
  const title = queryText('[data-test-job-title], h1');
  const company = queryText('[data-test-company-name], .jobs-company, .jobsearch-InlineCompanyRating div a, .topcard__org-name-link, [data-automation="job-company"]');
  const location = queryText('[data-test-job-location], .jobs-unified-top-card__bullet, .jobsearch-JobInfoHeader-subtitle div');
  const jobUrl = window.location.href;

  if (!company || !title) {
    return null;
  }

  return {
    companyName: company,
    jobTitle: title,
    jobLocation: location ?? '',
    jobUrl
  };
}

function queryText(selector: string): string | null {
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const text = element.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function mountPanel(): void {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const container = document.createElement('div');
  container.id = PANEL_ID;
  container.style.position = 'fixed';
  container.style.bottom = '24px';
  container.style.right = '24px';
  container.style.width = '320px';
  container.style.maxHeight = '80vh';
  container.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.24)';
  container.style.borderRadius = '16px';
  container.style.background = '#0f172a';
  container.style.color = '#f8fafc';
  container.style.fontFamily = 'Inter, system-ui, sans-serif';
  container.style.zIndex = '2147483647';
  container.style.overflow = 'hidden';

  container.innerHTML = createPanelMarkup();
  document.body.appendChild(container);

  container.querySelector('[data-action="refresh"]')?.addEventListener('click', refreshTrustScore);
  container.querySelector('[data-action="autofill"]')?.addEventListener('click', handleAutofillClick);
  container.querySelector('[data-action="queue"]')?.addEventListener('click', handleQueueClick);
  container.querySelector('[data-action="alias"]')?.addEventListener('click', handleResetAlias);
}

function createPanelMarkup(): string {
  return `
    <div style="padding: 18px 20px 16px 20px; display: flex; flex-direction: column; gap: 12px;">
      <header style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7;">Company Validator</div>
          <div style="font-size: 16px; font-weight: 600;" data-panel="title">${panelState.context?.companyName ?? ''}</div>
        </div>
        <button data-action="refresh" style="background: rgba(148, 163, 184, 0.18); border: none; color: inherit; padding: 6px 10px; border-radius: 8px; cursor: pointer;">Refresh</button>
      </header>
      <section data-panel="score" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 36px; font-weight: 700; line-height: 1;" data-panel="score-value">--</div>
        <div style="font-size: 13px; opacity: 0.85;" data-panel="score-message">Fetching trust score...</div>
      </section>
      <section data-panel="actions" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
        <button data-action="autofill" style="background: linear-gradient(135deg, #38bdf8, #0ea5e9); border: none; color: #0f172a; font-weight: 600; padding: 10px 12px; border-radius: 10px; cursor: pointer;">Autofill</button>
        <button data-action="queue" style="background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.35); color: inherit; padding: 10px 12px; border-radius: 10px; cursor: pointer;">Log to Sheet</button>
      </section>
      <footer style="font-size: 12px; opacity: 0.75; display: flex; flex-direction: column; gap: 6px;">
        <span data-panel="alias">Alias: --</span>
        <button data-action="alias" style="align-self: flex-start; background: none; border: none; color: #38bdf8; padding: 0; cursor: pointer;">Reset alias</button>
        <span data-panel="queue-status"></span>
      </footer>
    </div>
  `;
}

async function refreshTrustScore(): Promise<void> {
  if (!panelState.context) {
    return;
  }

  updateScore({ score: '--', message: 'Fetching trust score...' });

  const request: BackgroundRequest = {
    type: 'FETCH_TRUST_SCORE',
    payload: {
      companyName: panelState.context.companyName,
      jobTitle: panelState.context.jobTitle,
      jobLocation: panelState.context.jobLocation,
      jobUrl: panelState.context.jobUrl
    } satisfies TrustScoreRequest
  };

  const response = await sendBackgroundMessage<TrustScore>(request);
  if (!response.ok || !response.data) {
    updateScore({ score: '--', message: response.error ?? 'Unable to fetch trust score.' });
    return;
  }

  panelState.trustScore = response.data;
  const scoreValue = response.data.score != null ? response.data.score.toFixed(0) : '--';
  const message = response.data.message || describeStatus(response.data.status);
  updateScore({ score: scoreValue, message });
}

function describeStatus(status: TrustScore['status']): string {
  switch (status) {
    case 'ok':
      return 'Company looks legitimate based on our signals.';
    case 'warning':
      return 'Some risk factors detected. Review before applying.';
    case 'high-risk':
      return 'High-risk company. Apply with caution.';
    case 'unverified':
      return 'Not enough data to verify this company yet.';
    default:
      return 'Trust data currently unavailable.';
  }
}

function updateScore({ score, message }: { score: string; message: string }): void {
  const container = document.getElementById(PANEL_ID);
  container?.querySelector('[data-panel="score-value"]')?.textContent = score;
  container?.querySelector('[data-panel="score-message"]')?.textContent = message;
}

async function handleAutofillClick(): Promise<void> {
  if (!panelState.context) {
    return;
  }

  const request: BackgroundRequest = {
    type: 'REQUEST_AUTOFILL',
    payload: {
      companyName: panelState.context.companyName,
      jobTitle: panelState.context.jobTitle,
      jobLocation: panelState.context.jobLocation,
      jobUrl: panelState.context.jobUrl
    } satisfies AutofillRequest
  };

  const response = await sendBackgroundMessage<AutofillPayload>(request);
  if (!response.ok || !response.data) {
    notifyQueueStatus(response.error ?? 'Unable to prepare autofill data.');
    return;
  }

  panelState.aliasEmail = response.data.aliasEmail;
  updateAliasLabel(response.data.aliasEmail);
  autofillForm(response.data);
}

function autofillForm(payload: AutofillPayload): void {
  const fields = buildFieldMap(payload);
  Object.entries(fields).forEach(([selector, value]) => {
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!element) {
      return;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function buildFieldMap(payload: AutofillPayload): Record<string, string> {
  const { resume, aliasEmail } = payload;
  return {
    'input[name="firstName"], input[name="first_name"], input[data-qa="firstName"]': resume.firstName,
    'input[name="lastName"], input[name="last_name"], input[data-qa="lastName"]': resume.lastName,
    'input[name="email"], input[type="email"], input[data-qa="email"]': aliasEmail || resume.email,
    'input[name="phone"], input[type="tel"], input[data-qa="phone"]': resume.phone,
    'input[name="city"], input[data-qa="city"]': resume.city,
    'input[name="state"], input[data-qa="state"]': resume.state,
    'textarea[name="summary"], textarea[data-qa="summary"], textarea[name="coverLetter"]': resume.summary,
    'input[name="linkedin"], input[data-qa="linkedin"]': resume.linkedin,
    'input[name="website"], input[data-qa="website"]': resume.website
  };
}

async function handleQueueClick(): Promise<void> {
  if (!panelState.context) {
    return;
  }

  const now = new Date().toISOString();
  const entry: ApplicationLog = {
    companyName: panelState.context.companyName,
    jobTitle: panelState.context.jobTitle,
    jobLocation: panelState.context.jobLocation,
    jobUrl: panelState.context.jobUrl,
    submittedAt: now,
    aliasEmail: panelState.aliasEmail ?? '',
    status: 'queued'
  };

  const response = await sendBackgroundMessage<ApplicationLog[]>({ type: 'LOG_APPLICATION', payload: entry });
  if (!response.ok) {
    notifyQueueStatus(response.error ?? 'Unable to queue application.');
    return;
  }

  panelState.lastQueuedAt = now;
  notifyQueueStatus('Application queued for sync.');
}

async function handleResetAlias(): Promise<void> {
  if (!panelState.context) {
    return;
  }

  const response = await sendBackgroundMessage<null>({
    type: 'RESET_ALIAS',
    payload: { companyName: panelState.context.companyName }
  });

  if (response.ok) {
    panelState.aliasEmail = null;
    updateAliasLabel('--');
    notifyQueueStatus('Alias reset. Autofill to generate a new one.');
  } else {
    notifyQueueStatus(response.error ?? 'Failed to reset alias.');
  }
}

function updateAliasLabel(value: string): void {
  const container = document.getElementById(PANEL_ID);
  container?.querySelector('[data-panel="alias"]')?.textContent = `Alias: ${value}`;
}

function notifyQueueStatus(message: string): void {
  const container = document.getElementById(PANEL_ID);
  const target = container?.querySelector('[data-panel="queue-status"]');
  if (target) {
    target.textContent = message;
    const marker = Date.now().toString();
    target.setAttribute('data-updated-at', marker);
    setTimeout(() => {
      const lastUpdate = target.getAttribute('data-updated-at');
      if (lastUpdate === marker) {
        target.textContent = '';
      }
    }, 6000);
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

function registerMutationObserver(): void {
  const observer = new MutationObserver(() => {
    const context = extractJobContext();
    if (!context) {
      return;
    }

    if (panelState.context && panelState.context.jobUrl === context.jobUrl) {
      return;
    }

    panelState.context = context;
    panelState.trustScore = null;
    panelState.aliasEmail = null;

    const container = document.getElementById(PANEL_ID);
    if (container) {
      container.querySelector('[data-panel="title"]')!.textContent = context.companyName;
      updateAliasLabel('--');
      updateScore({ score: '--', message: 'Fetching trust score...' });
    }

    refreshTrustScore().catch((error) => console.error('Failed to refresh trust score after DOM change', error));
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
