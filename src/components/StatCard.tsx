import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: { value: number; positive: boolean };
    color?: 'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'purple';
}

const colorMap = {
    teal: 'bg-primary/10 text-primary border-primary/20',
    blue: 'bg-primary/10 text-primary border-primary/20',
    amber: 'bg-warning/10 text-warning border-warning/20',
    rose: 'bg-danger/10 text-danger border-danger/20',
    emerald: 'bg-success/10 text-success border-success/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const iconBgMap = {
    teal: 'bg-primary/20 text-primary',
    blue: 'bg-primary/20 text-primary',
    amber: 'bg-warning/20 text-warning',
    rose: 'bg-danger/20 text-danger',
    emerald: 'bg-success/20 text-success',
    purple: 'bg-purple-500/20 text-purple-400',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, trend, color = 'teal' }) => {
    return (
        <div className={`rounded-nb border p-4 ${colorMap[color]}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-nb flex items-center justify-center ${iconBgMap[color]}`}>
                    <Icon size={18} />
                </div>
                {trend && (
                    <span className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
                        {trend.positive ? '+' : ''}{trend.value}%
                    </span>
                )}
            </div>
            <div className="text-2xl font-bold text-fg">{value}</div>
            <div className="text-xs text-fg-muted mt-1">{label}</div>
        </div>
    );
};

export default StatCard;
