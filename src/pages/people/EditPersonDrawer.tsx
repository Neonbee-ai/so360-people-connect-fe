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
import { toast, Drawer, Select, TextField, NumberInput, DateInput, Button, Badge, Stack, Cluster, FieldGrid, FieldGridItem, FormSection } from '@so360/design-system';
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
// Edit Person Modal
// =============================================================================

export interface EditPersonModalProps {
    person: Person | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, data: Partial<Person>) => void;
    currencies?: string[];
    busy?: boolean;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({ person, isOpen, onClose, onSave, currencies = DEFAULT_CURRENCIES, busy }) => {
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
        // `type` is only sent when the user changed the Employment Type and it
        // implies a different type. An unrelated edit (e.g. the phone) must not
        // rewrite a stored type — it drives the party:contractor/party:employee
        // role — and a consultant must not be converted to a contractor.
        const nextType = typeToSendOnEdit(person.employment_type, payload.employment_type, person.type);
        if (nextType) payload.type = nextType;
        else delete payload.type;
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

    // Quick-add work location replaces the drawer content (never a stacked
    // surface); the form stays mounted so nothing being edited is lost.
    const [editView, setEditView] = useState<'form' | 'newLocation'>('form');
    useEffect(() => { if (isOpen) setEditView('form'); }, [isOpen]);

    const handleEditLocationCreated = (loc: WorkLocation) => {
        setWorkLocations(prev => [...prev, loc].sort((a, b) => a.name.localeCompare(b.name)));
        updateField('work_location_id', loc.id);
        setEditView('form');
    };

    if (!person) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={editView === 'form' ? `Edit ${person.full_name}` : 'New Work Location'}
            size="lg"
            onBack={editView === 'newLocation' ? () => setEditView('form') : undefined}
            footer={
                editView === 'form' ? (
                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
                        <Button
                            type="submit"
                            form="edit-person-form"
                            loading={busy}
                            disabled={busy || !isFormValid}
                            title={isFormValid ? undefined : 'Fix the highlighted fields before saving.'}
                        >
                            Save Changes
                        </Button>
                    </Cluster>
                ) : (
                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={() => setEditView('form')}>Back</Button>
                        <Button type="submit" form="quick-add-location-form">Add Location</Button>
                    </Cluster>
                )
            }
        >
            {editView === 'newLocation' && <QuickAddLocationPanel onCreated={handleEditLocationCreated} />}
            <form ref={formRef} id="edit-person-form" onSubmit={handleSubmit} noValidate className={editView === 'newLocation' ? 'hidden' : undefined}>
              <Stack gap="region">
                <FormSection title="Identity" variant="plain" columns={2}>
                    <FieldGridItem span="full">
                        <TextField
                            name="edit-person-full-name"
                            label="Full Name *"
                            data-field="full_name"
                            value={formData.full_name || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('full_name', e.target.value)}
                            aria-invalid={!!errors.full_name}
                            error={errors.full_name}
                        />
                    </FieldGridItem>
                    <TextField
                        name="edit-person-email"
                        label="Email"
                        data-field="email"
                        value={formData.email || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('email', e.target.value)}
                        aria-invalid={!!errors.email}
                        error={errors.email}
                    />
                    <TextField
                        name="edit-person-phone"
                        label="Phone"
                        data-field="phone"
                        inputMode="tel"
                        value={formData.phone || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('phone', sanitizePhoneInput(e.target.value))}
                        maxLength={20}
                        aria-invalid={!!errors.phone}
                        error={errors.phone}
                    />
                    <TextField
                        name="edit-person-employee-id"
                        label="Employee ID"
                        value={formData.employee_id || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('employee_id', e.target.value)}
                    />
                </FormSection>

                <FormSection title="Classification" variant="plain" columns={3}>
                    <Stack gap="tight">
                        <Select label="Employment Type" name="edit-employment-type" id="edit-employment-type" value={formData.employment_type || ''} onChange={(e) => updateField('employment_type', e.target.value || undefined)} options={[{ value: "", label: "Not set" }, ...employmentTypes.map((et) => ({ value: et.code, label: et.name }))]} />
                        {employmentTypesError ? (
                            <p className="text-nb-caption text-danger">Couldn't load employment types. Try reopening this form.</p>
                        ) : employmentTypes.length === 0 ? (
                            <p className="text-nb-caption text-fg-subtle">
                                No employment types configured.{' '}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { markEmploymentTypesPending(); window.open(employmentTypesHref, '_blank', 'noopener'); }}
                                >
                                    Create Employment Type
                                </Button>
                            </p>
                        ) : (
                            <p className="text-nb-caption text-fg-subtle" data-testid="derived-person-type">
                                Recorded as {personTypeLabel(person ? (typeToSendOnEdit(person.employment_type, formData.employment_type, person.type) ?? person.type) : personTypeForEmploymentType(formData.employment_type))}
                            </p>
                        )}
                        {person && typeToSendOnEdit(person.employment_type, formData.employment_type, person.type) && (
                            <p role="status" className="text-nb-caption text-warning" data-testid="person-type-change-notice">
                                Saving will change this person's type from {personTypeLabel(person.type)} to {personTypeLabel(typeToSendOnEdit(person.employment_type, formData.employment_type, person.type)!)}.
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
                        <Select label="Job Title (Designation)" name="people-select-70" value={formData.job_title || ''} onChange={(e) => updateField('job_title', e.target.value || undefined)} options={[{ value: "", label: "Select Designation" }, ...designations.map((d) => ({ value: d.name, label: d.name }))]} />
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
                    <Stack gap="tight">
                        {/* The dropdown only lists active locations, so an existing
                            assignment to a since-deactivated location would silently
                            reset to blank on the next save. Keep it selectable for
                            the person who already has it, flagged as inactive. */}
                        <Select
                            label="Work Location"
                            name="edit-work-location"
                            value={formData.work_location_id || ''}
                            onChange={(e) => updateField('work_location_id', e.target.value || undefined)}
                            options={[
                                { value: '', label: 'Select Work Location' },
                                ...(formData.work_location_id && !workLocations.some(loc => loc.id === formData.work_location_id)
                                    ? [{
                                        value: formData.work_location_id,
                                        label: (person as any)?.work_location?.name
                                            ? `${(person as any).work_location.name} (inactive)`
                                            : 'Current location (inactive)',
                                    }]
                                    : []),
                                ...workLocations.map((loc) => ({ value: loc.id, label: loc.name })),
                            ]}
                        />
                        {/* Edit form is prefilled, so a cheap dirty check can't
                            tell edits from initial values — always guard the exit. */}
                        <WorkLocationFieldHelp
                            hasError={workLocationsError}
                            isEmpty={workLocations.length === 0}
                            isDirty
                            onQuickAdd={() => setEditView('newLocation')}
                        />
                    </Stack>
                    <DateInput
                        name="edit-joining-date"
                        label="Joining Date"
                        value={formData.start_date ? formData.start_date.slice(0, 10) : ''}
                        onChange={(iso: string) => updateField('start_date', iso)}
                    />
                </FormSection>

                <FormSection title="Cost & Billing" variant="plain" columns={4}>
                    <NumberInput
                        name="edit-cost-rate"
                        label="Cost Rate"
                        min={0}
                        step={0.01}
                        value={formData.cost_rate ?? 0}
                        onChange={(v: number | null) => updateField('cost_rate', v || 0)}
                    />
                    <Select label="Rate Unit" name="people-select-72" value={formData.cost_rate_unit || 'hour'} onChange={(e) => updateField('cost_rate_unit', e.target.value)} options={[{ value: "hour", label: "Per Hour" }, { value: "day", label: "Per Day" }]} />
                    <NumberInput
                        name="edit-billing-rate"
                        label="Billing Rate"
                        min={0}
                        step={0.01}
                        value={formData.billing_rate ?? 0}
                        onChange={(v: number | null) => updateField('billing_rate', v || 0)}
                    />
                    <Select label="Currency" name="people-select-73" value={formData.currency || currencies[0]} onChange={(e) => updateField('currency', e.target.value)} options={[...currencies.map((c) => ({ value: c, label: c }))]} />
                    <NumberInput
                        name="edit-hours-per-day"
                        label="Hours/Day"
                        min={1}
                        max={24}
                        value={formData.available_hours_per_day ?? 8}
                        onChange={(v: number | null) => updateField('available_hours_per_day', v || 8)}
                    />
                </FormSection>

                {/* Timesheet costing defaults — progressive disclosure. Collapsed
                    when complete so the rate fields above stay the focus; the count
                    badge means it is never hidden AND forgotten. */}
                <Stack gap="tight">
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCosting((v) => !v)}
                            aria-expanded={showCosting}
                        >
                            {showCosting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            Timesheet &amp; costing defaults
                            {missingCostingCount > 0 && (
                                <Badge tone="warning">{missingCostingCount} missing</Badge>
                            )}
                        </Button>
                    </div>

                    {showCosting && (
                        <FieldGrid columns={3}>
                            <Stack gap="tight">
                                <Select label="Default Labor Category" name="people-select-74" value={formData.default_labor_category_id || ''} onChange={(e) => updateField('default_labor_category_id', e.target.value || null)} options={[{ value: "", label: "Not set" }, ...laborCategories.map((c) => ({ value: c.id, label: `${c.name}${c.rate_configured ? '' : ' (no rate)'}` }))]} />
                                {laborCategories.length === 0 && (
                                    <p className="text-nb-caption text-fg-subtle">
                                        No labor categories configured. The employee&apos;s own cost rate will be used.
                                    </p>
                                )}
                            </Stack>

                            <Select label="Billing Type" name="people-select-75" value={formData.billing_type || ''} onChange={(e) => updateField('billing_type', e.target.value || null)} options={[{ value: "", label: "Not set" }, { value: "billable", label: "Billable" }, { value: "non_billable", label: "Non-billable" }, { value: "internal", label: "Internal" }]} />

                            {/* Read-only: cost centres are owned by Accounting and inherited
                                via the employee's department. Editing them here would fork
                                the org's chart of cost centres. */}
                            <Stack gap="tight">
                                <span className="text-nb-label text-fg-muted">Cost Center</span>
                                <p className="text-nb-body text-fg-muted">
                                    {resolvedCostCenter || 'Inherited from department — not set'}
                                </p>
                                <p className="text-nb-caption text-fg-subtle">
                                    Set on the department, not the employee.
                                </p>
                            </Stack>
                        </FieldGrid>
                    )}
                </Stack>

                {/* Custom Fields */}
                <CustomFieldsSection
                    fields={customFields.map(f => ({ field_def_id: f.field_def_id, label: f.label, field_type: f.field_type, options: f.options, is_required: f.is_required }))}
                    values={customFieldValues}
                    onChange={updateCustomFieldValue}
                    loadError={customFieldsError}
                />

                <p className="text-nb-caption text-fg-subtle">
                    Role &amp; System Permissions are managed from the employee's detail page.
                </p>
              </Stack>
            </form>
        </Drawer>
    );
};
