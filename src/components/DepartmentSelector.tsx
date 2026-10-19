import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Flatten tree for lookup and filtering
  const flatList = useMemo(() => {
    const result: (Department & { depth: number })[] = [];
    const walk = (nodes: Department[], depth: number) => {
      for (const node of nodes) {
        result.push({ ...node, depth });
        if (node.children?.length) walk(node.children, depth + 1);
      }
    };
    walk(departments, 0);
    return result;
  }, [departments]);

  const selectedDept = flatList.find((d) => d.id === value);

  const filtered = useMemo(() => {
    if (!search) return flatList;
    const lower = search.toLowerCase();
    return flatList.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        d.code?.toLowerCase().includes(lower)
    );
  }, [flatList, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <div
        className="flex items-center w-full px-nb-3 py-nb-2 bg-surface-raised border border-line-strong rounded-nb text-nb-sm text-fg cursor-pointer focus-within:border-primary"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedDept ? selectedDept.name : placeholder}
            className="flex-1 bg-transparent outline-none text-nb-sm text-fg placeholder:text-fg-subtle"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate ${selectedDept ? 'text-fg' : 'text-fg-muted'}`}>
            {selectedDept ? selectedDept.name : placeholder}
          </span>
        )}
        {allowClear && value && !open ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="ml-2 text-fg-muted hover:text-fg"
          >
            &times;
          </button>
        ) : (
          <svg className="ml-2 w-4 h-4 text-fg-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-surface-raised border border-line-strong rounded-nb shadow-lg">
          {loading ? (
            <div className="px-nb-3 py-nb-2 text-nb-sm text-fg-muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-nb-3 py-nb-2 text-nb-sm text-fg-muted">No departments found</div>
          ) : (
            filtered.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => handleSelect(dept.id)}
                className={`w-full text-left px-nb-3 py-nb-2 text-nb-sm hover:bg-line flex items-center ${
                  dept.id === value ? 'bg-line/50 text-primary' : 'text-fg'
                }`}
              >
                {dept.depth > 0 && (
                  <span className="text-fg-subtle mr-1" style={{ paddingLeft: `${dept.depth * 12}px` }}>
                    {'└'}
                  </span>
                )}
                <span className="truncate">{dept.name}</span>
                {dept.code && (
                  <span className="ml-auto text-nb-caption text-fg-subtle shrink-0">{dept.code}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
