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
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const iconBgMap = {
    teal: 'bg-teal-500/20 text-teal-400',
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    rose: 'bg-rose-500/20 text-rose-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, trend, color = 'teal' }) => {
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBgMap[color]}`}>
                    <Icon size={18} />
                </div>
                {trend && (
                    <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trend.positive ? '+' : ''}{trend.value}%
                    </span>
                )}
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
        </div>
    );
};

export default StatCard;
