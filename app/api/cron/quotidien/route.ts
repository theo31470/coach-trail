import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { duree, isoAujourdhui } from '@/lib/format';
import type { Plan } from '@/lib/moteur-entrainement';
import { envoyerPush, pushActif } from '@/lib/notifier';
import { envoyerRecaps } from '@/lib/recap-envoi';
import { detaillerSeance } from '@/lib/seance-detail';
import type { Preferences } from '@/lib/types';

export const maxDuration = 60;

interface Membre {
  id: string; email: string; prenom: string | null; preferences: Preferences & { email_quotidien?: boolean };
  plan: Plan; course: string | null; date_course: string | null; bilan_fait: boolean;
  push: { endpoint: string; keys: { p256dh: string; auth: string } }[];
}

/**
 * Chaque matin (cron Vercel) : notification de la séance du jour, et récap par e-mail pour les membres sans montre Garmin.
 * Les membres Garmin reçoivent leur récap dès que la montre envoie leur nuit ; ?vague=rattrapage (11 h) couvre ceux qui n'ont pas synchronisé.
 */
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ erreur: 'non autorisé' }, { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const aujourdhui = isoAujourdhui();
  const site = process.env.SITE_URL ?? new URL(requete.url).origin;
  // 11 h : rattrapage pour les montres Garmin qui n'ont pas synchronisé la nuit
  if (new URL(requete.url).searchParams.get('vague') === 'rattrapage') {
    const r = await envoyerRecaps(supabase, secret, { date: aujourdhui, site, declencheur: 'rattrapage', garmin: true });
    return NextResponse.json({ date: aujourdhui, rattrapage: r.envoyes });
  }
  const { data, error } = await supabase.rpc('envois_du_jour', { p_secret: secret, p_date: aujourdhui });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });
  const bilan = { push: 0, emails: 0, expires: 0 };

  for (const m of (data as Membre[]) ?? []) {
    const seance = m.plan.semaines.flatMap((s) => s.seances).find((s) => s.date === aujourdhui);
    const detail = seance ? detaillerSeance(seance) : null;
    const titre = seance ? (seance.type === 'course' ? `Jour J : ${m.course || 'ta course'} !` : `${detail!.titre} · ${duree(seance.dureeMin)}`) : 'Journée de récupération';

    if (pushActif() && m.preferences?.notif_seance !== false && !m.bilan_fait) {
      for (const a of m.push) {
        const r = await envoyerPush(a, {
          titre: seance ? `Aujourd’hui : ${titre}` : 'Pas de course aujourd’hui',
          corps: seance ? 'Fais ton bilan du matin : la séance s’adapte à ta forme.' : 'Mobilité, marche et bon sommeil : la récupération fait partie du plan.',
          url: seance ? '/app?bilan=1' : '/app', tag: `jour-${aujourdhui}`,
        });
        if (r === 'ok') bilan.push++;
        if (r === 'expire') { bilan.expires++; await supabase.rpc('supprimer_push', { p_secret: secret, p_endpoint: a.endpoint }); }
      }
    }
  }

  // Récap par e-mail : membres sans Garmin à 6 h 15 ; ceux avec Garmin le reçoivent à la synchronisation de leur montre
  const recap = await envoyerRecaps(supabase, secret, { date: aujourdhui, site, declencheur: 'matin', garmin: false });
  bilan.emails = recap.envoyes;
  return NextResponse.json({ date: aujourdhui, ...bilan });
}
