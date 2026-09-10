/**
 * BDD specs — Employee Profile → Leave.
 *
 * The point of this tab is that HR can see WHY a leave type is available to an
 * employee — inherited from their employment type, or set for them specifically
 * — and change it without touching anyone else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../services/leaveConfigService', () => ({
    leaveConfigApi: {
        getForPerson: vi.fn(),
        setPersonOverride: vi.fn(),
        clearPersonOverride: vi.fn(),
    },
}));

vi.mock('../../services/leaveTypesService', () => ({
    leaveTypesApi: { getAll: vi.fn() },
}));

import PersonLeaveConfigTab from './PersonLeaveConfigTab';
import { leaveConfigApi } from '../../services/leaveConfigService';
import { leaveTypesApi } from '../../services/leaveTypesService';

const api = leaveConfigApi as any;
const typesApi = leaveTypesApi as any;

const PERSON = 'person-1';

function type(id: string, name: string, source = 'employment_type') {
    return {
        id,
        code: id.toUpperCase(),
        name,
        is_paid: true,
        accrual_type: 'annual',
        max_days_per_year: 12,
        color: null,
        source,
    };
}

function config(overrides: any = {}) {
    return {
        person_id: PERSON,
        employment_type: 'full_time',
        employment_type_master_id: 'm-1',
        inherits_all: false,
        leave_types: [type('annual', 'Annual Leave'), type('sick', 'Sick Leave')],
        excluded: [],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    api.getForPerson.mockResolvedValue(config());
    typesApi.getAll.mockResolvedValue({
        data: [
            { id: 'annual', name: 'Annual Leave', is_paid: true, max_days_per_year: 12 },
            { id: 'sick', name: 'Sick Leave', is_paid: true, max_days_per_year: 12 },
            { id: 'bereavement', name: 'Bereavement Leave', is_paid: true, max_days_per_year: 3 },
        ],
    });
});

describe('Given an employee inheriting from their employment type', () => {
    it('When the tab loads / Then each type is labelled with where it came from', async () => {
        render(<PersonLeaveConfigTab personId={PERSON} employmentTypeLabel="Full Time" />);

        expect(await screen.findByText('Annual Leave')).toBeInTheDocument();
        expect(screen.getAllByText('Employment Type').length).toBeGreaterThan(0);
    });

    it('Then the header names the employment type the configuration came from', async () => {
        render(<PersonLeaveConfigTab personId={PERSON} employmentTypeLabel="Full Time" />);

        await screen.findByText('Annual Leave');
        expect(screen.getByText(/Inherited from/i)).toBeInTheDocument();
        expect(screen.getByText('Full Time')).toBeInTheDocument();
    });
});

describe('Given the employment type has no configuration', () => {
    // The distinction that keeps existing orgs working: "not configured" means
    // everything applies, and the UI must not claim it was inherited.
    it('When the tab loads / Then it says every leave type applies, not that they were inherited', async () => {
        api.getForPerson.mockResolvedValue(
            config({
                inherits_all: true,
                leave_types: [type('annual', 'Annual Leave', 'org_default')],
            }),
        );

        render(<PersonLeaveConfigTab personId={PERSON} employmentTypeLabel="Full Time" />);

        expect(await screen.findByText(/no leave types configured/i)).toBeInTheDocument();
        expect(screen.queryByText(/Inherited from/i)).not.toBeInTheDocument();
    });
});

describe('Given an employee-specific addition', () => {
    it('When the tab loads / Then it is marked employee-specific, not inherited', async () => {
        api.getForPerson.mockResolvedValue(
            config({
                leave_types: [
                    type('annual', 'Annual Leave'),
                    type('bereavement', 'Bereavement Leave', 'employee'),
                ],
            }),
        );

        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        expect(await screen.findByText('Bereavement Leave')).toBeInTheDocument();
        expect(screen.getByText('Employee-specific')).toBeInTheDocument();
    });
});

describe('Given a withheld leave type', () => {
    beforeEach(() => {
        api.getForPerson.mockResolvedValue(
            config({ excluded: [type('casual', 'Casual Leave', 'employee')] }),
        );
    });

    it('When the tab loads / Then it appears in a withheld section', async () => {
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        expect(await screen.findByText('Casual Leave')).toBeInTheDocument();
        expect(screen.getByText('Withheld')).toBeInTheDocument();
    });

    // Hide-only removal is the whole contract — say so where HR can read it.
    it('Then the UI states that balances and history are preserved', async () => {
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        expect(
            await screen.findByText(/balances and history are preserved/i),
        ).toBeInTheDocument();
    });

    it('When restored / Then the override is cleared rather than flipped to include', async () => {
        api.clearPersonOverride.mockResolvedValue(config());
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        fireEvent.click(await screen.findByLabelText('Restore Casual Leave'));

        await waitFor(() =>
            expect(api.clearPersonOverride).toHaveBeenCalledWith(PERSON, 'casual'),
        );
        expect(api.setPersonOverride).not.toHaveBeenCalled();
    });
});

describe('Given HR edits one employee', () => {
    it('When a type is added / Then it is sent as an employee-level include', async () => {
        api.setPersonOverride.mockResolvedValue(config());
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        fireEvent.click(await screen.findByText('Bereavement Leave'));

        await waitFor(() =>
            expect(api.setPersonOverride).toHaveBeenCalledWith(PERSON, 'bereavement', 'include'),
        );
    });

    it('When a type is removed / Then it is an exclude on THIS employee, not an employment-type edit', async () => {
        api.setPersonOverride.mockResolvedValue(config());
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        fireEvent.click(await screen.findByLabelText('Remove Sick Leave'));

        await waitFor(() =>
            expect(api.setPersonOverride).toHaveBeenCalledWith(PERSON, 'sick', 'exclude'),
        );
    });

    it('When a save fails / Then the error is shown and the previous configuration stays on screen', async () => {
        api.setPersonOverride.mockRejectedValue(new Error('500'));
        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        fireEvent.click(await screen.findByLabelText('Remove Sick Leave'));

        expect(await screen.findByText(/configuration is unchanged/i)).toBeInTheDocument();
        expect(screen.getByText('Sick Leave')).toBeInTheDocument();
    });
});

describe('Given a user without configuration permission', () => {
    it('When the tab loads / Then the configuration is visible but no controls are offered', async () => {
        api.getForPerson.mockResolvedValue(
            config({ excluded: [type('casual', 'Casual Leave', 'employee')] }),
        );

        render(<PersonLeaveConfigTab personId={PERSON} canEdit={false} />);

        expect(await screen.findByText('Annual Leave')).toBeInTheDocument();
        expect(screen.queryByLabelText('Remove Sick Leave')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Restore Casual Leave')).not.toBeInTheDocument();
        expect(screen.queryByText(/Add for this employee only/i)).not.toBeInTheDocument();
    });
});

describe('Given the configuration cannot be loaded', () => {
    // An unreadable configuration must never render as "nothing applies".
    it('When the request fails / Then an error and a retry are shown, not an empty list', async () => {
        api.getForPerson.mockRejectedValue(new Error('network'));

        render(<PersonLeaveConfigTab personId={PERSON} canEdit />);

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
        expect(screen.queryByText(/No leave types apply/i)).not.toBeInTheDocument();
    });
});
