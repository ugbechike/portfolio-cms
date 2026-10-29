import type { Content, Section } from "@portfolio/contracts";
export type Field = {
  name: string;
  label: string;
  type?:
    | "long"
    | "list"
    | "date"
    | "url"
    | "number"
    | "pairs"
    | "links"
    | "select";
  options?: string[];
  hint?: string;
};
export const fieldsFor = (kind: Content["kind"]): Field[] => [
  { name: "title", label: kind === "profile" ? "Name" : "Title" },
  {
    name: "slug",
    label: "URL slug",
    hint: "Lowercase words separated by hyphens.",
  },
  {
    name: "summary",
    label: "Summary",
    type: "long",
    hint: "A short introduction. Required before publishing.",
  },
  ...(kind === "projects"
    ? ([
        { name: "description", label: "Description", type: "long" },
        {
          name: "projectType",
          label: "Project type",
          type: "select",
          options: ["client", "personal"],
        },
        { name: "role", label: "Your role" },
        { name: "ownership", label: "Ownership level" },
        { name: "technologies", label: "Technologies", type: "list" },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "endDate", label: "End date", type: "date" },
        ...["challenges", "contributions", "decisions", "outcomes"].map(
          (name) => ({
            name,
            label: name[0].toUpperCase() + name.slice(1),
            type: "list",
          }),
        ),
        { name: "metrics", label: "Impact metrics", type: "pairs" },
        ...["repositoryUrl", "liveUrl", "packageUrl", "documentationUrl"].map(
          (name) => ({ name, label: name.replace("Url", " URL"), type: "url" }),
        ),
      ] as Field[])
    : kind === "experiences"
      ? ([
          { name: "organization", label: "Organization / client" },
          { name: "role", label: "Role" },
          {
            name: "engagementType",
            label: "Engagement",
            type: "select",
            options: ["employment", "client"],
          },
          { name: "startDate", label: "Start date", type: "date" },
          { name: "endDate", label: "End date", type: "date" },
          { name: "contributions", label: "Contributions", type: "list" },
          { name: "outcomes", label: "Outcomes", type: "list" },
        ] as Field[])
      : kind === "notes"
        ? ([
            { name: "markdown", label: "Article · Markdown", type: "long" },
            { name: "tags", label: "Tags", type: "list" },
          ] as Field[])
        : ([
            { name: "headline", label: "Professional headline" },
            { name: "biography", label: "Biography", type: "long" },
            { name: "skills", label: "Skills", type: "list" },
          ] as Field[])),
  { name: "links", label: "External / social links", type: "links" },
  {
    name: "mediaIds",
    label: "Screenshots / media IDs",
    type: "list",
    hint: "One media UUID per line. Copy IDs from the Media library.",
  },
  {
    name: "sortOrder",
    label: "Display order",
    type: "number",
    hint: "Lower numbers appear first within featured / non-featured groups.",
  },
];
export const sectionFields: Record<Section["type"], Field[]> = {
  text: [{ name: "body", label: "Text", type: "long" }],
  bullets: [{ name: "items", label: "Bullets", type: "list" }],
  decision: [
    { name: "context", label: "Context", type: "long" },
    { name: "decision", label: "Decision", type: "long" },
    { name: "tradeoffs", label: "Trade-offs", type: "long" },
  ],
  challenge: [
    { name: "challenge", label: "Challenge", type: "long" },
    { name: "solution", label: "Solution", type: "long" },
  ],
  metrics: [{ name: "metrics", label: "Metrics", type: "pairs" }],
  image: [
    { name: "mediaId", label: "Media ID" },
    { name: "alt", label: "Alternative text" },
  ],
  code: [
    { name: "language", label: "Language" },
    { name: "code", label: "Code", type: "long" },
  ],
  diagram: [
    {
      name: "source",
      label: "Architecture diagram source (Mermaid or text)",
      type: "long",
    },
  ],
  links: [{ name: "links", label: "Links", type: "links" }],
};
export const emptySection = (type: Section["type"]): Section =>
  ({
    type,
    title: "",
    ...Object.fromEntries(
      sectionFields[type].map((f) => [
        f.name,
        ["list", "pairs", "links"].includes(f.type ?? "") ? [] : "",
      ]),
    ),
  }) as Section;
export const displayValue = (value: unknown, type?: Field["type"]): string => {
  if (type === "list") return Array.isArray(value) ? value.join("\n") : "";
  if (type === "pairs" || type === "links")
    return Array.isArray(value)
      ? value
          .map((v) => `${v.label} | ${type === "links" ? v.url : v.value}`)
          .join("\n")
      : "";
  return value === null || value === undefined ? "" : String(value);
};
export const parseValue = (value: string, type?: Field["type"]): unknown => {
  if (type === "list")
    return value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  if (type === "pairs" || type === "links")
    return value
      .split("\n")
      .filter((v) => v.trim())
      .map((v) => {
        const [label, ...rest] = v.split("|");
        return {
          label: label.trim(),
          [type === "links" ? "url" : "value"]: rest.join("|").trim(),
        };
      });
  if (type === "date") return value || null;
  if (type === "number") return Number(value);
  return value;
};
