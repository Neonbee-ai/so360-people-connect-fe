import React, { useEffect, useState } from 'react';
import { TrendingUp, Star, Target, Award } from 'lucide-react';
import {
    toast, DashboardPageTemplate, KpiCard, Card, Stack, Cluster, Badge, Avatar, Progress, Rating, EmptyState,
} from '@so360/design-system';
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

    const pipeline = [
        { label: 'Draft', tone: 'neutral' as const, count: reviews.filter(r => r.status === 'draft').length },
        { label: 'Self Review', tone: 'primary' as const, count: reviews.filter(r => r.status === 'self_review_pending').length },
        { label: 'Manager Review', tone: 'warning' as const, count: reviews.filter(r => r.status === 'manager_review_pending').length },
        { label: 'Completed', tone: 'success' as const, count: completedReviews.length },
    ].filter(x => x.count > 0);

    return (
        <DashboardPageTemplate trail={[]}
            title="Team Performance"
            description="Analytics and insights across reviews and goals"
            kpis={[
                <KpiCard key="avg" name="avg-rating" label="Avg Rating" value={avgRating > 0 ? avgRating.toFixed(1) : '-'} icon={Star} loading={loading} />,
                <KpiCard key="completed" name="completed-reviews" label="Completed Reviews" value={completedReviews.length} icon={Award} loading={loading} />,
                <KpiCard key="pending" name="pending-reviews" label="Pending Reviews" value={pendingReviews.length} icon={TrendingUp} loading={loading} />,
                <KpiCard key="goal" name="avg-goal-progress" label="Avg Goal Progress" value={`${Math.round(avgGoalProgress)}%`} hint={`${activeGoals.length} active · ${completedGoals.length} completed`} icon={Target} loading={loading} />,
            ]}
            primary={(
                <Card title="Rating Distribution">
                    {completedReviews.length === 0 ? (
                        <EmptyState icon={Star} title="No completed reviews yet" />
                    ) : (
                        <Stack gap="default">
                            {ratingDistribution.map(({ rating, count }) => (
                                <Cluster key={rating} gap="default" align="center">
                                    <Rating name={`distribution-${rating}`} value={rating} max={rating} readOnly aria-label={`${rating} star${rating > 1 ? 's' : ''}`} />
                                    <div className="flex-1">
                                        <Progress value={(count / maxDistCount) * 100} label={`${rating} star reviews`} />
                                    </div>
                                    <span className="text-nb-sm text-fg-muted">{count}</span>
                                </Cluster>
                            ))}
                        </Stack>
                    )}
                </Card>
            )}
            secondary={(
                <Card title="Top Performers">
                    {topPerformers.length === 0 ? (
                        <EmptyState icon={Award} title="No top performers yet" />
                    ) : (
                        <Stack gap="default">
                            {topPerformers.map((review, i) => (
                                <Cluster key={review.id} gap="default" align="center">
                                    <span className="text-nb-xs text-fg-subtle">#{i + 1}</span>
                                    <Avatar name={review.person?.full_name || '?'} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-nb-sm text-fg truncate">{review.person?.full_name || 'Unknown'}</p>
                                        <p className="text-nb-xs text-fg-muted">{review.person?.job_title || ''}</p>
                                    </div>
                                    <Cluster gap="tight" align="center">
                                        <Star className="w-4 h-4 text-warning" />
                                        <span className="text-nb-sm font-medium text-fg">{review.overall_rating?.toFixed(1)}</span>
                                    </Cluster>
                                </Cluster>
                            ))}
                        </Stack>
                    )}
                </Card>
            )}
            bottom={(
                <Stack gap="region">
                    <Card title="Goals Summary">
                        <Cluster gap="default">
                            <Badge tone="neutral">{`Total (${goals.length})`}</Badge>
                            <Badge tone="primary">{`In Progress (${activeGoals.length})`}</Badge>
                            <Badge tone="success">{`Completed (${completedGoals.length})`}</Badge>
                        </Cluster>
                    </Card>
                    <Card title="Review Pipeline">
                        {reviews.length === 0 ? (
                            <EmptyState icon={TrendingUp} title="No reviews in pipeline" />
                        ) : (
                            <Cluster gap="default">
                                {pipeline.map(({ label, tone, count }) => (
                                    <Badge key={label} tone={tone}>{`${label} (${count})`}</Badge>
                                ))}
                            </Cluster>
                        )}
                    </Card>
                </Stack>
            )}
        />
    );
};

export default TeamPerformancePage;
