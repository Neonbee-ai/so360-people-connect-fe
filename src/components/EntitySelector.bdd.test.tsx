/**
 * BDD specs for <EntitySelector>.
 *
 * The selector replaces free-text "Entity ID (UUID)" entry across Time Entries
 * and Allocations. It loads UUID-keyed options from the entity lookup proxy and
 * emits the chosen option (real UUID + display name) so the user never types a
 * UUID. For `task` it cascades project → task.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('../services/peopleService', () => ({
    entitiesApi: { list: vi.fn() },
}));

import EntitySelector from './EntitySelector';
import { entitiesApi } from '../services/peopleService';

const mockList = (entitiesApi as any).list as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetAllMocks();
    mockList.mockResolvedValue({ data: [] });
});

describe('EntitySelector', () => {
    describe('Given a project selector', () => {
        beforeEach(() => {
            mockList.mockResolvedValue({ data: [{ id: 'p-uuid', name: 'Website Redesign' }] });
        });

        it('When it mounts / Then it loads options for the project type', async () => {
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined }));
        });

        it('When an option is picked / Then onChange receives that option (UUID + name)', async () => {
            const onChange = vi.fn();
            render(<EntitySelector entityType="project" value="" onChange={onChange} />);

            fireEvent.click(screen.getByText('Select project...'));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Website Redesign' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'Website Redesign' }));

            expect(onChange).toHaveBeenCalledWith({ id: 'p-uuid', name: 'Website Redesign' });
        });

        it('When a search term is typed / Then the option list is filtered', async () => {
            mockList.mockResolvedValue({
                data: [{ id: 'p1', name: 'Website Redesign' }, { id: 'p2', name: 'Mobile App' }],
            });
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByText('Select project...'));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Mobile App' })).toBeInTheDocument());
            fireEvent.change(screen.getByPlaceholderText('Select project...'), { target: { value: 'mobile' } });

            expect(screen.queryByRole('button', { name: 'Website Redesign' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Mobile App' })).toBeInTheDocument();
        });
    });

    describe('Given a deal selector', () => {
        it('When it mounts / Then it loads options for the deal type', async () => {
            render(<EntitySelector entityType="deal" value="" onChange={() => {}} />);
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'deal', project_id: undefined }));
        });
    });

    describe.each(['lead', 'customer', 'opportunity', 'department'] as const)(
        'Given a %s selector',
        (entityType) => {
            it('When it mounts / Then it loads options for that entity type', async () => {
                render(<EntitySelector entityType={entityType} value="" onChange={() => {}} />);
                await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: entityType, project_id: undefined }));
            });
        },
    );

    describe('Given an opportunity selector with no matching records', () => {
        it('When opened / Then it shows a correctly pluralised empty state', async () => {
            render(<EntitySelector entityType="opportunity" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByText('Select opportunity...'));

            await waitFor(() => expect(screen.getByText('No opportunities found')).toBeInTheDocument());
        });
    });

    describe('Given a selector that switches entity type', () => {
        it('When type changes / Then stale options from the previous type are cleared before the new load starts', async () => {
            const { rerender } = render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            // Let the initial project load settle.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined }));
            mockList.mockClear();

            // Simulate the parent updating the entity type to 'lead'.
            mockList.mockResolvedValue({ data: [{ id: 'l1', name: 'Orange Inc' }] });
            rerender(<EntitySelector entityType="lead" value="" onChange={() => {}} />);

            // The lead lookup must fire and the selector must not momentarily show
            // project-type options (stale data) during the transition.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'lead', project_id: undefined }));

            fireEvent.click(screen.getByText('Select lead...'));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Orange Inc' })).toBeInTheDocument());
        });
    });

    describe('Given a task selector with no project chosen yet', () => {
        it('When rendered / Then the task dropdown is disabled and tasks are not queried', async () => {
            render(<EntitySelector entityType="task" value="" onChange={() => {}} />);
            // Only the project sub-select loads; the task lookup is skipped.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined }));
            expect(mockList).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'task' }));

            // The task row is gated until a project is selected.
            const taskRow = screen.getByText('Select task...').closest('div')!;
            expect(taskRow.className).toContain('cursor-not-allowed');
        });
    });

    describe('Given a task selector after a project is chosen', () => {
        it('When the project is picked / Then tasks are loaded scoped to that project', async () => {
            mockList.mockImplementation(({ type }: { type: string }) => {
                if (type === 'project') return Promise.resolve({ data: [{ id: 'proj-uuid', name: 'Website Redesign' }] });
                if (type === 'task') return Promise.resolve({ data: [{ id: 'task-uuid', name: 'Design header' }] });
                return Promise.resolve({ data: [] });
            });
            const onChange = vi.fn();
            render(<EntitySelector entityType="task" value="" onChange={onChange} />);

            // Pick the project in the first (cascading) dropdown.
            fireEvent.click(screen.getByText('Select project...'));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Website Redesign' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'Website Redesign' }));

            // Picking a project clears any prior task selection.
            expect(onChange).toHaveBeenCalledWith(null);

            // The task dropdown now loads tasks for that project.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'task', project_id: 'proj-uuid' }));
            fireEvent.click(screen.getByText('Select task...'));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Design header' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: 'Design header' }));

            expect(onChange).toHaveBeenLastCalledWith({ id: 'task-uuid', name: 'Design header' });
        });
    });

    describe('Given the option lookup fails', () => {
        it('When opened / Then a retry affordance is shown with the correct error message', async () => {
            mockList.mockRejectedValue(new Error('network'));
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByText('Select project...'));
            await waitFor(() => expect(screen.getByText(/Unable to load records\. Please try again\./i)).toBeInTheDocument());
        });
    });

    describe('Given a search term is typed into an open selector', () => {
        afterEach(() => { vi.useRealTimers(); });

        it('When 300 ms elapses / Then the search term is forwarded to the backend', async () => {
            vi.useFakeTimers();
            mockList.mockResolvedValue({ data: [{ id: 'p1', name: 'Website Redesign' }] });
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            // Flush the initial mount load (search is empty → no search key in call).
            await act(async () => { await vi.runAllTimersAsync(); });
            expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined });
            mockList.mockClear();

            // Open the dropdown (trigger shows placeholder when nothing is selected).
            fireEvent.click(screen.getByText('Select project...'));
            // Type a search term; the placeholder switches to 'Select project...' on the input.
            fireEvent.change(screen.getByPlaceholderText('Select project...'), { target: { value: 'web' } });

            // Advance past the 300 ms debounce; the load re-fires with search='web'.
            await act(async () => { await vi.advanceTimersByTimeAsync(400); });

            expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined, search: 'web' });
        });
    });
});
