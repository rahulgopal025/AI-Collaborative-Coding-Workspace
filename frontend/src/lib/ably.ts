/**
 * Ably compatibility stub.
 *
 * The original code_together project used Ably for real-time chat.
 * CodeCollabAI uses Socket.IO instead. This stub keeps the import
 * contract so existing hooks compile, while doing nothing at runtime.
 * Chat still works via REST polling in useChatMessages.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useAblyChat(
  _projectId?: string,
  _onMessage?: (message: any) => void,
  _onReaction?: (data: any) => void,
) {
  // no-op: real-time chat events are handled via REST polling
}
