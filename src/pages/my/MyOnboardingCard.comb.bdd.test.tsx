import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../services/onboardingService', async () => {
    const actual = await vi.importActual<any>('../../services/onboardingService');
    return { ...actual, myOnboardingApi: { get: vi.fn(), completeItem: vi.fn(), uploadItemDocument: vi.fn() } };
});

import MyOnboardingCard from './MyOnboardingCard';
import { myOnboardingApi } from '../../services/onboardingService';

const api = myOnboardingApi as any;
const instance = { id: 'i1', person_id: 'p1', template_id: 't1', status: 'in_progress', started_at: '2026-08-20T09:00:00.000Z', completed_at: null };
const items = [
    { id: 'a', title: 'Read the handbook', item_type: 'task', assignee_role: 'employee', sort_order: 0, is_required: true, status: 'done', due_date: null },
    { id: 'b', title: 'Set up workstation', item_type: 'task', assignee_role: 'employee', sort_order: 1, is_required: true, status: 'pending', due_date: null },
    { id: 'c', title: 'Sign contract', item_type: 'e_sign', assignee_role: 'employee', sort_order: 2, is_required: true, status: 'pending', due_date: null },
    { id: 'd', title: 'Upload passport', item_type: 'document_upload', assignee_role: 'employee', sort_order: 3, is_required: true, status: 'pending', due_date: null },
];

const renderCard = () => render(<MemoryRouter><MyOnboardingCard /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ instance, items });
    api.completeItem.mockResolvedValue({});
    api.uploadItemDocument.mockResolvedValue({});
});

describe('Given MyOnboardingCard on Comb primitives', () => {
    it('When there is no instance / Then nothing renders', async () => {
        api.get.mockResolvedValue({ instance: null, items: [] });
        const { container } = renderCard();
        await waitFor(() => expect(api.get).toHaveBeenCalled());
        expect(container.firstChild).toBeNull();
    });

    it('When steps load / Then the title and progress count show', async () => {
        renderCard();
        await waitFor(() => expect(screen.getByText('Your onboarding')).toBeInTheDocument());
        expect(screen.getByText('1 of 4 steps done')).toBeInTheDocument();
    });

    it('When an e-sign step is pending / Then it shows Awaiting signature', async () => {
        renderCard();
        await waitFor(() => expect(screen.getByText('Awaiting signature')).toBeInTheDocument());
    });

    it('When Mark done is clicked / Then the complete API is called with the item id', async () => {
        renderCard();
        await waitFor(() => expect(screen.getByText('Mark done')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Mark done'));
        await waitFor(() => expect(api.completeItem).toHaveBeenCalledWith('b'));
    });

    it('When Attach is clicked / Then name and link fields appear with Cancel', async () => {
        renderCard();
        await waitFor(() => expect(screen.getByText('Attach')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Attach'));
        expect(screen.getByLabelText('File name')).toBeInTheDocument();
        expect(screen.getByLabelText('Link to the file')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
});
