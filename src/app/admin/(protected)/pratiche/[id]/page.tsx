import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  buildCustomerLink,
  displayValue,
  formatBoolean,
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatus,
} from "@/lib/admin/format";
import type { AgencyRow, EventRow, PracticeRow } from "@/lib/admin/types";
import { VERIFICATION_FIELDS } from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import {
  completeVerificationsAction,
  saveAppointmentAction,
  saveNotesAction,
  saveVerificationsAction,
} from "./actions";

type PracticeDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; cause?: string }>;
};

const noticeMessages: Record<string, string> = {
  verifications_saved: "Verifiche salvate.",
  verifications_completed: "Verifiche contrassegnate come completate.",
  verifications_incomplete:
    "Compila tutti e cinque i controlli prima di completarli.",
  appointment_saved: "Appuntamento salvato.",
  appointment_invalid: "Inserisci sia la data sia la fascia, oppure nessuna.",
  notes_saved: "Note salvate.",
  service_error: "Operazione non riuscita.",
};

const verificationLabels: Record<(typeof VERIFICATION_FIELDS)[number], string> = {
  check_intestatario_non_corrisponde: "Intestatario non corrisponde",
  check_cdp_cartaceo: "CDP cartaceo",
  check_revisione_scaduta: "Revisione scaduta",
  check_km_scalati: "Chilometri scalati",
  check_fermo_amministrativo: "Fermo amministrativo",
};

const highlightedEventLabels: Record<string, string> = {
  targa_contestata: "Il cliente ha contestato la targa.",
  nessuna_agenzia_nel_raggio:
    "Non sono state trovate agenzie entro il raggio configurato.",
  geocoding_fallito: "Non è stato possibile geocodificare il CAP.",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

export default async function PracticeDetailPage({
  params,
  searchParams,
}: PracticeDetailPageProps) {
  await requireAdminSession();
  const { id } = await params;
  const { notice, cause } = await searchParams;
  const supabase = createAdminSupabaseClient();
  const [{ data: practiceData, error }, { data: eventData, error: eventError }] =
    await Promise.all([
      supabase.from("pratiche").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("eventi")
        .select("*")
        .eq("pratica_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (error || eventError) {
    const message = error
      ? `Supabase: lettura pratica fallita: ${error.message}`
      : `Supabase: lettura eventi fallita: ${eventError?.message}`;
    console.error(message);
    return (
      <section className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-950">
        <h1 className="text-xl font-semibold">Dettaglio non disponibile</h1>
        <p className="mt-2 text-sm">{message}</p>
      </section>
    );
  }
  if (!practiceData) notFound();

  const practice = practiceData as PracticeRow;
  const events = (eventData ?? []) as EventRow[];
  let agency: AgencyRow | null = null;
  let agencyLoadError: string | null = null;

  if (practice.agenzia_id) {
    const { data, error: agencyError } = await supabase
      .from("agenzie")
      .select("*")
      .eq("id", practice.agenzia_id)
      .maybeSingle();
    if (agencyError) {
      agencyLoadError = `Supabase: lettura agenzia scelta fallita: ${agencyError.message}`;
      console.error(agencyLoadError);
    } else {
      agency = data as AgencyRow | null;
    }
  }

  const customerLink = buildCustomerLink(practice.token);
  const highlightedEvents = events.filter(
    (event) => highlightedEventLabels[event.tipo],
  );

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-blue-700 hover:underline" href="/admin">
          ← Torna alle pratiche
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {practice.targa} · {practice.marca} {practice.modello}
        </h1>
      </div>

      {agencyLoadError ? (
        <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-950">
          {agencyLoadError}
        </p>
      ) : null}

      {highlightedEvents.length > 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Eventi da attenzionare</h2>
          <ul className="mt-2 space-y-2 text-sm text-amber-950">
            {highlightedEvents.map((event) => (
              <li key={event.id}>
                <strong>{highlightedEventLabels[event.tipo]}</strong>{" "}
                {event.tipo === "targa_contestata"
                  ? `Targa operatore: ${displayValue(
                      typeof event.dettaglio.targa_operatore === "string"
                        ? event.dettaglio.targa_operatore
                        : undefined,
                    )} · Targa cliente: ${displayValue(
                      typeof event.dettaglio.targa_cliente === "string"
                        ? event.dettaglio.targa_cliente
                        : undefined,
                    )}`
                  : ""}
                {typeof event.dettaglio.errore === "string"
                  ? `Causa: ${event.dettaglio.errore}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notice && noticeMessages[notice] ? (
        <p
          className={`rounded-md p-3 text-sm ${
            notice.endsWith("invalid") ||
            notice.endsWith("incomplete") ||
            notice === "service_error"
              ? "bg-amber-50 text-amber-900"
              : "bg-green-50 text-green-900"
          }`}
        >
          {noticeMessages[notice]}
          {notice === "service_error" && cause ? ` Causa: ${cause}` : ""}
        </p>
      ) : null}

      <ReadOnlySection title="Riepilogo pratica">
        <Field label="Tipo pratica">
          {practice.tipo_pratica === "atto_demo" ? "Atto demo" : "Dini"}
        </Field>
        <Field label="Prezzo concordato">
          {formatMoney(practice.prezzo_concordato)}
        </Field>
        <Field label="Stato">{formatStatus(practice.status)}</Field>
        <Field label="Targa operatore">{practice.targa}</Field>
        <Field label="Targa cliente">
          {displayValue(practice.targa_cliente)}
        </Field>
        <Field label="Creata il">{formatDateTime(practice.created_at)}</Field>
        <Field label="Ultimo aggiornamento">
          {formatDateTime(practice.updated_at)}
        </Field>
        <Field label="Link cliente">
          <div className="flex flex-wrap items-center gap-2">
            <a className="text-blue-700 underline" href={customerLink}>
              Apri link
            </a>
            <CopyLinkButton value={customerLink} />
          </div>
        </Field>
      </ReadOnlySection>

      <ReadOnlySection title="Step 1 · Dati cliente">
        <Field label="Proprietario">{formatBoolean(practice.is_proprietario)}</Field>
        <Field label="Nome">{displayValue(practice.nome)}</Field>
        <Field label="Cognome">{displayValue(practice.cognome)}</Field>
        <Field label="Codice fiscale">{displayValue(practice.codice_fiscale)}</Field>
        <Field label="IBAN">{displayValue(practice.iban)}</Field>
      </ReadOnlySection>

      <ReadOnlySection title="Step 2 · Agenzia">
        <Field label="CAP">{displayValue(practice.cap)}</Field>
        <Field label="Auto cointestata">{formatBoolean(practice.cointestata)}</Field>
        <Field label="Due chiavi">{formatBoolean(practice.due_chiavi)}</Field>
        <Field label="Agenzia scelta">{agency?.nome ?? "—"}</Field>
        <Field label="Indirizzo agenzia">{agency?.indirizzo ?? "—"}</Field>
        <Field label="Telefono agenzia">{displayValue(agency?.telefono)}</Field>
        <Field label="Email agenzia">{displayValue(agency?.email)}</Field>
      </ReadOnlySection>

      <ReadOnlySection title="Step 3 · Preferenza">
        <Field label="Conosce gli orari del proprietario">
          {formatBoolean(practice.conosce_orari_proprietario)}
        </Field>
        <Field label="Data preferita">{formatDate(practice.preferenza_data)}</Field>
        <Field label="Fascia preferita">
          {practice.preferenza_fascia ?? "—"}
        </Field>
      </ReadOnlySection>

      <ReadOnlySection title="Step 4 · Ritiro">
        <Field label="Ubicazione auto">{practice.ubicazione_auto ?? "—"}</Field>
        <Field label="Indirizzo ritiro">
          {displayValue(practice.indirizzo_ritiro)}
        </Field>
        <Field label="Telefono ritiro">
          {displayValue(practice.telefono_ritiro)}
        </Field>
      </ReadOnlySection>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Verifiche</h2>
          <span className="text-sm text-slate-600">
            Completate: {formatDateTime(practice.verifiche_completate_at)}
          </span>
        </div>
        <form action={saveVerificationsAction} className="mt-4 space-y-4">
          <input name="practice_id" type="hidden" value={practice.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            {VERIFICATION_FIELDS.map((field) => {
              const value = practice[field];
              return (
                <label className="block text-sm font-medium" key={field}>
                  {verificationLabels[field]}
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                    defaultValue={
                      value === null ? "unchecked" : value ? "anomaly" : "ok"
                    }
                    name={field}
                  >
                    <option value="unchecked">Non verificato</option>
                    <option value="ok">Ok</option>
                    <option value="anomaly">Anomalia</option>
                  </select>
                </label>
              );
            })}
          </div>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-medium"
            type="submit"
          >
            Salva verifiche
          </button>
        </form>
        <form action={completeVerificationsAction} className="mt-3">
          <input name="practice_id" type="hidden" value={practice.id} />
          <button
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
            type="submit"
          >
            Verifiche completate
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Appuntamento</h2>
        <p className="mt-2 text-sm text-slate-600">
          Preferenza cliente: {formatDate(practice.preferenza_data)}, {practice.preferenza_fascia ?? "fascia non indicata"}.
          Agenzia: {agency?.nome ?? "non scelta"} · tel. {displayValue(agency?.telefono)} · email {displayValue(agency?.email)}.
        </p>
        <form action={saveAppointmentAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input name="practice_id" type="hidden" value={practice.id} />
          <label className="text-sm font-medium">
            Data confermata
            <input
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              defaultValue={practice.appuntamento_confermato_data ?? ""}
              name="appuntamento_confermato_data"
              type="date"
            />
          </label>
          <label className="text-sm font-medium">
            Fascia confermata
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              defaultValue={practice.appuntamento_confermato_fascia ?? ""}
              name="appuntamento_confermato_fascia"
            >
              <option value="">—</option>
              <option value="mattina">Mattina</option>
              <option value="pomeriggio">Pomeriggio</option>
            </select>
          </label>
          <button
            className="w-fit rounded-md bg-slate-900 px-4 py-2 font-medium text-white sm:col-span-2"
            type="submit"
          >
            Salva appuntamento
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Note operatore</h2>
        <form action={saveNotesAction} className="mt-4">
          <input name="practice_id" type="hidden" value={practice.id} />
          <textarea
            className="min-h-32 w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={practice.note_operatore ?? ""}
            name="note_operatore"
          />
          <button
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-medium text-white"
            type="submit"
          >
            Salva note
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Log eventi</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left">
              <tr>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2">Dettaglio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {formatDateTime(event.created_at)}
                  </td>
                  <td className="py-2 pr-4 font-medium">{event.tipo}</td>
                  <td className="py-2 font-mono text-xs">
                    {Object.keys(event.dettaglio).length > 0
                      ? JSON.stringify(event.dettaglio)
                      : "—"}
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td className="py-5 text-slate-500" colSpan={3}>
                    Nessun evento registrato.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
