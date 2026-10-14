import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Mail, Phone, Calendar, DollarSign, Clock, Target,
    Tag, Plus, Trash2, Edit2, Save, X, History, User, UserCheck, UserPlus,
    Briefcase, Shield, Wallet, ClipboardCheck, CalendarDays,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PayrollProfileTab from '../components/payroll/PayrollProfileTab';
import PersonLeaveConfigTab from '../components/leave/PersonLeaveConfigTab';
import PersonOnboardingTab from '../components/PersonOnboardingTab';
import Modal from '../components/Modal';
import { toast, Select } from '@so360/design-system';
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
            setRateHistory(data);
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

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-32 bg-surface-raised rounded" />
                    <div className="h-48 bg-surface-raised rounded-nb" />
                </div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="p-6 text-center text-fg-muted">
                {loadError === 'load_failed' ? 'Unable to load employee details.' : 'Person not found.'}
                <button onClick={() => navigate('/people/people')} className="ml-2 text-primary hover:text-primary">
                    Back to list
                </button>
            </div>
        );
    }

    const totalAllocated = allocations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.allocation_value ?? 0), 0);

    const totalHoursLogged = timeEntries.reduce((sum, te) => sum + te.hours, 0);

    return (
        <div className="p-6 space-y-6">
            {/* Back Navigation */}
            <button onClick={() => navigate('/people/people')} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors">
                <ArrowLeft size={16} />
                Back to People
            </button>

            {/* Header */}
            <div className="bg-surface border border-line rounded-nb p-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/20 border border-line-strong flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary">
                            {(person.full_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-fg">{person.full_name || 'Unknown'}</h2>
                            <StatusBadge status={person.type} />
                            <StatusBadge status={person.status} />
                            {person.user_id && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/30 rounded-nb-sm text-xs text-primary">
                                    <UserCheck size={12} />
                                    Linked to user account
                                </span>
                            )}
                            {!person.user_id && (
                                <button
                                    onClick={() => setShowLinkUserModal(true)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-surface-raised hover:bg-line border border-line-strong rounded-nb-sm text-xs text-fg-muted hover:text-fg transition-colors"
                                >
                                    <UserPlus size={12} />
                                    Link User
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-fg-muted">
                            {person.job_title && <span>{person.job_title}</span>}
                            {(person.department_info?.name || person.department) && <span className="text-fg-subtle">|</span>}
                            {(person.department_info?.name || person.department) && <span>{person.department_info?.name || person.department}</span>}
                            {person.work_location && (
                                <>
                                    <span className="text-fg-subtle">|</span>
                                    <span className="flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        {person.work_location.name}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-fg-subtle">
                            {person.email && <span className="flex items-center gap-1"><Mail size={12} />{person.email}</span>}
                            {person.phone && <span className="flex items-center gap-1"><Phone size={12} />{person.phone}</span>}
                            {person.start_date && <span className="flex items-center gap-1"><Calendar size={12} />Since {person.start_date}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <button
                                onClick={() => { setEditing(true); setEditData(person); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-line-strong rounded-nb text-xs text-fg hover:text-fg hover:border-line-strong transition-colors"
                            >
                                <Edit2 size={13} /> Edit
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-nb text-xs text-primary-fg hover:bg-primary-hover transition-colors">
                                    <Save size={13} /> Save
                                </button>
                                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-line-strong rounded-nb text-xs text-fg hover:text-fg transition-colors">
                                    <X size={13} /> Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Inline Edit Fields */}
                {editing && (
                    <div className="mt-4 pt-4 border-t border-line grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-fg-subtle mb-1">Department</label>
                            <DepartmentSelector
                                value={editData.department_id || ''}
                                onChange={(id) => setEditData(d => ({ ...d, department_id: id }))}
                                placeholder="Select department..."
                                allowClear
                            />
                        </div>
                        {canViewCompensation && (
                            <div>
                                <label className="block text-xs text-fg-subtle mb-1">Cost Rate</label>
                                <input
                                    type="number" value={editData.cost_rate || 0}
                                    onChange={e => setEditData(d => ({ ...d, cost_rate: parseFloat(e.target.value) }))}
                                    className="w-full px-3 py-1.5 bg-surface-raised border border-line-strong rounded text-sm text-fg focus:outline-none focus:border-primary"
                                />
                            </div>
                        )}
                        {canViewCompensation && (
                            <div>
                                <label className="block text-xs text-fg-subtle mb-1">Billing Rate</label>
                                <input
                                    type="number" value={editData.billing_rate || 0}
                                    onChange={e => setEditData(d => ({ ...d, billing_rate: parseFloat(e.target.value) }))}
                                    className="w-full px-3 py-1.5 bg-surface-raised border border-line-strong rounded text-sm text-fg focus:outline-none focus:border-primary"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs text-fg-subtle mb-1">Status</label>
                            <Select name="persondetail-select-78" value={editData.status || 'active'} onChange={e => setEditData(d => ({ ...d, status: e.target.value as Person['status'] }))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "on_leave", label: "On Leave" }]} />
                        </div>
                        <div>
                            <label className="block text-xs text-fg-subtle mb-1">Hours/Day</label>
                            <input
                                type="number" value={editData.available_hours_per_day || 8}
                                onChange={e => setEditData(d => ({ ...d, available_hours_per_day: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-1.5 bg-surface-raised border border-line-strong rounded text-sm text-fg focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-fg-subtle mb-1">Work Location</label>
                            <Select name="persondetail-select-79" value={editData.work_location_id || ''} onChange={e => setEditData(d => ({ ...d, work_location_id: e.target.value || undefined }))} options={[{ value: "", label: "None" }, ...workLocations.map((loc) => ({ value: loc.id, label: loc.name }))]} />
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                {canViewCompensation && (
                    <div className="bg-surface border border-line rounded-nb p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={14} className="text-success" />
                            <span className="text-xs text-fg-muted">Cost Rate</span>
                        </div>
                        <div className="text-lg font-bold text-fg">{formatters.formatCurrency(person.cost_rate)}/{person.cost_rate_unit}</div>
                    </div>
                )}
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Target size={14} className="text-primary" />
                        <span className="text-xs text-fg-muted">Total Allocated</span>
                    </div>
                    <div className="text-lg font-bold text-fg">{totalAllocated}%</div>
                </div>
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-warning" />
                        <span className="text-xs text-fg-muted">Hours Logged</span>
                    </div>
                    {/* Never report a confident "0h" when the timesheet source failed. */}
                    <div className="text-lg font-bold text-fg">
                        {timeEntriesStatus === 'error' ? '—' : `${totalHoursLogged}h`}
                    </div>
                </div>
                <div className="bg-surface border border-line rounded-nb p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-primary" />
                        <span className="text-xs text-fg-muted">Availability</span>
                    </div>
                    <div className="text-lg font-bold text-fg">{person.available_hours_per_day}h/day</div>
                </div>
            </div>

            {/* Employment Information — single source of truth, populated from the
                employee record + Core IAM membership captured at registration. The
                System Role here IS the access role (no separate role structure). */}
            <div className="bg-surface border border-line rounded-nb">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                        <Briefcase size={14} /> Employment Information
                    </h3>
                    <button
                        onClick={() => setShowSystemRoleModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-surface-raised border border-line-strong rounded-nb text-xs text-fg hover:text-fg hover:border-line-strong transition-colors"
                    >
                        <Edit2 size={12} /> Edit Role
                    </button>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                        <div className="text-xs text-fg-subtle mb-1">Job Title</div>
                        <div className="text-sm text-fg">{person.job_title || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-fg-subtle mb-1 flex items-center gap-1"><Shield size={11} /> System Role</div>
                        <div className="text-sm text-fg">
                            {person.system_role || <span className="text-fg-subtle">No system access</span>}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-fg-subtle mb-1">Department</div>
                        <div className="text-sm text-fg">{person.department_info?.name || person.department || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-fg-subtle mb-1">Employment Type</div>
                        <div className="text-sm text-fg capitalize">{person.type || '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-fg-subtle mb-1">Access Status</div>
                        <div><StatusBadge status={person.access_status || 'no_access'} /></div>
                    </div>
                    {person.invitation_status && (
                        <div>
                            <div className="text-xs text-fg-subtle mb-1">Invitation</div>
                            <div><StatusBadge status={person.invitation_status} /></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Skills & Competencies — capability tracker only; NOT an access role.
                Intentionally distinct from the System Role above. */}
            <div className="bg-surface border border-line rounded-nb">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                        <Tag size={14} /> Skills &amp; Competencies
                    </h3>
                    <button
                        onClick={() => setShowRoleModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-surface-raised border border-line-strong rounded-nb text-xs text-fg hover:text-fg hover:border-line-strong transition-colors"
                    >
                        <Plus size={12} /> Add Skill
                    </button>
                </div>
                <div className="p-5">
                    {!person.people_roles || person.people_roles.length === 0 ? (
                        <p className="text-sm text-fg-subtle">No skills added yet</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {person.people_roles.map(skill => (
                                <div key={skill.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-raised border border-line-strong rounded-nb">
                                    <span className="text-sm text-fg">{skill.role_name}</span>
                                    {skill.skill_category && <span className="text-xs text-fg-subtle">{skill.skill_category}</span>}
                                    <StatusBadge status={skill.proficiency} />
                                    {skill.is_primary && <span className="text-xs text-primary font-medium">Primary</span>}
                                    <button onClick={() => handleRemoveSkill(skill.id)} className="ml-1 text-fg-subtle hover:text-danger">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-surface border border-line rounded-nb">
                <div className="border-b border-line">
                    <div className="flex items-center gap-1 px-5 py-3">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'overview'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <User size={14} className="inline mr-1.5" />
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('allocations')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'allocations'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <Target size={14} className="inline mr-1.5" />
                            Allocations
                        </button>
                        <button
                            onClick={() => setActiveTab('time')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'time'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <Clock size={14} className="inline mr-1.5" />
                            Time Entries
                        </button>
                        <button
                            onClick={() => setActiveTab('employment-history')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'employment-history'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <History size={14} className="inline mr-1.5" />
                            Employment History
                        </button>
                        {canViewCompensation && (
                            <button
                                onClick={() => setActiveTab('rate-history')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    activeTab === 'rate-history'
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                                }`}
                            >
                                <DollarSign size={14} className="inline mr-1.5" />
                                Rate History
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('goals')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'goals'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <Target size={14} className="inline mr-1.5" />
                            Goals
                        </button>
                        <button
                            onClick={() => setActiveTab('onboarding')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'onboarding'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <ClipboardCheck size={14} className="inline mr-1.5" />
                            Onboarding
                        </button>
                        <button
                            onClick={() => setActiveTab('leave')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'leave'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <CalendarDays size={14} className="inline mr-1.5" />
                            Leave
                        </button>
                        <button
                            onClick={() => setActiveTab('payroll')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'payroll'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                            }`}
                        >
                            <Wallet size={14} className="inline mr-1.5" />
                            Payroll
                        </button>
                    </div>
                </div>

                <div className="p-5">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            <div className="text-sm text-fg-muted">
                                <p className="mb-2">This is the overview of {person.full_name || 'this person'}'s profile.</p>
                                <p>Use the tabs above to view allocations, time entries, employment history, rate changes, and goals.</p>
                            </div>
                        </div>
                    )}

                    {/* Allocations Tab */}
                    {activeTab === 'allocations' && (
                        <div className="space-y-3">
                            {allocations.length === 0 ? (
                                <EmptyState
                                    icon={Target}
                                    title="No allocations"
                                    description="Project allocations for this person will appear here"
                                />
                            ) : (
                                allocations.map(alloc => (
                                    <div key={alloc.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-fg">{alloc.entity_name || alloc.entity_id}</div>
                                                <div className="text-xs text-fg-subtle">
                                                    {alloc.start_date} to {alloc.end_date} | {alloc.entity_type}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-fg">
                                                    {alloc.allocation_value}%
                                                </span>
                                                <StatusBadge status={alloc.status} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Time Entries Tab */}
                    {activeTab === 'time' && (
                        <div className="space-y-3">
                            {timeEntriesStatus === 'loading' ? (
                                <div data-testid="time-entries-loading" role="status" aria-busy="true" className="animate-pulse space-y-3">
                                    <span className="sr-only">Loading time entries…</span>
                                    <div className="h-16 bg-surface-raised rounded-nb" />
                                    <div className="h-16 bg-surface-raised rounded-nb" />
                                    <div className="h-16 bg-surface-raised rounded-nb" />
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
                                    <div key={entry.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-fg">{entry.entity_name || entry.entity_type || 'Time entry'}</div>
                                                <div className="text-xs text-fg-subtle">
                                                    {entry.entry_date} | {entry.description || 'No description'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-fg">{entry.hours}h</span>
                                                <span className="text-xs text-fg-muted">${entry.calculated_cost || 0}</span>
                                                <StatusBadge status={entry.status} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Employment History Tab */}
                    {activeTab === 'employment-history' && (
                        <div className="space-y-3">
                            {employmentHistory.map((event) => (
                                <div key={event.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-fg capitalize">{event.event_type.replace('_', ' ')}</span>
                                                <StatusBadge status={event.event_type} />
                                            </div>
                                            <div className="text-xs text-fg-subtle">
                                                {formatters.formatDate(event.effective_date)}
                                            </div>
                                            {event.notes && (
                                                <div className="mt-2 text-sm text-fg-muted">{event.notes}</div>
                                            )}
                                            {event.new_department_id && (
                                                <div className="mt-1 text-xs text-fg-subtle">
                                                    Department: {event.new_department_name || event.new_department_id}
                                                </div>
                                            )}
                                            {event.new_job_title && (
                                                <div className="mt-1 text-xs text-fg-subtle">
                                                    Title: {event.new_job_title}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-fg-subtle">
                                            {formatters.formatDateTime(event.created_at)}
                                        </div>
                                    </div>
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
                        <div className="space-y-3">
                            {rateHistory.map((event) => (
                                <div key={event.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div>
                                                    <div className="text-xs text-fg-subtle">Cost Rate</div>
                                                    <div className="text-lg font-medium text-fg">
                                                        {formatters.formatCurrency(event.new_cost_rate)}/{person.cost_rate_unit}
                                                    </div>
                                                </div>
                                                {event.new_billing_rate && (
                                                    <div>
                                                        <div className="text-xs text-fg-subtle">Billing Rate</div>
                                                        <div className="text-lg font-medium text-primary">
                                                            {formatters.formatCurrency(event.new_billing_rate)}/{person.cost_rate_unit}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-fg-subtle">
                                                Effective: {formatters.formatDate(event.effective_date)}
                                            </div>
                                            {event.reason && (
                                                <div className="mt-2 text-sm text-fg-muted">{event.reason}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {rateHistory.length === 0 && (
                                <EmptyState
                                    icon={DollarSign}
                                    title="No rate history"
                                    description="Rate changes will appear here"
                                />
                            )}
                            <div className="border-t border-line pt-3">
                                <button
                                    onClick={() => setShowUpdateRateModal(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-raised hover:bg-line border border-line-strong rounded-nb text-sm text-fg transition-colors"
                                >
                                    <DollarSign size={16} />
                                    Add New Rate
                                </button>
                                <p className="mt-2 text-xs text-fg-subtle">
                                    This records a new effective-dated rate. Records above are read-only history and are never edited.
                                </p>
                            </div>
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
                        <div className="space-y-3">
                            {goals.map((goal) => (
                                <div key={goal.id} className="bg-surface-raised border border-line-strong rounded-nb p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-fg">{goal.title}</span>
                                                <StatusBadge status={goal.status} />
                                                <StatusBadge status={goal.goal_type} />
                                            </div>
                                            {goal.description && (
                                                <div className="text-xs text-fg-subtle mt-1">{goal.description}</div>
                                            )}
                                        </div>
                                        <div className="text-xs text-fg-subtle">
                                            Due: {formatters.formatDate(goal.target_date)}
                                        </div>
                                    </div>
                                    <div className="w-full bg-surface rounded-full h-2">
                                        <div
                                            className="bg-primary h-2 rounded-full transition-all"
                                            style={{ width: `${goal.progress_percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-fg-subtle mt-1">{goal.progress_percentage}% complete</div>
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
                </div>
            </div>

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

        </div>
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <p className="text-sm text-fg-muted">
                    Link <span className="text-fg font-medium">{personName}</span> to an existing
                    platform user so they can sign in and see their own records.
                </p>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">User Account *</label>
                    <UserSelector
                        value={userId}
                        onChange={(next) => { setUserId(next); setError(''); }}
                        placeholder="Search users by name or email..."
                    />
                    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
                </div>
                <p className="text-xs text-fg-subtle">
                    Don't see the person here? They don't have an account yet — use
                    <span className="text-fg"> Invite</span> from the People Registry instead.
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !userId}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Linking…' : 'Link Account'}
                    </button>
                </div>
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
    const [costRate, setCostRate] = useState('');
    const [billingRate, setBillingRate] = useState('');
    const [effectiveDate, setEffectiveDate] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCostRate(''); setBillingRate(''); setEffectiveDate(''); setReason('');
            setError(''); setSaving(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedCostRate = Number(costRate);
        if (!costRate || Number.isNaN(parsedCostRate) || parsedCostRate <= 0) {
            setError('Enter a valid cost rate.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onSave({
                cost_rate: parsedCostRate,
                billing_rate: billingRate ? Number(billingRate) : undefined,
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <p className="text-sm text-fg-muted">
                    Records a new effective-dated rate for <span className="text-fg font-medium">{personName}</span>.
                    Previous rate history is preserved and never edited.
                </p>
                <div>
                    <label htmlFor="add-rate-cost" className="block text-xs text-fg-muted mb-1">Cost Rate *</label>
                    <input id="add-rate-cost" type="number" min="0" step="0.01" required value={costRate}
                        onChange={e => { setCostRate(e.target.value); setError(''); }}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary" />
                </div>
                <div>
                    <label htmlFor="add-rate-billing" className="block text-xs text-fg-muted mb-1">Billing Rate</label>
                    <input id="add-rate-billing" type="number" min="0" step="0.01" value={billingRate}
                        onChange={e => setBillingRate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary" />
                </div>
                <div>
                    <label htmlFor="add-rate-effective-date" className="block text-xs text-fg-muted mb-1">Effective Date</label>
                    <input id="add-rate-effective-date" type="date" value={effectiveDate}
                        onChange={e => setEffectiveDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary" />
                    <p className="mt-1 text-xs text-fg-subtle">Defaults to today if left blank.</p>
                </div>
                <div>
                    <label htmlFor="add-rate-reason" className="block text-xs text-fg-muted mb-1">Reason</label>
                    <input id="add-rate-reason" type="text" value={reason} onChange={e => setReason(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="e.g., Annual review, Promotion" />
                </div>
                {error && <p role="alert" className="text-xs text-danger">{error}</p>}
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving…' : 'Add Rate'}
                    </button>
                </div>
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
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Skill Name *</label>
                    <input type="text" required value={skillName} onChange={e => setSkillName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="e.g., React, Financial Modelling" />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Skill Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="e.g., Engineering, Design" />
                </div>
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Proficiency</label>
                    <Select name="persondetail-select-80" value={proficiency} onChange={e => setProficiency(e.target.value)} options={[{ value: "beginner", label: "Beginner" }, { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" }, { value: "expert", label: "Expert" }]} />
                </div>
                <label className="flex items-center gap-2 text-sm text-fg">
                    <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
                        className="rounded border-line-strong" />
                    Primary skill
                </label>
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb">Add Skill</button>
                </div>
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
                <div className="space-y-4">
                    <p className="text-sm text-fg">
                        This person has no system access yet. Invite them to a user account from the
                        People list to assign a system role.
                    </p>
                    <div className="flex justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">Close</button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Current Role</label>
                        <div className="text-sm text-fg">{currentRole || '—'}</div>
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">New System Role *</label>
                        <Select name="persondetail-select-81" required value={roleId} onChange={e => setRoleId(e.target.value)} options={[{ value: "", label: "Select role..." }, ...orgRoles.map((role) => ({ value: role.id, label: role.name }))]} />
                        <p className="mt-1 text-xs text-fg-subtle">Updates access across the profile, Team Management, and permissions.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg">Cancel</button>
                        <button type="submit" disabled={saving || !roleId} className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium rounded-nb">
                            {saving ? 'Saving…' : 'Save Role'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default PersonDetailPage;
