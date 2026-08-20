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

// 5-state feature route, mirroring the real contract: enabled (and while
// loading — fail-open) renders children; locked/disabled/hidden render their
// fallbacks. Without this, any route wrapped in the App's FeatureGate renders
// `undefined` and the whole tree crashes.
export const FeatureRoute = ({ state, loading, children, hiddenFallback, lockedFallback, disabledFallback }: any) => {
    if (!loading && state === 'locked') return lockedFallback ?? null;
    if (!loading && state === 'disabled') return disabledFallback ?? null;
    if (!loading && state === 'hidden') return hiddenFallback ?? null;
    return React.createElement(React.Fragment, null, children);
};

// Faithful enough for assertions: dialog only exists when open, shows its
// title/message, and Cancel/confirm are real buttons — or the "delete needs a
// confirmation" specs would test nothing.
export const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, title = 'Confirm Delete', message, confirmText = 'Delete', cancelText = 'Cancel', isLoading }: any) =>
  isOpen
    ? React.createElement(
        'div',
        { role: 'dialog', 'aria-modal': 'true' },
        React.createElement('h3', null, title),
        message ? React.createElement('p', null, message) : null,
        React.createElement('button', { type: 'button', onClick: onClose, disabled: isLoading }, cancelText),
        React.createElement('button', { type: 'button', onClick: onConfirm, disabled: isLoading }, confirmText),
      )
    : null;

// Drawer mirrors the real semantics consumers assert on: renders only when
// open, dialog role labelled by the title, children + footer present, and the
// no-stacking Back affordance when a sub-flow replaced the content.
export const Drawer = ({ isOpen, onClose, title, subtitle, footer, onBack, children }: any) =>
  isOpen
    ? React.createElement(
        'div',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        onBack ? React.createElement('button', { type: 'button', 'aria-label': 'Back', onClick: onBack }) : null,
        React.createElement('h2', null, title),
        subtitle ? React.createElement('p', null, subtitle) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', onClick: onClose }),
        children,
        footer ?? null,
      )
    : null;

// Real <table> so cell content, custom renderers, and empty/loading branches
// are observable in specs.
export const DataTable = ({ columns, rows, rowKey, loading, emptyState, onRowClick }: any) => {
  if (loading) return React.createElement('div', { 'data-testid': 'datatable-loading' });
  if (!rows || rows.length === 0) return emptyState ?? null;
  return React.createElement(
    'table',
    null,
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        columns.map((c: any) => React.createElement('th', { key: c.key }, c.header)),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      rows.map((row: any) =>
        React.createElement(
          'tr',
          { key: rowKey(row), onClick: onRowClick ? () => onRowClick(row) : undefined },
          columns.map((c: any) =>
            React.createElement('td', { key: c.key }, c.render ? c.render(row) : String(row[c.key] ?? '—')),
          ),
        ),
      ),
    ),
  );
};

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
