import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  FileType as FileTypeIcon,
  CheckCircle2,
  Circle,
  Square,
  CheckSquare,
  Sparkles,
  RotateCcw,
  RotateCw,
  CheckCheck,
  X,
  Zap
} from 'lucide-react';
import type { FileSystemNode } from '../../types';

interface SidePanelProps {
  fileSystem?: FileSystemNode[]; // New prop for hierarchical data from backend
  onIndexSelected?: (paths: string[]) => void;
  onReindexPaths?: (paths: string[]) => void;
  onResetAll?: () => void;
  onLoadChildren?: (path: string) => Promise<void>;
  hasIndexedFiles?: boolean; // Whether any files have been indexed
  triggerIndexHint?: number; // Counter that increments to trigger bubble bounce
  // Backend should provide FileSystemNode[] with structure:
  // {
  //   name: string,           // Display name (e.g., "Documents")
  //   path: string,           // Full path (e.g., "C:/Users/Documents")
  //   type: 'file' | 'folder',
  //   indexed?: boolean,      // Whether this file/folder has been indexed
  //   lastIndexed?: string,   // ISO date string of last index
  //   children?: FileSystemNode[]  // Nested files/folders
  // }
}

interface TreeNodeProps {
  node: FileSystemNode;
  level: number;
  selectedPaths: Set<string>;
  onSelectionChange: (path: string, event: React.MouseEvent) => void;
  lastSelectedPath: string | null;
  onLoadChildren?: (path: string) => Promise<void>;
  onRequestContextMenu?: (e: React.MouseEvent, node: FileSystemNode) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, selectedPaths, onSelectionChange, lastSelectedPath, onLoadChildren, onRequestContextMenu }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // We consider it to have children if it's a folder, even if the array is currently empty (not loaded yet)
  const isFolder = node.type === 'folder';
  const hasLoadedChildren = node.children && node.children.length > 0;

  const getFileIcon = (name: string, type: string) => {
    if (type === 'folder') {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }
    
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
        return <FileCode size={16} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <ImageIcon size={16} />;
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return <FileText size={16} />;
      case 'pdf':
      case 'doc':
      case 'docx':
        return <FileTypeIcon size={16} />;
      default:
        return <File size={16} />;
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      if (!isExpanded && !hasLoadedChildren && onLoadChildren) {
        setIsLoading(true);
        await onLoadChildren(node.path);
        setIsLoading(false);
      }
      setIsExpanded(!isExpanded);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(node.path, e);
  };

  const getCheckboxIcon = () => {
    const isSelected = selectedPaths.has(node.path);
    if (!hasLoadedChildren) {
      return isSelected ? <CheckSquare size={16} /> : <Square size={16} />;
    }
    
    // For folders, check if any children are selected
    const childPaths = getAllChildPaths(node);
    const allSelected = childPaths.length > 0 && childPaths.every(p => selectedPaths.has(p));
    
    return allSelected ? <CheckSquare size={16} /> : <Square size={16} />;
  };

  const isSelected = selectedPaths.has(node.path);

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${node.indexed ? 'indexed' : ''} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleToggle}
        onContextMenu={(e) => {
          if (node.indexed === true && onRequestContextMenu) {
            e.preventDefault();
            onRequestContextMenu(e, node);
          }
        }}
        title={node.path} // Show full path on hover
      >
        <div className="tree-node-left">
          <span 
            className="tree-checkbox"
            onClick={handleCheckboxClick}
          >
            {getCheckboxIcon()}
          </span>
          {isFolder ? (
            <span className="tree-expand-icon">
              {isLoading ? (
                <div className="spinner-small" /> // Need CSS for this, or a simple text indicator like '...'
              ) : isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRightSmall size={16} />
              )}
            </span>
          ) : (
            <span className="tree-expand-icon tree-expand-placeholder"></span>
          )}
          <span className="tree-node-icon">
            {getFileIcon(node.name, node.type)}
          </span>
          <span className="tree-node-name">{node.name}</span>
        </div>
        <div className="tree-node-right">
          <span 
            className={`tree-index-status ${node.indexed === true ? 'indexed' : 'not-indexed'}`}
            title={node.indexed === true ? 'Indexed' : 'Not indexed'}
          >
            {node.indexed === true ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          </span>
        </div>
      </div>
      {isExpanded && hasLoadedChildren && (
        <div className="tree-node-children">
          {node.children!.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              selectedPaths={selectedPaths}
              onSelectionChange={onSelectionChange}
              lastSelectedPath={lastSelectedPath}
              onLoadChildren={onLoadChildren}
              onRequestContextMenu={onRequestContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to get all child paths
const getAllChildPaths = (node: FileSystemNode): string[] => {
  const paths: string[] = [node.path];
  if (node.children) {
    node.children.forEach(child => {
      paths.push(...getAllChildPaths(child));
    });
  }
  return paths;
};

// Helper function to get all nodes as flat array
const flattenNodes = (nodes: FileSystemNode[]): FileSystemNode[] => {
  const result: FileSystemNode[] = [];
  const traverse = (node: FileSystemNode) => {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return result;
};

const SidePanel: React.FC<SidePanelProps> = ({ fileSystem, onIndexSelected, onReindexPaths, onResetAll, onLoadChildren, hasIndexedFiles = true, triggerIndexHint = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [shouldBounce, setShouldBounce] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileSystemNode } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Collect all indexed *file* paths inside the current selection.
  // The reindex API only accepts files, so folders in the selection
  // are expanded to their indexed file descendants.
  const indexedFilesInSelection = useMemo<string[]>(() => {
    if (!fileSystem) return [];
    const result: string[] = [];
    const walk = (nodes: FileSystemNode[], underSelected: boolean) => {
      for (const n of nodes) {
        const inSelection = underSelected || selectedPaths.has(n.path);
        if (inSelection && n.type === 'file' && n.indexed === true) {
          result.push(n.path);
        }
        if (n.children) walk(n.children, inSelection);
      }
    };
    walk(fileSystem, false);
    // Dedupe just in case
    return Array.from(new Set(result));
  }, [selectedPaths, fileSystem]);

  // Update CSS variable when sidebar state or width changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isOpen ? `${panelWidth}px` : '0px'
    );
  }, [isOpen, panelWidth]);

  // Handle triggerIndexHint changes to bounce the bubble
  useEffect(() => {
    if (triggerIndexHint > 0 && !hasIndexedFiles && !isOpen) {
      setShouldBounce(true);
      const timer = setTimeout(() => setShouldBounce(false), 600);
      return () => clearTimeout(timer);
    }
  }, [triggerIndexHint, hasIndexedFiles, isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Close context menu on outside click, ESC, scroll, or resize
  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    const onClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      // Constrain width between 200px and 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleSelectionChange = (path: string, event: React.MouseEvent) => {
    const newSelected = new Set(selectedPaths);
    
    if (event.shiftKey && fileSystem) {
      // Shift+Click: Select range from last selected (or first item) to current
      const allNodes = flattenNodes(fileSystem);
      const currentIndex = allNodes.findIndex(n => n.path === path);
      
      let startIndex = 0;
      if (lastSelectedPath) {
        const lastIndex = allNodes.findIndex(n => n.path === lastSelectedPath);
        if (lastIndex !== -1) {
          startIndex = lastIndex;
        }
      }
      
      if (currentIndex !== -1) {
        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);
        // Clear previous selection and select range
        newSelected.clear();
        for (let i = start; i <= end; i++) {
          newSelected.add(allNodes[i].path);
        }
        
        // Also include children of the clicked item if it's a folder
        const clickedNode = findNodeByPath(fileSystem, path);
        if (clickedNode && clickedNode.children) {
          const childPaths = getAllChildPaths(clickedNode);
          childPaths.forEach(p => newSelected.add(p));
        }
      }
    } else if (event.ctrlKey || event.metaKey || event.altKey) {
      // Ctrl/Cmd/Alt+Click: Add item and its children to selection (don't deselect others)
      if (fileSystem) {
        const node = findNodeByPath(fileSystem, path);
        if (node) {
          const allPaths = getAllChildPaths(node);
          allPaths.forEach(p => newSelected.add(p));
        }
      }
    } else {
      // Regular click: Select this item and all children if it's a folder
      newSelected.clear();
      if (fileSystem) {
        const node = findNodeByPath(fileSystem, path);
        if (node) {
          const allPaths = getAllChildPaths(node);
          allPaths.forEach(p => newSelected.add(p));
        }
      }
    }
    
    setSelectedPaths(newSelected);
    setLastSelectedPath(path);
  };

  const handleSelectAll = () => {
    if (fileSystem) {
      const allPaths = flattenNodes(fileSystem).map(n => n.path);
      setSelectedPaths(new Set(allPaths));
    }
  };

  const handleDeselectAll = () => {
    setSelectedPaths(new Set());
  };

  const handleIndexSelected = () => {
    if (onIndexSelected && selectedPaths.size > 0) {
      onIndexSelected(Array.from(selectedPaths));
    }
  };

  const handleResetAll = () => {
    if (onResetAll) {
      onResetAll();
    }
  };

  const handleReindexSelected = () => {
    if (onReindexPaths && indexedFilesInSelection.length > 0) {
      onReindexPaths(indexedFilesInSelection);
    }
  };

  const handleReindexSingle = (node: FileSystemNode) => {
    if (!onReindexPaths) return;
    // If a folder was right-clicked, expand to its indexed file descendants;
    // for a file, just send the single path.
    let paths: string[] = [];
    if (node.type === 'file') {
      if (node.indexed === true) paths = [node.path];
    } else {
      const collect = (nodes: FileSystemNode[]) => {
        for (const n of nodes) {
          if (n.type === 'file' && n.indexed === true) paths.push(n.path);
          if (n.children) collect(n.children);
        }
      };
      if (node.children) collect(node.children);
    }
    if (paths.length > 0) onReindexPaths(paths);
    setContextMenu(null);
  };

  const openContextMenu = (e: React.MouseEvent, node: FileSystemNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

const selectedCount = selectedPaths.size;

  return (
    <>
      <div className={`side-panel ${isOpen ? 'open' : 'closed'}`} style={{ width: `${panelWidth}px` }}>
        <div className="side-panel-header">
          <h2>File Explorer</h2>
          <div className="menu-container" ref={menuRef}>
            <button
              className={`menu-button ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Actions menu"
            >
              <Zap size={13} />
              Actions
              <ChevronDown size={12} className={`menu-button-chevron ${isMenuOpen ? 'rotated' : ''}`} />
            </button>

            {isMenuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <span className="dropdown-header-label">Actions</span>
                  {selectedCount > 0 && (
                    <span className="dropdown-selection-badge">{selectedCount} selected</span>
                  )}
                </div>

                <div className="menu-group-label">Selection</div>
                <div className="menu-section">
                  <button
                    className="menu-item"
                    onClick={() => { handleSelectAll(); setIsMenuOpen(false); }}
                    disabled={!fileSystem || fileSystem.length === 0}
                  >
                    <span className="menu-item-icon menu-item-icon--neutral"><CheckCheck size={14} /></span>
                    <span className="menu-item-body">
                      <span className="menu-item-title">Select All</span>
                      <span className="menu-item-desc">Select every file and folder</span>
                    </span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => { handleDeselectAll(); setIsMenuOpen(false); }}
                    disabled={selectedPaths.size === 0}
                  >
                    <span className="menu-item-icon menu-item-icon--neutral"><X size={14} /></span>
                    <span className="menu-item-body">
                      <span className="menu-item-title">Deselect All</span>
                      <span className="menu-item-desc">Clear current selection</span>
                    </span>
                  </button>
                </div>

                <div className="menu-divider" />

                <div className="menu-group-label">Index</div>
                <div className="menu-section">
                  <button
                    className="menu-item menu-item--accent"
                    onClick={() => { handleIndexSelected(); setIsMenuOpen(false); }}
                    disabled={selectedPaths.size === 0}
                  >
                    <span className="menu-item-icon menu-item-icon--purple"><Sparkles size={14} /></span>
                    <span className="menu-item-body">
                      <span className="menu-item-title">Index Selected</span>
                      <span className="menu-item-desc">Embed and store for search</span>
                    </span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => { handleReindexSelected(); setIsMenuOpen(false); }}
                    disabled={indexedFilesInSelection.length === 0}
                    title={
                      indexedFilesInSelection.length === 0
                        ? 'Select one or more already-indexed files to re-index'
                        : undefined
                    }
                  >
                    <span className="menu-item-icon menu-item-icon--teal"><RotateCw size={14} /></span>
                    <span className="menu-item-body">
                      <span className="menu-item-title">
                        Reindex Selected
                        {indexedFilesInSelection.length > 0 && (
                          <span className="menu-item-count">{indexedFilesInSelection.length}</span>
                        )}
                      </span>
                      <span className="menu-item-desc">Force-refresh embeddings for indexed files</span>
                    </span>
                  </button>
                </div>

                <div className="menu-divider" />

                <div className="menu-group-label">Danger Zone</div>
                <div className="menu-section">
                  <button
                    className="menu-item menu-item--danger"
                    onClick={() => { handleResetAll(); setIsMenuOpen(false); }}
                  >
                    <span className="menu-item-icon menu-item-icon--red"><RotateCcw size={14} /></span>
                    <span className="menu-item-body">
                      <span className="menu-item-title">Reset All</span>
                      <span className="menu-item-desc">Wipe all indexed data</span>
                    </span>
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

        <div className="file-explorer">
          {fileSystem && fileSystem.length > 0 ? (
            // Render tree structure when fileSystem data is available
            <div className="tree-view">
              {fileSystem.map((node, index) => (
                <TreeNode
                  key={`${node.path}-${index}`}
                  node={node}
                  level={0}
                  selectedPaths={selectedPaths}
                  onSelectionChange={handleSelectionChange}
                  lastSelectedPath={lastSelectedPath}
                  onLoadChildren={onLoadChildren}
                  onRequestContextMenu={openContextMenu}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">No files to display</div>
          )}
        </div>
        
        {/* Resize handle */}
        <div 
          className="side-panel-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      </div>
      <button 
        className={`side-panel-toggle ${isOpen ? 'open' : 'closed'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle directory panel"
        style={{ left: isOpen ? `${panelWidth}px` : '0' }}
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
      {!hasIndexedFiles && !isOpen && (
        <div className={`index-files-hint ${shouldBounce ? 'bounce' : ''}`}>
          Index files before searching
        </div>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <div className="tree-context-menu-label" title={contextMenu.node.path}>
            {contextMenu.node.name}
          </div>
          <button
            className="tree-context-menu-item"
            onClick={() => handleReindexSingle(contextMenu.node)}
            role="menuitem"
          >
            <span className="tree-context-menu-icon"><RotateCw size={13} /></span>
            <span>
              Reindex
              {contextMenu.node.type === 'folder' && (
                <span className="tree-context-menu-hint"> indexed files in folder</span>
              )}
            </span>
          </button>
        </div>
      )}
    </>
  );
};

// Helper function to find a node by path
const findNodeByPath = (nodes: FileSystemNode[], path: string): FileSystemNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
};

export default SidePanel;
