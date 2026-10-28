import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Loader2, X, Crown, Shield, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email("Please enter a valid email address");

interface ApiMember {
  id: string;
  userId: string;
  role: "OWNER" | "DEVELOPER" | "VIEWER" | string;
  joinedAt?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
  };
}

export interface CollaboratorItem {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  color: number;
}

interface ManageCollaboratorsDialogProps {
  projectId: string;
  projectOwnerId?: string;
  trigger?: React.ReactNode;
  onRoleChanged?: (userId: string, newRole: string) => void;
}

export const ManageCollaboratorsDialog: React.FC<ManageCollaboratorsDialogProps> = ({
  projectId,
  projectOwnerId,
  trigger,
  onRoleChanged,
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<CollaboratorItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // User is owner if matching projectOwnerId or has OWNER role in member list
  const isOwner =
    Boolean(user?.id && projectOwnerId && user.id === projectOwnerId) ||
    members.some((m) => m.userId === user?.id && m.role.toUpperCase() === "OWNER");

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    setLoadingList(true);
    try {
      const data = await apiRequest<ApiMember[]>(`/projects/${projectId}/collaborators`);
      const mapped: CollaboratorItem[] = (data || []).map((m) => {
        const uId = m.userId || m.user?.id || m.id;
        const normalizedRole = (m.role || "DEVELOPER").toUpperCase();
        return {
          id: m.id,
          userId: uId,
          role: normalizedRole,
          name: m.user?.name || (m.role === "OWNER" ? "Project Owner" : "Collaborator"),
          email: m.user?.email || "",
          avatarUrl: m.user?.avatarUrl || null,
          color: 1 + ((uId || "a").charCodeAt(0) % 6),
        };
      });

      // Sort so OWNER is first, then DEVELOPER, then VIEWER
      mapped.sort((a, b) => {
        const rank = (r: string) => (r === "OWNER" ? 0 : r === "DEVELOPER" ? 1 : 2);
        return rank(a.role) - rank(b.role);
      });

      setMembers(mapped);
    } catch {
      toast.error("Failed to load project members");
    } finally {
      setLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  const handleInvite = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Please enter a valid email address");
      return;
    }

    setInviting(true);
    try {
      await apiRequest(`/projects/${projectId}/collaborators`, {
        method: "POST",
        body: {
          email: parsed.data.toLowerCase(),
          role: role === "viewer" ? "VIEWER" : "DEVELOPER",
        },
      });

      toast.success("Collaborator added successfully!");
      setEmail("");
      setRole("editor");
      await fetchMembers();
    } catch (error) {
      toast.error((error as Error).message || "Failed to invite collaborator");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: "DEVELOPER" | "VIEWER") => {
    if (updatingRoleId) return;
    setUpdatingRoleId(memberUserId);

    try {
      await apiRequest(`/projects/${projectId}/collaborators/${memberUserId}`, {
        method: "PUT",
        body: { role: newRole },
      });

      setMembers((prev) =>
        prev.map((m) => (m.userId === memberUserId ? { ...m, role: newRole } : m))
      );

      const label = newRole === "DEVELOPER" ? "Editor" : "Viewer";
      toast.success(`Role updated to ${label} successfully`);

      if (onRoleChanged) {
        onRoleChanged(memberUserId, newRole);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update member role");
      // Refetch to ensure displayed state matches DB
      await fetchMembers();
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemove = async (memberUserId: string) => {
    if (removingId) return;
    setRemovingId(memberUserId);
    try {
      await apiRequest(`/projects/${projectId}/collaborators/${memberUserId}`, {
        method: "DELETE",
      });

      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
      toast.success("Member removed from project");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" />
            Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Project Members & Roles
          </DialogTitle>
        </DialogHeader>

        {isOwner && (
          <div className="space-y-3 mt-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Invite new member
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                className="flex-1 text-sm"
              />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-28 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      Editor
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      Viewer
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} size="icon" disabled={inviting || !email.trim()}>
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <Separator className="my-3" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members ({members.length})
            </label>
            <span className="text-[11px] text-muted-foreground">
              {isOwner ? "Owner can manage roles" : "View only"}
            </span>
          </div>

          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No members found</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {members.map((member) => {
                const isMemberOwner = member.role === "OWNER";
                const isSelf = member.userId === user?.id;
                const canModifyRole = isOwner && !isMemberOwner && !isSelf;
                const isUpdating = updatingRoleId === member.userId;
                const isRemoving = removingId === member.userId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/40 bg-card/60 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm"
                        style={{
                          backgroundColor: isMemberOwner
                            ? "hsl(var(--primary))"
                            : `hsl(var(--user-${member.color}))`,
                        }}
                      >
                        {isMemberOwner ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{member.name}</span>
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground font-mono">(you)</span>
                          )}
                        </div>
                        {member.email && (
                          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isMemberOwner ? (
                        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-300 border-amber-500/30">
                          <Crown className="w-3 h-3" />
                          Owner
                        </Badge>
                      ) : canModifyRole ? (
                        isUpdating ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            <span>Updating...</span>
                          </div>
                        ) : (
                          <Select
                            value={member.role === "VIEWER" ? "VIEWER" : "DEVELOPER"}
                            onValueChange={(val) =>
                              handleRoleChange(member.userId, val as "DEVELOPER" | "VIEWER")
                            }
                            disabled={isUpdating || isRemoving}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DEVELOPER">
                                <span className="flex items-center gap-1 text-xs">
                                  <Edit3 className="w-3 h-3 text-blue-400" />
                                  Editor
                                </span>
                              </SelectItem>
                              <SelectItem value="VIEWER">
                                <span className="flex items-center gap-1 text-xs">
                                  <Eye className="w-3 h-3 text-slate-400" />
                                  Viewer
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        <Badge variant="outline" className="capitalize text-xs">
                          {member.role === "DEVELOPER" ? (
                            <span className="flex items-center gap-1">
                              <Edit3 className="w-3 h-3 text-blue-400" />
                              Editor
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-slate-400" />
                              Viewer
                            </span>
                          )}
                        </Badge>
                      )}

                      {isOwner && !isMemberOwner && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(member.userId)}
                          disabled={isRemoving || isUpdating}
                          title="Remove member"
                        >
                          {isRemoving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
