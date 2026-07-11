import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Users, Phone, Mail, Search, MessageSquare, Plus, Trash2, Calendar, User, Clock, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebaseClient';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { displayAngolaPhone } from '@/lib/angolaPhone';

export default function CRMContactsTab() {
  const { toast } = useToast();
  const [contactsData, setContactsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Note creation form states
  const [newNote, setNewNote] = useState('');
  const [interactionType, setInteractionType] = useState('Telefonema');
  const [savingNote, setSavingNote] = useState(false);

  const loadCRMData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get all users from Firestore users collection
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push(doc.data());
      });

      // 2. Fetch contacts and interactions for each user
      const fullList = [];
      for (const u of usersList) {
        if (!u.uid) continue;
        try {
          const contactsDoc = await getDoc(doc(db, 'users', u.uid, 'googleData', 'contacts'));
          const interactionsDoc = await getDoc(doc(db, 'users', u.uid, 'googleData', 'interactions'));
          
          const contacts = contactsDoc.exists() ? contactsDoc.data().data || [] : [];
          const interactions = interactionsDoc.exists() ? interactionsDoc.data().notes || [] : [];

          // Add metadata to each contact to identify who synced it
          contacts.forEach(c => {
            fullList.push({
              ...c,
              syncedByUid: u.uid,
              syncedByEmail: u.email,
              syncedByName: u.displayName || u.email.split('@')[0],
              interactions: interactions.filter(note => note.contactEmail === c.email || (c.phone && note.contactPhone === c.phone))
            });
          });
        } catch (err) {
          console.error(`Error loading CRM data for user ${u.uid}:`, err);
        }
      }

      // De-duplicate contacts by email/phone while merging interactions
      const uniqueContactsMap = new Map();
      fullList.forEach(c => {
        const key = c.email !== 'Sem Email' ? c.email : c.phone || c.name;
        if (uniqueContactsMap.has(key)) {
          const existing = uniqueContactsMap.get(key);
          // Merge interactions
          existing.interactions = [...new Set([...existing.interactions, ...c.interactions])];
        } else {
          uniqueContactsMap.set(key, c);
        }
      });

      setContactsData(Array.from(uniqueContactsMap.values()));
    } catch (err) {
      console.error('Failed to load CRM Contacts:', err);
      toast({
        variant: 'destructive',
        title: 'Erro CRM',
        description: 'Não foi possível ler os contactos e interações sincronizadas.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCRMData();
  }, [loadCRMData]);

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedContact) return;

    setSavingNote(true);
    try {
      const timestamp = new Date().toISOString();
      const noteObj = {
        id: Math.random().toString(36).substring(2, 9),
        contactEmail: selectedContact.email,
        contactPhone: selectedContact.phone || '',
        type: interactionType,
        text: newNote,
        date: timestamp,
        agentName: 'Administrador'
      };

      // Find the user context under which this contact is synced
      const targetUid = selectedContact.syncedByUid;
      if (!targetUid) throw new Error('Contacto sem vínculo de utilizador');

      // Fetch existing interactions for this user
      const docRef = doc(db, 'users', targetUid, 'googleData', 'interactions');
      const docSnap = await getDoc(docRef);
      const existingNotes = docSnap.exists() ? docSnap.data().notes || [] : [];

      // Save updated notes list
      const updatedNotes = [noteObj, ...existingNotes];
      await setDoc(docRef, { notes: updatedNotes }, { merge: true });

      // Update local state
      const updatedContact = {
        ...selectedContact,
        interactions: [noteObj, ...selectedContact.interactions]
      };
      setSelectedContact(updatedContact);
      setContactsData(prev => prev.map(c => {
        const key = c.email !== 'Sem Email' ? c.email : c.phone;
        const selKey = selectedContact.email !== 'Sem Email' ? selectedContact.email : selectedContact.phone;
        if (key === selKey) return updatedContact;
        return c;
      }));

      setNewNote('');
      toast({
        title: 'Interação Guardada',
        description: 'Interação de cliente adicionada com sucesso ao Firestore!',
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro CRM',
        description: 'Não foi possível guardar a interação no Firestore.',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleWhatsAppContact = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const num = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone.replace(/^0/, '')}`;
    window.open(`https://wa.me/${num}?text=Olá! Entramos em contacto da Livraria Adventista para acompanhar a sua solicitação.`, '_blank');
  };

  // Filter contacts list
  const filteredContacts = contactsData.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || 
           c.email.toLowerCase().includes(q) || 
           (c.phone && c.phone.toLowerCase().includes(q)) ||
           c.syncedByName.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#0ea5c9] mb-4" />
        <p className="text-muted-foreground text-sm">A carregar contactos e interações CRM do Firestore...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">CRM · Gestão Centralizada de Interações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie e acompanhe interações comerciais de clientes importados dos Contactos Google dos utilizadores do sistema.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Contact list panel */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email, telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-background"
            />
          </div>

          <div className="border rounded-xl bg-card overflow-hidden max-h-[550px] overflow-y-auto divide-y">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                Nenhum contacto de cliente sincronizado encontrado.
              </div>
            ) : (
              filteredContacts.map((contact, idx) => {
                const isSelected = selectedContact && (
                  contact.email !== 'Sem Email' 
                    ? contact.email === selectedContact.email 
                    : contact.phone === selectedContact.phone
                );
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedContact(contact);
                      setNewNote('');
                    }}
                    className={`p-3.5 cursor-pointer transition-all text-left flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-[#0ea5c9]/10 border-l-4 border-[#0ea5c9]' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {contact.photo ? (
                        <img src={contact.photo} alt={contact.name} className="h-9 w-9 rounded-full object-cover border" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold uppercase">
                          {contact.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-foreground">{contact.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                        {contact.phone && contact.phone !== 'Sem Telefone' && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{displayAngolaPhone(contact.phone)}</p>
                        )}
                        <span className="inline-block text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground mt-1">
                          Via: {contact.syncedByName}
                        </span>
                      </div>
                    </div>
                    {contact.interactions?.length > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold flex items-center justify-center border border-emerald-500/20">
                        {contact.interactions.length}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CRM Detail panel */}
        <div className="md:col-span-3">
          {selectedContact ? (
            <div className="border rounded-xl p-5 md:p-6 bg-card space-y-6">
              {/* Contact Header info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-4 text-left">
                  {selectedContact.photo ? (
                    <img src={selectedContact.photo} alt={selectedContact.name} className="h-12 w-12 rounded-full object-cover border-2 border-primary/20" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-[#0ea5c9]/10 text-[#0ea5c9] flex items-center justify-center text-lg font-bold border">
                      {selectedContact.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-base text-foreground">{selectedContact.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 text-[#0ea5c9]" /> {selectedContact.email}
                    </p>
                    {selectedContact.phone && selectedContact.phone !== 'Sem Telefone' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-[#0ea5c9]" /> {displayAngolaPhone(selectedContact.phone)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedContact.phone && selectedContact.phone !== 'Sem Telefone' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWhatsAppContact(selectedContact.phone)}
                      className="text-emerald-600 hover:bg-emerald-50 border-emerald-500/30 text-xs"
                    >
                      <svg className="h-3.5 w-3.5 mr-1.5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.42 9.863-9.864.002-2.634-1.02-5.11-2.881-6.973C16.69 1.904 14.212.861 11.58.861 6.143.861 1.72 5.281 1.716 10.72c-.001 1.67.438 3.3 1.27 4.733l-.988 3.61 3.702-.97.647.386zM17.16 14.93c-.29-.145-1.716-.847-1.982-.944-.265-.097-.459-.145-.652.145-.193.29-.747.944-.915 1.137-.168.193-.336.218-.626.073-1.638-.818-2.735-1.424-3.82-3.284-.287-.492.287-.457.822-1.52.09-.18.045-.337-.023-.482-.068-.145-.652-1.572-.893-2.152-.234-.564-.472-.488-.652-.497-.169-.008-.362-.01-.555-.01s-.506.072-.77.362c-.265.29-1.012.99-1.012 2.415 0 1.424 1.036 2.801 1.18 2.995.145.193 2.038 3.112 4.937 4.364 2.188.944 3.1 1.054 4.225.888.755-.112 2.327-.95 2.658-1.87.33-.92.33-1.71.233-1.87-.097-.16-.36-.255-.65-.4z" />
                      </svg>
                      WhatsApp
                    </Button>
                  )}
                  {selectedContact.email && selectedContact.email !== 'Sem Email' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`mailto:${selectedContact.email}?subject=Contacto - Livraria Adventista`, '_blank')}
                      className="text-[#0ea5c9] hover:bg-cyan-50 border-cyan-500/30 text-xs"
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Email
                    </Button>
                  )}
                </div>
              </div>

              {/* Log/Create interaction */}
              <div className="bg-muted/30 border p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-[#0ea5c9]" /> Registar Nova Interação
                </h4>
                <form onSubmit={handleAddInteraction} className="space-y-3 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="inter-type" className="text-[11px] font-semibold">Tipo</Label>
                      <select
                        id="inter-type"
                        value={interactionType}
                        onChange={(e) => setInteractionType(e.target.value)}
                        className="w-full text-xs rounded-md border border-input bg-background h-8 px-2"
                      >
                        <option value="Telefonema">📞 Telefonema</option>
                        <option value="WhatsApp">💬 WhatsApp</option>
                        <option value="E-mail">✉️ E-mail</option>
                        <option value="Presencial">👤 Presencial</option>
                        <option value="Outro">⚙️ Outro</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Sincronizado por</Label>
                      <Input value={selectedContact.syncedByName} disabled className="h-8 text-xs bg-muted/50" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inter-notes" className="text-[11px] font-semibold">Notas de Interação</Label>
                    <Textarea
                      id="inter-notes"
                      rows={2}
                      placeholder="Ex: Cliente interessado no novo livro do Ellen White. Prometeu comprar no final do mês."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="text-xs resize-none bg-background"
                    />
                  </div>
                  <Button type="submit" disabled={savingNote || !newNote.trim()} className="w-full h-8 text-xs bg-[#0ea5c9] hover:bg-[#0ea5c9]/90 text-white font-semibold">
                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    Salvar no CRM Firestore
                  </Button>
                </form>
              </div>

              {/* Interaction History List */}
              <div className="space-y-3 text-left">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Histórico de Acompanhamento ({selectedContact.interactions?.length || 0})
                </h4>

                {(!selectedContact.interactions || selectedContact.interactions.length === 0) ? (
                  <div className="text-center py-8 border border-dashed rounded-xl text-xs text-muted-foreground">
                    Sem interações registadas para este cliente. Utilize o formulário acima para adicionar o primeiro acompanhamento.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {selectedContact.interactions.map((note) => (
                      <div key={note.id || Math.random()} className="border rounded-lg p-3 bg-muted/10 hover:bg-muted/20 transition-colors space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-semibold">
                          <span className="bg-[#0ea5c9]/10 text-[#0ea5c9] px-2 py-0.5 rounded-full">
                            {note.type}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(note.date).toLocaleString('pt-AO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-normal leading-relaxed">
                          {note.text}
                        </p>
                        <p className="text-[9px] text-muted-foreground text-right">
                          Registado por: <strong>{note.agentName || 'Agente'}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center bg-muted/5 min-h-[400px]">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-bold text-sm text-muted-foreground">Nenhum Contacto Seleccionado</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Seleccione um contacto na barra lateral para carregar o seu perfil comercial, enviar mensagens directas e gerir notas de CRM no Firestore.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
