"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useNext2025Auth } from '@/contexts/next2025-auth-context'
import { toast } from 'sonner'
import { UserCircle, Mail, Lock, User, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { Bebas_Neue } from 'next/font/google'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

type AuthMode = 'login' | 'register'

export default function AuthPage() {
  const router = useRouter()
  const { login, register } = useNext2025Auth()
  const [activeTab, setActiveTab] = useState<AuthMode>('login')
  const [authLoading, setAuthLoading] = useState(false)
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })

  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    
    try {
      await login(loginData.email, loginData.password)
      toast.success('Login realizado com sucesso!')
      router.push('/next2025')
      setLoginData({ email: '', password: '' })
    } catch (error: any) {
      toast.error(error.message || 'Credenciais inválidas')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(registerData.email)) {
      toast.error('Por favor, insira um email válido')
      setAuthLoading(false)
      return
    }

    // Validações
    if (registerData.password !== registerData.confirmPassword) {
      toast.error('As senhas não coincidem')
      setAuthLoading(false)
      return
    }

    if (registerData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      setAuthLoading(false)
      return
    }

    try {
      await register(registerData.name, registerData.email, registerData.password)
      toast.success('Conta criada com sucesso!')
      router.push('/next2025')
      setRegisterData({ name: '', email: '', password: '', confirmPassword: '' })
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível criar a conta')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header with Logo */}
      <header className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Copa Passa Bola"
                fill
                className="object-contain"
              />
            </div>
            <span className={`${bebasNeue.className} text-2xl font-bold text-[#8e44ad] dark:text-pink-400 tracking-wider`}>
              PASSA BOLA
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Acesse sua conta</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Entre ou crie uma conta para acessar todas as funcionalidades
              </p>
            </div>

            {/* Tabs */}
            <div className="px-6">
              <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`pb-3 px-1 font-medium text-sm transition-colors border-b-2 -mb-px ${
                    activeTab === 'login'
                      ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`pb-3 px-1 font-medium text-sm transition-colors border-b-2 -mb-px ${
                    activeTab === 'register'
                      ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Criar conta
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 pt-4">
              {activeTab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-11"
                        value={loginData.email}
                        onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-[#8e44ad] hover:bg-[#7d3c98] text-white font-medium mt-6" 
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Entrar
                      </>
                    )}
                  </Button>
                </form>
              )}

              {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Seu nome completo"
                        className="pl-10 h-11"
                        value={registerData.name}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-11"
                        value={registerData.email}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mínimo 6 caracteres</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirmar senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-[#8e44ad] hover:bg-[#7d3c98] text-white font-medium mt-6" 
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Criar conta
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
