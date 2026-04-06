import { FolderGit2, Clock, CheckCircle, AlertCircle, Loader2, Trash2, Plus, GitFork, FolderArchive } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import type { Project } from '../../types';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Pending' },
  analyzing: { icon: Loader2, color: 'text-shield-600', bg: 'bg-shield-100', label: 'Analyzing', animate: true },
  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Complete' },
  failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Failed' },
};

export function ProjectList({ onSelectProject, onNewProject }: ProjectListProps) {
  const { projects, loading, deleteProject } = useProject();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-shield-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Your Projects</h2>
          <p className="text-base text-gray-500 mt-1">
            {projects.length > 0
              ? `${projects.length} project${projects.length !== 1 ? 's' : ''} analyzed`
              : 'Get started by analyzing your first codebase'}
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 bg-gradient-to-r from-shield-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg hover:shadow-shield-600/25 transition-all font-semibold text-base"
        >
          <Plus className="w-5 h-5" /> New Analysis
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-violet-50/50 rounded-3xl border-2 border-dashed border-gray-200">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white border border-gray-100 rounded-2xl shadow-sm mb-6">
            <FolderGit2 className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-3">No projects yet</h3>
          <p className="text-base text-gray-500 max-w-sm mx-auto">
            Connect a GitHub repository to discover patentable innovations, copyrightable works, and trademarks
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((project) => {
            const status = STATUS_CONFIG[project.analysis_status];
            const StatusIcon = status.icon;

            return (
              <div
                key={project.id}
                onClick={() => project.analysis_status === 'completed' && onSelectProject(project)}
                className={`bg-white border border-gray-100 rounded-2xl p-6 transition-all group shadow-sm ${
                  project.analysis_status === 'completed'
                    ? 'cursor-pointer hover:shadow-md hover:border-shield-200 hover:bg-gradient-to-br hover:from-white hover:to-shield-50/30'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      project.source_type === 'github_url'
                        ? 'bg-gray-100 text-gray-500 group-hover:bg-shield-100 group-hover:text-shield-600'
                        : 'bg-violet-50 text-violet-500'
                    } transition-colors`}>
                      {project.source_type === 'github_url' ? (
                        <GitFork className="w-5 h-5" />
                      ) : (
                        <FolderArchive className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base">{project.name}</h3>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {new Date(project.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${status.bg} ${status.color}`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${(status as Record<string, unknown>).animate ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this project and all its data?')) {
                          deleteProject(project.id);
                        }
                      }}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {project.source_url && (
                  <p className="text-sm text-gray-400 truncate mb-3">{project.source_url}</p>
                )}

                {project.analysis_summary && (
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{project.analysis_summary}</p>
                )}

                {/* Status dot animation for analyzing */}
                {project.analysis_status === 'analyzing' && (
                  <div className="flex items-center gap-1.5 mt-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-shield-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-shield-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-shield-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-shield-500 ml-1">Analysis in progress</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
