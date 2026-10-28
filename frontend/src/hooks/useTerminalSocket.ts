import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { TerminalLine } from "@/types/editor";
import { useEditorStore } from "@/store/editorStore";
import { authTokenStore, apiRequest } from "@/lib/api";

export interface TerminalSession {
  id: string;
  name: string;
  isReady: boolean;
}

export const useTerminalSocket = (projectId?: string) => {
  const { setIsTerminalRunning, setHasNodeModules } = useEditorStore();
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: "default", name: "Terminal 1", isReady: false },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>("default");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isDockerReady, setIsDockerReady] = useState<boolean>(false);

  // Backward-compatibility state for legacy callers
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingInput, setIsWaitingInput] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>('/workspace');

  const socketRef = useRef<Socket | null>(null);
  const dataListenersRef = useRef<Map<string, (data: string) => void>>(new Map());
  const activeSessionsDimensionsRef = useRef<Map<string, { cols: number; rows: number }>>(
    new Map([['default', { cols: 80, rows: 24 }]])
  );

  // Reset sessions and connection state when switching projects
  useEffect(() => {
    setSessions([{ id: "default", name: "Terminal 1", isReady: false }]);
    setActiveSessionId("default");
    setIsConnected(false);
    setConnectionError(null);
    activeSessionsDimensionsRef.current = new Map([['default', { cols: 80, rows: 24 }]]);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const backendUrl =
      import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
    const token = authTokenStore.get();

    // Connect to /project-runner namespace with JWT authentication and project ID
    const socket = io(`${backendUrl}/project-runner`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: { token, projectId },
      query: { token, projectId },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[ProjectRunner] Terminal socket connected (${socket.id}) for project: ${projectId}`);
      setIsConnected(true);
      setConnectionError(null);

      // Check Docker status
      socket.emit("runner:check-docker");

      // Auto-initialize terminal session(s) on connect/reconnect with current projectId
      activeSessionsDimensionsRef.current.forEach(({ cols, rows }, sessId) => {
        socket.emit("terminal:init", { projectId, sessionId: sessId, cols, rows });
      });

      // Check node_modules presence on connect
      apiRequest<{ hasNodeModules: boolean }>(`/project-runner/${projectId}/node-modules`)
        .then((res) => {
          if (res?.hasNodeModules !== undefined) {
            setHasNodeModules(res.hasNodeModules);
          }
        })
        .catch(() => {});
    });

    socket.on("connect_error", (err) => {
      console.warn("[ProjectRunner] Connection error:", err.message);
      setIsConnected(false);
      setConnectionError(err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[ProjectRunner] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("runner:docker-status", (status: { available: boolean }) => {
      setIsDockerReady(status.available);
    });

    socket.on("terminal:data", ({ sessionId, data }: { sessionId: string; data: string }) => {
      const listener = dataListenersRef.current.get(sessionId);
      if (listener) {
        listener(data);
      }
    });

    socket.on("terminal:ready", ({ sessionId }: { sessionId: string }) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, isReady: true } : s))
      );
    });

    socket.on("terminal:exit", ({ sessionId, code }: { sessionId: string; code?: number }) => {
      const listener = dataListenersRef.current.get(sessionId);
      if (listener) {
        listener(`\r\n\x1b[33m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`);
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, isReady: false } : s))
      );
    });

    socket.on(
      "runner:node-modules-status",
      ({ hasNodeModules: exists }: { hasNodeModules: boolean }) => {
        setHasNodeModules(exists);
      }
    );

    socket.on("runner:error", ({ message }: { message: string }) => {
      setConnectionError(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, setHasNodeModules]);

  const initSession = useCallback(
    (sessionId: string, cols = 80, rows = 24) => {
      if (!projectId) return;
      activeSessionsDimensionsRef.current.set(sessionId, { cols, rows });
      if (socketRef.current) {
        socketRef.current.emit("terminal:init", { projectId, sessionId, cols, rows });
      }
    },
    [projectId]
  );

  const sendData = useCallback((sessionId: string, data: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("terminal:data", { sessionId, data });
  }, []);

  const resize = useCallback((sessionId: string, cols: number, rows: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit("terminal:resize", { sessionId, cols, rows });
  }, []);

  const killSession = useCallback((sessionId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("terminal:kill", { sessionId });
  }, []);

  const createSession = useCallback(() => {
    const nextIdx = sessions.length + 1;
    const id = `session-${Date.now().toString(36)}`;
    const name = `Terminal ${nextIdx}`;
    setSessions((prev) => [...prev, { id, name, isReady: false }]);
    setActiveSessionId(id);
    return id;
  }, [sessions.length]);

  const closeSession = useCallback(
    (id: string) => {
      killSession(id);
      dataListenersRef.current.delete(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const fallback = { id: `session-${Date.now().toString(36)}`, name: "Terminal 1", isReady: false };
          setActiveSessionId(fallback.id);
          return [fallback];
        }
        if (activeSessionId === id) {
          setActiveSessionId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [killSession, activeSessionId]
  );

  const registerDataListener = useCallback(
    (sessionId: string, listener: (data: string) => void) => {
      dataListenersRef.current.set(sessionId, listener);
      return () => {
        dataListenersRef.current.delete(sessionId);
      };
    },
    []
  );

  // Backward-compatible runShellCommand
  const runShellCommand = useCallback(
    (command: string) => {
      sendData(activeSessionId, `${command}\r`);
    },
    [sendData, activeSessionId]
  );

  const sendInput = useCallback(
    (input: string) => {
      sendData(activeSessionId, `${input}\r`);
    },
    [sendData, activeSessionId]
  );

  const killProcess = useCallback(() => {
    killSession(activeSessionId);
  }, [killSession, activeSessionId]);

  const clearTerminal = useCallback(() => {
    const listener = dataListenersRef.current.get(activeSessionId);
    if (listener) {
      listener("\x1b[2J\x1b[3J\x1b[H");
    }
  }, [activeSessionId]);

  const runCode = useCallback(async (code: string, language: string, stdin?: string) => {
    setIsRunning(true);
    setIsTerminalRunning(true);

    const languageId = language.toLowerCase();
    const mappedLanguage =
      languageId === "python"
        ? "python3"
        : languageId === "c++"
        ? "cpp"
        : languageId === "c#"
        ? "csharp"
        : languageId;

    try {
      const { apiRequest } = await import("@/lib/api");
      const response = await apiRequest<{
        status: string;
        result: string;
        stdout: string;
        stderr: string;
        time: string;
        memory: number;
      }>("/execution/run", {
        method: "POST",
        body: { language: mappedLanguage, sourceCode: code, stdin: stdin || "", projectId: projectId || undefined },
      });

      const listener = dataListenersRef.current.get(activeSessionId);
      if (listener) {
        if (response.stdout) listener(response.stdout.replace(/\n/g, "\r\n") + "\r\n");
        if (response.stderr) listener(`\x1b[31m${response.stderr.replace(/\n/g, "\r\n")}\x1b[0m\r\n`);
        listener(`\r\n\x1b[32m[Process Finished with status: ${response.result} in ${response.time}s]\x1b[0m\r\n`);
      }
    } catch (error: any) {
      const listener = dataListenersRef.current.get(activeSessionId);
      if (listener) {
        listener(`\r\n\x1b[31mExecution failed: ${error.message || "Unknown error"}\x1b[0m\r\n`);
      }
    } finally {
      setIsRunning(false);
      setIsTerminalRunning(false);
    }
  }, [activeSessionId, setIsTerminalRunning]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    isConnected,
    connectionError,
    isDockerReady,
    initSession,
    sendData,
    resize,
    killSession,
    createSession,
    closeSession,
    registerDataListener,
    // Backward-compat exports
    lines,
    isRunning,
    isWaitingInput,
    currentCwd,
    runCode,
    runShellCommand,
    sendInput,
    killProcess,
    clearTerminal,
  };
};
