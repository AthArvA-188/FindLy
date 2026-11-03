import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  success?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  success = false,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Close on ESC, focus the confirm button on open, lock body scroll
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);

    // Autofocus the primary action on next tick
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 50);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const effectiveVariant = success ? 'success' : variant;

  return (
    <div className="confirm-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className={`confirm-modal confirm-modal--${effectiveVariant}`}>
        <button
          className="confirm-close"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        <div className="confirm-body">
          <div className={`confirm-icon confirm-icon--${effectiveVariant}`}>
            {success ? <CheckCircle2 size={26} /> : <AlertTriangle size={22} />}
          </div>
          <h3 className="confirm-title">{title}</h3>
          <div className="confirm-message">{message}</div>
        </div>

        {success ? (
          <div className="confirm-actions confirm-actions--center">
            <button
              ref={confirmBtnRef}
              className="confirm-btn confirm-btn--success"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        ) : (
          <div className="confirm-actions">
            <button className="confirm-btn confirm-btn--cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              className={`confirm-btn confirm-btn--${variant}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmModal;
