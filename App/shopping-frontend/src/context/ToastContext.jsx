import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", message, duration = 3500 }) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      const newToast = { id, type, message };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="sole-toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const icon =
          toast.type === "success"
            ? "✓"
            : toast.type === "error"
            ? "!"
            : "ℹ";

        return (
          <div
            key={toast.id}
            className={`sole-toast-pill toast-${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <span className="toast-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close-btn"
              onClick={() => onClose(toast.id)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

