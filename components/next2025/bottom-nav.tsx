'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Trophy, Gift, History, Link as LinkIcon } from 'lucide-react';

const navItems = [
  {
    name: 'Início',
    href: '/next2025',
    icon: Home,
  },
  {
    name: 'Ranking',
    href: '/next2025/leaderboard',
    icon: Trophy,
  },
  {
    name: 'Pulseira',
    href: '/next2025/vincular-pulseira',
    icon: LinkIcon,
  },
  {
    name: 'Histórico',
    href: '/next2025/historico',
    icon: History,
  },
];

export function Next2025BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-safe">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
