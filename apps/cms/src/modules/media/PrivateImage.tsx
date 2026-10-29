import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export const PrivateImage = ({ id, alt }: { id: string; alt: string }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ url: string }>(`/media/${id}/url`)
      .then((r) => {
        if (active) setUrl(r.data.url);
      })
      .catch(() => {
        if (active) setError("Image unavailable. Check its media ID.");
      });
    return () => {
      active = false;
    };
  }, [id]);
  return url ? (
    <img
      src={url}
      alt={alt}
      style={{ maxWidth: "100%", height: "auto", borderRadius: 8 }}
    />
  ) : (
    <p className="muted small">{error || "Loading image…"}</p>
  );
};
