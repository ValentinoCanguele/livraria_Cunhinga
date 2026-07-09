import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import BrandLogo from '@/components/BrandLogo';
import { pageTitle } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { confirmPasswordReset } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ variant: 'destructive', title: 'As passwords não coincidem' });
      return;
    }
    if (password.length < 8) {
      toast({ variant: 'destructive', title: 'Mínimo 8 caracteres' });
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      toast({ variant: 'destructive', title: 'Link inválido ou expirado' });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">Link inválido.</p>
          <Link to="/forgot-password"><Button variant="outline">Pedir novo link</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>{pageTitle('Nova Password')}</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 text-center"><BrandLogo linkTo="/" /></div>
          <div className="bg-card border rounded-2xl p-8 shadow-lg">
            {done ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <h1 className="text-xl font-bold">Password alterada!</h1>
                <p className="text-sm text-muted-foreground">A redireccionar para o login...</p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-6">Nova Password</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nova password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar</Label>
                    <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full btn-primary py-6" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Password
                  </Button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
