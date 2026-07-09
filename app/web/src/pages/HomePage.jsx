import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Truck, Package, RotateCcw, Mail } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getFeaturedProducts, subscribeNewsletter } from '@/api/EcommerceApi';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import HeroSlider from '@/components/HeroSlider.jsx';
import { pageTitle, BRAND } from '@/lib/brand';

const trustSignals = [
  { icon: Truck, title: 'Envio Grátis acima de 20.000 Kz', description: 'Para todo o país' },
  { icon: Package, title: 'Pagamento Flexível', description: 'Na entrega ou transferência' },
  { icon: RotateCcw, title: 'Devolução em 30 dias', description: 'Sem complicações' },
];

const HomePage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    getFeaturedProducts(8)
      .then((res) => setProducts(res.products))
      .catch(console.error);
  }, []);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await subscribeNewsletter(email);
      toast({ title: 'Subscrição realizada com sucesso!' });
      setEmail('');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível subscrever.', variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle('Livros e Histórias')}</title>
        <meta name="description" content={`${BRAND.name} — literatura cristã adventista, educação e inspiração.`} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main>
        <HeroSlider />

        <section className="section-spacing bg-muted/30">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Destaques</h2>
              <p className="text-muted-foreground text-lg">Os títulos preferidos dos nossos leitores</p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.slice(0, 4).map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ProductCard product={product} onCartOpen={() => setIsCartOpen(true)} index={index} />
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link to="/shop">
                <Button size="lg" variant="outline" className="border-[#0ea5c9] text-[#0ea5c9] hover:bg-[#0ea5c9] hover:text-white">
                  Ver Todos os Livros
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="section-spacing bg-background">
          <div className="container-custom">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trustSignals.map((signal, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0ea5c9]/10 mb-4">
                    <signal.icon className="h-8 w-8 text-[#0ea5c9]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{signal.title}</h3>
                  <p className="text-muted-foreground">{signal.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-spacing bg-secondary/20">
          <div className="container-custom">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Junte-se à Nossa Comunidade</h2>
              <p className="text-muted-foreground text-lg mb-8">
                Subscreva e receba novidades sobre lançamentos e promoções da {BRAND.name}
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <Input type="email" placeholder="O seu email" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex-1" />
                <Button type="submit" className="btn-primary">
                  <Mail className="h-4 w-4 mr-2" />
                  Subscrever
                </Button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default HomePage;
