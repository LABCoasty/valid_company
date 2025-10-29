declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
    }

    interface Port {
      name: string;
      disconnect(): void;
      onMessage: { addListener(callback: (message: any) => void): void };
      postMessage(message: any): void;
    }

    const id: string;

    function sendMessage(message: any, responseCallback?: (response: any) => void): void;

    function getURL(path: string): string;

    const lastError: { message?: string } | undefined;

    function onInstalled(callback: (details?: any) => void): void;

    function onMessage(): void;

    const onMessage: {
      addListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const sync: StorageArea;
    const local: StorageArea;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }

    function query(queryInfo: Record<string, any>): Promise<Tab[]>;
    function sendMessage(tabId: number, message: any): Promise<any>;
  }

  namespace scripting {
    function executeScript(injection: any): Promise<void>;
  }
}
