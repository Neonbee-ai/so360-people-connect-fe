import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Mail, Phone, Calendar, DollarSign, Clock, Target, MapPin,
    Plus, Trash2, Edit2, Save, X, History, User, UserCheck, UserPlus,
    Wallet, ClipboardCheck, CalendarDays,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PayrollProfileTab from '../components/payroll/PayrollProfileTab';
import PersonLeaveConfigTab from '../components/leave/PersonLeaveConfigTab';
import PersonOnboardingTab from '../components/PersonOnboardingTab';
import Modal from '../components/Modal';
import {
    toast, Select, DetailPageTemplate, Button, IconButton, TextField, NumberInput, DateInput, Checkbox,
    FormField, Card, SectionCard, KpiCard, Badge, Avatar, Progress, DescriptionList, Skeleton, Grid, Stack, Cluster,
} from '@so360/design-system';
import EmptyState from '../components/EmptyState';
import { useActivity } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { peopleApi, allocationsApi } from '../services/peopleService';
import { timesheetApi } from '../services/timesheetApi';
import type { TimesheetEntry } from '../services/timesheetApi';
import { goalsApi, Goal } from '../services/goalsService';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import DepartmentSelector from '../components/DepartmentSelector';
import UserSelector from '../components/UserSelector';
import { useCanViewCompensation } from '../hooks/useCanViewCompensation';
import { useCanConfigureLeave } from '../hooks/useCanConfigureLeave';
import type { Person, Allocation, PersonRole } from '../types/people';

const PersonDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const formatters = usePeopleFormatters();
    // Compensation privacy tier — rate/salary fields are hidden unless the
    // user holds compensation.read (fail open while permissions load).
    const canViewCompensation = useCanViewCompensation();
    // Employees must not be able to grant themselves leave types.
    const canConfigureLeave = useCanConfigureLeave();
    const [person, setPerson] = useState<Person | null>(null);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimesheetEntry[]>([]);
    // Time entries come from the Timesheets module over a bridge that can be down
    // (503), forbidden (403) or unreachable. Those are NOT the same thing as an
    // employee who logged no time, so the tab tracks its own three states.
    const [timeEntriesStatus, setTimeEntriesStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
    const [employmentHistory, setEmploymentHistory] = useState<any[]>([]);
    const [rateHistory, setRateHistory] = useState<any[]>([]);
    const [goals, setGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<'not_found' | 'load_failed' | null>(null);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Person>>({});
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showSystemRoleModal, setShowSystemRoleModal] = useState(false);
    const [showLinkUserModal, setShowLinkUserModal] = useState(false);
    const [showUpdateRateModal, setShowUpdateRateModal] = useState(false);
    // Deep links (e.g. payroll alert "Fix" flow) may land with ?tab=payroll.
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') ?? 'overview');
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const loadData = async () => {
            setLoading(true);
            setLoadError(null);
            setTimeEntriesStatus('loading');

            // 1. Critical fetch: the employee record itself. A failure here (or an
            //    empty/invalid record) must surface a proper error/not-found state,
            //    never a blank page.
            let personData: Person | null = null;
            try {
                personData = await peopleApi.getById(id);
            } catch (error) {
                console.error('Failed to load person:', error);
                if (cancelled) return;
                setPerson(null);
                setLoadError('load_failed');
                toast.error('Failed to load employee details');
                setLoading(false);
                return;
            }
            if (cancelled) return;
            if (!personData || !personData.id) {
                setPerson(null);
                setLoadError('not_found');
                setLoading(false);
                return;
            }
            setPerson(personData);

            // 2. Secondary data: allocations, time entries, work locations. A failure
            //    in any of these must NOT blank the page — degrade gracefully to [].
            const [allocRes, timeRes, locRes] = await Promise.allSettled([
                allocationsApi.getAll({ person_id: id }),
                // Read-only: time entries come from the Timesheets module
                timesheetApi.getEntries({ person_id: id, limit: 10 }),
                workLocationsApi.getAll(),
            ]);
            if (cancelled) return;
            setAllocations(allocRes.status === 'fulfilled' ? (allocRes.value?.data ?? []) : []);
            setTimeEntries(timeRes.status === 'fulfilled' ? (timeRes.value?.data ?? []) : []);
            setTimeEntriesStatus(timeRes.status === 'fulfilled' ? 'loaded' : 'error');
            setWorkLocations(locRes.status === 'fulfilled' ? (locRes.value?.data ?? []) : []);
            // Log secondary failures but do not surface a page-level error toast.
            // Timesheet 403 is expected for users without timesheet access; work
            // location failures are non-critical. Each tab shows its own state —
            // the Time Entries tab distinguishes "unavailable" from "none logged".
            if (timeRes.status === 'rejected') {
                console.warn('[PersonDetail] Timesheet data unavailable (user may lack timesheet permissions):', (timeRes as PromiseRejectedResult).reason);
            }
            if (locRes.status === 'rejected') {
                console.warn('[PersonDetail] Work locations unavailable:', (locRes as PromiseRejectedResult).reason);
            }
            if (allocRes.status === 'rejected') {
                console.warn('[PersonDetail] Allocations unavailable:', (allocRes as PromiseRejectedResult).reason);
            }
            setLoading(false);
        };
        loadData();
        return () => { cancelled = true; };
    }, [id]);

    const handleSave = async () => {
        if (!id || !person) return;
        try {
            const updated = await peopleApi.update(id, editData);
            setPerson({ ...person, ...updated });
            setEditing(false);
            toast.success('Person updated');
            const statusChanged = editData.status && editData.status !== person.status;
            if (statusChanged) {
                recordActivity({ eventType: 'people.person.status_changed', eventCategory: 'identity', description: `Person ${person.full_name} status changed to ${editData.status}`, resourceType: 'person', resourceId: id }).catch(() => {});
            } else {
                recordActivity({ eventType: 'people.person.updated', eventCategory: 'identity', description: `Person ${person.full_name} was updated`, resourceType: 'person', resourceId: id }).catch(() => {});
            }
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    // Skills & Competencies — a capability tracker, intentionally separate from the
    // System Role (which is the Core IAM access role, edited via handleUpdateSystemRole).
    const handleAddSkill = async (skillData: { role_name: string; skill_category: string; proficiency: string; is_primary: boolean }) => {
        if (!id) return;
        try {
            const newSkill = await peopleApi.addRole(id, skillData as Omit<PersonRole, 'id' | 'person_id' | 'org_id' | 'tenant_id' | 'created_at'>);
            setPerson(prev => prev ? { ...prev, people_roles: [...(prev.people_roles || []), newSkill] } : prev);
            setShowRoleModal(false);
            toast.success('Skill added');
        } catch (error) {
            toast.error('Failed to add skill');
        }
    };

    const handleRemoveSkill = async (skillId: string) => {
        if (!id) return;
        try {
            await peopleApi.removeRole(id, skillId);
            setPerson(prev => prev ? { ...prev, people_roles: prev.people_roles?.filter(r => r.id !== skillId) } : prev);
            toast.success('Skill removed');
        } catch (error) {
            toast.error('Failed to remove skill');
        }
    };

    // System Role — the single source of truth for access. Updating it patches the
    // person's Core IAM org membership, which keeps the employee profile, Team
    // Management, and permissions in sync automatically (one membership, one role).
    const handleUpdateSystemRole = async (roleId: string, roleName: string) => {
        if (!id) return;
        try {
            await peopleApi.updateSystemRole(id, roleId);
            setPerson(prev => prev ? { ...prev, system_role: roleName } : prev);
            setShowSystemRoleModal(false);
            toast.success('System role updated');
            recordActivity({ eventType: 'people.person.role_changed', eventCategory: 'identity', description: `${person?.full_name ?? 'Person'} system role changed to ${roleName}`, resourceType: 'person', resourceId: id }).catch(() => {});
        } catch (error) {
            toast.error('Failed to update system role');
        }
    };

    // Link this person to an existing platform user account. The button used to
    // only flip `showLinkUserModal`, which nothing rendered — clicking it did
    // nothing at all. The modal below is the missing half.
    const handleLinkUser = async (userId: string) => {
        if (!id) return;
        const updated = await peopleApi.linkUser(id, userId);
        setPerson(prev => (prev ? { ...prev, ...updated, user_id: updated?.user_id ?? userId } : prev));
        setShowLinkUserModal(false);
        toast.success(`${person?.full_name ?? 'Person'} is now linked to a user account`);
        recordActivity({ eventType: 'people.person.user_linked', eventCategory: 'identity', description: `${person?.full_name ?? 'Person'} was linked to a user account`, resourceType: 'person', resourceId: id }).catch(() => {});
    };

    // Records a new effective-dated rate (employment_history row). The Update Rate
    // button used to only flip `showUpdateRateModal`, which nothing rendered —
    // clicking it did nothing at all. The modal below is the missing half.
    const handleAddNewRate = async (dto: { cost_rate: number; billing_rate?: number; effective_date?: string; reason?: string }) => {
        if (!id) return;
        await peopleApi.updateRate(id, dto);
        setShowUpdateRateModal(false);
        toast.success('New rate recorded');
        loadRateHistory();
        recordActivity({ eventType: 'people.person.rate_changed', eventCategory: 'compensation', description: `${person?.full_name ?? 'Person'} rate changed`, resourceType: 'person', resourceId: id }).catch(() => {});
    };

    // Re-fetch just the time entries. Backs the Retry action on the Time Entries
    // tab so a transient timesheet-bridge failure can be recovered without a
    // full page reload.
    const loadTimeEntries = async () => {
        if (!id) return;
        setTimeEntriesStatus('loading');
        try {
            const res = await timesheetApi.getEntries({ person_id: id, limit: 10 });
            setTimeEntries(res?.data ?? []);
            setTimeEntriesStatus('loaded');
        } catch (error) {
            console.warn('[PersonDetail] Timesheet data unavailable:', error);
            setTimeEntries([]);
            setTimeEntriesStatus('error');
        }
    };

    const loadEmploymentHistory = async () => {
        if (!id) return;
        try {
            const data = await peopleApi.getEmploymentHistory(id);
            setEmploymentHistory(data);
        } catch (error) {
            console.error('Failed to load employment history:', error);
        }
    };

    const loadRateHistory = async () => {
        if (!id) return;
        try {
            const data = await peopleApi.getRateHistory(id);
            setRateHistory(data ?? []);
        } catch (error) {
            console.error('Failed to load rate history:', error);
        }
    };

    const loadGoals = async () => {
        if (!id || !person) return;
        try {
            const data = await goalsApi.getAll({ person_id: id });
            setGoals(data.data || []);
        } catch (error) {
            console.error('Failed to load goals:', error);
            setGoals([]);
        }
    };

    useEffect(() => {
        if (!person) return;
        if (activeTab === 'employment-history') {
            loadEmploymentHistory();
        } else if (activeTab === 'rate-history') {
            loadRateHistory();
        } else if (activeTab === 'goals') {
            loadGoals();
        }
    }, [activeTab, person]);

    const goBack = () => navigate('/people/people');

    if (loading) {
        return <DetailPageTemplate title="Employee" trail={[{ label: 'People', onClick: goBack }]} loading />;
    }

    if (!person) {
        return (
            <DetailPageTemplate title="Person" trail={[{ label: 'People', onClick: goBack }]}>
                <EmptyState
                    icon={User}
                    title={loadError === 'load_failed' ? 'Unable to load employee details.' : 'Person not found.'}
                    description="Return to the people list to pick another record."
                    action={{ label: 'Back to list', onClick: goBack }}
                />
            </DetailPageTemplate>
        );
    }

    const totalAllocated = allocations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.allocation_value ?? 0), 0);

    const totalHoursLogged = timeEntries.reduce((sum, te) => sum + te.hours, 0);

    const departmentName = person.department_info?.name || person.department;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <User size={14} /> },
        { id: 'allocations', label: 'Allocations', icon: <Target size={14} /> },
        { id: 'time', label: 'Time Entries', icon: <Clock size={14} /> },
        { id: 'employment-history', label: 'Employment History', icon: <History size={14} /> },
        ...(canViewCompensation ? [{ id: 'rate-history', label: 'Rate History', icon: <DollarSign size={14} /> }] : []),
        { id: 'goals', label: 'Goals', icon: <Target size={14} /> },
        { id: 'onboarding', label: 'Onboarding', icon: <ClipboardCheck size={14} /> },
        { id: 'leave', label: 'Leave', icon: <CalendarDays size={14} /> },
        { id: 'payroll', label: 'Payroll', icon: <Wallet size={14} /> },
    ];

    const metaItems = [
        ...(person.job_title ? [{ id: 'job-title', content: person.job_title }] : []),
        ...(departmentName ? [{ id: 'department', content: departmentName }] : []),
        ...(person.work_location ? [{ id: 'work-location', icon: <MapPin size={12} />, content: person.work_location.name }] : []),
        ...(person.email ? [{ id: 'email', icon: <Mail size={12} />, content: person.email }] : []),
        ...(person.phone ? [{ id: 'phone', icon: <Phone size={12} />, content: person.phone }] : []),
        ...(person.start_date ? [{ id: 'start-date', icon: <Calendar size={12} />, content: `Since ${person.start_date}` }] : []),
    ];

    return (
        <DetailPageTemplate
            title={person.full_name || 'Unknown'}
            trail={[{ label: 'People', onClick: goBack }]}
            status={(
                <Cluster>
                    <Avatar name={person.full_name || undefined} size="md" />
                    <StatusBadge status={person.type} />
                    <StatusBadge status={person.status} />
                    {person.user_id ? (
                        <Badge tone="primary">
                            <UserCheck size={12} />
                            Linked to user account
                        </Badge>
                    ) : (
                        <Button variant="secondary" size="sm" onClick={() => setShowLinkUserModal(true)}>
                            <UserPlus size={12} />
                            Link User
                        </Button>
                    )}
                </Cluster>
            )}
            metaItems={metaItems}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            maxVisible={5}
            secondaryActions={!editing
                ? [
                    <Button key="edit" variant="secondary" onClick={() => { setEditing(true); setEditData(person); }}>
                        <Edit2 size={13} /> Edit
                    </Button>,
                    ...(activeTab === 'rate-history' && canViewCompensation
                        ? [
                            <Button key="add-rate" variant="secondary" onClick={() => setShowUpdateRateModal(true)}>
                                <DollarSign size={13} /> Add new rate
                            </Button>,
                        ]
                        : []),
                ]
                : [
                    <Button key="cancel" variant="secondary" onClick={() => setEditing(false)}>
                        <X size={13} /> Cancel
                    </Button>,
                ]}
            primaryAction={editing ? (
                <Button onClick={handleSave}>
                    <Save size={13} /> Save
                </Button>
            ) : undefined}
        >
            <Stack gap="region">
                {/* Inline Edit Fields */}
                {editing && (
                    <Card>
                        <Grid columns={4} gap="md">
                            <FormField label="Department" name="person-department">
                                <DepartmentSelector
                                    value={editData.department_id || ''}
                                    onChange={(id) => setEditData(d => ({ ...d, department_id: id }))}
                                    placeholder="Select department..."
                                    allowClear
                                />
                            </FormField>
                            {canViewCompensation && (
                                <NumberInput
                                    label="Cost Rate"
                                    name="person-cost-rate"
                                    value={editData.cost_rate || 0}
                                    onChange={(v) => setEditData(d => ({ ...d, cost_rate: v ?? 0 }))}
                                />
                            )}
                            {canViewCompensation && (
                                <NumberInput
                                    label="Billing Rate"
                                    name="person-billing-rate"
                                    value={editData.billing_rate || 0}
                                    onChange={(v) => setEditData(d => ({ ...d, billing_rate: v ?? 0 }))}
                                />
                            )}
                            <Select
                                label="Status"
                                name="persondetail-select-78"
                                value={editData.status || 'active'}
                                onChange={e => setEditData(d => ({ ...d, status: e.target.value as Person['status'] }))}
                                options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "on_leave", label: "On Leave" }]}
                            />
                            <NumberInput
                                label="Hours/Day"
                                name="person-hours-per-day"
                                value={editData.available_hours_per_day || 8}
                                onChange={(v) => setEditData(d => ({ ...d, available_hours_per_day: v ?? 0 }))}
                            />
                            <Select
                                label="Work Location"
                                name="persondetail-select-79"
                                value={editData.work_location_id || ''}
                                onChange={e => setEditData(d => ({ ...d, work_location_id: e.target.value || undefined }))}
                                options={[{ value: "", label: "None" }, ...workLocations.map((loc) => ({ value: loc.id, label: loc.name }))]}
                            />
                        </Grid>
                    </Card>
                )}

                {/* Stats Row */}
                <Grid columns={4} gap="md">
                    {canViewCompensation && (
                        <KpiCard
                            label="Cost Rate"
                            icon={DollarSign}
                            value={`${formatters.formatCurrency(person.cost_rate)}/${person.cost_rate_unit}`}
                        />
                    )}
                    <KpiCard label="Total Allocated" icon={Target} value={`${totalAllocated}%`} />
                    {/* Never report a confident "0h" when the timesheet source failed. */}
                    <KpiCard
                        label="Hours Logged"
                        icon={Clock}
                        value={timeEntriesStatus === 'error' ? '—' : `${totalHoursLogged}h`}
                    />
                    <KpiCard label="Availability" icon={Clock} value={`${person.available_hours_per_day}h/day`} />
                </Grid>

                {/* Employment Information — single source of truth, populated from the
                    employee record + Core IAM membership captured at registration. The
                    System Role here IS the access role (no separate role structure). */}
                <SectionCard
                    title="Employment Information"
                    actions={(
                        <Button variant="secondary" size="sm" onClick={() => setShowSystemRoleModal(true)}>
                            <Edit2 size={12} /> Edit Role
                        </Button>
                    )}
                >
                    <DescriptionList
                        columns={3}
                        items={[
                            { label: 'Job Title', value: person.job_title || '—' },
                            { label: 'System Role', value: person.system_role || 'No system access' },
                            { label: 'Department', value: departmentName || '—' },
                            { label: 'Employment Type', value: <span className="capitalize">{person.type || '—'}</span> },
                            { label: 'Access Status', value: <StatusBadge status={person.access_status || 'no_access'} /> },
                            { label: 'Invitation', value: person.invitation_status ? <StatusBadge status={person.invitation_status} /> : null, hidden: !person.invitation_status },
                        ]}
                    />
                </SectionCard>

                {/* Skills & Competencies — capability tracker only; NOT an access role.
                    Intentionally distinct from the System Role above. */}
                <SectionCard
                    title="Skills & Competencies"
                    actions={(
                        <Button variant="secondary" size="sm" onClick={() => setShowRoleModal(true)}>
                            <Plus size={12} /> Add Skill
                        </Button>
                    )}
                >
                    {!person.people_roles || person.people_roles.length === 0 ? (
                        <p className="text-nb-body text-fg-subtle">No skills added yet</p>
                    ) : (
                        <Cluster>
                            {person.people_roles.map(skill => (
                                <Badge key={skill.id} tone="neutral" size="md">
                                    <span className="text-nb-body text-fg">{skill.role_name}</span>
                                    {skill.skill_category && <span className="text-nb-caption text-fg-subtle">{skill.skill_category}</span>}
                                    <StatusBadge status={skill.proficiency} />
                                    {skill.is_primary && <span className="text-nb-caption text-primary">Primary</span>}
                                    <IconButton
                                        label={`Remove ${skill.role_name}`}
                                        variant="danger"
                                        size="sm"
                                        icon={<Trash2 size={12} />}
                                        onClick={() => handleRemoveSkill(skill.id)}
                                    />
                                </Badge>
                            ))}
                        </Cluster>
                    )}
                </SectionCard>

                <Card>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <Stack gap="tight">
                            <p className="text-nb-body text-fg-muted">This is the overview of {person.full_name || 'this person'}'s profile.</p>
                            <p className="text-nb-body text-fg-muted">Use the tabs above to view allocations, time entries, employment history, rate changes, and goals.</p>
                        </Stack>
                    )}

                    {/* Allocations Tab */}
                    {activeTab === 'allocations' && (
                        <div className="divide-y divide-line">
                            {allocations.length === 0 ? (
                                <EmptyState
                                    icon={Target}
                                    title="No allocations"
                                    description="Project allocations for this person will appear here"
                                />
                            ) : (
                                allocations.map(alloc => (
                                    <div key={alloc.id} className="py-nb-3 first:pt-0 last:pb-0">
                                        <Cluster justify="between">
                                            <Stack gap="none">
                                                <span className="text-nb-body text-fg">{alloc.entity_name || alloc.entity_id}</span>
                                                <span className="text-nb-caption text-fg-subtle">
                                                    {alloc.start_date} to {alloc.end_date} | {alloc.entity_type}
                                                </span>
                                            </Stack>
                                            <Cluster>
                                                <span className="text-nb-body text-fg">{alloc.allocation_value}%</span>
                                                <StatusBadge status={alloc.status} />
                                            </Cluster>
                                        </Cluster>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Time Entries Tab */}
                    {activeTab === 'time' && (
                        <div className="divide-y divide-line">
                            {timeEntriesStatus === 'loading' ? (
                                <div data-testid="time-entries-loading" role="status" aria-busy="true">
                                    <span className="sr-only">Loading time entries…</span>
                                    <Stack>
                                        <Skeleton variant="rect" className="h-nb-12 w-full" />
                                        <Skeleton variant="rect" className="h-nb-12 w-full" />
                                        <Skeleton variant="rect" className="h-nb-12 w-full" />
                                    </Stack>
                                </div>
                            ) : timeEntriesStatus === 'error' ? (
                                <EmptyState
                                    icon={Clock}
                                    title="Unable to load time entries"
                                    description="The Timesheets service did not respond. This is a connection problem, not an empty timesheet."
                                    action={{ label: 'Retry', onClick: () => { loadTimeEntries(); } }}
                                />
                            ) : timeEntries.length === 0 ? (
                                <EmptyState
                                    icon={Clock}
                                    title="No time entries"
                                    description="Time entries logged by this person will appear here"
                                />
                            ) : (
                                timeEntries.map(entry => (
                                    <div key={entry.id} className="py-nb-3 first:pt-0 last:pb-0">
                                        <Cluster justify="between">
                                            <Stack gap="none">
                                                <span className="text-nb-body text-fg">{entry.entity_name || entry.entity_type || 'Time entry'}</span>
                                                <span className="text-nb-caption text-fg-subtle">
                                                    {entry.entry_date} | {entry.description || 'No description'}
                                                </span>
                                            </Stack>
                                            <Cluster>
                                                <span className="text-nb-body text-fg">{entry.hours}h</span>
                                                <span className="text-nb-caption text-fg-muted">${entry.calculated_cost || 0}</span>
                                                <StatusBadge status={entry.status} />
                                            </Cluster>
                                        </Cluster>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Employment History Tab */}
                    {activeTab === 'employment-history' && (
                        <div className="divide-y divide-line">
                            {employmentHistory.map((event) => (
                                <div key={event.id} className="py-nb-3 first:pt-0 last:pb-0">
                                    <Cluster justify="between" align="start">
                                        <Stack gap="tight">
                                            <Cluster>
                                                <span className="text-nb-body capitalize text-fg">{event.event_type.replace('_', ' ')}</span>
                                                <StatusBadge status={event.event_type} />
                                            </Cluster>
                                            <span className="text-nb-caption text-fg-subtle">
                                                {formatters.formatDate(event.effective_date)}
                                            </span>
                                            {event.notes && (
                                                <span className="text-nb-body text-fg-muted">{event.notes}</span>
                                            )}
                                            {event.new_department_id && (
                                                <span className="text-nb-caption text-fg-subtle">
                                                    Department: {event.new_department_name || event.new_department_id}
                                                </span>
                                            )}
                                            {event.new_job_title && (
                                                <span className="text-nb-caption text-fg-subtle">
                                                    Title: {event.new_job_title}
                                                </span>
                                            )}
                                        </Stack>
                                        <span className="text-nb-caption text-fg-subtle">
                                            {formatters.formatDateTime(event.created_at)}
                                        </span>
                                    </Cluster>
                                </div>
                            ))}
                            {employmentHistory.length === 0 && (
                                <EmptyState
                                    icon={History}
                                    title="No employment history"
                                    description="Employment changes will appear here"
                                />
                            )}
                        </div>
                    )}

                    {/* Rate History Tab — compensation-gated */}
                    {activeTab === 'rate-history' && canViewCompensation && (
                        <div className="divide-y divide-line">
                            {rateHistory.map((event) => (
                                <div key={event.id} className="py-nb-3 first:pt-0 last:pb-0">
                                    <Stack gap="tight">
                                        <Cluster gap="default" align="start">
                                            <Stack gap="none">
                                                <span className="text-nb-caption text-fg-subtle">Cost Rate</span>
                                                <span className="text-nb-title text-fg">
                                                    {formatters.formatCurrency(event.new_cost_rate)}/{person.cost_rate_unit}
                                                </span>
                                            </Stack>
                                            {event.new_billing_rate && (
                                                <Stack gap="none">
                                                    <span className="text-nb-caption text-fg-subtle">Billing Rate</span>
                                                    <span className="text-nb-title text-primary">
                                                        {formatters.formatCurrency(event.new_billing_rate)}/{person.cost_rate_unit}
                                                    </span>
                                                </Stack>
                                            )}
                                        </Cluster>
                                        <span className="text-nb-caption text-fg-subtle">
                                            Effective: {formatters.formatDate(event.effective_date)}
                                        </span>
                                        {event.reason && (
                                            <span className="text-nb-body text-fg-muted">{event.reason}</span>
                                        )}
                                    </Stack>
                                </div>
                            ))}
                            {rateHistory.length === 0 && (
                                <EmptyState
                                    icon={DollarSign}
                                    title="No rate history"
                                    description="Rate changes will appear here"
                                />
                            )}
                            <p className="pt-nb-3 text-nb-caption text-fg-subtle">
                                Use Add new rate in the page header to record a new effective-dated rate. Records above are read-only history and are never edited.
                            </p>
                        </div>
                    )}

                    {/* Onboarding Tab */}
                    {activeTab === 'onboarding' && id && <PersonOnboardingTab personId={id} />}

                    {/* Leave Configuration Tab — which leave types apply to this
                        employee, and whether each came from their employment type
                        or was set for them specifically. */}
                    {activeTab === 'leave' && id && (
                        <PersonLeaveConfigTab
                            personId={id}
                            employmentTypeLabel={person?.employment_type ?? null}
                            canEdit={canConfigureLeave}
                        />
                    )}

                    {/* Payroll Tab */}
                    {activeTab === 'payroll' && person && <PayrollProfileTab person={person} />}

                    {/* Goals Tab */}
                    {activeTab === 'goals' && (
                        <div className="divide-y divide-line">
                            {goals.map((goal) => (
                                <div key={goal.id} className="py-nb-3 first:pt-0 last:pb-0">
                                    <Stack gap="tight">
                                        <Cluster justify="between" align="start">
                                            <Stack gap="tight">
                                                <Cluster>
                                                    <span className="text-nb-body text-fg">{goal.title}</span>
                                                    <StatusBadge status={goal.status} />
                                                    <StatusBadge status={goal.goal_type} />
                                                </Cluster>
                                                {goal.description && (
                                                    <span className="text-nb-caption text-fg-subtle">{goal.description}</span>
                                                )}
                                            </Stack>
                                            <span className="text-nb-caption text-fg-subtle">
                                                Due: {formatters.formatDate(goal.target_date)}
                                            </span>
                                        </Cluster>
                                        <Progress value={goal.progress_percentage} label={`${goal.title} progress`} />
                                        <span className="text-nb-caption text-fg-subtle">{goal.progress_percentage}% complete</span>
                                    </Stack>
                                </div>
                            ))}
                            {goals.length === 0 && (
                                <EmptyState
                                    icon={Target}
                                    title="No goals"
                                    description="Goals assigned to this person will appear here"
                                />
                            )}
                        </div>
                    )}
                </Card>
            </Stack>

            {/* Add Skill Modal */}
            <AddSkillModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} onAdd={handleAddSkill} />

            {/* Edit System Role Modal — updates the existing IAM membership role */}
            <EditSystemRoleModal
                isOpen={showSystemRoleModal}
                onClose={() => setShowSystemRoleModal(false)}
                currentRole={person.system_role ?? null}
                hasAccess={!!person.linked_user_id || !!person.user_id}
                onSave={handleUpdateSystemRole}
            />

            {/* Link User Modal */}
            <LinkUserModal
                isOpen={showLinkUserModal}
                onClose={() => setShowLinkUserModal(false)}
                personName={person.full_name || 'This person'}
                onLink={handleLinkUser}
            />

            {/* Add New Rate Modal — creates a new employment_history entry, never edits history */}
            <AddNewRateModal
                isOpen={showUpdateRateModal}
                onClose={() => setShowUpdateRateModal(false)}
                personName={person.full_name || 'This person'}
                onSave={handleAddNewRate}
            />
        </DetailPageTemplate>
    );
};

// Link User Modal — picks an existing platform user and links it to the person.
const LinkUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    personName: string;
    onLink: (userId: string) => Promise<void>;
}> = ({ isOpen, onClose, personName, onLink }) => {
    const [userId, setUserId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) { setUserId(null); setError(''); setSaving(false); }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) { setError('Select a user account to link.'); return; }
        setSaving(true);
        setError('');
        try {
            await onLink(userId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to link the user account. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link User Account" size="md">
            <form onSubmit={handleSubmit} noValidate>
                <Stack>
                    <p className="text-nb-body text-fg-muted">
                        Link <span className="text-fg">{personName}</span> to an existing
                        platform user so they can sign in and see their own records.
                    </p>
                    <FormField label="User Account *" name="link-user-account">
                        <UserSelector
                            value={userId}
                            onChange={(next) => { setUserId(next); setError(''); }}
                            placeholder="Search users by name or email..."
                        />
                    </FormField>
                    {error && <p role="alert" className="text-nb-caption text-danger">{error}</p>}
                    <p className="text-nb-caption text-fg-subtle">
                        Don't see the person here? They don't have an account yet — use
                        <span className="text-fg"> Invite</span> from the People Registry instead.
                    </p>
                    <Cluster justify="end">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving || !userId}>
                            {saving ? 'Linking…' : 'Link Account'}
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// Add New Rate Modal — records a new effective-dated rate. Rate History rows
// above are read-only; this always creates a new employment_history entry,
// it never edits an existing one.
const AddNewRateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    personName: string;
    onSave: (dto: { cost_rate: number; billing_rate?: number; effective_date?: string; reason?: string }) => Promise<void>;
}> = ({ isOpen, onClose, personName, onSave }) => {
    const [costRate, setCostRate] = useState<number | null>(null);
    const [billingRate, setBillingRate] = useState<number | null>(null);
    const [effectiveDate, setEffectiveDate] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCostRate(null); setBillingRate(null); setEffectiveDate(''); setReason('');
            setError(''); setSaving(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (costRate == null || Number.isNaN(costRate) || costRate <= 0) {
            setError('Enter a valid cost rate.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onSave({
                cost_rate: costRate,
                billing_rate: billingRate != null ? billingRate : undefined,
                effective_date: effectiveDate || undefined,
                reason: reason || undefined,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to record the new rate. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Rate" size="md">
            <form onSubmit={handleSubmit} noValidate>
                <Stack>
                    <p className="text-nb-body text-fg-muted">
                        Records a new effective-dated rate for <span className="text-fg">{personName}</span>.
                        Previous rate history is preserved and never edited.
                    </p>
                    <NumberInput
                        label="Cost Rate *"
                        name="add-rate-cost"
                        min={0}
                        step={0.01}
                        value={costRate}
                        onChange={(v) => { setCostRate(v); setError(''); }}
                    />
                    <NumberInput
                        label="Billing Rate"
                        name="add-rate-billing"
                        min={0}
                        step={0.01}
                        value={billingRate}
                        onChange={setBillingRate}
                    />
                    <DateInput
                        label="Effective Date"
                        name="add-rate-effective-date"
                        value={effectiveDate}
                        onChange={setEffectiveDate}
                        hint="Defaults to today if left blank."
                    />
                    <TextField
                        label="Reason"
                        name="add-rate-reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g., Annual review, Promotion"
                    />
                    {error && <p role="alert" className="text-nb-caption text-danger">{error}</p>}
                    <Cluster justify="end">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Add Rate'}
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// Add Skill Modal Component — captures a capability/competency (NOT an access role).
const AddSkillModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: { role_name: string; skill_category: string; proficiency: string; is_primary: boolean }) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [skillName, setSkillName] = useState('');
    const [category, setCategory] = useState('');
    const [proficiency, setProficiency] = useState('intermediate');
    const [isPrimary, setIsPrimary] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!skillName) return;
        onAdd({ role_name: skillName, skill_category: category, proficiency, is_primary: isPrimary });
        setSkillName(''); setCategory(''); setProficiency('intermediate'); setIsPrimary(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Skill" size="sm">
            <form onSubmit={handleSubmit}>
                <Stack>
                    <TextField
                        label="Skill Name *"
                        name="add-skill-name"
                        value={skillName}
                        onChange={e => setSkillName(e.target.value)}
                        placeholder="e.g., React, Financial Modelling"
                    />
                    <TextField
                        label="Skill Category"
                        name="add-skill-category"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        placeholder="e.g., Engineering, Design"
                    />
                    <Select
                        label="Proficiency"
                        name="persondetail-select-80"
                        value={proficiency}
                        onChange={e => setProficiency(e.target.value)}
                        options={[{ value: "beginner", label: "Beginner" }, { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" }, { value: "expert", label: "Expert" }]}
                    />
                    <Checkbox
                        label="Primary skill"
                        name="add-skill-primary"
                        checked={isPrimary}
                        onChange={e => setIsPrimary(e.target.checked)}
                    />
                    <Cluster justify="end">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Add Skill</Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

// Edit System Role Modal — updates the person's existing Core IAM org membership
// role. This is the single source of truth; it does NOT create a new role record.
const EditSystemRoleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentRole: string | null;
    hasAccess: boolean;
    onSave: (roleId: string, roleName: string) => void;
}> = ({ isOpen, onClose, currentRole, hasAccess, onSave }) => {
    const [orgRoles, setOrgRoles] = useState<Array<{ id: string; name: string }>>([]);
    const [roleId, setRoleId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setRoleId('');
        peopleApi.getOrgRoles().then(r => setOrgRoles(r.data ?? [])).catch(() => setOrgRoles([]));
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleId) return;
        const selected = orgRoles.find(r => r.id === roleId);
        setSaving(true);
        try {
            await onSave(roleId, selected?.name ?? '');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit System Role" size="sm">
            {!hasAccess ? (
                <Stack>
                    <p className="text-nb-body text-fg">
                        This person has no system access yet. Invite them to a user account from the
                        People list to assign a system role.
                    </p>
                    <Cluster justify="end">
                        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                    </Cluster>
                </Stack>
            ) : (
                <form onSubmit={handleSubmit}>
                    <Stack>
                        <FormField label="Current Role" name="current-system-role">
                            <span className="text-nb-body text-fg">{currentRole || '—'}</span>
                        </FormField>
                        <Select
                            label="New System Role *"
                            name="persondetail-select-81"
                            value={roleId}
                            onChange={e => setRoleId(e.target.value)}
                            options={[{ value: "", label: "Select role..." }, ...orgRoles.map((role) => ({ value: role.id, label: role.name }))]}
                            hint="Updates access across the profile, Team Management, and permissions."
                        />
                        <Cluster justify="end">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={saving || !roleId}>
                                {saving ? 'Saving…' : 'Save Role'}
                            </Button>
                        </Cluster>
                    </Stack>
                </form>
            )}
        </Modal>
    );
};

export default PersonDetailPage;
