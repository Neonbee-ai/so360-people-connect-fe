import React, { useEffect, useState } from 'react';
import { TrendingUp, Star, Target, Users, Award } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Toast, { ToastType } from '../components/Toast';
import { performanceReviewsApi, PerformanceReview } from '../services/performanceReviewsService';
import { goalsApi, Goal } from '../services/goalsService';

const TeamPerformancePage: React.FC = () => {
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Failed to load performance data', type: 'error' });
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
                <div className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-slate-50 mb-4">Rating Distribution</h3>
                    {completedReviews.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No completed reviews yet</p>
                    ) : (
                        <div className="space-y-3">
                            {ratingDistribution.map(({ rating, count }) => (
                                <div key={rating} className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 w-20">
                                        {Array.from({ length: rating }).map((_, i) => (
                                            <Star key={i} size={12} className="fill-yellow-500 text-yellow-500" />
                                        ))}
                                    </div>
                                    <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-teal-600 rounded-full transition-all"
                                            style={{ width: `${(count / maxDistCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-slate-400 w-8 text-right">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Performers */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-slate-50 mb-4">Top Performers</h3>
                    {topPerformers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No top performers yet</p>
                    ) : (
                        <div className="space-y-3">
                            {topPerformers.map((review, i) => (
                                <div key={review.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
                                    <span className="text-xs text-slate-500 w-5">#{i + 1}</span>
                                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-medium text-slate-50">
                                        {review.person?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-50 truncate">{review.person?.full_name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-400">{review.person?.job_title || ''}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Star size={14} className="fill-yellow-500 text-yellow-500" />
                                        <span className="text-sm font-medium text-slate-50">{review.overall_rating?.toFixed(1)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Goals Overview */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-slate-50 mb-4">Goals Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-slate-50">{goals.length}</p>
                        <p className="text-xs text-slate-400 mt-1">Total Goals</p>
                    </div>
                    <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-teal-400">{activeGoals.length}</p>
                        <p className="text-xs text-slate-400 mt-1">In Progress</p>
                    </div>
                    <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-green-400">{completedGoals.length}</p>
                        <p className="text-xs text-slate-400 mt-1">Completed</p>
                    </div>
                    <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                        <p className="text-2xl font-bold text-amber-400">{Math.round(avgGoalProgress)}%</p>
                        <p className="text-xs text-slate-400 mt-1">Avg Progress</p>
                    </div>
                </div>
            </div>

            {/* Review Status Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-slate-50 mb-4">Review Pipeline</h3>
                <div className="flex items-center gap-2 h-8">
                    {[
                        { status: 'draft', label: 'Draft', color: 'bg-slate-600', count: reviews.filter(r => r.status === 'draft').length },
                        { status: 'self_review_pending', label: 'Self Review', color: 'bg-blue-600', count: reviews.filter(r => r.status === 'self_review_pending').length },
                        { status: 'manager_review_pending', label: 'Manager Review', color: 'bg-yellow-600', count: reviews.filter(r => r.status === 'manager_review_pending').length },
                        { status: 'completed', label: 'Completed', color: 'bg-green-600', count: completedReviews.length },
                    ].map(({ label, color, count }) => {
                        const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                            <div
                                key={label}
                                className={`${color} rounded-md h-full flex items-center justify-center text-xs text-slate-50 font-medium transition-all`}
                                style={{ width: `${pct}%`, minWidth: count > 0 ? '60px' : 0 }}
                                title={`${label}: ${count}`}
                            >
                                {count > 0 && `${label} (${count})`}
                            </div>
                        );
                    })}
                    {reviews.length === 0 && (
                        <p className="text-sm text-slate-400">No reviews in pipeline</p>
                    )}
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TeamPerformancePage;
