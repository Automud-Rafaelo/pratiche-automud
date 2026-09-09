"use client";

import type { FocusEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { customerCopy } from "@/lib/copy/customer";
import type {
  PlaceSuggestion,
  PlacesAutocompleteMode,
  ResolvedPlace,
} from "@/lib/google/places-autocomplete";

import { inputClass, primaryButtonClass } from "./question-frame";

type PlaceAutocompleteFieldProps = {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  screen: string;
  mode: PlacesAutocompleteMode;
  defaultPlace?: ResolvedPlace | null;
  defaultSelectionProof?: string | null;
  defaultManualAddress?: string;
  manualFallback: "always" | "on-error";
};

type SuggestResponse = {
  suggestions?: PlaceSuggestion[];
  sessionToken?: string;
};

type ResolveResponse = {
  place?: ResolvedPlace;
  selectionProof?: string;
};

export function PlaceAutocompleteField({
  action,
  token,
  screen,
  mode,
  defaultPlace = null,
  defaultSelectionProof = null,
  defaultManualAddress = "",
  manualFallback,
}: PlaceAutocompleteFieldProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ResolvedPlace | null>(
    defaultPlace,
  );
  const [selectionProof, setSelectionProof] = useState<string | null>(
    defaultSelectionProof,
  );
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [manual, setManual] = useState(
    !defaultPlace && Boolean(defaultManualAddress),
  );
  const [manualAddress, setManualAddress] = useState(defaultManualAddress);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestSequence = useRef(0);
  const sessionToken = useRef<string | null>(null);
  const copy = customerCopy.placesAutocomplete;

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (
      manual ||
      selectedPlace ||
      normalizedQuery.length <
        BUSINESS_RULES.placesAutocomplete.minimumInputLength
    ) {
      return;
    }

    const controller = new AbortController();
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const timeout = window.setTimeout(async () => {
      setUnavailable(false);
      try {
        const response = await fetch("/api/places/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            input: normalizedQuery,
            mode,
            sessionToken: sessionToken.current ?? undefined,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Places suggestions unavailable");
        const payload = (await response.json()) as SuggestResponse;
        if (sequence !== requestSequence.current) return;
        sessionToken.current = payload.sessionToken ?? null;
        setSuggestions(payload.suggestions ?? []);
        setActiveIndex(-1);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setSuggestions([]);
        setUnavailable(true);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, BUSINESS_RULES.placesAutocomplete.debounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [manual, mode, query, selectedPlace, token]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    if (!sessionToken.current) return;
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch("/api/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          placeId: suggestion.placeId,
          mode,
          sessionToken: sessionToken.current,
        }),
      });
      if (!response.ok) throw new Error("Place details unavailable");
      const payload = (await response.json()) as ResolveResponse;
      if (!payload.place || !payload.selectionProof) {
        throw new Error("Place details missing");
      }
      setSelectedPlace(payload.place);
      setSelectionProof(payload.selectionProof);
      setSuggestions([]);
    } catch (error) {
      console.error(error);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setSelectedPlace(null);
    setQuery("");
    setSuggestions([]);
    sessionToken.current = null;
    setSelectionProof(null);
    setUnavailable(false);
    setManual(false);
    setManualAddress("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    window.requestAnimationFrame(() => {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  if (selectedPlace && selectionProof) {
    return (
      <form action={action}>
        <input name="token" type="hidden" value={token} />
        <input name="screen" type="hidden" value={screen} />
        <input name="selection_mode" type="hidden" value="place" />
        <input name="place_proof" type="hidden" value={selectionProof} />
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#E5DED2]">
          <h2 className="text-xl font-bold">
            {mode === "establishment"
              ? copy.confirmEstablishment
              : copy.confirmAddress}
          </h2>
          {mode === "establishment" && selectedPlace.displayName ? (
            <p className="mt-3 text-lg font-bold">{selectedPlace.displayName}</p>
          ) : null}
          <p className="mt-2 text-[17px] leading-6">
            {selectedPlace.formattedAddress}
          </p>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3">
          <button className={primaryButtonClass} type="submit">
            {copy.confirm}
          </button>
          <button
            className="text-sm font-semibold underline underline-offset-4"
            onClick={resetSearch}
            type="button"
          >
            {copy.change}
          </button>
        </div>
      </form>
    );
  }

  if (manual) {
    return (
      <form action={action}>
        <input name="token" type="hidden" value={token} />
        <input name="screen" type="hidden" value={screen} />
        <input name="selection_mode" type="hidden" value="manual" />
        <label className="sr-only" htmlFor={`${screen}-manual-address`}>
          {copy.manualLabel}
        </label>
        <input
          autoCapitalize="words"
          autoComplete="street-address"
          className={inputClass}
          id={`${screen}-manual-address`}
          name="manual_address"
          onChange={(event) => setManualAddress(event.target.value)}
          onFocus={handleFocus}
          placeholder={copy.manualPlaceholder}
          required
          value={manualAddress}
        />
        <div className="mt-3 text-center">
          <button
            className={primaryButtonClass}
            disabled={!manualAddress.trim()}
            type="submit"
          >
            {customerCopy.actions.continue}
          </button>
        </div>
        <div className="mt-4 text-center">
          <button
            className="text-sm font-semibold underline underline-offset-4"
            onClick={resetSearch}
            type="button"
          >
            {copy.change}
          </button>
        </div>
      </form>
    );
  }

  const listboxId = `${screen}-place-suggestions`;
  const showManualFallback = manualFallback === "always" || unavailable;
  return (
    <div>
      <label className="sr-only" htmlFor={`${screen}-place-query`}>
        {mode === "establishment"
          ? copy.establishmentLabel
          : copy.addressLabel}
      </label>
      <input
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={suggestions.length > 0}
        autoCapitalize="words"
        autoComplete="off"
        className={inputClass}
        id={`${screen}-place-query`}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setUnavailable(false);
          if (
            value.trim().length >=
            BUSINESS_RULES.placesAutocomplete.minimumInputLength
          ) {
            setLoading(true);
          } else {
            setSuggestions([]);
            setLoading(false);
          }
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={
          mode === "establishment"
            ? copy.establishmentPlaceholder
            : copy.addressPlaceholder
        }
        role="combobox"
        value={query}
      />
      <div aria-live="polite" className="mt-2 min-h-5 px-3 text-sm">
        {loading ? copy.loading : null}
        {!loading && unavailable ? copy.unavailable : null}
        {!loading &&
        !unavailable &&
        query.trim().length >=
          BUSINESS_RULES.placesAutocomplete.minimumInputLength &&
        suggestions.length === 0
          ? copy.noResults
          : null}
      </div>
      {suggestions.length > 0 ? (
        <ul
          className="mt-2 overflow-hidden rounded-3xl border border-[#D8D3CA] bg-white shadow-sm"
          id={listboxId}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li
              aria-selected={index === activeIndex}
              id={`${listboxId}-${index}`}
              key={suggestion.placeId}
              role="option"
            >
              <button
                className={`w-full px-5 py-4 text-left ${
                  index === activeIndex ? "bg-[#F9DDB5]/60" : "bg-white"
                }`}
                onClick={() => void selectSuggestion(suggestion)}
                type="button"
              >
                <span className="block font-bold">{suggestion.mainText}</span>
                {suggestion.secondaryText ? (
                  <span className="mt-1 block text-sm text-[#3B2314]/70">
                    {suggestion.secondaryText}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showManualFallback ? (
        <div className="mt-4 text-center">
          <button
            className="text-sm font-semibold underline underline-offset-4"
            onClick={() => setManual(true)}
            type="button"
          >
            {copy.manualLink}
          </button>
        </div>
      ) : null}
    </div>
  );
}
