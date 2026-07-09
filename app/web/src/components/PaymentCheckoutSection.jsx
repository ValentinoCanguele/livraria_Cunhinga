import React from 'react';
import { CreditCard, Store, Truck, Smartphone, QrCode } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  PAYMENT_CATEGORIES,
  GATEWAY_PROVIDERS,
  groupPaymentMethods,
  getAvailableCategories,
  methodRequiresReference,
  normalizePaymentMethod,
} from '@/lib/paymentUtils';

const CATEGORY_ICONS = {
  gateway: CreditCard,
  balcao: Store,
  on_delivery: Truck,
};

function MethodDetails({ method, showReference, reference, onReferenceChange }) {
  const m = normalizePaymentMethod(method);
  const providerLabel = m.gateway_provider ? (GATEWAY_PROVIDERS[m.gateway_provider] || m.gateway_provider) : null;

  return (
    <div className="ml-1 mt-2 space-y-3 rounded-lg border border-[var(--brand-primary)]/20 bg-[rgb(var(--brand-primary-rgb)/0.04)] p-3">
      {providerLabel && (
        <p className="text-xs font-medium text-[var(--brand-primary)] flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Gateway: {providerLabel}
        </p>
      )}
      {m.account_info && (
        <p className="text-xs font-mono bg-background rounded-md px-2 py-1.5 border">
          {m.account_info}
        </p>
      )}
      {m.instructions && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{m.instructions}</p>
      )}
      {m.qr_url && (
        <div className="flex items-start gap-3">
          <img src={m.qr_url} alt="QR pagamento" className="h-28 w-28 rounded-lg border bg-white object-contain" />
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
            <QrCode className="h-3 w-3" /> Leia o QR com a app do seu banco
          </p>
        </div>
      )}
      {showReference && (
        <div className="space-y-1.5">
          <Label className="text-xs">Referência / comprovativo *</Label>
          <Input
            placeholder="Ex.: número da transferência ou referência Multicaixa"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            A equipa confirmará o pagamento após verificar a referência.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PaymentCheckoutSection({
  methods = [],
  paymentCategory,
  paymentMethod,
  paymentReference,
  onCategoryChange,
  onMethodChange,
  onReferenceChange,
  physicalStores = [],
}) {
  const grouped = groupPaymentMethods(methods);
  const categories = getAvailableCategories(methods);
  const selectedMethods = grouped[paymentCategory] || [];
  const activeMethod = selectedMethods.find((m) => m.code === paymentMethod) || selectedMethods[0];

  if (categories.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 rounded-lg border">
        Nenhum método de pagamento disponível. Contacte a loja.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        value={paymentCategory}
        onValueChange={(cat) => {
          const first = grouped[cat]?.[0];
          onCategoryChange(cat, first?.code || '');
        }}
      >
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || CreditCard;
          const isActive = paymentCategory === cat.id;
          return (
            <div key={cat.id} className="space-y-0">
              <div
                className={`flex items-start space-x-2 p-3 rounded-xl border transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/0.06)] shadow-sm'
                    : 'hover:bg-muted/40'
                }`}
                onClick={() => {
                  const first = grouped[cat.id]?.[0];
                  onCategoryChange(cat.id, first?.code || '');
                }}
              >
                <RadioGroupItem value={cat.id} id={`pay-cat-${cat.id}`} className="mt-1" />
                <Label htmlFor={`pay-cat-${cat.id}`} className="cursor-pointer flex-1">
                  <span className="font-semibold flex items-center gap-2">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-[var(--brand-primary)]/15' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-[var(--brand-primary)]' : 'text-muted-foreground'}`} />
                    </span>
                    {cat.label}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{cat.description}</span>
                </Label>
              </div>

              {isActive && cat.id === 'gateway' && selectedMethods.length > 1 && (
                <div className="ml-4 mt-2 space-y-2 border-l-2 border-[var(--brand-primary)]/20 pl-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Gateway de pagamento</p>
                  <RadioGroup value={paymentMethod} onValueChange={onMethodChange}>
                    {selectedMethods.map((m) => (
                      <div
                        key={m.code}
                        className={`flex items-center space-x-2 p-2.5 rounded-lg border text-sm cursor-pointer ${
                          paymentMethod === m.code ? 'border-[var(--brand-primary)]/40 bg-background' : 'hover:bg-muted/30'
                        }`}
                        onClick={() => onMethodChange(m.code)}
                      >
                        <RadioGroupItem value={m.code} id={`gw-${m.code}`} />
                        <Label htmlFor={`gw-${m.code}`} className="cursor-pointer flex-1">
                          <span className="font-medium flex items-center gap-1.5">
                            {m.icon && <span>{m.icon}</span>}
                            {m.name}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {isActive && activeMethod && (
                <MethodDetails
                  method={activeMethod}
                  showReference={methodRequiresReference(activeMethod)}
                  reference={paymentReference}
                  onReferenceChange={onReferenceChange}
                />
              )}

              {isActive && cat.id === 'balcao' && physicalStores.length > 0 && (
                <div className="ml-4 mt-2 rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium mb-2">Lojas disponíveis para pagamento</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {physicalStores.slice(0, 4).map((s) => (
                      <li key={s.id} className="flex items-start gap-1.5">
                        <Store className="h-3 w-3 shrink-0 mt-0.5 text-[var(--brand-primary)]" />
                        <span>
                          <strong className="text-foreground">{s.name}</strong>
                          {s.address && <span className="block">{s.address}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
