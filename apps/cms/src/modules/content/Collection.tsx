import Link from "next/link";
import { useState } from "react";
import { Plus, Search, ArrowUpRight, FolderOpen } from "lucide-react";
import type { Kind } from "@portfolio/contracts";
import { useCollection } from "./useContent";
export const Collection = ({
  kind,
  playground = false,
}: {
  kind: Kind;
  playground?: boolean;
}) => {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    page: String(page),
    limit: "12",
    q: search,
    ...(status ? { status } : {}),
    ...(playground ? { projectType: "personal" } : {}),
  }).toString();
  const { rows, total, error, loading } = useCollection(kind, query);
  const label = playground
    ? "Playground"
    : kind === "notes"
      ? "Engineering notes"
      : kind === "experiences"
        ? "Experience"
        : kind === "profile"
          ? "Profile"
          : "Projects";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR CONTENT</p>
          <h1>{label}</h1>
          <p className="muted">
            {playground
              ? "Experiments, side quests, and ideas made real."
              : "A considered collection of your work and your story."}
          </p>
        </div>
        {(kind !== "profile" || !total) && (
          <Link className="button primary" href={`/${kind}/new`}>
            <Plus size={17} />
            {kind === "profile" ? "Create profile" : "Create new"}
          </Link>
        )}
      </div>
      <div className="toolbar">
        <div className="tabs">
          {["", "draft", "published", "archived"].map((s) => (
            <button
              key={s}
              className={status === s ? "selected" : ""}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s || "All content"}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search content"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
        {loading ? (
          <p className="empty">Loading content…</p>
        ) : rows.length ? (
          <div className="content-table">
            <div className="table-header">
              <span>TITLE</span>
              <span>STATUS</span>
              <span>LAST UPDATED</span>
              <span />
            </div>
            {rows.map((row) => (
              <Link
                className="content-row"
                href={`/${kind}/${row.id}`}
                key={row.id}
              >
                <div>
                  <strong>
                    {row.draft.title}
                    {row.draft.featured && (
                      <span className="featured">Featured</span>
                    )}
                  </strong>
                  <small>
                    {row.draft.summary || "Add a summary to tell the story."}
                  </small>
                </div>
                <span className={`badge ${row.status}`}>{row.status}</span>
                <time>{new Date(row.updatedAt).toLocaleDateString()}</time>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <FolderOpen />
            </span>
            <h3>
              {search || status
                ? "Nothing matches yet."
                : "Your next chapter starts here."}
            </h3>
            <p>
              {search || status
                ? "Try a different search or status."
                : "Add your first entry. Save it as a draft and make it your own."}
            </p>
            <Link href={`/${kind}/new`} className="text-link">
              Create an entry <Plus size={15} />
            </Link>
          </div>
        )}
      </section>
      <div className="pagination">
        <span className="small muted">{total} entries</span>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>{page}</span>
        <button
          disabled={page * 12 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
};
