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
