'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Next2025AuthProvider, useNext2025Auth } from '@/contexts/next2025-auth-context';
import { Next2025BottomNav } from '@/components/next2025/bottom-nav';
import { Toaster } from '@/components/ui/sonner';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useNext2025Auth();
  const router = useRouter();
  const pathname = usePathname();

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/next2025/auth', '/next2025/game-display'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  // Rotas que não devem redirecionar quando logado (ex: game-display para TV)
  const noRedirectWhenLoggedIn = ['/next2025/game-display'];
  const shouldNotRedirect = noRedirectWhenLoggedIn.includes(pathname);
  
  // Rotas que não devem mostrar a navbar
  const hideNavRoutes = ['/next2025/game-display'];
  const shouldHideNav = hideNavRoutes.includes(pathname);

  useEffect(() => {
    if (!loading) {
      if (!user && !isPublicRoute) {
        router.push('/next2025/auth');
      } else if (user && isPublicRoute && !shouldNotRedirect) {
        router.push('/next2025');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isPublicRoute]);

  // Mostrar loading apenas em rotas protegidas
  if (loading && !isPublicRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Em rotas públicas, sempre mostrar o conteúdo
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Em rotas protegidas, só mostrar se tiver usuário
  if (!user) {
    return null;
  }

  return (
    <>
      {children}
      {!shouldHideNav && <Next2025BottomNav />}
    </>
  );
}

export default function Next2025Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Next2025AuthProvider>
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20">
          {children}
        </div>
        <Toaster position="top-center" />
      </AuthGuard>
    </Next2025AuthProvider>
  );
}
