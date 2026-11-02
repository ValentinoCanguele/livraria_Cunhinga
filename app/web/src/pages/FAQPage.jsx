import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle } from '@/lib/brand';

import { FAQ_SECTIONS } from '@/lib/faqData';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const FAQPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { settings } = useSiteSettings();
  // O limite do envio grátis vem das Configurações, para a resposta não ficar desactualizada.
  const freeThreshold = `${(Number(settings.shipping_free_threshold) || 20000).toLocaleString('pt-AO')} Kz`;
  const faqs = FAQ_SECTIONS.map((section) => ({
    ...section,
    questions: section.questions.map((q) => ({ ...q, answer: q.answer.replace('{free_threshold}', freeThreshold) })),
  }));

  return (
    <>
      <Helmet>
        <title>{pageTitle('FAQ')}</title>
        <meta name="description" content="Perguntas frequentes sobre encomendas, envios, devoluções e pagamentos." />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="section-spacing bg-background">
        <div className="container-custom max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Perguntas Frequentes</h1>
            <p className="text-muted-foreground text-lg">Encontre respostas às dúvidas mais comuns</p>
          </motion.div>

          <div className="space-y-8">
            {faqs.map((section, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <h2 className="text-2xl font-semibold mb-4 text-[#0ea5c9]">{section.category}</h2>
                <Accordion type="single" collapsible className="space-y-2">
                  {section.questions.map((faq, j) => (
                    <AccordionItem key={j} value={`${i}-${j}`} className="bg-card border border-border rounded-xl px-6">
                      <AccordionTrigger className="text-left font-medium">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default FAQPage;
