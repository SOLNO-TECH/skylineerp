import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { sendSoporteChat, type SoporteChatMessage } from '../api/client';

function FormattedReply({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-800">
      {lines.map((line, i) => (
        <p key={i} className={line.trim() === '' ? 'min-h-[0.5rem]' : ''}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            const m = part.match(/^\*\*([^*]+)\*\*$/);
            if (m) {
              return (
                <strong key={j} className="font-semibold text-gray-900">
                  {m[1]}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

const WELCOME =
  'Hola, soy el **asistente de soporte interno** de Skyline ERP. Funciona con una **guía incluida en el sistema** (no hace falta contratar OpenAI ni ningún servicio de pago). Pregunta cómo usar los módulos: unidades, rentas, check-in/out, proveedores, usuarios, roles, etc. Las respuestas son orientativas.';

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SoporteChatMessage[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<SoporteChatMessage[]>(messages);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    const userMsg: SoporteChatMessage = { role: 'user', content: trimmed };
    const history = [...messagesRef.current, userMsg];
    setInput('');
    setLoading(true);
    setMessages(history);
    try {
      const { reply } = await sendSoporteChat(history);
      if (requestId !== requestIdRef.current) return;
      setMessages((p) => [...p, { role: 'assistant', content: reply }]);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      const errText =
        e instanceof Error
          ? `**No pude responder ahora.** ${e.message}\n\nSi el problema continúa, contacta a un administrador del sistema.`
          : '**Error de conexión.** Intenta de nuevo en unos segundos.';
      setMessages((p) => [...p, { role: 'assistant', content: errText }]);
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [input, loading]);

  const clearChat = useCallback(() => {
    inFlightRef.current = false;
    requestIdRef.current += 1;
    setLoading(false);
    setMessages([{ role: 'assistant', content: WELCOME }]);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[55] flex size-14 items-center justify-center rounded-full border-2 border-skyline-blue bg-white text-skyline-blue shadow-lg transition hover:bg-skyline-blue/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skyline-blue"
        aria-expanded={open}
        aria-controls="skyline-soporte-panel"
        title="Ayuda y soporte"
        aria-label="Abrir ayuda y soporte interno"
      >
        <Icon icon={open ? 'mdi:close' : 'mdi:help-circle-outline'} className="size-8" aria-hidden />
      </button>

      {open && (
        <div
          id="skyline-soporte-panel"
          className="fixed bottom-24 right-6 z-[55] flex w-[min(100vw-2rem,400px)] flex-col rounded-xl border border-skyline-border bg-white shadow-2xl"
          role="dialog"
          aria-label="Chat de soporte interno"
        >
          <div className="flex items-center justify-between gap-2 border-b border-skyline-border bg-skyline-bg/80 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon icon="mdi:headset" className="size-5 shrink-0 text-skyline-blue" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Soporte Skyline</p>
                <p className="text-xs text-gray-500 truncate">Uso del sistema</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearChat}
              className="btn btn-outline-secondary btn-sm shrink-0"
              title="Nueva conversación"
            >
              Limpiar
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(420px,50vh)] space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`rounded-lg px-3 py-2 ${
                  m.role === 'user'
                    ? 'ml-6 border border-skyline-blue/30 bg-skyline-blue/[0.06]'
                    : 'mr-4 border border-skyline-border bg-gray-50/90'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <FormattedReply text={m.content} />
                )}
              </div>
            ))}
            {loading && (
              <p className="text-xs text-skyline-muted px-1 flex items-center gap-2">
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue" />
                Preparando respuesta…
              </p>
            )}
          </div>

          <div className="border-t border-skyline-border p-3">
            <p className="mb-2 text-[10px] leading-snug text-gray-500">
              Guía integrada, sin APIs de pago. Las respuestas son informativas; para políticas internas o casos excepcionales, confirma con tu administrador.
            </p>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Escribe tu duda…"
                rows={1}
                className="min-h-[44px] flex-1 resize-y rounded-md border border-skyline-border bg-white px-3 py-2.5 text-sm leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue"
                disabled={loading}
                aria-label="Mensaje para el asistente"
              />
              <button
                type="button"
                className="btn btn-primary shrink-0 px-3"
                disabled={loading || !input.trim()}
                onClick={send}
              >
                <Icon icon="mdi:send" className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
