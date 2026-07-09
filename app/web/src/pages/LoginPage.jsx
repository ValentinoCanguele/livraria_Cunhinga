import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BrandLogo from '@/components/BrandLogo';
import { pageTitle } from '@/lib/brand';
import { withCacheBust } from '@/lib/imageUrl';

const LoginPage = () => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, loginWithGoogle } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const bgImage = withCacheBust(
    settings.login_bg_url || 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80',
    settings.assets_version,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password, name);
      toast({ title: 'Bem-vindo!' });
      navigate('/profile');
    } catch {
      toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Verifique as suas credenciais.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast({ title: 'Bem-vindo!' });
      navigate('/profile');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Google não disponível',
        description: 'Configure OAuth no PocketBase Admin ou use email/password.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>{pageTitle('Entrar')}</title></Helmet>
      <div className="min-h-screen grid lg:grid-cols-2 bg-background">
        <div className="relative hidden lg:block">
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c4a6e]/95 via-[#0c4a6e]/40 to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <BrandLogo linkTo="/" variant="light" className="mb-6" />
            <h2 className="text-3xl font-bold mb-3">{settings.site_name}</h2>
            <p className="text-white/80 text-lg max-w-md">{settings.tagline || 'A sua livraria online'}</p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            <div className="mb-8 lg:hidden"><BrandLogo /></div>

            <h1 className="text-2xl font-bold mb-1">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {mode === 'login' ? 'Aceda à sua conta para comprar e acompanhar encomendas.' : 'Junte-se em segundos.'}
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full mb-4 py-6 border-2"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com Google
            </Button>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou com email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" required />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  {mode === 'login' && (
                    <Link to="/forgot-password" className="text-xs text-[#0ea5c9] hover:underline">Esqueceu?</Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required minLength={8} />
                </div>
              </div>
              <Button type="submit" className="w-full btn-primary py-6 text-base" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {mode === 'login' ? 'Entrar' : 'Criar Conta'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-[#0ea5c9] font-medium hover:underline">
                {mode === 'login' ? 'Registe-se' : 'Entrar'}
              </button>
            </p>

            <p className="text-center mt-4">
              <Link to="/track" className="text-xs text-muted-foreground hover:text-[#0ea5c9]">Rastrear encomenda</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
