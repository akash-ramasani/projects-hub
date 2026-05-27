"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query as fsQuery,
} from "firebase/firestore";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  StarIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { getFirebase } from "@/lib/firebase";
import type { Contact } from "@/lib/types";

const COLS: DataTableColumn[] = [
  "Business",
  "Category",
  { label: "Rating", className: "text-right" },
  "Phone",
  "Website",
  "Email",
  "Address",
  { label: "Actions", srOnly: true },
];

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white shadow-xs ring-1 ring-black/5 p-5">
      <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-gray-300 text-[#2BB673] focus:ring-[#2BB673]"
      />
      {label}
    </label>
  );
}

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    let unsub = () => {};
    try {
      const { db } = getFirebase();
      const q = fsQuery(collection(db, "contacts"), orderBy("updated_at", "desc"));
      unsub = onSnapshot(
        q,
        (snap) => {
          const rows: Contact[] = snap.docs.map((d) => ({
            ...(d.data() as Contact),
            id: d.id,
          }));
          setContacts(rows);
        },
        (err) => setError(err.message),
      );
    } catch (e) {
      setError((e as Error).message);
    }
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (contacts || []).forEach((c) => c.category && set.add(c.category));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const needle = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (hasPhone && !c.phone && !c.phone_display) return false;
      if (hasWebsite && !c.website) return false;
      if (hasEmail && !c.email) return false;
      if (minRating > 0 && (c.rating ?? 0) < minRating) return false;
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (!needle) return true;
      const hay = [
        c.name,
        c.category,
        c.address,
        c.phone,
        c.phone_display,
        c.website,
        c.website_domain,
        c.email,
        c.source_query,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [contacts, q, hasPhone, hasWebsite, hasEmail, minRating, categoryFilter]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    triggerDownload(
      blob,
      `contacts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
  }
  function exportCsv() {
    const cols: (keyof Contact)[] = [
      "name",
      "category",
      "rating",
      "reviews",
      "address",
      "phone",
      "phone_display",
      "website",
      "website_domain",
      "email",
      "plus_code",
      "hours",
      "place_url",
      "latitude",
      "longitude",
      "source_query",
    ];
    const esc = (v: unknown) => {
      if (v === undefined || v === null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [cols.join(",")];
    for (const r of filtered) {
      lines.push(cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    triggerDownload(
      blob,
      `contacts-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    );
  }

  return (
    <>
      <PageHeader
        title="Maps Contacts"
        description="Business contact data scraped from Google Maps and saved to Firestore. Filter, search, and export."
        actions={
          <>
            <button
              onClick={exportCsv}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 active:scale-95 transition disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="size-4" /> CSV
            </button>
            <button
              onClick={exportJson}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2BB673] px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#23a062] active:scale-95 transition disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="size-4" /> JSON
            </button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Stat label="Total Contacts" value={contacts?.length ?? "—"} />
        <Stat
          label="With Phone"
          value={contacts?.filter((c) => c.phone || c.phone_display).length ?? "—"}
        />
        <Stat
          label="With Website"
          value={contacts?.filter((c) => c.website).length ?? "—"}
        />
        <Stat
          label="With Email"
          value={contacts?.filter((c) => c.email).length ?? "—"}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-6 rounded-2xl bg-white shadow-xs ring-1 ring-black/5 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="size-5 text-gray-400" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, category, address, email…"
              className="block w-full rounded-lg border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all sm:text-sm/6"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg ring-1 ring-inset ring-gray-300 py-2 px-3 text-sm text-gray-700 bg-white focus:outline-[#2BB673]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="rounded-lg ring-1 ring-inset ring-gray-300 py-2 px-3 text-sm text-gray-700 bg-white focus:outline-[#2BB673]"
          >
            <option value={0}>Any rating</option>
            <option value={3}>≥ 3.0 ★</option>
            <option value={4}>≥ 4.0 ★</option>
            <option value={4.5}>≥ 4.5 ★</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Toggle checked={hasPhone} onChange={setHasPhone} label="Has phone" />
          <Toggle checked={hasWebsite} onChange={setHasWebsite} label="Has website" />
          <Toggle checked={hasEmail} onChange={setHasEmail} label="Has email" />
          <span className="text-xs text-gray-500 ml-auto">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span> of{" "}
            {contacts?.length ?? 0}
          </span>
        </div>
      </div>

      {/* Error / loading */}
      {error && (
        <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <strong>Firestore error:</strong> {error}
          <div className="mt-1 text-xs text-rose-600">
            Make sure NEXT_PUBLIC_FIREBASE_* env vars are set and the
            <code className="mx-1 rounded bg-rose-100 px-1">contacts</code>
            collection is readable by your security rules.
          </div>
        </div>
      )}
      {!error && contacts === null && (
        <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <ArrowPathIcon className="size-4 animate-spin" /> Loading from Firestore…
        </div>
      )}

      {/* Table */}
      {contacts !== null && (
        <DataTable columns={COLS}>
          {filtered.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/60">
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                <div className="font-semibold text-gray-900">{c.name}</div>
                {c.source_query && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {c.source_query}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">
                {c.category ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {c.category}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                {c.rating ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                    <StarIcon className="size-4 text-amber-500" />
                    {c.rating.toFixed(1)}
                    {c.reviews != null && (
                      <span className="text-xs font-normal text-gray-400">
                        ({c.reviews})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                {c.phone || c.phone_display ? (
                  <a
                    href={`tel:${c.phone || c.phone_display}`}
                    className="inline-flex items-center gap-1.5 text-gray-700 hover:text-[#2BB673]"
                  >
                    <PhoneIcon className="size-4 text-gray-400" />
                    {c.phone_display || c.phone}
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                {c.website ? (
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-gray-700 hover:text-[#2BB673]"
                  >
                    <GlobeAltIcon className="size-4 text-gray-400" />
                    {c.website_domain || c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1.5 text-gray-700 hover:text-[#2BB673]"
                  >
                    <EnvelopeIcon className="size-4 text-gray-400" />
                    {c.email}
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-3 py-4 text-sm text-gray-600 max-w-xs">
                <div className="line-clamp-2">{c.address || "—"}</div>
              </td>
              <td className="whitespace-nowrap relative py-4 pl-3 pr-4 text-right text-sm sm:pr-6">
                <a
                  href={c.place_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md px-2 py-1 text-[#2BB673] hover:bg-[#2BB673]/5 font-semibold"
                >
                  Open
                </a>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && contacts.length > 0 && (
            <tr>
              <td colSpan={COLS.length} className="py-12 text-center text-sm text-gray-500">
                No results match your filters.
              </td>
            </tr>
          )}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={COLS.length} className="py-12 text-center text-sm text-gray-500">
                No contacts yet. Run the Google Maps extension and click{" "}
                <span className="font-semibold">Upload to Firebase</span>.
              </td>
            </tr>
          )}
        </DataTable>
      )}
    </>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
