import { api } from './apiClient';

// =============================================================================
// Attendance Types
// =============================================================================

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'wfh'
  | 'on_duty'
  | 'holiday'
  | 'weekend';

export interface AttendanceRegisterRow {
  person_id: string;
  person_name: string;
  department_id?: string;
  department_name?: string;
  designation?: string;
  // null when nothing has been recorded yet for this person on this date.
  attendance_id: string | null;
  // null = not yet marked (distinct from an explicit 'absent').
  status: AttendanceStatus | null;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
}

export interface AttendanceRegisterResponse {
  data: AttendanceRegisterRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceSummary {
  total_employees: number;
  present: number;
  absent: number;
  on_leave: number;
  half_day: number;
  remote: number;
}

export interface AttendanceRecord {
  id: string;
  person_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
}

export interface MarkAttendancePayload {
  person_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in?: string | null;
  check_out?: string | null;
  notes?: string | null;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  check_in?: string | null;
  check_out?: string | null;
  notes?: string | null;
  // Required by the server whenever status/check_in/check_out changes.
  reason: string;
}

export interface AttendanceHistoryEntry {
  id: string;
  attendance_id: string;
  previous_status: AttendanceStatus | null;
  new_status: AttendanceStatus | null;
  previous_check_in: string | null;
  new_check_in: string | null;
  previous_check_out: string | null;
  new_check_out: string | null;
  changed_by: string;
  changed_by_name?: string;
  changed_at: string;
  reason: string;
}

// =============================================================================
// Correction Requests (attendance regularization)
// =============================================================================

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceCorrectionRequest {
  id: string;
  person_id: string;
  // Present on the admin list only — enriched server-side.
  person_name?: string | null;
  designation?: string | null;
  attendance_date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_status: AttendanceStatus | null;
  reason: string;
  status: CorrectionStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCorrectionPayload {
  attendance_date: string;
  requested_check_in?: string;
  requested_check_out?: string;
  requested_status?: AttendanceStatus;
  reason: string;
}

// =============================================================================
// ATTENDANCE API
// =============================================================================

export const attendanceApi = {
  getRegister: async (params: {
    date: string;
    department_id?: string;
    status?: string;
    person_id?: string;
    page?: number;
    limit?: number;
  }): Promise<AttendanceRegisterResponse> => {
    return api.get<AttendanceRegisterResponse>('/attendance', params);
  },

  getSummary: async (date: string): Promise<AttendanceSummary> => {
    return api.get<AttendanceSummary>('/attendance/summary', { date });
  },

  mark: async (data: MarkAttendancePayload): Promise<AttendanceRecord> => {
    return api.post<AttendanceRecord>('/attendance', data);
  },

  update: async (id: string, data: UpdateAttendancePayload): Promise<AttendanceRecord> => {
    return api.patch<AttendanceRecord>(`/attendance/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/attendance/${id}`);
  },

  getHistory: async (id: string): Promise<{ data: AttendanceHistoryEntry[]; total: number }> => {
    return api.get<{ data: AttendanceHistoryEntry[]; total: number }>(`/attendance/${id}/history`);
  },
};

// =============================================================================
// CORRECTIONS API — self-service (/mine) + review (attendance.read/update)
// =============================================================================

export const attendanceCorrectionsApi = {
  /** File a correction for MYSELF — the server resolves the person from the session. */
  createMine: async (data: CreateCorrectionPayload): Promise<AttendanceCorrectionRequest> => {
    return api.post<AttendanceCorrectionRequest>('/attendance/corrections/mine', data);
  },

  /** My own correction requests, newest first. */
  listMine: async (): Promise<{ data: AttendanceCorrectionRequest[]; total: number }> => {
    return api.get<{ data: AttendanceCorrectionRequest[]; total: number }>('/attendance/corrections/mine');
  },

  /** Org-wide list for reviewers (attendance.read). */
  list: async (params?: { status?: CorrectionStatus }): Promise<{ data: AttendanceCorrectionRequest[]; total: number }> => {
    return api.get<{ data: AttendanceCorrectionRequest[]; total: number }>('/attendance/corrections', params);
  },

  /** Approve — upserts the attendance record server-side (attendance.update). */
  approve: async (id: string, review_note?: string): Promise<AttendanceCorrectionRequest> => {
    return api.post<AttendanceCorrectionRequest>(`/attendance/corrections/${id}/approve`, review_note ? { review_note } : {});
  },

  /** Reject — a review note is required (attendance.update). */
  reject: async (id: string, review_note: string): Promise<AttendanceCorrectionRequest> => {
    return api.post<AttendanceCorrectionRequest>(`/attendance/corrections/${id}/reject`, { review_note });
  },
};
