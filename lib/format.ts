import type { Jour, Phase } from './moteur-entrainement';

export const JOURS: { id: Jour; court: string; long: string }[] = [
  { id: 'lun', court: 'Lun', long: 'lundi' },
  { id: 'mar', court: 'Mar', long: 'mardi' },
  { id: 'mer', court: 'Mer', long: 'mercredi' },
  { id: 'jeu', court: 'Jeu', long: 'jeudi' },
  { id: 'ven', court: 'Ven', long: 'vendredi' },
  { id: 'sam', court: 'Sam', long: 'samedi' },
  { id: 'dim', court: 'Dim', long: 'dimanche' },
];

export const PHASES: Record<Phase, string> = {
  foncier: 'Foncier',
  developpement: 'Développement',
  specifique: 'Spécifique',
  recuperation: 'Récupération',
  affutage: 'Affûtage',
  course: 'Course',
};

export const PHASES_TEXTE: Record<Phase, string> = {
  foncier: 'On construit la base : beaucoup d’endurance facile et un peu de renforcement.',
  developpement: 'On développe le moteur : plus de volume et des séances de qualité.',
  specifique: 'On prépare la course elle-même : terrain, dénivelé, allure du jour J.',
  recuperation: 'Semaine allégée : le corps assimile le travail des semaines précédentes.',
  affutage: 'On réduit le volume pour arriver frais, en gardant un peu de rythme.',
  course: 'Semaine de course : repos, confiance, et c’est parti.',
};

export const NIVEAUX = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé' } as const;
export const ABONNEMENTS = { essai: 'Essai', premium: 'Premium', offert: 'Offert', expire: 'Expiré' } as const;
export const ROLES = { membre: 'Membre', coach: 'Coach', admin: 'Admin' } as const;

/** Date du jour à l'heure de Paris (les serveurs tournent en UTC). */
export const isoAujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const ajouterJoursIso = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const ecartJours = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const prochainLundi = (iso = isoAujourdhui()) => {
  const j = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return ajouterJoursIso(iso, j === 0 ? 0 : 7 - j);
};

export const duree = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};
export const chrono = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
};
export const dateCourte = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dateLongue = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
export const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const nomAffiche = (p: { prenom: string | null; nom: string | null; email: string }) =>
  [p.prenom, p.nom].filter(Boolean).join(' ') || p.email;
export const initiales = (p: { prenom: string | null; nom: string | null; email: string }) =>
  ((p.prenom?.[0] ?? p.email[0]) + (p.nom?.[0] ?? '')).toUpperCase();
export const nombre = (n: number) => n.toLocaleString('fr-FR');
export const relatif = (iso: string | null) => {
  if (!iso) return 'jamais';
  const j = ecartJours(iso.slice(0, 10), isoAujourdhui());
  if (j <= 0) return 'aujourd’hui';
  if (j === 1) return 'hier';
  if (j < 30) return `il y a ${j} j`;
  return `il y a ${Math.round(j / 30)} mois`;
};
