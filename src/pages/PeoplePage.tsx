import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, UserPlus, Search, Filter, Mail, Phone, Briefcase, Upload, Download, ChevronDown, MoreHorizontal, Pencil, UserMinus, UserCheck, Archive, Trash2, Send, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { peopleApi } from '../services/peopleService';
import type { Person, CreatePersonPayload, PersonStatus, AccessStatus, InvitationStatus } from '../types/people';
import DepartmentSelector from '../components/DepartmentSelector';
import UserSelector from '../components/UserSelector';
import { usePeopleContext } from '../hooks/useShellContext';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, toast } from '@so360/design-system';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import { usePeopleFormatters } from '../utils/formatters';
import { fetchOrgBaseCurrency } from '../services/settingsService';

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

// Access-status badge — mirrors the StatusBadge colour vocabulary used across
// this module (emerald=ok, amber=pending, slate=neutral, rose=blocked). A
// 'blocked' login_status always wins over access_status.
const ACCESS_BADGE: Record<string, { label: string; className: string }> = {
    active: { label: 'Has Access', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    pending: { label: 'Invitation Pending', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    no_access: { label: 'No Access', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
    blocked: { label: 'Blocked', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

const resolveAccessBadge = (person: Pick<Person, 'access_status' | 'login_status'>) => {
    // Blocked is a hard override regardless of access_status.
    if (person.login_status === 'blocked') return ACCESS_BADGE.blocked;
    const key: AccessStatus = person.access_status ?? 'no_access';
    return ACCESS_BADGE[key] ?? ACCESS_BADGE.no_access;
};

const INVITATION_LABEL: Record<InvitationStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    expired: 'Expired',
};

const PeoplePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { orgId, tenantId } = usePeopleContext();
    const { recordActivity } = useActivity();
    const formatters = usePeopleFormatters();
    const shell = useShellBridge();
    const canAddEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:create') ?? true);
    const canImportEmployees = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:import') ?? true);
    const canExportEmployees = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:export') ?? true);
    const canEditEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:update') ?? true);
    const canDeleteEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:delete') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'people', quota_key: 'max_employees' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId });
    const quotaData = getQuota('max_employees');
    const { isSandboxMode, sandboxEntryLimit, limitItems, isLimited } = useSandboxLimit();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    // Debounced copy of `search` that actually drives the list query. The input
    // stays bound to raw `search` (instant typing); only the fetch waits for a
    // 300ms pause so we fire one request per typing burst instead of one per
    // keystroke. Same results — `search` and `debouncedSearch` converge once
    // typing stops.
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>('');
    const [joiningFromFilter, setJoiningFromFilter] = useState<string>('');
    const [joiningToFilter, setJoiningToFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [inviteResult, setInviteResult] = useState<{ link: string; email: string; emailSent: boolean } | null>(null);
    const [currencies, setCurrencies] = useState<string[]>(DEFAULT_CURRENCIES);
    // Org's configured base currency (from Core business_settings), used as the
    // default selection for new-person currency. Empty until settings load.
    const [baseCurrency, setBaseCurrency] = useState<string>('');
    // Tracks the person currently being invited from the list row so we can
    // disable just that button while the request is in flight.
    const [invitingId, setInvitingId] = useState<string | null>(null);
    // Row Actions (⋮) menu — which person's menu is open, the person queued
    // for edit, and any pending confirm-dialog action.
    const [openActionsId, setOpenActionsId] = useState<string | null>(null);
    const [editPerson, setEditPerson] = useState<Person | null>(null);
    const [confirmAction, setConfirmAction] = useState<
        | { type: 'delete'; person: Person }
        | { type: 'deactivate'; person: Person }
        | { type: 'archive'; person: Person }
        | { type: 'cancel-invite'; person: Person }
        | null
    >(null);
    const [actionBusy, setActionBusy] = useState(false);

    // Debounce the search term: only update `debouncedSearch` 300ms after the
    // last keystroke. Cleanup cancels the pending timer on each change so a
    // burst of keystrokes collapses into a single query.
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(handle);
    }, [search]);

    const loadPeople = useCallback(async () => {
        try {
            setLoading(true);
            const result = await peopleApi.getAll({
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                type: typeFilter || undefined,
                department_id: departmentFilter || undefined,
                employment_type: employmentTypeFilter || undefined,
                date_of_joining_from: joiningFromFilter || undefined,
                date_of_joining_to: joiningToFilter || undefined,
            });
            setPeople(result.data);
        } catch (error) {
            console.error('Failed to load people:', error);
            toast.error('Failed to load people');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, statusFilter, typeFilter, departmentFilter, employmentTypeFilter, joiningFromFilter, joiningToFilter]);

    useEffect(() => {
        loadPeople();
    }, [loadPeople]);

    // Open create modal when navigated from dashboard "Add Person" button
    useEffect(() => {
        if ((location.state as { openCreate?: boolean } | null)?.openCreate) {
            setShowCreateModal(true);
            window.history.replaceState({}, '', location.pathname);
        }
    }, [location.state, location.pathname]);

    // Derive supported currencies from org business_settings, which the shell
    // loads once and shares across all MFEs — no per-page Core API fetch.
    useEffect(() => {
        const settings = shell?.businessSettings as
            | { currency?: string; base_currency?: string; supported_currencies?: string[] }
            | null
            | undefined;
        if (!settings) return;
        const orgCurrency = settings.currency || settings.base_currency;
        if (orgCurrency) setBaseCurrency(orgCurrency);
        if (Array.isArray(settings.supported_currencies) && settings.supported_currencies.length > 0) {
            setCurrencies(settings.supported_currencies);
            return;
        }
        if (orgCurrency && !DEFAULT_CURRENCIES.includes(orgCurrency)) {
            setCurrencies([orgCurrency, ...DEFAULT_CURRENCIES]);
        }
    }, [shell?.businessSettings]);

    const handleCreate = async (data: CreatePersonPayload) => {
        try {
            const created = await peopleApi.create(data);
            setShowCreateModal(false);
            recordActivity({ eventType: 'people.person.created', eventCategory: 'identity', description: `Person ${data.full_name} was created`, resourceType: 'person', resourceId: created?.id }).catch(() => {});

            // When the admin chose "Invite as New User", mint the invite via Core (which also emails
            // it via SES when requested) and surface the copyable link so it can be shared manually
            // if email delivery is unreliable.
            const invite = data as CreatePersonPayload & { userLinkageMode?: string; inviteEmail?: string; inviteRole?: string; sendInviteEmail?: boolean };
            const inviteEmail = invite.inviteEmail || data.email;
            if (invite.userLinkageMode === 'invite' && inviteEmail && invite.inviteRole && created?.id) {
                try {
                    const res = await peopleApi.inviteUser(created.id, inviteEmail, invite.inviteRole, invite.sendInviteEmail !== false);
                    if (res.invite_status === 'existing_user') {
                        toast.success(`${data.full_name} added — ${inviteEmail} already has an account and can sign in.`);
                    } else if (res.invite_link) {
                        setInviteResult({ link: res.invite_link, email: inviteEmail, emailSent: !!res.email_sent });
                    } else {
                        toast.success(`${data.full_name} has been invited`);
                    }
                } catch {
                    toast.error(`${data.full_name} added, but sending the invite failed`);
                }
            } else {
                toast.success(`${data.full_name} has been added`);
            }
            loadPeople();
        } catch (error) {
            toast.error('Failed to create person');
        }
    };

    const handleCopyInvite = async () => {
        if (!inviteResult) return;
        try {
            await navigator.clipboard.writeText(inviteResult.link);
            toast.success('Invite link copied to clipboard');
        } catch {
            toast.error('Could not copy automatically — select the link and copy it manually');
        }
    };

    // Invite a person to a user account directly from the registry row. Used
    // primarily for `no_access` people. Resolves a default org role (the
    // backend requires one) and reuses the same invite-link surface as create.
    const handleInvite = async (person: Person) => {
        const email = person.email;
        if (!email) {
            toast.error(`${person.full_name} has no email — add one before inviting`);
            return;
        }
        try {
            setInvitingId(person.id);
            const roles = await peopleApi.getOrgRoles();
            const defaultRole = roles.data?.[0]?.id;
            if (!defaultRole) {
                toast.error('No org roles available to assign — set up roles first');
                return;
            }
            const res = await peopleApi.inviteUser(person.id, email, defaultRole, true);
            if (res.invite_status === 'existing_user') {
                toast.success(`${email} already has an account and can sign in.`);
            } else if (res.invite_link) {
                setInviteResult({ link: res.invite_link, email, emailSent: !!res.email_sent });
            } else {
                toast.success(`${person.full_name} has been invited`);
            }
            loadPeople();
        } catch {
            toast.error(`Failed to invite ${person.full_name}`);
        } finally {
            setInvitingId(null);
        }
    };

    // Resend a still-pending invitation — same underlying call as the initial
    // invite (idempotent server-side), just re-triggerable from the Actions menu.
    const handleResendInvite = async (person: Person) => {
        const email = person.email;
        if (!email) {
            toast.error(`${person.full_name} has no email on file`);
            return;
        }
        setActionBusy(true);
        try {
            const roles = await peopleApi.getOrgRoles();
            const defaultRole = roles.data?.[0]?.id;
            if (!defaultRole) {
                toast.error('No org roles available to assign — set up roles first');
                return;
            }
            const res = await peopleApi.inviteUser(person.id, email, defaultRole, true);
            if (res.invite_link) {
                setInviteResult({ link: res.invite_link, email, emailSent: !!res.email_sent });
            } else {
                toast.success(`Invitation resent to ${person.full_name}`);
            }
            recordActivity({ eventType: 'people.person.invitation_resent', eventCategory: 'identity', description: `Invitation resent to ${person.full_name}`, resourceType: 'person', resourceId: person.id }).catch(() => {});
            loadPeople();
        } catch {
            toast.error(`Failed to resend invitation to ${person.full_name}`);
        } finally {
            setActionBusy(false);
        }
    };

    const handleCancelInvite = async (person: Person) => {
        setActionBusy(true);
        try {
            await peopleApi.cancelInvite(person.id);
            toast.success(`Invitation to ${person.full_name} has been cancelled`);
            recordActivity({ eventType: 'people.person.invitation_cancelled', eventCategory: 'identity', description: `Invitation to ${person.full_name} was cancelled`, resourceType: 'person', resourceId: person.id }).catch(() => {});
            loadPeople();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to cancel invitation');
        } finally {
            setActionBusy(false);
            setConfirmAction(null);
        }
    };

    const handleEditSave = async (id: string, data: Partial<Person>) => {
        setActionBusy(true);
        try {
            await peopleApi.update(id, data);
            toast.success('Employee updated');
            recordActivity({ eventType: 'people.person.updated', eventCategory: 'identity', description: `Person ${data.full_name ?? ''} was updated`.trim(), resourceType: 'person', resourceId: id }).catch(() => {});
            setEditPerson(null);
            loadPeople();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update employee');
        } finally {
            setActionBusy(false);
        }
    };

    // Quick status toggles (Activate / Deactivate / Archive) — no confirmation
    // needed for re-activating, but deactivate/archive go through confirmAction.
    const handleSetStatus = async (person: Person, status: PersonStatus) => {
        setActionBusy(true);
        try {
            await peopleApi.update(person.id, { status });
            const verb = status === 'active' ? 'reactivated' : status === 'archived' ? 'archived' : 'deactivated';
            toast.success(`${person.full_name} has been ${verb}`);
            recordActivity({ eventType: `people.person.${status === 'active' ? 'activated' : status}`, eventCategory: 'identity', description: `${person.full_name} was ${verb}`, resourceType: 'person', resourceId: person.id }).catch(() => {});
            loadPeople();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to update ${person.full_name}`);
        } finally {
            setActionBusy(false);
            setConfirmAction(null);
        }
    };

    const handleDeleteConfirmed = async (person: Person) => {
        setActionBusy(true);
        try {
            const res = await peopleApi.delete(person.id);
            if (res.hard_deleted) toast.success(res.message);
            else toast.info(res.message);
            recordActivity({ eventType: res.hard_deleted ? 'people.person.deleted' : 'people.person.deactivated', eventCategory: 'identity', description: `${person.full_name}: ${res.message}`, resourceType: 'person', resourceId: person.id }).catch(() => {});
            loadPeople();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to delete ${person.full_name}`);
        } finally {
            setActionBusy(false);
            setConfirmAction(null);
        }
    };

    const handleExport = async (format: 'csv' | 'excel') => {
        try {
            const blob = await peopleApi.export(format, {
                status: statusFilter,
                type: typeFilter,
                department_id: departmentFilter,
                employment_type: employmentTypeFilter,
                date_of_joining_from: joiningFromFilter,
                date_of_joining_to: joiningToFilter,
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `people-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
            a.click();
            setShowExportMenu(false);
            toast.success(`Exported ${people.length} people as ${format.toUpperCase()}`);
        } catch (error) {
            toast.error('Failed to export people');
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="People Registry"
                subtitle="Manage people as costed, allocatable resources"
                actions={
                    <div className="flex items-center gap-2">
                        {/* Import Button */}
                        {canImportEmployees && (
                        <button
                            onClick={() => navigate('/people/import-export')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-50 text-sm font-medium rounded-lg transition-colors"
                        >
                            <Upload size={16} />
                            Import
                        </button>
                        )}

                        {/* Export Dropdown */}
                        {canExportEmployees && (
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-50 text-sm font-medium rounded-lg transition-colors"
                            >
                                <Download size={16} />
                                Export
                                <ChevronDown size={14} />
                            </button>
                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-50 hover:bg-slate-700 rounded-t-lg"
                                    >
                                        Export as CSV
                                    </button>
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-50 hover:bg-slate-700 rounded-b-lg"
                                    >
                                        Export as Excel
                                    </button>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Add Person Button */}
                        {canAddEmployee && (
                        <QuotaGate
                            quotaKey="max_employees"
                            moduleCode="people"
                            used={quotaData?.current_usage ?? 0}
                            limit={quotaData?.limit ?? 0}
                            isUnlimited={quotaData?.is_unlimited}
                            disableOnExceeded
                        >
                        <button
                            onClick={() => setShowCreateModal(true)}
                            disabled={isSandboxMode}
                            title={isSandboxMode ? 'Not available in Sandbox mode' : undefined}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <UserPlus size={16} />
                            Add Person
                        </button>
                        </QuotaGate>
                        )}
                    </div>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                    <option value="archived">Archived</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Types</option>
                    <option value="employee">Employee</option>
                    <option value="contractor">Contractor</option>
                </select>

                {/* Department Filter */}
                <DepartmentSelector
                    value={departmentFilter}
                    onChange={(id: string | null) => setDepartmentFilter(id || '')}
                    orgId={orgId}
                    tenantId={tenantId}
                    placeholder="All Departments"
                    className="w-48"
                    allowClear
                />

                {/* Employment Type Filter */}
                <select
                    value={employmentTypeFilter}
                    onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Employment Types</option>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                </select>

                {/* Date of Joining Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Joined:</label>
                    <input
                        type="date"
                        value={joiningFromFilter}
                        onChange={(e) => setJoiningFromFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="From"
                    />
                    <span className="text-slate-600">-</span>
                    <input
                        type="date"
                        value={joiningToFilter}
                        onChange={(e) => setJoiningToFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="To"
                    />
                </div>
            </div>

            {quotaData && (
                <QuotaBar
                    label="Employees"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                />
            )}

            {isSandboxMode && isLimited(people.length) && (
                <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-sm">
                    <span className="font-semibold">Sandbox:</span>
                    <span>Showing {sandboxEntryLimit} of {people.length} records. Switch to Production to view all.</span>
                </div>
            )}

            {/* People List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : people.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No people found"
                    description="Add people to start tracking resource allocation and utilization."
                    action={{ label: 'Add First Person', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {(isSandboxMode ? people.slice(0, sandboxEntryLimit) : people).map((person) => (
                        <div
                            key={person.id}
                            onClick={() => navigate(`/people/people/${person.id}`)}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-all"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                    {person.avatar_url ? (
                                        <img src={person.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <span className="text-sm font-medium text-teal-400">
                                            {person.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-medium text-slate-50 truncate">{person.full_name}</span>
                                        <StatusBadge status={person.type} />
                                        <StatusBadge status={person.status} />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        {person.job_title && (
                                            <span className="flex items-center gap-1">
                                                <Briefcase size={12} />
                                                {person.job_title}
                                            </span>
                                        )}
                                        {person.email && (
                                            <span className="flex items-center gap-1">
                                                <Mail size={12} />
                                                {person.email}
                                            </span>
                                        )}
                                        {(person.department_info?.name || person.department) && (
                                            <span className="text-slate-600">{person.department_info?.name || person.department}</span>
                                        )}
                                        {person.work_location && (
                                            <span className="flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                {(person.work_location as any).name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Cost Info */}
                                <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-medium text-slate-50">
                                        {formatters.formatCurrency(person.cost_rate)}/{person.cost_rate_unit}
                                    </div>
                                    {person.billing_rate && person.billing_rate > 0 && (
                                        <div className="text-xs text-slate-500">
                                            Bill: {formatters.formatCurrency(person.billing_rate)}/{person.cost_rate_unit}
                                        </div>
                                    )}
                                </div>

                                {/* System Access (access status / system role / invitation) */}
                                {(() => {
                                    const accessBadge = resolveAccessBadge(person);
                                    const invitation = person.invitation_status
                                        ? (INVITATION_LABEL[person.invitation_status] ?? '—')
                                        : '—';
                                    return (
                                        <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0 min-w-[140px]" aria-label="System access">
                                            {/* Access Status */}
                                            <span
                                                aria-label="Access status"
                                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${accessBadge.className}`}
                                            >
                                                {accessBadge.label}
                                            </span>
                                            {/* System Role (Core login role — distinct from skill/people_roles) */}
                                            <span className="text-xs text-slate-500" aria-label="System role">
                                                Role: {person.system_role || '—'}
                                            </span>
                                            {/* Invitation Status */}
                                            <span className="text-xs text-slate-600" aria-label="Invitation status">
                                                Invite: {invitation}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Invite action — primarily for people without access */}
                                {(() => {
                                    const isPending = person.access_status === 'pending' || person.invitation_status === 'pending';
                                    const hasAccess = person.access_status === 'active';
                                    // Hide entirely once the person already has access; otherwise
                                    // show Invite (no_access) or a disabled "Invited" (pending).
                                    if (hasAccess) return null;
                                    return (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); if (!isPending) handleInvite(person); }}
                                            disabled={isPending || invitingId === person.id}
                                            title={isPending ? 'Invitation already sent' : 'Invite to a user account'}
                                            className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-slate-50 text-xs font-medium rounded-lg transition-colors"
                                        >
                                            <UserPlus size={14} />
                                            {isPending ? 'Invited' : (invitingId === person.id ? 'Inviting…' : 'Invite')}
                                        </button>
                                    );
                                })()}

                                {/* Skills — capability tags (distinct from the System Role shown above) */}
                                <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                                    {person.people_roles?.slice(0, 2).map((skill) => (
                                        <span key={skill.id} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400">
                                            {skill.role_name}
                                        </span>
                                    ))}
                                    {person.people_roles && person.people_roles.length > 2 && (
                                        <span className="text-xs text-slate-600">+{person.people_roles.length - 2}</span>
                                    )}
                                </div>

                                {/* Actions (⋮) — Edit / Deactivate / Archive / Delete / Resend / Cancel */}
                                {(canEditEmployee || canDeleteEmployee) && (
                                    <div className="relative flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setOpenActionsId(openActionsId === person.id ? null : person.id); }}
                                            aria-label="Employee actions"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors"
                                        >
                                            <MoreHorizontal size={16} />
                                        </button>
                                        {openActionsId === person.id && (
                                            <>
                                                {/* Backdrop to close the menu on outside click */}
                                                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenActionsId(null); }} />
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20 py-1"
                                                >
                                                    {canEditEmployee && (
                                                        <button
                                                            onClick={() => { setEditPerson(person); setOpenActionsId(null); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-50 hover:bg-slate-700"
                                                        >
                                                            <Pencil size={14} /> Edit Employee
                                                        </button>
                                                    )}
                                                    {canEditEmployee && (person.invitation_status === 'pending' || person.access_status === 'pending') && (
                                                        <>
                                                            <button
                                                                onClick={() => { setOpenActionsId(null); handleResendInvite(person); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-50 hover:bg-slate-700"
                                                            >
                                                                <Send size={14} /> Resend Invitation
                                                            </button>
                                                            <button
                                                                onClick={() => { setConfirmAction({ type: 'cancel-invite', person }); setOpenActionsId(null); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-amber-400 hover:bg-slate-700"
                                                            >
                                                                <XCircle size={14} /> Cancel Invitation
                                                            </button>
                                                        </>
                                                    )}
                                                    {canEditEmployee && person.status !== 'active' && (
                                                        <button
                                                            onClick={() => { setOpenActionsId(null); handleSetStatus(person, 'active'); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-emerald-400 hover:bg-slate-700"
                                                        >
                                                            <UserCheck size={14} /> Activate
                                                        </button>
                                                    )}
                                                    {canEditEmployee && person.status === 'active' && (
                                                        <button
                                                            onClick={() => { setConfirmAction({ type: 'deactivate', person }); setOpenActionsId(null); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-amber-400 hover:bg-slate-700"
                                                        >
                                                            <UserMinus size={14} /> Deactivate
                                                        </button>
                                                    )}
                                                    {canEditEmployee && person.status !== 'archived' && (
                                                        <button
                                                            onClick={() => { setConfirmAction({ type: 'archive', person }); setOpenActionsId(null); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                                                        >
                                                            <Archive size={14} /> Archive
                                                        </button>
                                                    )}
                                                    {canDeleteEmployee && (
                                                        <button
                                                            onClick={() => { setConfirmAction({ type: 'delete', person }); setOpenActionsId(null); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-rose-400 hover:bg-slate-700 border-t border-slate-700 mt-1 pt-2"
                                                        >
                                                            <Trash2 size={14} /> Delete Employee
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <CreatePersonModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
                currencies={currencies}
                defaultCurrency={baseCurrency}
            />

            {/* Invite link — shown after inviting so the admin can copy/share it if email is unreliable */}
            {inviteResult && (
                <Modal isOpen={true} onClose={() => setInviteResult(null)} title="Invitation ready" size="md">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300">
                            {inviteResult.emailSent
                                ? <>We've emailed the invitation to <span className="text-slate-100 font-medium">{inviteResult.email}</span>. If it doesn't arrive, copy and share this link directly:</>
                                : <>Share this invite link with <span className="text-slate-100 font-medium">{inviteResult.email}</span> so they can set a password and sign in:</>}
                        </p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={inviteResult.link}
                                onFocus={(e) => e.currentTarget.select()}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                            />
                            <button
                                type="button"
                                onClick={handleCopyInvite}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                            >
                                Copy link
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">This link lets the invitee set a password. It expires according to your security settings.</p>
                        <div className="flex justify-end pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setInviteResult(null)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            <EditPersonModal
                person={editPerson}
                isOpen={!!editPerson}
                onClose={() => setEditPerson(null)}
                onSave={handleEditSave}
                currencies={currencies}
                busy={actionBusy}
            />

            {/* Deactivate / Archive / Delete / Cancel-invite confirmation */}
            {confirmAction && (
                <ConfirmDialog
                    title={
                        confirmAction.type === 'delete' ? 'Delete Employee'
                            : confirmAction.type === 'archive' ? 'Archive Employee'
                                : confirmAction.type === 'cancel-invite' ? 'Cancel Invitation'
                                    : 'Deactivate Employee'
                    }
                    message={
                        confirmAction.type === 'delete'
                            ? `Are you sure you want to delete ${confirmAction.person.full_name}? If they have linked business data or an active account, they will be deactivated instead of permanently removed.`
                            : confirmAction.type === 'archive'
                                ? `Archive ${confirmAction.person.full_name}? They will be hidden from active-resource views but their records are preserved and can be reactivated later.`
                                : confirmAction.type === 'cancel-invite'
                                    ? `Cancel the pending invitation for ${confirmAction.person.full_name}? They will not be able to use the invite link afterward.`
                                    : `Deactivate ${confirmAction.person.full_name}? Their records are preserved and they can be reactivated later.`
                    }
                    confirmLabel={confirmAction.type === 'delete' ? 'Delete Employee' : confirmAction.type === 'archive' ? 'Archive' : confirmAction.type === 'cancel-invite' ? 'Cancel Invitation' : 'Deactivate'}
                    danger={confirmAction.type === 'delete' || confirmAction.type === 'cancel-invite'}
                    busy={actionBusy}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={() => {
                        if (confirmAction.type === 'delete') handleDeleteConfirmed(confirmAction.person);
                        else if (confirmAction.type === 'archive') handleSetStatus(confirmAction.person, 'archived');
                        else if (confirmAction.type === 'deactivate') handleSetStatus(confirmAction.person, 'inactive');
                        else if (confirmAction.type === 'cancel-invite') handleCancelInvite(confirmAction.person);
                    }}
                />
            )}

        </div>
    );
};

// =============================================================================
// Create Person Modal
// =============================================================================

interface CreatePersonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreatePersonPayload) => void;
    currencies?: string[];
    // Org's configured base currency; pre-selected as the default. Falls back to
    // 'USD' only when no org currency is configured.
    defaultCurrency?: string;
}

const CreatePersonModal: React.FC<CreatePersonModalProps> = ({ isOpen, onClose, onCreate, currencies = DEFAULT_CURRENCIES, defaultCurrency }) => {
    const { orgId, tenantId } = usePeopleContext();
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
    const [orgRoles, setOrgRoles] = useState<Array<{ id: string; name: string }>>([]);
    // Holds the resolved org currency. Initialized from the shell prop when available;
    // falls back to a direct Core BE fetch to avoid the shell's async race condition.
    const [resolvedCurrency, setResolvedCurrency] = useState(defaultCurrency || 'USD');

    useEffect(() => {
        if (!isOpen) return;
        workLocationsApi.getAll().then(r => setWorkLocations(r.data)).catch(() => {});
        peopleApi.getOrgRoles().then(r => setOrgRoles(r.data ?? [])).catch(() => {});
    }, [isOpen]);

    // When the shell hasn't pre-loaded businessSettings yet (defaultCurrency is empty),
    // fetch org currency directly from Core BE so the field is never stuck on USD.
    useEffect(() => {
        if (!isOpen || !orgId || defaultCurrency) return;
        fetchOrgBaseCurrency(orgId).then(currency => {
            if (currency) setResolvedCurrency(currency);
        }).catch(() => {});
    }, [isOpen, orgId, defaultCurrency]);

    // Keep in sync if the shell prop arrives after the modal is already mounted.
    useEffect(() => {
        if (defaultCurrency) setResolvedCurrency(defaultCurrency);
    }, [defaultCurrency]);

    const [formData, setFormData] = useState<CreatePersonPayload & {
        userLinkageMode?: 'none' | 'link' | 'invite';
        existingUserId?: string;
        inviteEmail?: string;
        inviteRole?: string;
        sendInviteEmail?: boolean;
    }>({
        full_name: '',
        email: '',
        phone: '',
        type: 'employee',
        department_id: '',
        job_title: '',
        cost_rate: 0,
        cost_rate_unit: 'hour',
        currency: resolvedCurrency,
        billing_rate: 0,
        available_hours_per_day: 8,
        available_days_per_week: 5,
        start_date: new Date().toISOString().split('T')[0],
        userLinkageMode: 'invite',
        sendInviteEmail: true,
    });

    // Sync form currency whenever the resolved currency updates or the modal opens.
    useEffect(() => {
        if (isOpen) setFormData(prev => ({ ...prev, currency: resolvedCurrency }));
    }, [isOpen, resolvedCurrency]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name || !formData.type) return;
        // Omit an unselected department so the backend @IsUUID validation is not
        // triggered by an empty string.
        const payload = { ...formData };
        payload.department_id = payload.department_id || undefined;
        onCreate(payload);
        // Reset form
        setFormData({
            full_name: '', email: '', phone: '', type: 'employee',
            department_id: '', job_title: '', cost_rate: 0, cost_rate_unit: 'hour',
            currency: resolvedCurrency, billing_rate: 0, available_hours_per_day: 8,
            available_days_per_week: 5, start_date: new Date().toISOString().split('T')[0],
            userLinkageMode: 'invite', sendInviteEmail: true,
        });
    };

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Person" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                            <input
                                type="text" required value={formData.full_name}
                                onChange={(e) => updateField('full_name', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Email</label>
                            <input
                                type="email" value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                placeholder="john@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Phone</label>
                            <input
                                type="text" value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                placeholder="+1-555-0100"
                            />
                        </div>
                    </div>
                </div>

                {/* Classification */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Classification</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type *</label>
                            <select
                                value={formData.type}
                                onChange={(e) => updateField('type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="employee">Employee</option>
                                <option value="contractor">Contractor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Department</label>
                            <DepartmentSelector
                                value={formData.department_id || ''}
                                onChange={(id) => updateField('department_id', id || undefined)}
                                placeholder="Select department..."
                                allowClear
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Job Title</label>
                            <input
                                type="text" value={formData.job_title || ''}
                                onChange={(e) => updateField('job_title', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                placeholder="Senior Developer"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Work Location</label>
                            <select
                                value={(formData as any).work_location_id || ''}
                                onChange={(e) => updateField('work_location_id', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">None</option>
                                {workLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Cost */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cost & Billing</h4>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Cost Rate *</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.cost_rate}
                                onChange={(e) => updateField('cost_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Rate Unit</label>
                            <select
                                value={formData.cost_rate_unit}
                                onChange={(e) => updateField('cost_rate_unit', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="hour">Per Hour</option>
                                <option value="day">Per Day</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Billing Rate</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.billing_rate || 0}
                                onChange={(e) => updateField('billing_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => updateField('currency', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                {currencies.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Availability */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Availability</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Hours/Day</label>
                            <input
                                type="number" min="1" max="24" value={formData.available_hours_per_day}
                                onChange={(e) => updateField('available_hours_per_day', parseFloat(e.target.value) || 8)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Days/Week</label>
                            <input
                                type="number" min="1" max="7" value={formData.available_days_per_week}
                                onChange={(e) => updateField('available_days_per_week', parseInt(e.target.value) || 5)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                            <input
                                type="date" value={formData.start_date || ''}
                                onChange={(e) => updateField('start_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* User Linkage */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        User Account Linkage
                    </h4>
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:border-teal-500">
                            <input
                                type="radio"
                                name="userLinkage"
                                value="none"
                                checked={formData.userLinkageMode === 'none'}
                                onChange={() => updateField('userLinkageMode', 'none')}
                                className="text-teal-500 focus:ring-teal-500"
                            />
                            <div>
                                <div className="text-sm font-medium text-slate-50">Employee Only (No System Access)</div>
                                <div className="text-xs text-slate-500">Person will not have access to Neonbee</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:border-teal-500">
                            <input
                                type="radio"
                                name="userLinkage"
                                value="link"
                                checked={formData.userLinkageMode === 'link'}
                                onChange={() => updateField('userLinkageMode', 'link')}
                                className="text-teal-500 focus:ring-teal-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-50">Link to Existing User</div>
                                <div className="text-xs text-slate-500 mb-2">Select an existing user account to link</div>
                                {formData.userLinkageMode === 'link' && (
                                    <UserSelector
                                        value={formData.existingUserId}
                                        onChange={(userId: string | null) => updateField('existingUserId', userId)}
                                        orgId={orgId}
                                        tenantId={tenantId}
                                        placeholder="Select user..."
                                    />
                                )}
                            </div>
                        </label>

                        <label className="flex items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:border-teal-500">
                            <input
                                type="radio"
                                name="userLinkage"
                                value="invite"
                                checked={formData.userLinkageMode === 'invite'}
                                onChange={() => updateField('userLinkageMode', 'invite')}
                                className="text-teal-500 focus:ring-teal-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-50">Invite as New User (Recommended)</div>
                                <div className="text-xs text-slate-500 mb-2">Send invitation email to create user account</div>
                                {formData.userLinkageMode === 'invite' && (
                                    <div className="space-y-2">
                                        <input
                                            type="email"
                                            value={formData.inviteEmail || formData.email}
                                            onChange={(e) => updateField('inviteEmail', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                            placeholder="Email for invitation"
                                            required={formData.userLinkageMode === 'invite'}
                                        />
                                        <select
                                            value={formData.inviteRole || ''}
                                            onChange={(e) => updateField('inviteRole', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                            required={formData.userLinkageMode === 'invite'}
                                        >
                                            <option value="">Select role...</option>
                                            {orgRoles.map(role => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                        </select>
                                        <label className="flex items-center gap-2 text-xs text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={formData.sendInviteEmail !== false}
                                                onChange={(e) => updateField('sendInviteEmail', e.target.checked)}
                                                className="text-teal-500 focus:ring-teal-500"
                                            />
                                            Send invitation email immediately
                                        </label>
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button" onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Add Person
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// =============================================================================
// Confirm Dialog — mirrors the delete-confirmation pattern used in CRM
// (so360-crm-fe LeadsPage) for visual consistency across the platform.
// =============================================================================

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, danger, busy, onCancel, onConfirm }) => (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700/50 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">{title}</h2>
            <p className="text-slate-400 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    disabled={busy}
                    className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    disabled={busy}
                    className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70 ${danger ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800' : 'bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800'}`}
                >
                    {busy && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// =============================================================================
// Edit Person Modal
// =============================================================================

interface EditPersonModalProps {
    person: Person | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, data: Partial<Person>) => void;
    currencies?: string[];
    busy?: boolean;
}

const EditPersonModal: React.FC<EditPersonModalProps> = ({ person, isOpen, onClose, onSave, currencies = DEFAULT_CURRENCIES, busy }) => {
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
    const [formData, setFormData] = useState<Partial<Person>>({});

    useEffect(() => {
        if (!isOpen) return;
        workLocationsApi.getAll().then(r => setWorkLocations(r.data)).catch(() => {});
    }, [isOpen]);

    // Reload the form whenever a different person is opened for edit.
    useEffect(() => {
        if (!person) return;
        setFormData({
            full_name: person.full_name,
            email: person.email,
            phone: person.phone,
            job_title: person.job_title,
            department_id: person.department_id,
            type: person.type,
            employee_id: person.employee_id,
            employment_type: person.employment_type,
            cost_rate: person.cost_rate,
            cost_rate_unit: person.cost_rate_unit,
            currency: person.currency,
            billing_rate: person.billing_rate,
            available_hours_per_day: person.available_hours_per_day,
            start_date: person.start_date,
            work_location_id: person.work_location_id,
        });
    }, [person]);

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!person || !formData.full_name) return;
        onSave(person.id, formData);
    };

    if (!person) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${person.full_name}`} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                            <input
                                type="text" required value={formData.full_name || ''}
                                onChange={(e) => updateField('full_name', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Email</label>
                            <input
                                type="email" value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Phone</label>
                            <input
                                type="text" value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Employee ID</label>
                            <input
                                type="text" value={formData.employee_id || ''}
                                onChange={(e) => updateField('employee_id', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Classification</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select
                                value={formData.type || 'employee'}
                                onChange={(e) => updateField('type', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="employee">Employee</option>
                                <option value="contractor">Contractor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Employment Type</label>
                            <select
                                value={formData.employment_type || ''}
                                onChange={(e) => updateField('employment_type', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Not set</option>
                                <option value="full_time">Full Time</option>
                                <option value="part_time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="intern">Intern</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Department</label>
                            <DepartmentSelector
                                value={formData.department_id || ''}
                                onChange={(id) => updateField('department_id', id || undefined)}
                                placeholder="Select department..."
                                allowClear
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Job Title</label>
                            <input
                                type="text" value={formData.job_title || ''}
                                onChange={(e) => updateField('job_title', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Work Location</label>
                            <select
                                value={formData.work_location_id || ''}
                                onChange={(e) => updateField('work_location_id', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">None</option>
                                {workLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Joining Date</label>
                            <input
                                type="date" value={formData.start_date ? formData.start_date.slice(0, 10) : ''}
                                onChange={(e) => updateField('start_date', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cost & Billing</h4>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Cost Rate</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.cost_rate ?? 0}
                                onChange={(e) => updateField('cost_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Rate Unit</label>
                            <select
                                value={formData.cost_rate_unit || 'hour'}
                                onChange={(e) => updateField('cost_rate_unit', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="hour">Per Hour</option>
                                <option value="day">Per Day</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Billing Rate</label>
                            <input
                                type="number" min="0" step="0.01" value={formData.billing_rate ?? 0}
                                onChange={(e) => updateField('billing_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Currency</label>
                            <select
                                value={formData.currency || currencies[0]}
                                onChange={(e) => updateField('currency', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                {currencies.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Hours/Day</label>
                            <input
                                type="number" min="1" max="24" value={formData.available_hours_per_day ?? 8}
                                onChange={(e) => updateField('available_hours_per_day', parseFloat(e.target.value) || 8)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    </div>
                </div>

                <p className="text-xs text-slate-500">
                    Role &amp; System Permissions are managed from the employee's detail page.
                </p>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button" onClick={onClose} disabled={busy}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit" disabled={busy}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-70 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        {busy && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PeoplePage;
