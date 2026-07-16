'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);

        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            window.location.href = '/dashboard';
            return;
          }
        }

        const errorParam = searchParams.get('error');
        if (errorParam) {
          setErrorMessage(
            searchParams.get('error_description') || 'Error de autenticación'
          );
          setStatus('error');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/dashboard';
          return;
        }

        setStatus('success');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Error de verificación'
        );
        setStatus('error');
      }
    };

    handleCallback();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent mx-auto mb-4" />
          <p className="text-[#64748B] text-sm">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#C62828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1B3A5C] font-[Georgia] mb-2">Error de verificación</h1>
          <p className="text-[#64748B] text-sm mb-6">
            {errorMessage || 'No pudimos verificar tu cuenta. El enlace puede haber expirado o ya fue utilizado.'}
          </p>
          <a
            href="/"
            className="inline-block bg-[#1B3A5C] text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-[#2A5A8C] transition-colors"
          >
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#2D8A4E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1B3A5C] font-[Georgia] mb-2">Cuenta confirmada</h1>
        <p className="text-[#64748B] text-sm mb-6">
          Tu cuenta ha sido verificada exitosamente. Ya puedes cerrar esta pestaña e iniciar sesión.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/"
            className="inline-block bg-[#1B3A5C] text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-[#2A5A8C] transition-colors"
          >
            Ir al inicio de sesión
          </a>
          <p className="text-xs text-[#94A3B8]">
            O simplemente cierra esta pestaña
          </p>
        </div>
        <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#94A3B8]">IPADE Business School &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
