import React from 'react';
import { UserCheck } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';

const EmployeeStatusPage: React.FC = () => (
  <MasterListPage
    masterType="employee_status"
    label="Employee Status"
    pluralLabel="Employee Statuses"
    icon={UserCheck}
    description="Lifecycle statuses such as Active, On Leave, Probation, or Resigned"
  />
);

export default EmployeeStatusPage;
