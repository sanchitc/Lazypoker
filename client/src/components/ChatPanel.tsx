import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { encryptChat, decryptChat } from '../lib/chatCrypto';
import type { ChatMessage } from '@common/types';

interface DecryptedMessage {
  id: string;
  fromPlayerId: string;
  fromName: string;
  text: string;
  sentAt: number;
  failed?: boolean;
}

export default function ChatPanel() {
  const { socket } = useSocket();
  const { roomCode, playerId } = useGame();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!socket || !roomCode) return;

    let cancelled = false;
    const seenIds = new Set<string>();

    const handleHistory = async (msgs: ChatMessage[]) => {
      const decrypted = await Promise.all(
        msgs.map(async (m): Promise<DecryptedMessage> => {
          try {
            const text = await decryptChat(roomCode, m.iv, m.ciphertext);
            return { id: m.id, fromPlayerId: m.fromPlayerId, fromName: m.fromName, text, sentAt: m.sentAt };
          } catch {
            return { id: m.id, fromPlayerId: m.fromPlayerId, fromName: m.fromName, text: '[unable to decrypt]', sentAt: m.sentAt, failed: true };
          }
        })
      );
      if (cancelled) return;
      decrypted.forEach(d => seenIds.add(d.id));
      setMessages(decrypted);
    };

    const handleMessage = async (m: ChatMessage) => {
      if (seenIds.has(m.id)) return;
      seenIds.add(m.id);

      let text: string;
      let failed = false;
      try {
        text = await decryptChat(roomCode, m.iv, m.ciphertext);
      } catch {
        text = '[unable to decrypt]';
        failed = true;
      }
      if (cancelled) return;

      setMessages(prev => [...prev, {
        id: m.id, fromPlayerId: m.fromPlayerId, fromName: m.fromName, text, sentAt: m.sentAt, failed,
      }]);

      if (!openRef.current && m.fromPlayerId !== playerId) {
        setUnread(u => u + 1);
      }
    };

    socket.on('chat:history', handleHistory);
    socket.on('chat:message', handleMessage);

    return () => {
      cancelled = true;
      socket.off('chat:history', handleHistory);
      socket.off('chat:message', handleMessage);
    };
  }, [socket, roomCode, playerId]);

  // Autoscroll to bottom on new messages or open.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Clear unread once opened.
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !socket || !roomCode || !playerId || sending) return;
    setSending(true);
    try {
      const { iv, ciphertext } = await encryptChat(roomCode, text);
      socket.emit('chat:send', { roomCode, playerId, iv, ciphertext });
      setDraft('');
    } catch (err) {
      console.error('chat encrypt failed', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!roomCode || !playerId) return null;

  return (
    <>
      {/* Floating toggle button — anchored to bottom-right, sits above the
          action bar so it never overlaps. pointer-events scoped to the button
          itself so the rest of the table remains clickable. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className={`fixed right-3 bottom-24 z-40 flex h-11 w-11 items-center justify-center
                    rounded-full border border-brass/35
                    bg-gradient-to-b from-panel-soft to-panel-strong
                    text-bone shadow-lg shadow-ink/50
                    transition-all hover:border-brass/60 active:scale-95
                    ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <MessageCircle className="h-5 w-5 text-brass" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center
                           rounded-full bg-ember px-1 text-[10px] font-bold text-bone
                           shadow-md shadow-ink/50 animate-scale-pop">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel — fixed overlay. Doesn't block the action bar (action bar
          is full-width at the bottom; panel sits above it on the right). */}
      <div
        className={`fixed right-3 bottom-24 z-40
                    w-[min(20rem,calc(100vw-1.5rem))] h-[min(24rem,60vh)]
                    flex flex-col overflow-hidden rounded-2xl
                    border border-brass/30 bg-panel/95 backdrop-blur-md
                    shadow-2xl shadow-ink/60
                    origin-bottom-right transition-all duration-150
                    ${open
                      ? 'opacity-100 scale-100 pointer-events-auto'
                      : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brass/20
                        bg-ink/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-brass" />
            <span className="font-display text-[11px] uppercase tracking-[0.18em] text-brass">
              Table Chat
            </span>
            <span className="ml-1 text-[9px] text-bone-dim/70" title="End-to-end encrypted with the room code">
              · encrypted
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="flex h-6 w-6 items-center justify-center rounded-full
                       text-bone-dim hover:text-bone hover:bg-bone/8 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5 scrollbar-brass">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-[11px]
                            italic text-bone-dim/60 font-display">
              No messages yet. Say hi to the table.
            </div>
          ) : (
            messages.map(m => {
              const mine = m.fromPlayerId === playerId;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-brass/70">
                      {m.fromName}
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-2.5 py-1.5 text-[12px] leading-snug break-words
                      ${mine
                        ? 'bg-brass/18 text-bone border border-brass/25'
                        : m.failed
                        ? 'bg-ember/15 text-ember border border-ember/30 italic'
                        : 'bg-panel-soft/70 text-bone border border-bone/10'}`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="flex items-center gap-1.5 border-t border-brass/20 bg-ink/30 px-2 py-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            placeholder="Message…"
            className="flex-1 rounded-full border border-bone/12 bg-panel-soft/60
                       px-3 py-1.5 text-[12px] text-bone placeholder:text-bone-dim/50
                       outline-none focus:border-brass/50 focus:bg-panel-soft/80
                       transition-colors"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-full
                       border border-brass/40 bg-gradient-to-b from-[#f1dca8] to-brass
                       text-obsidian shadow-md shadow-ink/40
                       transition-all hover:brightness-110 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
