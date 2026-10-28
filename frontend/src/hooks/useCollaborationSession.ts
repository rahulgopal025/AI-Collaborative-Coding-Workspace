import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { apiBaseUrl, authTokenStore } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useEditorStore } from '@/store/editorStore';
import { FileNode } from '@/types/editor';
import * as Y from 'yjs';

export interface PresenceParticipant {
  id: string;
  user_id: string;
  project_id: string;
  file_path: string | null;
  cursor_line: number | null;
  cursor_column: number | null;
  is_online: boolean;
  last_seen: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    color: number;
  };
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type SaveStatus = 'saved' | 'saving' | 'error';

const socketBaseUrl = apiBaseUrl.replace(/\/api$/, '');

export const useCollaborationSession = ({
  projectId,
  activeFile,
  refetchFiles,
}: {
  projectId: string | null;
  activeFile: FileNode | null;
  refetchFiles: (silent?: boolean) => Promise<void>;
}) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  
  // Yjs documents mapped by fileId
  const yDocsRef = useRef<Map<string, Y.Doc>>(new Map());

  // React STATE (not ref) so changes propagate to consumers and trigger re-renders
  const [activeYDoc, setActiveYDoc] = useState<Y.Doc | null>(null);
  const [isDocSynced, setIsDocSynced] = useState<boolean>(false);

  const [participants, setParticipants] = useState<PresenceParticipant[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Global project connection
  useEffect(() => {
    const token = authTokenStore.get();
    if (!projectId || !token || !user) {
      setConnectionStatus('disconnected');
      setParticipants([]);
      return;
    }

    const socket = io(socketBaseUrl, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token },
    });

    socketRef.current = socket;
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      setConnectionStatus('connected');
      // Join project room
      socket.emit('project:join', { projectId });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      setConnectionStatus('error');
      toast.error(error.message || 'Realtime connection failed');
    });

    socket.on('project:role', (payload: { projectId: string; role: string }) => {
      if (payload?.projectId === projectId && payload?.role) {
        setRole(payload.role.toLowerCase());
      }
    });

    const handleRoleChanged = (payload: { projectId: string; userId: string; role: string }) => {
      if (!payload || payload.projectId !== projectId) return;
      if (payload.userId === user?.id) {
        const newRole = payload.role.toLowerCase();
        setRole(newRole);
        if (newRole === 'viewer') {
          toast.warning('Your role was changed to Viewer. You now have read-only access.', {
            duration: 6000,
          });
        } else if (newRole === 'developer' || newRole === 'editor') {
          toast.success('Your role was changed to Editor. Edit permissions enabled!', {
            duration: 6000,
          });
        }
      }
    };

    socket.on('project:member_role_changed', handleRoleChanged);
    socket.on('member:role_updated', handleRoleChanged);

    socket.on('editor:error', (payload: { fileId?: string; message: string }) => {
      if (payload?.message) {
        toast.error(payload.message);
      }
    });

    socket.on('presence:list', (snapshot: any[]) => {
      if (!Array.isArray(snapshot)) return;

      // Deduplicate by userId
      const uniqueUsers = new Map<string, any>();
      for (const p of snapshot) {
        if (!p || !p.userId) continue;
        if (!uniqueUsers.has(p.userId)) {
          uniqueUsers.set(p.userId, p);
        }
      }

      setParticipants(
        Array.from(uniqueUsers.values()).map((p) => {
          const isSelf = p.userId === user?.id;
          const resolvedName = p.name || p.displayName || (isSelf ? (user?.name || 'You') : 'User');
          return {
            id: p.userId,
            user_id: p.userId,
            project_id: projectId,
            file_path: p.activeFileId || null,
            cursor_line: null,
            cursor_column: null,
            is_online: true,
            last_seen: new Date().toISOString(),
            profile: {
              display_name: resolvedName,
              avatar_url: p.avatarUrl || null,
              color: 1 + ((p.userId || '').charCodeAt(0) % 6),
            },
          };
        })
      );
    });

    socket.on('presence:join', (p: any) => {
      if (!p || !p.userId) return;
      const isSelf = p.userId === user?.id;
      const resolvedName = p.name || p.displayName || (isSelf ? (user?.name || 'You') : 'User');

      setParticipants((prev) => {
        const existingIndex = prev.findIndex((x) => x.user_id === p.userId);
        const updated: PresenceParticipant = {
          id: p.userId,
          user_id: p.userId,
          project_id: projectId,
          file_path: p.activeFileId || null,
          cursor_line: null,
          cursor_column: null,
          is_online: true,
          last_seen: new Date().toISOString(),
          profile: {
            display_name: resolvedName,
            avatar_url: p.avatarUrl || null,
            color: 1 + ((p.userId || '').charCodeAt(0) % 6),
          },
        };

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });

    socket.on('presence:leave', (payload: { socketId: string; userId?: string; hasRemainingConnections?: boolean }) => {
      if (payload?.userId) {
        if (!payload.hasRemainingConnections) {
          setParticipants((prev) => prev.filter((p) => p.user_id !== payload.userId));
        }
      }
    });

    socket.on('presence:update', (payload: any) => {
      if (!payload) return;
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.user_id === payload.userId) {
            return {
              ...p,
              file_path: payload.activeFileId !== undefined ? payload.activeFileId : p.file_path,
              cursor_line: payload.cursor_line !== undefined ? payload.cursor_line : p.cursor_line,
            };
          }
          return p;
        })
      );
    });

    return () => {
      if (socketRef.current?.connected && projectId) {
        socketRef.current.emit('project:leave', { projectId });
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      yDocsRef.current.clear();
      setActiveYDoc(null);
      setIsDocSynced(false);
    };
  }, [projectId, user]);

  // File connection — join the file room, sync Yjs doc, handle updates
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !projectId || !activeFile?.id) {
      setActiveYDoc(null);
      setIsDocSynced(false);
      return;
    }

    const fileId = activeFile.id;
    // Keep a local reference to the file's content for initial population
    const fileContent = activeFile.content || '';

    let doc = yDocsRef.current.get(fileId);
    let isNewDoc = false;
    if (!doc) {
      doc = new Y.Doc();
      yDocsRef.current.set(fileId, doc);
      isNewDoc = true;
    }

    // Set the doc in state immediately so MonacoEditor can receive it
    setActiveYDoc(doc);
    // Reset synced state — we need to wait for server state before binding
    setIsDocSynced(false);

    // Listen for Yjs updates originating locally → broadcast to server
    const onUpdate = (update: Uint8Array, origin: any) => {
      if (origin !== socket) {
        socket.emit('editor:update', { fileId, update: Array.from(update) });
        setSaveStatus('saving');
      }
    };
    
    doc.on('update', onUpdate);

    // Join the file room and request sync
    const joinFile = () => {
      socket.emit('file:join', { fileId, projectId });
      socket.emit('editor:sync', { fileId }); // ask server for full state
    };

    if (socket.connected) {
      joinFile();
    } else {
      socket.once('connect', joinFile);
    }

    // Handle server sending full document state
    const handleEditorSync = (payload: { fileId: string; state: number[] }) => {
      if (payload.fileId !== fileId) return;

      const updateArray = new Uint8Array(payload.state);
      // Apply server state with socket as origin so our onUpdate doesn't re-broadcast
      Y.applyUpdate(doc!, updateArray, socket);

      // If the ytext is still empty after applying server state AND we have file content,
      // populate from the database content (first-time collaborative open)
      const yText = doc!.getText('content');
      if (yText.length === 0 && fileContent.length > 0) {
        yText.insert(0, fileContent);
      }

      // NOW mark as synced — MonacoBinding can safely bind
      setIsDocSynced(true);
    };

    // Handle incremental updates from other collaborators
    const handleEditorUpdate = (payload: { fileId: string; update: number[] }) => {
      if (payload.fileId !== fileId) return;
      const updateArray = new Uint8Array(payload.update);
      Y.applyUpdate(doc!, updateArray, socket);
    };

    // Handle save confirmations
    const handleEditorSaved = (payload: { fileId: string; timestamp: string }) => {
      if (payload.fileId !== fileId) return;
      setSaveStatus('saved');
      setLastSavedAt(payload.timestamp);
    };

    socket.on('editor:sync', handleEditorSync);
    socket.on('editor:update', handleEditorUpdate);
    socket.on('editor:saved', handleEditorSaved);

    return () => {
      doc!.off('update', onUpdate);
      socket.off('editor:sync', handleEditorSync);
      socket.off('editor:update', handleEditorUpdate);
      socket.off('editor:saved', handleEditorSaved);
      if (socket.connected) {
        socket.emit('file:leave', { fileId, projectId });
      }
    };
  }, [projectId, activeFile?.id]);

  // Emit presence cursor updates
  const updateCursor = useCallback((line: number, column: number) => {
    const socket = socketRef.current;
    if (socket?.connected && projectId) {
      socket.emit('presence:update', {
        projectId,
        cursor_line: line,
        cursor_column: column,
        activeFileId: activeFile?.id || null,
      });
    }
  }, [projectId, activeFile?.id]);

  // Force-save: emit editor:save to flush debounced save immediately
  const forceSave = useCallback(() => {
    const socket = socketRef.current;
    const fileId = activeFile?.id;
    if (socket?.connected && fileId) {
      setSaveStatus('saving');
      socket.emit('editor:save', { fileId });
    }
  }, [activeFile?.id]);

  const onlineUsers = useMemo(
    () => participants.filter((participant) => participant.is_online),
    [participants]
  );

  return {
    participants,
    onlineUsers,
    role,
    connectionStatus,
    saveStatus,
    lastSavedAt,
    sendCodeChange: () => {}, // unused with Yjs
    updateCursor,
    activeYDoc,
    isDocSynced,
    forceSave,
    socket: socketRef.current
  };
};
