import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/mastersService', () => ({
  mastersApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

let mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ ...mockShellFlags }),
}));

import MasterListPage from '../components/MasterListPage';
import DesignationsPage from '../pages/masters/DesignationsPage';
import SkillsPage from '../pages/masters/SkillsPage';
import { mastersApi } from '../services/mastersService';

const mockApi = mastersApi as any;

const renderPage = (node: React.ReactElement) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
});

// ============================================================================
// Generic behavior via the raw MasterListPage component
// ============================================================================
describe('Given MasterListPage generic behavior', () => {
  describe('Given rows exist for the given masterType', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [
          { id: 'm1', name: 'React', code: 'react', is_active: true },
          { id: 'm2', name: 'Node', code: 'node', is_active: false },
        ],
      });
    });

    it('When the page loads / Then it requests includeInactive and fetches by masterType', async () => {
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());
      expect(mockApi.getAll).toHaveBeenCalledWith('skill', { includeInactive: true });
      expect(screen.getByText('Node')).toBeInTheDocument();
    });

    it('When Add {label} is clicked / Then the shared form modal opens', async () => {
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Skill'));
      // Both the trigger button and the modal title/submit button now read "Add Skill".
      await waitFor(() => expect(screen.getAllByText('Add Skill').length).toBeGreaterThan(1));
      expect(screen.getByPlaceholderText('e.g. Skill')).toBeInTheDocument();
    });
  });

  describe('Given no rows exist', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({ data: [] });
    });

    it('When the page loads / Then it shows the empty state for the given plural label', async () => {
      renderPage(<MasterListPage masterType="skill" label="Skill" pluralLabel="Skills" />);
      await waitFor(() => expect(screen.getByText('No skills')).toBeInTheDocument());
    });
  });

  describe('Given the fetch fails', () => {
    beforeEach(() => {
      mockApi.getAll.mockRejectedValue(new Error('network error'));
    });

    it('When the page loads / Then an error state is shown, not a silently empty list', async () => {
      renderPage(<MasterListPage masterType="skill" label="Skill" pluralLabel="Skills" />);
      await waitFor(() => expect(screen.getByText(/Couldn't load skills/i)).toBeInTheDocument());
    });
  });

  describe('Given showLevelGrade is true (Designations)', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [{ id: 'd1', name: 'Manager', code: 'manager', level: 'Mid', grade: 'L4', is_active: true }],
      });
    });

    it('When the page loads / Then Level and Grade columns are rendered', async () => {
      renderPage(<MasterListPage masterType="designation" label="Designation" showLevelGrade />);
      await waitFor(() => expect(screen.getByText('Manager')).toBeInTheDocument());
      expect(screen.getByText('Level')).toBeInTheDocument();
      expect(screen.getByText('Grade')).toBeInTheDocument();
      expect(screen.getByText('Mid')).toBeInTheDocument();
      expect(screen.getByText('L4')).toBeInTheDocument();
    });
  });

  describe('Given showLevelGrade is false (default, e.g. Skills)', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [{ id: 's1', name: 'React', code: 'react', is_active: true }],
      });
    });

    it('When the page loads / Then no Level or Grade columns are rendered', async () => {
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());
      expect(screen.queryByText('Level')).not.toBeInTheDocument();
      expect(screen.queryByText('Grade')).not.toBeInTheDocument();
    });
  });

  describe('Given create/update/delete actions', () => {
    beforeEach(() => {
      mockApi.getAll.mockResolvedValue({
        data: [{ id: 'm1', name: 'React', code: 'react', is_active: true }],
      });
    });

    it('When a new row is submitted / Then mastersApi.create is called with the masterType', async () => {
      mockApi.create.mockResolvedValue({ id: 'm2', name: 'Vue' });
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Add Skill'));
      const nameInput = await screen.findByPlaceholderText('e.g. Skill');
      fireEvent.change(nameInput, { target: { value: 'Vue' } });
      const submitButtons = screen.getAllByRole('button', { name: 'Add Skill' });
      fireEvent.click(submitButtons[submitButtons.length - 1]);

      await waitFor(() =>
        expect(mockApi.create).toHaveBeenCalledWith('skill', expect.objectContaining({ name: 'Vue' })),
      );
    });

    it('When the active toggle is clicked / Then mastersApi.update flips is_active', async () => {
      mockApi.update.mockResolvedValue({ id: 'm1', is_active: false });
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Deactivate'));

      await waitFor(() =>
        expect(mockApi.update).toHaveBeenCalledWith('skill', 'm1', { is_active: false }),
      );
    });

    it('When Delete is clicked / Then mastersApi.delete is called with the masterType and id', async () => {
      mockApi.delete.mockResolvedValue({ message: 'skill deleted' });
      renderPage(<MasterListPage masterType="skill" label="Skill" />);
      await waitFor(() => expect(screen.getByText('React')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Delete'));

      await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('skill', 'm1'));
    });
  });
});

// ============================================================================
// effectiveFlagsLoaded gate — mirrors WorkLocationsPage's fail-safe behavior
// ============================================================================
describe('Given MasterListPage — effectiveFlagsLoaded gate', () => {
  it('When effectiveFlagsLoaded is false / Then the Add button is absent', async () => {
    mockShellFlags = { effectiveFlagsLoaded: false, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage(<MasterListPage masterType="skill" label="Skill" pluralLabel="Skills" />);
    await waitFor(() => expect(screen.queryByText('No skills')).toBeInTheDocument());
    expect(screen.queryByText('Add Skill')).not.toBeInTheDocument();
  });

  it('When effectiveFlagsLoaded is true / Then the Add button is present', async () => {
    mockShellFlags = { effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true };
    mockApi.getAll.mockResolvedValue({ data: [] });
    renderPage(<MasterListPage masterType="skill" label="Skill" pluralLabel="Skills" />);
    await waitFor(() => expect(screen.queryByText('No skills')).toBeInTheDocument());
    expect(screen.queryAllByText('Add Skill').length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Thin route-wrapper pages — verify each wraps MasterListPage with its own
// masterType/label instead of duplicating the list/CRUD logic.
// ============================================================================
describe('Given the thin route-wrapper pages', () => {
  it('When DesignationsPage renders / Then it fetches masterType="designation" with level/grade columns', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [{ id: 'd1', name: 'Manager', code: 'manager', level: 'Mid', grade: 'L4', is_active: true }],
    });
    renderPage(<DesignationsPage />);
    await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith('designation', { includeInactive: true }));
    expect(await screen.findByText('Grade')).toBeInTheDocument();
  });

  it('When SkillsPage renders / Then it fetches masterType="skill" without level/grade columns', async () => {
    mockApi.getAll.mockResolvedValue({
      data: [{ id: 's1', name: 'React', code: 'react', is_active: true }],
    });
    renderPage(<SkillsPage />);
    await waitFor(() => expect(mockApi.getAll).toHaveBeenCalledWith('skill', { includeInactive: true }));
    expect(await screen.findByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Grade')).not.toBeInTheDocument();
  });
});
