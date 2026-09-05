import Link from "next/link";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { requireAdminSession } from "@/lib/admin/auth";
import { buildCustomerLink } from "@/lib/admin/format";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { createPracticeAction } from "./actions";

type NewPracticePageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
    cause?: string;
    warning?: string;
  }>;
};

export default async function NewPracticePage({
  searchParams,
}: NewPracticePageProps) {
  await requireAdminSession();
  const { created, error, cause, warning } = await searchParams;
  let createdPractice: { id: string; token: string } | null = null;
  let loadError: string | null = null;

  if (created) {
    const supabase = createAdminSupabaseClient();
    const { data, error: practiceError } = await supabase
      .from("pratiche")
      .select("id,token")
      .eq("id", created)
      .maybeSingle();
    if (practiceError) {
      loadError = `Supabase: lettura pratica creata fallita: ${practiceError.message}`;
      console.error(loadError);
    } else {
      createdPractice = data;
    }
  }

  const customerLink = createdPractice
    ? buildCustomerLink(createdPractice.token)
    : null;

  return (
    <div className="max-w-2xl">
      <Link className="text-sm text-blue-700 hover:underline" href="/admin">
        ← Torna alle pratiche
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Nuova pratica</h1>

      {createdPractice && customerLink ? (
        <section className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="font-semibold text-green-900">Pratica creata</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-sm"
              readOnly
              value={customerLink}
            />
            <CopyLinkButton value={customerLink} />
          </div>
          <Link
            className="mt-3 inline-block text-sm text-green-900 underline"
            href={`/admin/pratiche/${createdPractice.id}`}
          >
            Apri il dettaglio
          </Link>
        </section>
      ) : null}

      {warning === "plate" ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          La targa è stata salvata, ma non rispetta il formato moderno AA123AA.
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {error === "invalid" ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Controlla i campi inseriti e riprova.
        </p>
      ) : null}

      {error === "service" ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Operazione non riuscita. Causa: {cause ?? "errore sconosciuto"}
        </p>
      ) : null}

      <form action={createPracticeAction} className="mt-6 space-y-5 rounded-lg border bg-white p-5">
        <label className="block text-sm font-medium">
          Tipo pratica
          <select
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            name="tipo_pratica"
            required
          >
            <option value="dini">Dini</option>
            <option value="atto_demo">Atto demo</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Prezzo concordato
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            min="0"
            name="prezzo_concordato"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="block text-sm font-medium">
          Targa
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 uppercase"
            name="targa"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Marca
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            name="marca"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Modello
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            name="modello"
            required
          />
        </label>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
          type="submit"
        >
          Crea pratica
        </button>
      </form>
    </div>
  );
}
