import { useCallback, useEffect, useState } from "react";
import { listOperations, undoLastOperation } from "@/lib/tauri";
import type { OperationHistoryItem } from "@/types/media";

export function useOperations() {
  const [operations, setOperations] = useState<OperationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOperations(await listOperations());
    } catch (err) {
      console.error("Failed to load operations", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const undo = useCallback(async () => {
    const message: string = await undoLastOperation();
    await refresh();
    return message;
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { operations, loading, refresh, undo };
}
