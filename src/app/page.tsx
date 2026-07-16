'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const { user, loading, signIn, signUp, signInWithMicrosoft } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
      } else {
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setError(error.message);
        } else {
          setSignUpSuccess(true);
        }
      }
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.');
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-bg flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full border-2 border-white" />
          <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full border-2 border-white" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full border border-white" />
        </div>

        <div className="relative z-10">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png"
            alt="IPADE Business School"
            className="h-20 w-auto mb-6 drop-shadow-lg"
          />
          <h1 className="text-4xl font-bold font-[Georgia] leading-tight">
            Plataforma de<br />Encuestas
          </h1>
          <div className="w-16 h-1 bg-[#C4A84D] mt-4 rounded-full" />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Encuestas Profesionales</h3>
              <p className="text-white/70 text-sm mt-1">Crea encuestas con más de 15 tipos de preguntas y lógica avanzada</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Flujo Inteligente</h3>
              <p className="text-white/70 text-sm mt-1">Ramificaciones, aleatorización y datos embebidos</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Análisis en Tiempo Real</h3>
              <p className="text-white/70 text-sm mt-1">Visualiza resultados al instante con gráficos interactivos</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-sm">
          IPADE Business School &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png"
              alt="IPADE"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-[#1B3A5C] font-[Georgia]">IPADE</h1>
              <p className="text-xs text-[#64748B]">Plataforma de Encuestas</p>
            </div>
          </div>

          {signUpSuccess ? (
            <div className="animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-center text-[#1B3A5C] font-[Georgia]">
                ¡Cuenta creada!
              </h2>
              <p className="text-[#64748B] text-center mt-3">
                Revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.
              </p>
              <button
                onClick={() => { setIsLogin(true); setSignUpSuccess(false); }}
                className="btn-primary w-full mt-8 justify-center"
              >
                Ir a Iniciar Sesión
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-[#1B3A5C] font-[Georgia]">
                {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
              </h2>
              <p className="text-[#64748B] mt-2 mb-8">
                {isLogin
                  ? 'Inicia sesión para acceder a tus encuestas'
                  : 'Registra una cuenta para comenzar a crear encuestas'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium mb-1.5">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field"
                      placeholder="Tu nombre completo"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200 animate-fade-in">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : isLogin ? (
                    <>
                      <LogIn size={18} />
                      Iniciar Sesión
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Crear Cuenta
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E2E8F0]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-3 text-[#94A3B8]">o continúa con</span>
                </div>
              </div>

              <button
                type="button"
                disabled={microsoftLoading || submitting}
                onClick={async () => {
                  setMicrosoftLoading(true);
                  setError('');
                  const { error } = await signInWithMicrosoft();
                  if (error) {
                    setError(error.message);
                    setMicrosoftLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border-[1.5px] border-[#E2E8F0] rounded-lg font-medium text-sm text-[#1B3A5C] hover:bg-[#F1F5F9] hover:border-[#94A3B8] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {microsoftLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1B3A5C] border-t-transparent" />
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    Continuar con Microsoft
                  </>
                )}
              </button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="text-sm text-[#2A5A8C] hover:text-[#1B3A5C] font-medium transition-colors"
                >
                  {isLogin
                    ? '¿No tienes cuenta? Regístrate'
                    : '¿Ya tienes cuenta? Inicia Sesión'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
