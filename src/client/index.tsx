import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/**
 * Minimalist fullscreen chat with:
 * - center messages
 * - bottom-centered, polished input UI (based on user's component)
 * - presence support (presence messages sent/received; green dot next to online participants)
 * - image sending (base64 data URLs) via file picker / paste
 * - optimistic sends + reconciliation with server echoes
 * - mention notifications (in-app badge + optional browser Notification)
 *
 * Single-file index.tsx as requested.
 */

/* -------------------- Styled Input (adapted from user) -------------------- */
type InputProps = {
  onSendText: (text: string) => void;
  onSendFile: (file: File) => void;
  placeholder?: string;
};

const StyledWrapper = styled.div`
  .container-ia-chat {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 560px;
    margin: 0 auto;
  }

  .container-upload-files {
    position: absolute;
    left: 12px;
    display: flex;
    color: #aaaaaa;
    transition: all 0.5s;
    pointer-events: none;
  }

  .container-upload-files .upload-file {
    margin: 0 6px;
    padding: 2px;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: auto;
  }

  .input-text {
    width: 100%;
    padding: 12px 48px 12px 120px;
    border-radius: 999px;
    border: none;
    outline: none;
    background-color: #f1f3f5;
    color: #111827;
    font-size: 14px;
    line-height: 18px;
    font-weight: 500;
    transition: all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.05);
    box-shadow: 0 6px 18px rgba(16, 24, 40, 0.04);
  }

  .input-text::placeholder {
    color: #9aa0a6;
  }

  .label-files,
  .label-voice {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid rgba(16, 24, 40, 0.04);
    cursor: pointer;
  }

  .label-files {
    left: 12px;
  }

  .label-voice {
    right: 12px;
  }

  .ai {
    display: none; /* keep visual complexity out for minimalism */
  }

  .file-input {
    display: none;
  }
`;

/* Input component (uses file input internally) */
function InputBar({ onSendText, onSendFile, placeholder = "Ask Anything..." }: InputProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // allow paste->image
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) onSendFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onSendFile]);

  return (
    <StyledWrapper>
      <div className="container-ia-chat" aria-hidden={false}>
        {/* left file icons (informational) */}
        <div className="container-upload-files" aria-hidden>
          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={13} r={3} />
              <path d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.4 4.4 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697s0-4.597-.749-5.697a4.4 4.4 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.4 4.4 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364s0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21Z" />
            </g>
          </svg>

          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <rect width={18} height={18} x={3} y={3} rx={2} ry={2} />
              <circle cx={9} cy={9} r={2} />
              <path d="m21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </g>
          </svg>
        </div>

        {/* hidden file input */}
        <input
          ref={fileRef}
          className="file-input"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) onSendFile(f);
          }}
        />

        {/* visible input */}
        <input
          ref={inputRef}
          className="input-text"
          type="text"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) {
                onSendText(v);
                (e.target as HTMLInputElement).value = "";
              }
            }
          }}
        />

        <label
          className="label-files"
          onClick={() => {
            fileRef.current?.click();
          }}
          title="Attach image"
          aria-label="Attach image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
          </svg>
        </label>

        <label className="label-voice" title="Send/Cancel voice (not implemented)">
          <svg className="icon-voice" xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10m12-6v2M4 11v2" />
          </svg>
        </label>
      </div>
    </StyledWrapper>
  );
}

/* -------------------- App -------------------- */

type Participant = {
  user: string;
  id?: string;
  status: "online" | "offline";
  lastSeen?: string;
};

function useLocalName() {
  const [name, setName] = useState(() => {
    try {
      const v = localStorage.getItem("cc:name");
      if (v) return v;
    } catch {}
    const n = names[Math.floor(Math.random() * names.length)];
    try {
      localStorage.setItem("cc:name", n);
    } catch {}
    return n;
  });
  return [name, setName] as const;
}

function AppInner() {
  const { room } = useParams<{ room: string }>();
  const navigate = useNavigate();
  const roomId = room ?? "general";

  const [name, setName] = useLocalName();
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [focused, setFocused] = useState(true);

  // pending queue & socket refs
  const socketRef = useRef<any>(null);
  const pendingQueueRef = useRef<Map<string, any>>(new Map());

  // load cached messages for this room
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cc:messages:${roomId}`);
      if (raw) setMessages(JSON.parse(raw));
      else setMessages([]);
    } catch {
      setMessages([]);
    }
    try {
      const rawP = localStorage.getItem(`cc:participants:${roomId}`);
      if (rawP) setParticipants(JSON.parse(rawP));
      else setParticipants([]);
    } catch {
      setParticipants([]);
    }
  }, [roomId]);

  // persist messages & participants
  useEffect(() => {
    try {
      localStorage.setItem(`cc:messages:${roomId}`, JSON.stringify(messages.slice(-300)));
    } catch {}
  }, [messages, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`cc:participants:${roomId}`, JSON.stringify(participants));
    } catch {}
  }, [participants, roomId]);

  // helper: reconcile server message with optimistic
  const reconcileServerMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      // if same id exists, update
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], ...msg, pending: false };
        pendingQueueRef.current.delete(msg.id);
        return copy;
      }

      // match by user+content recent optimistic
      for (let i = prev.length - 1; i >= Math.max(0, prev.length - 40); i--) {
        const m = prev[i] as any;
        if (m.pending && m.user === msg.user && m.content === msg.content) {
          const copy = prev.slice();
          copy[i] = { ...m, ...msg, pending: false };
          pendingQueueRef.current.delete(m.id);
          return copy;
        }
      }

      // append if no match
      pendingQueueRef.current.delete(msg.id);
      return [...prev, { ...msg, pending: false }];
    });
  }, []);

  // message incoming handler
  const handleIncoming = useCallback(
    (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data as string) as Message;
        if (!data || typeof data !== "object") return;

        if (data.type === "presence") {
          // presence messages: update participants
          const p: Participant = { user: data.user, id: data.id ?? data.user, status: data.status ?? "online", lastSeen: data.lastSeen };
          setParticipants((prev) => {
            const idx = prev.findIndex((x) => x.user === p.user);
            if (idx === -1) return [...prev, p];
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], ...p };
            return copy;
          });
          return;
        }

        if (data.type === "participants") {
          const list = Array.isArray((data as any).participants) ? (data as any).participants : [];
          setParticipants(list.map((p: any) => ({ user: p.user, id: p.id, status: p.status ?? "online", lastSeen: p.lastSeen })));
          return;
        }

        if (data.type === "add") {
          const msg = data as Message & { id: string; content: string; user: string; created_at?: string };
          reconcileServerMessage(msg);

          // notifications: if message mentions current user, mark and optionally show browser notification
          const mention = typeof msg.content === "string" && msg.content.includes(`@${name}`);
          if (!focused || mention) {
            setUnreadCount((n) => n + 1);
            // try browser notification when permission allowed
            if (mention && "Notification" in window && Notification.permission === "granted") {
              new Notification(`Mention from ${msg.user}`, { body: msg.content.slice(0, 120) });
            }
          }
          return;
        }
      } catch (err) {
        console.warn("handleIncoming parse error", err);
      }
    },
    [name, reconcileServerMessage, focused],
  );

  // wire socket via party hook, re-created on room change
  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage: handleIncoming,
    onOpen() {
      // flush pending queue
      pendingQueueRef.current.forEach((payload) => {
        try {
          socketRef.current?.send(JSON.stringify(payload));
        } catch {}
      });
      // announce presence on open
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "online", id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
    },
    onClose() {
      // best-effort presence leave will be sent on unload
    },
  });

  useEffect(() => {
    socketRef.current = partySocket;
  }, [partySocket]);

  // presence heartbeat and unload
  useEffect(() => {
    const sendPresence = (status: "online" | "offline") => {
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status, id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
      setParticipants((prev) => {
        const idx = prev.findIndex((p) => p.user === name);
        const p: Participant = { user: name, id: clientId, status, lastSeen: new Date().toISOString() };
        if (idx === -1) return [...prev, p];
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], ...p };
        return copy;
      });
    };
    sendPresence("online");
    const hb = window.setInterval(() => sendPresence("online"), 30000);
    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(hb);
      try {
        socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "offline", id: clientId, lastSeen: new Date().toISOString() }));
      } catch {}
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [name, clientId]);

  // focus / visibility tracking (to compute unread)
  useEffect(() => {
    const onFocus = () => {
      setFocused(true);
      setUnreadCount(0);
    };
    const onBlur = () => setFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // send payload helper (queue + immediate attempt)
  const sendPayload = useCallback((payload: any) => {
    // ensure id
    if (!payload.id) payload.id = nanoid(12);
    pendingQueueRef.current.set(payload.id, payload);
    try {
      socketRef.current?.send(JSON.stringify(payload));
    } catch {
      // will be retried when socket opens
    }
    // optimistic add
    setMessages((prev) => [...prev, { ...payload, pending: true } as any]);
  }, []);

  // public sendText/sendFile handlers
  const sendText = useCallback((text: string) => {
    const payload: any = {
      type: "add",
      id: nanoid(12),
      content: text,
      user: name,
      role: "user",
      created_at: new Date().toISOString(),
    };
    sendPayload(payload);
  }, [name, sendPayload]);

  const sendFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const payload: any = {
        type: "add",
        id: nanoid(12),
        content: dataUrl,
        user: name,
        role: "user",
        kind: "image",
        created_at: new Date().toISOString(),
      };
      sendPayload(payload);
    };
    reader.onerror = () => {
      console.warn("file read error");
    };
    reader.readAsDataURL(file);
  }, [name, sendPayload]);

  // simple channels list (minimal)
  const CHANNELS = useMemo(() => ["general", "design-discussions", "support-group", "for-hire"], []);

  // ensure navigation to room on click
  const goto = useCallback((r: string) => navigate(`/${r}`), [navigate]);

  // request notification permission on mount (optional)
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /* ---------------- Render ---------------- */
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "grid",
      gridTemplateColumns: "84px 1fr 300px",
      gridTemplateRows: "1fr",
      background: "#fafbfd",
      boxSizing: "border-box",
      overflow: "hidden",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
    }}>
      {/* left minimal channels */}
      <nav style={{ borderRight: "1px solid rgba(16,24,40,0.04)", padding: 12, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>DB</div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          {CHANNELS.map((c) => (
            <button key={c} onClick={() => goto(c)} style={{ width: 44, height: 44, borderRadius: 10, background: c === roomId ? "#f1f3f5" : "transparent", border: "none", cursor: "pointer" }}>
              <div style={{ fontSize: 12, color: c === roomId ? "#111827" : "#9aa0a6" }}>#{c.slice(0,2)}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e9eefb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => goto("general")}>🏠</div>
        </div>
      </nav>

      {/* center messages */}
      <main style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 24, gap: 12, overflow: "hidden" }}>
        {/* header minimal */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>#{roomId}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {unreadCount > 0 && <div style={{ background: "#ff4d6d", color: "white", padding: "4px 8px", borderRadius: 12, fontSize: 12 }}>{unreadCount} new</div>}
            <div style={{ fontSize: 13, color: "#6b7280" }}>{participants.filter(p => p.status === "online").length} online</div>
          </div>
        </div>

        {/* messages container */}
        <div id="messages-list" style={{ flex: 1, overflow: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m: any) => {
            const isMe = m.user === name;
            const isImage = typeof m.content === "string" && m.content.startsWith("data:image/");
            const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : (m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "");
            const mentionMe = typeof m.content === "string" && m.content.includes(`@${name}`);
            return (
              <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: isMe ? "row-reverse" as const : "row" as const }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontWeight: 700 }}>
                  {initialsFromName(m.user)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" as const : "flex-start" as const, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 700 }}>{m.user}</div>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>{time}</div>
                    {mentionMe && <div style={{ background: "#fffbeb", color: "#b45309", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>mentioned you</div>}
                  </div>

                  <div style={{
                    background: isMe ? "#6c5ce7" : "#ffffff",
                    color: isMe ? "white" : "#111827",
                    padding: "10px 14px",
                    borderRadius: 14,
                    maxWidth: "80%",
                    boxShadow: isMe ? "0 8px 20px rgba(108,92,231,0.08)" : "0 6px 12px rgba(16,24,40,0.04)",
                    border: isMe ? "none" : "1px solid rgba(16,24,40,0.03)",
                  }}>
                    {isImage ? <img src={m.content} alt="attachment" style={{ maxWidth: 420, borderRadius: 8 }} /> : <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
                    {m.pending ? <div style={{ fontSize: 12, color: "#9aa0a6", marginTop: 8 }}>Sending…</div> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom centered input (fixed within center column) */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
          <div style={{ width: 560 }}>
            <InputBar onSendText={sendText} onSendFile={sendFile} placeholder={`Message #${roomId}`} />
          </div>
        </div>
      </main>

      {/* right participants */}
      <aside style={{ borderLeft: "1px solid rgba(16,24,40,0.04)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Participants</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {participants.length === 0 ? <div style={{ color: "#9aa0a6" }}>No participants yet</div> : participants.map((p) => (
            <div key={p.user} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {initialsFromName(p.user)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.user}</div>
                  <div style={{ fontSize: 12, color: "#9aa0a6" }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: p.status === "online" ? "#34d399" : "#cbd5e1" }} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", fontSize: 12, color: "#9aa0a6" }}>
          Your name: <strong>{name}</strong>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Router + mount ---------------- */
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/general" />} />
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/general" />} />
    </Routes>
  </BrowserRouter>,
);
