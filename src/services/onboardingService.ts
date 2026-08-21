import { api } from './apiClient';

// =============================================================================
// Onboarding Types — mirrors pc-be src/modules/onboarding (B1 contract)
// =============================================================================

export type OnboardingItemType = 'document_upload' | 'e_sign' | 'task' | 'meeting';
export type OnboardingAssigneeRole = 'hr' | 'manager' | 'employee';
export type OnboardingInstanceStatus = 'in_progress' | 'completed' | 'cancelled';
export type OnboardingItemStatus = 'pending' | 'done' | 'waived';

export const ONBOARDING_ITEM_TYPES: OnboardingItemType[] = [
  'task',
  'meeting',
  'document_upload',
  'e_sign',
];

export const ONBOARDING_ASSIGNEE_ROLES: OnboardingAssigneeRole[] = ['hr', 'manager', 'employee'];

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  item_type: OnboardingItemType;
  assignee_role: OnboardingAssigneeRole;
  sort_order: number;
  is_required: boolean;
  due_days_offset: number | null;
  document_type: string | null;
  sign_document_ref: string | null;
}

export interface OnboardingTemplateWithItems extends OnboardingTemplate {
  items: OnboardingTemplateItem[];
}

/** Item shape the template CRUD accepts. PATCH with `items` REPLACES the list. */
export interface TemplateItemPayload {
  title: string;
  description?: string;
  item_type: OnboardingItemType;
  assignee_role: OnboardingAssigneeRole;
  sort_order?: number;
  is_required?: boolean;
  due_days_offset?: number;
  document_type?: string;
  sign_document_ref?: string;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
  items?: TemplateItemPayload[];
}

export type UpdateTemplatePayload = Partial<CreateTemplatePayload>;

export interface OnboardingInstance {
  id: string;
  person_id: string;
  template_id: string;
  status: OnboardingInstanceStatus;
  started_at: string;
  completed_at: string | null;
  /** Enriched on the list endpoint only. */
  person?: {
    id: string;
    full_name: string | null;
    job_title: string | null;
    department_id: string | null;
  } | null;
}

/** Immutable snapshot of a template item on a running instance. */
export interface OnboardingInstanceItem {
  id: string;
  instance_id: string;
  template_item_id: string | null;
  title: string;
  description: string | null;
  item_type: OnboardingItemType;
  assignee_role: OnboardingAssigneeRole;
  sort_order: number;
  is_required: boolean;
  status: OnboardingItemStatus;
  due_date: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  note?: string | null;
}

export interface OnboardingInstanceWithItems extends OnboardingInstance {
  items: OnboardingInstanceItem[];
}

/** Item action result — carries whether this settle closed the instance. */
export type OnboardingItemActionResult = OnboardingInstanceItem & {
  instance_completed: boolean;
};

/**
 * B4 — document_upload completion payload. Metadata-first: the file name is
 * required, the URL optional (where the file already lives). When the
 * DMS-backed person-documents upload lands, the FE uploads the binary there
 * first and passes its URL here — this contract stays unchanged.
 */
export interface UploadItemDocumentPayload {
  file_name: string;
  file_url?: string;
  note?: string;
}

/** `/me/onboarding` — nulls (not 404) when the caller has no open onboarding. */
export interface MyOnboardingResponse {
  instance: OnboardingInstance | null;
  items: OnboardingInstanceItem[];
}

// =============================================================================
// ONBOARDING API — admin/HR surface (onboarding.read / onboarding.manage)
// =============================================================================

export const onboardingApi = {
  // --- Templates -------------------------------------------------------------

  listTemplates: async (): Promise<{ data: OnboardingTemplate[]; total: number }> => {
    return api.get<{ data: OnboardingTemplate[]; total: number }>('/onboarding/templates');
  },

  getTemplate: async (id: string): Promise<OnboardingTemplateWithItems> => {
    return api.get<OnboardingTemplateWithItems>(`/onboarding/templates/${id}`);
  },

  createTemplate: async (data: CreateTemplatePayload): Promise<OnboardingTemplateWithItems> => {
    return api.post<OnboardingTemplateWithItems>('/onboarding/templates', data);
  },

  /** `items`, when present, REPLACES the template's item list (replace-all). */
  updateTemplate: async (
    id: string,
    data: UpdateTemplatePayload,
  ): Promise<OnboardingTemplateWithItems> => {
    return api.patch<OnboardingTemplateWithItems>(`/onboarding/templates/${id}`, data);
  },

  /** Soft-deactivates when instances reference the template, hard-deletes otherwise. */
  deleteTemplate: async (id: string): Promise<{ deleted: boolean; deactivated: boolean }> => {
    return api.delete<{ deleted: boolean; deactivated: boolean }>(`/onboarding/templates/${id}`);
  },

  // --- Instances -------------------------------------------------------------

  /** 409 when the person already has a non-cancelled instance. */
  startOnboarding: async (data: {
    person_id: string;
    template_id?: string;
  }): Promise<OnboardingInstanceWithItems> => {
    return api.post<OnboardingInstanceWithItems>('/onboarding/instances', data);
  },

  listInstances: async (params?: {
    person_id?: string;
    status?: OnboardingInstanceStatus;
  }): Promise<{ data: OnboardingInstance[]; total: number }> => {
    return api.get<{ data: OnboardingInstance[]; total: number }>('/onboarding/instances', params);
  },

  getInstance: async (id: string): Promise<OnboardingInstanceWithItems> => {
    return api.get<OnboardingInstanceWithItems>(`/onboarding/instances/${id}`);
  },

  cancelInstance: async (id: string): Promise<OnboardingInstance> => {
    return api.post<OnboardingInstance>(`/onboarding/instances/${id}/cancel`, {});
  },

  // --- Item actions (manage holder OR the item's resolved assignee) ----------

  completeItem: async (id: string, note?: string): Promise<OnboardingItemActionResult> => {
    return api.post<OnboardingItemActionResult>(
      `/onboarding/items/${id}/complete`,
      note ? { note } : {},
    );
  },

  /** The note is REQUIRED server-side — never call without one. */
  waiveItem: async (id: string, note: string): Promise<OnboardingItemActionResult> => {
    return api.post<OnboardingItemActionResult>(`/onboarding/items/${id}/waive`, { note });
  },

  /**
   * Attach a document to a pending document_upload item on the hire's behalf
   * (onboarding.manage) — files it into the person's cabinet and settles the
   * step. 400 on non-document items and already-settled items.
   */
  uploadItemDocument: async (
    id: string,
    payload: UploadItemDocumentPayload,
  ): Promise<OnboardingItemActionResult> => {
    return api.post<OnboardingItemActionResult>(
      `/onboarding/items/${id}/upload-document`,
      payload,
    );
  },
};

// =============================================================================
// SELF-SERVICE — /me/onboarding (no admin permissions; person from the token)
// =============================================================================

export const myOnboardingApi = {
  get: async (): Promise<MyOnboardingResponse> => {
    return api.get<MyOnboardingResponse>('/me/onboarding');
  },

  /**
   * Only employee-assigned task/meeting items on MY OWN instance — the server
   * returns 400 for e_sign/document_upload (those complete via their flows).
   */
  completeItem: async (id: string, note?: string): Promise<OnboardingItemActionResult> => {
    return api.post<OnboardingItemActionResult>(
      `/me/onboarding/items/${id}/complete`,
      note ? { note } : {},
    );
  },

  /**
   * Attach a document to one of MY document_upload steps — the legitimate
   * completion path for a type the plain complete route rejects (400).
   * Only employee-assigned items on my own instance (403 otherwise).
   */
  uploadItemDocument: async (
    id: string,
    payload: UploadItemDocumentPayload,
  ): Promise<OnboardingItemActionResult> => {
    return api.post<OnboardingItemActionResult>(
      `/me/onboarding/items/${id}/upload-document`,
      payload,
    );
  },
};
