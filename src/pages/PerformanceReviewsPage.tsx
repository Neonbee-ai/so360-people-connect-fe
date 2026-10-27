import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PersonPicker, { PickablePerson } from '../components/PersonPicker';
import {
    toast, getErrorMessage, Select, ListPageTemplate, DataTable, Modal, Button, Tabs, Badge, Avatar, Rating,
    Cluster, Stack, Grid, Card, Alert, DateInput,
} from '@so360/design-system';
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

    const statusTone = (status: string): 'neutral' | 'primary' | 'warning' | 'success' => {
        switch (status) {
            case 'self_review_pending': return 'primary';
            case 'manager_review_pending': return 'warning';
            case 'completed': return 'success';
            default: return 'neutral';
        }
    };

    const openReview = (id: string) => navigate(`/people/reviews/${id}`);

    return (
        <ListPageTemplate trail={[]}
            title="Performance Reviews"
            description="Track employee performance evaluations"
            loading={loading}
            isEmpty={reviews.length === 0}
            primaryAction={canCreateReview ? (
                <Button type="button" onClick={() => setShowCreateModal(true)}>
                    <TrendingUp className="w-4 h-4" />
                    Create Review
                </Button>
            ) : undefined}
            views={(
                <Tabs
                    name="performance-reviews-scope"
                    items={[
                        { id: 'all', label: 'All Reviews' },
                        { id: 'my', label: 'My Reviews' },
                        { id: 'team', label: 'My Team' },
                    ]}
                    value={activeTab}
                    onChange={(id) => setActiveTab(id as 'all' | 'my' | 'team')}
                />
            )}
            filterConfig={{
                fields: [{ key: 'status', label: 'Status', type: 'select', options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'self_review_pending', label: 'Self Review Pending' },
                    { value: 'manager_review_pending', label: 'Manager Review Pending' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                ] }],
                values: { status: statusFilter || undefined },
                onChange: (v) => setStatusFilter((v.status as string) || ''),
                onClear: () => setStatusFilter(''),
            }}
            empty={(
                <EmptyState
                    icon={TrendingUp}
                    title="No performance reviews found"
                    description="Create performance reviews to track employee development."
                    action={canCreateReview ? { label: 'Create Review', onClick: () => setShowCreateModal(true) } : undefined}
                />
            )}
        >
            <DataTable<PerformanceReview>
                name="performance-reviews"
                rows={reviews}
                rowKey={(r) => r.id}
                onRowClick={(r) => openReview(r.id)}
                rowActions={(r) => [{ label: 'View', onSelect: () => openReview(r.id) }]}
                columns={[
                    {
                        key: 'person',
                        header: 'Person',
                        render: (r) => (
                            <Cluster gap="tight" align="center">
                                <Avatar src={r.person?.avatar_url} name={r.person?.full_name} size="sm" />
                                <div>
                                    <div className="text-nb-sm font-medium text-fg">{r.person?.full_name}</div>
                                    <div className="text-nb-xs text-fg-subtle">{r.person?.job_title}</div>
                                </div>
                            </Cluster>
                        ),
                    },
                    {
                        key: 'template',
                        header: 'Template',
                        render: (r) => (
                            <div>
                                <div className="text-nb-sm text-fg">{r.template?.name}</div>
                                <div className="text-nb-xs text-fg-subtle capitalize">{r.template?.review_type.replace('_', ' ')}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'period',
                        header: 'Review Period',
                        render: (r) => (
                            <span className="text-nb-sm text-fg-muted">
                                {formatters.formatDate(r.review_period_start)} -{' '}
                                {formatters.formatDate(r.review_period_end)}
                            </span>
                        ),
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        align: 'center',
                        render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge>,
                    },
                    {
                        key: 'rating',
                        header: 'Overall Rating',
                        align: 'center',
                        render: (r) => r.overall_rating ? (
                            <Cluster gap="tight" align="center" justify="center">
                                <Rating name={`review-rating-${r.id}`} value={Math.round(r.overall_rating)} readOnly aria-label={`Overall rating ${r.overall_rating.toFixed(1)}`} />
                                <span className="text-nb-xs text-fg-muted">{r.overall_rating.toFixed(1)}</span>
                            </Cluster>
                        ) : null,
                    },
                ]}
            />

            <CreateReviewModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
            />
        </ListPageTemplate>
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
    // This modal is a SIBLING of the page component, so it cannot see the
    // page's formatters — it needs its own hook to reach the org timezone.
    const formatters = usePeopleFormatters();
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
        review_period_start: formatters.businessToday(),
        review_period_end: formatters.businessToday(),
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
        <Modal open={isOpen} onClose={onClose} title="Create Performance Review" size="lg">
            <form onSubmit={handleSubmit}>
                <Stack gap="region">
                    <Stack gap="tight">
                        <label htmlFor="review-person-picker" className="text-nb-sm font-medium text-fg-muted">Person Being Reviewed *</label>
                        <PersonPicker
                            options={people}
                            value={formData.person_id}
                            onChange={(id) => updateField('person_id', id)}
                            placeholder="Search people..."
                            emptyMessage="No active people found"
                            inputId="review-person-picker"
                            data-testid="person-picker"
                        />
                    </Stack>

                    {/* Reviewer Selector - restricted to managers eligible for this person */}
                    <Stack gap="tight">
                        <label htmlFor="review-reviewer-picker" className="text-nb-sm font-medium text-fg-muted">Reviewer (Manager) *</label>
                        <PersonPicker
                            options={reviewerOptions}
                            value={formData.reviewer_id}
                            onChange={(id) => updateField('reviewer_id', id)}
                            placeholder={unrestrictedReviewers ? 'Search people...' : 'Search eligible managers...'}
                            emptyMessage="No people available"
                            loading={reviewersLoading}
                            disabled={!formData.person_id}
                            disabledMessage="Select the person being reviewed first."
                            inputId="review-reviewer-picker"
                            data-testid="reviewer-picker"
                        />
                        {formData.person_id && unrestrictedReviewers && (
                            <Alert variant="warning">
                                No department heads are configured, so any employee can be selected as
                                reviewer. Assign a department head in People Connect → Departments to
                                restrict this list to managers.
                            </Alert>
                        )}
                        {eligibleReviewers.some(r => r.is_direct_manager && r.id === formData.reviewer_id) && (
                            <p className="text-nb-xs text-fg-subtle">Their reporting manager.</p>
                        )}
                    </Stack>

                    {templatesLoaded && templates.length === 0 ? (
                        <Stack gap="tight">
                            <span className="text-nb-sm font-medium text-fg-muted">Review Template *</span>
                            <Card>
                                <Stack gap="tight">
                                    <p className="text-nb-sm text-fg">No review templates found.</p>
                                    <Cluster>
                                        <Button type="button" size="sm" onClick={handleSeedDefaults} disabled={seedingTemplates}>
                                            {seedingTemplates ? 'Creating…' : 'Create default templates'}
                                        </Button>
                                    </Cluster>
                                </Stack>
                            </Card>
                        </Stack>
                    ) : (
                        <Select
                            name="review_template_id"
                            label="Review Template"
                            required
                            value={formData.template_id}
                            onChange={(e) => updateField('template_id', e.target.value)}
                            options={[{ value: '', label: 'Select template' }, ...templates.map((template) => ({ value: template.id, label: `${template.name} (${template.review_type})` }))]}
                        />
                    )}

                    <Grid columns={2} gap="lg">
                        <DateInput
                            name="review_period_start"
                            label="Review Period Start"
                            required
                            value={formData.review_period_start}
                            onChange={(v) => updateField('review_period_start', v)}
                        />
                        <DateInput
                            name="review_period_end"
                            label="Review Period End"
                            required
                            // Blocks earlier dates in the picker; the explicit check
                            // below still catches typed-in values.
                            min={formData.review_period_start || undefined}
                            value={formData.review_period_end}
                            onChange={(v) => updateField('review_period_end', v)}
                            error={periodInvalid ? 'Review Period End date cannot be earlier than Review Period Start date.' : undefined}
                        />
                        <DateInput
                            name="self_review_deadline"
                            label="Self Review Deadline"
                            value={formData.self_review_deadline || ''}
                            onChange={(v) => updateField('self_review_deadline', v)}
                        />
                        <DateInput
                            name="manager_review_deadline"
                            label="Manager Review Deadline"
                            value={formData.manager_review_deadline || ''}
                            onChange={(v) => updateField('manager_review_deadline', v)}
                        />
                    </Grid>

                    <Cluster gap="default" justify="end">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={!canSubmit}>Create Review</Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

export default PerformanceReviewsPage;
