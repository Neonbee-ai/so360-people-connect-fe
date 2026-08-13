/**
 * PersonPicker — BDD specs.
 *
 * Replaces the inline "type at least one character before anything appears"
 * person inputs that were copy-pasted across the Reviews and Feedback modals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import PersonPicker from './PersonPicker';

const PEOPLE = [
    { id: 'p1', full_name: 'Alice Anderson', job_title: 'Engineer' },
    { id: 'p2', full_name: 'Aswin Shaji', job_title: 'Developer' },
    { id: 'p3', full_name: 'Dhanooj B S' },
];

const onChange = vi.fn();

const renderPicker = (props: Partial<React.ComponentProps<typeof PersonPicker>> = {}) =>
    render(
        <PersonPicker
            options={PEOPLE}
            value=""
            onChange={onChange}
            data-testid="picker"
            {...props}
        />,
    );

const input = () => screen.getByTestId('picker').querySelector('input') as HTMLInputElement;

beforeEach(() => {
    onChange.mockReset();
});

describe('Given a PersonPicker with nothing selected', () => {
    describe('Given the field has not been interacted with', () => {
        it('When first rendered / Then no dropdown is shown', () => {
            renderPicker();
            expect(screen.queryByText(/Alice Anderson/)).not.toBeInTheDocument();
        });
    });

    describe('Given the user focuses the field without typing', () => {
        it('When focused / Then the full people list opens immediately', async () => {
            renderPicker();
            fireEvent.focus(input());

            await waitFor(() => expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument());
            expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument();
            expect(screen.getByText(/Dhanooj B S/)).toBeInTheDocument();
        });

        it('When clicked / Then the list opens as it does on focus', async () => {
            renderPicker();
            fireEvent.click(input());

            await waitFor(() => expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument());
        });

        it('When a person is picked without typing / Then their id is reported', async () => {
            renderPicker();
            fireEvent.focus(input());
            fireEvent.click(await screen.findByText(/Aswin Shaji/));

            expect(onChange).toHaveBeenCalledWith('p2', expect.objectContaining({ id: 'p2' }));
        });
    });

    describe('Given the user types a search term', () => {
        it('When typing / Then the list narrows to matches', async () => {
            renderPicker();
            fireEvent.focus(input());
            fireEvent.change(input(), { target: { value: 'alice' } });

            await waitFor(() => expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument());
            expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument();
        });

        it('When the term is cleared / Then the full list returns', async () => {
            renderPicker();
            fireEvent.focus(input());
            fireEvent.change(input(), { target: { value: 'alice' } });
            await waitFor(() => expect(screen.queryByText(/Aswin Shaji/)).not.toBeInTheDocument());

            fireEvent.change(input(), { target: { value: '' } });

            await waitFor(() => expect(screen.getByText(/Aswin Shaji/)).toBeInTheDocument());
        });

        it('When nothing matches / Then a no-matches state is shown', async () => {
            renderPicker();
            fireEvent.focus(input());
            fireEvent.change(input(), { target: { value: 'zzzz' } });

            await waitFor(() => expect(screen.getByText('No matches found')).toBeInTheDocument());
        });
    });

    describe('Given there are no options at all', () => {
        it('When focused / Then the configured empty message is shown', async () => {
            renderPicker({ options: [], emptyMessage: 'No eligible managers found' });
            fireEvent.focus(input());

            await waitFor(() =>
                expect(screen.getByText('No eligible managers found')).toBeInTheDocument(),
            );
        });
    });

    describe('Given the options are still loading', () => {
        it('When focused / Then a loading state is shown instead of an empty list', async () => {
            renderPicker({ options: [], loading: true });
            fireEvent.focus(input());

            await waitFor(() => expect(screen.getByText('Loading…')).toBeInTheDocument());
        });
    });

    describe('Given the picker is disabled', () => {
        it('When focused / Then no list opens and the reason is shown', () => {
            renderPicker({ disabled: true, disabledMessage: 'Select the person first.' });
            fireEvent.focus(input());

            expect(input()).toBeDisabled();
            expect(screen.queryByText(/Alice Anderson/)).not.toBeInTheDocument();
            expect(screen.getByText('Select the person first.')).toBeInTheDocument();
        });
    });

    describe('Given the list is open', () => {
        it('When Escape is pressed / Then the list closes', async () => {
            renderPicker();
            fireEvent.focus(input());
            await waitFor(() => expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument());

            fireEvent.keyDown(input(), { key: 'Escape' });

            await waitFor(() => expect(screen.queryByText(/Alice Anderson/)).not.toBeInTheDocument());
        });

        it('When a click lands outside / Then the list closes', async () => {
            renderPicker();
            fireEvent.focus(input());
            await waitFor(() => expect(screen.getByText(/Alice Anderson/)).toBeInTheDocument());

            fireEvent.mouseDown(document.body);

            await waitFor(() => expect(screen.queryByText(/Alice Anderson/)).not.toBeInTheDocument());
        });
    });
});

describe('Given a PersonPicker with a person already selected', () => {
    it('When rendered / Then the name is shown with a Clear control and no search box', () => {
        renderPicker({ value: 'p1' });

        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
        expect(screen.getByText('Clear')).toBeInTheDocument();
        expect(screen.getByTestId('picker').querySelector('input')).toBeNull();
    });

    it('When rendered / Then it offers no Edit action on the person record', () => {
        renderPicker({ value: 'p1' });

        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('When Clear is clicked / Then the selection is emptied without touching the record', () => {
        renderPicker({ value: 'p1' });
        fireEvent.click(screen.getByText('Clear'));

        expect(onChange).toHaveBeenCalledWith('');
    });
});
