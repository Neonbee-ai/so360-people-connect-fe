import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    getHeadersRaw: vi.fn(() => ({ 'X-Tenant-Id': 'tenant-1', Authorization: 'Bearer tok' })),
  },
  apiContext: {
    getBaseUrl: vi.fn(() => 'http://api.test/v1'),
  },
}));

import payrollApiDefault, { payrollApi } from './payrollApi';
import { api } from './apiClient';

const mockClient = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getHeadersRaw: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockClient.get.mockClear().mockResolvedValue({});
  mockClient.post.mockClear().mockResolvedValue({});
  mockClient.put.mockClear().mockResolvedValue({});
  mockClient.patch.mockClear().mockResolvedValue({});
  mockClient.delete.mockClear().mockResolvedValue({});
});

describe('GIVEN the payroll API module', () => {
  it('WHEN imported THEN the default export is the same object as the named export', () => {
    expect(payrollApiDefault).toBe(payrollApi);
  });
});

// =============================================================================
// Table-driven contract: every exported wrapper hits the right verb + path +
// payload on the shared client. [call, verb, path, body]
// =============================================================================

type Row = [name: string, invoke: () => unknown, verb: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, payload?: unknown];

const P = 'person-1';
const ID = 'id-1';

const rows: Row[] = [
  // Settings
  ['settings.get', () => payrollApi.settings.get(), 'get', '/payroll/settings'],
  ['settings.update', () => payrollApi.settings.update({ pay_frequency: 'monthly' }), 'put', '/payroll/settings', { pay_frequency: 'monthly' }],
  // Groups & periods
  ['groups.list', () => payrollApi.groups.list({ is_active: true }), 'get', '/payroll/groups', { is_active: true }],
  ['groups.create', () => payrollApi.groups.create({ name: 'G' }), 'post', '/payroll/groups', { name: 'G' }],
  ['groups.update', () => payrollApi.groups.update(ID, { name: 'G2' }), 'patch', `/payroll/groups/${ID}`, { name: 'G2' }],
  ['groups.remove', () => payrollApi.groups.remove(ID), 'delete', `/payroll/groups/${ID}`],
  ['periods.list', () => payrollApi.periods.list({ status: 'open' }), 'get', '/payroll/periods', { status: 'open' }],
  ['periods.generate', () => payrollApi.periods.generate({ payroll_group_id: 'g1', from: '2026-01-01', count: 12 }), 'post', '/payroll/periods/generate', { payroll_group_id: 'g1', from: '2026-01-01', count: 12 }],
  // Statutory
  ['statutory.get', () => payrollApi.statutory.get(), 'get', '/payroll/statutory'],
  ['statutory.update', () => payrollApi.statutory.update({ enabled: true }), 'put', '/payroll/statutory', { enabled: true }],
  // Benefit types
  ['benefitTypes.list', () => payrollApi.benefitTypes.list(), 'get', '/payroll/benefit-types'],
  ['benefitTypes.create', () => payrollApi.benefitTypes.create({ name: 'B' }), 'post', '/payroll/benefit-types', { name: 'B' }],
  ['benefitTypes.update', () => payrollApi.benefitTypes.update(ID, { name: 'B2' }), 'patch', `/payroll/benefit-types/${ID}`, { name: 'B2' }],
  ['benefitTypes.remove', () => payrollApi.benefitTypes.remove(ID), 'delete', `/payroll/benefit-types/${ID}`],
  // Components
  ['components.list', () => payrollApi.components.list({ kind: 'earning' }), 'get', '/payroll/components', { kind: 'earning' }],
  ['components.create', () => payrollApi.components.create({ code: 'HRA' }), 'post', '/payroll/components', { code: 'HRA' }],
  ['components.update', () => payrollApi.components.update(ID, { name: 'C' }), 'patch', `/payroll/components/${ID}`, { name: 'C' }],
  ['components.remove', () => payrollApi.components.remove(ID), 'delete', `/payroll/components/${ID}`],
  // Structures
  ['structures.list', () => payrollApi.structures.list({ status: 'active' }), 'get', '/payroll/structures', { status: 'active' }],
  ['structures.get', () => payrollApi.structures.get(ID), 'get', `/payroll/structures/${ID}`],
  ['structures.create', () => payrollApi.structures.create({ name: 'S' }), 'post', '/payroll/structures', { name: 'S' }],
  ['structures.update', () => payrollApi.structures.update(ID, { name: 'S2' }), 'patch', `/payroll/structures/${ID}`, { name: 'S2' }],
  ['structures.remove', () => payrollApi.structures.remove(ID), 'delete', `/payroll/structures/${ID}`],
  ['structures.saveLines', () => payrollApi.structures.saveLines(ID, [{ component_id: 'c1', display_order: 1 }]), 'put', `/payroll/structures/${ID}/lines`, { lines: [{ component_id: 'c1', display_order: 1 }] }],
  ['structures.validate (sample)', () => payrollApi.structures.validate(ID, { monthly_wage: 50000 }), 'post', `/payroll/structures/${ID}/validate`, { monthly_wage: 50000 }],
  ['structures.validate (no sample)', () => payrollApi.structures.validate(ID), 'post', `/payroll/structures/${ID}/validate`, {}],
  ['structures.clone (named)', () => payrollApi.structures.clone(ID, { name: 'Copy' }), 'post', `/payroll/structures/${ID}/clone`, { name: 'Copy' }],
  ['structures.clone (default)', () => payrollApi.structures.clone(ID), 'post', `/payroll/structures/${ID}/clone`, {}],
  ['structures.newVersion', () => payrollApi.structures.newVersion(ID), 'post', `/payroll/structures/${ID}/new-version`, {}],
  // Employees
  ['employees.list', () => payrollApi.employees.list({ search: 'a' }), 'get', '/payroll/employees', { search: 'a' }],
  ['employees.getProfile', () => payrollApi.employees.getProfile(P), 'get', `/payroll/employees/${P}/profile`],
  ['employees.updateProfile', () => payrollApi.employees.updateProfile(P, { tax_regime: 'old' }), 'put', `/payroll/employees/${P}/profile`, { tax_regime: 'old' }],
  ['employees.salary.list', () => payrollApi.employees.salary.list(P), 'get', `/payroll/employees/${P}/salary`],
  ['employees.salary.revise', () => payrollApi.employees.salary.revise(P, { structure_id: 's1', monthly_wage: 1, effective_from: '2026-01-01', revision_reason: 'r', revision_type: 'increment' }), 'post', `/payroll/employees/${P}/salary`, { structure_id: 's1', monthly_wage: 1, effective_from: '2026-01-01', revision_reason: 'r', revision_type: 'increment' }],
  ['employees.overrides.list', () => payrollApi.employees.overrides.list(P), 'get', `/payroll/employees/${P}/overrides`],
  ['employees.overrides.create', () => payrollApi.employees.overrides.create(P, { action: 'add' }), 'post', `/payroll/employees/${P}/overrides`, { action: 'add' }],
  ['employees.overrides.update', () => payrollApi.employees.overrides.update(P, ID, { action: 'remove' }), 'patch', `/payroll/employees/${P}/overrides/${ID}`, { action: 'remove' }],
  ['employees.overrides.remove', () => payrollApi.employees.overrides.remove(P, ID), 'delete', `/payroll/employees/${P}/overrides/${ID}`],
  ['employees.benefits.list', () => payrollApi.employees.benefits.list(P), 'get', `/payroll/employees/${P}/benefits`],
  ['employees.benefits.create', () => payrollApi.employees.benefits.create(P, { benefit_type_id: 'b1' }), 'post', `/payroll/employees/${P}/benefits`, { benefit_type_id: 'b1' }],
  ['employees.benefits.update', () => payrollApi.employees.benefits.update(P, ID, { notes: 'n' }), 'patch', `/payroll/employees/${P}/benefits/${ID}`, { notes: 'n' }],
  ['employees.benefits.remove', () => payrollApi.employees.benefits.remove(P, ID), 'delete', `/payroll/employees/${P}/benefits/${ID}`],
  ['employees.bankAccounts.list', () => payrollApi.employees.bankAccounts.list(P), 'get', `/payroll/employees/${P}/bank-accounts`],
  ['employees.bankAccounts.create', () => payrollApi.employees.bankAccounts.create(P, { bank_name: 'B', account_holder: 'H', account_number: '1', account_type: 'savings', payment_method: 'bank_transfer' }), 'post', `/payroll/employees/${P}/bank-accounts`, { bank_name: 'B', account_holder: 'H', account_number: '1', account_type: 'savings', payment_method: 'bank_transfer' }],
  ['employees.bankAccounts.update', () => payrollApi.employees.bankAccounts.update(P, ID, { ifsc: 'X' }), 'patch', `/payroll/employees/${P}/bank-accounts/${ID}`, { ifsc: 'X' }],
  ['employees.bankAccounts.remove', () => payrollApi.employees.bankAccounts.remove(P, ID), 'delete', `/payroll/employees/${P}/bank-accounts/${ID}`],
  ['employees.bankAccounts.reveal', () => payrollApi.employees.bankAccounts.reveal(P, ID), 'get', `/payroll/employees/${P}/bank-accounts/${ID}/reveal`],
  ['employees.history', () => payrollApi.employees.history(P), 'get', `/payroll/employees/${P}/history`],
  ['employees.taxDeclarations.list', () => payrollApi.employees.taxDeclarations.list(P), 'get', `/payroll/employees/${P}/tax-declarations`],
  ['employees.taxDeclarations.get', () => payrollApi.employees.taxDeclarations.get(P, '2026-27'), 'get', `/payroll/employees/${P}/tax-declarations/2026-27`],
  ['employees.taxDeclarations.reviewItem', () => payrollApi.employees.taxDeclarations.reviewItem(P, '2026-27', ID, { status: 'approved', approved_amount: 100 }), 'post', `/payroll/employees/${P}/tax-declarations/2026-27/items/${ID}/review`, { status: 'approved', approved_amount: 100 }],
  ['employees.taxDeclarations.review', () => payrollApi.employees.taxDeclarations.review(P, '2026-27', { action: 'approve' }), 'post', `/payroll/employees/${P}/tax-declarations/2026-27/review`, { action: 'approve' }],
  ['employees.previousEmployments.list', () => payrollApi.employees.previousEmployments.list(P), 'get', `/payroll/employees/${P}/previous-employments`],
  ['employees.previousEmployments.create', () => payrollApi.employees.previousEmployments.create(P, { employer_name: 'E' }), 'post', `/payroll/employees/${P}/previous-employments`, { employer_name: 'E' }],
  ['employees.previousEmployments.update', () => payrollApi.employees.previousEmployments.update(P, ID, { notes: 'n' }), 'patch', `/payroll/employees/${P}/previous-employments/${ID}`, { notes: 'n' }],
  ['employees.previousEmployments.remove', () => payrollApi.employees.previousEmployments.remove(P, ID), 'delete', `/payroll/employees/${P}/previous-employments/${ID}`],
  // Admin tax-declaration queue
  ['taxDeclarations.list', () => payrollApi.taxDeclarations.list({ status: 'submitted' }), 'get', '/payroll/tax-declarations', { status: 'submitted' }],
  // Runs
  ['runs.list', () => payrollApi.runs.list({ status: 'review' }), 'get', '/payroll/runs', { status: 'review' }],
  ['runs.get', () => payrollApi.runs.get(ID), 'get', `/payroll/runs/${ID}`],
  ['runs.create', () => payrollApi.runs.create({ payroll_period_id: 'pp1' }), 'post', '/payroll/runs', { payroll_period_id: 'pp1' }],
  ['runs.employees', () => payrollApi.runs.employees(ID, { status: 'error' }), 'get', `/payroll/runs/${ID}/employees`, { status: 'error' }],
  ['runs.employeeLines', () => payrollApi.runs.employeeLines(ID, 're1'), 'get', `/payroll/runs/${ID}/employees/re1/lines`],
  ['runs.calculate', () => payrollApi.runs.calculate(ID), 'post', `/payroll/runs/${ID}/calculate`, {}],
  ['runs.submitReview', () => payrollApi.runs.submitReview(ID), 'post', `/payroll/runs/${ID}/submit-review`, {}],
  ['runs.approve', () => payrollApi.runs.approve(ID), 'post', `/payroll/runs/${ID}/approve`, {}],
  ['runs.markPaid', () => payrollApi.runs.markPaid(ID), 'post', `/payroll/runs/${ID}/mark-paid`, {}],
  ['runs.close', () => payrollApi.runs.close(ID), 'post', `/payroll/runs/${ID}/close`, {}],
  ['runs.reopen', () => payrollApi.runs.reopen(ID, 'why'), 'post', `/payroll/runs/${ID}/reopen`, { reason: 'why' }],
  ['runs.cancel', () => payrollApi.runs.cancel(ID, 'why'), 'post', `/payroll/runs/${ID}/cancel`, { reason: 'why' }],
  ['runs.exclude', () => payrollApi.runs.exclude(ID, P, 'why'), 'post', `/payroll/runs/${ID}/exclude`, { person_id: P, reason: 'why' }],
  ['runs.include', () => payrollApi.runs.include(ID, P), 'post', `/payroll/runs/${ID}/include`, { person_id: P }],
  ['runs.postToAccounting', () => payrollApi.runs.postToAccounting(ID), 'post', `/payroll/runs/${ID}/post-to-accounting`, {}],
  ['runs.generatePayslips', () => payrollApi.runs.generatePayslips(ID), 'post', `/payroll/runs/${ID}/generate-payslips`, {}],
  // Payslips
  ['payslips.list', () => payrollApi.payslips.list({ person_id: P }), 'get', '/payroll/payslips', { person_id: P }],
  ['payslips.get', () => payrollApi.payslips.get(ID), 'get', `/payroll/payslips/${ID}`],
  // Template
  ['template.get', () => payrollApi.template.get(), 'get', '/payroll/payslip-template'],
  ['template.update', () => payrollApi.template.update({ layout: 'wave' }), 'put', '/payroll/payslip-template', { layout: 'wave' }],
  ['template.preview', () => payrollApi.template.preview({ layout: 'wave' }), 'post', '/payroll/payslip-template/preview', { layout: 'wave' }],
  // Dashboard / alerts
  ['dashboard.get', () => payrollApi.dashboard.get(), 'get', '/payroll/dashboard'],
  ['alerts.list', () => payrollApi.alerts.list(), 'get', '/payroll/alerts'],
  ['alerts.employees', () => payrollApi.alerts.employees('missing_bank'), 'get', '/payroll/alerts/missing_bank/employees'],
  // Reports (table view — CSV export is covered separately below)
  ['reports.run', () => payrollApi.reports.run('summary', { from: '2026-01-01' }), 'get', '/payroll/reports/summary', { from: '2026-01-01' }],
  // Self service
  ['my.profile', () => payrollApi.my.profile(), 'get', '/payroll/my/profile'],
  ['my.salary', () => payrollApi.my.salary(), 'get', '/payroll/my/salary'],
  ['my.payslips', () => payrollApi.my.payslips({ page: 1 }), 'get', '/payroll/my/payslips', { page: 1 }],
  ['my.payslip', () => payrollApi.my.payslip(ID), 'get', `/payroll/my/payslips/${ID}`],
  ['my.bankAccounts', () => payrollApi.my.bankAccounts(), 'get', '/payroll/my/bank-accounts'],
  ['my.taxDeclarations.list', () => payrollApi.my.taxDeclarations.list(), 'get', '/payroll/my/tax-declarations'],
  ['my.taxDeclarations.get', () => payrollApi.my.taxDeclarations.get('2026-27'), 'get', '/payroll/my/tax-declarations/2026-27'],
  ['my.taxDeclarations.save', () => payrollApi.my.taxDeclarations.save('2026-27', { regime: 'old', items: [] }), 'put', '/payroll/my/tax-declarations/2026-27', { regime: 'old', items: [] }],
  ['my.taxDeclarations.submit', () => payrollApi.my.taxDeclarations.submit('2026-27'), 'post', '/payroll/my/tax-declarations/2026-27/submit', {}],
];

describe('GIVEN every payroll API wrapper', () => {
  it.each(rows)('WHEN %s is called THEN the client receives the right verb, path and payload', async (_name, invoke, verb, path, payload) => {
    await invoke();
    const fn = mockClient[verb];
    expect(fn).toHaveBeenCalledTimes(1);
    if (payload === undefined) {
      expect(fn.mock.calls[0][0]).toBe(path);
    } else {
      expect(fn).toHaveBeenCalledWith(path, payload);
    }
  });
});

// =============================================================================
// downloadFile-backed endpoints — raw fetch with tenant headers + blob link
// =============================================================================

describe('GIVEN the CSV / PDF download helpers', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['csv,data'])),
    });
    vi.stubGlobal('fetch', fetchSpy);
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    clickSpy.mockRestore();
  });

  it('WHEN a report CSV is exported THEN fetch hits the export URL with the raw context headers', async () => {
    await payrollApi.reports.exportCsv('summary', { from: '2026-01-01', group_id: '', department_id: undefined });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://api.test/v1/payroll/reports/summary?from=2026-01-01&export=csv');
    expect(init.headers).toMatchObject({ 'X-Tenant-Id': 'tenant-1' });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('WHEN a payslip PDF is downloaded THEN the admin PDF path and filename are used', async () => {
    await payrollApi.payslips.downloadPdf('ps1', 'PS-1.pdf');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://api.test/v1/payroll/payslips/ps1/pdf');
  });

  it('WHEN a self-service payslip PDF is downloaded with the default filename THEN the /my path is used', async () => {
    await payrollApi.my.downloadPayslipPdf('ps2');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://api.test/v1/payroll/my/payslips/ps2/pdf');
  });

  it('WHEN the server rejects the download THEN the helper throws with the status', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 403 });
    await expect(payrollApi.payslips.downloadPdf('ps1')).rejects.toThrow('Download failed: 403');
  });

  it('WHEN a CSV export is requested with no params THEN only the export flag lands in the query', async () => {
    await payrollApi.reports.exportCsv('history');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://api.test/v1/payroll/reports/history?export=csv');
  });
});
