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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Projects</h2>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 bg-shield-600 text-white px-4 py-2 rounded-lg hover:bg-shield-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Analyze New Codebase
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <FolderGit2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-6">Upload a codebase to discover patentable IP</p>
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 bg-shield-600 text-white px-6 py-2.5 rounded-lg hover:bg-shield-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Get Started
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const status = STATUS_CONFIG[project.analysis_status];
            const StatusIcon = status.icon;

            return (
              <div
                key={project.id}
                onClick={() => project.analysis_status === 'completed' && onSelectProject(project)}
                className={`bg-white border border-gray-200 rounded-lg p-4 transition-all ${
                  project.analysis_status === 'completed' ? 'cursor-pointer hover:border-shield-500 hover:shadow-sm' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {project.source_type === 'github_url' ? (
                      <GitFork className="w-5 h-5 text-gray-400" />
                    ) : (
                      <FolderArchive className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500">
                        {project.source_url || 'Uploaded zip'} -- {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
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
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {project.analysis_summary && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{project.analysis_summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
