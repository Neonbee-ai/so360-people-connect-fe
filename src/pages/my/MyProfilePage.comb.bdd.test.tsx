import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/meService', () => ({ meService: { updateMyProfile: vi.fn() } }));
vi.mock('../../services/peopleService', () => ({ peopleApi: { getMe: vi.fn() } }));

import MyProfilePage from './MyProfilePage';
import { meService } from '../../services/meService';
import { peopleApi } from '../../services/peopleService';

const ME = { id: 'p1', full_name: 'Me Myself', email: 'me@example.com', phone: '+100', job_title: 'Engineer', employee_id: 'EMP-1', date_of_joining: '2024-03-01', emergency_contact: 'Kin 999' };

beforeEach(() => {
    vi.clearAllMocks();
    (peopleApi.getMe as any).mockResolvedValue(ME);
    (meService.updateMyProfile as any).mockResolvedValue({ updated: true, fields: ['phone'] });
});

describe('Given MyProfilePage on the Comb dashboard template', () => {
    it('When it renders / Then the My Profile heading shows', async () => {
        render(<MyProfilePage />);
        expect(screen.getByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
        await waitFor(() => expect(peopleApi.getMe).toHaveBeenCalled());
    });

    it('When it loads / Then employment details appear as read-only text', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument());
        expect(screen.getByText('EMP-1')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Engineer')).not.toBeInTheDocument();
    });

    it('When it loads / Then phone and emergency contact are prefilled fields', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());
        expect(screen.getByDisplayValue('Kin 999')).toBeInTheDocument();
    });

    it('When the phone is edited and saved / Then updateMyProfile is called', async () => {
        render(<MyProfilePage />);
        await waitFor(() => expect(screen.getByDisplayValue('+100')).toBeInTheDocument());
        fireEvent.change(screen.getByDisplayValue('+100'), { target: { value: '+200' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        await waitFor(() => expect(meService.updateMyProfile).toHaveBeenCalled());
        expect((meService.updateMyProfile as any).mock.calls[0][0]).toMatchObject({ phone: '+200' });
    });
});
