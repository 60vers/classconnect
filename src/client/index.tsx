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

import { names, type ChatMessage, type Message } from "../shared";

/* ---------- Types ---------- */
type Theme = "light" | "dark";

type ServerItem = {
  id: string; // room id
  label?: string;
  type?: "server" | "dm";
};

type Participant = {
  user: string;
  status: "online" | "offline";
  lastSeen?: string;
  id?: string;
};

/* ---------- Persistent state helper (defensive) ---------- */
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

/* ---------- Styles (light default, Discord-like layout) ---------- */
const styles = (theme: Theme) => {
  const isDark = theme === "dark";
  const bg = isDark ? "#0f1720" : "#f5f6f8";
  const surface = isDark ? "#0b1220" : "#ffffff";
  const panel = isDark ? "#07101a" : "#ffffff";
  const text = isDark ? "#e6eef8" : "#111827";
  const muted = isDark ? "#9aa6b2" : "#6b7280";
  const accent = "#6c5ce7"; // purple-ish discord-like
  const messageMeBg = accent;
  const messageThemBg = isDark ? "#0e1720" : "#f3f4f6";

  return {
    app: {
      width: "100vw",
      height: "100vh",
      display: "grid",
      // left nav | conversations | messages | right panel
      gridTemplateColumns: "72px 300px 1fr 320px",
      gridTemplateRows: "64px 1fr",
      boxSizing: "border-box" as const,
      background: bg,
      color: text,
      gap: 0,
      overflow: "hidden",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    },
    leftNav: {
      gridColumn: "1 / 2",
      gridRow: "1 / -1",
      background: isDark ? "#071025" : "#fff",
      borderRight: `1px solid ${isDark ? "#0b1722" : "#e6e9ef"}`,
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
      boxShadow: "0 6px 16px rgba(108,92,231,0.12)",
    },
    convColumn: {
      gridColumn: "2 / 3",
      gridRow: "1 / -1",
      borderRight: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      background: isDark ? "#05121a" : "#fbfdff",
      padding: "12px",
      overflow: "auto",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
    },
    convHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    convList: { display: "flex", flexDirection: "column" as const, gap: 8, overflow: "auto" },
    convRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px",
      borderRadius: 10,
      cursor: "pointer",
    },
    convRowActive: {
      background: "rgba(108,92,231,0.06)",
    },
    convAvatar: {
      width: 40,
      height: 40,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      color: "white",
      background: "#9b8cff",
      flexShrink: 0,
    },

    header: {
      gridColumn: "3 / 4",
      gridRow: "1 / 2",
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      background: panel,
      gap: 12,
      zIndex: 20,
    },
    headerTitle: { fontSize: 16, fontWeight: 700 as const },

    center: {
      gridColumn: "3 / 4",
      gridRow: "2 / -1",
      padding: "16px",
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
      borderRadius: 12,
      boxShadow: "inset 0 1px 0 rgba(16,24,39,0.02)",
      minHeight: 0,
      overflow: "hidden",
      padding: 12,
    },
    messagesList: {
      flex: 1,
      overflow: "auto",
      padding: "8px 12px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
    },
    composer: {
      borderTop: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      padding: 12,
      display: "flex",
      gap: 8,
      alignItems: "center",
      background: "transparent",
    },
    input: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 14,
      border: `2px solid rgba(108,92,231,0.18)`,
      background: "#fff",
      color: text,
      outline: "none",
      boxShadow: "none",
    },
    sendBtn: {
      background: messageMeBg,
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      cursor: "pointer",
    },
    rightSidebar: {
      gridColumn: "4 / 5",
      gridRow: "1 / -1",
      padding: 20,
      background: "#fff",
      borderLeft: `1px solid ${isDark ? "#071622" : "#eef2f7"}`,
      overflow: "auto",
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 999,
      background: "#ddd",
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
      padding: "12px 14px",
      borderRadius: 16,
      maxWidth: "72%",
      wordBreak: "break-word" as const,
      boxShadow: "0 6px 18px rgba(108,92,231,0.08)",
    },
    bubbleThem: {
      alignSelf: "flex-start",
      background: messageThemBg,
      color: text,
      padding: "10px 14px",
      borderRadius: 12,
      maxWidth: "72%",
      wordBreak: "break-word" as const,
      border: "1px solid #eef2f7",
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
  const navigate = useNavigate();
  const roomId = room ?? "main";

  // persistent client id (used for deterministic DM ids)
  const [clientId] = usePersistentState<string>("cc:clientId", () => nanoid(8));

  // name persisted
  const [name, setName] = usePersistentState<string>("cc:name", () => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });
  const [editingName, setEditingName] = useState(name);

  // theme: fixed to light
  const theme: Theme = "light";

  // messages persisted per room
  const messagesKey = `cc:messages:${roomId}`;
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(messagesKey, []);

  // participants persisted per room (simple fallback)
  const participantsKey = `cc:participants:${roomId}`;
  const [participants, setParticipants] = usePersistentState<Participant[]>(participantsKey, []);

  // servers persisted (list of objects). Migrate & sanitize any malformed entries.
  const [servers, setServers] = usePersistentState<ServerItem[]>("cc:servers", () => {
    try {
      const raw = localStorage.getItem("cc:servers");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [];
      const normalized = arr
        .map((item: any) => {
          if (!item) return null;
          if (typeof item === "string") {
            const id = item.trim();
            if (!id) return null;
            return { id, label: id.slice(0, 6), type: id.startsWith("dm--") ? "dm" : "server" } as ServerItem;
          }
          if (typeof item === "object") {
            const id = item.id ?? (typeof item.label === "string" ? item.label : null);
            if (!id) return null;
            const sid = String(id);
            return { id: sid, label: item.label ?? sid.slice(0, 6), type: item.type === "dm" ? "dm" : "server" } as ServerItem;
          }
          return null;
        })
        .filter(Boolean) as ServerItem[];
      try {
        localStorage.setItem("cc:servers", JSON.stringify(normalized));
      } catch {}
      return normalized;
    } catch {
      return [];
    }
  });

  // ensure current room is in servers list (defensive)
  useEffect(() => {
    if (!roomId) return;
    const found = servers.find((s) => s && s.id === roomId);
    if (!found) {
      const item: ServerItem = {
        id: roomId,
        label: roomId.startsWith("dm--") ? `DM ${roomId.slice(4, 10)}` : String(roomId).slice(0, 6),
        type: roomId.startsWith("dm--") ? "dm" : "server",
      };
      setServers((prev) => {
        if (prev.some((p) => p && p.id === item.id)) return prev;
        return [...prev, item];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // local refs
  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // computed styles for current theme
  const S = useMemo(() => styles(theme), [theme]);

  // helper: safely add message (dedupe by id)
  const addMessage = useCallback((m: ChatMessage) => {
    if (!m || !m.id) return;
    setMessages((prev) => {
      if (prev.some((x) => x.id === m.id)) return prev;
      return [...prev, m];
    });
  }, [setMessages]);

  // helper: update message (replace by id)
  const updateMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }, [setMessages]);

  // visible messages: filter out system
  const visibleMessages = useMemo(() => messages.filter((m) => m.role !== "system"), [messages]);

  // handle incoming messages
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
          addMessage(newMsg);
        } else if (msg.type === "update") {
          const updated: ChatMessage = {
            id: msg.id,
            content: msg.content,
            user: msg.user,
            role: msg.role,
          };
          updateMessage(updated);
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
          // ignore unknown/system messages to avoid noise
        }
      } catch (err) {
        console.warn("Failed to parse incoming message", err);
      }
    },
    [addMessage, updateMessage, setParticipants],
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
        id: clientId,
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
  }, [name, roomId, clientId]);

  // scroll to bottom on new visible messages
  useEffect(() => {
    const el = document.getElementById("messages-list");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [visibleMessages]);

  // send chat (optimistic + dedupe based on id)
  const sendChat = (content: string) => {
    if (!content.trim()) return;
    const chatMessage: ChatMessage = {
      id: nanoid(12),
      content,
      user: name,
      role: "user",
    };
    // optimistic add (dedupe prevents duplicate when server echo arrives)
    addMessage(chatMessage);
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
        JSON.stringify({ type: "presence", user: target, status: "online", id: clientId, lastSeen: new Date().toISOString() }),
      );
    } catch {}
  };

  /* ---------- Server management ---------- */
  const addServer = (id: string, label?: string, type: ServerItem["type"] = "server") => {
    if (!id) return;
    const sid = String(id);
    setServers((prev) => {
      if (prev.some((s) => s && s.id === sid)) return prev;
      const item: ServerItem = { id: sid, label: label ?? sid.slice(0, 6), type };
      return [...prev, item];
    });
  };

  const navigateToServer = (id: string) => {
    if (!id) return;
    addServer(id, id.slice(0, 6), id.startsWith("dm--") ? "dm" : "server");
    window.location.pathname = `/${id}`;
  };

  /* ---------- DM utilities ---------- */
  const startDMWith = (p: Participant) => {
    if (!p) return;
    const otherId = p.id ?? `u:${p.user}`;
    const myId = clientId;
    const ids = [myId, otherId].sort();
    const dmId = `dm--${ids.join("--")}`;
    addServer(dmId, `DM ${p.user}`, "dm");
    navigateToServer(dmId);
  };

  /* ---------- Derived conversations (servers) ---------- */
  const conversations = useMemo(() => {
    return servers.map((s) => ({
      ...s,
      label: s?.label ?? (s?.id ? String(s.id).slice(0, 6) : "??"),
    }));
  }, [servers]);

  /* ---------- Render ---------- */
  return (
    <div style={S.app} data-theme={theme} className="chat-fullscreen">
      {/* Left nav */}
      <nav style={S.leftNav}>
        <div style={S.leftNavButton} title="ClassConnect" onClick={() => navigateToServer("home")}>CC</div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center" }}>
          <button
            aria-label="New room"
            onClick={() => {
              const r = nanoid(8);
              addServer(r, r.slice(0, 6), "server");
              navigateToServer(r);
            }}
            style={{ ...S.leftNavButton, width: 40, height: 40, background: "#2f3136" }}
            title="Create new room"
          >
            +
          </button>

          <button
            aria-label="Add server by id"
            onClick={() => {
              const id = window.prompt("Enter server / room id or URL (room id portion):");
              if (id) {
                const sanitized = id.trim();
                if (!sanitized) return;
                addServer(sanitized, sanitized.slice(0, 6), sanitized.startsWith("dm--") ? "dm" : "server");
                navigateToServer(sanitized);
              }
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              marginTop: 6,
              background: "#ffffff",
              border: "1px solid #eef2f7",
              cursor: "pointer",
            }}
            title="Add server"
          >
            +
          </button>
        </div>
      </nav>

      {/* Conversations column */}
      <aside style={S.convColumn}>
        <div style={S.convHeader}>
          <div style={{ fontWeight: 700 }}>Conversations</div>
          <div style={{ color: S.muted, fontSize: 13 }}>{conversations.length}</div>
        </div>

        <div style={S.convList}>
          {conversations.map((c) => {
            const isActive = c.id === roomId;
            const label = c.label ?? c.id;
            return (
              <div
                key={c.id}
                onClick={() => navigateToServer(c.id)}
                style={{
                  ...S.convRow,
                  ...(isActive ? S.convRowActive : {}),
                }}
              >
                <div style={S.convAvatar} aria-hidden>
                  {initialsFromName(String(label))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>Tap to open</div>
                </div>
                <div style={{ fontSize: 11, color: S.muted }}>•</div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Header for messages */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={S.avatar}>CC</div>
          <div>
            <div style={S.headerTitle}>ClassConnect</div>
            <div style={{ color: S.muted, fontSize: 13 }}>
              Room: <span style={{ fontWeight: 700 }}>{roomId}</span>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: S.muted, fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
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

      {/* Center messages */}
      <main style={S.center}>
        <div style={S.messagesPanel}>
          <div id="messages-list" style={S.messagesList} role="log" aria-live="polite">
            {visibleMessages.length === 0 ? (
              <div style={{ color: S.muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
            ) : (
              visibleMessages.map((m) => {
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
                    <div style={{ ...S.avatar, width: 40, height: 40, borderRadius: 10 }} aria-hidden>
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
            <input
              name="content"
              ref={inputRef}
              style={S.input}
              placeholder={`Message #${roomId}`}
              autoComplete="off"
            />
            <button type="submit" style={S.sendBtn}>Send</button>
          </form>
        </div>
      </main>

      {/* Right participant / profile */}
      <aside style={S.rightSidebar}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div style={S.avatar}>{initialsFromName(name)}</div>
          <div>
            <div style={{ fontWeight: 800 }}>{name}</div>
            <div style={{ color: S.muted, fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
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
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ ...S.avatar, width: 40, height: 40, borderRadius: 10 }}>{initialsFromName(p.user)}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ fontWeight: 700 }}>{p.user}</div>
                      <div style={{ fontSize: 12, color: S.muted }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => {
                        const el = inputRef.current;
                        if (el) {
                          el.focus();
                          el.value = `@${p.user} `;
                        }
                      }}
                      style={{ padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}
                      title="Mention"
                    >
                      @
                    </button>

                    <button
                      onClick={() => startDMWith(p)}
                      style={{ padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}
                      title="Start DM"
                    >
                      DM
                    </button>

                    <div style={S.presenceDot(p.status)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, color: S.muted, fontSize: 13 }}>
          Tip: Click a participant to mention them or start a DM. Servers and DMs are saved locally.
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
