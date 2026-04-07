import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// A stable guest user ID so RLS policies work consistently
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ error: Error | null }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function createGuestUser(): User {
  return {
    id: GUEST_USER_ID,
    email: 'guest@ipshield.app',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'guest' },
    user_metadata: { is_guest: true },
    created_at: new Date().toISOString(),
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check for saved guest mode
    const savedGuest = localStorage.getItem('git-patent-guest');
    if (savedGuest === 'true') {
      setUser(createGuestUser());
      setIsGuest(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isGuest) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsGuest(false);
    localStorage.removeItem('git-patent-guest');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGitHub = async () => {
    setIsGuest(false);
    localStorage.removeItem('git-patent-guest');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo',
        redirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signInAsGuest = () => {
    localStorage.setItem('git-patent-guest', 'true');
    setUser(createGuestUser());
    setIsGuest(true);
    setSession(null);
  };

  const signOut = async () => {
    localStorage.removeItem('git-patent-guest');
    setIsGuest(false);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, signIn, signUp, signInWithGitHub, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
