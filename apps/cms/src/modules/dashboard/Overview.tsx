import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Folder,
  FileText,
  Briefcase,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Revision } from "@portfolio/contracts";
type Dashboard = {
  totals: { kind: string; total: number }[];
  published: number;
  drafts: number;
  recent: Revision[];
};
export const Overview = () => {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Dashboard>("/dashboard")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
          <h1>Make your work speak.</h1>
          <p className="muted">
            A little perspective on everything you’re building.
          </p>
        </div>
        <Link href="/projects/new" className="button primary">
          <Plus size={17} />
          New project
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="stats">
        {[
          [
            "Total projects",
            data?.totals.find((t) => t.kind === "projects")?.total,
            "Across client & personal work",
          ],
          ["Published", data?.published, "Live on your public API"],
          ["In progress", data?.drafts, "Ideas taking shape"],
          [
            "Experience",
            data?.totals.find((t) => t.kind === "experiences")?.total,
            "Chapters of your career",
          ],
          [
            "Notes",
            data?.totals.find((t) => t.kind === "notes")?.total,
            "Thoughts worth sharing",
          ],
        ].map(([label, value, hint]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
            <span className="small muted">
              <Clock size={14} /> Latest changes
            </span>
          </div>
          {!data && !error ? (
            <p className="empty">Loading your workspace…</p>
          ) : data?.recent.length ? (
            <div className="activity">
              {data.recent.map((r) => (
                <div className="activity-row" key={r.id}>
                  <span className="activity-icon">
                    <FileText size={16} />
                  </span>
                  <div>
                    <Link href={`/${r.content.kind}/${r.contentId}`}>
                      {r.content.title}
                    </Link>
                    <small>
                      {r.action} · revision {r.version}
                    </small>
                  </div>
                  <time>
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty-icon">
                <Clock />
              </span>
              <h3>A clean slate.</h3>
              <p>
                Your edits, publications, and new ideas
                <br />
                will find a home here.
              </p>
              <Link href="/projects/new" className="text-link">
                Create your first project <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <aside className="start-panel">
          <span className="eyebrow">KEEP THE MOMENTUM</span>
          <h2>
            What’s next
            <br />
            for your story?
          </h2>
          <p>
            Big launches. Small experiments.
            <br />
            The lessons in between.
            <br />
            They all belong here.
          </p>
          {[
            ["/projects/new", "Document a project", Folder],
            ["/notes/new", "Write an engineering note", FileText],
            ["/experiences/new", "Add an experience", Briefcase],
          ].map(([href, label, Icon]) => {
            const I = Icon as typeof Folder;
            return (
              <Link
                className="quick-link"
                href={href as string}
                key={href as string}
              >
                <I size={18} />
                {label as string}
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
          <div className="draft-note">
            <span className="online" /> Your drafts stay private until you
            publish.
          </div>
        </aside>
      </div>
    </>
  );
};
