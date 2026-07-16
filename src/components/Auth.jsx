import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { Loader2, Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>
);

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogle();
      // Sur web, la redirection OAuth prend le relais ; sur natif,
      // onAuthStateChange dans App.jsx bascule vers l'application.
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo('Si un compte existe pour cet email, un lien de réinitialisation vient de vous être envoyé.');
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Vérifiez votre boîte mail pour confirmer votre compte !');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (updater) => {
    setError(null);
    setInfo(null);
    updater();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto rounded-2xl object-contain shadow-2xl" />
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-white">MoneyFlow</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-xs">Brayce Edition</p>
          </div>
        </div>

        <div className="glass-card space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold">
              {isForgot ? 'Mot de passe oublié' : isSignUp ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isForgot
                ? 'Entrez votre email pour recevoir un lien de réinitialisation.'
                : isSignUp
                ? 'Commencez à gérer vos finances intelligemment.'
                : 'Connectez-vous pour suivre vos flux.'}
            </p>
          </div>

          {!isForgot && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full bg-white/5 border border-white/10 h-12 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {googleLoading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <GoogleIcon />
                    Continuer avec Google
                  </>
                )}
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-primary outline-none transition-colors"
                  placeholder="nom@exemple.com"
                  required
                />
              </div>
            </div>

            {!isForgot && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-white/5 rounded-xl py-3 pl-10 pr-12 focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isSignUp && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => switchMode(() => setIsForgot(true))}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            {info && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {isForgot ? 'Envoyer le lien' : isSignUp ? "S'inscrire" : "Se connecter"}
                  {isForgot ? <KeyRound size={18} /> : <ArrowRight size={18} />}
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            {isForgot ? (
              <button
                onClick={() => switchMode(() => setIsForgot(false))}
                className="text-sm text-muted-foreground hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Retour à la connexion
              </button>
            ) : (
              <button
                onClick={() => switchMode(() => setIsSignUp(!isSignUp))}
                className="text-sm text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
