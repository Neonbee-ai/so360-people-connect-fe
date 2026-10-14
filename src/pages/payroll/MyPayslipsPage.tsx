import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, FileDown } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { PayslipViewModal } from './PayslipsPage';
import { payrollApi, Payslip } from '../../services/payrollApi';

/** "Your August 2026 payslip" style label from a period start date. */
export function payslipRowLabel(periodStart: string, locale = 'en-US'): string {
    const date = new Date(periodStart);
    if (Number.isNaN(date.getTime())) return 'Your payslip';
    const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    return `Your ${month} payslip`;
}

const MyPayslipsPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState<Payslip | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.my.payslips();
            setPayslips(result.data);
        } catch {
            toast.error('Failed to load your payslips');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openPayslip = async (payslip: Payslip) => {
        try {
            const full = await payrollApi.my.payslip(payslip.id);
            setViewing(full);
        } catch {
            toast.error('Failed to load payslip');
        }
    };

    const download = async (payslip: Payslip) => {
        try {
            await payrollApi.my.downloadPayslipPdf(payslip.id, `${payslip.payslip_number}.pdf`);
        } catch {
            toast.error('Failed to download payslip PDF');
        }
    };

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="My Payslips" subtitle="View and download your payslips" />

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-surface-raised/50 rounded-nb animate-pulse" />)}
                </div>
            ) : payslips.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No payslips yet"
                    description="Your payslips will appear here after your first payroll run is completed."
                />
            ) : (
                <div className="space-y-3">
                    {payslips.map(payslip => (
                        <div key={payslip.id} className="flex items-center justify-between px-5 py-4 bg-surface border border-line rounded-nb hover:border-line-strong transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-nb bg-primary/10 flex items-center justify-center">
                                    <Receipt size={16} className="text-primary" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-fg">
                                        {payslipRowLabel(payslip.period_start, settings?.document_language || 'en-US')}
                                    </div>
                                    <div className="text-xs text-fg-muted">
                                        {payslip.payslip_number} · Net {formatters.formatCurrency(payslip.net_pay)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => openPayslip(payslip)} className="text-xs text-primary hover:text-primary transition-colors">View</button>
                                <button onClick={() => download(payslip)} aria-label={`Download ${payslip.payslip_number}`} className="text-fg-muted hover:text-fg transition-colors">
                                    <FileDown size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <PayslipViewModal payslip={viewing} onClose={() => setViewing(null)} formatCurrency={formatters.formatCurrency} formatDate={formatters.formatDate} />
        </div>
    );
};

export default MyPayslipsPage;
