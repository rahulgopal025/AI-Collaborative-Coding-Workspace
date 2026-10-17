import React from 'react';
import { 
  GitBranch, 
  Check,
  Bell, 
  Wifi, 
  WifiOff,
  ShieldCheck,
  Users,
  Loader2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  className?: string;
  connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error';
  saveStatus?: 'saved' | 'saving' | 'error';
  lastSavedAt?: string | null;
  cursorLine?: number;
  cursorColumn?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  className, 
  connectionStatus = 'disconnected',
  saveStatus = 'saved',
  lastSavedAt,
  cursorLine,
  cursorColumn,
}) => {
  const { tabs, activeTabId, collaborators } = useEditorStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  
  const onlineCount = collaborators.filter(c => c.isOnline).length + 1;

  const connectionLabel = connectionStatus === 'connected' 
    ? 'Live' 
    : connectionStatus === 'connecting' 
      ? 'Reconnecting…' 
      : connectionStatus === 'error'
        ? 'Error'
        : 'Offline';

  const connectionColor = connectionStatus === 'connected' 
    ? 'text-success' 
    : connectionStatus === 'connecting' 
      ? 'text-warning animate-pulse' 
      : 'text-destructive';

  const ConnectionIcon = connectionStatus === 'connected' 
    ? Wifi 
    : connectionStatus === 'connecting'
      ? Loader2
      : connectionStatus === 'error'
        ? AlertCircle
        : WifiOff;

  const saveLabel = saveStatus === 'saving' 
    ? 'Saving…' 
    : saveStatus === 'error' 
      ? 'Save failed'
      : lastSavedAt 
        ? `Saved` 
        : 'Saved';

  const saveColor = saveStatus === 'saving' 
    ? 'text-warning' 
    : saveStatus === 'error' 
      ? 'text-destructive' 
      : 'text-success';

  return (
    <div className={cn(
      "flex items-center justify-between h-6 px-2 bg-statusbar text-statusbar-foreground text-xs select-none",
      className
    )}>
      <div className="flex items-center">
        <div className="statusbar-item">
          <GitBranch className="w-3.5 h-3.5" />
          <span>main</span>
        </div>

        <div className={cn("statusbar-item", saveColor)}>
          {saveStatus === 'saving' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>{saveLabel}</span>
        </div>

        <div className={cn("statusbar-item", connectionColor)}>
          <ConnectionIcon className={cn("w-3.5 h-3.5", connectionStatus === 'connecting' && 'animate-spin')} />
          <span>{connectionLabel}</span>
        </div>
      </div>

      <div className="flex items-center">
        <div className="statusbar-item">
          <Users className="w-3.5 h-3.5" />
          <span>{onlineCount} online</span>
        </div>

        {activeTab && (
          <>
            <div className="statusbar-item">
              <span>Ln {cursorLine ?? 1}, Col {cursorColumn ?? 1}</span>
            </div>
            <div className="statusbar-item">
              <span>Spaces: 2</span>
            </div>
            <div className="statusbar-item">
              <span>UTF-8</span>
            </div>
            <div className="statusbar-item">
              <span className="capitalize">{activeTab.language}</span>
            </div>
          </>
        )}

        <div className="statusbar-item">
          <Bell className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
