import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, FileDown } from 'lucide-react';
import { toast, IconButton, ListPageTemplate, Card, Stack, Cluster } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
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
        <>
            <ListPageTemplate trail={[]}
                title="My Payslips"
                description="View and download your payslips"
                loading={loading}
                isEmpty={payslips.length === 0}
                empty={
                    <EmptyState
                        icon={Receipt}
                        title="No payslips yet"
                        description="Your payslips will appear here after your first payroll run is completed."
                    />
                }
            >
                <Stack gap="default">
                    {payslips.map(payslip => (
                        <Card key={payslip.id} name={`payslip-${payslip.id}`} padding="md" onClick={() => openPayslip(payslip)}>
                            <Cluster gap="default" justify="between" align="center">
                                <Cluster gap="default" align="center">
                                    <Receipt size={16} className="text-primary" />
                                    <Stack gap="none">
                                        <span className="text-nb-body text-fg">
                                            {payslipRowLabel(payslip.period_start, settings?.document_language || 'en-US')}
                                        </span>
                                        <span className="text-nb-caption text-fg-muted">
                                            {payslip.payslip_number} · Net {formatters.formatCurrency(payslip.net_pay)}
                                        </span>
                                    </Stack>
                                </Cluster>
                                <Cluster gap="tight" align="center">
                                    <IconButton icon={<FileDown size={14} />} label={`Download ${payslip.payslip_number}`} onClick={(e) => { e.stopPropagation(); download(payslip); }} />
                                </Cluster>
                            </Cluster>
                        </Card>
                    ))}
                </Stack>
            </ListPageTemplate>

            <PayslipViewModal payslip={viewing} onClose={() => setViewing(null)} formatCurrency={formatters.formatCurrency} formatDate={formatters.formatDate} />
        </>
    );
};

export default MyPayslipsPage;
