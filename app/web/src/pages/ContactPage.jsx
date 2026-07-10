import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle, BRAND } from '@/lib/brand';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

const ContactPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${PB_URL}/api/app/contact-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar mensagem');
      toast({
        title: 'Mensagem enviada',
        description: data.message || 'Entraremos em contacto em breve.',
      });
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar',
        description: err.message || 'Tente novamente mais tarde.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle('Contacto')}</title>
        <meta name="description" content={`Entre em contacto com o ${BRAND.name}. Estamos aqui para ajudar.`} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="section-spacing bg-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Contacte-nos</h1>
            <p className="text-muted-foreground text-lg">Teremos todo o gosto em ouvir de si</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold mb-6 text-foreground">Envie-nos uma mensagem</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone (opcional)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="mt-1 bg-input border-border text-foreground"
                  />
                </div>

                <Button type="submit" className="w-full btn-primary" disabled={sending}>
                  {sending ? 'A enviar...' : 'Enviar Mensagem'}
                </Button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-foreground">Informações de Contacto</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-foreground">Email</h3>
                      <p className="text-muted-foreground">{BRAND.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-foreground">Telefone</h3>
                      <p className="text-muted-foreground">{BRAND.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-foreground">Morada</h3>
                      <p className="text-muted-foreground">{BRAND.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-6">
                <h3 className="font-semibold mb-3 text-foreground">Horário de Atendimento</h3>
                <p className="text-muted-foreground text-sm mb-2">Segunda a Sexta: 8h – 17h</p>
                <p className="text-muted-foreground text-sm mb-2">Sábado: 8h – 12h</p>
                <p className="text-muted-foreground text-sm">Domingo: Encerrado</p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default ContactPage;