import { useCallback, useEffect, useState } from "react";
import type { Content, ContentRecord, Kind } from "@portfolio/contracts";
import { api } from "@/lib/api";
export const useCollection = (kind: Kind, query: string) => {
  const [rows, setRows] = useState<ContentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<ContentRecord[]>(`/${kind}?${query}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [kind, query]);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, total, error, loading, reload: load };
};
export const saveContent = (
  kind: Kind,
  content: Content,
  row?: ContentRecord,
) =>
  api<ContentRecord>(row ? `/${kind}/${row.id}` : `/${kind}`, {
    method: row ? "PATCH" : "POST",
    body: JSON.stringify(
      row ? { content, expectedVersion: row.version } : content,
    ),
  });
export const contentAction = (row: ContentRecord, action: string) =>
  api<ContentRecord>(
    `/${row.kind}/${row.id}${action === "delete" ? "" : `/${action}`}`,
    {
      method: action === "delete" ? "DELETE" : "POST",
      body: JSON.stringify({ expectedVersion: row.version }),
    },
  );
