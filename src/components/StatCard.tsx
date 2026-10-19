import React from 'react';
import { LucideIcon } from 'lucide-react';
import { KpiCard } from '@so360/design-system';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: { value: number; positive: boolean };
    /** Legacy colour hint; Comb KpiCard is tone-neutral so this is accepted and ignored. */
    color?: 'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'purple';
}

/** Thin adapter over the Comb KpiCard; keeps the legacy props API. */
const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend }) => (
    <KpiCard
        label={label}
        value={value}
        icon={icon}
        hint={trend ? `${trend.positive ? '+' : ''}${trend.value}%` : undefined}
    />
);

export default StatCard;
