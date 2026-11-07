import type { LectureMontre } from '@/lib/sante';

const PICTO: Record<string, string> = { mieux: '✓', normal: '·', vigilance: '!', alerte: '!!' };

/** Ce que la montre a mesuré pendant la nuit, comparé aux valeurs habituelles du coureur. */
export default function CarteNuit({ lecture }: { lecture: LectureMontre }) {
  const manque = Math.max(0, 5 - lecture.joursReference);
  return (
    <div className="carte-nuit" aria-label="Ta nuit mesurée par ta montre">
      <p className="carte-nuit-titre">Ta nuit, mesurée par ta montre</p>
      <ul className="nuit-indicateurs">
        {lecture.indicateurs.map((i) => (
          <li key={i.cle} className={`nuit-ind t-${i.tendance}`}>
            <span className="nuit-lib">{i.libelle}</span>
            <span className="nuit-val">{i.valeur}</span>
            {i.detail && <span className="nuit-det"><i aria-hidden="true">{PICTO[i.tendance]}</i> {i.detail}</span>}
          </li>
        ))}
      </ul>
      {manque > 0 && (
        <p className="tiny muted mt-8">
          Encore {manque} nuit{manque > 1 ? 's' : ''} de mesures et le moteur comparera ta FC au repos et ta VFC à tes valeurs habituelles.
        </p>
      )}
    </div>
  );
}
