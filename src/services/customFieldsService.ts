import { api } from './apiClient';

export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'date' | 'checkbox' | 'multi_select';

// Field types whose values are drawn from a fixed choice list — mirrors
// CHOICE_FIELD_TYPES in so360-people-connect-be custom-fields.dto.ts.
export const CHOICE_FIELD_TYPES: CustomFieldType[] = ['dropdown', 'multi_select'];

export interface CustomFieldDef {
  id: string;
  org_id: string;
  tenant_id: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomFieldDefPayload {
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options?: string[];
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

// One row per active field def, merged with the person's stored value
// (null when never set) — exactly what the Person form renders from.
export interface PersonCustomFieldValue {
  field_def_id: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  value: unknown;
}

export interface SetCustomFieldValueEntry {
  field_def_id: string;
  value: unknown;
}

export const customFieldDefsApi = {
  getAll: async (opts?: { includeInactive?: boolean }): Promise<{ data: CustomFieldDef[] }> => {
    const suffix = opts?.includeInactive ? '?includeInactive=true' : '';
    return api.get<{ data: CustomFieldDef[] }>(`/custom-field-defs${suffix}`);
  },

  create: async (data: CreateCustomFieldDefPayload): Promise<CustomFieldDef> => {
    return api.post<CustomFieldDef>('/custom-field-defs', data);
  },

  update: async (id: string, data: Partial<CreateCustomFieldDefPayload>): Promise<CustomFieldDef> => {
    return api.patch<CustomFieldDef>(`/custom-field-defs/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/custom-field-defs/${id}`);
  },
};

export const personCustomFieldsApi = {
  getForPerson: async (personId: string): Promise<{ data: PersonCustomFieldValue[] }> => {
    return api.get<{ data: PersonCustomFieldValue[] }>(`/people/${personId}/custom-fields`);
  },

  setForPerson: async (
    personId: string,
    values: SetCustomFieldValueEntry[],
  ): Promise<{ data: unknown[] }> => {
    return api.put<{ data: unknown[] }>(`/people/${personId}/custom-fields`, { values });
  },
};
