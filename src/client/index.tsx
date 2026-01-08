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

import { names, type ChatMessage, type Message } from "../shared";

function App() {
  // pick a default name (from localStorage if set, otherwise random)
  const [name, setName] = useState<string>(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    return names[Math.floor(Math.random() * names.length)];
  });

  // editingName is the controlled input value for the name field
  const [editingName, setEditingName] = useState<string>(name);

  // persist name to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cc:name", name);
  }, [name]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        } else {
          // this usually means we ourselves added a message
          // and it was broadcasted back
          // so let's replace the message with the new message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(messages.slice(foundIndex + 1));
          });
        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
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
    // focus input on mount / room change
    inputRef.current?.focus();
  }, [room]);

  return (
    <div className="chat container" style={{ padding: 0 }}>
      <style>{`
        .chat.container { max-width: 760px; margin: 36px auto; font-family: Inter, Roboto, Arial, sans-serif; }
        .chat-card { background: #fbfbfd; border-radius: 12px; padding: 16px; box-shadow: 0 6px 18px rgba(20,20,30,0.06); }
        .room-header { font-size: 0.95rem; color: #333; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .name-row { display:flex; gap:8px; margin-bottom:12px; }
        .my-input-text { flex:1; padding:8px 10px; border-radius:8px; border:1px solid #e6e6e6; background:white; }
        .set-button, .send-button { padding:8px 12px; border-radius:8px; border: none; background:#2d8cf0; color:white; cursor:pointer; min-width:64px; }
        .message-list { max-height:50vh; overflow:auto; display:flex; flex-direction:column; gap:8px; padding:4px 2px; margin-bottom:12px; }
        .message-row { display:flex; gap:10px; align-items:flex-end; }
        .message-row.mine { justify-content:flex-end; }
        .user { width:96px; font-weight:600; color:#333; font-size:0.9rem; }
        .message-bubble { padding:10px 12px; border-radius:12px; background:white; box-shadow:0 1px 2px rgba(0,0,0,0.03); max-width:70%; word-break:break-word; }
        .message-row.mine .message-bubble { background:#2d8cf0; color:white; border-bottom-right-radius:4px; }
        .message-row.mine .user { display:none; }
        .footer-row { display:flex; gap:8px; }
        .my-input-text:focus { outline: 2px solid rgba(45,140,240,0.18); }
        .empty-state { color:#666; text-align:center; padding:10px 4px; font-size:0.95rem; }
      `}</style>

      <div className="chat-card">
        <div className="room-header">
          <div>Room: {room}</div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
        </div>

        {/* Name picker row */}
        <form
          className="row name-row"
          onSubmit={(e) => {
            e.preventDefault();
            const newName = editingName.trim() || name;
            if (newName === name) {
              alert(`Name unchanged: ${name}`);
              return;
            }
            setName(newName);
            alert(`Name set to ${newName}`);
          }}
        >
          <input
            type="text"
            name="name"
            className="ten columns my-input-text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            placeholder="Enter your display name"
            autoComplete="name"
          />
          <button type="submit" className="set-button">Set</button>
        </form>

        <div className="message-list" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">No messages yet — say hi 👋</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`row message-row ${message.user === name ? "mine" : ""}`}
              >
                {message.user === name ? (
                  <div className="message-bubble">{message.content}</div>
                ) : (
                  <>
                    <div className="user">{message.user}</div>
                    <div className="message-bubble">{message.content}</div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <form
          className="row footer-row"
          onSubmit={(e) => {
            e.preventDefault();
            const content = e.currentTarget.elements.namedItem(
              "content",
            ) as HTMLInputElement;
            const trimmed = (content.value || "").trim();
            if (!trimmed) {
              // don't send empty messages
              content.value = "";
              inputRef.current?.focus();
              return;
            }
            const chatMessage: ChatMessage = {
              id: nanoid(8),
              content: trimmed,
              user: name,
              role: "user",
            };
            setMessages((messages) => [...messages, chatMessage]);

            socket.send(
              JSON.stringify({
                type: "add",
                ...chatMessage,
              } satisfies Message),
            );

            content.value = "";
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            name="content"
            className="ten columns my-input-text"
            placeholder={`Hello ${name}! Type a message...`}
            autoComplete="off"
          />
          <button type="submit" className="send-button">Send</button>
        </form>
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
