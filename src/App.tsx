import { useState, useEffect } from 'react';
import { Shield, LogOut, ChevronLeft, FolderGit2, ChevronRight } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { CodebaseUpload } from './components/analysis/CodebaseUpload';
import { ProjectList } from './components/analysis/ProjectList';
import { IPDashboard } from './components/ip/IPDashboard';
import { PricingGate } from './components/payment/PricingGate';
import { PaymentBanner } from './components/payment/PaymentBanner';
import { TermsOfService } from './components/legal/TermsOfService';
import { usePaymentGate } from './hooks/usePaymentGate';
import type { Project } from './types';

type View = 'projects' | 'pricing' | 'upload' | 'editor' | 'terms';

function Footer({ onTerms }: { onTerms: () => void }) {
  return (
    <footer className="border-t border-gray-100 mt-auto py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <span>&copy; {new Date().getFullYear()} Git-Patent</span>
        <span>&middot;</span>
        <button onClick={onTerms} className="hover:text-indigo-600 transition-colors underline underline-offset-2">
          Terms of Service
        </button>
      </div>
    </footer>
  );
}

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentProject, selectProject, refreshProjects } = useProject();
  const { isInternalUser } = usePaymentGate();
  const [view, setView] = useState<View>('projects');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [paidProjectId, setPaidProjectId] = useState<string | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'cancelled' | null>(null);

  // Detect Stripe payment redirect at app level
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const projectId = params.get('project_id');
    if (paymentStatus === 'success' || paymentStatus === 'cancelled') {
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('session_id');
      url.searchParams.delete('project_id');
      window.history.replaceState({}, '', url.pathname);

      if (paymentStatus === 'success' && projectId) {
        setPaidProjectId(projectId);
        setPaymentBanner('success');
        setView('upload');
      } else if (paymentStatus === 'cancelled') {
        setPaymentBanner('cancelled');
        setView('projects');
      }
    }
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (view === 'terms') {
    return <TermsOfService onBack={() => setView('projects')} />;
  }

  if (!user) {
    if (authMode === 'signup') {
      return <SignUpPage onToggleLogin={() => setAuthMode('login')} onTerms={() => setView('terms')} />;
    }
    return <LoginPage onToggleSignUp={() => setAuthMode('signup')} onTerms={() => setView('terms')} />;
  }

  const handleSelectProject = (project: Project) => {
    selectProject(project);
    setView('editor');
  };

  const handleBack = () => {
    selectProject(null);
    setView('projects');
    refreshProjects();
  };

  const handleNewProject = () => {
    if (isInternalUser()) {
      setView('upload');
    } else {
      setView('pricing');
    }
  };

  const viewLabels: Record<View, string | null> = {
    'projects': null,
    'pricing': 'New Project',
    'upload': 'New Analysis',
    'editor': 'IP Editor',
    'terms': 'Terms of Service',
  };
  const viewLabel = viewLabels[view];
  const userInitial = user.email ? user.email[0].toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-gray-50/80 flex flex-col">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'projects' && (
              <button
                onClick={handleBack}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => { selectProject(null); setView('projects'); refreshProjects(); }}
            >
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200 group-hover:shadow-md group-hover:shadow-indigo-200 transition-all duration-200">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-transparent">
                Git-Patent
              </span>
            </div>

            {/* Breadcrumb */}
            {(currentProject || viewLabel) && (
              <nav className="hidden sm:flex items-center gap-1.5 ml-2 text-sm text-gray-400">
                <ChevronRight className="w-3.5 h-3.5" />
                {currentProject && view === 'editor' ? (
                  <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                    <FolderGit2 className="w-3.5 h-3.5" />
                    {currentProject.name}
                  </span>
                ) : viewLabel ? (
                  <span className="text-gray-500">{viewLabel}</span>
                ) : null}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors cursor-default">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                {userInitial}
              </div>
              <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
            </div>
            <button
              onClick={signOut}
              className="p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1">
        {paymentBanner && view !== 'upload' && (
          <div className="max-w-2xl mx-auto">
            <PaymentBanner type={paymentBanner} onDismiss={() => setPaymentBanner(null)} />
          </div>
        )}

        {view === 'projects' && (
          <ProjectList
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
          />
        )}

        {view === 'pricing' && (
          <PricingGate onInternalBypass={() => setView('upload')} />
        )}

        {view === 'upload' && (
          <CodebaseUpload
            paidProjectId={paidProjectId}
            paymentBanner={paymentBanner}
            onDismissBanner={() => setPaymentBanner(null)}
            onRequiresPayment={() => setView('pricing')}
            onAnalysisComplete={(project) => {
              setPaidProjectId(null);
              setPaymentBanner(null);
              refreshProjects();
              selectProject(project);
              setView('editor');
            }}
          />
        )}

        {view === 'editor' && currentProject && (
          <IPDashboard />
        )}
      </main>

      <Footer onTerms={() => setView('terms')} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
