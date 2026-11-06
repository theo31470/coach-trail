'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { majReglages } from '../actions';

export default function FormReglages(props: { inscriptions: boolean; annonce: string; essai: number }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [inscriptions, setInscriptions] = useState(props.inscriptions);
  const [annonce, setAnnonce] = useState(props.annonce);
  const [essai, setEssai] = useState(String(props.essai));
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="carte stack">
        <h3>Inscriptions</h3>
        <div className="reglage">
          <div><b>Inscriptions ouvertes</b><p>Fermées, seuls les e-mails administrateurs peuvent encore créer un compte.</p></div>
          <label className="interrupteur"><input type="checkbox" checked={inscriptions} onChange={(e) => setInscriptions(e.target.checked)} /><span /><b className="sr">Inscriptions ouvertes</b></label>
        </div>
        <label className="champ">Durée de l’essai (jours) <span className="aide">appliquée aux nouveaux inscrits</span>
          <input type="number" min={0} max={365} value={essai} onChange={(e) => setEssai(e.target.value)} style={{ maxWidth: 160 }} />
        </label>
      </section>
      <section className="carte stack">
        <h3>Annonce aux membres</h3>
        <p className="small muted">Affichée en haut de l’espace membre. Laisse vide pour ne rien afficher.</p>
        <textarea value={annonce} maxLength={280} placeholder="Ex. : nouvelle fonctionnalité, maintenance prévue…" onChange={(e) => setAnnonce(e.target.value)} />
        {annonce && <div className="annonce" style={{ marginBottom: 0 }}>{annonce}</div>}
      </section>
      {msg && <p className={`alerte ${msg.ok ? 'alerte-ok' : 'alerte-danger'} small`}>{msg.texte}</p>}
      <div><button className="btn btn-dark" disabled={enCours} onClick={() => demarrer(async () => {
        const r = await majReglages(inscriptions, annonce, Math.max(0, Math.min(365, Number(essai) || 0)));
        setMsg(r.erreur ? { ok: false, texte: r.erreur } : { ok: true, texte: 'Réglages enregistrés.' });
        router.refresh();
      })}>Enregistrer les réglages</button></div>
    </div>
  );
}
