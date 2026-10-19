import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, FileDown } from 'lucide-react';
import { toast, Button, IconButton, ListPageTemplate, DataTable, DateInput, Modal, Stack, Cluster, Card } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/payroll/StatusChip';
import PersonPicker, { PickablePerson } from '../../components/PersonPicker';
import { payrollApi, Payslip } from '../../services/payrollApi';
import { peopleApi } from '../../services/peopleService';

const PayslipsPage: React.FC = () => {
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [people, setPeople] = useState<PickablePerson[]>([]);
    const [personId, setPersonId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [viewing, setViewing] = useState<Payslip | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const result = await payrollApi.payslips.list({
                person_id: personId || undefined,
                from: from || undefined,
                to: to || undefined,
            });
            setPayslips(result.data);
        } catch {
            toast.error('Failed to load payslips');
        } finally {
            setLoading(false);
        }
    }, [personId, from, to]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        peopleApi.getAll({ status: 'active', limit: 200 })
            .then(result => setPeople(result.data.map(p => ({ id: p.id, full_name: p.full_name || '' }))))
            .catch(() => { /* filter degrades gracefully without options */ });
    }, []);

    const openPayslip = async (payslip: Payslip) => {
        try {
            const full = await payrollApi.payslips.get(payslip.id);
            setViewing(full);
        } catch {
            toast.error('Failed to load payslip');
        }
    };

    const download = async (payslip: Payslip) => {
        try {
            await payrollApi.payslips.downloadPdf(payslip.id, `${payslip.payslip_number}.pdf`);
        } catch {
            toast.error('Failed to download payslip PDF');
        }
    };

    const columns: DataTableColumn<Payslip>[] = [
        { key: 'payslip_number', header: 'Payslip #', render: p => <span className="text-fg">{p.payslip_number}</span> },
        { key: 'person_name', header: 'Employee', render: p => <span className="text-fg">{p.person_name || '—'}</span> },
        {
            key: 'period',
            header: 'Period',
            render: p => (
                <span className="text-fg-muted">
                    {formatters.formatDate(p.period_start)} – {formatters.formatDate(p.period_end)}
                </span>
            ),
        },
        { key: 'net_pay', header: 'Net Pay', align: 'right', render: p => <span className="text-fg">{formatters.formatCurrency(p.net_pay)}</span> },
        { key: 'visibility', header: 'Visibility', align: 'center', render: p => <StatusChip status={p.visibility || 'published'} /> },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: p => (
                <Cluster gap="tight" align="center" justify="end">
                    <Button variant="ghost" size="sm" onClick={() => openPayslip(p)}>View</Button>
                    <IconButton icon={<FileDown size={14} />} label={`Download ${p.payslip_number}`} onClick={() => download(p)} />
                </Cluster>
            ),
        },
    ];

    return (
        <>
            <ListPageTemplate
                title="Payslips"
                description="All generated payslips across pay runs"
                loading={loading}
                isEmpty={payslips.length === 0}
                filters={
                    <Cluster gap="default" align="end" wrap>
                        <Stack gap="tight">
                            <span className="text-nb-caption text-fg-muted">Employee</span>
                            <PersonPicker options={people} value={personId} onChange={id => setPersonId(id)} placeholder="All employees" emptyMessage="No people available" />
                        </Stack>
                        <DateInput name="from" label="From" value={from} onChange={setFrom} />
                        <DateInput name="to" label="To" value={to} onChange={setTo} />
                    </Cluster>
                }
                empty={
                    <EmptyState
                        icon={Receipt}
                        title="No payslips"
                        description="Payslips appear here after a payroll run is closed."
                    />
                }
            >
                <DataTable name="payslips" columns={columns} rows={payslips} rowKey={p => p.id} />
            </ListPageTemplate>

            <PayslipViewModal payslip={viewing} onClose={() => setViewing(null)} formatCurrency={formatters.formatCurrency} formatDate={formatters.formatDate} />
        </>
    );
};

// Shared payslip line view — also used by MyPayslipsPage.
export const PayslipViewModal: React.FC<{
    payslip: Payslip | null;
    onClose: () => void;
    formatCurrency: (v: number) => string;
    formatDate: (d: string) => string;
}> = ({ payslip, onClose, formatCurrency, formatDate }) => (
    <Modal open={!!payslip} onClose={onClose} title={payslip ? `Payslip ${payslip.payslip_number}` : ''} size="lg">
        {payslip && (
            <Stack gap="default">
                <Cluster gap="default" justify="between" align="center">
                    <span className="text-nb-body text-fg-muted">
                        {formatDate(payslip.period_start)} – {formatDate(payslip.period_end)}
                    </span>
                    {payslip.person_name && <span className="text-nb-body text-fg">{payslip.person_name}</span>}
                </Cluster>
                {payslip.lines && payslip.lines.length > 0 && (
                    <Card padding="sm">
                        <Stack gap="tight">
                            {payslip.lines.map(line => (
                                <Cluster key={line.id || line.component_code} gap="default" justify="between" align="center">
                                    <Cluster gap="default" align="center">
                                        <StatusChip status={line.kind} />
                                        <span className="text-nb-body text-fg">{line.component_name}</span>
                                    </Cluster>
                                    <span className="text-nb-body text-fg">{formatCurrency(line.amount)}</span>
                                </Cluster>
                            ))}
                        </Stack>
                    </Card>
                )}
                <Card padding="md">
                    <Stack gap="tight">
                        <Cluster gap="default" justify="between"><span className="text-nb-body text-fg-muted">Gross</span><span className="text-nb-body text-fg">{formatCurrency(payslip.gross)}</span></Cluster>
                        <Cluster gap="default" justify="between"><span className="text-nb-body text-fg-muted">Deductions</span><span className="text-nb-body text-fg">{formatCurrency(payslip.total_deductions)}</span></Cluster>
                        <Cluster gap="default" justify="between"><span className="text-nb-body text-fg">Net Pay</span><span className="text-nb-body text-primary">{formatCurrency(payslip.net_pay)}</span></Cluster>
                    </Stack>
                </Card>
            </Stack>
        )}
    </Modal>
);

export default PayslipsPage;
