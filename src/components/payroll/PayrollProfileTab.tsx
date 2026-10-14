import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ChevronDown, ChevronUp, Briefcase, DollarSign, Layers, Award, Landmark,
    CreditCard, FileText, History, Plus, Eye, Trash2, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { toast, Select } from '@so360/design-system';
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

const inputCls = 'w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary';
const labelCls = 'block text-xs text-fg-muted mb-1';

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
        return <div className="h-64 bg-surface-raised/50 rounded-nb animate-pulse" />;
    }

    return (
        <div className="space-y-3">
            {sections.map(({ key, label, icon: Icon }) => (
                <div key={key} className="border border-line rounded-nb overflow-hidden">
                    <button
                        onClick={() => toggle(key)}
                        aria-expanded={openSection === key}
                        className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-raised/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Icon size={15} className="text-primary" />
                            <span className="text-sm font-medium text-fg">{label}</span>
                        </div>
                        {openSection === key ? <ChevronUp size={15} className="text-fg-muted" /> : <ChevronDown size={15} className="text-fg-muted" />}
                    </button>
                    {openSection === key && (
                        <div className="p-4 bg-surface/50 border-t border-line">
                            {key === 'employment' && <EmploymentSection person={person} profile={profile} onSaved={loadProfile} />}
                            {key === 'salary' && <SalarySection personId={person.id} />}
                            {key === 'overrides' && <OverridesSection personId={person.id} />}
                            {key === 'benefits' && <BenefitsSection personId={person.id} />}
                            {key === 'tax' && <TaxStatutorySection personId={person.id} profile={profile} onSaved={loadProfile} />}
                            {key === 'bank' && <BankSection personId={person.id} />}
                            {key === 'documents' && (
                                <p className="text-sm text-fg-muted">
                                    Payroll documents (proofs, contracts) live with the person's documents.{' '}
                                    <Link to={`/people/people/${person.id}?tab=overview`} className="text-primary hover:text-primary">Open documents</Link>
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
                    <div key={label} className="bg-surface-raised/50 border border-line-strong rounded-nb px-3 py-2">
                        <div className="text-xs text-fg-subtle">{label}</div>
                        <div className="text-sm text-fg capitalize">{value}</div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-fg-subtle">Identity fields come from the People Registry and are edited there — never duplicated in payroll.</p>

            {/* Editable contract */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className={labelCls}>Contract Type</label>
                    <Select name="payrollprofiletab-select-2" value={contract.type || 'permanent'} onChange={e => setContract(c => ({ ...c, type: e.target.value as 'permanent' | 'fixed_term' }))} options={[{ value: "permanent", label: "Permanent" }, { value: "fixed_term", label: "Fixed term" }]} />
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
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors">
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
    const formatters = useFormatters({ currency: settings?.base_currency || 'USD', timezone: settings?.timezone || 'UTC' });
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

    if (loading) return <div className="h-32 bg-surface-raised/50 rounded-nb animate-pulse" />;

    return (
        <div className="space-y-4">
            {!current ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-warning/5 border border-warning/30 rounded-nb">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-sm text-warning">
                        No salary assigned yet. A salary structure is required before this employee can be included in payroll.
                    </span>
                </div>
            ) : (
                <div className="bg-surface-raised/50 border border-line-strong rounded-nb p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-fg-subtle">Current Monthly Wage</div>
                            <div className="text-xl font-bold text-fg">{formatters.formatCurrency(current.monthly_wage)}</div>
                            <div className="text-xs text-fg-muted mt-1">
                                {current.structure_name || 'Structure'} v{current.structure_version} · effective {current.effective_from}
                            </div>
                        </div>
                        {current.annual_ctc != null && (
                            <div className="text-right">
                                <div className="text-xs text-fg-subtle">Annual CTC</div>
                                <div className="text-sm font-semibold text-fg">{formatters.formatCurrency(current.annual_ctc)}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={() => setShowAdjustModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                >
                    <TrendingUp size={14} /> Salary Adjustment
                </button>
            </div>

            {/* Revision timeline */}
            {assignments.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Revision History</h4>
                    {assignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center justify-between px-3 py-2.5 bg-surface-raised/40 border border-line rounded-nb">
                            <div>
                                <div className="text-sm text-fg">{formatters.formatCurrency(assignment.monthly_wage)}/month</div>
                                <div className="text-xs text-fg-subtle">
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
                    <div className="bg-surface-raised/50 border border-line-strong rounded-nb px-4 py-3">
                        <div className="text-xs text-fg-subtle">Previous</div>
                        <div className="text-lg font-semibold text-fg">
                            {current ? formatCurrency(current.monthly_wage) : '—'}
                        </div>
                    </div>
                    <div className="bg-primary/5 border border-primary/30 rounded-nb px-4 py-3">
                        <div className="text-xs text-primary">New</div>
                        <div className="text-lg font-semibold text-primary">
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
                                    className="w-full text-left px-3 py-2 bg-warning/5 border border-warning/30 rounded-nb text-xs text-warning hover:bg-warning/10 transition-colors"
                                >
                                    No salary structures configured — Configure Salary Structure →
                                </button>
                            ) : (
                                <div className="px-3 py-2 bg-surface-raised/50 border border-line-strong rounded-nb text-xs text-fg-muted">
                                    Contact an administrator to configure salary structures.
                                </div>
                            )
                        ) : (
                            <Select name="payrollprofiletab-select-3" required value={form.structure_id} onChange={e => setForm(f => ({ ...f, structure_id: e.target.value }))} options={[{ value: "", label: "Select structure…" }, ...structures.map((s) => ({ value: s.id, label: `${s.name} (v${s.version})` }))]} />
                        )}
                    </div>
                    <div>
                        <label className={labelCls}>Effective From *</label>
                        <input type="date" required value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Revision Type</label>
                        <Select name="payrollprofiletab-select-4" value={form.revision_type} onChange={e => setForm(f => ({ ...f, revision_type: e.target.value as RevisionType }))} options={[{ value: "initial", label: "Initial" }, { value: "increment", label: "Increment" }, { value: "decrement", label: "Decrement" }, { value: "structure_change", label: "Structure change" }, { value: "adjustment", label: "Adjustment" }]} />
                    </div>
                    <div className="col-span-2">
                        <label className={labelCls}>Reason *</label>
                        <input type="text" required value={form.revision_reason} onChange={e => setForm(f => ({ ...f, revision_reason: e.target.value }))} className={inputCls} placeholder="Annual increment 2026" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors">
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

    if (loading) return <div className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium rounded-nb transition-colors">
                    <Plus size={12} /> Add Override
                </button>
            </div>
            {overrides.length === 0 ? (
                <p className="text-sm text-fg-muted">No component overrides. Overrides add, remove or change a component just for this employee — e.g. a loan EMI or a one-time bonus.</p>
            ) : (
                <div className="space-y-2">
                    {overrides.map(override => (
                        <div key={override.id} className="flex items-center justify-between px-3 py-2.5 bg-surface-raised/40 border border-line rounded-nb">
                            <div>
                                <div className="text-sm text-fg">
                                    {override.component_code || override.component_name || override.component_id}
                                    <span className="text-xs text-fg-subtle ml-2 capitalize">{override.action}</span>
                                    {override.calc_override?.amount != null && <span className="text-xs text-fg-muted ml-2">{override.calc_override.amount}</span>}
                                </div>
                                <div className="text-xs text-fg-subtle">
                                    {override.recurrence === 'one_time' ? 'One time' : `${override.effective_from} → ${override.effective_to || 'ongoing'}`}
                                    {override.reason ? ` · ${override.reason}` : ''}
                                </div>
                            </div>
                            <button onClick={() => remove(override)} aria-label="Remove override" className="p-1.5 rounded text-danger hover:text-danger hover:bg-surface-raised transition-colors">
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
                    <Select name="payrollprofiletab-select-5" required value={form.component_id || ''} onChange={e => setForm(f => ({ ...f, component_id: e.target.value }))} options={[{ value: "", label: "Select component…" }, ...components.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))]} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>
                            Action
                            <FieldTooltip text="Add = component the structure doesn't include. Remove = skip a structure component for this employee. Override = keep it but change the amount." />
                        </label>
                        <Select name="payrollprofiletab-select-6" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value as ComponentOverride['action'] }))} options={[{ value: "add", label: "Add" }, { value: "remove", label: "Remove" }, { value: "override", label: "Override" }]} />
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
                        <Select name="payrollprofiletab-select-7" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as ComponentOverride['recurrence'] }))} options={[{ value: "recurring", label: "Recurring" }, { value: "one_time", label: "One time" }]} />
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
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors">Add Override</button>
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

    if (loading) return <div className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => { setForm({}); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium rounded-nb transition-colors">
                    <Plus size={12} /> Add Benefit
                </button>
            </div>
            {benefits.length === 0 ? (
                <p className="text-sm text-fg-muted">No benefits assigned to this employee.</p>
            ) : (
                <div className="space-y-2">
                    {benefits.map(benefit => (
                        <div key={benefit.id} className="flex items-center justify-between px-3 py-2.5 bg-surface-raised/40 border border-line rounded-nb">
                            <div>
                                <div className="text-sm text-fg">{benefit.benefit_type_name || benefit.benefit_type_id}</div>
                                <div className="text-xs text-fg-subtle">
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
                                className="p-1.5 rounded text-danger hover:text-danger hover:bg-surface-raised transition-colors"
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
                        <Select name="payrollprofiletab-select-8" required value={form.benefit_type_id || ''} onChange={e => setForm(f => ({ ...f, benefit_type_id: e.target.value }))} options={[{ value: "", label: "Select benefit…" }, ...types.map((t) => ({ value: t.id, label: t.name }))]} />
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
                    <div className="flex justify-end gap-3 pt-4 border-t border-line">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors">Add Benefit</button>
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
                    <span className="text-sm text-fg">Tax Regime</span>
                    <FieldTooltip text="The regime used for this employee's TDS. The new regime has lower rates without deductions; the old regime honours approved declarations." />
                </div>
                <div className="flex items-center gap-2">
                    {(['new', 'old'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRegime(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                regime === r ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface-raised border-line-strong text-fg-muted hover:text-fg'
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
                            <p className="text-xs text-warning mt-1">
                                {def.label} is required before this employee can be included in payroll.
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb transition-colors">
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

    if (loading) return <div className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium rounded-nb transition-colors">
                    <Plus size={12} /> Add Bank Account
                </button>
            </div>
            {accounts.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-warning/5 border border-warning/30 rounded-nb">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-sm text-warning">Bank account is required before this employee can be included in payroll.</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {accounts.map(account => (
                        <div key={account.id} className="px-4 py-3 bg-surface-raised/40 border border-line rounded-nb">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-fg">{account.bank_name}</span>
                                        {account.is_primary && <StatusChip status="active" label="Primary" />}
                                    </div>
                                    <div className="text-xs text-fg-muted mt-0.5">
                                        {account.account_holder} · {revealed[account.id] || `•••• ${account.account_number_last4}`}
                                        {account.ifsc ? ` · ${account.ifsc}` : ''}
                                    </div>
                                </div>
                                {canReveal && !revealed[account.id] && (
                                    <button
                                        onClick={() => reveal(account)}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                                    >
                                        <Eye size={12} /> Reveal
                                    </button>
                                )}
                            </div>
                            {canReveal && !revealed[account.id] && (
                                <p className="text-xs text-fg-subtle mt-1.5">Revealing the full account number is recorded in the audit log.</p>
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
                        <Select name="payrollprofiletab-select-9" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value as BankAccountPayload['account_type'] }))} options={[{ value: "savings", label: "Savings" }, { value: "current", label: "Current" }]} />
                    </div>
                    <div>
                        <label className={labelCls}>Payment Method</label>
                        <Select name="payrollprofiletab-select-10" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as BankAccountPayload['payment_method'] }))} options={[{ value: "bank_transfer", label: "Bank transfer" }, { value: "cheque", label: "Cheque" }, { value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }]} />
                    </div>
                </div>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-primary" />
                    <span className="text-sm text-fg">Primary account for salary payments</span>
                </label>
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors">Add Account</button>
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

    if (loading) return <div className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />;
    if (events.length === 0) return <p className="text-sm text-fg-muted">No payroll history yet for this employee.</p>;

    return (
        <div className="space-y-2">
            {events.map(event => (
                <div key={event.id} className="flex items-start gap-3 px-3 py-2.5 bg-surface-raised/40 border border-line rounded-nb">
                    <History size={13} className="text-fg-subtle mt-0.5" />
                    <div>
                        <div className="text-sm text-fg">{event.description || event.event_type.replace(/[._]/g, ' ')}</div>
                        <div className="text-xs text-fg-subtle">
                            {event.created_at}{event.actor_name ? ` · ${event.actor_name}` : ''}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PayrollProfileTab;
