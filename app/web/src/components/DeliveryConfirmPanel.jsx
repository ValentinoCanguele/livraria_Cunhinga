import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { confirmDelivery } from '@/api/PlatformApi';
import SignaturePad from '@/components/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function DeliveryConfirmPanel({ orderNumber, email, order, onConfirmed }) {
  const signatureRef = useRef(null);
  const [recipientName, setRecipientName] = useState(order?.customer_name || '');
  const [recipientId, setRecipientId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const canConfirm = order
    && !order.delivery_confirmed_at
    && ['out_for_delivery', 'delivered', 'in_transit', 'shipped'].includes(order.delivery_status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Indique quem recebe a encomenda.' });
      return;
    }
    const signature = signatureRef.current?.getDataURL();
    if (!signature) {
      toast({ variant: 'destructive', title: 'Assinatura obrigatória', description: 'Assine no quadro para confirmar a recepção.' });
      return;
    }
    setSubmitting(true);
    try {
      const updated = await confirmDelivery({
        orderNumber,
        email,
        recipientName: recipientName.trim(),
        recipientId: recipientId.trim(),
        signature,
      });
      toast({ title: 'Entrega confirmada', description: 'Obrigado! A assinatura foi registada.' });
      onConfirmed?.(updated);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (order?.delivery_confirmed_at) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-green-700 font-semibold">
          <CheckCircle2 className="h-5 w-5" />
          Recepção confirmada pelo comprador
        </div>
        <p className="text-sm text-muted-foreground">
          Confirmado por <strong>{order.delivery_confirmed_by || order.delivery_recipient_name}</strong>
          {order.delivery_confirmed_at && (
            <> em {new Date(order.delivery_confirmed_at).toLocaleString('pt-AO')}</>
          )}
        </p>
        {order.delivery_signature_data && (
          <img src={order.delivery_signature_data} alt="Assinatura" className="max-h-24 border rounded bg-white p-2" />
        )}
      </div>
    );
  }

  if (!canConfirm) return null;

  return (
    <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 font-semibold text-[#0ea5c9]">
        <PenLine className="h-5 w-5" />
        Confirmar recepção da encomenda
      </div>
      <p className="text-sm text-muted-foreground">
        Ao receber os livros, verifique o conteúdo e assine abaixo.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome de quem recebe *</Label>
          <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>BI / Documento (opcional)</Label>
          <Input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} placeholder="Para verificação" />
        </div>
      </div>

      <SignaturePad
        ref={signatureRef}
        label="Assinatura *"
        hint="Assine com o dedo ou caneta ao receber a encomenda."
      />

      <Button type="submit" className="w-full btn-primary" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
        Confirmar e assinar recepção
      </Button>
    </form>
  );
}
