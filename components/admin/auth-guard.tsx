"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { LayoutDashboard, User } from "lucide-react"
import { logger } from "@/lib/logger"

interface AuthGuardProps {
  children: React.ReactNode
}

interface User {
  id: number
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
  permissions: string[]
  lastLogin?: string
}

interface SessionInfo {
  id: string
  rememberMe: boolean
  expiresAt: string
  lastActivity: string
  ipAddress: string
}

interface AuthStatus {
  authenticated: boolean
  user?: User
  session?: SessionInfo
}

interface AuthContextType {
  authStatus: AuthStatus
  hasPermission: (permission: string) => boolean
  handleLogout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthGuard')
  }
  return context
}

// Константы для localStorage
const STORAGE_KEYS = {
  REMEMBERED_USERNAME: 'medsip_admin_remembered_username',
  REMEMBER_PREFERENCE: 'medsip_admin_remember_preference'
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isLoading, setIsLoading] = useState(true)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Загрузка сохраненных данных при инициализации
  useEffect(() => {
    loadSavedCredentials()
    checkAuthStatus()
  }, [])

  const loadSavedCredentials = () => {
    try {
      const savedUsername = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USERNAME)
      const savedRememberPreference = localStorage.getItem(STORAGE_KEYS.REMEMBER_PREFERENCE)

      if (savedUsername && savedRememberPreference === 'true') {
        setCredentials(prev => ({ ...prev, username: savedUsername }))
        setRememberMe(true)
      }
    } catch (error) {
      console.warn('Failed to load saved credentials:', error)
    }
  }

  const saveSavedCredentials = (username: string, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem(STORAGE_KEYS.REMEMBERED_USERNAME, username)
        localStorage.setItem(STORAGE_KEYS.REMEMBER_PREFERENCE, 'true')
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USERNAME)
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_PREFERENCE)
      }
    } catch (error) {
      console.warn('Failed to save credentials:', error)
    }
  }

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/admin/auth/status', {
        method: 'GET',
        credentials: 'include', // Важно для передачи cookies
      })

      if (response.ok) {
        const data = await response.json()
        setAuthStatus(data)
      } else {
        setAuthStatus({ authenticated: false })
      }
    } catch (error) {
      console.error('Auth status check failed:', error)
      setAuthStatus({ authenticated: false })
    } finally {
      setIsLoading(false)
    }
  }

  // Проверка прав доступа
  const _hasPermission = (permission: string): boolean => {
    if (!authStatus.authenticated || !authStatus.user) return false

    const permissions = authStatus.user.permissions || []

    // Супер-админ имеет все права
    if (permissions.includes('*')) return true

    // Проверка точного совпадения
    if (permissions.includes(permission)) return true

    // Проверка wildcard разрешений (например, products.* для products.read)
    return permissions.some(perm => {
      if (perm.endsWith('*')) {
        const basePermission = perm.slice(0, -1)
        return permission.startsWith(basePermission)
      }
      return false
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно для установки cookies
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          rememberMe
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Сохраняем учетные данные если нужно
        saveSavedCredentials(credentials.username, rememberMe)

        // Обновляем статус с данными пользователя
        setAuthStatus({
          authenticated: true,
          user: data.user
        })

        setCredentials({ username: credentials.username, password: "" }) // Очищаем только пароль

        logger.info('User logged in successfully', {
          username: data.user.username,
          role: data.user.role
        })
      } else {
        setError(data.error || 'Ошибка аутентификации')
      }
    } catch (error) {
      console.error('Login failed:', error)
      setError('Ошибка соединения с сервером')
    } finally {
      setIsSubmitting(false)
    }
  }

  const _handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        setAuthStatus({ authenticated: false })
        // Сохраняем только логин если "запомнить меня" включено
        if (!rememberMe) {
          setCredentials({ username: "", password: "" })
          saveSavedCredentials("", false)
        } else {
          setCredentials(prev => ({ ...prev, password: "" }))
        }

        logger.info('User logged out')
      }
    } catch (error) {
      console.error('Logout failed:', error)
      // В любом случае сбрасываем состояние локально
      setAuthStatus({ authenticated: false })
      if (!rememberMe) {
        setCredentials({ username: "", password: "" })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    )
  }

  if (!authStatus.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-gray-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-normal text-gray-700">Вход в админ панель</CardTitle>
            <p className="text-gray-500 text-sm">Система управления MedSIP-Protez</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Введите имя пользователя"
                  required
                  disabled={isSubmitting}
                  className="transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Введите пароль"
                  required
                  disabled={isSubmitting}
                  className="transition-colors"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                  disabled={isSubmitting}
                />
                <Label htmlFor="remember-me" className="text-sm text-gray-600">
                  Запомнить меня
                </Label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gray-700 hover:bg-gray-800 text-white py-2.5 transition-colors"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Вход...
                  </div>
                ) : (
                  'Войти в систему'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const contextValue: AuthContextType = {
    authStatus,
    hasPermission,
    handleLogout
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
