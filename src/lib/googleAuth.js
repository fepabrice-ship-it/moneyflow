import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// Client ID OAuth "Web" du projet Google Cloud (pas le client Android).
// Le plugin natif l'utilise comme serverClientId pour obtenir un idToken
// que Supabase peut vérifier.
const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

let initialized = false;

export async function signInWithGoogle() {
  // Web : redirection OAuth classique gérée par Supabase.
  if (!Capacitor.isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  // Android : sélecteur de compte natif, puis échange de l'idToken avec Supabase.
  if (!webClientId) {
    throw new Error('VITE_GOOGLE_WEB_CLIENT_ID manquant dans la configuration.');
  }
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!initialized) {
    await SocialLogin.initialize({ google: { webClientId } });
    initialized = true;
  }
  const res = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });
  const idToken = res?.result?.idToken;
  if (!idToken) {
    throw new Error('Connexion Google annulée ou incomplète.');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
}
