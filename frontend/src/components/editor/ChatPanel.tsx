import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, ArrowDown, Users, AlertCircle, MessageSquare } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useAuth } from '@/hooks/useAuth';
import { useChatMessages } from '@/hooks/useChatMessages';
import {
  isOwnChatMessage,
  resolveCurrentChatUser,
  formatMessageTime,
  formatDateSeparator,
  isSameDay,
  getInitials,
} from '@/lib/chat';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/editor';

interface ChatPanelProps {
  className?: string;
  projectId?: string;
  socket?: any;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ className, projectId, socket }) => {
  const { currentUser, collaborators } = useEditorStore();
  const { user, profile } = useAuth();
  const {
    messages,
    loading,
    isSending,
    error: chatError,
    sendMessage,
    toggleReaction,
  } = useChatMessages(projectId || '', socket);

  const storeMessages = useEditorStore((s) => s.messages);
  const storeSend = useEditorStore((s) => s.sendMessage);

  const isPersisted = !!projectId;
  const displayMessages: ChatMessage[] = isPersisted ? messages : storeMessages;

  const currentChatUser = useMemo(
    () =>
      resolveCurrentChatUser({
        userId: user?.id,
        profileUserId: profile?.user_id,
        displayName: user?.name || profile?.display_name,
        color: profile?.color,
        fallbackDisplayName: currentUser.name,
        fallbackColor: currentUser.color,
      }),
    [user?.id, user?.name, profile?.user_id, profile?.display_name, profile?.color, currentUser.name, currentUser.color]
  );

  const [inputValue, setInputValue] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if scroll is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 120);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Initial scroll and auto-scroll when near bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom < 160 || displayMessages.length <= 1) {
      scrollToBottom('smooth');
    }
  }, [displayMessages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      if (isPersisted) {
        await sendMessage(trimmed);
      } else {
        storeSend(trimmed);
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      // Restore input on failure so message is not lost
      setInputValue(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const onlineCollaborators = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof collaborators = [];
    for (const c of collaborators) {
      if (c.id && !seen.has(c.id) && c.id !== currentChatUser.id) {
        seen.add(c.id);
        list.push(c);
      }
    }
    return list;
  }, [collaborators, currentChatUser.id]);

  return (
    <div className={cn('flex flex-col h-full bg-card/95 border-l border-border select-none', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/80 bg-secondary/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">Team Chat</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {onlineCollaborators.length + 1} online
          </span>
        </div>
      </div>

      {/* Collaborator Quick-Pills */}
      <div className="px-3 py-1.5 border-b border-border/60 bg-muted/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: `hsl(var(--user-${currentChatUser.color}))` }}
          />
          <span className="font-medium">You</span>
        </div>

        {onlineCollaborators.map((c) => (
          <div
            key={c.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/60 shrink-0"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: `hsl(var(--user-${c.color}))` }}
            />
            <span className="truncate max-w-[90px]">{c.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 relative scrollbar-thin"
      >
        {loading && isPersisted ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading message history...</span>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-secondary/80 flex items-center justify-center mb-3 text-muted-foreground/60 ring-1 ring-border">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Start the discussion! Real-time messages are shared with all project collaborators.
            </p>
          </div>
        ) : (
          displayMessages.map((msg, idx) => {
            const isOwn = isOwnChatMessage(msg.userId, currentChatUser.id);
            const prevMsg = idx > 0 ? displayMessages[idx - 1] : null;

            // Date separator check
            const showDateSeparator =
              !prevMsg || !isSameDay(new Date(prevMsg.timestamp), new Date(msg.timestamp));

            // Consecutive message check (same sender within 5 mins on same day)
            const isConsecutive =
              !showDateSeparator &&
              prevMsg &&
              isOwnChatMessage(prevMsg.userId, msg.userId) &&
              Math.abs(new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 300000;

            const timeString = formatMessageTime(new Date(msg.timestamp));
            const initials = getInitials(msg.userName);

            return (
              <React.Fragment key={msg.id || idx}>
                {/* Date Separator Badge */}
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border/80 shadow-xs">
                      {formatDateSeparator(new Date(msg.timestamp))}
                    </span>
                  </div>
                )}

                {/* Message Row */}
                <div
                  className={cn(
                    'flex items-end gap-1.5 group',
                    isOwn ? 'justify-end' : 'justify-start',
                    isConsecutive ? 'mt-1' : 'mt-2.5'
                  )}
                >
                  {/* Left Avatar for other participants (only on non-consecutive or first in series) */}
                  {!isOwn && (
                    <div className="w-6 shrink-0 mb-0.5">
                      {!isConsecutive ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: `hsl(var(--user-${msg.userColor || 1}))` }}
                          title={msg.userName}
                        >
                          {initials}
                        </div>
                      ) : (
                        <div className="w-6 h-6" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={cn(
                      'flex flex-col max-w-[85%]',
                      isOwn ? 'items-end' : 'items-start'
                    )}
                  >
                    {/* Sender Name (only for other users on first in series) */}
                    {!isOwn && !isConsecutive && (
                      <span
                        className="text-[11px] font-semibold mb-1 ml-1"
                        style={{ color: `hsl(var(--user-${msg.userColor || 1}))` }}
                      >
                        {msg.userName}
                      </span>
                    )}

                    {/* WhatsApp-Style Bubble */}
                    <div
                      className={cn(
                        'chat-message relative px-3 py-1.5 text-xs shadow-xs transition-shadow',
                        isOwn
                          ? 'chat-message own bg-primary/20 text-foreground border border-primary/35 rounded-2xl rounded-tr-xs'
                          : 'chat-message other bg-secondary/85 text-foreground border border-border/80 rounded-2xl rounded-tl-xs'
                      )}
                    >
                      {/* Message Content */}
                      <div className="whitespace-pre-wrap break-words leading-relaxed select-text" style={{ overflowWrap: 'anywhere' }}>
                        {msg.content}
                      </div>

                      {/* Timestamp positioned in bottom right corner */}
                      <div
                        className={cn(
                          'flex items-center justify-end gap-1 mt-0.5 select-none text-[9px] text-muted-foreground/80'
                        )}
                      >
                        <span>{timeString}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute right-6 bottom-20 z-20 p-1.5 rounded-full bg-secondary/90 hover:bg-secondary border border-border text-foreground shadow-md transition-all hover:scale-105"
          title="Scroll to latest messages"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Error Notice */}
      {chatError && (
        <div className="px-3 py-1.5 bg-destructive/15 border-t border-destructive/30 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{chatError}</span>
        </div>
      )}

      {/* Message Input Box */}
      <div className="p-2.5 border-t border-border/80 bg-card">
        <div className="flex items-end gap-2 bg-secondary/40 border border-border/90 rounded-xl px-2.5 py-1.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-28 py-1 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className={cn(
              'shrink-0 p-1.5 rounded-lg transition-all flex items-center justify-center',
              inputValue.trim() && !isSending
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
                : 'bg-muted/60 text-muted-foreground/60 cursor-not-allowed'
            )}
            title="Send message (Enter)"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
