import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

/** Tiempo sin interacción antes de cerrar sesión (15 minutos). */
const IDLE_MS = 15 * 60 * 1000;

/** Evita reprogramar el temporizador en cada evento (p. ej. scroll repetido). */
const THROTTLE_MS = 800;

const BUBBLING_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'click'] as const;

/**
 * Cierra sesión y envía a login si el usuario no interactúa con la aplicación durante IDLE_MS.
 * Solo activo cuando hay sesión iniciada.
 */
export function IdleSessionWatcher() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useNotification();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBumpRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleLogout = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      logout();
      toast('Tu sesión se cerró por inactividad tras 15 minutos sin uso.', 'info');
      navigate('/login', { replace: true });
    }, IDLE_MS);
  }, [clearTimer, logout, navigate, toast]);

  const onActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastBumpRef.current < THROTTLE_MS) return;
    lastBumpRef.current = now;
    scheduleLogout();
  }, [scheduleLogout]);

  useEffect(() => {
    if (!user) {
      clearTimer();
      return;
    }

    scheduleLogout();

    const optsBubbling: AddEventListenerOptions = { capture: false, passive: true };
    const optsCapture: AddEventListenerOptions = { capture: true, passive: true };

    for (const ev of BUBBLING_EVENTS) {
      window.addEventListener(ev, onActivity, optsBubbling);
    }
    document.addEventListener('scroll', onActivity, optsCapture);

    return () => {
      clearTimer();
      for (const ev of BUBBLING_EVENTS) {
        window.removeEventListener(ev, onActivity, optsBubbling);
      }
      document.removeEventListener('scroll', onActivity, optsCapture);
    };
  }, [user, clearTimer, scheduleLogout, onActivity]);

  return null;
}
