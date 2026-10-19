import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Send, ClipboardCheck, CheckCircle, Circle } from 'lucide-react';
import { toast, Button, IconButton, Card, Modal, Stack, Cluster, Skeleton, TextField, NumberInput, FormPageTemplate } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import StatusChip from '../../components/payroll/StatusChip';
import FieldTooltip from '../../components/payroll/FieldTooltip';
import { payrollApi, TaxDeclaration, TaxDeclarationItem } from '../../services/payrollApi';

const CATEGORIES: { key: string; label: string; tooltip: string }[] = [
    { key: '80C', label: 'Section 80C', tooltip: 'Investments like PPF, ELSS, life insurance premium and home-loan principal, up to the 80C limit.' },
    { key: '80D', label: 'Section 80D', tooltip: 'Health insurance premiums for you and your family.' },
    { key: 'HRA_RENT', label: 'House Rent', tooltip: 'Rent paid, used to compute your HRA exemption.' },
    { key: 'HOME_LOAN_INTEREST', label: 'Home Loan Interest', tooltip: 'Interest paid on a housing loan.' },
    { key: 'OTHER_INCOME', label: 'Other Income', tooltip: 'Income outside salary you want considered for tax, e.g. freelance income.' },
    { key: 'INTEREST_INCOME', label: 'Interest Income', tooltip: 'Interest earned from savings accounts and deposits.' },
];

/** Current Indian fiscal year label, e.g. 2026-27 (FY starts in April). */
export function currentFiscalYear(today = new Date()): string {
    const year = today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

const STATUS_TIMELINE = ['draft', 'submitted', 'under_review', 'approved'] as const;

const MyTaxDeclarationPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD', timezone: settings?.timezone || 'UTC' });
    const [fiscalYear] = useState(currentFiscalYear());
    const [declaration, setDeclaration] = useState<TaxDeclaration | null>(null);
    const [items, setItems] = useState<TaxDeclarationItem[]>([]);
    const [regime, setRegime] = useState<'new' | 'old'>('new');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.my.taxDeclarations.get(fiscalYear);
            setDeclaration(result);
            setItems(result.items || []);
            setRegime(result.regime || 'new');
        } catch {
            // No declaration yet for this FY — start fresh.
            setDeclaration(null);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [fiscalYear]);

    useEffect(() => { load(); }, [load]);

    const editable = !declaration || declaration.status === 'draft' || declaration.status === 'reopened' || declaration.status === 'rejected';
    const totalDeclared = useMemo(() => items.reduce((sum, item) => sum + (Number(item.declared_amount) || 0), 0), [items]);

    const addItem = (category: string) =>
        setItems(prev => [...prev, { category, description: '', declared_amount: 0 }]);
    const updateItem = (index: number, patch: Partial<TaxDeclarationItem>) =>
        setItems(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    const removeItem = (index: number) =>
        setItems(prev => prev.filter((_, i) => i !== index));

    const save = async (): Promise<boolean> => {
        try {
            setSaving(true);
            const saved = await payrollApi.my.taxDeclarations.save(fiscalYear, { regime, items });
            setDeclaration(saved);
            toast.success('Declaration saved');
            return true;
        } catch {
            toast.error('Failed to save declaration');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const submit = async () => {
        const saved = await save();
        if (!saved) { setShowSubmitConfirm(false); return; }
        try {
            setSaving(true);
            await payrollApi.my.taxDeclarations.submit(fiscalYear);
            toast.success('Declaration submitted for review');
            setShowSubmitConfirm(false);
            load();
        } catch {
            toast.error('Failed to submit declaration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Skeleton variant="rect" className="h-96" />;
    }

    const statusIndex = declaration ? STATUS_TIMELINE.indexOf(declaration.status as typeof STATUS_TIMELINE[number]) : 0;

    return (
        <>
            <FormPageTemplate
                title="My Tax Declaration"
                description={`Fiscal year ${fiscalYear}`}
                status={declaration ? <StatusChip status={declaration.status} /> : undefined}
                secondaryAction={editable ? (
                    <Button variant="secondary" onClick={save} disabled={saving}>Save Draft</Button>
                ) : undefined}
                primaryAction={editable ? (
                    <Button onClick={() => setShowSubmitConfirm(true)} disabled={saving || items.length === 0}>
                        <Send size={14} /> Submit Declaration
                    </Button>
                ) : undefined}
            >
                <Stack gap="default">
                    {/* Status timeline */}
                    <Card name="status-timeline">
                        <Cluster gap="default" align="center" wrap>
                            {STATUS_TIMELINE.map((step, index) => {
                                const done = statusIndex > index || declaration?.status === 'approved';
                                const current = statusIndex === index;
                                return (
                                    <Cluster key={step} gap="tight" align="center">
                                        {done ? <CheckCircle className="size-4 text-primary" /> : <Circle className={`size-4 ${current ? 'text-primary' : 'text-fg-subtle'}`} />}
                                        <span className={`text-nb-caption capitalize ${done || current ? 'text-primary' : 'text-fg-subtle'}`}>
                                            {step.replace(/_/g, ' ')}
                                        </span>
                                    </Cluster>
                                );
                            })}
                        </Cluster>
                        {declaration?.review_notes && (
                            <p className="text-nb-caption text-warning mt-3">Reviewer notes: {declaration.review_notes}</p>
                        )}
                    </Card>

                    {/* Regime */}
                    <Card name="tax-regime">
                        <Cluster gap="default" justify="between" align="center">
                            <Cluster gap="tight" align="center">
                                <span className="text-nb-body text-fg">Tax Regime</span>
                                <FieldTooltip text="The new regime has lower rates but fewer deductions; the old regime allows deductions like 80C and HRA. Your declarations only reduce tax under the old regime." />
                            </Cluster>
                            <Cluster gap="tight" align="center">
                                {(['new', 'old'] as const).map(r => (
                                    <Button
                                        key={r}
                                        size="sm"
                                        variant={regime === r ? 'secondary' : 'ghost'}
                                        disabled={!editable}
                                        onClick={() => setRegime(r)}
                                    >
                                        {r === 'new' ? 'New Regime' : 'Old Regime'}
                                    </Button>
                                ))}
                            </Cluster>
                        </Cluster>
                    </Card>

                    {/* Items grouped by category */}
                    {CATEGORIES.map(category => {
                        const categoryItems = items
                            .map((item, index) => ({ item, index }))
                            .filter(({ item }) => item.category === category.key);
                        return (
                            <Card
                                key={category.key}
                                name={`category-${category.key}`}
                                padding="md"
                            >
                                <Stack gap="default">
                                    <Cluster gap="default" justify="between" align="center">
                                        <Cluster gap="tight" align="center">
                                            <h4 className="text-nb-title text-fg">{category.label}</h4>
                                            <FieldTooltip text={category.tooltip} />
                                        </Cluster>
                                        {editable && (
                                            <Button variant="ghost" size="sm" onClick={() => addItem(category.key)}>
                                                <Plus size={12} /> Add
                                            </Button>
                                        )}
                                    </Cluster>
                                    {categoryItems.length === 0 ? (
                                        <p className="text-nb-caption text-fg-subtle">Nothing declared under {category.label}.</p>
                                    ) : (
                                        <Stack gap="tight">
                                            {categoryItems.map(({ item, index }) => (
                                                <Cluster key={index} gap="tight" align="center">
                                                    <TextField
                                                        name={`description-${index}`}
                                                        placeholder="Description (e.g. LIC premium)"
                                                        disabled={!editable}
                                                        value={item.description || ''}
                                                        onChange={e => updateItem(index, { description: e.target.value })}
                                                    />
                                                    <NumberInput
                                                        name={`declared-amount-${index}`}
                                                        min={0}
                                                        step={0.01}
                                                        stepper={false}
                                                        disabled={!editable}
                                                        value={item.declared_amount || null}
                                                        onChange={v => updateItem(index, { declared_amount: v ?? 0 })}
                                                        aria-label={`${category.label} declared amount`}
                                                    />
                                                    {item.status && <StatusChip status={item.status} />}
                                                    {editable && (
                                                        <IconButton icon={<Trash2 size={13} />} label="Remove item" variant="ghost" onClick={() => removeItem(index)} />
                                                    )}
                                                </Cluster>
                                            ))}
                                        </Stack>
                                    )}
                                </Stack>
                            </Card>
                        );
                    })}

                    {/* Totals */}
                    <Card name="totals">
                        <div className="text-nb-body text-fg">
                            Total declared: <span className="text-fg">{formatters.formatCurrency(totalDeclared)}</span>
                        </div>
                    </Card>

                    {!editable && declaration && (
                        <Card name="locked-notice">
                            <Cluster gap="tight" align="center">
                                <ClipboardCheck size={15} className="text-primary" />
                                <span className="text-nb-body text-fg-muted">
                                    Your declaration is {declaration.status.replace(/_/g, ' ')} and can no longer be edited. Contact HR if something needs to change.
                                </span>
                            </Cluster>
                        </Card>
                    )}
                </Stack>
            </FormPageTemplate>

            <Modal
                open={showSubmitConfirm}
                onClose={() => setShowSubmitConfirm(false)}
                title="Submit Tax Declaration"
                size="sm"
                footer={
                    <Cluster gap="default" justify="end">
                        <Button variant="ghost" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
                        <Button onClick={submit} disabled={saving}>Submit</Button>
                    </Cluster>
                }
            >
                <p className="text-nb-body text-fg">
                    Submit your FY {fiscalYear} declaration ({formatters.formatCurrency(totalDeclared)} declared)?
                    After submission you cannot edit it unless HR reopens it.
                </p>
            </Modal>
        </>
    );
};

export default MyTaxDeclarationPage;
