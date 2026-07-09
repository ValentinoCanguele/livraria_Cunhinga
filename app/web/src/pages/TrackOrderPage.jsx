import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Package, MapPin, Truck, CheckCircle2, Circle, Loader2, Phone, Users, Calendar, User,
} from 'lucide-react';
import { trackOrder } from '@/api/PlatformApi';
import { pageTitle } from '@/lib/brand';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DeliveryConfirmPanel from '@/components/DeliveryConfirmPanel';
import {
  getOrderStatusLabel, getOrderStatusColor, getDeliveryStatusLabel, getDeliveryStatusColor,
  getPaymentStatusLabel, getPaymentStatusColor,
} from '@/lib/orderUtils';
import { displayAngolaPhone } from '@/lib/angolaPhone';

const STEPS = ['received', 'confirmed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];

export default function TrackOrderPage() {
  const { settings } = useSiteSettings();
  const { user, isAuthed } = useAuth();
  const location = useLocation();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState(location.state?.orderNumber || '');
  const [email, setEmail] = useState(location.state?.email || user?.email || '');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.orderNumber) setOrderNumber(location.state.orderNumber);
    if (location.state?.email) setEmail(location.state.email);
    else if (user?.email && !email) setEmail(user.email);
  }, [location.state, user?.email, email]);

  useEffect(() => {
    const num = (location.state?.orderNumber || '').trim();
    const em = (location.state?.email || user?.email || '').trim();
    if (!num || !em) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await trackOrder(num, em);
        if (!cancelled) setOrder(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrack = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const data = await trackOrder(orderNumber.trim(), email.trim());
      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIdx = order ? STEPS.indexOf(order.delivery_status) : -1;
  const timeline = order?.timeline || [];

  return (
    <>
      <Helmet><title>{pageTitle('Rastrear Encomenda')}</title></Helmet>
      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="min-h-screen bg-muted/20 py-10">
        <div className="container-custom max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-8">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-[#0ea5c9]/10 items-center justify-center mb-4">
                <Truck className="h-7 w-7 text-[#0ea5c9]" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Rastrear Encomenda</h1>
              <p className="text-muted-foreground">Acompanhe a entrega ao domicílio em tempo real</p>
            </div>

            {isAuthed && user?.email && (
              <p className="text-xs text-center text-muted-foreground mb-4 flex items-center justify-center gap-1">
                <User className="h-3.5 w-3.5" />
                Sessão iniciada como <strong>{user.email}</strong>
                {' · '}
                <Link to="/profile" state={{ tab: 'orders' }} className="text-[#0ea5c9] hover:underline">Ver todas as encomendas</Link>
              </p>
            )}

            <form onSubmit={handleTrack} className="bg-card border rounded-2xl p-6 mb-8 space-y-4">
              <div className="space-y-2">
                <Label>Número da Encomenda</Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  placeholder="ENC-XXXXXX"
                  required
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Email usado na compra</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full btn-primary py-6" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Rastrear
              </Button>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
            </form>

            {order && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-card border rounded-2xl p-6">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Encomenda</p>
                      <p className="text-xl font-bold font-mono text-[#0ea5c9]">{order.order_number}</p>
                      {order.customer_name && (
                        <p className="text-sm text-muted-foreground mt-1">{order.customer_name}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(order.delivery_status)}`}>
                        {getDeliveryStatusLabel(order.delivery_status)}
                      </span>
                      {order.payment_status && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                          {getPaymentStatusLabel(order.payment_status)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total</span>
                      <p className="font-bold">Kz {Number(order.total).toFixed(2)}</p>
                    </div>
                    {order.estimated_delivery && (
                      <div>
                        <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Entrega prevista</span>
                        <p className="font-medium">
                          {new Date(order.estimated_delivery).toLocaleDateString('pt-AO', { weekday: 'short', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    )}
                    {order.phone && (
                      <div>
                        <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Contacto</span>
                        <p className="font-medium">{displayAngolaPhone(order.phone)}</p>
                      </div>
                    )}
                    {(order.delivery_relative_name || order.delivery_relative_phone) && (
                      <div>
                        <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Contacto próximo</span>
                        <p className="font-medium">
                          {order.delivery_relative_name || '—'}
                          {order.delivery_relative_phone && (
                            <span className="block text-xs text-muted-foreground">{displayAngolaPhone(order.delivery_relative_phone)}</span>
                          )}
                        </p>
                      </div>
                    )}
                    {order.tracking_number && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Tracking</span>
                        <p className="font-mono">{order.tracking_number}{order.carrier ? ` · ${order.carrier}` : ''}</p>
                      </div>
                    )}
                    <div className="sm:col-span-2 flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p>{order.delivery_address_full || order.address}{!order.delivery_address_full && order.city ? `, ${order.city}` : ''}</p>
                        {order.delivery_province && (
                          <p className="text-xs mt-1">
                            {[order.delivery_locality, order.delivery_municipality, order.delivery_province].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {order.delivery_reference && (
                          <p className="text-xs text-[#0ea5c9]">Ref: {order.delivery_reference}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl p-6">
                  <h3 className="font-semibold mb-6 flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#0ea5c9]" /> Estado da Entrega
                  </h3>
                  <div className="relative">
                    {STEPS.map((step, idx) => {
                      const done = idx <= currentStepIdx;
                      const active = idx === currentStepIdx;
                      return (
                        <div key={step} className="flex gap-4 pb-6 last:pb-0">
                          <div className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[#0ea5c9] text-white' : 'bg-muted border-2 border-border'}`}>
                              {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            {idx < STEPS.length - 1 && (
                              <div className={`w-0.5 flex-1 min-h-[24px] ${idx < currentStepIdx ? 'bg-[#0ea5c9]' : 'bg-border'}`} />
                            )}
                          </div>
                          <div className={`pt-1 ${active ? 'font-semibold text-[#0ea5c9]' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {getDeliveryStatusLabel(step)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {timeline.length > 0 && (
                  <div className="bg-card border rounded-2xl p-6">
                    <h3 className="font-semibold mb-4">Histórico</h3>
                    <div className="space-y-4">
                      {[...timeline].reverse().map((ev, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                            {new Date(ev.at).toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div>
                            <p className="font-medium">{ev.title}</p>
                            {ev.description && <p className="text-muted-foreground text-xs">{ev.description}</p>}
                            {ev.location && <p className="text-xs text-[#0ea5c9]">{ev.location}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DeliveryConfirmPanel
                  orderNumber={orderNumber}
                  email={email}
                  order={order}
                  onConfirmed={(updated) => setOrder((prev) => ({ ...prev, ...updated }))}
                />

                <p className="text-center text-sm text-muted-foreground">
                  Dúvidas? <Link to="/contact" className="text-[#0ea5c9] hover:underline">Contacte-nos</Link>
                  {settings.contact_phone && ` · ${displayAngolaPhone(settings.contact_phone)}`}
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
