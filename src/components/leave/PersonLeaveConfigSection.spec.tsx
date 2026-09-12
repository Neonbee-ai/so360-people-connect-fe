import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * PersonLeaveConfigSection — BDD specs.
 *
 * The section HR sees while creating an employee. The behaviours worth pinning
 * are the ones that were easy to get wrong:
 *   - an UNCONFIGURED employment type means "every leave type applies", which is
 *     the opposite of the empty list it looks like
 *   - customising one employee must never edit the employment type default, so
 *     deviations are staged as per-person include/exclude overrides
 *   - changing employment type resets those deviations, and must say so
 */

vi.mock('../../services/leaveConfigService', () => ({
  leaveConfigApi: { getForEmploymentType: vi.fn() },
}));

vi.mock('../../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn() },
}));

import PersonLeaveConfigSection, { type PendingLeaveOverride } from './PersonLeaveConfigSection';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { leaveTypesApi } from '../../services/leaveTypesService';

const mockConfig = leaveConfigApi as any;
const mockTypes = leaveTypesApi as any;

const ANNUAL = { id: 'lt-annual', code: 'AL', name: 'Annual Leave', is_paid: true, accrual_type: 'yearly', max_days_per_year: 18, color: '#10b981', source: 'employment_type' };
const SICK = { id: 'lt-sick', code: 'SL', name: 'Sick Leave', is_paid: true, accrual_type: 'yearly', max_days_per_year: 12, color: '#f59e0b', source: 'employment_type' };

/** Test host: owns the staged overrides exactly as the Add Person form does. */
const Host: React.FC<{ masterId?: string; canManageLeave?: boolean }> = ({
  masterId = 'et-full-time',
  canManageLeave = true,
}) => {
  const [overrides, setOverrides] = React.useState<PendingLeaveOverride[]>([]);
  const [id, setId] = React.useState(masterId);
  return (
    <div>
      <button onClick={() => setId('et-contract')}>Switch to Contract</button>
      <pre data-testid="overrides">{JSON.stringify(overrides)}</pre>
      <PersonLeaveConfigSection
        employmentTypeMasterId={id}
        employmentTypeName={id === 'et-full-time' ? 'Full Time' : 'Contract'}
        overrides={overrides}
        onOverridesChange={setOverrides}
        canManageLeave={canManageLeave}
      />
    </div>
  );
};

const overridesJson = () => JSON.parse(screen.getByTestId('overrides').textContent || '[]');

beforeEach(() => {
  vi.clearAllMocks();
  mockConfig.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [ANNUAL, SICK] });
  mockTypes.getAll.mockResolvedValue({
    data: [ANNUAL, SICK, { id: 'lt-bereave', code: 'BL', name: 'Bereavement Leave', is_active: true }],
  });
});

describe('Given an employment type with configured leave types', () => {
  it('When the section loads / Then the inherited structure and its source are shown', async () => {
    render(<Host />);

    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    expect(screen.getByText('Sick Leave')).toBeInTheDocument();
    expect(screen.getByText(/Full Time/)).toBeInTheDocument();
    expect(screen.getAllByText(/Employment type/i).length).toBeGreaterThan(0);
  });

  it('When nothing is customised / Then no overrides are staged', async () => {
    render(<Host />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    expect(overridesJson()).toEqual([]);
  });

  it('When entitlement is configured / Then it is surfaced so HR can confirm what the hire receives', async () => {
    render(<Host />);
    await waitFor(() => expect(screen.getByText('18 days')).toBeInTheDocument());
  });
});

describe('Given HR customises the structure for one employee', () => {
  const startCustomising = async () => {
    render(<Host />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /customize for this employee/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /add leave type/i })).toBeInTheDocument());
  };

  it('When an extra leave type is added / Then it is staged as an employee-level include', async () => {
    await startCustomising();

    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'lt-bereave' } });

    await waitFor(() =>
      expect(overridesJson()).toEqual([{ leave_type_id: 'lt-bereave', mode: 'include' }]),
    );
  });

  it('When an already-inherited type is offered / Then it is not selectable twice', async () => {
    await startCustomising();
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));

    const options = Array.from((await screen.findByRole('combobox')).querySelectorAll('option')).map(
      o => (o as HTMLOptionElement).value,
    );
    expect(options).not.toContain('lt-annual');
    expect(options).toContain('lt-bereave');
  });

  it('When an inherited type is removed / Then it is staged as an employee-level exclude', async () => {
    await startCustomising();

    fireEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);

    await waitFor(() =>
      expect(overridesJson()).toEqual([{ leave_type_id: 'lt-annual', mode: 'exclude' }]),
    );
  });

  it('When a removed type is restored / Then the exclude is dropped again', async () => {
    await startCustomising();

    fireEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
    await waitFor(() => expect(overridesJson()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));

    await waitFor(() => expect(overridesJson()).toEqual([]));
  });

  it('When customising / Then the copy states the employment type default is untouched', async () => {
    await startCustomising();
    expect(screen.getByText(/default is unchanged/i)).toBeInTheDocument();
  });
});

describe('Given the employment type is changed after customising', () => {
  it('When it changes / Then staged deviations are cleared AND the user is told', async () => {
    render(<Host />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /customize for this employee/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add leave type/i }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'lt-bereave' } });
    await waitFor(() => expect(overridesJson()).toHaveLength(1));

    mockConfig.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [SICK] });
    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));

    await waitFor(() => expect(overridesJson()).toEqual([]));
    expect(screen.getByText(/employee-specific changes were cleared/i)).toBeInTheDocument();
  });
});

describe('Given an employment type with NO leave configuration', () => {
  it('When the section loads / Then it says every active type applies, not that none do', async () => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
    render(<Host />);

    await waitFor(() =>
      expect(screen.getByText(/Every active leave type will apply/i)).toBeInTheDocument(),
    );
  });
});

describe('Given no employment type is selected yet', () => {
  it('When the section renders / Then it guides the user to pick one', async () => {
    render(<Host masterId="" />);

    expect(
      screen.getByText(/Select an Employment Type to load the default leave structure/i),
    ).toBeInTheDocument();
    expect(mockConfig.getForEmploymentType).not.toHaveBeenCalled();
  });
});

describe('Given the viewer cannot manage leave', () => {
  it('When the section loads / Then the inherited structure is read-only', async () => {
    render(<Host canManageLeave={false} />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /customize for this employee/i })).not.toBeInTheDocument();
  });
});

describe('Given the configuration cannot be loaded', () => {
  it('When the read fails / Then an error with a retry is shown instead of an empty structure', async () => {
    mockConfig.getForEmploymentType.mockRejectedValue(new Error('boom'));
    render(<Host />);

    await waitFor(() =>
      expect(screen.getByText(/Could not load the leave structure/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
