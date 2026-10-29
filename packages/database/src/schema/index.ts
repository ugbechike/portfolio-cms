import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { Content, Kind } from "@portfolio/contracts";
export const entries = pgTable(
  "content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<Kind>().notNull(),
    slug: text("slug").notNull(),
    draft: jsonb("draft").$type<Content>().notNull(),
    published: jsonb("published").$type<Content>(),
    publishedSlug: text("published_slug"),
    status: text("status")
      .$type<"draft" | "published" | "archived">()
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    uniqueIndex("content_kind_slug").on(t.kind, t.slug),
    uniqueIndex("content_published_slug").on(t.kind, t.publishedSlug),
    index("content_kind_status").on(t.kind, t.status),
  ],
);
export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id").notNull(),
    content: jsonb("content").$type<Content>().notNull(),
    version: integer("version").notNull(),
    action: text("action").notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("revisions_content").on(t.contentId),
    index("revisions_recent").on(t.createdAt),
  ],
);
export const media = pgTable("media", {
  id: uuid("id").primaryKey(),
  path: text("path").notNull().unique(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  alt: text("alt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});
export const mediaRefs = pgTable(
  "content_media",
  {
    contentId: uuid("content_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentId, t.mediaId] }),
    index("content_media_asset").on(t.mediaId),
  ],
);
