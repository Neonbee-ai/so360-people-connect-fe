import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';

/**
 * PersonLeaveConfigSection — BDD specs.
 *
 * The Leave Configuration block HR sees while creating an employee. What must
 * hold:
 *   - every active leave type is a checkbox, pre-ticked from the employment
 *     type's defaults, and choosing happens in place — the section never
 *     navigates away from the half-filled Add Person form
 *   - an UNCONFIGURED employment type means every type applies, so all start
 *     ticked rather than looking like "no leave"
 *   - ticking/unticking never edits the employment type; deviations are staged
 *     as per-person include/exclude overrides
 *   - when the org has no leave types yet, they can be created right here
 */

vi.mock('../../services/leaveConfigService', () => ({
  leaveConfigApi: { getForEmploymentType: vi.fn() },
}));

vi.mock('../../services/leaveTypesService', () => ({
  leaveTypesApi: { getAll: vi.fn(), create: vi.fn() },
}));

import PersonLeaveConfigSection, {
  type PendingLeaveOverride,
  leaveCodeFromName,
  validateDraft,
} from './PersonLeaveConfigSection';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { leaveTypesApi } from '../../services/leaveTypesService';

const mockConfig = leaveConfigApi as any;
const mockTypes = leaveTypesApi as any;

const ANNUAL = { id: 'lt-annual', code: 'AL', name: 'Annual Leave', is_paid: true, accrual_type: 'yearly', max_days_per_year: 18, color: '#10b981', source: 'employment_type' };
const SICK = { id: 'lt-sick', code: 'SL', name: 'Sick Leave', is_paid: true, accrual_type: 'yearly', max_days_per_year: 12, color: '#f59e0b', source: 'employment_type' };
const BEREAVE = { id: 'lt-bereave', code: 'BL', name: 'Bereavement Leave', is_active: true };

/** Test host: owns the staged overrides exactly as the Add Person form does. */
const Host: React.FC<{
  masterId?: string;
  canManageLeave?: boolean;
  canCreateLeaveTypes?: boolean;
  /** Omit the employment type's display name, as when it hasn't resolved yet. */
  noName?: boolean;
  initialOverrides?: PendingLeaveOverride[];
}> = ({
  masterId = 'et-full-time',
  canManageLeave = true,
  canCreateLeaveTypes = true,
  noName = false,
  initialOverrides = [],
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
        canCreateLeaveTypes={canCreateLeaveTypes}
      />
    </div>
  );
};

const overridesJson = () => JSON.parse(screen.getByTestId('overrides').textContent || '[]');
const box = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) }) as HTMLInputElement;
const row = (name: string) => box(name).closest('li')!;
const count = () => screen.getByTestId('leave-selected-count').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  // Full Time grants Annual + Sick; the org also has Bereavement.
  mockConfig.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [ANNUAL, SICK] });
  mockTypes.getAll.mockResolvedValue({ data: [ANNUAL, SICK, BEREAVE] });
  mockTypes.create.mockImplementation(async (p: any) => ({ id: `new-${p.code}`, ...p }));
});

// ============================================================================
describe('Given an employment type with configured default leave types', () => {
  it('When the section loads / Then every org leave type is a checkbox with the defaults ticked', async () => {
    render(<Host />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(box('Annual Leave').checked).toBe(true);
    expect(box('Sick Leave').checked).toBe(true);
    expect(box('Bereavement Leave').checked).toBe(false);
    expect(count()).toBe('2 of 3 selected');
    expect(screen.getByText(/Pre-selected from/)).toHaveTextContent('Pre-selected from Full Time.');
  });

  it('When it loads / Then defaults are labelled and entitlements shown', async () => {
    render(<Host />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(within(row('Annual Leave')).getByText('Default')).toBeInTheDocument();
    expect(within(row('Annual Leave')).getByText('18 days')).toBeInTheDocument();
    expect(within(row('Bereavement Leave')).queryByText('Default')).not.toBeInTheDocument();
    expect(within(row('Bereavement Leave')).queryByText(/days/)).not.toBeInTheDocument();
  });

  it('When nothing is touched / Then no overrides are staged and no Reset is offered', async () => {
    render(<Host />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(overridesJson()).toEqual([]);
    expect(screen.queryByRole('button', { name: /reset to/i })).not.toBeInTheDocument();
  });

  it('When a default is unticked / Then it is staged as an exclude and marked Removed', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sick Leave/ }));

    expect(overridesJson()).toEqual([{ leave_type_id: 'lt-sick', mode: 'exclude' }]);
    expect(box('Sick Leave').checked).toBe(false);
    expect(within(row('Sick Leave')).getByText('Removed')).toBeInTheDocument();
    expect(count()).toBe('1 of 3 selected');
  });

  it('When an unticked default is ticked again / Then the exclude is dropped', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sick Leave/ }));
    fireEvent.click(box('Sick Leave'));

    expect(overridesJson()).toEqual([]);
    expect(within(row('Sick Leave')).queryByText('Removed')).not.toBeInTheDocument();
  });

  it('When a non-default type is ticked / Then it is staged as an include and marked Added', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Bereavement Leave/ }));

    expect(overridesJson()).toEqual([{ leave_type_id: 'lt-bereave', mode: 'include' }]);
    expect(within(row('Bereavement Leave')).getByText('Added')).toBeInTheDocument();
  });

  it('When an added type is unticked again / Then the include is dropped', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Bereavement Leave/ }));
    fireEvent.click(box('Bereavement Leave'));

    expect(overridesJson()).toEqual([]);
  });

  it('When Reset is clicked / Then every employee-specific change is cleared', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sick Leave/ }));
    fireEvent.click(box('Bereavement Leave'));

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Full Time defaults' }));

    expect(overridesJson()).toEqual([]);
    expect(count()).toBe('2 of 3 selected');
  });

  it('When the employment type name is unknown / Then the source and Reset use generic labels', async () => {
    render(<Host noName />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sick Leave/ }));

    expect(screen.getByText(/Pre-selected from/)).toHaveTextContent('Pre-selected from This employment type.');
    expect(screen.getByRole('button', { name: 'Reset to employment type defaults' })).toBeInTheDocument();
  });

  it('When a default is missing from the active catalog / Then it is still listed', async () => {
    mockTypes.getAll.mockResolvedValue({ data: [SICK] });
    render(<Host />);

    expect(await screen.findByRole('checkbox', { name: /Annual Leave/ })).toBeChecked();
    expect(count()).toBe('2 of 2 selected');
  });

  it('When the API omits the default list / Then it is treated as no defaults, not a crash', async () => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: true });
    render(<Host />);

    await screen.findByRole('checkbox', { name: /Annual Leave/ });
    expect(count()).toBe('0 of 3 selected');
  });
});

// ============================================================================
describe('Given an employment type with NO leave defaults', () => {
  beforeEach(() => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
  });

  it('When the section loads / Then it says all types apply and all start ticked', async () => {
    render(<Host />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(screen.getByText(/Full Time has no leave defaults, so all leave types apply/)).toBeInTheDocument();
    expect(count()).toBe('3 of 3 selected');
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('When a type is unticked / Then it is excluded for this employee only', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Bereavement Leave/ }));

    expect(overridesJson()).toEqual([{ leave_type_id: 'lt-bereave', mode: 'exclude' }]);
    expect(within(row('Bereavement Leave')).getByText('Removed')).toBeInTheDocument();
  });

  it('When the employment type name is unknown / Then the copy stays grammatical', async () => {
    render(<Host noName />);

    expect(await screen.findByText(/This employment type has no leave defaults/)).toBeInTheDocument();
  });
});

// ============================================================================
describe('Given the employment type is changed', () => {
  it('When changes were staged / Then they are cleared AND the user is told, and can dismiss it', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sick Leave/ }));
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: true, leave_types: [SICK] });

    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));

    await waitFor(() => expect(overridesJson()).toEqual([]));
    expect(await screen.findByText(/employee-specific changes were cleared/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/employee-specific changes were cleared/i)).not.toBeInTheDocument();
  });

  it('When nothing was staged / Then no notice is shown', async () => {
    render(<Host />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    fireEvent.click(screen.getByRole('button', { name: /switch to contract/i }));

    await waitFor(() => expect(mockConfig.getForEmploymentType).toHaveBeenCalledWith('et-contract'));
    await screen.findByRole('checkbox', { name: /Annual Leave/ });
    expect(screen.queryByText(/employee-specific changes were cleared/i)).not.toBeInTheDocument();
  });
});

// ============================================================================
describe('Given the viewer cannot manage leave', () => {
  it('When the section loads / Then the list is read-only and says so', async () => {
    render(<Host canManageLeave={false} initialOverrides={[{ leave_type_id: 'lt-sick', mode: 'exclude' }]} />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(box('Annual Leave')).toBeDisabled();
    expect(screen.getByText(/can view but not change/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new leave type/i })).not.toBeInTheDocument();
  });
});

// ============================================================================
describe('Given no employment type is selected yet', () => {
  it('When the section renders / Then it asks for one and loads nothing', () => {
    render(<Host masterId="" />);

    expect(screen.getByText('Select an Employment Type above to load its leave defaults.')).toBeInTheDocument();
    expect(mockConfig.getForEmploymentType).not.toHaveBeenCalled();
    expect(mockTypes.getAll).not.toHaveBeenCalled();
  });
});

// ============================================================================
describe('Given the leave data cannot be loaded', () => {
  it('When the read fails / Then an error with Retry is shown, and Retry recovers', async () => {
    mockTypes.getAll.mockRejectedValueOnce(new Error('boom'));
    render(<Host />);

    expect(await screen.findByText(/Could not load the leave types/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('checkbox', { name: /Annual Leave/ })).toBeInTheDocument();
    expect(screen.queryByText(/Could not load the leave types/i)).not.toBeInTheDocument();
  });

  it('When a load is in flight / Then a loading message is shown', async () => {
    mockConfig.getForEmploymentType.mockReturnValue(new Promise(() => {}));
    render(<Host />);

    expect(await screen.findByText(/Loading leave configuration/)).toBeInTheDocument();
  });
});

// ============================================================================
describe('Given the org has no leave types at all', () => {
  beforeEach(() => {
    mockConfig.getForEmploymentType.mockResolvedValue({ configured: false, leave_types: [] });
    mockTypes.getAll.mockResolvedValue({ data: [] });
  });

  it('When the viewer cannot create leave types / Then a read-only note says the person can still be saved', async () => {
    render(<Host canCreateLeaveTypes={false} />);

    expect(await screen.findByText(/Ask an HR admin to add them/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create selected/i })).not.toBeInTheDocument();
  });

  it('When the viewer can create types but not manage this employee\'s leave / Then creating is not offered', async () => {
    render(<Host canManageLeave={false} canCreateLeaveTypes />);

    expect(await screen.findByText(/Ask an HR admin to add them/)).toBeInTheDocument();
  });

  it('When the list API omits data / Then it is treated as empty', async () => {
    mockTypes.getAll.mockResolvedValue({});
    render(<Host />);

    expect(await screen.findByText(/no leave types yet/i)).toBeInTheDocument();
  });

  it('When the section loads / Then common types are offered, unticked, and saving is optional', async () => {
    render(<Host />);

    expect(await screen.findByText(/no leave types yet/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Annual Leave' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Annual Leave days per year' })).toHaveValue('18');
    expect(screen.queryByRole('textbox', { name: 'Unpaid Leave days per year' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create selected (0)' })).toBeDisabled();
    expect(screen.getByText(/You can skip this/)).toBeInTheDocument();
  });

  it('When presets are picked and created / Then they become ticked rows in place', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Annual Leave' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Annual Leave days per year' }), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unpaid Leave' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create selected (2)' }));

    await screen.findByTestId('leave-selected-count');
    expect(mockTypes.create).toHaveBeenCalledWith({ code: 'ANNUAL', name: 'Annual Leave', is_paid: true, max_days_per_year: 20, is_active: true });
    expect(mockTypes.create).toHaveBeenCalledWith({ code: 'UNPAID', name: 'Unpaid Leave', is_paid: false, is_active: true });
    expect(box('Annual Leave')).toBeChecked();
    expect(box('Unpaid Leave')).toBeChecked();
    expect(count()).toBe('2 of 2 selected');
    // Nothing to stage: an unconfigured type already grants every new type.
    expect(overridesJson()).toEqual([]);
  });

  it('When a preset is unticked before creating / Then it is not created', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sick Leave' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sick Leave' }));

    expect(screen.getByRole('button', { name: 'Create selected (0)' })).toBeDisabled();
  });

  it('When creation is in progress / Then the button shows it and is disabled', async () => {
    mockTypes.create.mockReturnValue(new Promise(() => {}));
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sick Leave' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create selected (1)' }));

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
  });

  it('When a picked preset has invalid days / Then nothing is created and the row explains why', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sick Leave' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Sick Leave days per year' }), { target: { value: '-2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create selected (1)' }));

    expect(await screen.findByText('Days per year must be 0 or more.')).toBeInTheDocument();
    expect(mockTypes.create).not.toHaveBeenCalled();
  });

  it('When every create fails / Then each row shows its error and stays picked for a retry', async () => {
    mockTypes.create.mockRejectedValue(new Error("Leave type with code 'SICK' already exists"));
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sick Leave' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create selected (1)' }));

    expect(await screen.findByText("Leave type with code 'SICK' already exists")).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Sick Leave' })).toBeChecked();

    mockTypes.create.mockImplementation(async (p: any) => ({ id: 'new-sick', ...p }));
    fireEvent.click(screen.getByRole('button', { name: 'Create selected (1)' }));

    expect(await screen.findByTestId('leave-selected-count')).toHaveTextContent('1 of 1 selected');
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
  });

  it('When some creates fail / Then the rest are listed and the failures reported above them', async () => {
    mockTypes.create.mockImplementation(async (p: any) => {
      if (p.code === 'SICK') throw new Error('');
      return { id: `new-${p.code}`, ...p };
    });
    render(<Host />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Annual Leave' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sick Leave' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create selected (2)' }));

    expect(await screen.findByText("Couldn't create Sick Leave: Could not create this leave type.")).toBeInTheDocument();
    expect(box('Annual Leave')).toBeChecked();
  });

  it('When a custom type is added / Then it is created with a derived code and listed ticked', async () => {
    render(<Host />);
    const name = await screen.findByRole('textbox', { name: 'New leave type name' });
    fireEvent.change(name, { target: { value: 'Work From Home' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'New leave type days per year' }), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paid' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('checkbox', { name: /Work From Home/ })).toBeChecked();
    expect(mockTypes.create).toHaveBeenCalledWith({ code: 'WORK_FROM_HOME', name: 'Work From Home', is_paid: false, max_days_per_year: 24, is_active: true });
  });

  it('When a custom type has no name / Then it is not created and the field explains why', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(mockTypes.create).not.toHaveBeenCalled();
  });

  it('When a custom create fails / Then the backend message is shown under the form', async () => {
    mockTypes.create.mockRejectedValue('network down');
    render(<Host />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'New leave type name' }), { target: { value: 'Comp Off' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Could not create this leave type.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New leave type name' })).toHaveValue('Comp Off');
  });
});

// ============================================================================
describe('Given leave types exist and the viewer can create more', () => {
  it('When "New leave type" is used / Then the form opens in place and closes after a successful add', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('button', { name: /new leave type/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New leave type name' }), { target: { value: 'Comp Off' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Full Time's defaults are configured, so a type created for this hire is
    // staged as an include — otherwise it would appear unticked.
    expect(await screen.findByRole('checkbox', { name: /Comp Off/ })).toBeChecked();
    expect(overridesJson()).toEqual([{ leave_type_id: 'new-COMP_OFF', mode: 'include' }]);
    expect(screen.queryByRole('textbox', { name: 'New leave type name' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new leave type/i })).toBeInTheDocument();
  });

  it('When the viewer cannot create leave types / Then "New leave type" is not offered', async () => {
    render(<Host canCreateLeaveTypes={false} />);
    await screen.findByRole('checkbox', { name: /Annual Leave/ });

    expect(screen.queryByRole('button', { name: /new leave type/i })).not.toBeInTheDocument();
  });
});

// ============================================================================
describe('leaveCodeFromName', () => {
  it.each([
    ['Annual Leave', 'ANNUAL'],
    ['Work From Home', 'WORK_FROM_HOME'],
    ['  sick-leave  ', 'SICK'],
    ['Leave', 'LEAVE'],
    ['Extraordinarily Long Leave Name For Testing', 'EXTRAORDINARILY_LONG'],
    ['!!!', ''],
  ])('Given "%s" / Then the code is "%s"', (name, code) => {
    expect(leaveCodeFromName(name)).toBe(code);
  });
});

describe('validateDraft', () => {
  it.each([
    [{ name: 'Sick Leave', days: '12', isPaid: true }, null],
    [{ name: 'Unpaid Leave', days: '', isPaid: false }, null],
    [{ name: '   ', days: '', isPaid: true }, 'Enter a name.'],
    [{ name: 'x'.repeat(101), days: '', isPaid: true }, 'Keep the name under 100 characters.'],
    [{ name: '!!!', days: '', isPaid: true }, 'Use letters or numbers in the name.'],
    [{ name: 'Sick Leave', days: '-1', isPaid: true }, 'Days per year must be 0 or more.'],
    [{ name: 'Sick Leave', days: 'abc', isPaid: true }, 'Days per year must be 0 or more.'],
  ])('Given %o / Then the result is %s', (draft, expected) => {
    expect(validateDraft(draft)).toBe(expected);
  });
});
