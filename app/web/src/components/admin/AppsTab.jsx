import React, { useState, useEffect, useCallback } from 'react';
import { 
  Loader2, Mail, MessageSquare, Terminal, CheckCircle2, XCircle, MinusCircle,
  Trash2, RefreshCw, Search, Play, Check, Shield, Activity, Save, Key, Smartphone, BookOpen, ExternalLink
} from 'lucide-react';
import pb from '@/lib/dataClient';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { testWhatsAppApi, testEmailApi } from '@/lib/messaging';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import PhoneInput from '@/components/PhoneInput';

// Estado de cada envio, tal como a Edge Function "app" o grava em notification_logs.
const LOG_STATUS = {
  sent: { label: 'Enviado', icon: CheckCircle2, badge: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  failed: { label: 'Falhou', icon: XCircle, badge: 'bg-red-500/10 text-red-600', dot: 'bg-red-400', text: 'text-red-400' },
  skipped: { label: 'Não enviado', icon: MinusCircle, badge: 'bg-amber-500/10 text-amber-700', dot: 'bg-amber-400', text: 'text-amber-400' },
};

const LOG_CONTEXT = {
  order: 'Encomenda',
  receipt: 'Recibo',
  test: 'Teste',
  contact: 'Contacto',
  campaign: 'Campanha',
  account: 'Conta',
};

const DEFAULT_APPS = [
  { name: 'Google OAuth', code: 'google_oauth', description: 'Login com conta Google — feito pelo Firebase Authentication', icon: '🔐' },
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
  {
    name: 'Envio de E-mail SMTP (Sem Gmail)',
    code: 'smtp_email',
    description: 'Notificações de confirmação de pedido via SMTP direto do servidor (sem depender das limitações do Gmail)',
    icon: '📧',
    config: { host: 'smtp.livrariaadventista.ao', port: 587, user: 'no-reply@livrariaadventista.ao', secure: false, fromName: 'Livraria Adventista Aurora' }
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

function SmtpConfigForm({ app, onSave }) {
  const cfg = app.config || {};
  const [host, setHost] = useState(cfg.host || 'smtp.livrariaadventista.ao');
  const [port, setPort] = useState(cfg.port || 587);
  const [user, setUser] = useState(cfg.user || 'no-reply@livrariaadventista.ao');
  const [fromName, setFromName] = useState(cfg.fromName || 'Livraria Adventista Aurora');
  const [secure, setSecure] = useState(!!cfg.secure);

  useEffect(() => {
    setHost(cfg.host || 'smtp.livrariaadventista.ao');
    setPort(cfg.port || 587);
    setUser(cfg.user || 'no-reply@livrariaadventista.ao');
    setFromName(cfg.fromName || 'Livraria Adventista Aurora');
    setSecure(!!cfg.secure);
  }, [app.id, cfg.host, cfg.port, cfg.user, cfg.fromName, cfg.secure]);

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/30 border text-sm grid md:grid-cols-2 gap-3">
      <div className="space-y-1.5 col-span-2">
        <p className="text-xs text-muted-foreground">
          Configure um servidor SMTP seguro para enviar e-mails transacionais aos clientes de forma autónoma e profissional.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Host SMTP</Label>
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.exemplo.com" className="text-xs font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Porta SMTP</Label>
        <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} placeholder="587" className="text-xs font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Utilizador / E-mail de Envio</Label>
        <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="encomendas@livraria.ao" className="text-xs font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Nome do Remetente</Label>
        <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Livraria Aurora" className="text-xs" />
      </div>
      <div className="flex items-center gap-2 pt-2 col-span-2">
        <Switch id="smtp-ssl" checked={secure} onCheckedChange={setSecure} />
        <Label htmlFor="smtp-ssl" className="text-xs cursor-pointer">Usar conexão SSL/TLS protegida (Porta 465)</Label>
      </div>
      <div className="col-span-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="bg-sky-600 hover:bg-sky-700 text-white"
          onClick={() => onSave(app, { host: host.trim(), port, user: user.trim(), fromName: fromName.trim(), secure })}
        >
          Guardar Configuração SMTP
        </Button>
      </div>
    </div>
  );
}

function WhatsAppConfigForm({ app, onSave }) {
  const cfg = app.config || {};
  const [phoneId, setPhoneId] = useState(cfg.phoneId || '108264935391054');
  const [templateNamespace, setTemplateNamespace] = useState(cfg.templateNamespace || 'livraria_aurora_templates');
  const [templateName, setTemplateName] = useState(cfg.templateName || 'confirmacao_pedido_ao');

  useEffect(() => {
    setPhoneId(cfg.phoneId || '108264935391054');
    setTemplateNamespace(cfg.templateNamespace || 'livraria_aurora_templates');
    setTemplateName(cfg.templateName || 'confirmacao_pedido_ao');
  }, [app.id, cfg.phoneId, cfg.templateNamespace, cfg.templateName]);

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/30 border text-sm grid md:grid-cols-2 gap-3">
      <div className="space-y-1.5 col-span-2">
        <p className="text-xs text-muted-foreground">
          Integração com o WhatsApp Business Cloud API Oficial da Meta para envio de alertas por templates autenticados.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Phone Number ID (Meta Developer)</Label>
        <Input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="10826..." className="text-xs font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Namespace dos Modelos (Templates)</Label>
        <Input value={templateNamespace} onChange={(e) => setTemplateNamespace(e.target.value)} placeholder="livraria_aurora_templates" className="text-xs font-mono" />
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label className="text-xs font-semibold">Nome do Modelo Oficial (Template Name)</Label>
        <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="confirmacao_pedido_ao" className="text-xs font-mono" />
      </div>
      <div className="col-span-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => onSave(app, { phoneId: phoneId.trim(), templateNamespace: templateNamespace.trim(), templateName: templateName.trim() })}
        >
          Guardar Configuração WhatsApp
        </Button>
      </div>
    </div>
  );
}

export default function AppsTab() {
  const { toast } = useToast();
  const { refresh: refreshIntegrations } = useIntegrations();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('apps'); // 'apps', 'logs'
  
  // Notification logs state
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [testingType, setTestingType] = useState(null); // 'email', 'whatsapp'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let list = await pb.collection('app_integrations').getFullList();
      
      // Auto provision any missing DEFAULT_APPS to support retrofitting
      let hasModified = false;
      for (const appDef of DEFAULT_APPS) {
        const found = list.some(a => a.code === appDef.code);
        if (!found) {
          await pb.collection('app_integrations').create({
            ...appDef,
            enabled: ['google_drive', 'whatsapp_business', 'smtp_email'].includes(appDef.code) ? false : true,
            config: appDef.config || {}
          });
          hasModified = true;
        }
      }

      if (hasModified) {
        list = await pb.collection('app_integrations').getFullList();
      }

      setApps(list);
    } catch (err) {
      console.warn('Failing to load from PocketBase, fallback to static defaults:', err);
      setApps(DEFAULT_APPS.map((a) => ({ ...a, enabled: true, id: a.code })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Registo de comunicações (tabela notification_logs no Supabase, escrita pela Edge Function).
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('Error loading notification logs:', e);
      toast({ variant: 'destructive', title: 'Erro de Leitura', description: 'Não foi possível carregar o registo de comunicações.' });
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'logs') {
      loadLogs();
    }
  }, [activeSubTab]);

  const toggle = async (app, enabled) => {
    try {
      if (app.id && app.id.length > 10) {
        await pb.collection('app_integrations').update(app.id, { enabled });
      }
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, enabled } : a)));
      await refreshIntegrations();
      toast({ title: enabled ? 'Funcionalidade Activada' : 'Funcionalidade Desactivada' });
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
      toast({ title: 'Configuração guardada com sucesso!' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro de validação', description: err.message });
    }
  };

  const clearAllLogs = async () => {
    if (!window.confirm('Tem a certeza de que deseja apagar todo o histórico de logs de notificações?')) return;
    try {
      // O Supabase exige um filtro em DELETE; "id <> ''" abrange todos os registos.
      const { error } = await supabase.from('notification_logs').delete().neq('id', '');
      if (error) throw error;
      setLogs([]);
      toast({ title: 'Limpeza Concluída', description: 'O registo de comunicações foi apagado.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: err.message });
    }
  };

  // Envio de teste real através da Edge Function; o resultado fica no registo.
  const runTestSend = async (type) => {
    if (!pb.authStore.token) {
      toast({ variant: 'destructive', title: 'Sessão expirada', description: 'Inicie sessão novamente para enviar um teste.' });
      return;
    }
    const isEmail = type === 'email';
    const target = window.prompt(
      isEmail ? 'Email que vai receber o teste:' : 'Número de WhatsApp que vai receber o teste (ex.: +244 923 000 000):',
      isEmail ? (pb.authStore.model?.email || '') : '',
    );
    if (!target || !target.trim()) return;

    setTestingType(type);
    try {
      const result = isEmail
        ? await testEmailApi(target.trim(), pb.authStore.token)
        : await testWhatsAppApi(target.trim(), pb.authStore.token);
      toast({ title: 'Teste enviado', description: result.message });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Teste falhou', description: err.message });
    } finally {
      setTestingType(null);
      await loadLogs();
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = logSearch.toLowerCase();
    return (
      (log.customer_name || '').toLowerCase().includes(searchLower) ||
      (log.recipient || '').toLowerCase().includes(searchLower) ||
      (log.order_number || '').toLowerCase().includes(searchLower) ||
      (log.type || '').toLowerCase().includes(searchLower) ||
      (log.status || '').toLowerCase().includes(searchLower)
    );
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;

  return (
    <div className="space-y-6">
      {/* Sub Tabs Toggle */}
      <div className="flex border-b border-border pb-1 gap-2">
        <button
          onClick={() => setActiveSubTab('apps')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'apps' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Configurações de APIs
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 relative ${
            activeSubTab === 'logs' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="h-4 w-4" />
          Monitor de Envio & Logs
          <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
            Novo
          </span>
        </button>
      </div>

      {activeSubTab === 'apps' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Active, desactive e configure as chaves de integração do sistema.</p>
          
          {apps.map((app) => (
            <div key={app.id} className="bg-card border rounded-xl p-5 space-y-4 shadow-xs hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 bg-muted rounded-xl">{app.icon || '⚙️'}</span>
                  <div>
                    <p className="font-bold text-sm md:text-base text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground max-w-xl">{app.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!app.enabled} onCheckedChange={(v) => toggle(app, v)} id={`switch-${app.code}`} />
                </div>
              </div>

              {app.enabled && (
                <div className="pt-2 border-t border-border mt-2 animate-fadeIn">
                  {app.code === 'google_oauth' && (
                    <p className="text-xs p-3 rounded-lg bg-amber-500/10 text-amber-800 border border-amber-500/20 max-w-2xl leading-relaxed">
                      O login com Google é feito pelo Firebase Authentication.<br />
                      Adicione o domínio do site em Firebase Console → Authentication → Settings → <code className="font-mono bg-amber-500/10 px-1 py-0.5 rounded">Authorized domains</code>.
                    </p>
                  )}

                  {app.code === 'google_drive' && (
                    <DriveConfigForm app={app} onSave={saveConfig} />
                  )}

                  {app.code === 'smtp_email' && (
                    <SmtpConfigForm app={app} onSave={saveConfig} />
                  )}

                  {app.code === 'whatsapp_business' && (
                    <WhatsAppBusinessConfigForm app={app} onSave={saveConfig} />
                  )}

                  {/* Fallback for JSON configs for other modules */}
                  {!['google_drive', 'smtp_email', 'whatsapp_business', 'google_oauth'].includes(app.code) && (
                    <div className="space-y-2 max-w-2xl">
                      <Label className="text-xs font-semibold">Configuração Adicional (JSON)</Label>
                      <Textarea
                        rows={2}
                        defaultValue={JSON.stringify(app.config || {}, null, 2)}
                        className="font-mono text-xs bg-muted/20"
                        onBlur={(e) => saveConfig(app, e.target.value)}
                        placeholder="{}"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Logs tab */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="space-y-1">
              <h3 className="font-bold text-sm md:text-base text-foreground">Relatório de Comunicações em Tempo Real</h3>
              <p className="text-xs text-muted-foreground">Histórico real de emails e mensagens WhatsApp enviados pelo servidor (últimos 50).</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runTestSend('email')}
                disabled={!!testingType}
                className="text-xs font-semibold border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 flex items-center gap-1.5"
              >
                {testingType === 'email' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Testar Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runTestSend('whatsapp')}
                disabled={!!testingType}
                className="text-xs font-semibold border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center gap-1.5"
              >
                {testingType === 'whatsapp' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Testar WhatsApp API
              </Button>
              <Button variant="outline" size="icon" onClick={loadLogs} className="h-8 w-8" title="Recarregar logs">
                <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="destructive" size="sm" onClick={clearAllLogs} className="text-xs h-8">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar Logs
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Pesquisar por cliente, email ou número de pedido..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {loadingLogs ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-card">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2 stroke-[1.5]" />
              <p className="font-bold text-sm">Nenhum log encontrado</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">Os envios aparecem aqui depois de uma encomenda ou de um teste em "Testar Email" / "Testar WhatsApp API".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isEmail = log.type === 'email';
                const isExpanded = expandedLogId === log.id;
                const status = LOG_STATUS[log.status] || LOG_STATUS.skipped;
                const StatusIcon = status.icon;

                return (
                  <div key={log.id} className="border rounded-xl bg-card overflow-hidden hover:border-primary/40 transition-colors">
                    {/* Log Main Bar */}
                    <div 
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-lg text-white ${isEmail ? 'bg-sky-500' : 'bg-teal-500'}`}>
                          {isEmail ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs md:text-sm text-foreground">{log.customer_name || 'Cliente'}</p>
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold text-muted-foreground">
                              {log.order_number || 'Sem Pedido'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{log.recipient}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(log.created).toLocaleDateString('pt-AO')} às {new Date(log.created).toLocaleTimeString('pt-AO')}
                          </p>
                          <p className="text-[9px] text-[#0ea5c9] font-mono font-bold uppercase tracking-wider">
                            {LOG_CONTEXT[log.context] || log.context}{log.provider ? ` · ${log.provider}` : ''}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${status.badge}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Handshake Logs & Preview */}
                    {isExpanded && (
                      <div className="p-4 bg-muted/10 border-t border-border space-y-4 animate-fadeIn">
                        {/* Header details */}
                        <div className="grid sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Assunto / Endpoint</p>
                            <p className="font-bold text-foreground">{log.subject || (isEmail ? 'Sem assunto' : 'Mensagem WhatsApp')}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">ID do Registo</p>
                            <p className="font-mono text-muted-foreground break-all">{log.id}</p>
                          </div>
                        </div>

                        {/* Handshake Technical terminal */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground bg-slate-900 text-slate-200 px-3 py-1.5 rounded-t-lg font-mono">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="h-3.5 w-3.5 text-sky-400" />
                              {isEmail ? 'RESPOSTA DO SERVIDOR DE EMAIL' : 'RESPOSTA DA WHATSAPP CLOUD API'}
                            </span>
                            <span className={`text-[10px] font-extrabold flex items-center gap-1 ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                              {(log.status || '').toUpperCase()}
                            </span>
                          </div>
                          <pre className="p-4 bg-slate-950 text-slate-200 rounded-b-lg text-[10.5px] font-mono leading-relaxed overflow-x-auto border border-slate-800 whitespace-pre-wrap max-h-60 shadow-inner">
                            {log.detail || 'Sem detalhes registados.'}
                          </pre>
                        </div>

                        {/* Visual Message Body content */}
                        <div className="space-y-1.5 border rounded-lg p-3.5 bg-background">
                          <p className="text-xs font-bold text-foreground border-b pb-1.5 mb-2 flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-[#0ea5c9]" />
                            Visualização do Conteúdo
                          </p>
                          {isEmail ? (
                            <div 
                              className="border rounded p-3 bg-white text-black text-xs overflow-auto max-h-80 shadow-xs"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.content) }}
                            />
                          ) : (
                            <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-100 text-xs text-slate-700 leading-relaxed max-w-md font-medium">
                              💬 <strong className="text-teal-900">WhatsApp Business:</strong> {log.content}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
