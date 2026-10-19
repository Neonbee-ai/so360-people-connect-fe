import React from 'react';
// Rendering stand-ins for Comb primitives/floorplans (Button, TextField, Card, ListPageTemplate, ...).
export * from './design-system.comb';
// Select mirrors Comb Select: label + native <select> built from `options`.
export const Select = ({ label, name, options = [], placeholder, hint, error, required, size, children, ...rest }: any) =>
  React.createElement(
    'div',
    null,
    label ? React.createElement('label', { htmlFor: name }, label) : null,
    React.createElement(
      'select',
      { id: name, name, required, ...rest },
      placeholder ? React.createElement('option', { value: '' }, placeholder) : null,
      ...options.map((o: any) => React.createElement('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label)),
    ),
    hint ? React.createElement('p', null, hint) : null,
    error ? React.createElement('p', null, error) : null,
  );
// Modal mirrors Comb Modal: renders only when open, dialog labelled by title, Close button.
export const Modal = ({ open, onClose, title, description, footer, children }: any) =>
  open
    ? React.createElement(
        'div',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        React.createElement('h2', null, title),
        description ? React.createElement('p', null, description) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', onClick: onClose }),
        children,
        footer,
      )
    : null;
// useConfirm mirrors Comb: [confirm(opts) => Promise<boolean>, dialogElement].
export const useConfirm = (): [(opts: any) => Promise<boolean>, any] => {
  const [state, setState] = React.useState<null | { opts: any; resolve: (v: boolean) => void }>(null);
  const confirm = (opts: any) => new Promise<boolean>((resolve) => setState({ opts, resolve }));
  const done = (v: boolean) => { state?.resolve(v); setState(null); };
  const el = state
    ? React.createElement(
        'div',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': state.opts.title },
        React.createElement('h3', null, state.opts.title),
        React.createElement('p', null, state.opts.message),
        React.createElement('button', { type: 'button', onClick: () => done(false) }, state.opts.cancelLabel || 'Cancel'),
        React.createElement('button', { type: 'button', onClick: () => done(true) }, state.opts.confirmLabel || 'Confirm'),
      )
    : null;
  return [confirm, el];
};
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);

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
export const DataTable = ({ columns, rows, rowKey, loading, emptyState, onRowClick, rowActions }: any) => {
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
        rowActions ? React.createElement('th', { key: '__actions' }) : null,
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
          rowActions
            ? React.createElement(
                'td',
                { key: '__actions', onClick: (e: any) => e.stopPropagation() },
                rowActions(row).map((it: any) =>
                  React.createElement('button', { key: it.label, type: 'button', disabled: it.disabled, onClick: it.onSelect }, it.label),
                ),
              )
            : null,
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

// Combobox mirrors Comb Combobox: role=combobox input, listbox opens on focus/click, typing filters
// (custom `filter` or label substring), options are role=option, clearable renders "Clear selection".
export const Combobox = ({ options = [], value = null, onChange, name, label, placeholder, disabled, clearable, emptyText = 'No results', filter, loadOptions, error, hint, 'data-testid': testId, 'aria-label': ariaLabel }: any) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [remote, setRemote] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (loadOptions && open) loadOptions(query).then(setRemote).catch(() => setRemote([]));
  }, [loadOptions, open, query]);
  const pool: any[] = loadOptions ? remote : options;
  const selected = [...options, ...remote].find((o: any) => o.value === value) ?? null;
  const visible = loadOptions
    ? pool
    : pool.filter((o: any) => !query.trim() || (filter ? filter(o, query) : o.label.toLowerCase().includes(query.toLowerCase())));
  const close = () => { setOpen(false); setQuery(''); };
  const commit = (o: any) => { onChange?.(o ? o.value : null, o); };
  return React.createElement(
    'div',
    null,
    label ? React.createElement('label', { htmlFor: name }, label) : null,
    React.createElement('input', {
      id: name, name, type: 'text', role: 'combobox', disabled, placeholder: open && selected ? selected.label : placeholder,
      'aria-label': ariaLabel ?? name, 'aria-expanded': open, 'data-testid': testId,
      value: open ? query : (selected?.label ?? ''),
      onChange: (e: any) => { setQuery(e.target.value); setOpen(true); },
      onFocus: () => !disabled && setOpen(true),
      onClick: () => !disabled && setOpen(true),
      onBlur: close,
      onKeyDown: (e: any) => { if (e.key === 'Escape') close(); },
    }),
    clearable && selected && !disabled
      ? React.createElement('button', { type: 'button', 'aria-label': 'Clear selection', onClick: () => commit(null) })
      : null,
    open
      ? React.createElement(
          'div',
          null,
          visible.length > 0
            ? React.createElement(
                'ul',
                { role: 'listbox', 'aria-label': ariaLabel ?? name },
                ...visible.map((o: any) =>
                  React.createElement(
                    'li',
                    { key: o.value, role: 'option', 'aria-selected': o.value === value, 'aria-disabled': o.disabled, onMouseDown: (e: any) => e.preventDefault(), onClick: () => { if (!o.disabled) { commit(o); close(); } } },
                    React.createElement('span', null, o.label),
                    o.description ? React.createElement('span', null, o.description) : null,
                  ),
                ),
              )
            : React.createElement('p', { role: 'status' }, emptyText),
        )
      : null,
    hint ? React.createElement('p', null, hint) : null,
    error ? React.createElement('p', null, error) : null,
  );
};
