/** Envois : notifications push (Web Push / VAPID) et e-mails (Resend). Chaque canal s'active avec ses clés. */
import webpush from 'web-push';

export const pushActif = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const emailActif = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_EXPEDITEUR);

let pret = false;
function preparer() {
  if (pret) return;
  webpush.setVapidDetails(`mailto:${process.env.EMAIL_CONTACT ?? 'contact@monotrace.fr'}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  pret = true;
}

export interface MessagePush { titre: string; corps: string; url?: string; tag?: string }

/** Envoie une notification ; renvoie « expire » si l'abonnement n'existe plus. */
export async function envoyerPush(abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }, m: MessagePush): Promise<'ok' | 'expire' | 'erreur'> {
  if (!pushActif()) return 'erreur';
  preparer();
  try {
    await webpush.sendNotification(abonnement, JSON.stringify(m), { TTL: 6 * 3600, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? 'expire' : 'erreur';
  }
}

export async function envoyerEmail(a: string, sujet: string, html: string, texte: string) {
  if (!emailActif()) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_EXPEDITEUR, to: [a], subject: sujet, html, text: texte }),
  });
  return r.ok;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** E-mail du matin : la séance du jour, son déroulé et les deux actions utiles. */
export function emailDuMatin(o: {
  prenom: string | null; site: string; titre: string; resume: string; blocs: { titre: string; duree: string; cible: string }[];
  pourquoi?: string; joursAvant: number | null; course: string | null; seanceId?: string;
}) {
  const bouton = (href: string, txt: string, plein: boolean) =>
    `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none;${plein ? 'background:#1D5BFF;color:#fff' : 'background:#EAF1FF;color:#1D5BFF'}">${txt}</a>`;
  const lignes = o.blocs.map((b) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E6ECF7"><b>${esc(b.titre)}</b><br><span style="color:#5A6B8C;font-size:13px">${esc(b.cible)}</span></td><td style="padding:8px 0;border-bottom:1px solid #E6ECF7;text-align:right;font-weight:700">${esc(b.duree)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3F6FC;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0B1530">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:linear-gradient(135deg,#1D5BFF,#0A1A3F);background-color:#0A1A3F;padding:28px 28px 24px;color:#fff">
<div style="font-size:20px;letter-spacing:-.5px;line-height:1"><b style="font-weight:900">mono</b><span style="font-weight:400;color:#7DD3FC">trace</span></div>
<div style="font-size:13px;opacity:.8;margin-top:14px">Ta journée${o.joursAvant !== null && o.joursAvant > 0 ? ` · J-${o.joursAvant}${o.course ? ` avant ${esc(o.course)}` : ''}` : ''}</div>
<div style="font-size:26px;font-weight:800;margin-top:8px">Bonjour${o.prenom ? ` ${esc(o.prenom)}` : ''} !</div>
<div style="font-size:18px;font-weight:700;margin-top:14px">${esc(o.titre)}</div>
<div style="font-size:15px;opacity:.9;margin-top:4px">${esc(o.resume)}</div></td></tr>
<tr><td style="padding:24px 28px">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Avant de partir, fais ton <b>bilan du matin</b> (10 secondes) : sommeil, énergie, jambes. Le moteur adapte la séance à ta forme du jour.</p>
<div>${bouton(`${o.site}/app?bilan=1`, 'Faire mon bilan du matin', true)} ${o.seanceId ? bouton(`${o.site}/app/seance/${encodeURIComponent(o.seanceId)}`, 'Voir la séance', false) : ''}</div>
${lignes ? `<table role="presentation" width="100%" style="margin-top:22px;font-size:14px" cellpadding="0" cellspacing="0">${lignes}</table>` : ''}
${o.pourquoi ? `<p style="margin:20px 0 0;font-size:13px;color:#5A6B8C;line-height:1.5"><b>Pourquoi cette séance :</b> ${esc(o.pourquoi)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#7D89A6">Tu reçois cet e-mail car le programme du jour est activé. <a href="${o.site}/app/compte?onglet=preferences" style="color:#1D5BFF">Gérer mes e-mails</a></td></tr>
</table></td></tr></table></body></html>`;
  const texte = `Bonjour${o.prenom ? ` ${o.prenom}` : ''} !\n\n${o.titre}\n${o.resume}\n\n${o.blocs.map((b) => `- ${b.titre} (${b.duree}) : ${b.cible}`).join('\n')}\n\nFais ton bilan du matin : ${o.site}/app?bilan=1`;
  return { html, texte };
}
