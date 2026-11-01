import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, ShoppingBag, LayoutDashboard, LogOut, ChevronDown, Settings, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { getUserDisplayName, getUserFirstName } from '@/lib/userUtils';
import { cn } from '@/lib/utils';

export function UserMenu({ compact = false, className }) {
  const { user, isAdmin, canAccessAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'gap-2 px-2 hover:bg-[#0ea5c9]/10 rounded-full h-auto py-1',
            className,
          )}
          aria-label="Menu da conta"
        >
          <UserAvatar user={user} size="md" className="ring-2 ring-[#0ea5c9]/20" />
          {!compact && (
            <>
              <span className="hidden md:flex flex-col items-start text-left leading-tight max-w-[120px]">
                <span className="text-xs text-muted-foreground">Olá,</span>
                <span className="text-sm font-semibold truncate w-full">
                  {getUserFirstName(user)}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block shrink-0" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{getUserDisplayName(user)}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-[#0ea5c9]">
                  <Shield className="h-3 w-3" /> Administrador
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <User className="mr-2" /> Minha Conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" state={{ tab: 'orders' }} className="cursor-pointer">
            <ShoppingBag className="mr-2" /> As Minhas Encomendas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" state={{ tab: 'settings' }} className="cursor-pointer">
            <Settings className="mr-2" /> Definições
          </Link>
        </DropdownMenuItem>

        {canAccessAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin" className="cursor-pointer text-[#0ea5c9]">
                <LayoutDashboard className="mr-2" /> Painel Admin
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
          <LogOut className="mr-2" /> Terminar Sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GuestAuthButton({ className, fullWidth = false }) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-center gap-2', fullWidth && 'flex-col w-full', className)}>
      <Button
        variant="outline"
        size="sm"
        className={cn('rounded-full bg-transparent border-[#0ea5c9]/30 hover:bg-[#0ea5c9]/10', fullWidth && 'w-full')}
        onClick={() => navigate('/login')}
      >
        <User className="h-4 w-4 mr-2" />
        Entrar
      </Button>
      <Button
        size="sm"
        className={cn('btn-primary rounded-full hidden sm:inline-flex', fullWidth && 'w-full sm:flex')}
        onClick={() => navigate('/login')}
      >
        Criar Conta
      </Button>
    </div>
  );
}
