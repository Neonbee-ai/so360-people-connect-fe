import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, FileDown } from 'lucide-react';
import { toast } from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
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

    return (
        <div className="p-6 space-y-5">
            <PageHeader title="Payslips" subtitle="All generated payslips across pay runs" />

            {/* Filters */}
            <div className="flex items-end gap-3">
                <div className="w-64">
                    <label className="block text-xs text-slate-400 mb-1">Employee</label>
                    <PersonPicker options={people} value={personId} onChange={id => setPersonId(id)} placeholder="All employees" emptyMessage="No people available" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">From</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">To</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 focus:outline-none focus:border-teal-500" />
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />)}
                </div>
            ) : payslips.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No payslips"
                    description="Payslips appear here after a payroll run is closed."
                />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Payslip #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Period</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Net Pay</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Visibility</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {payslips.map(payslip => (
                                <tr key={payslip.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-50">{payslip.payslip_number}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{payslip.person_name || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {formatters.formatDate(payslip.period_start)} – {formatters.formatDate(payslip.period_end)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-200">{formatters.formatCurrency(payslip.net_pay)}</td>
                                    <td className="px-4 py-3 text-center"><StatusChip status={payslip.visibility || 'published'} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-3">
                                            <button onClick={() => openPayslip(payslip)} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">View</button>
                                            <button onClick={() => download(payslip)} aria-label={`Download ${payslip.payslip_number}`} className="text-slate-400 hover:text-slate-50 transition-colors"><FileDown size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <PayslipViewModal payslip={viewing} onClose={() => setViewing(null)} formatCurrency={formatters.formatCurrency} formatDate={formatters.formatDate} />
        </div>
    );
};

// Shared payslip line view — also used by MyPayslipsPage.
export const PayslipViewModal: React.FC<{
    payslip: Payslip | null;
    onClose: () => void;
    formatCurrency: (v: number) => string;
    formatDate: (d: string) => string;
}> = ({ payslip, onClose, formatCurrency, formatDate }) => (
    <Modal isOpen={!!payslip} onClose={onClose} title={payslip ? `Payslip ${payslip.payslip_number}` : ''} size="lg">
        {payslip && (
            <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                        {formatDate(payslip.period_start)} – {formatDate(payslip.period_end)}
                    </span>
                    {payslip.person_name && <span className="text-slate-300">{payslip.person_name}</span>}
                </div>
                {payslip.lines && payslip.lines.length > 0 && (
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <tbody className="divide-y divide-slate-800">
                                {payslip.lines.map(line => (
                                    <tr key={line.id || line.component_code}>
                                        <td className="px-4 py-2"><StatusChip status={line.kind} /></td>
                                        <td className="px-4 py-2 text-sm text-slate-300">{line.component_name}</td>
                                        <td className="px-4 py-2 text-right text-sm text-slate-200">{formatCurrency(line.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Gross</span><span className="text-slate-200">{formatCurrency(payslip.gross)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Deductions</span><span className="text-slate-200">{formatCurrency(payslip.total_deductions)}</span></div>
                    <div className="flex justify-between text-sm font-semibold"><span className="text-slate-300">Net Pay</span><span className="text-teal-400">{formatCurrency(payslip.net_pay)}</span></div>
                </div>
            </div>
        )}
    </Modal>
);

export default PayslipsPage;
