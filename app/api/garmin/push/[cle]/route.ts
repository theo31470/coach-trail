import { NextResponse } from 'next/server';
import { recevoir } from '@/lib/garmin-reception';

export const maxDuration = 60;

export async function POST(requete: Request, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  return recevoir(requete, cle);
}

export function GET() {
  return NextResponse.json({ ok: true, service: 'Monotrace · réception Garmin' });
}
