import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from '@so360/design-system';
import { payrollApi, PayrollAlert, AlertEmployee } from '../../services/payrollApi';

/**
 * Right-hand drawer opened from a dashboard alert's "Review employees →"
 * action. Lists the affected employees with a direct link to each person's
 * Payroll tab so the issue can be fixed inline; the alert count on the
 * dashboard drops as employees are fixed and the list is reloaded.
 */
interface AlertDrawerProps {
    alert: PayrollAlert | null;
    onClose: () => void;
}

const AlertDrawer: React.FC<AlertDrawerProps> = ({ alert, onClose }) => {
    const [employees, setEmployees] = useState<AlertEmployee[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!alert) return;
        let cancelled = false;
        setLoading(true);
        payrollApi.alerts.employees(alert.key)
            .then(result => { if (!cancelled) setEmployees(result.data); })
            .catch(() => { if (!cancelled) toast.error('Failed to load affected employees'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [alert]);

    if (!alert) return null;

    return (
        <div className="fixed inset-0 z-[600] flex justify-end">
            <div className="fixed inset-0 bg-overlay/60 backdrop-blur-sm" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-label={alert.label} className="relative w-full max-w-md h-full bg-surface border-l border-line shadow-2xl overflow-y-auto">
                <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-start justify-between z-10">
                    <div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-warning" />
                            <h2 className="text-base font-semibold text-fg">{alert.label}</h2>
                        </div>
                        {alert.description && <p className="text-xs text-fg-muted mt-1">{alert.description}</p>}
                        <p className="text-xs text-fg-subtle mt-1">{alert.count} employee{alert.count === 1 ? '' : 's'} affected</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-nb text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5 space-y-2">
                    {loading ? (
                        [...Array(4)].map((_, i) => <div key={i} className="h-14 bg-surface-raised/50 rounded-nb animate-pulse" />)
                    ) : employees.length === 0 ? (
                        <p className="text-sm text-fg-muted py-8 text-center">No employees remaining — this alert is resolved.</p>
                    ) : (
                        employees.map(emp => (
                            <div key={emp.person_id} className="flex items-center justify-between px-3 py-2.5 bg-surface-raised/50 border border-line rounded-nb">
                                <div>
                                    <div className="text-sm font-medium text-fg">{emp.person_name}</div>
                                    <div className="text-xs text-fg-muted">
                                        {[emp.employee_code, emp.department_name].filter(Boolean).join(' · ')}
                                    </div>
                                    {emp.detail && <div className="text-xs text-warning/80 mt-0.5">{emp.detail}</div>}
                                </div>
                                <Link
                                    to={`/people/people/${emp.person_id}?tab=payroll`}
                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors"
                                >
                                    Fix <ExternalLink size={12} />
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlertDrawer;
