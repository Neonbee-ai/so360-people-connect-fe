import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Copy, CheckCircle, AlertCircle, FileText, ArrowLeft } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import Modal from '../../Modal';
import EmptyState from '../../EmptyState';
import StatusChip from '../StatusChip';
import FieldTooltip from '../FieldTooltip';
import {
    payrollApi, SalaryStructure, SalaryStructureLine, SalaryComponent, StructureValidationResult,
} from '../../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const StructuresTab: React.FC = () => {
    const [structures, setStructures] = useState<SalaryStructure[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SalaryStructure | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.structures.list();
            setStructures(result.data);
        } catch {
            toast.error('Failed to load salary structures');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openDetail = async (structure: SalaryStructure) => {
        try {
            const full = await payrollApi.structures.get(structure.id);
            setSelected(full);
        } catch {
            toast.error('Failed to load structure detail');
        }
    };

    const handleCreate = async (data: Partial<SalaryStructure>) => {
        try {
            const created = await payrollApi.structures.create(data);
            toast.success('Structure created');
            setShowCreateModal(false);
            load();
            setSelected(created);
        } catch {
            toast.error('Failed to create structure');
        }
    };

    if (loading) return <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />;

    if (selected) {
        return <StructureBuilder structure={selected} onBack={() => { setSelected(null); load(); }} onReload={openDetail} />;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">Salary Structures</h3>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Plus size={13} /> New Structure
                </button>
            </div>

            {structures.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No salary structures"
                    description="A structure defines which components make up an employee's salary and how each is calculated."
                    action={{ label: 'New Structure', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Version</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {structures.map(structure => (
                                <tr key={structure.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-50">{structure.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{structure.code}</td>
                                    <td className="px-4 py-3 text-center text-sm text-slate-400">v{structure.version}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={structure.status} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => openDetail(structure)} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">Open</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Salary Structure">
                <CreateStructureForm onCancel={() => setShowCreateModal(false)} onCreate={handleCreate} />
            </Modal>
        </div>
    );
};

const CreateStructureForm: React.FC<{
    onCancel: () => void;
    onCreate: (data: Partial<SalaryStructure>) => void;
}> = ({ onCancel, onCreate }) => {
    const [form, setForm] = useState({ name: '', code: '', description: '' });
    return (
        <form onSubmit={e => { e.preventDefault(); if (form.name && form.code) onCreate(form); }} className="space-y-4">
            <div>
                <label className={labelCls}>Name *</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Standard India — Monthly" />
            </div>
            <div>
                <label className={labelCls}>Code *</label>
                <input type="text" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className={inputCls} placeholder="STD_IN_MONTHLY" />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} rows={2} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">Create</button>
            </div>
        </form>
    );
};

// =============================================================================
// Structure builder — lines table + validate + sample preview + clone/version
// =============================================================================

const StructureBuilder: React.FC<{
    structure: SalaryStructure;
    onBack: () => void;
    onReload: (structure: SalaryStructure) => void;
}> = ({ structure, onBack, onReload }) => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD' });
    const [lines, setLines] = useState<SalaryStructureLine[]>(structure.lines || []);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [pickerComponentId, setPickerComponentId] = useState('');
    const [sampleWage, setSampleWage] = useState(50000);
    const [validation, setValidation] = useState<StructureValidationResult | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        payrollApi.components.list({ is_active: true })
            .then(result => setComponents(result.data))
            .catch(() => toast.error('Failed to load components'));
    }, []);

    useEffect(() => { setLines(structure.lines || []); setValidation(null); }, [structure]);

    const componentById = (id: string) => components.find(c => c.id === id);

    const addLine = () => {
        if (!pickerComponentId) return;
        const component = componentById(pickerComponentId);
        if (!component) return;
        if (lines.some(l => l.component_id === pickerComponentId)) {
            toast.error(`${component.name} is already in this structure`);
            return;
        }
        setLines(prev => [...prev, {
            component_id: component.id,
            component_code: component.code,
            component_name: component.name,
            kind: component.kind,
            calc_override: null,
            display_order: prev.length + 1,
        }]);
        setPickerComponentId('');
    };

    const move = (index: number, direction: -1 | 1) => {
        setLines(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next.map((line, i) => ({ ...line, display_order: i + 1 }));
        });
    };

    const removeLine = (index: number) =>
        setLines(prev => prev.filter((_, i) => i !== index).map((line, i) => ({ ...line, display_order: i + 1 })));

    const setOverride = (index: number, raw: string) => {
        setLines(prev => prev.map((line, i) => {
            if (i !== index) return line;
            if (!raw.trim()) return { ...line, calc_override: null };
            const amount = parseFloat(raw);
            return Number.isNaN(amount) ? line : { ...line, calc_override: { amount } };
        }));
    };

    const handleSaveLines = async () => {
        try {
            setSaving(true);
            await payrollApi.structures.saveLines(structure.id, lines);
            toast.success('Structure lines saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save lines');
        } finally {
            setSaving(false);
        }
    };

    const handleValidate = async () => {
        try {
            await payrollApi.structures.saveLines(structure.id, lines);
            const result = await payrollApi.structures.validate(structure.id, { monthly_wage: sampleWage });
            setValidation(result);
            if (result.valid) toast.success('Structure is valid');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Validation failed');
        }
    };

    const handleClone = async () => {
        try {
            const clone = await payrollApi.structures.clone(structure.id);
            toast.success(`Cloned as ${clone.name}`);
            onReload(clone);
        } catch {
            toast.error('Failed to clone structure');
        }
    };

    const handleNewVersion = async () => {
        try {
            const version = await payrollApi.structures.newVersion(structure.id);
            toast.success(`Created version ${version.version}. Existing assignments stay pinned to their version.`);
            onReload(version);
        } catch {
            toast.error('Failed to create a new version');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors" aria-label="Back to structures">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-50">{structure.name}</h3>
                            <StatusChip status={structure.status} />
                            <span className="text-xs text-slate-500">v{structure.version}</span>
                        </div>
                        <p className="text-xs text-slate-400">{structure.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleClone} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors">
                        <Copy size={12} /> Clone
                    </button>
                    <button onClick={handleNewVersion} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors">
                        <Plus size={12} /> New Version
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* Lines table */}
                <div className="col-span-2 space-y-3">
                    <div className="flex items-center gap-2">
                        <select value={pickerComponentId} onChange={e => setPickerComponentId(e.target.value)} className={inputCls} aria-label="Add component">
                            <option value="">Add a component…</option>
                            {components.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                        <button onClick={addLine} className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors">
                            <Plus size={13} /> Add
                        </button>
                    </div>

                    {lines.length === 0 ? (
                        <p className="text-sm text-slate-400 py-8 text-center bg-slate-900 border border-slate-800 rounded-xl">
                            No components yet. Add components to build this structure.
                        </p>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-800/50 border-b border-slate-800">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Order</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Component</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Kind</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                            Override
                                            <FieldTooltip text="Optional fixed amount overriding the component's default calculation for this structure only. Leave blank to use the component default." />
                                        </th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {lines.map((line, index) => (
                                        <tr key={line.component_id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-3 py-2 text-sm text-slate-400">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                <div className="text-sm font-medium text-slate-50">{line.component_code || componentById(line.component_id)?.code}</div>
                                                <div className="text-xs text-slate-400">{line.component_name || componentById(line.component_id)?.name}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center"><StatusChip status={line.kind || componentById(line.component_id)?.kind || 'earning'} /></td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={line.calc_override?.amount ?? ''}
                                                    onChange={e => setOverride(index, e.target.value)}
                                                    placeholder="default"
                                                    className="w-28 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-50 focus:outline-none focus:border-teal-500"
                                                    aria-label={`Override amount for ${line.component_code}`}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button onClick={() => move(index, -1)} aria-label="Move up" className="p-1 rounded text-slate-400 hover:text-slate-50 hover:bg-slate-800"><ArrowUp size={13} /></button>
                                                    <button onClick={() => move(index, 1)} aria-label="Move down" className="p-1 rounded text-slate-400 hover:text-slate-50 hover:bg-slate-800"><ArrowDown size={13} /></button>
                                                    <button onClick={() => removeLine(index)} aria-label="Remove line" className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-slate-800"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button onClick={handleValidate} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors">
                            Validate
                        </button>
                        <button onClick={handleSaveLines} disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                            {saving ? 'Saving…' : 'Save Lines'}
                        </button>
                    </div>
                </div>

                {/* Sample preview / validation panel */}
                <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sample Preview</h4>
                        <div>
                            <label className={labelCls}>Sample monthly wage</label>
                            <input type="number" min={0} value={sampleWage} onChange={e => setSampleWage(parseFloat(e.target.value) || 0)} className={inputCls} />
                        </div>
                        <p className="text-xs text-slate-500">Validate runs a server dry-run: the DAG order below is the exact order the engine will evaluate.</p>
                    </div>

                    {validation && (
                        <div className={`rounded-xl border p-4 space-y-2 ${validation.valid ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                            <div className="flex items-center gap-2">
                                {validation.valid
                                    ? <><CheckCircle size={15} className="text-emerald-400" /><span className="text-sm font-medium text-emerald-400">Valid structure</span></>
                                    : <><AlertCircle size={15} className="text-rose-400" /><span className="text-sm font-medium text-rose-400">Validation failed</span></>}
                            </div>
                            {validation.errors?.map((error, i) => (
                                <p key={i} className="text-xs text-rose-400">{error}</p>
                            ))}
                            {validation.order && validation.order.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Evaluation order:</p>
                                    <p className="text-xs font-mono text-slate-300">{validation.order.join(' → ')}</p>
                                </div>
                            )}
                            {validation.preview && validation.preview.length > 0 && (
                                <div className="pt-2 border-t border-slate-800 space-y-1">
                                    {validation.preview.map(row => (
                                        <div key={row.component_code} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">{row.component_code}</span>
                                            <span className="text-slate-200">{row.amount !== undefined ? formatters.formatCurrency(row.amount) : '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StructuresTab;
