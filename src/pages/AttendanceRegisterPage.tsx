import React, { useEffect, useState, useCallback } from 'react';
import { UserCheck, UserMinus, Clock, Home, CalendarDays, Pencil, ClipboardCheck, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { toast, Select } from '@so360/design-system';
import {
    attendanceApi,
    attendanceCorrectionsApi,
    AttendanceRegisterRow,
    AttendanceSummary,
    AttendanceStatus,
    AttendanceCorrectionRequest,
    CorrectionStatus,
} from '../services/attendanceService';
import { usePeopleFormatters } from '../utils/formatters';

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
    const formatters = usePeopleFormatters();
    const [tab, setTab] = useState<'register' | 'corrections'>('register');
    // Attendance is the most midnight-sensitive surface in the platform: the
    // register must open on the day the ORG is on. The UTC day meant an org
    // ahead of UTC opened YESTERDAY's register between local midnight and the
    // offset, so early-shift marks landed on the wrong date.
    const [date, setDate] = useState(() => formatters.businessToday());
    const [rows, setRows] = useState<AttendanceRegisterRow[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingRow, setEditingRow] = useState<AttendanceRegisterRow | null>(null);

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
            toast.error('Failed to load attendance register');
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
            toast.success(`${row.person_name} marked ${statusLabel(status)}`);
            loadSummary(date);
        } catch (error) {
            // Revert on failure — never leave a false status behind.
            setRows((prev) => prev.map((r) => (r.person_id === row.person_id ? previous : r)));
            const msg = error instanceof Error ? error.message : 'Failed to update attendance';
            toast.error(msg);
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

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-line" role="tablist">
                {([
                    { id: 'register', label: 'Register' },
                    { id: 'corrections', label: 'Corrections' },
                ] as const).map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-fg-muted hover:text-fg'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'corrections' ? (
                <CorrectionsSection
                    onChanged={() => {
                        loadRegister(date);
                        loadSummary(date);
                    }}
                />
            ) : (
            <>
            {/* Date Picker */}
            <div className="flex items-center gap-3">
                <label htmlFor="attendance-date" className="text-xs text-fg-muted">
                    Date
                </label>
                <input
                    id="attendance-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
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
                        <div key={i} className="h-16 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="No employees found for this date"
                    description="Attendance records will appear here once people are registered."
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Check In</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Check Out</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Notes</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {rows.map((row) => (
                                <tr key={row.person_id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-fg">{row.person_name}</div>
                                        <div className="text-xs text-fg-subtle">
                                            {[row.department_name, row.designation].filter(Boolean).join(' · ') || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {row.status ? (
                                            <StatusBadge status={row.status} />
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-nb-sm text-xs font-medium border border-dashed border-line-strong text-fg-subtle">
                                                Not Marked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{row.check_in || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{row.check_out || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted max-w-[200px] truncate" title={row.notes || ''}>
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
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
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
                                                className="p-1.5 rounded-nb text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
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
            <AttendanceEditModal row={editingRow} date={date} onClose={() => setEditingRow(null)} onSaved={handleSaved} />
            </>
            )}

        </div>
    );
};

// =============================================================================
// Corrections tab — review employee regularization requests
// =============================================================================

const CORRECTION_FILTERS: { id: CorrectionStatus | 'all'; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
];

const CorrectionsSection: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
    const [filter, setFilter] = useState<CorrectionStatus | 'all'>('pending');
    const [requests, setRequests] = useState<AttendanceCorrectionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<AttendanceCorrectionRequest | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await attendanceCorrectionsApi.list(
                filter === 'all' ? undefined : { status: filter },
            );
            setRequests(result.data);
        } catch (error) {
            console.error('Failed to load correction requests:', error);
            toast.error('Failed to load correction requests');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
    }, [load]);

    const handleApprove = async (request: AttendanceCorrectionRequest) => {
        setBusyId(request.id);
        try {
            await attendanceCorrectionsApi.approve(request.id);
            toast.success(`Correction approved for ${request.person_name || 'employee'}`);
            await load();
            onChanged();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to approve correction');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Status filter */}
            <div className="flex items-center gap-2">
                {CORRECTION_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filter === f.id
                                ? 'bg-primary/20 text-primary'
                                : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-surface-raised/50 rounded-nb animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="No correction requests"
                    description="Employee attendance correction requests will appear here for review."
                />
            ) : (
                <div className="bg-surface border border-line rounded-nb overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-surface-raised/50 border-b border-line">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Requested</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Reason</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {requests.map((r) => (
                                <tr key={r.id} className="hover:bg-surface-raised/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-fg">{r.person_name || '—'}</div>
                                        <div className="text-xs text-fg-subtle">{r.designation || ''}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">{r.attendance_date}</td>
                                    <td className="px-4 py-3 text-sm text-fg-muted">
                                        {r.requested_status ? statusLabel(r.requested_status) : '—'}
                                        <div className="text-xs text-fg-subtle">
                                            {[r.requested_check_in, r.requested_check_out].filter(Boolean).join(' – ') || ''}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-fg-muted max-w-[240px] truncate" title={r.reason}>
                                        {r.reason}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={r.status} />
                                        {r.review_note && (
                                            <div className="text-xs text-fg-subtle mt-0.5 max-w-[160px] truncate" title={r.review_note}>
                                                {r.review_note}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.status === 'pending' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    disabled={busyId === r.id}
                                                    onClick={() => handleApprove(r)}
                                                    aria-label={`Approve correction for ${r.person_name || 'employee'}`}
                                                    className="px-3 py-1.5 rounded-nb text-xs font-medium bg-primary hover:bg-primary-hover text-primary-fg transition-colors disabled:opacity-50"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busyId === r.id}
                                                    onClick={() => setRejecting(r)}
                                                    aria-label={`Reject correction for ${r.person_name || 'employee'}`}
                                                    className="px-3 py-1.5 rounded-nb text-xs font-medium border border-line-strong text-fg hover:bg-surface-raised hover:text-danger transition-colors disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <RejectCorrectionModal
                request={rejecting}
                onClose={() => setRejecting(null)}
                onRejected={async () => {
                    setRejecting(null);
                    await load();
                }}
            />
        </div>
    );
};

const RejectCorrectionModal: React.FC<{
    request: AttendanceCorrectionRequest | null;
    onClose: () => void;
    onRejected: () => void;
}> = ({ request, onClose, onRejected }) => {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (request) setNote('');
    }, [request]);

    if (!request) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!note.trim()) return;
        setSaving(true);
        try {
            await attendanceCorrectionsApi.reject(request.id, note.trim());
            toast.success(`Correction rejected for ${request.person_name || 'employee'}`);
            onRejected();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to reject correction');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={!!request} onClose={onClose} title={`Reject Correction — ${request.person_name || 'Employee'}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Reason for rejection *</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="Shown to the employee — why is this request being rejected?"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !note.trim()}
                        className="px-4 py-2 bg-danger hover:bg-danger-hover text-danger-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reject Request
                    </button>
                </div>
            </form>
        </Modal>
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
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'half_day', 'leave', 'wfh', 'on_duty', 'holiday', 'weekend'];

const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({ row, date, onClose, onSaved }) => {
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
            toast.success(`Attendance updated for ${row.person_name}`);
            onSaved();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to save attendance';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={!!row} onClose={onClose} title={`Edit Attendance — ${row.person_name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-fg-muted mb-1">Status *</label>
                    <Select name="attendanceregister-select-31" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} options={[...STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))]} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Check In</label>
                        <input
                            type="time"
                            value={checkIn}
                            onChange={(e) => setCheckIn(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-fg-muted mb-1">Check Out</label>
                        <input
                            type="time"
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
                            className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-fg-muted mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="Optional notes..."
                    />
                </div>

                <div>
                    <label className="block text-xs text-fg-muted mb-1">Reason *</label>
                    <textarea
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (e.target.value.trim()) setReasonError(null);
                        }}
                        rows={2}
                        className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-nb text-sm text-fg focus:outline-none focus:border-primary"
                        placeholder="Why is this change being made?"
                    />
                    {reasonError && <p className="mt-1 text-xs text-danger">{reasonError}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !reason.trim()}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium rounded-nb transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AttendanceRegisterPage;
