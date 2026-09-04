"use client";

import { useMemo, useState } from "react";

import type { AppointmentPreferenceOption } from "@/lib/config/business-rules";
import { customerCopy } from "@/lib/copy/customer";

import { primaryButtonClass } from "./question-frame";

type DisplayOption = AppointmentPreferenceOption & { label: string };

export function AppointmentQuestion({
  action,
  token,
  options,
  defaultDate,
  defaultSlot,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  options: DisplayOption[];
  defaultDate?: string | null;
  defaultSlot?: string | null;
}) {
  const validDefault = options.some((option) => option.date === defaultDate);
  const [date, setDate] = useState(validDefault ? (defaultDate ?? "") : "");
  const [slot, setSlot] = useState(validDefault ? (defaultSlot ?? "") : "");
  const selectedDay = useMemo(
    () => options.find((option) => option.date === date),
    [date, options],
  );
  const valid = Boolean(date && slot && selectedDay?.slots.includes(slot as never));

  return (
    <form action={action}>
      <input name="token" type="hidden" value={token} />
      <input name="screen" type="hidden" value="appointment" />
      <div className="grid gap-3">
        {options.map((option) => (
          <label
            className={`cursor-pointer rounded-3xl border px-5 py-4 text-center text-[17px] font-bold transition ${
              date === option.date
                ? "border-[#F7941D] bg-[#F7941D] text-white"
                : "border-[#D8D3CA] bg-white text-[#3B2314]"
            }`}
            key={option.date}
          >
            <input
              checked={date === option.date}
              className="sr-only"
              name="preference_date"
              onChange={() => {
                setDate(option.date);
                setSlot("");
              }}
              type="radio"
              value={option.date}
            />
            {option.label}
          </label>
        ))}
      </div>

      {selectedDay ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["mattina", "pomeriggio"] as const).map((value) => {
            const enabled = selectedDay.slots.includes(value);
            const label =
              value === "mattina"
                ? customerCopy.appointment.morning
                : customerCopy.appointment.afternoon;
            return (
              <label
                className={`flex min-h-14 items-center justify-center rounded-full border px-3 text-center font-bold transition ${
                  !enabled
                    ? "cursor-not-allowed border-[#DED5C5] bg-[#EEE8DD] text-[#9A9388]"
                    : slot === value
                      ? "cursor-pointer border-[#F7941D] bg-[#F7941D] text-white"
                      : "cursor-pointer border-[#D8D3CA] bg-white text-[#3B2314]"
                }`}
                key={value}
              >
                <input
                  checked={slot === value}
                  className="sr-only"
                  disabled={!enabled}
                  name="preference_slot"
                  onChange={() => setSlot(value)}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 text-center">
        <button className={primaryButtonClass} disabled={!valid} type="submit">
          {customerCopy.actions.continue}
        </button>
      </div>
    </form>
  );
}
