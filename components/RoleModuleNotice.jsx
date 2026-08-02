'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ROLES } from '@/lib/modules';

export default function RoleModuleNotice({ currentRole, title, description, actions = [] }) {
  const role = ROLES.find((item) => item.id === currentRole);
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="surface border-crimson/20 bg-crimson/[0.03] p-6">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-crimson" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-crimson">{role?.label ?? currentRole} workspace</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-[#1d1d1f]">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="surface surface-interactive flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-heading font-semibold text-[#1d1d1f]">{action.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{action.description}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-crimson" />
          </Link>
        ))}
      </div>
    </div>
  );
}
