import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PERMISSIONS, ROLES, MANAGER_PERMISSIONS, DEFAULT_PERMISSIONS } from '@/lib/permissions';
import { createUser, updateUser } from '@/lib/usersApi';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'member',
  permissions: { ...DEFAULT_PERMISSIONS },
  password: '',
  sendLink: true,
};

/**
 * Criar ou editar uma conta.
 * - `user` com `has_account`: edição.
 * - `user` sem conta (cliente que comprou como convidado) ou null: criação, com os dados pré-preenchidos.
 * Papéis e permissões só aparecem para administradores; o servidor volta a verificar tudo.
 */
export default function UserFormDialog({ open, onOpenChange, user, isAdmin, currentUserId, onSaved }) {
  const isEdit = !!user?.has_account;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      ...emptyForm,
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.has_account ? user.role : 'member',
      permissions: { ...DEFAULT_PERMISSIONS, ...(user?.permissions || {}) },
    });
  }, [open, user]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isSelf = isEdit && user.id === currentUserId;
  const canEditRole = isAdmin && !isSelf;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) return setError('Indique o email.');
    if (form.password && form.password.length < 8) return setError('A palavra-passe deve ter pelo menos 8 caracteres.');
    setSaving(true);
    try {
      let result;
      if (isEdit) {
        const patch = {};
        if (form.name !== (user.name || '')) patch.name = form.name;
        if (form.phone !== (user.phone || '')) patch.phone = form.phone;
        if (form.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) patch.email = form.email;
        if (canEditRole) {
          if (form.role !== user.role) patch.role = form.role;
          if (form.role === 'manager') patch.permissions = form.permissions;
        }
        if (Object.keys(patch).length) await updateUser(user.id, patch);
        result = { id: user.id };
      } else {
        result = await createUser({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: isAdmin ? form.role : 'member',
          permissions: form.role === 'manager' ? form.permissions : undefined,
          password: form.password || undefined,
          send_link: form.password ? form.sendLink : true,
        });
      }
      onSaved?.(result, { created: !isEdit, name: form.name, email: form.email, phone: form.phone });
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar conta' : user ? 'Criar conta para cliente' : 'Nova conta'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Altere os dados da conta. As encomendas continuam ligadas ao email.'
                : 'A conta fica logo confirmada. Sem palavra-passe, a pessoa recebe um link para a definir.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="uf-name">Nome</Label>
              <Input id="uf-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="uf-email">Email</Label>
              <Input id="uf-email" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="uf-phone">Telefone</Label>
              <Input id="uf-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+244 9XX XXX XXX" maxLength={40} />
            </div>

            {!isEdit && (
              <div className="grid gap-1.5">
                <Label htmlFor="uf-password">Palavra-passe (opcional)</Label>
                <Input id="uf-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder="Deixe vazio para enviar um link" />
                {form.password && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={form.sendLink} onCheckedChange={(v) => set({ sendLink: v === true })} />
                    Enviar também um link para a pessoa definir a sua própria palavra-passe
                  </label>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="grid gap-1.5">
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={(role) => set({ role, permissions: role === 'manager' && form.role !== 'manager' ? { ...MANAGER_PERMISSIONS } : form.permissions })} disabled={!canEditRole && isEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, r]) => (
                      <SelectItem key={key} value={key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isSelf ? 'Não pode alterar o seu próprio papel.' : ROLES[form.role]?.description}
                </p>
              </div>
            )}

            {isAdmin && form.role === 'manager' && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissões do gestor</p>
                {Object.entries(PERMISSIONS).map(([key, p]) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <Switch
                      checked={!!form.permissions[key]}
                      disabled={!canEditRole && isEdit}
                      onCheckedChange={(v) => set({ permissions: { ...form.permissions, [key]: v } })}
                    />
                    <span>
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Guardar' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
