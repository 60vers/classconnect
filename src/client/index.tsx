import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * Layout-only index.tsx with backend chat integration (WebSocket + REST history).
 * - No gradients (solid colors only).
 * - Self-contained so only this file needs to change.
 *
 * Configure endpoints:
 * - For Vite: set VITE_WS_URL and VITE_REST_URL
 * - For CRA: set REACT_APP_WS_URL and REACT_APP_REST_URL
 * - Or set a global on the page: window.__WS_URL__ and window.__REST_URL__
 * - Defaults:
 *    WS:  ws(s)://<current-host>/ws
 *    REST: /api/messages
 *
 * WebSocket message format expected from backend (recommended):
 *  { id: number|string, text: string, from: "me" | "them" | "system", created_at?: string }
 *
 * Outgoing message to WS: { action: "message", text: "..." } or simply { text: "..." } depending on server.
 * Adjust the sendMessage() JSON shape to match your backend.
 */

/* --------- Simple environment helpers ---------- */
const getEnv = (keyVite: string, keyCRA: string, windowKey: string, fallback: string) => {
  const win = window as any;
  if (win && win[windowKey]) return win[windowKey];
  // import.meta.env for Vite
  const im = (typeof import.meta !== "undefined" ? (import.meta as any) : undefined) as any | undefined;
  if (im?.env && im.env[keyVite]) return im.env[keyVite];
  // process.env for CRA
  const proc = (typeof process !== "undefined" ? (process as any) : undefined) as any | undefined;
  if (proc?.env && proc.env[keyCRA]) return proc.env[keyCRA];
  return fallback;
};

const WS_URL = getEnv("VITE_WS_URL", "REACT_APP_WS_URL", "__WS_URL__", (() => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
})());

const REST_URL = getEnv("VITE_REST_URL", "REACT_APP_REST_URL", "__REST_URL__", "/api/messages");

/* --------- Styles (no gradients) ---------- */
const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    background: "#f3f6fb", // solid, no gradient
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: "#0b1726",
  },
  card: {
    width: "100%",
    maxWidth: 1100,
    borderRadius: 8,
    boxShadow: "0 6px 20px rgba(11,25,60,0.06)",
    overflow: "hidden",
    background: "#ffffff",
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    minHeight: 520,
  },
  header: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid #e6eef8",
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
  },
  left: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  chatCard: {
    background: "#fff",
    borderRadius: 8,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 360,
    boxShadow: "inset 0 1px 0 rgba(16,24,39,0.02)",
  },
  messages: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 6,
  },
  messageMe: {
    alignSelf: "flex-end",
    background: "#2b7cff",
    color: "white",
    padding: "10px 14px",
    borderRadius: 10,
    maxWidth: "78%",
    wordBreak: "break-word",
  },
  messageThem: {
    alignSelf: "flex-start",
    background: "#f1f5fb",
    color: "#0b1726",
    padding: "10px 14px",
    borderRadius: 10,
    maxWidth: "78%",
    wordBreak: "break-word",
  },
  composer: {
    marginTop: 8,
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
  sidebar: {
    borderLeft: "1px solid #e6eef8",
    padding: 16,
    background: "#fafbff",
  },
  smallMuted: { fontSize: 13, color: "#6d7790" },
  participants: { marginTop: 10, paddingLeft: 16 },
};

/* --------- Types ---------- */
type Message = {
  id: string | number;
  text: string;
  from: "me" | "them" | "system";
  created_at?: string;
};

/* --------- Component ---------- */
function App(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sendQueueRef = useRef<any[]>([]); // queue messages until WS opens
  const reconnectionRef = useRef({ attempts: 0, timer: 0 });

  /* Fetch message history from REST endpoint on mount */
  useEffect(() => {
    let cancelled = false;
    fetch(REST_URL, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Expecting array of messages; adapt if your API returns { messages: [...] }
        const list: any[] = Array.isArray(data) ? data : data.messages || [];
        const normalized = list.map((m) => ({
          id: m.id ?? Math.random().toString(36).slice(2),
          text: m.text ?? String(m),
          from: m.from ?? "them",
          created_at: m.created_at,
        })) as Message[];
        setMessages(normalized);
        // scroll bottom after render
        requestAnimationFrame(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        });
      })
      .catch((err) => {
        // ignore — could show a toast in a real app
        console.warn("Could not load message history:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* WebSocket connection with simple reconnection */
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closedByUs = false;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
      } catch (err) {
        console.error("WS constructor error:", err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectionRef.current.attempts = 0;
        setConnected(true);
        setWsInstance(ws);
        // flush queued messages
        while (sendQueueRef.current.length) {
          const item = sendQueueRef.current.shift();
          ws?.send(typeof item === "string" ? item : JSON.stringify(item));
        }
      };

      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          // if backend sends { type: "message", ... } adjust accordingly.
          // We'll try to normalize various shapes:
          if (Array.isArray(payload)) {
            // maybe history snapshot
            const normalized = payload.map((m: any) => ({
              id: m.id ?? Math.random().toString(36).slice(2),
              text: m.text ?? JSON.stringify(m),
              from: m.from ?? "them",
              created_at: m.created_at,
            })) as Message[];
            setMessages((prev) => [...prev, ...normalized]);
          } else if (payload && payload.text) {
            const msg: Message = {
              id: payload.id ?? Math.random().toString(36).slice(2),
              text: payload.text,
              from: payload.from === "me" ? "me" : payload.from || "them",
              created_at: payload.created_at,
            };
            setMessages((prev) => [...prev, msg]);
            requestAnimationFrame(() => {
              if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
            });
          } else {
            // fallback: treat as plain string
            setMessages((prev) => [
              ...prev,
              { id: Math.random().toString(36).slice(2), text: ev.data, from: "system" },
            ]);
          }
        } catch (err) {
          // non-JSON payload
          setMessages((prev) => [
            ...prev,
            { id: Math.random().toString(36).slice(2), text: ev.data, from: "system" },
          ]);
        }
      };

      ws.onclose = (ev) => {
        setConnected(false);
        setWsInstance(null);
        if (!closedByUs) scheduleReconnect();
      };

      ws.onerror = (e) => {
        console.warn("WebSocket error", e);
        // close will trigger reconnect
      };
    };

    const scheduleReconnect = () => {
      reconnectionRef.current.attempts += 1;
      const attempts = reconnectionRef.current.attempts;
      const delay = Math.min(30000, 500 * Math.pow(1.5, attempts)); // exponential backoff cap 30s
      reconnectionRef.current.timer = window.setTimeout(() => {
        connect();
      }, delay);
    };

    connect();

    return () => {
      // clean up
      closedByUs = true;
      if (reconnectionRef.current.timer) clearTimeout(reconnectionRef.current.timer);
      try {
        ws?.close();
      } catch (err) {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  /* send message (WS preferred; fallback to REST POST) */
  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const outgoing = { text: trimmed };
    // optimistic local message
    const localMsg: Message = {
      id: `local-${Date.now()}`,
      text: trimmed,
      from: "me",
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, localMsg]);
    requestAnimationFrame(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    });

    // send via ws if connected
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      try {
        // adjust payload shape for your server
        wsInstance.send(JSON.stringify(outgoing));
        return;
      } catch (err) {
        console.warn("WS send failed, will fallback to REST", err);
      }
    }

    // If WS not open, queue for send when it opens
    if (!wsInstance) {
      sendQueueRef.current.push(outgoing);
      // also try REST as fallback
      fetch(REST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(outgoing),
      }).catch((err) => {
        console.warn("REST fallback failed:", err);
      });
      return;
    }

    // if ws exists but not open
    if (wsInstance.readyState !== WebSocket.OPEN) {
      sendQueueRef.current.push(outgoing);
      // also attempt REST POST fallback
      fetch(REST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(outgoing),
      }).catch((err) => {
        console.warn("REST fallback failed:", err);
      });
    }
  };

  /* UI handlers */
  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    sendMessage(value);
    setValue("");
  };

  return (
    <div style={styles.app}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.logo} aria-hidden>
            CC
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>ClassConnect</div>
            <div style={styles.smallMuted}>Messaging</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: connected ? "#2b7cff" : "#7b8794" }}>
              {connected ? "Connected" : "Disconnected"}
            </div>
          </div>
        </header>

        <main style={styles.left}>
          <section style={styles.chatCard} aria-label="Messages">
            <div style={styles.messages} ref={messagesRef} aria-live="polite" tabIndex={0}>
              {messages.map((m) => {
                const cls = m.from === "me" ? styles.messageMe : styles.messageThem;
                return (
                  <div key={String(m.id)} style={cls}>
                    {m.text}
                    {m.created_at ? (
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, textAlign: "right" }}>
                        {new Date(m.created_at).toLocaleTimeString()}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <form style={styles.composer} onSubmit={onSubmit} aria-label="Send message">
              <input
                style={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Type a message and press Enter..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                aria-label="Message input"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => {
                  onSubmit();
                }}
                style={styles.sendBtn}
                aria-label="Send"
                disabled={!value.trim()}
              >
                Send
              </button>
            </form>
          </section>
        </main>

        <aside style={styles.sidebar} aria-label="Conversation info">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Conversation</div>
            <div style={{ fontSize: 12, color: "#7b8794" }}>{messages.length} messages</div>
          </div>

          <div style={{ marginTop: 8, ...styles.smallMuted }}>General • Classroom</div>

          <div style={{ marginTop: 12, fontSize: 14, color: "#12263a" }}>Participants</div>
          <ul style={styles.participants}>
            <li>Alice</li>
            <li>Bob</li>
            <li>Carol</li>
          </ul>

          <div style={{ marginTop: 18, ...styles.smallMuted }}>
            Backend endpoints:
            <div style={{ fontSize: 12, marginTop: 6, color: "#344054" }}>
              WS: <code>{WS_URL}</code>
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#344054" }}>
              REST: <code>{REST_URL}</code>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* Mount into existing #root element in public/index.html */
const container = document.getElementById("root");
if (!container) throw new Error('Root element not found — add <div id="root"></div> to public/index.html');

createRoot(container).render(<App />);
