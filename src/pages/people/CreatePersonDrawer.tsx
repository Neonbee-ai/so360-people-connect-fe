import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useHref } from 'react-router-dom';
import { Users, UserPlus, Search, Filter, Mail, Phone, Briefcase, Upload, Download, ChevronDown, ChevronRight, MoreHorizontal, Pencil, UserMinus, UserCheck, Archive, Trash2, Send, XCircle, X } from 'lucide-react';
import { peopleApi } from '../../services/peopleService';
import type { Person, CreatePersonPayload, PersonStatus, AccessStatus, InvitationStatus, LaborCategoryOption } from '../../types/people';
import DepartmentSelector from '../../components/DepartmentSelector';
import UserSelector from '../../components/UserSelector';
import { usePeopleContext } from '../../hooks/useShellContext';
import { useCanViewCompensation } from '../../hooks/useCanViewCompensation';
import { useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { toast, Alert, Drawer, Select, TextField, NumberInput, DateInput, Checkbox, RadioGroup, Button, Stack, FieldGrid, FieldGridItem, FormSection, Cluster } from '@so360/design-system';
import { workLocationsApi, WorkLocation } from '../../services/workLocationsService';
import { mastersApi, MasterRow } from '../../services/mastersService';
import {
    customFieldDefsApi,
    personCustomFieldsApi,
    CustomFieldDef,
    PersonCustomFieldValue,
    CHOICE_FIELD_TYPES,
} from '../../services/customFieldsService';
import { usePeopleFormatters } from '../../utils/formatters';
import { leaveConfigApi } from '../../services/leaveConfigService';
import PersonLeaveConfigSection, { type PendingLeaveOverride } from '../../components/leave/PersonLeaveConfigSection';
import { fetchOrgBaseCurrency } from '../../services/settingsService';
import { validatePersonName, validateEmail, validatePhone, sanitizePhoneInput, focusFirstInvalid } from '../../utils/validation';
import { useRefreshOnReturn } from '../../hooks/useRefreshOnReturn';
import { personTypeForEmploymentType, personTypeLabel, typeToSendOnEdit } from '../../utils/personType';
import { DEFAULT_CURRENCIES } from './shared';
import { CustomFieldsSection } from './CustomFieldsSection';
import { WorkLocationFieldHelp, Section, QuickAddLocationPanel } from './WorkLocationHelpers';

// =============================================================================
// Create Person Modal
// =============================================================================

export interface CreatePersonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreatePersonPayload) => void;
    currencies?: string[];
    // Org's configured base currency; pre-selected as the default. Falls back to
    // 'USD' only when no org currency is configured.
    defaultCurrency?: string;
}

export const CreatePersonModal: React.FC<CreatePersonModalProps> = ({ isOpen, onClose, onCreate, currencies = DEFAULT_CURRENCIES, defaultCurrency }) => {
    // This modal is a SIBLING of the page component, so it cannot see the
    // page's formatters — it needs its own hook to reach the org timezone.
    const formatters = usePeopleFormatters();
    const { orgId, tenantId } = usePeopleContext();
    const navigate = useNavigate();
    const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
    const [workLocationsError, setWorkLocationsError] = useState(false);
    const [designations, setDesignations] = useState<MasterRow[]>([]);
    const [designationsError, setDesignationsError] = useState(false);
    const [employmentTypes, setEmploymentTypes] = useState<MasterRow[]>([]);
    const [employmentTypesError, setEmploymentTypesError] = useState(false);
    // "Create Employment Type" opens in a new tab so a half-filled form is kept;
    // the list is re-read once, when the user comes back from that tab.
    const employmentTypesHref = useHref('/people/settings/employment-types');
    const markEmploymentTypesPending = useRefreshOnReturn(isOpen, () => {
        mastersApi.getAll('employment_type')
            .then(r => { setEmploymentTypes(r.data ?? []); setEmploymentTypesError(false); })
            .catch(() => {});
    });
    const [orgRoles, setOrgRoles] = useState<Array<{ id: string; name: string }>>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
    const [customFieldsError, setCustomFieldsError] = useState(false);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
    // Employee-level leave deviations, staged here and applied after the person
    // row exists (overrides are keyed by person_id).
    const [leaveOverrides, setLeaveOverrides] = useState<PendingLeaveOverride[]>([]);
    const shell = useShellBridge() as any;
    // Creating a person and managing their leave are separate permissions: an
    // HR assistant may hold the first and not the second, in which case they see
    // the inherited structure read-only. Fails open while permissions resolve.
    const canManageLeave = !shell?.permissionsLoaded
        ? true
        : (shell?.hasPermission?.('leave.update') ?? true);
    // Creating org-wide leave types from inside the form. Mirrors the Leave
    // Types page guard (leave.configure) and the create endpoint's own guard
    // (leave.create). Fails closed: offering a create that then 403s is worse
    // than not offering it until permissions resolve.
    // The Employment Types page is guarded by org_policy.read — don't open a
    // new tab onto an access-denied screen. Fails closed while loading.
    const canManageEmploymentTypes = !!shell?.permissionsLoaded
        && !!shell?.hasPermission?.('org_policy.read');
    const canCreateLeaveTypes = !!shell?.permissionsLoaded
        && !!shell?.hasPermission?.('leave.configure')
        && !!shell?.hasPermission?.('leave.create');
    // Holds the resolved org currency. Initialized from the shell prop when available;
    // falls back to a direct Core BE fetch to avoid the shell's async race condition.
    const [resolvedCurrency, setResolvedCurrency] = useState(defaultCurrency || 'USD');

    useEffect(() => {
        if (!isOpen) return;
        setLeaveOverrides([]);
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
        start_date: formatters.businessToday(),
        userLinkageMode: 'invite',
        sendInviteEmail: true,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    // Submit-order of the validated fields — drives which field gets scrolled
    // to and focused when a submit is rejected.
    const FIELD_ORDER = ['full_name', 'email', 'phone', 'inviteEmail', 'inviteRole'];

    // The form stores employment_type as a CODE; leave configuration is keyed by
    // the master row's id, so resolve one to the other here rather than in the
    // section (which would have to re-fetch the master list to do it).
    // MUST stay below the formData declaration — reading it above is a temporal
    // dead zone error that crashes the whole modal at render, and tsc cannot see it.
    const selectedEmploymentType = employmentTypes.find(
        et => et.code === (formData as any).employment_type,
    );

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
        payload.type = personTypeForEmploymentType(payload.employment_type);
        // The invitation always goes to the Identity email — never carry a separate value.
        payload.inviteEmail = payload.email;
        if (Object.keys(customFieldValues).length > 0) {
            payload.customFieldValues = customFieldValues;
        }
        // Applied by handleCreate once the person id exists. Only sent when the
        // user actually deviated from the inherited defaults — an untouched
        // Leave Configuration section writes nothing at all.
        if (leaveOverrides.length > 0) {
            payload.leaveOverrides = leaveOverrides;
        }
        onCreate(payload);
        setCustomFieldValues({});
        setLeaveOverrides([]);
        // Reset form
        setFormData({
            full_name: '', email: '', phone: '', type: 'employee',
            department_id: '', job_title: '', cost_rate: 0, cost_rate_unit: 'hour',
            currency: resolvedCurrency, billing_rate: 0, available_hours_per_day: 8,
            available_days_per_week: 5, start_date: formatters.businessToday(),
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

    // Drawer content view — 'newLocation' replaces the form with the quick-add
    // location panel (UX guide: replace drawer content, never stack surfaces).
    // Form state lives here, not in the form DOM, so nothing typed is lost.
    const [view, setView] = useState<'form' | 'newLocation'>('form');
    useEffect(() => { if (isOpen) setView('form'); }, [isOpen]);

    const handleLocationCreated = (loc: WorkLocation) => {
        setWorkLocations(prev => [...prev, loc].sort((a, b) => a.name.localeCompare(b.name)));
        updateField('work_location_id', loc.id);
        setView('form');
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={view === 'form' ? 'Add Person' : 'New Work Location'}
            size="lg"
            onBack={view === 'newLocation' ? () => setView('form') : undefined}
            footer={
                view === 'form' ? (
                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button
                            type="submit"
                            form="create-person-form"
                            disabled={!isFormValid}
                            title={isFormValid ? undefined : 'Complete all required fields with valid values.'}
                        >
                            Add Person
                        </Button>
                    </Cluster>
                ) : (
                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={() => setView('form')}>Back</Button>
                        <Button type="submit" form="quick-add-location-form">Add Location</Button>
                    </Cluster>
                )
            }
        >
            {view === 'newLocation' && <QuickAddLocationPanel onCreated={handleLocationCreated} />}
            {/* noValidate: browser-native bubbles anchor to the offending field even
                when it is scrolled out of view, so a user at the bottom of this
                modal saw nothing happen. Inline messages + scroll-to-first-invalid
                replace them. */}
            <form ref={formRef} id="create-person-form" onSubmit={handleSubmit} noValidate className={view === 'newLocation' ? 'hidden' : undefined}>
              <Stack gap="region">
                {/* Basic Info */}
                <FormSection title="Identity" variant="plain" columns={2}>
                    <FieldGridItem span="full">
                        <TextField
                            name="person-full-name"
                            label="Full Name *"
                            data-field="full_name"
                            value={formData.full_name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('full_name', e.target.value)}
                            aria-invalid={!!errors.full_name}
                            error={errors.full_name}
                            placeholder="John Doe"
                        />
                    </FieldGridItem>
                    <TextField
                        name="person-email"
                        label="Email"
                        data-field="email"
                        value={formData.email || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('email', e.target.value)}
                        aria-invalid={!!errors.email}
                        error={errors.email}
                        placeholder="john@company.com"
                    />
                    <TextField
                        name="person-phone"
                        label="Phone"
                        data-field="phone"
                        inputMode="tel"
                        value={formData.phone || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('phone', sanitizePhoneInput(e.target.value))}
                        maxLength={20}
                        aria-invalid={!!errors.phone}
                        error={errors.phone}
                        placeholder="+1-555-0100"
                    />
                </FormSection>

                {/* Classification — the ≤5-field primary screen: Type, Department,
                    Work Location. Designation/employment type/joining date and the
                    cost/availability numbers live behind the sections below
                    (progressive disclosure), all pre-filled with sensible defaults. */}
                <FormSection title="Classification" variant="plain" columns={3}>
                    {/* The single classification input. Employee vs Contractor is
                        derived from it (see utils/personType) — there is no separate
                        Type field that could contradict it. */}
                    <Stack gap="tight">
                        <Select label="Employment Type" name="create-employment-type" id="create-employment-type" value={(formData as any).employment_type || ''} onChange={(e) => updateField('employment_type', e.target.value || undefined)} options={[{ value: "", label: "Select Employment Type" }, ...employmentTypes.map((et) => ({ value: et.code, label: et.name }))]} />
                        {employmentTypesError ? (
                            <p className="text-nb-caption text-danger">Couldn't load employment types. Try reopening this form.</p>
                        ) : employmentTypes.length === 0 ? (
                            <p className="text-nb-caption text-fg-subtle">
                                No employment types configured.{' '}
                                {!canManageEmploymentTypes ? 'Ask an administrator to add them.' : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { markEmploymentTypesPending(); window.open(employmentTypesHref, '_blank', 'noopener'); }}
                                >
                                    Create Employment Type
                                </Button>
                                )}
                            </p>
                        ) : (
                            <p className="text-nb-caption text-fg-subtle" data-testid="derived-person-type">
                                Recorded as {personTypeLabel(personTypeForEmploymentType((formData as any).employment_type))}
                            </p>
                        )}
                    </Stack>
                    {/* DepartmentSelector is a project component (not a DS control); it brings no label of its own. */}
                    <Stack gap="tight">
                        <span className="text-nb-label text-fg-muted">Department</span>
                        <DepartmentSelector
                            value={formData.department_id || ''}
                            onChange={(id) => updateField('department_id', id || undefined)}
                            placeholder="Select department..."
                            allowClear
                        />
                    </Stack>
                    <Stack gap="tight">
                        <Select label="Work Location" name="people-select-64" value={(formData as any).work_location_id || ''} onChange={(e) => updateField('work_location_id', e.target.value || undefined)} options={[{ value: "", label: "Select Work Location" }, ...workLocations.map((loc) => ({ value: loc.id, label: loc.name }))]} />
                        {/* The manage link is unconditional. It used to render only
                            when zero locations existed, so it vanished the moment the
                            first one was created — leaving no route to the management
                            page from here. */}
                        <WorkLocationFieldHelp
                            hasError={workLocationsError}
                            isEmpty={workLocations.length === 0}
                            isDirty={!!(formData.full_name?.trim() || formData.email?.trim() || formData.phone?.trim())}
                            onQuickAdd={() => setView('newLocation')}
                        />
                    </Stack>
                </FormSection>

                {/* Employment details — Advanced */}
                <Section title="Employment Details">
                    <FieldGrid columns={2}>
                        <Stack gap="tight">
                            <Select label="Job Title (Designation)" name="people-select-65" value={formData.job_title || ''} onChange={(e) => updateField('job_title', e.target.value || undefined)} options={[{ value: "", label: "Select Designation" }, ...designations.map((d) => ({ value: d.name, label: d.name }))]} />
                            {designationsError ? (
                                <p className="text-nb-caption text-danger">Couldn't load designations. Try reopening this form.</p>
                            ) : designations.length === 0 ? (
                                <p className="text-nb-caption text-fg-subtle">
                                    No designations configured.{' '}
                                    <Button variant="ghost" size="sm" onClick={() => navigate('/people/settings/designations')}>
                                        Create Designation
                                    </Button>
                                </p>
                            ) : null}
                        </Stack>
                    </FieldGrid>
                </Section>

                {/* Placed directly after Employment Details — the employment type
                    chosen above is what determines the defaults shown here. */}
                <Section title="Leave Configuration">
                    <PersonLeaveConfigSection
                        employmentTypeMasterId={selectedEmploymentType?.id ?? ''}
                        employmentTypeName={selectedEmploymentType?.name}
                        overrides={leaveOverrides}
                        onOverridesChange={setLeaveOverrides}
                        canManageLeave={canManageLeave}
                        canCreateLeaveTypes={canCreateLeaveTypes}
                    />
                </Section>

                {/* Cost — Advanced (defaults: 0 @ hourly in the org currency) */}
                <Section title="Cost & Billing">
                    <FieldGrid columns={4}>
                        <NumberInput
                            name="person-cost-rate"
                            label="Cost Rate *"
                            min={0}
                            step={0.01}
                            value={formData.cost_rate}
                            onChange={(v: number | null) => updateField('cost_rate', v || 0)}
                        />
                        <Select label="Rate Unit" name="people-select-66" value={formData.cost_rate_unit} onChange={(e) => updateField('cost_rate_unit', e.target.value)} options={[{ value: "hour", label: "Per Hour" }, { value: "day", label: "Per Day" }]} />
                        <NumberInput
                            name="person-billing-rate"
                            label="Billing Rate"
                            min={0}
                            step={0.01}
                            value={formData.billing_rate || 0}
                            onChange={(v: number | null) => updateField('billing_rate', v || 0)}
                        />
                        <Select label="Currency" name="people-select-67" value={formData.currency} onChange={(e) => updateField('currency', e.target.value)} options={[...currencies.map((c) => ({ value: c, label: c }))]} />
                    </FieldGrid>
                </Section>

                {/* Availability — Advanced (defaults: 8h × 5d, starting today) */}
                <Section title="Availability">
                    <FieldGrid columns={3}>
                        <NumberInput
                            name="person-hours-per-day"
                            label="Hours/Day"
                            min={1}
                            max={24}
                            value={formData.available_hours_per_day}
                            onChange={(v: number | null) => updateField('available_hours_per_day', v || 8)}
                        />
                        <NumberInput
                            name="person-days-per-week"
                            label="Days/Week"
                            min={1}
                            max={7}
                            value={formData.available_days_per_week}
                            onChange={(v: number | null) => updateField('available_days_per_week', Math.trunc(v ?? 0) || 5)}
                        />
                        <DateInput
                            name="person-start-date"
                            label="Start Date"
                            value={formData.start_date || ''}
                            onChange={(iso: string) => updateField('start_date', iso)}
                        />
                    </FieldGrid>
                </Section>

                {/* Custom Fields */}
                <CustomFieldsSection
                    fields={customFieldDefs.map(d => ({ field_def_id: d.id, label: d.label, field_type: d.field_type, options: d.options, is_required: d.is_required }))}
                    values={customFieldValues}
                    onChange={updateCustomFieldValue}
                    loadError={customFieldsError}
                />

                {/* User Linkage */}
                <FormSection title="User Account Linkage" variant="plain">
                    <RadioGroup
                        name="userLinkage"
                        label="User Account Linkage"
                        value={formData.userLinkageMode ?? 'invite'}
                        onChange={(v: string) => updateField('userLinkageMode', v as 'none' | 'link' | 'invite')}
                        options={[
                            { value: 'none', label: 'Employee Only (No System Access)', description: 'Person will not have access to Neonbee' },
                            { value: 'link', label: 'Link to Existing User', description: 'Select an existing user account to link' },
                            { value: 'invite', label: 'Invite as New User (Recommended)', description: 'Send invitation email to create user account' },
                        ]}
                    />

                    {formData.userLinkageMode === 'link' && (
                        <div data-field="existingUserId" tabIndex={-1}>
                            <UserSelector
                                value={formData.existingUserId}
                                onChange={(userId: string | null) => updateField('existingUserId', userId)}
                                orgId={orgId}
                                tenantId={tenantId}
                                placeholder="Select user..."
                            />
                            {errors.existingUserId && <p role="alert" className="text-nb-caption text-danger">{errors.existingUserId}</p>}
                        </div>
                    )}

                    {formData.userLinkageMode === 'invite' && (
                        <Stack gap="tight">
                            {/* Read-only mirror of the Identity email — the single source of
                                truth for the invitation. It used to be editable with an
                                `inviteEmail || email` fallback, which forked the two values on
                                the first keystroke: the invite went to one address while the
                                person record carried another, and Core's ensurePersonLink (which
                                matches people by email) then created a SECOND, duplicate person
                                for the invitee instead of linking the one just added. */}
                            <TextField
                                name="person-invite-email"
                                label="Email for invitation"
                                data-field="inviteEmail"
                                readOnly
                                aria-readonly="true"
                                value={formData.email || ''}
                                aria-invalid={!!errors.inviteEmail}
                                placeholder="Email for invitation"
                                error={errors.inviteEmail}
                            />
                            {!errors.inviteEmail && (
                                <p className="text-nb-caption text-fg-subtle">
                                    The invitation will be emailed to <span className="text-fg">{formData.email}</span>. To change it, edit the Email field in the Identity section.
                                </p>
                            )}
                            <Select
                                name="person-invite-role"
                                label="Invitation role"
                                data-field="inviteRole"
                                value={formData.inviteRole || ''}
                                onChange={(e) => updateField('inviteRole', e.target.value)}
                                error={errors.inviteRole}
                                options={[{ value: '', label: 'Select role...' }, ...orgRoles.map((role) => ({ value: role.id, label: role.name }))]}
                            />
                            <Checkbox
                                name="person-send-invite-email"
                                label="Send invitation email immediately"
                                checked={formData.sendInviteEmail !== false}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('sendInviteEmail', e.target.checked)}
                            />
                        </Stack>
                    )}
                </FormSection>

                {/* Validation summary — visible wherever the user has scrolled to. */}
                {errorCount > 1 && (
                    <Alert name="create-person-validation-summary" variant="error">
                        {errorCount} fields need attention before this person can be added.
                    </Alert>
                )}
              </Stack>
            </form>
        </Drawer>
    );
};
