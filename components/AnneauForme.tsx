import { libelleForme } from '@/lib/quotidien';

/** Score de forme du jour en anneau, qui se dessine à l'affichage. */
export default function AnneauForme({ score, taille = 96 }: { score: number; taille?: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const { ton } = libelleForme(score);
  const couleur = ton === 'ok' ? 'var(--accent)' : ton === 'warn' ? 'var(--z3)' : 'var(--z5)';
  return (
    <svg className="anneau-forme" width={taille} height={taille} viewBox="0 0 100 100" role="img" aria-label={`Forme du jour : ${score} sur 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="9" />
      <circle className="gr-anneau" style={{ '--c': c } as React.CSSProperties} cx="50" cy="50" r={r} fill="none" stroke={couleur} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="52" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)">{score}</text>
      <text x="50" y="68" textAnchor="middle" fontSize="10" fill="var(--ink-3)">forme</text>
    </svg>
  );
}
