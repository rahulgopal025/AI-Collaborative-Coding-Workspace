import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";

export interface Activity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  details: Record<string, any>;
  created_at?: string;
  createdAt?: string;
  user?: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export const useActivities = (projectIds: string[]) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const projectIdsString = [...projectIds].sort().join(',');

  const fetchActivities = useCallback(async () => {
    const ids = projectIdsString ? projectIdsString.split(',').filter(Boolean) : [];
    if (ids.length === 0) {
      setActivities(prev => prev.length === 0 ? prev : []);
      return;
    }

    setLoading(true);
    try {
      // Fetch activities for all projects in parallel
      const promises = ids.map((id) =>
        apiRequest<{ data: Activity[] }>(`/projects/${id}/activities?limit=5`)
          .then((res) => (Array.isArray(res) ? res : res?.data || []))
          .catch(() => [])
      );

      const results = await Promise.all(promises);
      // Flatten, sort by date descending, and take top 10
      const allActivities = results
        .flat()
        .sort((a, b) => new Date(b.created_at || b.createdAt || '').getTime() - new Date(a.created_at || a.createdAt || '').getTime())
        .slice(0, 10);

      setActivities(prev => JSON.stringify(prev) === JSON.stringify(allActivities) ? prev : allActivities);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  }, [projectIdsString]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, refetch: fetchActivities };
};
