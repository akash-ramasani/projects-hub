export interface ReviewTopic {
  keyword: string;
  mentions: number;
}

export interface Contact {
  id: string;                                // sha1(place_url) — Firestore doc id

  // ── Core ────────────────────────────────────────────────────────────────
  name: string;
  category?: string;
  place_url: string;

  // ── Geo ─────────────────────────────────────────────────────────────────
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  plus_code?: string;

  // ── Contact ─────────────────────────────────────────────────────────────
  phone?: string;                            // E.164 (e.g. +15104683929)
  phone_display?: string;                    // (510) 468-3929
  website?: string;
  website_domain?: string;
  email?: string;

  // ── Reputation ──────────────────────────────────────────────────────────
  rating?: number | null;                    // 0.0–5.0
  reviews?: number | null;                   // total count
  rating_distribution?: Record<string, number>; // { "5": 15, "4": 0, ... }

  // ── Hours ───────────────────────────────────────────────────────────────
  open_status?: string;                      // "Open ⋅ Closes 8 PM"
  hours?: string;                            // human-readable summary
  hours_weekly?: Record<string, string>;     // { Monday: "8 AM to 8 PM", ... }

  // ── Identifiers ─────────────────────────────────────────────────────────
  cid?: string;                              // 0x808ff929ce4404c1:0x1f316fc2acf22a7b
  ftid?: string;                             // /g/11g4jbsqfq
  chij?: string;                             // ChIJwQREzin5j4AReyryrMJvMR8

  // ── Rich content ────────────────────────────────────────────────────────
  description?: string;
  photo_urls?: string[];
  accessibility?: string[];                  // ["Wheelchair accessible entrance", ...]
  review_topics?: ReviewTopic[];
  claim_status?: string;                     // e.g. "unclaimed", "owner-verified"

  // ── Provenance ──────────────────────────────────────────────────────────
  scraped_at?: string;                       // ISO, last scrape in browser
  updated_at?: string;                       // ISO, set on every Firestore write
  first_seen_at?: string;                    // ISO, written ONCE on first sync
  source_query?: string;                     // search label / search URL
}

export interface UploadPayload {
  query?: string;
  contacts: Omit<Contact, "id" | "updated_at">[];
}
