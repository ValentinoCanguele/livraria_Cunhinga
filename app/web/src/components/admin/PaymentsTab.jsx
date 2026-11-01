import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Pencil, Trash2, CreditCard } from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, saveRecordWithMedia } from '@/lib/mediaSave';

const empty = { name: '', code: '', type: 'p2p', enabled: true, instructions: '', account_info: '', qr_url: '', icon: '', sort_order: 0 };

export default function PaymentsTab() {
  const { toast } = useToast();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [qrFile, setQrFile] = useState(null);
  const [qrRemoved, setQrRemoved] = useState(false);
  const [hadQrFile, setHadQrFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const { driveImageConfig } = useIntegrations();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pb.collection('payment_methods').getFullList({ sort: 'sort_order' });
      setMethods(list);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty); setQrFile(null); setQrRemoved(false); setHadQrFile(false); setShowForm(true); };
  const openEdit = (m) => {
    setEditing(m);
    setHadQrFile(!!m.qr_code);
    setQrRemoved(false);
    setQrFile(null);
    setForm({
      name: m.name, code: m.code, type: m.type || 'p2p', enabled: !!m.enabled,
      instructions: m.instructions || '', account_info: m.account_info || '',
      qr_url: m.qr_url || (m.qr_code ? pb.files.getURL(m, m.qr_code) : ''),
      icon: m.icon || '', sort_order: m.sort_order ?? 0,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, sort_order: Number(form.sort_order) || 0, enabled: !!form.enabled };
      await saveRecordWithMedia({
        collection: 'payment_methods',
        recordId: editing?.id,
        data,
        file: qrFile,
        fileField: 'qr_code',
        urlField: 'qr_url',
        removed: qrRemoved,
        hadFile: hadQrFile,
      });
      toast({ title: editing ? 'Método actualizado' : 'Método criado' });
      setShowForm(false);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg">Pagamentos P2P</h3>
          <p className="text-sm text-muted-foreground">Multicaixa, Unitel Money, transferência, etc.</p>
        </div>
        <Button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Método</Button>
      </div>

      <div className="grid gap-3">
        {methods.map((m) => (
          <div key={m.id} className="flex items-center gap-4 bg-card border rounded-xl p-4">
            <div className="h-10 w-10 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-[#0ea5c9]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{m.name} <code className="text-xs text-muted-foreground ml-1">{m.code}</code></p>
              <p className="text-xs text-muted-foreground">{m.type} · {m.enabled ? 'Activo' : 'Inactivo'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={async () => { await pb.collection('payment_methods').delete(m.id); load(); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {methods.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum método configurado.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Editar' : 'Novo'} Método de Pagamento</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Multicaixa Express" /></div>
                <div className="space-y-2"><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="multicaixa" className="font-mono" /></div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p2p">P2P (referência/QR)</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="offline">Pagamento na entrega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Conta / Número / IBAN</Label><Input value={form.account_info} onChange={(e) => setForm({ ...form, account_info: e.target.value })} /></div>
              <div className="space-y-2"><Label>Instruções para o cliente</Label><Textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Envie o comprovativo para..." /></div>
              <ImageField
                label="QR Code de pagamento"
                value={form.qr_url}
                onChange={(v) => { setForm({ ...form, qr_url: v }); setQrRemoved(false); }}
                onFileChange={(f) => { setQrFile(f); if (f) setQrRemoved(false); }}
                onClear={() => setQrRemoved(true)}
                aspect="1:1"
                hint="QR: PNG · 300×300px · Para pagamentos P2P"
                previewClassName="h-28 w-28"
                driveConfig={driveImageConfig}
              />
              <div className="flex items-center gap-3"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /><Label>Activo no checkout</Label></div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 btn-primary" disabled={saving}>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
