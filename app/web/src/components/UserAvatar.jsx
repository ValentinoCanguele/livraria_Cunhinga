import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getUserAvatarUrl, getUserInitials } from '@/lib/userUtils';

export default function UserAvatar({ user, className, fallbackClassName, size = 'md' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
  };

  const avatarUrl = getUserAvatarUrl(user);
  const initials = getUserInitials(user);

  return (
    <Avatar className={cn(sizes[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.name || 'Utilizador'} />}
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-[#0ea5c9] to-[#0c4a6e] text-white font-semibold',
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
