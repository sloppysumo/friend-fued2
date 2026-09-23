"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (loginError) {
      setError(loginError.message);
      return;
    }

    router.push("/host");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <button
          className="back-button"
          type="button"
          onClick={() => router.push("/")}
        >
          ← BACK
        </button>

        <p className="login-eyebrow">BALD BOY FEUD</p>

        <h1>HOST LOGIN</h1>

        <p className="login-description">
          Sign in to create and control a game.
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <label htmlFor="email">EMAIL</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">PASSWORD</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            className="game-button host-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>
      </section>
    </main>
  );
}