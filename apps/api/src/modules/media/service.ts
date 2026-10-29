import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentError, type Repository } from "@portfolio/content";
import { randomUUID } from "node:crypto";
export const detectImage = (buffer: Buffer): string | null => {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    buffer.length >= 3 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    return "image/jpeg";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
};
export const createMediaService = (
  repo: Repository,
  supabase: SupabaseClient,
  bucket: string,
) => ({
  upload: async (buffer: Buffer, mime: string, alt: string) => {
    if (
      !buffer.length ||
      buffer.length > 10485760 ||
      detectImage(buffer) !== mime
    )
      throw new ContentError(
        400,
        "INVALID_IMAGE",
        "Upload a PNG, JPEG, or WebP up to 10 MB",
      );
    const id = randomUUID();
    const path = `${id}/${id}.${mime.split("/")[1]}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (error)
      throw new ContentError(502, "STORAGE_ERROR", "Storage upload failed");
    try {
      return await repo.mediaAdd({ id, path, mime, size: buffer.length, alt });
    } catch (error) {
      await supabase.storage.from(bucket).remove([path]);
      throw error;
    }
  },
  url: async (id: string, publicOnly: boolean) => {
    const asset = await repo.mediaGet(id);
    if (!asset || (publicOnly && !(await repo.mediaIsPublic(id))))
      throw new ContentError(404, "NOT_FOUND", "Media not found");
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(asset.path, 60);
    if (error || !data)
      throw new ContentError(502, "STORAGE_ERROR", "Unable to read media");
    return data.signedUrl;
  },
  remove: async (id: string) => {
    const asset = await repo.mediaGet(id);
    if (!asset) throw new ContentError(404, "NOT_FOUND", "Media not found");
    // Delete metadata first: the foreign key blocks deletion of referenced media.
    // If storage fails, restore metadata so the operation can be retried.
    await repo.mediaDelete(id);
    const { error } = await supabase.storage.from(bucket).remove([asset.path]);
    if (error) {
      await repo.mediaAdd(asset);
      throw new ContentError(
        502,
        "STORAGE_ERROR",
        "Storage deletion failed; retry",
      );
    }
  },
});
export type MediaService = ReturnType<typeof createMediaService>;
