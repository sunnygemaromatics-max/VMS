'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface Props {
  value: string;
  onChange: (branchId: string) => void;
}

export function BranchFilter({ value, onChange }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    apiGet<Branch[]>('/admin/branches').then(setBranches).catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur">
      <Building2 className="w-4 h-4 text-blue-400" />
      <label className="text-xs text-zinc-400">Branch</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
      >
        <option value="" className="bg-slate-900">
          All branches
        </option>
        {branches.map((b) => (
          <option key={b.id} value={b.id} className="bg-slate-900">
            {b.name} — {b.location}
          </option>
        ))}
      </select>
    </div>
  );
}
