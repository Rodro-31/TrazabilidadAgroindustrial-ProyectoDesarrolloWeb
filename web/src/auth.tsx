import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { cerrarSesion, iniciarSesion, leerSesion, type Sesion } from './api';

interface Contexto {
  sesion: Sesion | null;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
}

const AuthContext = createContext<Contexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);

  // api.ts avisa con este evento cuando el servidor rechaza el refresh token.
  useEffect(() => {
    const vencida = () => setSesion(null);
    window.addEventListener('sesion-expirada', vencida);
    return () => window.removeEventListener('sesion-expirada', vencida);
  }, []);

  const entrar = useCallback(async (email: string, password: string) => {
    setSesion(await iniciarSesion(email, password));
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesion();
    setSesion(null);
  }, []);

  return <AuthContext.Provider value={{ sesion, entrar, salir }}>{children}</AuthContext.Provider>;
}

export function useAuth(): Contexto {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
