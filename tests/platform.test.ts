import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  createRepository,
  createContentService,
  importContent,
} from "@portfolio/content";
import {
  contentSchema,
  newContent,
  listSchema,
  type ContentRecord,
} from "@portfolio/contracts";
import type { Database } from "@portfolio/database";
import { buildApp } from "../apps/api/src/app";
import { authorize } from "../apps/api/src/modules/auth/authorize";
import { detectImage } from "../apps/api/src/modules/media/service";
const actor = "11111111-1111-4111-8111-111111111111";
let pg: PGlite;
let repo: ReturnType<typeof createRepository>;
let service: ReturnType<typeof createContentService>;
let app: Awaited<ReturnType<typeof buildApp>>;
const project = (slug = "example") =>
  contentSchema.parse({
    ...newContent("projects"),
    title: "Example",
    slug,
    summary: "A test project",
  });
const headers = { authorization: "Bearer admin" };
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    await readFile(
      new URL(
        "../packages/database/src/migrations/0001_content.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  // PGlite runs the actual SQL with an embedded Postgres engine; only the driver differs.
  repo = createRepository(drizzle(pg) as unknown as Database);
  service = createContentService(repo);
  app = await buildApp({
    repo,
    verify: async (token) =>
      token === "admin" ? actor : token === "other" ? randomUUID() : null,
    adminId: actor,
    origins: ["http://localhost:3000"],
    health: async () => {
      await pg.query("select 1");
    },
    media: {
      upload: async () => {
        throw new Error("Storage unavailable");
      },
      url: async () => {
        throw new Error("Storage unavailable");
      },
      remove: async () => {},
    },
  });
});
afterAll(async () => {
  await app.close();
  await pg.close();
});
beforeEach(async () => {
  await pg.exec("TRUNCATE content, revisions, media, content_media CASCADE");
});
describe("contracts and authorization", () => {
  it("rejects malformed slugs, unsafe URLs, and impossible dates", () => {
    expect(
      contentSchema.safeParse({ ...project(), slug: "Bad Slug" }).success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({ ...project(), liveUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({ ...project(), startDate: "2025-02-30" })
        .success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({
        ...project(),
        startDate: "2025-02-28",
        endDate: "2024-01-01",
      }).success,
    ).toBe(false);
  });
  it("rejects missing, forged, and non-admin tokens", async () => {
    for (const token of [undefined, "Bearer invalid", "Bearer other"]) {
      const response = await app.inject({
        url: "/api/v1/admin/projects",
        headers: token ? { authorization: token } : {},
      });
      expect(response.statusCode).toBe(token === "Bearer other" ? 403 : 401);
      expect(response.json().error.code).toBeTruthy();
    }
  });
  it("fails closed when verification is unavailable", async () => {
    await expect(
      authorize(
        "Bearer token",
        async () => {
          throw new Error("offline");
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("protects every administrative route, including media and publication", async () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
      const r = await app.inject({
        method,
        url: `/api/v1/admin/projects${method === "POST" ? "" : method === "GET" ? "" : "/" + randomUUID()}`,
        payload: method === "GET" ? undefined : {},
      });
      expect(r.statusCode).toBe(401);
    }
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${randomUUID()}/publish`,
      payload: { expectedVersion: 1 },
    });
    expect(r.statusCode).toBe(401);
    expect((await app.inject({ url: "/api/v1/admin/media" })).statusCode).toBe(
      401,
    );
  });
});
describe("drafts, published snapshots, revisions and CRUD", () => {
  it("creates a project, publishes explicitly, and keeps subsequent edits private", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      headers,
      payload: project(),
    });
    expect(created.statusCode).toBe(201);
    const row = created.json().data as ContentRecord;
    expect(
      (await app.inject({ url: "/api/v1/projects" })).json().data,
    ).toHaveLength(0);
    expect(
      (await app.inject({ url: "/api/v1/projects/example" })).statusCode,
    ).toBe(404);
    const pub = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${row.id}/publish`,
      headers,
      payload: { expectedVersion: 1 },
    });
    expect(pub.statusCode).toBe(200);
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/projects/${row.id}`,
      headers,
      payload: {
        content: { ...project(), title: "Secret draft", slug: "new-slug" },
        expectedVersion: 2,
      },
    });
    expect(patch.statusCode).toBe(200);
    const publicRow = (
      await app.inject({ url: "/api/v1/projects/example" })
    ).json().data;
    expect(publicRow.title).toBe("Example");
    expect(publicRow.draft).toBeUndefined();
    expect(
      (await app.inject({ url: "/api/v1/projects/new-slug" })).statusCode,
    ).toBe(404);
    expect((await repo.history(row.id)).map((r) => r.action)).toEqual([
      "save",
      "publish",
      "create",
    ]);
    await service.action("projects", row.id, "unpublish", actor, 3);
    expect(
      (await repo.list("projects", listSchema.parse({}), true)).total,
    ).toBe(0);
    await service.action("projects", row.id, "delete", actor, 4);
    expect(await repo.get(row.id)).toBeUndefined();
    expect(await repo.history(row.id)).toHaveLength(5);
  });
  it("rejects stale versions without creating a revision", async () => {
    const row = await service.save("projects", project(), actor);
    await service.save(
      "projects",
      { ...project(), title: "New" },
      actor,
      row.id,
      1,
    );
    await expect(
      service.save("projects", project(), actor, row.id, 1),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await repo.history(row.id)).toHaveLength(2);
  });
  it("restores revisions only into draft and archives withdraw public content", async () => {
    const row = await service.save("projects", project(), actor);
    const rev = (await repo.history(row.id))[0];
    await service.action("projects", row.id, "publish", actor, 1);
    await service.save(
      "projects",
      { ...project(), title: "New" },
      actor,
      row.id,
      2,
    );
    await service.restore("projects", row.id, rev.id, actor, 3);
    expect((await repo.get(row.id))?.draft.title).toBe("Example");
    expect((await repo.get(row.id))?.published?.title).toBe("Example");
    await service.action("projects", row.id, "archive", actor, 4);
    expect((await repo.get(row.id))?.status).toBe("archived");
    expect(
      (await repo.list("projects", listSchema.parse({}), true)).total,
    ).toBe(0);
  });
  it("rolls back a failed publish without corrupting snapshots or revision history", async () => {
    const a = await service.save("projects", project("first"), actor);
    await service.action("projects", a.id, "publish", actor, 1);
    await service.save("projects", project("renamed"), actor, a.id, 2);
    const b = await service.save("projects", project("first"), actor);
    await expect(
      service.action("projects", b.id, "publish", actor, 1),
    ).rejects.toThrow();
    expect((await repo.get(b.id))?.published).toBeNull();
    expect(await repo.history(b.id)).toHaveLength(1);
    expect((await repo.publicBySlug("projects", "first"))?.id).toBe(a.id);
  });
  it("validates publication and cannot access an ID through the wrong content kind", async () => {
    const row = await service.save(
      "projects",
      { ...project(), summary: "" },
      actor,
    );
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${row.id}/publish`,
      headers,
      payload: { expectedVersion: 1 },
    });
    expect(r.statusCode).toBe(422);
    expect(
      (await app.inject({ url: `/api/v1/admin/notes/${row.id}`, headers }))
        .statusCode,
    ).toBe(404);
  });
  it("serves only published notes, experiences and profile", async () => {
    for (const content of [
      contentSchema.parse({ ...newContent("notes"), summary: "Note" }),
      contentSchema.parse({
        ...newContent("experiences"),
        summary: "Experience",
      }),
      contentSchema.parse({ ...newContent("profile"), summary: "Profile" }),
    ]) {
      const row = await service.save(content.kind, content, actor);
      expect(
        (await repo.list(content.kind, listSchema.parse({}), true)).total,
      ).toBe(0);
      await service.action(content.kind, row.id, "publish", actor, 1);
      expect(
        (await repo.list(content.kind, listSchema.parse({}), true)).total,
      ).toBe(1);
    }
  });
  it("returns consistent validation errors and paginated filtered results", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/projects",
          headers,
          payload: { title: "" },
        })
      ).json().error.code,
    ).toBe("VALIDATION_ERROR");
    expect(
      (await app.inject({ url: "/api/v1/projects?limit=0" })).statusCode,
    ).toBe(400);
    await service.save("projects", project(), actor);
    const r = await app.inject({
      url: "/api/v1/admin/projects?limit=1&q=Example",
      headers,
    });
    expect(r.json().meta.total).toBe(1);
    expect(r.json().data).toHaveLength(1);
  });
});
describe("media, imports and database safeguards", () => {
  it("identifies allowed image signatures and rejects SVG", () => {
    expect(detectImage(Buffer.from('<svg onload="alert(1)"/>'))).toBeNull();
    expect(detectImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
  });
  it("preserves referenced media and exposes only references in the published snapshot", async () => {
    const id = randomUUID();
    await repo.mediaAdd({
      id,
      path: "test.png",
      mime: "image/png",
      size: 12,
      alt: "Test",
    });
    const row = await service.save(
      "projects",
      { ...project(), mediaIds: [id] },
      actor,
    );
    expect(await repo.mediaIsPublic(id)).toBe(false);
    await service.action("projects", row.id, "publish", actor, 1);
    expect(await repo.mediaIsPublic(id)).toBe(true);
    await service.save("projects", project(), actor, row.id, 2);
    await expect(repo.mediaDelete(id)).rejects.toThrow();
    expect(await repo.mediaIsPublic(id)).toBe(true);
    await service.action("projects", row.id, "unpublish", actor, 3);
    expect(await repo.mediaIsPublic(id)).toBe(false);
    await repo.mediaDelete(id);
  });
  it("imports idempotently and dry-runs without writes", async () => {
    const id = randomUUID();
    const input = {
      records: [{ id, updatedAt: "2020-01-01T00:00:00Z", content: project() }],
    };
    const options = { dryRun: true, overwrite: false, actorId: actor };
    await importContent(repo, input, options);
    expect(await repo.get(id)).toBeUndefined();
    await importContent(repo, input, { ...options, dryRun: false });
    const result = await importContent(repo, input, {
      ...options,
      dryRun: false,
    });
    expect(result[0].action).toBe("unchanged");
    expect(await repo.history(id)).toHaveLength(1);
    await expect(
      importContent(
        repo,
        {
          records: [
            { ...input.records[0], content: { ...project(), title: "Older" } },
          ],
        },
        { ...options, dryRun: false },
      ),
    ).rejects.toMatchObject({ code: "NEWER_CONTENT" });
  });
  it("enables RLS on every content table", async () => {
    const result = await pg.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('content','revisions','media','content_media')",
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
