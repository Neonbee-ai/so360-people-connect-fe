import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Send, ClipboardCheck, CheckCircle, Circle } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import StatusChip from '../../components/payroll/StatusChip';
import FieldTooltip from '../../components/payroll/FieldTooltip';
import { payrollApi, TaxDeclaration, TaxDeclarationItem } from '../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';

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
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD' });
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
        return <div className="p-6"><div className="h-96 bg-slate-800/50 rounded-xl animate-pulse" /></div>;
    }

    const statusIndex = declaration ? STATUS_TIMELINE.indexOf(declaration.status as typeof STATUS_TIMELINE[number]) : 0;

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="My Tax Declaration"
                subtitle={`Fiscal year ${fiscalYear}`}
                actions={declaration && <StatusChip status={declaration.status} />}
            />

            {/* Status timeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-0">
                    {STATUS_TIMELINE.map((step, index) => {
                        const done = statusIndex > index || declaration?.status === 'approved';
                        const current = statusIndex === index;
                        const isLast = index === STATUS_TIMELINE.length - 1;
                        return (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center">
                                    <div className={`flex items-center justify-center w-7 h-7 rounded-full ${
                                        done ? 'bg-teal-500 text-white' : current ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-400' : 'bg-slate-800 border border-slate-600 text-slate-600'
                                    }`}>
                                        {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className={`text-xs mt-1.5 w-20 text-center capitalize ${done || current ? 'text-teal-400' : 'text-slate-600'}`}>
                                        {step.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                {!isLast && <div className={`flex-1 h-0.5 min-w-4 ${done ? 'bg-teal-500' : 'bg-slate-700'}`} />}
                            </React.Fragment>
                        );
                    })}
                </div>
                {declaration?.review_notes && (
                    <p className="text-xs text-amber-400 mt-3">Reviewer notes: {declaration.review_notes}</p>
                )}
            </div>

            {/* Regime */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center">
                    <span className="text-sm text-slate-300">Tax Regime</span>
                    <FieldTooltip text="The new regime has lower rates but fewer deductions; the old regime allows deductions like 80C and HRA. Your declarations only reduce tax under the old regime." />
                </div>
                <div className="flex items-center gap-2">
                    {(['new', 'old'] as const).map(r => (
                        <button
                            key={r}
                            disabled={!editable}
                            onClick={() => setRegime(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                                regime === r ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {r === 'new' ? 'New Regime' : 'Old Regime'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Items grouped by category */}
            <div className="space-y-4">
                {CATEGORIES.map(category => {
                    const categoryItems = items
                        .map((item, index) => ({ item, index }))
                        .filter(({ item }) => item.category === category.key);
                    return (
                        <div key={category.key} className="bg-slate-900 border border-slate-800 rounded-xl">
                            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center">
                                    <h4 className="text-sm font-semibold text-slate-50">{category.label}</h4>
                                    <FieldTooltip text={category.tooltip} />
                                </div>
                                {editable && (
                                    <button onClick={() => addItem(category.key)} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                                        <Plus size={12} /> Add
                                    </button>
                                )}
                            </div>
                            {categoryItems.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-slate-500">Nothing declared under {category.label}.</p>
                            ) : (
                                <div className="p-4 space-y-2">
                                    {categoryItems.map(({ item, index }) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Description (e.g. LIC premium)"
                                                disabled={!editable}
                                                value={item.description || ''}
                                                onChange={e => updateItem(index, { description: e.target.value })}
                                                className={`${inputCls} disabled:opacity-50`}
                                            />
                                            <input
                                                type="number" min={0} step="0.01"
                                                disabled={!editable}
                                                value={item.declared_amount || ''}
                                                onChange={e => updateItem(index, { declared_amount: parseFloat(e.target.value) || 0 })}
                                                className={`${inputCls} w-40 disabled:opacity-50`}
                                                aria-label={`${category.label} declared amount`}
                                            />
                                            {item.status && <StatusChip status={item.status} />}
                                            {editable && (
                                                <button onClick={() => removeItem(index)} aria-label="Remove item" className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Totals + actions */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-sm text-slate-300">
                    Total declared: <span className="font-semibold text-slate-50">{formatters.formatCurrency(totalDeclared)}</span>
                </div>
                {editable && (
                    <div className="flex items-center gap-2">
                        <button onClick={save} disabled={saving} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium rounded-lg transition-colors">
                            Save Draft
                        </button>
                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={saving || items.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Send size={14} /> Submit Declaration
                        </button>
                    </div>
                )}
            </div>

            {!editable && declaration && (
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
                    <ClipboardCheck size={15} className="text-teal-400" />
                    Your declaration is {declaration.status.replace(/_/g, ' ')} and can no longer be edited. Contact HR if something needs to change.
                </div>
            )}

            <Modal isOpen={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)} title="Submit Tax Declaration" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                        Submit your FY {fiscalYear} declaration ({formatters.formatCurrency(totalDeclared)} declared)?
                        After submission you cannot edit it unless HR reopens it.
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button onClick={() => setShowSubmitConfirm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                        <button onClick={submit} disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                            Submit
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MyTaxDeclarationPage;
