import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { performanceReviewsApi, PerformanceReview, CreatePerformanceReviewPayload } from '../services/performanceReviewsService';
import { reviewTemplatesApi, ReviewTemplate } from '../services/reviewTemplatesService';
import { peopleApi } from '../services/peopleService';
import type { Person } from '../types/people';

const PerformanceReviewsPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateReview = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:reviews:create') ?? true);
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'my' | 'team'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadReviews = useCallback(async () => {
        try {
            setLoading(true);
            const params: { status?: string } = {};
            if (statusFilter) params.status = statusFilter;

            let result;
            if (activeTab === 'my') {
                result = await performanceReviewsApi.getMyReviews();
            } else {
                result = await performanceReviewsApi.getAll(params);
            }
            setReviews(result.data);
        } catch (error) {
            console.error('Failed to load performance reviews:', error);
            setToast({ message: 'Failed to load performance reviews', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter]);

    useEffect(() => {
        loadReviews();
    }, [loadReviews]);

    const handleCreate = async (data: CreatePerformanceReviewPayload) => {
        try {
            const created = await performanceReviewsApi.create(data);
            setShowCreateModal(false);
            setToast({ message: 'Performance review created successfully', type: 'success' });
            recordActivity({ eventType: 'people.review.created', eventCategory: 'data', description: `Performance review was created`, resourceType: 'review', resourceId: created?.id }).catch(() => {});
            loadReviews();
        } catch (error) {
            setToast({ message: 'Failed to create performance review', type: 'error' });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-600';
            case 'self_review_pending': return 'bg-blue-600';
            case 'manager_review_pending': return 'bg-yellow-600';
            case 'completed': return 'bg-green-600';
            case 'cancelled': return 'bg-slate-500';
            default: return 'bg-slate-600';
        }
    };

    const renderRatingStars = (rating?: number) => {
        if (!rating) return null;
        return (
            <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                        key={i}
                        size={12}
                        className={i < Math.round(rating) ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600'}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Performance Reviews"
                subtitle="Track employee performance evaluations"
                actions={canCreateReview ? (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <TrendingUp size={16} />
                        Create Review
                    </button>
                ) : undefined}
            />

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'all'
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    All Reviews
                </button>
                <button
                    onClick={() => setActiveTab('my')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'my'
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    My Reviews
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'team'
                            ? 'text-teal-400 border-b-2 border-teal-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    My Team
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="self_review_pending">Self Review Pending</option>
                    <option value="manager_review_pending">Manager Review Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Reviews Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <EmptyState
                    icon={TrendingUp}
                    title="No performance reviews found"
                    description="Create performance reviews to track employee development."
                    action={canCreateReview ? { label: 'Create Review', onClick: () => setShowCreateModal(true) } : undefined}
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Person</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Template</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Review Period</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Overall Rating</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {reviews.map(review => (
                                <tr
                                    key={review.id}
                                    onClick={() => navigate(`/reviews/${review.id}`)}
                                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                                {review.person?.avatar_url ? (
                                                    <img src={review.person.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <span className="text-xs font-medium text-teal-400">
                                                        {review.person?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-50">{review.person?.full_name}</div>
                                                <div className="text-xs text-slate-500">{review.person?.job_title}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-slate-50">{review.template?.name}</div>
                                        <div className="text-xs text-slate-500 capitalize">
                                            {review.template?.review_type.replace('_', ' ')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {new Date(review.review_period_start).toLocaleDateString()} -{' '}
                                        {new Date(review.review_period_end).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-slate-50 ${getStatusColor(review.status)}`}>
                                            {review.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {renderRatingStars(review.overall_rating)}
                                            {review.overall_rating && (
                                                <span className="text-xs text-slate-400">{review.overall_rating.toFixed(1)}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/reviews/${review.id}`);
                                            }}
                                            className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            <CreateReviewModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Create Review Modal
// =============================================================================

interface CreateReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreatePerformanceReviewPayload) => void;
}

const CreateReviewModal: React.FC<CreateReviewModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [personSearch, setPersonSearch] = useState('');
    const [reviewerSearch, setReviewerSearch] = useState('');
    const [formData, setFormData] = useState<CreatePerformanceReviewPayload>({
        person_id: '',
        template_id: '',
        reviewer_id: '',
        review_period_start: new Date().toISOString().split('T')[0],
        review_period_end: new Date().toISOString().split('T')[0],
        self_review_deadline: '',
        manager_review_deadline: '',
    });

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
            loadPeople();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        try {
            const result = await reviewTemplatesApi.getAll({ is_active: true });
            setTemplates(result.data);
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    };

    const loadPeople = async () => {
        try {
            const result = await peopleApi.getAll({ status: 'active', limit: 200 });
            setPeople(result.data || []);
        } catch (error) {
            console.error('Failed to load people:', error);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.person_id || !formData.template_id || !formData.reviewer_id) return;
        onCreate(formData);
    };

    const updateField = (field: keyof CreatePerformanceReviewPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const filteredPeopleForPerson = people.filter(p =>
        !personSearch || p.full_name.toLowerCase().includes(personSearch.toLowerCase())
    );

    const filteredPeopleForReviewer = people.filter(p =>
        !reviewerSearch || p.full_name.toLowerCase().includes(reviewerSearch.toLowerCase())
    );

    const selectedPerson = people.find(p => p.id === formData.person_id);
    const selectedReviewer = people.find(p => p.id === formData.reviewer_id);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Performance Review">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selector */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Person Being Reviewed *</label>
                    {selectedPerson ? (
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                            <span className="text-sm text-slate-50">{selectedPerson.full_name}</span>
                            <button type="button" onClick={() => updateField('person_id', '')} className="text-xs text-slate-400 hover:text-red-400">Clear</button>
                        </div>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Search people..."
                                value={personSearch}
                                onChange={(e) => setPersonSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                            {personSearch && (
                                <div className="mt-1 max-h-32 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg">
                                    {filteredPeopleForPerson.slice(0, 10).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => { updateField('person_id', p.id); setPersonSearch(''); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-50"
                                        >
                                            {p.full_name} {p.job_title ? `(${p.job_title})` : ''}
                                        </button>
                                    ))}
                                    {filteredPeopleForPerson.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-slate-500">No matches found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reviewer Selector */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Reviewer (Manager) *</label>
                    {selectedReviewer ? (
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                            <span className="text-sm text-slate-50">{selectedReviewer.full_name}</span>
                            <button type="button" onClick={() => updateField('reviewer_id', '')} className="text-xs text-slate-400 hover:text-red-400">Clear</button>
                        </div>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Search reviewer..."
                                value={reviewerSearch}
                                onChange={(e) => setReviewerSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                            />
                            {reviewerSearch && (
                                <div className="mt-1 max-h-32 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg">
                                    {filteredPeopleForReviewer.slice(0, 10).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => { updateField('reviewer_id', p.id); setReviewerSearch(''); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-50"
                                        >
                                            {p.full_name} {p.job_title ? `(${p.job_title})` : ''}
                                        </button>
                                    ))}
                                    {filteredPeopleForReviewer.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-slate-500">No matches found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Review Template *</label>
                    <select
                        required
                        value={formData.template_id}
                        onChange={(e) => updateField('template_id', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">Select template</option>
                        {templates.map(template => (
                            <option key={template.id} value={template.id}>
                                {template.name} ({template.review_type})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Review Period Start *</label>
                        <input
                            type="date"
                            required
                            value={formData.review_period_start}
                            onChange={(e) => updateField('review_period_start', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Review Period End *</label>
                        <input
                            type="date"
                            required
                            value={formData.review_period_end}
                            onChange={(e) => updateField('review_period_end', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Self Review Deadline</label>
                        <input
                            type="date"
                            value={formData.self_review_deadline || ''}
                            onChange={(e) => updateField('self_review_deadline', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Manager Review Deadline</label>
                        <input
                            type="date"
                            value={formData.manager_review_deadline || ''}
                            onChange={(e) => updateField('manager_review_deadline', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!formData.person_id || !formData.reviewer_id || !formData.template_id}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create Review
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PerformanceReviewsPage;
