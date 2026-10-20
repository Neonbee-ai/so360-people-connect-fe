import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ChevronDown, ChevronUp, Briefcase, DollarSign, Layers, Award, Landmark,
    CreditCard, FileText, History, Plus, Eye, Trash2, TrendingUp,
} from 'lucide-react';
import {
    toast, Alert, Button, IconButton, Card, Checkbox, Cluster, DateInput, FieldGrid, FormActions, FormField,
    NumberInput, Select, Skeleton, Stack, TextField,
} from '@so360/design-system';
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
        return <Skeleton variant="rect" className="h-64" />;
    }

    return (
        <Stack gap="none">
            {sections.map(({ key, label, icon: Icon }) => (
                <div key={key} data-testid={`payroll-section-${key}`} className="border-b border-line last:border-b-0">
                    <Button
                        name={`payroll-section-toggle-${key}`}
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={() => toggle(key)}
                        aria-expanded={openSection === key}
                    >
                        <Cluster gap="tight" align="center">
                            <Icon size={15} className="text-primary" />
                            <span className="text-nb-body font-medium text-fg">{label}</span>
                        </Cluster>
                        {openSection === key ? <ChevronUp size={15} className="text-fg-muted" /> : <ChevronDown size={15} className="text-fg-muted" />}
                    </Button>
                    {openSection === key && (
                        <div className="p-4 border-t border-line">
                            {key === 'employment' && <EmploymentSection person={person} profile={profile} onSaved={loadProfile} />}
                            {key === 'salary' && <SalarySection personId={person.id} />}
                            {key === 'overrides' && <OverridesSection personId={person.id} />}
                            {key === 'benefits' && <BenefitsSection personId={person.id} />}
                            {key === 'tax' && <TaxStatutorySection personId={person.id} profile={profile} onSaved={loadProfile} />}
                            {key === 'bank' && <BankSection personId={person.id} />}
                            {key === 'documents' && (
                                <p className="text-nb-body text-fg-muted">
                                    Payroll documents (proofs, contracts) live with the person's documents.{' '}
                                    <Link to={`/people/people/${person.id}?tab=overview`} className="text-primary hover:text-primary">Open documents</Link>
                                </p>
                            )}
                            {key === 'history' && <HistorySection personId={person.id} />}
                        </div>
                    )}
                </div>
            ))}
        </Stack>
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
        <Stack>
            {/* Read-only master data from People Registry */}
            <FieldGrid columns={3}>
                {[
                    ['Name', person.full_name],
                    ['Designation', person.job_title || '—'],
                    ['Department', person.department_info?.name || person.department || '—'],
                    ['Type', person.type || '—'],
                    ['Joining Date', person.start_date || '—'],
                    ['Status', person.status || '—'],
                ].map(([label, value]) => (
                    <Card key={label} name={`person-${label}`} padding="sm">
                        <div className="text-nb-caption text-fg-subtle">{label}</div>
                        <div className="text-nb-body text-fg capitalize">{value}</div>
                    </Card>
                ))}
            </FieldGrid>
            <p className="text-nb-caption text-fg-subtle">Identity fields come from the People Registry and are edited there — never duplicated in payroll.</p>

            {/* Editable contract */}
            <FieldGrid columns={3}>
                <Select
                    name="payroll-contract-type"
                    label="Contract Type"
                    value={contract.type || 'permanent'}
                    onChange={e => setContract(c => ({ ...c, type: e.target.value as 'permanent' | 'fixed_term' }))}
                    options={[{ value: 'permanent', label: 'Permanent' }, { value: 'fixed_term', label: 'Fixed term' }]}
                />
                <DateInput
                    name="payroll-contract-start"
                    label="Contract Start"
                    value={contract.start || ''}
                    onChange={v => setContract(c => ({ ...c, start: v || '' }))}
                />
                {contract.type === 'fixed_term' && (
                    <DateInput
                        name="payroll-contract-end"
                        label="Contract End"
                        value={contract.end || ''}
                        onChange={v => setContract(c => ({ ...c, end: v || '' }))}
                    />
                )}
            </FieldGrid>
            <Cluster justify="end">
                <Button variant="primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Contract'}
                </Button>
            </Cluster>
        </Stack>
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

    if (loading) return <Skeleton variant="rect" className="h-32" />;

    return (
        <Stack>
            {!current ? (
                <Alert variant="warning">
                    No salary assigned yet. A salary structure is required before this employee can be included in payroll.
                </Alert>
            ) : (
                <Card name="current-salary">
                    <Cluster justify="between" align="center">
                        <div>
                            <div className="text-nb-caption text-fg-subtle">Current Monthly Wage</div>
                            <div className="text-nb-title font-bold text-fg">{formatters.formatCurrency(current.monthly_wage)}</div>
                            <div className="text-nb-caption text-fg-muted mt-1">
                                {current.structure_name || 'Structure'} v{current.structure_version} · effective {current.effective_from}
                            </div>
                        </div>
                        {current.annual_ctc != null && (
                            <div className="text-right">
                                <div className="text-nb-caption text-fg-subtle">Annual CTC</div>
                                <div className="text-nb-body font-semibold text-fg">{formatters.formatCurrency(current.annual_ctc)}</div>
                            </div>
                        )}
                    </Cluster>
                </Card>
            )}

            <Cluster justify="end">
                <Button variant="primary" onClick={() => setShowAdjustModal(true)}>
                    <TrendingUp size={14} /> Salary Adjustment
                </Button>
            </Cluster>

            {/* Revision timeline */}
            {assignments.length > 0 && (
                <Stack gap="tight">
                    <h4 className="text-nb-caption font-semibold text-fg-muted">Revision History</h4>
                    {assignments.map(assignment => (
                        <Card key={assignment.id} name={`revision-${assignment.id}`} padding="sm">
                            <Cluster justify="between" align="center">
                                <div>
                                    <div className="text-nb-body text-fg">{formatters.formatCurrency(assignment.monthly_wage)}/month</div>
                                    <div className="text-nb-caption text-fg-subtle">
                                        {assignment.effective_from} → {assignment.effective_to || 'current'}
                                        {assignment.revision_reason ? ` · ${assignment.revision_reason}` : ''}
                                    </div>
                                </div>
                                <StatusChip status={assignment.revision_type === 'initial' ? 'draft' : 'approved'} label={assignment.revision_type.replace(/_/g, ' ')} />
                            </Cluster>
                        </Card>
                    ))}
                </Stack>
            )}

            <SalaryAdjustmentModal
                isOpen={showAdjustModal}
                personId={personId}
                current={current || null}
                onClose={() => setShowAdjustModal(false)}
                onSaved={() => { setShowAdjustModal(false); load(); }}
                formatCurrency={formatters.formatCurrency}
            />
        </Stack>
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
            <form onSubmit={submit}>
                <Stack>
                    {/* Previous → new preview */}
                    <FieldGrid columns={2}>
                        <Card name="previous-wage" padding="sm">
                            <div className="text-nb-caption text-fg-subtle">Previous</div>
                            <div className="text-nb-title font-semibold text-fg">
                                {current ? formatCurrency(current.monthly_wage) : '—'}
                            </div>
                        </Card>
                        <Card name="new-wage" padding="sm" className="border-primary">
                            <div className="text-nb-caption text-primary">New</div>
                            <div className="text-nb-title font-semibold text-primary">
                                {form.monthly_wage ? formatCurrency(form.monthly_wage) : '—'}
                            </div>
                        </Card>
                    </FieldGrid>

                    <FieldGrid columns={2}>
                        <NumberInput
                            name="payroll-new-monthly-wage"
                            label="New Monthly Wage"
                            aria-label="New Monthly Wage"
                            required
                            min={0}
                            step={0.01}
                            value={form.monthly_wage || null}
                            onChange={v => setForm(f => ({ ...f, monthly_wage: v || 0 }))}
                        />
                        {structuresLoaded && structures.length === 0 ? (
                            <FormField label="Salary Structure" name="payroll-salary-structure" required>
                                {canConfigureStructures ? (
                                    <Button variant="secondary" size="sm" className="w-full justify-start" onClick={goConfigureStructures}>
                                        No salary structures configured — Configure Salary Structure →
                                    </Button>
                                ) : (
                                    <p className="text-nb-caption text-fg-muted">
                                        Contact an administrator to configure salary structures.
                                    </p>
                                )}
                            </FormField>
                        ) : (
                            <Select
                                name="payroll-salary-structure"
                                label="Salary Structure"
                                required
                                value={form.structure_id}
                                onChange={e => setForm(f => ({ ...f, structure_id: e.target.value }))}
                                options={[{ value: '', label: 'Select structure…' }, ...structures.map((s) => ({ value: s.id, label: `${s.name} (v${s.version})` }))]}
                            />
                        )}
                        <DateInput
                            name="payroll-effective-from"
                            label="Effective From"
                            required
                            value={form.effective_from}
                            onChange={v => setForm(f => ({ ...f, effective_from: v || '' }))}
                        />
                        <Select
                            name="payroll-revision-type"
                            label="Revision Type"
                            value={form.revision_type}
                            onChange={e => setForm(f => ({ ...f, revision_type: e.target.value as RevisionType }))}
                            options={[{ value: 'initial', label: 'Initial' }, { value: 'increment', label: 'Increment' }, { value: 'decrement', label: 'Decrement' }, { value: 'structure_change', label: 'Structure change' }, { value: 'adjustment', label: 'Adjustment' }]}
                        />
                    </FieldGrid>
                    <TextField
                        name="payroll-revision-reason"
                        label="Reason"
                        type="text"
                        required
                        value={form.revision_reason}
                        onChange={e => setForm(f => ({ ...f, revision_reason: e.target.value }))}
                        placeholder="Annual increment 2026"
                    />

                    <FormActions divider onCancel={onClose} submitting={saving} submitLabel={saving ? 'Saving…' : 'Apply Adjustment'} />
                </Stack>
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

    if (loading) return <Skeleton variant="rect" className="h-24" />;

    return (
        <Stack gap="tight">
            <Cluster justify="end">
                <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                    <Plus size={12} /> Add Override
                </Button>
            </Cluster>
            {overrides.length === 0 ? (
                <p className="text-nb-body text-fg-muted">No component overrides. Overrides add, remove or change a component just for this employee — e.g. a loan EMI or a one-time bonus.</p>
            ) : (
                <Stack gap="tight">
                    {overrides.map(override => (
                        <Card key={override.id} name={`override-${override.id}`} padding="sm">
                            <Cluster justify="between" align="center">
                                <div>
                                    <div className="text-nb-body text-fg">
                                        {override.component_code || override.component_name || override.component_id}
                                        <span className="text-nb-caption text-fg-subtle ml-2 capitalize">{override.action}</span>
                                        {override.calc_override?.amount != null && <span className="text-nb-caption text-fg-muted ml-2">{override.calc_override.amount}</span>}
                                    </div>
                                    <div className="text-nb-caption text-fg-subtle">
                                        {override.recurrence === 'one_time' ? 'One time' : `${override.effective_from} → ${override.effective_to || 'ongoing'}`}
                                        {override.reason ? ` · ${override.reason}` : ''}
                                    </div>
                                </div>
                                <IconButton label="Remove override" variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => remove(override)} />
                            </Cluster>
                        </Card>
                    ))}
                </Stack>
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
        </Stack>
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
            <form onSubmit={e => { e.preventDefault(); if (form.component_id && form.effective_from) onSave(form); }}>
                <Stack>
                    <Select
                        name="payroll-override-component"
                        label="Component"
                        required
                        value={form.component_id || ''}
                        onChange={e => setForm(f => ({ ...f, component_id: e.target.value }))}
                        options={[{ value: '', label: 'Select component…' }, ...components.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                    />
                    <FieldGrid columns={2}>
                        <Select
                            name="payroll-override-action"
                            label="Action"
                            hint="Add = component the structure doesn't include. Remove = skip a structure component for this employee. Override = keep it but change the amount."
                            value={form.action}
                            onChange={e => setForm(f => ({ ...f, action: e.target.value as ComponentOverride['action'] }))}
                            options={[{ value: 'add', label: 'Add' }, { value: 'remove', label: 'Remove' }, { value: 'override', label: 'Override' }]}
                        />
                        {form.action !== 'remove' && (
                            <NumberInput
                                name="payroll-override-amount"
                                label="Amount"
                                min={0}
                                step={0.01}
                                value={form.calc_override?.amount ?? null}
                                onChange={v => setForm(f => ({ ...f, calc_override: { amount: v || 0 } }))}
                            />
                        )}
                        <Select
                            name="payroll-override-recurrence"
                            label="Recurrence"
                            hint="Recurring applies every run in the effective window; one-time applies to a single pay period only."
                            value={form.recurrence}
                            onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as ComponentOverride['recurrence'] }))}
                            options={[{ value: 'recurring', label: 'Recurring' }, { value: 'one_time', label: 'One time' }]}
                        />
                        <DateInput
                            name="payroll-override-effective-from"
                            label="Effective From"
                            required
                            value={form.effective_from || ''}
                            onChange={v => setForm(f => ({ ...f, effective_from: v || '' }))}
                        />
                    </FieldGrid>
                    <TextField
                        name="payroll-override-reason"
                        label="Reason"
                        type="text"
                        value={form.reason || ''}
                        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                        placeholder="Loan EMI recovery"
                    />
                    <FormActions divider onCancel={onClose} submitLabel="Add Override" />
                </Stack>
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

    if (loading) return <Skeleton variant="rect" className="h-24" />;

    return (
        <Stack gap="tight">
            <Cluster justify="end">
                <Button variant="primary" size="sm" onClick={() => { setForm({}); setShowModal(true); }}>
                    <Plus size={12} /> Add Benefit
                </Button>
            </Cluster>
            {benefits.length === 0 ? (
                <p className="text-nb-body text-fg-muted">No benefits assigned to this employee.</p>
            ) : (
                <Stack gap="tight">
                    {benefits.map(benefit => (
                        <Card key={benefit.id} name={`benefit-${benefit.id}`} padding="sm">
                            <Cluster justify="between" align="center">
                                <div>
                                    <div className="text-nb-body text-fg">{benefit.benefit_type_name || benefit.benefit_type_id}</div>
                                    <div className="text-nb-caption text-fg-subtle">
                                        {benefit.amount_override != null ? `Amount ${benefit.amount_override}` : 'Default amount'} · from {benefit.effective_from}
                                    </div>
                                </div>
                                <IconButton
                                    label="Remove benefit"
                                    variant="danger"
                                    size="sm"
                                    icon={<Trash2 size={13} />}
                                    onClick={async () => {
                                        try {
                                            await payrollApi.employees.benefits.remove(personId, benefit.id);
                                            toast.success('Benefit removed');
                                            load();
                                        } catch {
                                            toast.error('Failed to remove benefit');
                                        }
                                    }}
                                />
                            </Cluster>
                        </Card>
                    ))}
                </Stack>
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
                >
                    <Stack>
                        <Select
                            name="payroll-benefit-type"
                            label="Benefit Type"
                            required
                            value={form.benefit_type_id || ''}
                            onChange={e => setForm(f => ({ ...f, benefit_type_id: e.target.value }))}
                            options={[{ value: '', label: 'Select benefit…' }, ...types.map((t) => ({ value: t.id, label: t.name }))]}
                        />
                        <FieldGrid columns={2}>
                            <NumberInput
                                name="payroll-benefit-amount"
                                label="Amount Override"
                                min={0}
                                step={0.01}
                                value={form.amount_override ?? null}
                                onChange={v => setForm(f => ({ ...f, amount_override: v ?? null }))}
                                placeholder="Default"
                            />
                            <DateInput
                                name="payroll-benefit-effective-from"
                                label="Effective From"
                                required
                                value={form.effective_from || ''}
                                onChange={v => setForm(f => ({ ...f, effective_from: v || '' }))}
                            />
                        </FieldGrid>
                        <FormActions divider onCancel={() => setShowModal(false)} submitLabel="Add Benefit" />
                    </Stack>
                </form>
            </Modal>
        </Stack>
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
        <Stack>
            <Cluster justify="between" align="center">
                <Cluster gap="none" align="center">
                    <span className="text-nb-body text-fg">Tax Regime</span>
                    <FieldTooltip text="The regime used for this employee's TDS. The new regime has lower rates without deductions; the old regime honours approved declarations." />
                </Cluster>
                <Cluster gap="tight" align="center">
                    {(['new', 'old'] as const).map(r => (
                        <Button
                            key={r}
                            size="sm"
                            variant={regime === r ? 'primary' : 'secondary'}
                            aria-pressed={regime === r}
                            onClick={() => setRegime(r)}
                        >
                            {r === 'new' ? 'New Regime' : 'Old Regime'}
                        </Button>
                    ))}
                </Cluster>
            </Cluster>

            <FieldGrid columns={2}>
                {identifierDefs.map(def => (
                    <Stack key={def.key} gap="none">
                        <TextField
                            name={`payroll-identifier-${def.key}`}
                            label={`${def.label}${def.required_for_payroll ? ' *' : ''}`}
                            hint={IDENTIFIER_TOOLTIPS[def.key] || `${def.label} statutory identifier.`}
                            type="text"
                            value={identifiers[def.key] || ''}
                            onChange={e => setIdentifiers(prev => ({ ...prev, [def.key]: e.target.value }))}
                            aria-label={def.label}
                        />
                        {def.required_for_payroll && !identifiers[def.key] && (
                            <p className="text-nb-caption text-warning mt-1">
                                {def.label} is required before this employee can be included in payroll.
                            </p>
                        )}
                    </Stack>
                ))}
            </FieldGrid>

            <Cluster justify="end">
                <Button variant="primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Tax & Statutory'}
                </Button>
            </Cluster>
        </Stack>
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

    if (loading) return <Skeleton variant="rect" className="h-24" />;

    return (
        <Stack gap="tight">
            <Cluster justify="end">
                <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                    <Plus size={12} /> Add Bank Account
                </Button>
            </Cluster>
            {accounts.length === 0 ? (
                <Alert variant="warning">Bank account is required before this employee can be included in payroll.</Alert>
            ) : (
                <Stack gap="tight">
                    {accounts.map(account => (
                        <Card key={account.id} name={`bank-${account.id}`} padding="sm">
                            <Cluster justify="between" align="center">
                                <div>
                                    <Cluster gap="tight" align="center">
                                        <span className="text-nb-body font-medium text-fg">{account.bank_name}</span>
                                        {account.is_primary && <StatusChip status="active" label="Primary" />}
                                    </Cluster>
                                    <div className="text-nb-caption text-fg-muted mt-0.5">
                                        {account.account_holder} · {revealed[account.id] || `•••• ${account.account_number_last4}`}
                                        {account.ifsc ? ` · ${account.ifsc}` : ''}
                                    </div>
                                </div>
                                {canReveal && !revealed[account.id] && (
                                    <Button variant="secondary" size="sm" onClick={() => reveal(account)}>
                                        <Eye size={12} /> Reveal
                                    </Button>
                                )}
                            </Cluster>
                            {canReveal && !revealed[account.id] && (
                                <p className="text-nb-caption text-fg-subtle mt-1.5">Revealing the full account number is recorded in the audit log.</p>
                            )}
                        </Card>
                    ))}
                </Stack>
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
        </Stack>
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
            <form onSubmit={e => { e.preventDefault(); if (form.bank_name && form.account_holder && form.account_number) onSave(form); }}>
                <Stack>
                    <FieldGrid columns={2}>
                        <TextField name="payroll-bank-name" label="Bank Name" type="text" required value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
                        <TextField name="payroll-bank-holder" label="Account Holder" type="text" required value={form.account_holder} onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))} />
                        <TextField name="payroll-bank-number" label="Account Number" type="text" required value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} autoComplete="off" />
                        <TextField
                            name="payroll-bank-ifsc"
                            label="IFSC"
                            hint="Indian Financial System Code identifying the bank branch for transfers."
                            type="text"
                            value={form.ifsc || ''}
                            onChange={e => setForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
                        />
                        <Select
                            name="payroll-bank-account-type"
                            label="Account Type"
                            value={form.account_type}
                            onChange={e => setForm(f => ({ ...f, account_type: e.target.value as BankAccountPayload['account_type'] }))}
                            options={[{ value: 'savings', label: 'Savings' }, { value: 'current', label: 'Current' }]}
                        />
                        <Select
                            name="payroll-bank-payment-method"
                            label="Payment Method"
                            value={form.payment_method}
                            onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as BankAccountPayload['payment_method'] }))}
                            options={[{ value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }]}
                        />
                    </FieldGrid>
                    <Checkbox
                        name="payroll-bank-primary"
                        label="Primary account for salary payments"
                        checked={!!form.is_primary}
                        onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
                    />
                    <FormActions divider onCancel={onClose} submitLabel="Add Account" />
                </Stack>
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

    if (loading) return <Skeleton variant="rect" className="h-24" />;
    if (events.length === 0) return <p className="text-nb-body text-fg-muted">No payroll history yet for this employee.</p>;

    return (
        <Stack gap="tight">
            {events.map(event => (
                <Card key={event.id} name={`history-${event.id}`} padding="sm">
                    <Cluster gap="tight" align="start">
                        <History size={13} className="text-fg-subtle mt-0.5" />
                        <div>
                            <div className="text-nb-body text-fg">{event.description || event.event_type.replace(/[._]/g, ' ')}</div>
                            <div className="text-nb-caption text-fg-subtle">
                                {event.created_at}{event.actor_name ? ` · ${event.actor_name}` : ''}
                            </div>
                        </div>
                    </Cluster>
                </Card>
            ))}
        </Stack>
    );
};

export default PayrollProfileTab;
