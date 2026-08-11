import React from 'react';
import { Briefcase } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';

const EmploymentTypesPage: React.FC = () => (
  <MasterListPage
    masterType="employment_type"
    label="Employment Type"
    icon={Briefcase}
    description="Full Time, Part Time, Contract, and other employment arrangements"
  />
);

export default EmploymentTypesPage;
