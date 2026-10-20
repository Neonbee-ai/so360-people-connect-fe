import React, { useEffect, useState, useCallback } from 'react';
import { UserCheck, UserMinus, Clock, Home, CalendarDays, Pencil, ClipboardCheck, Users } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import {
    toast,
    Select,
    Button,
    IconButton,
    Badge,
    KpiCard,
    ListPageTemplate,
    DataTable,
    Modal,
    DateInput,
    TextField,
    Textarea,
    Tabs,
    SegmentedControl,
    Skeleton,
    Stack,
    Cluster,
    Grid,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
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

    const columns: DataTableColumn<AttendanceRegisterRow>[] = [
        {
            key: 'person_name',
            header: 'Employee',
            render: (row) => (
                <Stack gap="none">
                    <span className="text-nb-sm text-fg">{row.person_name}</span>
                    <span className="text-nb-xs text-fg-subtle">
                        {[row.department_name, row.designation].filter(Boolean).join(' · ') || '—'}
                    </span>
                </Stack>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (row) =>
                row.status ? <StatusBadge status={row.status} /> : <Badge tone="neutral">Not Marked</Badge>,
        },
        { key: 'check_in', header: 'Check In', render: (row) => row.check_in || '—' },
        { key: 'check_out', header: 'Check Out', render: (row) => row.check_out || '—' },
        { key: 'notes', header: 'Notes', hideBelow: 'medium', render: (row) => row.notes || '—' },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (row) => (
                <Cluster gap="none" justify="end" align="center">
                    {QUICK_ACTIONS.map(({ status, label, icon: Icon }) => (
                        <IconButton
                            key={status}
                            label={label}
                            icon={<Icon size={14} />}
                            variant="ghost"
                            size="sm"
                            selected={row.status === status}
                            onClick={() => handleQuickMark(row, status)}
                        />
                    ))}
                    <IconButton
                        label={`Edit attendance for ${row.person_name}`}
                        icon={<Pencil size={14} />}
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRow(row)}
                    />
                </Cluster>
            ),
        },
    ];

    const tabs = (
        <Tabs
            name="attendance-register-tabs"
            items={[
                { id: 'register', label: 'Register' },
                { id: 'corrections', label: 'Corrections' },
            ]}
            value={tab}
            onChange={(id: string) => setTab(id as 'register' | 'corrections')}
        />
    );

    const isRegister = tab === 'register';

    return (
        <>
            <ListPageTemplate
                title="Attendance Register"
                description="Daily attendance for your organization"
                loading={isRegister && loading}
                isEmpty={isRegister && rows.length === 0}
                empty={
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No employees found for this date"
                        description="Attendance records will appear here once people are registered."
                    />
                }
                filters={tabs}
                toolbarEnd={
                    isRegister ? (
                        <DateInput name="attendance-date" label="Date" value={date} onChange={(v: string) => setDate(v)} />
                    ) : undefined
                }
                kpis={
                    isRegister ? (
                        <Grid columns={3} gap="md">
                            <KpiCard label="Total Employees" value={summary?.total_employees ?? 0} icon={Users} />
                            <KpiCard label="Present" value={summary?.present ?? 0} icon={UserCheck} />
                            <KpiCard label="Absent" value={summary?.absent ?? 0} icon={UserMinus} />
                            <KpiCard label="On Leave" value={summary?.on_leave ?? 0} icon={CalendarDays} />
                            <KpiCard label="Half Day" value={summary?.half_day ?? 0} icon={Clock} />
                            <KpiCard label="Remote" value={summary?.remote ?? 0} icon={Home} />
                        </Grid>
                    ) : undefined
                }
            >
                {isRegister ? (
                    <DataTable name="attendance-register" columns={columns} rows={rows} rowKey={(r) => r.person_id} />
                ) : (
                    <CorrectionsSection
                        onChanged={() => {
                            loadRegister(date);
                            loadSummary(date);
                        }}
                    />
                )}
            </ListPageTemplate>

            {isRegister && (
                <AttendanceEditModal row={editingRow} date={date} onClose={() => setEditingRow(null)} onSaved={handleSaved} />
            )}
        </>
    );
};

// =============================================================================
// Corrections tab — review employee regularization requests
// =============================================================================

const CORRECTION_FILTERS: { value: CorrectionStatus | 'all'; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
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

    const columns: DataTableColumn<AttendanceCorrectionRequest>[] = [
        {
            key: 'person_name',
            header: 'Employee',
            render: (r) => (
                <Stack gap="none">
                    <span className="text-nb-sm text-fg">{r.person_name || '—'}</span>
                    <span className="text-nb-xs text-fg-subtle">{r.designation || ''}</span>
                </Stack>
            ),
        },
        { key: 'attendance_date', header: 'Date' },
        {
            key: 'requested',
            header: 'Requested',
            render: (r) => (
                <Stack gap="none">
                    <span>{r.requested_status ? statusLabel(r.requested_status) : '—'}</span>
                    <span className="text-nb-xs text-fg-subtle">
                        {[r.requested_check_in, r.requested_check_out].filter(Boolean).join(' – ') || ''}
                    </span>
                </Stack>
            ),
        },
        { key: 'reason', header: 'Reason', hideBelow: 'medium', render: (r) => <span title={r.reason}>{r.reason}</span> },
        {
            key: 'status',
            header: 'Status',
            render: (r) => (
                <Stack gap="none">
                    <StatusBadge status={r.status} />
                    {r.review_note && (
                        <span className="text-nb-xs text-fg-subtle" title={r.review_note}>
                            {r.review_note}
                        </span>
                    )}
                </Stack>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (r) =>
                r.status === 'pending' ? (
                    <Cluster gap="tight" justify="end" align="center">
                        <Button
                            size="sm"
                            disabled={busyId === r.id}
                            onClick={() => handleApprove(r)}
                            aria-label={`Approve correction for ${r.person_name || 'employee'}`}
                        >
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyId === r.id}
                            onClick={() => setRejecting(r)}
                            aria-label={`Reject correction for ${r.person_name || 'employee'}`}
                        >
                            Reject
                        </Button>
                    </Cluster>
                ) : null,
        },
    ];

    return (
        <Stack gap="default">
            <SegmentedControl
                aria-label="Correction status"
                options={CORRECTION_FILTERS}
                value={filter}
                onChange={(v: string) => setFilter(v as CorrectionStatus | 'all')}
            />

            {loading ? (
                <Stack gap="tight">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} />
                    ))}
                </Stack>
            ) : requests.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="No correction requests"
                    description="Employee attendance correction requests will appear here for review."
                />
            ) : (
                <DataTable name="attendance-corrections" columns={columns} rows={requests} rowKey={(r) => r.id} />
            )}

            <RejectCorrectionModal
                request={rejecting}
                onClose={() => setRejecting(null)}
                onRejected={async () => {
                    setRejecting(null);
                    await load();
                }}
            />
        </Stack>
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
        <Modal open onClose={onClose} title={`Reject Correction — ${request.person_name || 'Employee'}`}>
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <Textarea
                        name="attendance-reject-note"
                        label="Reason for rejection *"
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Shown to the employee — why is this request being rejected?"
                    />
                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="danger" disabled={saving || !note.trim()}>
                            Reject Request
                        </Button>
                    </Cluster>
                </Stack>
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
        <Modal open onClose={onClose} title={`Edit Attendance — ${row.person_name}`}>
            <form onSubmit={handleSubmit}>
                <Stack gap="default">
                    <Select
                        name="attendanceregister-select-31"
                        label="Status *"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                        options={[...STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))]}
                    />

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-4">
                        <TextField
                            name="attendance-check-in"
                            label="Check In"
                            type="time"
                            value={checkIn}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckIn(e.target.value)}
                        />
                        <TextField
                            name="attendance-check-out"
                            label="Check Out"
                            type="time"
                            value={checkOut}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckOut(e.target.value)}
                        />
                    </div>

                    <Textarea
                        name="attendance-notes"
                        label="Notes"
                        value={notes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional notes..."
                    />

                    <Textarea
                        name="attendance-reason"
                        label="Reason *"
                        value={reason}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            setReason(e.target.value);
                            if (e.target.value.trim()) setReasonError(null);
                        }}
                        rows={2}
                        placeholder="Why is this change being made?"
                        error={reasonError ?? undefined}
                    />

                    <Cluster gap="tight" justify="end">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving || !reason.trim()}>
                            Save Changes
                        </Button>
                    </Cluster>
                </Stack>
            </form>
        </Modal>
    );
};

export default AttendanceRegisterPage;
