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
  StarIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Select } from "@/components/Select";
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
  "Rating",
  "Phone",
  "Website",
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

// 5-star visual with colored fill proportional to the score, plus the numeric
// value and review count. Compact and scannable.
function RatingCell({
  rating,
  reviews,
}: {
  rating?: number | null;
  reviews?: number | null;
}) {
  if (!rating) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200">
        Unrated
      </span>
    );
  }
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const tone =
    rating >= 4.5
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : rating >= 4
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : rating >= 3
          ? "text-orange-700 bg-orange-50 ring-orange-200"
          : "text-rose-700 bg-rose-50 ring-rose-200";
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}
      >
        <StarIcon className="size-3.5" />
        {rating.toFixed(1)}
      </span>
      <span
        className="relative inline-block leading-none"
        aria-hidden="true"
        title={`${rating.toFixed(1)} out of 5`}
      >
        <span className="text-gray-200 tracking-tight text-base">★★★★★</span>
        <span
          className="absolute inset-0 overflow-hidden text-amber-400 tracking-tight text-base"
          style={{ width: `${pct}%` }}
        >
          ★★★★★
        </span>
      </span>
      {reviews != null && (
        <span className="text-xs text-gray-400">({reviews})</span>
      )}
    </div>
  );
}

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [noWebsite, setNoWebsite] = useState(false);
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
      if (!c.rating) return false; // hide unrated
      if (hasPhone && !c.phone && !c.phone_display) return false;
      if (hasWebsite && !c.website) return false;
      if (noWebsite && c.website) return false;
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
        c.source_query,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [deduped, q, hasPhone, hasWebsite, noWebsite, minRating, categoryFilter]);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Stat label="Total Contacts" value={deduped.length || "—"} />
        <Stat
          label="With Phone"
          value={deduped.filter((c) => c.phone || c.phone_display).length || "—"}
        />
        <Stat
          label="With Website"
          value={deduped.filter((c) => c.website).length || "—"}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-6 rounded-2xl bg-white shadow-xs ring-1 ring-black/5 p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_180px] lg:items-end">
          <div>
            <label htmlFor="contacts-search" className="block text-sm/6 font-medium text-gray-900">
              Search
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="size-5 text-gray-400" />
              </div>
              <input
                id="contacts-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, category, address…"
                className="block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2BB673] sm:text-sm/6"
              />
            </div>
          </div>
          <Select
            id="contacts-category"
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "", label: "All categories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            id="contacts-rating"
            label="Minimum rating"
            value={String(minRating)}
            onChange={(v) => setMinRating(Number(v))}
            options={[
              { value: "0", label: "Any rating" },
              { value: "3", label: "≥ 3.0 ★" },
              { value: "4", label: "≥ 4.0 ★" },
              { value: "4.5", label: "≥ 4.5 ★" },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Toggle checked={hasPhone} onChange={setHasPhone} label="Has phone" />
          <Toggle checked={hasWebsite} onChange={setHasWebsite} label="Has website" />
          <Toggle checked={noWebsite} onChange={setNoWebsite} label="No website" />
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
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                <RatingCell rating={c.rating} reviews={c.reviews} />
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200">
                    No website
                  </span>
                )}
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
