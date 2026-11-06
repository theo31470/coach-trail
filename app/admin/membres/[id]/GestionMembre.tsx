'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ABONNEMENTS, ROLES, ajouterJoursIso, isoAujourdhui } from '@/lib/format';
import type { Profil } from '@/lib/types';
import { majMembre, regenererPlanMembre, supprimerMembre } from '../../actions';

export default function GestionMembre({ membre, note: noteInitiale, estAdmin, estMoi, aUnObjectif }: { membre: Profil; note: string; estAdmin: boolean; estMoi: boolean; aUnObjectif: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [f, setF] = useState({ role: membre.role, statut: membre.statut, abonnement: membre.abonnement, fin: membre.abonnement_fin ?? '' });
  const [note, setNote] = useState(noteInitiale);
  const [confirmation, setConfirmation] = useState('');

  const lancer = (fn: () => Promise<{ erreur?: string } | void>, ok: string) => {
    setMsg(null);
    demarrer(async () => {
      const r = await fn();
      if (r && r.erreur) setMsg({ ok: false, texte: r.erreur });
      else { setMsg({ ok: true, texte: ok }); router.refresh(); }
    });
  };

  if (!estAdmin) {
    return (
      <div className="carte stack-s">
        <h3>Gestion</h3>
        <p className="small muted">En tant que coach, tu peux consulter les fiches et traiter les alertes santé. La gestion des comptes est réservée aux administrateurs.</p>
        {aUnObjectif && <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => confirm('Régénérer le plan de ce membre à partir de lundi ?') && lancer(() => regenererPlanMembre(membre.id), 'Plan régénéré.')}>Régénérer son plan</button>}
        {msg && <p className={`alerte ${msg.ok ? 'alerte-ok' : 'alerte-danger'} small`}>{msg.texte}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="carte stack">
        <h3>Compte</h3>
        <div className="grille" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="champ">Rôle
            <select value={f.role} disabled={estMoi} onChange={(e) => setF({ ...f, role: e.target.value as Profil['role'] })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="champ">Statut
            <select value={f.statut} disabled={estMoi} onChange={(e) => setF({ ...f, statut: e.target.value as Profil['statut'] })}>
              <option value="actif">Actif</option><option value="suspendu">Suspendu</option>
            </select>
          </label>
          <label className="champ">Abonnement
            <select value={f.abonnement} onChange={(e) => setF({ ...f, abonnement: e.target.value as Profil['abonnement'] })}>
              {Object.entries(ABONNEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="champ">Jusqu’au
            <input type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[30, 90, 365].map((j) => (
            <button key={j} type="button" className="btn btn-ghost btn-s" onClick={() => setF({ ...f, fin: ajouterJoursIso(f.fin && f.fin > isoAujourdhui() ? f.fin : isoAujourdhui(), j) })}>+{j === 365 ? '1 an' : `${j} j`}</button>
          ))}
        </div>
        {estMoi && <p className="tiny">Tu ne peux pas modifier ton propre rôle ni te suspendre.</p>}
        <button className="btn btn-dark" disabled={enCours} onClick={() => lancer(() => majMembre(membre.id, {
          role: f.role !== membre.role ? f.role : undefined, statut: f.statut !== membre.statut ? f.statut : undefined,
          abonnement: f.abonnement !== membre.abonnement ? f.abonnement : undefined, abonnement_fin: f.fin && f.fin !== membre.abonnement_fin ? f.fin : undefined,
        }), 'Compte mis à jour.')}>Enregistrer</button>
      </div>

      <div className="carte stack">
        <h3>Note interne</h3>
        <textarea placeholder="Visible uniquement par l’équipe" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-ghost btn-s" disabled={enCours || note === noteInitiale} onClick={() => lancer(() => majMembre(membre.id, { note }), 'Note enregistrée.')}>Enregistrer la note</button>
      </div>

      <div className="carte stack-s">
        <h3>Actions</h3>
        <div className="row">
          {membre.statut === 'actif' && !estMoi
            ? <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => confirm('Suspendre ce compte ? Le membre ne pourra plus accéder à son plan.') && lancer(() => majMembre(membre.id, { statut: 'suspendu' }), 'Compte suspendu.')}>Suspendre</button>
            : !estMoi && <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => lancer(() => majMembre(membre.id, { statut: 'actif' }), 'Compte réactivé.')}>Réactiver</button>}
          {aUnObjectif && <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => confirm('Régénérer le plan de ce membre à partir de lundi ? Son historique est conservé.') && lancer(() => regenererPlanMembre(membre.id), 'Plan régénéré.')}>Régénérer son plan</button>}
          <a className="btn btn-ghost btn-s" href={`mailto:${membre.email}`}>Écrire un e-mail</a>
        </div>
      </div>

      {msg && <p className={`alerte ${msg.ok ? 'alerte-ok' : 'alerte-danger'} small`} role="status">{msg.texte}</p>}

      {!estMoi && (
        <div className="carte stack-s" style={{ borderColor: 'var(--danger)' }}>
          <h3 style={{ color: 'var(--danger)' }}>Supprimer le membre</h3>
          <p className="small muted">Compte, plans et séances supprimés définitivement. Tape l’e-mail du membre pour confirmer.</p>
          <input value={confirmation} placeholder={membre.email} onChange={(e) => setConfirmation(e.target.value)} />
          <button className="btn btn-danger btn-s" disabled={enCours || confirmation.trim().toLowerCase() !== membre.email.toLowerCase()}
            onClick={() => lancer(() => supprimerMembre(membre.id), 'Membre supprimé.')}>Supprimer définitivement</button>
        </div>
      )}
    </div>
  );
}
