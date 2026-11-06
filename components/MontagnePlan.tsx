import Link from 'next/link';
import { PHASES, dateCourte, ecartJours, isoAujourdhui } from '@/lib/format';
import type { SemainePlan } from '@/lib/moteur-entrainement';
import './montagne-plan.css';

/**
 * « Ta montagne » : le plan dessiné comme une ascension.
 * L'altitude est le volume d'entraînement cumulé : chaque semaine fait monter,
 * les semaines allégées font des replats, le jour J est au sommet.
 */
export default function MontagnePlan({ semaines, index, avant, course, joursAvant }: {
  semaines: SemainePlan[]; index: number; avant: boolean; course: string; joursAvant: number;
}) {
  const n = semaines.length;
  const total = semaines.reduce((t, s) => t + s.volumeMin, 0) || 1;
  let cumul = 0;
  const pts: [number, number][] = [[3, 10]];
  semaines.forEach((s, k) => {
    cumul += s.volumeMin;
    const relief = k === n - 1 ? 0 : Math.sin(k * 2.3) * 2.2;
    pts.push([3 + (90 * (k + 1)) / n, k === n - 1 ? 70 : 10 + (cumul / total) * 58 + relief]);
  });

  // Position du coureur : début de la semaine en cours + jours écoulés
  const f = avant ? 0 : Math.min(1, Math.max(0, ecartJours(semaines[index].debut, isoAujourdhui()) / 7));
  const a = pts[avant ? 0 : index], b = pts[avant ? 0 : index + 1] ?? a;
  const ici: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const fait = [...pts.slice(0, avant ? 1 : index + 1), ici];
  const chemin = (p: [number, number][]) => `M${p.map(([x, y]) => `${x.toFixed(2)} ${(100 - y).toFixed(2)}`).join('L')}`;
  const pourcent = avant ? 0 : Math.round(((semaines.slice(0, index).reduce((t, s) => t + s.volumeMin, 0) + semaines[index].volumeMin * f) / total) * 100);
  const sommet = pts[n];

  return (
    <section className="montagne" aria-label={`Ton ascension : ${pourcent} % du chemin vers ${course}`}>
      <div className="montagne-titre">
        <h2>Ton ascension vers le jour J</h2>
        <p>{avant ? `Départ le ${dateCourte(semaines[0].debut)}` : `Semaine ${semaines[index].numero} sur ${n} · ${PHASES[semaines[index].phase]} · ${pourcent} % du chemin`}</p>
      </div>
      <svg className="montagne-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mp-pente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2A56C6" />
            <stop offset="1" stopColor="#0A1A3F" />
          </linearGradient>
        </defs>
        <path className="mp-loin" d="M0 100V52L12 40L22 48L34 28L46 42L58 20L70 36L82 14L92 26L100 18V100Z" />
        <path fill="url(#mp-pente)" d={`${chemin(pts)}L100 ${100 - sommet[1]}V100H0Z`} />
        <path className="mp-sentier" d={chemin(pts)} />
        <clipPath id="mp-parcouru" clipPathUnits="userSpaceOnUse">
          <rect className="mp-revele" x="0" y="0" width={ici[0] + 1} height="100" />
        </clipPath>
        <path className="mp-fait" clipPath="url(#mp-parcouru)" d={chemin(fait)} />
      </svg>
      {semaines.map((s, k) => (
        <Link key={s.numero} href={`/app/plan?semaine=${s.numero}`} className="mp-semaine" style={{ left: `${3 + (90 * k) / n}%`, width: `${90 / n}%` }}
          title={`Semaine ${s.numero} · ${PHASES[s.phase]}`}>
          <span className="sr">Semaine {s.numero}, {PHASES[s.phase]}</span>
        </Link>
      ))}
      <div className="mp-phases" aria-hidden="true">
        {semaines.map((s) => <i key={s.numero} style={{ background: `var(--phase-${s.phase})` }} />)}
      </div>
      <span className="mp-depart" style={{ left: `${pts[0][0]}%`, bottom: `${pts[0][1]}%` }}>Départ</span>
      <span className="mp-sommet" style={{ left: `${sommet[0]}%`, bottom: `${sommet[1]}%` }}>
        <svg viewBox="0 0 24 30" aria-hidden="true"><path d="M5 29V2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><path d="M6 3h14l-3.5 5L20 13H6z" fill="#1D5BFF" /></svg>
        <b>{joursAvant > 0 ? `J-${joursAvant}` : 'Jour J'}</b>
      </span>
      <span className={`mp-ici${ici[0] > 70 ? ' a-gauche' : ''}`} style={{ left: `${ici[0]}%`, bottom: `${ici[1]}%` }}>
        <i />
        <em>Tu es ici</em>
      </span>
    </section>
  );
}
