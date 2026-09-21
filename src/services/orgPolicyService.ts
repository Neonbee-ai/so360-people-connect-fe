import { api } from './apiClient';

export interface ApprovalChain {
  id: string;
  person_id: string;
  person_name: string;
  approver_person_id: string;
  approver_name: string;
  module_scope: string;
}

export interface EmploymentPolicy {
  id?: string;
  daily_threshold: number;
  weekly_threshold: number;
  premium_multiplier: number;
}

export interface CreateApprovalChainPayload {
  person_id: string;
  person_name: string;
  approver_person_id: string;
  approver_name: string;
  module_scope?: string;
}

export const orgPolicyApi = {
  getApprovalChains: (): Promise<ApprovalChain[]> =>
    api.get<ApprovalChain[]>('/org-policy/approval-chains'),

  createApprovalChain: (payload: CreateApprovalChainPayload): Promise<ApprovalChain> =>
    api.post<ApprovalChain>('/org-policy/approval-chains', payload),

  deleteApprovalChain: (personId: string): Promise<{ success: boolean }> =>
    api.delete<{ success: boolean }>(`/org-policy/approval-chains/${personId}`),

  getEmploymentPolicy: (): Promise<EmploymentPolicy> =>
    api.get<EmploymentPolicy>('/org-policy/employment-policy'),

  updateEmploymentPolicy: (dto: Partial<EmploymentPolicy>): Promise<EmploymentPolicy> =>
    api.patch<EmploymentPolicy>('/org-policy/employment-policy', dto),
};
