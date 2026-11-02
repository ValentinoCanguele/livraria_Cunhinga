import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BookOpen, Users, Heart, Globe } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle, BRAND } from '@/lib/brand';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const values = [
  { icon: BookOpen, title: 'Literatura de Qualidade', description: 'Publicações cuidadosamente selecionadas para edificar, educar e inspirar leitores de todas as idades.' },
  { icon: Users, title: 'Para Toda a Família', description: 'Livros infantis, juvenis e adultos — recursos para cada fase da jornada de fé.' },
  { icon: Heart, title: 'Missão e Propósito', description: 'Cada publicação reflete o compromisso de partilhar a mensagem de esperança e amor.' },
  { icon: Globe, title: 'Alcance Nacional', description: 'Entregamos em todo o território angolano, levando literatura cristã a cada canto do país.' },
];

const AboutPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { settings } = useSiteSettings();
  // Escolhidas em Configurações → Página Sobre (galeria de imagens prontas). Vazio = a que
  // vem com o site.
  const topImage = settings.about_top_image_url || '/images/site/sobre-topo.webp';
  const sideImage = settings.about_side_image_url || '/images/site/sobre-livros.webp';

  return (
    <>
      <Helmet>
        <title>{pageTitle('Sobre Nós')}</title>
        <meta name="description" content={`Conheça o ${BRAND.name} — a nossa missão de difundir literatura cristã e educacional.`} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main>
        <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img src={topImage} alt="Capas de livros do catálogo da livraria" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c4a6e]/80 to-[#0ea5c9]/40" />
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10 container-custom text-center text-white">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">A Nossa História</h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              Difundindo literatura que transforma vidas desde o coração de Angola
            </p>
          </motion.div>
        </section>

        <section className="section-spacing bg-background">
          <div className="container-custom">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <h2 className="text-4xl font-bold mb-6">Palavras que edificam, histórias que inspiram</h2>
                <p className="text-muted-foreground text-lg mb-4">
                  A {BRAND.name} nasceu com a missão de tornar acessível literatura cristã adventista de qualidade a famílias, igrejas e comunidades em todo o país.
                </p>
                <p className="text-muted-foreground text-lg mb-4">
                  Do clássico «Caminho a Cristo» às obras de Ellen G. White, passando por publicações infantis e manuais educativos — o nosso catálogo foi pensado para cada leitor.
                </p>
                <p className="text-muted-foreground text-lg">
                  Acreditamos que um bom livro pode mudar uma vida. Por isso, selecionamos cada título com cuidado e dedicação.
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative h-[500px] rounded-2xl overflow-hidden">
                <img src={sideImage} alt="Livros do catálogo da livraria" loading="lazy" className="w-full h-full object-cover" />
              </motion.div>
            </div>
          </div>
        </section>

        <section className="section-spacing bg-muted/30">
          <div className="container-custom">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Os Nossos Valores</h2>
              <p className="text-muted-foreground text-lg">O que nos move todos os dias</p>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="bg-card rounded-xl p-8 border border-border">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0ea5c9]/10 mb-4">
                    <value.icon className="h-6 w-6 text-[#0ea5c9]" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default AboutPage;
