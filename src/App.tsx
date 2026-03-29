import { useState } from 'react';
import { Shield, LogOut, ChevronLeft, FolderGit2, ChevronRight } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { CodebaseUpload } from './components/analysis/CodebaseUpload';
import { ProjectList } from './components/analysis/ProjectList';
import { IPAnalysisDashboard } from './components/results/IPAnalysisDashboard';
import { PatentDocumentViewer } from './components/results/PatentDocumentViewer';
import { IPDashboard } from './components/ip/IPDashboard';
import type { Project } from './types';

type View = 'projects' | 'upload' | 'ip-results' | 'patent-viewer' | 'advanced';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentProject, selectProject, refreshProjects } = useProject();
  const [view, setView] = useState<View>('projects');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [viewingPatentId, setViewingPatentId] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (authMode === 'signup') {
      return <SignUpPage onToggleLogin={() => setAuthMode('login')} />;
    }
    return <LoginPage onToggleSignUp={() => setAuthMode('signup')} />;
  }

  const handleSelectProject = (project: Project) => {
    selectProject(project);
    setView('ip-results');
  };

  const handleBack = () => {
    if (view === 'patent-viewer') {
      setView('ip-results');
      setViewingPatentId(null);
    } else if (view === 'advanced') {
      setView('ip-results');
    } else {
      selectProject(null);
      setView('projects');
      refreshProjects();
    }
  };

  const viewLabels: Record<View, string | null> = {
    'projects': null,
    'upload': 'New Analysis',
    'ip-results': 'IP Results',
    'patent-viewer': 'Patent Document',
    'advanced': 'Advanced Editor',
  };
  const viewLabel = viewLabels[view];
  const userInitial = user.email ? user.email[0].toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-gray-50/80">
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
                IP Shield
              </span>
            </div>

            {/* Breadcrumb */}
            {(currentProject || viewLabel) && (
              <nav className="hidden sm:flex items-center gap-1.5 ml-2 text-sm text-gray-400">
                <ChevronRight className="w-3.5 h-3.5" />
                {currentProject && (
                  <>
                    <span
                      className="flex items-center gap-1.5 text-gray-600 font-medium cursor-pointer hover:text-shield-600"
                      onClick={() => setView('ip-results')}
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                      {currentProject.name}
                    </span>
                    {viewLabel && viewLabel !== 'IP Results' && <ChevronRight className="w-3.5 h-3.5" />}
                  </>
                )}
                {viewLabel && viewLabel !== 'IP Results' && (
                  <span className="text-gray-500">{viewLabel}</span>
                )}
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
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'projects' && (
          <ProjectList
            onSelectProject={handleSelectProject}
            onNewProject={() => setView('upload')}
          />
        )}

        {view === 'upload' && (
          <CodebaseUpload
            onAnalysisComplete={() => {
              refreshProjects();
              setView('projects');
            }}
          />
        )}

        {view === 'ip-results' && currentProject && (
          <IPAnalysisDashboard
            onAdvancedMode={() => setView('advanced')}
            onViewPatent={(id) => { setViewingPatentId(id); setView('patent-viewer'); }}
          />
        )}

        {view === 'patent-viewer' && currentProject && viewingPatentId && (
          <PatentDocumentViewer
            applicationId={viewingPatentId}
            onBack={() => { setView('ip-results'); setViewingPatentId(null); }}
            onAdvancedMode={() => setView('advanced')}
          />
        )}

        {view === 'advanced' && currentProject && (
          <IPDashboard />
        )}
      </main>
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
