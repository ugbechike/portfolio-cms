import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { kindSchema } from "@portfolio/contracts";
import { requireAdmin } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { Overview } from "@/modules/dashboard/Overview";
import { Collection } from "@/modules/content/Collection";
import { Editor } from "@/modules/content/Editor";
import { MediaLibrary } from "@/modules/media/MediaLibrary";
export const getServerSideProps: GetServerSideProps = requireAdmin;
const Workspace = ({ email }: { email: string }) => {
  const router = useRouter();
  const path = (router.query.path as string[] | undefined) ?? [];
  const [section, id] = path;
  const kind = kindSchema.safeParse(
    section === "playground" ? "projects" : section,
  );
  return (
    <Layout email={email}>
      {!section ? (
        <Overview />
      ) : section === "media" ? (
        <MediaLibrary />
      ) : section === "settings" ? (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">WORKSPACE</p>
              <h1>Settings</h1>
            </div>
          </div>
          <section className="panel padded">
            <h2>Connected account</h2>
            <p>{email}</p>
            <p className="muted">
              Administrator access is managed with the server-side ADMIN_USER_ID
              environment variable.
            </p>
            <hr />
            <h2>Publication & security</h2>
            <p>
              Content is private by default. Only explicitly published snapshots
              are returned by the public API. Images use private storage and
              short-lived signed URLs.
            </p>
            <p className="muted">
              Deployment and connection settings are configured through
              environment variables. See the repository’s deployment guide.
            </p>
          </section>
        </>
      ) : kind.success ? (
        id ? (
          <Editor key={`${kind.data}/${id}`} kind={kind.data} id={id} />
        ) : (
          <Collection
            key={section}
            kind={kind.data}
            playground={section === "playground"}
          />
        )
      ) : (
        <div className="empty">
          <h1>Page not found</h1>
          <a href="/">Back to overview</a>
        </div>
      )}
    </Layout>
  );
};
export default Workspace;
