import { createClient } from '@supabase/supabase-js';
import { planVersIcs } from '@/lib/ics';
import type { Plan } from '@/lib/moteur-entrainement';

/** Abonnement agenda (Apple Calendrier, Google Agenda, Outlook) : le plan se met à jour tout seul. */
export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const propre = jeton.replace(/\.ics$/, '');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await supabase.rpc('calendrier_par_jeton', { p_jeton: propre });
  const d = data as { plan: Plan; course: string | null; date_course: string | null } | null;
  if (!d?.plan) return new Response('Calendrier introuvable', { status: 404 });
  const site = new URL(requete.url).origin;
  return new Response(planVersIcs(d.plan, { course: d.course, dateCourse: d.date_course, site }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
  });
}
