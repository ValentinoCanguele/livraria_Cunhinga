import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithGoogleWorkspace,
  logoutGoogleWorkspace,
  initGoogleAuth,
  listDriveFiles,
  uploadDriveFile,
  deleteDriveFile,
  listCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  listGmailMessages,
  sendGmailMessage,
  listGoogleContacts,
} from '@/lib/googleAuth';
import {
  FolderOpen, Calendar, Mail, Users, File, Trash2, Plus, LogOut,
  Send, User, Clock, Search, ArrowRight, UploadCloud, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import ContactsManager from '@/components/ContactsManager';

const GoogleWorkspaceHub = () => {
  const { toast } = useToast();
  const [googleUser, setGoogleUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Tab states: 'drive', 'calendar', 'gmail', 'contacts'
  const [subTab, setSubTab] = useState('drive');

  // Loading states
  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Data states
  const [driveFiles, setDriveFiles] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [gmailMessages, setGmailMessages] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Form states
  const [newEvent, setNewEvent] = useState({ title: '', description: '', start: '', end: '' });
  const [newMail, setNewMail] = useState({ to: '', subject: '', body: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, cachedToken) => {
        setGoogleUser(user);
        setToken(cachedToken);
        setLoadingAuth(false);
      },
      () => {
        setGoogleUser(null);
        setToken(null);
        setLoadingAuth(false);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Dados do separador activo, lidos directamente das APIs do Google
  const fetchData = async (currentSubTab = subTab) => {
    setLoadingData(true);
    try {
      if (!token) throw new Error('Sem sessão Google');
      if (currentSubTab === 'drive') setDriveFiles(await listDriveFiles(token));
      else if (currentSubTab === 'calendar') setCalendarEvents(await listCalendarEvents(token));
      else if (currentSubTab === 'gmail') setGmailMessages(await listGmailMessages(token));
      else if (currentSubTab === 'contacts') setContacts(await listGoogleContacts(token));
    } catch (err) {
      if (token) console.warn(`Não foi possível carregar ${currentSubTab}:`, err);
      if (currentSubTab === 'drive') setDriveFiles([]);
      else if (currentSubTab === 'calendar') setCalendarEvents([]);
      else if (currentSubTab === 'gmail') setGmailMessages([]);
      else if (currentSubTab === 'contacts') setContacts([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData(subTab);
  }, [token, subTab]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res) {
        setGoogleUser(res.user);
        setToken(res.token);
        toast({ title: 'Conectado com Sucesso', description: 'A sua conta Google foi integrada na Livraria!' });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Falha na Ligação',
        description: err.message || 'Erro ao conectar à conta Google.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmLogout = window.confirm('Deseja realmente desconectar a sua conta Google deste dispositivo? Os acessos em memória serão apagados.');
    if (!confirmLogout) return;

    try {
      await logoutGoogleWorkspace();
      setGoogleUser(null);
      setToken(null);
      setDriveFiles([]);
      setCalendarEvents([]);
      setGmailMessages([]);
      setContacts([]);
      setIsArchivedMode(false);
      toast({ title: 'Desconectado', description: 'A sua sessão Google foi encerrada.' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsAppContact = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Google Drive Handlers
  const handleFileUpload = async (file) => {
    if (!file || !token) return;
    setActionLoading(true);
    try {
      await uploadDriveFile(token, file);
      toast({ title: 'Ficheiro Carregado', description: `O ficheiro "${file.name}" foi guardado no seu Google Drive.` });
      fetchData('drive');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro de Carregamento', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleFileDelete = async (fileId, fileName) => {
    const confirmed = window.confirm(`Tem a certeza de que deseja eliminar definitivamente o ficheiro "${fileName}" do seu Google Drive? Esta acção não pode ser desfeita.`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteDriveFile(token, fileId);
      toast({ title: 'Ficheiro Eliminado', description: 'Ficheiro removido do Google Drive.' });
      fetchData('drive');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Google Calendar Handlers
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.start || !newEvent.end) {
      toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Preencha o título, data de início e término.' });
      return;
    }

    const confirmed = window.confirm(`Deseja adicionar o evento "${newEvent.title}" ao seu Google Calendário?`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const event = {
        summary: newEvent.title,
        description: newEvent.description,
        start: { dateTime: new Date(newEvent.start).toISOString() },
        end: { dateTime: new Date(newEvent.end).toISOString() }
      };
      await createCalendarEvent(token, event);
      toast({ title: 'Evento Adicionado', description: 'O seu calendário foi actualizado.' });
      setNewEvent({ title: '', description: '', start: '', end: '' });
      fetchData('calendar');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao Criar Evento', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId, eventTitle) => {
    const confirmed = window.confirm(`Tem a certeza de que deseja eliminar o evento "${eventTitle}" do seu Google Calendário?`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteCalendarEvent(token, eventId);
      toast({ title: 'Evento Eliminado', description: 'O evento foi removido do seu calendário.' });
      fetchData('calendar');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Gmail Handlers
  const handleSendMail = async (e) => {
    e.preventDefault();
    if (!newMail.to || !newMail.subject || !newMail.body) {
      toast({ variant: 'destructive', title: 'Campos em falta', description: 'Preencha o destinatário, assunto e mensagem.' });
      return;
    }

    const confirmed = window.confirm(`Confirma o envio deste email para ${newMail.to}?`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await sendGmailMessage(token, newMail);
      toast({ title: 'Email Enviado', description: `A sua mensagem foi enviada para ${newMail.to}!` });
      setNewMail({ to: '', subject: '', body: '' });
      fetchData('gmail');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao Enviar', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter lists
  const startEmailToContact = (emailAddress) => {
    setNewMail({ to: emailAddress, subject: 'Contacto - Livraria Aurora', body: '' });
    setSubTab('gmail');
  };

  const filteredContacts = contacts.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDriveFiles = driveFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredEvents = calendarEvents.filter(ev => ev.summary?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGmail = gmailMessages.filter(msg => msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) || msg.from.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-background border rounded-2xl p-8 text-center shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-[#0ea5c9] mb-4" />
        <p className="text-muted-foreground font-medium">A validar estado dos serviços Google...</p>
      </div>
    );
  }

  // Google Connection Prompt
  if (!googleUser) {
    return (
      <div className="bg-background border border-muted/60 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="max-w-2xl mx-auto text-center space-y-6 py-4">
          <div className="h-16 w-16 rounded-2xl bg-[#0ea5c9]/10 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-[#0ea5c9]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sincronização com o Google Workspace</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ligue a sua conta Google para gerir os seus ficheiros no <strong>Google Drive</strong>,
              sincronizar eventos no <strong>Google Calendário</strong>, enviar/receber emails via <strong>Gmail</strong>
              e gerir os seus <strong>Google Contactos</strong> directamente na aplicação.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center pt-2">
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="gsi-material-button w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-3 border shadow-sm rounded-lg hover:bg-muted/10 transition-all duration-200"
            >
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '22px', height: '22px' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {actionLoading ? 'A conectar...' : 'Iniciar Sessão com Google'}
              </span>
            </button>
            <p className="text-[11px] text-muted-foreground mt-3">
              *A sessão é mantida em segurança na memória do dispositivo de acordo com os princípios de segurança.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background border rounded-2xl overflow-hidden shadow-sm">
      {/* Account Header */}
      <div className="p-5 md:p-6 bg-muted/20 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {googleUser.photoURL ? (
            <img src={googleUser.photoURL} alt="Google Avatar" className="h-10 w-10 rounded-full border border-primary/20 shadow-sm" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#0ea5c9]/10 flex items-center justify-center text-[#0ea5c9] border">
              <User className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-bold text-foreground text-sm sm:text-base">{googleUser.displayName || 'Utilizador Google'}</p>
            <p className="text-xs text-muted-foreground">{googleUser.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!token && (
            <Button variant="default" size="sm" onClick={handleConnect} className="bg-[#0ea5c9] hover:bg-[#0ea5c9]/90 text-white h-9">
              <svg className="h-4 w-4 mr-1.5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sincronizar Google Workspace
            </Button>
          )}
          {token && (
            <Button variant="outline" size="sm" onClick={() => fetchData(subTab)} disabled={loadingData} className="h-9">
              {loadingData ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Sincronizar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9">
            <LogOut className="h-4 w-4 mr-1" /> Terminar
          </Button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="border-b px-4 bg-muted/5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex space-x-1 py-2 overflow-x-auto">
          <Button
            variant={subTab === 'drive' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('drive')}
            className={`rounded-lg px-3 py-2 text-xs font-medium h-9 ${subTab === 'drive' ? 'bg-[#0ea5c9]/10 text-[#0ea5c9] hover:bg-[#0ea5c9]/15' : ''}`}
          >
            <FolderOpen className="h-4 w-4 mr-1.5" /> Google Drive
          </Button>
          <Button
            variant={subTab === 'calendar' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('calendar')}
            className={`rounded-lg px-3 py-2 text-xs font-medium h-9 ${subTab === 'calendar' ? 'bg-[#0ea5c9]/10 text-[#0ea5c9] hover:bg-[#0ea5c9]/15' : ''}`}
          >
            <Calendar className="h-4 w-4 mr-1.5" /> Calendário
          </Button>
          <Button
            variant={subTab === 'gmail' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('gmail')}
            className={`rounded-lg px-3 py-2 text-xs font-medium h-9 ${subTab === 'gmail' ? 'bg-[#0ea5c9]/10 text-[#0ea5c9] hover:bg-[#0ea5c9]/15' : ''}`}
          >
            <Mail className="h-4 w-4 mr-1.5" /> Gmail
          </Button>
          <Button
            variant={subTab === 'contacts' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('contacts')}
            className={`rounded-lg px-3 py-2 text-xs font-medium h-9 ${subTab === 'contacts' ? 'bg-[#0ea5c9]/10 text-[#0ea5c9] hover:bg-[#0ea5c9]/15' : ''}`}
          >
            <Users className="h-4 w-4 mr-1.5" /> Contactos
          </Button>
        </div>

        {/* Global Hub Search Bar */}
        <div className="relative w-full sm:w-48 md:w-64 mb-2 sm:mb-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="p-5 md:p-6 min-h-[350px]">
        {loadingData && subTab !== 'contacts' ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9] mb-3" />
            <p className="text-xs text-muted-foreground">A sincronizar dados da API do Google...</p>
          </div>
        ) : (
          <>
            {/* Google Drive Sub-tab */}
            {subTab === 'drive' && (
              <div className="space-y-6">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-[#0ea5c9] bg-[#0ea5c9]/5' : 'border-muted/80 hover:border-[#0ea5c9]/60 hover:bg-muted/5'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    className="hidden"
                  />
                  <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-semibold">Carregar novo ficheiro para o Google Drive</p>
                  <p className="text-xs text-muted-foreground mt-1">Arraste e solte o ficheiro aqui ou clique para seleccionar</p>
                </div>

                {/* Drive File List */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                    <File className="h-4 w-4 text-muted-foreground" />
                    Os Meus Ficheiros ({filteredDriveFiles.length})
                  </h3>

                  {filteredDriveFiles.length === 0 ? (
                    <div className="text-center py-10 bg-muted/10 border rounded-xl">
                      <p className="text-sm text-muted-foreground">Nenhum ficheiro encontrado no Google Drive.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filteredDriveFiles.map((file) => (
                        <div key={file.id} className="border rounded-xl p-4 flex items-start justify-between bg-card hover:border-[#0ea5c9]/30 transition-all shadow-sm">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                              <File className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate pr-2">{file.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Modificado: {new Date(file.modifiedTime).toLocaleDateString('pt-AO')}
                              </p>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-[#0ea5c9] hover:underline font-medium inline-flex items-center gap-0.5 mt-1"
                                >
                                  Ver no Drive <ArrowRight className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleFileDelete(file.id, file.name)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Google Calendar Sub-tab */}
            {subTab === 'calendar' && (
              <div className="grid gap-6 md:grid-cols-5">
                {/* Add Event Form */}
                <div className="md:col-span-2 border rounded-xl p-5 bg-muted/5 h-fit space-y-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                    <Plus className="h-4 w-4" /> Adicionar Evento
                  </h3>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs">Título do Evento</Label>
                      <Input
                        id="title"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="Ex: Reunião com Fornecedor"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="desc" className="text-xs">Descrição</Label>
                      <Textarea
                        id="desc"
                        rows={2}
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Detalhes adicionais..."
                        className="text-xs resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="start" className="text-xs">Data de Início</Label>
                        <Input
                          id="start"
                          type="datetime-local"
                          value={newEvent.start}
                          onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                          className="h-9 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="end" className="text-xs">Data de Fim</Label>
                        <Input
                          id="end"
                          type="datetime-local"
                          value={newEvent.end}
                          onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                          className="h-9 text-xs px-2"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={actionLoading} className="w-full bg-[#0ea5c9] hover:bg-[#0ea5c9]/90 text-white h-9 text-xs font-semibold">
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Calendar className="h-3.5 w-3.5 mr-1.5" />}
                      Agendar Evento
                    </Button>
                  </form>
                </div>

                {/* Event Lists */}
                <div className="md:col-span-3 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Próximos Eventos ({filteredEvents.length})
                  </h3>

                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl bg-muted/10">
                      <p className="text-sm text-muted-foreground">Não tem eventos futuros agendados.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((ev) => (
                        <div key={ev.id} className="border rounded-xl p-4 flex items-center justify-between bg-card hover:border-[#0ea5c9]/30 transition-all shadow-sm">
                          <div className="min-w-0 pr-2">
                            <p className="text-sm font-bold truncate text-foreground">{ev.summary || '(Sem Título)'}</p>
                            {ev.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ev.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-medium">
                              <Clock className="h-3 w-3 text-[#0ea5c9]" />
                              <span>
                                {ev.start?.dateTime
                                  ? `${new Date(ev.start.dateTime).toLocaleDateString('pt-AO')} às ${new Date(ev.start.dateTime).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`
                                  : ev.start?.date || 'Não definida'}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEvent(ev.id, ev.summary)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gmail Sub-tab */}
            {subTab === 'gmail' && (
              <div className="grid gap-6 md:grid-cols-5">
                {/* Send Email Form */}
                <div className="md:col-span-2 border rounded-xl p-5 bg-muted/5 h-fit space-y-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                    <Send className="h-4 w-4" /> Enviar Mensagem
                  </h3>
                  <form onSubmit={handleSendMail} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="to" className="text-xs">Para (Email)</Label>
                      <Input
                        id="to"
                        type="email"
                        value={newMail.to}
                        onChange={(e) => setNewMail({ ...newMail, to: e.target.value })}
                        placeholder="cliente@exemplo.com"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subj" className="text-xs">Assunto</Label>
                      <Input
                        id="subj"
                        value={newMail.subject}
                        onChange={(e) => setNewMail({ ...newMail, subject: e.target.value })}
                        placeholder="Confirmação de Encomenda, etc."
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="body" className="text-xs">Mensagem (HTML ou texto)</Label>
                      <Textarea
                        id="body"
                        rows={5}
                        value={newMail.body}
                        onChange={(e) => setNewMail({ ...newMail, body: e.target.value })}
                        placeholder="Escreva a sua mensagem..."
                        className="text-xs resize-none"
                      />
                    </div>
                    <Button type="submit" disabled={actionLoading} className="w-full bg-[#0ea5c9] hover:bg-[#0ea5c9]/90 text-white h-9 text-xs font-semibold">
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      Enviar Email
                    </Button>
                  </form>
                </div>

                {/* Email Messages Inbox */}
                <div className="md:col-span-3 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-muted-foreground" /> Caixa de Entrada Recente ({filteredGmail.length})
                  </h3>

                  {filteredGmail.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl bg-muted/10">
                      <p className="text-sm text-muted-foreground">Não tem mensagens recentes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredGmail.map((msg) => (
                        <div key={msg.id} className="border rounded-xl p-4 bg-card hover:border-[#0ea5c9]/30 transition-all shadow-sm space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{msg.from}</p>
                              <p className="text-sm font-bold text-[#0ea5c9] truncate mt-0.5">{msg.subject}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                              {msg.date ? new Date(msg.date).toLocaleDateString('pt-AO') : ''}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 p-2 rounded-lg italic">
                            "{msg.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contactos — CRM local com sincronização Google */}
            {subTab === 'contacts' && (
              <div className="space-y-8">
              <ContactsManager
                googleToken={token}
                onOpenGmail={(email) => {
                  setNewMail({ to: email, subject: 'Novidades — Livraria Adventista', body: '' });
                  setSubTab('gmail');
                }}
              />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" /> Google Contactos ({filteredContacts.length})
                </h3>

                {filteredContacts.length === 0 ? (
                  <div className="text-center py-12 border rounded-xl bg-muted/10">
                    <p className="text-sm text-muted-foreground">Nenhum contacto sincronizado.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {filteredContacts.map((c, i) => (
                      <div key={i} className="border rounded-xl p-4 bg-card hover:border-[#0ea5c9]/30 transition-all shadow-sm flex items-center gap-3">
                        {c.photo ? (
                          <img src={c.photo} alt={c.name} className="h-10 w-10 rounded-full object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-[#0ea5c9]/10 flex items-center justify-center text-[#0ea5c9] border shrink-0">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                          {c.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{c.phone}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.phone && c.phone !== 'Sem Telefone' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleWhatsAppContact(c.phone)}
                              title="Conversar no WhatsApp"
                              className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 h-8 w-8 rounded-full"
                            >
                              <svg className="h-4 w-4 fill-current text-emerald-600" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.42 9.863-9.864.002-2.634-1.02-5.11-2.881-6.973C16.69 1.904 14.212.861 11.58.861 6.143.861 1.72 5.281 1.716 10.72c-.001 1.67.438 3.3 1.27 4.733l-.988 3.61 3.702-.97.647.386zM17.16 14.93c-.29-.145-1.716-.847-1.982-.944-.265-.097-.459-.145-.652.145-.193.29-.747.944-.915 1.137-.168.193-.336.218-.626.073-1.638-.818-2.735-1.424-3.82-3.284-.287-.492.287-.457.822-1.52.09-.18.045-.337-.023-.482-.068-.145-.652-1.572-.893-2.152-.234-.564-.472-.488-.652-.497-.169-.008-.362-.01-.555-.01s-.506.072-.77.362c-.265.29-1.012.99-1.012 2.415 0 1.424 1.036 2.801 1.18 2.995.145.193 2.038 3.112 4.937 4.364 2.188.944 3.1 1.054 4.225.888.755-.112 2.327-.95 2.658-1.87.33-.92.33-1.71.233-1.87-.097-.16-.36-.255-.65-.4z" />
                              </svg>
                            </Button>
                          )}
                          {c.email && c.email !== 'Sem Email' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEmailToContact(c.email)}
                              title="Enviar Email via Gmail"
                              className="text-[#0ea5c9] hover:bg-[#0ea5c9]/10 h-8 w-8 shrink-0 rounded-full"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleWorkspaceHub;
