import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Select, Button, IconButton, Banner, Badge, Spinner, Modal, DescriptionList, DashboardPageTemplate, Stack, Cluster } from '@so360/design-system';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { leaveRequestsApi, LeaveRequest } from '../services/leaveRequestsService';
import { departmentsApi, Department } from '../services/departmentsService';
import { usePeopleFormatters } from '../utils/formatters';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusColors: Record<string, string> = {
    approved: 'bg-success/80',
    pending: 'bg-warning/80',
    rejected: 'bg-danger/60',
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
        <DashboardPageTemplate trail={[]}
            title="Leave Calendar"
            description="Visual overview of team availability"
            filters={
                <Select
                    name="leavecalendar-select-54"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    options={[{ value: '', label: 'All Departments' }, ...departments.map((dept) => ({ value: dept.id, label: dept.name }))]}
                />
            }
        >
            <Stack gap="default">
                {/* Controls */}
                <Cluster gap="default" align="center">
                    <IconButton label="Previous month" icon={<ChevronLeft size={14} />} variant="ghost" onClick={() => navigateMonth(-1)} />
                    <h2 className="text-nb-section font-medium text-fg text-center">{monthName}</h2>
                    <IconButton label="Next month" icon={<ChevronRight size={14} />} variant="ghost" onClick={() => navigateMonth(1)} />
                    <Button size="sm" variant="secondary" onClick={() => setCurrentDate(new Date())}>Today</Button>
                </Cluster>

                {/* Legend */}
                <Cluster gap="region" align="center">
                    <Cluster gap="tight" align="center">
                        <span className="w-3 h-3 rounded bg-success/80" />
                        <span className="text-nb-caption text-fg-muted">Approved</span>
                    </Cluster>
                    <Cluster gap="tight" align="center">
                        <span className="w-3 h-3 rounded bg-warning/80" />
                        <span className="text-nb-caption text-fg-muted">Pending</span>
                    </Cluster>
                </Cluster>

                {/* Error Banner */}
                {loadError && (
                    <Banner variant="danger" action={{ label: 'Retry', onClick: loadLeaveRequests }}>
                        Unable to load leave data. Please try again.
                    </Banner>
                )}

                {/* Empty state: say why the grid is blank instead of silently showing nothing */}
                {!loading && !loadError && visibleLeaveRequests.length === 0 && (
                    <Banner variant="info">
                        {departmentFilter
                            ? `No leave records for ${selectedDepartmentName || 'this department'} in ${monthName}.`
                            : `No leave records in ${monthName}.`}
                    </Banner>
                )}

                {/* Calendar Grid */}
                <div className="bg-surface border border-line rounded-nb overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-line">
                        {DAYS.map(day => (
                            <div key={day} className="text-center text-nb-label font-medium text-fg-muted py-nb-3 border-r border-line last:border-r-0">
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
                                    className={`min-h-24 border-r border-b border-line last:border-r-0 p-nb-2 ${
                                        day.date ? 'bg-surface hover:bg-surface-raised/50' : 'bg-surface/30'
                                    } transition-colors`}
                                >
                                    {day.date && (
                                        <>
                                            <div className={`text-nb-body font-semibold mb-nb-1 ${
                                                isToday
                                                    ? 'text-primary bg-primary/10 w-7 h-7 rounded-full flex items-center justify-center'
                                                    : 'text-fg'
                                            }`}>
                                                {day.date}
                                            </div>
                                            <div className="flex flex-col gap-nb-1">
                                                {filteredLeaves.slice(0, 3).map(leave => (
                                                    <button // comb-exception: status-tinted calendar day chip
                                                        key={leave.id}
                                                        type="button"
                                                        onClick={() => setSelectedLeave(leave)}
                                                        className={`w-full text-left px-nb-1 rounded text-nb-caption text-fg truncate ${
                                                            statusColors[leave.status] || 'bg-line'
                                                        } hover:opacity-80 transition-opacity`}
                                                        title={`${leave.person?.full_name} - ${leave.leave_type?.name}`}
                                                    >
                                                        {leave.person?.full_name?.split(' ')[0] || 'Unknown'}
                                                    </button>
                                                ))}
                                                {filteredLeaves.length > 3 && (
                                                    <p className="text-nb-caption text-fg-subtle px-nb-1">+{filteredLeaves.length - 3} more</p>
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
                    <Cluster justify="center">
                        <Spinner />
                    </Cluster>
                )}
            </Stack>

            {/* Leave Details Modal */}
            {selectedLeave && (
                <Modal
                    open={!!selectedLeave}
                    onClose={() => setSelectedLeave(null)}
                    title="Leave Details"
                >
                    <DescriptionList
                        columns={2}
                        items={[
                            { label: 'Person', value: selectedLeave.person?.full_name || 'Unknown', span: 2 },
                            { label: 'Leave Type', value: selectedLeave.leave_type?.name || 'Unknown', span: 2 },
                            {
                                label: 'Start Date',
                                value: <>{formatters.formatDate(selectedLeave.start_date)}{selectedLeave.is_half_day_start && <span className="text-nb-caption text-fg-muted ml-nb-1">(half day)</span>}</>,
                            },
                            {
                                label: 'End Date',
                                value: <>{formatters.formatDate(selectedLeave.end_date)}{selectedLeave.is_half_day_end && <span className="text-nb-caption text-fg-muted ml-nb-1">(half day)</span>}</>,
                            },
                            { label: 'Total Days', value: selectedLeave.total_days, span: 2 },
                            {
                                label: 'Status',
                                value: (
                                    <Badge tone={selectedLeave.status === 'approved' ? 'success' : selectedLeave.status === 'pending' ? 'warning' : 'danger'}>
                                        {selectedLeave.status}
                                    </Badge>
                                ),
                                span: 2,
                            },
                            { label: 'Reason', value: selectedLeave.reason, span: 2, hidden: !selectedLeave.reason },
                        ]}
                    />
                </Modal>
            )}
        </DashboardPageTemplate>
    );
};

export default LeaveCalendarPage;
