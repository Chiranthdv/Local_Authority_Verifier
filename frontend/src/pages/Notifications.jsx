import { useEffect, useState } from "react";
import api from "../lib/api";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = async ({ append = false } = {}) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");
      const params = { limit: 20 };
      if (append && nextCursor) {
        params.cursor = nextCursor;
      }

      const { data } = await api.get("/notifications/me", { params });
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.notifications) ? data.notifications : []));

      setNotifications((current) => {
        if (!append) {
          return list;
        }

        const existingIds = new Set(current.map((item) => item._id));
        const incoming = list.filter((item) => !existingIds.has(item._id));
        return [...current, ...incoming];
      });

      if (!Array.isArray(data)) {
        setNextCursor(data?.nextCursor || "");
        setHasMore(Boolean(data?.hasMore && data?.nextCursor));
      } else {
        setNextCursor("");
        setHasMore(false);
      }
    } catch (loadError) {
      setError("Could not load notifications.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadNotifications({ append: false });

    const handleRealtimeNotification = (event) => {
      const incoming = event.detail;
      if (!incoming?._id) {
        return;
      }

      setNotifications((current) => {
        if (current.some((item) => item._id === incoming._id)) {
          return current;
        }
        return [incoming, ...current];
      });
    };

    window.addEventListener("app:notification:new", handleRealtimeNotification);

    return () => {
      window.removeEventListener("app:notification:new", handleRealtimeNotification);
    };
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) => current.map((item) => (
        item._id === id
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item
      )));
    } catch (actionError) {
      setError("Could not mark notification as read.");
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (actionError) {
      setError("Could not mark all notifications as read.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-white">Notifications</h1>
        <button onClick={markAllRead} className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950">
          Mark All Read
        </button>
      </div>

      {error && <p className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-rose-200">{error}</p>}
      {loading && <div className="h-40 animate-pulse rounded-3xl bg-white/5" />}

      {!loading && notifications.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
          No notifications yet.
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((item) => (
            <article
              key={item._id}
              className={`rounded-2xl border p-4 ${item.isRead ? "border-white/10 bg-white/5" : "border-cyan-300/40 bg-cyan-500/10"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                {!item.isRead && (
                  <button onClick={() => markRead(item._id)} className="rounded-full border border-cyan-300/70 px-3 py-1 text-xs text-cyan-200">
                    Mark Read
                  </button>
                )}
              </div>
              <p className="mt-1 text-slate-300">{item.message}</p>
              <p className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
            </article>
          ))}
          {hasMore && (
            <button
              onClick={() => loadNotifications({ append: true })}
              disabled={loadingMore}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Notifications;
