"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error", error);
  }, [error]);

  return (
    <section className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-950">
      <h1 className="text-xl font-semibold">Operazione non riuscita</h1>
      <p className="mt-2 text-sm">{error.message}</p>
      <button
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        onClick={reset}
        type="button"
      >
        Riprova
      </button>
    </section>
  );
}
