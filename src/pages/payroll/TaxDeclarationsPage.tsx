import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, X, Check, RotateCcw } from 'lucide-react';
import { toast, Select, Button, IconButton, Card, Drawer, Stack, Cluster, TextField, Textarea, DataTable, ListPageTemplate } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/payroll/StatusChip';
import { payrollApi, TaxDeclaration, DeclarationStatus } from '../../services/payrollApi';

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

    const columns: DataTableColumn<TaxDeclaration>[] = [
        { key: 'person', header: 'Employee', render: d => d.person_name || d.person_id },
        { key: 'fiscal_year', header: 'Fiscal Year', render: d => d.fiscal_year },
        { key: 'regime', header: 'Regime', align: 'center', render: d => <span className="capitalize">{d.regime}</span> },
        { key: 'declared', header: 'Declared', align: 'right', render: d => formatters.formatCurrency(d.total_declared || 0) },
        { key: 'status', header: 'Status', align: 'center', render: d => <StatusChip status={d.status} /> },
        { key: 'actions', header: 'Actions', align: 'right', render: d => <Button variant="ghost" size="sm" onClick={() => openDetail(d)}>Review</Button> },
    ];

    return (
        <>
            <ListPageTemplate trail={[]}
                title="Tax Declarations"
                description="Review employee investment declarations"
                filterConfig={{
                    fields: [
                        { key: 'fiscal_year', label: 'Fiscal Year', type: 'text' },
                        { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                    ],
                    values: { fiscal_year: fiscalYear || undefined, status: status || undefined },
                    onChange: (v) => {
                        setFiscalYear((v.fiscal_year as string) || '');
                        setStatus((v.status as string) || '');
                    },
                    onClear: () => { setFiscalYear(''); setStatus(''); },
                }}
                loading={loading}
                isEmpty={!loading && declarations.length === 0}
                empty={
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No tax declarations"
                        description="Employee declarations appear here once submitted from their self-service portal."
                    />
                }
            >
                {!loading && declarations.length > 0 && (
                    <DataTable name="tax-declarations" rows={declarations} columns={columns} rowKey={d => d.id} />
                )}
            </ListPageTemplate>

            <DeclarationReviewDrawer
                declaration={selected}
                onClose={() => setSelected(null)}
                onChanged={() => { setSelected(null); load(); }}
                formatCurrency={formatters.formatCurrency}
            />
        </>
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
        <Drawer
            isOpen
            onClose={onClose}
            title={declaration.person_name || 'Declaration'}
            subtitle={`FY ${declaration.fiscal_year}`}
            size="md"
            footer={
                <Cluster gap="tight" justify="end">
                    <Button onClick={() => decide('approve')} disabled={busy}><Check size={14} /> Approve</Button>
                    <Button variant="danger" onClick={() => decide('reject')} disabled={busy}><X size={14} /> Reject</Button>
                    <Button variant="secondary" onClick={() => decide('reopen')} disabled={busy}><RotateCcw size={14} /> Reopen</Button>
                </Cluster>
            }
        >
            <Stack gap="default">
                <Cluster gap="tight" align="center">
                    <span className="text-nb-caption text-fg-muted capitalize">{declaration.regime} regime</span>
                    <StatusChip status={declaration.status} />
                </Cluster>

                {(declaration.items || []).length === 0 ? (
                    <p className="text-nb-body text-fg-muted">No declaration items.</p>
                ) : (
                    (declaration.items || []).map(item => (
                        <Card key={item.id} name={`declaration-item-${item.id}`}>
                            <Stack gap="tight">
                                <Cluster gap="default" justify="between" align="center">
                                    <span className="text-nb-caption text-fg-muted">{item.category}</span>
                                    {item.status && <StatusChip status={item.status} />}
                                </Cluster>
                                {item.description && <p className="text-nb-body text-fg">{item.description}</p>}
                                <Cluster gap="default" justify="between" align="center">
                                    <span className="text-fg-muted">Declared</span>
                                    <span className="text-fg">{formatCurrency(item.declared_amount)}</span>
                                </Cluster>
                                <Cluster gap="tight" align="center">
                                    <TextField
                                        name={`approved-amount-${item.id}`}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder={`Approved amount (default ${item.declared_amount})`}
                                        value={approvedAmounts[item.id || ''] ?? (item.approved_amount != null ? String(item.approved_amount) : '')}
                                        onChange={e => setApprovedAmounts(prev => ({ ...prev, [item.id || '']: e.target.value }))}
                                        aria-label={`Approved amount for ${item.category}`}
                                    />
                                    <IconButton icon={<Check size={14} />} label={`Approve ${item.category}`} hideTooltip disabled={busy} onClick={() => item.id && reviewItem(item.id, 'approved')} />
                                    <IconButton icon={<X size={14} />} label={`Reject ${item.category}`} hideTooltip variant="danger" disabled={busy} onClick={() => item.id && reviewItem(item.id, 'rejected')} />
                                </Cluster>
                            </Stack>
                        </Card>
                    ))
                )}

                <Textarea name="review_notes" label="Review Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </Stack>
        </Drawer>
    );
};

export default TaxDeclarationsPage;
