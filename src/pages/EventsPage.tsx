import React, { useEffect, useState, useCallback } from 'react';
import {
    Activity, Filter, Calendar, User,
    UserPlus, Target, Clock, CheckCircle, UserMinus,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Toast, { ToastType } from '../components/Toast';
import { eventsApi } from '../services/peopleService';
import type { PeopleEvent } from '../types/people';

const EventsPage: React.FC = () => {
    const [events, setEvents] = useState<PeopleEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalEvents, setTotalEvents] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadEvents = useCallback(async () => {
        try {
            setLoading(true);
            const result = await eventsApi.getAll({
                event_type: eventTypeFilter || undefined,
                page,
                limit: 30,
            });
            setEvents(result.data);
            setTotalEvents(result.total);
        } catch (error) {
            console.error('Failed to load events:', error);
            setToast({ message: 'Failed to load events', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [eventTypeFilter, page]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const eventTypeConfig: Record<string, { icon: React.FC<{ size?: number; className?: string }>; color: string; label: string }> = {
        person_created: { icon: UserPlus, color: 'text-emerald-400', label: 'Person Created' },
        person_allocated: { icon: Target, color: 'text-blue-400', label: 'Person Allocated' },
        time_logged: { icon: Clock, color: 'text-teal-400', label: 'Time Logged' },
        timesheet_approved: { icon: CheckCircle, color: 'text-emerald-400', label: 'Timesheet Approved' },
        person_released: { icon: UserMinus, color: 'text-amber-400', label: 'Person Released' },
    };

    const formatRelativeTime = (dateStr: string): string => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderEventDescription = (event: PeopleEvent): string => {
        const payload = event.payload as Record<string, unknown>;
        switch (event.event_type) {
            case 'person_created':
                return `${payload.full_name || 'Unknown'} added as ${payload.type || 'resource'}`;
            case 'person_allocated':
                return `Allocated ${payload.allocation_value || '?'}${payload.allocation_type === 'hours' ? 'h' : '%'} to ${payload.entity_name || payload.entity_type || 'entity'}`;
            case 'time_logged':
                return `${payload.hours || '?'}h logged on ${payload.entity_name || 'entity'}`;
            case 'timesheet_approved':
                return `${payload.hours || '?'}h approved ($${payload.total_cost || '0'}) for ${payload.entity_name || 'entity'}`;
            case 'person_released':
                return `Released from allocation (${payload.reason || 'completed'})`;
            default:
                return JSON.stringify(payload).substring(0, 80);
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="People Events"
                subtitle="Immutable event log for audit and integration"
            />

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={eventTypeFilter}
                    onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Event Types</option>
                    <option value="person_created">Person Created</option>
                    <option value="person_allocated">Person Allocated</option>
                    <option value="time_logged">Time Logged</option>
                    <option value="timesheet_approved">Timesheet Approved</option>
                    <option value="person_released">Person Released</option>
                </select>
                <span className="text-xs text-slate-500 ml-auto">
                    {totalEvents} event{totalEvents !== 1 ? 's' : ''} total
                </span>
            </div>

            {/* Events Timeline */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : events.length === 0 ? (
                <EmptyState
                    icon={Activity}
                    title="No events"
                    description="Events will appear here as people are allocated, time is logged, and timesheets are approved."
                />
            ) : (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[23px] top-6 bottom-6 w-px bg-slate-800" />

                    <div className="space-y-1">
                        {events.map((event) => {
                            const config = eventTypeConfig[event.event_type] || {
                                icon: Activity,
                                color: 'text-slate-400',
                                label: event.event_type,
                            };
                            const Icon = config.icon;

                            return (
                                <div key={event.id} className="relative flex items-start gap-4 py-3 px-2 hover:bg-slate-800/20 rounded-lg transition-colors">
                                    {/* Timeline dot */}
                                    <div className={`relative z-10 w-[18px] h-[18px] rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                                    </div>

                                    {/* Event Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Icon size={13} className={config.color} />
                                            <span className={`text-xs font-medium ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-xs text-slate-600">by</span>
                                            <span className="text-xs text-slate-400">
                                                {event.actor_name || 'System'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-300">
                                            {renderEventDescription(event)}
                                        </div>
                                        {event.entity_type && (
                                            <div className="text-xs text-slate-600 mt-0.5">
                                                {event.entity_type}{event.entity_id ? ` / ${event.entity_id}` : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <div className="text-xs text-slate-600 flex-shrink-0 mt-0.5">
                                        {formatRelativeTime(event.occurred_at)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalEvents > 30 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-xs text-slate-500">
                        Page {page} of {Math.ceil(totalEvents / 30)}
                    </span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * 30 >= totalEvents}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default EventsPage;
