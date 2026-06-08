/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
        renderButton: (
          element: HTMLElement,
          options: { theme?: string; size?: string; width?: string; text?: string }
        ) => void;
      };
    };
  };
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
