import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart as ShoppingCartIcon, X, Loader2, ChevronLeft, Truck, CreditCard, MapPin, Shield, Lock, MessageCircle, ChevronDown, ChevronUp, Zap, PenLine,
} from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { initializeCheckout } from '@/api/EcommerceApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useIntegrations } from '@/hooks/useIntegrations';
import { getPaymentMethods, getPhysicalStores } from '@/api/PlatformApi';
import { formatCurrency } from '@/api/EcommerceApi';
import { openWhatsAppOrder } from '@/lib/whatsapp';
import { calcShippingCents, SHIPPING_METHODS, getShippingLabel } from '@/lib/shipping';
import { saveLastOrder } from '@/lib/receipt';
import AngolaAddressSelector, { validateAngolaAddress, angolaAddressToPayload } from '@/components/AngolaAddressSelector';
import SignaturePad from '@/components/SignaturePad';
import PhoneInput from '@/components/PhoneInput';
import { normalizeAngolaPhone, isValidAngolaPhone } from '@/lib/angolaPhone';
import { FloatingScrollTop } from '@/components/ui/FloatingScrollTop';

const ShoppingCart = ({ isCartOpen, setIsCartOpen }) => {
  const { toast } = useToast();
  const { user, updateProfile } = useAuth();
  const { settings } = useSiteSettings();
  const { integrations } = useIntegrations();
  const waApiActive = !!(integrations?.whatsapp_business?.enabled && integrations?.whatsapp_business?.config?.configured);
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, getCartTotalCents, clearCart } = useCart();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [physicalStores, setPhysicalStores] = useState([]);
  const [shippingOpen, setShippingOpen] = useState(false);
  const cartScrollRef = useRef(null);

  const [step, setStep] = useState('cart');
  const [checkingOut, setCheckingOut] = useState(false);
  const signatureRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Luanda',
    paymentMethod: 'entrega',
    paymentReference: '',
    notes: '',
    shippingMethod: 'delivery',
    pickupStore: '',
  });
  const [deliveryAddress, setDeliveryAddress] = useState({
    provinceId: '',
    provinceName: 'Luanda',
    municipalityId: '',
    municipalityName: '',
    localityId: '',
    localityName: '',
    localityCustom: '',
    street: '',
    reference: '',
    phone: '',
    relativeName: '',
    relativePhone: '',
  });

  useEffect(() => {
    if (isCartOpen) {
      getPaymentMethods().then((res) => {
        const methods = res.methods || [];
        setPaymentMethods(methods);
        if (methods.length > 0 && !methods.find((m) => m.code === form.paymentMethod)) {
          setForm((f) => ({ ...f, paymentMethod: methods[0].code }));
        }
      });
      // Só as lojas que aceitam levantamento aparecem no checkout.
      getPhysicalStores().then((list) => setPhysicalStores(list.filter((st) => st.pickup_enabled)));
    }
  }, [isCartOpen]);

  const subtotalCents = getCartTotalCents();
  const FREE_SHIPPING_THRESHOLD = (Number(settings.shipping_free_threshold) || 20000) * 100;
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalCents);
  const freeShippingProgress = FREE_SHIPPING_THRESHOLD > 0
    ? Math.min(100, (subtotalCents / FREE_SHIPPING_THRESHOLD) * 100)
    : 100;
  const maintenanceMode = !!settings.maintenance_mode;

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.name || '',
        email: f.email || user.email || '',
        phone: f.phone || user.phone || '',
      }));
      setDeliveryAddress((d) => ({
        ...d,
        phone: d.phone || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!isCartOpen) setStep('cart');
  }, [isCartOpen]);

  const shippingCents = calcShippingCents(form.shippingMethod, subtotalCents, settings);
  const totalCents = subtotalCents + shippingCents;
  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const orderItemsForReceipt = cartItems.map((item) => ({
    title: item.product.title,
    quantity: item.quantity,
    price: (item.variant.sale_price_in_cents ?? item.variant.price_in_cents) / 100,
  }));

  const handleCheckout = useCallback(async (viaWhatsApp = false) => {
    if (maintenanceMode) {
      toast({ variant: 'destructive', title: 'Loja em manutenção', description: 'O checkout está temporariamente indisponível. Tente mais tarde ou contacte-nos.' });
      return;
    }
    const needsAddress = form.shippingMethod !== 'pickup';
    const effectivePhone = normalizeAngolaPhone(
      needsAddress ? (deliveryAddress.phone || form.phone) : form.phone
    );

    if (!form.name.trim() || !form.email.trim() || !effectivePhone) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos obrigatórios' });
      return;
    }
    if (!isValidAngolaPhone(effectivePhone)) {
      toast({ variant: 'destructive', title: 'Telefone inválido', description: 'Use o formato +244 9XX XXX XXX.' });
      return;
    }
    if (needsAddress) {
      const addrErr = validateAngolaAddress(deliveryAddress, { requireDelivery: true });
      if (addrErr) {
        toast({ variant: 'destructive', title: 'Morada incompleta', description: addrErr });
        return;
      }
    }
    if (form.shippingMethod === 'pickup' && physicalStores.length > 0 && !form.pickupStore) {
      toast({ variant: 'destructive', title: 'Seleccione a loja de levantamento' });
      return;
    }

    // Validate payment reference for transfer/P2P methods
    const selectedMethod = paymentMethods.find((m) => m.code === form.paymentMethod);
    if (selectedMethod && (selectedMethod.type === 'p2p' || selectedMethod.type === 'transfer') && !form.paymentReference.trim()) {
      toast({
        variant: 'destructive',
        title: 'Referência de pagamento obrigatória',
        description: 'Indique a referência, número ou comprovativo do pagamento por transferência / Multicaixa Express.'
      });
      return;
    }

    const checkoutSignature = signatureRef.current?.getDataURL();
    if (!checkoutSignature) {
      toast({
        variant: 'destructive',
        title: 'Assinatura obrigatória',
        description: 'Assine no quadro para confirmar a compra.',
      });
      return;
    }

    setCheckingOut(true);
    try {
      const items = cartItems.map((item) => ({
        variant_id: item.variant.id,
        quantity: item.quantity,
      }));

      const addressPayload = form.shippingMethod === 'pickup'
        ? { address: `Levantamento: ${form.pickupStore || 'Loja física'}`, city: form.pickupStore || 'Loja física' }
        : angolaAddressToPayload(deliveryAddress);

      const { orderId, total, orderNumber, order_type, whatsapp_sent } = await initializeCheckout({
        items,
        successUrl: `${window.location.origin}/success`,
        customerEmail: form.email.trim(),
        customerName: form.name.trim(),
        phone: effectivePhone,
        ...addressPayload,
        paymentMethodCode: form.paymentMethod,
        paymentReference: form.paymentReference,
        notes: form.notes.trim(),
        shippingCost: shippingCents / 100,
        saleChannel: viaWhatsApp ? 'whatsapp' : 'web_purchase',
        shippingMethod: form.shippingMethod,
        pickupStore: form.pickupStore,
        checkoutSignature,
      });

      const isWhatsApp = viaWhatsApp || order_type === 'whatsapp_order';
      const waPhone = settings.whatsapp || settings.contact_phone;
      const paymentMethodInfo = paymentMethods.find((m) => m.code === form.paymentMethod);
      const paymentLabel = paymentMethodInfo?.name || form.paymentMethod;

      saveLastOrder({
        orderId,
        orderNumber,
        paymentLink: paymentMethodInfo?.payment_link || '',
        paymentReference: (form.paymentReference || '').trim(),
        total,
        subtotal: subtotalCents / 100,
        shippingCost: shippingCents / 100,
        customerName: form.name.trim(),
        signerName: form.name.trim(),
        email: form.email.trim(),
        phone: effectivePhone,
        address: addressPayload.address,
        city: addressPayload.city,
        deliveryAddress: form.shippingMethod !== 'pickup' ? deliveryAddress : null,
        deliveryRelativeName: addressPayload.deliveryRelativeName || '',
        deliveryRelativePhone: addressPayload.deliveryRelativePhone || '',
        shippingMethod: form.shippingMethod,
        shippingLabel: getShippingLabel(form.shippingMethod),
        pickupStore: form.pickupStore,
        paymentMethod: paymentLabel,
        orderType: isWhatsApp ? 'whatsapp' : 'purchase',
        items: orderItemsForReceipt,
        createdAt: new Date().toISOString(),
        signatureSignedAt: new Date().toISOString(),
        checkoutSignature,
      });

      if (isWhatsApp && waPhone && !waApiActive && !whatsapp_sent) {
        openWhatsAppOrder(waPhone, {
          cartItems,
          form: { ...form, paymentMethod: paymentLabel },
          totalFormatted: formatCurrency(total * 100),
          orderNumber,
        });
      }

      clearCart();
      if (user?.id && effectivePhone) {
        try {
          await updateProfile({ phone: effectivePhone });
        } catch { /* ignore */ }
      }
      setIsCartOpen(false);
      const params = new URLSearchParams({
        orderId,
        total: String(total),
        type: isWhatsApp ? 'whatsapp' : 'purchase',
        ...(orderNumber && { orderNumber }),
      });
      window.location.href = `/success?${params.toString()}`;
    } catch (error) {
      toast({
        title: viaWhatsApp ? 'Erro no pedido WhatsApp' : 'Erro no checkout',
        description: error.message || 'Não foi possível finalizar.',
        variant: 'destructive',
      });
    } finally {
      setCheckingOut(false);
    }
  }, [cartItems, clearCart, deliveryAddress, form, maintenanceMode, orderItemsForReceipt, paymentMethods, physicalStores.length, settings, shippingCents, subtotalCents, setIsCartOpen, toast, updateProfile, user?.id, waApiActive]);

  const maxQty = (item) => (item.variant.manage_inventory ? item.variant.inventory_quantity : 99);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/60 z-50"
          onClick={() => setIsCartOpen(false)}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-card text-card-foreground shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                {step === 'checkout' && (
                  <Button variant="ghost" size="icon" onClick={() => setStep('cart')} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <div>
                  <h2 className="text-xl font-bold">
                    {step === 'cart' ? 'Carrinho' : 'Finalizar Compra'}
                  </h2>
                  {itemCount > 0 && (
                    <p className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <Button onClick={() => setIsCartOpen(false)} variant="ghost" size="icon">
                <X />
              </Button>
            </div>

            {/* Steps indicator */}
            {cartItems.length > 0 && (
              <div className="flex gap-2 px-5 py-3 border-b border-border bg-muted/30">
                <div className={`flex-1 h-1 rounded-full ${step === 'cart' ? 'bg-[#0ea5c9]' : 'bg-[#0ea5c9]/40'}`} />
                <div className={`flex-1 h-1 rounded-full ${step === 'checkout' ? 'bg-[#0ea5c9]' : 'bg-muted'}`} />
              </div>
            )}

            <div className="flex-grow overflow-y-auto relative" ref={cartScrollRef}>
              {step === 'cart' && (
                <div className="p-5 space-y-4">
                  {cartItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16 flex flex-col items-center">
                      <ShoppingCartIcon size={48} className="mb-4 opacity-40" />
                      <p className="mb-4">O carrinho está vazio.</p>
                      <Button variant="outline" onClick={() => { setIsCartOpen(false); }} asChild>
                        <Link to="/shop">Explorar Livros</Link>
                      </Button>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.variant.id} className="flex gap-3 bg-muted/30 border border-border p-3 rounded-xl">
                        <img
                          src={item.product.image}
                          alt={item.product.title}
                          className="w-16 h-20 object-cover rounded-lg shrink-0 bg-muted"
                          onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="80" fill="%23e5e7eb"%3E%3Crect width="100%25" height="100%25"/%3E%3C/svg%3E'; }}
                        />
                        <div className="flex-grow min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-2">{item.product.title}</h3>
                          <p className="text-xs text-muted-foreground">{item.product.subtitle}</p>
                          <p className="text-sm text-[#0ea5c9] font-bold mt-1">
                            {item.variant.sale_price_formatted || item.variant.price_formatted}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center border border-border rounded-lg bg-background">
                            <Button
                              onClick={() => updateQuantity(item.variant.id, item.quantity - 1)}
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              disabled={item.quantity <= 1}
                            >−</Button>
                            <span className="w-7 text-center text-sm">{item.quantity}</span>
                            <Button
                              onClick={() => updateQuantity(item.variant.id, item.quantity + 1)}
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              disabled={item.quantity >= maxQty(item)}
                            >+</Button>
                          </div>
                          <Button onClick={() => removeFromCart(item.variant.id)} size="sm" variant="ghost" className="text-destructive text-xs h-6 px-1">
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {step === 'checkout' && (
                <div className="p-5 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0ea5c9]">
                      <Truck className="h-4 w-4" /> Método de Entrega
                    </div>
                    <RadioGroup
                      value={form.shippingMethod}
                      onValueChange={(v) => setForm({ ...form, shippingMethod: v, pickupStore: v === 'pickup' ? form.pickupStore : '' })}
                    >
                      {Object.values(SHIPPING_METHODS).map((opt) => {
                        const cost = calcShippingCents(opt.id, subtotalCents, settings);
                        const Icon = opt.icon;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-start space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${form.shippingMethod === opt.id ? 'border-[#0ea5c9] bg-[#0ea5c9]/5' : 'hover:bg-muted/50'}`}
                            onClick={() => setForm({ ...form, shippingMethod: opt.id })}
                          >
                            <RadioGroupItem value={opt.id} id={`ship-${opt.id}`} className="mt-1" />
                            <Label htmlFor={`ship-${opt.id}`} className="cursor-pointer flex-1">
                              <span className="font-medium flex items-center gap-1.5">
                                <Icon className="h-4 w-4 text-[#0ea5c9]" /> {opt.label}
                              </span>
                              <span className="block text-xs text-muted-foreground">{opt.description}</span>
                              <span className={`block text-xs font-semibold mt-0.5 ${cost === 0 ? 'text-green-600' : 'text-[#0ea5c9]'}`}>
                                {cost === 0 ? 'Grátis' : formatCurrency(cost)}
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    {form.shippingMethod === 'pickup' && physicalStores.length > 0 && (
                      <div className="space-y-2 ml-1">
                        <Label>Loja de levantamento *</Label>
                        <RadioGroup value={form.pickupStore} onValueChange={(v) => setForm({ ...form, pickupStore: v })}>
                          {physicalStores.map((store) => (
                            <div key={store.id} className="flex items-center space-x-2 p-2 rounded-lg border text-sm">
                              <RadioGroupItem value={store.name} id={`store-${store.id}`} />
                              <Label htmlFor={`store-${store.id}`} className="cursor-pointer flex-1">
                                <span className="font-medium">{store.name}</span>
                                {store.address && <span className="block text-xs text-muted-foreground">{store.address}</span>}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0ea5c9]">
                      <MapPin className="h-4 w-4" /> {form.shippingMethod === 'pickup' ? 'Dados de Contacto' : 'Dados de Entrega'}
                    </div>
                    <div className="space-y-2">
                      <Label>Nome completo *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="O seu nome" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                    </div>
                    {form.shippingMethod === 'pickup' && (
                      <div className="space-y-2">
                        <Label>Telefone *</Label>
                        <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
                      </div>
                    )}
                    {form.shippingMethod !== 'pickup' && (
                      <AngolaAddressSelector value={deliveryAddress} onChange={setDeliveryAddress} />
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0ea5c9]">
                      <CreditCard className="h-4 w-4" /> Método de Pagamento
                    </div>
                    <RadioGroup value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v, paymentReference: '' })}>
                      {paymentMethods.length > 0 ? paymentMethods.map((m) => (
                        <div key={m.code} className="space-y-2">
                          <div className={`flex items-start space-x-2 p-3 rounded-lg border transition-colors cursor-pointer ${form.paymentMethod === m.code ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/0.05)]' : 'hover:bg-muted/50'}`}>
                            <RadioGroupItem value={m.code} id={m.code} className="mt-1" />
                            <Label htmlFor={m.code} className="cursor-pointer flex-1">
                              <span className="font-medium flex items-center gap-2">
                                {m.icon && <span>{m.icon}</span>}
                                {m.name}
                                <span className="text-[10px] uppercase text-muted-foreground font-normal">{m.type}</span>
                              </span>
                              {m.account_info && <span className="block text-xs text-muted-foreground font-mono mt-0.5">{m.account_info}</span>}
                              {form.paymentMethod === m.code && m.instructions && (
                                <p className="text-xs text-muted-foreground mt-2 p-2 rounded-md bg-muted/50 whitespace-pre-wrap">{m.instructions}</p>
                              )}
                            </Label>
                          </div>
                          {form.paymentMethod === m.code && (m.type === 'p2p' || m.type === 'transfer') && (
                            <div className="ml-6 space-y-2">
                              {m.payment_link && (
                                <a
                                  href={m.payment_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                                >
                                  <CreditCard className="h-4 w-4" /> Pagar agora com {m.name}
                                </a>
                              )}
                              {m.payment_link && (
                                <p className="text-xs text-muted-foreground">Depois de pagar, escreva abaixo a referência ou o número do comprovativo.</p>
                              )}
                              {m.qr_url && <img src={m.qr_url} alt="QR pagamento" className="h-32 w-32 rounded-lg border" />}
                              <Input placeholder="Referência / comprovativo de pagamento" value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} />
                            </div>
                          )}
                        </div>
                      )) : (
                        <>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border"><RadioGroupItem value="entrega" id="entrega" /><Label htmlFor="entrega">Pagamento na entrega</Label></div>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border"><RadioGroupItem value="transferencia" id="transferencia" /><Label htmlFor="transferencia">Transferência bancária</Label></div>
                        </>
                      )}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Instruções de entrega..." />
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0ea5c9]">
                      <PenLine className="h-4 w-4" /> Assinatura
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assine à mão para confirmar a compra. A imagem fica no recibo em preto e branco, com o seu nome e data.
                    </p>
                    <SignaturePad
                      ref={signatureRef}
                      label="Assinatura do comprador *"
                      hint="Desenhe a sua assinatura com o dedo ou rato."
                    />
                  </div>
                </div>
              )}
              <FloatingScrollTop
                mode="container"
                containerRef={cartScrollRef}
                threshold={180}
                positionClass="absolute bottom-4 right-4 z-10"
              />
            </div>

            {cartItems.length > 0 && (
              <div className="p-5 border-t border-border bg-muted/20 space-y-3">
                {maintenanceMode && (
                  <div className="text-xs p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900">
                    A loja está em manutenção — o checkout online está temporariamente desactivado.
                  </div>
                )}
                {!user && step === 'checkout' && (
                  <div className="text-xs p-3 rounded-lg bg-[#0ea5c9]/5 border border-[#0ea5c9]/20 text-muted-foreground">
                    <Link to="/login" className="text-[#0ea5c9] font-medium hover:underline" onClick={() => setIsCartOpen(false)}>
                      Entre na sua conta
                    </Link>
                    {' '}para acompanhar esta encomenda e guardar os seus dados.
                  </div>
                )}
                <div className="flex gap-3 text-[10px] text-muted-foreground justify-center pb-1">
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-green-600" /> Compra segura</span>
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-green-600" /> Dados protegidos</span>
                  <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-[#0ea5c9]" /> Entrega nacional</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {form.shippingMethod === 'delivery' && freeShippingRemaining > 0 && subtotalCents > 0 && (
                    <div className="rounded-lg border border-[#0ea5c9]/20 bg-[#0ea5c9]/5 p-2.5 mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Envio grátis</span>
                        <span>Faltam {formatCurrency(freeShippingRemaining)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-[#0ea5c9] rounded-full transition-all" style={{ width: `${freeShippingProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {form.shippingMethod === 'delivery' && shippingCents === 0 && subtotalCents >= FREE_SHIPPING_THRESHOLD && (
                    <p className="text-xs text-green-600 font-medium mb-1">Envio grátis aplicado neste pedido</p>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotalCents)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShippingOpen((o) => !o)}
                    className="w-full flex justify-between items-center rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-[#0ea5c9]" />
                      {getShippingLabel(form.shippingMethod)}
                      {shippingOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                    <span className={shippingCents === 0 ? 'text-green-600 font-medium' : ''}>
                      {shippingCents === 0 ? 'Grátis' : formatCurrency(shippingCents)}
                    </span>
                  </button>
                  {shippingOpen && (
                    <div className="rounded-lg border border-border bg-background p-2 space-y-1">
                      {Object.values(SHIPPING_METHODS).map((opt) => {
                        const cost = calcShippingCents(opt.id, subtotalCents, settings);
                        const Icon = opt.icon;
                        const selected = form.shippingMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setForm({ ...form, shippingMethod: opt.id })}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${selected ? 'bg-[#0ea5c9]/10 border border-[#0ea5c9]/30' : 'hover:bg-muted/50'}`}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <Icon className="h-3.5 w-3.5" /> {opt.label}
                            </span>
                            <span className={cost === 0 ? 'text-green-600' : ''}>{cost === 0 ? 'Grátis' : formatCurrency(cost)}</span>
                          </button>
                        );
                      })}
                      {form.shippingMethod === 'delivery' && shippingCents > 0 && (
                        <p className="text-[10px] text-muted-foreground px-2 pt-1">
                          Envio grátis acima de {formatCurrency(FREE_SHIPPING_THRESHOLD)}
                        </p>
                      )}
                      {step === 'cart' && (
                        <p className="text-[10px] text-[#0ea5c9] px-2">Continue para checkout para seleccionar loja de levantamento</p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                    <span>Total</span>
                    <span className="text-[#0ea5c9]">{formatCurrency(totalCents)}</span>
                  </div>
                </div>

                {step === 'cart' ? (
                  <Button className="w-full btn-primary py-6 text-base" onClick={() => setStep('checkout')} disabled={maintenanceMode}>
                    {maintenanceMode ? 'Checkout indisponível' : 'Continuar para Checkout'}
                  </Button>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 space-y-0.5">
                      <p><strong>{form.name || '—'}</strong> · {form.email}</p>
                      <p>{form.shippingMethod === 'pickup'
                        ? `Levantamento: ${form.pickupStore || 'Loja física'}`
                        : angolaAddressToPayload(deliveryAddress).deliveryAddressFull}
                      </p>
                    </div>
                    <Button className="w-full btn-primary py-6 text-base" onClick={() => handleCheckout(false)} disabled={checkingOut || maintenanceMode}>
                      {checkingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar Compra · {formatCurrency(totalCents)}
                    </Button>
                    {(settings.whatsapp || settings.contact_phone) && (
                      <Button
                        variant="outline"
                        className="w-full py-5 border-green-500/50 text-green-700 hover:bg-green-50"
                        onClick={() => handleCheckout(true)}
                        disabled={checkingOut || maintenanceMode}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        {waApiActive ? 'Confirmar e receber no WhatsApp' : 'Finalizar via WhatsApp'}
                      </Button>
                    )}
                    <p className="text-[10px] text-center text-muted-foreground">
                      <strong>Compra online</strong> — pagamento e entrega pela loja.{' '}
                      {waApiActive ? (
                        <><strong>WhatsApp</strong> — confirmação automática enviada para o seu número.</>
                      ) : (
                        <><strong>WhatsApp</strong> — pedido registado e conversa directa com a equipa.</>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCart;
