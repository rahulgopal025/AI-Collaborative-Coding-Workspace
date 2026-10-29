import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  X,
  Code2,
  FileCode,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { useEditorStore } from '@/store/editorStore';

interface CodeRunnerPanelProps {
  className?: string;
  projectId?: string;
  codeToRun?: string;
  language?: string;
  fileName?: string;
  isVisible?: boolean;
  readOnly?: boolean;
  onClose?: () => void;
  onSwitchToDockerTerminal?: () => void;
}

interface ExecutionResponse {
  id: string;
  language: string;
  status: string;
  result: 'success' | 'failure' | 'timeout' | null;
  stdout: string;
  stderr: string;
  buildStdout?: string;
  buildStderr?: string;
  buildResult?: 'success' | 'failure' | string;
  buildExitCode?: number | string;
  time?: string;
  memory?: number;
}

const SUPPORTED_RUNNER_LANGUAGES = [
  { id: 'c', name: 'C (GCC)', extension: 'c', icon: 'C' },
  { id: 'cpp', name: 'C++ (G++)', extension: 'cpp', icon: 'C++' },
  { id: 'java', name: 'Java (OpenJDK)', extension: 'java', icon: 'Java' },
  { id: 'python3', name: 'Python 3', extension: 'py', icon: 'Py' },
  { id: 'javascript', name: 'JavaScript (Node)', extension: 'js', icon: 'JS' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts', icon: 'TS' },
  { id: 'go', name: 'Go', extension: 'go', icon: 'Go' },
  { id: 'rust', name: 'Rust', extension: 'rs', icon: 'Rs' },
  { id: 'csharp', name: 'C# (Mono)', extension: 'cs', icon: 'C#' },
];

function detectLanguage(fileName?: string, defaultLang?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'c') return 'c';
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'h' || ext === 'hpp') return 'cpp';
    if (ext === 'java') return 'java';
    if (ext === 'py') return 'python3';
    if (ext === 'js' || ext === 'mjs') return 'javascript';
    if (ext === 'ts') return 'typescript';
    if (ext === 'go') return 'go';
    if (ext === 'rs') return 'rust';
    if (ext === 'cs') return 'csharp';
  }

  if (defaultLang) {
    const l = defaultLang.toLowerCase();
    if (l === 'c') return 'c';
    if (l === 'cpp' || l === 'c++') return 'cpp';
    if (l === 'java') return 'java';
    if (l === 'python' || l === 'python3' || l === 'py') return 'python3';
    if (l === 'javascript' || l === 'js') return 'javascript';
    if (l === 'typescript' || l === 'ts') return 'typescript';
    if (l === 'go') return 'go';
    if (l === 'rust') return 'rust';
    if (l === 'csharp' || l === 'c#') return 'csharp';
  }

  return 'python3';
}

export const CodeRunnerPanel: React.FC<CodeRunnerPanelProps> = ({
  className,
  projectId,
  codeToRun: propCode,
  language: propLang,
  fileName: propFileName,
  isVisible = true,
  readOnly = false,
  onClose,
  onSwitchToDockerTerminal,
}) => {
  const { tabs, activeTabId, setActiveBottomPanel, triggerRunnerRun } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Derive source code and filename from active tab or props
  const currentCode = activeTab?.content ?? propCode ?? '';
  const currentFileName = activeTab?.name ?? propFileName ?? '';
  const initialLang = detectLanguage(currentFileName, activeTab?.language ?? propLang);

  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLang);
  const [stdin, setStdin] = useState<string>('');
  const [isStdinOpen, setIsStdinOpen] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<ExecutionResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  // Sync language when active tab changes
  useEffect(() => {
    const detected = detectLanguage(currentFileName, activeTab?.language ?? propLang);
    setSelectedLanguage(detected);
  }, [currentFileName, activeTab?.language, propLang]);

  // Scroll output on new result
  useEffect(() => {
    if (result || errorMsg) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result, errorMsg]);

  // Listen for triggerRunnerRun from toolbar Run button
  useEffect(() => {
    if (triggerRunnerRun > 0 && isVisible) {
      const isRecent = Date.now() - triggerRunnerRun < 2000;
      if (isRecent) {
        handleRunCode();
      }
    }
  }, [triggerRunnerRun, isVisible]);

  const handleRunCode = async () => {
    if (isRunning) return;
    if (!currentCode.trim()) {
      setErrorMsg('No code to execute. Write code in the editor first.');
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const response = await apiRequest<ExecutionResponse>('/execution/run', {
        method: 'POST',
        body: {
          language: selectedLanguage,
          sourceCode: currentCode,
          stdin: stdin || '',
          projectId: projectId && projectId !== 'local' ? projectId : undefined,
        },
      });

      setResult(response);
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution request failed. Please check backend connection.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearOutput = () => {
    setResult(null);
    setErrorMsg(null);
  };

  const hasCompilationError =
    result?.buildResult === 'failure' ||
    (result?.buildStderr && result.buildStderr.trim().length > 0);
  const hasRuntimeError =
    !hasCompilationError &&
    (result?.result === 'failure' || (result?.stderr && result.stderr.trim().length > 0));
  const isTimeout = result?.result === 'timeout' || result?.status === 'timeout';
  const isSuccess =
    result &&
    !hasCompilationError &&
    !hasRuntimeError &&
    !isTimeout &&
    (result.result === 'success' || (!result.stderr && !result.buildStderr));

  return (
    <div
      className={cn(
        'flex flex-col border-t border-[#333] select-none text-[12px]',
        isMinimized && 'h-9',
        className
      )}
      style={{ backgroundColor: '#1e1e1e', fontFamily: '"JetBrains Mono", monospace' }}
    >
      {/* Top Header / Tab Bar */}
      <div
        className="flex items-center justify-between px-2 h-9 border-b border-[#333] shrink-0 overflow-x-auto gap-2"
        style={{ backgroundColor: '#252526' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Terminal Tabs: Docker Terminal & Code Runner */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (onSwitchToDockerTerminal) {
                  onSwitchToDockerTerminal();
                } else {
                  setActiveBottomPanel('terminal');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-t-sm transition-colors text-[#6272a4] hover:bg-white/5 hover:text-[#f8f8f2]"
              title="Switch to Docker Interactive Terminal"
            >
              <TerminalIcon className="w-3.5 h-3.5 text-[#ffb86c]" />
              <span>Docker Terminal</span>
            </button>

            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-t-sm transition-colors bg-[#1e1e1e] text-[#50fa7b] border-t-2 border-[#50fa7b] font-medium"
              title="API-based Single File Code Execution"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code Runner</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#444]">
            <span className="text-[10px] text-[#6272a4] uppercase font-semibold">Lang:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isRunning}
              className="bg-[#2a2a2b] text-[#f8f8f2] text-[11px] px-2 py-0.5 rounded border border-[#444] outline-none cursor-pointer hover:border-[#6272a4] transition-colors"
            >
              {SUPPORTED_RUNNER_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active File info */}
          {currentFileName && (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#6272a4] rounded bg-white/5">
              <FileCode className="w-3 h-3 text-[#bd93f9]" />
              <span className="truncate max-w-[150px]">{currentFileName}</span>
            </div>
          )}
        </div>

        {/* Right Action Icons & Run Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning || readOnly}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors border',
              readOnly
                ? 'border-border/40 bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60'
                : isRunning
                ? 'border-[#f1fa8c]/40 bg-[#f1fa8c]/10 text-[#f1fa8c]'
                : 'border-[#50fa7b]/50 bg-[#50fa7b]/15 text-[#50fa7b] hover:bg-[#50fa7b]/25'
            )}
            title={readOnly ? 'Viewer access: code execution disabled' : 'Execute code with Paiza'}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Code</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClearOutput}
            className="p-1 rounded-sm text-[#6272a4] hover:text-[#f8f8f2] hover:bg-white/5 transition-colors"
            title="Clear Console Output"
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

      {/* Main Panel Content */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#333]">
          {/* Stdin Panel */}
          <div
            className={cn(
              'flex flex-col transition-all bg-[#1a1a1a] shrink-0',
              isStdinOpen ? 'w-full md:w-64 h-32 md:h-full' : 'h-7 md:w-8 md:h-full'
            )}
          >
            <div
              className="flex items-center justify-between px-2.5 py-1 bg-[#222223] border-b border-[#333] cursor-pointer"
              onClick={() => setIsStdinOpen(!isStdinOpen)}
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-[#8be9fd]">
                <ArrowRightLeft className="w-3 h-3" />
                {isStdinOpen && <span>Standard Input (stdin)</span>}
              </div>
              <button
                type="button"
                className="text-[#6272a4] hover:text-white"
                title={isStdinOpen ? 'Collapse stdin' : 'Expand stdin'}
              >
                {isStdinOpen ? <ChevronDown className="w-3 h-3 md:hidden" /> : <ChevronUp className="w-3 h-3 md:hidden" />}
              </button>
            </div>

            {isStdinOpen && (
              <div className="flex-1 flex flex-col p-2 min-h-0">
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter inputs here (e.g., numbers, strings) before running..."
                  disabled={isRunning}
                  className="flex-1 w-full p-2 bg-[#141414] text-[#f8f8f2] text-[11px] rounded border border-[#333] focus:border-[#8be9fd]/50 outline-none resize-none font-mono placeholder:text-[#555]"
                />
                <span className="text-[9px] text-[#6272a4] mt-1">
                  Passed to program on execution (e.g. scanf, cin, Scanner, input)
                </span>
              </div>
            )}
          </div>

          {/* Output Console Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e] overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#333] text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-[#6272a4] font-medium">OUTPUT:</span>
                {isRunning && (
                  <span className="flex items-center gap-1 text-[#f1fa8c] animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Executing via Paiza.IO...
                  </span>
                )}
                {isSuccess && (
                  <span className="flex items-center gap-1 text-[#50fa7b]">
                    <CheckCircle2 className="w-3 h-3" />
                    Success
                  </span>
                )}
                {hasCompilationError && (
                  <span className="flex items-center gap-1 text-[#ff5555]">
                    <XCircle className="w-3 h-3" />
                    Compilation Error
                  </span>
                )}
                {hasRuntimeError && (
                  <span className="flex items-center gap-1 text-[#ffb86c]">
                    <AlertTriangle className="w-3 h-3" />
                    Runtime Error
                  </span>
                )}
                {isTimeout && (
                  <span className="flex items-center gap-1 text-[#ff79c6]">
                    <Clock className="w-3 h-3" />
                    Execution Timeout
                  </span>
                )}
                {!isRunning && !result && !errorMsg && (
                  <span className="text-[#6272a4]">Idle - ready to run</span>
                )}
              </div>

              {/* Stats */}
              {result && (
                <div className="flex items-center gap-3 text-[10px] text-[#6272a4]">
                  {result.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {result.time}s
                    </span>
                  )}
                  {result.memory !== undefined && result.memory > 0 && (
                    <span>{(result.memory / 1024 / 1024).toFixed(1)} MB</span>
                  )}
                </div>
              )}
            </div>

            {/* Console Output Area */}
            <div className="flex-1 p-3 overflow-auto font-mono text-[12px] leading-relaxed selection:bg-[#44475a]">
              {/* Java note hint */}
              {selectedLanguage === 'java' && !result && (
                <div className="mb-2 p-2 rounded bg-[#bd93f9]/10 border border-[#bd93f9]/30 text-[#bd93f9] text-[11px]">
                  <strong>Java Tip:</strong> Use <code>public class Main</code> with <code>public static void main(String[] args)</code> for single-file execution.
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-2.5 mb-2 rounded bg-red-950/40 border border-red-800 text-[#ff5555]">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Execution Request Failed
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px]">{errorMsg}</pre>
                </div>
              )}

              {/* Compilation Errors */}
              {result?.buildStderr && (
                <div className="mb-2 p-2.5 rounded bg-red-950/30 border border-red-800/60 text-[#ff5555]">
                  <div className="font-bold text-[11px] uppercase tracking-wide mb-1 text-red-400">
                    [Compilation Error]
                  </div>
                  <pre className="whitespace-pre-wrap">{result.buildStderr}</pre>
                </div>
              )}

              {/* Standard Output */}
              {result?.stdout && (
                <div className="text-[#f8f8f2] whitespace-pre-wrap">
                  {result.stdout}
                </div>
              )}

              {/* Runtime Errors (stderr) */}
              {result?.stderr && (
                <div className="mt-2 p-2.5 rounded bg-amber-950/30 border border-amber-800/60 text-[#ffb86c]">
                  <div className="font-bold text-[11px] uppercase tracking-wide mb-1 text-amber-400">
                    [Runtime Error / stderr]
                  </div>
                  <pre className="whitespace-pre-wrap">{result.stderr}</pre>
                </div>
              )}

              {/* Empty state after run */}
              {result && !result.stdout && !result.stderr && !result.buildStderr && (
                <div className="text-[#6272a4] italic">
                  [Program executed successfully with no output (exit code 0)]
                </div>
              )}

              {/* Initial idle state */}
              {!result && !errorMsg && !isRunning && (
                <div className="flex flex-col items-center justify-center h-full text-center text-[#6272a4] py-8">
                  <Play className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-[12px] font-medium text-[#888]">Ready to run your code</p>
                  <p className="text-[11px] text-[#555] max-w-sm mt-1">
                    Select language ({selectedLanguage}), provide input (stdin) if needed, and click <strong>Run Code</strong>.
                  </p>
                </div>
              )}

              <div ref={outputEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
