"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
  writeBatch,
} from "firebase/firestore";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  StarIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { getFirebase } from "@/lib/firebase";
import type { Contact } from "@/lib/types";

type MergedContact = Contact & { _dupCount?: number; _dupIds?: string[] };

// Normalize a phone to digits only so "+1 (510) 555-1212" and "5105551212" match.
function normPhone(p?: string | null): string {
  return (p || "").replace(/\D+/g, "");
}
// Lowercase the domain and strip leading "www." so "WWW.Acme.com" and "acme.com" match.
function normDomain(d?: string | null): string {
  return (d || "").toLowerCase().replace(/^www\./, "").trim();
}
function normText(s?: string | null): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Identity tokens a contact contributes to the dedup graph. Two contacts that
// share ANY token end up in the same group (union-find). This catches the case
// where a single business has multiple Google Maps listings with different CIDs.
function identityTokens(c: Contact): string[] {
  const t: string[] = [];
  if (c.cid)  t.push("cid:"  + c.cid);
  if (c.ftid) t.push("ftid:" + c.ftid);
  if (c.chij) t.push("chij:" + c.chij);
  const phone = normPhone(c.phone || c.phone_display);
  if (phone.length >= 7) t.push("phone:" + phone);
  const dom = normDomain(c.website_domain || c.website);
  // Skip generic platform domains that many businesses share. Adding these as
  // tokens would incorrectly group unrelated listings together.
  if (dom && !/^(facebook|instagram|twitter|youtube|tiktok|linkedin|wixsite|forms\.gle|homesnap|realtystore|locations\.[a-z]+|shop\.[a-z]+)\.[a-z.]+$/.test(dom)) {
    t.push("dom:" + dom);
  }
  const na = normText(c.name) + "|" + normText(c.address);
  if (na.length > 1 && c.address) t.push("na:" + na);
  return t;
}

// How "complete" a contact is. Used to pick the seed row in each group.
function completeness(c: Contact): number {
  return [
    c.phone, c.website, c.email, c.address, c.rating,
    c.category, c.hours, c.description, c.cid,
    c.photo_urls?.length, c.hours_weekly && Object.keys(c.hours_weekly).length,
  ].filter(Boolean).length;
}

// Merge `b` into `a` field-by-field — non-empty wins, latest updated_at wins.
function mergeContacts(a: MergedContact, b: Contact): MergedContact {
  const out: MergedContact = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Contact, unknown][]) {
    const cur = out[k];
    const aEmpty = cur === undefined || cur === null || cur === "" ||
      (Array.isArray(cur) && cur.length === 0);
    const bEmpty = v === undefined || v === null || v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (bEmpty) continue;
    if (aEmpty) { (out as unknown as Record<string, unknown>)[k] = v; continue; }
    // Both present — keep the value from whichever row was updated more recently.
    if ((b.updated_at || 0) > (a.updated_at || 0)) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  out._dupCount = (out._dupCount || 1) + 1;
  out._dupIds = [...(out._dupIds || [a.id]), b.id];
  return out;
}

// Union-find: every contact contributes multiple identity tokens; any two
// contacts that share at least one token end up in the same group.
function dedupeContacts(rows: Contact[]): MergedContact[] {
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let p = parent.get(i) ?? i;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(i, p);
    return p;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Token → first row index that owns it. Subsequent rows union with the owner.
  const tokenOwner = new Map<string, number>();
  rows.forEach((r, i) => {
    parent.set(i, i);
    for (const tok of identityTokens(r)) {
      const owner = tokenOwner.get(tok);
      if (owner === undefined) tokenOwner.set(tok, i);
      else union(i, owner);
    }
  });

  // Collect indices into groups by root.
  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  });

  // Merge each group.
  const out: MergedContact[] = [];
  for (const indices of groups.values()) {
    if (indices.length === 1) { out.push(rows[indices[0]]); continue; }
    const sorted = indices
      .map((i) => rows[i])
      .sort((x, y) => completeness(y) - completeness(x));
    let merged: MergedContact = { ...sorted[0], _dupCount: 1, _dupIds: [sorted[0].id] };
    for (let i = 1; i < sorted.length; i++) merged = mergeContacts(merged, sorted[i]);
    out.push(merged);
  }
  return out;
}

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

  // Step 1: collapse duplicates ACROSS Firestore docs into single merged rows.
  //   - same Google CID            → same business (most reliable)
  //   - same phone (digits-only)   → same business
  //   - same website domain        → same business
  //   - same name + address        → same business
  // Same place_url re-scrapes are already merged server-side (sha1 doc id),
  // this catches Maps duplicate listings + legacy random-id docs.
  const deduped = useMemo<MergedContact[]>(
    () => dedupeContacts(contacts || []),
    [contacts],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deduped.filter((c) => {
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
  }, [deduped, q, hasPhone, hasWebsite, hasEmail, minRating, categoryFilter]);

  // ── One-click duplicate cleanup ──────────────────────────────────────────
  // For each UI-merged group (×N badge), write the merged contact back to ONE
  // canonical Firestore doc (the most-complete row's id) and DELETE the other
  // doc(s). After this runs, the badges disappear and Firestore matches what
  // you already see in the table.
  const [cleaning, setCleaning] = useState(false);
  const dupGroups = useMemo(
    () => deduped.filter((c) => (c._dupCount || 1) > 1),
    [deduped],
  );
  const dupExcessCount = useMemo(
    () => dupGroups.reduce((n, c) => n + ((c._dupCount || 1) - 1), 0),
    [dupGroups],
  );

  async function cleanDuplicates() {
    if (!dupGroups.length || cleaning) return;
    if (
      !confirm(
        `Permanently delete ${dupExcessCount} duplicate Firestore document${
          dupExcessCount === 1 ? "" : "s"
        }?\n\nEach merged row will collapse to a single canonical document. This cannot be undone.`,
      )
    )
      return;
    setCleaning(true);
    try {
      const { db } = getFirebase();
      let totalDeleted = 0;
      // Firestore batches cap at 500 writes. Chunk groups so each batch stays safe.
      const CHUNK = 100; // each group ≈ 1-3 writes → 100 groups ≈ ≤400 writes
      for (let i = 0; i < dupGroups.length; i += CHUNK) {
        const slice = dupGroups.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const merged of slice) {
          const ids = merged._dupIds || [];
          if (ids.length < 2) continue;
          const [keepId, ...dropIds] = ids;
          // Write the merged snapshot back to the canonical doc so it carries
          // every field from every duplicate (set with merge=true).
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _dupCount, _dupIds, id: _id, ...payload } = merged;
          batch.set(doc(db, "contacts", keepId), payload, { merge: true });
          for (const did of dropIds) batch.delete(doc(db, "contacts", did));
          totalDeleted += dropIds.length;
        }
        await batch.commit();
      }
      alert(`Cleanup complete. Deleted ${totalDeleted} duplicate document${totalDeleted === 1 ? "" : "s"}.`);
    } catch (e) {
      alert("Cleanup failed: " + (e as Error).message);
    } finally {
      setCleaning(false);
    }
  }

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
            {dupExcessCount > 0 && (
              <button
                onClick={cleanDuplicates}
                disabled={cleaning}
                title={`Permanently delete ${dupExcessCount} duplicate documents in Firestore`}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 shadow-xs hover:bg-amber-100 active:scale-95 transition disabled:opacity-50"
              >
                {cleaning ? (
                  <ArrowPathIcon className="size-4 animate-spin" />
                ) : (
                  <TrashIcon className="size-4" />
                )}
                Clean {dupExcessCount} dup{dupExcessCount === 1 ? "" : "s"}
              </button>
            )}
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
        <Stat label="Total Contacts" value={deduped.length || "—"} />
        <Stat
          label="With Phone"
          value={deduped.filter((c) => c.phone || c.phone_display).length || "—"}
        />
        <Stat
          label="With Website"
          value={deduped.filter((c) => c.website).length || "—"}
        />
        <Stat
          label="With Email"
          value={deduped.filter((c) => c.email).length || "—"}
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  {c._dupCount && c._dupCount > 1 && (
                    <span
                      title={`Merged from ${c._dupCount} duplicate listings`}
                      className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
                    >
                      ×{c._dupCount}
                    </span>
                  )}
                </div>
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
