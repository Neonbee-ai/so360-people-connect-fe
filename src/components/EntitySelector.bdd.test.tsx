/**
 * BDD specs for <EntitySelector>.
 *
 * The selector replaces free-text "Entity ID (UUID)" entry across Time Entries
 * and Allocations. It loads UUID-keyed options from the entity lookup proxy and
 * emits the chosen option (real UUID + display name) so the user never types a
 * UUID. For `task` it cascades project → task.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

            fireEvent.click(screen.getByPlaceholderText('Select project...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Website Redesign' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('option', { name: 'Website Redesign' }));

            expect(onChange).toHaveBeenCalledWith({ id: 'p-uuid', name: 'Website Redesign' });
        });

        it('When a search term is typed / Then it is forwarded to the backend and the list shows the results', async () => {
            mockList.mockImplementation(({ search }: { search?: string }) =>
                Promise.resolve({
                    data: search
                        ? [{ id: 'p2', name: 'Mobile App' }]
                        : [{ id: 'p1', name: 'Website Redesign' }, { id: 'p2', name: 'Mobile App' }],
                }),
            );
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByPlaceholderText('Select project...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Website Redesign' })).toBeInTheDocument());
            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mobile' } });

            await waitFor(() => expect(screen.queryByRole('option', { name: 'Website Redesign' })).not.toBeInTheDocument());
            expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined, search: 'mobile' });
            expect(screen.getByRole('option', { name: 'Mobile App' })).toBeInTheDocument();
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

            fireEvent.click(screen.getByPlaceholderText('Select opportunity...'));

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

            fireEvent.click(screen.getByPlaceholderText('Select lead...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Orange Inc' })).toBeInTheDocument());
        });

        it('When the stale response resolves AFTER the fresh one / Then only fresh data is shown (race condition fix)', async () => {
            // Simulate: project request is slow, lead request is fast.
            // If the stale (project) response resolves last, it must NOT overwrite the lead data.
            let resolveProjectRequest!: (v: any) => void;
            const projectPromise = new Promise<{ data: { id: string; name: string }[] }>((res) => {
                resolveProjectRequest = res;
            });

            mockList
                .mockImplementationOnce(() => projectPromise)                               // first call: project (slow)
                .mockResolvedValue({ data: [{ id: 'l1', name: 'Orange Inc' }] });           // every later call: lead (fast)

            const { rerender } = render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            // The project request is in-flight but hasn't resolved yet.
            // Switch to 'lead' — the lead request fires and resolves quickly.
            rerender(<EntitySelector entityType="lead" value="" onChange={() => {}} />);
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'lead', project_id: undefined }));

            // Now let the slow (stale) project request resolve with project data.
            await act(async () => {
                resolveProjectRequest({ data: [{ id: 'p1', name: 'Website Redesign' }] });
            });

            // The dropdown must show lead data, NOT the stale project data.
            fireEvent.click(screen.getByPlaceholderText('Select lead...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Orange Inc' })).toBeInTheDocument());
            expect(screen.queryByRole('option', { name: 'Website Redesign' })).not.toBeInTheDocument();
        });
    });

    describe('Given a task selector with no project chosen yet', () => {
        it('When rendered / Then the task dropdown is disabled and tasks are not queried', async () => {
            render(<EntitySelector entityType="task" value="" onChange={() => {}} />);
            // Only the project sub-select loads; the task lookup is skipped.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'project', project_id: undefined }));
            expect(mockList).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'task' }));

            // The task row is gated until a project is selected.
            expect(screen.getByPlaceholderText('Select task...')).toBeDisabled();
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
            fireEvent.click(screen.getByPlaceholderText('Select project...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Website Redesign' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('option', { name: 'Website Redesign' }));

            // Picking a project clears any prior task selection.
            expect(onChange).toHaveBeenCalledWith(null);

            // The task dropdown now loads tasks for that project.
            await waitFor(() => expect(mockList).toHaveBeenCalledWith({ type: 'task', project_id: 'proj-uuid' }));
            fireEvent.click(screen.getByPlaceholderText('Select task...'));
            await waitFor(() => expect(screen.getByRole('option', { name: 'Design header' })).toBeInTheDocument());
            fireEvent.click(screen.getByRole('option', { name: 'Design header' }));

            expect(onChange).toHaveBeenLastCalledWith({ id: 'task-uuid', name: 'Design header' });
        });
    });

    describe('Given the option lookup fails', () => {
        it('When opened / Then a retry affordance is shown with the correct error message', async () => {
            mockList.mockImplementation(async () => { throw new Error('network'); });
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByPlaceholderText('Select project...'));
            await waitFor(() => expect(screen.getByText(/Unable to load records\. Please try again\./i)).toBeInTheDocument());
        });

        it('When the field is re-opened / Then the list is re-fetched and options appear', async () => {
            mockList
                .mockRejectedValueOnce(new Error('network'))
                .mockRejectedValueOnce(new Error('network'))
                .mockResolvedValue({ data: [{ id: 'p1', name: 'Website Redesign' }] });

            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByPlaceholderText('Select project...'));
            await waitFor(() => expect(screen.getByText(/Unable to load records/i)).toBeInTheDocument());

            // Close and re-open: the combobox re-queries the backend.
            fireEvent.blur(screen.getByRole('combobox'));
            fireEvent.focus(screen.getByRole('combobox'));

            await waitFor(() => expect(screen.getByRole('option', { name: 'Website Redesign' })).toBeInTheDocument());
        });
    });

    describe('Given the API returns null for the data field', () => {
        it('When opened / Then the empty state is shown without throwing', async () => {
            mockList.mockResolvedValue({ data: null });
            render(<EntitySelector entityType="project" value="" onChange={() => {}} />);

            fireEvent.click(screen.getByPlaceholderText('Select project...'));

            await waitFor(() => expect(screen.getByText('No projects found')).toBeInTheDocument());
        });
    });

    describe('Given a selection already exists', () => {
        it('When rendered with a stored display name / Then the field shows that name', async () => {
            render(<EntitySelector entityType="project" value="p9" displayName="Legacy Project" onChange={() => {}} />);

            await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Legacy Project'));
        });

        it('When the matching option is loaded / Then the field shows the loaded name', async () => {
            mockList.mockResolvedValue({ data: [{ id: 'p1', name: 'Website Redesign' }] });
            render(<EntitySelector entityType="project" value="p1" onChange={() => {}} />);

            await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Website Redesign'));
        });
    });
});
