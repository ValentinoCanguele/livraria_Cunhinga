import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, Search, MoreHorizontal, Eye, Pencil, KeyRound, Ban, CheckCircle2, Trash2, UserPlus,
  Users, UserCheck, ShoppingBag, ShieldAlert, Copy, MessageCircle, ChevronLeft, ChevronRight, RefreshCw, Download,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listUsers, listAllUsers, setUserSuspended, sendAccessLink, deleteUser } from '@/lib/usersApi';
import UserFormDialog from './UserFormDialog';
import UserDetailSheet from './UserDetailSheet';
import { PersonAvatar, Pill, ROLE_BADGE, accountState, formatDate, formatKz } from './userFormat';

const PER_PAGE = 20;

/** CSV com ";" (abre directamente no Excel em português) e BOM para os acentos. */
function downloadCsv(rows, filename) {
  const cols = [
    ['name', 'Nome'], ['email', 'Email'], ['phone', 'Telefone'], ['role', 'Tipo'], ['estado', 'Estado'],
    ['orders_count', 'Encomendas'], ['orders_total', 'Total gasto (Kz)'], ['last_order_at', 'Última compra'],
    ['last_sign_in_at', 'Último acesso'], ['created', 'Conta criada'],
  ];
  const esc = (v) => {
    const t = v == null ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [cols.map(([, h]) => h).join(';')];
  rows.forEach((r) => {
    const row = { ...r, role: (ROLE_BADGE[r.role] || ROLE_BADGE.member).label, estado: accountState(r).label,
      orders_total: Number(r.orders_total || 0).toFixed(2).replace('.', ',') };
    lines.push(cols.map(([k]) => esc(row[k])).join(';'));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_FILTERS = {
  customers: [
    ['all', 'Todos'],
    ['buyers', 'Com compras'],
    ['active', 'Com conta activa'],
    ['guest', 'Sem conta'],
    ['unconfirmed', 'Por confirmar'],
    ['suspended', 'Suspensos'],
  ],
  team: [
    ['all', 'Todos'],
    ['active', 'Activos'],
    ['suspended', 'Suspensos'],
  ],
};

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
      <span className={`p-2 rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-lg font-bold leading-none">{value ?? '—'}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

const waLink = (phone, text) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 9) digits = `244${digits}`;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '';
};

/**
 * Módulo "Utilizadores e Clientes": equipa (administradores e gestores) e clientes
 * (com conta ou que compraram sem conta), com pesquisa, filtros, paginação e CRUD.
 */
export default function UsersModule() {
  const { user: me, isAdmin } = useAuth();
  const { toast } = useToast();

  const [scope, setScope] = useState('customers');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, summary: {} });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formUser, setFormUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, description, actionLabel, destructive, run }
  const [accessInfo, setAccessInfo] = useState(null); // { name, email, phone, link, emailSent }

  // Pesquisa com atraso, para não pedir ao servidor a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({ scope, q: query, status, page, perPage: PER_PAGE });
      const items = res.items || [];
      setData({ items, total: res.total || 0, summary: res.summary || {} });
      // Mantém a ficha aberta actualizada (por email: um cliente sem conta ganha id ao criar a conta).
      setDetail((d) => (d ? items.find((i) => i.email === d.email) || d : d));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao carregar', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [scope, query, status, page, toast]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await listAllUsers({ scope, q: query, status });
      downloadCsv(rows, `${scope === 'team' ? 'equipa' : 'clientes'}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: 'Exportação pronta', description: `${rows.length} linha(s).` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Exportação falhou', description: err.message });
    } finally {
      setExporting(false);
    }
  };

  const changeScope = (value) => { setScope(value); setStatus('all'); setPage(1); };

  /** Gestores só mexem em clientes; ninguém se suspende nem se apaga a si próprio. */
  const permissionsFor = useCallback((u) => {
    const manageable = isAdmin || u.role === 'member' || u.role === 'guest';
    const self = u.id && u.id === me?.id;
    return {
      edit: u.has_account && manageable,
      createAccount: !u.has_account,
      accessLink: u.has_account && manageable,
      suspend: u.has_account && manageable && !self,
      remove: u.has_account && manageable && !self,
    };
  }, [isAdmin, me?.id]);

  const run = async (u, fn, successTitle) => {
    setBusyId(u.id || u.email);
    try {
      const result = await fn();
      if (successTitle) toast({ title: successTitle });
      await load();
      return result;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível concluir', description: err.message });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = (prefill = null) => { setFormUser(prefill); setFormOpen(true); };
  const openEdit = (u) => { setFormUser(u); setFormOpen(true); };

  const askSuspend = (u) => setConfirm({
    title: u.suspended ? 'Reactivar conta?' : 'Suspender conta?',
    description: u.suspended
      ? `${u.name || u.email} volta a poder entrar na loja.`
      : `${u.name || u.email} deixa de conseguir entrar até a conta ser reactivada. As encomendas não são afectadas.`,
    actionLabel: u.suspended ? 'Reactivar' : 'Suspender',
    destructive: !u.suspended,
    run: () => run(u, () => setUserSuspended(u.id, !u.suspended), u.suspended ? 'Conta reactivada' : 'Conta suspensa'),
  });

  const askDelete = (u) => setConfirm({
    title: 'Apagar conta?',
    description: `A conta de ${u.name || u.email} é apagada de vez. As encomendas ficam guardadas (estão ligadas ao email) e a pessoa pode voltar a registar-se.`,
    actionLabel: 'Apagar',
    destructive: true,
    run: async () => {
      const ok = await run(u, () => deleteUser(u.id), 'Conta apagada');
      if (ok) setDetail(null);
    },
  });

  const doAccessLink = async (u) => {
    const res = await run(u, () => sendAccessLink(u.id, u.email));
    if (!res) return;
    if (!res.link) {
      // Sem link para partilhar: o Supabase Auth enviou o email de recuperação.
      toast({ title: 'Email enviado', description: `${u.email} recebe um email para definir a palavra-passe.` });
      return;
    }
    setAccessInfo({ name: u.name, email: u.email, phone: u.phone, link: res.link, emailSent: res.emailSent });
  };

  const onSaved = async (result, meta) => {
    await load();
    if (meta.created) {
      toast({ title: 'Conta criada' });
      if (result?.link) setAccessInfo({ name: meta.name, email: meta.email, phone: meta.phone, link: result.link, emailSent: result.emailSent });
    } else {
      toast({ title: 'Alterações guardadas' });
      setDetail(null);
    }
  };

  const rowActions = (u) => {
    const can = permissionsFor(u);
    return (
      <>
        <DropdownMenuItem onClick={() => setDetail(u)}><Eye className="h-4 w-4 mr-2" />Ver ficha</DropdownMenuItem>
        {can.edit && <DropdownMenuItem onClick={() => openEdit(u)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
        {can.createAccount && <DropdownMenuItem onClick={() => openCreate(u)}><UserPlus className="h-4 w-4 mr-2" />Criar conta</DropdownMenuItem>}
        {can.accessLink && <DropdownMenuItem onClick={() => doAccessLink(u)}><KeyRound className="h-4 w-4 mr-2" />Link para definir palavra-passe</DropdownMenuItem>}
        {(can.suspend || can.remove) && <DropdownMenuSeparator />}
        {can.suspend && (
          <DropdownMenuItem onClick={() => askSuspend(u)}>
            {u.suspended ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
            {u.suspended ? 'Reactivar' : 'Suspender'}
          </DropdownMenuItem>
        )}
        {can.remove && (
          <DropdownMenuItem onClick={() => askDelete(u)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />Apagar conta
          </DropdownMenuItem>
        )}
      </>
    );
  };

  const detailActions = useMemo(() => {
    if (!detail) return null;
    const can = permissionsFor(detail);
    return (
      <div className="flex flex-wrap gap-2">
        {can.edit && <Button size="sm" variant="outline" onClick={() => openEdit(detail)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>}
        {can.createAccount && <Button size="sm" onClick={() => openCreate(detail)}><UserPlus className="h-4 w-4 mr-1" />Criar conta</Button>}
        {can.accessLink && <Button size="sm" variant="outline" onClick={() => doAccessLink(detail)}><KeyRound className="h-4 w-4 mr-1" />Link de acesso</Button>}
        {can.suspend && (
          <Button size="sm" variant="outline" onClick={() => askSuspend(detail)}>
            {detail.suspended ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
            {detail.suspended ? 'Reactivar' : 'Suspender'}
          </Button>
        )}
        {can.remove && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => askDelete(detail)}><Trash2 className="h-4 w-4 mr-1" />Apagar</Button>}
      </div>
    );
    // As acções usam o estado actual; recalcular quando a ficha muda chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, permissionsFor]);

  const s = data.summary || {};
  const from = data.total ? (page - 1) * PER_PAGE + 1 : 0;
  const to = Math.min(page * PER_PAGE, data.total);
  const lastPage = Math.max(1, Math.ceil(data.total / PER_PAGE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Utilizadores e Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Contas da equipa, clientes registados e quem comprou sem conta, num só lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={exporting || !data.total} title="Exportar a lista filtrada">
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Exportar
          </Button>
          <Button variant="outline" size="icon" onClick={load} title="Recarregar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => openCreate(null)}><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Clientes com conta" value={s.customers} tone="bg-slate-500/10 text-slate-700 dark:text-slate-300" />
        <SummaryCard icon={ShoppingBag} label="Compraram sem conta" value={s.guests} tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
        <SummaryCard icon={UserCheck} label="Equipa" value={s.team} tone="bg-sky-500/10 text-sky-700 dark:text-sky-300" />
        <SummaryCard icon={ShieldAlert} label="Contas suspensas" value={s.suspended} tone="bg-red-500/10 text-red-700 dark:text-red-300" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Tabs value={scope} onValueChange={changeScope}>
          <TabsList>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="team">Equipa</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome, email ou telefone…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS[scope].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {scope === 'team' && !isAdmin && (
        <p className="text-xs text-muted-foreground">Só administradores podem alterar contas da equipa, papéis e permissões.</p>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Encomendas</TableHead>
              <TableHead className="text-right">Total gasto</TableHead>
              <TableHead>Última actividade</TableHead>
              <TableHead className="w-10"><span className="sr-only">Acções</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin inline text-muted-foreground" /></TableCell></TableRow>
            ) : data.items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Nenhum resultado.</TableCell></TableRow>
            ) : data.items.map((u) => {
              const role = ROLE_BADGE[u.role] || ROLE_BADGE.member;
              const state = accountState(u);
              const key = u.id || `guest:${u.email}`;
              return (
                <TableRow key={key} className="cursor-pointer" onClick={() => setDetail(u)}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <PersonAvatar person={u} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name || '—'}{u.id && u.id === me?.id ? ' (você)' : ''}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Pill className={role.className}>{role.label}</Pill></TableCell>
                  <TableCell><Pill className={state.className}>{state.label}</Pill></TableCell>
                  <TableCell className="text-right tabular-nums">{u.orders_count || 0}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{formatKz(u.orders_total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {u.last_order_at ? `Compra ${formatDate(u.last_order_at)}` : u.last_sign_in_at ? `Entrou ${formatDate(u.last_sign_in_at)}` : formatDate(u.created)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === (u.id || u.email)}>
                          {busyId === (u.id || u.email) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">{rowActions(u)}</DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total ? `${from}–${to} de ${data.total}` : ''}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)}>
            Seguinte<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={formUser}
        isAdmin={isAdmin}
        currentUserId={me?.id}
        onSaved={onSaved}
      />

      <UserDetailSheet person={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} actions={detailActions} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => { const action = confirm?.run; setConfirm(null); action?.(); }}
            >
              {confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!accessInfo} onOpenChange={(o) => !o && setAccessInfo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link de acesso</DialogTitle>
            <DialogDescription>
              {accessInfo?.emailSent
                ? `Enviámos o link para ${accessInfo?.email}. Também o pode partilhar directamente.`
                : `O email da loja não está configurado ou falhou: partilhe este link com ${accessInfo?.name || accessInfo?.email}. É pessoal e expira.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={accessInfo?.link || ''} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              title="Copiar"
              onClick={() => navigator.clipboard?.writeText(accessInfo?.link || '').then(() => toast({ title: 'Link copiado' }))}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter className="gap-2">
            {waLink(accessInfo?.phone, '') && (
              <Button asChild variant="outline">
                <a
                  href={waLink(accessInfo?.phone, `Olá ${accessInfo?.name || ''}! Use este link para definir a palavra-passe da sua conta na Livraria Adventista: ${accessInfo?.link}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />Enviar por WhatsApp
                </a>
              </Button>
            )}
            <Button onClick={() => setAccessInfo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
