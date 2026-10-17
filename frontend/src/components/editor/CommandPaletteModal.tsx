import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Folder, FilePlus, Play, Bot, MessageSquare, UserPlus, PanelLeft, PanelBottom, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export interface Command {
  id: string;
  title: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));

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
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
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
          <Terminal className="w-4 h-4 text-primary mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-mono text-sm"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">No matching commands</div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2 text-left hover:bg-sidebar-hover transition-colors",
                  index === selectedIndex && "bg-primary/20 text-primary hover:bg-primary/30"
                )}
                onClick={() => {
                  command.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center min-w-0">
                  <command.icon className="w-4 h-4 mr-3 opacity-70" />
                  <span className="text-sm font-medium truncate">{command.title}</span>
                </div>
                {command.shortcut && (
                  <div className="flex items-center gap-1">
                    {command.shortcut.split('+').map((key, i) => (
                      <kbd key={i} className="px-1.5 py-0.5 rounded-sm bg-background border border-border text-[10px] font-mono text-muted-foreground uppercase">{key}</kbd>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
