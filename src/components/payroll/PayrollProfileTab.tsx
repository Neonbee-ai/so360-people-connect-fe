import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ChevronDown, ChevronUp, Briefcase, DollarSign, Layers, Award, Landmark,
    CreditCard, FileText, History, Plus, Eye, Trash2, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { toast } from '@so360/design-system';
import { useShellBridge, useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import Modal from '../Modal';
import StatusChip from './StatusChip';
import FieldTooltip from './FieldTooltip';
import {
    payrollApi, EmployeePayrollProfile, SalaryAssignment, SalaryRevisionPayload,
    ComponentOverride, EmployeeBenefit, BankAccount, BankAccountPayload,
    SalaryStructure, SalaryComponent, BenefitType, StatutoryIdentifierDef,
    PayrollHistoryEvent, RevisionType,
} from '../../services/payrollApi';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500';
const labelCls = 'block text-xs text-slate-400 mb-1';

const IDENTIFIER_TOOLTIPS: Record<string, string> = {
    pan: "Permanent Account Number — the employee's income-tax identity, required for TDS.",
    uan: "Universal Account Number used for managing an employee's PF account.",
    esic_number: "The employee's ESI insurance number for medical benefits.",
    lwf_number: "The employee's Labour Welfare Fund registration number.",
    aadhaar: 'National identity number. Stored encrypted and always masked in the UI.',
};

/** Master data the host PersonDetailPage passes in — read-only here. */
export interface PayrollTabPerson {
    id: string;
    full_name: string;
    type?: string;
    job_title?: string;
    department_info?: { name: string } | null;
    department?: string;
    start_date?: string;
    status?: string;
}

interface PayrollProfileTabProps {
    person: PayrollTabPerson;
}

type SectionKey = 'employment' | 'salary' | 'overrides' | 'benefits' | 'tax' | 'bank' | 'documents' | 'history';

const PayrollProfileTab: React.FC<PayrollProfileTabProps> = ({ person }) => {
    const [openSection, setOpenSection] = useState<SectionKey | null>('employment');
    const toggle = (key: SectionKey) => setOpenSection(prev => (prev === key ? null : key));

    const [profile, setProfile] = useState<EmployeePayrollProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        try {
            setProfileLoading(true);
            const result = await payrollApi.employees.getProfile(person.id);
            setProfile(result);
        } catch {
            setProfile(null);
        } finally {
            setProfileLoading(false);
        }
    }, [person.id]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    const sections: { key: SectionKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
        { key: 'employment', label: 'Employment & Contract', icon: Briefcase },
        { key: 'salary', label: 'Salary', icon: DollarSign },
        { key: 'overrides', label: 'Components & Overrides', icon: Layers },
        { key: 'benefits', label: 'Benefits', icon: Award },
        { key: 'tax', label: 'Tax & Statutory', icon: Landmark },
        { key: 'bank', label: 'Bank', icon: CreditCard },
        { key: 'documents', label: 'Documents', icon: FileText },
        { key: 'history', label: 'History', icon: History },
    ];

    if (profileLoading) {
        return <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />;
    }

    return (
        <div className="space-y-3">
            {sections.map(({ key, label, icon: Icon }) => (
                <div key={key} className="border border-slate-800 rounded-xl overflow-hidden">
                    <button
                        onClick={() => toggle(key)}
                        aria-expanded={openSection === key}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Icon size={15} className="text-teal-400" />
                            <span className="text-sm font-medium text-slate-50">{label}</span>
                        </div>
                        {openSection === key ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                    </button>
                    {openSection === key && (
                        <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                            {key === 'employment' && <EmploymentSection person={person} profile={profile} onSaved={loadProfile} />}
                            {key === 'salary' && <SalarySection personId={person.id} />}
                            {key === 'overrides' && <OverridesSection personId={person.id} />}
                            {key === 'benefits' && <BenefitsSection personId={person.id} />}
                            {key === 'tax' && <TaxStatutorySection personId={person.id} profile={profile} onSaved={loadProfile} />}
                            {key === 'bank' && <BankSection personId={person.id} />}
                            {key === 'documents' && (
                                <p className="text-sm text-slate-400">
                                    Payroll documents (proofs, contracts) live with the person's documents.{' '}
                                    <Link to={`/people/people/${person.id}?tab=overview`} className="text-teal-400 hover:text-teal-300">Open documents</Link>
                                </p>
                            )}
                            {key === 'history' && <HistorySection personId={person.id} />}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// =============================================================================
// Employment & Contract
// =============================================================================

const EmploymentSection: React.FC<{
    person: PayrollTabPerson;
    profile: EmployeePayrollProfile | null;
    onSaved: () => void;
}> = ({ person, profile, onSaved }) => {
    const [contract, setContract] = useState<NonNullable<EmployeePayrollProfile['contract']>>(profile?.contract || {});
    const [saving, setSaving] = useState(false);

    useEffect(() => { setContract(profile?.contract || {}); }, [profile]);

    const save = async () => {
        try {
            setSaving(true);
            await payrollApi.employees.updateProfile(person.id, { contract });
            toast.success('Contract details saved');
            onSaved();
        } catch {
            toast.error('Failed to save contract details');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Read-only master data from People Registry */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    ['Name', person.full_name],
                    ['Designation', person.job_title || '—'],
                    ['Department', person.department_info?.name || person.department || '—'],
                    ['Type', person.type || '—'],
                    ['Joining Date', person.start_date || '—'],
                    ['Status', person.status || '—'],
                ].map(([label, value]) => (
                    <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="text-sm text-slate-200 capitalize">{value}</div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-500">Identity fields come from the People Registry and are edited there — never duplicated in payroll.</p>

            {/* Editable contract */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className={labelCls}>Contract Type</label>
                    <select value={contract.type || 'permanent'} onChange={e => setContract(c => ({ ...c, type: e.target.value as 'permanent' | 'fixed_term' }))} className={inputCls}>
                        <option value="permanent">Permanent</option>
                        <option value="fixed_term">Fixed term</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Contract Start</label>
                    <input type="date" value={contract.start || ''} onChange={e => setContract(c => ({ ...c, start: e.target.value }))} className={inputCls} />
                </div>
                {contract.type === 'fixed_term' && (
                    <div>
                        <label className={labelCls}>Contract End</label>
                        <input type="date" value={contract.end || ''} onChange={e => setContract(c => ({ ...c, end: e.target.value }))} className={inputCls} />
                    </div>
                )}
            </div>
            <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {saving ? 'Saving…' : 'Save Contract'}
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Salary — current assignment + revision timeline + Salary Adjustment
// =============================================================================

const SalarySection: React.FC<{ personId: string }> = ({ personId }) => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD' });
    const [assignments, setAssignments] = useState<SalaryAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdjustModal, setShowAdjustModal] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.employees.salary.list(personId);
            setAssignments(result.data);
        } catch {
            toast.error('Failed to load salary history');
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => { load(); }, [load]);

    const current = assignments.find(a => !a.effective_to) || assignments[0];

    if (loading) return <div className="h-32 bg-slate-800/50 rounded-lg animate-pulse" />;

    return (
        <div className="space-y-4">
            {!current ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-sm text-amber-400">
                        No salary assigned yet. A salary structure is required before this employee can be included in payroll.
                    </span>
                </div>
            ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500">Current Monthly Wage</div>
                            <div className="text-xl font-bold text-slate-50">{formatters.formatCurrency(current.monthly_wage)}</div>
                            <div className="text-xs text-slate-400 mt-1">
                                {current.structure_name || 'Structure'} v{current.structure_version} · effective {current.effective_from}
                            </div>
                        </div>
                        {current.annual_ctc != null && (
                            <div className="text-right">
                                <div className="text-xs text-slate-500">Annual CTC</div>
                                <div className="text-sm font-semibold text-slate-200">{formatters.formatCurrency(current.annual_ctc)}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={() => setShowAdjustModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <TrendingUp size={14} /> Salary Adjustment
                </button>
            </div>

            {/* Revision timeline */}
            {assignments.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revision History</h4>
                    {assignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/40 border border-slate-800 rounded-lg">
                            <div>
                                <div className="text-sm text-slate-200">{formatters.formatCurrency(assignment.monthly_wage)}/month</div>
                                <div className="text-xs text-slate-500">
                                    {assignment.effective_from} → {assignment.effective_to || 'current'}
                                    {assignment.revision_reason ? ` · ${assignment.revision_reason}` : ''}
                                </div>
                            </div>
                            <StatusChip status={assignment.revision_type === 'initial' ? 'draft' : 'approved'} label={assignment.revision_type.replace(/_/g, ' ')} />
                        </div>
                    ))}
                </div>
            )}

            <SalaryAdjustmentModal
                isOpen={showAdjustModal}
                personId={personId}
                current={current || null}
                onClose={() => setShowAdjustModal(false)}
                onSaved={() => { setShowAdjustModal(false); load(); }}
                formatCurrency={formatters.formatCurrency}
            />
        </div>
    );
};

const SalaryAdjustmentModal: React.FC<{
    isOpen: boolean;
    personId: string;
    current: SalaryAssignment | null;
    onClose: () => void;
    onSaved: () => void;
    formatCurrency: (v: number) => string;
}> = ({ isOpen, personId, current, onClose, onSaved, formatCurrency }) => {
    const navigate = useNavigate();
    const shell = useShellBridge() as {
        permissionsLoaded?: boolean;
        hasPermission?: (code: string) => boolean;
    } | null;
    const canConfigureStructures = shell?.permissionsLoaded
        ? (shell.hasPermission?.('payroll.structures') ?? false)
        : false;

    const [structures, setStructures] = useState<SalaryStructure[]>([]);
    const [structuresLoaded, setStructuresLoaded] = useState(false);
    const [form, setForm] = useState<SalaryRevisionPayload>({
        structure_id: '', monthly_wage: 0, effective_from: '',
        revision_reason: '', revision_type: 'increment',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setStructuresLoaded(false);
        payrollApi.structures.list({ status: 'active' })
            .then(result => setStructures(result.data))
            .catch(() => toast.error('Failed to load structures'))
            .finally(() => setStructuresLoaded(true));
        setForm({
            structure_id: current?.structure_id || '',
            monthly_wage: current?.monthly_wage || 0,
            effective_from: '',
            revision_reason: '',
            revision_type: current ? 'increment' : 'initial',
        });
    }, [isOpen, current]);

    const goConfigureStructures = () => {
        onClose();
        navigate('/people/payroll/configuration');
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.structure_id || !form.monthly_wage || !form.effective_from || !form.revision_reason) return;
        try {
            setSaving(true);
            await payrollApi.employees.salary.revise(personId, form);
            toast.success('Salary revision saved');
            onSaved();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save salary revision');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Salary Adjustment" size="lg">
            <form onSubmit={submit} className="space-y-4">
                {/* Previous → new preview */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
                        <div className="text-xs text-slate-500">Previous</div>
                        <div className="text-lg font-semibold text-slate-300">
                            {current ? formatCurrency(current.monthly_wage) : '—'}
                        </div>
                    </div>
                    <div className="bg-teal-500/5 border border-teal-500/30 rounded-lg px-4 py-3">
                        <div className="text-xs text-teal-500">New</div>
                        <div className="text-lg font-semibold text-teal-400">
                            {form.monthly_wage ? formatCurrency(form.monthly_wage) : '—'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>New Monthly Wage *</label>
                        <input type="number" min={0} step="0.01" required aria-label="New Monthly Wage" value={form.monthly_wage || ''} onChange={e => setForm(f => ({ ...f, monthly_wage: parseFloat(e.target.value) || 0 }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Salary Structure *</label>
                        {structuresLoaded && structures.length === 0 ? (
                            canConfigureStructures ? (
                                <button
                                    type="button"
                                    onClick={goConfigureStructures}
                                    className="w-full text-left px-3 py-2 bg-amber-500/5 border border-amber-500/30 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                                >
                                    No salary structures configured — Configure Salary Structure →
                                </button>
                            ) : (
                                <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                                    Contact an administrator to configure salary structures.
                                </div>
                            )
                        ) : (
                            <select required value={form.structure_id} onChange={e => setForm(f => ({ ...f, structure_id: e.target.value }))} className={inputCls}>
                                <option value="">Select structure…</option>
                                {structures.map(s => <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className={labelCls}>Effective From *</label>
                        <input type="date" required value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Revision Type</label>
                        <select value={form.revision_type} onChange={e => setForm(f => ({ ...f, revision_type: e.target.value as RevisionType }))} className={inputCls}>
                            <option value="initial">Initial</option>
                            <option value="increment">Increment</option>
                            <option value="decrement">Decrement</option>
                            <option value="structure_change">Structure change</option>
                            <option value="adjustment">Adjustment</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className={labelCls}>Reason *</label>
                        <input type="text" required value={form.revision_reason} onChange={e => setForm(f => ({ ...f, revision_reason: e.target.value }))} className={inputCls} placeholder="Annual increment 2026" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                        {saving ? 'Saving…' : 'Apply Adjustment'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// =============================================================================
// Components & Overrides
// =============================================================================

const OverridesSection: React.FC<{ personId: string }> = ({ personId }) => {
    const [overrides, setOverrides] = useState<ComponentOverride[]>([]);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [overridesResult, componentsResult] = await Promise.all([
                payrollApi.employees.overrides.list(personId),
                payrollApi.components.list({ is_active: true }),
            ]);
            setOverrides(overridesResult.data);
            setComponents(componentsResult.data);
        } catch {
            toast.error('Failed to load overrides');
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => { load(); }, [load]);

    const remove = async (override: ComponentOverride) => {
        try {
            await payrollApi.employees.overrides.remove(personId, override.id);
            toast.success('Override removed');
            load();
        } catch {
            toast.error('Failed to remove override');
        }
    };

    if (loading) return <div className="h-24 bg-slate-800/50 rounded-lg animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors">
                    <Plus size={12} /> Add Override
                </button>
            </div>
            {overrides.length === 0 ? (
                <p className="text-sm text-slate-400">No component overrides. Overrides add, remove or change a component just for this employee — e.g. a loan EMI or a one-time bonus.</p>
            ) : (
                <div className="space-y-2">
                    {overrides.map(override => (
                        <div key={override.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/40 border border-slate-800 rounded-lg">
                            <div>
                                <div className="text-sm text-slate-200">
                                    {override.component_code || override.component_name || override.component_id}
                                    <span className="text-xs text-slate-500 ml-2 capitalize">{override.action}</span>
                                    {override.calc_override?.amount != null && <span className="text-xs text-slate-400 ml-2">{override.calc_override.amount}</span>}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {override.recurrence === 'one_time' ? 'One time' : `${override.effective_from} → ${override.effective_to || 'ongoing'}`}
                                    {override.reason ? ` · ${override.reason}` : ''}
                                </div>
                            </div>
                            <button onClick={() => remove(override)} aria-label="Remove override" className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <OverrideModal
                isOpen={showModal}
                components={components}
                onClose={() => setShowModal(false)}
                onSave={async data => {
                    try {
                        await payrollApi.employees.overrides.create(personId, data);
                        toast.success('Override added');
                        setShowModal(false);
                        load();
                    } catch {
                        toast.error('Failed to add override');
                    }
                }}
            />
        </div>
    );
};

const OverrideModal: React.FC<{
    isOpen: boolean;
    components: SalaryComponent[];
    onClose: () => void;
    onSave: (data: Partial<ComponentOverride>) => void;
}> = ({ isOpen, components, onClose, onSave }) => {
    const [form, setForm] = useState<Partial<ComponentOverride>>({ action: 'add', recurrence: 'recurring' });

    useEffect(() => {
        if (isOpen) setForm({ action: 'add', recurrence: 'recurring' });
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Component Override">
            <form
                onSubmit={e => { e.preventDefault(); if (form.component_id && form.effective_from) onSave(form); }}
                className="space-y-4"
            >
                <div>
                    <label className={labelCls}>Component *</label>
                    <select required value={form.component_id || ''} onChange={e => setForm(f => ({ ...f, component_id: e.target.value }))} className={inputCls}>
                        <option value="">Select component…</option>
                        {components.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>
                            Action
                            <FieldTooltip text="Add = component the structure doesn't include. Remove = skip a structure component for this employee. Override = keep it but change the amount." />
                        </label>
                        <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value as ComponentOverride['action'] }))} className={inputCls}>
                            <option value="add">Add</option>
                            <option value="remove">Remove</option>
                            <option value="override">Override</option>
                        </select>
                    </div>
                    {form.action !== 'remove' && (
                        <div>
                            <label className={labelCls}>Amount</label>
                            <input type="number" min={0} step="0.01" value={form.calc_override?.amount ?? ''} onChange={e => setForm(f => ({ ...f, calc_override: { amount: parseFloat(e.target.value) || 0 } }))} className={inputCls} />
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>
                            Recurrence
                            <FieldTooltip text="Recurring applies every run in the effective window; one-time applies to a single pay period only." />
                        </label>
                        <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as ComponentOverride['recurrence'] }))} className={inputCls}>
                            <option value="recurring">Recurring</option>
                            <option value="one_time">One time</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Effective From *</label>
                        <input type="date" required value={form.effective_from || ''} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                        <label className={labelCls}>Reason</label>
                        <input type="text" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inputCls} placeholder="Loan EMI recovery" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">Add Override</button>
                </div>
            </form>
        </Modal>
    );
};

// =============================================================================
// Benefits
// =============================================================================

const BenefitsSection: React.FC<{ personId: string }> = ({ personId }) => {
    const [benefits, setBenefits] = useState<EmployeeBenefit[]>([]);
    const [types, setTypes] = useState<BenefitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<Partial<EmployeeBenefit>>({});

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [benefitsResult, typesResult] = await Promise.all([
                payrollApi.employees.benefits.list(personId),
                payrollApi.benefitTypes.list(),
            ]);
            setBenefits(benefitsResult.data);
            setTypes(typesResult.data);
        } catch {
            toast.error('Failed to load benefits');
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="h-24 bg-slate-800/50 rounded-lg animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => { setForm({}); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors">
                    <Plus size={12} /> Add Benefit
                </button>
            </div>
            {benefits.length === 0 ? (
                <p className="text-sm text-slate-400">No benefits assigned to this employee.</p>
            ) : (
                <div className="space-y-2">
                    {benefits.map(benefit => (
                        <div key={benefit.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/40 border border-slate-800 rounded-lg">
                            <div>
                                <div className="text-sm text-slate-200">{benefit.benefit_type_name || benefit.benefit_type_id}</div>
                                <div className="text-xs text-slate-500">
                                    {benefit.amount_override != null ? `Amount ${benefit.amount_override}` : 'Default amount'} · from {benefit.effective_from}
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        await payrollApi.employees.benefits.remove(personId, benefit.id);
                                        toast.success('Benefit removed');
                                        load();
                                    } catch {
                                        toast.error('Failed to remove benefit');
                                    }
                                }}
                                aria-label="Remove benefit"
                                className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Benefit">
                <form
                    onSubmit={async e => {
                        e.preventDefault();
                        if (!form.benefit_type_id || !form.effective_from) return;
                        try {
                            await payrollApi.employees.benefits.create(personId, form);
                            toast.success('Benefit added');
                            setShowModal(false);
                            load();
                        } catch {
                            toast.error('Failed to add benefit');
                        }
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className={labelCls}>Benefit Type *</label>
                        <select required value={form.benefit_type_id || ''} onChange={e => setForm(f => ({ ...f, benefit_type_id: e.target.value }))} className={inputCls}>
                            <option value="">Select benefit…</option>
                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Amount Override</label>
                            <input type="number" min={0} step="0.01" value={form.amount_override ?? ''} onChange={e => setForm(f => ({ ...f, amount_override: e.target.value ? parseFloat(e.target.value) : null }))} className={inputCls} placeholder="Default" />
                        </div>
                        <div>
                            <label className={labelCls}>Effective From *</label>
                            <input type="date" required value={form.effective_from || ''} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inputCls} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">Add Benefit</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// =============================================================================
// Tax & Statutory
// =============================================================================

const TaxStatutorySection: React.FC<{
    personId: string;
    profile: EmployeePayrollProfile | null;
    onSaved: () => void;
}> = ({ personId, profile, onSaved }) => {
    const [identifierDefs, setIdentifierDefs] = useState<StatutoryIdentifierDef[]>([]);
    const [identifiers, setIdentifiers] = useState<Record<string, string>>(profile?.statutory_identifiers || {});
    const [regime, setRegime] = useState<'new' | 'old'>(profile?.tax_regime || 'new');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        payrollApi.statutory.get()
            .then(config => setIdentifierDefs(config.config.identifiers || []))
            .catch(() => { /* identifiers form degrades to empty */ });
    }, []);

    useEffect(() => {
        setIdentifiers(profile?.statutory_identifiers || {});
        setRegime(profile?.tax_regime || 'new');
    }, [profile]);

    const save = async () => {
        try {
            setSaving(true);
            await payrollApi.employees.updateProfile(personId, { statutory_identifiers: identifiers, tax_regime: regime });
            toast.success('Tax & statutory details saved');
            onSaved();
        } catch {
            toast.error('Failed to save tax & statutory details');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <span className="text-sm text-slate-300">Tax Regime</span>
                    <FieldTooltip text="The regime used for this employee's TDS. The new regime has lower rates without deductions; the old regime honours approved declarations." />
                </div>
                <div className="flex items-center gap-2">
                    {(['new', 'old'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRegime(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                regime === r ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {r === 'new' ? 'New Regime' : 'Old Regime'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {identifierDefs.map(def => (
                    <div key={def.key}>
                        <label className={labelCls}>
                            {def.label}{def.required_for_payroll ? ' *' : ''}
                            <FieldTooltip text={IDENTIFIER_TOOLTIPS[def.key] || `${def.label} statutory identifier.`} />
                        </label>
                        <input
                            type="text"
                            value={identifiers[def.key] || ''}
                            onChange={e => setIdentifiers(prev => ({ ...prev, [def.key]: e.target.value }))}
                            className={inputCls}
                            aria-label={def.label}
                        />
                        {def.required_for_payroll && !identifiers[def.key] && (
                            <p className="text-xs text-amber-400 mt-1">
                                {def.label} is required before this employee can be included in payroll.
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {saving ? 'Saving…' : 'Save Tax & Statutory'}
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Bank — masked accounts, reveal gated by permission, audited
// =============================================================================

const BankSection: React.FC<{ personId: string }> = ({ personId }) => {
    const shell = useShellBridge() as {
        permissionsLoaded?: boolean;
        hasPermission?: (code: string) => boolean;
    } | null;
    const canReveal = shell?.permissionsLoaded ? (shell.hasPermission?.('payroll.bank_reveal') ?? false) : false;

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [revealed, setRevealed] = useState<Record<string, string>>({});
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.employees.bankAccounts.list(personId);
            setAccounts(result.data);
        } catch {
            toast.error('Failed to load bank accounts');
        } finally {
            setLoading(false);
        }
    }, [personId]);

    useEffect(() => { load(); }, [load]);

    const reveal = async (account: BankAccount) => {
        try {
            const result = await payrollApi.employees.bankAccounts.reveal(personId, account.id);
            setRevealed(prev => ({ ...prev, [account.id]: result.account_number }));
        } catch {
            toast.error('Failed to reveal account number');
        }
    };

    if (loading) return <div className="h-24 bg-slate-800/50 rounded-lg animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors">
                    <Plus size={12} /> Add Bank Account
                </button>
            </div>
            {accounts.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-sm text-amber-400">Bank account is required before this employee can be included in payroll.</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {accounts.map(account => (
                        <div key={account.id} className="px-4 py-3 bg-slate-800/40 border border-slate-800 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-50">{account.bank_name}</span>
                                        {account.is_primary && <StatusChip status="active" label="Primary" />}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {account.account_holder} · {revealed[account.id] || `•••• ${account.account_number_last4}`}
                                        {account.ifsc ? ` · ${account.ifsc}` : ''}
                                    </div>
                                </div>
                                {canReveal && !revealed[account.id] && (
                                    <button
                                        onClick={() => reveal(account)}
                                        className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                    >
                                        <Eye size={12} /> Reveal
                                    </button>
                                )}
                            </div>
                            {canReveal && !revealed[account.id] && (
                                <p className="text-xs text-slate-500 mt-1.5">Revealing the full account number is recorded in the audit log.</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <BankAccountModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSave={async data => {
                    try {
                        await payrollApi.employees.bankAccounts.create(personId, data);
                        toast.success('Bank account added');
                        setShowModal(false);
                        load();
                    } catch {
                        toast.error('Failed to add bank account');
                    }
                }}
            />
        </div>
    );
};

const BankAccountModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BankAccountPayload) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const empty: BankAccountPayload = {
        bank_name: '', account_holder: '', account_number: '',
        ifsc: '', account_type: 'savings', payment_method: 'bank_transfer', is_primary: true,
    };
    const [form, setForm] = useState<BankAccountPayload>(empty);

    useEffect(() => { if (isOpen) setForm(empty); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Bank Account">
            <form
                onSubmit={e => { e.preventDefault(); if (form.bank_name && form.account_holder && form.account_number) onSave(form); }}
                className="space-y-4"
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Bank Name *</label>
                        <input type="text" required value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Account Holder *</label>
                        <input type="text" required value={form.account_holder} onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Account Number *</label>
                        <input type="text" required value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} className={inputCls} autoComplete="off" />
                    </div>
                    <div>
                        <label className={labelCls}>
                            IFSC
                            <FieldTooltip text="Indian Financial System Code identifying the bank branch for transfers." />
                        </label>
                        <input type="text" value={form.ifsc || ''} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Account Type</label>
                        <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as BankAccountPayload['account_type'] }))} className={inputCls}>
                            <option value="savings">Savings</option>
                            <option value="current">Current</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Payment Method</label>
                        <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as BankAccountPayload['payment_method'] }))} className={inputCls}>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                        </select>
                    </div>
                </div>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500" />
                    <span className="text-sm text-slate-300">Primary account for salary payments</span>
                </label>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">Add Account</button>
                </div>
            </form>
        </Modal>
    );
};

// =============================================================================
// History
// =============================================================================

const HistorySection: React.FC<{ personId: string }> = ({ personId }) => {
    const [events, setEvents] = useState<PayrollHistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        payrollApi.employees.history(personId)
            .then(result => setEvents(result.data))
            .catch(() => { /* history is optional context */ })
            .finally(() => setLoading(false));
    }, [personId]);

    if (loading) return <div className="h-24 bg-slate-800/50 rounded-lg animate-pulse" />;
    if (events.length === 0) return <p className="text-sm text-slate-400">No payroll history yet for this employee.</p>;

    return (
        <div className="space-y-2">
            {events.map(event => (
                <div key={event.id} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/40 border border-slate-800 rounded-lg">
                    <History size={13} className="text-slate-500 mt-0.5" />
                    <div>
                        <div className="text-sm text-slate-200">{event.description || event.event_type.replace(/[._]/g, ' ')}</div>
                        <div className="text-xs text-slate-500">
                            {event.created_at}{event.actor_name ? ` · ${event.actor_name}` : ''}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PayrollProfileTab;
