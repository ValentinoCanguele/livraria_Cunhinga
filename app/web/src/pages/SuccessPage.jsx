import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Package, User, MessageCircle, Download, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle } from '@/lib/brand';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useToast } from '@/hooks/use-toast';
import { loadLastOrder, downloadReceipt, sendReceiptViaWhatsApp } from '@/lib/receipt';
import { showLocalNotification, subscribeToPush, isPushSupported } from '@/lib/pushNotifications';

const SuccessPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [receiptChoice, setReceiptChoice] = useState(null);
  const [params] = useSearchParams();
  const { isAuthed } = useAuth();
  const { settings } = useSiteSettings();
  const { integrations } = useIntegrations();
  const { toast } = useToast();
  const waApiActive = !!(integrations?.whatsapp_business?.enabled && integrations?.whatsapp_business?.config?.configured);

  const orderId = params.get('orderId');
  const orderNumber = params.get('orderNumber');
  const total = params.get('total');
  const orderType = params.get('type') || 'purchase';

  const [orderData, setOrderData] = useState(null);

  const isWhatsApp = orderType === 'whatsapp';
  const hasOrder = !!(orderId || orderNumber);

  useEffect(() => {
    const saved = loadLastOrder();
    if (saved && (!orderId || saved.orderId === orderId)) {
      setOrderData(saved);
    } else if (orderId || orderNumber) {
      setOrderData({
        orderId,
        orderNumber,
        total: total ? Number(total) : 0,
        orderType,
      });
    }
  }, [orderId, orderNumber, total, orderType]);

  useEffect(() => {
    if (!hasOrder || isWhatsApp) return;
    const notify = async () => {
      const shown = await showLocalNotification({
        title: 'Encomenda confirmada! 🎉',
        body: orderNumber ? `Pedido ${orderNumber} registado com sucesso.` : 'A sua compra foi registada.',
        url: '/profile',
      });
      if (!shown && settings.push_enabled && settings.vapid_public_key && isPushSupported()) {
        try { await subscribeToPush(settings.vapid_public_key); } catch { /* ignore */ }
      }
    };
    notify();
  }, [hasOrder, isWhatsApp, orderNumber, settings.push_enabled, settings.vapid_public_key]);

  const title = isWhatsApp ? 'Pedido WhatsApp Registado!' : 'Compra Confirmada!';
  const subtitle = isWhatsApp
    ? (waApiActive
      ? 'O seu pedido foi registado e a confirmação foi enviada automaticamente para o seu WhatsApp.'
      : 'O seu pedido foi registado no sistema. Continue a conversa no WhatsApp para confirmar pagamento e entrega.')
    : (waApiActive
      ? 'Obrigado pela sua compra. Receberá confirmação no WhatsApp e por email (se configurado).'
      : 'Obrigado pela sua compra. A nossa equipa irá processar o pedido em breve.');

  const handleReceiptWhatsApp = async () => {
    if (!orderData) return;
    setReceiptChoice('whatsapp');
    try {
      const result = await sendReceiptViaWhatsApp(orderData, orderData.phone || settings.whatsapp);
      if (result?.mode === 'api') {
        toast({ title: 'Recibo enviado', description: 'Verifique o seu WhatsApp.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleReceiptDownload = () => {
    if (!orderData) return;
    setReceiptChoice('download');
    downloadReceipt(orderData);
  };

  const nextSteps = isWhatsApp
    ? [
        { step: 1, title: 'WhatsApp', desc: 'A equipa confirma disponibilidade e forma de pagamento no chat.' },
        { step: 2, title: 'Pagamento', desc: 'Efectue o pagamento conforme indicado (Multicaixa, transferência, etc.).' },
        { step: 3, title: 'Entrega', desc: 'Após confirmação, coordenamos a entrega na sua morada.' },
      ]
    : [
        { step: 1, title: 'Confirmação', desc: 'Verificamos a compra e o stock em 1-2 dias úteis.' },
        { step: 2, title: 'Preparação', desc: 'Os livros são embalados com cuidado para envio.' },
        { step: 3, title: 'Entrega', desc: 'Receberá contacto para coordenar a entrega na sua morada.' },
      ];

  return (
    <>
      <Helmet>
        <title>{pageTitle(isWhatsApp ? 'Pedido WhatsApp' : 'Compra Confirmada')}</title>
        <meta name="description" content={subtitle} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="section-spacing bg-background min-h-[60vh] flex items-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isWhatsApp ? 'bg-green-500/10' : 'bg-[#0ea5c9]/10'}`}>
              {isWhatsApp ? (
                <MessageCircle className="h-10 w-10 text-green-600" />
              ) : (
                <CheckCircle className="h-10 w-10 text-[#0ea5c9]" />
              )}
            </div>

            <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4 ${isWhatsApp ? 'bg-green-500/10 text-green-700' : 'bg-[#0ea5c9]/10 text-[#0ea5c9]'}`}>
              {isWhatsApp ? 'Encomenda via WhatsApp' : 'Compra Online'}
            </span>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            <p className="text-muted-foreground text-lg mb-8">{subtitle}</p>

            {hasOrder && (
              <div className="bg-card border border-border rounded-xl p-6 mb-6 text-left space-y-3">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#0ea5c9]" />
                  {isWhatsApp ? 'Detalhes do Pedido' : 'Detalhes da Compra'}
                </h2>
                {orderNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Número</span>
                    <code className="font-mono font-semibold text-[#0ea5c9]">{orderNumber}</code>
                  </div>
                )}
                {total && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold">Kz {Number(total).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            {hasOrder && orderData && (
              <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left">
                <h2 className="font-semibold text-lg flex items-center gap-2 mb-2">
                  <Receipt className="h-5 w-5 text-[#0ea5c9]" /> Como deseja receber o recibo?
                </h2>
                <p className="text-sm text-muted-foreground mb-4">Escolha uma opção para guardar o comprovativo da sua {isWhatsApp ? 'encomenda' : 'compra'}.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Button
                    variant={receiptChoice === 'whatsapp' ? 'default' : 'outline'}
                    className={`py-6 h-auto flex-col gap-2 ${receiptChoice === 'whatsapp' ? 'btn-primary' : 'border-green-500/40 text-green-700 hover:bg-green-50'}`}
                    onClick={handleReceiptWhatsApp}
                  >
                    <MessageCircle className="h-6 w-6" />
                    <span className="font-semibold">Receber por WhatsApp</span>
                    <span className="text-xs font-normal opacity-80">Envia o recibo para o seu chat</span>
                  </Button>
                  <Button
                    variant={receiptChoice === 'download' ? 'default' : 'outline'}
                    className={`py-6 h-auto flex-col gap-2 ${receiptChoice === 'download' ? 'btn-primary' : ''}`}
                    onClick={handleReceiptDownload}
                  >
                    <Download className="h-6 w-6" />
                    <span className="font-semibold">Descarregar Recibo</span>
                    <span className="text-xs font-normal opacity-80">Ficheiro HTML para imprimir ou guardar</span>
                  </Button>
                </div>
                {receiptChoice && (
                  <p className="text-xs text-green-600 mt-3 text-center">
                    {receiptChoice === 'whatsapp'
                      ? (waApiActive ? '✓ Recibo enviado para o seu WhatsApp' : '✓ WhatsApp aberto com o recibo')
                      : '✓ Recibo descarregado'}
                  </p>
                )}
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-8 mb-8 text-left">
              <h2 className="text-xl font-semibold mb-4">Próximos passos</h2>
              <div className="space-y-4">
                {nextSteps.map(({ step, title: stepTitle, desc }) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0ea5c9]/10 flex items-center justify-center text-[#0ea5c9] font-semibold text-sm">{step}</div>
                    <div>
                      <h3 className="font-medium mb-1">{stepTitle}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/shop">
                <Button size="lg" className="btn-primary w-full sm:w-auto">
                  Continuar a Comprar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              {isAuthed ? (
                <Link to="/profile" state={{ tab: 'orders' }}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-[#0ea5c9] text-[#0ea5c9]">
                    <User className="mr-2 h-5 w-5" /> Ver {isWhatsApp ? 'Pedidos' : 'Compras'}
                  </Button>
                </Link>
              ) : (
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Contactar Apoio
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default SuccessPage;
