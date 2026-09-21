import React from 'react';
import { Award } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';

const DesignationsPage: React.FC = () => (
  <MasterListPage
    masterType="designation"
    label="Designation"
    icon={Award}
    description="Job titles used across the People Registry, from Intern to CXO"
    showLevelGrade
  />
);

export default DesignationsPage;
