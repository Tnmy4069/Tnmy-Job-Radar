declare module "playwright" {
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<{
      newPage: (options?: Record<string, unknown>) => Promise<{
        goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
        waitForLoadState: (state: string, options?: Record<string, unknown>) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        getByRole: (
          role: string,
          options?: Record<string, unknown>
        ) => { first: () => { click: (options?: Record<string, unknown>) => Promise<void> } };
        content: () => Promise<string>;
      }>;
      close: () => Promise<void>;
    }>;
  };
}
