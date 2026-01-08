import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useState, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";
import styled from "styled-components";

import { names, type ChatMessage, type Message } from "../shared";

/* Inlined Input component (styled with styled-components) */
type InputProps = {
  name?: string;
  onSend: (text: string) => void;
};

const Input: React.FC<InputProps> = ({ name = "You", onSend }) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      setValue("");
      inputRef.current?.focus();
      return;
    }
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <StyledWrapper>
      <div className="container-ia-chat" role="presentation" aria-hidden={false}>
        <input
          type="checkbox"
          name="input-voice"
          id="input-voice"
          className="input-voice"
          style={{ display: "none" }}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          type="text"
          name="input-text"
          id="input-text"
          placeholder={`Ask Anything, ${name}...`}
          className="input-text"
          title="Ask Anything"
          aria-label="Message"
        />
        <input
          type="checkbox"
          name="input-files"
          id="input-files"
          className="input-files"
          style={{ display: "none" }}
        />
        <div className="container-upload-files" aria-hidden="true">
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

        <label htmlFor="input-files" className="label-files" title="Upload files">
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
          </svg>
        </label>

        <label htmlFor="input-voice" className="label-voice" title="Toggle voice">
          <svg className="icon-voice" xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 4v16m4-13v10M8 7v10m12-6v2M4 11v2" />
          </svg>

          <div className="ai" aria-hidden>
            <div className="container">
              <div className="c c4" />
              <div className="c c1" />
              <div className="c c2" />
              <div className="c c3" />
              <div className="rings" />
            </div>
            <div className="glass" />
          </div>

          <div className="text-voice" aria-hidden>
            <p>Conversation Started</p>
            <p>Press to cancel the conversation</p>
          </div>
        </label>

        <button
          type="button"
          aria-label="Send"
          className="label-text"
          onClick={submit}
          title="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12l7-7l7 7m-7 7V5" />
          </svg>
        </button>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
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

    & .upload-file {
      margin: 5px;
      padding: 2px;
      cursor: pointer;
      transition: all 0.5s;

      &:hover {
        color: #4c4c4c;
        transform: scale(1.1);
      }
    }
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

    &::placeholder {
      color: #959595;
    }

    &:focus-within,
    &:valid {
      max-width: 250px;
      margin-left: 42px;
    }

    &::selection {
      background-color: #4c4c4c;
      color: #e9e9e9;
    }

    &:valid ~ .label-text {
      transform: translateX(0) translateY(-50%) scale(1);
      opacity: 1;
      visibility: visible;
      pointer-events: all;
    }

    &:valid ~ .label-voice {
      transform: translateX(0) translateY(-50%) scale(0.25);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
  }

  .input-voice {
    display: none;

    &:checked ~ .container-upload-files {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      filter: blur(5px);
    }

    &:checked ~ .input-text {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      filter: blur(5px);
    }
  }

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

    &:focus-visible,
    &:hover {
      color: #4c4c4c;
    }
  }

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

  .input-voice:checked ~ .label-voice {
    background-color: #e9e9e9;
    right: 0;
    width: 300px;
    height: 300px;
    border-radius: 3rem;
    box-shadow: 0 10px 40px rgba(0, 0, 60, 0.25), inset 0 0 10px rgba(255, 255, 255, 0.5);

    & .icon-voice {
      opacity: 0;
    }

    & .text-voice p {
      opacity: 1;
    }
  }

  .label-voice {
    color: #959595;
    overflow: hidden;

    &:hover,
    &:focus-visible {
      color: #4c4c4c;
    }

    &:active svg {
      transform: scale(1.1);
    }

    & .icon-voice {
      position: absolute;
      transition: all 0.3s;
    }

    & .text-voice {
      position: absolute;
      inset: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;

      & p {
        opacity: 0;
        transition: all 0.3s;
        white-space: nowrap;

        &:first-child {
          font-size: 20px;
          font-weight: 500;
          color: transparent;
          background-image: linear-gradient(-40deg, #959595 0% 35%, #e770cd 40%, #ffcef4 50%, #e770cd 60%, #959595 65% 100%);
          background-clip: text;
          background-size: 900px;
          animation: text-light 6s ease infinite;
        }

        &:last-child {
          font-size: 12px;
          color: #2b2b2b;
          mix-blend-mode: difference;
        }
      }
    }
  }

  @keyframes text-light {
    0% {
      background-position: 0px;
    }

    100% {
      background-position: 900px;
    }
  }

  .label-text {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-50%) scale(0.25);
    color: #e9e9e9;
    background: linear-gradient(to top right, #9147ff, #ff4141);
    box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.5);
    border-radius: 50px;

    &:hover,
    &:focus-visible {
      transform-origin: top center;
      box-shadow: inset 0 0 6px rgba(255, 255, 255, 1);
    }

    &:active {
      transform: scale(0.9);
    }
  }

  .ai {
    --z: 0;
    --s: 300px;
    --p: calc(var(--s) / 4);
    width: var(--s);
    aspect-ratio: 1;
    padding: var(--p);
    display: grid;
    place-items: center;
    position: relative;
    animation: circle1 5s ease-in-out infinite;
  }

  .ai::before,
  .ai::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 50%;
    height: 50%;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 30px rgba(234, 170, 255, 1);
    filter: blur(5px);
    transform: translate(-50%, -50%);
    animation: wave 1.5s linear infinite;
  }

  .ai::after {
    animation-delay: 0.4s;
  }

  @keyframes wave {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
      box-shadow: 0 0 50px rgba(234, 170, 255, 0.9);
    }
    35% {
      transform: translate(-50%, -50%) scale(1.3);
      opacity: 1;
    }
    70%,
    100% {
      transform: translate(-50%, -50%) scale(1.6);
      opacity: 0;
      box-shadow: 0 0 50px rgba(234, 170, 255, 0.3);
    }
  }

  @keyframes ai1 {
    0% {
      transform: rotate(0deg) translate(50%) scale(0.9);
      opacity: 0;
    }

    25% {
      transform: rotate(90deg) translate(50%) scale(1.8);
      opacity: 1;
    }

    50% {
      transform: rotate(180deg) translate(50%) scale(0.7);
      opacity: 0.4;
    }

    75% {
      transform: rotate(270deg) translate(50%) scale(1.2);
      opacity: 1;
    }

    100% {
      transform: rotate(360deg) translate(50%) scale(0.9);
      opacity: 0;
    }
  }

  @keyframes ai2 {
    0% {
      transform: rotate(90deg) translate(50%) scale(0.5);
    }

    25% {
      transform: rotate(180deg) translate(50%) scale(1.7);
      opacity: 0;
    }

    50% {
      transform: rotate(270deg) translate(50%) scale(1);
      opacity: 0;
    }

    75% {
      transform: rotate(360deg) translate(50%) scale(0.8);
      opacity: 0;
    }

    100% {
      transform: rotate(450deg) translate(50%) scale(0.5);
      opacity: 1;
    }
  }

  @keyframes ai3 {
    0% {
      transform: rotate(180deg) translate(50%) scale(0.8);
      opacity: 0.8;
    }

    25% {
      transform: rotate(270deg) translate(50%) scale(1.5);
    }

    50% {
      transform: rotate(360deg) translate(50%) scale(0.6);
      opacity: 0.4;
    }

    75% {
      transform: rotate(450deg) translate(50%) scale(1.3);
      opacity: 0.7;
    }

    100% {
      transform: rotate(540deg) translate(50%) scale(0.8);
      opacity: 0.8;
    }
  }

  @keyframes ai4 {
    0% {
      transform: rotate(270deg) translate(50%) scale(1);
      opacity: 1;
    }

    25% {
      transform: rotate(360deg) translate(50%) scale(0.7);
    }

    50% {
      transform: rotate(450deg) translate(50%) scale(1.6);
      opacity: 0.5;
    }

    75% {
      transform: rotate(540deg) translate(50%) scale(0.9);
      opacity: 0.8;
    }

    100% {
      transform: rotate(630deg) translate(50%) scale(1);
      opacity: 1;
    }
  }

  .c {
    position: absolute;
    width: 300px;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .c1 {
    background: radial-gradient(50% 50% at center, #c979ee, #74bcd6);
    width: 200px;
    animation: ai1 5.5s linear infinite;
  }

  .c2 {
    background: radial-gradient(50% 50% at center, #ef788c, #e7e7fb);
    width: 100px;
    animation: ai2 6s linear infinite;
  }

  .c3 {
    background: radial-gradient(50% 50% at center, #eb7fc6, transparent);
    width: 150px;
    opacity: 0.6;
    animation: ai3 4.8s linear infinite;
  }

  .c4 {
    background: #6d67c8;
    animation: ai4 5.2s linear infinite;
  }

  .container {
    overflow: hidden;
    background: #b6a9f8;
    width: 100%;
    border-radius: 50%;
    aspect-ratio: 1;
    position: relative;
    display: grid;
    place-items: center;
  }

  .glass {
    overflow: hidden;
    position: absolute;
    inset: calc(var(--p) - 4px);
    border-radius: 50%;
    backdrop-filter: blur(10px);
    box-shadow: 0 0 50px rgba(255, 255, 255, 0.3), 0 50px 50px rgba(0, 0, 0, 0.3), 0 0 25px rgba(255, 255, 255, 1);
    background: radial-gradient(75px at 70% 30%, rgba(255, 255, 255, 0.7), transparent);
  }

  .rings {
    aspect-ratio: 1;
    border-radius: 50%;
    position: absolute;
    inset: 0;
    perspective: 11rem;
    opacity: 0.9;
  }

  .rings::before,
  .rings::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(255, 0, 0, 1);
    border-radius: 50%;
    border: 6px solid transparent;
    mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    background: linear-gradient(white, blue, magenta, violet, lightyellow) border-box;
  }

  .rings::before {
    animation: ring180 10s ease-in-out infinite;
  }

  .rings::after {
    animation: ring90 10s ease-in-out infinite;
  }

  @keyframes ring180 {
    0% {
      transform: rotateY(180deg) rotateX(180deg) rotateZ(180deg);
    }
    25% {
      transform: rotateY(180deg) rotateX(180deg) rotateZ(180deg);
    }
    50% {
      transform: rotateY(360deg) rotateX(360deg) rotateZ(360deg);
    }
    80% {
      transform: rotateY(360deg) rotateX(360deg) rotateZ(360deg);
    }
    100% {
      transform: rotateY(540deg) rotateX(540deg) rotateZ(540deg);
    }
  }

  @keyframes ring90 {
    0% {
      transform: rotateY(90deg) rotateX(90deg) rotateZ(90deg);
    }
    25% {
      transform: rotateY(90deg) rotateX(90deg) rotateZ(90deg) scale(1.1);
    }
    50% {
      transform: rotateY(270deg) rotateX(270deg) rotateZ(270deg);
    }
    75% {
      transform: rotateY(270deg) rotateX(270deg) rotateZ(270deg);
    }
    100% {
      transform: rotateY(450deg) rotateX(450deg) rotateZ(450deg);
    }
  }

  @keyframes circle1 {
    0% {
      transform: scale(0.97);
    }
    15% {
      transform: scale(1);
    }
    30% {
      transform: scale(0.98);
    }
    45% {
      transform: scale(1);
    }
    60% {
      transform: scale(0.97);
    }
    85% {
      transform: scale(1);
    }
    100% {
      transform: scale(0.97);
    }
  }
`;

export default Input;

/* End of inlined Input component */


/* Main App */
function App() {
  // pick a default name (from localStorage if set, otherwise random)
  const [name, setName] = useState<string>(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });

  const [editingName, setEditingName] = useState<string>(name);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem("cc:name", name);
  }, [name]);

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          setMessages((prev) => [
            ...prev,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(prev.slice(foundIndex + 1)),
          );
        }
      } else if (message.type === "update") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                }
              : m,
          ),
        );
      } else {
        setMessages(message.messages);
      }
    },
  });

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // send handler wired to Input
  const handleSend = (text: string) => {
    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content: text,
      user: name,
      role: "user",
    };
    setMessages((prev) => [...prev, chatMessage]);
    socket.send(JSON.stringify({ type: "add", ...chatMessage } satisfies Message));
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 18 }}>
      <style>{`
        .card {
          max-width: 720px;
          width: 100%;
          padding: 8px;
        }

        .messages {
          max-height: 60vh;
          overflow: auto;
          display:flex;
          flex-direction:column;
          gap:8px;
          padding:6px;
          margin-bottom:12px;
          width: 320px;
        }

        .msg-row {
          display:flex;
          gap:8px;
          align-items:flex-start;
        }

        .msg-user {
          font-weight:600;
          color: rgba(55,65,81,1);
          width: 68px;
          font-size: 0.85rem;
        }

        .msg-bubble {
          background: rgba(245,247,250,1);
          padding: 8px 10px;
          border-radius: 8px;
          color: rgba(55,65,81,1);
          font-size: 0.92rem;
          max-width: 100%;
          word-break: break-word;
        }

        .msg-row.mine { justify-content:flex-end; }
        .msg-row.mine .msg-user { display:none; }
        .msg-row.mine .msg-bubble { background: rgba(59,130,246,1); color:white; }
      `}</style>

      <div className="card" role="region" aria-label={`Chat room ${room}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Room: {room}</div>
          <div style={{ color: "rgba(107,114,128,1)" }}>{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="messages" ref={messagesRef} aria-live="polite">
          {messages.length === 0 ? (
            <div style={{ color: "rgba(107,114,128,1)", textAlign: "center", padding: 8 }}>No messages yet — say hi 👋</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg-row ${m.user === name ? "mine" : ""}`}>
                {m.user !== name && <div className="msg-user">{m.user}</div>}
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Name setter */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const newName = editingName.trim() || name;
            if (newName === name) return;
            setName(newName);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 12 }}
        >
          <input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="input"
            placeholder="Display name"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #eee" }}
            aria-label="Display name"
            name="name"
          />
          <button type="submit" style={{ padding: "8px 10px", borderRadius: 8, background: "#2d8cf0", color: "white", border: "none" }}>
            Set
          </button>
        </form>

        {/* Inlined Input used here */}
        <Input name={name} onSend={handleSend} />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
