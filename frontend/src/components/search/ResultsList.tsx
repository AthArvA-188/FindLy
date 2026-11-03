import React, { useState } from 'react';
import { File, FileText, FileCode, Image as ImageIcon, RotateCw, Check } from 'lucide-react';
import type { SearchResult } from '../../types';
import FilePreviewModal from '../preview/FilePreviewModal';

interface ResultsListProps {
  results: SearchResult[];
  loading: boolean;
  onReindex?: (path: string) => Promise<void> | void;
}

const getFileIcon = (fileType: string) => {
  switch (fileType.toLowerCase()) {
    case 'pdf':
    case 'doc':
    case 'docx':
      return <FileText size={16} />;
    case 'code':
    case 'js':
    case 'ts':
    case 'py':
    case 'java':
      return <FileCode size={16} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'image':
      return <ImageIcon size={16} />;
    default:
      return <File size={16} />;
  }
};

const ResultsList: React.FC<ResultsListProps> = ({ results, loading, onReindex }) => {
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  // Track per-result reindex state: 'idle' | 'pending' | 'done'
  const [reindexState, setReindexState] = useState<Record<string, 'pending' | 'done'>>({});

  const handleReindex = async (e: React.MouseEvent, result: SearchResult) => {
    e.stopPropagation();
    if (!onReindex || reindexState[result.id]) return;

    setReindexState(prev => ({ ...prev, [result.id]: 'pending' }));
    try {
      await onReindex(result.path);
      setReindexState(prev => ({ ...prev, [result.id]: 'done' }));
      // Fade the checkmark back to idle after a moment
      setTimeout(() => {
        setReindexState(prev => {
          const next = { ...prev };
          delete next[result.id];
          return next;
        });
      }, 2000);
    } catch {
      setReindexState(prev => {
        const next = { ...prev };
        delete next[result.id];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="results-container">
        <div className="loading">
          <div className="spinner"></div>
          <span>Searching documents...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="results-container">
        <div className="no-results">
          <p>No results found. Try adjusting your search query or filters.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="results-container">
        {results.map((result) => (
          <div
            key={result.id}
            className="result-card"
            onClick={() => setPreviewPath(result.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPreviewPath(result.path);
              }
            }}
          >
            <div className="result-header">
              <div className="result-title">
                {result.path.split('/').pop() || result.path}
              </div>
              <div className="result-header-right">
                {onReindex && (
                  <button
                    type="button"
                    className={`reindex-btn ${
                      reindexState[result.id] === 'pending' ? 'reindex-btn--pending' : ''
                    } ${reindexState[result.id] === 'done' ? 'reindex-btn--done' : ''}`}
                    onClick={(e) => handleReindex(e, result)}
                    disabled={!!reindexState[result.id]}
                    aria-label="Re-index this file"
                    title={
                      reindexState[result.id] === 'done'
                        ? 'Queued for re-indexing'
                        : reindexState[result.id] === 'pending'
                        ? 'Queuing…'
                        : 'Re-index this file'
                    }
                  >
                    {reindexState[result.id] === 'done' ? (
                      <Check size={13} />
                    ) : (
                      <RotateCw
                        size={13}
                        className={
                          reindexState[result.id] === 'pending' ? 'reindex-spin' : ''
                        }
                      />
                    )}
                  </button>
                )}
                <div className="confidence-score">
                  {Math.round(result.confidence * 100)}% match
                </div>
              </div>
            </div>
            <div className="result-path">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {getFileIcon(result.fileType)}
                <span>{result.path}</span>
              </span>
            </div>
            <div className="result-preview">{result.preview}</div>
          </div>
        ))}
      </div>
      {previewPath && (
        <FilePreviewModal
          path={previewPath}
          onClose={() => setPreviewPath(null)}
        />
      )}
    </>
  );
};

export default ResultsList;
