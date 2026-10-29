import Link from "next/link";
import { useRouter } from "next/router";
import {
  Command,
  LayoutDashboard,
  Folder,
  Briefcase,
  FlaskConical,
  FileText,
  Image,
  User,
  Settings,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
const links = [
  ["/", "Overview", LayoutDashboard],
  ["/projects", "Projects", Folder],
  ["/experiences", "Experience", Briefcase],
  ["/playground", "Playground", FlaskConical],
  ["/notes", "Engineering notes", FileText],
  ["/media", "Media library", Image],
  ["/profile", "Profile", User],
  ["/settings", "Settings", Settings],
] as const;
export const Layout = ({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) => {
  const router = useRouter();
  const current =
    "/" + ((router.query.path as string[] | undefined)?.[0] ?? "");
  return (
    <div className="workspace">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Command size={20} />
          </span>{" "}
          Portfolio <span className="muted">/ Studio</span>
        </Link>
        <div className="workspace-name">
          <span className="avatar">P</span>
          <div>
            Personal workspace<small>Administrator</small>
          </div>
          <span className="online" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={url}
              className={current === url ? "nav-link active" : "nav-link"}
            >
              <Icon size={18} />
              {label}
              {current === url && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="online" /> Built to keep you in control
            <p>
              Draft freely.
              <br />
              Publish when it’s ready.
            </p>
          </div>
          <button
            className="nav-link"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.assign("/login");
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            Workspace{" "}
            <span className="muted">
              / {links.find((l) => l[0] === current)?.[1] ?? "Editor"}
            </span>
          </span>
          <span className="account">
            <span className="online" /> Private workspace{" "}
            <span className="avatar">
              {email.slice(0, 1).toUpperCase() || "P"}
            </span>
          </span>
        </header>
        <main id="main" className="main">
          {children}
        </main>
        <footer>
          Portfolio Studio{" "}
          <span>
            Made for the work that matters. <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
};
