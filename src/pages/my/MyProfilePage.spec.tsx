import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * MyProfilePage — BDD specs.
 *
 * The split that matters: fields an employee may change are inputs, fields HR
 * owns are shown but not editable. Rendering an HR-owned field as an input
 * would produce a form that fails on save, since the backend refuses anything
 * outside its allow-list.
 */

vi.mock('../../services/meService', () => ({
    meService: { updateMyProfile: vi.fn() },
}));

vi.mock('../../services/peopleService', () => ({
    peopleApi: { getMe: vi.fn() },
}));

vi.mock('@so360/design-system', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import MyProfilePage from './MyProfilePage';
import { meService } from '../../services/meService';
import { peopleApi } from '../../services/peopleService';
import { toast } from '@so360/design-system';

const ME = {
    id: 'p1',
    full_name: 'Me Myself',
    email: 'me@example.com',
    phone: '+100',
    job_title: 'Engineer',
    employee_id: 'EMP-1',
    date_of_joining: '2024-03-01',
    emergency_contact: 'Kin 999',
};

beforeEach(() => {
    vi.clearAllMocks();
    (peopleApi.getMe as any).mockResolvedValue(ME);
    (meService.updateMyProfile as any).mockResolvedValue({ updated: true, fields: ['phone'] });
});

describe('Given an employee opening their profile', () => {
    it('When it loads / Then HR-owned details are shown', async () => {
        render(<MyProfilePage />);

        await waitFor(() => expect(screen.getByText('Me Myself')).toBeInTheDocument());
        expect(screen.getByText('Engineer')).toBeInTheDocument();
        expect(screen.getByText('EMP-1')).toBeInTheDocument();
        expect(screen.getByText('2024-03-01')).toBeInTheDocument();
    });

    it('When it loads / Then HR-owned details are NOT editable', async () => {
        // Showing them as inputs would invite a save the backend refuses.
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByText('Me Myself')).toBeInTheDocument());

        expect(screen.queryByDisplayValue('Engineer')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('me@example.com')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Me Myself')).not.toBeInTheDocument();
    });

    it('When it loads / Then self-editable fields are pre-filled inputs', async () => {
        render(<MyProfilePage />);

        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());
        expect(screen.getByDisplayValue('Kin 999')).toBeInTheDocument();
    });

    it('When a field is missing / Then a dash is shown rather than blank', async () => {
        (peopleApi.getMe as any).mockResolvedValue({ ...ME, job_title: null });
        render(<MyProfilePage />);

        await waitFor(() => expect(screen.getByText('Me Myself')).toBeInTheDocument());
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
});

describe('Given an employee saving their contact details', () => {
    it('When they save / Then only self-editable fields are sent', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());

        fireEvent.change(screen.getByDisplayValue('+100'), { target: { value: '+999' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(meService.updateMyProfile).toHaveBeenCalled());
        const payload = (meService.updateMyProfile as any).mock.calls[0][0];

        expect(payload.phone).toBe('+999');
        expect(payload).not.toHaveProperty('job_title');
        expect(payload).not.toHaveProperty('email');
        expect(payload).not.toHaveProperty('full_name');
    });

    it('When the save succeeds / Then it is confirmed', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile updated'));
    });

    it('When the backend refuses / Then the reason is shown', async () => {
        (meService.updateMyProfile as any).mockRejectedValue(
            new Error('These fields cannot be changed from your profile: cost_rate'),
        );
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'These fields cannot be changed from your profile: cost_rate',
            ),
        );
    });
});

describe('Given the profile cannot be loaded', () => {
    it('When the account has no employee record / Then the reason is surfaced', async () => {
        (peopleApi.getMe as any).mockRejectedValue(
            new Error('No employee profile found for your account.'),
        );

        render(<MyProfilePage />);

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'No employee profile found for your account.',
            ),
        );
    });
});

describe('Given an emergency contact stored as structured data', () => {
    it('When it is an object / Then it is rendered as text rather than [object Object]', async () => {
        (peopleApi.getMe as any).mockResolvedValue({
            ...ME,
            emergency_contact: { name: 'Kin', phone: '999' },
        });

        render(<MyProfilePage />);

        await waitFor(() =>
            expect(screen.getByDisplayValue(/"name":"Kin"/)).toBeInTheDocument(),
        );
    });

    it('When it is absent / Then the field is empty rather than showing null', async () => {
        (peopleApi.getMe as any).mockResolvedValue({ ...ME, emergency_contact: null });

        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());

        expect(screen.getByPlaceholderText(/name and number/i)).toHaveValue('');
    });

    it('When it is edited / Then the new value is submitted', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('Kin 999')).toBeInTheDocument());

        fireEvent.change(screen.getByDisplayValue('Kin 999'), {
            target: { value: 'Next of Kin 111' },
        });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(meService.updateMyProfile).toHaveBeenCalled());
        expect((meService.updateMyProfile as any).mock.calls[0][0].emergency_contact)
            .toBe('Next of Kin 111');
    });

    it('When the phone is absent / Then the input starts empty', async () => {
        (peopleApi.getMe as any).mockResolvedValue({ ...ME, phone: null });

        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByText('Me Myself')).toBeInTheDocument());
    });
});
