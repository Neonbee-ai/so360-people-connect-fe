import React, { useEffect, useState } from 'react';
import {
  Badge, Banner, Button, Cluster, DataTable, EmptyState, ListPageTemplate, Modal, SearchInput, Stack, useConfirm,
} from '@so360/design-system';
import { UserPlus, Trash2, Loader2, User } from 'lucide-react';
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Define Approval Relationship"
      size="lg"
      footer={
        <Cluster gap="default">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving}>Discard</Button>
          <Button
            variant="primary"
            type="submit"
            form="add-approval-chain-form"
            disabled={isSaving || !selectedPerson || !selectedApprover}
            className="gap-nb-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {isSaving ? 'Establishing...' : 'Establish Relationship'}
          </Button>
        </Cluster>
      }
    >
      <form id="add-approval-chain-form" onSubmit={handleSubmit}>
        <Stack gap="region">
            <Stack gap="tight">
              <span className="text-sm font-medium text-fg">Employee to be Managed</span>
              {selectedPerson ? (
                <Cluster gap="default">
                  <Badge tone="primary">
                    <User className="w-4 h-4" />
                    {selectedPerson.full_name || `${selectedPerson.first_name} ${selectedPerson.last_name}`}
                  </Badge>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedPerson(null)}>Change</Button>
                </Cluster>
              ) : (
                <Stack gap="tight">
                  <SearchInput
                    placeholder="Search by name..."
                    value={personQuery}
                    onChange={(v: string) => setPersonQuery(v)}
                  />
                  {personResults.map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      type="button"
                      onClick={() => { setSelectedPerson(p); setPersonResults([]); setPersonQuery(''); }}
                    >
                      <span className="flex flex-col items-start">
                        <span className="text-nb-sm font-medium text-fg">
                          {p.full_name || `${p.first_name} ${p.last_name}`}
                        </span>
                        <span className="text-nb-caption text-fg-subtle">{p.email}</span>
                      </span>
                    </Button>
                  ))}
                </Stack>
              )}
            </Stack>
            <Stack gap="tight">
              <span className="text-sm font-medium text-fg">Designated Approver (Manager)</span>
              {selectedApprover ? (
                <Cluster gap="default">
                  <Badge tone="success">
                    <User className="w-4 h-4" />
                    {selectedApprover.full_name || `${selectedApprover.first_name} ${selectedApprover.last_name}`}
                  </Badge>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedApprover(null)}>Change</Button>
                </Cluster>
              ) : (
                <Stack gap="tight">
                  <SearchInput
                    placeholder="Search by name..."
                    value={approverQuery}
                    onChange={(v: string) => setApproverQuery(v)}
                  />
                  {approverResults.map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      type="button"
                      onClick={() => { setSelectedApprover(p); setApproverResults([]); setApproverQuery(''); }}
                    >
                      <span className="flex flex-col items-start">
                        <span className="text-nb-sm font-medium text-fg">
                          {p.full_name || `${p.first_name} ${p.last_name}`}
                        </span>
                        <span className="text-nb-caption text-fg-subtle">{p.email}</span>
                      </span>
                    </Button>
                  ))}
                </Stack>
              )}
            </Stack>
          {error && <Banner variant="danger">{error}</Banner>}
        </Stack>
      </form>
    </Modal>
  );
};

const ApprovalChainsPage: React.FC = () => {
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shell = useShellBridge();
  const flagsLoaded = shell?.effectiveFlagsLoaded ?? false;
  const canManage = (flagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:people:approval_chains:manage') ?? true);

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

  const [confirm, confirmDialog] = useConfirm();

  const handleDelete = async (personId: string) => {
    if (!(await confirm({ title: 'Remove mapping', message: 'Permanently remove this approval mapping?', intent: 'danger', confirmLabel: 'Remove' }))) return;
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

  const columns = [
    { key: 'person_name', header: 'Employee', render: (c: ApprovalChain) => c.person_name },
    { key: 'approver_name', header: 'Reports To (Approver)', render: (c: ApprovalChain) => c.approver_name },
    {
      key: 'module_scope',
      header: 'Scope',
      render: (c: ApprovalChain) => <Badge tone="neutral">{c.module_scope}</Badge>,
    },
  ];

  return (
    <>
      {confirmDialog}
      <ListPageTemplate trail={[{ label: 'Settings', to: '/people/settings' }]}
        title="Approval Chains"
        description="Define reporting lines for automated submission routing across Timesheet, Leave, and Expenses."
        count={filtered.length}
        primaryAction={
          canManage ? (
            <Button variant="primary" onClick={() => setIsAddOpen(true)}>
              <UserPlus className="w-4 h-4" />
              New Relationship
            </Button>
          ) : undefined
        }
        search={
          <SearchInput
            placeholder="Search employee or approver..."
            value={searchQuery}
            onChange={(v: string) => setSearchQuery(v)}
          />
        }
        loading={isLoading}
      >
        <Stack gap="default">
          {error && <Banner variant="danger">{error}</Banner>}

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c: ApprovalChain) => c.id}
            loading={isLoading}
            emptyState={
              <EmptyState
                title={searchQuery ? 'No matching relationships found.' : 'No approval chains defined.'}
              />
            }
            rowActions={
              canManage
                ? (c: ApprovalChain) => [
                    { label: 'Remove', icon: <Trash2 className="w-4 h-4" />, danger: true, onSelect: () => handleDelete(c.person_id) },
                  ]
                : undefined
            }
          />

          <Banner variant="info" title="Policy Enforcement">
            Approval chains apply across Timesheet, Leave, and Expense submissions. Employees without a chain are routed to the Org Administrator by default.
          </Banner>
        </Stack>
      </ListPageTemplate>

      <AddChainModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={loadChains} />
    </>
  );
};

export default ApprovalChainsPage;
