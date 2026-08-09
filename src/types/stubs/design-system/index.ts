/* eslint-disable */
// Fallback types stub — used when @so360/design-system is not resolvable at the
// real path during CI typecheck (tsconfig paths tries the shell checkout first,
// then this). Runtime resolution is unaffected (vite alias / federation share).
const _any: any = undefined;
export default _any;
export const Button: any = _any;
export const QuotaBar: any = _any;
export const QuotaGate: any = _any;
export const FeatureRoute: any = _any;
export const FeatureGate: any = _any;
export const Tooltip: any = _any;
export const Pagination: any = _any;
export const DeleteConfirmDialog: any = _any;

// Universal toast surface
export const toast: {
    success: (message: string, opts?: any) => string;
    error: (message: string, opts?: any) => string;
    warning: (message: string, opts?: any) => string;
    info: (message: string, opts?: any) => string;
    promise: <T>(p: Promise<T>, msgs?: any) => Promise<T>;
    dismiss: (id?: string) => void;
} = {
    success: () => 'toast-id',
    error: () => 'toast-id',
    warning: () => 'toast-id',
    info: () => 'toast-id',
    promise: (p) => p,
    dismiss: () => {},
};
export const useToast = () => toast;
export const getErrorMessage = (_e: unknown, fallback?: string): string => fallback ?? 'error';
export const attachToastErrorHandler = (_instance?: unknown, _opts?: unknown): number => 0;
export const toastBus: any = { subscribe: () => () => {}, show: () => 'toast-id', dismiss: () => {}, getToasts: () => [] };
export const ToastViewport: any = () => null;
export const ToastProvider: any = ({ children }: any) => children ?? null;
