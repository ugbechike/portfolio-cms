import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Save,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Eye,
  History,
} from "lucide-react";
import {
  contentSchema,
  newContent,
  type Content,
  type ContentRecord,
  type Kind,
  type Revision,
  type Section,
} from "@portfolio/contracts";
import { api } from "@/lib/api";
import { saveContent, contentAction } from "./useContent";
import {
  fieldsFor,
  sectionFields,
  emptySection,
  displayValue,
  parseValue,
  type Field,
} from "./fields";
import { Preview } from "./Preview";
const formSchema = z.object({ content: contentSchema });
type Form = z.infer<typeof formSchema>;
export const Editor = ({ kind, id }: { kind: Kind; id: string }) => {
  const router = useRouter();
  const [sectionEpoch, setSectionEpoch] = useState(0);
  const [row, setRow] = useState<ContentRecord>();
  const [loading, setLoading] = useState(id !== "new");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("edit");
  const [history, setHistory] = useState<Revision[]>([]);
  const [sectionType, setSectionType] = useState<Section["type"]>("text");
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: newContent(kind) },
  });
  const content = watch("content");
  const sections = content.kind === "projects" ? content.sections : [];
  useEffect(() => {
    if (id === "new") return;
    api<ContentRecord>(`/${kind}/${id}`)
      .then((r) => {
        setRow(r.data);
        reset({ content: r.data.draft });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, kind, reset]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
  const accept = (value: ContentRecord, message: string) => {
    setRow(value);
    reset({ content: value.draft });
    setNotice(message);
  };
  const save = handleSubmit(
    async (values) => {
      setBusy(true);
      setError("");
      try {
        const result = await saveContent(kind, values.content, row);
        accept(
          result.data,
          "Draft saved. Your published version is unchanged.",
        );
        if (id === "new") await router.replace(`/${kind}/${result.data.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to save");
      } finally {
        setBusy(false);
      }
    },
    () => setError("Please review the form. Some fields are invalid."),
  );
  const action = async (name: string) => {
    if (!row) return;
    if (isDirty) {
      setError("Save your draft before changing publication status.");
      return;
    }
    if (
      ["publish", "delete", "archive", "unpublish"].includes(name) &&
      !window.confirm(
        name === "delete"
          ? "Delete this content? Its revisions remain in the audit log."
          : `${name[0].toUpperCase() + name.slice(1)} this content?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await contentAction(row, name);
      if (name === "delete") await router.push(`/${kind}`);
      else accept(result.data, `${name} completed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  const revisions = async () => {
    setTab("history");
    if (row)
      try {
        setHistory(
          (await api<Revision[]>(`/${kind}/${row.id}/revisions`)).data,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load revisions");
      }
  };
  const restore = async (revision: Revision) => {
    if (
      !row ||
      !window.confirm(
        "Replace your editable draft with this revision? Published content will remain unchanged.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await api<ContentRecord>(`/${kind}/${row.id}/restore`, {
        method: "POST",
        body: JSON.stringify({
          revisionId: revision.id,
          expectedVersion: row.version,
        }),
      });
      accept(r.data, "Revision restored to draft.");
      setTab("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };
  const field = (f: Field, prefix = "content") => (
    <Controller
      key={`${prefix}.${f.name}`}
      control={control}
      name={`${prefix}.${f.name}` as FieldPath<Form>}
      render={({ field: input, fieldState }) => (
        <label
          className={
            ["long", "list", "pairs", "links"].includes(f.type ?? "")
              ? "field wide"
              : "field"
          }
        >
          {f.label}
          {f.type === "select" ? (
            <select
              value={String(input.value ?? "")}
              onChange={input.onChange}
              onBlur={input.onBlur}
              ref={input.ref}
            >
              {f.options?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : ["long", "list", "pairs", "links"].includes(f.type ?? "") ? (
            <textarea
              key={`${row?.version ?? 0}-${prefix}-${f.name}`}
              defaultValue={displayValue(input.value, f.type)}
              onChange={(e) =>
                input.onChange(parseValue(e.target.value, f.type))
              }
              onBlur={input.onBlur}
              ref={input.ref}
              rows={f.name === "markdown" ? 18 : 4}
              aria-invalid={Boolean(fieldState.error)}
            />
          ) : (
            <input
              type={
                f.type === "date"
                  ? "date"
                  : f.type === "number"
                    ? "number"
                    : f.type === "url"
                      ? "url"
                      : "text"
              }
              value={displayValue(input.value, f.type)}
              onChange={(e) =>
                input.onChange(parseValue(e.target.value, f.type))
              }
              onBlur={input.onBlur}
              ref={input.ref}
              readOnly={kind === "profile" && f.name === "slug"}
              aria-invalid={Boolean(fieldState.error)}
            />
          )}
          <small>
            {fieldState.error ? (
              <span className="error">
                {fieldState.error.message ?? "Check the values in this field"}
              </span>
            ) : (
              (f.hint ??
              (f.type === "list"
                ? "One item per line."
                : f.type === "pairs"
                  ? "One per line: Label | Value"
                  : f.type === "links"
                    ? "One per line: Label | https://example.com"
                    : ""))
            )}
          </small>
        </label>
      )}
    />
  );
  const setSections = (values: Section[]) => {
    setValue("content.sections" as FieldPath<Form>, values, {
      shouldDirty: true,
    });
    setSectionEpoch((v) => v + 1);
  };
  if (loading) return <p className="empty">Loading editor…</p>;
  if (id !== "new" && !row)
    return (
      <p role="alert" className="error">
        {error || "Content not found"}
      </p>
    );
  return (
    <>
      <Link href={`/${kind}`} className="back">
        <ArrowLeft size={15} />
        Back to {kind}
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{row ? "EDIT CONTENT" : "NEW CHAPTER"}</p>
          <h1>{content.title || "Untitled"}</h1>
          <p className="small muted">
            {isDirty
              ? "Unsaved changes"
              : row
                ? `Saved · revision ${row.version}`
                : "Start with a draft"}{" "}
            {row?.published ? " · A published snapshot is live" : ""}
          </p>
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={() => setTab(tab === "preview" ? "edit" : "preview")}
          >
            <Eye size={16} />
            Preview
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void save()}
          >
            <Save size={16} />
            {busy ? "Working…" : "Save draft"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="editor-grid">
        <div>
          <div className="tabs editor-tabs">
            <button
              onClick={() => setTab("edit")}
              className={tab === "edit" ? "selected" : ""}
            >
              Content
            </button>
            <button
              onClick={() => setTab("preview")}
              className={tab === "preview" ? "selected" : ""}
            >
              Preview
            </button>
            <button
              onClick={() => void revisions()}
              className={tab === "history" ? "selected" : ""}
            >
              <History size={14} /> Revisions
            </button>
          </div>
          {tab === "preview" ? (
            <div className="panel">
              <Preview content={content} />
            </div>
          ) : tab === "history" ? (
            <section className="panel padded">
              <h2>Revision history</h2>
              <p className="muted small">Restoring changes only your draft.</p>
              {history.length ? (
                history.map((r) => (
                  <div className="revision" key={r.id}>
                    <div>
                      <strong>
                        Revision {r.version} · {r.action}
                      </strong>
                      <small>{new Date(r.createdAt).toLocaleString()}</small>
                    </div>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void restore(r)}
                    >
                      Restore draft
                    </button>
                  </div>
                ))
              ) : (
                <p>No saved revisions yet.</p>
              )}
            </section>
          ) : (
            <form onSubmit={save}>
              <section className="panel padded">
                <h2>The essentials</h2>
                <div className="form-grid">
                  {fieldsFor(kind).map((f) => field(f))}
                  <Controller
                    name="content.featured"
                    control={control}
                    render={({ field: f }) => (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={f.value}
                          onChange={f.onChange}
                        />
                        Feature this content
                      </label>
                    )}
                  />
                </div>
              </section>
              {kind === "projects" && (
                <section className="panel padded section-editor">
                  <h2>Case study</h2>
                  <p className="muted small">
                    Build the story in sections. Use the arrows to change their
                    order.
                  </p>
                  {sections.map((section, index) => (
                    <div
                      className="section-card"
                      key={`${sectionEpoch}-${index}-${section.type}`}
                    >
                      <div className="section-heading">
                        <strong>
                          {index + 1}. {section.type}
                        </strong>
                        <div>
                          <button
                            type="button"
                            aria-label="Move section up"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...sections];
                              [next[index - 1], next[index]] = [
                                next[index],
                                next[index - 1],
                              ];
                              setSections(next);
                            }}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Move section down"
                            disabled={index === sections.length - 1}
                            onClick={() => {
                              const next = [...sections];
                              [next[index + 1], next[index]] = [
                                next[index],
                                next[index + 1],
                              ];
                              setSections(next);
                            }}
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove section"
                            onClick={() =>
                              setSections(
                                sections.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {field(
                        { name: "title", label: "Section title" },
                        `content.sections.${index}`,
                      )}
                      {sectionFields[section.type].map((f) =>
                        field(f, `content.sections.${index}`),
                      )}
                    </div>
                  ))}
                  <div className="actions">
                    <select
                      aria-label="New section type"
                      value={sectionType}
                      onChange={(e) =>
                        setSectionType(e.target.value as Section["type"])
                      }
                    >
                      {Object.keys(sectionFields).map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        setSections([...sections, emptySection(sectionType)])
                      }
                    >
                      <Plus size={16} />
                      Add section
                    </button>
                  </div>
                </section>
              )}
              <button
                type="submit"
                className="button primary bottom-save"
                disabled={busy}
              >
                Save draft
              </button>
              {Object.keys(errors).length > 0 && (
                <p className="error">
                  Check all fields, including section items, URLs, and media
                  IDs.
                </p>
              )}
            </form>
          )}
        </div>
        <aside className="panel publication">
          <p className="eyebrow">PUBLICATION</p>
          <span className={`badge ${row?.status ?? "draft"}`}>
            {row?.status ?? "draft"}
          </span>
          <h3>
            You choose when
            <br />
            it goes live.
          </h3>
          <p className="muted small">
            Saving updates your draft. Publishing replaces the public snapshot
            with your latest saved version.
          </p>
          <button
            className="button primary"
            disabled={!row || busy || isDirty}
            onClick={() => void action("publish")}
          >
            {row?.published ? "Publish latest version" : "Publish content"}
          </button>
          {row?.published && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void action("unpublish")}
            >
              Unpublish
            </button>
          )}
          {row && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => void action("archive")}
              >
                Archive
              </button>
              <button
                className="danger-link"
                disabled={busy}
                onClick={() => void action("delete")}
              >
                Delete content
              </button>
            </>
          )}
          <hr />
          <p className="small muted">/{content.slug}</p>
        </aside>
      </div>
    </>
  );
};
