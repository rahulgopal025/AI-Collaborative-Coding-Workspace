import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, X, Globe, Loader2 } from 'lucide-react';
import { useHTMLPreview } from '@/hooks/useHTMLPreview';
import { authTokenStore } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HTMLPreviewProps {
  code?: string;
  projectId?: string;
  className?: string;
  onClose?: () => void;
}

export const HTMLPreview: React.FC<HTMLPreviewProps> = ({
  code = '',
  projectId,
  className,
  onClose,
}) => {
  const { previewHtml, generateBlobUrl } = useHTMLPreview(code);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPort, setSelectedPort] = useState<number>(5173);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const token = authTokenStore.get();
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
    /\/api\/?$/,
    ''
  );

  // Live preview URL when projectId is provided
  const livePreviewUrl = projectId
    ? `${backendBase}/preview/${projectId}/?token=${encodeURIComponent(token || '')}&port=${selectedPort}&k=${refreshKey}`
    : '';

  useEffect(() => {
    setIsLoading(true);
  }, [livePreviewUrl, refreshKey, selectedPort]);

  const handleOpenInNewTab = () => {
    if (projectId) {
      window.open(livePreviewUrl, '_blank');
    } else {
      const url = generateBlobUrl();
      window.open(url, '_blank');
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={cn('flex flex-col h-full bg-[#18181b] text-foreground', className)}>
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 h-10 bg-[#1e1e1e] border-b border-[#333] shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-[#50fa7b] shrink-0" />
          <span className="text-xs font-semibold tracking-wide text-white/90 shrink-0">
            Live Preview
          </span>

          {projectId && (
            <div className="flex items-center gap-1.5 ml-1">
              <select
                value={selectedPort}
                onChange={(e) => {
                  setSelectedPort(parseInt(e.target.value, 10));
                  setRefreshKey((k) => k + 1);
                }}
                className="bg-[#2a2a2c] text-white/80 text-[11px] font-mono rounded px-1.5 py-0.5 border border-[#444] focus:outline-none focus:border-[#bd93f9]"
                title="Select Dev Server Port"
              >
                <option value={5173}>5173 (Vite)</option>
                <option value={3000}>3000 (React/Next)</option>
                <option value={5000}>5000 (Node/API)</option>
                <option value={8080}>8080 (Workspace)</option>
              </select>

              {/* Simulated browser address bar */}
              <div className="hidden sm:flex items-center bg-[#252526] px-2.5 py-0.5 rounded border border-[#383838] text-[11px] font-mono text-white/60 max-w-[220px] truncate">
                <span className="text-emerald-400 mr-1.5 text-[10px]">●</span>
                <span className="truncate">http://localhost:{selectedPort}/</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin text-[#bd93f9]')} />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors ml-1"
              title="Close preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main preview container */}
      <div className="relative flex-1 w-full h-full bg-[#1e1e1e] overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1e1e1e]/80 backdrop-blur-[1px] text-white/70">
            <Loader2 className="w-6 h-6 animate-spin text-[#bd93f9] mb-2" />
            <span className="text-xs font-mono text-white/60">Connecting to dev server...</span>
          </div>
        )}

        {projectId ? (
          <iframe
            ref={iframeRef}
            key={`live-${refreshKey}-${selectedPort}`}
            title="live-project-preview"
            src={livePreviewUrl}
            onLoad={handleIframeLoad}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <iframe
            key={`static-${refreshKey}`}
            title="html-preview"
            srcDoc={
              previewHtml ||
              '<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999;background:#1e1e1e">Start writing HTML to see a preview</body>'
            }
            onLoad={handleIframeLoad}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
};
