import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  mensaje: string;
  tipo: ToastType;
  createdAt: number;
};

type NotificationContextValue = {
  toasts: Toast[];
  toast: (mensaje: string, tipo?: ToastType) => void;
  removeToast: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

let idCounter = 0;
function generateId() {
  idCounter += 1;
  return `toast-${Date.now()}-${idCounter}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((mensaje: string, tipo: ToastType = 'success') => {
    const id = generateId();
    const nuevo: Toast = { id, mensaje, tipo, createdAt: Date.now() };
    setToasts((prev) => [...prev, nuevo]);

    // Auto-remover después de 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: NotificationContextValue = {
    toasts,
    toast,
    removeToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification debe usarse dentro de NotificationProvider');
  return ctx;
}
