import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle, BRAND } from '@/lib/brand';

const faqs = [
  {
    category: 'Encomendas e Envios',
    questions: [
      { question: 'Quanto tempo demora a entrega?', answer: 'A entrega padrão demora 5 a 7 dias úteis em Luanda e 7 a 14 dias para outras províncias. Envio expresso disponível mediante consulta.' },
      { question: 'Oferecem envio grátis?', answer: 'Sim, envio grátis para encomendas acima de 20.000 Kz em todo o território nacional.' },
      { question: 'Posso acompanhar a minha encomenda?', answer: 'Sim! Após o envio, receberá um email com o número de rastreamento para acompanhar a entrega.' },
    ],
  },
  {
    category: 'Devoluções',
    questions: [
      { question: 'Qual é a política de devolução?', answer: 'Aceitamos devoluções em até 30 dias, desde que o livro esteja em bom estado e na embalagem original.' },
      { question: 'Como inicio uma devolução?', answer: `Contacte-nos em ${BRAND.email} ou pelo formulário de contacto. Enviaremos as instruções de devolução.` },
    ],
  },
  {
    category: 'Pagamentos',
    questions: [
      { question: 'Que métodos de pagamento aceitam?', answer: 'Aceitamos transferência bancária, Multicaixa Express e pagamento na entrega (mediante disponibilidade na sua zona).' },
      { question: 'Os meus dados estão seguros?', answer: 'Sim, utilizamos ligações encriptadas e não armazenamos dados de pagamento nos nossos servidores.' },
    ],
  },
];

const FAQPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

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
