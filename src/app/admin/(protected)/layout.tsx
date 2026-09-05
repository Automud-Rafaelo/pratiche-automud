import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdminSession } from "@/lib/admin/auth";

import { logoutAction } from "./actions";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminSession();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
          <Link className="text-lg font-semibold" href="/admin">
            Pratiche Automud
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link className="underline-offset-4 hover:underline" href="/admin">
              Pratiche
            </Link>
            <Link
              className="underline-offset-4 hover:underline"
              href="/admin/import-agenzie"
            >
              Agenzie
            </Link>
          </nav>
          <form action={logoutAction} className="ml-auto">
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              type="submit"
            >
              Esci
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? (
          <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Configurazione mancante: NEXT_PUBLIC_WHATSAPP_NUMBER. I link WhatsApp
            mostrati ai clienti non possono aprire la conversazione corretta.
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
