import React, { useEffect, useState, useCallback } from 'react';
import { Target, AlertTriangle, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, useConfirm, Select } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { goalsApi, Goal, CreateGoalPayload } from '../services/goalsService';
import { peopleApi } from '../services/peopleService';

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
            toast.error('Failed to create goal');
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

    const getGoalTypeColor = (type: string) => {
        switch (type) {
            case 'individual': return 'bg-primary';
            case 'team': return 'bg-purple-600';
            case 'company': return 'bg-primary';
            case 'development': return 'bg-warning';
            default: return 'bg-line-strong';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-danger';
            case 'high': return 'text-warning';
            case 'medium': return 'text-warning';
            case 'low': return 'text-fg-muted';
            default: return 'text-fg-muted';
        }
    };

    return (
        <div className="p-6 space-y-5">
          {confirmDialog}
            <PageHeader
                title="Goals"
                subtitle="Track objectives and key results"
                actions={canCreateGoal ? (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        <Target size={16} />
                        Create Goal
                    </button>
                ) : undefined}
            />

            {/* Filters */}
            <div className="flex items-center gap-3">
                <Select name="goals-select-41" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: "", label: "All Statuses" }, { value: "draft", label: "Draft" }, { value: "in_progress", label: "In Progress" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
            </div>

            {/* Goals Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-48 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : goals.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No goals found"
                    description="Create goals to track objectives and key results."
                    action={canCreateGoal ? { label: 'Create Goal', onClick: () => setShowCreateModal(true) } : undefined}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.map(goal => (
                        <div
                            key={goal.id}
                            className="bg-surface border border-line rounded-nb p-5 hover:border-line-strong hover:bg-surface-raised/50 cursor-pointer transition-all"
                            onClick={() => setEditingGoal(goal)}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-fg ${getGoalTypeColor(goal.goal_type)}`}>
                                    {goal.goal_type}
                                </span>
                                <span className={`text-xs font-medium ${getPriorityColor(goal.priority)}`}>
                                    {goal.priority}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-sm font-medium text-fg mb-2 line-clamp-2">{goal.title}</h3>

                            {/* Person */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/20 border border-line-strong flex items-center justify-center flex-shrink-0">
                                    {goal.person?.avatar_url ? (
                                        <img src={goal.person.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                    ) : (
                                        <span className="text-xs font-medium text-primary">
                                            {goal.person?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-fg-muted">{goal.person?.full_name}</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-fg-muted">Progress</span>
                                    <span className="text-xs font-medium text-fg">{goal.progress_percentage}%</span>
                                </div>
                                <div className="w-full bg-surface-raised rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${goal.progress_percentage}%` }}
                                    />
                                </div>
                            </div>

                            {/* Target & Status */}
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                    {isOverdue(goal) && (
                                        <AlertTriangle size={12} className="text-danger" />
                                    )}
                                    <span className={isOverdue(goal) ? 'text-danger' : 'text-fg-muted'}>
                                        Target: {formatters.formatDate(goal.target_date)}
                                    </span>
                                </div>
                                <StatusBadge status={goal.status} />
                            </div>

                            {/* Actions */}
                            {goal.status === 'in_progress' && (
                                <div className="mt-3 pt-3 border-t border-line flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUpdatingProgress(goal);
                                            setProgressValue(goal.current_value || 0);
                                        }}
                                        className="flex-1 px-3 py-1.5 text-xs text-primary hover:bg-surface-raised rounded-nb transition-colors"
                                    >
                                        Update Progress
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCompleteGoal(goal);
                                        }}
                                        className="flex-1 px-3 py-1.5 text-xs text-success hover:bg-surface-raised rounded-nb transition-colors"
                                    >
                                        Mark Complete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

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

            {/* Update Progress Modal */}
            <Modal
                isOpen={!!updatingProgress}
                onClose={() => setUpdatingProgress(null)}
                title="Update Progress"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Current Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={progressValue}
                            onChange={(e) => setProgressValue(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                        {updatingProgress?.unit && (
                            <p className="mt-1 text-xs text-fg-muted">Unit: {updatingProgress.unit}</p>
                        )}
                        {updatingProgress?.target_value && (
                            <p className="mt-1 text-xs text-fg-muted">
                                Target: {updatingProgress.target_value} {updatingProgress.unit}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-line">
                        <button
                            onClick={() => setUpdatingProgress(null)}
                            className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdateProgress}
                            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                        >
                            Update
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
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
            .then(me => { if (!cancelled) setFormData(prev => ({ ...prev, person_id: me.id })); })
            .catch(() => undefined);
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
        <Modal isOpen={isOpen} onClose={onClose} title={goal ? 'Edit Goal' : 'Create Goal'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Title *</label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="Increase sales by 20%"
                    />
                </div>

                <div>
                    <label className="block text-xs text-fg-muted mb-1">Description</label>
                    <textarea
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Goal Type</label>
                        <Select name="goals-select-42" value={formData.goal_type} onChange={(e) => updateField('goal_type', e.target.value)} options={[{ value: "individual", label: "Individual" }, { value: "team", label: "Team" }, { value: "company", label: "Company" }, { value: "development", label: "Development" }]} />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Priority</label>
                        <Select name="goals-select-43" value={formData.priority} onChange={(e) => updateField('priority', e.target.value)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }]} />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Start Date</label>
                        <input
                            type="date"
                            value={formData.start_date || ''}
                            onChange={(e) => updateField('start_date', e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Target Date *</label>
                        <input
                            type="date"
                            required
                            value={formData.target_date}
                            onChange={(e) => updateField('target_date', e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Target Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.target_value || ''}
                            onChange={(e) => updateField('target_value', parseFloat(e.target.value) || undefined)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Current Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.current_value || ''}
                            onChange={(e) => updateField('current_value', parseFloat(e.target.value) || undefined)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Unit</label>
                        <input
                            type="text"
                            value={formData.unit || ''}
                            onChange={(e) => updateField('unit', e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                            placeholder="sales, projects, %"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors"
                    >
                        {goal ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default GoalsPage;
