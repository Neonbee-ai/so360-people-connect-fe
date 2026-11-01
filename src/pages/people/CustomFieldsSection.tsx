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
import { Select, TextField, NumberInput, DateInput, Checkbox, Button, Cluster, FieldGrid } from '@so360/design-system';
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

// =============================================================================
// Custom Fields Section — renders one input per active custom field
// definition (org-defined via Settings > Employee Custom Fields). Shared by
// both the Create and Edit Person modals so the field-type -> input mapping
// lives in exactly one place.
// =============================================================================

export interface RenderableCustomField {
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

export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ fields, values, onChange, loadError }) => {
    if (loadError) {
        return (
            <div>
                <h4 className="text-nb-caption font-semibold text-fg-muted mb-nb-3">Custom Fields</h4>
                <p className="text-nb-caption text-danger">Couldn't load custom fields. Try reopening this form.</p>
            </div>
        );
    }

    if (fields.length === 0) return null;

    return (
        <div data-testid="custom-fields-section">
            <h4 className="text-nb-caption font-semibold text-fg-muted mb-nb-3">Custom Fields</h4>
            <FieldGrid columns={2}>
                {fields.map(field => {
                    const value = values[field.field_def_id];
                    const name = `custom-field-${field.field_def_id}-input`;
                    return (
                        <div key={field.field_def_id} data-testid={`custom-field-${field.field_def_id}`}>
                            {field.field_type === 'text' && (
                                <TextField
                                    name={name}
                                    label={field.label}
                                    type="text"
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value)}
                                />
                            )}
                            {field.field_type === 'number' && (
                                <NumberInput
                                    name={name}
                                    label={field.label}
                                    value={value === undefined || value === null ? null : (value as number)}
                                    required={!!field.is_required}
                                    onChange={n => onChange(field.field_def_id, n)}
                                />
                            )}
                            {field.field_type === 'date' && (
                                <DateInput
                                    name={name}
                                    label={field.label}
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={iso => onChange(field.field_def_id, iso)}
                                />
                            )}
                            {field.field_type === 'checkbox' && (
                                <>
                                    <span className="block text-nb-caption text-fg-muted mb-nb-1">{field.label}{field.is_required && <span className="text-danger"> *</span>}</span>
                                    <Checkbox
                                        name={name}
                                        label="Yes"
                                        checked={!!value}
                                        onChange={e => onChange(field.field_def_id, e.target.checked)}
                                    />
                                </>
                            )}
                            {field.field_type === 'dropdown' && (
                                <Select
                                    name={name}
                                    label={field.label}
                                    value={(value as string) || ''}
                                    required={!!field.is_required}
                                    onChange={e => onChange(field.field_def_id, e.target.value || undefined)}
                                    placeholder={`Select ${field.label}`}
                                    options={(field.options || []).map(opt => ({ value: opt, label: opt }))}
                                />
                            )}
                            {field.field_type === 'multi_select' && (
                                <>
                                    <span className="block text-nb-caption text-fg-muted mb-nb-1">{field.label}{field.is_required && <span className="text-danger"> *</span>}</span>
                                    <Cluster gap="tight">
                                        {(field.options || []).map(opt => {
                                            const selected = Array.isArray(value) && (value as string[]).includes(opt);
                                            return (
                                                <Button
                                                    key={opt}
                                                    type="button"
                                                    size="sm"
                                                    variant={selected ? 'primary' : 'secondary'}
                                                    aria-pressed={selected}
                                                    onClick={() => {
                                                        const current: string[] = Array.isArray(value) ? [...(value as string[])] : [];
                                                        const next = current.includes(opt)
                                                            ? current.filter(v => v !== opt)
                                                            : [...current, opt];
                                                        onChange(field.field_def_id, next);
                                                    }}
                                                >
                                                    {opt}
                                                </Button>
                                            );
                                        })}
                                        {(field.options || []).length === 0 && (
                                            <span className="text-nb-caption text-fg-subtle">No options configured for this field.</span>
                                        )}
                                    </Cluster>
                                </>
                            )}
                        </div>
                    );
                })}
            </FieldGrid>
        </div>
    );
};

export default CustomFieldsSection;
