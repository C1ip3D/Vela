"use client";
import { useState, useEffect, useCallback } from "react";
import { useCanvas } from "@/contexts/CanvasContext";
import { getMockAdvisorLogs } from "@/lib/canvas/client";

export function useCanvasNotifications() {
    const { token, isConnected } = useCanvas();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!isConnected || !token) {
            setLogs(getMockAdvisorLogs());
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/canvas/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (!res.ok) throw new Error("Failed to fetch notifications");

            const data = await res.json();
            setLogs(data.logs);
        } catch (err: any) {
            setError(err.message);
            setLogs(getMockAdvisorLogs());
        } finally {
            setLoading(false);
        }
    }, [token, isConnected]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const unreadLogs = logs.filter((l) => !l.isRead);

    return { logs, unreadLogs, loading, error, refetch: fetchNotifications };
}
