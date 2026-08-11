import React from 'react';
import { FileText } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';

const DocumentTypesPage: React.FC = () => (
  <MasterListPage
    masterType="document_type"
    label="Document Type"
    icon={FileText}
    description="Identity and employment document categories, e.g. Aadhaar, PAN, Passport"
  />
);

export default DocumentTypesPage;
