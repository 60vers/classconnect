import React, { useCallback, useEffect, useRef, useState } from "react";
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

/*
  Single-file minimal chat UI.

  Important notes:
  - You provided an exact HTML + CSS snippet (Uiverse by Cobp).
  - To avoid build issues with a missing styled-components package, I did NOT import styled-components.
    Instead I used your exact HTML structure and injected your CSS string directly into a <style> tag.
  - This file is a drop-in replacement for src/client/index.tsx.
  - Bare minimum: no server list, no logo. Center messages + right participants + bottom-center input exactly as requested.
  - Image sending via file picker or paste (base64).
  - Presence support and optimistic sends + reconciliation with server echoes are included.
*/

/* ---------------- CSS copied from your snippet (adapted for use-injection) ---------------- */
const UIVERSE_CSS = `/* From Uiverse.io by Cobp */
.container-ia-chat {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: end;
  width: 300px;
}

.container-upload-files {
  position: absolute;
  left: 0;
  display: flex;
  color: #aaaaaa;
  transition: all 0.5s;
}
.container-upload-files .upload-file {
  margin: 5px;
  padding: 2px;
  cursor: pointer;
  transition: all 0.5s;
}
.container-upload-files .upload-file:hover {
  color: #4c4c4c;
  transform: scale(1.1);
}

.input-text {
  max-width: 190px;
  width: 100%;
  margin-left: 72px;
  padding: 0.75rem 1rem;
  padding-right: 46px;
  border-radius: 50px;
  border: none;
  outline: none;
  background-color: #e9e9e9;
  color: #4c4c4c;
  font-size: 14px;
  line-height: 18px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  font-weight: 500;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  z-index: 999;
  text-align: center; /* placeholder centered visually */
}
.input-text::placeholder {
  color: #959595;
}
.input-text:focus {
  text-align: left; /* when user types, left-align content */
}

.input-voice { display: none; }

.label-files {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateX(-20px) translateY(-50%) scale(1);
  display: flex;
  padding: 0.5rem;
  color: #959595;
  background-color: #e9e9e9;
  border-radius: 50px;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
}
.label-files:hover { color: #4c4c4c; }

.label-voice,
.label-text {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateX(0) translateY(-50%) scale(1);
  width: 36px;
  height: 36px;
  display: flex;
  padding: 6px;
  border: none;
  outline: none;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  z-index: 999;
}
.label-voice { color: #959595; }

@keyframes text-light { 0% { background-position: 0px; } 100% { background-position: 900px; } }

/* Minimal page layout and message CSS */
:root {
  --page-bg: #e8e8e8;
  --muted: #9aa0a6;
  --bubble-bg: #ffffff;
  --accent: #6c5ce7;
}
html,body,#root { height: 100%; margin: 0; background: var(--page-bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
.fullscreen-grid { display: grid; grid-template-columns: 1fr 320px; height: 100vh; width: 100%; box-sizing: border-box; }
.center-column { display: flex; flex-direction: column; justify-content: flex-start; padding: 28px; gap: 12px; overflow: hidden; }
.messages-list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 8px; }
.message-row { display:flex; gap:12px; align-items:flex-start; }
.avatar { width:36px; height:36px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-weight:700; color:#374151; }
.bubble { background: var(--bubble-bg); color:#111827; padding:10px 14px; border-radius:12px; max-width:80%; border:1px solid rgba(16,24,40,0.03); box-shadow:0 6px 12px rgba(16,24,40,0.04); }
.bubble.me { background: var(--accent); color:white; border:none; box-shadow:0 8px 20px rgba(108,92,231,0.08); align-self:flex-end; }
.composer-wrapper { display:flex; justify-content:center; padding:18px 0; }
.input-container { width: 640px; display:flex; justify-content:center; }
.right-column { border-left:1px solid rgba(16,24,40,0.04); padding:20px; overflow:auto; background: transparent; }
.presence-dot { width:10px; height:10px; border-radius:999px; }
`;

/* ---------------- small helpers ---------------- */
function initials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- Input component: exactly your HTML, with JS hooks wired ---------------- */
function InputComponent(props: { onSendText: (text: string) => void; onSendFile: (f: File) => void }) {
  const { onSendText, onSendFile } = props;
  const hiddenFileRef = useRef<HTMLInputElement | null>(null);

  // handle Enter
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const v = (e.target as HTMLInputElement).value.trim();
      if (v) {
        onSendText(v);
        (e.target as HTMLInputElement).value = "";
      }
    }
  };

  // paste handling handled globally elsewhere, but keep hidden input
  return (
    <div>
      {/* inject the CSS that was provided */}
      <style>{UIVERSE_CSS}</style>

      <div className="container-ia-chat">
        <input type="checkbox" name="input-voice" id="input-voice" className="input-voice" style={{ display: "none" }} />
        <input
          type="text"
          name="input-text"
          id="input-text"
          placeholder="Ask Anything..."
          className="input-text"
          required
          title=""
          onKeyDown={onKeyDown}
        />
        <input type="checkbox" name="input-files" id="input-files" className="input-files" style={{ display: "none" }} />
        <div className="container-upload-files" aria-hidden>
          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={13} r={3} />
              <path d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.4 4.4 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697s0-4.597-.749-5.697a4.4 4.4 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.4 4.4 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364s0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21Z" />
            </g>
          </svg>

          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <rect width={18} height={18} x={3} y={3} rx={2} ry={2} />
              <circle cx={9} cy={9} r={2} />
              <path d="m21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </g>
          </svg>

          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
          </svg>
        </div>

        <label htmlFor="input-files" className="label-files" onClick={() => hiddenFileRef.current?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
          </svg>
        </label>

        <label htmlFor="input-voice" className="label-voice" title="Voice (not implemented)">
          <svg className="icon-voice" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10m12-6v2M4 11v2" />
          </svg>
        </label>

        <label htmlFor="input-text" className="label-text" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12l7-7l7 7m-7 7V5" />
          </svg>
        </label>

        <input
          id="hidden-file-input"
          type="file"
          accept="image/*"
          ref={hiddenFileRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (f) onSendFile(f);
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- Minimal App (center messages + right participants) ---------------- */
function AppInner() {
  const { room } = useParams<{ room: string }>();
  const navigate = useNavigate();
  const roomId = room ?? "general";

  const [name] = useState(() => {
    try { const v = localStorage.getItem("cc:name"); if (v) return v; } catch {}
    const n = names[Math.floor(Math.random() * names.length)];
    try { localStorage.setItem("cc:name", n); } catch {}
    return n;
  });

  const [clientId] = useState(() => {
    try { const v = localStorage.getItem("cc:clientId"); if (v) return v; } catch {}
    const id = nanoid(8);
    try { localStorage.setItem("cc:clientId", id); } catch {}
    return id;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<{ user: string; id?: string; status: "online" | "offline"; lastSeen?: string }[]>([]);
  const socketRef = useRef<any>(null);
  const pendingRef = useRef<Map<string, any>>(new Map());

  // load persisted messages/participants for room
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cc:messages:${roomId}`);
      if (raw) setMessages(JSON.parse(raw));
      else setMessages([]);
    } catch {
      setMessages([]);
    }
    try {
      const pr = localStorage.getItem(`cc:participants:${roomId}`);
      if (pr) setParticipants(JSON.parse(pr));
      else setParticipants([]);
    } catch {
      setParticipants([]);
    }
  }, [roomId]);

  useEffect(() => {
    try { localStorage.setItem(`cc:messages:${roomId}`, JSON.stringify(messages.slice(-500))); } catch {}
  }, [messages, roomId]);
  useEffect(() => {
    try { localStorage.setItem(`cc:participants:${roomId}`, JSON.stringify(participants)); } catch {}
  }, [participants, roomId]);

  // reconcile incoming
  const reconcile = useCallback((msg: Message) => {
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === msg.id);
      if (i !== -1) {
        const p = prev.slice();
        p[i] = { ...p[i], ...msg, pending: false } as any;
        pendingRef.current.delete(msg.id);
        return p;
      }
      for (let j = prev.length - 1; j >= Math.max(0, prev.length - 40); j--) {
        const m = prev[j] as any;
        if (m.pending && m.user === msg.user && m.content === msg.content) {
          const copy = prev.slice();
          copy[j] = { ...m, ...msg, pending: false } as any;
          pendingRef.current.delete(m.id);
          return copy;
        }
      }
      pendingRef.current.delete(msg.id);
      return [...prev, { ...(msg as any), pending: false }];
    });
  }, []);

  // incoming handler
  const onMessage = useCallback((evt: MessageEvent) => {
    try {
      const data = JSON.parse(evt.data as string) as Message;
      if (!data || typeof data !== "object") return;

      if (data.type === "presence") {
        const p = { user: data.user, id: data.id ?? data.user, status: data.status ?? "online", lastSeen: data.lastSeen };
        setParticipants((prev) => {
          const idx = prev.findIndex((x) => x.user === p.user);
          if (idx === -1) return [...prev, p];
          const copy = prev.slice(); copy[idx] = { ...copy[idx], ...p }; return copy;
        });
        return;
      }

      if (data.type === "participants") {
        const list = Array.isArray((data as any).participants) ? (data as any).participants : [];
        setParticipants(list.map((p: any) => ({ user: p.user, id: p.id, status: p.status ?? "online", lastSeen: p.lastSeen })));
        return;
      }

      if (data.type === "add") {
        reconcile(data);
      }
    } catch (err) {
      console.warn("parse incoming", err);
    }
  }, [reconcile]);

  const partySocket = usePartySocket({
    party: "chat",
    room: roomId,
    onMessage,
    onOpen() {
      try { socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "online", id: clientId, lastSeen: new Date().toISOString() })); } catch {}
      pendingRef.current.forEach((p) => {
        try { socketRef.current?.send(JSON.stringify(p)); } catch {}
      });
    },
  });
  useEffect(() => { socketRef.current = partySocket; }, [partySocket]);

  // presence heartbeat
  useEffect(() => {
    const sendPresence = (status: "online" | "offline") => {
      try { socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status, id: clientId, lastSeen: new Date().toISOString() })); } catch {}
      setParticipants((prev) => {
        const idx = prev.findIndex((p) => p.user === name);
        const p = { user: name, id: clientId, status, lastSeen: new Date().toISOString() };
        if (idx === -1) return [...prev, p];
        const copy = prev.slice(); copy[idx] = { ...copy[idx], ...p }; return copy;
      });
    };
    sendPresence("online");
    const hb = window.setInterval(() => sendPresence("online"), 30000);
    const onUnload = () => sendPresence("offline");
    window.addEventListener("beforeunload", onUnload);
    return () => { clearInterval(hb); try { socketRef.current?.send(JSON.stringify({ type: "presence", user: name, status: "offline", id: clientId, lastSeen: new Date().toISOString() })); } catch {} window.removeEventListener("beforeunload", onUnload); };
  }, [name, clientId]);

  // send text or file
  const send = useCallback((opts: { text?: string; file?: File }) => {
    if (!opts.text && !opts.file) return;
    if (opts.file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const payload: any = { type: "add", id: nanoid(12), content: dataUrl, user: name, role: "user", kind: "image", created_at: new Date().toISOString() };
        pendingRef.current.set(payload.id, payload);
        try { socketRef.current?.send(JSON.stringify(payload)); } catch {}
        setMessages((prev) => [...prev, { ...payload, pending: true } as any]);
      };
      reader.readAsDataURL(opts.file);
      return;
    }
    const payload: any = { type: "add", id: nanoid(12), content: opts.text, user: name, role: "user", created_at: new Date().toISOString() };
    pendingRef.current.set(payload.id, payload);
    try { socketRef.current?.send(JSON.stringify(payload)); } catch {}
    setMessages((prev) => [...prev, { ...payload, pending: true } as any]);
  }, [name]);

  // paste-to-image
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) send({ file });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [send]);

  // simple navigation by URL (no UI channels)
  const goto = useCallback((r: string) => navigate(`/${r}`), [navigate]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div className="fullscreen-grid" role="application">
        <div className="center-column" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>#{roomId}</div>
            <div style={{ color: "#9aa0a6" }}>{participants.filter(p => p.status === "online").length} online</div>
          </div>

          <div className="messages-list" id="messages-list">
            {messages.map((m: any) => {
              const isMe = m.user === name;
              const isImage = typeof m.content === "string" && m.content.startsWith("data:image/");
              const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : (m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "");
              return (
                <div key={m.id} className="message-row" style={{ flexDirection: isMe ? "row-reverse" as const : "row" as const }}>
                  <div className="avatar" aria-hidden>{initials(m.user)}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 700 }}>{m.user}</div>
                      <div style={{ fontSize: 12, color: "#9aa0a6" }}>{time}</div>
                    </div>

                    <div className={`bubble ${isMe ? "me" : ""}`} style={{ marginTop: 6 }}>
                      {isImage ? <img src={m.content} alt="attachment" style={{ maxWidth: 420, borderRadius: 8 }} /> : <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
                      {m.pending ? <div style={{ marginTop: 8, fontSize: 12, color: "#9aa0a6" }}>Sending…</div> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="composer-wrapper">
            <div className="input-container">
              <InputComponent onSendText={(text) => send({ text })} onSendFile={(f) => send({ file: f })} />
            </div>
          </div>
        </div>

        <div className="right-column" role="complementary" aria-label="Participants">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Participants</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {participants.length === 0 ? <div style={{ color: "#9aa0a6" }}>No participants yet</div> : participants.map((p) => (
              <div key={p.user} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="avatar" aria-hidden>{initials(p.user)}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.user}</div>
                    <div style={{ fontSize: 12, color: "#9aa0a6" }}>{p.lastSeen ? new Date(p.lastSeen).toLocaleString() : p.status}</div>
                  </div>
                </div>
                <div className="presence-dot" style={{ background: p.status === "online" ? "#34d399" : "#cbd5e1" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#9aa0a6" }}>
            Your name: <strong>{name}</strong>
          </div>
        </div>
      </div>
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
