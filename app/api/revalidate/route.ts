// app/api/revalidate/route.ts
// ═══════════════════════════════════════════════════════════════
// On-demand revalidation endpoint
// Pozovi ovo kad Google Sheet dovrši refresh da se keš očisti
//
// Korišćenje:
//   GET /api/revalidate?secret=tvoj_tajni_token
//
// Možeš ovo pozvati iz Google Apps Script-a nakon importa:
//   UrlFetchApp.fetch('https://tvoj-sajt.vercel.app/api/revalidate?secret=...')
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Proveri tajni token (opciono ali preporučljivo)
  if (process.env.REVALIDATE_SECRET && secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Nevažeći token' }, { status: 401 });
  }

  try {
    // Očisti keš za glavnu stranicu i API rutu
    revalidatePath('/', 'page');
    revalidatePath('/api/fleet', 'page');

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      message: 'Keš je uspešno očišćen. Sledeći zahtev će povući sveže podatke.'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Greška pri revalidaciji' },
      { status: 500 }
    );
  }
}
