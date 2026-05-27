import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdmin } from "@/lib/firebaseAdmin";
import type { UploadPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function sha1(s: string) {
  return createHash("sha1").update(s).digest("hex");
}

function clean<T extends Record<string, unknown>>(o: T) {
  // Firestore rejects `undefined`; replace with null or drop.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (v === "") continue;
    out[k] = v;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const expected = process.env.UPLOAD_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "Server is missing UPLOAD_API_KEY env var." },
      { status: 500, headers: CORS },
    );
  }
  const provided = req.headers.get("x-api-key") || "";
  if (provided !== expected) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );
  }

  let payload: UploadPayload;
  try {
    payload = (await req.json()) as UploadPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS },
    );
  }
  if (!payload || !Array.isArray(payload.contacts)) {
    return NextResponse.json(
      { error: "Body must be { contacts: [...] }" },
      { status: 400, headers: CORS },
    );
  }

  const { db } = getAdmin();
  const col = db.collection("contacts");
  const now = new Date().toISOString();

  let written = 0;
  // Firestore batched writes — max 500 ops per batch.
  const chunks: typeof payload.contacts[] = [];
  for (let i = 0; i < payload.contacts.length; i += 400) {
    chunks.push(payload.contacts.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    for (const c of chunk) {
      if (!c.place_url) continue;
      const id = sha1(c.place_url);
      const ref = col.doc(id);
      const data = clean({
        ...c,
        id,
        source_query: payload.query || c.source_query || "",
        updated_at: now,
      });
      // Merge so re-uploads enrich the doc instead of wiping fields.
      batch.set(ref, data, { merge: true });
      written++;
    }
    await batch.commit();
  }

  return NextResponse.json(
    { ok: true, written, total: payload.contacts.length },
    { headers: CORS },
  );
}
