import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Shield, User, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserAvatar from '@/components/UserAvatar';
import { PERMISSIONS, MANAGER_PERMISSIONS } from '@/lib/permissions';

export default function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pb.collection('users').getFullList({ sort: '-created' });
      setUsers(list);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (user, role) => {
    try {
      const data = { role };
      if (role === 'manager') {
        data.permissions = MANAGER_PERMISSIONS;
      } else if (role === 'member') {
        data.permissions = {};
      }
      await pb.collection('users').update(user.id, data);
      toast({ title: 'Role actualizada' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const updatePermission = async (user, key, value) => {
    try {
      const permissions = { ...(user.permissions || {}), [key]: value };
      await pb.collection('users').update(user.id, { permissions });
      toast({ title: 'Permissão actualizada' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const deleteUser = async (user) => {
    if (!confirm(`Eliminar utilizador ${user.email}?`)) return;
    try {
      await pb.collection('users').delete(user.id);
      toast({ title: 'Utilizador eliminado' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Utilizadores e Permissões</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {users.length} utilizadores · O login é central para encomendas, perfil e acesso ao painel.
        </p>
      </div>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-card border rounded-xl overflow-hidden">
            <div
              className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-muted/20"
              onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
            >
              <div className="flex items-center gap-3">
                <UserAvatar user={u} size="sm" />
                <div>
                  <p className="font-medium">{u.name || '—'}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={u.role || 'member'} onValueChange={(v) => updateRole(u, v)} onClick={(e) => e.stopPropagation()}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member"><User className="h-3 w-3 inline mr-1" />Membro</SelectItem>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="admin"><Shield className="h-3 w-3 inline mr-1" />Admin</SelectItem>
                  </SelectContent>
                </Select>
                {expandedUser === u.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {expandedUser === u.id && u.role !== 'admin' && (
              <div className="px-4 pb-4 border-t pt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Permissões granulares</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.entries(PERMISSIONS).map(([key, { label, description }]) => (
                    <div key={key} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                      <Switch
                        checked={!!(u.permissions || {})[key]}
                        onCheckedChange={(v) => updatePermission(u, key, v)}
                      />
                      <div>
                        <Label className="text-sm">{label}</Label>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => deleteUser(u)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </div>
            )}

            {expandedUser === u.id && u.role === 'admin' && (
              <div className="px-4 pb-4 border-t pt-4 text-sm text-muted-foreground">
                Administradores têm acesso total ao sistema.
                <div className="flex justify-end mt-2">
                  <Button variant="ghost" size="sm" onClick={() => deleteUser(u)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
