import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Truck, Package, RotateCcw, Clock } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { pageTitle } from '@/lib/brand';
import PageBannerSlider from '@/components/PageBannerSlider';

const ShippingReturnsPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>{pageTitle('Envios e Devoluções')}</title>
        <meta name="description" content="Informações sobre envios, prazos de entrega e política de devoluções." />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <PageBannerSlider>
        <h1 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">Envios e Devoluções</h1>
        <p className="text-base text-white/85 sm:text-lg">Tudo o que precisa saber sobre entregas e devoluções</p>
      </PageBannerSlider>

      <main className="section-spacing bg-background">
        <div className="container-custom max-w-4xl">
          <div className="space-y-12">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-semibold text-foreground">Shipping Options</h2>
              </div>

              <div className="space-y-6 bg-card border border-border rounded-xl p-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Standard Shipping</h3>
                  <p className="text-muted-foreground mb-2">Free on orders over $100 (5-7 business days)</p>
                  <p className="text-muted-foreground">$15 flat rate for orders under $100</p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Express Shipping</h3>
                  <p className="text-muted-foreground mb-2">2-3 business days</p>
                  <p className="text-muted-foreground">$35 flat rate</p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">White Glove Delivery</h3>
                  <p className="text-muted-foreground mb-2">Professional delivery, assembly, and setup (2-3 weeks)</p>
                  <p className="text-muted-foreground">Starting at $149 (varies by item and location)</p>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-semibold text-foreground">Order Processing</h2>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <p className="text-muted-foreground">
                  Orders are processed within 1-2 business days. You'll receive a confirmation email once your order ships with tracking information.
                </p>
                <p className="text-muted-foreground">
                  Please note that processing times may be longer during peak seasons or for custom orders.
                </p>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-semibold text-foreground">Returns Policy</h2>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">30-Day Return Window</h3>
                  <p className="text-muted-foreground">
                    We want you to love your purchase. If you're not completely satisfied, you can return most items within 30 days of delivery for a full refund.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">Return Requirements</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Items must be in original condition with all packaging</li>
                    <li>Products must be unused and unassembled (if applicable)</li>
                    <li>Include all accessories, manuals, and documentation</li>
                    <li>Custom or personalized items are final sale</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">How to Return</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Contact our customer service team at support@haven.com</li>
                    <li>Receive your return authorization and prepaid shipping label</li>
                    <li>Pack the item securely in its original packaging</li>
                    <li>Drop off at any authorized shipping location</li>
                    <li>Receive your refund within 5-7 business days after we receive the item</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">Return Shipping</h3>
                  <p className="text-muted-foreground">
                    Return shipping is free for defective or damaged items. For standard returns, a $25 return shipping fee will be deducted from your refund.
                  </p>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-semibold text-foreground">Exchanges</h2>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <p className="text-muted-foreground">
                  Need a different size or color? We're happy to help with exchanges. Contact our customer service team, and we'll arrange an exchange at no additional cost.
                </p>
                <p className="text-muted-foreground">
                  Exchanges are subject to product availability. If your preferred item is out of stock, we'll process a full refund.
                </p>
              </div>
            </motion.section>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 text-center bg-muted/30 rounded-xl p-8"
          >
            <h3 className="text-xl font-semibold mb-3 text-foreground">Questions about shipping or returns?</h3>
            <p className="text-muted-foreground mb-4">Our customer support team is here to help</p>
            <a href="/contact" className="inline-block px-4 py-2 text-primary hover:underline font-medium">
              Contact Us
            </a>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default ShippingReturnsPage;