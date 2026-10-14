import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast } from '@so360/design-system';
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
        <div className="space-y-6">
            {sections.map((section) => (
                <div key={section.id} className="bg-surface-raised/50 border border-line-strong rounded-nb p-5">
                    <h4 className="text-sm font-medium text-fg mb-1">{section.title}</h4>
                    {section.description && <p className="text-xs text-fg-muted mb-4">{section.description}</p>}
                    {section.weight && <p className="text-xs text-primary mb-3">Weight: {section.weight}%</p>}

                    <div className="space-y-4">
                        {section.fields.map((field, fi) => (
                            <div key={fi}>
                                <label className="block text-xs text-fg-muted mb-1">
                                    {field.label} {field.required && <span className="text-danger">*</span>}
                                </label>

                                {field.type === 'rating' && (
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: field.max || ratingScale }).map((_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                disabled={readOnly}
                                                onClick={() => updateField(section.id, field.label, i + 1)}
                                                className="p-0.5 disabled:cursor-default"
                                            >
                                                <Star
                                                    size={20}
                                                    className={
                                                        (getFieldValue(section.id, field.label) as number || 0) > i
                                                            ? 'fill-warning text-warning'
                                                            : 'text-fg-subtle hover:text-fg-muted'
                                                    }
                                                />
                                            </button>
                                        ))}
                                        {getFieldValue(section.id, field.label) != null ? (
                                            <span className="text-sm text-fg ml-2">
                                                {String(getFieldValue(section.id, field.label))} / {field.max || ratingScale}
                                            </span>
                                        ) : null}
                                    </div>
                                )}

                                {field.type === 'textarea' && (
                                    <textarea
                                        value={(getFieldValue(section.id, field.label) as string) || ''}
                                        onChange={(e) => updateField(section.id, field.label, e.target.value)}
                                        disabled={readOnly}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'text' && (
                                    <input
                                        type="text"
                                        value={(getFieldValue(section.id, field.label) as string) || ''}
                                        onChange={(e) => updateField(section.id, field.label, e.target.value)}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'number' && (
                                    <input
                                        type="number"
                                        value={(getFieldValue(section.id, field.label) as number) || ''}
                                        onChange={(e) => updateField(section.id, field.label, parseFloat(e.target.value))}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'checkbox' && (
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!!getFieldValue(section.id, field.label)}
                                            onChange={(e) => updateField(section.id, field.label, e.target.checked)}
                                            disabled={readOnly}
                                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary"
                                        />
                                        <span className="text-sm text-fg">Yes</span>
                                    </label>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-line-strong';
            case 'self_review_pending': return 'bg-primary';
            case 'manager_review_pending': return 'bg-warning';
            case 'completed': return 'bg-success';
            default: return 'bg-line-strong';
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="h-20 bg-surface-raised/50 rounded-nb animate-pulse mb-5" />
                <div className="h-96 bg-surface-raised/50 rounded-nb animate-pulse" />
            </div>
        );
    }

    if (!review) {
        return (
            <div className="p-6">
                <p className="text-fg-muted">Review not found</p>
            </div>
        );
    }

    const sections = template?.sections || [];
    const ratingScale = template?.rating_scale || 5;
    const selfSubmitted = !!review.self_review_submitted_at;
    const managerSubmitted = !!review.manager_review_submitted_at;

    return (
        <div className="p-6 space-y-5">
            {/* Header with back button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/people/reviews')}
                    className="p-2 hover:bg-surface-raised rounded-nb transition-colors"
                >
                    <ArrowLeft size={20} className="text-fg-muted" />
                </button>
                <PageHeader
                    title={`${review.person?.full_name || 'Unknown'} - ${review.template?.name || 'Review'}`}
                    subtitle={`Review Period: ${formatters.formatDate(review.review_period_start)} - ${formatters.formatDate(review.review_period_end)}`}
                />
            </div>

            {/* Measured evidence from CRM, scoped to this review's period.
                Placed above the rating form on purpose: the reviewer should
                see the numbers before writing the assessment, not after. */}
            <div className="bg-surface border border-line rounded-nb p-6">
                <PerformanceEvidencePanel
                    personId={review.person_id}
                    periodStart={review.review_period_start}
                    periodEnd={review.review_period_end}
                />
            </div>

            {/* Review Info Card */}
            <div className="bg-surface border border-line rounded-nb p-6">
                <div className="grid grid-cols-4 gap-6">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Reviewer</label>
                        <p className="text-sm text-fg">{review.reviewer?.full_name || '-'}</p>
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Status</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-fg ${getStatusColor(review.status)}`}>
                            {review.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Self Review Deadline</label>
                        <p className="text-sm text-fg">
                            {review.self_review_deadline
                                ? formatters.formatDate(review.self_review_deadline)
                                : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Manager Review Deadline</label>
                        <p className="text-sm text-fg">
                            {review.manager_review_deadline
                                ? formatters.formatDate(review.manager_review_deadline)
                                : '-'}
                        </p>
                    </div>
                </div>

                {review.overall_rating != null && review.overall_rating > 0 && (
                    <div className="mt-6 pt-6 border-t border-line">
                        <label className="block text-xs text-fg-muted mb-2">Overall Rating</label>
                        <div className="flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    size={20}
                                    className={i < Math.round(review.overall_rating!) ? 'fill-warning text-warning' : 'text-fg-subtle'}
                                />
                            ))}
                            <span className="text-lg font-medium text-fg ml-2">{review.overall_rating.toFixed(1)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-line">
                <button
                    onClick={() => setActiveTab('self')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'self' ? 'text-primary border-b-2 border-primary' : 'text-fg-muted hover:text-fg'
                    }`}
                >
                    Self Review {selfSubmitted && <span className="text-success ml-1">&#10003;</span>}
                </button>
                <button
                    onClick={() => setActiveTab('manager')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'manager' ? 'text-primary border-b-2 border-primary' : 'text-fg-muted hover:text-fg'
                    }`}
                >
                    Manager Review {managerSubmitted && <span className="text-success ml-1">&#10003;</span>}
                </button>
                <button
                    onClick={() => setActiveTab('overall')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'overall' ? 'text-primary border-b-2 border-primary' : 'text-fg-muted hover:text-fg'
                    }`}
                >
                    Overall
                </button>
            </div>

            {/* Review Form */}
            <div className="bg-surface border border-line rounded-nb p-6">
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
                            <>
                                <ReviewForm
                                    sections={sections}
                                    ratingScale={ratingScale}
                                    data={managerFormData}
                                    onChange={setManagerFormData}
                                    readOnly={managerSubmitted}
                                />
                                {!managerSubmitted && review.status === 'manager_review_pending' && (
                                    <div className="mt-6 pt-6 border-t border-line-strong">
                                        <label className="block text-xs text-fg-muted mb-2">Overall Rating (1-5)</label>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setOverallRating(i + 1)}
                                                    className="p-0.5"
                                                >
                                                    <Star
                                                        size={24}
                                                        className={overallRating > i ? 'fill-warning text-warning' : 'text-fg-subtle hover:text-fg-muted'}
                                                    />
                                                </button>
                                            ))}
                                            {overallRating > 0 && (
                                                <span className="text-sm text-fg ml-2">{overallRating} / 5</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'overall' && (
                            <div className="space-y-6">
                                {selfSubmitted && (
                                    <div>
                                        <h4 className="text-sm font-medium text-fg mb-3">Self Review (Submitted {formatters.formatDate(review.self_review_submitted_at!)})</h4>
                                        <ReviewForm sections={sections} ratingScale={ratingScale} data={selfFormData} onChange={() => {}} readOnly />
                                    </div>
                                )}
                                {managerSubmitted && (
                                    <div>
                                        <h4 className="text-sm font-medium text-fg mb-3">Manager Review (Submitted {formatters.formatDate(review.manager_review_submitted_at!)})</h4>
                                        <ReviewForm sections={sections} ratingScale={ratingScale} data={managerFormData} onChange={() => {}} readOnly />
                                    </div>
                                )}
                                {!selfSubmitted && !managerSubmitted && (
                                    <p className="text-sm text-fg-muted text-center py-8">No reviews submitted yet.</p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-sm text-fg-muted">No template sections available. The review template may not have been configured.</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                {review.status === 'self_review_pending' && !selfSubmitted && (
                    <button
                        onClick={handleSubmitSelfReview}
                        disabled={submitting}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Submitting...' : 'Submit Self Review'}
                    </button>
                )}
                {review.status === 'manager_review_pending' && !managerSubmitted && (
                    <button
                        onClick={handleSubmitManagerReview}
                        disabled={submitting || overallRating === 0}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Submitting...' : 'Submit Manager Review'}
                    </button>
                )}
                {review.status === 'manager_review_pending' && managerSubmitted && (
                    <button
                        onClick={handleCompleteReview}
                        disabled={submitting}
                        className="px-4 py-2 bg-success hover:bg-success text-success-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Completing...' : 'Complete Review'}
                    </button>
                )}
            </div>

        </div>
    );
};

export default ReviewDetailPage;
