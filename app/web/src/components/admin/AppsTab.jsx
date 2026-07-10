import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { testWhatsAppApi } from '@/lib/messaging';
import PhoneInput from '@/components/PhoneInput';

const DEFAULT_APPS = [
  { name: 'Google OAuth', code: 'google_oauth', description: 'Login com conta Google — configurar em PocketBase Auth providers', icon: '🔐' },
  { name: 'Google Maps', code: 'google_maps', description: 'Mapas embutidos nas lojas físicas (requer API key em Tema UI)', icon: '🗺️' },
  { name: 'Google Contactos', code: 'google_contacts', description: 'Link rápido para contactos Google no perfil admin', icon: '👤' },
  {
    name: 'Google Drive (Imagens)',
    code: 'google_drive',
    description: 'Escolher imagens do Drive ao adicionar livros, logotipo e capas — pasta filtrada do sistema',
    icon: '📁',
    config: { api_key: '', client_id: '', folder_id: '' },
  },
  { name: 'Newsletter', code: 'newsletter', description: 'Subscrições de email no rodapé', icon: '📧' },
  { name: 'PWA', code: 'pwa', description: 'App instalável no telemóvel', icon: '📱' },
  { name: 'Rastreio de Entregas', code: 'delivery_tracking', description: 'Página pública de rastreio de encomendas', icon: '📦' },
  {
    name: 'WhatsApp Business API',
    code: 'whatsapp_business',
    description: 'Envio automático de confirmações e notificações via Meta Cloud API',
    icon: '💬',
    config: { phone_number_id: '', access_token: '', template_name: 'order_confirmation', template_language: 'pt_PT', use_template: false, auto_send: true },
  },
];

function WhatsAppBusinessConfigForm({ app, onSave }) {
  const cfg = app.config || {};
  const { toast } = useToast();
  const [phoneId, setPhoneId] = useState(cfg.phone_number_id || '');
  const [token, setToken] = useState(cfg.access_token || '');
  const [template, setTemplate] = useState(cfg.template_name || 'order_confirmation');
  const [templateLang, setTemplateLang] = useState(cfg.template_language || 'pt_PT');
  const [useTemplate, setUseTemplate] = useState(!!cfg.use_template);
  const [autoSend, setAutoSend] = useState(cfg.auto_send !== false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setPhoneId(cfg.phone_number_id || '');
    setToken(cfg.access_token || '');
    setTemplate(cfg.template_name || 'order_confirmation');
    setTemplateLang(cfg.template_language || 'pt_PT');
    setUseTemplate(!!cfg.use_template);
    setAutoSend(cfg.auto_send !== false);
  }, [app.id, cfg.phone_number_id, cfg.access_token, cfg.template_name, cfg.template_language, cfg.use_template, cfg.auto_send]);

  const buildConfig = () => ({
    phone_number_id: phoneId.trim(),
    access_token: token.trim(),
    template_name: template.trim() || 'order_confirmation',
    template_language: templateLang.trim() || 'pt_PT',
    use_template: useTemplate,
    auto_send: autoSend,
  });

  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast({ variant: 'destructive', title: 'Indique um número de teste' });
      return;
    }
    if (!pb.authStore.token) {
      toast({ variant: 'destructive', title: 'Sessão expirada', description: 'Inicie sessão novamente.' });
      return;
    }
    setTesting(true);
    try {
      await onSave(app, buildConfig());
      await testWhatsAppApi(testPhone.trim(), pb.authStore.token);
      toast({ title: 'Teste enviado', description: `Mensagem enviada para ${testPhone}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Teste falhou', description: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border text-sm">
      <p className="text-xs text-muted-foreground">
        Configure em <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-[#0ea5c9] underline">Meta for Developers</a>.
        Com a API activa, checkout, CRM e recibos enviam mensagens <strong>sem abrir o browser</strong>.
      </p>
      <div className="flex items-center gap-3 p-2 rounded border bg-background">
        <Switch checked={autoSend} onCheckedChange={setAutoSend} />
        <Label className="text-xs">Envio automático (checkout + CRM)</Label>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Phone Number ID</Label>
        <Input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="1234567890" className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Access Token (permanente)</Label>
        <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAxxxx..." className="font-mono text-xs" />
      </div>
      <div className="flex items-center gap-3 p-2 rounded border bg-background">
        <Switch checked={useTemplate} onCheckedChange={setUseTemplate} />
        <Label className="text-xs">Usar template Meta (recomendado para produção)</Label>
      </div>
      {useTemplate && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Nome do template</Label>
            <Input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="order_confirmation" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Idioma do template</Label>
            <Input value={templateLang} onChange={(e) => setTemplateLang(e.target.value)} placeholder="pt_PT" className="font-mono text-xs" />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => onSave(app, buildConfig())}>
          Guardar WhatsApp Business
        </Button>
      </div>
      <div className="border-t pt-3 space-y-2">
        <Label className="text-xs font-semibold">Testar envio</Label>
        <PhoneInput value={testPhone} onChange={setTestPhone} />
        <Button type="button" size="sm" variant="outline" onClick={handleTest} disabled={testing}>
          {testing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Enviar mensagem de teste
        </Button>
      </div>
    </div>
  );
}

function DriveConfigForm({ app, onSave }) {
  const cfg = app.config || {};
  const [apiKey, setApiKey] = useState(cfg.api_key || '');
  const [clientId, setClientId] = useState(cfg.client_id || '');
  const [folderId, setFolderId] = useState(cfg.folder_id || '');

  useEffect(() => {
    setApiKey(cfg.api_key || '');
    setClientId(cfg.client_id || '');
    setFolderId(cfg.folder_id || '');
  }, [app.id, cfg.api_key, cfg.client_id, cfg.folder_id]);

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border text-sm">
      <p className="text-xs text-muted-foreground">
        Crie credenciais em Google Cloud Console (Drive API + Picker API). A pasta deve conter as imagens do sistema.
        ID da pasta: último segmento do URL <code className="font-mono">drive.google.com/drive/folders/XXXX</code>
      </p>
      <div className="space-y-2">
        <Label className="text-xs">API Key</Label>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">OAuth Client ID (Picker)</Label>
        <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">ID da Pasta do Sistema</Label>
        <Input value={folderId} onChange={(e) => setFolderId(e.target.value)} placeholder="1AbC..." className="font-mono text-xs" />
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onSave(app, { api_key: apiKey.trim(), client_id: clientId.trim(), folder_id: folderId.trim() })}
      >
        Guardar Google Drive
      </Button>
    </div>
  );
}

export default function AppsTab() {
  const { toast } = useToast();
  const { refresh: refreshIntegrations } = useIntegrations();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let list = await pb.collection('app_integrations').getFullList();
      if (list.length === 0) {
        for (const app of DEFAULT_APPS) {
          await pb.collection('app_integrations').create({ ...app, enabled: app.code === 'google_drive' ? false : true, config: app.config || {} });
        }
        list = await pb.collection('app_integrations').getFullList();
      } else {
        const hasDrive = list.some((a) => a.code === 'google_drive');
        const hasWa = list.some((a) => a.code === 'whatsapp_business');
        if (!hasDrive) {
          const driveDef = DEFAULT_APPS.find((a) => a.code === 'google_drive');
          await pb.collection('app_integrations').create({ ...driveDef, enabled: false, config: driveDef.config || {} });
        }
        if (!hasWa) {
          const waDef = DEFAULT_APPS.find((a) => a.code === 'whatsapp_business');
          await pb.collection('app_integrations').create({ ...waDef, enabled: false, config: waDef.config || {} });
        }
        if (!hasDrive || !hasWa) {
          list = await pb.collection('app_integrations').getFullList();
        }
      }
      setApps(list);
    } catch {
      setApps(DEFAULT_APPS.map((a) => ({ ...a, enabled: true, id: a.code })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (app, enabled) => {
    try {
      if (app.id && app.id.length > 10) {
        await pb.collection('app_integrations').update(app.id, { enabled });
      }
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, enabled } : a)));
      await refreshIntegrations();
      toast({ title: enabled ? 'Activado' : 'Desactivado' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const saveConfig = async (app, config) => {
    try {
      const payload = typeof config === 'string' ? JSON.parse(config || '{}') : config;
      await pb.collection('app_integrations').update(app.id, { config: payload });
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, config: payload } : a)));
      await refreshIntegrations();
      toast({ title: 'Configuração guardada' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'JSON inválido ou erro', description: err.message });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Active ou desactive funcionalidades auxiliares do sistema.</p>
      {apps.map((app) => (
        <div key={app.id} className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{app.icon || '⚙️'}</span>
              <div>
                <p className="font-semibold">{app.name}</p>
                <p className="text-xs text-muted-foreground">{app.description}</p>
              </div>
            </div>
            <Switch checked={!!app.enabled} onCheckedChange={(v) => toggle(app, v)} />
          </div>
          {app.code === 'google_oauth' && app.enabled && (
            <p className="text-xs p-2 rounded bg-amber-500/10 text-amber-800">
              Configure em PocketBase Admin → Settings → Auth providers → Google. Adicione o redirect URL: <code className="font-mono">http://127.0.0.1:8090/api/oauth2-redirect</code>
            </p>
          )}
          {app.code === 'google_drive' && app.enabled && (
            <DriveConfigForm app={app} onSave={saveConfig} />
          )}
          {app.code === 'whatsapp_business' && app.enabled && (
            <WhatsAppBusinessConfigForm app={app} onSave={saveConfig} />
          )}
          {app.code !== 'google_drive' && app.code !== 'whatsapp_business' && (
            <div className="space-y-2">
              <Label className="text-xs">Configuração JSON (opcional)</Label>
              <Textarea
                rows={2}
                defaultValue={JSON.stringify(app.config || {}, null, 2)}
                className="font-mono text-xs"
                onBlur={(e) => saveConfig(app, e.target.value)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
