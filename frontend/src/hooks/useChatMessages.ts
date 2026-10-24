import { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ChatMessage } from "@/types/editor";
import { ChatMessageRow, resolveCurrentChatUser, toChatMessage } from "@/lib/chat";

export type { ChatMessageRow } from "@/lib/chat";

export const useChatMessages = (projectId: string, socket?: any) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentChatUser = useMemo(
    () =>
      resolveCurrentChatUser({
        userId: user?.id,
        profileUserId: profile?.user_id,
        displayName: user?.name || profile?.display_name,
        color: profile?.color,
      }),
    [profile?.color, profile?.display_name, profile?.user_id, user?.id, user?.name]
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
        setError(null);
        const data = await apiRequest<ChatMessageRow[]>(`/projects/${projectId}/messages`);
        setMessages((data || []).map((row) => toChatMessage(row, currentChatUser)));
      } catch (err: any) {
        if (!silent) {
          console.error("Failed to load chat messages:", err);
          setError(err.message || "Failed to load chat messages");
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
    }, 15000);

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

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, projectId, currentChatUser]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !projectId) return;

      setIsSending(true);
      setError(null);

      try {
        if (socket && socket.connected) {
          socket.emit("message:send", { projectId, content: trimmed });
        } else {
          throw new Error("Chat connection is offline. Please try again.");
        }
      } catch (err: any) {
        console.error("Failed to send message:", err);
        setError(err.message || "Failed to send message");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [projectId, socket]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentChatUser.id || !projectId) return;
      console.warn("Reactions are not currently supported by the backend.");
    },
    [currentChatUser.id, projectId]
  );

  return { messages, loading, isSending, error, sendMessage, toggleReaction, refetch: fetchMessages };
};
