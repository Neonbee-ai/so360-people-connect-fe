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
        className="flex items-center w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-50 cursor-pointer focus-within:border-teal-500"
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
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-400"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate ${selectedDept ? 'text-white' : 'text-slate-400'}`}>
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
            className="ml-2 text-slate-400 hover:text-white"
          >
            &times;
          </button>
        ) : (
          <svg className="ml-2 w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No departments found</div>
          ) : (
            filtered.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => handleSelect(dept.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center ${
                  dept.id === value ? 'bg-slate-700/50 text-teal-400' : 'text-slate-50'
                }`}
              >
                {dept.depth > 0 && (
                  <span className="text-slate-500 mr-1" style={{ paddingLeft: `${dept.depth * 12}px` }}>
                    {'└'}
                  </span>
                )}
                <span className="truncate">{dept.name}</span>
                {dept.code && (
                  <span className="ml-auto text-xs text-slate-500 shrink-0">{dept.code}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
