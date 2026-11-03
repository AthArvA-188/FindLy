import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { getImagePreviewUrl, getTextPreview, detectPreviewKind } from '../../api';

interface FilePreviewModalProps {
  path: string;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ path, onClose }) => {
  const kind = detectPreviewKind(path);
  const fileName = path.split('/').pop() || path;

  const [page, setPage] = useState(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (kind === 'pdf') {
        if (e.key === 'ArrowRight') setPage(p => p + 1);
        if (e.key === 'ArrowLeft') setPage(p => Math.max(1, p - 1));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, kind]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Load text for text files
  useEffect(() => {
    if (kind !== 'text') return;
    let cancelled = false;
    setTextLoading(true);
    setError(null);
    getTextPreview(path)
      .then(text => {
        if (!cancelled) setTextContent(text);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? 'Failed to load text preview');
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, kind]);

  // Reset image loading state when page changes (PDF navigation)
  useEffect(() => {
    if (kind === 'pdf' || kind === 'image') {
      setImageLoading(true);
      setError(null);
    }
  }, [page, kind, path]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const imageSrc =
    kind === 'image' ? getImagePreviewUrl(path) :
    kind === 'pdf' ? getImagePreviewUrl(path, page, 2.0) :
    null;

  return (
    <div className="preview-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="preview-modal">
        <header className="preview-header">
          <div className="preview-header-info">
            <span className="preview-header-icon">
              {kind === 'text' ? <FileText size={16} /> :
               kind === 'pdf' ? <FileText size={16} /> :
               kind === 'image' ? <ImageIcon size={16} /> :
               <AlertCircle size={16} />}
            </span>
            <div className="preview-header-text">
              <span className="preview-filename">{fileName}</span>
              <span className="preview-path" title={path}>{path}</span>
            </div>
          </div>
          <button className="preview-close" onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </button>
        </header>

        <div className="preview-body">
          {kind === 'unsupported' && (
            <div className="preview-message">
              <AlertCircle size={28} />
              <p>Preview not available for this file type.</p>
              <span className="preview-message-sub">{fileName}</span>
            </div>
          )}

          {(kind === 'image' || kind === 'pdf') && imageSrc && (
            <div className="preview-image-wrap">
              {imageLoading && !error && (
                <div className="preview-loader">
                  <Loader2 size={24} className="preview-spinner" />
                  <span>Rendering…</span>
                </div>
              )}
              {error && (
                <div className="preview-message">
                  <AlertCircle size={28} />
                  <p>Couldn't load preview</p>
                  <span className="preview-message-sub">{error}</span>
                </div>
              )}
              <img
                key={imageSrc}
                src={imageSrc}
                alt={fileName}
                className={`preview-image ${imageLoading || error ? 'hidden' : ''}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setError('Could not render this page.');
                }}
              />
            </div>
          )}

          {kind === 'text' && (
            <div className="preview-text-wrap">
              {textLoading && (
                <div className="preview-loader">
                  <Loader2 size={24} className="preview-spinner" />
                  <span>Loading text…</span>
                </div>
              )}
              {error && !textLoading && (
                <div className="preview-message">
                  <AlertCircle size={28} />
                  <p>Couldn't load text</p>
                  <span className="preview-message-sub">{error}</span>
                </div>
              )}
              {!textLoading && !error && textContent !== null && (
                <pre className="preview-text">{textContent || '(empty file)'}</pre>
              )}
            </div>
          )}
        </div>

        {kind === 'pdf' && (
          <footer className="preview-footer">
            <button
              className="preview-nav-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span className="preview-page-indicator">Page {page}</span>
            <button
              className="preview-nav-btn"
              onClick={() => setPage(p => p + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default FilePreviewModal;
