import { ChatMessage } from "@/types/editor";

export interface ChatMessageUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface ChatMessageRow {
  id: string;
  project_id?: string;
  projectId?: string;
  user_id?: string;
  userId?: string;
  content: string;
  type?: string;
  created_at?: string;
  createdAt?: string;
  timestamp?: string | Date;
  user_name?: string;
  userName?: string;
  user_color?: number;
  userColor?: number;
  user?: ChatMessageUser | null;
  reactions?: Record<string, string[]>;
}

export interface ChatCurrentUser {
  id: string;
  displayName: string;
  color: number;
}

export const normalizeChatId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    if ("_id" in (value as any)) {
      return normalizeChatId((value as any)._id);
    }
    if ("id" in (value as any)) {
      return normalizeChatId((value as any).id);
    }
  }

  return String(value);
};

export const resolveCurrentChatUser = ({
  userId,
  profileUserId,
  displayName,
  color,
  fallbackDisplayName,
  fallbackColor,
}: {
  userId?: unknown;
  profileUserId?: unknown;
  displayName?: string | null;
  color?: number | null;
  fallbackDisplayName?: string | null;
  fallbackColor?: number | null;
}): ChatCurrentUser => {
  const resolvedName = (displayName || fallbackDisplayName || "").trim();
  return {
    id: normalizeChatId(userId || profileUserId),
    displayName: resolvedName || "User",
    color:
      typeof color === "number"
        ? color
        : typeof fallbackColor === "number"
          ? fallbackColor
          : 1,
  };
};

export const isOwnChatMessage = (messageUserId: unknown, currentUserId: unknown): boolean => {
  const normalizedMessageUserId = normalizeChatId(messageUserId);
  const normalizedCurrentUserId = normalizeChatId(currentUserId);

  return Boolean(
    normalizedMessageUserId &&
    normalizedCurrentUserId &&
    normalizedMessageUserId === normalizedCurrentUserId
  );
};

export const getInitials = (name?: string | null): string => {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const toChatMessage = (
  row: ChatMessageRow,
  currentUser?: Partial<ChatCurrentUser> | null
): ChatMessage => {
  const resolvedUserId = normalizeChatId(row.userId || row.user_id || row.user?.id);
  const isOwn = isOwnChatMessage(resolvedUserId, currentUser?.id);
  const normalizedCurrentUserDisplayName = String(currentUser?.displayName || "").trim();

  // Resolve sender name:
  // 1. If own message: use current user's verified name or "You"
  // 2. If other participant: use backend user.name, userName, user_name
  // 3. Fallback: "User" (never raw UUID or "Unknown")
  let resolvedUserName = "User";
  if (isOwn) {
    resolvedUserName = normalizedCurrentUserDisplayName || "You";
  } else {
    const rawName = row.user?.name || row.userName || row.user_name;
    if (rawName && typeof rawName === "string" && rawName.trim()) {
      resolvedUserName = rawName.trim();
    }
  }

  // Deterministic user color 1-6
  const fallbackColor = resolvedUserId
    ? 1 + (resolvedUserId.charCodeAt(0) % 6)
    : 1;
  const userColor = isOwn && typeof currentUser?.color === "number"
    ? currentUser.color
    : (row.userColor || row.user_color || fallbackColor);

  // Parse timestamp safely
  const rawTimestamp = row.createdAt || row.created_at || row.timestamp;
  const parsedDate = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const timestamp = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return {
    id: normalizeChatId(row.id),
    userId: resolvedUserId,
    userName: resolvedUserName,
    userColor,
    content: row.content || "",
    timestamp,
    type: row.type === "code" ? "code" : "text",
    reactions: row.reactions || {},
  };
};

export const formatMessageTime = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const formatDateSeparator = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return "";

  const now = new Date();
  if (isSameDay(date, now)) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  // e.g. "Sat, Oct 24, 2026"
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};
