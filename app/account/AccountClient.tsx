"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "../components/ClientIcons";
import type { AccountUser } from "../lib/account-server";

type AccountClientProps = {
  initialUser: AccountUser | null;
  returnTo: string;
};

export function AccountClient({ initialUser, returnTo }: AccountClientProps) {
  const [user, setUser] = useState(initialUser);
  const [form, setForm] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    if (form === "register" && password !== String(values.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/account/${form}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(values.get("email") ?? ""),
          password,
          displayName: form === "register" ? String(values.get("displayName") ?? "") : undefined,
        }),
      });
      const body = await response.json().catch(() => ({})) as { user?: AccountUser; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error || "Account service is unavailable.");
      setUser(body.user);
      window.dispatchEvent(new Event("bitemap:account-changed"));
      window.location.assign(returnTo === "/" ? "/my-spots" : returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/account/logout", { method: "POST" });
    setUser(null);
    setBusy(false);
    window.dispatchEvent(new Event("bitemap:account-changed"));
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your BiteMap account, saved spots, and private trip logs? This cannot be undone.")) return;
    setBusy(true);
    const response = await fetch("/api/account", { method: "DELETE" });
    if (response.ok) {
      setUser(null);
      window.dispatchEvent(new Event("bitemap:account-changed"));
    } else {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error || "Unable to delete the account.");
    }
    setBusy(false);
  }

  if (user) {
    return (
      <section className="account-card account-signed-in">
        <span className="account-icon"><ShieldCheck size={28} /></span>
        <span className="eyebrow">Signed in</span>
        <h2>{user.displayName}</h2>
        <p>{user.email}</p>
        {error && <p className="account-error" role="alert">{error}</p>}
        <div className="account-actions">
          <a className="primary-action" href="/my-spots">Open My Spots</a>
          <a className="secondary-action" href="/trips">Open Trip Log</a>
          <button className="secondary-action" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </div>
        <button className="delete-account" type="button" disabled={busy} onClick={() => void deleteAccount()}>Delete account, saved spots, and trip logs</button>
      </section>
    );
  }

  return (
    <section className="account-card account-auth-card">
      <div className="account-tabs" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected={form === "login"} className={form === "login" ? "active" : ""} onClick={() => { setForm("login"); setError(null); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={form === "register"} className={form === "register" ? "active" : ""} onClick={() => { setForm("register"); setError(null); }}>Create account</button>
      </div>
      <span className="account-icon"><LockKeyhole size={28} /></span>
      <h2>{form === "login" ? "Welcome back." : "Create your account."}</h2>
      <p>{form === "login" ? "Sign in to see your saved spots and trip log." : "Use a unique password with at least 12 characters."}</p>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {form === "register" && <label>Display name <input name="displayName" autoComplete="name" maxLength={120} placeholder="What should we call you?" /></label>}
        <label>Email address <input name="email" type="email" autoComplete="email" required maxLength={320} /></label>
        <label>Password <input name="password" type="password" autoComplete={form === "login" ? "current-password" : "new-password"} required minLength={form === "register" ? 12 : 1} maxLength={256} /></label>
        {form === "register" && <label>Confirm password <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>}
        {error && <p className="account-error" role="alert">{error}</p>}
        <button className="primary-action" disabled={busy} type="submit">{busy ? "Please wait..." : form === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <small>Passwords are salted and hashed. Your session is stored in a secure, HTTP-only browser cookie.</small>
    </section>
  );
}
