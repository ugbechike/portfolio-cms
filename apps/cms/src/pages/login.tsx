import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Command } from "lucide-react";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { api } from "@/lib/api";
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Enter your password"),
});
type Login = z.infer<typeof schema>;
const LoginPage = () => {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Login>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const { error } = await getSupabase().auth.signInWithPassword(values);
      if (error) throw error;
      await api("/session");
      window.location.assign("/");
    } catch (e) {
      await getSupabase().auth.signOut();
      setError(e instanceof Error ? e.message : "Unable to sign in");
    }
  });
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Command size={21} />
          </span>{" "}
          Portfolio<span className="muted"> / Studio</span>
        </div>
        <div>
          <p className="eyebrow">YOUR WORK, WELL TOLD</p>
          <h1>
            A home for
            <br />
            everything
            <br />
            <em>you build.</em>
          </h1>
          <p className="login-caption">
            Shape the stories behind your work.
            <br />
            One thoughtful update at a time.
          </p>
        </div>
        <span className="eyebrow">PRIVATE WORKSPACE · CONTENT MANAGEMENT</span>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Back to your craft.</h2>
          <p className="muted">Sign in to manage your portfolio.</p>
          {!isConfigured() ? (
            <div className="notice">
              Connect your workspace by setting the Supabase URL, publishable
              key, API URL, and administrator ID in the environment files. See
              docs/DEPLOYMENT.md.
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Email address
                <input
                  autoComplete="username"
                  type="email"
                  {...register("email")}
                  placeholder="you@example.com"
                />
              </label>
              {errors.email && <p className="error">{errors.email.message}</p>}
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                />
              </label>
              {errors.password && (
                <p className="error">{errors.password.message}</p>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Enter workspace"}
                <ArrowUpRight size={17} />
              </button>
            </form>
          )}
          <p className="small muted">
            An invitation-only workspace. No public registration.
          </p>
        </div>
      </section>
    </main>
  );
};
export default LoginPage;
