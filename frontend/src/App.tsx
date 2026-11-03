import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import SidePanel from './components/layout/SidePanel';
import SearchBar from './components/search/SearchBar';
import FileTypeFilter from './components/search/FileTypeFilter';
import ResultsList from './components/search/ResultsList';
import BackgroundAnimation from './components/backgrounds/BackgroundAnimation';
import { IndexingProgress } from './components/layout/IndexingProgress';
import ConfirmModal from './components/common/ConfirmModal';
import { searchByText, searchByImage, indexPaths, reindexPaths, resetAll, getFileSystem, getIndexStatus } from './api';
import type { SearchResult, FileType, FileSystemNode } from './types';

function App() {
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>([]);
  
  // Grouped search-related state
  const [searchState, setSearchState] = useState({
    query: '',
    imageFile: null as File | null,
    results: [] as SearchResult[],
    loading: false,
    selectedFileTypes: ['all'] as FileType[],
    hasPendingFilterChange: false,
    hasSearched: false // Track if search has been performed
  });
  
  // UI state
  const [backgroundType, setBackgroundType] = useState<'prism' | 'scan' | 'dotgrid'>('prism');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetInProgress, setResetInProgress] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    // Restore active job ID from localStorage on mount
    return localStorage.getItem('findly_activeJobId');
  });
  const [triggerIndexHint, setTriggerIndexHint] = useState(0);

  // SINGLE SOURCE OF TRUTH: Check if any files are indexed
  // Only checks fileSystem nodes for indexed: true
  const hasIndexedFiles = useMemo(() => {
    const checkIndexed = (nodes: FileSystemNode[]): boolean => {
      for (const node of nodes) {
        if (node.indexed === true) {
          return true;
        }
        if (node.children && checkIndexed(node.children)) {
          return true;
        }
      }
      return false;
    };
    return checkIndexed(fileSystem);
  }, [fileSystem]);

  // Helper function to recursively mark paths as indexed
  const markPathsAsIndexed = (nodes: FileSystemNode[], paths: string[]): FileSystemNode[] => {
    return nodes.map(node => {
      // Normalize paths for comparison (handle Windows backslashes)
      const normalizedNodePath = node.path.replace(/\\/g, '/');
      const isIndexed = paths.some(indexedPath => {
        const normalizedIndexedPath = indexedPath.replace(/\\/g, '/');
        // Check if node path matches indexed path exactly, or is a child of indexed path, or indexed path is a child of node
        return normalizedNodePath === normalizedIndexedPath ||
               normalizedNodePath.startsWith(normalizedIndexedPath + '/') ||
               normalizedIndexedPath.startsWith(normalizedNodePath + '/');
      });
      
      const updatedNode: FileSystemNode = {
        ...node,
        indexed: isIndexed ? true : node.indexed
      };
      if (node.children) {
        updatedNode.children = markPathsAsIndexed(node.children, paths);
      }
      return updatedNode;
    });
  };

  // Load file system on mount and restore indexed paths
  useEffect(() => {
    const loadFileSystem = async () => {
      const data = await getFileSystem();
      
      // Restore indexed paths from localStorage
      const savedIndexedPaths = localStorage.getItem('findly_indexedPaths');
      if (savedIndexedPaths) {
        try {
          const indexedPaths = JSON.parse(savedIndexedPaths) as string[];
          const updatedFileSystem = markPathsAsIndexed(data.fileSystem, indexedPaths);
          setFileSystem(updatedFileSystem);
        } catch (error) {
          console.error('Failed to restore indexed paths:', error);
          setFileSystem(data.fileSystem);
        }
      } else {
        setFileSystem(data.fileSystem);
      }
    };
    
    loadFileSystem().catch(err => console.error('Failed to load file system:', err));
  }, []);

  // Restore and check active indexing job on mount
  useEffect(() => {
    const savedJobId = localStorage.getItem('findly_activeJobId');
    if (savedJobId) {
      getIndexStatus(savedJobId)
        .then(status => {
          if (status.status === 'queued' || status.status === 'processing') {
            setActiveJobId(savedJobId);
          } else {
            localStorage.removeItem('findly_activeJobId');
          }
        })
        .catch(() => {
          localStorage.removeItem('findly_activeJobId');
        });
    }
  }, []);

  const handleLoadChildren = async (path: string) => {
    try {
      const data = await getFileSystem(path);
      
      // Get indexed paths from localStorage to mark children as indexed
      const savedIndexedPaths = localStorage.getItem('findly_indexedPaths');
      let indexedPaths: string[] = [];
      if (savedIndexedPaths) {
        try {
          indexedPaths = JSON.parse(savedIndexedPaths) as string[];
        } catch (e) {
          indexedPaths = [];
        }
      }
      
      // Mark children as indexed if their path matches any indexed path
      const markedChildren = markPathsAsIndexed(data.fileSystem, indexedPaths);
      
      // Update the fileSystem state with the new children
      setFileSystem(prev => {
        const newFs = structuredClone(prev); // deep object copy
        
        // Recursive function to find the folder and append children
        const updateNode = (nodes: FileSystemNode[], targetPath: string, newChildren: FileSystemNode[]): boolean => {
          for (const node of nodes) {
            if (node.path === targetPath) {
              node.children = newChildren;
              return true;
            }
            if (node.children && updateNode(node.children, targetPath, newChildren)) {
              return true;
            }
          }
          return false;
        };
        
        updateNode(newFs, path, markedChildren);
        return newFs;
      });
    } catch (error) {
      console.error('Failed to load children for path:', path, error);
    }
  };

  const handleSearch = async (_query: string, _imageFile: File | null, fileTypes: FileType[] = searchState.selectedFileTypes) => {
    // Block search if no files are indexed
    if (!hasIndexedFiles) {
      setTriggerIndexHint(prev => prev + 1);
      return;
    }

    if (!_query.trim() && !_imageFile) {
      setSearchState(prev => ({
        ...prev,
        query: '',
        imageFile: null,
        results: [],
        hasPendingFilterChange: false,
        hasSearched: false
      }));
      setBackgroundType('prism');
      return;
    }

    setSearchState(prev => ({
      ...prev,
      query: _query,
      imageFile: _imageFile,
      loading: true,
      hasPendingFilterChange: false,
      hasSearched: true
    }));
    setBackgroundType('scan');
    
    try {
      const response = _imageFile
        ? await searchByImage({ image: _imageFile, fileTypes })
        : await searchByText({ query: _query, fileTypes });
      
      setSearchState(prev => ({
        ...prev,
        results: response.results,
        loading: false
      }));
      setBackgroundType('dotgrid');
    } catch (error) {
      console.error('Search failed:', error);
      setSearchState(prev => ({ 
        ...prev, 
        loading: false,
        results: []
      }));
      setBackgroundType('prism');
    }
  };

  const handleFilterChange = (newFileTypes: FileType[]) => {
    setSearchState(prev => ({
      ...prev,
      selectedFileTypes: newFileTypes,
      hasPendingFilterChange: false
    }));
    // Automatically re-search with new filters if there's an active query
    if (searchState.query || searchState.imageFile) {
      handleSearch(searchState.query, searchState.imageFile, newFileTypes);
    }
  };

  // Indexing and selection handlers
  const handleIndexSelected = async (paths: string[]) => {
    try {
      const response = await indexPaths(paths);
      if (response.job_id) {
        setActiveJobId(response.job_id);
        localStorage.setItem('findly_activeJobId', response.job_id);
      }
    } catch (error) {
      console.error('Indexing failed:', error);
    }
  };

  // Force re-index a single file (e.g., from a search result card)
  const handleReindexFile = async (path: string) => {
    try {
      const response = await reindexPaths([path]);
      if (response.job_id) {
        setActiveJobId(response.job_id);
        localStorage.setItem('findly_activeJobId', response.job_id);
      }
    } catch (error) {
      console.error('Reindex failed:', error);
    }
  };

  // Force re-index a batch of file paths (tree context menu / bulk Actions)
  const handleReindexPaths = async (paths: string[]) => {
    if (paths.length === 0) return;
    try {
      const response = await reindexPaths(paths);
      if (response.job_id) {
        setActiveJobId(response.job_id);
        localStorage.setItem('findly_activeJobId', response.job_id);
      }
    } catch (error) {
      console.error('Reindex failed:', error);
    }
  };

  const handleResetAll = () => {
    // Open the confirmation modal; the actual reset runs in performReset
    setResetSuccess(false);
    setResetConfirmOpen(true);
  };

  const closeResetModal = () => {
    setResetConfirmOpen(false);
    setResetSuccess(false);
  };

  const performReset = async () => {
    setResetInProgress(true);
    try {
      await resetAll();

      // Clear all local caches related to indexing
      localStorage.removeItem('findly_indexedPaths');
      localStorage.removeItem('findly_activeJobId');
      setActiveJobId(null);

      // Reset search state
      setSearchState(prev => ({
        ...prev,
        query: '',
        imageFile: null,
        results: [],
        hasSearched: false,
        hasPendingFilterChange: false,
      }));

      // Refresh file system (all items will show as not-indexed)
      const data = await getFileSystem();
      setFileSystem(data.fileSystem);

      // Show success state with checkmark, then auto-close after a moment
      setResetSuccess(true);
      setTimeout(() => {
        setResetConfirmOpen(false);
        setResetSuccess(false);
      }, 1800);
    } catch (error) {
      console.error('Reset failed:', error);
      // Keep the modal open so the user sees something went wrong
      setResetConfirmOpen(false);
    } finally {
      setResetInProgress(false);
    }
  };


  const handleIndexingComplete = useCallback(async () => {
    const jobId = activeJobId;
    if (!jobId) return;
    
    try {
      // Get the paths that were indexed from the job status
      const status = await getIndexStatus(jobId);
      const indexedPaths = status.paths || [];
      
      // Save indexed paths to localStorage for persistence
      const existingPaths = localStorage.getItem('findly_indexedPaths');
      let allIndexedPaths: string[] = [];
      if (existingPaths) {
        try {
          allIndexedPaths = JSON.parse(existingPaths) as string[];
        } catch (e) {
          allIndexedPaths = [];
        }
      }
      
      // Add new indexed paths (avoid duplicates)
      indexedPaths.forEach(path => {
        if (!allIndexedPaths.includes(path)) {
          allIndexedPaths.push(path);
        }
      });
      
      localStorage.setItem('findly_indexedPaths', JSON.stringify(allIndexedPaths));
      
      // Refresh file system
      const data = await getFileSystem();
      
      // Mark the indexed paths as indexed: true in the fileSystem
      const markIndexed = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          // Check if this node's path matches any indexed path
          const isIndexed = allIndexedPaths.some(indexedPath => {
            const normalizedNodePath = node.path.replace(/\\/g, '/');
            const normalizedIndexedPath = indexedPath.replace(/\\/g, '/');
            return normalizedNodePath === normalizedIndexedPath ||
                   normalizedNodePath.startsWith(normalizedIndexedPath + '/') ||
                   normalizedIndexedPath.startsWith(normalizedNodePath + '/');
          });
          
          const updatedNode: FileSystemNode = {
            ...node,
            indexed: isIndexed ? true : node.indexed
          };
          
          if (node.children) {
            updatedNode.children = markIndexed(node.children);
          }
          
          return updatedNode;
        });
      };
      
      const updatedFileSystem = markIndexed(data.fileSystem);
      setFileSystem(updatedFileSystem);
      
      // Clear job ID from localStorage
      localStorage.removeItem('findly_activeJobId');
    } catch (error) {
      console.error('Failed to refresh file system after indexing:', error);
      localStorage.removeItem('findly_activeJobId');
    }
  }, [activeJobId]);

  return (
    <div className="app-container">
      <BackgroundAnimation type={backgroundType} />
      <SidePanel
        fileSystem={fileSystem}
        onIndexSelected={handleIndexSelected}
        onReindexPaths={handleReindexPaths}
        onResetAll={handleResetAll}
        onLoadChildren={handleLoadChildren}
        hasIndexedFiles={hasIndexedFiles}
        triggerIndexHint={triggerIndexHint}
      />
      <main className="main-content">
        <div className="content-wrapper">
          <SearchBar 
            onSearch={handleSearch} 
            loading={searchState.loading}
            hasResults={searchState.results.length > 0}
            hasPendingChange={searchState.hasPendingFilterChange}
            hasIndexedFiles={hasIndexedFiles}
            onTriggerIndexHint={() => setTriggerIndexHint(prev => prev + 1)}
          />
          {(searchState.hasSearched || searchState.loading) && (
            <>
              <FileTypeFilter 
                selectedTypes={searchState.selectedFileTypes} 
                onTypeChange={handleFilterChange} 
              />
              <ResultsList
                results={searchState.results}
                loading={searchState.loading}
                onReindex={handleReindexFile}
              />
            </>
          )}
        </div>
      </main>
      {activeJobId && (
        <IndexingProgress
          jobId={activeJobId}
          onComplete={handleIndexingComplete}
          onDismiss={() => {
            setActiveJobId(null);
            localStorage.removeItem('findly_activeJobId');
          }}
        />
      )}
      <ConfirmModal
        open={resetConfirmOpen}
        variant="danger"
        success={resetSuccess}
        title={resetSuccess ? 'Reset complete' : 'Reset everything?'}
        message={
          resetSuccess ? (
            <>
              All indexed files and search data have been cleared.
              You can start indexing fresh whenever you're ready.
            </>
          ) : (
            <>
              This will permanently delete <strong>all indexed files</strong>,
              clear the search database, and empty the processing queue.
              This action cannot be undone.
            </>
          )
        }
        confirmLabel={
          resetSuccess ? 'Done' : resetInProgress ? 'Resetting…' : 'Reset All'
        }
        cancelLabel="Cancel"
        onConfirm={resetSuccess ? closeResetModal : performReset}
        onCancel={() => {
          if (!resetInProgress) closeResetModal();
        }}
      />
    </div>
  );
}

export default App;
