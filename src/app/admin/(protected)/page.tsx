import Link from "next/link";

import { requireAdminSession } from "@/lib/admin/auth";
import { formatDateTime, formatStatus } from "@/lib/admin/format";
import type { EventRow, PracticeRow } from "@/lib/admin/types";
import {
  ATTENTION_EVENT_TYPES,
  BUSINESS_RULES,
} from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { resolveOperatorAlertAction } from "./actions";

type AdminPageProps = {
  searchParams: Promise<{ filter?: string; service_error?: string }>;
};

const attentionLabels: Record<string, string> = {
  targa_contestata: "Targa contestata",
  nessuna_agenzia_nel_raggio: `Agenzia oltre ${BUSINESS_RULES.nearbyAgencies.radiusKm} km`,
  geocoding_fallito: "Geocoding fallito",
  external_service_error: "Servizio esterno non disponibile",
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdminSession();
  const { filter, service_error: actionServiceError } = await searchParams;
  const toVerifyOnly = filter === "to_verify";
  const supabase = createAdminSupabaseClient();

  const { data: alertData, error: alertError } = await supabase
    .from("operator_alerts")
    .select("id,created_at,source,message")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const serviceMessages: string[] = [];
  if (actionServiceError) serviceMessages.push(actionServiceError);
  if (alertError) {
    const message = `Supabase: lettura avvisi operatore fallita: ${alertError.message}`;
    console.error(message);
    serviceMessages.push(message);
  }

  let practiceQuery = supabase
    .from("pratiche")
    .select("*")
    .order("created_at", { ascending: false });

  if (toVerifyOnly) {
    practiceQuery = practiceQuery
      .eq("status", "completata")
      .is("verifiche_completate_at", null);
  }

  const { data: practicesData, error: practicesError } = await practiceQuery;
  if (practicesError) {
    const message = `Supabase: lettura pratiche fallita: ${practicesError.message}`;
    console.error(message);
    return (
      <section className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-950">
        <h1 className="text-xl font-semibold">Pratiche non disponibili</h1>
        <p className="mt-2 text-sm">{message}</p>
      </section>
    );
  }

  const practices = (practicesData ?? []) as PracticeRow[];
  const practiceIds = practices.map((practice) => practice.id);
  let attentionEvents: Pick<EventRow, "pratica_id" | "tipo">[] = [];

  if (practiceIds.length > 0) {
    const { data, error } = await supabase
      .from("eventi")
      .select("pratica_id,tipo")
      .in("pratica_id", practiceIds)
      .in("tipo", [...ATTENTION_EVENT_TYPES]);

    if (error) {
      const message = `Supabase: lettura eventi di attenzione fallita: ${error.message}`;
      console.error(message);
      serviceMessages.push(message);
    } else {
      attentionEvents = data ?? [];
    }
  }

  const attentionByPractice = new Map<string, string[]>();
  for (const event of attentionEvents) {
    const current = attentionByPractice.get(event.pratica_id) ?? [];
    if (!current.includes(event.tipo)) current.push(event.tipo);
    attentionByPractice.set(event.pratica_id, current);
  }

  return (
    <>
      {serviceMessages.map((message) => (
        <p
          className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-950"
          key={message}
        >
          {message}
        </p>
      ))}
      {(alertData ?? []).length > 0 ? (
        <section className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Errori da controllare</h2>
          <div className="mt-3 space-y-2">
            {(alertData ?? []).map((alert) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-md bg-white p-3 text-sm"
                key={alert.id}
              >
                <strong>{alert.source}</strong>
                <span>{alert.message}</span>
                <span className="text-slate-500">
                  {formatDateTime(alert.created_at)}
                </span>
                <form action={resolveOperatorAlertAction} className="ml-auto">
                  <input name="alert_id" type="hidden" value={alert.id} />
                  <button className="rounded border px-2 py-1" type="submit">
                    Segna come risolto
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pratiche</h1>
          <p className="mt-1 text-sm text-slate-600">
            Elenco dalla pratica più recente.
          </p>
        </div>
        <Link
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          href="/admin/pratiche/nuova"
        >
          Nuova pratica
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          className={`rounded-md px-3 py-2 text-sm ${
            !toVerifyOnly ? "bg-slate-900 text-white" : "border bg-white"
          }`}
          href="/admin"
        >
          Tutte
        </Link>
        <Link
          className={`rounded-md px-3 py-2 text-sm ${
            toVerifyOnly ? "bg-slate-900 text-white" : "border bg-white"
          }`}
          href="/admin?filter=to_verify"
        >
          Da verificare
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Veicolo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Stato</th>
              <th className="px-4 py-3">Creata</th>
              <th className="px-4 py-3">Verifiche</th>
              <th className="px-4 py-3">Appuntamento</th>
              <th className="px-4 py-3">Attenzione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {practices.map((practice) => {
              const attention = attentionByPractice.get(practice.id) ?? [];
              return (
                <tr key={practice.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-blue-700 hover:underline"
                      href={`/admin/pratiche/${practice.id}`}
                    >
                      {practice.targa}
                    </Link>
                    <div className="text-slate-600">
                      {practice.marca} {practice.modello}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {[practice.nome, practice.cognome].filter(Boolean).join(" ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3">{formatStatus(practice.status)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDateTime(practice.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {practice.verifiche_completate_at ? "Sì" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    {practice.appuntamento_confermato_data ? "Sì" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    {attention.length > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        {attention.map((type) => (
                          <span
                            className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900"
                            key={type}
                          >
                            {attentionLabels[type] ?? type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "No"
                    )}
                  </td>
                </tr>
              );
            })}
            {practices.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                  Nessuna pratica trovata.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
