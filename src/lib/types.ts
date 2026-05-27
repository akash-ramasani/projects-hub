export interface Contact {
  id: string;                 // sha1(place_url) — used as Firestore doc id
  name: string;
  category?: string;
  rating?: number | null;
  reviews?: number | null;
  address?: string;
  phone?: string;             // E.164
  phone_display?: string;     // human formatted
  website?: string;
  website_domain?: string;
  email?: string;
  plus_code?: string;
  hours?: string;
  place_url: string;
  latitude?: number | null;
  longitude?: number | null;
  scraped_at?: string;        // ISO
  updated_at?: string;        // ISO, written server-side
  source_query?: string;      // optional context the extension can send
}

export interface UploadPayload {
  query?: string;
  contacts: Omit<Contact, "id" | "updated_at">[];
}
