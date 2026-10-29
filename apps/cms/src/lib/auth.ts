import { createServerClient } from "@supabase/ssr";
import type { GetServerSidePropsContext } from "next";
export const requireAdmin = async (ctx: GetServerSidePropsContext) => {
  ctx.res.setHeader("Cache-Control", "private, no-store");
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !process.env.ADMIN_USER_ID
  )
    return { redirect: { destination: "/login", permanent: false } };
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () =>
          Object.entries(ctx.req.cookies).map(([name, value]) => ({
            name,
            value: value ?? "",
          })),
        setAll: (cookies) => {
          ctx.res.setHeader(
            "Set-Cookie",
            cookies.map(
              ({ name, value, options }) =>
                `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${options.maxAge !== undefined ? `; Max-Age=${options.maxAge}` : ""}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
            ),
          );
        },
      },
    },
  );
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== process.env.ADMIN_USER_ID)
    return { redirect: { destination: "/login", permanent: false } };
  return { props: { email: data.user.email ?? "" } };
};
