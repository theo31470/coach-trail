/** Flux iCalendar du plan : chaque séance devient un événement dans l'agenda du coureur. */
import { ajouterJoursIso, duree } from './format';
import type { Plan } from './moteur-entrainement';
import { detaillerSeance } from './seance-detail';

const echapper = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const plier = (ligne: string) => {
  const morceaux: string[] = [];
  let reste = ligne;
  while (Buffer.byteLength(reste) > 73) {
    let n = 73;
    while (Buffer.byteLength(reste.slice(0, n)) > 73) n--;
    morceaux.push(reste.slice(0, n));
    reste = reste.slice(n);
  }
  morceaux.push(reste);
  return morceaux.join('\r\n ');
};
const jour = (iso: string) => iso.replace(/-/g, '');

export function planVersIcs(plan: Plan, o: { course?: string | null; dateCourse?: string | null; site: string }) {
  const tampon = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Monotrace//Plan//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Monotrace · mon plan', 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
  for (const s of plan.semaines) {
    for (const seance of s.seances) {
      const d = detaillerSeance(seance);
      const titre = seance.type === 'course' ? `🏁 ${o.course || 'Jour de course'}` : `🏃 ${d.titre} · ${duree(seance.dureeMin)}`;
      const description = [d.resume, '', `Pourquoi : ${seance.pourquoi}`, '', ...d.conseils.map((c) => `• ${c}`), '', `${o.site}/app/seance/${encodeURIComponent(seance.id)}`].join('\n');
      lignes.push('BEGIN:VEVENT', `UID:${seance.id}@monotrace.fr`, `DTSTAMP:${tampon}`,
        `DTSTART;VALUE=DATE:${jour(seance.date)}`, `DTEND;VALUE=DATE:${jour(ajouterJoursIso(seance.date, 1))}`,
        plier(`SUMMARY:${echapper(titre)}`), plier(`DESCRIPTION:${echapper(description)}`),
        plier(`URL:${o.site}/app/seance/${encodeURIComponent(seance.id)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
  }
  lignes.push('END:VCALENDAR');
  return lignes.join('\r\n') + '\r\n';
}
