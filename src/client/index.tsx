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
  Fixes made:
  - Input alignment: the input wrapper now toggles a `.focused` class on focus/blur so CSS can animate icons and placeholder reliably.
  - Placeholder centering -> left-align on focus with smooth animation.
  - Clearer animation & color tweaks (page bg #e8e8e8, input white, muted icon color).
  - Kept behaviour: image paste/upload, presence, optimistic sends + reconciliation, minimal layout.
*/

/* ---------------- CSS injected (adapted from your Uiverse snippet, with focus toggling) ---------------- */
const UIVERSE_CSS = `
:root{
  --page-bg:#e8e8e8;
  --muted:#9aa0a6;
  --icon:#9fa6ab;
  --input-bg:#ffffff;
  --accent:#6c5ce7;
}
html,body,#root{height:100%;margin:0;background:var(--page-bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.fullscreen-grid{display:grid;grid-template-columns:1fr 320px;height:100vh;width:100%;box-sizing:border-box}
.center-column{display:flex;flex-direction:column;justify-content:flex-start;padding:28px;gap:12px;overflow:hidden}
.messages-list{flex:1;overflow:auto;display:flex;flex-direction:column;gap:12px;padding-right:8px}
.message-row{display:flex;gap:12px;align-items:flex-start}
.avatar{width:36px;height:36px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-weight:700;color:#374151}
.bubble{background:var(--input-bg);color:#111827;padding:10px 14px;border-radius:12px;max-width:80%;border:1px solid rgba(16,24,40,0.03);box-shadow:0 6px 12px rgba(16,24,40,0.04)}
.bubble.me{background:var(--accent);color:white;border:none;box-shadow:0 8px 20px rgba(108,92,231,0.08);align-self:flex-end}
.composer-wrapper{display:flex;justify-content:center;padding:18px 0}
.input-container{width:640px;display:flex;justify-content:center}
.right-column{border-left:1px solid rgba(16,24,40,0.04);padding:20px;overflow:auto;background:transparent}
.presence-dot{width:10px;height:10px;border-radius:999px}

/* input box + icons */
.container-ia-chat{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  width:100%;
  max-width:640px;
  transition:all .18s ease;
}

/* left icon group */
.container-upload-files{
  position:absolute;
  left:18px;
  display:flex;
  gap:8px;
  color:var(--icon);
  transition:opacity .22s ease, transform .22s ease;
  align-items:center;
  pointer-events:auto;
  transform-origin:left center;
}
.container-upload-files .upload-file{width:20px;height:20px;cursor:pointer;display:inline-block}
.container-upload-files .upload-file:hover{color:#4c4c4c;transform:scale(1.06)}

/* input */
.input-text{
  width:100%;
  padding:14px 56px;
  padding-left:120px; /* reserved space for left icons */
  border-radius:999px;
  border:none;
  outline:none;
  background:var(--input-bg);
  color:#333;
  font-size:15px;
  line-height:18px;
  font-weight:500;
  box-shadow:0 6px 18px rgba(16,24,40,0.04);
  text-align:center; /* placeholder centered */
  transition: all .22s cubic-bezier(.2,.9,.3,1);
}
.input-text::placeholder{color:var(--muted);opacity:.95}
.container-ia-chat.focused .input-text{
  text-align:left;
  padding-left:56px; /* bring typed text closer after focus */
}

/* label-files appears when focused */
.label-files{
  position:absolute;
  top:50%;
  left:14px;
  transform:translateY(-50%) translateX(-6px) scale(.98);
  display:flex;
  padding:8px;
  color:var(--muted);
  background:var(--input-bg);
  border-radius:999px;
  border:1px solid rgba(16,24,40,0.03);
  cursor:pointer;
  opacity:0;
  visibility:hidden;
  transition:opacity .22s ease, transform .22s ease;
  box-shadow:0 4px 12px rgba(16,24,40,0.04);
}
.container-ia-chat.focused .label-files{
  opacity:1;
  visibility:visible;
  transform:translateY(-50%) translateX(0) scale(1);
}

/* when focused, fade left icon group */
.container-ia-chat.focused .container-upload-files{
  opacity:0;
  transform:translateX(-12px) scale(.98);
  pointer-events:none;
}

/* right mic */
.label-voice{
  position:absolute;
  right:12px;
  top:50%;
  transform:translateY(-50%);
  width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--icon);background:transparent;border:none;cursor:pointer;transition:transform .18s ease, color .18s ease;
}
.label-voice:hover{color:#444;transform:scale(1.04)}
`;

/* ---------------- small helpers ---------------- */
function initials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- Input component (focus toggling) ---------------- */
function InputComponent(props: { onSendText: (text: string) => void; onSendFile: (f: File) => void }) {
  const { onSendText, onSendFile } = props;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // focus/blur handlers toggle class on wrapper so CSS can animate sibling elements reliably
  useEffect(() => {
    const input = inputRef.current;
    const wrap = wrapperRef.current;
    if (!input || !wrap) return;
    const onFocus = () => wrap.classList.add("focused");
    const onBlur = () => {
      // small delay so label-files click works
      setTimeout(() => wrap.classList.remove("focused"), 90);
    };
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
    };
  }, []);

  // Enter key sends
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = (e.target as HTMLInputElement).value.trim();
      if (v) {
        onSendText(v);
        (e.target as HTMLInputElement).value = "";
      }
    }
  };

  return (
    <div>
      <style>{UIVERSE_CSS}</style>

      <div className="container-ia-chat" ref={wrapperRef}>
        <input type="checkbox" name="input-voice" id="input-voice" className="input-voice" style={{ display: "none" }} />
        <input
          ref={inputRef}
          type="text"
          name="input-text"
          id="input-text"
          placeholder="Ask Anything..."
          className="input-text"
          onKeyDown={onKeyDown}
          aria-label="Message input"
          autoComplete="off"
        />

        <input type="checkbox" name="input-files" id="input-files" className="input-files" style={{ display: "none" }} />

        <div className="container-upload-files" aria-hidden>
          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={13} r={3}/><path d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.4 4.4 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697s0-4.597-.749-5.697a4.4 4.4 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.4 4.4 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364s0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21Z"/></g></svg>

          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}><rect width={18} height={18} x={3} y={3} rx={2} ry={2}/><circle cx={9} cy={9} r={2}/><path d="m21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></g></svg>

          <svg className="upload-file" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>
        </div>

        <label htmlFor="input-files" className="label-files" onClick={() => fileRef.current?.click()} title="Attach">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14"/></svg>
        </label>

        <label htmlFor="input-voice" className="label-voice" title="Voice (not implemented)">
          <svg className="icon-voice" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10"/></svg>
        </label>

        <input ref={fileRef} id="hidden-file-input" type="file" accept="image/*" style={{ display: "none" }}
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
