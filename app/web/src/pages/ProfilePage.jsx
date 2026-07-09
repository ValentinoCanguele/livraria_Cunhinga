import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Mail, Shield, ShoppingBag, Settings, LogOut, Loader2,
  Package, ChevronRight, Lock, BookOpen, LayoutDashboard, Truck, Phone,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';
import { pageTitle } from '@/lib/brand';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserAvatar from '@/components/UserAvatar';
import { getUserDisplayName } from '@/lib/userUtils';
import { getOrderStatusLabel, getOrderStatusColor, formatOrderNumber, PAYMENT_METHODS, getPaymentStatusLabel, getDeliveryStatusLabel, getDeliveryStatusColor } from '@/lib/orderUtils';
import { resolveOrderPaymentLabel } from '@/lib/paymentUtils';
import { displayAngolaPhone, formatAngolaPhone } from '@/lib/angolaPhone';
import PhoneInput from '@/components/PhoneInput';

const ProfilePage = () => {
  const { user, isAuthed, isAdmin, logout, updateProfile, changePassword, fetchUserOrders, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'orders');

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!isAuthed) navigate('/login');
  }, [isAuthed, navigate]);

  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab);
  }, [location.state?.tab]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone ? formatAngolaPhone(user.phone) : '');
    }
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user?.email) return;
    setLoadingOrders(true);
    try {
      const list = await fetchUserOrders(user.email);
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [user?.email, fetchUserOrders]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name, email, phone });
      toast({ title: 'Perfil atualizado' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'As passwords não coincidem' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Password deve ter pelo menos 8 caracteres' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast({ title: 'Password alterada com sucesso' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await updateAvatar(file);
      toast({ title: 'Foto actualizada' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <>
      <Helmet><title>{pageTitle('A Minha Conta')}</title></Helmet>
      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="min-h-screen bg-muted/20">
        <div className="container-custom py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {/* Cabeçalho do perfil */}
            <div className="bg-gradient-to-br from-[#0ea5c9]/10 via-background to-background border rounded-2xl p-6 md:p-8 mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <UserAvatar user={user} size="lg" className="h-20 w-20 text-2xl ring-4 ring-[#0ea5c9]/20" />
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold">{getUserDisplayName(user)}</h1>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" /> {user?.email}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#0ea5c9]/15 text-[#0ea5c9]">
                        <Shield className="h-3 w-3" /> Administrador
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      <User className="h-3 w-3" /> Membro desde {new Date(user?.created).toLocaleDateString('pt-AO')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {isAdmin && (
                    <Button asChild variant="outline" className="flex-1 sm:flex-none">
                      <Link to="/admin"><LayoutDashboard className="h-4 w-4 mr-2" /> Admin</Link>
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { logout(); navigate('/'); }}>
                    <LogOut className="h-4 w-4 mr-2" /> Sair
                  </Button>
                </div>
              </div>
            </div>

            {/* Atalhos rápidos */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Link to="/shop" className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:border-[#0ea5c9]/40 transition-colors group">
                <div className="h-10 w-10 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-[#0ea5c9]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Explorar Loja</p>
                  <p className="text-xs text-muted-foreground">Ver catálogo completo</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0ea5c9]" />
              </Link>
              <Link to="/track" className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:border-[#0ea5c9]/40 transition-colors group">
                <div className="h-10 w-10 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-[#0ea5c9]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Rastrear Encomenda</p>
                  <p className="text-xs text-muted-foreground">Estado de entrega em tempo real</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0ea5c9]" />
              </Link>
              <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{orders.length} Encomenda{orders.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">Histórico de compras</p>
                </div>
              </div>
              {isAdmin && (
                <Link to="/admin" className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:border-[#0ea5c9]/40 transition-colors group">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Gestão de Livros</p>
                    <p className="text-xs text-muted-foreground">Admin · catálogo e slides</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#0ea5c9]" />
                </Link>
              )}
            </div>

            {/* Tabs principais */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 mr-2" />Encomendas</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Definições</TabsTrigger>
                <TabsTrigger value="security"><Lock className="h-4 w-4 mr-2" />Segurança</TabsTrigger>
              </TabsList>

              <TabsContent value="orders">
                <div className="bg-card border rounded-xl">
                  {loadingOrders ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-16 px-4">
                      <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">Ainda não tem encomendas.</p>
                      <Button asChild className="btn-primary"><Link to="/shop">Ir à Loja</Link></Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {orders.map((o) => (
                        <div key={o.id} className="p-5 hover:bg-muted/20">
                          <div className="flex flex-wrap justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{formatOrderNumber(o)}</p>
                                {o.order_number && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-[#0ea5c9] px-2" asChild>
                                    <Link to="/track" state={{ orderNumber: o.order_number, email: user?.email }}>
                                      <Truck className="h-3 w-3 mr-1" /> Rastrear
                                    </Link>
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {new Date(o.created).toLocaleDateString('pt-AO', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {' · '}{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}
                              </p>
                              {o.phone && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {displayAngolaPhone(o.phone)}
                                </p>
                              )}
                              {(o.payment_method_code || o.payment_method || o.payment_method_name) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {resolveOrderPaymentLabel(o, PAYMENT_METHODS)}
                                  {o.payment_status && (
                                    <> · {getPaymentStatusLabel(o.payment_status)}</>
                                  )}
                                </p>
                              )}
                              {(o.delivery_municipality || o.delivery_province) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {[o.delivery_locality, o.delivery_municipality, o.delivery_province].filter(Boolean).join(', ')}
                                </p>
                              )}
                              {o.tracking_number && (
                                <p className="text-xs text-[#0ea5c9] mt-1 font-mono">
                                  Tracking: {o.tracking_number}{o.carrier ? ` (${o.carrier})` : ''}
                                </p>
                              )}
                              <div className="mt-2 space-y-1">
                                {(o.items || []).map((item, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    {item.quantity}× {item.title}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-[#0ea5c9]">Kz {Number(o.total).toFixed(2)}</p>
                              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(o.status)}`}>
                                {getOrderStatusLabel(o.status)}
                              </span>
                              {o.delivery_status && (
                                <span className={`inline-block mt-1.5 px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(o.delivery_status)}`}>
                                  {getDeliveryStatusLabel(o.delivery_status)}
                                </span>
                              )}
                              {o.delivery_confirmed_at && (
                                <p className="text-[10px] text-green-600 mt-1.5">Recepção confirmada</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <div className="bg-card border rounded-xl p-6 max-w-lg space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-4">Foto de Perfil</h3>
                    <div className="flex items-center gap-4">
                      <UserAvatar user={user} size="lg" className="h-20 w-20" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {user?.avatar ? 'Foto do Google ou upload personalizado' : 'Adicione a sua foto (PNG/JPG, máx. 2MB)'}
                        </p>
                        <label className="cursor-pointer">
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} disabled={avatarUploading} />
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>{avatarUploading ? 'A carregar...' : 'Alterar foto'}</span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Dados Pessoais</h3>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="O seu nome" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <PhoneInput value={phone} onChange={setPhone} />
                      <p className="text-[11px] text-muted-foreground">Usado para pré-preencher o checkout e contacto de entrega.</p>
                    </div>
                    <Button type="submit" className="btn-primary" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Alterações
                    </Button>
                  </form>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security">
                <div className="bg-card border rounded-xl p-6 max-w-lg">
                  <h3 className="font-bold text-lg mb-4">Alterar Password</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Password Actual</Label>
                      <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Nova Password</Label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Nova Password</Label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" variant="outline" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Alterar Password
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default ProfilePage;
