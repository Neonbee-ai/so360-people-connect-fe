import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, UserPlus, Search, Filter, Mail, Phone, Briefcase, Upload, Download, ChevronDown, ChevronRight, MoreHorizontal, Pencil, UserMinus, UserCheck, Archive, Trash2, Send, XCircle, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { peopleApi } from '../services/peopleService';
import type { Person, CreatePersonPayload, PersonStatus, AccessStatus, InvitationStatus, LaborCategoryOption } from '../types/people';
import DepartmentSelector from '../components/DepartmentSelector';
import UserSelector from '../components/UserSelector';
import { usePeopleContext } from '../hooks/useShellContext';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, toast } from '@so360/design-system';
import { workLocationsApi, WorkLocation } from '../services/workLocationsService';
import { mastersApi, MasterRow } from '../services/mastersService';
import {
    customFieldDefsApi,
    personCustomFieldsApi,
    CustomFieldDef,
    PersonCustomFieldValue,
    CHOICE_FIELD_TYPES,
} from '../services/customFieldsService';
import { usePeopleFormatters } from '../utils/formatters';
import { fetchOrgBaseCurrency } from '../services/settingsService';
import { validatePersonName, validateEmail, validatePhone, focusFirstInvalid } from '../utils/validation';

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

// =============================================================================
// Custom Fields Section — renders one input per active custom field
// definition (org-defined via Settings > Employee Custom Fields). Shared by
// both the Create and Edit Person modals so the field-type -> input mapping
// lives in exactly one place.
// =============================================================================

interface RenderableCustomField {
    field_def_id: string;
    label: string;
    field_type: 'text' | 'number' | 'dropdown' | 'date' | 'checkbox' | 'multi_select';
    options?: string[] | null;
    is_required?: boolean;
}

interface CustomFieldsSectionProps {
    fields: RenderableCustomField[];
    values: Record<string, unknown>;
    onChange: (fieldDefId: string, value: unknown) => void;
    loadError?: boolean;
}

const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ fields, values, onChange, loadError }) => {
    if (loadError) {
        return (
            <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Custom Fields</h4>
                <p className="text-xs text-rose-400">Couldn't load custom fields. Try reopening this form.</p>
            </div>
        );
    }

    if (fields.length === 0) return null;

    return (
        <div data-testid="custom-fields-section">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Custom Fields</h4>
            <div className="grid grid-cols-2 gap-4">
                {fields.map(field => {
                    const value = values[field.field_def_id];
                    const inputClass = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500";
                    return (
                        <div key={field.field_def_id} data-testid={`custom-field-${field.field_def_id}`}>
                            <label className="block text-xs text-slate-400 mb-1">
                                {field.label}{field.is_required && <span className="text-red-400"> *</span>}
                            </label>
                            {field.field_type === 'text' && (
                                <input
                                    type="text"
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value)}
                                    className={inputClass}
                                />
                            )}
                            {field.field_type === 'number' && (
                                <input
                                    type="number"
                                    value={value === undefined || value === null ? '' : (value as number)}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value === '' ? null : parseFloat(e.target.value))}
                                    className={inputClass}
                                />
                            )}
                            {field.field_type === 'date' && (
                                <input
                                    type="date"
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value)}
                                    className={inputClass}
                                />
                            )}
                            {field.field_type === 'checkbox' && (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={!!value}
                                        onChange={e => onChange(field.field_def_id, e.target.checked)}
                                        className="text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="text-xs text-slate-400">Yes</span>
                                </label>
                            )}
                            {field.field_type === 'dropdown' && (
                                <select
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value || undefined)}
                                    className={inputClass}
                                >
                                    <option value="">Select {field.label}</option>
                                    {(field.options || []).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}
                            {field.field_type === 'multi_select' && (
                                <div className="flex flex-wrap gap-2">
                                    {(field.options || []).map(opt => {
                                        const selected = Array.isArray(value) && (value as string[]).includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    const current: string[] = Array.isArray(value) ? [...(value as string[])] : [];
                                                    const next = current.includes(opt)
                                                        ? current.filter(v => v !== opt)
                                                        : [...current, opt];
                                                    onChange(field.field_def_id, next);
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs border transition-colors ${selected ? 'bg-teal-600 border-teal-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500'}`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                    {(field.options || []).length === 0 && (
                                        <span className="text-xs text-slate-500">No options configured for this field.</span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const INVITATION_LABEL: Record<InvitationStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    expired: 'Expired',
};

/**
 * Pick the org role an invite (or re-invite) should carry.
 *
 * Both invite actions previously used `roles.data[0].id` — the first row the API
 * happened to return. Two things went wrong with that. The role handed to a new
 * user was effectively arbitrary (Guest for some orgs, Admin for others), and
 * because the backend upserts invites on (org_id, email), hitting "Resend"
 * silently OVERWROTE the role an administrator had deliberately chosen.
 *
 * So: keep the person's existing role when they already have one, otherwise use
 * the canonical Employee role. Never guess — returning null surfaces a real error
 * rather than quietly granting the wrong level of access.
 */
export const resolveInviteRoleId = (
    person: Person,
    roles?: Array<{ id: string; name: string }>,
): string | undefined => {
    if (!roles?.length) return undefined;

    const byName = (name?: string | null) =>
        name
            ? roles.find(r => r.name?.toLowerCase().trim() === name.toLowerCase().trim())
            : undefined;

    return (byName(person.system_role) ?? byName('Employee'))?.id;
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
    const { getQuota, refresh: refreshQuota } = useQuota({ checks: quotaChecks, orgId });
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
            const customFieldValues = (data as any).customFieldValues as Record<string, unknown> | undefined;
            const createPayload = { ...data } as any;
            delete createPayload.customFieldValues;
            const created = await peopleApi.create(createPayload);
            setShowCreateModal(false);
            recordActivity({ eventType: 'people.person.created', eventCategory: 'identity', description: `Person ${data.full_name} was created`, resourceType: 'person', resourceId: created?.id }).catch(() => {});

            if (created?.id && customFieldValues && Object.keys(customFieldValues).length > 0) {
                const entries = Object.entries(customFieldValues).map(([field_def_id, value]) => ({ field_def_id, value }));
                personCustomFieldsApi.setForPerson(created.id, entries).catch(() => {
                    toast.error('Person created, but saving custom field values failed');
                });
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
                            // Land directly on the Import tab — clicking Import must
                            // never drop the user on the Export section.
                            onClick={() => navigate('/people/import-export?tab=import')}
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
                        className="w-full pl-9 pr-9 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
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
                    <label htmlFor="joined-from" className="text-xs text-slate-400">Joined:</label>
                    <input
                        id="joined-from"
                        type="date"
                        aria-label="Joined from"
                        value={joiningFromFilter}
                        onChange={(e) => setJoiningFromFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-slate-600">-</span>
                    <input
                        type="date"
                        aria-label="Joined to"
                        value={joiningToFilter}
                        onChange={(e) => setJoiningToFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    />
                    {(joiningFromFilter || joiningToFilter) && (
                        <button
                            type="button"
                            onClick={() => { setJoiningFromFilter(''); setJoiningToFilter(''); }}
                            aria-label="Clear joined date range"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Reset everything at once — previously the only way back to the
                    default view was clearing six controls by hand or reloading. */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-slate-50 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <X size={14} />
                        Clear Filters
                    </button>
                )}
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
                            {/* Every trailing section lives in a fixed-width cell, so
                                the columns line up across rows no matter how long a
                                name/role is or which optional controls a row has. */}
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
                                    <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                        <span className="text-sm font-medium text-slate-50 truncate">{person.full_name}</span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <StatusBadge status={person.type} />
                                            <StatusBadge status={person.status} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 min-w-0 truncate">
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
                                <div className="w-28 text-right flex-shrink-0">
                                    <div className="text-sm font-medium text-slate-50 truncate">
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
                                        <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0 w-36" aria-label="System access">
                                            {/* Access Status */}
                                            <span
                                                aria-label="Access status"
                                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${accessBadge.className}`}
                                            >
                                                {accessBadge.label}
                                            </span>
                                            {/* System Role (Core login role — distinct from skill/people_roles) */}
                                            <span className="text-xs text-slate-500 truncate max-w-full" aria-label="System role" title={person.system_role || undefined}>
                                                Role: {person.system_role || '—'}
                                            </span>
                                            {/* Invitation Status */}
                                            <span className="text-xs text-slate-600" aria-label="Invitation status">
                                                Invite: {invitation}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Invite action — primarily for people without access.
                                    The cell is always rendered (even when the person
                                    already has access) so the columns after it stay put. */}
                                <div className="hidden sm:flex w-24 justify-end flex-shrink-0">
                                {(() => {
                                    const isPending = person.access_status === 'pending' || person.invitation_status === 'pending';
                                    const hasAccess = person.access_status === 'active';
                                    // Hide the control once the person already has access;
                                    // otherwise show Invite (no_access) or a disabled
                                    // "Invited" (pending).
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
                                </div>

                                {/* Skills — capability tags (distinct from the System Role shown above) */}
                                <div className="hidden lg:flex items-center justify-end gap-1 w-32 flex-shrink-0 overflow-hidden">
                                    {person.people_roles?.slice(0, 2).map((skill) => (
                                        <span key={skill.id} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400 truncate">
                                            {skill.role_name}
                                        </span>
                                    ))}
                                    {person.people_roles && person.people_roles.length > 2 && (
                                        <span className="text-xs text-slate-600 flex-shrink-0">+{person.people_roles.length - 2}</span>
                                    )}
                                </div>

                                {/* Actions (⋮) — Edit / Deactivate / Archive / Delete / Resend / Cancel */}
                                {(canEditEmployee || canDeleteEmployee) && (
                                    <div className="relative flex-shrink-0 w-8 flex justify-end">
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
                                : inviteResult.emailRequested
                                    ? <>The invitation for <span className="text-slate-100 font-medium">{inviteResult.email}</span> was created, but the email could not be sent. Share this link with them directly:</>
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
    const navigate = useNavigate();
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
    const [workLocationsError, setWorkLocationsError] = useState(false);
    const [designations, setDesignations] = useState<MasterRow[]>([]);
    const [designationsError, setDesignationsError] = useState(false);
    const [employmentTypes, setEmploymentTypes] = useState<MasterRow[]>([]);
    const [employmentTypesError, setEmploymentTypesError] = useState(false);
    const [orgRoles, setOrgRoles] = useState<Array<{ id: string; name: string }>>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
    const [customFieldsError, setCustomFieldsError] = useState(false);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
    // Holds the resolved org currency. Initialized from the shell prop when available;
    // falls back to a direct Core BE fetch to avoid the shell's async race condition.
    const [resolvedCurrency, setResolvedCurrency] = useState(defaultCurrency || 'USD');

    useEffect(() => {
        if (!isOpen) return;
        setWorkLocationsError(false);
        workLocationsApi.getAll()
            .then(r => setWorkLocations(r.data ?? []))
            .catch(() => setWorkLocationsError(true));
        setDesignationsError(false);
        mastersApi.getAll('designation')
            .then(r => setDesignations(r.data ?? []))
            .catch(() => setDesignationsError(true));
        setEmploymentTypesError(false);
        mastersApi.getAll('employment_type')
            .then(r => setEmploymentTypes(r.data ?? []))
            .catch(() => setEmploymentTypesError(true));
        peopleApi.getOrgRoles().then(r => setOrgRoles(r.data ?? [])).catch(() => {});
        setCustomFieldsError(false);
        setCustomFieldValues({});
        customFieldDefsApi.getAll()
            .then(r => setCustomFieldDefs(r.data ?? []))
            .catch(() => setCustomFieldsError(true));
    }, [isOpen]);

    const updateCustomFieldValue = (fieldDefId: string, value: unknown) => {
        setCustomFieldValues(prev => ({ ...prev, [fieldDefId]: value }));
    };

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

    const [errors, setErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    // Submit-order of the validated fields — drives which field gets scrolled
    // to and focused when a submit is rejected.
    const FIELD_ORDER = ['full_name', 'email', 'phone', 'inviteEmail', 'inviteRole'];

    // Sync form currency whenever the resolved currency updates or the modal opens.
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setFormData(prev => ({ ...prev, currency: resolvedCurrency }));
        }
    }, [isOpen, resolvedCurrency]);

    const validate = (data: typeof formData): Record<string, string> => {
        const next: Record<string, string> = {};
        const nameError = validatePersonName(data.full_name);
        if (nameError) next.full_name = nameError;
        const emailError = validateEmail(data.email);
        if (emailError) next.email = emailError;
        const phoneError = validatePhone(data.phone);
        if (phoneError) next.phone = phoneError;
        if (data.userLinkageMode === 'invite') {
            // The Identity email IS the invitation email (the invite field is a
            // read-only mirror), so validate that one and point the admin back to it.
            const inviteEmailError = validateEmail(data.email, true);
            if (inviteEmailError) {
                next.inviteEmail = data.email
                    ? inviteEmailError
                    : 'Add an email in the Identity section — the invitation is sent to that address.';
            }
            if (!data.inviteRole) next.inviteRole = 'Select a role for the invited user.';
        }
        if (data.userLinkageMode === 'link' && !data.existingUserId) {
            next.existingUserId = 'Select the user account to link.';
        }
        return next;
    };

    // Live validity — the primary action stays disabled until the form can
    // actually be submitted, instead of firing a browser validation bubble
    // anchored to a field the user may have scrolled past.
    const isFormValid = Object.keys(validate(formData)).length === 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            focusFirstInvalid(formRef.current, [...FIELD_ORDER, 'existingUserId'], validationErrors);
            return;
        }
        // Omit an unselected department so the backend @IsUUID validation is not
        // triggered by an empty string.
        const payload: any = { ...formData, full_name: formData.full_name.trim() };
        payload.department_id = payload.department_id || undefined;
        // The invitation always goes to the Identity email — never carry a separate value.
        payload.inviteEmail = payload.email;
        if (Object.keys(customFieldValues).length > 0) {
            payload.customFieldValues = customFieldValues;
        }
        onCreate(payload);
        setCustomFieldValues({});
        // Reset form
        setFormData({
            full_name: '', email: '', phone: '', type: 'employee',
            department_id: '', job_title: '', cost_rate: 0, cost_rate_unit: 'hour',
            currency: resolvedCurrency, billing_rate: 0, available_hours_per_day: 8,
            available_days_per_week: 5, start_date: new Date().toISOString().split('T')[0],
            userLinkageMode: 'invite', sendInviteEmail: true,
        });
        setErrors({});
    };

    const updateField = (field: string, value: unknown) => {
        // Functional update: `currency` is resolved asynchronously from org
        // settings, so merging into a captured snapshot could revert it.
        setFormData(prev => ({ ...prev, [field]: value }));
        // Re-validate the touched field so a correction clears immediately.
        // Validation only reads user-entered fields, so the snapshot is safe.
        const nextData = { ...formData, [field]: value } as typeof formData;
        const fieldErrors = validate(nextData);
        setErrors(prev => ({
            ...prev,
            [field]: fieldErrors[field] || '',
            // Switching linkage mode changes which invite fields are required.
            ...(field === 'userLinkageMode'
                ? { inviteEmail: fieldErrors.inviteEmail || '', inviteRole: fieldErrors.inviteRole || '', existingUserId: fieldErrors.existingUserId || '' }
                : {}),
            // The invite email defaults to the identity email — keep them in sync.
            ...(field === 'email' ? { inviteEmail: fieldErrors.inviteEmail || '' } : {}),
        }));
    };

    // Summarises what is still missing when more than one field is invalid.
    const errorCount = Object.values(errors).filter(Boolean).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Person" size="lg">
            {/* noValidate: browser-native bubbles anchor to the offending field even
                when it is scrolled out of view, so a user at the bottom of this
                modal saw nothing happen. Inline messages + scroll-to-first-invalid
                replace them. */}
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Basic Info */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="person-full-name" className="block text-xs text-slate-400 mb-1">Full Name *</label>
                            <input
                                id="person-full-name"
                                data-field="full_name"
                                type="text" value={formData.full_name}
                                onChange={(e) => updateField('full_name', e.target.value)}
                                aria-invalid={!!errors.full_name}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.full_name ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                                placeholder="John Doe"
                            />
                            {errors.full_name && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.full_name}</p>}
                        </div>
                        <div>
                            <label htmlFor="person-email" className="block text-xs text-slate-400 mb-1">Email</label>
                            <input
                                id="person-email"
                                data-field="email"
                                type="text" value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                aria-invalid={!!errors.email}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.email ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                                placeholder="john@company.com"
                            />
                            {errors.email && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.email}</p>}
                        </div>
                        <div>
                            <label htmlFor="person-phone" className="block text-xs text-slate-400 mb-1">Phone</label>
                            <input
                                id="person-phone"
                                data-field="phone"
                                type="text" inputMode="tel" value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                aria-invalid={!!errors.phone}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.phone ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                                placeholder="+1-555-0100"
                            />
                            {errors.phone && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.phone}</p>}
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
                            <label className="block text-xs text-slate-400 mb-1">Job Title (Designation)</label>
                            <select
                                value={formData.job_title || ''}
                                onChange={(e) => updateField('job_title', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Designation</option>
                                {designations.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            {designationsError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load designations. Try reopening this form.</p>
                            ) : designations.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No designations configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/designations')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Designation
                                    </button>
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Employment Type</label>
                            <select
                                value={(formData as any).employment_type || ''}
                                onChange={(e) => updateField('employment_type', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Employment Type</option>
                                {employmentTypes.map(et => (
                                    <option key={et.id} value={et.code}>{et.name}</option>
                                ))}
                            </select>
                            {employmentTypesError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load employment types. Try reopening this form.</p>
                            ) : employmentTypes.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No employment types configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/employment-types')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Employment Type
                                    </button>
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Work Location</label>
                            <select
                                value={(formData as any).work_location_id || ''}
                                onChange={(e) => updateField('work_location_id', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Work Location</option>
                                {workLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                            {workLocationsError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load work locations. Try reopening this form.</p>
                            ) : workLocations.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No work locations configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/work-locations')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Work Location
                                    </button>
                                </p>
                            ) : null}
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

                {/* Custom Fields */}
                <CustomFieldsSection
                    fields={customFieldDefs.map(d => ({ field_def_id: d.id, label: d.label, field_type: d.field_type, options: d.options, is_required: d.is_required }))}
                    values={customFieldValues}
                    onChange={updateCustomFieldValue}
                    loadError={customFieldsError}
                />

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
                                    <div data-field="existingUserId" tabIndex={-1}>
                                        <UserSelector
                                            value={formData.existingUserId}
                                            onChange={(userId: string | null) => updateField('existingUserId', userId)}
                                            orgId={orgId}
                                            tenantId={tenantId}
                                            placeholder="Select user..."
                                        />
                                        {errors.existingUserId && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.existingUserId}</p>}
                                    </div>
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
                                        {/* Read-only mirror of the Identity email — the single source of
                                            truth for the invitation. It used to be editable with an
                                            `inviteEmail || email` fallback, which forked the two values on
                                            the first keystroke: the invite went to one address while the
                                            person record carried another, and Core's ensurePersonLink (which
                                            matches people by email) then created a SECOND, duplicate person
                                            for the invitee instead of linking the one just added. */}
                                        <input
                                            data-field="inviteEmail"
                                            type="text"
                                            readOnly
                                            aria-label="Email for invitation"
                                            aria-readonly="true"
                                            value={formData.email || ''}
                                            aria-invalid={!!errors.inviteEmail}
                                            className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-sm text-slate-400 cursor-not-allowed focus:outline-none ${errors.inviteEmail ? 'border-rose-500' : 'border-slate-700'}`}
                                            placeholder="Email for invitation"
                                        />
                                        {errors.inviteEmail
                                            ? <p role="alert" className="text-xs text-rose-400">{errors.inviteEmail}</p>
                                            : <p className="text-xs text-slate-500">
                                                The invitation will be emailed to <span className="text-slate-300">{formData.email}</span>. To change it, edit the Email field in the Identity section.
                                            </p>}
                                        <select
                                            data-field="inviteRole"
                                            aria-label="Invitation role"
                                            value={formData.inviteRole || ''}
                                            onChange={(e) => updateField('inviteRole', e.target.value)}
                                            aria-invalid={!!errors.inviteRole}
                                            className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.inviteRole ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                                        >
                                            <option value="">Select role...</option>
                                            {orgRoles.map(role => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                        </select>
                                        {errors.inviteRole && <p role="alert" className="text-xs text-rose-400">{errors.inviteRole}</p>}
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

                {/* Validation summary — visible wherever the user has scrolled to. */}
                {errorCount > 1 && (
                    <div role="alert" className="px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400">
                        {errorCount} fields need attention before this person can be added.
                    </div>
                )}

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
                        disabled={!isFormValid}
                        title={isFormValid ? undefined : 'Complete all required fields with valid values.'}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    const navigate = useNavigate();
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
    const [workLocationsError, setWorkLocationsError] = useState(false);
    const [designations, setDesignations] = useState<MasterRow[]>([]);
    const [designationsError, setDesignationsError] = useState(false);
    const [employmentTypes, setEmploymentTypes] = useState<MasterRow[]>([]);
    const [employmentTypesError, setEmploymentTypesError] = useState(false);
    const [formData, setFormData] = useState<Partial<Person>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const [customFields, setCustomFields] = useState<PersonCustomFieldValue[]>([]);
    const [customFieldsError, setCustomFieldsError] = useState(false);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

    useEffect(() => {
        if (!isOpen) return;
        setWorkLocationsError(false);
        workLocationsApi.getAll()
            .then(r => setWorkLocations(r.data ?? []))
            .catch(() => setWorkLocationsError(true));
        setDesignationsError(false);
        mastersApi.getAll('designation')
            .then(r => setDesignations(r.data ?? []))
            .catch(() => setDesignationsError(true));
        setEmploymentTypesError(false);
        mastersApi.getAll('employment_type')
            .then(r => setEmploymentTypes(r.data ?? []))
            .catch(() => setEmploymentTypesError(true));
    }, [isOpen]);

    // Reload the form whenever a different person is opened for edit.
    useEffect(() => {
        if (!person) return;
        setErrors({});
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
            default_labor_category_id: person.default_labor_category_id,
            billing_type: person.billing_type,
        });
    }, [person]);

    // Load this person's current custom field values (merged with every
    // active field def) whenever the edit modal opens for a given person.
    useEffect(() => {
        if (!isOpen || !person) return;
        setCustomFieldsError(false);
        personCustomFieldsApi.getForPerson(person.id)
            .then(r => {
                const rows = r.data ?? [];
                setCustomFields(rows);
                const initial: Record<string, unknown> = {};
                rows.forEach(row => { initial[row.field_def_id] = row.value; });
                setCustomFieldValues(initial);
            })
            .catch(() => setCustomFieldsError(true));
    }, [isOpen, person?.id]);

    // Same identity rules as Add Person — the backend applies them on update
    // too, so without this an edit would fail with a raw 400.
    const validate = (data: Partial<Person>): Record<string, string> => {
        const next: Record<string, string> = {};
        const nameError = validatePersonName(data.full_name);
        if (nameError) next.full_name = nameError;
        const emailError = validateEmail(data.email);
        if (emailError) next.email = emailError;
        const phoneError = validatePhone(data.phone);
        if (phoneError) next.phone = phoneError;
        return next;
    };

    const isFormValid = Object.keys(validate(formData)).length === 0;

    const updateField = (field: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'full_name' || field === 'email' || field === 'phone') {
            const fieldErrors = validate({ ...formData, [field]: value });
            setErrors(prev => ({ ...prev, [field]: fieldErrors[field] || '' }));
        }
    };

    const updateCustomFieldValue = (fieldDefId: string, value: unknown) => {
        setCustomFieldValues(prev => ({ ...prev, [fieldDefId]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!person) return;
        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            focusFirstInvalid(formRef.current, ['full_name', 'email', 'phone'], validationErrors);
            return;
        }
        const payload: any = { ...formData, full_name: (formData.full_name || '').trim() };
        // Empty select value means "clear it". Send null rather than '' so the
        // backend @IsUUID / @IsEnum validators are not tripped by an empty string.
        payload.default_labor_category_id = payload.default_labor_category_id || null;
        payload.billing_type = payload.billing_type || null;
        if (Object.keys(customFieldValues).length > 0) {
            payload.customFieldValues = customFieldValues;
        }
        onSave(person.id, payload);
    };

    // Timesheet costing defaults. These feed the Log Time precheck: an employee
    // without a usable rate is blocked from logging time entirely.
    const [showCosting, setShowCosting] = useState(false);
    const [laborCategories, setLaborCategories] = useState<LaborCategoryOption[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        peopleApi.getLaborCategoryOptions()
            .then((rows) => setLaborCategories(rows ?? []))
            // The catalog is optional — an org with none simply relies on per-person
            // rates, so a failure here must not break the form.
            .catch(() => setLaborCategories([]));
    }, [isOpen]);

    const resolvedCostCenter = person?.department_info?.name
        ? `Via ${person.department_info.name}`
        : null;

    // Surfaced on the collapsed disclosure so missing config is never hidden AND forgotten.
    const missingCostingCount =
        (formData.default_labor_category_id ? 0 : 1) + (formData.billing_type ? 0 : 1);

    // Auto-expand when something is unset, so the section is not a place config goes to hide.
    useEffect(() => {
        if (isOpen && missingCostingCount > 0) setShowCosting(true);
    }, [isOpen, missingCostingCount]);

    if (!person) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${person.full_name}`} size="lg">
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="edit-person-full-name" className="block text-xs text-slate-400 mb-1">Full Name *</label>
                            <input
                                id="edit-person-full-name"
                                data-field="full_name"
                                type="text" value={formData.full_name || ''}
                                onChange={(e) => updateField('full_name', e.target.value)}
                                aria-invalid={!!errors.full_name}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.full_name ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                            />
                            {errors.full_name && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.full_name}</p>}
                        </div>
                        <div>
                            <label htmlFor="edit-person-email" className="block text-xs text-slate-400 mb-1">Email</label>
                            <input
                                id="edit-person-email"
                                data-field="email"
                                type="text" value={formData.email || ''}
                                onChange={(e) => updateField('email', e.target.value)}
                                aria-invalid={!!errors.email}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.email ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                            />
                            {errors.email && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.email}</p>}
                        </div>
                        <div>
                            <label htmlFor="edit-person-phone" className="block text-xs text-slate-400 mb-1">Phone</label>
                            <input
                                id="edit-person-phone"
                                data-field="phone"
                                type="text" inputMode="tel" value={formData.phone || ''}
                                onChange={(e) => updateField('phone', e.target.value)}
                                aria-invalid={!!errors.phone}
                                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${errors.phone ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-teal-500'}`}
                            />
                            {errors.phone && <p role="alert" className="mt-1 text-xs text-rose-400">{errors.phone}</p>}
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
                                {employmentTypes.map(et => (
                                    <option key={et.id} value={et.code}>{et.name}</option>
                                ))}
                            </select>
                            {employmentTypesError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load employment types. Try reopening this form.</p>
                            ) : employmentTypes.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No employment types configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/employment-types')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Employment Type
                                    </button>
                                </p>
                            ) : null}
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
                            <label className="block text-xs text-slate-400 mb-1">Job Title (Designation)</label>
                            <select
                                value={formData.job_title || ''}
                                onChange={(e) => updateField('job_title', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Designation</option>
                                {designations.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            {designationsError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load designations. Try reopening this form.</p>
                            ) : designations.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No designations configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/designations')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Designation
                                    </button>
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Work Location</label>
                            <select
                                value={formData.work_location_id || ''}
                                onChange={(e) => updateField('work_location_id', e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select Work Location</option>
                                {workLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                            {workLocationsError ? (
                                <p className="text-xs text-rose-400 mt-1">Couldn't load work locations. Try reopening this form.</p>
                            ) : workLocations.length === 0 ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    No work locations configured.{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/people/settings/work-locations')}
                                        className="text-teal-400 hover:text-teal-300 underline"
                                    >
                                        Create Work Location
                                    </button>
                                </p>
                            ) : null}
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

                    {/* Timesheet costing defaults — progressive disclosure. Collapsed
                        when complete so the rate fields above stay the focus; the count
                        badge means it is never hidden AND forgotten. */}
                    <button
                        type="button"
                        onClick={() => setShowCosting((v) => !v)}
                        className="mt-4 flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300"
                        aria-expanded={showCosting}
                    >
                        {showCosting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Timesheet &amp; costing defaults
                        {missingCostingCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                                {missingCostingCount} missing
                            </span>
                        )}
                    </button>

                    {showCosting && (
                        <div className="mt-3 grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Default Labor Category</label>
                                <select
                                    value={formData.default_labor_category_id || ''}
                                    onChange={(e) => updateField('default_labor_category_id', e.target.value || null)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                    aria-label="Default Labor Category"
                                >
                                    <option value="">Not set</option>
                                    {laborCategories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}{c.rate_configured ? '' : ' (no rate)'}
                                        </option>
                                    ))}
                                </select>
                                {laborCategories.length === 0 && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        No labor categories configured. The employee&apos;s own cost rate will be used.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Billing Type</label>
                                <select
                                    value={formData.billing_type || ''}
                                    onChange={(e) => updateField('billing_type', e.target.value || null)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                                    aria-label="Billing Type"
                                >
                                    <option value="">Not set</option>
                                    <option value="billable">Billable</option>
                                    <option value="non_billable">Non-billable</option>
                                    <option value="internal">Internal</option>
                                </select>
                            </div>

                            {/* Read-only: cost centres are owned by Accounting and inherited
                                via the employee's department. Editing them here would fork
                                the org's chart of cost centres. */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Cost Center</label>
                                <div className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-400">
                                    {resolvedCostCenter || 'Inherited from department — not set'}
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Set on the department, not the employee.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Fields */}
                <CustomFieldsSection
                    fields={customFields.map(f => ({ field_def_id: f.field_def_id, label: f.label, field_type: f.field_type, options: f.options, is_required: f.is_required }))}
                    values={customFieldValues}
                    onChange={updateCustomFieldValue}
                    loadError={customFieldsError}
                />

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
                        type="submit" disabled={busy || !isFormValid}
                        title={isFormValid ? undefined : 'Fix the highlighted fields before saving.'}
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
