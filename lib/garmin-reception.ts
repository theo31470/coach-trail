import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { jetonPush, lignesAEcrire, lirePush, type CompteGarmin } from './garmin';

/** Traitement commun : la clé arrive soit dans le chemin (/api/garmin/push/<clé>), soit en paramètre (?cle=). */
export async function recevoir(requete: Request, cle: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || cle !== jetonPush(secret)) return NextResponse.json({ erreur: 'non autorisé' }, { status: 401 });

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

