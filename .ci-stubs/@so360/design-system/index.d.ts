export const useShellBridge: any;
export const useShell: any;
export const eventBus: any;
declare const _: any;
export default _;
export const QuotaGate: any;
export const QuotaBar: any;
export const FeatureRoute: any;

export declare const toast: {
  success: (message: string, opts?: Record<string, unknown>) => string;
  error: (message: string, opts?: Record<string, unknown>) => string;
  warning: (message: string, opts?: Record<string, unknown>) => string;
  info: (message: string, opts?: Record<string, unknown>) => string;
  promise: <T>(p: Promise<T>, msgs?: Record<string, unknown>) => Promise<T>;
  dismiss: (id?: string) => void;
};
export declare const useToast: () => typeof toast;
export declare const getErrorMessage: (err: unknown, fallback?: string) => string;
export declare const attachToastErrorHandler: (instance: unknown, options?: unknown) => number;
export declare const toastBus: { subscribe: (l: unknown) => () => void; show: (...a: unknown[]) => string; dismiss: (id?: string) => void; getToasts: () => unknown[] };
export declare const ToastViewport: (props?: Record<string, unknown>) => null;
export declare const ToastProvider: (props: { children?: unknown }) => unknown;
