import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import OrktoLogo from "../OrktoLogo";

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    return !!gl;
  } catch { return false; }
}

export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

interface SignInPageProps {
  className?: string;
  onSignInSuccess: () => void;
  onSignUp?: (email: string, password: string, name: string) => Promise<void>;
  onDemoLogin?: () => Promise<void>;
  onAuthenticate?: (email: string, password: string) => Promise<{ error?: string }>;
}
      
const CanvasRevealEffect = React.lazy(() => import('./canvas-reveal-effect').then(({ CanvasRevealEffect }) => ({ default: CanvasRevealEffect })));

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <a href={href} className="group relative inline-block overflow-hidden h-5 flex items-center text-sm whitespace-nowrap shrink-0">
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2 whitespace-nowrap">
        <span className="text-zinc-500 whitespace-nowrap leading-none">{children}</span>
        <span className="text-[#FF9F1C] whitespace-nowrap leading-none">{children}</span>
      </div>
    </a>
  );
};

function MiniNavbar({ onStart }: { onStart: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }
    return () => {
      if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    };
  }, [isOpen]);

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-20 flex items-center px-6 py-3 backdrop-blur-md rounded-full border border-zinc-800 bg-[#111111]/70 w-[calc(100%-2rem)] sm:w-auto transition-all">
      <div className="flex items-center justify-between w-full gap-x-6">
        <div className="flex items-center shrink-0">
           <OrktoLogo size="sm" showSlogan={false} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={onStart} className="px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-zinc-950 bg-gradient-to-br from-[#FF9F1C] to-[#e88d0e] rounded-full hover:from-[#FF9F1C] hover:to-[#ffa933] transition-all duration-200 whitespace-nowrap">
            Criar conta grátis
          </button>
        </div>
      </div>
    </header>
  );
}

export const SignInPage = ({ className, onSignInSuccess, onSignUp, onDemoLogin, onAuthenticate }: SignInPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "forgot" | "success" | "signup">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [arrowSliding, setArrowSliding] = useState(false);
  const [hasWebGL2] = useState(() => detectWebGL2());
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    if (!hasWebGL2) return;
    const timer = window.setTimeout(() => setCanvasReady(true), 450);
    return () => window.clearTimeout(timer);
  }, [hasWebGL2]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && !arrowSliding) setArrowSliding(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setAuthError("");
    try {
      if (onAuthenticate) {
        const result = await onAuthenticate(email, password);
        if (result.error) {
          setAuthError(result.error);
          setReverseCanvasVisible(false);
          setInitialCanvasVisible(true);
          return;
        }
      }
      setReverseCanvasVisible(true);
      setTimeout(() => { setInitialCanvasVisible(false); }, 50);
      setTimeout(() => {
        setStep("success");
        onSignInSuccess();
      }, 700);
    } catch (err: any) {
      setAuthError(err.message || "Erro ao autenticar");
      setReverseCanvasVisible(false);
      setInitialCanvasVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (step === "password") {
      setTimeout(() => { }, 500);
    }
  }, [step]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setAuthError('Não foi possível enviar o link. Verifique o e-mail.');
        return;
      }
      setResetSent(true);
      setTimeout(() => {
        setResetSent(false);
        setStep("email");
      }, 4000);
    } catch {
      setAuthError('Erro ao enviar link de recuperação.');
    }
  };

  const handleBackClick = () => {
    setStep("email");
    setPassword("");
    setAuthError("");
    setReverseCanvasVisible(false);
    setInitialCanvasVisible(true);
  };

  const handleBypassOrkto = async () => {
    if (onDemoLogin) {
      setIsSubmitting(true);
      setAuthError('');
      try {
        await onDemoLogin();
      } catch {
        setAuthError('Erro ao acessar conta demo');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    try {
      const res = await fetch('/api/auth/demo-login', { method: 'POST' });
      if (!res.ok) {
        setAuthError('Erro ao acessar conta demo');
        return;
      }
      const data = await res.json();
      if (data.session) {
        const { supabase } = await import('../../lib/supabase');
        await supabase.auth.setSession(data.session);
      }
      onSignInSuccess();
    } catch {
      setAuthError('Erro ao acessar conta demo');
    }
  }

  return (
    <div className={cn("flex w-[100%] flex-col min-h-screen bg-[#111111] relative text-white", className)}>
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" style={{ pointerEvents: 'none' }}>
        {hasWebGL2 && !canvasReady && initialCanvasVisible && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        )}
        {hasWebGL2 && canvasReady && initialCanvasVisible && (
          <React.Suspense fallback={<div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />}>
            <div className="absolute inset-0 pointer-events-none" style={{ pointerEvents: 'none' }}>
              <CanvasRevealEffect
                animationSpeed={3}
                containerClassName="bg-[#111111]"
                colors={[[255, 159, 28], [255, 100, 28]]}
                dotSize={6}
                reverse={false}
              />
            </div>
          </React.Suspense>
        )}
        {!hasWebGL2 && initialCanvasVisible && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        )}
        
        {hasWebGL2 && canvasReady && reverseCanvasVisible && (
          <React.Suspense fallback={<div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />}>
            <div className="absolute inset-0 pointer-events-none" style={{ pointerEvents: 'none' }}>
              <CanvasRevealEffect
                animationSpeed={4}
                containerClassName="bg-[#111111]"
                colors={[[255, 159, 28], [255, 100, 28]]}
                dotSize={6}
                reverse={true}
              />
            </div>
          </React.Suspense>
        )}
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111111_0%,_transparent_100%)] opacity-80 pointer-events-none" style={{ pointerEvents: "none" }} />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-[#111111] to-transparent pointer-events-none" style={{ pointerEvents: "none" }} />
      </div>
      
      <div className="relative z-10 flex flex-col flex-1">
        <MiniNavbar onStart={() => { setAuthError(''); setStep('signup'); }} />

        <div className="flex flex-1 flex-col lg:flex-row items-center justify-center px-4 w-full h-full pb-10">
          <div className="flex-1 flex flex-col justify-center items-center h-full w-full">
            <div className="w-full mt-[120px] max-w-sm">
              <AnimatePresence mode="wait">
                {step === "email" ? (
                  <motion.div 
                    key="email-step"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center relative z-20 pointer-events-auto"
                  >
                    <div className="space-y-1 mb-8">
                      <h1 className="text-[2.2rem] font-bold leading-[1.1] tracking-tight">Identifique-se</h1>
                      <p className="text-[1.2rem] text-zinc-400 font-light mt-2">Acesse a plataforma <span className="text-[#FF9F1C] font-semibold">ORKTO</span></p>
                    </div>
                    
                    <div className="space-y-4">
                      
                      <form onSubmit={handleEmailSubmit}>
                        <div className="relative">
                          <input 
                            type="email" 
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-label="Seu e-mail"
                            className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 pl-6 pr-16 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                            required
                          />
                          <button 
                            type="submit"
                            aria-label="Continuar com e-mail"
                            disabled={arrowSliding}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-950 w-11 h-11 flex items-center justify-center rounded-full bg-[#FF9F1C] hover:bg-[#FF9F1C]/90 transition-colors overflow-hidden shadow-lg shadow-[#FF9F1C]/20 cursor-pointer"
                          >
                            <motion.span className="flex items-center justify-center" animate={{ x: arrowSliding ? 44 : 0 }} transition={{ duration: 0.22 }} onAnimationComplete={() => { if (arrowSliding) { setStep('password'); setArrowSliding(false); } }}>
                              <svg aria-hidden="true" viewBox="0 0 32 24" className="w-7 h-6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14C9 10 17 15 28 10M20 4C23 7 25 8 28 10C25 13 23 16 20 20" /></svg>
                            </motion.span>
                          </button>
                        </div>
                      </form>
 
                      {import.meta.env.DEV && <button
                        onClick={handleBypassOrkto}
                        type="button"
                        className="backdrop-blur-[2px] w-full flex items-center justify-center gap-3 bg-zinc-900/50 hover:bg-zinc-800 text-white border border-zinc-800 rounded-full py-3.5 px-4 transition-colors font-medium text-sm mt-4 cursor-pointer">
                        <svg className="w-5 h-5 text-[#FF9F1C]" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                        </svg>
                        <span>Explorar demonstração</span>
                      </button>}

                      {/* Login Google configurado no Supabase */}
                        <button
                          onClick={async () => {
                            try {
                              const { supabase } = await import('../../lib/supabase');
                              const { error } = await supabase.auth.signInWithOAuth({
                                provider: 'google',
                                options: { redirectTo: window.location.origin },
                              });
                              if (error) {
                                setAuthError('Não foi possível entrar com o Google. Tente novamente.');
                              }
                            } catch {
                              setAuthError('Erro ao conectar com Google. Tente novamente.');
                            }
                          }}
                          type="button"
                          className="backdrop-blur-[2px] w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white border border-zinc-700 rounded-full py-3.5 px-4 transition-colors font-medium text-sm cursor-pointer"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>Entrar com Google</span>
                        </button>

                      <p className="text-[10px] text-zinc-600 pt-2">
                        Precisa de ajuda? <a href="mailto:ola@orkto.co" className="text-zinc-400 hover:text-[#FF9F1C] transition-colors">ola@orkto.co</a>
                      </p>

                      <button
                        onClick={() => { setStep("forgot"); setResetEmail(email || ""); }}
                        type="button"
                        className="text-xs font-semibold text-zinc-500 hover:text-[#FF9F1C] transition-all cursor-pointer block mx-auto pt-2 hover:underline relative z-30"
                      >
                        Esqueci minha senha / código de acesso
                      </button>

                      <div className="relative pt-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-[#111111] px-4 text-zinc-500">ou</span>
                        </div>
                      </div>

                      <button
                        onClick={() => { setStep("signup"); setSignupName(""); setAuthError(""); }}
                        type="button"
                        className="w-full backdrop-blur-[2px] flex items-center justify-center gap-3 bg-zinc-900/30 hover:bg-zinc-800/50 text-zinc-300 hover:text-white border border-zinc-800 rounded-full py-3.5 px-4 transition-colors font-medium text-sm cursor-pointer"
                      >
                        Criar Conta
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-zinc-500 pt-10">
                      Ao acessar, você concorda com nossos <a href="/termos.html" target="_blank" className="underline text-zinc-400 hover:text-white transition-colors">Termos</a> e <a href="/privacidade.html" target="_blank" className="underline text-zinc-400 hover:text-white transition-colors">Privacidade</a>.
                    </p>
                  </motion.div>
                ) : step === "forgot" ? (
                  <motion.div 
                    key="forgot-step"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center relative z-20 pointer-events-auto"
                  >
                    <div className="space-y-1 mb-8">
                      <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight">Recuperar Acesso</h1>
                      <p className="text-[1rem] text-zinc-400 font-light mt-1">Digite seu e-mail para receber um link de redefinição seguro</p>
                    </div>

                    {resetSent ? (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl text-sm font-semibold leading-normal animate-pulse">
                        Link enviado! Verifique sua caixa de entrada nos próximos instantes. Redirecionando...
                      </div>
                    ) : (
                      <form onSubmit={handleResetSubmit} className="space-y-4">
                        <div className="relative">
                          <input 
                            type="email" 
                            placeholder="seu@email.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 px-6 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                            required
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setStep("email")}
                            className="w-[30%] py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold text-xs transition-colors"
                          >
                            Voltar
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-3 bg-[#FF9F1C] text-black hover:opacity-90 rounded-full font-bold text-xs transition-all shadow-lg active:scale-95"
                          >
                            Enviar Link de Acesso
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                ) : step === "signup" ? (
                  <motion.div
                    key="signup-step"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center relative z-20 pointer-events-auto"
                  >
                    <div className="space-y-1 mb-8">
                      <h1 className="text-[2.2rem] font-bold leading-[1.1] tracking-tight">Criar Conta</h1>
                      <p className="text-[1rem] text-zinc-400 font-light">Preencha seus dados para se cadastrar na plataforma <span className="text-[#FF9F1C] font-semibold">ORKTO</span></p>
                    </div>

                    {authError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold">
                        {authError}
                      </div>
                    )}

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!email || !password || !signupName) {
                        setAuthError('Preencha todos os campos');
                        return;
                      }
                      if (password.length < 6) {
                        setAuthError('A senha deve ter no mínimo 6 caracteres');
                        return;
                      }
                      setIsSubmitting(true);
                      setAuthError('');
                      try {
                        if (onSignUp) {
                          await onSignUp(email, password, signupName);
                        }
                        setReverseCanvasVisible(true);
                        setTimeout(() => { setInitialCanvasVisible(false); }, 50);
                        setTimeout(() => {
                          setStep("success");
                          onSignInSuccess();
                        }, 700);
                      } catch (err: any) {
                        setAuthError(err.message || 'Erro ao criar conta');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }} className="space-y-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Seu nome completo"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 px-6 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                          required
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 px-6 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                          required
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Sua senha (mín. 6 caracteres)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 px-6 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                          required
                          minLength={6}
                        />
                      </div>

                      <div className="flex w-full gap-3">
                        <button
                          type="button"
                          onClick={() => { setStep("email"); setAuthError(""); }}
                          className="rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium px-6 py-3.5 hover:bg-zinc-800 transition-colors w-[30%] text-xs"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={!email || !password || !signupName || isSubmitting}
                          className={`flex-1 rounded-full font-medium py-3.5 border transition-all duration-300 ${
                            email && password && signupName && !isSubmitting
                            ? "bg-[#FF9F1C] text-black border-transparent hover:bg-[#e88d0e]"
                            : "bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          {isSubmitting ? 'Criando...' : 'Criar Conta'}
                        </button>
                      </div>
                    </form>

                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-[#111111] px-4 text-zinc-500">ou</span>
                        </div>
                      </div>

                      {/* Cadastro Google configurado no Supabase */}
                        <button
                          onClick={async () => {
                            try {
                              const { supabase } = await import('../../lib/supabase');
                              const { error } = await supabase.auth.signInWithOAuth({
                                provider: 'google',
                                options: { redirectTo: window.location.origin },
                              });
                              if (error) {
                                setAuthError('Não foi possível cadastrar com o Google. Tente novamente.');
                              }
                            } catch {
                              setAuthError('Erro ao conectar com Google. Tente novamente.');
                            }
                          }}
                          type="button"
                          className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white border border-zinc-700 rounded-full py-3.5 px-4 transition-colors font-medium text-sm cursor-pointer"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>Cadastrar com Google</span>
                        </button>

                    <p className="text-[10px] text-zinc-500">
                      Ao criar uma conta, você concorda com nossos <a href="/termos.html" target="_blank" className="underline text-zinc-400 hover:text-white transition-colors">Termos</a> e <a href="/privacidade.html" target="_blank" className="underline text-zinc-400 hover:text-white transition-colors">Privacidade</a>.
                    </p>

                    <p className="text-[10px] text-zinc-600">
                      Precisa de ajuda? <a href="mailto:ola@orkto.co" className="text-zinc-400 hover:text-[#FF9F1C] transition-colors">ola@orkto.co</a>
                    </p>
                  </motion.div>
                ) : step === "password" ? (
                  <motion.div 
                    key="password-step"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center relative z-20 pointer-events-auto"
                  >
                    <div className="space-y-1 mb-8">
                      <h1 className="text-[2.2rem] font-bold leading-[1.1] tracking-tight">Sua Senha</h1>
                      <p className="text-[1rem] text-zinc-400 font-light">Digite a senha para <span className="text-[#FF9F1C] font-semibold">{email}</span></p>
                    </div>
                    
                    {authError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold">
                        {authError}
                      </div>
                    )}
                    
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div className="relative">
                        <input 
                          type="password" 
                          placeholder="Sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full backdrop-blur-[2px] bg-zinc-900/50 text-white border border-zinc-800 rounded-full py-4 px-6 focus:outline-none focus:border focus:border-[#FF9F1C]/50 focus:ring-1 focus:ring-[#FF9F1C]/30 text-center text-sm font-medium"
                          required
                          minLength={6}
                          autoFocus
                        />
                      </div>
                      
                      <div className="flex w-full gap-3">
                        <button 
                          type="button"
                          onClick={() => { setStep("email"); setPassword(""); setAuthError(""); }}
                          className="rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium px-6 py-3.5 hover:bg-zinc-800 transition-colors w-[30%] text-xs"
                        >
                          Voltar
                        </button>
                        <button 
                          type="submit"
                          disabled={!password || isSubmitting}
                          className={`flex-1 rounded-full font-medium py-3.5 border transition-all duration-300 ${
                            password && !isSubmitting
                            ? "bg-[#FF9F1C] text-black border-transparent hover:bg-[#e88d0e]" 
                            : "bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          {isSubmitting ? 'Entrando...' : 'Entrar'}
                        </button>
                      </div>
                    </form>
                    
                    <button
                      onClick={() => { setStep("forgot"); setResetEmail(email || ""); }}
                      type="button"
                      className="text-xs font-semibold text-zinc-500 hover:text-[#FF9F1C] transition-all cursor-pointer block mx-auto pt-2 hover:underline relative z-30"
                    >
                      Esqueci minha senha
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="success-step"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                    className="space-y-6 text-center relative z-20 pointer-events-auto"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight">Oeste de Prontidão!</h1>
                      <p className="text-[1.25rem] text-zinc-400 font-light">Acesso Liberado.</p>
                    </div>
                    
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="py-10"
                    >
                      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#FF9F1C] to-[#e88d0e] flex items-center justify-center shadow-[0_0_40px_rgba(255,159,28,0.4)]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-black" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </motion.div>
                    
                    <motion.button 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      onClick={onSignInSuccess}
                      className="w-full relative z-50 pointer-events-auto rounded-full bg-[#FF9F1C] text-black font-bold py-4 hover:bg-[#e88d0e] transition-colors uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(255,159,28,0.2)]"
                    >
                      Prosseguir ao Painel
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
