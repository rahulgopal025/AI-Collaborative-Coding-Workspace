import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { TerminalLine } from "@/types/editor";
import { useEditorStore } from "@/store/editorStore";

export const useTerminalSocket = () => {
  const { setIsTerminalRunning } = useEditorStore();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingInput, setIsWaitingInput] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
    
    // Connect to specific execution namespace
    const socket = io(`${backendUrl}/execution`, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Terminal execution socket bound:", socket.id);
      socket.emit("get-cwd");
    });

    socket.on("cwd-changed", ({ cwd }: { cwd: string }) => {
      setCurrentCwd(cwd);
    });

    socket.on("clear-terminal", () => {
      setLines([]);
    });

    socket.on("execution-started", (payload: { mode: string; language?: string; command?: string; cwd?: string }) => {
      if (payload.cwd) setCurrentCwd(payload.cwd);
      // Shell commands are already echoed by runShellCommand() before the event arrives
      if (payload.mode !== 'shell') {
        setLines(prev => [...prev, {
          type: 'system',
          content: `[Starting ${payload.language} process via ${payload.mode} Engine]`,
          timestamp: new Date()
        }]);
      }
      setIsRunning(true);
      setIsTerminalRunning(true);
      setIsWaitingInput(false);
    });

    socket.on("output", (payload: { type: 'output' | 'error' | 'system', content: string }) => {
      setLines((prev) => [
        ...prev,
        {
          type: payload.type,
          content: payload.content,
          timestamp: new Date(),
        },
      ]);
      
      // If the process expects input, it hangs and the last line looks like a prompt or simply stops
      // E.g.: `a = input("Enter number: ")` prints `Enter number: ` natively without "\n".
      if (payload.type === 'output' && !payload.content.endsWith('\n') && !!payload.content.trim()) {
        setIsWaitingInput(true);
      } else {
         setIsWaitingInput(false);
      }

      if (payload.type === 'system' && payload.content.includes('[Process Finished')) {
        setIsRunning(false);
        setIsTerminalRunning(false);
        setIsWaitingInput(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const runCode = useCallback(async (code: string, language: string, stdin?: string) => {
    setLines([]);
    setIsRunning(true);
    setIsTerminalRunning(true);
    
    // Determine language identifier for the API
    const languageId = language.toLowerCase();
    const mappedLanguage = languageId === 'python' ? 'python3' : 
                           languageId === 'c++' ? 'cpp' : 
                           languageId === 'c#' ? 'csharp' : languageId;
    
    setLines([{ type: 'system', content: `[Running ${mappedLanguage} process via Paiza.IO]`, timestamp: new Date() }]);

    try {
      const { apiRequest } = await import('@/lib/api');
      const response = await apiRequest<{
        status: string;
        result: string;
        stdout: string;
        stderr: string;
        buildStdout: string;
        buildStderr: string;
        buildResult: string;
        time: string;
        memory: number;
      }>('/execution/run', {
        method: 'POST',
        body: { language: mappedLanguage, sourceCode: code, stdin: stdin || '' }
      });

      const outLines = [];
      
      if (response.buildResult && response.buildResult !== 'success') {
        if (response.buildStdout) outLines.push({ type: 'error', content: response.buildStdout, timestamp: new Date() });
        if (response.buildStderr) outLines.push({ type: 'error', content: response.buildStderr, timestamp: new Date() });
      } else {
        if (response.stdout) outLines.push({ type: 'output', content: response.stdout, timestamp: new Date() });
        if (response.stderr) outLines.push({ type: 'error', content: response.stderr, timestamp: new Date() });
        if (outLines.length === 0) outLines.push({ type: 'system', content: '[No output]', timestamp: new Date() });
      }

      const memoryMB = (response.memory / 1024 / 1024).toFixed(2);
      outLines.push({ 
        type: 'system', 
        content: `\n[Process Finished with status: ${response.result} in ${response.time}s, memory: ${memoryMB}MB]`, 
        timestamp: new Date() 
      });

      setLines(prev => [...prev, ...(outLines as any)]);
    } catch (error: any) {
      setLines(prev => [...prev, { type: 'error', content: `Execution failed: ${error.message || 'Unknown error'}`, timestamp: new Date() }]);
    } finally {
      setIsRunning(false);
      setIsTerminalRunning(false);
      setIsWaitingInput(false);
    }
  }, []);

  const runShellCommand = useCallback((command: string, cwd?: string) => {
    if (!socketRef.current) return;
    setLines((prev) => [
      ...prev,
      { type: 'system', content: `$ ${command}`, timestamp: new Date() }
    ]);
    setIsRunning(true);
    setIsTerminalRunning(true);
    socketRef.current.emit("run-shell-command", { command, cwd });
  }, []);

  const sendInput = useCallback((input: string) => {
    if (!socketRef.current) return;
    
    // Visual echo
    setLines((prev) => [
      ...prev,
      {
        type: 'output',
        content: input + "\n",
        timestamp: new Date(),
      },
    ]);
    
    setIsWaitingInput(false); // Assume input consumed locally
    socketRef.current.emit("send-input", { input });
  }, []);

  const killProcess = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("kill-process");
    setIsRunning(false);
    setIsTerminalRunning(false);
    setIsWaitingInput(false);
  }, []);

  const clearTerminal = useCallback(() => {
    setLines([]);
  }, []);

  return {
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
