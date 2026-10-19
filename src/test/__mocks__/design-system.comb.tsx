/**
 * Rendering stand-ins for Comb (@so360/design-system) primitives and floorplans.
 * Faithful enough for behavioural assertions (roles, labels, handlers, slots) —
 * NOT visual. Real DS contracts mirrored: Button -> <button>, TextField ->
 * label+input, Switch -> role="switch", templates render title/actions/content.
 * Add new stubs by appending below (grep first: a duplicate export name breaks the build).
 */
import React from 'react';

const tid = (p: any) => p['data-testid'];

export const Button = ({ variant, size, loading, children, type = 'button', ...rest }: any) => (
  <button type={type} {...rest} disabled={rest.disabled || loading} data-variant={variant}>
    {children}
  </button>
);

export const IconButton = ({ label, icon, variant, size, tooltipSide, hideTooltip, selected, loading, type = 'button', ...rest }: any) => (
  <button type={type} aria-label={label} title={label} aria-pressed={selected} {...rest} disabled={rest.disabled || loading}>
    {icon}
  </button>
);

export const Input = (props: any) => <input {...props} />;

export const TextField = ({ label, name, hint, error, required, size, leadingIcon, 'data-testid': testId, ...rest }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <input id={name} name={name} required={required} data-testid={testId} {...rest} />
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

export const Textarea = ({ label, name, hint, error, required, size, 'data-testid': testId, ...rest }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <textarea id={name} name={name} required={required} data-testid={testId} {...rest} />
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

export const Checkbox = ({ label, name, description, indeterminate, hideLabel, 'data-testid': testId, ...rest }: any) => (
  <div>
    <input type="checkbox" id={name} name={name} aria-label={hideLabel ? label : undefined} data-testid={testId} {...rest} />
    {!hideLabel ? <label htmlFor={name}>{label}</label> : null}
    {description ? <p>{description}</p> : null}
  </div>
);

export const Switch = ({ label, name, checked, onCheckedChange, description, hideLabel, labelPosition, 'data-testid': testId, ...rest }: any) => (
  <div>
    <button type="button" role="switch" id={name} name={name} aria-checked={!!checked} aria-label={label} data-testid={testId} onClick={() => onCheckedChange?.(!checked)} {...rest} />
    {!hideLabel ? <span>{label}</span> : null}
    {description ? <span>{description}</span> : null}
  </div>
);

export const NumberInput = ({ label, name, value, onChange, hint, error, min, max, step, required, disabled, readOnly, placeholder, 'data-testid': testId, 'aria-label': ariaLabel }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <input
      type="number" id={name} name={name} value={value ?? ''} min={min} max={max} step={step} required={required}
      disabled={disabled} readOnly={readOnly} placeholder={placeholder} aria-label={ariaLabel} data-testid={testId}
      onChange={(e: any) => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
    />
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

export const DateInput = ({ label, name, value, onChange, hint, error, min, max, required, disabled, placeholder, 'data-testid': testId, 'aria-label': ariaLabel }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <input
      type="date" id={name} name={name} value={value ?? ''} min={min} max={max} required={required} disabled={disabled}
      placeholder={placeholder} aria-label={ariaLabel} data-testid={testId} onChange={(e: any) => onChange?.(e.target.value)}
    />
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

export const SearchInput = ({ value, defaultValue, onChange, onSearch, onClear, placeholder, name, 'data-testid': testId, 'aria-label': ariaLabel }: any) => (
  <>
    <input
      type="search" name={name} value={value} defaultValue={defaultValue} placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? 'Search'} data-testid={testId}
      onChange={(e: any) => onChange?.(e.target.value)}
      onKeyDown={(e: any) => { if (e.key === 'Enter') onSearch?.(e.target.value); }}
    />
    {value ? <button type="button" aria-label="Clear search" onClick={() => { onChange?.(''); onClear?.(); }} /> : null}
  </>
);

export const RadioGroup = ({ label, name, options = [], value, onChange, 'data-testid': testId }: any) => (
  <div role="radiogroup" aria-label={label} data-testid={testId}>
    {options.map((o: any) => (
      <label key={o.value}>
        <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange?.(o.value)} />
        {o.label}
      </label>
    ))}
  </div>
);

export const FormField = ({ label, children, hint, error }: any) => (
  <div>
    {label ? <label>{label}</label> : null}
    {children}
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

export const Card = ({ title, actions, footer, children, 'data-testid': testId }: any) => (
  <section data-testid={testId}>
    {title ? <h2>{title}</h2> : null}
    {actions}
    {children}
    {footer}
  </section>
);
export const SectionCard = Card;

export const KpiCard = ({ label, value, hint, icon: Icon, onClick, loading, 'data-testid': testId }: any) => (
  <div data-testid={testId} onClick={onClick}>
    {Icon ? <Icon /> : null}
    <span>{label}</span>
    <span>{loading ? '…' : value}</span>
    {hint ? <span>{hint}</span> : null}
  </div>
);
export const StatCard = KpiCard;

export const Badge = ({ tone, size, dot, variant, shape, children, 'data-testid': testId, ...rest }: any) => (
  <span data-testid={testId} data-tone={tone} {...rest}>{children}</span>
);
export const StatusBadge = ({ status, 'data-testid': testId }: any) => <span data-testid={testId}>{status}</span>;
export const Chip = ({ label, children, onRemove, 'data-testid': testId }: any) => (
  <span data-testid={testId}>{label ?? children}{onRemove ? <button type="button" aria-label="Remove" onClick={onRemove} /> : null}</span>
);

export const EmptyState = ({ title, description, action, icon: Icon, 'data-testid': testId }: any) => (
  <div data-testid={testId}>
    {Icon ? <Icon /> : null}
    <p>{title}</p>
    {description ? <p>{description}</p> : null}
    {action ? <button type="button" data-testid={action['data-testid']} onClick={action.onClick}>{action.label}</button> : null}
  </div>
);

export const Skeleton = ({ 'data-testid': testId }: any) => <div data-testid={testId ?? 'skeleton'} aria-busy="true" />;
export const Spinner = ({ 'aria-label': ariaLabel }: any) => <span role="status" aria-label={ariaLabel ?? 'Loading'} />;
export const Tooltip = ({ children }: any) => children;
export const QuotaBar = () => null;

export const Pagination = ({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: any) => (
  <nav aria-label="Pagination">
    <span>{totalItems} items</span>
    <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange?.(currentPage - 1)}>Previous</button>
    <span>Page {currentPage} of {totalPages}</span>
    <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(currentPage + 1)}>Next</button>
    {onPageSizeChange ? (
      <select aria-label="Rows per page" value={pageSize} onChange={(e: any) => onPageSizeChange(Number(e.target.value))}>
        {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    ) : null}
  </nav>
);

export const Tabs = ({ items = [], value, defaultValue, onChange, children, end, 'data-testid': testId }: any) => {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.id);
  const active = value ?? inner;
  return (
    <div data-testid={testId}>
      <div role="tablist">
        {items.map((t: any) => (
          <button
            key={t.id} type="button" role="tab" aria-selected={active === t.id} disabled={t.disabled}
            onClick={() => { setInner(t.id); onChange?.(t.id); }}
          >
            {t.label}{t.count != null ? ` ${t.count}` : ''}
          </button>
        ))}
        {end}
      </div>
      {typeof children === 'function' ? children(active) : null}
    </div>
  );
};

export const SegmentedControl = ({ options = [], value, onChange, 'aria-label': ariaLabel, 'data-testid': testId }: any) => (
  <div role="group" aria-label={ariaLabel} data-testid={testId}>
    {options.map((o: any) => (
      <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.hideLabel ? o.label : undefined} disabled={o.disabled} onClick={() => onChange?.(o.value)}>
        {o.hideLabel ? null : o.label}
      </button>
    ))}
  </div>
);

export const Menu = ({ trigger, items = [] }: any) => (
  <>
    {trigger}
    {items.map((it: any) => (
      <button key={it.label} type="button" disabled={it.disabled} onClick={it.onSelect}>{it.label}</button>
    ))}
  </>
);

export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, onClose }: any) =>
  open ? (
    <div role="dialog" aria-modal="true" aria-label={title}>
      <h3>{title}</h3>
      <p>{message}</p>
      <button type="button" onClick={onCancel ?? onClose}>{cancelLabel}</button>
      <button type="button" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ) : null;

export const Banner = ({ title, children, action, onDismiss, variant }: any) => (
  <div role={variant === 'error' || variant === 'danger' ? 'alert' : 'status'}>
    {title ? <p>{title}</p> : null}
    {children}
    {action ? <button type="button" onClick={action.onClick}>{action.label}</button> : null}
    {onDismiss ? <button type="button" aria-label="Dismiss" onClick={onDismiss} /> : null}
  </div>
);

export const Progress = ({ value, max = 100, label }: any) => <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemax={max} />;
export const Avatar = ({ name }: any) => <span aria-label={name}>{name ? String(name).slice(0, 2).toUpperCase() : ''}</span>;
export const Divider = () => <hr />;

export const DescriptionList = ({ items = [], title, emptyValue = '—', 'data-testid': testId }: any) => (
  <dl data-testid={testId} aria-label={title}>
    {items.filter((i: any) => !i.hidden).map((i: any) => (
      <div key={i.label}>
        <dt>{i.label}</dt>
        <dd>{i.value ?? emptyValue}</dd>
      </div>
    ))}
  </dl>
);

// ---- layout primitives -------------------------------------------------
const Pass = ({ children, 'data-testid': testId }: any) => <div data-testid={testId}>{children}</div>;
export const PageContainer = Pass;
export const Grid = Pass;
export const GridItem = Pass;
export const Stack = Pass;
export const Cluster = Pass;
export const Region = Pass;
export const Split = ({ children, side }: any) => <div>{children}{side}</div>;
export const FieldGrid = Pass;
export const FieldGridItem = Pass;
export const IconTile = () => null;

export const FormSection = ({ title, description, actions, children }: any) => (
  <section aria-label={title}>
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
    {actions}
    {children}
  </section>
);

export const FormActions = ({ submitLabel = 'Save', onSubmit, submitting, submitDisabled, onCancel, cancelLabel = 'Cancel', children, form }: any) => (
  <div>
    {onCancel ? <button type="button" onClick={onCancel}>{cancelLabel}</button> : null}
    {children}
    <button type={onSubmit ? 'button' : 'submit'} form={form} onClick={onSubmit} disabled={submitting || submitDisabled}>{submitLabel}</button>
  </div>
);

// ---- page header + floorplans -----------------------------------------
const Header = ({ title, description, count, status, meta, onBack, backLabel, trail, primaryAction, secondaryActions, headerSecondaryActions, overflowActions, collapsibleActions, metaItems, breadcrumbs, actions }: any) => (
  <header data-slot="header">
    {onBack ? <button type="button" aria-label={backLabel ?? 'Back'} onClick={onBack} /> : null}
    {Array.isArray(trail) ? trail.map((t: any) => <span key={t.label}>{t.label}</span>) : null}
    <h1>{title}</h1>
    {count != null ? <span>{count}</span> : null}
    {description ? <p>{description}</p> : null}
    {status}
    {meta}
    {(metaItems ?? []).map((m: any) => <span key={m.id}>{m.label ? `${m.label} ` : null}{m.content}</span>)}
    {(breadcrumbs ?? []).map((b: any) => <span key={b.label}>{b.label}</span>)}
    {actions}
    {(collapsibleActions ?? []).map((a: any) => (a.node ? <React.Fragment key={a.id}>{a.node}</React.Fragment> : <button key={a.id} type="button" onClick={a.menuItem?.onSelect}>{a.menuItem?.label}</button>))}
    {Array.isArray(secondaryActions) ? secondaryActions.map((a: any, i: number) => <React.Fragment key={i}>{a}</React.Fragment>) : null}
    {Array.isArray(headerSecondaryActions) ? headerSecondaryActions.map((a: any, i: number) => <React.Fragment key={i}>{a}</React.Fragment>) : null}
    {primaryAction}
    {(overflowActions ?? []).map((it: any) => (
      <button key={it.label} type="button" disabled={it.disabled} onClick={it.onSelect}>{it.label}</button>
    ))}
  </header>
);
export const PageHeader = Header;

const filterControl = (f: any, cfg: any) => {
  const v = cfg.values?.[f.key];
  const set = (next: any) => cfg.onChange({ ...cfg.values, [f.key]: next });
  if (f.type === 'select' || f.type === 'multiselect') {
    return (
      <label key={f.key}>
        {f.label}
        <select aria-label={f.label} value={(v as string) ?? ''} onChange={(e: any) => set(e.target.value || undefined)}>
          <option value="">All</option>
          {(f.options ?? []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    );
  }
  if (f.type === 'custom' && f.render) return <React.Fragment key={f.key}>{f.render(v, set)}</React.Fragment>;
  return (
    <label key={f.key}>
      {f.label}
      <input aria-label={f.label} value={(v as string) ?? ''} onChange={(e: any) => set(e.target.value || undefined)} />
    </label>
  );
};

export const ListFilters = (cfg: any) => (
  <div data-testid="list-filters">
    {(cfg.fields ?? []).map((f: any) => filterControl(f, cfg))}
    <button type="button" onClick={cfg.onClear}>Clear all</button>
  </div>
);

export const ListPageTemplate = (p: any) => {
  const empty = !p.loading && (p.isFilteredEmpty || (p.isEmpty ?? p.empty !== undefined));
  return (
    <section data-template="list" data-testid="list-page-template">
      <Header {...p} headerSecondaryActions={p.headerSecondaryActions} overflowActions={[...(p.secondaryActions ?? []), ...(p.overflowActions ?? [])]} secondaryActions={undefined} />
      {p.kpis}
      <div data-slot="toolbar">
        {p.selectedCount > 0 ? (
          <>
            <span>{p.selectedCount} selected</span>
            {p.bulkActions}
            {p.onClearSelection ? <button type="button" onClick={p.onClearSelection}>Clear selection</button> : null}
          </>
        ) : (
          <>
            {p.views}
            {p.search}
            {p.filterConfig ? <ListFilters {...p.filterConfig} /> : null}
            {p.filters}
            {p.toolbar}
            {p.viewSwitcher && p.viewSwitcher.options?.length > 1 ? (
              <SegmentedControl {...p.viewSwitcher} />
            ) : null}
            {p.toolbarEnd}
          </>
        )}
      </div>
      <div data-slot="content">
        {p.loading ? (
          <div role="status" aria-busy="true">Loading…</div>
        ) : empty ? (
          p.isFilteredEmpty ? (
            <EmptyState title="No results match your filters" action={p.onClearFilters ? { label: 'Clear filters', onClick: p.onClearFilters } : undefined} />
          ) : (
            p.empty ?? <EmptyState title="Nothing here yet" />
          )
        ) : (
          p.children
        )}
      </div>
      {p.pagination}
      {p.footer}
    </section>
  );
};

export const DetailPageTemplate = (p: any) => (
  <section data-template="detail" data-testid="detail-page-template">
    <Header {...p} secondaryActions={p.secondaryActions} />
    {Array.isArray(p.tabs) ? (
      <div role="tablist">
        {p.tabs.map((t: any) => (
          <button key={t.id} type="button" role="tab" aria-selected={p.activeTab === t.id} onClick={() => p.onTabChange?.(t.id)}>{t.label}</button>
        ))}
      </div>
    ) : null}
    {p.loading ? <div role="status" aria-busy="true">Loading…</div> : <>{p.children}{p.sidePanel}</>}
  </section>
);

export const FormPageTemplate = (p: any) => (
  <section data-template="form" data-testid="form-page-template">
    <Header {...p} />
    {p.children}
    <footer data-slot="footer">
      {p.onCancel ? <button type="button" onClick={p.onCancel}>{p.cancelLabel ?? 'Cancel'}</button> : null}
      {p.secondaryAction}
      {p.destructiveAction}
      {p.primaryAction}
    </footer>
  </section>
);

export const SettingsCard = ({ title, description, actions, children }: any) => (
  <section aria-label={title}>
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
    {children}
    {actions}
  </section>
);

export const SettingsPageTemplate = (p: any) => (
  <section data-template="settings" data-testid="settings-page-template">
    <Header {...p} />
    {Array.isArray(p.sections) ? (
      <nav>
        {p.sections.map((s: any) => (
          <button key={s.id} type="button" aria-current={p.activeSection === s.id} onClick={() => p.onSectionChange?.(s.id)}>{s.label}</button>
        ))}
      </nav>
    ) : null}
    {p.children}
  </section>
);

export const DashboardPageTemplate = (p: any) => (
  <section data-template="dashboard" data-testid="dashboard-page-template">
    <Header {...p} secondaryActions={undefined} actions={p.secondaryActions} />
    {p.filters}
    {p.toolbarEnd}
    {p.kpis}
    {p.primary}
    {p.secondary}
    {p.bottom}
    {p.children}
  </section>
);

export const ColorPicker = ({ label, name, value, onChange, 'data-testid': testId }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <input type="color" id={name} name={name} value={value ?? '#000000'} data-testid={testId} onChange={(e: any) => onChange?.(e.target.value)} />
  </div>
);

// TimePicker mirrors Comb TimePicker: label + time input, onChange gets 'HH:mm'.
export const TimePicker = ({ label, name, value, onChange, hint, error, required, disabled, placeholder, 'data-testid': testId, 'aria-label': ariaLabel }: any) => (
  <div>
    {label ? <label htmlFor={name}>{label}</label> : null}
    <input
      type="time" id={name} name={name} value={value ?? ''} required={required} disabled={disabled}
      placeholder={placeholder} aria-label={ariaLabel} data-testid={testId} onChange={(e: any) => onChange?.(e.target.value)}
    />
    {hint ? <p>{hint}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
);

// Rating: readOnly renders role="img"; interactive renders one button per star.
export const Rating = ({ value = 0, onChange, max = 5, readOnly, label, name, 'aria-label': ariaLabel, 'data-testid': testId }: any) =>
  readOnly ? (
    <span role="img" data-testid={testId} aria-label={ariaLabel ?? label ?? `${value} of ${max}`} />
  ) : (
    <div data-testid={testId} role="group" aria-label={ariaLabel ?? label ?? name}>
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} type="button" aria-label={`${i + 1} star${i === 0 ? '' : 's'}`} aria-pressed={value >= i + 1} onClick={() => onChange?.(i + 1)} />
      ))}
    </div>
  );
