import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { chrono, duree, ecartJours, isoAujourdhui } from '@/lib/format';
import type { Plan } from '@/lib/moteur-entrainement';
import { emailActif, emailDuMatin, envoyerEmail, envoyerPush, pushActif } from '@/lib/notifier';
import { cibleBloc, detaillerSeance } from '@/lib/seance-detail';
import type { Preferences } from '@/lib/types';

export const maxDuration = 60;

interface Membre {
  id: string; email: string; prenom: string | null; preferences: Preferences & { email_quotidien?: boolean };
  plan: Plan; course: string | null; date_course: string | null; bilan_fait: boolean;
  push: { endpoint: string; keys: { p256dh: string; auth: string } }[];
}

/** Chaque matin : notification et e-mail avec la séance du jour (déclenché par le cron Vercel). */
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ erreur: 'non autorisé' }, { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const aujourdhui = isoAujourdhui();
  const { data, error } = await supabase.rpc('envois_du_jour', { p_secret: secret, p_date: aujourdhui });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });
  const site = process.env.SITE_URL ?? new URL(requete.url).origin;
  const bilan = { push: 0, emails: 0, expires: 0 };

  for (const m of (data as Membre[]) ?? []) {
    const seance = m.plan.semaines.flatMap((s) => s.seances).find((s) => s.date === aujourdhui);
    const joursAvant = m.date_course ? ecartJours(aujourdhui, m.date_course) : null;
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

    if (emailActif() && seance && m.preferences?.email_quotidien !== false) {
      const { html, texte } = emailDuMatin({
        prenom: m.prenom, site, titre, resume: detail!.resume, pourquoi: seance.pourquoi, joursAvant, course: m.course, seanceId: seance.id,
        blocs: detail!.blocs.filter((b) => b.type !== 'recup').slice(0, 8).map((b) => ({ titre: b.repetition ? `${b.titre} (${b.repetition})` : b.titre, duree: chrono(b.dureeSec), cible: cibleBloc(b.zone, m.plan.zones) })),
      });
      if (await envoyerEmail(m.email, `☀️ ${titre}`, html, texte)) bilan.emails++;
    }
  }
  return NextResponse.json({ date: aujourdhui, ...bilan });
}
