import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "./useAuth";

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  current_role: string | null;
  created_at: string;
  updated_at: string;
}

// How the CodeCollabAI backend actually returns a project
interface BackendProject {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members?: {
    userId: string;
    role: string;
    user?: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    }
  }[];
}

interface CollaboratorApi {
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  }
}

interface Collaborator {
  user_id: string;
  role: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    color: number;
  };
}

export const useProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapBackendProject = (p: BackendProject, currentUserId: string): Project => {
    const ownerMember = p.members?.find(m => m.role === 'OWNER');
    const currentUserMember = p.members?.find(m => m.userId === currentUserId);
    
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      owner_id: ownerMember?.userId || '',
      current_role: currentUserMember?.role?.toLowerCase() || null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  };

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<BackendProject[]>("/projects");
      const mapped = (data || []).map(p => mapBackendProject(p, user.id));
      setProjects(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (name: string, description?: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const data = await apiRequest<BackendProject>("/projects", {
        method: "POST",
        body: { name, description: description || null },
      });
      // the create endpoint might not return members array immediately, so default it:
      if (!data.members) {
        data.members = [{ userId: user.id, role: 'OWNER' }];
      }
      
      const mapped = mapBackendProject(data, user.id);
      setProjects((prev) => [mapped, ...prev]);
      return { data: mapped, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateProject = async (
    projectId: string,
    updates: { name?: string; description?: string | null }
  ) => {
    if (!user) return { error: new Error("Not authenticated") };
    
    try {
      const data = await apiRequest<BackendProject>(`/projects/${projectId}`, {
        method: "PATCH",
        body: updates,
      });
      
      // Patch might not return members if it's just updating project table.
      // So merge with existing project state to retain members
      setProjects((prev) => prev.map((project) => {
        if (project.id === projectId) {
          return {
            ...project,
            name: data.name,
            description: data.description,
            updated_at: data.updatedAt
          };
        }
        return project;
      }));
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      return { error: null };
    } catch (error) {
      console.error('Delete project failed:', error);
      return { error: error as Error };
    }
  };

  const getCollaborators = async (projectId: string): Promise<Collaborator[]> => {
    const collaborators = await apiRequest<CollaboratorApi[]>(`/projects/${projectId}/collaborators`);

    return (collaborators || []).map((collaborator) => ({
      user_id: collaborator.userId,
      role: collaborator.role.toLowerCase(),
      profile: {
        display_name: collaborator.user?.name || collaborator.user?.email,
        avatar_url: collaborator.user?.avatarUrl || null,
        color: 1 + (collaborator.userId.charCodeAt(0) % 6), // deterministic color
      },
    }));
  };

  const addCollaborator = async (projectId: string, email: string, role: string = "DEVELOPER") => {
    try {
      // Backend expects role in uppercase like "DEVELOPER" or "VIEWER"
      await apiRequest(`/projects/${projectId}/collaborators`, {
        method: "POST",
        body: { email, role: role.toUpperCase() },
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    getCollaborators,
    addCollaborator,
    refetch: fetchProjects,
  };
};
