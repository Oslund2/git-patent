import { useState } from 'react';
import { Shield, LogOut, ChevronLeft, FolderGit2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { CodebaseUpload } from './components/analysis/CodebaseUpload';
import { AnalysisResults } from './components/analysis/AnalysisResults';
import { ProjectList } from './components/analysis/ProjectList';
import type { Project } from './types';

type View = 'projects' | 'upload' | 'results' | 'patents' | 'copyrights' | 'trademarks';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentProject, selectProject, refreshProjects } = useProject();
  const [view, setView] = useState<View>('projects');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-shield-600 border-t-transparent" />
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
    setView('results');
  };

  const handleBack = () => {
    if (view === 'patents' || view === 'copyrights' || view === 'trademarks') {
      setView('results');
    } else {
      selectProject(null);
      setView('projects');
      refreshProjects();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'projects' && (
              <button onClick={handleBack} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => { selectProject(null); setView('projects'); refreshProjects(); }}
            >
              <div className="w-8 h-8 bg-shield-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900">IP Shield</span>
            </div>
            {currentProject && (
              <div className="flex items-center gap-2 ml-4 text-sm text-gray-500">
                <FolderGit2 className="w-4 h-4" />
                <span>{currentProject.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={signOut}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
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

        {view === 'results' && currentProject && (
          <AnalysisResults
            onNavigate={(target) => setView(target)}
          />
        )}

        {view === 'patents' && currentProject && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Patent Applications</h2>
            <p className="text-gray-500">Patent generation — extracted beestudio services will be connected here.</p>
            <p className="text-sm text-gray-400 mt-4">Project: {currentProject.name}</p>
          </div>
        )}

        {view === 'copyrights' && currentProject && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Copyright Registrations</h2>
            <p className="text-gray-500">Copyright registration — extracted beestudio services will be connected here.</p>
          </div>
        )}

        {view === 'trademarks' && currentProject && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Trademark Applications</h2>
            <p className="text-gray-500">Trademark applications — extracted beestudio services will be connected here.</p>
          </div>
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
