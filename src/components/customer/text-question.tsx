"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import {
  BUSINESS_RULES,
  isValidIban,
  isValidItalianPostalCode,
  isValidItalianTaxCode,
  isValidPhone,
  normalizeVehiclePlate,
} from "@/lib/config/business-rules";
import { customerCopy } from "@/lib/copy/customer";

import { inputClass, primaryButtonClass } from "./question-frame";

type ValidationKind =
  | "text"
  | "tax_code"
  | "iban"
  | "postal_code"
  | "phone"
  | "vehicle_plate";

function isValid(value: string, kind: ValidationKind) {
  const trimmed = value.trim();
  if (kind === "tax_code") return isValidItalianTaxCode(trimmed);
  if (kind === "iban") return isValidIban(trimmed);
  if (kind === "postal_code") return isValidItalianPostalCode(trimmed);
  if (kind === "phone") return isValidPhone(trimmed);
  if (kind === "vehicle_plate") return normalizeVehiclePlate(trimmed).length > 0;
  return trimmed.length > 0;
}

function normalizeVisibleValue(value: string, kind: ValidationKind) {
  if (kind === "tax_code") return value.toUpperCase().replace(/\s/g, "");
  if (kind === "iban") return value.toUpperCase();
  if (kind === "vehicle_plate") return normalizeVehiclePlate(value);
  return value;
}

export function TextQuestion({
  action,
  token,
  screen,
  name,
  label,
  placeholder,
  defaultValue = "",
  validationKind = "text",
  errorMessage,
  warningMessage,
  inputMode,
  autoComplete,
  autoCapitalize,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  screen: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  validationKind?: ValidationKind;
  errorMessage?: string;
  warningMessage?: string;
  inputMode?: "text" | "numeric" | "tel";
  autoComplete?: string;
  autoCapitalize?: "none" | "characters" | "words";
}) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const valid = isValid(value, validationKind);
  const showWarning =
    validationKind === "vehicle_plate" &&
    valid &&
    !BUSINESS_RULES.validation.modernItalianVehiclePlatePattern.test(value);

  function handleFocus(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    window.requestAnimationFrame(() => {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <form action={action}>
      <input name="token" type="hidden" value={token} />
      <input name="screen" type="hidden" value={screen} />
      <label className="sr-only" htmlFor={name}>
        {label}
      </label>
      <input
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        className={inputClass}
        id={name}
        inputMode={inputMode}
        name={name}
        onBlur={() => setTouched(true)}
        onChange={(event) =>
          setValue(normalizeVisibleValue(event.target.value, validationKind))
        }
        onFocus={handleFocus}
        placeholder={placeholder}
        required
        value={value}
      />
      {touched && !valid && errorMessage ? (
        <p className="mt-2 px-3 text-sm font-medium text-red-700">{errorMessage}</p>
      ) : null}
      {showWarning && warningMessage ? (
        <p className="mt-2 px-3 text-sm font-medium text-amber-800">
          {warningMessage}
        </p>
      ) : null}
      <div className="mt-3 text-center">
        <button className={primaryButtonClass} disabled={!valid} type="submit">
          {customerCopy.actions.continue}
        </button>
      </div>
    </form>
  );
}
