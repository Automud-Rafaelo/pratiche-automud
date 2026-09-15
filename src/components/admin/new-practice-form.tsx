"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createPracticeAction,
  type CreatePracticeActionState,
} from "@/app/admin/(protected)/pratiche/nuova/actions";

const INITIAL_STATE: CreatePracticeActionState = {
  error: null,
  duplicate: null,
};

export function NewPracticeForm({
  creationToken,
}: {
  creationToken: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPracticeAction,
    INITIAL_STATE,
  );
  const [type, setType] = useState("dini");
  const [price, setPrice] = useState("");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  return (
    <form
      action={formAction}
      className="mt-6 space-y-5 rounded-lg border bg-white p-5"
    >
      <input name="creazione_token" type="hidden" value={creationToken} />
      {state.error ? (
        <p
          aria-live="polite"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {state.duplicate ? (
        <section
          aria-live="polite"
          className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p>
            Esiste già una pratica per{" "}
            <strong>{state.duplicate.plate}</strong> creata{" "}
            {state.duplicate.createdAgo}.
          </p>
          <Link
            className="mt-2 inline-block font-medium underline"
            href={"/admin/pratiche/" + state.duplicate.id}
          >
            Apri la pratica esistente
          </Link>
          <label className="mt-4 flex items-start gap-2">
            <input
              checked={duplicateConfirmed}
              className="mt-0.5"
              name="confirm_recent_duplicate"
              onChange={(event) =>
                setDuplicateConfirmed(event.currentTarget.checked)
              }
              required
              type="checkbox"
              value="yes"
            />
            <span>Confermo di voler creare comunque una nuova pratica.</span>
          </label>
        </section>
      ) : null}
      <label className="block text-sm font-medium">
        Tipo pratica
        <select
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          name="tipo_pratica"
          onChange={(event) => setType(event.currentTarget.value)}
          required
          value={type}
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
          onChange={(event) => setPrice(event.currentTarget.value)}
          required
          step="0.01"
          type="number"
          value={price}
        />
      </label>
      <label className="block text-sm font-medium">
        Targa
        <input
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 uppercase"
          name="targa"
          onChange={(event) => setPlate(event.currentTarget.value)}
          required
          value={plate}
        />
      </label>
      <label className="block text-sm font-medium">
        Marca
        <input
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          name="marca"
          onChange={(event) => setMake(event.currentTarget.value)}
          required
          value={make}
        />
      </label>
      <label className="block text-sm font-medium">
        Modello
        <input
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          name="modello"
          onChange={(event) => setModel(event.currentTarget.value)}
          required
          value={model}
        />
      </label>
      <button
        className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={
          pending || Boolean(state.duplicate && !duplicateConfirmed)
        }
        type="submit"
      >
        {pending ? "Creazione in corso…" : "Crea pratica"}
      </button>
    </form>
  );
}
