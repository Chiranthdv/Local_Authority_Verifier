import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let isMounted = true;

    const loadUnreadNotifications = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/notifications/me", {
          params: {
            unread: true,
            limit: 100
          }
        });

        const items = Array.isArray(data?.items)
          ? data.items
          : (Array.isArray(data?.notifications) ? data.notifications : []);

        if (isMounted) {
          setCount(items.length);
        }
      } catch {
        if (isMounted) {
          setCount(0);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleNewNotification = () => {
      setCount((current) => current + 1);
    };

    const handleNotificationRead = () => {
      setCount((current) => Math.max(0, current - 1));
    };

    const handleAllRead = () => {
      setCount(0);
    };

    loadUnreadNotifications();
    window.addEventListener("app:notification:new", handleNewNotification);
    window.addEventListener("app:notification:read", handleNotificationRead);
    window.addEventListener("app:notification:read-all", handleAllRead);

    return () => {
      isMounted = false;
      window.removeEventListener("app:notification:new", handleNewNotification);
      window.removeEventListener("app:notification:read", handleNotificationRead);
      window.removeEventListener("app:notification:read-all", handleAllRead);
    };
  }, [user]);

  return { unreadCount: count, loading };
}
