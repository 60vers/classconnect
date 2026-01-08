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
 * Fixes flashing by:
 * - Defaulting theme to "light".
 * - Ensuring React sets document.documentElement.dataset.theme immediately when it mounts / theme changes.
 * - Uses localStorage for persistence but defaults to light.
 *
 * Also contains the fullscreen / Discord-like UI (as before).
 */

/* ---------- Theme helpers ---------- */
type Theme = "dark" | "light";

/** Prefer saved choice, otherwise default to light (no system preference). */
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem("cc:theme");
    if (saved === "dark" || saved === "light") return saved as Theme;
  } catch {}
  return "light";
}

function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const initializer = typeof initial === "function" ? (initial as () => T) : () => initial;
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initializer();
    } catch {
      return initializer();
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
  const accent = "#5865f2"; // discord-like
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
      minHeight: 0,
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

  // theme persisted, default to light
  const [theme, setTheme] = usePersistentState<Theme>("cc:theme", getInitialTheme());

  // Immediately sync document theme to avoid flashes when React mounts / theme changes
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
      document.body.setAttribute("data-theme", theme);
    } catch {}
  }, [theme]);

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
          const p: Participant = { user: msg.user, status: msg.status || "online", lastSeen: msg.lastSeen, id: msg.id };
          setParticipants((prev) => {
            const found = prev.findIndex((x) => x.user === p.user);
            if (found === -1) return [...prev, p];
            const copy = prev.slice();
            copy[found] = { ...copy[found], ...p };
            return copy;
          });
        } else if (msg.type === "participants") {
          const list = Array.isArray((msg as any).participants) ? (msg as any).participants : [];
          const normalized = list.map((p: any) => ({
            user: p.user,
            status: p.status || "online",
            lastSeen: p.lastSeen,
            id: p.id,
          })) as Participant[];
          setParticipants(normalized);
        } else {
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

  // attach socket via usePartySocket
  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

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
      } catch {}
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

  // scroll to bottom on new messages
  useEffect(() => {
    const el = document.getElementById("messages-list");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  // send chat
  const sendChat = (content: string) => {
    if (!content.trim()) return;
    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content,
      user: name,
      role: "user",
    };
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

  const applyName = (newName?: string) => {
    const target = (newName ?? editingName).trim() || name;
    if (target === name) {
      setEditingName(target);
      return;
    }
    setName(target);
    setEditingName(target);
    try {
      socketRef.current?.send(
        JSON.stringify({ type: "presence", user: target, status: "online", id: nanoid(6), lastSeen: new Date().toISOString() }),
      );
    } catch {}
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div style={styles(theme).app} data-theme={theme} className="chat-fullscreen">
      <nav style={styles(theme).leftNav}>
        <div style={styles(theme).leftNavButton} title="ClassConnect">CC</div>
        <div
          style={{ ...styles(theme).leftNavButton, width: 40, height: 40, background: "#2f3136" }}
          title="New room"
          onClick={() => {
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
                // update document immediately to avoid flash
                try {
                  document.documentElement.setAttribute("data-theme", next);
                  document.body.setAttribute("data-theme", next);
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

      <header style={styles(theme).header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: styles(theme).avatar.background, display: "flex", alignItems: "center", justifyContent: "center", color: styles(theme).text, fontWeight: 700 }}>
            CC
          </div>
          <div>
            <div style={styles(theme).headerTitle}>ClassConnect</div>
            <div style={{ color: styles(theme).muted, fontSize: 13 }}>Room: <span style={{ fontWeight: 700 }}>{roomId}</span></div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: styles(theme).muted, fontSize: 13 }}>{participants.filter(p => p.status === "online").length} online</div>
          <div style={{ width: 1, height: 24, background: styles(theme).muted, opacity: 0.12 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              aria-label="Display name"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyName();
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${styles(theme).muted}`, background: "transparent", color: styles(theme).text }}
            />
            <button onClick={() => applyName()} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}>
              Set
            </button>
          </div>
        </div>
      </header>

      <main style={styles(theme).center}>
        <div style={styles(theme).messagesPanel}>
          <div id="messages-list" style={styles(theme).messagesList} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div style={{ color: styles(theme).muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
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
                    <div style={styles(theme).avatar} aria-hidden>
                      {initialsFromName(m.user)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={styles(theme).authorLine}>{m.user}</div>
                        <div style={styles(theme).timeSmall}>
                          {m.role}&nbsp;•&nbsp;{typeof (m as any).created_at === "string" ? new Date((m as any).created_at).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      <div style={isMe ? styles(theme).bubbleMe : styles(theme).bubbleThem}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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
            style={styles(theme).composer}
          >
            <input name="content" ref={inputRef} style={styles(theme).input} placeholder={`Message #${roomId}`} autoComplete="off" />
            <button type="submit" style={styles(theme).sendBtn}>Send</button>
          </form>
        </div>
      </main>

      <aside style={styles(theme).rightSidebar}>
        <div style={styles(theme).participantsTitle}>Participants</div>
        <div style={{ color: styles(theme).muted, fontSize: 13, marginBottom: 8 }}>{participants.length} total</div>

        <div>
          {participants.length === 0 ? (
            <div style={{ color: styles(theme).muted }}>No participants yet</div>
          ) : (
            participants.map((p) => (
              <div
                key={p.user}
                style={{
                  ...styles(theme).participantRow,
                  justifyContent: "space-between",
                }}
                onClick={() => {
                  const el = inputRef.current;
                  if (el) {
                    el.focus();
                    el.value = `@${p.user} `;
                  }
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={styles(theme).avatar}>{initialsFromName(p.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: styles(theme).muted }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={styles(theme).presenceDot(p.status)} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, color: styles(theme).muted, fontSize: 13 }}>
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
