"use client";

import { ChevronDownIcon } from "@heroicons/react/16/solid";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  /** Hide the label visually but keep it for screen readers. */
  srOnlyLabel?: boolean;
};

/**
 * Reusable select control matching the Tailwind UI "grid + overlaid chevron"
 * pattern. Uses native <select> for full accessibility and mobile support, with
 * the brand green focus ring instead of indigo.
 */
export function Select({
  id,
  name,
  label,
  value,
  onChange,
  options,
  className = "",
  srOnlyLabel = false,
}: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className={
            srOnlyLabel
              ? "sr-only"
              : "block text-sm/6 font-medium text-gray-900"
          }
        >
          {label}
        </label>
      )}
      <div className={label && !srOnlyLabel ? "mt-2 grid grid-cols-1" : "grid grid-cols-1"}>
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2BB673] sm:text-sm/6"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4"
        />
      </div>
    </div>
  );
}
