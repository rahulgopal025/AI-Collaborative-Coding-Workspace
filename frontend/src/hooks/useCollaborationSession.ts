import { useEffect, useMemo, useRef, useState } from 'react';
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
  const activeDocRef = useRef<Y.Doc | null>(null);

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
      activeDocRef.current = null;
    };
  }, [projectId, user]);

  // File connection
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !projectId || !activeFile?.id) {
      activeDocRef.current = null;
      return;
    }

    const fileId = activeFile.id;
    let doc = yDocsRef.current.get(fileId);
    if (!doc) {
      doc = new Y.Doc();
      yDocsRef.current.set(fileId, doc);
    }
    activeDocRef.current = doc;

    const onUpdate = (update: Uint8Array, origin: any) => {
      if (origin !== socket) {
        socket.emit('editor:update', { fileId, update: Array.from(update) });
        setSaveStatus('saving');
        setTimeout(() => setSaveStatus('saved'), 1000); // debounce save indicator
      }
    };
    
    doc.on('update', onUpdate);

    const joinFile = () => {
      socket.emit('file:join', { fileId, projectId });
      socket.emit('editor:sync', { fileId }); // ask for sync
    };

    if (socket.connected) {
      joinFile();
    } else {
      socket.once('connect', joinFile);
    }

    const handleEditorSync = (payload: { fileId: string; state: number[] }) => {
      if (payload.fileId === fileId) {
        const updateArray = new Uint8Array(payload.state);
        Y.applyUpdate(doc!, updateArray, socket);
      }
    };

    const handleEditorUpdate = (payload: { fileId: string; update: number[] }) => {
      if (payload.fileId === fileId) {
        const updateArray = new Uint8Array(payload.update);
        Y.applyUpdate(doc!, updateArray, socket);
      }
    };

    socket.on('editor:sync', handleEditorSync);
    socket.on('editor:update', handleEditorUpdate);

    return () => {
      doc!.off('update', onUpdate);
      socket.off('editor:sync', handleEditorSync);
      socket.off('editor:update', handleEditorUpdate);
      if (socket.connected) {
        socket.emit('file:leave', { fileId, projectId });
      }
    };
  }, [projectId, activeFile?.id]);

  const updateCursor = (line: number, column: number) => {
    // optional: CodeCollabAI backend might not have cursor support yet via socket, or it might be in Yjs awareness.
  };

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
    activeYDoc: activeDocRef.current,
    socket: socketRef.current
  };
};

