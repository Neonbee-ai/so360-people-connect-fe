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
const Host: React.FC<{
  masterId?: string;
  canManageLeave?: boolean;
  /** Omit the employment type's display name, as when it hasn't resolved yet. */
  noName?: boolean;
  initialOverrides?: PendingLeaveOverride[];
  onConfigureLeaveTypes?: () => void;
  onConfigureEmploymentTypeDefaults?: () => void;
}> = ({
  masterId = 'et-full-time',
  canManageLeave = true,
  noName = false,
  initialOverrides = [],
  onConfigureLeaveTypes,
  onConfigureEmploymentTypeDefaults,
}) => {
  const [overrides, setOverrides] = React.useState<PendingLeaveOverride[]>(initialOverrides);
  const [id, setId] = React.useState(masterId);
  return (
    <div>
      <button onClick={() => setId('et-contract')}>Switch to Contract</button>
      <pre data-testid="overrides">{JSON.stringify(overrides)}</pre>
      <PersonLeaveConfigSection
        employmentTypeMasterId={id}
        employmentTypeName={noName ? undefined : id === 'et-full-time' ? 'Full Time' : 'Contract'}
        overrides={overrides}
        onOverridesChange={setOverrides}
        canManageLeave={canManageLeave}
        onConfigureLeaveTypes={onConfigureLeaveTypes}
        onConfigureEmploymentTypeDefaults={onConfigureEmploymentTypeDefaults}
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

  it('When an employee-only type is removed again / Then its include is dropped', async () => {
    await startCustomising();
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'lt-bereave' } });
    await waitFor(() => expect(overridesJson()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Bereavement Leave' }));

    await waitFor(() => expect(overridesJson()).toEqual([]));
    expect(screen.queryByText('Bereavement Leave')).not.toBeInTheDocument();
  });

  it('When the leave type picker loses focus without a choice / Then it closes and stages nothing', async () => {
    await startCustomising();
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));
    const picker = await screen.findByRole('combobox');

    fireEvent.blur(picker);

    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add leave type/i })).toBeInTheDocument();
    expect(overridesJson()).toEqual([]);
  });

  it('When the picker reports an empty value / Then nothing is staged', async () => {
    await startCustomising();
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '' } });

    expect(overridesJson()).toEqual([]);
  });

  // The picker only lists addable types, so these two reach the guard the way a
  // stale <option> would: the option is injected and then selected.
  const selectStaleOption = async (value: string) => {
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));
    const picker = (await screen.findByRole('combobox')) as HTMLSelectElement;
    picker.appendChild(new Option('Stale', value));
    fireEvent.change(picker, { target: { value } });
  };

  it('When a stale picker value names an inherited type / Then it is not staged as an include', async () => {
    await startCustomising();

    await selectStaleOption('lt-annual');

    expect(overridesJson()).toEqual([]);
  });

  it('When a stale picker value names an already-added type / Then it is not staged twice', async () => {
    await startCustomising();
    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'lt-bereave' } });
    await waitFor(() => expect(overridesJson()).toHaveLength(1));

    await selectStaleOption('lt-bereave');

    expect(overridesJson()).toEqual([{ leave_type_id: 'lt-bereave', mode: 'include' }]);
  });

  it('When no other leave types exist / Then the picker says so', async () => {
    mockTypes.getAll.mockResolvedValue({ data: [ANNUAL, SICK] });
    await startCustomising();

    fireEvent.click(screen.getByRole('button', { name: /add leave type/i }));

    expect(await screen.findByText('No other leave types available')).toBeInTheDocument();
  });

  it('When customising a second time / Then the leave type list is not fetched again', async () => {
    await startCustomising();
    expect(mockTypes.getAll).toHaveBeenCalledTimes(1);

    // Switching employment type closes customisation; reopening must reuse the catalog.
    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));
    fireEvent.click(await screen.findByRole('button', { name: /customize for this employee/i }));

    await screen.findByRole('button', { name: /add leave type/i });
    expect(mockTypes.getAll).toHaveBeenCalledTimes(1);
  });

  it('When the leave type list cannot be loaded / Then an error is shown', async () => {
    mockTypes.getAll.mockRejectedValue(new Error('boom'));
    render(<Host />);
    fireEvent.click(await screen.findByRole('button', { name: /customize for this employee/i }));

    expect(await screen.findByText(/Could not load the leave type list/i)).toBeInTheDocument();
  });
});

describe('Given employee-specific types staged before the catalog is loaded', () => {
  it('When an added type is also in the inherited list / Then it is named from the inherited list', async () => {
    render(<Host initialOverrides={[{ leave_type_id: 'lt-annual', mode: 'include' }]} />);

    await waitFor(() => expect(screen.getAllByText('Annual Leave')).toHaveLength(2));
  });

  it('When an added type is in neither list / Then a generic name is shown instead of an id', async () => {
    render(<Host initialOverrides={[{ leave_type_id: 'lt-unknown', mode: 'include' }]} />);

    expect(await screen.findByText('Leave type')).toBeInTheDocument();
    expect(screen.queryByText('lt-unknown')).not.toBeInTheDocument();
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

  it('When the notice is dismissed / Then it goes away', async () => {
    render(<Host initialOverrides={[{ leave_type_id: 'lt-bereave', mode: 'include' }]} />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));
    await screen.findByText(/employee-specific changes were cleared/i);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText(/employee-specific changes were cleared/i)).not.toBeInTheDocument();
  });

  it('When it changes with nothing staged / Then no notice is shown', async () => {
    render(<Host />);
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));

    await waitFor(() => expect(mockConfig.getForEmploymentType).toHaveBeenCalledWith('et-contract'));
    expect(screen.queryByText(/employee-specific changes were cleared/i)).not.toBeInTheDocument();
  });
});

describe('Given the employment type name is not available', () => {
  it('When the type is configured / Then generic labels are used for the source', async () => {
    render(<Host noName />);

    expect(await screen.findByText('Employment type', { selector: 'span.text-slate-300' })).toBeInTheDocument();
  });

  it('When customising / Then the unchanged-default copy uses a generic label', async () => {
    render(<Host noName />);
    fireEvent.click(await screen.findByRole('button', { name: /customize for this employee/i }));

    expect(await screen.findByText(/the employment type default is unchanged/i)).toBeInTheDocument();
  });

  it('When the type is unconfigured / Then the copy and defaults link say "this employment type"', async () => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
    render(<Host noName onConfigureEmploymentTypeDefaults={vi.fn()} />);

    expect(await screen.findByText(/No leave types are configured for this employment type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set defaults for this employment type' })).toBeInTheDocument();
  });
});

describe('Given the API omits the leave type list', () => {
  it('When the type is marked configured / Then it is treated as an empty list, not a crash', async () => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: true });
    render(<Host />);

    expect(await screen.findByText('0 leave types')).toBeInTheDocument();
  });

  it('When exactly one type applies / Then the count is singular', async () => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [ANNUAL] });
    render(<Host />);

    expect(await screen.findByText('1 leave type')).toBeInTheDocument();
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

  const renderUnconfigured = async (props: React.ComponentProps<typeof Host> = {}) => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
    render(<Host {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/Every active leave type will apply/i)).toBeInTheDocument(),
    );
  };

  it('When "Configure Leave Types" is clicked / Then only the leave-types callback fires', async () => {
    const onConfigureLeaveTypes = vi.fn();
    const onConfigureEmploymentTypeDefaults = vi.fn();
    await renderUnconfigured({ onConfigureLeaveTypes, onConfigureEmploymentTypeDefaults });

    fireEvent.click(screen.getByRole('button', { name: 'Configure Leave Types' }));

    expect(onConfigureLeaveTypes).toHaveBeenCalledTimes(1);
    expect(onConfigureEmploymentTypeDefaults).not.toHaveBeenCalled();
  });

  it('When the employment-type defaults link is clicked / Then only the defaults callback fires, and the link names the type', async () => {
    const onConfigureLeaveTypes = vi.fn();
    const onConfigureEmploymentTypeDefaults = vi.fn();
    await renderUnconfigured({ onConfigureLeaveTypes, onConfigureEmploymentTypeDefaults });

    fireEvent.click(screen.getByRole('button', { name: 'Set defaults for Full Time' }));

    expect(onConfigureEmploymentTypeDefaults).toHaveBeenCalledTimes(1);
    expect(onConfigureLeaveTypes).not.toHaveBeenCalled();
  });

  it('When only the leave-types callback is provided / Then the defaults link is not rendered', async () => {
    await renderUnconfigured({ onConfigureLeaveTypes: vi.fn() });

    expect(screen.getByRole('button', { name: 'Configure Leave Types' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set defaults for/i })).not.toBeInTheDocument();
  });

  it('When only the defaults callback is provided / Then the leave-types link is not rendered', async () => {
    await renderUnconfigured({ onConfigureEmploymentTypeDefaults: vi.fn() });

    expect(screen.getByRole('button', { name: 'Set defaults for Full Time' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure Leave Types' })).not.toBeInTheDocument();
  });

  it('When the viewer cannot manage leave / Then neither configuration link is rendered', async () => {
    await renderUnconfigured({
      canManageLeave: false,
      onConfigureLeaveTypes: vi.fn(),
      onConfigureEmploymentTypeDefaults: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Configure Leave Types' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set defaults for/i })).not.toBeInTheDocument();
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

  it('When Retry is clicked and the read succeeds / Then the structure is shown', async () => {
    mockConfig.getForEmploymentType.mockRejectedValueOnce(new Error('boom'));
    render(<Host />);
    await screen.findByText(/Could not load the leave structure/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Annual Leave')).toBeInTheDocument();
    expect(screen.queryByText(/Could not load the leave structure/i)).not.toBeInTheDocument();
    expect(mockConfig.getForEmploymentType).toHaveBeenCalledTimes(2);
  });
});
