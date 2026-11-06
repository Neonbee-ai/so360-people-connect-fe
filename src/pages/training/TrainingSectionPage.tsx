import React from 'react';
import { GraduationCap } from 'lucide-react';
import { ListPageTemplate } from '@so360/design-system';
import EmptyState from '../../components/EmptyState';
import { TRAINING_SECTIONS } from './sections';

interface Props {
  /** Section slug; omit for the module landing page. */
  section?: string;
}

/** Placeholder page for a Training & Competency section. No data or logic yet. */
const TrainingSectionPage: React.FC<Props> = ({ section }) => {
  const def = TRAINING_SECTIONS.find((s) => s.slug === section);
  const title = def ? def.label : 'Training & Competency';
  const description = def ? def.description : 'Training programs, sessions, certifications and competencies';
  return (
    <ListPageTemplate
      trail={[]}
      title={title}
      description={description}
      loading={false}
      isEmpty
      isFilteredEmpty={false}
      empty={
        <EmptyState
          icon={GraduationCap}
          title={`${title} is coming soon`}
          description="This section is part of the Training & Competency module foundation and is not available yet."
        />
      }
    >
      {null}
    </ListPageTemplate>
  );
};

export default TrainingSectionPage;
