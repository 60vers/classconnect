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

/* ---------- Persistent state helper ---------- */
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

/* ---------- Styles (light default) ---------- */
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
    leftNavList: { display: "flex", flexDirection: "column", gap: 8 },
    serverBtnSmall: {
      width: 40,
      height: 40,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#e6eef8",
      color: text,
      cursor: "pointer",
      border: "none",
    },
    serverActive: {
      boxShadow: "0 0 0 3px rgba(88,101,242,0.12)",
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
      // persist normalized form back (best-effort)
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
        // avoid duplicates in case of races
        if (prev.some((p) => p && p.id === item.id)) return prev;
        return [...prev, item];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // local refs
  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);

  // computed styles for current theme
  const S = useMemo(() => styles(theme), [theme]);

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
          // ignore unknown/system messages to avoid noise
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
        JSON.stringify({ type: "presence", user: target, status: "online", id: clientId, lastSeen: new Date().toISOString() }),
      );
    } catch {}
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const removeServer = (id: string) => {
    setServers((prev) => prev.filter((s) => s && s.id !== id));
  };

  const navigateToServer = (id: string) => {
    if (!id) return;
    // ensure persisted
    addServer(id, id.slice(0, 6), id.startsWith("dm--") ? "dm" : "server");
    window.location.pathname = `/${id}`;
  };

  /* ---------- DM utilities ---------- */
  const startDMWith = (p: Participant) => {
    if (!p) return;
    // prefer participant.id if available fallback to sanitized name
    const otherId = p.id ?? `u:${p.user}`;
    const myId = clientId;
    const ids = [myId, otherId].sort();
    const dmId = `dm--${ids.join("--")}`;
    // label the DM with the other user's name
    addServer(dmId, `DM ${p.user}`, "dm");
    navigateToServer(dmId);
  };

  /* ---------- UI helpers ---------- */
  const Sx = S;

  return (
    <div style={styles(theme).app} data-theme={theme} className="chat-fullscreen">
      <nav style={styles(theme).leftNav}>
        <div style={styles(theme).leftNavButton} title="ClassConnect" onClick={() => navigateToServer("home")}>CC</div>

        <div style={{ marginTop: 8, width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={styles(theme).leftNavList}>
            {servers.map((s) => {
              const sid = s?.id ?? "";
              const label = s?.label ?? sid;
              const isActive = sid === roomId;
              return (
                <button
                  key={sid || Math.random().toString(36).slice(2, 9)}
                  title={label ?? sid}
                  onClick={() => sid && navigateToServer(sid)}
                  style={{
                    ...styles(theme).serverBtnSmall,
                    ...(isActive ? styles(theme).serverActive : {}),
                    background: s?.type === "dm" ? "#f1f5ff" : undefined,
                  }}
                >
                  {label ? (label.slice ? label.slice(0, 2) : String(label).slice(0, 2)) : "??"}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center" }}>
          <button
            aria-label="New room"
            onClick={() => {
              const r = nanoid(8);
              addServer(r, r.slice(0, 6), "server");
              navigateToServer(r);
            }}
            style={{ ...styles(theme).leftNavButton, width: 40, height: 40, background: "#2f3136" }}
            title="Create new room"
          >
            +
          </button>

          <button
            aria-label="Add server by id"
            onClick={() => {
              const id = window.prompt("Enter server / room id or URL (room id portion):");
              if (id) {
                // sanitize simple ids
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
              border: "1px solid #eef3fb",
              cursor: "pointer",
            }}
            title="Add server"
          >
            +
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
            <div style={{ color: styles(theme).muted, fontSize: 13 }}>
              Room: <span style={{ fontWeight: 700 }}>{roomId}</span>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: styles(theme).muted, fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
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
            {visibleMessages.length === 0 ? (
              <div style={{ color: styles(theme).muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
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
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={styles(theme).avatar}>{initialsFromName(p.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: styles(theme).muted }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => {
                      // mention in input
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

                  <div style={styles(theme).presenceDot(p.status)} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, color: styles(theme).muted, fontSize: 13 }}>
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
