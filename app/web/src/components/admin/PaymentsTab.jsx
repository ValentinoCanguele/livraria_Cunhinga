import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Pencil, Trash2, CreditCard, Store, Smartphone } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
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
import { PAYMENT_CATEGORIES, GATEWAY_PROVIDERS } from '@/lib/paymentUtils';

const empty = {
  name: '',
  code: '',
  category: 'gateway',
  type: 'p2p',
  gateway_provider: 'multicaixa_express',
  requires_reference: true,
  enabled: true,
  instructions: '',
  account_info: '',
  qr_url: '',
  icon: '',
  sort_order: 0,
};

const CATEGORY_BADGE = {
  gateway: { label: 'Pagar (gateway)', className: 'bg-[#0ea5c9]/10 text-[#0ea5c9]' },
  balcao: { label: 'Pagar no Balcão', className: 'bg-amber-500/10 text-amber-700' },
  on_delivery: { label: 'Na entrega', className: 'bg-slate-500/10 text-slate-600' },
};

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

  const openNew = (category = 'gateway') => {
    setEditing(null);
    setForm({
      ...empty,
      category,
      type: category === 'gateway' ? 'p2p' : 'offline',
      requires_reference: category === 'gateway',
      gateway_provider: category === 'gateway' ? 'multicaixa_express' : '',
    });
    setQrFile(null);
    setQrRemoved(false);
    setHadQrFile(false);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setHadQrFile(!!m.qr_code);
    setQrRemoved(false);
    setQrFile(null);
    setForm({
      name: m.name,
      code: m.code,
      category: m.category || 'gateway',
      type: m.type || 'p2p',
      gateway_provider: m.gateway_provider || '',
      requires_reference: m.requires_reference !== false && m.category !== 'balcao',
      enabled: !!m.enabled,
      instructions: m.instructions || '',
      account_info: m.account_info || '',
      qr_url: m.qr_url || (m.qr_code ? pb.files.getURL(m, m.qr_code) : ''),
      icon: m.icon || '',
      sort_order: m.sort_order ?? 0,
    });
    setShowForm(true);
  };

  const handleCategoryChange = (category) => {
    setForm((f) => ({
      ...f,
      category,
      type: category === 'gateway' ? 'p2p' : 'offline',
      requires_reference: category === 'gateway',
      gateway_provider: category === 'gateway' ? (f.gateway_provider || 'multicaixa_express') : '',
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        sort_order: Number(form.sort_order) || 0,
        enabled: !!form.enabled,
        requires_reference: form.category === 'gateway' ? !!form.requires_reference : false,
        gateway_provider: form.category === 'gateway' ? (form.gateway_provider || '') : '',
      };
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

  const grouped = {
    gateway: methods.filter((m) => (m.category || 'gateway') === 'gateway'),
    balcao: methods.filter((m) => m.category === 'balcao'),
    on_delivery: methods.filter((m) => m.category === 'on_delivery'),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h3 className="font-bold text-lg">Métodos de Pagamento</h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            Configure como os clientes pagam: <strong>Pagar</strong> (gateway online — Multicaixa Express, transferência) ou <strong>Pagar no Balcão</strong> (loja física).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openNew('gateway')}>
            <Smartphone className="h-4 w-4 mr-1.5" /> Gateway
          </Button>
          <Button variant="outline" size="sm" onClick={() => openNew('balcao')}>
            <Store className="h-4 w-4 mr-1.5" /> Balcão
          </Button>
          <Button className="btn-primary" size="sm" onClick={() => openNew('gateway')}>
            <Plus className="h-4 w-4 mr-2" /> Novo Método
          </Button>
        </div>
      </div>

      {['gateway', 'balcao', 'on_delivery'].map((cat) => {
        const list = grouped[cat];
        if (list.length === 0 && cat === 'on_delivery') return null;
        const meta = PAYMENT_CATEGORIES[cat];
        return (
          <div key={cat} className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {meta?.label || cat}
            </h4>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-xl border-dashed">
                Nenhum método em «{meta?.label}». Adicione um para aparecer no checkout.
              </p>
            ) : (
              <div className="grid gap-3">
                {list.map((m) => {
                  const badge = CATEGORY_BADGE[m.category || 'gateway'];
                  return (
                    <div key={m.id} className="flex items-center gap-4 bg-card border rounded-xl p-4">
                      <div className="h-10 w-10 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center shrink-0">
                        {m.category === 'balcao' ? <Store className="h-5 w-5 text-amber-600" /> : <CreditCard className="h-5 w-5 text-[#0ea5c9]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold flex flex-wrap items-center gap-2">
                          {m.icon && <span>{m.icon}</span>}
                          {m.name}
                          <code className="text-xs text-muted-foreground font-normal">{m.code}</code>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.gateway_provider && `${GATEWAY_PROVIDERS[m.gateway_provider] || m.gateway_provider} · `}
                          {m.enabled ? 'Activo no checkout' : 'Inactivo'}
                          {m.requires_reference ? ' · Requer referência' : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { await pb.collection('payment_methods').delete(m.id); load(); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {methods.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Nenhum método configurado. Reinicie o PocketBase para aplicar migrations ou crie um método.</p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-1">{editing ? 'Editar' : 'Novo'} Método de Pagamento</h3>
            <p className="text-sm text-muted-foreground mb-4">Defina como este método aparece no checkout.</p>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria no checkout *</Label>
                <Select value={form.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gateway">Pagar — gateway online (Multicaixa, transferência…)</SelectItem>
                    <SelectItem value="balcao">Pagar no Balcão — loja física</SelectItem>
                    <SelectItem value="on_delivery">Pagar na Entrega — ao receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={form.category === 'balcao' ? 'Pagar no Balcão' : 'Multicaixa Express'} /></div>
                <div className="space-y-2"><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder={form.category === 'balcao' ? 'balcao' : 'multicaixa'} className="font-mono" disabled={!!editing} /></div>
              </div>
              {form.category === 'gateway' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Gateway / provedor</Label>
                      <Select value={form.gateway_provider || 'multicaixa_express'} onValueChange={(v) => setForm({ ...form, gateway_provider: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(GATEWAY_PROVIDERS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo técnico</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="p2p">P2P (referência / QR)</SelectItem>
                          <SelectItem value="transfer">Transferência bancária</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Switch checked={form.requires_reference} onCheckedChange={(v) => setForm({ ...form, requires_reference: v })} />
                    <div>
                      <Label>Exigir referência/comprovativo no checkout</Label>
                      <p className="text-xs text-muted-foreground">O cliente deve indicar o número da transferência ou referência Multicaixa</p>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2"><Label>Conta / Número / IBAN</Label><Input value={form.account_info} onChange={(e) => setForm({ ...form, account_info: e.target.value })} placeholder="923 000 000 ou IBAN" /></div>
              <div className="space-y-2"><Label>Instruções para o cliente</Label><Textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={form.category === 'balcao' ? 'Dirija-se ao balcão com o número da encomenda…' : 'Transfira o valor e indique a referência…'} /></div>
              {form.category === 'gateway' && (
                <ImageField
                  label="QR Code de pagamento"
                  value={form.qr_url}
                  onChange={(v) => { setForm({ ...form, qr_url: v }); setQrRemoved(false); }}
                  onFileChange={(f) => { setQrFile(f); if (f) setQrRemoved(false); }}
                  onClear={() => setQrRemoved(true)}
                  aspect="1:1"
                  hint="QR: PNG · 300×300px · Multicaixa / gateway"
                  previewClassName="h-28 w-28"
                  driveConfig={driveImageConfig}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Ícone (emoji)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="💳" maxLength={4} /></div>
                <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
              </div>
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
