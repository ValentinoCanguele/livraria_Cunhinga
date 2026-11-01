import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Phone, ShoppingBag, CalendarClock, LogIn, KeyRound } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PERMISSIONS } from '@/lib/permissions';
import { listUserOrders } from '@/lib/usersApi';
import { formatOrderNumber, getDeliveryStatusColor, getDeliveryStatusLabel, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/orderUtils';
import { PersonAvatar, Pill, ROLE_BADGE, PROVIDER_LABEL, accountState, formatDate, formatKz } from './userFormat';

function Info({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="break-words">{children}</div>
      </div>
    </div>
  );
}

/** Ficha de uma pessoa: dados da conta, permissões e histórico de encomendas. As acções vêm do módulo. */
export default function UserDetailSheet({ person, open, onOpenChange, actions }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !person?.email) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    listUserOrders(person.email)
      .then((res) => { if (!cancelled) setOrders(res.items || []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, person?.email]);

  if (!person) return null;
  const role = ROLE_BADGE[person.role] || ROLE_BADGE.member;
  const state = accountState(person);
  const activePermissions = Object.entries(PERMISSIONS).filter(([k]) => person.permissions?.[k] === true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <PersonAvatar person={person} className="h-12 w-12" />
            <div className="min-w-0">
              <SheetTitle className="truncate">{person.name || person.email}</SheetTitle>
              <SheetDescription className="truncate">{person.email}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Pill className={role.className}>{role.label}</Pill>
            <Pill className={state.className}>{state.label}</Pill>
            {(person.providers || []).map((p) => (
              <Pill key={p} className="bg-muted text-muted-foreground">{PROVIDER_LABEL[p] || p}</Pill>
            ))}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {actions}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-lg font-bold">{person.orders_count || 0}</p>
              <p className="text-[11px] text-muted-foreground">Encomendas</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-sm font-bold leading-7">{formatKz(person.orders_total)}</p>
              <p className="text-[11px] text-muted-foreground">Total gasto</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-sm font-bold leading-7">{formatDate(person.last_order_at)}</p>
              <p className="text-[11px] text-muted-foreground">Última compra</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={Mail} label="Email">{person.email || '—'}</Info>
            <Info icon={Phone} label="Telefone">{person.phone || '—'}</Info>
            {person.has_account && <Info icon={CalendarClock} label="Conta criada">{formatDate(person.created, true)}</Info>}
            {person.has_account && <Info icon={LogIn} label="Último acesso">{formatDate(person.last_sign_in_at, true)}</Info>}
          </div>

          {person.role === 'manager' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Permissões
              </p>
              {activePermissions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {activePermissions.map(([k, p]) => <Pill key={k} className="bg-sky-500/10 text-sky-700 dark:text-sky-300">{p.label}</Pill>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma permissão activa: este gestor não vê nada no painel.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Encomendas
            </p>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não fez nenhuma encomenda.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {orders.map((o) => (
                  <li key={o.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatOrderNumber(o)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(o.created, true)} · {(o.items || []).reduce((n, it) => n + (Number(it.quantity) || 1), 0)} artigo(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill className={getPaymentStatusColor(o.payment_status)}>{getPaymentStatusLabel(o.payment_status)}</Pill>
                      <Pill className={getDeliveryStatusColor(o.delivery_status)}>{getDeliveryStatusLabel(o.delivery_status)}</Pill>
                      <span className="font-semibold">{formatKz(o.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
