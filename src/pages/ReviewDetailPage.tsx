import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Toast, { ToastType } from '../components/Toast';
import { useActivity } from '@so360/shell-context';
import { performanceReviewsApi, PerformanceReview } from '../services/performanceReviewsService';
import { reviewTemplatesApi, ReviewTemplate, ReviewTemplateSection } from '../services/reviewTemplatesService';

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
                <div key={section.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                    <h4 className="text-sm font-medium text-slate-50 mb-1">{section.title}</h4>
                    {section.description && <p className="text-xs text-slate-400 mb-4">{section.description}</p>}
                    {section.weight && <p className="text-xs text-teal-400 mb-3">Weight: {section.weight}%</p>}

                    <div className="space-y-4">
                        {section.fields.map((field, fi) => (
                            <div key={fi}>
                                <label className="block text-xs text-slate-400 mb-1">
                                    {field.label} {field.required && <span className="text-red-400">*</span>}
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
                                                            ? 'fill-yellow-500 text-yellow-500'
                                                            : 'text-slate-600 hover:text-slate-400'
                                                    }
                                                />
                                            </button>
                                        ))}
                                        {getFieldValue(section.id, field.label) != null ? (
                                            <span className="text-sm text-slate-50 ml-2">
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
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500 disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'text' && (
                                    <input
                                        type="text"
                                        value={(getFieldValue(section.id, field.label) as string) || ''}
                                        onChange={(e) => updateField(section.id, field.label, e.target.value)}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500 disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'number' && (
                                    <input
                                        type="number"
                                        value={(getFieldValue(section.id, field.label) as number) || ''}
                                        onChange={(e) => updateField(section.id, field.label, parseFloat(e.target.value))}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500 disabled:opacity-60"
                                    />
                                )}

                                {field.type === 'checkbox' && (
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!!getFieldValue(section.id, field.label)}
                                            onChange={(e) => updateField(section.id, field.label, e.target.checked)}
                                            disabled={readOnly}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-teal-600"
                                        />
                                        <span className="text-sm text-slate-300">Yes</span>
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
    const [review, setReview] = useState<PerformanceReview | null>(null);
    const [template, setTemplate] = useState<ReviewTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'self' | 'manager' | 'overall'>('self');
    const [selfFormData, setSelfFormData] = useState<Record<string, unknown>>({});
    const [managerFormData, setManagerFormData] = useState<Record<string, unknown>>({});
    const [overallRating, setOverallRating] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Failed to load review', type: 'error' });
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
            setToast({ message: 'Self review submitted successfully', type: 'success' });
            recordActivity({ eventType: 'people.review.submitted', eventCategory: 'data', description: `Self review submitted for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to submit self review', type: 'error' });
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
            setToast({ message: 'Manager review submitted successfully', type: 'success' });
            recordActivity({ eventType: 'people.review.updated', eventCategory: 'data', description: `Manager review submitted for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to submit manager review', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompleteReview = async () => {
        if (!review) return;
        setSubmitting(true);
        try {
            await performanceReviewsApi.complete(review.id);
            setToast({ message: 'Review completed successfully', type: 'success' });
            recordActivity({ eventType: 'people.review.completed', eventCategory: 'data', description: `Performance review completed for ${review.person?.full_name || 'person'}`, resourceType: 'review', resourceId: review.id }).catch(() => {});
            if (id) loadReview(id);
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to complete review', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-600';
            case 'self_review_pending': return 'bg-blue-600';
            case 'manager_review_pending': return 'bg-yellow-600';
            case 'completed': return 'bg-green-600';
            default: return 'bg-slate-600';
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="h-20 bg-slate-800/50 rounded-xl animate-pulse mb-5" />
                <div className="h-96 bg-slate-800/50 rounded-xl animate-pulse" />
            </div>
        );
    }

    if (!review) {
        return (
            <div className="p-6">
                <p className="text-slate-400">Review not found</p>
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
                    onClick={() => navigate('/reviews')}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-400" />
                </button>
                <PageHeader
                    title={`${review.person?.full_name || 'Unknown'} - ${review.template?.name || 'Review'}`}
                    subtitle={`Review Period: ${new Date(review.review_period_start).toLocaleDateString()} - ${new Date(review.review_period_end).toLocaleDateString()}`}
                />
            </div>

            {/* Review Info Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="grid grid-cols-4 gap-6">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Reviewer</label>
                        <p className="text-sm text-slate-50">{review.reviewer?.full_name || '-'}</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Status</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-slate-50 ${getStatusColor(review.status)}`}>
                            {review.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Self Review Deadline</label>
                        <p className="text-sm text-slate-50">
                            {review.self_review_deadline
                                ? new Date(review.self_review_deadline).toLocaleDateString()
                                : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Manager Review Deadline</label>
                        <p className="text-sm text-slate-50">
                            {review.manager_review_deadline
                                ? new Date(review.manager_review_deadline).toLocaleDateString()
                                : '-'}
                        </p>
                    </div>
                </div>

                {review.overall_rating != null && review.overall_rating > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                        <label className="block text-xs text-slate-400 mb-2">Overall Rating</label>
                        <div className="flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    size={20}
                                    className={i < Math.round(review.overall_rating!) ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600'}
                                />
                            ))}
                            <span className="text-lg font-medium text-slate-50 ml-2">{review.overall_rating.toFixed(1)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('self')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'self' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    Self Review {selfSubmitted && <span className="text-green-400 ml-1">&#10003;</span>}
                </button>
                <button
                    onClick={() => setActiveTab('manager')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'manager' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    Manager Review {managerSubmitted && <span className="text-green-400 ml-1">&#10003;</span>}
                </button>
                <button
                    onClick={() => setActiveTab('overall')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'overall' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    Overall
                </button>
            </div>

            {/* Review Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
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
                                    <div className="mt-6 pt-6 border-t border-slate-700">
                                        <label className="block text-xs text-slate-400 mb-2">Overall Rating (1-5)</label>
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
                                                        className={overallRating > i ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600 hover:text-slate-400'}
                                                    />
                                                </button>
                                            ))}
                                            {overallRating > 0 && (
                                                <span className="text-sm text-slate-50 ml-2">{overallRating} / 5</span>
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
                                        <h4 className="text-sm font-medium text-slate-50 mb-3">Self Review (Submitted {new Date(review.self_review_submitted_at!).toLocaleDateString()})</h4>
                                        <ReviewForm sections={sections} ratingScale={ratingScale} data={selfFormData} onChange={() => {}} readOnly />
                                    </div>
                                )}
                                {managerSubmitted && (
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-50 mb-3">Manager Review (Submitted {new Date(review.manager_review_submitted_at!).toLocaleDateString()})</h4>
                                        <ReviewForm sections={sections} ratingScale={ratingScale} data={managerFormData} onChange={() => {}} readOnly />
                                    </div>
                                )}
                                {!selfSubmitted && !managerSubmitted && (
                                    <p className="text-sm text-slate-400 text-center py-8">No reviews submitted yet.</p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-sm text-slate-400">No template sections available. The review template may not have been configured.</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                {review.status === 'self_review_pending' && !selfSubmitted && (
                    <button
                        onClick={handleSubmitSelfReview}
                        disabled={submitting}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Submitting...' : 'Submit Self Review'}
                    </button>
                )}
                {review.status === 'manager_review_pending' && !managerSubmitted && (
                    <button
                        onClick={handleSubmitManagerReview}
                        disabled={submitting || overallRating === 0}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Submitting...' : 'Submit Manager Review'}
                    </button>
                )}
                {review.status === 'manager_review_pending' && managerSubmitted && (
                    <button
                        onClick={handleCompleteReview}
                        disabled={submitting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Completing...' : 'Complete Review'}
                    </button>
                )}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ReviewDetailPage;
