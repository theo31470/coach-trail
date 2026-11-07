import type { SupabaseClient } from '@supabase/supabase-js';
import { envoyerEmail, emailActif } from './notifier';
import { composerRecap, type MembreRecap } from './recap';

/**
 * Envoie le récapitulatif du jour aux membres choisis, au plus un par personne et par jour
 * (la réservation en base garantit qu'un second déclencheur ne renvoie rien).
 */
export async function envoyerRecaps(supabase: SupabaseClient, secret: string, o: {
  date: string; site: string; declencheur: 'montre' | 'matin' | 'rattrapage';
  ids?: string[]; garmin?: boolean;
}) {
  if (!emailActif()) return { envoyes: 0 };
  const { data, error } = await supabase.rpc('recap_membres', { p_secret: secret, p_date: o.date, p_ids: o.ids ?? null });
  if (error) throw new Error(error.message);
  let envoyes = 0;
  for (const m of (data as MembreRecap[]) ?? []) {
    if (m.email_envoye || m.preferences?.email_quotidien === false) continue;
    if (o.garmin !== undefined && m.garmin !== o.garmin) continue;
    const { data: reserve } = await supabase.rpc('email_matin_reserver', { p_secret: secret, p_user: m.id, p_date: o.date, p_declencheur: o.declencheur });
    if (!reserve) continue;
    const { sujet, html, texte } = composerRecap(m, o.date, o.site);
    if (await envoyerEmail(m.email, sujet, html, texte)) envoyes++;
  }
  return { envoyes };
}
