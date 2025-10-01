// Type declarations for Clerk on window object
declare global {
  interface Window {
    Clerk?: {
      user?: any;
      session?: any;
      loaded?: boolean;
      openSignIn?: (...args: any[]) => Promise<any> | void;
      openSignUp?: (...args: any[]) => Promise<any> | void;
      signOut?: () => Promise<void>;
      addListener?: (callback: (state: any) => void) => void;
      removeListener?: (callback: (state: any) => void) => void;
    };
  }
}

export {};
