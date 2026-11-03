import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { getIndexStatus } from '../../api';
import './IndexingProgress.css';

interface IndexingProgressProps {
  jobId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export const IndexingProgress: React.FC<IndexingProgressProps> = ({ jobId, onComplete, onDismiss }) => {
  const [status, setStatus] = useState<'queued' | 'processing' | 'completed' | 'failed'>('queued');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  const hasCalledOnCompleteRef = useRef(false);

  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const checkStatus = async () => {
      if (!isMounted) return;
      
      try {
        const response = await getIndexStatus(jobId);
        
        if (!isMounted) return;
        
        setStatus(response.status);
        setProgress(response.progress);
        
        if (response.error) {
          setError(response.error);
        }

        if (response.status === 'completed') {
          if (!hasCalledOnCompleteRef.current) {
            hasCalledOnCompleteRef.current = true;
            onCompleteRef.current();
          }
          // Stop polling when completed
          return;
        } else if (response.status === 'failed') {
          // Keep failure state visible, no longer polling
          return;
        } else {
          // If still queued or processing, poll again in 1.5 seconds
          timeoutId = setTimeout(checkStatus, 1500);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to get indexing status:', err);
        setError('Lost connection to indexing service.');
        setStatus('failed');
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [jobId]);

  return (
    <div className="indexing-progress-toast">
      <div className="toast-header">
        <div className="toast-title">
          {status === 'completed' && <CheckCircle2 size={18} className="text-success" />}
          {status === 'failed' && <AlertCircle size={18} className="text-error" />}
          {(status === 'queued' || status === 'processing') && <Loader2 size={18} className="animate-spin text-accent" />}
          <h3>
            {status === 'queued' && 'Queued for Indexing...'}
            {status === 'processing' && `Indexing Files (${Math.round(progress)}%)`}
            {status === 'completed' && 'Indexing Complete'}
            {status === 'failed' && 'Indexing Failed'}
          </h3>
        </div>
        <button className="dismiss-btn" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>

      {(status === 'queued' || status === 'processing') && (
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progress}%`, transition: 'width 0.5s ease-out' }} 
          />
        </div>
      )}

      {error && (
        <div className="toast-error-message">
          {error}
        </div>
      )}
    </div>
  );
};
