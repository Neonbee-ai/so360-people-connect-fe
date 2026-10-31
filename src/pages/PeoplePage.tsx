import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, UserPlus, Briefcase, Mail, Upload, Download, MoreHorizontal, Pencil, UserMinus, UserCheck, Archive, Trash2, Send, XCircle } from 'lucide-react';
import { peopleApi } from '../services/peopleService';
import type { Person, CreatePersonPayload, PersonStatus } from '../types/people';
import { departmentsApi, type Department } from '../services/departmentsService';
import { usePeopleContext } from '../hooks/useShellContext';
import { useCanViewCompensation } from '../hooks/useCanViewCompensation';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import {
    QuotaBar, QuotaGate, toast, ListPageTemplate, DataTable, SearchInput, Button, IconButton,
    Menu, ConfirmDialog, Modal, TextField, Badge, StatusBadge, Avatar, EmptyState, Banner, Cluster, Stack,
} from '@so360/design-system';
import { mastersApi, MasterRow } from '../services/mastersService';
import { personCustomFieldsApi } from '../services/customFieldsService';
import { usePeopleFormatters } from '../utils/formatters';
import { leaveConfigApi } from '../services/leaveConfigService';
import { type PendingLeaveOverride } from '../components/leave/PersonLeaveConfigSection';
import { DEFAULT_CURRENCIES, resolveAccessBadge, INVITATION_LABEL, resolveInviteRoleId } from './people/shared';
import { CreatePersonModal } from './people/CreatePersonDrawer';
import { EditPersonModal } from './people/EditPersonDrawer';

// Re-exported so specs (and any caller) keep importing it from the page module.
export { resolveInviteRoleId } from './people/shared';

type ConfirmAction =
    | { type: 'delete'; person: Person }
    | { type: 'deactivate'; person: Person }
    | { type: 'archive'; person: Person }
    | { type: 'cancel-invite'; person: Person };

const ACCESS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
    'Has Access': 'success',
    'Invitation Pending': 'warning',
    'No Access': 'neutral',
    Blocked: 'danger',
};

const CONFIRM_COPY = (a: ConfirmAction) => {
    const name = a.person.full_name;
    switch (a.type) {
        case 'delete':
            return {
                title: 'Delete Employee', confirmLabel: 'Delete Employee',
                message: `Permanently delete ${name}? This cannot be undone.`,
                detail: 'Their employee record and platform access are removed. If they have linked records (timesheets, leave, allocations, reviews, goals, feedback, attendance), history is protected: they are deactivated instead and the blocking records are listed.',
            };
        case 'archive':
            return {
                title: 'Archive Employee', confirmLabel: 'Archive',
                message: `Archive ${name}? They will be removed from active use and lose platform access.`,
                detail: 'All historical records are preserved and they can be reactivated later.',
            };
        case 'cancel-invite':
            return {
                title: 'Cancel Invitation', confirmLabel: 'Cancel Invitation',
                message: `Cancel the pending invitation for ${name}? They will not be able to use the invite link afterward.`,
                detail: undefined as string | undefined,
            };
        default:
            return {
                title: 'Deactivate Employee', confirmLabel: 'Deactivate',
                message: `Deactivate ${name}? They will immediately lose access to the platform.`,
                detail: 'Their records are preserved; access is restored if you reactivate them.',
            };
    }
};

const PeoplePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { orgId } = usePeopleContext();
    // Compensation privacy tier — rate columns hidden without compensation.read.
    const canViewCompensation = useCanViewCompensation();
    const { recordActivity } = useActivity();
    const formatters = usePeopleFormatters();
    const shell = useShellBridge();
    const canAddEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:create') ?? true);
    const canImportEmployees = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:import') ?? true);
    const canExportEmployees = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:export') ?? true);
    const canEditEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:update') ?? true);
    const canDeleteEmployee = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:employees:delete') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'people', quota_key: 'max_employees' }], []);
    const { getQuota, refresh: refreshQuota } = useQuota({ checks: quotaChecks, orgId });
    const quotaData = getQuota('max_employees');
    const { isSandboxMode, sandboxEntryLimit, limitItems, isLimited } = useSandboxLimit();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
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
    // Options come from the org's Employment Types master (Settings →
    // Employment Types), not a fixed list — admins can add their own codes
    // there (e.g. 'consultant', 'freelancer') and this filter must offer them.
    const [employmentTypeOptions, setEmploymentTypeOptions] = useState<MasterRow[]>([]);
    const [joiningFromFilter, setJoiningFromFilter] = useState<string>('');
    const [joiningToFilter, setJoiningToFilter] = useState<string>('');
    const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
    useEffect(() => {
        let cancelled = false;
        departmentsApi.getTree()
            .then((res) => {
                const tree: Department[] = Array.isArray(res) ? res : (res as any)?.data || [];
                const out: { value: string; label: string }[] = [];
                const walk = (nodes: Department[]) => nodes.forEach((n) => { out.push({ value: n.id, label: n.name }); if (n.children?.length) walk(n.children); });
                walk(tree);
                if (!cancelled) setDepartmentOptions(out);
            })
            .catch(() => { if (!cancelled) setDepartmentOptions([]); });
        return () => { cancelled = true; };
    }, []);
    // From > To is invalid input, not "zero matches" — surfaced inline instead
    // of silently querying and showing a misleading "No people found".
    const joinedRangeInvalid = !!(joiningFromFilter && joiningToFilter && joiningFromFilter > joiningToFilter);
    const [showCreateModal, setShowCreateModal] = useState(false);
    // `emailRequested` distinguishes "admin opted out of the email" from "we tried to
    // email it and it didn't go out" — the modal must not claim delivery either way.
    const [inviteResult, setInviteResult] = useState<{ link: string; email: string; emailSent: boolean; emailRequested: boolean } | null>(null);
    const [currencies, setCurrencies] = useState<string[]>(DEFAULT_CURRENCIES);
    // Org's configured base currency (from Core business_settings), used as the
    // default selection for new-person currency. Empty until settings load.
    const [baseCurrency, setBaseCurrency] = useState<string>('');
    // Tracks the person currently being invited from the list row so we can
    // disable just that button while the request is in flight.
    const [invitingId, setInvitingId] = useState<string | null>(null);
    // Row Actions (⋮) menu — which person's menu is open, the person queued
    // for edit, and any pending confirm-dialog action.
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

    // Any non-default filter value — drives the "Clear Filters" affordance.
    const hasActiveFilters = !!(
        search || statusFilter || typeFilter || departmentFilter ||
        employmentTypeFilter || joiningFromFilter || joiningToFilter
    );

    // Reset every control to its default. `loadPeople` re-runs off these state
    // values, so the full list reloads without any extra user action.
    const handleClearFilters = () => {
        setSearch('');
        setStatusFilter('');
        setTypeFilter('');
        setDepartmentFilter('');
        setEmploymentTypeFilter('');
        setJoiningFromFilter('');
        setJoiningToFilter('');
    };

    const loadPeople = useCallback(async () => {
        if (joinedRangeInvalid) {
            // Invalid filter input, not a real empty result — don't query and
            // don't clear the previously loaded list out from under the user.
            setLoading(false);
            return;
        }
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
    }, [debouncedSearch, statusFilter, typeFilter, departmentFilter, employmentTypeFilter, joiningFromFilter, joiningToFilter, joinedRangeInvalid]);

    useEffect(() => {
        loadPeople();
    }, [loadPeople]);

    useEffect(() => {
        mastersApi.getAll('employment_type')
            .then(r => setEmploymentTypeOptions(r.data ?? []))
            .catch(() => setEmploymentTypeOptions([]));
    }, []);

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
            const customFieldValues = (data as any).customFieldValues as Record<string, unknown> | undefined;
            const leaveOverrides = (data as any).leaveOverrides as PendingLeaveOverride[] | undefined;
            const createPayload = { ...data } as any;
            delete createPayload.customFieldValues;
            delete createPayload.leaveOverrides;
            const created = await peopleApi.create(createPayload);
            setShowCreateModal(false);
            recordActivity({ eventType: 'people.person.created', eventCategory: 'identity', description: `Person ${data.full_name} was created`, resourceType: 'person', resourceId: created?.id }).catch(() => {});

            if (created?.id && customFieldValues && Object.keys(customFieldValues).length > 0) {
                const entries = Object.entries(customFieldValues).map(([field_def_id, value]) => ({ field_def_id, value }));
                personCustomFieldsApi.setForPerson(created.id, entries).catch(() => {
                    toast.error('Person created, but saving custom field values failed');
                });
            }

            // Leave overrides are applied AFTER creation because they are keyed
            // by person_id. The person is already saved at this point, so a
            // failure here must not read as "creation failed" — it is reported
            // as the partial it is, with the fix (Employee → Leave) named.
            if (created?.id && leaveOverrides && leaveOverrides.length > 0) {
                try {
                    // Sequential, not Promise.all: each call returns the whole
                    // recomputed config, and concurrent writes to the same
                    // person's override set race each other.
                    for (const o of leaveOverrides) {
                        await leaveConfigApi.setPersonOverride(created.id, o.leave_type_id, o.mode);
                    }
                } catch {
                    toast.error(
                        `${data.full_name} was created, but their leave configuration could not be saved. Set it from the employee's Leave tab.`,
                    );
                }
            }

            // When the admin chose "Invite as New User", mint the invite via Core (which also emails
            // it via SES when requested) and surface the copyable link so it can be shared manually
            // if email delivery is unreliable.
            const invite = data as CreatePersonPayload & { userLinkageMode?: string; inviteEmail?: string; inviteRole?: string; sendInviteEmail?: boolean };
            // Single source of truth: the person's Identity email. Anything else would
            // invite one address while the person record carries another, which leaves
            // the invitee unlinked (Core resolves the person by email).
            const inviteEmail = data.email;
            if (invite.userLinkageMode === 'invite' && inviteEmail && invite.inviteRole && created?.id) {
                try {
                    const res = await peopleApi.inviteUser(created.id, inviteEmail, invite.inviteRole, invite.sendInviteEmail !== false);
                    if (res.invite_status === 'existing_user') {
                        toast.success(`${data.full_name} added — ${inviteEmail} already has an account and can sign in.`);
                    } else if (res.invite_link) {
                        setInviteResult({ link: res.invite_link, email: inviteEmail, emailSent: !!res.email_sent, emailRequested: invite.sendInviteEmail !== false });
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
            refreshQuota().catch(() => {});
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
            const defaultRole = resolveInviteRoleId(person, roles.data);
            if (!defaultRole) {
                toast.error('No suitable org role found — create an "Employee" role first');
                return;
            }
            const res = await peopleApi.inviteUser(person.id, email, defaultRole, true);
            if (res.invite_status === 'existing_user') {
                toast.success(`${email} already has an account and can sign in.`);
            } else if (res.invite_link) {
                setInviteResult({ link: res.invite_link, email, emailSent: !!res.email_sent, emailRequested: true });
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
            const defaultRole = resolveInviteRoleId(person, roles.data);
            if (!defaultRole) {
                toast.error('No suitable org role found — create an "Employee" role first');
                return;
            }
            const res = await peopleApi.inviteUser(person.id, email, defaultRole, true);
            if (res.invite_link) {
                setInviteResult({ link: res.invite_link, email, emailSent: !!res.email_sent, emailRequested: true });
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
            const customFieldValues = (data as any).customFieldValues as Record<string, unknown> | undefined;
            const updatePayload = { ...data } as any;
            delete updatePayload.customFieldValues;
            await peopleApi.update(id, updatePayload);

            if (customFieldValues && Object.keys(customFieldValues).length > 0) {
                const entries = Object.entries(customFieldValues).map(([field_def_id, value]) => ({ field_def_id, value }));
                await personCustomFieldsApi.setForPerson(id, entries).catch(() => {
                    toast.error('Employee updated, but saving custom field values failed');
                });
            }

            toast.success('Employee updated');
            recordActivity({ eventType: 'people.person.updated', eventCategory: 'identity', description: `Person ${data.full_name ?? ''} was updated`.trim(), resourceType: 'person', resourceId: id }).catch(() => {});
            setEditPerson(null);
            loadPeople();
            refreshQuota().catch(() => {});
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
            refreshQuota().catch(() => {});
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
            refreshQuota().catch(() => {});
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to delete ${person.full_name}`);
        } finally {
            setActionBusy(false);
            setConfirmAction(null);
        }
    };

    const visiblePeople = isSandboxMode ? people.slice(0, sandboxEntryLimit) : people;

    const rowMenuItems = (person: Person) => {
        const isPendingInvite = person.invitation_status === 'pending' || person.access_status === 'pending';
        const items: { label: string; onSelect: () => void; icon: React.ReactNode; danger?: boolean }[] = [];
        if (canEditEmployee) items.push({ label: 'Edit Employee', icon: <Pencil size={14} />, onSelect: () => setEditPerson(person) });
        if (canEditEmployee && isPendingInvite) {
            items.push({ label: 'Resend Invitation', icon: <Send size={14} />, onSelect: () => { handleResendInvite(person); } });
            items.push({ label: 'Cancel Invitation', icon: <XCircle size={14} />, onSelect: () => setConfirmAction({ type: 'cancel-invite', person }) });
        }
        if (canEditEmployee && person.status !== 'active') items.push({ label: 'Activate', icon: <UserCheck size={14} />, onSelect: () => { handleSetStatus(person, 'active'); } });
        if (canEditEmployee && person.status === 'active') items.push({ label: 'Deactivate', icon: <UserMinus size={14} />, onSelect: () => setConfirmAction({ type: 'deactivate', person }) });
        if (canEditEmployee && person.status !== 'archived') items.push({ label: 'Archive', icon: <Archive size={14} />, onSelect: () => setConfirmAction({ type: 'archive', person }) });
        if (canDeleteEmployee) items.push({ label: 'Delete Employee', icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirmAction({ type: 'delete', person }) });
        return items;
    };

    const columns = [
        {
            key: 'person',
            header: 'Person',
            render: (person: Person) => (
                <Cluster gap="default" className="min-w-0 max-w-full">
                    <Avatar name={person.full_name} src={person.avatar_url || undefined} />
                    <Stack gap="none" className="min-w-0 max-w-full">
                        <span className="text-nb-body font-medium text-fg truncate">{person.full_name}</span>
                        <Cluster gap="default" className="min-w-0 max-w-full">
                            {person.job_title && (
                                <span className="inline-flex min-w-0 items-center gap-nb-1 text-nb-caption text-fg-muted"><Briefcase size={12} />{person.job_title}</span>
                            )}
                            {person.email && (
                                <span className="inline-flex min-w-0 max-w-full items-center gap-nb-1 break-all text-nb-caption text-fg-muted"><Mail size={12} className="shrink-0" />{person.email}</span>
                            )}
                            {(person.department_info?.name || person.department) && (
                                <span className="text-nb-caption text-fg-muted">{person.department_info?.name || person.department}</span>
                            )}
                            {person.work_location && (
                                <span className="text-nb-caption text-fg-muted">{(person.work_location as any).name}</span>
                            )}
                        </Cluster>
                    </Stack>
                </Cluster>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (person: Person) => (
                <Cluster gap="tight">
                    <StatusBadge status={person.type} />
                    <StatusBadge status={person.status} />
                </Cluster>
            ),
        },
        ...(canViewCompensation ? [{
            key: 'cost',
            header: 'Cost',
            align: 'right' as const,
            render: (person: Person) => (
                <Stack gap="none">
                    <span className="text-nb-body font-medium text-fg">{formatters.formatCurrency(person.cost_rate)}/{person.cost_rate_unit}</span>
                    {person.billing_rate && person.billing_rate > 0 && (
                        <span className="text-nb-caption text-fg-muted">Bill: {formatters.formatCurrency(person.billing_rate)}/{person.cost_rate_unit}</span>
                    )}
                </Stack>
            ),
        }] : []),
        {
            key: 'access',
            header: 'System access',
            hideBelow: 'medium' as const,
            render: (person: Person) => {
                const accessBadge = resolveAccessBadge(person);
                const invitation = person.invitation_status ? (INVITATION_LABEL[person.invitation_status] ?? '—') : '—';
                return (
                    <div role="group" aria-label="System access"><Stack gap="none">
                        <Badge tone={ACCESS_TONE[accessBadge.label] ?? 'neutral'} aria-label="Access status">{accessBadge.label}</Badge>
                        <span className="text-nb-caption text-fg-muted truncate" aria-label="System role" title={person.system_role || undefined}>Role: {person.system_role || '—'}</span>
                        <span className="text-nb-caption text-fg-muted" aria-label="Invitation status">Invite: {invitation}</span>
                    </Stack></div>
                );
            },
        },
        {
            key: 'skills',
            header: 'Skills',
            hideBelow: 'expanded' as const,
            render: (person: Person) => (
                <Cluster gap="tight">
                    {person.people_roles?.slice(0, 2).map((skill) => (
                        <Badge key={skill.id} tone="neutral">{skill.role_name}</Badge>
                    ))}
                    {person.people_roles && person.people_roles.length > 2 && (
                        <span className="text-nb-caption text-fg-muted">+{person.people_roles.length - 2}</span>
                    )}
                </Cluster>
            ),
        },
        {
            key: 'invite',
            header: 'Invite',
            interactive: true,
            hideBelow: 'medium' as const,
            render: (person: Person) => {
                const isPending = person.access_status === 'pending' || person.invitation_status === 'pending';
                // Hide the control once the person already has access; otherwise
                // show Invite (no_access) or a disabled "Invited" (pending).
                if (person.access_status === 'active') return null;
                return (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (!isPending) handleInvite(person); }}
                        disabled={isPending || invitingId === person.id}
                        title={isPending ? 'Invitation already sent' : 'Invite to a user account'}
                    >
                        <UserPlus size={14} />
                        {isPending ? 'Invited' : (invitingId === person.id ? 'Inviting…' : 'Invite')}
                    </Button>
                );
            },
        },
        ...((canEditEmployee || canDeleteEmployee) ? [{
            key: 'actions',
            header: '',
            interactive: true,
            align: 'right' as const,
            render: (person: Person) => (
                <Menu
                    trigger={<IconButton label="Employee actions" icon={<MoreHorizontal size={16} />} variant="ghost" />}
                    items={rowMenuItems(person)}
                />
            ),
        }] : []),
    ];

    // Direct CSV download of the current (filtered) registry, like HubSpot/BambooHR list exports.
    const handleExportCsv = async () => {
        setIsExporting(true);
        try {
            const blob = await peopleApi.export('csv', {
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                type: typeFilter || undefined,
                department_id: departmentFilter || undefined,
                employment_type: employmentTypeFilter || undefined,
                date_of_joining_from: joiningFromFilter || undefined,
                date_of_joining_to: joiningToFilter || undefined,
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'people-export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Exported successfully as CSV');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to export people');
        } finally {
            setIsExporting(false);
        }
    };

    const confirmCopy = confirmAction ? CONFIRM_COPY(confirmAction) : null;

    return (
        <>
            <ListPageTemplate trail={[]}
                title="People Registry"
                description="Manage people as costed, allocatable resources"
                headerSecondaryActions={[
                    ...(canImportEmployees ? [
                        // Land directly on the Import tab — clicking Import must
                        // never drop the user on the Export section.
                        <Button key="import" variant="secondary" onClick={() => navigate('/people/import-export?tab=import')}>
                            <Upload size={16} />
                            Import
                        </Button>,
                    ] : []),
                    ...(canExportEmployees ? [
                        // Downloads the filtered registry as CSV directly (Excel/format choice lives on Data Management).
                        <Button key="export" variant="secondary" onClick={handleExportCsv} disabled={isExporting}>
                            <Download size={16} />
                            Export
                        </Button>,
                    ] : []),
                ]}
                primaryAction={canAddEmployee ? (
                    <QuotaGate
                        quotaKey="max_employees"
                        moduleCode="people"
                        used={quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                            disabled={isSandboxMode}
                            title={isSandboxMode ? 'Not available in Sandbox mode' : undefined}
                        >
                            <UserPlus size={16} />
                            Add Person
                        </Button>
                    </QuotaGate>
                ) : undefined}
                search={
                    <SearchInput
                        name="people-search"
                        placeholder="Search by name, email, or title..."
                        value={search}
                        onChange={setSearch}
                        onClear={() => setSearch('')}
                    />
                }
                filterConfig={{
                    fields: [
                        { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'on_leave', label: 'On Leave' }, { value: 'terminated', label: 'Terminated' }, { value: 'archived', label: 'Archived' }] },
                        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'employee', label: 'Employee' }, { value: 'contractor', label: 'Contractor' }] },
                        { key: 'department', label: 'Department', type: 'select', options: departmentOptions },
                        { key: 'employmentType', label: 'Employment Type', type: 'select', options: employmentTypeOptions.map((t) => ({ value: t.code, label: t.name })) },
                        { key: 'joined', label: 'Joined', type: 'daterange' },
                    ],
                    values: {
                        status: statusFilter || undefined,
                        type: typeFilter || undefined,
                        department: departmentFilter || undefined,
                        employmentType: employmentTypeFilter || undefined,
                        joined: joiningFromFilter || joiningToFilter ? { start: joiningFromFilter, end: joiningToFilter } : undefined,
                    },
                    onChange: (v) => {
                        setStatusFilter((v.status as string) || '');
                        setTypeFilter((v.type as string) || '');
                        setDepartmentFilter((v.department as string) || '');
                        setEmploymentTypeFilter((v.employmentType as string) || '');
                        const joined = v.joined as { start?: string; end?: string } | undefined;
                        setJoiningFromFilter(joined?.start || '');
                        setJoiningToFilter(joined?.end || '');
                    },
                    onClear: handleClearFilters,
                }}
                isFilteredEmpty={hasActiveFilters && people.length === 0}
                onClearFilters={handleClearFilters}
                kpis={
                    <>
                {quotaData && (
                    <QuotaBar
                        label="Employees"
                        used={quotaData.current_usage}
                        limit={quotaData.limit}
                        isUnlimited={quotaData.is_unlimited}
                    />
                )}

                {joinedRangeInvalid && (
                    <Banner variant="danger">From Date cannot be later than To Date.</Banner>
                )}

                {isSandboxMode && isLimited(people.length) && (
                    <Banner variant="warning">
                        Sandbox: Showing {sandboxEntryLimit} of {people.length} records. Switch to Production to view all.
                    </Banner>
                )}
                    </>
                }
                loading={loading && people.length === 0}
                isEmpty={people.length === 0}
                empty={
                    <EmptyState
                        icon={Users}
                        title="No people found"
                        description="Add people to start tracking resource allocation and utilization."
                        action={{ label: 'Add First Person', onClick: () => setShowCreateModal(true) }}
                    />
                }
            >
                <DataTable<Person>
                    columns={columns}
                    rows={visiblePeople}
                    rowKey={(p) => p.id}
                    onRowClick={(p) => navigate(`/people/people/${p.id}`)}
                />
            </ListPageTemplate>

            {/* Create Modal */}
            <CreatePersonModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
                currencies={currencies}
                defaultCurrency={baseCurrency}
            />

            {/* Invite link — shown after inviting so the admin can copy/share it if email is unreliable */}
            <Modal
                open={!!inviteResult}
                onClose={() => setInviteResult(null)}
                title="Invitation ready"
                size="md"
                footer={<Button variant="ghost" onClick={() => setInviteResult(null)}>Done</Button>}
            >
                {inviteResult && (
                    <Stack gap="default">
                        <p className="text-nb-body text-fg">
                            {inviteResult.emailSent
                                ? <>We've emailed the invitation to <span className="font-medium">{inviteResult.email}</span>. If it doesn't arrive, copy and share this link directly:</>
                                : inviteResult.emailRequested
                                    ? <>The invitation for <span className="font-medium">{inviteResult.email}</span> was created, but the email could not be sent. Share this link with them directly:</>
                                    : <>Share this invite link with <span className="font-medium">{inviteResult.email}</span> so they can set a password and sign in:</>}
                        </p>
                        <Cluster gap="tight">
                            <TextField
                                name="invite-link"
                                readOnly
                                value={inviteResult.link}
                                onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
                            />
                            <Button variant="primary" onClick={handleCopyInvite}>Copy link</Button>
                        </Cluster>
                        <p className="text-nb-caption text-fg-muted">This link lets the invitee set a password. It expires according to your security settings.</p>
                    </Stack>
                )}
            </Modal>

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
            <ConfirmDialog
                open={!!confirmAction}
                title={confirmCopy?.title ?? ''}
                message={confirmCopy ? (
                    <>
                        {confirmCopy.message}
                        {confirmCopy.detail && <span className="block mt-nb-2 text-nb-caption text-fg-muted">{confirmCopy.detail}</span>}
                    </>
                ) : ''}
                confirmLabel={confirmCopy?.confirmLabel ?? 'Confirm'}
                intent={confirmAction && (confirmAction.type === 'delete' || confirmAction.type === 'cancel-invite') ? 'danger' : 'default'}
                onCancel={() => setConfirmAction(null)}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (!confirmAction || actionBusy) return;
                    if (confirmAction.type === 'delete') handleDeleteConfirmed(confirmAction.person);
                    else if (confirmAction.type === 'archive') handleSetStatus(confirmAction.person, 'archived');
                    else if (confirmAction.type === 'deactivate') handleSetStatus(confirmAction.person, 'inactive');
                    else if (confirmAction.type === 'cancel-invite') handleCancelInvite(confirmAction.person);
                }}
            />
        </>
    );
};

export default PeoplePage;
