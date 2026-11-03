import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Search, RefreshCw, Download, Send, MessageCircle, Mail,
  Plus, Trash2, Edit2, Loader2, User, Tag, Bell, CalendarClock,
  ChevronRight, Check, UserPlus, Megaphone, Filter, Phone, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  listContacts, createContact, updateContact, deleteContact,
  syncContactsBatch, importContactsFromSources, getContactsStats,
  notifyContacts, runDueCampaigns, isCrmReady,
  listGroups, createGroup, updateGroup, deleteGroup,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  listNotifications,
  SOURCE_LABELS, CHANNEL_LABELS, FREQUENCY_LABELS
} from '@/api/ContactsApi';
import { listAllGoogleContacts, sendGmailMessage, getCachedGoogleToken } from '@/lib/googleAuth';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { fetchMessagingStatus, isWhatsAppApiActive } from '@/lib/messaging';
import { FloatingScrollTop } from '@/components/ui/FloatingScrollTop';
import { useAuth } from '@/hooks/useAuth';

const DEFAULT_NOTIFY_BODY = `Olá! 👋

Temos novidades na Livraria Adventista que podem interessar-lhe.

Visite a nossa loja online para descobrir os livros mais recentes:
https://livrariaadventista.ao/shop

Com carinho,
Equipa Livraria Adventista`;

// Contactos com esta etiqueta não recebem envios (o servidor também os ignora).
const OPT_OUT_TAG = 'nao-contactar';
const isOptedOut = (c) => Array.isArray(c?.tags) && c.tags.includes(OPT_OUT_TAG);
const MAX_NOTIFY_CONTACTS = 300;
const STATUS_LABELS = {
  sent: 'Enviado',
  manual: 'Link manual',
  failed: 'Falhou',
  pending: 'Pendente',
};

const ContactsManager = ({ googleToken = null, onOpenGmail = null }) => {
  const { toast } = useToast();
  const { isAdmin, hasPermission } = useAuth();
  const token = googleToken || getCachedGoogleToken();
  const canUseCrm = isCrmReady() && (isAdmin || hasPermission('manage_marketing') || hasPermission('manage_users'));

  const [activeTab, setActiveTab] = useState('contacts');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  const [contacts, setContacts] = useState([]);
  const [contactsMap, setContactsMap] = useState({});
  const [totalContacts, setTotalContacts] = useState(0);
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messagingStatus, setMessagingStatus] = useState(null);
  const contactsListRef = useRef(null);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', notes: '', tags: '', optOut: false });
  const [runningCampaigns, setRunningCampaigns] = useState(false);

  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [notifyGroupId, setNotifyGroupId] = useState('');
  const [notifyForm, setNotifyForm] = useState({
    channel: 'whatsapp',
    subject: 'Novidades — Livraria Adventista',
    body: DEFAULT_NOTIFY_BODY,
  });

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#0ea5c9' });

  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    group: '',
    channel: 'whatsapp',
    frequency: 'weekly',
    subject: 'Novidades — Livraria Adventista',
    message_template: DEFAULT_NOTIFY_BODY,
    include_new_books: true,
  });

  const loadContacts = useCallback(async () => {
    try {
      const res = await listContacts({ search, source: sourceFilter });
      setContacts(res.items);
      setTotalContacts(res.totalItems);
      const map = {};
      res.items.forEach((c) => { map[c.id] = c; });
      setContactsMap(map);
      setLoadError('');
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Erro ao carregar contactos';
      setLoadError(msg.includes('collection') || msg.includes('404')
        ? 'Base de dados CRM não encontrada. Aplique as migrações do Supabase (supabase/migrations).'
        : msg);
    }
  }, [search, sourceFilter]);

  const loadAll = useCallback(async () => {
    if (!canUseCrm) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const [statsRes, groupsRes, campaignsRes, notifRes, msgStatus] = await Promise.all([
        getContactsStats().catch(() => null),
        listGroups().catch(() => []),
        listCampaigns().catch(() => []),
        listNotifications({ perPage: 20 }).catch(() => ({ items: [] })),
        fetchMessagingStatus(true).catch(() => null),
      ]);
      setStats(statsRes);
      setGroups(groupsRes);
      setCampaigns(campaignsRes);
      setNotifications(notifRes.items || []);
      setMessagingStatus(msgStatus);
      await loadContacts();

    } catch (err) {
      setLoadError(err?.message || 'Erro ao inicializar CRM');
    } finally {
      setLoading(false);
    }
  }, [canUseCrm, loadContacts]);

  // As campanhas só correm quando alguém o pede (antes corriam ao abrir o separador).
  const dueCampaigns = campaigns.filter((c) => c.is_active && c.group && (!c.next_send_at || new Date(c.next_send_at).getTime() <= Date.now()));
  const handleRunDueCampaigns = async () => {
    if (!dueCampaigns.length) return;
    if (!window.confirm(`Enviar agora ${dueCampaigns.length} campanha(s) pendente(s) aos contactos dos respectivos grupos?`)) return;
    setRunningCampaigns(true);
    try {
      const due = await runDueCampaigns();
      toast({
        title: 'Campanhas enviadas',
        description: `${due?.processed || 0} campanha(s) processada(s), ${due?.notifications?.length || 0} mensagem(ns).`,
      });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao enviar campanhas', description: err.message });
    } finally {
      setRunningCampaigns(false);
    }
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const t = setTimeout(loadContacts, 300);
    return () => clearTimeout(t);
  }, [search, sourceFilter, loadContacts]);

  const handleSyncGoogle = async () => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Google não conectado', description: 'Conecte a conta Google no separador Workspace primeiro.' });
      return;
    }
    setActionLoading(true);
    setSyncProgress({ loaded: 0, page: 0 });
    try {
      const googleContacts = await listAllGoogleContacts(token, (p) => setSyncProgress({ loaded: p.loaded, page: p.page }));
      if (!googleContacts.length) {
        toast({ title: 'Sem contactos', description: 'Não foram encontrados contactos no Google.' });
        return;
      }
      const result = await syncContactsBatch(googleContacts, (p) => setSyncProgress({ loaded: p.done, total: p.total }));
      toast({
        title: 'Sincronização concluída',
        description: `${result.created} novos, ${result.updated} actualizados (${result.total} processados).`,
      });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: err.message });
    } finally {
      setActionLoading(false);
      setSyncProgress(null);
    }
  };

  const handleImportSources = async () => {
    setActionLoading(true);
    try {
      const result = await importContactsFromSources();
      toast({
        title: 'Importação concluída',
        description: `${result.created} novos, ${result.updated} actualizados de encomendas e newsletter.`,
      });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    setActionLoading(true);
    try {
      const data = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim(),
        notes: contactForm.notes.trim(),
        tags: (() => {
          const tags = (contactForm.tags ? contactForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
            .filter((t) => t !== OPT_OUT_TAG);
          return contactForm.optOut ? [...new Set([...tags, OPT_OUT_TAG])] : [...new Set(tags)];
        })(),
      };
      if (editingContact) {
        await updateContact(editingContact.id, data);
        toast({ title: 'Contacto actualizado' });
      } else {
        await createContact(data);
        toast({ title: 'Contacto criado' });
      }
      setShowContactForm(false);
      setEditingContact(null);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteContact = async (id, name) => {
    if (!window.confirm(`Eliminar o contacto "${name}"?`)) return;
    try {
      await deleteContact(id);
      toast({ title: 'Contacto eliminado' });
      if (selectedContact?.id === id) setSelectedContact(null);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) setSelectedIds([]);
    else setSelectedIds(contacts.map((c) => c.id));
  };

  const openNotifyDialog = (ids, groupId = '') => {
    const targetIds = ids || selectedIds;
    if (!targetIds.length) {
      toast({ variant: 'destructive', title: 'Seleccione contactos', description: 'Escolha pelo menos um contacto.' });
      return;
    }
    setSelectedIds(targetIds);
    setNotifyGroupId(groupId || '');
    setShowNotifyDialog(true);
  };

  const handleSendNotification = async () => {
    if ((notifyForm.body || '').trim().length < 5) {
      toast({ variant: 'destructive', title: 'Escreva a mensagem a enviar.' });
      return;
    }
    if (selectedIds.length > MAX_NOTIFY_CONTACTS) {
      toast({ variant: 'destructive', title: 'Demasiados destinatários', description: `Envie no máximo ${MAX_NOTIFY_CONTACTS} contactos de cada vez.` });
      return;
    }
    // Também filtrado aqui, para valer enquanto a Edge Function publicada for a antiga.
    const targets = selectedIds.filter((id) => !isOptedOut(contactsMap[id]));
    const optedOut = selectedIds.length - targets.length;
    if (!targets.length) {
      toast({ variant: 'destructive', title: 'Nenhum destinatário', description: 'Todos os contactos seleccionados estão marcados "não contactar".' });
      return;
    }
    setActionLoading(true);
    try {
      const result = await notifyContacts({
        contactIds: targets,
        channel: notifyForm.channel,
        subject: notifyForm.subject,
        body: notifyForm.body,
        groupId: notifyGroupId,
      });

      const waApiCount = result.results.filter((r) => r.whatsapp_api_sent).length;
      const manualWa = result.results.filter((r) => r.whatsapp_url && !r.whatsapp_api_sent);
      const emailCount = result.results.filter((r) => r.email_sent).length;

      if (manualWa.length === 1) {
        window.open(manualWa[0].whatsapp_url, '_blank', 'noopener,noreferrer');
      } else if (manualWa.length > 1) {
        toast({
          title: `${manualWa.length} links WhatsApp (modo manual)`,
          description: 'API não activa — abra cada contacto individualmente.',
        });
      }

      const parts = [
        `${result.results.length} notificação(ões) processada(s).`,
        waApiCount ? `${waApiCount} WhatsApp enviado(s) automaticamente.` : '',
        emailCount ? `${emailCount} email(s) enviado(s).` : '',
        (optedOut || result.skipped_opt_out) ? `${optedOut || result.skipped_opt_out} ignorado(s) por "não contactar".` : '',
      ].filter(Boolean);

      toast({ title: 'Notificação concluída', description: parts.join(' ') });
      setShowNotifyDialog(false);
      setNotifyGroupId('');
      setSelectedIds([]);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickWhatsApp = async (contact) => {
    if (isOptedOut(contact)) {
      toast({ variant: 'destructive', title: 'Contacto marcado "não contactar"', description: 'Retire a marca no contacto para lhe enviar mensagens.' });
      return;
    }
    if (!contact.phone) {
      toast({ variant: 'destructive', title: 'Sem telefone', description: 'Este contacto não tem número de telefone.' });
      return;
    }
    if (isWhatsAppApiActive(messagingStatus)) {
      setActionLoading(true);
      try {
        const result = await notifyContacts({
          contactIds: [contact.id],
          channel: 'whatsapp',
          subject: 'Novidades — Livraria Adventista',
          body: DEFAULT_NOTIFY_BODY,
        });
        const sent = result.results[0]?.whatsapp_api_sent;
        toast({
          title: sent ? 'WhatsApp enviado' : 'Falha no envio',
          description: sent ? `Mensagem enviada para ${contact.name}.` : 'Verifique a configuração da API.',
          variant: sent ? 'default' : 'destructive',
        });
        await loadAll();
      } catch (err) {
        toast({ variant: 'destructive', title: 'Erro', description: err.message });
      } finally {
        setActionLoading(false);
      }
      return;
    }
    const url = buildWhatsAppUrl(contact.phone, DEFAULT_NOTIFY_BODY);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleQuickEmail = (contact) => {
    if (!contact.email) {
      toast({ variant: 'destructive', title: 'Sem email', description: 'Este contacto não tem endereço de email.' });
      return;
    }
    if (onOpenGmail) {
      onOpenGmail(contact.email);
    } else if (token) {
      sendGmailMessage(token, {
        to: contact.email,
        subject: 'Novidades — Livraria Adventista',
        body: DEFAULT_NOTIFY_BODY.replace(/\n/g, '<br>'),
      }).then(() => toast({ title: 'Email enviado via Gmail' }))
        .catch((err) => toast({ variant: 'destructive', title: 'Erro', description: err.message }));
    } else {
      window.open(`mailto:${contact.email}?subject=${encodeURIComponent('Novidades — Livraria Adventista')}`, '_blank');
    }
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;
    setActionLoading(true);
    try {
      const data = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim(),
        color: groupForm.color,
        member_ids: editingGroup ? (editingGroup.member_ids || []) : selectedIds,
      };
      if (editingGroup) {
        await updateGroup(editingGroup.id, data);
        toast({ title: 'Grupo actualizado' });
      } else {
        await createGroup(data);
        toast({ title: 'Grupo criado', description: `${data.member_ids.length} contacto(s) adicionado(s).` });
        setSelectedIds([]);
      }
      setShowGroupForm(false);
      setEditingGroup(null);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToGroup = async (groupId) => {
    const group = groups.find((g) => g.id === groupId);
    const idsToAdd = selectedIds.length ? selectedIds : (selectedContact ? [selectedContact.id] : []);
    if (!group || !idsToAdd.length) return;
    const merged = [...new Set([...(group.member_ids || []), ...idsToAdd])];
    try {
      await updateGroup(groupId, { member_ids: merged });
      toast({ title: 'Adicionado ao grupo', description: `${idsToAdd.length} contacto(s) adicionado(s) a "${group.name}".` });
      setSelectedIds([]);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleDeleteGroup = async (id, name) => {
    if (!window.confirm(`Eliminar o grupo "${name}"?`)) return;
    try {
      await deleteGroup(id);
      toast({ title: 'Grupo eliminado' });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    if (!campaignForm.name.trim() || !campaignForm.group) return;
    setActionLoading(true);
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, campaignForm);
        toast({ title: 'Campanha actualizada' });
      } else {
        await createCampaign(campaignForm);
        toast({ title: 'Campanha criada', description: 'As actualizações serão enviadas automaticamente na frequência definida.' });
      }
      setShowCampaignForm(false);
      setEditingCampaign(null);
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCampaign = async (id, name) => {
    if (!window.confirm(`Eliminar a campanha "${name}"?`)) return;
    try {
      await deleteCampaign(id);
      toast({ title: 'Campanha eliminada' });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleToggleCampaign = async (camp) => {
    try {
      await updateCampaign(camp.id, { is_active: !camp.is_active });
      await loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const openEditContact = (c) => {
    setEditingContact(c);
    setContactForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      notes: c.notes || '',
      tags: (c.tags || []).filter((t) => t !== OPT_OUT_TAG).join(', '),
      optOut: isOptedOut(c),
    });
    setShowContactForm(true);
  };

  const openEditGroup = (g) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, description: g.description || '', color: g.color || '#0ea5c9' });
    setShowGroupForm(true);
  };

  const openEditCampaign = (c) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name,
      group: c.group || '',
      channel: c.channel || 'whatsapp',
      frequency: c.frequency || 'weekly',
      subject: c.subject || '',
      message_template: c.message_template || '',
      include_new_books: !!c.include_new_books,
    });
    setShowCampaignForm(true);
  };

  const getGroupMembers = (group) => {
    const ids = group.member_ids || [];
    return ids.map((id) => contactsMap[id]).filter(Boolean);
  };

  if (!canUseCrm) {
    return (
      <div className="border rounded-2xl p-8 text-center bg-muted/10 space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="font-semibold">Sessão administrativa necessária</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Precisa de permissões de administrador ou marketing para gerir contactos.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">A carregar CRM de contactos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Erro ao carregar CRM</p>
            <p className="text-muted-foreground mt-1">{loadError}</p>
          </div>
        </div>
      )}

      {messagingStatus && (
        <div className={`rounded-xl border p-3 text-sm flex flex-wrap items-center gap-2 ${isWhatsAppApiActive(messagingStatus) ? 'bg-green-500/5 border-green-500/30 text-green-800' : 'bg-amber-500/5 border-amber-500/30 text-amber-900'}`}>
          <MessageCircle className="h-4 w-4 shrink-0" />
          {isWhatsAppApiActive(messagingStatus) ? (
            <span><strong>WhatsApp Business API activa</strong> — envios automáticos sem abrir o browser.</span>
          ) : (
            <span><strong>Modo manual</strong> — configure WhatsApp Business em Admin → Apps para envio automático.</span>
          )}
          {messagingStatus.email?.enabled && (
            <Badge variant="secondary" className="text-[10px]">Email SMTP activo</Badge>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats?.total ?? totalContacts, icon: Users },
          { label: 'Google', value: stats?.google ?? 0, icon: RefreshCw },
          { label: 'Compradores', value: stats?.buyers ?? 0, icon: Tag },
          { label: 'Grupos', value: stats?.groups ?? groups.length, icon: UserPlus },
          { label: 'Campanhas', value: stats?.active_campaigns ?? 0, icon: Megaphone },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border rounded-xl p-4 bg-card text-center">
            <Icon className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSyncGoogle} disabled={actionLoading || !token} className="bg-primary hover:bg-[#0ea5c9]/90 text-white">
          {actionLoading && syncProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Sincronizar Google {syncProgress?.total ? `(${syncProgress.loaded || 0}/${syncProgress.total})` : syncProgress?.loaded ? `(${syncProgress.loaded})` : ''}
        </Button>
        <Button size="sm" variant="outline" onClick={loadAll} disabled={actionLoading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualizar
        </Button>
        <Button size="sm" variant="outline" onClick={handleImportSources} disabled={actionLoading}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Importar Encomendas/Newsletter
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setContactForm({ name: '', email: '', phone: '', notes: '', tags: '', optOut: false }); setShowContactForm(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Contacto
        </Button>
        {selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="secondary" onClick={() => openNotifyDialog()}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Notificar ({selectedIds.length})
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setEditingGroup(null); setGroupForm({ name: '', description: '', color: '#0ea5c9' }); setShowGroupForm(true); }}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Criar Grupo
            </Button>
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1.5" />Contactos ({totalContacts})</TabsTrigger>
          <TabsTrigger value="groups"><UserPlus className="h-4 w-4 mr-1.5" />Grupos ({groups.length})</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4 mr-1.5" />Campanhas ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="history"><Bell className="h-4 w-4 mr-1.5" />Histórico</TabsTrigger>
        </TabsList>

        {/* CONTACTOS */}
        <TabsContent value="contacts" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Pesquisar nome, email ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                </div>
                <Select value={sourceFilter || 'all'} onValueChange={(v) => setSourceFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-40 h-9 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Origem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas origens</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-9 text-xs">
                  {selectedIds.length === contacts.length && contacts.length ? <Check className="h-3 w-3 mr-1" /> : null}
                  {selectedIds.length === contacts.length && contacts.length ? 'Desmarcar' : 'Seleccionar todos'}
                </Button>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-16 border rounded-xl bg-muted/10">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                  <p className="font-medium text-muted-foreground">Nenhum contacto guardado</p>
                  <p className="text-sm text-muted-foreground mt-1">Sincronize com o Google ou importe de encomendas.</p>
                </div>
              ) : (
                <div ref={contactsListRef} className="space-y-2 max-h-[500px] overflow-y-auto pr-1 relative">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all hover:border-[#0ea5c9]/40 ${selectedContact?.id === c.id ? 'border-[#0ea5c9] bg-[#0ea5c9]/5' : ''} ${selectedIds.includes(c.id) ? 'ring-1 ring-[#0ea5c9]/30' : ''}`}
                      onClick={() => setSelectedContact(c)}
                    >
                      <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} onClick={(e) => e.stopPropagation()} />
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="h-9 w-9 rounded-full object-cover border shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-[#0ea5c9]/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{c.name}</p>
                          {c.is_buyer && <Badge variant="secondary" className="text-[10px] h-4">Comprador</Badge>}
                          {isOptedOut(c) && <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/40">Não contactar</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{c.email || '—'} · {c.phone || '—'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{SOURCE_LABELS[c.source] || c.source}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                  <FloatingScrollTop
                    mode="container"
                    containerRef={contactsListRef}
                    threshold={80}
                    positionClass="absolute bottom-3 right-3 z-10 scale-90"
                  />
                </div>
              )}
            </div>

            {/* Painel de detalhe */}
            <div className="lg:w-80 border rounded-xl p-5 bg-muted/5 h-fit sticky top-4">
              {selectedContact ? (
                <div className="space-y-4">
                  <div className="text-center">
                    {selectedContact.photo_url ? (
                      <img src={selectedContact.photo_url} alt="" className="h-16 w-16 rounded-full mx-auto border object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-[#0ea5c9]/10 flex items-center justify-center mx-auto">
                        <User className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <h3 className="font-bold mt-2">{selectedContact.name}</h3>
                    <Badge variant="outline" className="mt-1 text-[10px]">{SOURCE_LABELS[selectedContact.source]}</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {selectedContact.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{selectedContact.email}</span>
                      </div>
                    )}
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" /><span>{selectedContact.phone}</span>
                      </div>
                    )}
                    {selectedContact.notes && <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">{selectedContact.notes}</p>}
                    {(selectedContact.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedContact.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                    {selectedContact.last_contacted_at && (
                      <p className="text-[10px] text-muted-foreground">Último contacto: {new Date(selectedContact.last_contacted_at).toLocaleDateString('pt-AO')}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => handleQuickWhatsApp(selectedContact)} disabled={!selectedContact.phone}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleQuickEmail(selectedContact)} disabled={!selectedContact.email}>
                      <Mail className="h-3.5 w-3.5 mr-1" /> Email
                    </Button>
                    <Button size="sm" variant="secondary" className="text-xs col-span-2" onClick={() => openNotifyDialog([selectedContact.id])}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Enviar Notificação
                    </Button>
                  </div>

                  {groups.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Adicionar a grupo</Label>
                      <Select onValueChange={handleAddToGroup}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar grupo..." /></SelectTrigger>
                        <SelectContent>
                          {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({(g.member_ids || []).length})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => openEditContact(selectedContact)}>
                      <Edit2 className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => handleDeleteContact(selectedContact.id, selectedContact.name)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Seleccione um contacto</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* GRUPOS */}
        <TabsContent value="groups" className="mt-4">
          <div className="flex justify-between mb-4">
            <p className="text-sm text-muted-foreground">Agrupe contactos para envios periódicos automáticos.</p>
            <Button size="sm" onClick={() => { setEditingGroup(null); setGroupForm({ name: '', description: '', color: '#0ea5c9' }); setShowGroupForm(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Grupo
            </Button>
          </div>
          {groups.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-muted/10">
              <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nenhum grupo criado</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => {
                const members = getGroupMembers(g);
                return (
                  <div key={g.id} className="border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ background: g.color || '#0ea5c9' }} />
                          <h3 className="font-semibold text-sm">{g.name}</h3>
                          <Badge variant="outline" className="text-[10px]">{(g.member_ids || []).length} membros</Badge>
                        </div>
                        {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditGroup(g)} aria-label="Editar grupo" title="Editar grupo"><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGroup(g.id, g.name)} aria-label="Eliminar grupo" title="Eliminar grupo"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {members.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {members.slice(0, 5).map((m) => (
                          <Badge key={m.id} variant="secondary" className="text-[10px]">{m.name}</Badge>
                        ))}
                        {members.length > 5 && <Badge variant="outline" className="text-[10px]">+{members.length - 5}</Badge>}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8" onClick={() => openNotifyDialog(g.member_ids || [], g.id)}>
                      <Send className="h-3 w-3 mr-1" /> Notificar Grupo
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* CAMPANHAS */}
        <TabsContent value="campaigns" className="mt-4">
          <div className="flex justify-between mb-4">
            <p className="text-sm text-muted-foreground">Envios periódicos com novidades da loja. Quando chega a data, ficam pendentes até carregar em "Enviar pendentes".</p>
            <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" disabled={!dueCampaigns.length || runningCampaigns} onClick={handleRunDueCampaigns}>
              {runningCampaigns ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Enviar pendentes ({dueCampaigns.length})
            </Button>
            <Button size="sm" onClick={() => { setEditingCampaign(null); setCampaignForm({ name: '', group: '', channel: 'whatsapp', frequency: 'weekly', subject: 'Novidades — Livraria Adventista', message_template: DEFAULT_NOTIFY_BODY, include_new_books: true }); setShowCampaignForm(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova Campanha
            </Button>
            </div>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-muted/10">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nenhuma campanha activa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const group = groups.find((g) => g.id === c.group);
                return (
                  <div key={c.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{c.name}</h3>
                        <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">{c.is_active ? 'Activa' : 'Pausada'}</Badge>
                        <Badge variant="outline" className="text-[10px]">{FREQUENCY_LABELS[c.frequency]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[c.channel]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Grupo: {group?.name || '—'} · {(group?.member_ids || []).length} contactos
                        {c.next_send_at && ` · Próximo: ${new Date(c.next_send_at).toLocaleDateString('pt-AO')}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleToggleCampaign(c)}>
                        {c.is_active ? 'Pausar' : 'Activar'}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditCampaign(c)} aria-label="Editar campanha" title="Editar campanha"><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCampaign(c.id, c.name)} aria-label="Eliminar campanha" title="Eliminar campanha"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history" className="mt-4">
          {notifications.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-muted/10">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nenhuma notificação enviada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="border rounded-xl p-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{n.expand?.contact?.name || 'Contacto'}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.subject || n.body?.slice(0, 60)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[n.channel]}</Badge>
                    <Badge variant={n.status === 'sent' ? 'default' : n.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{STATUS_LABELS[n.status] || n.status}</Badge>
                    {n.whatsapp_url && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => window.open(n.whatsapp_url, '_blank', 'noopener,noreferrer')} aria-label="Abrir no WhatsApp" title="Abrir no WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Contacto */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingContact ? 'Editar Contacto' : 'Novo Contacto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveContact} className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Tags (separadas por vírgula)</Label><Input value={contactForm.tags} onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })} className="h-9 text-sm" /></div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={!!contactForm.optOut} onCheckedChange={(v) => setContactForm({ ...contactForm, optOut: !!v })} className="mt-0.5" />
              <span>
                Não contactar
                <span className="block text-[11px] text-muted-foreground">Pediu para não receber mensagens: fica fora dos envios e das campanhas.</span>
              </span>
            </label>
            <div><Label className="text-xs">Notas</Label><Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} className="text-sm" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowContactForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Notificação */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enviar Notificação ({selectedIds.length} contacto(s))</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={notifyForm.channel} onValueChange={(v) => setNotifyForm({ ...notifyForm, channel: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email (Gmail)</SelectItem>
                  <SelectItem value="both">WhatsApp + Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(notifyForm.channel === 'email' || notifyForm.channel === 'both') && (
              <div><Label className="text-xs">Assunto</Label><Input value={notifyForm.subject} onChange={(e) => setNotifyForm({ ...notifyForm, subject: e.target.value })} className="h-9 text-sm" /></div>
            )}
            <div><Label className="text-xs">Mensagem</Label><Textarea value={notifyForm.body} onChange={(e) => setNotifyForm({ ...notifyForm, body: e.target.value })} rows={6} className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNotifyDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendNotification} disabled={actionLoading} className="bg-primary hover:bg-[#0ea5c9]/90 text-white">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Grupo */}
      <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveGroup} className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} rows={2} className="text-sm" /></div>
            {!editingGroup && selectedIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedIds.length} contacto(s) seleccionado(s) serão adicionados.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowGroupForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={actionLoading}>Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Campanha */}
      <Dialog open={showCampaignForm} onOpenChange={setShowCampaignForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCampaign ? 'Editar Campanha' : 'Nova Campanha Automática'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveCampaign} className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} required className="h-9 text-sm" /></div>
            <div>
              <Label className="text-xs">Grupo *</Label>
              <Select value={campaignForm.group} onValueChange={(v) => setCampaignForm({ ...campaignForm, group: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar grupo..." /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({(g.member_ids || []).length})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={campaignForm.channel} onValueChange={(v) => setCampaignForm({ ...campaignForm, channel: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Frequência</Label>
                <Select value={campaignForm.frequency} onValueChange={(v) => setCampaignForm({ ...campaignForm, frequency: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={campaignForm.include_new_books} onCheckedChange={(v) => setCampaignForm({ ...campaignForm, include_new_books: !!v })} />
              <Label className="text-xs">Incluir automaticamente novos livros do catálogo</Label>
            </div>
            <div><Label className="text-xs">Mensagem</Label><Textarea value={campaignForm.message_template} onChange={(e) => setCampaignForm({ ...campaignForm, message_template: e.target.value })} rows={4} className="text-sm" /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCampaignForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={actionLoading}>Guardar Campanha</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactsManager;
