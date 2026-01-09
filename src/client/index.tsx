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

/**
 * Changes in this version:
 * - Removed "servers" feature entirely (left sidebar is now purely channels list).
 * - Reworked left sidebar to closely match the look requested (rounded white panel,
 *   grouped channels with clear spacing and corner radii).
 * - Added image sending: choose an image file -> read as base64 data URL -> send it in message payload.
 *   Messages that are images are rendered inline (auto-scaled).
 * - Improved duplicate protection:
 *   - New messages from server are ignored if an identical (user+content) message was recently added locally.
 *   - Local optimistic sends are also supported but server messages are the source of truth.
 * - Polished styling: corner radii, colors and spacing approximated from the example images.
 *
 * Notes:
 * - I intentionally kept message persistence and presence features.
 * - For image messages we send the full dataURL (base64). This is simple and works without server changes
 *   if the server simply broadcasts the payload. If you want to avoid sending large base64 strings over the
 *   wire, we can change to upload-to-storage + send URL flow (recommended for production).
 */

/* ---------------- Theme / Styles ---------------- */
type Theme = "light" | "dark";

const LEFT_PANEL_RADIUS = 26; // approximated from reference images
const CARD_RADIUS = 12;
const MAIN_BG = "#f3f4f6"; // page background
const LEFT_PANEL_BG = "#ffffff";
const MUTED = "#9ca3af";
const TEXT = "#111827";
const ACCENT = "#6c5ce7";

const styles = (theme: Theme) => {
  const isDark = theme === "dark";

  return {
    app: {
      width: "100vw",
      height: "100vh",
      display: "grid",
      // left channels | center content | right profile
      gridTemplateColumns: "300px 1fr 340px",
      gridTemplateRows: "72px 1fr",
      gap: 0,
      background: MAIN_BG,
      color: TEXT,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      boxSizing: "border-box" as const,
      overflow: "hidden",
    },

    /* Left channels panel */
    leftPanel: {
      gridColumn: "1 / 2",
      gridRow: "1 / -1",
      background: LEFT_PANEL_BG,
      borderRight: `1px solid rgba(17,24,39,0.04)`,
      padding: "20px 18px",
      boxSizing: "border-box" as const,
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      borderTopLeftRadius: LEFT_PANEL_RADIUS,
      borderBottomLeftRadius: LEFT_PANEL_RADIUS,
      overflowY: "auto" as const,
    },
    brand: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 6 },
    brandLogo: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: "#111827",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: 800,
      fontSize: 14,
    },
    brandTitle: { fontWeight: 800, fontSize: 18 },

    groupLabel: { fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 6 },
    channelRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
    },
    channelRowActive: {
      background: "#f3f4f6",
      borderRadius: 14,
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.02)",
    },
    channelIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f7fb",
      flexShrink: 0,
      fontSize: 14,
    },

    /* header for center content */
    header: {
      gridColumn: "2 / 3",
      gridRow: "1 / 2",
      display: "flex",
      alignItems: "center",
      padding: "18px",
      borderBottom: `1px solid rgba(17,24,39,0.04)`,
      background: "transparent",
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: 800 },

    /* main center area */
    center: {
      gridColumn: "2 / 3",
      gridRow: "2 / -1",
      padding: "20px",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      minHeight: 0,
      overflow: "hidden",
    },
    messagesPanel: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      overflow: "hidden",
      background: "transparent",
    },
    messagesList: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
      padding: "8px 4px",
    },

    /* message styles */
    msgRow: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: "#f3f4f6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      color: "#374151",
      flexShrink: 0,
    },
    bubbleMe: {
      alignSelf: "flex-end",
      background: ACCENT,
      color: "white",
      padding: "10px 14px",
      borderRadius: 16,
      maxWidth: "70%",
      wordBreak: "break-word" as const,
    },
    bubbleThem: {
      alignSelf: "flex-start",
      background: "#fbfbfd",
      color: TEXT,
      padding: "10px 14px",
      borderRadius: 12,
      maxWidth: "70%",
      wordBreak: "break-word" as const,
      border: "1px solid rgba(17,24,39,0.03)",
    },
    metaRow: { display: "flex", alignItems: "baseline", gap: 8 },

    /* composer */
    composerWrap: {
      paddingTop: 12,
      paddingBottom: 12,
      borderTop: `1px solid rgba(17,24,39,0.04)`,
      display: "flex",
      gap: 8,
      alignItems: "center",
      background: "transparent",
    },
    input: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid rgba(17,24,39,0.06)`,
      background: "#ffffff",
      outline: "none",
      fontSize: 14,
    },
    fileButton: {
      padding: "8px",
      borderRadius: 10,
      background: "#fff",
      border: "1px solid rgba(17,24,39,0.06)",
      cursor: "pointer",
    },

    /* right profile panel */
    rightPanel: {
      gridColumn: "3 / 4",
      gridRow: "1 / -1",
      padding: 20,
      background: "#ffffff",
      borderLeft: `1px solid rgba(17,24,39,0.04)`,
      overflow: "auto",
    },

    imagePreview: {
      maxWidth: "360px",
      maxHeight: "360px",
      borderRadius: 10,
      objectFit: "cover" as const,
      display: "block",
    },

    muted: MUTED,
    text: TEXT,
    accent: ACCENT,
    CARD_RADIUS,
  };
};

/* ---------------- Utilities ---------------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- Main App ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const navigate = useNavigate();
  const roomId = room ?? "general";

  // identity
  const [name, setName] = useState(() => {
    try {
      const s = localStorage.getItem("cc:name");
      if (s) return s;
    } catch {}
    const n = names[Math.floor(Math.random() * names.length)];
    try {
      localStorage.setItem("cc:name", n);
    } catch {}
    return n;
  });
  const [editingName, setEditingName] = useState(name);

  // client id (kept for presence)
  const [clientId] = useState(() => {
    try {
      const v = localStorage.getItem("cc:clientId");
      if (v) return v;
    } catch {}
    const id = nanoid(8);
    try {
      localStorage.setItem("cc:clientId", id);
    } catch {}
    return id;
  });

  const theme: Theme = "light";

  // messages persisted per channel
  const messagesKey = `cc:messages:${roomId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(messagesKey);
      if (raw) return JSON.parse(raw) as ChatMessage[];
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(messagesKey, JSON.stringify(messages));
    } catch {}
  }, [messagesKey, messages]);

  // participants persisted per channel
  const participantsKey = `cc:participants:${roomId}`;
  const [participants, setParticipants] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem(participantsKey);
      if (raw) return JSON.parse(raw) as any[];
    } catch {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(participantsKey, JSON.stringify(participants));
    } catch {}
  }, [participantsKey, participants]);

  // socket & refs
  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const S = useMemo(() => styles(theme), [theme]);

  // dedupe helper: avoid adding server message if identical message recently added locally
  const isDuplicate = useCallback(
    (incoming: { id?: string; content?: string; user?: string }) => {
      if (!incoming) return false;
      // direct id check
      if (incoming.id && messages.some((m) => m.id === incoming.id)) return true;
      // loose content/user/time dedupe (helps when server returns different ids)
      if (incoming.content && incoming.user) {
        const now = Date.now();
        for (let i = messages.length - 1; i >= 0 && i >= messages.length - 40; i--) {
          const m = messages[i] as any;
          try {
            if (m.user === incoming.user && m.content === incoming.content) {
              // if that local message was created within last 10s, treat as duplicate
              const createdAt = (m as any).createdAt || 0;
              if (now - createdAt < 10000) return true;
            }
          } catch {}
        }
      }
      return false;
    },
    [messages],
  );

  // add message from server (safe)
  const addMessageFromServer = useCallback(
    (m: ChatMessage) => {
      if (!m || !m.id) return;
      if (isDuplicate({ id: m.id, content: m.content, user: m.user })) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    },
    [isDuplicate],
  );

  // handle incoming socket messages
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
            role: msg.role ?? "user",
            // try to preserve server timestamp if it sends one
            ...(msg.created_at ? { created_at: msg.created_at } : {}),
            // local helper
            createdAt: Date.now(),
          } as any;
          addMessageFromServer(newMsg);
        } else if (msg.type === "update") {
          setMessages((prev) => prev.map((x) => (x.id === msg.id ? { ...x, content: msg.content, user: msg.user } : x)));
        } else if (msg.type === "presence") {
          const p = { user: msg.user, status: msg.status || "online", lastSeen: msg.lastSeen, id: msg.id };
          setParticipants((prev) => {
            const idx = prev.findIndex((q) => q.user === p.user);
            if (idx === -1) return [...prev, p];
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], ...p };
            return copy;
          });
        } else if (msg.type === "participants") {
          const list = Array.isArray((msg as any).participants) ? (msg as any).participants : [];
          setParticipants(list);
        } else {
          // ignore unknown/system messages
        }
      } catch (err) {
        console.warn("Failed to parse incoming message", err);
      }
    },
    [addMessageFromServer],
  );

  // attach socket via partySocket hook
  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
  });

  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  // presence heartbeat
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
        const idx = prev.findIndex((p) => p.user === name);
        const p = { user: name, status, lastSeen: payload.lastSeen, id: payload.id };
        if (idx === -1) return [...prev, p];
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], ...p };
        return copy;
      });
    };

    sendPresence("online");
    heartbeatRef.current = window.setInterval(() => sendPresence("online"), 30000);

    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sendPresence("offline");
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, roomId, clientId]);

  // scroll on new messages
  useEffect(() => {
    const el = document.getElementById("messages-list");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  // send text message or image
  const sendChat = useCallback(async (opts: { text?: string; imageDataUrl?: string }) => {
    const { text = "", imageDataUrl } = opts;
    if (!text.trim() && !imageDataUrl) return;

    // client generates an id so we can reference it if needed
    const id = nanoid(12);
    const payload: any = {
      type: "add",
      id,
      user: name,
      role: "user",
    };
    if (imageDataUrl) {
      payload.content = imageDataUrl; // data:image/...
      payload.kind = "image";
    } else {
      payload.content = text;
      payload.kind = "text";
    }

    // optimistic local add with timestamp (will be deduped if server repeats)
    const optimistic: any = {
      id,
      content: payload.content,
      user: name,
      role: "user",
      kind: payload.kind,
      createdAt: Date.now(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      socketRef.current?.send(JSON.stringify(payload));
    } catch (err) {
      console.warn("send failed", err);
    }
  }, [name]);

  // image file input handler
  const onSelectFile = useCallback((file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:...;base64,...
      sendChat({ imageDataUrl: result });
    };
    reader.onerror = (err) => {
      console.warn("failed reading file", err);
    };
    reader.readAsDataURL(file);
  }, [sendChat]);

  // handle paste of images (optional)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) onSelectFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onSelectFile]);

  // name apply
  const applyName = () => {
    const target = (editingName || name).trim() || name;
    setName(target);
    try {
      localStorage.setItem("cc:name", target);
    } catch {}
    try {
      socketRef.current?.send(JSON.stringify({ type: "presence", user: target, status: "online", id: clientId, lastSeen: new Date().toISOString() }));
    } catch {}
  };

  // channels list: example channels; each list item is a channel
  const CHANNELS = [
    { id: "paid-opportunities", label: "paid-opportunities", emoji: "💼" },
    { id: "for-hire", label: "for-hire", emoji: "🚀" },
    { id: "introductions", label: "introductions", emoji: "🌱" },
    { id: "general", label: "general", emoji: "👀" },
    { id: "design-discussions", label: "design-discussions", emoji: "🎨", badge: "3 New" },
    { id: "professionals-hangout", label: "professionals-hangout", emoji: "💎" },
    { id: "support-group", label: "support-group", emoji: "💖" },
    { id: "design-challenges", label: "design-challenges", emoji: "🐰" },
    { id: "ask-professionals", label: "ask-professionals", emoji: "👋" },
    { id: "career-questions", label: "career-questions", emoji: "🏢" },
  ];

  /* ---------------- Render ---------------- */
  return (
    <div style={S.app} data-theme={theme} className="chat-fullscreen">
      {/* Left channels panel */}
      <aside style={S.leftPanel}>
        <div style={S.brand}>
          <div style={S.brandLogo}>DB</div>
          <div style={S.brandTitle}>Design Buddies</div>
        </div>

        <div>
          <div style={S.groupLabel}>Job Search</div>
          {CHANNELS.filter(c => ["paid-opportunities", "for-hire"].includes(c.id)).map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/${c.id}`)}
              style={{ ...S.channelRow, ...(roomId === c.id ? S.channelRowActive : {}) }}
            >
              <div style={S.channelIcon}>{c.emoji}</div>
              <div style={{ fontWeight: 700 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={S.groupLabel}>General Discussion</div>
          {CHANNELS.filter(c => ["introductions","general","design-discussions","professionals-hangout","support-group"].includes(c.id)).map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/${c.id}`)}
              style={{ ...S.channelRow, ...(roomId === c.id ? S.channelRowActive : {}) }}
            >
              <div style={S.channelIcon}>{c.emoji}</div>
              <div style={{ fontWeight: roomId === c.id ? 700 : 400 }}>{c.label}</div>
              {c.badge ? <div style={{ marginLeft: "auto", color: S.muted, fontSize: 12 }}>{c.badge}</div> : null}
            </div>
          ))}
        </div>

        <div>
          <div style={S.groupLabel}>Design Buddies Events</div>
          {CHANNELS.filter(c => c.id === "design-challenges").map(c => (
            <div key={c.id} onClick={() => navigate(`/${c.id}`)} style={{ ...S.channelRow, ...(roomId === c.id ? S.channelRowActive : {}) }}>
              <div style={S.channelIcon}>{c.emoji}</div>
              <div>{c.label}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={S.groupLabel}>Ask For Help</div>
          {CHANNELS.filter(c => ["ask-professionals","career-questions"].includes(c.id)).map(c => (
            <div key={c.id} onClick={() => navigate(`/${c.id}`)} style={{ ...S.channelRow, ...(roomId === c.id ? S.channelRowActive : {}) }}>
              <div style={S.channelIcon}>{c.emoji}</div>
              <div style={{ fontWeight: roomId === c.id ? 700 : 400 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", fontSize: 13, color: S.muted }}>
          curated by Mobbin
        </div>
      </aside>

      {/* Header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>CC</div>
          <div>
            <div style={S.headerTitle}>#{roomId}</div>
            <div style={{ color: S.muted, fontSize: 13 }}>Channel</div>
          </div>
        </div>
      </header>

      {/* Center content (messages) */}
      <main style={S.center}>
        <div style={S.messagesPanel}>
          <div id="messages-list" style={S.messagesList} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div style={{ color: S.muted, textAlign: "center", padding: 20 }}>No messages yet — say hello 👋</div>
            ) : (
              messages.map((m: any) => {
                const isMe = m.user === name;
                return (
                  <div key={m.id} style={{ ...S.msgRow, flexDirection: isMe ? "row-reverse" as const : "row" as const }}>
                    <div style={S.avatar} aria-hidden>{initialsFromName(m.user)}</div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                      <div style={S.metaRow}>
                        <div style={{ fontWeight: 700 }}>{m.user}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{m.role || "user"}</div>
                      </div>

                      <div style={isMe ? S.bubbleMe : S.bubbleThem}>
                        {/* If content is an image data URL, render it */}
                        {typeof m.content === "string" && m.content.startsWith("data:image/") ? (
                          // eslint-disable-next-line jsx-a11y/img-redundant-alt
                          <img src={m.content} alt="image" style={S.imagePreview} />
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                        )}
                        {/* small pending indicator for optimistic messages */}
                        {m.pending ? <div style={{ fontSize: 11, color: S.muted, marginTop: 8 }}>Sending…</div> : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* composer: text + file input */}
          <div style={S.composerWrap}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const input = form.elements.namedItem("content") as HTMLInputElement | null;
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;
                sendChat({ text });
                input.value = "";
                input.focus();
              }}
              style={{ display: "flex", gap: 8, width: "100%" }}
            >
              <input name="content" ref={inputRef} style={S.input} placeholder={`Message #${roomId}`} autoComplete="off" />
              <button
                type="button"
                style={S.fileButton}
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (f) onSelectFile(f);
                }}
              />
            </form>
          </div>
        </div>
      </main>

      {/* Right profile */}
      <aside style={S.rightPanel}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{initialsFromName(name)}</div>
          <div>
            <div style={{ fontWeight: 800 }}>{name}</div>
            <div style={{ color: S.muted, fontSize: 13 }}>{participants.filter((p) => p.status === "online").length} online</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(17,24,39,0.04)", paddingTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Details</div>
          <div style={{ color: S.muted, fontSize: 13 }}>Channel details and notes can go here.</div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Display name</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(17,24,39,0.06)" }} />
              <button onClick={applyName} style={{ padding: "8px 10px", borderRadius: 8, background: ACCENT, color: "white", border: "none", cursor: "pointer" }}>Set</button>
            </div>
          </div>
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
      <Route path="/" element={<Navigate to="/general" />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/general" />} />
    </Routes>
  </BrowserRouter>,
);
