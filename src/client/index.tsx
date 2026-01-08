import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

/**
 * UI-updated index.tsx
 * - Only this file changed.
 * - Keeps existing backend integration via usePartySocket.
 * - Adds a clean, accessible layout and inline styles (no external CSS changes).
 * - Uses functional updates for message state to avoid stale closures.
 */

/* ---------- Inline styles (kept here to avoid editing other files) ---------- */
const S: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f6fb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: 20,
    boxSizing: "border-box",
  },
  container: {
    width: "100%",
    maxWidth: 1000,
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 6px 20px rgba(16,24,40,0.08)",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: 0,
  },
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    padding: "16px 18px",
    borderBottom: "1px solid #eef3fb",
    gap: 12,
    background: "#ffffff",
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    background: "#2b7cff",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
  },
  left: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 520,
  },
  messagesCard: {
    flex: 1,
    background: "#ffffff",
    borderRadius: 6,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "inset 0 1px 0 rgba(16,24,39,0.02)",
  },
  messagesList: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 6,
  },
  messageRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "#e6eef8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#102a43",
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%",
    padding: "10px 12px",
    borderRadius: 10,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  bubbleMe: {
    background: "#2b7cff",
    color: "white",
    marginLeft: "auto",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    background: "#f1f5fb",
    color: "#0b1726",
    borderBottomLeftRadius: 4,
  },
  metaSmall: {
    fontSize: 11,
    color: "#6d7790",
    marginTop: 6,
    textAlign: "right",
  },
  composerRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e6eef8",
    background: "#fbfdff",
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
    borderLeft: "1px solid #eef3fb",
    padding: 16,
    background: "#fafbff",
  },
  nameRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    width: "100%",
  },
  nameInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e6eef8",
  },
  setNameBtn: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d9e6ff",
    background: "#ffffff",
    cursor: "pointer",
  },
  messagesEmpty: {
    color: "#6d7790",
    textAlign: "center",
    padding: 20,
  },
  roomLabel: {
    fontSize: 12,
    color: "#6d7790",
    marginTop: 8,
  },
  participantsList: {
    marginTop: 12,
    paddingLeft: 16,
  },
  smallNote: { fontSize: 13, color: "#7b8794", marginTop: 12 },
  responsive: {
    // will be applied in-line when window is narrow
  },
};

/* ---------------- Helper utilities ---------------- */
function initialsFromName(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ---------------- App component ---------------- */
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

  // stable onMessage that uses functional updates to avoid stale closures
  const handleIncoming = useCallback(
    (evt: MessageEvent) => {
      try {
        const message = JSON.parse(evt.data as string) as Message;
        if (message.type === "add") {
          setMessages((prev) => {
            const foundIndex = prev.findIndex((m) => m.id === message.id);
            const newMsg: ChatMessage = {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            };
            if (foundIndex === -1) {
              return [...prev, newMsg];
            } else {
              // replace the item at foundIndex
              return prev
                .slice(0, foundIndex)
                .concat(newMsg)
                .concat(prev.slice(foundIndex + 1));
            }
          });
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
          // full sync or initial state
          const list = Array.isArray(message.messages) ? message.messages : [];
          const normalized = list.map((m: any) => ({
            id: m.id,
            content: m.content,
            user: m.user,
            role: m.role,
          })) as ChatMessage[];
          setMessages(normalized);
        }
      } catch (err) {
        console.warn("Failed to parse incoming message", err);
      }
    },
    [setMessages],
  );

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: handleIncoming,
  });

  // handle sending message
  const onSend = (content: string) => {
    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content,
      user: name,
      role: "user",
    };
    // optimistic UI update
    setMessages((m) => [...m, chatMessage]);

    socket.send(
      JSON.stringify({
        type: "add",
        ...chatMessage,
      } satisfies Message),
    );
  };

  // Keep a memoized placeholder for input placeholder text
  const placeholder = useMemo(() => `Hello ${name}! Type a message...`, [name]);

  /* Basic responsive behavior: add single-column when small screens */
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={S.app}>
      <div
        style={{
          ...S.container,
          ...(isNarrow ? { gridTemplateColumns: "1fr" } : undefined),
        }}
        className="chat container"
      >
        <header style={S.header}>
          <div style={S.logo}>CC</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>ClassConnect</div>
            <div style={{ fontSize: 13, color: "#6d7790" }}>Classroom chat</div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#6d7790" }}>Room</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#102a43" }}>{room}</div>
          </div>
        </header>

        {/* Left: messages and composer */}
        <main style={S.left}>
          {/* name picker (compact, moved into main for quick access) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const newName = editingName.trim() || name;
              if (newName === name) {
                // no change
                return;
              }
              setName(newName);
              setEditingName(newName);
            }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              aria-label="Display name"
              style={S.nameInput}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="Display name"
              autoComplete="name"
            />
            <button type="submit" style={S.setNameBtn}>
              Set
            </button>
          </form>

          <section style={S.messagesCard} aria-live="polite">
            <div style={S.messagesList} id="messages-list">
              {messages.length === 0 ? (
                <div style={S.messagesEmpty}>No messages yet — say hello 👋</div>
              ) : (
                messages.map((message) => {
                  const isMe = message.user === name;
                  return (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        flexDirection: isMe ? "row-reverse" : "row",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                      className="message-row"
                    >
                      <div style={S.avatar} aria-hidden>
                        {initialsFromName(message.user)}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            ...S.bubble,
                            ...(isMe ? S.bubbleMe : S.bubbleThem),
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                            {message.user}
                          </div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                        </div>

                        <div style={{ fontSize: 12, color: "#6d7790", marginTop: 6 }}>
                          {message.role ? message.role : "user"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = e.currentTarget.elements.namedItem(
                  "content",
                ) as HTMLInputElement | null;
                if (!target) return;
                const text = target.value.trim();
                if (!text) return;
                onSend(text);
                target.value = "";
              }}
              style={S.composerRow}
            >
              <input
                name="content"
                style={S.input}
                placeholder={placeholder}
                autoComplete="off"
                aria-label="Message"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const target = e.currentTarget as HTMLInputElement;
                    const form = target.form as HTMLFormElement | null;
                    form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                  }
                }}
              />
              <button type="submit" style={S.sendBtn}>
                Send
              </button>
            </form>
          </section>
        </main>

        {/* Right: info panel */}
        <aside style={S.rightSidebar}>
          <div style={{ fontWeight: 600 }}>Conversation</div>
          <div style={S.roomLabel}>Room id</div>
          <div style={{ fontWeight: 700 }}>{room}</div>

          <div style={S.smallNote}>Participants</div>
          <ul style={S.participantsList}>
            {/* This is a simple static list; if your backend provides presence, plug it in here */}
            <li>Alice</li>
            <li>Bob</li>
            <li>Carol</li>
          </ul>

          <div style={S.smallNote}>
            Tip: Press Enter to send. Your name is saved in localStorage.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Mounting + Router ---------------- */
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
