import { requireAdminSession } from "@/lib/admin/auth";
import { formatDateTime } from "@/lib/admin/format";
import type { AgencyRow } from "@/lib/admin/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import {
  importAgenciesAction,
  refreshAgencyHoursAction,
  toggleAgencyAction,
} from "./actions";

type ImportAgenciesPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const statusLabels = {
  pending: "In attesa",
  ok: "Ok",
  not_found: "Non trovata",
};

function formatNullableBoolean(value: boolean | null) {
  return value === null ? "Sconosciuto" : value ? "Sì" : "No";
}

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
    console.error("[Supabase] Unable to load agencies", error.message);
    return (
      <section className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-950">
        <h1 className="text-xl font-semibold">Agenzie non disponibili</h1>
        <p className="mt-2 text-sm">Supabase: {error.message}</p>
      </section>
    );
  }

  const agencies = (data ?? []) as AgencyRow[];
  const counts = agencies.reduce(
    (result, agency) => {
      result[agency.import_status] += 1;
      return result;
    },
    { pending: 0, ok: 0, not_found: 0 },
  );

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

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-white p-3"><strong>Totale</strong><div>{agencies.length}</div></div>
        <div className="rounded-md border bg-white p-3"><strong>Ok</strong><div>{counts.ok}</div></div>
        <div className="rounded-md border bg-white p-3"><strong>Non trovate</strong><div>{counts.not_found}</div></div>
        <div className="rounded-md border bg-white p-3"><strong>In attesa</strong><div>{counts.pending}</div></div>
      </div>

      {query.imported === "1" ? (
        <div className="mt-5 rounded-md bg-green-50 p-4 text-sm text-green-900">
          <p>
            Report CSV: create {query.created}, aggiornate {query.updated},
            disattivate {query.deactivated}, pending {query.pending_after}.
          </p>
          <p className="mt-1">
            Elaborate con Google Places {query.processed} di {query.pending_before}
            {" "}agenzie da completare.
          </p>
          {query.pending_after !== "0"
            ? " Premi di nuovo Importa per continuare dopo aver risolto gli eventuali errori mostrati."
            : " Non restano agenzie in attesa."}
        </div>
      ) : null}

      {query.run_error ? (
        <p className="mt-3 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Import non completato: {query.run_error}
        </p>
      ) : null}

      {query.missing_key === "1" ? (
        <p className="mt-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          Google Places: chiave assente. Le righe sono state inserite, ma coordinate e orari da aggiornare restano in attesa.
        </p>
      ) : null}

      {query.toggle_error ? (
        <p className="mt-3 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {query.toggle_error === "phone"
            ? "Non puoi attivare un'agenzia senza telefono."
            : query.toggle_error === "eligibility"
              ? "L'agenzia è attivabile solo con telefono presente, delega No e istanza No."
            : query.toggle_error}
        </p>
      ) : null}

      {query.toggle_saved === "1" ? (
        <p className="mt-3 rounded-md bg-green-50 p-4 text-sm text-green-900">
          Stato dell&apos;agenzia aggiornato.
        </p>
      ) : null}

      {query.hours_error ? (
        <p className="mt-3 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Aggiornamento orari non riuscito: {query.hours_error}
        </p>
      ) : null}

      {query.hours_saved === "1" ? (
        <p className="mt-3 rounded-md bg-green-50 p-4 text-sm text-green-900">
          Orari dell&apos;agenzia aggiornati.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Agenzia</th>
              <th className="px-4 py-3">Contatti</th>
              <th className="px-4 py-3">Dati pagamento</th>
              <th className="px-4 py-3">Costi e requisiti</th>
              <th className="px-4 py-3">Coordinate</th>
              <th className="px-4 py-3">Import</th>
              <th className="px-4 py-3">Errore import</th>
              <th className="px-4 py-3">Orari aggiornati il</th>
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
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{agency.telefono ?? "—"}</div>
                  <div className="text-slate-600">{agency.email ?? "—"}</div>
                </td>
                <td className="min-w-64 px-4 py-3">
                  <div>{agency.intestatario_iban ?? "—"}</div>
                  <div className="font-mono text-xs text-slate-600">
                    {agency.iban ?? "—"}
                  </div>
                </td>
                <td className="min-w-56 px-4 py-3">
                  <div>Costi: {agency.costi_pratica ?? "—"}</div>
                  <div>Delega: {formatNullableBoolean(agency.delega)}</div>
                  <div>Istanza: {formatNullableBoolean(agency.istanza)}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {agency.lat !== null && agency.lng !== null
                    ? `${agency.lat}, ${agency.lng}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {statusLabels[agency.import_status]}
                </td>
                <td className="max-w-md px-4 py-3 text-sm text-red-700">
                  {agency.import_error ?? "—"}
                </td>
                <td className="min-w-48 px-4 py-3">
                  <div>{formatDateTime(agency.orari_aggiornati_at)}</div>
                  <form action={refreshAgencyHoursAction} className="mt-2">
                    <input name="agency_id" type="hidden" value={agency.id} />
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5"
                      type="submit"
                    >
                      Aggiorna orari
                    </button>
                  </form>
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
                <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
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
