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
];

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
        if (!hasDrive) {
          const driveDef = DEFAULT_APPS.find((a) => a.code === 'google_drive');
          await pb.collection('app_integrations').create({ ...driveDef, enabled: false, config: driveDef.config || {} });
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
          {app.code !== 'google_drive' && (
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
