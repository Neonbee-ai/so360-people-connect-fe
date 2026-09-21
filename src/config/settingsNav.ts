// =============================================================================
// Settings Hub navigation catalog — single source of truth for every entry
// shown in the People Connect Settings nav rail (SettingsHubPage).
//
// OTHER GROUPS: when your settings sub-page ships, find your `key` below and
// flip `status` from 'coming_soon' to 'active' (update `path` too if the
// route differs from the placeholder listed here). Do NOT reorder or remove
// existing entries — append new ones at the end if a brand-new settings
// section is introduced.
// =============================================================================

export type SettingsSectionStatus = 'active' | 'coming_soon';

export interface SettingsNavItem {
  key: string;
  label: string;
  path: string;
  status: SettingsSectionStatus;
}

export const settingsNavItems: SettingsNavItem[] = [
  { key: 'organization', label: 'Organization Settings', path: 'settings/organization', status: 'active' },
  { key: 'work_locations', label: 'Work Locations', path: 'settings/work-locations', status: 'active' },
  { key: 'departments', label: 'Departments', path: 'departments', status: 'active' },
  { key: 'designations', label: 'Designations', path: 'settings/designations', status: 'active' },
  { key: 'employment_types', label: 'Employment Types', path: 'settings/employment-types', status: 'active' },
  { key: 'leave_configuration', label: 'Leave Configuration', path: 'settings/leave-configuration', status: 'active' },
  { key: 'holiday_calendar', label: 'Holiday Calendar', path: 'settings/holidays', status: 'active' },
  { key: 'shift_management', label: 'Shift Management', path: 'settings/shifts', status: 'active' },
  { key: 'attendance_settings', label: 'Attendance Settings', path: 'settings/attendance', status: 'active' },
  { key: 'approval_workflow', label: 'Approval Workflow', path: 'settings/approval-chains', status: 'active' },
  { key: 'resource_allocation_defaults', label: 'Resource Allocation Defaults', path: 'settings/resource-allocation', status: 'active' },
  { key: 'performance_settings', label: 'Performance Settings', path: 'settings/performance', status: 'active' },
  { key: 'skills', label: 'Skills', path: 'settings/skills', status: 'active' },
  { key: 'employee_status', label: 'Employee Status', path: 'settings/employee-status', status: 'active' },
  { key: 'document_types', label: 'Document Types', path: 'settings/document-types', status: 'active' },
  { key: 'notification_settings', label: 'Notification Settings', path: 'settings/notifications', status: 'active' },
  { key: 'utilization_settings', label: 'Utilization Settings', path: 'settings/utilization-settings', status: 'active' },
  { key: 'timesheet_settings', label: 'Timesheet Settings', path: 'settings/timesheet-settings', status: 'active' },
  { key: 'employee_custom_fields', label: 'Employee Custom Fields', path: 'settings/custom-fields', status: 'active' },
  { key: 'numbering_prefixes', label: 'Numbering & Prefixes', path: 'settings/numbering', status: 'active' },
  { key: 'leave_types', label: 'Leave Types', path: 'leaves/types', status: 'active' },
  // Appended per this file's contract — never reorder the entries above.
  { key: 'labor_categories', label: 'Labor Categories', path: 'settings/labor-categories', status: 'active' },
];
