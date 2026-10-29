import { z } from "zod";
export const kindSchema = z.enum([
  "projects",
  "experiences",
  "notes",
  "profile",
]);
export type Kind = z.infer<typeof kindSchema>;
export const httpUrl = z
  .string()
  .url()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS URL");
const text = z.string().max(50000);
const short = z.string().max(500);
const strings = z.array(z.string().min(1).max(2000)).max(100);
export const linkSchema = z.object({ label: short.min(1), url: httpUrl });
export const metricSchema = z.object({
  label: short.min(1),
  value: short.min(1),
});
export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), title: short, body: text }),
  z.object({ type: z.literal("bullets"), title: short, items: strings }),
  z.object({
    type: z.literal("decision"),
    title: short,
    context: text,
    decision: text,
    tradeoffs: text,
  }),
  z.object({
    type: z.literal("challenge"),
    title: short,
    challenge: text,
    solution: text,
  }),
  z.object({
    type: z.literal("metrics"),
    title: short,
    metrics: z.array(metricSchema).max(30),
  }),
  z.object({
    type: z.literal("image"),
    title: short,
    mediaId: z.string().uuid(),
    alt: short.min(1),
  }),
  z.object({
    type: z.literal("code"),
    title: short,
    language: short,
    code: text,
  }),
  z.object({ type: z.literal("diagram"), title: short, source: text }),
  z.object({
    type: z.literal("links"),
    title: short,
    links: z.array(linkSchema).max(30),
  }),
]);
export type Section = z.infer<typeof sectionSchema>;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
const base = {
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().max(1000).default(""),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  mediaIds: z.array(z.string().uuid()).max(100).default([]),
  links: z.array(linkSchema).max(30).default([]),
};
export const projectSchema = z.object({
  ...base,
  kind: z.literal("projects"),
  description: text.default(""),
  projectType: z.enum(["client", "personal"]).default("personal"),
  role: short.default(""),
  ownership: short.default(""),
  technologies: strings.default([]),
  startDate: date.nullable().default(null),
  endDate: date.nullable().default(null),
  challenges: strings.default([]),
  contributions: strings.default([]),
  decisions: strings.default([]),
  outcomes: strings.default([]),
  metrics: z.array(metricSchema).max(30).default([]),
  sections: z.array(sectionSchema).max(100).default([]),
  repositoryUrl: httpUrl.or(z.literal("")).default(""),
  liveUrl: httpUrl.or(z.literal("")).default(""),
  packageUrl: httpUrl.or(z.literal("")).default(""),
  documentationUrl: httpUrl.or(z.literal("")).default(""),
});
export const experienceSchema = z.object({
  ...base,
  kind: z.literal("experiences"),
  organization: short.min(1),
  role: short.min(1),
  engagementType: z.enum(["employment", "client"]).default("employment"),
  startDate: date,
  endDate: date.nullable().default(null),
  contributions: strings.default([]),
  outcomes: strings.default([]),
});
export const noteSchema = z.object({
  ...base,
  kind: z.literal("notes"),
  markdown: text.default(""),
  tags: strings.default([]),
});
export const profileSchema = z.object({
  ...base,
  kind: z.literal("profile"),
  slug: z.literal("profile"),
  headline: short.default(""),
  biography: text.default(""),
  skills: strings.default([]),
});
export const contentSchema = z
  .discriminatedUnion("kind", [
    projectSchema,
    experienceSchema,
    noteSchema,
    profileSchema,
  ])
  .superRefine((v, ctx) => {
    if ("startDate" in v && v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must follow start date",
      });
  });
export type Content = z.infer<typeof contentSchema>;
export const saveSchema = z.object({
  content: contentSchema,
  expectedVersion: z.number().int().positive(),
});
export const versionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).default(""),
  status: z.enum(["draft", "published", "archived"]).optional(),
  projectType: z.enum(["client", "personal"]).optional(),
});
export type ListQuery = z.infer<typeof listSchema>;
export type ContentRecord = {
  id: string;
  kind: Kind;
  slug: string;
  draft: Content;
  published: Content | null;
  publishedSlug: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
export type Revision = {
  id: string;
  contentId: string;
  content: Content;
  version: number;
  action: string;
  actorId: string;
  createdAt: string;
};
export type Media = {
  id: string;
  path: string;
  mime: string;
  size: number;
  alt: string;
  createdAt: string;
};
export const importSchema = z.object({
  records: z
    .array(
      z.object({
        id: z.string().uuid(),
        updatedAt: z.string().datetime(),
        content: contentSchema,
      }),
    )
    .max(1000),
});
export const newContent = (kind: Kind): Content =>
  contentSchema.parse({
    kind,
    title: "Untitled",
    slug: kind === "profile" ? "profile" : "untitled",
    ...(kind === "experiences"
      ? {
          organization: "Organization",
          role: "Role",
          startDate: new Date().toISOString().slice(0, 10),
        }
      : {}),
  });
export const mediaReferences = (content: Content): string[] => [
  ...new Set([
    ...content.mediaIds,
    ...(content.kind === "projects"
      ? content.sections
          .filter(
            (s): s is Extract<Section, { type: "image" }> => s.type === "image",
          )
          .map((s) => s.mediaId)
      : []),
  ]),
];
