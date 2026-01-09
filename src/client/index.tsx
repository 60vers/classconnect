import { useEffect, useState, useRef } from "react";
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
import { Hash, Plus, Send } from "lucide-react";
import "./index.css";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
  const { room } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [name] = useState(() => {
    const stored = localStorage.getItem("cc:name");
    if (stored) return stored;
    const n = names[Math.floor(Math.random() * names.length)];
    localStorage.setItem("cc:name", n);
    return n;
  });

  const [servers, setServers] = useState<string[]>(() => {
    const stored = localStorage.getItem("cc:servers");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (room && !servers.includes(room)) {
      const updated = [...servers, room];
      setServers(updated);
      localStorage.setItem("cc:servers", JSON.stringify(updated));
    }
  }, [room, servers]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const socket = usePartySocket({
    party: "chat",
    room,
    onOpen() {
      socket.send(
        JSON.stringify({
          type: "presence",
          action: "join",
          user: name,
        })
      );
    },
    onClose() {
      socket.send(
        JSON.stringify({
          type: "presence",
          action: "leave",
          user: name,
        })
      );
    },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);

      if (msg.type === "presence") {
        setParticipants((prev) => {
          if (msg.action === "join") {
            return prev.includes(msg.user) ? prev : [...prev, msg.user];
          }
          if (msg.action === "leave") {
            return prev.filter((u) => u !== msg.user);
          }
          return prev;
        });
        return;
      }

      if (msg.type === "add") {
        setMessages((m) => [...m, msg]);
      } else if (Array.isArray(msg.messages)) {
        setMessages(msg.messages);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text: string) => {
    const message: ChatMessage = {
      id: nanoid(),
      content: text,
      user: name,
      role: "user",
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, message]);
    socket.send(JSON.stringify({ type: "add", ...message } satisfies Message));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    send(messageInput);
    setMessageInput("");
  };

  const initials = (userName: string) => {
    return userName.slice(0, 2).toUpperCase();
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="w-screen h-screen flex bg-slate-900 text-gray-100 overflow-hidden">
      <aside className="w-[72px] bg-slate-950 flex flex-col items-center py-3 gap-2">
        {servers.map((s) => (
          <button
            key={s}
            onClick={() => navigate(`/${s}`)}
            className={`
              w-12 h-12 rounded-2xl font-bold text-sm transition-all duration-200
              hover:rounded-xl hover:bg-blue-600
              ${s === room
                ? "bg-blue-600 rounded-xl"
                : "bg-slate-800 text-gray-300"
              }
            `}
          >
            {initials(s)}
          </button>
        ))}
        <button
          onClick={() => navigate(`/${nanoid()}`)}
          className="w-12 h-12 rounded-2xl bg-slate-800 text-green-500 font-bold text-2xl transition-all duration-200 hover:rounded-xl hover:bg-green-600 hover:text-white flex items-center justify-center"
        >
          <Plus size={24} />
        </button>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-900">
        <header className="h-14 border-b border-slate-800 px-4 flex items-center shadow-sm">
          <Hash size={24} className="text-gray-400 mr-2" />
          <span className="font-semibold text-lg">{room}</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m) => {
            const isMe = m.user === name;
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {initials(m.user)}
                </div>
                <div className={`flex flex-col ${isMe ? "items-end" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${isMe ? "order-2" : ""}`}>
                      {m.user}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                  <div
                    className={`
                      px-4 py-2.5 rounded-2xl max-w-md break-words
                      ${isMe
                        ? "bg-blue-600 text-white rounded-tr-md"
                        : "bg-slate-800 text-gray-100 rounded-tl-md"
                      }
                    `}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800">
          <div className="flex gap-2 bg-slate-800 rounded-lg px-4 py-3">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message #${room}`}
              className="flex-1 bg-transparent outline-none text-gray-100 placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </main>

      <aside className="w-60 bg-slate-900 border-l border-slate-800 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
          Online — {participants.length}
        </h3>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-xs">
                  {initials(p)}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>
              </div>
              <span className="text-sm font-medium">{p}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
    </Routes>
  </BrowserRouter>
);
