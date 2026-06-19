import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FeatureGate } from '@so360/design-system';
import { Users, UserPlus, Trash2, Shield, Loader2, Search, User } from 'lucide-react';
import { orgPolicyApi, ApprovalChain, CreateApprovalChainPayload } from '../../services/orgPolicyService';
import { peopleApi } from '../../services/peopleService';
import { useShellBridge } from '@so360/shell-context';

// Inline modal for adding a new mapping — searches PC people list
const AddChainModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const [personQuery, setPersonQuery] = useState('');
  const [approverQuery, setApproverQuery] = useState('');
  const [personResults, setPersonResults] = useState<any[]>([]);
  const [approverResults, setApproverResults] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [selectedApprover, setSelectedApprover] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPersonQuery('');
      setApproverQuery('');
      setSelectedPerson(null);
      setSelectedApprover(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (personQuery.length > 1) {
        try {
          const r = await peopleApi.getAll({ search: personQuery, limit: 10 });
          setPersonResults(r.data || []);
        } catch {
          setPersonResults([]);
        }
      } else {
        setPersonResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [personQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (approverQuery.length > 1) {
        try {
          const r = await peopleApi.getAll({ search: approverQuery, limit: 10 });
          setApproverResults(r.data || []);
        } catch {
          setApproverResults([]);
        }
      } else {
        setApproverResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [approverQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !selectedApprover) {
      setError('Please select both an employee and an approver.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload: CreateApprovalChainPayload = {
        person_id: selectedPerson.id,
        person_name: selectedPerson.full_name || `${selectedPerson.first_name || ''} ${selectedPerson.last_name || ''}`.trim(),
        approver_person_id: selectedApprover.id,
        approver_name: selectedApprover.full_name || `${selectedApprover.first_name || ''} ${selectedApprover.last_name || ''}`.trim(),
        module_scope: 'all',
      };
      await orgPolicyApi.createApprovalChain(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create approval chain.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <h2 className="text-lg font-bold text-slate-50 mb-6">Define Approval Relationship</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Employee to be Managed</label>
            {selectedPerson ? (
              <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-400" />
                  <p className="text-sm font-bold text-slate-50">
                    {selectedPerson.full_name || `${selectedPerson.first_name} ${selectedPerson.last_name}`}
                  </p>
                </div>
                <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedPerson(null)}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={personQuery}
                  onChange={e => setPersonQuery(e.target.value)}
                />
                {personResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50">
                    {personResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-slate-700/50 flex flex-col border-b border-slate-700 last:border-none"
                        onClick={() => { setSelectedPerson(p); setPersonResults([]); setPersonQuery(''); }}
                      >
                        <span className="text-sm font-bold text-slate-50">
                          {p.full_name || `${p.first_name} ${p.last_name}`}
                        </span>
                        <span className="text-xs text-slate-500">{p.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Approver selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Designated Approver (Manager)</label>
            {selectedApprover ? (
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-emerald-400" />
                  <p className="text-sm font-bold text-slate-50">
                    {selectedApprover.full_name || `${selectedApprover.first_name} ${selectedApprover.last_name}`}
                  </p>
                </div>
                <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedApprover(null)}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={approverQuery}
                  onChange={e => setApproverQuery(e.target.value)}
                />
                {approverResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50">
                    {approverResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-slate-700/50 flex flex-col border-b border-slate-700 last:border-none"
                        onClick={() => { setSelectedApprover(p); setApproverResults([]); setApproverQuery(''); }}
                      >
                        <span className="text-sm font-bold text-slate-50">
                          {p.full_name || `${p.first_name} ${p.last_name}`}
                        </span>
                        <span className="text-xs text-slate-500">{p.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving}>Discard</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSaving || !selectedPerson || !selectedApprover}
              className="gap-2 min-w-[160px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {isSaving ? 'Establishing...' : 'Establish Relationship'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ApprovalChainsPage: React.FC = () => {
  const navigate = useNavigate();
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shell = useShellBridge();
  const flagsLoaded = shell?.effectiveFlagsLoaded ?? false;
  const manageState = shell?.getFeatureState ? shell.getFeatureState('action:people:approval_chains:manage') : 'enabled';

  const tenantId = shell?.currentTenant?.id;
  const orgId = shell?.currentOrg?.id;

  const loadChains = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orgPolicyApi.getApprovalChains();
      setChains(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load approval chains.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId || tenantId === 'default-tenant' || !orgId) return;
    loadChains();
  }, [tenantId, orgId]);

  const handleDelete = async (personId: string) => {
    if (!confirm('Permanently remove this approval mapping?')) return;
    try {
      await orgPolicyApi.deleteApprovalChain(personId);
      loadChains();
    } catch (err: any) {
      setError(err.message || 'Failed to delete mapping.');
    }
  };

  const filtered = chains.filter(c =>
    c.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.approver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-500" />
            Approval Chains
          </h1>
          <p className="text-slate-400 text-sm">
            Define reporting lines for automated submission routing across Timesheet, Leave, and Expenses.
          </p>
        </div>
        <FeatureGate state={manageState} loading={!flagsLoaded} onUpgradeClick={() => navigate('/org/billing')}>
          <Button variant="primary" className="w-full sm:w-auto h-11 px-6" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            New Relationship
          </Button>
        </FeatureGate>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-800/20 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search employee or approver..."
            className="bg-transparent border-none text-sm text-slate-50 focus:outline-none flex-1"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-4 px-6 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Employee</th>
                <th className="py-4 px-6 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Reports To (Approver)</th>
                <th className="py-4 px-6 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Scope</th>
                <th className="py-4 px-6 text-[11px] text-slate-500 uppercase tracking-widest font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="py-10 px-6 bg-slate-800/10" />
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map(chain => (
                  <tr key={chain.id} className="group hover:bg-slate-800/20 transition-all">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs">
                          {chain.person_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-bold text-slate-50 group-hover:text-teal-400 transition-colors">
                          {chain.person_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                        <span className="text-sm font-medium">{chain.approver_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 capitalize">
                        {chain.module_scope}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <FeatureGate state={manageState} loading={!flagsLoaded} onUpgradeClick={() => navigate('/org/billing')}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-9 h-9 p-0 flex items-center justify-center hover:text-rose-500 hover:border-rose-500/50 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => handleDelete(chain.person_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </FeatureGate>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-24 text-center text-slate-500 italic text-sm">
                    {searchQuery ? 'No matching relationships found.' : 'No approval chains defined.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">Policy Enforcement</p>
          <p className="text-xs text-teal-300/70 leading-relaxed">
            Approval chains apply across Timesheet, Leave, and Expense submissions. Employees without a chain are routed to the Org Administrator by default.
          </p>
        </div>
      </div>

      <AddChainModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={loadChains} />
    </div>
  );
};

export default ApprovalChainsPage;
