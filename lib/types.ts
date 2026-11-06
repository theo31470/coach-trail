import type { Decision, Jour, Niveau, Plan, TypeCourse } from './moteur-entrainement';

export interface Preferences {
  unites?: 'km' | 'mi';
  theme?: 'systeme' | 'clair' | 'sombre';
  rappel_heure?: string;
  notif_seance?: boolean;
  notif_bilan?: boolean;
  notif_conseils?: boolean;
  email_quotidien?: boolean;
  pilotage?: 'rpe' | 'fc' | 'allure';
  son_lecteur?: boolean;
  vibration_lecteur?: boolean;
  profil_public?: boolean;
}

export interface Profil {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  date_naissance: string | null;
  sexe: 'femme' | 'homme' | 'autre' | null;
  ville: string | null;
  poids_kg: number | null;
  taille_cm: number | null;
  niveau: Niveau;
  fc_max: number | null;
  fc_repos: number | null;
  ref_distance_km: number | null;
  ref_temps_min: number | null;
  volume_actuel_min: number;
  dplus_actuel_m: number;
  jours_dispo: Jour[];
  jour_longue: Jour;
  blessure_recente: boolean;
  preferences: Preferences;
  consentement_sante: boolean;
  consentement_ia: boolean;
  onboarding_termine: boolean;
  role: 'membre' | 'coach' | 'admin';
  statut: 'actif' | 'suspendu';
  abonnement: 'essai' | 'premium' | 'offert' | 'expire';
  abonnement_fin: string | null;
  created_at: string;
  derniere_activite: string;
  jeton_calendrier?: string | null;
}

export interface ObjectifDb {
  id: string;
  user_id: string;
  nom: string | null;
  type: TypeCourse;
  distance_km: number;
  dplus_m: number;
  date: string;
  actif: boolean;
  created_at: string;
}

export interface Bilan {
  semaine: number;
  date: string;
  decision: Decision;
}

export interface PlanDb {
  id: string;
  user_id: string;
  objectif_id: string | null;
  contenu: Plan;
  bilans: Bilan[];
  actif: boolean;
  created_at: string;
}

export interface SeanceRealiseeDb {
  id: string;
  user_id: string;
  plan_id: string | null;
  seance_id: string | null;
  type_prevu: string | null;
  date: string;
  duree_min: number;
  distance_km: number | null;
  dplus_m: number | null;
  rpe: number;
  douleur: number;
  zone_douleur: string | null;
  sommeil: number | null;
  commentaire: string | null;
  alerte_traitee: boolean;
  created_at: string;
}

export interface BilanMatinDb {
  id: string;
  user_id: string;
  date: string;
  sommeil: number;
  energie: number;
  jambes: number;
  douleur: number;
  zone_douleur: string | null;
  score: number;
  adaptation: import('./quotidien').Adaptation;
  created_at: string;
}

export type Fournisseur = 'garmin' | 'coros' | 'polar' | 'strava' | 'suunto';

export interface ConnexionDb {
  id: string;
  user_id: string;
  fournisseur: Fournisseur;
  compte_externe: string | null;
  derniere_synchro: string | null;
  created_at: string;
}
