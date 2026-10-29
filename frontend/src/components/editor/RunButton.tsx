import React from 'react';
import { Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { getLanguageInfo } from '@/lib/sandboxExecutor';

interface RunButtonProps {
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
}

export const RunButton: React.FC<RunButtonProps> = ({ className, readOnly, disabled: propDisabled }) => {
  const {
    tabs,
    activeTabId,
    activeBottomPanel,
    setActiveBottomPanel,
    setTriggerRun,
    setTriggerRunnerRun,
    isTerminalRunning
  } = useEditorStore();

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (!activeTab) return null;

  const langInfo = getLanguageInfo(activeTab.language);

  // Exclude non-programmatic tabs
  const isRunnable = activeTab.language !== 'json' && activeTab.language !== 'markdown' && activeTab.language !== 'plaintext';
  if (!isRunnable) return null;

  const isHtml = activeTab.language.toLowerCase() === 'html' || activeTab.language.toLowerCase() === 'css';
  const isDisabled = propDisabled || readOnly || (isTerminalRunning && !isHtml);

  const handleRunCode = () => {
    if (!activeTab || readOnly) return;
    
    if (isHtml) {
       setActiveBottomPanel('output');
       return;
    }

    if (activeBottomPanel === 'runner') {
      setTriggerRunnerRun(Date.now());
      return;
    }

    if (isTerminalRunning) return;

    // Switch to Terminal automatically
    setActiveBottomPanel('terminal');
    
    // Setting timestamp dynamically fires trigger inside TerminalPanel useEffect mapping
    setTriggerRun(Date.now());
  };

  return (
    <button
      onClick={handleRunCode}
      disabled={isDisabled}
      title={
        readOnly
          ? 'Viewer access: code execution is disabled'
          : activeBottomPanel === 'runner'
          ? `Run ${langInfo.name} in Code Runner`
          : `Run ${langInfo.name}`
      }
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium border transition-colors',
        readOnly
          ? 'border-border/40 bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60'
          : isTerminalRunning && !isHtml
            ? 'border-[#ffb86c]/30 bg-[#ffb86c]/10 text-[#ffb86c]' 
            : activeBottomPanel === 'runner'
            ? 'border-[#50fa7b]/50 bg-[#50fa7b]/20 text-[#50fa7b] hover:bg-[#50fa7b]/30'
            : 'border-primary/50 bg-primary/90 text-primary-foreground hover:bg-primary',
        'disabled:cursor-not-allowed',
        className
      )}
    >
      {isTerminalRunning && !isHtml ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Running...</span>
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" />
          <span>Run {langInfo.icon}</span>
        </>
      )}
    </button>
  );
};
