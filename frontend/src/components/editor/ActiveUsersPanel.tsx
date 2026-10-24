import React, { useMemo } from 'react';
import { Eye, PencilLine, Users, Circle } from 'lucide-react';
import { PresenceParticipant } from '@/hooks/useCollaborationSession';
import { getInitials } from '@/lib/chat';
import { cn } from '@/lib/utils';

interface ActiveUsersPanelProps {
  className?: string;
  users: PresenceParticipant[];
  currentUserId: string | null;
  activeFilePath: string | null;
}

const getPresenceLabel = (user: PresenceParticipant, activeFilePath: string | null) => {
  if (!user.file_path) {
    return 'Online in project';
  }

  if (activeFilePath && user.file_path === activeFilePath) {
    if (user.cursor_line) {
      return `Editing line ${user.cursor_line}`;
    }
    return 'Viewing this file';
  }

  const segments = user.file_path.split(/[\\/]/);
  const shortPath = segments[segments.length - 1] || user.file_path;
  return `Viewing ${shortPath}`;
};

export const ActiveUsersPanel: React.FC<ActiveUsersPanelProps> = ({
  className,
  users,
  currentUserId,
  activeFilePath,
}) => {
  // Deduplicate users by user_id and sort current user to the top
  const deduplicatedUsers = useMemo(() => {
    const map = new Map<string, PresenceParticipant>();
    for (const u of users) {
      if (u.user_id && !map.has(u.user_id)) {
        map.set(u.user_id, u);
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      const nameA = a.profile?.display_name || '';
      const nameB = b.profile?.display_name || '';
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [users, currentUserId]);

  return (
    <div className={cn('flex flex-col border-b border-border bg-card/60 select-none', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/70 bg-secondary/30">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>Active Users</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {deduplicatedUsers.length} online
        </span>
      </div>

      <div className="max-h-[260px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
        {deduplicatedUsers.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No active collaborators online.
          </div>
        ) : (
          deduplicatedUsers.map((participant) => {
            const isCurrentUser = participant.user_id === currentUserId;
            const label = getPresenceLabel(participant, activeFilePath);
            const colorIndex = participant.profile?.color || 1;
            const rawDisplayName = participant.profile?.display_name?.trim();
            const displayName = rawDisplayName && rawDisplayName.length > 0 ? rawDisplayName : 'User';
            const avatarUrl = participant.profile?.avatar_url;
            const initials = getInitials(displayName);

            return (
              <div
                key={participant.user_id}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-secondary/40',
                  isCurrentUser && 'bg-primary/5'
                )}
              >
                {/* User Avatar with colored badge and online status */}
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm ring-1 ring-black/20"
                      style={{ backgroundColor: `hsl(var(--user-${colorIndex}))` }}
                    >
                      {initials}
                    </div>
                  )}
                  {/* Status Indicator Dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>

                {/* Name & Activity */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-medium bg-primary/20 text-primary border border-primary/30">
                        you
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/90 truncate">
                    {label.includes('Editing') ? (
                      <PencilLine className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <Eye className="w-3 h-3 text-blue-400 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
