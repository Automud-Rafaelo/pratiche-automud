"use client";

import { useState } from "react";

import type { NearbyAgency } from "@/lib/customer/agencies";
import { customerCopy } from "@/lib/copy/customer";

import { primaryButtonClass } from "./question-frame";

export function AgencyQuestion({
  action,
  token,
  agencies,
  defaultValue,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  agencies: NearbyAgency[];
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  return (
    <form action={action}>
      <input name="token" type="hidden" value={token} />
      <input name="screen" type="hidden" value="agency" />
      <div className="grid gap-3">
        {agencies.map((agency) => (
          <label
            className={`cursor-pointer rounded-3xl border p-4 transition ${
              selected === agency.id
                ? "border-[#F7941D] bg-[#F7941D] text-white"
                : "border-[#D8D3CA] bg-white text-[#3B2314]"
            }`}
            key={agency.id}
          >
            <input
              checked={selected === agency.id}
              className="sr-only"
              name="agency_id"
              onChange={() => setSelected(agency.id)}
              type="radio"
              value={agency.id}
            />
            <span className="block text-[17px] font-bold">{agency.nome}</span>
            <span className="mt-1 block text-sm">{agency.indirizzo}</span>
            <span className="mt-2 block text-sm font-bold">
              {agency.distanceKm.toFixed(1)} {customerCopy.agency.distance}
              {agency.telefono ? ` · ${agency.telefono}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 text-center">
        <button className={primaryButtonClass} disabled={!selected} type="submit">
          {customerCopy.actions.continue}
        </button>
      </div>
    </form>
  );
}
