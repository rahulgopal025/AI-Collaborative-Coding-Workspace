import { useState, useMemo } from 'react';

import { 
  FolderOpen, 
  Plus, 
  Clock, 
  Users, 
  MoreVertical,
  Trash2,
  LogOut,
  Loader2,
  Pencil,
  Search,
  Zap,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { ManageCollaboratorsDialog } from './ManageCollaboratorsDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/lib/time';
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { useActivities } from '@/hooks/useActivities';

const currentDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

interface ProjectListProps {
  onSelectProject?: (project: { id: string; name: string; ownerId: string; role: string | null }) => void;
}

import { useNavigate } from 'react-router-dom';

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const navigate = useNavigate();
  const { projects, loading, createProject, updateProject, deleteProject } = useProjects();
  const { user, profile, signOut } = useAuth();
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { activities, loading: loadingActivities } = useActivities(projectIds);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleEditProject = (project: { id: string; name: string; description: string | null }) => {
    setEditingProject({ id: project.id, name: project.name, description: project.description || '' });
    setEditDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!editingProject || !editingProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setIsSaving(true);
    const { error } = await updateProject(editingProject.id, {
      name: editingProject.name.trim(),
      description: editingProject.description.trim() || null,
    });
    setIsSaving(false);
    if (error) {
      toast.error('Failed to update project');
    } else {
      toast.success('Project updated');
      setEditDialogOpen(false);
      setEditingProject(null);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsCreating(true);
    const { data, error } = await createProject(newProjectName.trim(), newProjectDesc.trim() || undefined);
    setIsCreating(false);

    if (error) {
      toast.error('Failed to create project');
      return;
    }

    toast.success('Project created!');
    setNewProjectName('');
    setNewProjectDesc('');
    setDialogOpen(false);
    
    if (data) {
      const projectPayload = {
        id: data.id,
        name: data.name,
        ownerId: data.owner_id,
        role: data.current_role,
      };
      if (onSelectProject) onSelectProject(projectPayload);
      navigate(`/projects/${data.id}`, { state: {
        projectName: data.name,
        projectOwnerId: data.owner_id,
        projectRole: data.current_role
      }});
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    toast('Delete this project?', {
      description: 'This action cannot be undone. All files and data will be permanently deleted.',
      action: {
        label: 'Delete',
        onClick: async () => {
          const { error } = await deleteProject(projectId);
          if (error) {
            toast.error('Failed to delete project');
          } else {
            toast.success('Project deleted');
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 8000,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
            <FolderOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold gradient-text">Your Projects</span>
        </div>

        <div className="flex items-center gap-4">
          <DarkModeToggle />
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: `hsl(var(--user-${profile?.color || 1}))` }}
            >
              {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.display_name}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono mb-1">{currentDate}</p>
            <h1 className="text-3xl md:text-4xl font-bold font-heading tracking-tight mb-2 text-foreground">
              Welcome back, {profile?.display_name || user?.name || user?.email?.split('@')[0]}
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening across your workspaces.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                className="pl-9 bg-[#12121a] border-primary/20 w-full md:w-64 focus-visible:ring-primary/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shrink-0">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Project</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Project Name
                    </label>
                    <Input
                      placeholder="My Awesome Project"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Description (optional)
                    </label>
                    <Input
                      placeholder="A brief description..."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateProject} 
                    className="w-full gap-2"
                    disabled={isCreating}
                  >
                    {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-muted-foreground">Total projects</span>
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary font-heading tracking-tight">{projects.length}</div>
            <div className="text-xs text-success mt-2">+12% this month</div>
          </div>
          
          <div className="p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-muted-foreground">Collaborators</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary font-heading tracking-tight">
              {projects.reduce((acc, p) => acc + (p.current_role === 'owner' ? 3 : 1), 0)}
            </div>
            <div className="text-xs text-success mt-2">+12% this month</div>
          </div>
          
          <div className="p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-muted-foreground">Active projects</span>
              <Zap className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary font-heading tracking-tight">
              {Math.min(projects.length, 4)}
            </div>
            <div className="text-xs text-success mt-2">+12% this month</div>
          </div>
          
          <div className="p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-muted-foreground">AI conversations</span>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold text-primary font-heading tracking-tight">186</div>
            <div className="text-xs text-success mt-2">+12% this month</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Projects (lg:col-span-2) */}
          <div className="lg:col-span-2 p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground font-heading">Recent projects</h2>
              <Button variant="ghost" size="sm" className="text-primary text-xs hover:bg-primary/10 hover:text-primary">
                View all
              </Button>
            </div>

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20">
                <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
                <p className="text-muted-foreground mb-6">Create your first project to start coding collaboratively</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create Your First Project
                </Button>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (onSelectProject) {
                        onSelectProject({
                          id: project.id,
                          name: project.name,
                          ownerId: project.owner_id,
                          role: project.current_role,
                        });
                      }
                      navigate(`/projects/${project.id}`, { state: {
                        projectName: project.name,
                        projectOwnerId: project.owner_id,
                        projectRole: project.current_role
                      }});
                    }}
                    className="group p-4 bg-[#0a0a0f] border border-primary/5 rounded-lg hover:border-primary/30 hover:bg-[#161622] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-mono text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                        {'{ }'}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{project.description || 'Node.js'}</span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                          <span>{project.current_role === 'owner' ? '3' : '4'} members</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {formatDistanceToNow(new Date(project.updated_at || ''), { addSuffix: true }).replace('about ', '')}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-primary">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#12121a] border-primary/20">
                          {project.owner_id === user?.id && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditProject(project);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Rename / Edit
                            </DropdownMenuItem>
                          )}
                          <ManageCollaboratorsDialog
                            projectId={project.id}
                            projectOwnerId={project.owner_id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Users className="w-4 h-4 mr-2" />
                                Manage Collaborators
                              </DropdownMenuItem>
                            }
                          />
                          {project.owner_id === user?.id && (
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDeleteProject(project.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Project
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Activity (lg:col-span-1) */}
          <div className="p-6 bg-[#12121a] border border-primary/10 rounded-xl cyber-chamfer-sm flex flex-col">
            <h2 className="text-lg font-bold text-foreground font-heading mb-6">Live activity</h2>
            
            <div className="space-y-6 flex-1">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary/70 shadow-[0_0_8px_rgba(0,255,136,0.6)]"></div>
                    <p className="text-sm text-slate-300">
                      <span className="font-semibold text-foreground">{activity.user?.name || 'A user'}</span> {activity.action.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at || activity.createdAt || ''), { addSuffix: true })}
                    </p>
                  </div>
                ))
              ) : (
                <>
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary/70 shadow-[0_0_8px_rgba(0,255,136,0.6)]"></div>
                    <p className="text-sm text-slate-300"><span className="font-semibold text-foreground">You</span> logged into CodeCollabAI</p>
                    <p className="text-xs text-muted-foreground mt-1">Just now</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-accent-tertiary/70 shadow-[0_0_8px_rgba(0,255,255,0.6)]"></div>
                    <p className="text-sm text-slate-300"><span className="font-semibold text-foreground">System</span> initialized workspaces</p>
                    <p className="text-xs text-muted-foreground mt-1">1 minute ago</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Project Name</label>
              <Input
                value={editingProject?.name || ''}
                onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProject()}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Description (optional)</label>
              <Input
                value={editingProject?.description || ''}
                onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <Button onClick={handleSaveProject} className="w-full gap-2" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
