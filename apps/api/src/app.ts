import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { z, ZodError } from "zod";
import {
  kindSchema,
  listSchema,
  saveSchema,
  versionSchema,
} from "@portfolio/contracts";
import {
  createContentService,
  ContentError,
  type Repository,
} from "@portfolio/content";
import { authorize, type VerifyToken } from "@/modules/auth/authorize";
import type { MediaService } from "@/modules/media/service";
export type AppOptions = {
  repo: Repository;
  verify: VerifyToken;
  adminId: string;
  origins: string[];
  media: MediaService;
  health: () => Promise<void>;
  logger?: boolean;
};
export const buildApp = async (options: AppOptions) => {
  const app = Fastify({
    logger: options.logger
      ? { redact: ["req.headers.authorization", "req.headers.cookie"] }
      : false,
    bodyLimit: 1024 * 1024,
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: options.origins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: { fileSize: 10485760, files: 1, fields: 1, parts: 2 },
  });
  const service = createContentService(options.repo);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the highlighted fields",
            details: error.flatten(),
          },
          requestId: request.id,
        });
    if (error instanceof ContentError)
      return reply
        .code(error.status)
        .send({
          error: { code: error.code, message: error.message },
          requestId: request.id,
        });
    const e = error as {
      code?: string;
      statusCode?: number;
      cause?: { code?: string };
    };
    const code = e.cause?.code ?? e.code;
    if (code === "23505")
      return reply
        .code(409)
        .send({
          error: {
            code: "CONFLICT",
            message: "This slug or identifier already exists",
          },
        });
    if (code === "23503")
      return reply
        .code(409)
        .send({
          error: {
            code: "MEDIA_REFERENCE",
            message: "Media is missing or still referenced by content",
          },
        });
    if (e.statusCode && e.statusCode < 500)
      return reply
        .code(e.statusCode)
        .send({
          error: {
            code: "BAD_REQUEST",
            message:
              e.statusCode === 413 ? "Upload is too large" : "Invalid request",
          },
        });
    request.log.error({ err: error, requestId: request.id }, "Request failed");
    return reply
      .code(500)
      .send({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to complete request",
        },
        requestId: request.id,
      });
  });
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ error: { code: "NOT_FOUND", message: "Route not found" } }),
  );
  app.get("/health", async () => {
    await options.health();
    return { status: "ok" };
  });
  app.get("/api/v1/media/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    reply.header("Cache-Control", "no-store");
    return reply.redirect(await options.media.url(id, true));
  });
  for (const kind of kindSchema.options) {
    app.get(`/api/v1/${kind}`, async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      const query = listSchema.parse(req.query);
      const result = await options.repo.list(kind, query, true);
      const data = result.rows.map((row) => ({
        id: row.id,
        ...row.published,
        publishedAt: row.publishedAt,
      }));
      return {
        data: kind === "profile" ? (data[0] ?? null) : data,
        meta: { page: query.page, limit: query.limit, total: result.total },
      };
    });
    if (kind === "projects" || kind === "notes")
      app.get(`/api/v1/${kind}/:slug`, async (req, reply) => {
        const { slug } = z
          .object({ slug: z.string().max(160) })
          .parse(req.params);
        const row = await options.repo.publicBySlug(kind, slug);
        if (!row?.published)
          throw new ContentError(404, "NOT_FOUND", "Content not found");
        reply.header("Cache-Control", "no-store");
        return {
          data: { id: row.id, ...row.published, publishedAt: row.publishedAt },
        };
      });
  }
  await app.register(
    async (admin) => {
      admin.addHook("onRequest", async (req, reply) => {
        await authorize(
          req.headers.authorization,
          options.verify,
          options.adminId,
        );
        reply.header("Cache-Control", "no-store");
      });
      admin.get("/session", async () => ({ data: { id: options.adminId } }));
      admin.get("/dashboard", async () => {
        const totals = await Promise.all(
          kindSchema.options.map(async (kind) => ({
            kind,
            total: (await options.repo.list(kind, listSchema.parse({}))).total,
          })),
        );
        const published = (
          await options.repo.list(
            "projects",
            listSchema.parse({ status: "published" }),
          )
        ).total;
        const drafts = (
          await options.repo.list(
            "projects",
            listSchema.parse({ status: "draft" }),
          )
        ).total;
        return {
          data: {
            totals,
            published,
            drafts,
            recent: await options.repo.recent(),
          },
        };
      });
      admin.get("/media", async () => ({
        data: await options.repo.mediaList(),
      }));
      admin.post("/media", async (req, reply) => {
        const file = await req.file();
        if (!file)
          throw new ContentError(400, "INVALID_IMAGE", "Choose an image");
        const buffer = await file.toBuffer();
        const field = file.fields.alt;
        const alt = z
          .string()
          .trim()
          .min(1)
          .max(500)
          .parse(
            field && !Array.isArray(field) && field.type === "field"
              ? field.value
              : undefined,
          );
        return reply
          .code(201)
          .send({
            data: await options.media.upload(buffer, file.mimetype, alt),
          });
      });
      admin.get("/media/:id/url", async (req) => {
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        return { data: { url: await options.media.url(id, false) } };
      });
      admin.delete("/media/:id", async (req) => {
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        await options.media.remove(id);
        return { data: { id } };
      });
      for (const kind of kindSchema.options) {
        const params = z.object({ id: z.string().uuid() });
        admin.get(`/${kind}`, async (req) => {
          const query = listSchema.parse(req.query);
          const result = await options.repo.list(kind, query);
          return {
            data: result.rows,
            meta: { page: query.page, limit: query.limit, total: result.total },
          };
        });
        admin.get(`/${kind}/:id`, async (req) => {
          const { id } = params.parse(req.params);
          const row = await options.repo.get(id);
          if (!row || row.kind !== kind)
            throw new ContentError(404, "NOT_FOUND", "Content not found");
          return { data: row };
        });
        admin.post(`/${kind}`, async (req, reply) =>
          reply
            .code(201)
            .send({
              data: await service.save(kind, req.body, options.adminId),
            }),
        );
        admin.patch(`/${kind}/:id`, async (req) => {
          const { id } = params.parse(req.params);
          const body = saveSchema.parse(req.body);
          return {
            data: await service.save(
              kind,
              body.content,
              options.adminId,
              id,
              body.expectedVersion,
            ),
          };
        });
        admin.delete(`/${kind}/:id`, async (req) => {
          const { id } = params.parse(req.params);
          const body = versionSchema.parse(req.body);
          await service.action(
            kind,
            id,
            "delete",
            options.adminId,
            body.expectedVersion,
          );
          return { data: { id } };
        });
        for (const action of ["publish", "unpublish", "archive"] as const)
          admin.post(`/${kind}/:id/${action}`, async (req) => {
            const { id } = params.parse(req.params);
            const body = versionSchema.parse(req.body);
            return {
              data: await service.action(
                kind,
                id,
                action,
                options.adminId,
                body.expectedVersion,
              ),
            };
          });
        admin.get(`/${kind}/:id/revisions`, async (req) => {
          const { id } = params.parse(req.params);
          const row = await options.repo.get(id);
          if (!row || row.kind !== kind)
            throw new ContentError(404, "NOT_FOUND", "Content not found");
          return { data: await options.repo.history(id) };
        });
        admin.post(`/${kind}/:id/restore`, async (req) => {
          const { id } = params.parse(req.params);
          const body = versionSchema
            .extend({ revisionId: z.string().uuid() })
            .parse(req.body);
          return {
            data: await service.restore(
              kind,
              id,
              body.revisionId,
              options.adminId,
              body.expectedVersion,
            ),
          };
        });
      }
    },
    { prefix: "/api/v1/admin" },
  );
  return app;
};
