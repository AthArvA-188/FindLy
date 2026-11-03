/**
 * Directory API Service
 * Handles file system directory operations
 */

import { api } from './client';
import type { FileSystemNode } from '../types';

interface FileSystemResponse {
  current_path: string;
  items: {
    name: string;
    path: string;
    is_dir: boolean;
  }[];
}

/**
 * GET /directories
 * Fetch directory contents for a specific path
 */
export async function getFileSystem(path?: string): Promise<{ fileSystem: FileSystemNode[] }> {
  const queryParam = path ? `?path=${encodeURIComponent(path)}` : '';
  const response = await api.get<FileSystemResponse>(`/get-directories-and-files${queryParam}`);
  
  // Map backend response matching the new format structure
  const mappedNodes: FileSystemNode[] = response.items.map(item => ({
    name: item.name,
    path: item.path,
    type: item.is_dir ? 'folder' : 'file',
    // We start with an empty array for folders so they can be expanded later
    children: item.is_dir ? [] : undefined 
  }));

  return { fileSystem: mappedNodes };
}
