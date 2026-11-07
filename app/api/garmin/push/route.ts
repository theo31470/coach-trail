import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { jetonPush, lignesAEcrire, lirePush, type CompteGarmin } from '@/lib/garmin';

export const maxDuration = 60;

/**
 * Adresse appelée par Garmin à chaque synchronisation d'une montre (sommeil, FC au repos, VFC, sorties, déconnexions).
 * Protégée par un jeton dans l'URL : /api/garmin/push?cle=…
 * Garmin attend une réponse 200 rapide ; une erreur de notre côté renvoie 500 pour qu'il réessaie.
 */
export async function POST(requete: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(requete.url);
  if (!secret || url.searchParams.get('cle') !== jetonPush(secret)) return NextResponse.json({ erreur: 'non autorisé' }, { status: 401 });

  let corps: unknown;
  try { corps = await requete.json(); } catch { return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 }); }

  const push = lirePush(corps);
  const ids = [...new Set([...push.mesures.map((m) => m.garminId), ...push.activites.map((a) => a.garminId), ...push.courbes.map((c) => c.garminId), ...push.deconnexions])];
  if (!ids.length) return NextResponse.json({ ok: true, recu: 0 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: comptes, error } = await supabase.rpc('garmin_comptes', { p_secret: secret, p_ids: ids });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const lignes = lignesAEcrire(push, (comptes as CompteGarmin[]) ?? []);
  const { error: e2 } = await supabase.rpc('garmin_ecrire', {
    p_secret: secret, p_mesures: lignes.mesures, p_seances: lignes.seances, p_deconnexions: lignes.deconnexions, p_courbes: lignes.courbes,
  });
  if (e2) return NextResponse.json({ erreur: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, mesures: lignes.mesures.length, seances: lignes.seances.length, courbes: lignes.courbes.length, deconnexions: lignes.deconnexions.length });
}

/** Certains outils Garmin vérifient l'adresse par un GET. */
export function GET() {
  return NextResponse.json({ ok: true, service: 'Monotrace · réception Garmin' });
}
