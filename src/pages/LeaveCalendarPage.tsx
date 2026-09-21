import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { leaveRequestsApi, LeaveRequest } from '../services/leaveRequestsService';
import { departmentsApi, Department } from '../services/departmentsService';
import { usePeopleFormatters } from '../utils/formatters';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusColors: Record<string, string> = {
    approved: 'bg-green-600/80',
    pending: 'bg-amber-600/80',
    rejected: 'bg-red-600/60',
};

const LeaveCalendarPage: React.FC = () => {
    const formatters = usePeopleFormatters();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
    const [loadError, setLoadError] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        departmentsApi.getAll({ is_active: true }).then(res => {
            setDepartments(res.data || []);
        }).catch(() => { /* ignore */ });
    }, []);

    // Monotonic token for the in-flight fetch. Clicking prev/next faster than
    // the API responds would otherwise let an older month's response land last
    // and repaint the grid with the wrong month's leave.
    const requestIdRef = useRef(0);

    const loadLeaveRequests = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setLoadError(false);
        // Drop the outgoing month's entries before the fetch — otherwise the
        // previous month's leave stays painted over the new grid until the
        // response lands, which reads as data belonging to the new month.
        setLeaveRequests([]);
        try {
            const pad = (n: number) => String(n).padStart(2, '0');
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            // Build the bounds from local calendar parts — toISOString() shifts
            // to UTC and can hand the API the neighbouring month's boundary day.
            const firstDay = `${year}-${pad(month + 1)}-01`;
            const lastDay = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
            const [result, pendingResult] = await Promise.all([
                leaveRequestsApi.getAll({
                    start_date: firstDay,
                    end_date: lastDay,
                    status: 'approved',
                    limit: 200,
                }),
                leaveRequestsApi.getAll({
                    start_date: firstDay,
                    end_date: lastDay,
                    status: 'pending',
                    limit: 200,
                }),
            ]);
            if (requestId !== requestIdRef.current) return; // superseded by a newer month
            setLeaveRequests([...(result.data || []), ...(pendingResult.data || [])]);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error('Failed to load leave requests:', error);
            setLoadError(true);
            setLeaveRequests([]);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        loadLeaveRequests();
    }, [loadLeaveRequests]);

    // A department selection covers that department AND everything beneath it,
    // so leave taken by someone in a sub-department stays visible. Legacy people
    // carry their unit only as free text, so match the department name too.
    const departmentMatcher = useMemo(() => {
        if (!departmentFilter) return null;
        const ids = new Set<string>([departmentFilter]);
        let grew = true;
        while (grew) {
            grew = false;
            departments.forEach(d => {
                if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) {
                    ids.add(d.id);
                    grew = true;
                }
            });
        }
        const names = new Set(
            departments
                .filter(d => ids.has(d.id))
                .map(d => d.name.trim().toLowerCase()),
        );
        return (leave: LeaveRequest) => {
            const deptId = leave.person?.department_id;
            if (deptId) return ids.has(deptId);
            const deptName = leave.person?.department?.trim().toLowerCase();
            return !!deptName && names.has(deptName);
        };
    }, [departmentFilter, departments]);

    const visibleLeaveRequests = useMemo(
        () => (departmentMatcher ? leaveRequests.filter(departmentMatcher) : leaveRequests),
        [leaveRequests, departmentMatcher],
    );

    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const startPadding = firstDayOfMonth.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: Array<{ date: number | null; leaves: LeaveRequest[] }> = [];

        // Padding for days before the 1st
        for (let i = 0; i < startPadding; i++) {
            days.push({ date: null, leaves: [] });
        }

        // Actual days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayLeaves = visibleLeaveRequests.filter(lr => {
                const start = lr.start_date.split('T')[0];
                const end = lr.end_date.split('T')[0];
                return dateStr >= start && dateStr <= end;
            });
            days.push({ date: d, leaves: dayLeaves });
        }

        return days;
    }, [year, month, visibleLeaveRequests]);

    const navigateMonth = (delta: number) => {
        setCurrentDate(new Date(year, month + delta, 1));
    };

    const selectedDepartmentName = departments.find(d => d.id === departmentFilter)?.name;

    // Label the grid from the same local year/month the grid is built from.
    // Formatting `currentDate` (local midnight on the 1st) in another timezone
    // rolled the label back a month for any positive UTC offset.
    const monthName = new Intl.DateTimeFormat(formatters.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month, 1)));

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Leave Calendar"
                subtitle="Visual overview of team availability"
            />

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-2 text-slate-400 hover:text-slate-50 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-lg font-medium text-slate-50 min-w-[200px] text-center">{monthName}</h2>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-2 text-slate-400 hover:text-slate-50 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-50 border border-slate-700 rounded-lg transition-colors"
                    >
                        Today
                    </button>
                </div>

                <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-600/80" />
                    <span className="text-slate-400">Approved</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-600/80" />
                    <span className="text-slate-400">Pending</span>
                </div>
            </div>

            {/* Error Banner */}
            {loadError && (
                <div className="flex items-center justify-between px-4 py-3 bg-rose-900/20 border border-rose-700/40 rounded-lg text-sm text-rose-400">
                    <span>Unable to load leave data. Please try again.</span>
                    <button
                        onClick={loadLeaveRequests}
                        className="ml-4 px-3 py-1 text-xs bg-rose-800/40 hover:bg-rose-700/40 border border-rose-700/40 rounded transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Empty state — say why the grid is blank instead of silently showing nothing */}
            {!loading && !loadError && visibleLeaveRequests.length === 0 && (
                <div className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-400">
                    {departmentFilter
                        ? `No leave records for ${selectedDepartmentName || 'this department'} in ${monthName}.`
                        : `No leave records in ${monthName}.`}
                </div>
            )}

            {/* Calendar Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-800">
                    {DAYS.map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-400 uppercase py-3 border-r border-slate-800 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, i) => {
                        const isToday = day.date === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                        const filteredLeaves = day.leaves;

                        return (
                            <div
                                key={i}
                                className={`min-h-[100px] border-r border-b border-slate-800 last:border-r-0 p-2 ${
                                    day.date ? 'bg-slate-900 hover:bg-slate-800/50' : 'bg-slate-900/30'
                                } transition-colors`}
                            >
                                {day.date && (
                                    <>
                                        <div className={`text-sm font-semibold mb-1 ${
                                            isToday
                                                ? 'text-teal-400 bg-teal-400/10 w-7 h-7 rounded-full flex items-center justify-center'
                                                : 'text-slate-300'
                                        }`}>
                                            {day.date}
                                        </div>
                                        <div className="space-y-0.5">
                                            {filteredLeaves.slice(0, 3).map(leave => (
                                                <button
                                                    key={leave.id}
                                                    onClick={() => setSelectedLeave(leave)}
                                                    className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] text-slate-50 truncate ${
                                                        statusColors[leave.status] || 'bg-slate-700'
                                                    } hover:opacity-80 transition-opacity`}
                                                    title={`${leave.person?.full_name} - ${leave.leave_type?.name}`}
                                                >
                                                    {leave.person?.full_name?.split(' ')[0] || 'Unknown'}
                                                </button>
                                            ))}
                                            {filteredLeaves.length > 3 && (
                                                <p className="text-[10px] text-slate-500 px-1">+{filteredLeaves.length - 3} more</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                </div>
            )}

            {/* Leave Details Modal */}
            {selectedLeave && (
                <Modal
                    isOpen={!!selectedLeave}
                    onClose={() => setSelectedLeave(null)}
                    title="Leave Details"
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Person</label>
                            <p className="text-sm text-slate-50">{selectedLeave.person?.full_name || 'Unknown'}</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Leave Type</label>
                            <p className="text-sm text-slate-50">{selectedLeave.leave_type?.name || 'Unknown'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                                <p className="text-sm text-slate-50">
                                    {formatters.formatDate(selectedLeave.start_date)}
                                    {selectedLeave.is_half_day_start && <span className="text-xs text-slate-400 ml-1">(half day)</span>}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">End Date</label>
                                <p className="text-sm text-slate-50">
                                    {formatters.formatDate(selectedLeave.end_date)}
                                    {selectedLeave.is_half_day_end && <span className="text-xs text-slate-400 ml-1">(half day)</span>}
                                </p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Total Days</label>
                            <p className="text-sm text-slate-50">{selectedLeave.total_days}</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Status</label>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                selectedLeave.status === 'approved' ? 'bg-green-900/40 text-green-400' :
                                selectedLeave.status === 'pending' ? 'bg-amber-900/40 text-amber-400' :
                                'bg-red-900/40 text-red-400'
                            }`}>
                                {selectedLeave.status}
                            </span>
                        </div>
                        {selectedLeave.reason && (
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Reason</label>
                                <p className="text-sm text-slate-50">{selectedLeave.reason}</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default LeaveCalendarPage;
