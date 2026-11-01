// Formatação e etiquetas partilhadas pelo módulo de utilizadores.
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mediaUrl } from '@/lib/supabaseClient';
import { ROLES } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export const formatKz = (value) =>
  `${Number(value || 0).toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kz`;

export const formatDate = (value, withTime = false) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? `${d.toLocaleDateString('pt-AO')} ${d.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('pt-AO');
};

export const ROLE_BADGE = {
  admin: { label: ROLES.admin.label, className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  manager: { label: ROLES.manager.label, className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  member: { label: ROLES.member.label, className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  guest: { label: 'Sem conta', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};

export const PROVIDER_LABEL = { email: 'Email', google: 'Google' };

/** Estado da conta: suspensa, por confirmar, activa ou sem conta (comprou como convidado). */
export function accountState(u) {
  if (!u.has_account) return { label: 'Sem conta', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
  if (u.suspended) return { label: 'Suspensa', className: 'bg-red-500/10 text-red-700 dark:text-red-300' };
  if (!u.email_confirmed) return { label: 'Por confirmar', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' };
  return { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };
}

export function Pill({ className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', className)}>
      {children}
    </span>
  );
}

export function PersonAvatar({ person, className }) {
  const avatar = person?.avatar || '';
  const src = !avatar ? '' : /^https?:\/\//.test(avatar) ? avatar : person?.id ? mediaUrl('users', person.id, avatar) : '';
  const label = (person?.name || person?.email || '?').trim();
  const initials = label.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  return (
    <Avatar className={cn('h-9 w-9', className)}>
      {src && <AvatarImage src={src} alt={label} />}
      <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
    </Avatar>
  );
}
