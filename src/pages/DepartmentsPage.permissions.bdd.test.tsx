/**
 * DepartmentsPage — permission gating BDD specs.
 *
 * Reported: an employee-level user could see Create Department and Edit. Root
 * cause: the page gated those actions on a PLAN FEATURE FLAG
 * (action:people:departments:create) with a fail-OPEN default (?? true), not on
 * the user's ROLE permission. Every member of an entitled org therefore saw the
 * buttons regardless of role.
 *
 * These specs pin the corrected behaviour: management actions follow the role
 * permission (departments.create / departments.update), fail closed, and an
 * owner/admin wildcard retains full access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/departmentsService', () => ({
  departmentsApi: { getTree: vi.fn(), create: vi.fn(), update: vi.fn() },
  Department: {},
  CreateDepartmentPayload: {},
}));

// Rebuilt per-test so each scenario controls the permission set.
let shell: any;
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => shell,
  useQuota: () => ({ getQuota: () => null, refresh: async () => {}, isLoading: false, error: null, isExceeded: () => false, getPercentage: () => 0 }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (i: any[]) => i, isLimited: () => false }),
}));

import DepartmentsPage from './DepartmentsPage';
import { departmentsApi } from '../services/departmentsService';

const mockApi = departmentsApi as any;

const makeShell = (permissions: string[], permissionsLoaded = true) => ({
  effectiveFlagsLoaded: true,
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
  currentTenant: { id: 'tenant-1' },
  currentOrg: { id: 'org-1' },
  user: { id: 'u1', email: 'a@b.com' },
  accessToken: 'tok',
  permissionsLoaded,
  hasPermission: (code: string) =>
    permissions.includes('*') ||
    permissions.includes(code) ||
    permissions.includes(`${code.split('.')[0]}.*`),
});

const renderPage = () => render(<MemoryRouter><DepartmentsPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getTree.mockResolvedValue({
    data: [{ id: 'd1', code: 'ENG', name: 'Engineering', is_active: true, employee_count: 3, children: [] }],
  });
});

describe('DepartmentsPage — role-based action gating', () => {
  describe('Given an employee with only view (departments.read)', () => {
    beforeEach(() => { shell = makeShell(['departments.read']); });

    it('When the page loads / Then Create Department is not shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.queryByRole('button', { name: /create department/i })).toBeNull();
    });

    it('When the page loads / Then the Edit action is not shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    });
  });

  describe('Given a user granted departments.create but not update', () => {
    beforeEach(() => { shell = makeShell(['departments.read', 'departments.create']); });

    it('When the page loads / Then Create shows but Edit does not', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.getByRole('button', { name: /create department/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    });
  });

  describe('Given a user granted both create and update', () => {
    beforeEach(() => { shell = makeShell(['departments.read', 'departments.create', 'departments.update']); });

    it('When the page loads / Then both Create and Edit are shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.getByRole('button', { name: /create department/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy();
    });
  });

  describe('Given an owner/admin (wildcard)', () => {
    beforeEach(() => { shell = makeShell(['*']); });

    it('When the page loads / Then management actions remain available', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.getByRole('button', { name: /create department/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy();
    });
  });

  describe('Given entitlements have not resolved yet', () => {
    beforeEach(() => { shell = makeShell(['departments.create', 'departments.update'], false); });

    it('When permissionsLoaded is false / Then actions fail closed (hidden)', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Engineering')).toBeTruthy());
      expect(screen.queryByRole('button', { name: /create department/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    });
  });
});
