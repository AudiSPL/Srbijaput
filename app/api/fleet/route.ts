// app/api/fleet/route.ts
// ═══════════════════════════════════════════════════════════════
// Server-side proxy za Google Sheets CSV
// Ovo rešava CORS problem — browser NE može direktno da fetchu-je
// CSV sa Google Sheets-a, ali Next.js server-side MOŽE.
//
// Kešira podatke na 5 minuta (revalidate: 300)
// Tvoj Sheet se ionako refreshuje jednom dnevno.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

const SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1taPBLXDC4KEjyzQ5K8lJ_amB15Fa0azraEc_XEcaa_E/export?format=csv&gid=0';

export const revalidate = 300; // Keš 5 minuta

export async function GET() {
  try {
    const response = await fetch(SHEET_CSV_URL, {
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'Fleet-Dashboard/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets vratio ${response.status}`);
    }

    const csvText = await response.text();

    // Validacija — proveri da CSV ima podatke
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV je prazan');
    }

    return new NextResponse(csvText, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Greška pri fetch-u Sheet podataka:', error);
    return NextResponse.json(
      { error: 'Nije moguće učitati podatke iz Google Sheet-a' },
      { status: 500 }
    );
  }
}
