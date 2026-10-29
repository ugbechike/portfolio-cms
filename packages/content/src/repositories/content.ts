import { and, eq, desc, sql, ilike, or, isNotNull } from "drizzle-orm";
import {
  entries,
  revisions,
  media,
  mediaRefs,
  type Database,
} from "@portfolio/database";
import {
  mediaReferences,
  type ContentRecord,
  type Content,
  type Kind,
  type ListQuery,
} from "@portfolio/contracts";
export class ContentError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const createRepository = (db: Database) => {
  const get = async (id: string) =>
    (await db.select().from(entries).where(eq(entries.id, id)))[0];
  const list = async (kind: Kind, query: ListQuery, publicOnly = false) => {
    const conditions = [eq(entries.kind, kind)];
    if (publicOnly) conditions.push(isNotNull(entries.published));
    else if (query.status) conditions.push(eq(entries.status, query.status));
    const doc = publicOnly ? entries.published : entries.draft;
    if (query.q)
      conditions.push(sql`${doc}->>'title' ILIKE ${"%" + query.q + "%"}`);
    if (query.projectType)
      conditions.push(sql`${doc}->>'projectType' = ${query.projectType}`);
    const where = and(...conditions);
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(entries)
      .where(where);
    const rows = await db
      .select()
      .from(entries)
      .where(where)
      .orderBy(
        sql`(${doc}->>'featured')::boolean DESC`,
        sql`(${doc}->>'sortOrder')::integer ASC`,
        desc(entries.updatedAt),
        entries.id,
      )
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { rows, total: count?.count ?? 0 };
  };
  const mutate = async (
    id: string,
    kind: Kind,
    actorId: string,
    action: string,
    expectedVersion: number | undefined,
    draft?: Content,
  ): Promise<ContentRecord> =>
    db.transaction(async (tx) => {
      const [old] = await tx
        .select()
        .from(entries)
        .where(eq(entries.id, id))
        .for("update");
      if (action === "create" && old)
        throw new ContentError(
          409,
          "CONFLICT",
          "This identifier already exists",
        );
      if (action !== "create" && (!old || old.kind !== kind))
        throw new ContentError(404, "NOT_FOUND", "Content not found");
      if (old && old.version !== expectedVersion)
        throw new ContentError(
          409,
          "VERSION_CONFLICT",
          "Content changed. Reload before saving.",
        );
      const now = new Date().toISOString();
      const value: ContentRecord = old
        ? { ...old, version: old.version + 1, updatedAt: now }
        : {
            id,
            kind,
            slug: draft!.slug,
            draft: draft!,
            published: null,
            publishedSlug: null,
            status: "draft",
            version: 1,
            createdAt: now,
            updatedAt: now,
            publishedAt: null,
          };
      if (draft) {
        value.draft = draft;
        value.slug = draft.slug;
      }
      if (action === "publish") {
        value.published = value.draft;
        value.publishedSlug = value.draft.slug;
        value.status = "published";
        value.publishedAt = now;
      }
      if (action === "unpublish" || action === "archive") {
        value.published = null;
        value.publishedSlug = null;
        value.publishedAt = null;
        value.status = action === "archive" ? "archived" : "draft";
      }
      if (action === "save" && value.status === "archived")
        value.status = "draft";
      await tx
        .insert(revisions)
        .values({
          contentId: id,
          content: action === "delete" ? old!.draft : value.draft,
          version: value.version,
          action,
          actorId,
        });
      if (action === "delete") {
        await tx.delete(entries).where(eq(entries.id, id));
        return value;
      }
      if (old) await tx.update(entries).set(value).where(eq(entries.id, id));
      else await tx.insert(entries).values(value);
      await tx.delete(mediaRefs).where(eq(mediaRefs.contentId, id));
      const refs = [
        ...new Set([
          ...mediaReferences(value.draft),
          ...(value.published ? mediaReferences(value.published) : []),
        ]),
      ];
      if (refs.length)
        await tx
          .insert(mediaRefs)
          .values(refs.map((mediaId) => ({ contentId: id, mediaId })));
      return value;
    });
  return {
    get,
    list,
    mutate,
    publicBySlug: async (kind: Kind, slug: string) =>
      (
        await db
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.kind, kind),
              eq(entries.publishedSlug, slug),
              isNotNull(entries.published),
            ),
          )
      )[0],
    history: (id: string) =>
      db
        .select()
        .from(revisions)
        .where(eq(revisions.contentId, id))
        .orderBy(desc(revisions.version))
        .limit(100),
    recent: () =>
      db.select().from(revisions).orderBy(desc(revisions.createdAt)).limit(12),
    mediaList: () =>
      db.select().from(media).orderBy(desc(media.createdAt)).limit(100),
    mediaGet: async (id: string) =>
      (await db.select().from(media).where(eq(media.id, id)))[0],
    mediaAdd: async (value: typeof media.$inferInsert) =>
      (await db.insert(media).values(value).returning())[0],
    mediaDelete: async (id: string) => db.delete(media).where(eq(media.id, id)),
    mediaIsPublic: async (id: string) => {
      const rows = await db
        .select({ published: entries.published })
        .from(mediaRefs)
        .innerJoin(entries, eq(mediaRefs.contentId, entries.id))
        .where(and(eq(mediaRefs.mediaId, id), isNotNull(entries.published)));
      return rows.some(
        (r) => r.published && mediaReferences(r.published).includes(id),
      );
    },
  };
};
export type Repository = ReturnType<typeof createRepository>;
