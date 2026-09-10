import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AUTH_DEFAULT = { currentUser: null, userProfile: null, loading: true, authError: null, clearAuthError: () => {} };

const AuthContext = createContext(AUTH_DEFAULT);

export const useAuth = () => useContext(AuthContext) ?? AUTH_DEFAULT;

// Garante que exista uma linha em `usuarios` pro usuário autenticado — equivalente
// ao setDoc de "primeiro acesso" que o Firebase fazia. Se não existir, cria como
// pendente (mesma regra de aprovação manual de sempre) e derruba a sessão.
async function ensureUsuarioProfile(user) {
  const { data: existing, error: fetchError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const provider = user.app_metadata?.provider;
  const providerEmail = user.user_metadata?.email || user.email;

  if (provider === 'azure') {
    if (!providerEmail) {
      await supabase.auth.signOut();
      throw new Error('email-indisponivel');
    }
    if (!providerEmail.endsWith('@normatel.com.br')) {
      await supabase.auth.signOut();
      throw new Error('dominio-invalido');
    }
  }

  const { error: insertError } = await supabase.from('usuarios').insert({
    id: user.id,
    nome: user.user_metadata?.full_name || user.user_metadata?.name || providerEmail?.split('@')[0] || 'Usuário Microsoft',
    email: providerEmail,
    funcao: 'colaborador',
    status_acesso: 'pendente',
    foto_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    data: { cargo: 'Colaborador' },
  });
  if (insertError) throw insertError;

  await supabase.auth.signOut();
  throw new Error('pendente');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    let activeChannel = null;
    let cancelled = false;

    const teardownChannel = () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };

    async function loadProfile(user) {
      try {
        const profile = await ensureUsuarioProfile(user);

        if (profile.status_acesso === 'pendente') {
          await supabase.auth.signOut();
          throw new Error('pendente');
        }

        if (cancelled) return;
        setCurrentUser(user);
        setUserProfile(profile);
        setAuthError(null);

        // Atualiza last_seen uma única vez no login (não dentro do listener realtime,
        // pra não criar loop — mesmo cuidado que existia com o onSnapshot do Firestore)
        supabase.from('usuarios').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});

        teardownChannel();
        activeChannel = supabase
          .channel(`usuarios-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'usuarios', filter: `id=eq.${user.id}` },
            (payload) => {
              if (payload.new) setUserProfile(payload.new);
            }
          )
          .subscribe();
      } catch (err) {
        if (cancelled) return;
        setCurrentUser(null);
        setUserProfile(null);
        setAuthError(err.message || 'erro-desconhecido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) loadProfile(session.user);
      else setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      teardownChannel();
      if (session?.user) {
        setLoading(true);
        loadProfile(session.user);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
      teardownChannel();
    };
  }, []);

  const value = useMemo(
    () => ({ currentUser, userProfile, loading, authError, clearAuthError }),
    [currentUser, userProfile, loading, authError, clearAuthError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
