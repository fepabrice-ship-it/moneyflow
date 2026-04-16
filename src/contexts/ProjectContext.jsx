import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const ProjectContext = createContext();

export const ProjectProvider = ({ children, session }) => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const selectProject = useCallback(async (project) => {
    if (!project) return;
    setCurrentProject(project);
    localStorage.setItem('last_project_id', project.id);
    
    try {
      // Fixed join syntax: PostgREST uses table name directly if there's a clear FK
      // We explicitly alias it for clarity and consistency with child components
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          role,
          profiles(
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', project.id);

      if (error) throw error;
      setMembers(data.map(m => ({
        id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name || 'Inconnu',
        avatar_url: m.profiles?.avatar_url
      })));
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    setLoading(true);
    try {
      const { data: memberProjects, error } = await supabase
        .from('project_members')
        .select(`
          project_id,
          role,
          projects:project_id (
            id,
            name,
            owner_id,
            type
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      const projectList = (memberProjects || []).map(mp => ({
        ...mp.projects,
        role: mp.role
      }));

      setProjects(projectList);

      const savedProjectId = localStorage.getItem('last_project_id');
      const lastProject = projectList.find(p => p.id === savedProjectId);
      const defaultProject = lastProject || projectList[0];
      
      if (defaultProject) {
        selectProject(defaultProject);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [session?.user?.id, selectProject]);

  useEffect(() => {
    if (session?.user) {
      fetchProjects();
    }
  }, [session?.user?.id]);

  const createProject = useCallback(async (name, type = 'standard') => {
    try {
      const { data: project, error: pError } = await supabase
        .from('projects')
        .insert([{ name, type, owner_id: session.user.id }])
        .select()
        .single();

      if (pError) throw pError;

      const { error: mError } = await supabase
        .from('project_members')
        .insert([{ project_id: project.id, user_id: session.user.id, role: 'owner' }]);

      if (mError) throw mError;

      await fetchProjects();
      return project;
    } catch (err) {
      console.error('Error creating project:', err);
      throw err;
    }
  }, [session?.user?.id, fetchProjects]);

  const updateProject = useCallback(async (projectId, updates) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
      
      if (error) throw error;
      await fetchProjects();
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  }, [fetchProjects]);

  const value = useMemo(() => ({
    projects, 
    currentProject, 
    members, 
    loading: loading && projects.length === 0, 
    selectProject, 
    createProject,
    updateProject,
    refreshProjects: fetchProjects
  }), [projects, currentProject, members, loading, selectProject, createProject, updateProject, fetchProjects]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
