import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { FileLock, FileNode, getLanguageFromFileName } from "@/types/editor";

interface DbFileLock {
  user_id: string;
  user_name: string | null;
  expires_at: string;
}

// How V0 expects a file to look like
interface DbFile {
  id: string;
  project_id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  content: string | null;
  language: string | null;
  revision: number;
  locked: boolean;
  parent_path: string | null;
  lock: DbFileLock | null;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

// How CodeCollabAI actually returns them
interface BackendFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendFile {
  id: string;
  name: string;
  content: string;
  language: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendFilesResponse {
  files: BackendFile[];
  folders: BackendFolder[];
}

interface FileLockMutationResponse {
  success: boolean;
  released?: boolean;
  file: DbFile;
}

interface UpdateFileMetadataInput {
  name?: string;
  path?: string;
  parent_path?: string | null;
}

const DEFAULT_LOCK_TTL_SECONDS = 60;

const toFileLock = (lock: DbFileLock | null): FileLock | null => {
  if (!lock) return null;

  return {
    userId: lock.user_id,
    userName: lock.user_name,
    expiresAt: lock.expires_at,
  };
};

// Convert flat DB files to nested FileNode tree
const buildFileTree = (files: DbFile[]): FileNode[] => {
  const nodeMap = new Map<string, FileNode>();
  const fileByPath = new Map<string, DbFile>();

  // Deduplicate files by unique path, preferring items with content or newer updates
  files.forEach((file) => {
    const existing = fileByPath.get(file.path);
    if (
      !existing ||
      (!existing.content && file.content) ||
      new Date(file.updated_at || file.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0)
    ) {
      fileByPath.set(file.path, file);
    }
  });

  fileByPath.forEach((file) => {
    nodeMap.set(file.path, {
      id: file.id,
      name: file.name,
      type: file.type,
      path: file.path,
      language: file.language || (file.type === "file" ? getLanguageFromFileName(file.name) : undefined),
      content: file.content || undefined,
      revision: file.revision || 0,
      locked: Boolean(file.locked),
      lock: toFileLock(file.lock),
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      children: file.type === "folder" ? [] : undefined,
      isOpen: file.type === "folder",
    });
  });

  const rootNodes: FileNode[] = [];
  const seenRootIds = new Set<string>();

  fileByPath.forEach((file) => {
    const node = nodeMap.get(file.path);
    if (!node) return;

    if (file.parent_path && nodeMap.has(file.parent_path)) {
      const parent = nodeMap.get(file.parent_path);
      if (parent) {
        parent.children = parent.children || [];
        if (!parent.children.some((c) => c.id === node.id || c.path === node.path)) {
          parent.children.push(node);
        }
      }
    } else {
      if (!seenRootIds.has(node.id)) {
        seenRootIds.add(node.id);
        rootNodes.push(node);
      }
    }
  });

  const sortNodes = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));

  return sortNodes(rootNodes);
};

const upsertDbFile = (files: DbFile[], updatedFile: DbFile): DbFile[] => {
  const index = files.findIndex((entry) => entry.id === updatedFile.id);
  if (index === -1) {
    return [...files, updatedFile];
  }

  const nextFiles = [...files];
  nextFiles[index] = updatedFile;
  return nextFiles;
};

const getParentPath = (path: string): string | null => {
  const normalizedPath = path.trim();
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  if (lastSlashIndex <= 0) {
    return null;
  }

  return normalizedPath.slice(0, lastSlashIndex);
};

const joinFilePath = (parentPath: string | null, name: string) =>
  parentPath ? `${parentPath}/${name}` : `/${name}`;

export const useProjectFiles = (projectId: string | null) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [dbFiles, setDbFiles] = useState<DbFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectNotFound, setProjectNotFound] = useState(false);

  // Helper to map backend's files & folders to V0's flat DbFile array
  const mapBackendToV0Files = useCallback((backendData: BackendFilesResponse): DbFile[] => {
    if (!backendData || (!backendData.files && !backendData.folders)) return [];
    
    const mappedFiles: DbFile[] = [];
    const folderPathMap = new Map<string, string>(); // folderId -> absolute path
    
    // 1. Build paths for folders
    const buildFolderPath = (folder: BackendFolder): string => {
      if (folderPathMap.has(folder.id)) return folderPathMap.get(folder.id)!;
      
      let path = `/${folder.name}`;
      if (folder.parentId) {
        const parent = backendData.folders.find(f => f.id === folder.parentId);
        if (parent) {
          path = `${buildFolderPath(parent)}/${folder.name}`;
        }
      }
      folderPathMap.set(folder.id, path);
      return path;
    };
    
    // Add all folders
    const seenFolderPaths = new Set<string>();
    for (const folder of backendData.folders || []) {
      const path = buildFolderPath(folder);
      if (seenFolderPaths.has(path)) continue;
      seenFolderPaths.add(path);
      mappedFiles.push({
        id: folder.id,
        project_id: projectId!,
        name: folder.name,
        path,
        type: 'folder',
        content: null,
        language: null,
        revision: 0,
        locked: false,
        parent_path: folder.parentId ? folderPathMap.get(folder.parentId) || null : null,
        lock: null,
        last_updated: folder.updatedAt,
        created_at: folder.createdAt,
        updated_at: folder.updatedAt,
      });
    }
    
    // Add all files (deduplicating by path, keeping newest/non-empty)
    const fileMap = new Map<string, DbFile>();
    for (const file of backendData.files || []) {
      const parentPath = file.folderId ? folderPathMap.get(file.folderId) || null : null;
      const path = parentPath ? `${parentPath}/${file.name}` : `/${file.name}`;
      
      const candidate: DbFile = {
        id: file.id,
        project_id: projectId!,
        name: file.name,
        path,
        type: 'file',
        content: file.content,
        language: file.language,
        revision: 0,
        locked: false,
        parent_path: parentPath,
        lock: null,
        last_updated: file.updatedAt,
        created_at: file.createdAt,
        updated_at: file.updatedAt,
      };

      const existing = fileMap.get(path);
      if (
        !existing ||
        (!existing.content && candidate.content) ||
        new Date(candidate.updated_at || candidate.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0)
      ) {
        fileMap.set(path, candidate);
      }
    }

    fileMap.forEach((entry) => mappedFiles.push(entry));
    
    return mappedFiles;
  }, [projectId]);

  const fetchFiles = useCallback(
    async (silent: boolean = false) => {
      if (!projectId) {
        setFiles([]);
        setDbFiles([]);
        setLoading(false);
        setProjectNotFound(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        setProjectNotFound(false);

        const data = await apiRequest<BackendFilesResponse>(`/projects/${projectId}/files`);
        
        // Ensure data is structured correctly even if API returned empty array
        const structuredData = Array.isArray(data) 
          ? { files: data as any[], folders: [] } 
          : data;

        const typedData = mapBackendToV0Files(structuredData);

        setDbFiles(typedData);
        setFiles(buildFileTree(typedData));
      } catch (error) {
        if (!silent) {
          console.error("Error fetching files:", error);
        }
        // Check if it's a 404 error (project not found)
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
          console.log('Project not found detected for:', projectId);
          setProjectNotFound(true);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId, mapBackendToV0Files]
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const findFolderIdByPath = (targetPath: string | null): string | null => {
    if (!targetPath) return null;
    const folder = dbFiles.find(f => f.type === 'folder' && f.path === targetPath);
    return folder ? folder.id : null;
  };

  const createFile = useCallback(
    async (parentPath: string | null, name: string, type: "file" | "folder") => {
      if (!projectId) return { error: new Error("No project selected") };

      const normalizedParentPath = !parentPath || parentPath === "/" ? null : parentPath;
      const path = normalizedParentPath ? `${normalizedParentPath}/${name}` : `/${name}`;
      const language = type === "file" ? getLanguageFromFileName(name) : null;
      
      const folderId = findFolderIdByPath(normalizedParentPath);

      const getContent = () => {
        if (type === "folder") return null;

        const ext = name.split(".").pop()?.toLowerCase();
        const templates: Record<string, string> = {
          js: `// ${name}\nconsole.log('Hello from ${name}');\n`,
          ts: `// ${name}\nconst greeting: string = 'Hello from ${name}';\nconsole.log(greeting);\n`,
          py: `# ${name}\n\ndef main():\n    print('Hello from ${name}')\n\nif __name__ == '__main__':\n    main()\n`,
          json: `{\n  "name": "${name.replace(".json", "")}"\n}\n`,
        };

        return templates[ext || ""] || `// ${name}\n`;
      };

      try {
        let endpoint = `/projects/${projectId}/files`;
        let body: any = { name, content: getContent(), language, folderId };
        
        if (type === 'folder') {
          endpoint = `/projects/${projectId}/folders`;
          body = { name, parentId: folderId };
        }

        const data = await apiRequest<BackendFile | BackendFolder>(endpoint, {
          method: "POST",
          body,
        });

        // Convert the newly created backend entity to a DbFile
        const newDbFile: DbFile = {
          id: data.id,
          project_id: projectId,
          name: data.name,
          path,
          type,
          content: 'content' in data ? data.content : null,
          language: 'language' in data ? data.language : null,
          revision: 0,
          locked: false,
          parent_path: normalizedParentPath,
          lock: null,
          last_updated: data.updatedAt,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
        };

        setDbFiles((prev) => {
          const nextFiles = upsertDbFile(prev, newDbFile);
          setFiles(buildFileTree(nextFiles));
          return nextFiles;
        });

        return { data: newDbFile, error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [projectId, dbFiles]
  );

  const updateFileContent = useCallback(
    async (fileId: string, content: string) => {
      if (!projectId) return { error: new Error("No project selected") };

      try {
        // Use the standalone /files/:id route (PUT/PATCH is supported there)
        const updated = await apiRequest<BackendFile>(`/files/${fileId}`, {
          method: "PATCH",
          body: { content },
        });

        setDbFiles((prev) => {
          const existing = prev.find(f => f.id === fileId);
          if (!existing) return prev;
          
          const nextDbFile: DbFile = {
            ...existing,
            content: updated.content,
            updated_at: updated.updatedAt,
            last_updated: updated.updatedAt
          };
          
          const nextFiles = upsertDbFile(prev, nextDbFile);
          setFiles(buildFileTree(nextFiles));
          return nextFiles;
        });

        // @ts-ignore - we ignore the return type mismatch for now since UI barely uses it
        return { data: updated, error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [projectId]
  );

  const updateFileMetadata = useCallback(
    async (fileId: string, updates: UpdateFileMetadataInput) => {
      if (!projectId) return { error: new Error("No project selected") };
      
      const isFolder = dbFiles.find(f => f.id === fileId)?.type === 'folder';

      try {
        const folderId = findFolderIdByPath(updates.parent_path || null);
        // Use the standalone /files/:id and /folders/:id routes (not project-scoped)
        let endpoint = `/${isFolder ? 'folders' : 'files'}/${fileId}`;
        
        let body: any = {};
        if (updates.name) body.name = updates.name;
        if (updates.parent_path !== undefined) {
           if (isFolder) body.parentId = folderId;
           else body.folderId = folderId;
        }

        const updated = await apiRequest<any>(endpoint, {
          method: "PATCH",
          body,
        });

        await fetchFiles(true);
        return { data: updated, error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [fetchFiles, projectId, dbFiles]
  );

  const renameNode = useCallback(
    async (node: FileNode, nextName: string) => {
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        return { error: new Error("Name is required") };
      }

      const parentPath = getParentPath(node.path);
      return updateFileMetadata(node.id, {
        name: trimmedName,
        parent_path: parentPath,
        path: joinFilePath(parentPath, trimmedName),
      });
    },
    [updateFileMetadata]
  );

  const moveNode = useCallback(
    async (node: FileNode, destinationParentPath: string | null) => {
      const normalizedParentPath =
        !destinationParentPath || destinationParentPath === "/" ? null : destinationParentPath;

      return updateFileMetadata(node.id, {
        name: node.name,
        parent_path: normalizedParentPath,
        path: joinFilePath(normalizedParentPath, node.name),
      });
    },
    [updateFileMetadata]
  );

  // File Locking is likely not implemented in CodeCollabAI backend. Mock it or fail silently.
  const acquireFileLock = useCallback(
    async (fileId: string, ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS, silent: boolean = false) => {
      if (!projectId) return { error: new Error("No project selected") };
      
      // Since it's likely not supported, just mock it
      return { data: dbFiles.find(f => f.id === fileId)!, error: null };
    },
    [projectId, dbFiles]
  );

  const releaseFileLock = useCallback(
    async (fileId: string, silent: boolean = false) => {
      if (!projectId) return { error: new Error("No project selected") };
      return { data: dbFiles.find(f => f.id === fileId)!, error: null };
    },
    [projectId, dbFiles]
  );

  const deleteFile = useCallback(
    async (fileId: string, filePath: string) => {
      if (!projectId) return { error: new Error("No project selected") };
      
      const isFolder = dbFiles.find(f => f.id === fileId)?.type === 'folder';

      try {
        // Use standalone routes — /api/files/:id and /api/folders/:id
        await apiRequest(`/${isFolder ? 'folders' : 'files'}/${fileId}`, {
          method: "DELETE",
        });

        setDbFiles((prev) => {
          const nextFiles = prev.filter(
            (file) => !(file.path === filePath || file.path.startsWith(`${filePath}/`))
          );
          setFiles(buildFileTree(nextFiles));
          return nextFiles;
        });

        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [projectId, dbFiles]
  );

  const getFileById = useCallback(
    (fileId: string): FileNode | null => {
      const findNode = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.id === fileId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      return findNode(files);
    },
    [files]
  );

  // AI-specific file operations
  const getFileContent = useCallback(
    async (fileId: string): Promise<{ content: string; error: Error | null }> => {
      if (!projectId) return { content: '', error: new Error("No project selected") };

      try {
        const file = await apiRequest<BackendFile>(`/projects/${projectId}/files/${fileId}`);
        return { content: file.content || '', error: null };
      } catch (error) {
        return { content: '', error: error as Error };
      }
    },
    [projectId]
  );

  const updateFileByAI = useCallback(
    async (fileId: string, content: string): Promise<{ error: Error | null }> => {
      if (!projectId) return { error: new Error("No project selected") };

      try {
        const updated = await apiRequest<BackendFile>(`/projects/${projectId}/files/${fileId}`, {
          method: "PATCH",
          body: { content },
        });

        setDbFiles((prev) => {
          const existing = prev.find(f => f.id === fileId);
          if (!existing) return prev;
          const nextDbFile: DbFile = {
            ...existing,
            content: updated.content,
            updated_at: updated.updatedAt,
            last_updated: updated.updatedAt
          };
          const nextFiles = upsertDbFile(prev, nextDbFile);
          setFiles(buildFileTree(nextFiles));
          return nextFiles;
        });

        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [projectId]
  );

  const createFileByAI = useCallback(
    async (path: string, content: string, type: 'file' | 'folder' = 'file'): Promise<{ fileId: string; error: Error | null }> => {
      if (!projectId) return { fileId: '', error: new Error("No project selected") };
      
      const normalizedPath = path.trim();
      const lastSlashIndex = normalizedPath.lastIndexOf("/");
      const name = lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : normalizedPath;
      const parentPath = lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex) : null;
      
      const result = await createFile(parentPath, name, type);
      if (result.error || !result.data) return { fileId: '', error: result.error || new Error("Failed to create file") };
      
      if (type === 'file' && content) {
        await updateFileContent(result.data.id, content);
      }
      return { fileId: result.data.id, error: null };
    },
    [projectId, createFile, updateFileContent]
  );

  const getAllFilesContent = useCallback(
    async (): Promise<{ files: Array<{ path: string; content: string; language: string | null }>; error: Error | null }> => {
      if (!projectId) return { files: [], error: new Error("No project selected") };

      try {
        const dbFiles = await apiRequest<BackendFilesResponse>(`/projects/${projectId}/files`);
        
        const mapped = mapBackendToV0Files(dbFiles);
        const files = mapped
          .filter(file => file.type === 'file' && file.content)
          .map(file => ({
            path: file.path,
            content: file.content || '',
            language: file.language,
          }));

        return { files, error: null };
      } catch (error) {
        return { files: [], error: error as Error };
      }
    },
    [projectId, mapBackendToV0Files]
  );

  return {
    files,
    loading,
    projectNotFound,
    createFile,
    updateFileContent,
    renameNode,
    moveNode,
    acquireFileLock,
    releaseFileLock,
    deleteFile,
    getFileById,
    refetch: fetchFiles,
    // AI-specific operations
    getFileContent,
    updateFileByAI,
    createFileByAI,
    getAllFilesContent,
  };
};
