import React, { useState } from 'react';
import { SettingsPageTemplate } from '@so360/design-system';
import SettingsTab from '../../components/payroll/config/SettingsTab';
import GroupsPeriodsTab from '../../components/payroll/config/GroupsPeriodsTab';
import ComponentsTab from '../../components/payroll/config/ComponentsTab';
import StructuresTab from '../../components/payroll/config/StructuresTab';
import BenefitsTab from '../../components/payroll/config/BenefitsTab';
import StatutoryTab from '../../components/payroll/config/StatutoryTab';
import PayslipTemplateTab from '../../components/payroll/config/PayslipTemplateTab';

type TabKey = 'settings' | 'groups' | 'components' | 'structures' | 'benefits' | 'statutory' | 'template';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'groups', label: 'Groups & Periods' },
    { key: 'components', label: 'Components' },
    { key: 'structures', label: 'Structures' },
    { key: 'benefits', label: 'Benefits' },
    { key: 'statutory', label: 'Statutory' },
    { key: 'template', label: 'Payslip Template' },
];

const PayrollConfigurationPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('settings');

    return (
        <SettingsPageTemplate trail={[{ label: 'Payroll', to: '/people/payroll' }]}
            title="Payroll Configuration"
            description="Pay policies, salary components, structures and the statutory pack"
            sections={TABS.map(({ key, label }) => ({ id: key, label }))}
            activeSection={activeTab}
            onSectionChange={id => setActiveTab(id as TabKey)}
        >
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'groups' && <GroupsPeriodsTab />}
            {activeTab === 'components' && <ComponentsTab />}
            {activeTab === 'structures' && <StructuresTab />}
            {activeTab === 'benefits' && <BenefitsTab />}
            {activeTab === 'statutory' && <StatutoryTab />}
            {activeTab === 'template' && <PayslipTemplateTab />}
        </SettingsPageTemplate>
    );
};

export default PayrollConfigurationPage;
