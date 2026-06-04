import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
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
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        departmentsApi.getAll({ is_active: true }).then(res => {
            setDepartments(res.data || []);
        }).catch(() => { /* ignore */ });
    }, []);

    useEffect(() => {
        loadLeaveRequests();
    }, [year, month]);

    const loadLeaveRequests = async () => {
        setLoading(true);
        try {
            const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
            const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
            const result = await leaveRequestsApi.getAll({
                from_date: firstDay,
                to_date: lastDay,
                status: 'approved',
                limit: 200,
            });
            // Also fetch pending
            const pendingResult = await leaveRequestsApi.getAll({
                from_date: firstDay,
                to_date: lastDay,
                status: 'pending',
                limit: 200,
            });
            setLeaveRequests([...(result.data || []), ...(pendingResult.data || [])]);
        } catch (error) {
            console.error('Failed to load leave requests:', error);
        } finally {
            setLoading(false);
        }
    };

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
            const dayLeaves = leaveRequests.filter(lr => {
                const start = lr.start_date.split('T')[0];
                const end = lr.end_date.split('T')[0];
                return dateStr >= start && dateStr <= end;
            });
            days.push({ date: d, leaves: dayLeaves });
        }

        return days;
    }, [year, month, leaveRequests]);

    const navigateMonth = (delta: number) => {
        setCurrentDate(new Date(year, month + delta, 1));
    };

    const monthName = new Intl.DateTimeFormat(formatters.locale, { month: 'long', year: 'numeric', timeZone: formatters.timezone }).format(currentDate);

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
                        const filteredLeaves = departmentFilter
                            ? day.leaves.filter(l => l.person?.full_name) // Filter would need department data
                            : day.leaves;

                        return (
                            <div
                                key={i}
                                className={`min-h-[100px] border-r border-b border-slate-800 last:border-r-0 p-2 ${
                                    day.date ? 'bg-slate-900 hover:bg-slate-800/50' : 'bg-slate-900/30'
                                } transition-colors`}
                            >
                                {day.date && (
                                    <>
                                        <div className={`text-xs font-medium mb-1 ${
                                            isToday
                                                ? 'text-teal-400 bg-teal-400/10 w-6 h-6 rounded-full flex items-center justify-center'
                                                : 'text-slate-400'
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default LeaveCalendarPage;
