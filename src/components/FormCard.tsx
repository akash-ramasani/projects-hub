import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export const inputCls =
  "block w-full rounded-lg bg-white px-3.5 py-2 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all";

export const selectCls =
  "col-start-1 row-start-1 w-full appearance-none rounded-lg bg-white px-3.5 py-2 pr-8 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all";

export const labelCls = "block text-sm/6 font-medium text-gray-900";

interface SubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel?: string;
  id?: string;
}

export function SubmitButton({
  loading,
  disabled,
  label,
  loadingLabel,
  id,
}: SubmitButtonProps) {
  return (
    <button
      id={id}
      type="submit"
      disabled={loading || disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2BB673] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#2BB673]/20 hover:bg-[#1e8a55] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2BB673]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2BB673] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all active:scale-95"
    >
      {loading ? loadingLabel ?? "Saving…" : label}
    </button>
  );
}

interface FormCardProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  error?: string;
  footer: React.ReactNode;
  className?: string;
}

export function FormCard({
  onSubmit,
  title,
  description,
  children,
  error,
  footer,
  className = "",
}: FormCardProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`bg-white shadow-2xl shadow-[#2BB673]/10 ring-1 ring-gray-200 sm:rounded-2xl ${className}`}
    >
      <div className="px-4 py-6 sm:p-8">
        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div className="sm:col-span-full">
            <h2 className="text-base/7 font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm/6 text-gray-600">{description}</p>
            )}
          </div>
          {children}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 sm:px-8 border-t border-red-200 bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8 bg-gray-50 sm:rounded-b-2xl">
        {footer}
      </div>
    </form>
  );
}

interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  children: React.ReactNode;
  span?: string;
  hint?: string;
}

export function FormField({
  id,
  label,
  children,
  span = "sm:col-span-full",
  hint,
}: FormFieldProps) {
  return (
    <div className={span}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
