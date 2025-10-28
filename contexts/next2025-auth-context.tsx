'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Next2025User, 
  createNext2025User, 
  loginNext2025User,
  getNext2025User 
} from '@/lib/next2025-service';

interface Next2025AuthContextType {
  user: Next2025User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: Next2025User; error?: any }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; user?: Next2025User; error?: any }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Next2025AuthContext = createContext<Next2025AuthContextType | undefined>(undefined);

export function Next2025AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Next2025User | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar usuário do localStorage ao iniciar
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUserId = localStorage.getItem('next2025UserId');
        if (storedUserId) {
          const userData = await getNext2025User(storedUserId);
          if (userData) {
            setUser(userData);
          } else {
            localStorage.removeItem('next2025UserId');
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await loginNext2025User(email, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem('next2025UserId', result.user.id);
        return { success: true, user: result.user };
      }
      
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error?.message || 'Erro ao fazer login';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Erro inesperado ao fazer login' 
      };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const result = await createNext2025User({ name, email, password });
      
      if (result.success && result.userId) {
        // Fazer login automaticamente após o cadastro
        const loginResult = await login(email, password);
        return loginResult;
      }
      
      const errorMessage = typeof result.error === 'string' 
        ? result.error 
        : result.error?.message || 'Erro ao criar conta';
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } catch (error) {
      console.error('Register error:', error);
      return { 
        success: false, 
        error: 'Erro inesperado ao criar conta' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('next2025UserId');
  };

  const refreshUser = async () => {
    if (user) {
      const userData = await getNext2025User(user.id);
      if (userData) {
        setUser(userData);
      }
    }
  };

  return (
    <Next2025AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        login, 
        register, 
        logout,
        refreshUser 
      }}
    >
      {children}
    </Next2025AuthContext.Provider>
  );
}

export function useNext2025Auth() {
  const context = useContext(Next2025AuthContext);
  if (context === undefined) {
    throw new Error('useNext2025Auth must be used within Next2025AuthProvider');
  }
  return context;
}
