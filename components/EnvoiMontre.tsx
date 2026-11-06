'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { envoyerSeanceGarmin } from '@/app/app/connexions/actions';
import { IcAgenda, IcEnvoyer, IcTelecharger } from './Icones';

/** Envoyer la séance vers la montre : Garmin Connect (si connecté), fichier .FIT, ou agenda. */
export default function EnvoiMontre({ seanceId, garmin, urlAgenda, compact = false }: {
  seanceId: string; garmin: boolean; urlAgenda?: string | null; compact?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  return (
    <div className={`envoi-montre${compact ? ' compact' : ''}`}>
      {garmin ? (
        <button className="btn btn-blanc" disabled={enCours} onClick={() => demarrer(async () => {
          const r = await envoyerSeanceGarmin(seanceId);
          setMessage(r.erreur ? { ok: false, texte: r.erreur } : { ok: true, texte: 'Séance envoyée : synchronise ta montre.' });
        })}><IcEnvoyer /> {enCours ? 'Envoi…' : 'Envoyer à ma Garmin'}</button>
      ) : (
        <Link className="btn btn-blanc" href="/app/connexions"><IcEnvoyer /> Envoyer à ma montre</Link>
      )}
      <a className="btn btn-verre" href={`/api/seances/${encodeURIComponent(seanceId)}/fit`} download><IcTelecharger /> Fichier .FIT</a>
      {!compact && urlAgenda && <a className="btn btn-verre" href={urlAgenda}><IcAgenda /> Dans mon agenda</a>}
      {message && <p className={`envoi-message ${message.ok ? 'ok' : 'ko'}`} role="status">{message.texte}</p>}
    </div>
  );
}
