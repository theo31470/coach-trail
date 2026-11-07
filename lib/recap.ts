/**
 * Récapitulatif quotidien (un e-mail par jour) :
 *  - ta nuit mesurée par la montre, comparée à ta normale ;
 *  - ce que le moteur en déduit pour la séance du jour ;
 *  - tes prochaines séances (jusqu'à 3 sur 6 jours) avec leurs conseils ;
 *  - le bouton du bilan du matin, qui confirme l'adaptation.
 * Tout est calculé par des règles fixes (pas d'IA).
 */
import { ajouterJoursIso, chrono, duree, ecartJours } from './format';
import type { Plan, Seance } from './moteur-entrainement';
import { estQualite } from './quotidien';
import { lireMontre, type LectureMontre, type MesureSanteDb } from './sante';
import { cibleBloc, detaillerSeance } from './seance-detail';

export interface MembreRecap {
  id: string; email: string; prenom: string | null; preferences: { email_quotidien?: boolean } | null;
  plan: Plan; course: string | null; date_course: string | null; garmin: boolean; email_envoye: boolean; mesures: MesureSanteDb[];
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jourLong = (iso: string, auj: string) => {
  const e = ecartJours(auj, iso);
  if (e === 0) return 'Aujourd’hui';
  if (e === 1) return 'Demain';
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Conseils propres à une séance (règles du moteur). */
function conseilsSeance(s: Seance, lecture: LectureMontre | null, estAujourdhui: boolean): string[] {
  const c: string[] = [];
  if (s.type === 'course') return ['Jour J : échauffe-toi 10 à 15 min, pars prudemment, bois et mange dès la première heure.'];
  if (estQualite(s.type)) c.push('Échauffe-toi bien (15 min facile + gammes) avant les efforts : la qualité d’exécution prime sur la vitesse.');
  if (s.dureeMin >= 90) c.push('Sortie longue : prévois de l’eau et 30 à 60 g de glucides par heure à partir de la première heure.');
  else if (s.dplusM && s.dplusM >= 300) c.push('Marche dans les pentes raides et garde de la fraîcheur pour bien descendre.');
  if (!estQualite(s.type) && s.zonePrincipale <= 2 && c.length === 0) c.push('Reste vraiment en aisance respiratoire : tu dois pouvoir parler en courant.');
  if (estAujourdhui && lecture && lecture.points <= -12) c.push('Vu ta nuit, reste attentif à tes sensations pendant l’échauffement.');
  return c.slice(0, 2);
}

/** Ce que le moteur prévoit pour la séance du jour à partir de la nuit seule (le bilan du matin confirme). */
function previsionDuJour(lecture: LectureMontre | null, seance: Seance | null) {
  if (!seance || seance.type === 'course') return null;
  if (!lecture) return null;
  if (lecture.points <= -25) return { ton: '#B91C1C', texte: 'Ta récupération est basse : le moteur va probablement remplacer la séance du jour par un footing très facile, voire du repos. Confirme avec ton bilan.' };
  if (lecture.points <= -12) return { ton: '#B45309', texte: 'Récupération incomplète : la séance du jour sera sans doute allégée. Ton bilan du matin décidera.' };
  return { ton: '#1D5BFF', texte: 'Feu vert de ta montre : rien n’empêche de faire la séance prévue. Confirme avec ton bilan du matin.' };
}

export function composerRecap(m: MembreRecap, auj: string, site: string, test = false) {
  const jour = m.mesures.find((x) => x.date === auj) ?? null;
  const lecture = lireMontre(jour, m.mesures.filter((x) => x.date < auj));
  const toutes = m.plan.semaines.flatMap((s) => s.seances);
  const duJour = toutes.find((s) => s.date === auj) ?? null;
  const prochaines = toutes.filter((s) => s.date >= auj && s.date <= ajouterJoursIso(auj, 6)).slice(0, 3);
  const joursAvant = m.date_course ? ecartJours(auj, m.date_course) : null;
  const prevision = previsionDuJour(lecture, duJour);

  // Conseils généraux du jour
  const conseils: string[] = [];
  if (lecture?.sommeilSuggere != null && lecture.sommeilSuggere <= 2) conseils.push('Nuit courte : vise un coucher 30 à 45 min plus tôt ce soir, c’est là que tu récupères le plus.');
  if (!duJour) conseils.push('Pas de course aujourd’hui : 15 min de mobilité ou de gainage, de la marche, et un bon repas. La récupération fait partie du plan.');
  if (joursAvant != null && joursAvant > 0 && joursAvant <= 7) conseils.push(`J-${joursAvant} : on n’ajoute plus rien. Dors bien, hydrate-toi, et prépare ton matériel tranquillement.`);

  const titreDuJour = duJour ? (duJour.type === 'course' ? `Jour J : ${m.course ?? 'ta course'}` : `${detaillerSeance(duJour).titre} · ${duree(duJour.dureeMin)}`) : 'Jour de récupération';
  const sujet = `${test ? '[Test] ' : ''}☀️ ${lecture?.indicateurs.find((i) => i.cle === 'sommeil') ? `Ta nuit : ${lecture.indicateurs.find((i) => i.cle === 'sommeil')!.valeur} · ` : ''}${titreDuJour}`;

  const couleur = { mieux: '#1D5BFF', normal: '#0B1530', vigilance: '#B45309', alerte: '#B91C1C' } as const;
  const bouton = (href: string, txt: string, plein: boolean) =>
    `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none;margin:0 6px 8px 0;${plein ? 'background:#1D5BFF;color:#fff' : 'background:#EAF1FF;color:#1D5BFF'}">${txt}</a>`;

  const nuit = lecture ? `
<tr><td style="padding:22px 28px 6px">
<div style="font-size:13px;font-weight:700;color:#5A6B8C">Ta nuit, mesurée par ta montre</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;font-size:14px">
${lecture.indicateurs.map((i) => `<tr><td style="padding:7px 0;border-bottom:1px solid #E6ECF7;color:#5A6B8C">${esc(i.libelle)}</td><td style="padding:7px 0;border-bottom:1px solid #E6ECF7;text-align:right"><b style="color:#0B1530">${esc(i.valeur)}</b>${i.detail ? `<br><span style="font-size:12px;color:${couleur[i.tendance]}">${esc(i.detail)}</span>` : ''}</td></tr>`).join('')}
</table>
${lecture.signaux.length ? `<ul style="margin:12px 0 0;padding-left:18px;font-size:14px;line-height:1.5;color:#0B1530">${lecture.signaux.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
${lecture.joursReference < 5 ? `<p style="margin:10px 0 0;font-size:12px;color:#7D89A6">Encore ${5 - lecture.joursReference} nuit(s) et le moteur comparera ta FC au repos et ta VFC à tes valeurs habituelles.</p>` : ''}
</td></tr>` : m.garmin ? `
<tr><td style="padding:22px 28px 0"><p style="margin:0;font-size:14px;color:#5A6B8C">Ta montre n’a pas encore envoyé ta nuit. Synchronise-la dans l’app Garmin Connect : le moteur en tiendra compte dans ton bilan.</p></td></tr>` : '';

  const blocSeance = (s: Seance) => {
    const d = detaillerSeance(s);
    const blocs = d.blocs.filter((b) => b.type !== 'recup').slice(0, 5);
    const conseilsS = conseilsSeance(s, lecture, s.date === auj);
    return `<tr><td style="padding:16px 28px 4px">
<div style="font-size:12px;font-weight:700;color:#1D5BFF">${esc(jourLong(s.date, auj))}</div>
<div style="font-size:17px;font-weight:800;margin-top:2px">${esc(s.type === 'course' ? `Jour J : ${m.course ?? 'ta course'}` : d.titre)} <span style="font-weight:600;color:#5A6B8C">· ${esc(duree(s.dureeMin))}${s.dplusM ? ` · ${s.dplusM} m D+` : ''}</span></div>
<div style="font-size:14px;color:#3B4A6B;margin-top:4px;line-height:1.45">${esc(d.resume)}</div>
${s.date === auj && blocs.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;font-size:13.5px">${blocs.map((b) => `<tr><td style="padding:6px 0;border-bottom:1px solid #E6ECF7"><b>${esc(b.repetition ? `${b.titre} (${b.repetition})` : b.titre)}</b><br><span style="color:#5A6B8C;font-size:12.5px">${esc(cibleBloc(b.zone, m.plan.zones))}</span></td><td style="padding:6px 0;border-bottom:1px solid #E6ECF7;text-align:right;font-weight:700">${esc(chrono(b.dureeSec))}</td></tr>`).join('')}</table>` : ''}
${conseilsS.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5;color:#3B4A6B">${conseilsS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
</td></tr>`;
  };

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3F6FC;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0B1530">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:linear-gradient(135deg,#1D5BFF,#0A1A3F);background-color:#0A1A3F;padding:28px 28px 24px;color:#fff">
<div style="font-size:20px;letter-spacing:-.5px;line-height:1"><b style="font-weight:900">mono</b><span style="font-weight:400;color:#7DD3FC">trace</span></div>
<div style="font-size:13px;opacity:.8;margin-top:14px">Ton récap du jour${joursAvant !== null && joursAvant > 0 ? ` · J-${joursAvant}${m.course ? ` avant ${esc(m.course)}` : ''}` : ''}</div>
<div style="font-size:26px;font-weight:800;margin-top:8px">Bonjour${m.prenom ? ` ${esc(m.prenom)}` : ''} !</div>
<div style="font-size:17px;font-weight:700;margin-top:12px">${esc(titreDuJour)}</div></td></tr>
${nuit}
${prevision ? `<tr><td style="padding:16px 28px 0"><div style="border-left:4px solid ${prevision.ton};background:#F5F8FF;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.5">${esc(prevision.texte)}</div></td></tr>` : ''}
<tr><td style="padding:18px 28px 0">${duJour ? bouton(`${site}/app?bilan=1`, 'Faire mon bilan (10 s)', true) : ''}${bouton(`${site}/app`, 'Ouvrir ma journée', !duJour)}${m.garmin ? bouton(`${site}/app/forme`, 'Ma forme', false) : ''}</td></tr>
<tr><td style="padding:14px 28px 0"><div style="font-size:13px;font-weight:700;color:#5A6B8C">Tes prochaines séances</div></td></tr>
${prochaines.length ? prochaines.map(blocSeance).join('') : `<tr><td style="padding:10px 28px"><p style="margin:0;font-size:14px;color:#5A6B8C">Aucune séance dans les 6 prochains jours.</p></td></tr>`}
${conseils.length ? `<tr><td style="padding:18px 28px 0"><div style="font-size:13px;font-weight:700;color:#5A6B8C">Conseils du jour</div><ul style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.5">${conseils.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></td></tr>` : ''}
<tr><td style="padding:22px 28px 24px;font-size:12px;color:#7D89A6">Un seul e-mail par jour${m.garmin ? ', envoyé dès que ta montre a synchronisé ta nuit' : ''}. <a href="${site}/app/compte?onglet=preferences" style="color:#1D5BFF">Gérer mes e-mails</a></td></tr>
</table></td></tr></table></body></html>`;

  const texte = [
    `Bonjour${m.prenom ? ` ${m.prenom}` : ''} !`, '', titreDuJour,
    ...(lecture ? ['', 'Ta nuit :', ...lecture.indicateurs.map((i) => `- ${i.libelle} : ${i.valeur}${i.detail ? ` (${i.detail})` : ''}`), ...lecture.signaux.map((s) => `! ${s}`)] : []),
    ...(prevision ? ['', prevision.texte] : []),
    '', 'Tes prochaines séances :', ...prochaines.map((s) => `- ${jourLong(s.date, auj)} : ${detaillerSeance(s).titre}, ${duree(s.dureeMin)}`),
    ...(conseils.length ? ['', 'Conseils :', ...conseils.map((c) => `- ${c}`)] : []),
    '', `Bilan du matin : ${site}/app?bilan=1`,
  ].join('\n');
  return { sujet, html, texte };
}
