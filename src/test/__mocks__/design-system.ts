import React from 'react';
export const Button = (props: any) => props;
export const Input = (props: any) => props;
export const Select = (props: any) => props;
export const Modal = (props: any) => props;
export const Card = (props: any) => props;
export const Badge = (props: any) => props;
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = () => null;
export const Pagination = () => null;
export const DeleteConfirmDialog = () => null;

// Universal toast facade (shell owns the single global viewport).
export const toast = {
    success: (_message: string, _opts?: any) => 'toast-id',
    error: (_message: string, _opts?: any) => 'toast-id',
    warning: (_message: string, _opts?: any) => 'toast-id',
    info: (_message: string, _opts?: any) => 'toast-id',
    promise: <T,>(p: Promise<T>, _msgs?: any) => p,
    dismiss: (_id?: string) => undefined,
};
export const useToast = () => toast;
export const getErrorMessage = (err: unknown, fallback?: string) => {
  // Mirrors the real implementation closely enough to be meaningful: a
  // server-supplied message wins over the fallback. The previous stub always
  // returned the fallback, which made every "the backend's message reaches the
  // user" assertion vacuous.
  const anyErr = err as any;
  const candidate =
    anyErr?.response?.data?.message ?? anyErr?.message ?? (typeof err === 'string' ? err : null);
  if (Array.isArray(candidate) && candidate.length) return candidate.join('. ');
  if (typeof candidate === 'string' && candidate.trim() && !/^\s*</.test(candidate)) {
    return candidate.trim();
  }
  return fallback ?? 'Something went wrong. Please try again.';
};
export const attachToastErrorHandler = () => 0;
export const toastBus = {
    show: () => undefined,
    dismiss: () => undefined,
    subscribe: () => () => undefined,
    getToasts: () => [],
};

// Faithful enough for assertions: error must be role="alert" (blocking) and the
// action must be a real button, or specs asserting on them test nothing.
export const Alert = ({ variant = 'info', title, children, action, onDismiss, id, className }: any) =>
  React.createElement(
    'div',
    { id, className, role: variant === 'error' ? 'alert' : 'status' },
    title ? React.createElement('p', null, title) : null,
    children ?? null,
    action ? React.createElement('button', { type: 'button', onClick: action.onClick }, action.label) : null,
    onDismiss ? React.createElement('button', { type: 'button', 'aria-label': 'Dismiss', onClick: onDismiss }) : null,
  );
