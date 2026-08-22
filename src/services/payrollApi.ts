// =============================================================================
// Payroll API layer — every route from the payroll implementation plan §7.
// All paths are /payroll/* relative to the shared people-connect ApiClient
// (whose base URL already carries the /v1 prefix, same as every sibling
// service). No payroll math happens in the frontend — this layer only moves
// server-computed values.
// =============================================================================

import { api, apiContext } from './apiClient';

// =============================================================================
// Types (snake_case — mirror plan §5 field names)
// =============================================================================

export interface PaginatedList<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}

// ---- Config layer -----------------------------------------------------------

export type PayFrequency = 'monthly' | 'semi_monthly' | 'bi_weekly' | 'weekly';
export type WorkingDaysBasis = 'calendar_days' | 'working_days' | 'fixed_30';
export type LopCalculation = 'per_day_gross' | 'per_day_basic' | 'custom_component';

export interface PayDayRule {
  type: 'fixed_day' | 'last_working_day';
  day?: number;
}

export interface PayrollSettings {
  id?: string;
  pay_frequency: PayFrequency;
  pay_day_rule: PayDayRule;
  working_days_basis: WorkingDaysBasis;
  lop_calculation: LopCalculation;
  payslip_number_format?: string;
  default_payroll_group_id?: string | null;
  attendance_cutoff_day?: number | null;
  /** Read-only echo from Core business_settings — never stored here. */
  currency?: string;
}

export interface PayrollGroup {
  id: string;
  name: string;
  code: string;
  description?: string;
  pay_day_rule?: PayDayRule | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PayrollPeriodStatus = 'upcoming' | 'open' | 'processing' | 'closed';

export interface PayrollPeriod {
  id: string;
  payroll_group_id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: PayrollPeriodStatus;
}

/**
 * Generation is idempotent server-side: a month that already has a period is
 * skipped, never overwritten. `created` and `skipped` are what actually
 * happened — do not report the requested count back to the user instead.
 */
export interface GeneratePeriodsResult {
  data: PayrollPeriod[];
  created: number;
  skipped: number;
}

/**
 * Narrows any ISO-ish calendar date to the YYYY-MM the generate DTO demands.
 *
 * The date picker hands back a full day ('2026-08-22'); posting that verbatim
 * failed validation with "from_month must be YYYY-MM". Slicing is deliberate
 * over `new Date(...)`: parsing would reinterpret the value in the local
 * timezone and can roll a 1st-of-month back into the previous month.
 * Returns '' for anything that is not a parseable date, so the caller can
 * refuse to send rather than post a malformed payload.
 */
export function toFromMonth(value: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec((value ?? '').trim());
  return match ? `${match[1]}-${match[2]}` : '';
}

export type ComponentKind = 'earning' | 'deduction' | 'employer_contribution' | 'benefit';
export type CalcType = 'fixed' | 'percent_of' | 'formula' | 'slab';
export type ComponentFrequency = 'per_period' | 'annual_spread' | 'one_time' | 'per_day' | 'per_hour';

export interface SlabRow {
  upto: number | null;
  rate?: number;
  amount?: number;
}

export interface CalcConfig {
  amount?: number;
  percent?: number;
  of?: string;
  expr?: string;
  basis?: string;
  slabs?: SlabRow[];
}

export interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  description?: string;
  kind: ComponentKind;
  calc_type: CalcType;
  calc_config: CalcConfig;
  frequency: ComponentFrequency;
  taxable: boolean;
  is_statutory: boolean;
  statutory_code?: string | null;
  prorate_on_lop: boolean;
  rounding?: { mode: 'nearest' | 'floor' | 'ceil'; precision: number } | null;
  display_order?: number;
  is_active: boolean;
}

export type SalaryComponentPayload = Omit<SalaryComponent, 'id'>;

export type StructureStatus = 'draft' | 'active' | 'archived';

export interface SalaryStructureLine {
  id?: string;
  structure_id?: string;
  component_id: string;
  component_code?: string;
  component_name?: string;
  kind?: ComponentKind;
  calc_override?: CalcConfig | null;
  is_optional?: boolean;
  display_order: number;
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: StructureStatus;
  version: number;
  lines?: SalaryStructureLine[];
  assignment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StructureValidationResult {
  valid: boolean;
  errors: string[];
  /** Component codes in evaluation order (topological sort result). */
  order?: string[];
  /** Optional server dry-run preview lines for the sample wage. */
  preview?: { component_code: string; component_name?: string; kind: ComponentKind; amount?: number }[];
}

export interface StatutoryIdentifierDef {
  key: string;
  label: string;
  required_for_payroll: boolean;
  pattern?: string;
  masked?: boolean;
}

export interface StatutoryConfig {
  pack: string;
  enabled: boolean;
  config: {
    pf?: { enabled: boolean; wage_ceiling?: number; employee_rate?: number; employer_rate?: number; eps_rate?: number; restrict_to_ceiling?: boolean };
    esi?: { enabled: boolean; wage_ceiling?: number; employee_rate?: number; employer_rate?: number };
    pt?: { enabled: boolean; state?: string | null; slabs?: SlabRow[] };
    lwf?: { enabled: boolean; state?: string | null; employee_amount?: number; employer_amount?: number; frequency?: string };
    tds?: { enabled: boolean; default_regime?: 'new' | 'old'; slabs_fy?: string; standard_deduction?: number };
    gratuity?: { enabled: boolean; rate_days?: number };
    identifiers?: StatutoryIdentifierDef[];
  };
}

export interface BenefitType {
  id: string;
  name: string;
  description?: string;
  default_amount?: number;
  taxable: boolean;
  payer: 'employer' | 'employee' | 'shared';
  frequency: string;
  is_active: boolean;
}

// ---- Employee layer ---------------------------------------------------------

export interface EmployeePayrollProfile {
  id?: string;
  person_id: string;
  payroll_group_id?: string | null;
  pay_category?: string;
  wage_type: 'salaried' | 'hourly' | 'daily';
  is_payroll_enabled: boolean;
  exclusion_reason?: string | null;
  statutory_identifiers?: Record<string, string>;
  tax_regime: 'new' | 'old';
  contract?: {
    type?: 'permanent' | 'fixed_term';
    start?: string;
    end?: string | null;
    working_hours?: number;
    working_days?: number;
  };
}

export type RevisionType = 'initial' | 'increment' | 'decrement' | 'structure_change' | 'adjustment';

export interface SalaryAssignment {
  id: string;
  person_id: string;
  structure_id: string;
  structure_version: number;
  structure_name?: string;
  annual_ctc?: number;
  monthly_wage: number;
  component_values?: Record<string, number>;
  effective_from: string;
  effective_to?: string | null;
  revision_reason?: string;
  revision_type: RevisionType;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
}

export interface SalaryRevisionPayload {
  structure_id: string;
  monthly_wage: number;
  annual_ctc?: number;
  component_values?: Record<string, number>;
  effective_from: string;
  revision_reason: string;
  revision_type: RevisionType;
}

export interface ComponentOverride {
  id: string;
  person_id: string;
  component_id: string;
  component_code?: string;
  component_name?: string;
  action: 'add' | 'remove' | 'override';
  calc_override?: CalcConfig | null;
  effective_from: string;
  effective_to?: string | null;
  recurrence: 'recurring' | 'one_time';
  one_time_period_id?: string | null;
  reason?: string;
}

export interface EmployeeBenefit {
  id: string;
  person_id: string;
  benefit_type_id: string;
  benefit_type_name?: string;
  amount_override?: number | null;
  effective_from: string;
  effective_to?: string | null;
  recurrence?: 'recurring' | 'one_time';
  notes?: string;
}

export interface BankAccount {
  id: string;
  person_id: string;
  bank_name: string;
  account_holder: string;
  /** Lists only ever return the last-4 digits — never the full number. */
  account_number_last4: string;
  ifsc?: string;
  branch?: string;
  account_type: 'savings' | 'current';
  payment_method: 'bank_transfer' | 'cheque' | 'cash' | 'upi';
  is_primary: boolean;
  effective_from?: string;
  verified_at?: string | null;
}

export interface BankAccountPayload {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc?: string;
  branch?: string;
  account_type: 'savings' | 'current';
  payment_method: 'bank_transfer' | 'cheque' | 'cash' | 'upi';
  is_primary?: boolean;
}

export type DeclarationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'reopened';

export interface TaxDeclarationItem {
  id?: string;
  declaration_id?: string;
  category: string;
  description?: string;
  declared_amount: number;
  approved_amount?: number | null;
  proof_document_id?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface TaxDeclaration {
  id: string;
  person_id: string;
  person_name?: string;
  fiscal_year: string;
  regime: 'new' | 'old';
  status: DeclarationStatus;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  items?: TaxDeclarationItem[];
  total_declared?: number;
  total_approved?: number;
}

export interface PreviousEmployment {
  id: string;
  person_id: string;
  fiscal_year: string;
  employer_name: string;
  period_from?: string;
  period_to?: string;
  taxable_income?: number;
  tax_deducted?: number;
  pf_deducted?: number;
  proof_document_id?: string | null;
  notes?: string;
}

export interface PayrollHistoryEvent {
  id: string;
  event_type: string;
  description?: string;
  actor_name?: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

// ---- Processing layer -------------------------------------------------------

export type RunStatus =
  | 'draft' | 'calculating' | 'review' | 'pending_approval'
  | 'approved' | 'paying' | 'paid' | 'closed' | 'cancelled';

export interface PayrollRun {
  id: string;
  payroll_group_id: string;
  payroll_group_name?: string;
  payroll_period_id: string;
  period_start?: string;
  period_end?: string;
  run_number: string | number;
  pay_date: string;
  status: RunStatus;
  employee_count?: number;
  gross_total?: number;
  deduction_total?: number;
  employer_contribution_total?: number;
  net_total?: number;
  employer_cost_total?: number;
  calculated_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  closed_at?: string | null;
  journal_entry_id?: string | null;
  posting_status?: 'not_posted' | 'posted' | 'failed';
  payslips_generated?: boolean;
  pending_approval_count?: number;
  notes?: string;
}

export interface PayrollRunEmployee {
  id: string;
  run_id: string;
  person_id: string;
  person_name: string;
  employee_code?: string;
  department_name?: string;
  designation?: string;
  input_snapshot?: {
    days_in_period?: number;
    payable_days?: number;
    lop_days?: number;
    ot_hours?: number;
  };
  gross?: number;
  total_deductions?: number;
  total_employer_contributions?: number;
  net_pay?: number;
  employer_cost?: number;
  previous_net_pay?: number | null;
  status: 'pending' | 'calculated' | 'excluded' | 'error';
  exclusion_reason?: string | null;
  error_detail?: string | null;
}

export interface PayrollRunLine {
  id: string;
  run_employee_id: string;
  component_id?: string;
  component_code: string;
  component_name: string;
  kind: ComponentKind;
  amount: number;
  calc_trace?: Record<string, unknown>;
}

export interface Payslip {
  id: string;
  run_employee_id?: string;
  person_id: string;
  person_name?: string;
  payslip_number: string;
  period_start: string;
  period_end: string;
  pay_date?: string;
  gross: number;
  total_deductions: number;
  net_pay: number;
  currency?: string;
  pdf_document_id?: string | null;
  generated_at?: string;
  visibility?: 'published' | 'held';
  lines?: PayrollRunLine[];
}

export type PayslipLayout = 'light' | 'bubble' | 'wave' | 'folder' | 'center' | 'dual' | 'lines';
export type PayslipTableStyle = 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'column';

export interface PayslipTemplate {
  id?: string;
  layout: PayslipLayout;
  table_style: PayslipTableStyle;
  font?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  address?: string;
  tagline?: string;
  footer_text?: string;
  paper_format?: 'A4' | 'Letter';
}

// ---- Dashboard / alerts / reports ------------------------------------------

export interface PayrollDashboard {
  current_run?: PayrollRun | null;
  current_period?: PayrollPeriod | null;
  employees_included?: number;
  employees_excluded?: number;
  pending_approvals?: number;
  alerts?: PayrollAlert[];
}

export interface PayrollAlert {
  key: string;
  label: string;
  description?: string;
  count: number;
  severity?: 'blocking' | 'warning' | 'info';
}

export interface AlertEmployee {
  person_id: string;
  person_name: string;
  employee_code?: string;
  department_name?: string;
  detail?: string;
}

export interface ReportResult {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
}

export interface ReportParams {
  from?: string;
  to?: string;
  period_id?: string;
  group_id?: string;
  department_id?: string;
  person_id?: string;
  [key: string]: unknown;
}

// =============================================================================
// CSV download helper — the shared client always JSON-parses, so exports go
// through a raw fetch that still carries the tenant/org/auth headers.
// =============================================================================

async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${apiContext.getBaseUrl()}${path}`, {
    headers: api.getHeadersRaw(),
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// =============================================================================
// API surface
// =============================================================================

export const payrollApi = {
  // ---- Settings -------------------------------------------------------------
  settings: {
    get: () => api.get<PayrollSettings>('/payroll/settings'),
    update: (data: Partial<PayrollSettings>) => api.put<PayrollSettings>('/payroll/settings', data),
  },

  // ---- Groups & periods -----------------------------------------------------
  groups: {
    list: (params?: { is_active?: boolean }) => api.get<PaginatedList<PayrollGroup>>('/payroll/groups', params),
    create: (data: Partial<PayrollGroup>) => api.post<PayrollGroup>('/payroll/groups', data),
    update: (id: string, data: Partial<PayrollGroup>) => api.patch<PayrollGroup>(`/payroll/groups/${id}`, data),
    remove: (id: string) => api.delete<{ message: string }>(`/payroll/groups/${id}`),
  },
  periods: {
    list: (params?: { group_id?: string; status?: PayrollPeriodStatus; year?: number }) =>
      api.get<PaginatedList<PayrollPeriod>>('/payroll/periods', params),
    // `from_month` is strictly YYYY-MM — the backend DTO rejects a full date.
    // Callers holding a calendar date must narrow it with toFromMonth().
    generate: (data: { payroll_group_id: string; from_month: string; count: number }) =>
      api.post<GeneratePeriodsResult>('/payroll/periods/generate', data),
  },

  // ---- Statutory ------------------------------------------------------------
  statutory: {
    get: () => api.get<StatutoryConfig>('/payroll/statutory'),
    update: (data: Partial<StatutoryConfig>) => api.put<StatutoryConfig>('/payroll/statutory', data),
  },

  // ---- Benefit types --------------------------------------------------------
  benefitTypes: {
    list: () => api.get<PaginatedList<BenefitType>>('/payroll/benefit-types'),
    create: (data: Partial<BenefitType>) => api.post<BenefitType>('/payroll/benefit-types', data),
    update: (id: string, data: Partial<BenefitType>) => api.patch<BenefitType>(`/payroll/benefit-types/${id}`, data),
    remove: (id: string) => api.delete<{ message: string }>(`/payroll/benefit-types/${id}`),
  },

  // ---- Components -----------------------------------------------------------
  components: {
    list: (params?: { kind?: ComponentKind; is_active?: boolean }) =>
      api.get<PaginatedList<SalaryComponent>>('/payroll/components', params),
    create: (data: Partial<SalaryComponentPayload>) => api.post<SalaryComponent>('/payroll/components', data),
    update: (id: string, data: Partial<SalaryComponentPayload>) =>
      api.patch<SalaryComponent>(`/payroll/components/${id}`, data),
    remove: (id: string) => api.delete<{ message: string }>(`/payroll/components/${id}`),
  },

  // ---- Structures -----------------------------------------------------------
  structures: {
    list: (params?: { status?: StructureStatus }) => api.get<PaginatedList<SalaryStructure>>('/payroll/structures', params),
    get: (id: string) => api.get<SalaryStructure>(`/payroll/structures/${id}`),
    create: (data: Partial<SalaryStructure>) => api.post<SalaryStructure>('/payroll/structures', data),
    update: (id: string, data: Partial<SalaryStructure>) => api.patch<SalaryStructure>(`/payroll/structures/${id}`, data),
    remove: (id: string) => api.delete<{ message: string }>(`/payroll/structures/${id}`),
    saveLines: (id: string, lines: SalaryStructureLine[]) =>
      api.put<SalaryStructure>(`/payroll/structures/${id}/lines`, { lines }),
    validate: (id: string, sample?: { monthly_wage?: number }) =>
      api.post<StructureValidationResult>(`/payroll/structures/${id}/validate`, sample ?? {}),
    clone: (id: string, data?: { name?: string; code?: string }) =>
      api.post<SalaryStructure>(`/payroll/structures/${id}/clone`, data ?? {}),
    newVersion: (id: string) => api.post<SalaryStructure>(`/payroll/structures/${id}/new-version`, {}),
  },

  // ---- Employees ------------------------------------------------------------
  employees: {
    list: (params?: { search?: string; group_id?: string; is_payroll_enabled?: boolean; page?: number; limit?: number }) =>
      api.get<PaginatedList<EmployeePayrollProfile & { person_name?: string; employee_code?: string }>>('/payroll/employees', params),
    getProfile: (personId: string) => api.get<EmployeePayrollProfile>(`/payroll/employees/${personId}/profile`),
    updateProfile: (personId: string, data: Partial<EmployeePayrollProfile>) =>
      api.put<EmployeePayrollProfile>(`/payroll/employees/${personId}/profile`, data),
    salary: {
      list: (personId: string) => api.get<PaginatedList<SalaryAssignment>>(`/payroll/employees/${personId}/salary`),
      revise: (personId: string, data: SalaryRevisionPayload) =>
        api.post<SalaryAssignment>(`/payroll/employees/${personId}/salary`, data),
    },
    overrides: {
      list: (personId: string) => api.get<PaginatedList<ComponentOverride>>(`/payroll/employees/${personId}/overrides`),
      create: (personId: string, data: Partial<ComponentOverride>) =>
        api.post<ComponentOverride>(`/payroll/employees/${personId}/overrides`, data),
      update: (personId: string, id: string, data: Partial<ComponentOverride>) =>
        api.patch<ComponentOverride>(`/payroll/employees/${personId}/overrides/${id}`, data),
      remove: (personId: string, id: string) =>
        api.delete<{ message: string }>(`/payroll/employees/${personId}/overrides/${id}`),
    },
    benefits: {
      list: (personId: string) => api.get<PaginatedList<EmployeeBenefit>>(`/payroll/employees/${personId}/benefits`),
      create: (personId: string, data: Partial<EmployeeBenefit>) =>
        api.post<EmployeeBenefit>(`/payroll/employees/${personId}/benefits`, data),
      update: (personId: string, id: string, data: Partial<EmployeeBenefit>) =>
        api.patch<EmployeeBenefit>(`/payroll/employees/${personId}/benefits/${id}`, data),
      remove: (personId: string, id: string) =>
        api.delete<{ message: string }>(`/payroll/employees/${personId}/benefits/${id}`),
    },
    bankAccounts: {
      list: (personId: string) => api.get<PaginatedList<BankAccount>>(`/payroll/employees/${personId}/bank-accounts`),
      create: (personId: string, data: BankAccountPayload) =>
        api.post<BankAccount>(`/payroll/employees/${personId}/bank-accounts`, data),
      update: (personId: string, id: string, data: Partial<BankAccountPayload>) =>
        api.patch<BankAccount>(`/payroll/employees/${personId}/bank-accounts/${id}`, data),
      remove: (personId: string, id: string) =>
        api.delete<{ message: string }>(`/payroll/employees/${personId}/bank-accounts/${id}`),
      /** Privileged + audited on the backend — returns the full account number once. */
      reveal: (personId: string, id: string) =>
        api.get<{ account_number: string }>(`/payroll/employees/${personId}/bank-accounts/${id}/reveal`),
    },
    history: (personId: string) => api.get<PaginatedList<PayrollHistoryEvent>>(`/payroll/employees/${personId}/history`),
    taxDeclarations: {
      list: (personId: string) => api.get<PaginatedList<TaxDeclaration>>(`/payroll/employees/${personId}/tax-declarations`),
      get: (personId: string, fy: string) =>
        api.get<TaxDeclaration>(`/payroll/employees/${personId}/tax-declarations/${fy}`),
      reviewItem: (personId: string, fy: string, itemId: string, data: { status: 'approved' | 'rejected'; approved_amount?: number }) =>
        api.post<TaxDeclarationItem>(`/payroll/employees/${personId}/tax-declarations/${fy}/items/${itemId}/review`, data),
      review: (personId: string, fy: string, data: { action: 'approve' | 'reject' | 'reopen'; notes?: string }) =>
        api.post<TaxDeclaration>(`/payroll/employees/${personId}/tax-declarations/${fy}/review`, data),
    },
    previousEmployments: {
      list: (personId: string) =>
        api.get<PaginatedList<PreviousEmployment>>(`/payroll/employees/${personId}/previous-employments`),
      create: (personId: string, data: Partial<PreviousEmployment>) =>
        api.post<PreviousEmployment>(`/payroll/employees/${personId}/previous-employments`, data),
      update: (personId: string, id: string, data: Partial<PreviousEmployment>) =>
        api.patch<PreviousEmployment>(`/payroll/employees/${personId}/previous-employments/${id}`, data),
      remove: (personId: string, id: string) =>
        api.delete<{ message: string }>(`/payroll/employees/${personId}/previous-employments/${id}`),
    },
  },

  // ---- Tax declarations (admin review queue) --------------------------------
  taxDeclarations: {
    list: (params?: { fiscal_year?: string; status?: DeclarationStatus; page?: number; limit?: number }) =>
      api.get<PaginatedList<TaxDeclaration>>('/payroll/tax-declarations', params),
  },

  // ---- Runs -----------------------------------------------------------------
  runs: {
    list: (params?: { status?: RunStatus; group_id?: string; page?: number; limit?: number }) =>
      api.get<PaginatedList<PayrollRun>>('/payroll/runs', params),
    get: (id: string) => api.get<PayrollRun>(`/payroll/runs/${id}`),
    create: (data: { payroll_period_id: string; payroll_group_id?: string; notes?: string }) =>
      api.post<PayrollRun>('/payroll/runs', data),
    employees: (id: string, params?: { status?: string }) =>
      api.get<PaginatedList<PayrollRunEmployee>>(`/payroll/runs/${id}/employees`, params),
    employeeLines: (id: string, runEmployeeId: string) =>
      api.get<PaginatedList<PayrollRunLine>>(`/payroll/runs/${id}/employees/${runEmployeeId}/lines`),
    calculate: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/calculate`, {}),
    submitReview: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/submit-review`, {}),
    approve: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/approve`, {}),
    markPaid: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/mark-paid`, {}),
    close: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/close`, {}),
    reopen: (id: string, reason: string) => api.post<PayrollRun>(`/payroll/runs/${id}/reopen`, { reason }),
    cancel: (id: string, reason?: string) => api.post<PayrollRun>(`/payroll/runs/${id}/cancel`, { reason }),
    exclude: (id: string, personId: string, reason: string) =>
      api.post<PayrollRunEmployee>(`/payroll/runs/${id}/exclude`, { person_id: personId, reason }),
    include: (id: string, personId: string) =>
      api.post<PayrollRunEmployee>(`/payroll/runs/${id}/include`, { person_id: personId }),
    postToAccounting: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/post-to-accounting`, {}),
    generatePayslips: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/generate-payslips`, {}),
  },

  // ---- Payslips -------------------------------------------------------------
  payslips: {
    list: (params?: { person_id?: string; period_id?: string; from?: string; to?: string; page?: number; limit?: number }) =>
      api.get<PaginatedList<Payslip>>('/payroll/payslips', params),
    get: (id: string) => api.get<Payslip>(`/payroll/payslips/${id}`),
    downloadPdf: (id: string, filename = 'payslip.pdf') => downloadFile(`/payroll/payslips/${id}/pdf`, filename),
  },

  // ---- Payslip template -----------------------------------------------------
  template: {
    get: () => api.get<PayslipTemplate>('/payroll/payslip-template'),
    update: (data: Partial<PayslipTemplate>) => api.put<PayslipTemplate>('/payroll/payslip-template', data),
    /** Server renders a trusted sample payslip as HTML for the live preview. */
    preview: (data: Partial<PayslipTemplate>) =>
      api.post<{ html: string }>('/payroll/payslip-template/preview', data),
  },

  // ---- Dashboard / alerts ---------------------------------------------------
  dashboard: {
    get: () => api.get<PayrollDashboard>('/payroll/dashboard'),
  },
  alerts: {
    list: () => api.get<PaginatedList<PayrollAlert>>('/payroll/alerts'),
    employees: (key: string) => api.get<PaginatedList<AlertEmployee>>(`/payroll/alerts/${key}/employees`),
  },

  // ---- Reports --------------------------------------------------------------
  reports: {
    run: (key: string, params?: ReportParams) => api.get<ReportResult>(`/payroll/reports/${key}`, params),
    exportCsv: (key: string, params?: ReportParams) =>
      downloadFile(`/payroll/reports/${key}${toQuery({ ...params, export: 'csv' })}`, `payroll-${key}.csv`),
  },

  // ---- Self service ---------------------------------------------------------
  my: {
    profile: () => api.get<EmployeePayrollProfile>('/payroll/my/profile'),
    salary: () => api.get<PaginatedList<SalaryAssignment>>('/payroll/my/salary'),
    payslips: (params?: { page?: number; limit?: number }) =>
      api.get<PaginatedList<Payslip>>('/payroll/my/payslips', params),
    payslip: (id: string) => api.get<Payslip>(`/payroll/my/payslips/${id}`),
    downloadPayslipPdf: (id: string, filename = 'payslip.pdf') =>
      downloadFile(`/payroll/my/payslips/${id}/pdf`, filename),
    bankAccounts: () => api.get<PaginatedList<BankAccount>>('/payroll/my/bank-accounts'),
    taxDeclarations: {
      list: () => api.get<PaginatedList<TaxDeclaration>>('/payroll/my/tax-declarations'),
      get: (fy: string) => api.get<TaxDeclaration>(`/payroll/my/tax-declarations/${fy}`),
      save: (fy: string, data: { regime?: 'new' | 'old'; items: TaxDeclarationItem[] }) =>
        api.put<TaxDeclaration>(`/payroll/my/tax-declarations/${fy}`, data),
      submit: (fy: string) => api.post<TaxDeclaration>(`/payroll/my/tax-declarations/${fy}/submit`, {}),
    },
  },
};

export default payrollApi;
