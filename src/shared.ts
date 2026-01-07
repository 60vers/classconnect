export const names = [
  "Sparky",
  "Nova",
  "Orion",
  "Astra",
  "Echo",
  "Indigo",
  "Pixel",
  "Rook",
  "Kit",
  "Milo",
];

export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "system";
  to?: string | null; // recipient username for DMs (optional)
  createdAt?: number;
};

export type ServerToClient =
  | {
      type: "users";
      users: { id: string; name: string }[];
    }
  | {
      type: "init";
      messages: ChatMessage[];
      users: { id: string; name: string }[];
    }
  | {
      type: "add";
      message: ChatMessage;
    }
  | {
      type: "dm";
      message: ChatMessage;
      toUserId: string;
    };

export type ClientToServer =
  | { type: "join"; name: string }
  | { type: "setName"; name: string }
  | { type: "add"; message: Omit<ChatMessage, "createdAt"> }
  | { type: "dm"; message: Omit<ChatMessage, "createdAt">; toUserId: string }
  | { type: "leave" };
