import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { ProjectProvider } from '../../contexts/ProjectContext';
import { IPDashboard } from '../ip/IPDashboard';
import { CodebaseUpload } from '../analysis/CodebaseUpload';
import { AnalysisResults } from '../analysis/AnalysisResults';
import { ProjectList } from '../analysis/ProjectList';
import type { Project } from '../../types';
import '../../index.css';

interface IPShieldWidgetProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
  userId: string;
  projectId?: string;
  theme?: 'light' | 'dark';
  initialView?: 'projects' | 'upload' | 'ip';
  onPatentGenerated?: (applicationId: string) => void;
  onAnalysisComplete?: (projectId: string) => void;
  className?: string;
}

// Embedded auth context — uses parent app's userId instead of Supabase Auth
interface EmbedAuthContextType {
  user: Pick<User, 'id' | 'email'> | null;
  session: null;
  loading: boolean;
  signIn: () => Promise<{ error: null }>;
  signUp: () => Promise<{ error: null }>;
  signInWithGitHub: () => Promise<{ error: null }>;
  signOut: () => Promise<void>;
}

const EmbedAuthContext = createContext<EmbedAuthContextType | undefined>(undefined);

function EmbedAuthProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const user = { id: userId, email: undefined } as Pick<User, 'id' | 'email'>;
  const noop = async () => ({ error: null });

  return (
    <EmbedAuthContext.Provider value={{
      user,
      session: null,
      loading: false,
      signIn: noop,
      signUp: noop,
      signInWithGitHub: noop,
      signOut: async () => {},
    }}>
      {children}
    </EmbedAuthContext.Provider>
  );
}

// Override the useAuth hook for embedded mode
export function useEmbedAuth() {
  const context = useContext(EmbedAuthContext);
  if (!context) throw new Error('useEmbedAuth must be used within EmbedAuthProvider');
  return context;
}

// Override supabase client for embedded mode
let embeddedSupabase: SupabaseClient | null = null;

function initEmbeddedSupabase(url: string, key: string) {
  if (!embeddedSupabase) {
    embeddedSupabase = createClient(url, key);
  }
  return embeddedSupabase;
}

type WidgetView = 'projects' | 'upload' | 'results' | 'ip';

function WidgetContent({
  initialView = 'projects',
  onAnalysisComplete,
}: {
  initialView?: WidgetView;
  onAnalysisComplete?: (projectId: string) => void;
}) {
  const [view, setView] = useState<WidgetView>(initialView);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  return (
    <div className="ip-patent-widget">
      {view === 'projects' && (
        <ProjectList
          onSelectProject={(project) => { setCurrentProject(project); setView('results'); }}
          onNewProject={() => setView('upload')}
        />
      )}

      {view === 'upload' && (
        <CodebaseUpload
          onAnalysisComplete={(project) => {
            onAnalysisComplete?.(project?.id || currentProject?.id || '');
            setView('projects');
          }}
        />
      )}

      {view === 'results' && currentProject && (
        <AnalysisResults onNavigate={() => setView('ip')} />
      )}

      {view === 'ip' && currentProject && (
        <IPDashboard />
      )}
    </div>
  );
}

export function IPShieldWidget({
  supabaseUrl,
  supabaseAnonKey,
  geminiApiKey,
  userId,
  initialView,
  onAnalysisComplete,
  className,
}: IPShieldWidgetProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize embedded Supabase client
    initEmbeddedSupabase(supabaseUrl, supabaseAnonKey);

    // Set Gemini API key for services
    if (geminiApiKey) {
      (window as unknown as Record<string, unknown>).__IP_SHIELD_GEMINI_KEY__ = geminiApiKey;
    }

    setReady(true);
  }, [supabaseUrl, supabaseAnonKey, geminiApiKey]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-patent-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={className}>
      <EmbedAuthProvider userId={userId}>
        <ProjectProvider>
          <WidgetContent
            initialView={initialView}
            onAnalysisComplete={onAnalysisComplete}
          />
        </ProjectProvider>
      </EmbedAuthProvider>
    </div>
  );
}
