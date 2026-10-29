import { ContentError } from "@portfolio/content";
export type VerifyToken = (token: string) => Promise<string | null>;
export const authorize = async (
  header: string | undefined,
  verify: VerifyToken,
  adminId: string,
) => {
  const match = header?.match(/^Bearer ([^\s]+)$/);
  if (!match)
    throw new ContentError(401, "UNAUTHENTICATED", "Sign in to continue");
  let id: string | null = null;
  try {
    id = await verify(match[1]);
  } catch {
    throw new ContentError(
      401,
      "UNAUTHENTICATED",
      "Invalid or expired session",
    );
  }
  if (!id)
    throw new ContentError(
      401,
      "UNAUTHENTICATED",
      "Invalid or expired session",
    );
  if (id !== adminId)
    throw new ContentError(403, "FORBIDDEN", "Administrator access required");
  return id;
};
