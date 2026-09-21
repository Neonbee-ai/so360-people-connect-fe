import React, { useState } from 'react';
import { Settings, CalendarRange, Layers, FileText, Award, Landmark, Receipt } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SettingsTab from '../../components/payroll/config/SettingsTab';
import GroupsPeriodsTab from '../../components/payroll/config/GroupsPeriodsTab';
import ComponentsTab from '../../components/payroll/config/ComponentsTab';
import StructuresTab from '../../components/payroll/config/StructuresTab';
import BenefitsTab from '../../components/payroll/config/BenefitsTab';
import StatutoryTab from '../../components/payroll/config/StatutoryTab';
import PayslipTemplateTab from '../../components/payroll/config/PayslipTemplateTab';

type TabKey = 'settings' | 'groups' | 'components' | 'structures' | 'benefits' | 'statutory' | 'template';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'groups', label: 'Groups & Periods', icon: CalendarRange },
    { key: 'components', label: 'Components', icon: Layers },
    { key: 'structures', label: 'Structures', icon: FileText },
    { key: 'benefits', label: 'Benefits', icon: Award },
    { key: 'statutory', label: 'Statutory', icon: Landmark },
    { key: 'template', label: 'Payslip Template', icon: Receipt },
];

const PayrollConfigurationPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('settings');

    return (
        <div className="p-6 space-y-5">
            <PageHeader
                title="Payroll Configuration"
                subtitle="Pay policies, salary components, structures and the statutory pack"
            />

            <div className="bg-slate-900 border border-slate-800 rounded-xl">
                <div className="border-b border-slate-800">
                    <div className="flex items-center gap-1 px-5 py-3 overflow-x-auto">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    activeTab === key
                                        ? 'bg-teal-500/10 text-teal-400'
                                        : 'text-slate-400 hover:text-slate-50 hover:bg-slate-800'
                                }`}
                            >
                                <Icon size={14} className="inline mr-1.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-5">
                    {activeTab === 'settings' && <SettingsTab />}
                    {activeTab === 'groups' && <GroupsPeriodsTab />}
                    {activeTab === 'components' && <ComponentsTab />}
                    {activeTab === 'structures' && <StructuresTab />}
                    {activeTab === 'benefits' && <BenefitsTab />}
                    {activeTab === 'statutory' && <StatutoryTab />}
                    {activeTab === 'template' && <PayslipTemplateTab />}
                </div>
            </div>
        </div>
    );
};

export default PayrollConfigurationPage;
