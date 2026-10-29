import { randomUUID } from "node:crypto";
import { contentSchema, type Content, type Kind } from "@portfolio/contracts";
import { ContentError, type Repository } from "../repositories/content";
export const createContentService = (repo: Repository) => ({
  save: async (
    kind: Kind,
    data: unknown,
    actor: string,
    id?: string,
    expectedVersion?: number,
  ) => {
    const draft = contentSchema.parse(data);
    if (draft.kind !== kind)
      throw new ContentError(
        400,
        "KIND_MISMATCH",
        "Content kind does not match route",
      );
    return repo.mutate(
      id ?? randomUUID(),
      kind,
      actor,
      id ? "save" : "create",
      expectedVersion,
      draft,
    );
  },
  action: async (
    kind: Kind,
    id: string,
    action: "publish" | "unpublish" | "archive" | "delete",
    actor: string,
    version: number,
  ) => {
    if (action === "publish") {
      const row = await repo.get(id);
      if (!row || row.kind !== kind)
        throw new ContentError(404, "NOT_FOUND", "Content not found");
      contentSchema.parse(row.draft);
      if (!row.draft.summary.trim())
        throw new ContentError(
          422,
          "PUBLISH_VALIDATION",
          "Add a summary before publishing",
        );
    }
    return repo.mutate(id, kind, actor, action, version);
  },
  restore: async (
    kind: Kind,
    id: string,
    revisionId: string,
    actor: string,
    version: number,
  ) => {
    const revision = (await repo.history(id)).find((r) => r.id === revisionId);
    if (!revision)
      throw new ContentError(404, "NOT_FOUND", "Revision not found");
    return repo.mutate(
      id,
      kind,
      actor,
      "restore",
      version,
      contentSchema.parse(revision.content),
    );
  },
});
