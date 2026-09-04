import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/lib/admin/auth";

import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Password non corretta.",
  rate_limit:
    "Troppi tentativi non riusciti. Riprova tra 15 minuti.",
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  if (await hasValidAdminSession()) {
    redirect("/admin");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Accesso operatori</h1>
        <p className="mt-2 text-sm text-slate-600">
          Inserisci la password del pannello Automud.
        </p>

        {error && errorMessages[error] ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errorMessages[error]}
          </p>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            id="password"
            name="password"
            required
            type="password"
          />
          <button
            className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
            type="submit"
          >
            Accedi
          </button>
        </form>
      </section>
    </main>
  );
}
