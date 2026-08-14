import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PersonPicker, { PickablePerson } from '../components/PersonPicker';
import { toast, getErrorMessage } from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { performanceReviewsApi, PerformanceReview, CreatePerformanceReviewPayload, EligibleReviewer } from '../services/performanceReviewsService';
import { reviewTemplatesApi, ReviewTemplate } from '../services/reviewTemplatesService';
import { peopleApi } from '../services/peopleService';
import type { Person } from '../types/people';

const PerformanceReviewsPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreateReview = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:reviews:create') ?? true);
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'my' | 'team'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);

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
            toast.error('Failed to load performance reviews');
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
            toast.success('Performance review created successfully');
            recordActivity({ eventType: 'people.review.created', eventCategory: 'data', description: `Performance review was created`, resourceType: 'review', resourceId: created?.id }).catch(() => {});
            loadReviews();
        } catch (error) {
            // Reviewer-eligibility and review-period rejections carry an
            // actionable message from the API — show it rather than a generic
            // failure the user cannot act on.
            toast.error(getErrorMessage(error, 'Failed to create performance review'));
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
                                    onClick={() => navigate(`/people/reviews/${review.id}`)}
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
                                        {formatters.formatDate(review.review_period_start)} -{' '}
                                        {formatters.formatDate(review.review_period_end)}
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
                                                navigate(`/people/reviews/${review.id}`);
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
    const [templatesLoaded, setTemplatesLoaded] = useState(false);
    const [seedingTemplates, setSeedingTemplates] = useState(false);
    const [people, setPeople] = useState<Person[]>([]);
    const [eligibleReviewers, setEligibleReviewers] = useState<EligibleReviewer[]>([]);
    const [reviewersLoading, setReviewersLoading] = useState(false);
    const [reviewersLoaded, setReviewersLoaded] = useState(false);
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

    /**
     * The reviewer list is a function of who is being reviewed — reload it on
     * every change and drop any previously chosen reviewer who is no longer
     * eligible, rather than silently submitting a stale id.
     */
    useEffect(() => {
        if (!isOpen || !formData.person_id) {
            setEligibleReviewers([]);
            setReviewersLoaded(false);
            return;
        }

        let cancelled = false;
        setReviewersLoading(true);
        performanceReviewsApi.getEligibleReviewers(formData.person_id)
            .then(result => {
                if (cancelled) return;
                const list = result.data || [];
                setEligibleReviewers(list);
                if (list.length === 0) {
                    // Unrestricted fallback (see reviewerOptions): keep whatever
                    // is already selected rather than clearing a valid pick.
                    return;
                }
                setFormData(prev => {
                    // Preselect the direct manager when there is one and nothing
                    // valid is already chosen; otherwise clear an ineligible pick.
                    if (prev.reviewer_id && list.some(r => r.id === prev.reviewer_id)) return prev;
                    const preferred = result.direct_manager_id && list.some(r => r.id === result.direct_manager_id)
                        ? result.direct_manager_id
                        : '';
                    return prev.reviewer_id === preferred ? prev : { ...prev, reviewer_id: preferred };
                });
            })
            .catch(() => {
                if (cancelled) return;
                setEligibleReviewers([]);
                setFormData(prev => (prev.reviewer_id ? { ...prev, reviewer_id: '' } : prev));
            })
            .finally(() => {
                if (!cancelled) {
                    setReviewersLoading(false);
                    setReviewersLoaded(true);
                }
            });

        return () => { cancelled = true; };
    }, [isOpen, formData.person_id]);

    const loadTemplates = async () => {
        try {
            const result = await reviewTemplatesApi.getAll({ status: 'active' });
            setTemplates(result.data);
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setTemplatesLoaded(true);
        }
    };

    const handleSeedDefaults = async () => {
        setSeedingTemplates(true);
        try {
            const result = await reviewTemplatesApi.seedDefaults();
            setTemplates(result.data);
        } catch (error) {
            console.error('Failed to create default templates:', error);
        } finally {
            setSeedingTemplates(false);
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

    /**
     * When the org has assigned no department heads there is no eligibility
     * data to restrict against, and the backend stands its check down to match.
     * Falling back to the full people list keeps review creation working for
     * orgs that have not modelled their hierarchy yet — the banner below says
     * why the field is unrestricted and how to restrict it.
     */
    const unrestrictedReviewers = reviewersLoaded && !reviewersLoading && eligibleReviewers.length === 0;
    // Widened to the picker's structural type: the two branches are Person[]
    // and EligibleReviewer[], and only the pickable fields are used here.
    const reviewerOptions: PickablePerson[] = unrestrictedReviewers
        ? people.filter(p => p.id !== formData.person_id)
        : eligibleReviewers;

    const periodInvalid = Boolean(
        formData.review_period_start &&
        formData.review_period_end &&
        formData.review_period_end < formData.review_period_start
    );

    const canSubmit = Boolean(
        formData.person_id && formData.reviewer_id && formData.template_id && !periodInvalid
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Guard, not belt-and-braces: a disabled button does not stop an
        // implicit submit triggered by Enter inside a text input.
        if (!canSubmit) return;
        // The backend DTO validates deadlines as dates — an empty string is not
        // a date, so unset optional deadlines must be omitted, not sent blank.
        const payload: CreatePerformanceReviewPayload = { ...formData };
        if (!payload.self_review_deadline) delete payload.self_review_deadline;
        if (!payload.manager_review_deadline) delete payload.manager_review_deadline;
        onCreate(payload);
    };

    const updateField = (field: keyof CreatePerformanceReviewPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Performance Review">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Person Selector */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Person Being Reviewed *</label>
                    <PersonPicker
                        options={people}
                        value={formData.person_id}
                        onChange={(id) => updateField('person_id', id)}
                        placeholder="Search people..."
                        emptyMessage="No active people found"
                        data-testid="person-picker"
                    />
                </div>

                {/* Reviewer Selector — restricted to managers eligible for this person */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Reviewer (Manager) *</label>
                    <PersonPicker
                        options={reviewerOptions}
                        value={formData.reviewer_id}
                        onChange={(id) => updateField('reviewer_id', id)}
                        placeholder={unrestrictedReviewers ? 'Search people...' : 'Search eligible managers...'}
                        emptyMessage="No people available"
                        loading={reviewersLoading}
                        disabled={!formData.person_id}
                        disabledMessage="Select the person being reviewed first."
                        data-testid="reviewer-picker"
                    />
                    {formData.person_id && unrestrictedReviewers && (
                        <p className="mt-1 text-xs text-amber-400">
                            No department heads are configured, so any employee can be selected as
                            reviewer. Assign a department head in People Connect → Departments to
                            restrict this list to managers.
                        </p>
                    )}
                    {eligibleReviewers.some(r => r.is_direct_manager && r.id === formData.reviewer_id) && (
                        <p className="mt-1 text-xs text-slate-500">Their reporting manager.</p>
                    )}
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Review Template *</label>
                    {templatesLoaded && templates.length === 0 ? (
                        <div className="px-3 py-3 bg-slate-800 border border-dashed border-slate-700 rounded-lg text-sm text-slate-400">
                            <p className="mb-2 text-slate-300">No review templates found.</p>
                            <button
                                type="button"
                                onClick={handleSeedDefaults}
                                disabled={seedingTemplates}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                                {seedingTemplates ? 'Creating…' : 'Create default templates'}
                            </button>
                        </div>
                    ) : (
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
                    )}
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
                            // Blocks earlier dates in the picker; the explicit
                            // check below still catches typed-in values, which
                            // `min` does not prevent.
                            min={formData.review_period_start || undefined}
                            aria-invalid={periodInvalid}
                            value={formData.review_period_end}
                            onChange={(e) => updateField('review_period_end', e.target.value)}
                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-slate-50 focus:outline-none ${
                                periodInvalid
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'border-slate-700 focus:border-teal-500'
                            }`}
                        />
                        {periodInvalid && (
                            <p role="alert" className="mt-1 text-xs text-red-400">
                                Review Period End date cannot be earlier than Review Period Start date.
                            </p>
                        )}
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
                        disabled={!canSubmit}
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
