import React, { useEffect, useState } from 'react';
import { TrendingUp, Star, Target, Users, Award } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { toast } from '@so360/design-system';
import { performanceReviewsApi, PerformanceReview } from '../services/performanceReviewsService';
import { goalsApi, Goal } from '../services/goalsService';

const TeamPerformancePage: React.FC = () => {
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reviewsRes, goalsRes] = await Promise.all([
                performanceReviewsApi.getAll({ limit: 100 }),
                goalsApi.getAll({ limit: 100 }),
            ]);
            setReviews(reviewsRes.data || []);
            setGoals(goalsRes.data || []);
        } catch (error) {
            console.error('Failed to load team performance data:', error);
            toast.error('Failed to load performance data');
        } finally {
            setLoading(false);
        }
    };

    // Compute stats
    const completedReviews = reviews.filter(r => r.status === 'completed');
    const avgRating = completedReviews.length > 0
        ? completedReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / completedReviews.length
        : 0;
    const pendingReviews = reviews.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
    const activeGoals = goals.filter(g => g.status === 'in_progress');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const avgGoalProgress = activeGoals.length > 0
        ? activeGoals.reduce((sum, g) => sum + (g.progress_percentage || 0), 0) / activeGoals.length
        : 0;

    // Rating distribution
    const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
        rating: r,
        count: completedReviews.filter(rev => Math.round(rev.overall_rating || 0) === r).length,
    }));
    const maxDistCount = Math.max(...ratingDistribution.map(d => d.count), 1);

    // Top performers
    const topPerformers = completedReviews
        .filter(r => r.overall_rating && r.overall_rating >= 4)
        .sort((a, b) => (b.overall_rating || 0) - (a.overall_rating || 0))
        .slice(0, 5);

    if (loading) {
        return (
            <div className="p-6 space-y-5">
                <div className="h-20 bg-surface-raised/50 rounded-nb animate-pulse" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Team Performance"
                subtitle="Analytics and insights across reviews and goals"
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    label="Avg Rating"
                    value={avgRating > 0 ? avgRating.toFixed(1) : '-'}
                    icon={Star}
                    color="amber"
                />
                <StatCard
                    label="Completed Reviews"
                    value={completedReviews.length}
                    icon={Award}
                    color="emerald"
                />
                <StatCard
                    label="Pending Reviews"
                    value={pendingReviews.length}
                    icon={TrendingUp}
                    color="amber"
                />
                <StatCard
                    label="Avg Goal Progress"
                    value={`${Math.round(avgGoalProgress)}%`}
                    icon={Target}
                    color="teal"
                />
            </div>

            <div className="grid grid-cols-2 gap-5">
                {/* Rating Distribution */}
                <div className="bg-surface border border-line rounded-nb p-6">
                    <h3 className="text-sm font-medium text-fg mb-4">Rating Distribution</h3>
                    {completedReviews.length === 0 ? (
                        <p className="text-sm text-fg-muted text-center py-8">No completed reviews yet</p>
                    ) : (
                        <div className="space-y-3">
                            {ratingDistribution.map(({ rating, count }) => (
                                <div key={rating} className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 w-20">
                                        {Array.from({ length: rating }).map((_, i) => (
                                            <Star key={i} size={12} className="fill-warning text-warning" />
                                        ))}
                                    </div>
                                    <div className="flex-1 h-6 bg-surface-raised rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all"
                                            style={{ width: `${(count / maxDistCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-fg-muted w-8 text-right">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Performers */}
                <div className="bg-surface border border-line rounded-nb p-6">
                    <h3 className="text-sm font-medium text-fg mb-4">Top Performers</h3>
                    {topPerformers.length === 0 ? (
                        <p className="text-sm text-fg-muted text-center py-8">No top performers yet</p>
                    ) : (
                        <div className="space-y-3">
                            {topPerformers.map((review, i) => (
                                <div key={review.id} className="flex items-center gap-3 px-3 py-2 bg-surface-raised/50 rounded-nb">
                                    <span className="text-xs text-fg-subtle w-5">#{i + 1}</span>
                                    <div className="w-8 h-8 bg-line rounded-full flex items-center justify-center text-xs font-medium text-fg">
                                        {review.person?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-fg truncate">{review.person?.full_name || 'Unknown'}</p>
                                        <p className="text-xs text-fg-muted">{review.person?.job_title || ''}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Star size={14} className="fill-warning text-warning" />
                                        <span className="text-sm font-medium text-fg">{review.overall_rating?.toFixed(1)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Goals Overview */}
            <div className="bg-surface border border-line rounded-nb p-6">
                <h3 className="text-sm font-medium text-fg mb-4">Goals Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-surface-raised/50 rounded-nb">
                        <p className="text-2xl font-bold text-fg">{goals.length}</p>
                        <p className="text-xs text-fg-muted mt-1">Total Goals</p>
                    </div>
                    <div className="text-center p-4 bg-surface-raised/50 rounded-nb">
                        <p className="text-2xl font-bold text-primary">{activeGoals.length}</p>
                        <p className="text-xs text-fg-muted mt-1">In Progress</p>
                    </div>
                    <div className="text-center p-4 bg-surface-raised/50 rounded-nb">
                        <p className="text-2xl font-bold text-success">{completedGoals.length}</p>
                        <p className="text-xs text-fg-muted mt-1">Completed</p>
                    </div>
                    <div className="text-center p-4 bg-surface-raised/50 rounded-nb">
                        <p className="text-2xl font-bold text-warning">{Math.round(avgGoalProgress)}%</p>
                        <p className="text-xs text-fg-muted mt-1">Avg Progress</p>
                    </div>
                </div>
            </div>

            {/* Review Status Breakdown */}
            <div className="bg-surface border border-line rounded-nb p-6">
                <h3 className="text-sm font-medium text-fg mb-4">Review Pipeline</h3>
                <div className="flex items-center gap-2 h-8">
                    {[
                        { status: 'draft', label: 'Draft', color: 'bg-line-strong', count: reviews.filter(r => r.status === 'draft').length },
                        { status: 'self_review_pending', label: 'Self Review', color: 'bg-primary', count: reviews.filter(r => r.status === 'self_review_pending').length },
                        { status: 'manager_review_pending', label: 'Manager Review', color: 'bg-warning', count: reviews.filter(r => r.status === 'manager_review_pending').length },
                        { status: 'completed', label: 'Completed', color: 'bg-success', count: completedReviews.length },
                    ].map(({ label, color, count }) => {
                        const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                            <div
                                key={label}
                                className={`${color} rounded-nb-sm h-full flex items-center justify-center text-xs text-fg font-medium transition-all`}
                                style={{ width: `${pct}%`, minWidth: count > 0 ? '60px' : 0 }}
                                title={`${label}: ${count}`}
                            >
                                {count > 0 && `${label} (${count})`}
                            </div>
                        );
                    })}
                    {reviews.length === 0 && (
                        <p className="text-sm text-fg-muted">No reviews in pipeline</p>
                    )}
                </div>
            </div>

        </div>
    );
};

export default TeamPerformancePage;
