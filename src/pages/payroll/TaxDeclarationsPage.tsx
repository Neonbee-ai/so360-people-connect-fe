import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, X, Check, RotateCcw } from 'lucide-react';
import { toast, Select } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/payroll/StatusChip';
import { payrollApi, TaxDeclaration, DeclarationStatus } from '../../services/payrollApi';

const inputCls = 'px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';

const STATUS_OPTIONS: DeclarationStatus[] = ['submitted', 'under_review', 'approved', 'rejected', 'reopened', 'draft'];

const TaxDeclarationsPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD', timezone: settings?.timezone || 'UTC' });
    const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [fiscalYear, setFiscalYear] = useState('');
    const [status, setStatus] = useState('');
    const [selected, setSelected] = useState<TaxDeclaration | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.taxDeclarations.list({
                fiscal_year: fiscalYear || undefined,
                status: (status || undefined) as DeclarationStatus | undefined,
            });
            setDeclarations(result.data);
        } catch {
            toast.error('Failed to load tax declarations');
        } finally {
            setLoading(false);
        }
    }, [fiscalYear, status]);

    useEffect(() => { load(); }, [load]);

    const openDetail = async (declaration: TaxDeclaration) => {
        try {
            const full = await payrollApi.employees.taxDeclarations.get(declaration.person_id, declaration.fiscal_year);
            setSelected({ ...full, person_name: full.person_name || declaration.person_name });
        } catch {
            toast.error('Failed to load declaration detail');
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="Tax Declarations" subtitle="Review employee investment declarations" />

            {/* Filters */}
            <div className="flex items-end gap-3">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Fiscal Year</label>
                    <input type="text" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} placeholder="2026-27" className={inputCls} />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Status</label>
                    <Select name="taxdeclarations-select-91" value={status} onChange={e => setStatus(e.target.value)} options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]} />
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-surface-raised/50 rounded-nb animate-pulse" />)}
                </div>
            ) : declarations.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="No tax declarations"
                    description="Employee declarations appear here once submitted from their self-service portal."
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Fiscal Year</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Regime</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Declared</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {declarations.map(declaration => (
                                <tr key={declaration.id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-fg">{declaration.person_name || declaration.person_id}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{declaration.fiscal_year}</td>
                                    <td className="px-4 py-3 text-center text-sm text-fg-muted uppercase">{declaration.regime}</td>
                                    <td className="px-4 py-3 text-right text-sm text-fg">{formatters.formatCurrency(declaration.total_declared || 0)}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={declaration.status} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => openDetail(declaration)} className="text-xs text-primary hover:text-primary transition-colors">Review</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <DeclarationReviewDrawer
                declaration={selected}
                onClose={() => setSelected(null)}
                onChanged={() => { setSelected(null); load(); }}
                formatCurrency={formatters.formatCurrency}
            />
        </div>
    );
};

// =============================================================================
// Review drawer — per-item approve/reject + overall decision
// =============================================================================

const DeclarationReviewDrawer: React.FC<{
    declaration: TaxDeclaration | null;
    onClose: () => void;
    onChanged: () => void;
    formatCurrency: (v: number) => string;
}> = ({ declaration, onClose, onChanged, formatCurrency }) => {
    const [notes, setNotes] = useState('');
    const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => { setNotes(''); setApprovedAmounts({}); }, [declaration?.id]);

    if (!declaration) return null;

    const reviewItem = async (itemId: string, itemStatus: 'approved' | 'rejected') => {
        try {
            setBusy(true);
            const raw = approvedAmounts[itemId];
            await payrollApi.employees.taxDeclarations.reviewItem(declaration.person_id, declaration.fiscal_year, itemId, {
                status: itemStatus,
                approved_amount: itemStatus === 'approved' && raw ? parseFloat(raw) : undefined,
            });
            toast.success(`Item ${itemStatus}`);
        } catch {
            toast.error('Failed to review item');
        } finally {
            setBusy(false);
        }
    };

    const decide = async (action: 'approve' | 'reject' | 'reopen') => {
        try {
            setBusy(true);
            await payrollApi.employees.taxDeclarations.review(declaration.person_id, declaration.fiscal_year, { action, notes: notes || undefined });
            toast.success(`Declaration ${action === 'reopen' ? 'reopened' : `${action}d`}`);
            onChanged();
        } catch {
            toast.error('Failed to update declaration');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[600] flex justify-end">
            <div className="fixed inset-0 bg-overlay/60 backdrop-blur-sm" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-label="Tax declaration review" className="relative w-full max-w-lg h-full bg-surface border-l border-line shadow-2xl overflow-y-auto">
                <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-base font-semibold text-fg">{declaration.person_name || 'Declaration'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-fg-muted">FY {declaration.fiscal_year}</span>
                            <span className="text-xs text-fg-muted uppercase">{declaration.regime} regime</span>
                            <StatusChip status={declaration.status} />
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-nb text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {(declaration.items || []).length === 0 ? (
                        <p className="text-sm text-fg-muted">No declaration items.</p>
                    ) : (
                        (declaration.items || []).map(item => (
                            <div key={item.id} className="bg-surface-raised/50 border border-line-strong rounded-nb p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{item.category}</span>
                                    {item.status && <StatusChip status={item.status} />}
                                </div>
                                {item.description && <p className="text-sm text-fg">{item.description}</p>}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-fg-muted">Declared</span>
                                    <span className="text-fg">{formatCurrency(item.declared_amount)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder={`Approved amount (default ${item.declared_amount})`}
                                        value={approvedAmounts[item.id || ''] ?? (item.approved_amount != null ? String(item.approved_amount) : '')}
                                        onChange={e => setApprovedAmounts(prev => ({ ...prev, [item.id || '']: e.target.value }))}
                                        className="flex-1 px-3 py-1.5 bg-surface-raised border border-line-strong rounded-nb text-xs text-fg focus:outline-none focus:border-primary"
                                        aria-label={`Approved amount for ${item.category}`}
                                    />
                                    <button onClick={() => item.id && reviewItem(item.id, 'approved')} disabled={busy} aria-label={`Approve ${item.category}`} className="p-1.5 rounded-nb bg-success/10 text-success hover:bg-success/20 transition-colors"><Check size={14} /></button>
                                    <button onClick={() => item.id && reviewItem(item.id, 'rejected')} disabled={busy} aria-label={`Reject ${item.category}`} className="p-1.5 rounded-nb bg-danger/10 text-danger hover:bg-danger-hover/20 transition-colors"><X size={14} /></button>
                                </div>
                            </div>
                        ))
                    )}

                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Review Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary" />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line">
                        <button onClick={() => decide('approve')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors">
                            <Check size={14} /> Approve
                        </button>
                        <button onClick={() => decide('reject')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-danger/10 hover:bg-danger-hover/20 border border-danger/30 disabled:opacity-50 text-danger text-sm font-medium rounded-nb transition-colors">
                            <X size={14} /> Reject
                        </button>
                        <button onClick={() => decide('reopen')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-raised hover:bg-line border border-line-strong disabled:opacity-50 text-fg text-sm font-medium rounded-nb transition-colors">
                            <RotateCcw size={14} /> Reopen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaxDeclarationsPage;
