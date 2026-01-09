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

/* ---------------- CSS copied from your snippet (patched, nothing removed) ---------------- */
const UIVERSE_CSS = `
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
  text-align: center;
}
.input-text::placeholder { color: #959595; }
.input-text:focus { text-align: left; }

.input-voice { display: none; }

.label-files {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateX(-20px) translateY(-50%);
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

.label-voice,
.label-text {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  padding: 6px;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.05);
  z-index: 999;
}

.label-text {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-50%) scale(0.25);
  background: linear-gradient(to top right, #9147ff, #ff4141);
  border-radius: 50px;
  color: white;
}

/* ---------- FIX: typed state ---------- */

.input-text[data-has-value="true"] {
  max-width: 250px;
  margin-left: 42px;
  text-align: left;
}

.input-text[data-has-value="true"] ~ .container-upload-files {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  filter: blur(5px);
}

.input-text[data-has-value="true"] ~ .label-text {
  opacity: 1;
  visibility: visible;
  pointer-events: all;
  transform: translateY(-50%) scale(1);
}

.input-text[data-has-value="true"] ~ .label-voice {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-50%) scale(0.25);
}

/* ---------- layout ---------- */

:root {
  --page-bg: #e8e8e8;
  --bubble-bg: #ffffff;
  --accent: #6c5ce7;
}

html,body,#root {
  height: 100%;
  margin: 0;
  background: var(--page-bg);
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
}

.fullscreen-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  height: 100vh;
}

.center-column {
  display: flex;
  flex-direction: column;
  padding: 28px;
  gap: 12px;
}

.messages-list {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row { display:flex; gap:12px; }

.avatar {
  width:36px;
  height:36px;
  border-radius:8px;
  background:#f3f4f6;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
}

.bubble {
  background: var(--bubble-bg);
  padding:10px 14px;
  border-radius:12px;
  max-width:80%;
}

.bubble.me {
  background: var(--accent);
  color:white;
  align-self:flex-end;
}

.composer-wrapper {
  display:flex;
  justify-content:center;
  padding:18px 0;
}

.input-container {
  width: 640px;
  display:flex;
  justify-content:center;
}

.right-column {
  border-left:1px solid rgba(0,0,0,0.05);
  padding:20px;
}
`;

/* ---------------- Input ---------------- */
function InputComponent({ onSendText, onSendFile }: any) {
  const hiddenFileRef = useRef<HTMLInputElement | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const input = e.currentTarget;
      const v = input.value.trim();
      if (v) {
        onSendText(v);
        input.value = "";
        input.dataset.hasValue = "false";
      }
    }
  };

  return (
    <>
      <style>{UIVERSE_CSS}</style>

      <div className="container-ia-chat">
        <input type="checkbox" className="input-voice" />

        <input
          type="text"
          className="input-text"
          placeholder="Ask Anything..."
          required
          data-has-value="false"
          onInput={(e) => {
            e.currentTarget.dataset.hasValue =
              e.currentTarget.value.trim() ? "true" : "false";
          }}
          onKeyDown={onKeyDown}
        />

        <div className="container-upload-files">
          <svg className="upload-file" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>

        <label className="label-files" onClick={() => hiddenFileRef.current?.click()}>
          +
        </label>

        <label className="label-voice">🎙</label>

        <label className="label-text">➤</label>

        <input
          type="file"
          accept="image/*"
          ref={hiddenFileRef}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onSendFile(f);
          }}
        />
      </div>
    </>
  );
}

/* ---------------- App ---------------- */
function AppInner() {
  const { room } = useParams();
  const roomId = room ?? "general";

  const [name] = useState(() => names[Math.floor(Math.random() * names.length)]);
  const [messages, setMessages] = useState<any[]>([]);

  const send = (text: string) => {
    setMessages((m) => [...m, { id: nanoid(), user: name, content: text }]);
  };

  return (
    <div className="fullscreen-grid">
      <div className="center-column">
        <div className="messages-list">
          {messages.map((m) => (
            <div key={m.id} className="message-row">
              <div className="avatar">{m.user[0]}</div>
              <div className="bubble me">{m.content}</div>
            </div>
          ))}
        </div>

        <div className="composer-wrapper">
          <div className="input-container">
            <InputComponent onSendText={send} onSendFile={() => {}} />
          </div>
        </div>
      </div>

      <div className="right-column">participants</div>
    </div>
  );
}

/* ---------------- mount ---------------- */
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/:room" element={<AppInner />} />
      <Route path="*" element={<Navigate to="/general" />} />
    </Routes>
  </BrowserRouter>
);
