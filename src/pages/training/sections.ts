/** Training & Competency sections (14a5681f scaffold). Mirrors the BE TRAINING_SECTIONS. */
export interface TrainingSection {
  slug: string;
  label: string;
  description: string;
}

export const TRAINING_SECTIONS: TrainingSection[] = [
  { slug: 'programs', label: 'Programs', description: 'Training programs and courses' },
  { slug: 'sessions', label: 'Sessions', description: 'Scheduled training sessions' },
  { slug: 'materials', label: 'Materials', description: 'Training materials and documents' },
  { slug: 'weekly-plans', label: 'Weekly Plans', description: 'Weekly training plans by department or site' },
  { slug: 'trainers', label: 'Trainers', description: 'Internal and external trainers' },
  { slug: 'certifications', label: 'Certifications', description: 'Certifications and their validity' },
  { slug: 'competencies', label: 'Competencies', description: 'Competency framework and levels' },
  { slug: 'assignments', label: 'Assignments', description: 'Training assigned to people' },
  { slug: 'assessments', label: 'Assessments', description: 'Assessment results' },
  { slug: 'attendance', label: 'Attendance', description: 'Session attendance' },
  { slug: 'analytics', label: 'Analytics', description: 'Training and competency analytics' },
];
