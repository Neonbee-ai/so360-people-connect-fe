import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Plus, CheckCircle, Eye, EyeOff } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import PersonPicker from '../components/PersonPicker';
import {
    toast, Select, ListPageTemplate, DataTable, Modal, Button, Badge, Avatar, Rating,
    Cluster, Stack, Grid, TextField, Textarea, Checkbox,
} from '@so360/design-system';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { feedbackApi, Feedback, CreateFeedbackPayload } from '../services/feedbackService';
import { peopleApi } from '../services/peopleService';
import { apiContext } from '../services/apiClient';
import type { Person } from '../types/people';

const FeedbackPage: React.FC = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = usePeopleFormatters();
    const canCreate = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:feedback:create') ?? true);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const result = await feedbackApi.getAll({
                feedback_type: typeFilter || undefined,
                limit: 50,
            });
            setFeedbacks(result.data || []);
        } catch (error) {
            console.error('Failed to load feedback:', error);
            toast.error('Failed to load feedback');
        } finally {
            setLoading(false);
        }
    }, [typeFilter]);

    useEffect(() => {
        loadFeedback();
    }, [loadFeedback]);

    const handleCreate = async (data: CreateFeedbackPayload) => {
        try {
            const created = await feedbackApi.create(data);
            toast.success('Feedback submitted successfully');
            setShowCreateModal(false);
            recordActivity({ eventType: 'people.feedback.submitted', eventCategory: 'data', description: `${data.feedback_type} feedback was submitted`, resourceType: 'feedback', resourceId: created?.id }).catch(() => {});
            loadFeedback();
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit feedback');
        }
    };

    const handleAcknowledge = async (id: string) => {
        try {
            await feedbackApi.acknowledge(id);
            toast.success('Feedback acknowledged');
            loadFeedback();
        } catch (error: any) {
            toast.error(error.message || 'Failed to acknowledge');
        }
    };

    const feedbackTypeTone: Record<string, 'success' | 'warning' | 'primary' | 'info'> = {
        positive: 'success',
        constructive: 'warning',
        general: 'primary',
        '360_degree': 'info',
    };

    return (
        <>
        <ListPageTemplate trail={[]}
            title="Feedback"
            description="Give and receive feedback across the team"
            loading={loading}
            isEmpty={feedbacks.length === 0}
            primaryAction={canCreate ? (
                <Button type="button" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4" /> Give Feedback
                </Button>
            ) : undefined}
            filters={(
                <Select
                    name="feedback-type-filter"
                    aria-label="Type filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    options={[
                        { value: '', label: 'All Types' },
                        { value: 'positive', label: 'Positive' },
                        { value: 'constructive', label: 'Constructive' },
                        { value: 'general', label: 'General' },
                        { value: '360_degree', label: '360 Degree' },
                    ]}
                />
            )}
            empty={(
                <EmptyState
                    icon={MessageSquare}
                    title="No feedback yet"
                    description="Start giving feedback to your team members."
                />
            )}
        >
            <DataTable<Feedback>
                name="feedback"
                rows={feedbacks}
                rowKey={(fb) => fb.id}
                columns={[
                    {
                        key: 'from_to',
                        header: 'From / To',
                        render: (fb) => (
                            <Cluster gap="tight" align="center">
                                <Avatar name={fb.is_anonymous ? undefined : fb.provider?.full_name} size="sm" />
                                <div>
                                    <p className="text-nb-sm text-fg font-medium">
                                        {fb.is_anonymous ? 'Anonymous' : fb.provider?.full_name || 'Unknown'}
                                        <span className="text-fg-muted font-normal"> to </span>
                                        {fb.person?.full_name || 'Unknown'}
                                    </p>
                                    <Cluster gap="tight" align="center">
                                        {fb.provider_relationship && (
                                            <span className="text-nb-xs text-fg-subtle capitalize">{fb.provider_relationship.replace('_', ' ')}</span>
                                        )}
                                        <span className="text-nb-xs text-fg-subtle">{formatters.formatDate(fb.created_at)}</span>
                                    </Cluster>
                                </div>
                            </Cluster>
                        ),
                    },
                    {
                        key: 'feedback_type',
                        header: 'Type',
                        render: (fb) => <Badge tone={feedbackTypeTone[fb.feedback_type] || 'neutral'}>{fb.feedback_type.replace('_', ' ')}</Badge>,
                    },
                    {
                        key: 'feedback_text',
                        header: 'Message',
                        render: (fb) => (
                            <Stack gap="tight">
                                <p className="text-nb-sm text-fg">{fb.feedback_text}</p>
                                {fb.strengths && <p className="text-nb-xs text-success">Strengths: {fb.strengths}</p>}
                                {fb.areas_for_improvement && <p className="text-nb-xs text-warning">Areas to improve: {fb.areas_for_improvement}</p>}
                            </Stack>
                        ),
                    },
                    {
                        key: 'overall_rating',
                        header: 'Rating',
                        render: (fb) => fb.overall_rating ? (
                            <Rating name={`feedback-rating-${fb.id}`} value={fb.overall_rating} readOnly aria-label={`Rating ${fb.overall_rating} of 5`} />
                        ) : null,
                    },
                    {
                        key: 'visibility',
                        header: 'Visibility',
                        align: 'center',
                        render: (fb) => fb.is_visible_to_subject ? (
                            <span title="Visible to subject"><Eye className="w-4 h-4 text-fg-subtle" /></span>
                        ) : (
                            <span title="Hidden from subject"><EyeOff className="w-4 h-4 text-fg-subtle" /></span>
                        ),
                    },
                    {
                        key: 'acknowledged',
                        header: 'Acknowledgement',
                        interactive: true,
                        render: (fb) => fb.acknowledged_at ? (
                            <span className="text-nb-xs text-fg-subtle">Acknowledged on {formatters.formatDate(fb.acknowledged_at)}</span>
                        ) : (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleAcknowledge(fb.id)}>
                                <CheckCircle className="w-4 h-4" /> Acknowledge
                            </Button>
                        ),
                    },
                ]}
            />
        </ListPageTemplate>
        {/* Sibling, not a template child: ListPageTemplate swaps children for the
            loading/empty state, which unmounted the dialog (and blocked first-ever feedback). */}
        <CreateFeedbackModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreate}
        />
        </>
    );
};

// =============================================================================
// Create Feedback Modal
// =============================================================================

interface CreateFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateFeedbackPayload) => void;
}

const CreateFeedbackModal: React.FC<CreateFeedbackModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [people, setPeople] = useState<Person[]>([]);
    const [formData, setFormData] = useState<CreateFeedbackPayload>({
        person_id: '',
        provider_id: apiContext.getUserId() || '',
        feedback_type: 'positive',
        feedback_text: '',
        is_anonymous: false,
        is_visible_to_subject: true,
    });

    useEffect(() => {
        if (isOpen) {
            peopleApi.getAll({ status: 'active', limit: 200 }).then(res => {
                setPeople(res.data || []);
            }).catch(() => {});
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.person_id || !formData.feedback_text) return;
        onCreate(formData);
    };

    const updateField = (field: keyof CreateFeedbackPayload, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Give Feedback"
            footer={(
                <Cluster gap="default" justify="end">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="feedback-form" disabled={!formData.person_id || !formData.feedback_text}>Submit Feedback</Button>
                </Cluster>
            )}
        >
            <form id="feedback-form" onSubmit={handleSubmit}>
                <Stack gap="region">
                    <Stack gap="tight">
                        <label htmlFor="feedback-person-input" className="text-nb-sm font-medium text-fg-muted">Feedback For *</label>
                        <PersonPicker
                            options={people}
                            value={formData.person_id}
                            onChange={(id) => updateField('person_id', id)}
                            placeholder="Search people..."
                            emptyMessage="No people available"
                            inputId="feedback-person-input"
                            data-testid="feedback-person-picker"
                        />
                    </Stack>

                    <Grid columns={2} gap="lg">
                        <Select
                            name="feedback_type"
                            label="Feedback Type *"
                            value={formData.feedback_type}
                            onChange={(e) => updateField('feedback_type', e.target.value)}
                            options={[{ value: 'positive', label: 'Positive' }, { value: 'constructive', label: 'Constructive' }, { value: 'general', label: 'General' }, { value: '360_degree', label: '360 Degree' }]}
                        />
                        <Select
                            name="provider_relationship"
                            label="Relationship"
                            value={formData.provider_relationship || ''}
                            onChange={(e) => updateField('provider_relationship', e.target.value || undefined)}
                            options={[{ value: '', label: 'Select...' }, { value: 'manager', label: 'Manager' }, { value: 'peer', label: 'Peer' }, { value: 'direct_report', label: 'Direct Report' }, { value: 'cross_functional', label: 'Cross-Functional' }]}
                        />
                    </Grid>

                    <Textarea
                        name="feedback_text"
                        label="Feedback *"
                        required
                        rows={4}
                        value={formData.feedback_text}
                        onChange={(e) => updateField('feedback_text', e.target.value)}
                        placeholder="Share your feedback..."
                    />

                    <TextField
                        name="strengths"
                        label="Strengths"
                        value={formData.strengths || ''}
                        onChange={(e) => updateField('strengths', e.target.value)}
                        placeholder="Highlight strengths..."
                    />

                    <TextField
                        name="areas_for_improvement"
                        label="Areas for Improvement"
                        value={formData.areas_for_improvement || ''}
                        onChange={(e) => updateField('areas_for_improvement', e.target.value)}
                        placeholder="Suggest improvements..."
                    />

                    <Rating
                        name="overall_rating"
                        label="Overall Rating"
                        value={formData.overall_rating || 0}
                        onChange={(v) => updateField('overall_rating', v)}
                    />

                    <Cluster gap="region">
                        <Checkbox
                            name="is_anonymous"
                            label="Submit anonymously"
                            checked={formData.is_anonymous}
                            onChange={(e) => updateField('is_anonymous', e.target.checked)}
                        />
                        <Checkbox
                            name="is_visible_to_subject"
                            label="Visible to subject"
                            checked={formData.is_visible_to_subject !== false}
                            onChange={(e) => updateField('is_visible_to_subject', e.target.checked)}
                        />
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

export default FeedbackPage;
