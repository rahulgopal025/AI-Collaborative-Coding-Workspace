import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  StopCircle,
  Terminal as TerminalIcon,
  Circle,
  Code2,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { useTerminalSocket } from '@/hooks/useTerminalSocket';

interface TerminalPanelProps {
  className?: string;
  onClose?: () => void;
  codeToRun?: string;
  language?: string;
  filePath?: string;
  fileName?: string;
  cwd?: string;
  projectId?: string;
  isVisible?: boolean;
  readOnly?: boolean;
  onSwitchToCodeRunner?: () => void;
}

interface XtermViewProps {
  sessionId: string;
  isActive: boolean;
  isVisible?: boolean;
  readOnly?: boolean;
  initSession: (sessionId: string, cols?: number, rows?: number) => void;
  sendData: (sessionId: string, data: string) => void;
  resize: (sessionId: string, cols: number, rows: number) => void;
  registerDataListener: (sessionId: string, listener: (data: string) => void) => () => void;
}

const XtermView: React.FC<XtermViewProps> = ({
  sessionId,
  isActive,
  isVisible = true,
  readOnly = false,
  onSwitchToCodeRunner,
  initSession,
  sendData,
  resize,
  registerDataListener,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: !readOnly,
      disableStdin: readOnly,
      cursorStyle: readOnly ? 'underline' : 'block',
      fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#1e1e1e',
        foreground: '#f8f8f2',
        cursor: '#50fa7b',
        cursorAccent: '#1e1e1e',
        selectionBackground: 'rgba(255, 255, 255, 0.25)',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch {}

    // Initialize backend PTY session only if not readOnly
    if (!readOnly) {
      initSession(sessionId, term.cols, term.rows);
    } else {
      term.write('\r\n\x1b[33m[Viewer Mode: Terminal is read-only. Terminal commands and code execution are disabled.]\x1b[0m\r\n');
    }

    // Forward user typing to backend PTY if not readOnly
    const onDataDisposable = !readOnly ? term.onData((data) => {
      sendData(sessionId, data);
    }) : { dispose: () => {} };

    // Forward terminal resize to backend PTY
    const onResizeDisposable = term.onResize(({ cols, rows }) => {
      resize(sessionId, cols, rows);
    });

    // Receive data from backend PTY into xterm
    const unregisterDataListener = registerDataListener(sessionId, (data) => {
      term.write(data);
    });

    // Auto-fit on container resize
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.offsetParent !== null) {
        try {
          fitAddon.fit();
        } catch {}
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      unregisterDataListener();
      term.dispose();
    };
  }, [sessionId, initSession, sendData, resize, registerDataListener]);

  // When active tab changes or panel visibility changes, re-fit and focus
  useEffect(() => {
    if (isActive && isVisible && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          try {
            fitAddonRef.current?.fit();
            termRef.current?.focus();
          } catch {}
        }
      }, 50);
    }
  }, [isActive, isVisible]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full p-2 overflow-hidden',
        !isActive && 'hidden'
      )}
      style={{ backgroundColor: '#1e1e1e' }}
    />
  );
};

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  className,
  onClose,
  codeToRun,
  language = 'javascript',
  filePath,
  fileName,
  cwd = '/workspace',
  projectId: propProjectId,
  isVisible = true,
  readOnly = false,
  onSwitchToCodeRunner,
}) => {
  const params = useParams<{ projectId: string }>();
  const projectId = propProjectId || params.projectId || '';

  const [isMinimized, setIsMinimized] = useState(false);
  const { triggerRun, pendingTerminalCommand, setPendingTerminalCommand } = useEditorStore();

  const {
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
    runCode,
    clearTerminal,
  } = useTerminalSocket(projectId);

  // Auto-send pending commands to active terminal
  useEffect(() => {
    if (readOnly) return;
    if (pendingTerminalCommand && activeSessionId) {
      sendData(activeSessionId, `${pendingTerminalCommand}\r`);
      setPendingTerminalCommand(null);
    }
  }, [pendingTerminalCommand, activeSessionId, sendData, setPendingTerminalCommand, readOnly]);

  // Handle single-file run triggers
  useEffect(() => {
    if (triggerRun > 0 && codeToRun) {
      if (readOnly) return;
      const isRecent = Date.now() - triggerRun < 2000;
      if (isRecent) {
        runCode(codeToRun, language);
      }
    }
  }, [triggerRun, codeToRun, language, runCode, readOnly]);

  const handleKill = () => {
    // Send Ctrl+C directly to active PTY
    sendData(activeSessionId, '\x03');
    killSession(activeSessionId);
  };

  return (
    <div
      className={cn(
        'flex flex-col border-t border-[#333] select-none',
        isMinimized && 'h-9',
        className
      )}
      style={{ backgroundColor: '#1e1e1e', fontFamily: '"JetBrains Mono", monospace' }}
    >
      {/* Top Header / Tab Bar */}
      <div
        className="flex items-center justify-between px-2 h-9 border-b border-[#333] shrink-0 overflow-x-auto"
        style={{ backgroundColor: '#252526' }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold text-[#ffb86c] shrink-0">
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Docker Terminal</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onSwitchToCodeRunner) {
                onSwitchToCodeRunner();
              } else {
                useEditorStore.getState().setActiveBottomPanel('runner');
              }
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-sm transition-colors text-[#6272a4] hover:bg-white/5 hover:text-[#50fa7b]"
            title="Switch to Code Runner (Single-File Execution)"
          >
            <Code2 className="w-3.5 h-3.5 text-[#50fa7b]" />
            <span>Code Runner</span>
          </button>


          {/* Docker status pill */}
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-sm shrink-0"
            style={{
              backgroundColor: isConnected ? 'rgba(80, 250, 123, 0.1)' : 'rgba(255, 85, 85, 0.1)',
              color: isConnected ? '#50fa7b' : '#ff5555',
            }}
            title={
              connectionError
                ? `Connection Error: ${connectionError}`
                : isConnected
                ? 'Docker Container Connected (Isolated /workspace)'
                : 'Connecting to Docker container...'
            }
          >
            <Circle className={cn('w-2 h-2 fill-current', isConnected ? 'animate-none' : 'animate-pulse')} />
            <span>{isConnected ? 'Docker' : connectionError ? 'Offline' : 'Connecting...'}</span>
          </div>

          {/* Session Tabs */}
          <div className="flex items-center gap-1 ml-2 overflow-x-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-t-sm cursor-pointer transition-colors shrink-0',
                  activeSessionId === session.id
                    ? 'bg-[#1e1e1e] text-[#f8f8f2] border-t-2 border-primary font-medium'
                    : 'text-[#6272a4] hover:bg-white/5 hover:text-[#f8f8f2]'
                )}
              >
                <span>{session.name}</span>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSession(session.id);
                    }}
                    className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                    title="Close Terminal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* New Terminal Tab Button */}
            <button
              type="button"
              onClick={createSession}
              className="p-1 rounded-sm text-[#6272a4] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
              title="New Terminal Session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            onClick={handleKill}
            title="Send Ctrl+C / Kill Process"
          >
            <StopCircle className="w-3 h-3" />
            <span>Kill</span>
          </button>

          <button
            type="button"
            className="p-1 rounded-sm text-[#6272a4] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
            title="Clear Terminal (Ctrl+L)"
            onClick={clearTerminal}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            className="p-1 rounded-sm text-[#6272a4] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              type="button"
              className="p-1 rounded-sm text-[#6272a4] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
              onClick={onClose}
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Content Area */}
      {!isMinimized && (
        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
          {connectionError && (
            <div className="absolute top-2 left-2 z-10 px-2 py-1 text-xs rounded bg-red-950/80 border border-red-800 text-red-200">
              Docker Terminal Error: {connectionError}
            </div>
          )}
          {readOnly && (
            <div className="px-3 py-1 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5 shrink-0">
              <span>Viewer access: Terminal is read-only. Code execution and interactive terminal disabled.</span>
            </div>
          )}
          {sessions.map((session) => (
            <XtermView
              key={`${projectId}-${session.id}`}
              sessionId={session.id}
              isActive={activeSessionId === session.id}
              isVisible={isVisible}
              readOnly={readOnly}
              initSession={initSession}
              sendData={sendData}
              resize={resize}
              registerDataListener={registerDataListener}
            />
          ))}
        </div>
      )}
    </div>
  );
};
