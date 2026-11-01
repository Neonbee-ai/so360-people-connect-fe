import React, { useEffect, useState, useCallback } from 'react';
import { Target, AlertTriangle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import {
    toast, getErrorMessage, useConfirm, Select, ListPageTemplate, DataTable, Modal, Button, Badge, Avatar, Progress,
    Cluster, Stack, Grid, TextField, Textarea, NumberInput, DateInput,
} from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { goalsApi, Goal, CreateGoalPayload } from '../services/goalsService';
import { peopleApi } from '../services/peopleService';
import PersonPicker, { PickablePerson } from '../components/PersonPicker';
import { enumLabel } from '../utils/format';

const GoalsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreateGoal = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:goals:create') ?? true);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [updatingProgress, setUpdatingProgress] = useState<Goal | null>(null);
    const [progressValue, setProgressValue] = useState<number>(0);

    const loadGoals = useCallback(async () => {
        try {
            setLoading(true);
            const params: { status?: string } = {};
            if (statusFilter) params.status = statusFilter;

            const result = await goalsApi.getAll(params);
            setGoals(result.data);
        } catch (error) {
            console.error('Failed to load goals:', error);
            toast.error('Failed to load goals');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadGoals();
    }, [loadGoals]);

    const handleCreate = async (data: CreateGoalPayload) => {
        try {
            const created = await goalsApi.create(data);
            setShowCreateModal(false);
            toast.success(`Goal ${data.title} has been created`);
            recordActivity({ eventType: 'people.goal.created', eventCategory: 'data', description: `Goal "${data.title}" was created`, resourceType: 'goal', resourceId: created?.id }).catch(() => {});
            loadGoals();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create goal'));
        }
    };

    const handleUpdate = async (id: string, data: Partial<Goal>) => {
        try {
            await goalsApi.update(id, data);
            setEditingGoal(null);
            toast.success('Goal updated successfully');
            recordActivity({ eventType: 'people.goal.updated', eventCategory: 'data', description: `Goal "${data.title || id}" was updated`, resourceType: 'goal', resourceId: id }).catch(() => {});
            loadGoals();
        } catch (error) {
            toast.error('Failed to update goal');
        }
    };

    const handleUpdateProgress = async () => {
        if (!updatingProgress) return;
        if (isNaN(progressValue) || progressValue < 0) {
            toast.error('Please enter a valid progress value (0 or above)');
            return;
        }

        try {
            await goalsApi.updateProgress(updatingProgress.id, progressValue, updatingProgress.target_value);
            setUpdatingProgress(null);
            toast.success('Progress updated successfully');
            loadGoals();
        } catch (error) {
            toast.error('Unable to update progress. Please try again.');
        }
    };

    const [confirm, confirmDialog] = useConfirm();

    const handleCompleteGoal = async (goal: Goal) => {
        if (!(await confirm({ title: 'Complete goal', message: `Mark goal "${goal.title}" as completed?`, confirmLabel: 'Complete' }))) return;

        try {
            await goalsApi.complete(goal.id);
            toast.success('Goal marked as completed');
            recordActivity({ eventType: 'people.goal.completed', eventCategory: 'data', description: `Goal "${goal.title}" was completed`, resourceType: 'goal', resourceId: goal.id }).catch(() => {});
            loadGoals();
        } catch (error) {
            toast.error('Failed to complete goal');
        }
    };

    const isOverdue = (goal: Goal) => {
        return goal.status === 'in_progress' && new Date(goal.target_date) < new Date();
    };

    const goalTypeTone = (type: string): 'primary' | 'info' | 'warning' | 'neutral' => {
        switch (type) {
            case 'individual': return 'primary';
            case 'team': return 'info';
            case 'company': return 'primary';
            case 'development': return 'warning';
            default: return 'neutral';
        }
    };

    const priorityTone = (priority: string): 'danger' | 'warning' | 'neutral' => {
        switch (priority) {
            case 'critical': return 'danger';
            case 'high': return 'warning';
            case 'medium': return 'warning';
            default: return 'neutral';
        }
    };

    return (
        <>
        {confirmDialog}
        <ListPageTemplate trail={[]}
            title="Goals"
            description="Track objectives and key results"
            loading={loading}
            isEmpty={goals.length === 0}
            primaryAction={canCreateGoal ? (
                <Button type="button" onClick={() => setShowCreateModal(true)}>
                    <Target className="w-4 h-4" />
                    Create Goal
                </Button>
            ) : undefined}
            filterConfig={{
                fields: [{ key: 'status', label: 'Status', type: 'select', options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                ] }],
                values: { status: statusFilter || undefined },
                onChange: (v) => setStatusFilter((v.status as string) || ''),
                onClear: () => setStatusFilter(''),
            }}
            empty={(
                <EmptyState
                    icon={Target}
                    title="No goals found"
                    description={canCreateGoal
                        ? 'Use Create Goal above to add your first objective.'
                        : 'Create goals to track objectives and key results.'}
                />
            )}
        >
            <DataTable<Goal>
                name="goals"
                rows={goals}
                rowKey={(g) => g.id}
                onRowClick={(g) => setEditingGoal(g)}
                rowActions={(g) => g.status === 'in_progress' ? [
                    {
                        label: 'Update Progress',
                        onSelect: () => {
                            setUpdatingProgress(g);
                            setProgressValue(g.current_value || 0);
                        },
                    },
                    { label: 'Mark Complete', onSelect: () => { handleCompleteGoal(g); } },
                ] : []}
                columns={[
                    { key: 'title', header: 'Goal', render: (g) => <span className="text-nb-sm font-medium text-fg">{g.title}</span> },
                    { key: 'goal_type', header: 'Type', render: (g) => g.goal_type ? <Badge tone={goalTypeTone(g.goal_type)}>{enumLabel(g.goal_type)}</Badge> : <span className="text-fg-subtle">—</span> },
                    { key: 'priority', header: 'Priority', render: (g) => g.priority ? <Badge tone={priorityTone(g.priority)}>{enumLabel(g.priority)}</Badge> : <span className="text-fg-subtle" data-testid="goal-priority-none">—</span> },
                    {
                        key: 'person',
                        header: 'Owner',
                        render: (g) => (
                            <Cluster gap="tight" align="center">
                                <Avatar src={g.person?.avatar_url} name={g.person?.full_name} size="xs" />
                                <span className="text-nb-xs text-fg-muted">{g.person?.full_name}</span>
                            </Cluster>
                        ),
                    },
                    {
                        key: 'progress',
                        header: 'Progress',
                        render: (g) => (
                            <Stack gap="tight">
                                <span className="text-nb-xs font-medium text-fg">{g.progress_percentage}%</span>
                                <Progress value={g.progress_percentage} max={100} aria-label={`Progress for ${g.title}`} />
                            </Stack>
                        ),
                    },
                    {
                        key: 'target_date',
                        header: 'Target Date',
                        render: (g) => (
                            <Cluster gap="tight" align="center">
                                {isOverdue(g) && <AlertTriangle className="w-3 h-3 text-danger" />}
                                <span className={isOverdue(g) ? 'text-nb-xs text-danger' : 'text-nb-xs text-fg-muted'}>
                                    Target: {formatters.formatDate(g.target_date)}
                                </span>
                            </Cluster>
                        ),
                    },
                    { key: 'status', header: 'Status', render: (g) => <StatusBadge status={g.status} /> },
                ]}
            />
            {/* Update Progress Modal */}
            <Modal
                open={!!updatingProgress}
                onClose={() => setUpdatingProgress(null)}
                title="Update Progress"
                footer={(
                    <Cluster gap="default" justify="end">
                        <Button type="button" variant="ghost" onClick={() => setUpdatingProgress(null)}>Cancel</Button>
                        <Button type="button" onClick={handleUpdateProgress}>Update</Button>
                    </Cluster>
                )}
            >
                <Stack gap="tight">
                    <NumberInput
                        name="goal-progress-value"
                        label="Current Value"
                        min={0}
                        step={0.1}
                        value={progressValue}
                        onChange={(v) => setProgressValue(v ?? 0)}
                    />
                    {updatingProgress?.unit && (
                        <p className="text-nb-xs text-fg-muted">Unit: {updatingProgress.unit}</p>
                    )}
                    {updatingProgress?.target_value && (
                        <p className="text-nb-xs text-fg-muted">
                            Target: {updatingProgress.target_value} {updatingProgress.unit}
                        </p>
                    )}
                </Stack>
            </Modal>
        </ListPageTemplate>

            {/* Create/Edit Modal */}
            <GoalModal
                isOpen={showCreateModal || !!editingGoal}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingGoal(null);
                }}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                goal={editingGoal}
            />

        </>
    );
};

// =============================================================================
// Goal Modal
// =============================================================================

interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateGoalPayload) => void;
    onUpdate: (id: string, data: Partial<Goal>) => void;
    goal: Goal | null;
}

const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose, onCreate, onUpdate, goal }) => {
    // This modal is a SIBLING of the page component, so it cannot see the
    // page's formatters — it needs its own hook to reach the org timezone.
    const formatters = usePeopleFormatters();
    const [formData, setFormData] = useState<CreateGoalPayload>({
        // Resolved from the caller's employee record below — NEVER the auth
        // user id, which is a different identifier entirely.
        person_id: '',
        title: '',
        description: '',
        goal_type: 'individual',
        start_date: formatters.businessToday(),
        target_date: formatters.businessToday(),
        measurement_criteria: '',
        target_value: 0,
        current_value: 0,
        unit: '',
        priority: 'medium',
        status: 'draft',
    });

    // A goal belongs to a PERSON, not to a login. This used to default to
    // the auth USER uuid — a different identifier — so every goal an employee
    // created was written against a person_id matching no employee record.
    useEffect(() => {
        if (goal || !isOpen) return;
        let cancelled = false;
        peopleApi
            .getMe()
            .then(me => { if (!cancelled && me?.id) setFormData(prev => (prev.person_id ? prev : { ...prev, person_id: me.id })); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [goal, isOpen]);

    // "Assigned To" candidates. Only people-directory readers (admins/HR) get a
    // list; for everyone else the call 403s and the goal stays on their own
    // record, so the picker is simply not shown.
    const [people, setPeople] = useState<PickablePerson[]>([]);
    useEffect(() => {
        if (goal || !isOpen) return;
        let cancelled = false;
        peopleApi
            .getAll({ status: 'active', limit: 200 })
            .then(result => { if (!cancelled) setPeople(result?.data || []); })
            .catch(() => { if (!cancelled) setPeople([]); });
        return () => { cancelled = true; };
    }, [goal, isOpen]);

    useEffect(() => {
        if (goal) {
            setFormData({
                person_id: goal.person_id,
                title: goal.title,
                description: goal.description || '',
                goal_type: goal.goal_type,
                start_date: goal.start_date || '',
                target_date: goal.target_date,
                measurement_criteria: goal.measurement_criteria || '',
                target_value: goal.target_value,
                current_value: goal.current_value,
                unit: goal.unit || '',
                priority: goal.priority,
                status: goal.status,
            });
        }
    }, [goal]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.target_date) return;
        if (!formData.person_id) {
            // Better to refuse than to write a goal nobody owns.
            toast.error('Could not identify your employee record. Contact your administrator.');
            return;
        }

        if (goal) {
            onUpdate(goal.id, formData);
        } else {
            onCreate(formData);
        }
    };

    const updateField = (field: keyof CreateGoalPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={goal ? 'Edit Goal' : 'Create Goal'}
            size="lg"
            footer={(
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="goal-form">{goal ? 'Update' : 'Create'}</Button>
                </Cluster>
            )}
        >
            <form id="goal-form" onSubmit={handleSubmit}>
                <Stack gap="region">
                    <TextField
                        name="goal_title"
                        label="Title"
                        required
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder="Increase sales by 20%"
                    />
                    <Textarea
                        name="goal_description"
                        label="Description"
                        rows={3}
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                    />
                    {!goal && people.length > 0 && (
                        <Stack gap="tight">
                            <label htmlFor="goal-person-picker" className="text-nb-sm font-medium text-fg-muted">Assigned To</label>
                            <PersonPicker
                                options={people}
                                value={formData.person_id}
                                onChange={(id) => updateField('person_id', id)}
                                placeholder="Search people..."
                                emptyMessage="No active people found"
                                inputId="goal-person-picker"
                                data-testid="goal-person-picker"
                            />
                        </Stack>
                    )}
                    <Grid columns={2} gap="lg">
                        <Select
                            name="goal_type"
                            label="Goal Type"
                            value={formData.goal_type}
                            onChange={(e) => updateField('goal_type', e.target.value)}
                            options={[{ value: 'individual', label: 'Individual' }, { value: 'team', label: 'Team' }, { value: 'company', label: 'Company' }, { value: 'development', label: 'Development' }]}
                        />
                        <Select
                            name="goal_priority"
                            label="Priority"
                            value={formData.priority}
                            onChange={(e) => updateField('priority', e.target.value)}
                            options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]}
                        />
                        <DateInput
                            name="goal_start_date"
                            label="Start Date"
                            value={formData.start_date || ''}
                            onChange={(v) => updateField('start_date', v)}
                        />
                        <DateInput
                            name="goal_target_date"
                            label="Target Date"
                            required
                            value={formData.target_date}
                            onChange={(v) => updateField('target_date', v)}
                        />
                    </Grid>
                    <Grid columns={3} gap="lg">
                        <NumberInput
                            name="goal_target_value"
                            label="Target Value (optional)"
                            hint="The number you are aiming for, e.g. 20 for a 20% increase."
                            min={0}
                            step={0.1}
                            value={formData.target_value || null}
                            onChange={(v) => updateField('target_value', v || undefined)}
                        />
                        <NumberInput
                            name="goal_current_value"
                            label="Current Value (optional)"
                            hint="Where you are today. Progress is calculated from current / target."
                            min={0}
                            step={0.1}
                            value={formData.current_value || null}
                            onChange={(v) => updateField('current_value', v || undefined)}
                        />
                        <Select
                            name="goal_unit"
                            label="Unit (optional)"
                            hint="Target and current values are measured in this unit."
                            placeholder="Select unit..."
                            value={formData.unit || ''}
                            onChange={(e) => updateField('unit', e.target.value || undefined)}
                            options={goalUnitOptions(formData.unit)}
                        />
                    </Grid>
                </Stack>
            </form>
        </Modal>
    );
};

/** Fixed unit list (Pulse 3900d9c0); a legacy free-text unit stays selectable so editing never drops it. */
export const GOAL_UNITS = [
    { value: '%', label: '% (percentage)' },
    { value: 'count', label: 'Count' },
    { value: 'currency', label: 'Currency' },
    { value: 'hours', label: 'Hours' },
    { value: 'projects', label: 'Projects' },
];
export function goalUnitOptions(current?: string) {
    return current && !GOAL_UNITS.some((u) => u.value === current)
        ? [...GOAL_UNITS, { value: current, label: current }]
        : GOAL_UNITS;
}

export default GoalsPage;
