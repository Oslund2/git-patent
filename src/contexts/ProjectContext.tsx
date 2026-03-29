import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Project } from '../types';
import type { Database } from '../lib/database.types';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  selectProject: (project: Project | null) => void;
  createProject: (data: { name: string; description?: string; source_type: Project['source_type']; source_url?: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  updateProject: (id: string, data: Record<string, unknown>) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data as Project[]);
      if (currentProject) {
        const updated = data.find(p => p.id === currentProject.id);
        if (updated) setCurrentProject(updated as Project);
      }
    }
    setLoading(false);
  }, [user, currentProject]);

  useEffect(() => {
    refreshProjects();
  }, [user]);

  const selectProject = (project: Project | null) => {
    setCurrentProject(project);
  };

  const createProject = async (data: { name: string; description?: string; source_type: Project['source_type']; source_url?: string }) => {
    if (!user) throw new Error('Must be logged in');

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description || null,
        source_type: data.source_type,
        source_url: data.source_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    await refreshProjects();
    const created = project as Project;
    setCurrentProject(created);
    return created;
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    if (currentProject?.id === id) setCurrentProject(null);
    await refreshProjects();
  };

  const updateProject = async (id: string, data: Record<string, unknown>) => {
    const { error } = await supabase
      .from('projects')
      .update({ ...data, updated_at: new Date().toISOString() } as Database['public']['Tables']['projects']['Update'])
      .eq('id', id);
    if (error) throw error;
    await refreshProjects();
  };

  return (
    <ProjectContext.Provider value={{ projects, currentProject, loading, selectProject, createProject, deleteProject, refreshProjects, updateProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
}
