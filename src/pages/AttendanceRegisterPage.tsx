import React, { useEffect, useState, useCallback } from 'react';
import { UserCheck, UserMinus, Clock, Home, CalendarDays, Pencil, ClipboardCheck, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Toast, { ToastType } from '../components/Toast';
import {
    attendanceApi,
    AttendanceRegisterRow,
    AttendanceSummary,
    AttendanceStatus,
} from '../services/attendanceService';

const todayIso = () => new Date().toISOString().split('T')[0];

const statusLabel = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

const QUICK_ACTIONS: { status: AttendanceStatus; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { status: 'present', label: 'Mark Present', icon: UserCheck },
    { status: 'absent', label: 'Mark Absent', icon: UserMinus },
    { status: 'half_day', label: 'Mark Half Day', icon: Clock },
    { status: 'wfh', label: 'Mark WFH', icon: Home },
    { status: 'leave', label: 'Mark Leave', icon: CalendarDays },
];

const AttendanceRegisterPage: React.FC = () => {
    const [date, setDate] = useState(todayIso());
    const [rows, setRows] = useState<AttendanceRegisterRow[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingRow, setEditingRow] = useState<AttendanceRegisterRow | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const loadSummary = useCallback(async (forDate: string) => {
        try {
            const result = await attendanceApi.getSummary(forDate);
            setSummary(result);
        } catch (error) {
            console.error('Failed to load attendance summary:', error);
        }
    }, []);

    const loadRegister = useCallback(async (forDate: string) => {
        try {
            setLoading(true);
            const result = await attendanceApi.getRegister({ date: forDate });
            setRows(result.data);
        } catch (error) {
            console.error('Failed to load attendance register:', error);
            setToast({ message: 'Failed to load attendance register', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRegister(date);
        loadSummary(date);
    }, [date, loadRegister, loadSummary]);

    const handleQuickMark = async (row: AttendanceRegisterRow, status: AttendanceStatus) => {
        const previous = { ...row };
        // Optimistic update — the row reflects the new status immediately.
        setRows((prev) => prev.map((r) => (r.person_id === row.person_id ? { ...r, status } : r)));
        try {
            const result = await attendanceApi.mark({ person_id: row.person_id, attendance_date: date, status });
            setRows((prev) =>
                prev.map((r) =>
                    r.person_id === row.person_id
                        ? {
                              ...r,
                              attendance_id: result.id,
                              status: result.status,
                              check_in: result.check_in,
                              check_out: result.check_out,
                              notes: result.notes,
                          }
                        : r,
                ),
            );
            setToast({ message: `${row.person_name} marked ${statusLabel(status)}`, type: 'success' });
            loadSummary(date);
        } catch (error) {
            // Revert on failure — never leave a false status behind.
            setRows((prev) => prev.map((r) => (r.person_id === row.person_id ? previous : r)));
            const msg = error instanceof Error ? error.message : 'Failed to update attendance';
            setToast({ message: msg, type: 'error' });
        }
    };

    const handleSaved = () => {
        setEditingRow(null);
        loadRegister(date);
        loadSummary(date);
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="Attendance Register" subtitle="Daily attendance for your organization" />

            {/* Date Picker */}
            <div className="flex items-center gap-3">
                <label htmlFor="attendance-date" className="text-xs text-slate-400">
                    Date
                </label>
                <input
                    id="attendance-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Total Employees" value={summary?.total_employees ?? 0} icon={Users} color="teal" />
                <StatCard label="Present" value={summary?.present ?? 0} icon={UserCheck} color="emerald" />
                <StatCard label="Absent" value={summary?.absent ?? 0} icon={UserMinus} color="rose" />
                <StatCard label="On Leave" value={summary?.on_leave ?? 0} icon={CalendarDays} color="purple" />
                <StatCard label="Half Day" value={summary?.half_day ?? 0} icon={Clock} color="amber" />
                <StatCard label="Remote" value={summary?.remote ?? 0} icon={Home} color="blue" />
            </div>

            {/* Register Table */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="No employees found for this date"
                    description="Attendance records will appear here once people are registered."
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check In</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check Out</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Notes</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {rows.map((row) => (
                                <tr key={row.person_id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-slate-50">{row.person_name}</div>
                                        <div className="text-xs text-slate-500">
                                            {[row.department_name, row.designation].filter(Boolean).join(' · ') || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {row.status ? (
                                            <StatusBadge status={row.status} />
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border border-dashed border-slate-600 text-slate-500">
                                                Not Marked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{row.check_in || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{row.check_out || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate" title={row.notes || ''}>
                                        {row.notes || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {QUICK_ACTIONS.map(({ status, label, icon: Icon }) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    title={label}
                                                    aria-label={label}
                                                    onClick={() => handleQuickMark(row, status)}
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        row.status === status
                                                            ? 'bg-teal-500/20 text-teal-400'
                                                            : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <Icon size={14} />
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                title="Edit Attendance"
                                                aria-label={`Edit attendance for ${row.person_name}`}
                                                onClick={() => setEditingRow(row)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            <AttendanceEditModal row={editingRow} date={date} onClose={() => setEditingRow(null)} onSaved={handleSaved} setToast={setToast} />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// =============================================================================
// Edit Attendance Modal
// =============================================================================

interface AttendanceEditModalProps {
    row: AttendanceRegisterRow | null;
    date: string;
    onClose: () => void;
    onSaved: () => void;
    setToast: (t: { message: string; type: ToastType } | null) => void;
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'half_day', 'leave', 'wfh', 'on_duty', 'holiday', 'weekend'];

const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({ row, date, onClose, onSaved, setToast }) => {
    const [status, setStatus] = useState<AttendanceStatus>('present');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [notes, setNotes] = useState('');
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (row) {
            setStatus(row.status || 'present');
            setCheckIn(row.check_in || '');
            setCheckOut(row.check_out || '');
            setNotes(row.notes || '');
            setReason('');
            setReasonError(null);
        }
    }, [row]);

    if (!row) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Mirror the server's required-reason rule client-side — don't rely
        // solely on the 400 the backend would otherwise return.
        if (!reason.trim()) {
            setReasonError('A reason is required to save this change.');
            return;
        }
        setReasonError(null);
        setSaving(true);
        try {
            if (row.attendance_id) {
                await attendanceApi.update(row.attendance_id, {
                    status,
                    check_in: checkIn || null,
                    check_out: checkOut || null,
                    notes: notes || null,
                    reason: reason.trim(),
                });
            } else {
                // Nothing recorded yet for this person/date — create it instead.
                await attendanceApi.mark({
                    person_id: row.person_id,
                    attendance_date: date,
                    status,
                    check_in: checkIn || null,
                    check_out: checkOut || null,
                    notes: notes || null,
                });
            }
            setToast({ message: `Attendance updated for ${row.person_name}`, type: 'success' });
            onSaved();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to save attendance';
            setToast({ message: msg, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={!!row} onClose={onClose} title={`Edit Attendance — ${row.person_name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Status *</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                    >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Check In</label>
                        <input
                            type="time"
                            value={checkIn}
                            onChange={(e) => setCheckIn(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Check Out</label>
                        <input
                            type="time"
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="Optional notes..."
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (e.target.value.trim()) setReasonError(null);
                        }}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500"
                        placeholder="Why is this change being made?"
                    />
                    {reasonError && <p className="mt-1 text-xs text-rose-400">{reasonError}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !reason.trim()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AttendanceRegisterPage;
