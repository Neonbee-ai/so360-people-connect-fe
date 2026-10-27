import React, { useState, useEffect, useMemo } from 'react';
import { Combobox } from '@so360/design-system';
import { departmentsApi, Department } from '../services/departmentsService';

type Props = {
  value: string;
  onChange: (id: string | null) => void;
  orgId?: string;
  tenantId?: string;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
};

export default function DepartmentSelector({
  value,
  onChange,
  placeholder = 'Select department...',
  className,
  allowClear,
}: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    departmentsApi.getTree()
      .then((res) => {
        if (!cancelled) {
          const tree = Array.isArray(res) ? res : (res as any).data || [];
          setDepartments(tree);
        }
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Flatten the tree (pre-order). Nesting is conveyed in the option description
  // ("under <parent>") because Comb Combobox options are flat.
  const options = useMemo(() => {
    const result: { value: string; label: string; description?: string; code?: string }[] = [];
    const walk = (nodes: Department[], parent?: string) => {
      for (const node of nodes) {
        const description = [node.code, parent ? `under ${parent}` : ''].filter(Boolean).join(' · ');
        result.push({ value: node.id, label: node.name, description: description || undefined, code: node.code });
        if (node.children?.length) walk(node.children, node.name);
      }
    };
    walk(departments);
    return result;
  }, [departments]);

  return (
    <div className={className}>
      <Combobox
        name="department"
        aria-label="Department"
        options={options}
        value={value || null}
        placeholder={placeholder}
        clearable={allowClear}
        emptyText={loading ? 'Loading...' : 'No departments found'}
        filter={(o: { label: string; code?: string }, q: string) => {
          const lower = q.trim().toLowerCase();
          return o.label.toLowerCase().includes(lower) || !!o.code?.toLowerCase().includes(lower);
        }}
        onChange={(id: string | null) => onChange(id)}
      />
    </div>
  );
}
