import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText } from 'lucide-react';
import { FileNode } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';

interface QuickOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
}

const flattenFiles = (nodes: FileNode[], result: FileNode[] = []) => {
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node);
    }
    if (node.children) {
      flattenFiles(node.children, result);
    }
  }
  return result;
};

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({ isOpen, onClose, files }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openTab } = useEditorStore();

  const flatFiles = flattenFiles(files);
  const filteredFiles = flatFiles.filter(f => f.path.toLowerCase().includes(query.toLowerCase())).slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredFiles.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        const file = filteredFiles[selectedIndex];
        openTab({
          id: file.id,
          name: file.name,
          path: file.path,
          language: file.language || 'plaintext',
          content: file.content || '',
          fileId: file.id
        });
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-[600px] bg-sidebar border border-border rounded-md shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-2 border-b border-border bg-background">
          <Search className="w-4 h-4 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-mono text-sm"
            placeholder="Search files by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">No matching files</div>
          ) : (
            filteredFiles.map((file, index) => (
              <button
                key={file.id}
                className={cn(
                  "w-full flex items-center px-4 py-2 text-left hover:bg-sidebar-hover transition-colors",
                  index === selectedIndex && "bg-primary/20 text-primary hover:bg-primary/30"
                )}
                onClick={() => {
                  openTab({
                    id: file.id,
                    name: file.name,
                    path: file.path,
                    language: file.language || 'plaintext',
                    content: file.content || '',
                    fileId: file.id
                  });
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileText className="w-4 h-4 mr-3 opacity-70" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate opacity-70">{file.path}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
