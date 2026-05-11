import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";
import api from "../lib/api";

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (error) {
    return "";
  }
}

function Chat() {
  const [searchParams] = useSearchParams();
  const workerIdFromQuery = searchParams.get("workerId") || "";
  const customerIdFromQuery = searchParams.get("customerId") || "";
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((item) => item._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const loadConversations = useCallback(async (preferredConversationId = "") => {
    try {
      setLoadingConversations(true);
      const { data } = await api.get("/chats/my");
      const list = Array.isArray(data) ? data : [];
      setConversations(list);

      if (preferredConversationId) {
        setSelectedConversationId(preferredConversationId);
      } else if (!selectedConversationId && list.length > 0) {
        setSelectedConversationId(list[0]._id);
      } else if (selectedConversationId && !list.some((item) => item._id === selectedConversationId)) {
        setSelectedConversationId(list[0]?._id || "");
      }
    } catch (loadError) {
      setError("Could not load chats.");
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);


  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      setError("");
      const { data } = await api.get(`/chats/${conversationId}/messages`);
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(list);
      await api.patch(`/chats/${conversationId}/read`);
      setConversations((current) => current.map((item) => (
        item._id === conversationId ? { ...item, unreadCount: 0 } : item
      )));
    } catch (loadError) {
      setError("Could not load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);


  useEffect(() => {
    const startChatIfNeeded = async () => {
      if (!workerIdFromQuery && !customerIdFromQuery) {
        await loadConversations();
        return;
      }

      try {
        const payload = workerIdFromQuery
          ? { workerId: workerIdFromQuery }
          : { customerId: customerIdFromQuery };
        const { data } = await api.post("/chats/start", payload);
        await loadConversations(data?._id);
      } catch (startError) {
        await loadConversations();
      }
    };

    startChatIfNeeded();
  }, [workerIdFromQuery, customerIdFromQuery, loadConversations]);


  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);


  useEffect(() => {
    const onChatMessage = (event) => {
      const incoming = event.detail;
      if (!incoming?.conversationId) return;

      setConversations((current) => {
        const existing = current.find((item) => item._id === incoming.conversationId);
        if (!existing) {
          loadConversations(incoming.conversationId);
          return current;
        }
        return current.map((item) => {
          if (item._id !== incoming.conversationId) return item;
          const isActive = item._id === selectedConversationId;
          return {
            ...item,
            lastMessage: incoming.text,
            lastMessageAt: incoming.createdAt,
            unreadCount: isActive ? 0 : (item.unreadCount || 0) + 1
          };
        });
      });

      if (incoming.conversationId === selectedConversationId) {
        setMessages((current) => (
          current.some((msg) => msg._id === incoming._id) ? current : [...current, incoming]
        ));
        api.patch(`/chats/${incoming.conversationId}/read`).catch(() => {});
      }
    };

    const onChatRead = (event) => {
      const incoming = event.detail;
      if (!incoming?.conversationId || incoming.conversationId !== selectedConversationId) return;
      setMessages((current) => current.map((item) => ({ ...item, isRead: true })));
    };

    window.addEventListener("app:chat:message", onChatMessage);
    window.addEventListener("app:chat:read", onChatRead);

    return () => {
      window.removeEventListener("app:chat:message", onChatMessage);
      window.removeEventListener("app:chat:read", onChatRead);
    };
  }, [selectedConversationId, loadConversations]);


  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedConversationId || !messageText.trim()) return;

    try {
      setSending(true);
      const { data } = await api.post(`/chats/${selectedConversationId}/messages`, { text: messageText.trim() });
      setMessages((current) => (
        current.some((item) => item._id === data._id) ? current : [...current, data]
      ));
      setConversations((current) => current.map((item) => (
        item._id === selectedConversationId
          ? { ...item, lastMessage: data.text, lastMessageAt: data.createdAt }
          : item
      )));
      setMessageText("");
    } catch (sendError) {
      setError(sendError.response?.data?.error || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold text-white">In-App Chat</h1>
      {error && <p className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-rose-200">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Conversations</h2>
          {loadingConversations && <div className="h-24 animate-pulse rounded-2xl bg-white/10" />}
          {!loadingConversations && conversations.length === 0 && (
            <p className="text-sm text-slate-400">No chat started yet.</p>
          )}
          {!loadingConversations && conversations.length > 0 && (
            <div className="space-y-2">
              {conversations.map((item) => (
                <button
                  key={item._id}
                  onClick={() => setSelectedConversationId(item._id)}
                  className={`w-full rounded-2xl px-3 py-3 text-left ${item._id === selectedConversationId ? "bg-cyan-500/20" : "bg-slate-900/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-100">{item.otherUser?.name || "User"}</p>
                    {item.unreadCount > 0 && (
                      <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-xs font-semibold text-slate-950">
                        {item.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.lastMessage || "No messages yet"}</p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-[520px] flex-col rounded-3xl border border-white/10 bg-white/5 p-4">
          {!selectedConversation && (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Select a conversation to start chatting.
            </div>
          )}

          {selectedConversation && (
            <>
              <div className="mb-3 border-b border-white/10 pb-3">
                <h2 className="text-xl font-semibold text-white">{selectedConversation.otherUser?.name || "User"}</h2>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {loadingMessages && <div className="h-24 animate-pulse rounded-2xl bg-white/10" />}
                {!loadingMessages && messages.length === 0 && (
                  <p className="text-sm text-slate-400">No messages yet.</p>
                )}
                {!loadingMessages && messages.map((msg) => {
                  const senderId = typeof msg.senderId === "object" && msg.senderId !== null ? msg.senderId._id : msg.senderId;
                  const isMine = String(senderId) !== String(selectedConversation.otherUser?._id);
                  return (
                    <div key={msg._id} className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? "ml-auto bg-cyan-500/20" : "bg-slate-900/70"}`}>
                      <p className="text-sm text-slate-100">{msg.text}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatTime(msg.createdAt)}</p>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="mt-3 flex gap-2">
                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-2 text-slate-100"
                />
                <button disabled={sending || !messageText.trim()} className="rounded-2xl bg-cyan-400 px-4 py-2 font-medium text-slate-950 disabled:opacity-60">
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default Chat;
