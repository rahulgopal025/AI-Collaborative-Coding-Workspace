import { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessage } from "@/types/editor";
import { ChatMessageRow, resolveCurrentChatUser, toChatMessage } from "@/lib/chat";
// Ably is removed

export type { ChatMessageRow } from "@/lib/chat";

export const useChatMessages = (projectId: string, socket?: any) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const currentChatUser = useMemo(
    () =>
      resolveCurrentChatUser({
        userId: user?.id,
        profileUserId: profile?.user_id,
        displayName: profile?.display_name,
        color: profile?.color,
      }),
    [profile?.color, profile?.display_name, profile?.user_id, user?.id]
  );

  const fetchMessages = useCallback(
    async (silent: boolean = false) => {
      if (!projectId) {
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        // Changed to correct endpoint
        const data = await apiRequest<ChatMessageRow[]>(`/projects/${projectId}/messages`);
        setMessages((data || []).map((row) => toChatMessage(row, currentChatUser)));
      } catch (error) {
        if (!silent) {
          console.error("Failed to load chat messages:", error);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [currentChatUser, projectId]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!projectId) return;

    // Polling as fallback if Socket is not available
    const interval = window.setInterval(() => {
      fetchMessages(true);
    }, 10000); 

    return () => window.clearInterval(interval);
  }, [projectId, fetchMessages]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleNewMessage = (message: any) => {
      const mappedMessage = toChatMessage(message, currentChatUser);
      setMessages((prev) => {
        if (prev.some((m) => m.id === mappedMessage.id)) return prev;
        return [...prev, mappedMessage];
      });
    };

    socket.on('message:new', handleNewMessage);
    
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, projectId, currentChatUser]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentChatUser.id || !projectId) return;

      try {
        if (socket && socket.connected) {
          socket.emit('message:send', { projectId, content });
          // Note: we wait for the message:new event to append it to the list
        } else {
          console.warn("Socket not connected, cannot send message.");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [currentChatUser.id, projectId, socket]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentChatUser.id || !projectId) return;
      console.warn("Reactions are not currently supported by the backend.");
    },
    [currentChatUser.id, projectId]
  );

  return { messages, loading, sendMessage, toggleReaction };
};
