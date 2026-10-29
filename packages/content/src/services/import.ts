import { isDeepStrictEqual } from "node:util";
import { importSchema } from "@portfolio/contracts";
import type { Repository } from "../repositories/content";
import { ContentError } from "../repositories/content";
export const importContent = async (
  repo: Repository,
  input: unknown,
  options: { dryRun: boolean; overwrite: boolean; actorId: string },
) => {
  const { records } = importSchema.parse(input);
  const seen = new Set<string>();
  const slugs = new Set<string>();
  for (const item of records) {
    const slug = item.content.kind + ":" + item.content.slug;
    if (seen.has(item.id) || slugs.has(slug))
      throw new ContentError(
        400,
        "DUPLICATE_IMPORT",
        "Duplicate ID or slug in import",
      );
    seen.add(item.id);
    slugs.add(slug);
  }
  const plan = [];
  for (const item of records) {
    const existing = await repo.get(item.id);
    if (existing && existing.kind !== item.content.kind)
      throw new ContentError(
        409,
        "KIND_MISMATCH",
        "Existing ID belongs to another content kind",
      );
    const same = existing && isDeepStrictEqual(existing.draft, item.content);
    if (
      existing &&
      !same &&
      !options.overwrite &&
      Date.parse(existing.updatedAt) >= Date.parse(item.updatedAt)
    )
      throw new ContentError(
        409,
        "NEWER_CONTENT",
        `Refusing to overwrite ${item.content.slug}; use --overwrite after review`,
      );
    plan.push({
      item,
      existing,
      action: same ? "unchanged" : existing ? "update" : "create",
    });
  }
  for (const p of plan)
    if (!options.dryRun && p.action !== "unchanged")
      await repo.mutate(
        p.item.id,
        p.item.content.kind,
        options.actorId,
        p.existing ? "save" : "create",
        p.existing?.version,
        p.item.content,
      );
  return plan.map((p) => ({
    id: p.item.id,
    slug: p.item.content.slug,
    action: p.action,
    dryRun: options.dryRun,
  }));
};
