"use server";

import { z } from "zod";
import * as history from "@/lib/history";
import { SavedLeadSchema, STATUSES, type SavedLead } from "@/lib/pipeline";
import { getUser } from "@/lib/session";

/** Every action resolves the user from the session cookie; nothing trusts an id sent by the client. */
async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Sign in to save leads to your account.");
  return user;
}

export async function listMyLeads(): Promise<SavedLead[]> {
  const user = await getUser();
  return user ? history.listLeads(user.id) : [];
}

export async function saveMyLead(lead: SavedLead): Promise<void> {
  const user = await requireUser();
  await history.upsertLead(user.id, SavedLeadSchema.parse(lead));
}

const Patch = z.object({
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(2000).optional(),
});

export async function updateMyLead(leadId: string, patch: { status?: string; notes?: string }): Promise<void> {
  const user = await requireUser();
  await history.updateLead(user.id, z.string().min(1).max(64).parse(leadId), Patch.parse(patch));
}

export async function removeMyLead(leadId: string): Promise<void> {
  const user = await requireUser();
  await history.removeLead(user.id, z.string().min(1).max(64).parse(leadId));
}

export async function importMyLeads(leads: SavedLead[]): Promise<number> {
  const user = await requireUser();
  const valid = z.array(z.unknown()).max(500).parse(leads).flatMap((l) => {
    const r = SavedLeadSchema.safeParse(l);
    return r.success ? [r.data] : [];
  });
  return history.importLeads(user.id, valid);
}

const Search = z.object({
  city: z.string().trim().min(1).max(120),
  niche: z.string().trim().min(1).max(60),
  radiusM: z.union([z.literal(2000), z.literal(5000), z.literal(10000)]),
  placeLabel: z.string().max(200).nullable(),
  resultCount: z.number().int().min(0).max(1000),
});

/** Signed-out users simply aren't recorded. */
export async function recordMySearch(s: z.input<typeof Search>): Promise<void> {
  const user = await getUser();
  if (!user) return;
  await history.recordSearch(user.id, Search.parse(s));
}

export async function clearMyHistory(kind: "searches" | "audits"): Promise<void> {
  const user = await requireUser();
  await history.clearHistory(user.id, z.enum(["searches", "audits"]).parse(kind));
}
