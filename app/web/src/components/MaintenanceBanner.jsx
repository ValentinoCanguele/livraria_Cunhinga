import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';

export default function MaintenanceBanner() {
  const { settings } = useSiteSettings();
  const { canAccessAdmin, isAuthed } = useAuth();

  if (!settings?.maintenance_mode || !isAuthed || !canAccessAdmin) return null;

  return (
    <div className="bg-amber-500 text-amber-950 text-center text-sm py-2 px-4 flex items-center justify-center gap-2 flex-wrap">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Modo manutenção activo — visitantes veem a página de manutenção; checkout bloqueado.</span>
      <Link to="/admin" className="underline font-medium hover:text-amber-900">Painel admin</Link>
    </div>
  );
}
