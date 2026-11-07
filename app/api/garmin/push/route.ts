import { NextResponse } from 'next/server';
import { recevoir } from '@/lib/garmin-reception';

export const maxDuration = 60;

/**
 * Adresse appelée par Garmin à chaque synchronisation d'une montre (sommeil, FC au repos, VFC, sorties, déconnexions).
 * Protégée par une clé dans l'adresse : /api/garmin/push/<clé> (le portail Garmin supprime les paramètres « ?… »).
 * Garmin attend une réponse 200 rapide ; une erreur de notre côté renvoie 500 pour qu'il réessaie.
 */
export async function POST(requete: Request) {
  return recevoir(requete, new URL(requete.url).searchParams.get('cle'));
}

/** Certains outils Garmin vérifient l'adresse par un GET. */
export function GET() {
  return NextResponse.json({ ok: true, service: 'Monotrace · réception Garmin' });
}
