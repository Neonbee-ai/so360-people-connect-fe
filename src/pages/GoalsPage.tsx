import React, { useEffect, useState, useCallback } from 'react';
import { Target, AlertTriangle, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { goalsApi, Goal, CreateGoalPayload } from '../services/goalsService';

const GoalsPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateGoal = (shell?.isFeatureEnabled?.('action:people:goals:create') ?? true);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [updatingProgress, setUpdatingProgress] = useState<Goal | null>(null);
    const [progressValue, setProgressValue] = useState<number>(0);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadGoals = useCallback(async () => {
        try {
            setLoading(true);
            const params: { status?: string } = {};
            if (statusFilter) params.status = statusFilter;

            const result = await goalsApi.getAll(params);
            setGoals(result.data);
        } catch (error) {
            console.error('Failed to load goals:', error);
            setToast({ message: 'Failed to load goals', type: 'error' });
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
            setToast({ message: `Goal ${data.title} has been created`, type: 'success' });
            recordActivity({ eventType: 'people.goal.created', eventCategory: 'data', description: `Goal "${data.title}" was created`, resourceType: 'goal', resourceId: created?.id }).catch(() => {});
            loadGoals();
        } catch (error) {
            setToast({ message: 'Failed to create goal', type: 'error' });
        }
    };

    const handleUpdate = async (id: string, data: Partial<Goal>) => {
        try {
            await goalsApi.update(id, data);
            setEditingGoal(null);
            setToast({ message: 'Goal updated successfully', type: 'success' });
            recordActivity({ eventType: 'people.goal.updated', eventCategory: 'data', description: `Goal "${data.title || id}" was updated`, resourceType: 'goal', resourceId: id }).catch(() => {});
            loadGoals();
        } catch (error) {
            setToast({ message: 'Failed to update goal', type: 'error' });
        }
    };

    const handleUpdateProgress = async () => {
        if (!updatingProgress) return;

        try {
            await goalsApi.updateProgress(updatingProgress.id, progressValue);
            setUpdatingProgress(null);
            setToast({ message: 'Progress updated successfully', type: 'success' });
            loadGoals();
        } catch (error) {
            setToast({ message: 'Failed to update progress', type: 'error' });
        }
    };

    const handleCompleteGoal = async (goal: Goal) => {
        if (!confirm(`Mark goal "${goal.title}" as completed?`)) return;

        try {
            await goalsApi.complete(goal.id);
            setToast({ message: 'Goal marked as completed', type: 'success' });
            recordActivity({ eventType: 'people.goal.completed', eventCategory: 'data', description: `Goal "${goal.title}" was completed`, resourceType: 'goal', resourceId: goal.id }).catch(() => {});
            loadGoals();
        } catch (error) {
            setToast({ message: 'Failed to complete goal', type: 'error' });
        }
    };

    const isOverdue = (goal: Goal) => {
        return goal.status === 'in_progress' && new Date(goal.target_date) < new Date();
    };

    const getGoalTypeColor = (type: string) => {
        switch (type) {
            case 'individual': return 'bg-blue-600';
            case 'team': return 'bg-purple-600';
            case 'company': return 'bg-teal-600';
            case 'development': return 'bg-orange-600';
            default: return 'bg-slate-600';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-red-400';
            case 'high': return 'text-orange-400';
            case 'medium': return 'text-yellow-400';
            case 'low': return 'text-slate-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Goals"
                subtitle="Track objectives and key results"
                actions={canCreateGoal ? (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Target size={16} />
                        Create Goal
                    </button>
                ) : undefined}
            />

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Goals Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-48 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : goals.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No goals found"
                    description="Create goals to track objectives and key results."
                    action={{ label: 'Create Goal', onClick: () => setShowCreateModal(true) }}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.map(goal => (
                        <div
                            key={goal.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-all"
                            onClick={() => setEditingGoal(goal)}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-white ${getGoalTypeColor(goal.goal_type)}`}>
                                    {goal.goal_type}
                                </span>
                                <span className={`text-xs font-medium ${getPriorityColor(goal.priority)}`}>
                                    {goal.priority}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">{goal.title}</h3>

                            {/* Person */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                    {goal.person?.avatar_url ? (
                                        <img src={goal.person.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                                    ) : (
                                        <span className="text-xs font-medium text-teal-400">
                                            {goal.person?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-400">{goal.person?.full_name}</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-slate-400">Progress</span>
                                    <span className="text-xs font-medium text-white">{goal.progress_percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div
                                        className="bg-teal-600 h-2 rounded-full transition-all"
                                        style={{ width: `${goal.progress_percentage}%` }}
                                    />
                                </div>
                            </div>

                            {/* Target & Status */}
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                    {isOverdue(goal) && (
                                        <AlertTriangle size={12} className="text-red-400" />
                                    )}
                                    <span className={isOverdue(goal) ? 'text-red-400' : 'text-slate-400'}>
                                        Target: {new Date(goal.target_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <StatusBadge status={goal.status} />
                            </div>

                            {/* Actions */}
                            {goal.status === 'in_progress' && (
                                <div className="mt-3 pt-3 border-t border-slate-800 flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUpdatingProgress(goal);
                                            setProgressValue(goal.current_value || 0);
                                        }}
                                        className="flex-1 px-3 py-1.5 text-xs text-teal-400 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Update Progress
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCompleteGoal(goal);
                                        }}
                                        className="flex-1 px-3 py-1.5 text-xs text-green-400 hover:bg-slate-800 rounded-lg transition-colors"
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
                        <label className="block text-xs text-slate-400 mb-1">Current Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={progressValue}
                            onChange={(e) => setProgressValue(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                        {updatingProgress?.unit && (
                            <p className="mt-1 text-xs text-slate-400">Unit: {updatingProgress.unit}</p>
                        )}
                        {updatingProgress?.target_value && (
                            <p className="mt-1 text-xs text-slate-400">
                                Target: {updatingProgress.target_value} {updatingProgress.unit}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                        <button
                            onClick={() => setUpdatingProgress(null)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpdateProgress}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Update
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
    const [formData, setFormData] = useState<CreateGoalPayload>({
        person_id: '',
        title: '',
        description: '',
        goal_type: 'individual',
        start_date: new Date().toISOString().split('T')[0],
        target_date: new Date().toISOString().split('T')[0],
        measurement_criteria: '',
        target_value: 0,
        current_value: 0,
        unit: '',
        priority: 'medium',
        status: 'draft',
    });

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
                    <label className="block text-xs text-slate-400 mb-1">Title *</label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        placeholder="Increase sales by 20%"
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Description</label>
                    <textarea
                        value={formData.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Goal Type</label>
                        <select
                            value={formData.goal_type}
                            onChange={(e) => updateField('goal_type', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="individual">Individual</option>
                            <option value="team">Team</option>
                            <option value="company">Company</option>
                            <option value="development">Development</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Priority</label>
                        <select
                            value={formData.priority}
                            onChange={(e) => updateField('priority', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={formData.start_date || ''}
                            onChange={(e) => updateField('start_date', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Target Date *</label>
                        <input
                            type="date"
                            required
                            value={formData.target_date}
                            onChange={(e) => updateField('target_date', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Target Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.target_value || ''}
                            onChange={(e) => updateField('target_value', parseFloat(e.target.value) || undefined)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Current Value</label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.current_value || ''}
                            onChange={(e) => updateField('current_value', parseFloat(e.target.value) || undefined)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Unit</label>
                        <input
                            type="text"
                            value={formData.unit || ''}
                            onChange={(e) => updateField('unit', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                            placeholder="sales, projects, %"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {goal ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default GoalsPage;
