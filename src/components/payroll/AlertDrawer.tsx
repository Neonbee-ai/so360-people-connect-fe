import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { toast, Drawer, Stack, Cluster, Card, Skeleton } from '@so360/design-system';
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
        <Drawer
            isOpen
            onClose={onClose}
            title={alert.label}
            subtitle={alert.description || undefined}
            size="md"
        >
            <Stack gap="tight">
                <p className="text-nb-caption text-fg-subtle">{alert.count} employee{alert.count === 1 ? '' : 's'} affected</p>
                {loading ? (
                    [...Array(4)].map((_, i) => <Skeleton key={i} variant="rect" className="h-14" />)
                ) : employees.length === 0 ? (
                    <p className="text-nb-body text-fg-muted py-8 text-center">No employees remaining — this alert is resolved.</p>
                ) : (
                    employees.map(emp => (
                        <Card key={emp.person_id} name={`alert-employee-${emp.person_id}`} padding="sm">
                            <Cluster gap="default" justify="between" align="center">
                                <Stack gap="none">
                                    <div className="text-nb-body text-fg">{emp.person_name}</div>
                                    <div className="text-nb-caption text-fg-muted">
                                        {[emp.employee_code, emp.department_name].filter(Boolean).join(' · ')}
                                    </div>
                                    {emp.detail && <div className="text-nb-caption text-warning">{emp.detail}</div>}
                                </Stack>
                                <Link
                                    to={`/people/people/${emp.person_id}?tab=payroll`}
                                    className="flex items-center gap-1 text-nb-caption text-primary"
                                >
                                    Fix <ExternalLink size={12} />
                                </Link>
                            </Cluster>
                        </Card>
                    ))
                )}
            </Stack>
        </Drawer>
    );
};

export default AlertDrawer;
