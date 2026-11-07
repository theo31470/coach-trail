'use client';

import { useState, useTransition } from 'react';
import { emailTestMatin } from '../actions';

export default function BoutonEmailTest() {
  const [enCours, demarrer] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  return (
    <div className="stack">
      <button type="button" className="btn btn-primary" disabled={enCours} style={{ alignSelf: 'flex-start' }}
        onClick={() => demarrer(async () => setMsg(await emailTestMatin()))}>
        {enCours ? 'Envoi…' : 'M’envoyer l’e-mail du matin'}
      </button>
      {msg && <p className={`small ${msg.ok ? '' : 'erreur'}`} role="status">{msg.texte}</p>}
    </div>
  );
}
