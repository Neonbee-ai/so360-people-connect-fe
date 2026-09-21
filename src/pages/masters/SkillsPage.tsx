import React from 'react';
import { Sparkles } from 'lucide-react';
import MasterListPage from '../../components/MasterListPage';

const SkillsPage: React.FC = () => (
  <MasterListPage
    masterType="skill"
    label="Skill"
    icon={Sparkles}
    description="Your organization's skill library, used for tagging people and roles"
  />
);

export default SkillsPage;
