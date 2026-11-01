import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, Server, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BrandLogo from '@/components/BrandLogo';
import { pageTitle } from '@/lib/brand';
import { withCacheBust } from '@/lib/imageUrl';
import { checkPocketBaseHealth } from '@/lib/pbAuth';

const LoginPage = () => {
  const location = useLocation();
  // ?redirect= só aceita caminhos internos (evita redireccionar para outros sites).
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectTo = location.state?.from || (redirectParam?.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : null);

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => sessionStorage.getItem('livraria_login_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState(null);
  const { login, signup, loginWithGoogle } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  useEffect(() => {
    checkPocketBaseHealth().then(setServerOk);
    const interval = setInterval(() => checkPocketBaseHealth().then(setServerOk), 20000);
    return () => clearInterval(interval);
  }, []);

  const bgImage = withCacheBust(
    settings.login_bg_url || 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80',
    settings.assets_version,
  );

  const afterAuthNavigate = (authRecord) => {
    if (redirectTo) {
      navigate(redirectTo);
      return;
    }
    const role = authRecord?.role;
    if (role === 'admin' || role === 'manager') {
      navigate('/admin');
      return;
    }
    navigate('/profile');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (serverOk === false) {
      toast.error('Servidor offline', {
        description: 'Não foi possível contactar o servidor. Verifique a ligação à internet.',
      });
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem('livraria_login_email', email.trim());
      const authData = mode === 'login'
        ? await login(email, password)
        : await signup(email, password, name);
      if (mode === 'login') {
        toast.success('Sessão iniciada com sucesso!', {
          description: `Bem-vindo de volta, ${authData.record?.name || 'utilizador'}!`,
        });
      } else {
        toast.success('Conta criada com sucesso!', {
          description: `Seja muito bem-vindo, ${name}!`,
        });
      }
      afterAuthNavigate(authData.record);
    } catch (err) {
      toast.error('Erro de autenticação', {
        description: err.message || 'Verifique se as suas credenciais de e-mail e palavra-passe estão corretas.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      // Sai da página para a Google e volta já com a sessão iniciada.
      await loginWithGoogle(redirectTo || '/profile');
    } catch (err) {
      toast.error('Google não disponível', {
        description: err?.message || 'Por favor, tente autenticar usando o seu e-mail e palavra-passe.',
      });
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>{pageTitle('Entrar')}</title></Helmet>
      <div className="min-h-screen grid lg:grid-cols-2 bg-background">
        <div className="relative hidden lg:block">
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c4a6e]/95 via-[#0c4a6e]/50 to-[#0c4a6e]/20" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <BrandLogo linkTo="/" variant="light" className="mb-6" />
            <h2 className="text-3xl font-bold mb-3">{settings.site_name}</h2>
            <p className="text-white/85 text-lg max-w-md leading-relaxed">{settings.tagline || 'Literatura que edifica e transforma'}</p>
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Compra segura</span>
              <span className="flex items-center gap-1.5"><Server className="h-4 w-4" /> Encomendas em tempo real</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-muted/30 to-background">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="mb-6 lg:hidden flex justify-center"><BrandLogo /></div>

            <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    {mode === 'login' ? 'Aceda à sua conta de cliente ou administrador.' : 'Registe-se em segundos.'}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border ${serverOk ? 'text-green-700 bg-green-500/10 border-green-500/30' : serverOk === false ? 'text-red-700 bg-red-500/10 border-red-500/30' : 'text-muted-foreground'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${serverOk ? 'bg-green-500' : serverOk === false ? 'bg-red-500' : 'bg-muted-foreground animate-pulse'}`} />
                  {serverOk ? 'Servidor OK' : serverOk === false ? 'Servidor offline' : 'A verificar...'}
                </div>
              </div>

              {serverOk === false && (
                <div className="mb-4 flex gap-2 text-xs text-amber-900 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Não foi possível contactar o servidor. Verifique a ligação à internet e tente novamente.</p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full mb-4 py-6 border-2 hover:bg-muted/50"
                onClick={handleGoogle}
                disabled={loading}
              >
                <svg className="h-5 w-5 mr-2 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuar com Google
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou com email</span></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="pl-9 h-11" required />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-11"
                      placeholder="admin@livraria.ao"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Palavra-passe</Label>
                    {mode === 'login' && (
                      <Link to="/forgot-password" className="text-xs text-[#0ea5c9] hover:underline">Esqueceu?</Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10 h-11"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPass((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full btn-primary py-6 text-base" disabled={loading || serverOk === false}>
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
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-muted-foreground">
              <Link to="/track" className="hover:text-[#0ea5c9]">Rastrear encomenda</Link>
              <Link to="/shop" className="hover:text-[#0ea5c9]">Ir à loja</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
