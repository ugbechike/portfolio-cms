import ReactMarkdown from "react-markdown";
import type { Content, Section } from "@portfolio/contracts";
import { PrivateImage } from "@/modules/media/PrivateImage";
export const SectionPreview = ({ section: s }: { section: Section }) => (
  <section className="preview-section">
    <h3>{s.title}</h3>
    {s.type === "text" ? (
      <p>{s.body}</p>
    ) : s.type === "bullets" ? (
      <ul>
        {s.items.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    ) : s.type === "decision" ? (
      <>
        <p>{s.context}</p>
        <p>{s.decision}</p>
        <p>{s.tradeoffs}</p>
      </>
    ) : s.type === "challenge" ? (
      <>
        <p>{s.challenge}</p>
        <p>{s.solution}</p>
      </>
    ) : s.type === "metrics" ? (
      <dl>
        {s.metrics.map((m, i) => (
          <div key={i}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>
    ) : s.type === "image" ? (
      <PrivateImage id={s.mediaId} alt={s.alt} />
    ) : s.type === "code" || s.type === "diagram" ? (
      <pre>
        <code>{s.type === "code" ? s.code : s.source}</code>
      </pre>
    ) : (
      <ul>
        {s.links.map((l, i) => (
          <li key={i}>
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    )}
  </section>
);
export const Preview = ({ content: c }: { content: Content }) => (
  <article className="preview">
    <p className="eyebrow">PRIVATE DRAFT PREVIEW</p>
    <h1>{c.title}</h1>
    <p className="lead">{c.summary}</p>
    {c.kind === "projects" ? (
      <>
        <p>{c.description}</p>
        <p>{c.technologies.join(" · ")}</p>
        {c.sections.map((s, i) => (
          <SectionPreview key={i} section={s} />
        ))}
      </>
    ) : c.kind === "notes" ? (
      <ReactMarkdown>{c.markdown}</ReactMarkdown>
    ) : c.kind === "profile" ? (
      <>
        <h2>{c.headline}</h2>
        <p>{c.biography}</p>
        <p>{c.skills.join(" · ")}</p>
      </>
    ) : (
      <>
        <h2>
          {c.role} · {c.organization}
        </h2>
        <p>
          {c.startDate} — {c.endDate ?? "Present"}
        </p>
        <ul>
          {c.contributions.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </>
    )}
    {c.mediaIds.map((id) => (
      <PrivateImage key={id} id={id} alt={c.title} />
    ))}
    {c.links.map((l, i) => (
      <p key={i}>
        <a href={l.url} rel="noreferrer" target="_blank">
          {l.label}
        </a>
      </p>
    ))}
  </article>
);
