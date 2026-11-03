import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import BrandLogo from '@/components/BrandLogo';
import { pageTitle } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { requestPasswordReset } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
      toast({ title: 'Email enviado', description: 'Verifique a sua caixa de entrada.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o email.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>{pageTitle('Recuperar Password')}</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 text-center"><BrandLogo linkTo="/" /></div>
          <div className="bg-card border rounded-2xl p-8 shadow-lg">
            <h1 className="text-2xl font-bold mb-2">Recuperar Password</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Introduza o email da sua conta. Enviaremos um link para redefinir a password.
            </p>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm">Se o email existir, receberá instruções em breve.</p>
                <Link to="/login"><Button variant="outline" className="w-full">Voltar ao Login</Button></Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <Button type="submit" className="w-full btn-primary py-6" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Link
                </Button>
              </form>
            )}
            <Link to="/login" className="flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground mt-4 hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Voltar ao login
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
}
