import { requireAdminSession } from "@/lib/admin/auth";
import type { AgencyRow } from "@/lib/admin/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { importAgenciesAction, toggleAgencyAction } from "./actions";

type ImportAgenciesPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const statusLabels = {
  pending: "In attesa",
  ok: "Ok",
  not_found: "Non trovata",
};

export default async function ImportAgenciesPage({
  searchParams,
}: ImportAgenciesPageProps) {
  await requireAdminSession();
  const query = await searchParams;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agenzie")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Unable to load agencies: ${error.message}`);
  }

  const agencies = (data ?? []) as AgencyRow[];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Import agenzie</h1>
          <p className="mt-1 text-sm text-slate-600">
            Origine: data/agenzie.csv. Le righe già elaborate non vengono duplicate.
          </p>
        </div>
        <form action={importAgenciesAction}>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Importa
          </button>
        </form>
      </div>

      {query.imported === "1" ? (
        <div className="mt-5 rounded-md bg-green-50 p-4 text-sm text-green-900">
          Elaborate {query.rows} righe: {query.ok} ok, {query.not_found} non trovate, {query.pending} in attesa.
          {query.places_errors !== "0"
            ? ` ${query.places_errors} chiamate Places potranno essere ritentate.`
            : ""}
        </div>
      ) : null}

      {query.missing_key === "1" ? (
        <p className="mt-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          GOOGLE_MAPS_API_KEY non è configurata: le righe sono state inserite e quelle senza coordinate restano in attesa.
        </p>
      ) : null}

      {query.toggle_error === "phone" ? (
        <p className="mt-3 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Non puoi attivare un&apos;agenzia senza telefono.
        </p>
      ) : null}

      {query.toggle_saved === "1" ? (
        <p className="mt-3 rounded-md bg-green-50 p-4 text-sm text-green-900">
          Stato dell&apos;agenzia aggiornato.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Agenzia</th>
              <th className="px-4 py-3">Contatti</th>
              <th className="px-4 py-3">Coordinate</th>
              <th className="px-4 py-3">Import</th>
              <th className="px-4 py-3">Attiva</th>
              <th className="px-4 py-3">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agencies.map((agency) => (
              <tr key={agency.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{agency.nome}</div>
                  <div className="max-w-sm text-slate-600">
                    {agency.indirizzo}
                    {agency.cap || agency.comune
                      ? ` · ${[agency.cap, agency.comune, agency.provincia].filter(Boolean).join(" ")}`
                      : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{agency.telefono ?? "—"}</div>
                  <div className="text-slate-600">{agency.email ?? "—"}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {agency.lat !== null && agency.lng !== null
                    ? `${agency.lat}, ${agency.lng}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {statusLabels[agency.import_status]}
                </td>
                <td className="px-4 py-3">{agency.attiva ? "Sì" : "No"}</td>
                <td className="px-4 py-3">
                  <form action={toggleAgencyAction}>
                    <input name="agency_id" type="hidden" value={agency.id} />
                    <input
                      name="activate"
                      type="hidden"
                      value={agency.attiva ? "false" : "true"}
                    />
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5"
                      type="submit"
                    >
                      {agency.attiva ? "Disattiva" : "Attiva"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {agencies.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  Nessuna agenzia importata.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
