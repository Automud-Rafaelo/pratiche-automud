"use client";

import { useState } from "react";

import { customerCopy } from "@/lib/copy/customer";

import { primaryButtonClass } from "./question-frame";

export type ChoiceOption = { value: string; label: string };

export function ChoiceQuestion({
  action,
  token,
  screen,
  name,
  options,
  defaultValue,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  screen: string;
  name: string;
  options: ChoiceOption[];
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  return (
    <form action={action}>
      <input name="token" type="hidden" value={token} />
      <input name="screen" type="hidden" value={screen} />
      <div className="grid gap-3">
        {options.map((option) => (
          <label
            className={`flex min-h-14 cursor-pointer items-center justify-center rounded-full border px-5 text-center text-[17px] font-bold transition ${
              selected === option.value
                ? "border-[#F7941D] bg-[#F7941D] text-white"
                : "border-[#D8D3CA] bg-white text-[#3B2314]"
            }`}
            key={option.value}
          >
            <input
              checked={selected === option.value}
              className="sr-only"
              name={name}
              onChange={() => setSelected(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
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
