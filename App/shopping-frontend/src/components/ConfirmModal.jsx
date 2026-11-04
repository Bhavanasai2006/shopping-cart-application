import { useEffect, useRef } from "react";

function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel
}) {
  const cancelBtnRef = useRef(null);

  // Focus cancel button on mount for safety; handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    cancelBtnRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop confirm-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <div className="confirm-modal-header">
          <span className="confirm-modal-icon" aria-hidden="true">
            {destructive ? "!" : "?"}
          </span>
          <h2 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h2>
        </div>

        <p id="confirm-modal-desc" className="confirm-modal-message">
          {message}
        </p>

        <div className="confirm-modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="confirm-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-btn-action ${destructive ? "btn-destructive" : ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

