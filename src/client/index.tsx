import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/**
 * Updated index.tsx
 * - Fullscreen, Discord-like layout (center messages + right participants + left nav).
 * - Dark / Light theme toggle (persisted in localStorage, respects system preference).
 * - Participants presence support (presence messages handled and sent).
 * - Messages persisted to localStorage per room as a fallback and for offline view.
 * - UI improvements: avatars, timestamps, author labels, sticky header, keyboard send.
 *
 * Only this file changed.
 */

/* ---------- Theme & style helpers ---------- */
type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem("cc:theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

/* ---------- Styles factory (colors depend on theme) ---------- */
const styles = (theme: Theme) => {
  const isDark = theme === "dark";
  const bg = isDark ? "#0f1720" : "#f3f6fb";
  const surface = isDark ? "#0b1220" : "#ffffff";
  const panel = isDark ? "#07101a" : "#fafbff";
  const text = isDark ? "#e6eef8" : "#0b1726";
  const muted = isDark ? "#9aa6b2" : "#6d7790";
  const accent = "#5865f2"; // discord-like purple
  const messageMeBg = isDark ? accent : "#2b7cff";
  const messageThemBg = isDark ? "#071722" : "#f1f5fb";

  return {
    app: {
      width: "100vw",
      height: "100vh",
      display: "grid",
      gridTemplateRows: "56px 1fr",
      gridTemplateColumns: "72px 1fr 320px",
      boxSizing: "border-box" as const,
      background: bg,
      color: text,
      gap: 0,
      overflow: "hidden",
    },
    leftNav: {
      gridColumn: "1 / 2",
      gridRow: "1 / -1",
      background: isDark ? "#071025" : "#ffffff",
      borderRight: `1px solid ${isDark ? "#0b1722" : "#eef3fb"}`,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      padding: "12px 8px",
      gap: 12,
    },
    leftNavButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: accent,
      color: "white",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: isDark ? "none" : "0 6px 16px rgba(88,101,242,0.12)",
    },
    header: {
      gridColumn: "2 / 3",
      gridRow: "1 / 2",
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: `1px solid ${isDark ? "#071622" : "#eef3fb"}`,
      background: panel,
      gap: 12,
      zIndex: 20,
    },
    headerTitle: { fontSize: 16, fontWeight: 700 as const },
    center: {
      gridColumn: "2 / 3",
      gridRow: "2 / -1",
      padding: "12px",
      display: "flex",
      flexDirection: "column" as const,
      minHeight: 0,
      gap: 12,
    },
    messagesPanel: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      background: surface,
      borderRadius: 8,
      boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.02)" : "inset 0 1px 0 rgba(16,24,39,0.02)",
      minHeight: 0, // important for children overflow
      overflow: "hidden",
    },
    messagesList: {
      flex: 1,
      overflow: "auto",
      padding: "16px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
    },
    composer: {
      borderTop: `1px solid ${isDark ? "#071622" : "#eef3fb"}`,
      padding: 12,
      display: "flex",
      gap: 8,
      alignItems: "center",
      background: panel,
    },
    input: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${isDark ? "#0b1722" : "#e6eef8"}`,
      background: isDark ? "#05101a" : "#fbfdff",
      color: text,
      outline: "none",
    },
    sendBtn: {
      background: messageMeBg,
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 8,
      cursor: "pointer",
    },
    rightSidebar: {
      gridColumn: "3 / 4",
      gridRow: "1 / -1",
      padding: 16,
      background: panel,
      borderLeft: `1px solid ${isDark ? "#071622" : "#eef3fb"}`,
      overflow: "auto",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 8,
      background: isDark ? "#0b1220" : "#e6eef8",
      color: text,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: 14,
      flexShrink: 0,
    },
    bubbleMe: {
      alignSelf: "flex-end",
      background: messageMeBg,
      color: "white",
      padding: "10px 12px",
      borderRadius: 10,
      maxWidth: "78%",
      wordBreak: "break-word" as const,
    },
    bubbleThem: {
      alignSelf: "flex-start",
      background: messageThemBg,
      color: text,
      padding: "10px 12px",
      borderRadius: 10,
      maxWidth: "78%",
      wordBreak: "break-word" as const,
    },
    authorLine: { fontSize: 13, fontWeight: 700 as const, marginBottom: 6, color: text },
    timeSmall: { fontSize: 11, color: muted, marginLeft: 8 },
    participantsTitle: { fontWeight: 700 as const, marginBottom: 8 },
    participantRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 6px",
      borderRadius: 6,
      cursor: "pointer",
    },
    presenceDot: (status: "online" | "offline") => ({
      width: 9,
      height: 9,
      borderRadius: 999,
      background: status === "online" ? "#39d353" : muted,
      flexShrink: 0,
    }),
    muted,
    text,
    accent,
  };
};

/* ---------- Presence & participants types ---------- */
type Participant = {
  user: string;
  status: "online" | "offline";
  lastSeen?: string;
  id?: string;
};

/* ---------------- Helper utilities ---------------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- Main App component ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const roomId = room ?? "main";

  // name persisted
  const [name, setName] = usePersistentState<string>("cc:name", () => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });
  const [editingName, setEditingName] = useState(name);

  // theme
  const [theme, setTheme] = usePersistentState<Theme>("cc:theme", getInitialTheme());

  // messages persisted per room
  const messagesKey = `cc:messages:${roomId}`;
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(messagesKey, []);

  // participants persisted per room (simple fallback)
  const participantsKey = `cc:participants:${roomId}`;
  const [participants, setParticipants] = usePersistentState<Participant[]>(participantsKey, []);

  // local refs
  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);

  // computed styles for current theme
  const S = useMemo(() => styles(theme), [theme]);

  // handle incoming messages (stable)
  const handleIncoming = useCallback(
    (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(evt.data as string) as Message;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "add") {
          const newMsg: ChatMessage = {
            id: msg.id,
            content: msg.content,
            user: msg.user,
            role: msg.role,
          };
          setMessages((prev) => [...prev, newMsg]);
        } else if (msg.type === "update") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? {
                    id: msg.id,
                    content: msg.content,
                    user: msg.user,
                    role: msg.role,
                  }
                : m,
            ),
          );
        } else if (msg.type === "presence") {
          // message: { type: 'presence', user, status, id? }
          const p: Participant = { user: msg.user, status: msg.status || "online", lastSeen: msg.lastSeen, id: msg.id };
          setParticipants((prev) => {
            const found = prev.findIndex((x) => x.user === p.user);
            if (found === -1) return [...prev, p];
            const copy = prev.slice();
            copy[found] = { ...copy[found], ...p };
            return copy;
          });
        } else if (msg.type === "participants") {
          // snapshot: { type: 'participants', participants: [...] }
          const list = Array.isArray((msg as any).participants) ? (msg as any).participants : [];
          const normalized = list.map((p: any) => ({
            user: p.user,
            status: p.status || "online",
            lastSeen: p.lastSeen,
            id: p.id,
          })) as Participant[];
          setParticipants(normalized);
        } else {
          // fallback: treat as text message event
          const text = typeof evt.data === "string" ? evt.data : JSON.stringify(evt.data);
          setMessages((prev) => [
            ...prev,
            { id: `sys-${Date.now()}`, content: String(text), user: "system", role: "system" },
          ]);
        }
      } catch (err) {
        console.warn("Failed to parse incoming message", err);
      }
    },
    [setMessages, setParticipants],
  );

  // attach socket via usePartySocket (this gives us a socket-like object)
  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

  // keep a ref for sending
  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  // presence: announce online on mount, offline on unload, heartbeat
  useEffect(() => {
    const sendPresence = (status: "online" | "offline") => {
      const payload = {
        type: "presence",
        user: name,
        status,
        id: nanoid(6),
        lastSeen: new Date().toISOString(),
      } as any;
      try {
        socketRef.current?.send(JSON.stringify(payload));
      } catch {
        // ignore
      }
      // also update local participants state for instant feedback
      setParticipants((prev) => {
        const found = prev.findIndex((p) => p.user === name);
        const p: Participant = { user: name, status, lastSeen: payload.lastSeen, id: payload.id };
        if (found === -1) return [...prev, p];
        const copy = prev.slice();
        copy[found] = { ...copy[found], ...p };
        return copy;
      });
    };

    sendPresence("online");
    // heartbeat
    heartbeatRef.current = window.setInterval(() => sendPresence("online"), 30000);

    const onUnload = () => {
      sendPresence("offline");
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sendPresence("offline");
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, roomId]);

  // save messages to localStorage when they change (usePersistentState already does it),
  // but ensure we limit size to avoid unbounded growth
  useEffect(() => {
    // keep last 500 messages
    if (messages.length > 500) {
      const trimmed = messages.slice(messages.length - 500);
      try {
        localStorage.setItem(messagesKey, JSON.stringify(trimmed));
      } catch {}
    }
    // scroll to bottom on new message
    const el = document.getElementById("messages-list");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // helper to send a chat message (optimistic)
  const sendChat = (content: string) => {
    if (!content.trim()) return;
    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content,
      user: name,
      role: "user",
    };
    // optimistic
    setMessages((prev) => [...prev, chatMessage]);
    try {
      socketRef.current?.send(
        JSON.stringify({
          type: "add",
          ...chatMessage,
        } satisfies Message),
      );
    } catch (err) {
      console.warn("send failed", err);
    }
  };

  // name update handler
  const applyName = (newName?: string) => {
    const target = (newName ?? editingName).trim() || name;
    if (target === name) {
      setEditingName(target);
      return;
    }
    setName(target);
    setEditingName(target);
    // announce presence with new name
    try {
      socketRef.current?.send(
        JSON.stringify({ type: "presence", user: target, status: "online", id: nanoid(6), lastSeen: new Date().toISOString() }),
      );
    } catch {}
  };

  // UI local input refs
  const inputRef = useRef<HTMLInputElement | null>(null);

  // render
  return (
    <div style={S.app} data-theme={theme} className="chat-fullscreen">
      {/* left vertical nav (Discord-like small server icons) */}
      <nav style={S.leftNav}>
        <div style={S.leftNavButton} title="ClassConnect">
          CC
        </div>
        <div
          style={{ ...S.leftNavButton, width: 40, height: 40, background: "#2f3136" }}
          title="Rooms"
          onClick={() => {
            // simple create new room behavior
            const r = nanoid(8);
            window.location.pathname = `/${r}`;
          }}
        >
          +
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            aria-label="Toggle theme"
            onClick={() => {
              setTheme((t) => {
                const next = t === "dark" ? "light" : "dark";
                try {
                  localStorage.setItem("cc:theme", next);
                } catch {}
                return next;
              });
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: theme === "dark" ? "#202225" : "#f1f5fb",
              color: theme === "dark" ? "white" : "black",
              cursor: "pointer",
              border: "none",
            }}
            title="Toggle dark / light mode"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </nav>

      {/* header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: S.avatar.background, display: "flex", alignItems: "center", justifyContent: "center", color: S.text, fontWeight: 700 }}>
            CC
          </div>
          <div>
            <div style={S.headerTitle}>ClassConnect</div>
            <div style={{ color: S.muted, fontSize: 13 }}>Room: <span style={{ fontWeight: 700 }}>{roomId}</span></div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: S.muted, fontSize: 13 }}>{participants.filter(p => p.status === "online").length} online</div>
          <div style={{ width: 1, height: 24, background: S.muted, opacity: 0.12 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              aria-label="Display name"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyName();
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${S.muted}`, background: "transparent", color: S.text }}
            />
            <button onClick={() => applyName()} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}>
              Set
            </button>
          </div>
        </div>
      </header>

      {/* center messages */}
      <main style={S.center}>
        <div style={S.messagesPanel}>
          <div id="messages-list" style={S.messagesList} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div style={{ color: S.muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
            ) : (
              messages.map((m) => {
                const isMe = m.user === name;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: isMe ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={S.avatar} aria-hidden>
                      {initialsFromName(m.user)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={S.authorLine}>{m.user}</div>
                        <div style={S.timeSmall}>
                          {m.role}&nbsp;•&nbsp;{typeof (m as any).created_at === "string" ? new Date((m as any).created_at).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      <div style={isMe ? S.bubbleMe : S.bubbleThem}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const input = form.elements.namedItem("content") as HTMLInputElement | null;
              if (!input) return;
              const text = input.value.trim();
              if (!text) return;
              sendChat(text);
              input.value = "";
              input.focus();
            }}
            style={S.composer}
          >
            <input name="content" ref={inputRef} style={S.input} placeholder={`Message #${roomId}`} autoComplete="off" />
            <button type="submit" style={S.sendBtn}>Send</button>
          </form>
        </div>
      </main>

      {/* right participants */}
      <aside style={S.rightSidebar}>
        <div style={S.participantsTitle}>Participants</div>
        <div style={{ color: S.muted, fontSize: 13, marginBottom: 8 }}>{participants.length} total</div>

        <div>
          {participants.length === 0 ? (
            <div style={{ color: S.muted }}>No participants yet</div>
          ) : (
            participants.map((p) => (
              <div
                key={p.user}
                style={{
                  ...S.participantRow,
                  justifyContent: "space-between",
                }}
                onClick={() => {
                  // quick interaction: autofill composer with @user
                  const el = inputRef.current;
                  if (el) {
                    el.focus();
                    el.value = `@${p.user} `;
                  }
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={S.avatar}>{initialsFromName(p.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: S.muted }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={S.presenceDot(p.status)} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, color: S.muted, fontSize: 13 }}>
          Tip: Click a participant to mention them. Theme and name are saved locally.
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Router + mount ---------------- */
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
