import { getSupabase } from "./supabase";
export const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type ApiResponse<T> = {
  data: T;
  meta?: { page: number; limit: number; total: number };
};
export const api = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> => {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Your session expired. Sign in again.");
  const response = await fetch(`${apiBase}/api/v1/admin${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${data.session.access_token}`,
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Request failed");
  return result as ApiResponse<T>;
};
