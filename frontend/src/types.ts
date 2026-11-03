export interface FileSystemNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  indexed?: boolean;
  lastIndexed?: string;
  children?: FileSystemNode[];
}

export interface SearchResult {
  id: string;
  path: string;
  confidence: number;
  preview: string;
  fileType: string;
}

export type FileType = 'all' | 'pdf' | 'doc' | 'txt' | 'image' | 'code';

export interface SearchState {
  query: string;
  imageFile: File | null;
  results: SearchResult[];
  loading: boolean;
  selectedFileType: FileType;
}
