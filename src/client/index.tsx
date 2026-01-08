import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router";
import { nanoid } from "nanoid";
import { FiPlus, FiHome, FiUser, FiHash } from "react-icons/fi";

import { names, type ChatMessage, type Message } from "../shared";

/**
 * Changes requested:
 * - Fix messages rendering (avoid raw JSON showing in UI).
 * - Remove dark mode (keep light only).
 * - Persist "servers" (rooms) locally and show them in left nav.
 * - Improve UI (Discord-like) and use react-icons for icons.
 *
 * Only this file changed.
 */

/* ---------- Lightweight persistent state helper ---------- */
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

/* ---------- Light-only styles ---------- */
const L = {
  app: {
    width: "100vw",
    height: "100vh",
    display: "grid",
    gridTemplateRows: "56px 1fr",
    gridTemplateColumns: "72px 1fr 320px",
    boxSizing: "border-box" as const,
    background: "#f6f8fb",
    color: "#0b1726",
    gap: 0,
    overflow: "hidden",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  leftNav: {
    gridColumn: "1 / 2",
    gridRow: "1 / -1",
    background: "#ffffff",
    borderRight: `1px solid #eef3fb`,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "12px 8px",
    gap: 12,
  },
  serverButton: (active = false) =>
    ({
      width: 48,
      height: 48,
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? "#5865f2" : "#eaf0ff",
      color: active ? "white" : "#2b3a67",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: active ? "0 6px 16px rgba(88,101,242,0.12)" : "none",
      border: "none",
    } as React.CSSProperties),
  header: {
    gridColumn: "2 / 3",
    gridRow: "1 / 2",
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #eef3fb",
    background: "#ffffff",
    gap: 12,
    zIndex: 20,
  },
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
    background: "#ffffff",
    borderRadius: 8,
    boxShadow: "inset 0 1px 0 rgba(16,24,39,0.02)",
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
    borderTop: `1px solid #eef3fb`,
    padding: 12,
    display: "flex",
    gap: 8,
    alignItems: "center",
    background: "#fafbff",
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid #e6eef8`,
    background: "#fbfdff",
    color: "#0b1726",
    outline: "none",
  },
  sendBtn: {
    background: "#2b7cff",
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
    background: "#fafbff",
    borderLeft: `1px solid #eef3fb`,
    overflow: "auto",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: "#e6eef8",
    color: "#102a43",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    background: "#2b7cff",
    color: "white",
    padding: "10px 12px",
    borderRadius: 10,
    maxWidth: "78%",
    wordBreak: "break-word" as const,
  },
  bubbleThem: {
    alignSelf: "flex-start",
    background: "#f1f5fb",
    color: "#0b1726",
    padding: "10px 12px",
    borderRadius: 10,
    maxWidth: "78%",
    wordBreak: "break-word" as const,
  },
  authorLine: { fontSize: 13, fontWeight: 700 as const, marginBottom: 6, color: "#0b1726" },
  timeSmall: { fontSize: 11, color: "#6d7790", marginLeft: 8 },
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
    background: status === "online" ? "#39d353" : "#9aa6b2",
    flexShrink: 0,
  }),
};

/* ---------- Presence & participants types ---------- */
type Participant = {
  user: string;
  status: "online" | "offline";
  lastSeen?: string;
  id?: string;
};

/* ---------------- Helpers ---------------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Safely extract a human-friendly string from message content.
 * - If content is a string, return it.
 * - If content looks like JSON (object/array), try to extract a common field:
 *   content.text | content.message | content.content | first string-valued property
 * - Fallback to JSON.stringify with truncation.
 */
function extractText(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") return String(content);
  // object / array
  try {
    if (Array.isArray(content)) {
      // try to join string items
      const strings = content.filter((x) => typeof x === "string");
      if (strings.length) return strings.join(" ");
    } else if (typeof content === "object") {
      if (typeof content.text === "string") return content.text;
      if (typeof content.message === "string") return content.message;
      if (typeof content.content === "string") return content.content;
      // pick first string property
      for (const k of Object.keys(content)) {
        const v = (content as any)[k];
        if (typeof v === "string") return v;
      }
    }
    // fallback: stringify but keep it short
    const s = JSON.stringify(content);
    return s.length > 300 ? s.slice(0, 300) + "… (truncated JSON)" : s;
  } catch {
    return String(content);
  }
}

/* ---------------- App (per-room) ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const roomId = room ?? "main";
  const navigate = useNavigate();

  // name persisted
  const [name, setName] = usePersistentState<string>("cc:name", () => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });
  const [editingName, setEditingName] = useState(name);

  // messages persisted per room
  const messagesKey = `cc:messages:${roomId}`;
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(messagesKey, []);

  // participants persisted per room (simple fallback)
  const participantsKey = `cc:participants:${roomId}`;
  const [participants, setParticipants] = usePersistentState<Participant[]>(participantsKey, []);

  // servers (rooms) saved locally
  const [servers, setServers] = usePersistentState<string[]>("cc:servers", () => {
    // default: include current room on first run
    const now = localStorage.getItem("cc:servers");
    if (now) {
      try {
        const parsed = JSON.parse(now) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    return [roomId];
  });

  // socket ref
  const socketRef = useRef<any>(null);

  // attach usePartySocket
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

  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  // presence announce
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
    const hb = window.setInterval(() => sendPresence("online"), 30000);
    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(hb);
      sendPresence("offline");
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, roomId]);

  // scroll on new messages
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

  /* Servers (rooms) management */
  const addServer = () => {
    const id = nanoid(8);
    setServers((prev) => {
      const next = Array.from(new Set([id, ...prev]));
      return next;
    });
    // navigate to new room
    navigate(`/${id}`);
  };

  const removeServer = (id: string) => {
    // don't remove current room (just in case)
    if (id === roomId) return;
    setServers((prev) => prev.filter((s) => s !== id));
  };

  // ensure current room is present in servers list
  useEffect(() => {
    setServers((prev) => (prev.includes(roomId) ? prev : [roomId, ...prev]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* Render */
  return (
    <div style={L.app} className="chat-fullscreen">
      <nav style={L.leftNav}>
        <button
          title="Home"
          onClick={() => navigate("/")}
          style={L.serverButton(false)}
        >
          <FiHome size={18} />
        </button>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {servers.map((s) => {
            const active = s === roomId;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => navigate(`/${s}`)}
                  title={`Room ${s}`}
                  style={L.serverButton(active)}
                >
                  <FiHash size={18} />
                </button>
                {/* small remove button shown for non-active servers */}
                {!active ? (
                  <button
                    onClick={() => removeServer(s)}
                    title="Remove server"
                    style={{ background: "transparent", border: "none", color: "#9aa6b2", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          title="Create new room"
          onClick={addServer}
          style={{ ...L.serverButton(false), marginTop: 8, background: "#2f3136", color: "white" }}
        >
          <FiPlus size={18} />
        </button>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f1f5fb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
            <FiUser />
          </div>
        </div>
      </nav>

      <header style={L.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: L.avatar.background, display: "flex", alignItems: "center", justifyContent: "center", color: L.avatar.color, fontWeight: 700 }}>
            CC
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>ClassConnect</div>
            <div style={{ color: "#6d7790", fontSize: 13 }}>Room: <span style={{ fontWeight: 700 }}>{roomId}</span></div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#6d7790", fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
          <div style={{ width: 1, height: 24, background: "#e6eef8", opacity: 0.9 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              aria-label="Display name"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyName();
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid #dfe8f6`, background: "transparent", color: "#0b1726" }}
            />
            <button onClick={() => applyName()} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}>
              Set
            </button>
          </div>
        </div>
      </header>

      <main style={L.center}>
        <div style={L.messagesPanel}>
          <div id="messages-list" style={L.messagesList} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div style={{ color: "#6d7790", textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
            ) : (
              messages.map((m) => {
                const isMe = m.user === name;
                const text = extractText(m.content);
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
                    <div style={L.avatar} aria-hidden>
                      {initialsFromName(m.user)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={L.authorLine}>{m.user}</div>
                        <div style={L.timeSmall}>
                          {m.role}&nbsp;•&nbsp;{typeof (m as any).created_at === "string" ? new Date((m as any).created_at).toLocaleTimeString() : ""}
                        </div>
                      </div>
                      <div style={isMe ? L.bubbleMe : L.bubbleThem}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
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
            style={L.composer}
          >
            <input name="content" ref={inputRef} style={L.input} placeholder={`Message #${roomId}`} autoComplete="off" />
            <button type="submit" style={L.sendBtn}>Send</button>
          </form>
        </div>
      </main>

      <aside style={L.rightSidebar}>
        <div style={L.participantsTitle}>Participants</div>
        <div style={{ color: "#6d7790", fontSize: 13, marginBottom: 8 }}>{participants.length} total</div>

        <div>
          {participants.length === 0 ? (
            <div style={{ color: "#6d7790" }}>No participants yet</div>
          ) : (
            participants.map((p) => (
              <div
                key={p.user}
                style={{
                  ...L.participantRow,
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
                  <div style={L.avatar}>{initialsFromName(p.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: "#6d7790" }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={L.presenceDot(p.status)} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, color: "#6d7790", fontSize: 13 }}>
          Tip: Click a participant to mention them. Servers (rooms) are saved locally.
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
