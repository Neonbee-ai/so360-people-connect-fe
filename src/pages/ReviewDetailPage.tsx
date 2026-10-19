import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    toast, DetailPageTemplate, Card, Stack, Cluster, Grid, Button, Badge, Rating,
    TextField, Textarea, NumberInput, Checkbox,
} from '@so360/design-system';
import { useActivity } from '@so360/shell-context';
import { usePeopleFormatters } from '../utils/formatters';
import { performanceReviewsApi, PerformanceReview } from '../services/performanceReviewsService';
import { reviewTemplatesApi, ReviewTemplate, ReviewTemplateSection } from '../services/reviewTemplatesService';
import PerformanceEvidencePanel from '../components/PerformanceEvidencePanel';

// Dynamic review form that renders template sections and fields
const ReviewForm: React.FC<{
    sections: ReviewTemplateSection[];
    ratingScale: number;
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
    readOnly?: boolean;
}> = ({ sections, ratingScale, data, onChange, readOnly }) => {
    const updateField = (sectionId: string, fieldLabel: string, value: unknown) => {
        const key = `${sectionId}__${fieldLabel}`;
        onChange({ ...data, [key]: value });
    };

    const getFieldValue = (sectionId: string, fieldLabel: string) => {
        return data[`${sectionId}__${fieldLabel}`];
    };

    return (
        <Stack gap="region">
            {sections.map((section) => (
                <Card key={section.id} name={`review-section-${section.id}`}>
                    <Stack gap="default">
                        <div>
                            <h4 className="text-nb-sm font-medium text-fg">{section.title}</h4>
                            {section.description && <p className="text-nb-xs text-fg-muted">{section.description}</p>}
                            {section.weight && <p className="text-nb-xs text-primary">Weight: {section.weight}%</p>}
                        </div>

                        {section.fields.map((field, fi) => {
                            const fieldName = `${section.id}__${field.label}`;
                            const value = getFieldValue(section.id, field.label);
                            if (field.type === 'rating') {
                                const max = field.max || ratingScale;
                                return (
                                    <Cluster key={fi} gap="default" align="center">
                                        <Rating
                                            name={fieldName}
                                            label={field.label}
                                            required={field.required}
                                            value={(value as number) || 0}
                                            max={max}
                                            readOnly={readOnly}
                                            onChange={(v: number) => updateField(section.id, field.label, v)}
                                        />
                                        {value != null ? (
                                            <span className="text-nb-sm text-fg">{String(value)} / {max}</span>
                                        ) : null}
                                    </Cluster>
                                );
                            }
                            if (field.type === 'textarea') {
                                return (
                                    <Textarea
                                        key={fi}
                                        name={fieldName}
                                        label={field.label}
                                        required={field.required}
                                        rows={3}
                                        value={(value as string) || ''}
                                        onChange={(e) => updateField(section.id, field.label, e.target.value)}
                                        disabled={readOnly}
                                    />
                                );
                            }
                            if (field.type === 'text') {
                                return (
                                    <TextField
                                        key={fi}
                                        name={fieldName}
                                        label={field.label}
                                        required={field.required}
                                        value={(value as string) || ''}
                                        onChange={(e) => updateField(section.id, field.label, e.target.value)}
                                        disabled={readOnly}
                                    />
                                );
                            }
                            if (field.type === 'number') {
                                return (
                                    <NumberInput
                                        key={fi}
                                        name={fieldName}
                                        label={field.label}
                                        required={field.required}
                                        value={(value as number) ?? null}
                                        onChange={(n) => updateField(section.id, field.label, n)}
                                        disabled={readOnly}
                                    />
                                );
                            }
                            if (field.type === 'checkbox') {
                                return (
                                    <Checkbox
                                        key={fi}
                                        name={fieldName}
                                        label={`${field.label}${field.required ? ' *' : ''} - Yes`}
                                        checked={!!value}
                                        onChange={(e) => updateField(section.id, field.label, e.target.checked)}
                                        disabled={readOnly}
                                    />
                                );
                            }
                            return null;
                        })}
                    </Stack>
                </Card>
            ))}
        </Stack>
    );
};

const ReviewDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const formatters = usePeopleFormatters();
    const [review, setReview] = useState<PerformanceReview | null>(null);
    const [template, setTemplate] = useState<ReviewTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'self' | 'manager' | 'overall'>('self');
    const [selfFormData, setSelfFormData] = useState<Record<string, unknown>>({});
    const [managerFormData, setManagerFormData] = useState<Record<string, unknown>>({});
    const [overallRating, setOverallRating] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (id) loadReview(id);
    }, [id]);

    const loadReview = async (reviewId: string) => {
        try {
            setLoading(true);
            const data = await performanceReviewsApi.getById(reviewId);
            setReview(data);

            // Load template for form rendering
            if (data.template_id) {
                try {
                    const tmpl = await reviewTemplatesApi.getById(data.template_id);
                    setTemplate(tmpl);
                } catch {
                    // Template may not be fetched separately if included in review
                }
            }

            // Pre-populate form data from existing review data
            if (data.self_review_data) {
                setSelfFormData(data.self_review_data as Record<string, unknown>);
            }
            if (data.manager_review_data) {
                setManagerFormData(data.manager_review_data as Record<string, unknown>);
            }
            if (data.overall_rating) {
                setOverallRating(data.overall_rating);
            }
        } catch (error) {
            console.error('Failed to load review:', error);
            toast.error('Failed to load review');
        } finally {
            setLoading(false);
        }
    };

    const calculateOverallFromForm = (formData: Record<string, unknown>, sections: ReviewTemplateSection[], ratingScale: number): number => {
        let totalWeight = 0;
        let weightedSum = 0;

        for (const section of sections) {
            const weight = section.weight || (100 / sections.length);
            let sectionRatings: number[] = [];

            for (const field of section.fields) {
                if (field.type === 'rating') {
                    const val = formData[`${section.id}__${field.label}`] as number;
                    if (val) sectionRatings.push(val);
                }
            }

            if (sectionRatings.length > 0) {
                const avgRating = sectionRatings.reduce((a, b) => a + b, 0) / sectionRatings.length;
                const normalizedRating = (avgRating / ratingScale) * 5; // Normalize to 5-point scale
                weightedSum += normalizedRating * weight;
                totalWeight += weight;
            }
        }

        return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
    };

    const handleSubmitSelfReview = async () => {
        if (!review) return;
        setSubmitting(true);
        try {
            await performanceReviewsApi.submitSelfReview(review.id, selfFormData);
            toast.success('Self review submitted successfully');
            recordActivity({ eventType: 'people.review.submitted', eventCategory: 'data', description: `Self review submitted for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit self review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitManagerReview = async () => {
        if (!review || !template) return;
        setSubmitting(true);
        try {
            const calculatedRating = overallRating || calculateOverallFromForm(managerFormData, template.sections, template.rating_scale);
            await performanceReviewsApi.submitManagerReview(review.id, managerFormData, calculatedRating);
            toast.success('Manager review submitted successfully');
            recordActivity({ eventType: 'people.review.updated', eventCategory: 'data', description: `Manager review submitted for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit manager review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompleteReview = async () => {
        if (!review) return;
        setSubmitting(true);
        try {
            await performanceReviewsApi.complete(review.id);
            toast.success('Review completed successfully');
            recordActivity({ eventType: 'people.review.completed', eventCategory: 'data', description: `Performance review completed for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            toast.error(error.message || 'Failed to complete review');
        } finally {
            setSubmitting(false);
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

    if (loading) {
        return <DetailPageTemplate title="Review" loading>{null}</DetailPageTemplate>;
    }

    if (!review) {
        return (
            <DetailPageTemplate title="Review" onBack={() => navigate('/people/reviews')} backLabel="Back">
                <p className="text-nb-sm text-fg-muted">Review not found</p>
            </DetailPageTemplate>
        );
    }

    const sections = template?.sections || [];
    const ratingScale = template?.rating_scale || 5;
    const selfSubmitted = !!review.self_review_submitted_at;
    const managerSubmitted = !!review.manager_review_submitted_at;

    let primaryAction: React.ReactNode;
    if (review.status === 'self_review_pending' && !selfSubmitted) {
        primaryAction = (
            <Button type="button" onClick={handleSubmitSelfReview} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Self Review'}
            </Button>
        );
    } else if (review.status === 'manager_review_pending' && !managerSubmitted) {
        primaryAction = (
            <Button type="button" onClick={handleSubmitManagerReview} disabled={submitting || overallRating === 0}>
                {submitting ? 'Submitting...' : 'Submit Manager Review'}
            </Button>
        );
    } else if (review.status === 'manager_review_pending' && managerSubmitted) {
        primaryAction = (
            <Button type="button" onClick={handleCompleteReview} disabled={submitting}>
                {submitting ? 'Completing...' : 'Complete Review'}
            </Button>
        );
    }

    return (
        <DetailPageTemplate
            title={`${review.person?.full_name || 'Unknown'} - ${review.template?.name || 'Review'}`}
            meta={<span className="text-nb-sm text-fg-muted">{`Review Period: ${formatters.formatDate(review.review_period_start)} - ${formatters.formatDate(review.review_period_end)}`}</span>}
            onBack={() => navigate('/people/reviews')}
            backLabel="Back"
            primaryAction={primaryAction}
            tabs={[
                { id: 'self', label: `Self Review${selfSubmitted ? ' \u2713' : ''}` },
                { id: 'manager', label: `Manager Review${managerSubmitted ? ' \u2713' : ''}` },
                { id: 'overall', label: 'Overall' },
            ]}
            activeTab={activeTab}
            onTabChange={(t: string) => setActiveTab(t as 'self' | 'manager' | 'overall')}
        >
            <Stack gap="region">
                {/* Measured evidence from CRM, scoped to this review's period.
                    Placed above the rating form on purpose: the reviewer should
                    see the numbers before writing the assessment, not after. */}
                <Card name="review-evidence">
                    <PerformanceEvidencePanel
                        personId={review.person_id}
                        periodStart={review.review_period_start}
                        periodEnd={review.review_period_end}
                    />
                </Card>

                <Card name="review-info">
                    <Stack gap="region">
                        <Grid columns={4} gap="lg">
                            <div>
                                <span className="text-nb-xs text-fg-muted">Reviewer</span>
                                <p className="text-nb-sm text-fg">{review.reviewer?.full_name || '-'}</p>
                            </div>
                            <div>
                                <span className="text-nb-xs text-fg-muted">Status</span>
                                <div>
                                    <Badge tone={statusTone(review.status)}>{review.status.replace(/_/g, ' ')}</Badge>
                                </div>
                            </div>
                            <div>
                                <span className="text-nb-xs text-fg-muted">Self Review Deadline</span>
                                <p className="text-nb-sm text-fg">
                                    {review.self_review_deadline ? formatters.formatDate(review.self_review_deadline) : '-'}
                                </p>
                            </div>
                            <div>
                                <span className="text-nb-xs text-fg-muted">Manager Review Deadline</span>
                                <p className="text-nb-sm text-fg">
                                    {review.manager_review_deadline ? formatters.formatDate(review.manager_review_deadline) : '-'}
                                </p>
                            </div>
                        </Grid>

                        {review.overall_rating != null && review.overall_rating > 0 && (
                            <Cluster gap="default" align="center">
                                <Rating name="review-overall-display" label="Overall Rating" value={Math.round(review.overall_rating)} readOnly />
                                <span className="text-nb-lg font-medium text-fg">{review.overall_rating.toFixed(1)}</span>
                            </Cluster>
                        )}
                    </Stack>
                </Card>

                <Card name="review-form">
                    {sections.length > 0 ? (
                        <>
                            {activeTab === 'self' && (
                                <ReviewForm
                                    sections={sections}
                                    ratingScale={ratingScale}
                                    data={selfFormData}
                                    onChange={setSelfFormData}
                                    readOnly={selfSubmitted}
                                />
                            )}
                            {activeTab === 'manager' && (
                                <Stack gap="region">
                                    <ReviewForm
                                        sections={sections}
                                        ratingScale={ratingScale}
                                        data={managerFormData}
                                        onChange={setManagerFormData}
                                        readOnly={managerSubmitted}
                                    />
                                    {!managerSubmitted && review.status === 'manager_review_pending' && (
                                        <Cluster gap="default" align="center">
                                            <Rating
                                                name="overall_rating"
                                                label="Overall Rating (1-5)"
                                                value={overallRating}
                                                max={5}
                                                onChange={(v: number) => setOverallRating(v)}
                                            />
                                            {overallRating > 0 && (
                                                <span className="text-nb-sm text-fg">{overallRating} / 5</span>
                                            )}
                                        </Cluster>
                                    )}
                                </Stack>
                            )}
                            {activeTab === 'overall' && (
                                <Stack gap="region">
                                    {selfSubmitted && (
                                        <div>
                                            <h4 className="text-nb-sm font-medium text-fg">Self Review (Submitted {formatters.formatDate(review.self_review_submitted_at!)})</h4>
                                            <ReviewForm sections={sections} ratingScale={ratingScale} data={selfFormData} onChange={() => {}} readOnly />
                                        </div>
                                    )}
                                    {managerSubmitted && (
                                        <div>
                                            <h4 className="text-nb-sm font-medium text-fg">Manager Review (Submitted {formatters.formatDate(review.manager_review_submitted_at!)})</h4>
                                            <ReviewForm sections={sections} ratingScale={ratingScale} data={managerFormData} onChange={() => {}} readOnly />
                                        </div>
                                    )}
                                    {!selfSubmitted && !managerSubmitted && (
                                        <p className="text-nb-sm text-fg-muted text-center">No reviews submitted yet.</p>
                                    )}
                                </Stack>
                            )}
                        </>
                    ) : (
                        <p className="text-nb-sm text-fg-muted text-center">No template sections available. The review template may not have been configured.</p>
                    )}
                </Card>
            </Stack>
        </DetailPageTemplate>
    );
};

export default ReviewDetailPage;
