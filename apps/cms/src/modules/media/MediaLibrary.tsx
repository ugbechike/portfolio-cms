import { useEffect, useState, type FormEvent } from "react";
import { Upload, Image as ImageIcon, Copy, Trash2 } from "lucide-react";
import type { Media } from "@portfolio/contracts";
import { api } from "@/lib/api";
export const MediaLibrary = () => {
  const [media, setMedia] = useState<Media[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const result = await api<Media[]>("/media");
      setMedia(result.data);
      const values = await Promise.all(
        result.data.map(async (m) => [
          m.id,
          (await api<{ url: string }>(`/media/${m.id}/url`)).data.url,
        ]),
      );
      setUrls(Object.fromEntries(values));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load media");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const upload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (
      file.size > 10485760 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("Choose a PNG, JPEG, or WebP up to 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/media", { method: "POST", body: data });
      form.reset();
      setNotice("Image uploaded. Copy its ID to reference it in your content.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (
      !window.confirm("Delete this image? Referenced images cannot be deleted.")
    )
      return;
    try {
      await api(`/media/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE VISUAL DETAILS</p>
          <h1>Media library</h1>
          <p className="muted">
            Screenshots and images that bring your work to life.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error notice">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <form className="upload-panel" onSubmit={upload}>
        <Upload size={24} />
        <div>
          <h3>Add an image</h3>
          <p className="small muted">
            PNG, JPEG or WebP · Up to 10 MB · Private until referenced by
            published content
          </p>
        </div>
        <label>
          Alternative text
          <input
            name="alt"
            required
            maxLength={500}
            placeholder="Describe the image"
          />
        </label>
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          aria-label="Choose image"
        />
        <button className="button primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload image"}
        </button>
      </form>
      <div className="media-grid">
        {media.map((m) => (
          <article className="media-card" key={m.id}>
            {urls[m.id] ? <img src={urls[m.id]} alt={m.alt} /> : <ImageIcon />}
            <div>
              <strong>{m.alt}</strong>
              <p className="small muted">
                {m.mime} · {Math.round(m.size / 1024)} KB
              </p>
              <div className="actions">
                <button
                  className="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(m.id);
                    setNotice("Media ID copied.");
                  }}
                >
                  <Copy size={14} />
                  Copy ID
                </button>
                <button
                  className="button"
                  aria-label={`Delete ${m.alt}`}
                  onClick={() => void remove(m.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!media.length && (
        <div className="empty">
          <ImageIcon />
          <h3>A place for the details.</h3>
          <p>Upload your first image to start your library.</p>
        </div>
      )}
    </>
  );
};
