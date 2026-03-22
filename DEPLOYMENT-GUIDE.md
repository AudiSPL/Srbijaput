# 🚀 Fleet Dashboard — Vodič za deployment korak po korak

## Pregled arhitekture

```
┌─────────────────────────────────────────────────────────┐
│  Google Sheet (Master Baza OMV)                        │
│  ↕ Refreshuje se dnevno putem Google Apps Script       │
└──────────────┬──────────────────────────────────────────┘
               │ CSV export
               ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js App na Vercel                                  │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ /api/fleet        │  │ / (Dashboard stranica)     │  │
│  │ Server-side fetch │──│ Klijentski React + Recharts│  │
│  │ CSV → JSON proxy  │  │ Auto-refresh na 10 min     │  │
│  └──────────────────┘  └────────────────────────────┘  │
│  ┌──────────────────┐                                   │
│  │ /api/revalidate   │ ← Poziva Apps Script posle       │
│  │ Čisti keš         │   dnevnog importa                │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
               │
               ▼ Dnevni email u 8:00
┌─────────────────────────────────────────────────────────┐
│  Google Apps Script                                     │
│  - Dnevni import podataka u Sheet                       │
│  - Šalje email izveštaj sa KPI-evima                    │
│  - Poziva /api/revalidate da osveži dashboard keš       │
└─────────────────────────────────────────────────────────┘
```

---

## FAZA 1: Priprema (10 min)

### Korak 1.1 — Instaliraj potrebne alate

Trebaš samo 3 stvari na računaru:

```bash
# 1. Node.js (verzija 18+)
# Preuzmi sa: https://nodejs.org/
node --version   # treba da pokaže v18+ ili v20+

# 2. Git
git --version

# 3. Vercel CLI
npm install -g vercel
```

### Korak 1.2 — Napravi GitHub nalog (ako nemaš)

Idi na https://github.com i registruj se. Besplatno je.

### Korak 1.3 — Napravi Vercel nalog

Idi na https://vercel.com i uloguj se sa GitHub nalogom. Besplatno je.

---

## FAZA 2: Podesi projekat lokalno (15 min)

### Korak 2.1 — Kreiraj folder projekta

```bash
mkdir fleet-dashboard
cd fleet-dashboard
```

### Korak 2.2 — Kopiraj fajlove

Iz fajlova koje sam ti dao, kopiraj SVE u ovaj folder.
Struktura treba da izgleda ovako:

```
fleet-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── fleet/
│       │   └── route.ts
│       └── revalidate/
│           └── route.ts
├── components/
│   └── Dashboard.tsx
├── public/
│   └── logo.png          ← tvoj Srbijaputh logo
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md              ← opciono
```

### Korak 2.3 — Instaliraj zavisnosti

```bash
npm install
```

Ovo će instalirati Next.js, React, Recharts i ostale pakete.
Trajaće 1-2 minuta.

### Korak 2.4 — Podesi environment varijable

```bash
cp .env.example .env.local
```

Otvori `.env.local` u editoru i proveri da je URL tačan:

```
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/1taPBLXDC4KEjyzQ5K8lJ_amB15Fa0azraEc_XEcaa_E/export?format=csv&gid=0
REVALIDATE_SECRET=moj_tajni_token_12345
```

### Korak 2.5 — Pokreni lokalno

```bash
npm run dev
```

Otvori http://localhost:3000 u browseru.
Trebalo bi da vidiš dashboard sa podacima iz tvog Google Sheet-a.

**Ako ne vidiš podatke:**
- Proveri da li je Sheet "Published to web"
  (File → Share → Publish to web → Entire Document → CSV)
- Proveri URL u `.env.local`

### Korak 2.6 — Testiraj API

Otvori u browseru:
```
http://localhost:3000/api/fleet
```
Treba da vidiš CSV podatke. Ako vidiš — sve radi.

---

## FAZA 3: Postavi na GitHub (5 min)

### Korak 3.1 — Napravi Git repo

```bash
git init
git add .
git commit -m "Fleet Fuel Dashboard - initial commit"
```

### Korak 3.2 — Napravi repo na GitHub-u

1. Idi na https://github.com/new
2. Naziv: `fleet-fuel-dashboard`
3. Ostavi Private (privatni)
4. Klikni "Create repository"

### Korak 3.3 — Push-uj kod

GitHub će ti pokazati komande. Koristi ove:

```bash
git remote add origin https://github.com/TVOJE_IME/fleet-fuel-dashboard.git
git branch -M main
git push -u origin main
```

---

## FAZA 4: Deploy na Vercel (5 min)

### Korak 4.1 — Importuj projekat

1. Idi na https://vercel.com/new
2. Klikni "Import Git Repository"
3. Izaberi `fleet-fuel-dashboard`
4. Vercel će automatski detektovati da je Next.js

### Korak 4.2 — Podesi environment varijable

Pre nego što klikneš Deploy, dodaj varijable:

| Ime | Vrednost |
|-----|----------|
| `GOOGLE_SHEET_CSV_URL` | `https://docs.google.com/spreadsheets/d/1taPBLXDC4KEjyzQ5K8lJ_amB15Fa0azraEc_XEcaa_E/export?format=csv&gid=0` |
| `REVALIDATE_SECRET` | `moj_tajni_token_12345` (stavi svoj) |

### Korak 4.3 — Deploy!

Klikni **Deploy**. Biće gotovo za 1-2 minuta.

Dobićeš URL tipa:
```
https://fleet-fuel-dashboard-xxxxx.vercel.app
```

**To je to — dashboard je LIVE!** 🎉

### Korak 4.4 — (Opciono) Priključi custom domen

U Vercel dashboardu → Settings → Domains → dodaj svoj domen.
Vercel automatski podešava HTTPS.

---

## FAZA 5: Podesi auto-refresh podataka (10 min)

Dashboard SE VEĆ auto-refreshuje na dva načina:
1. **Korisnik otvori stranicu** → API kešira CSV na 5 min
2. **Dashboard na stranici** → auto-refresh svakih 10 min

Ali za INSTANT refresh kad se Sheet osvezi, dodaj ovo:

### Korak 5.1 — Dodaj revalidation poziv u Apps Script

Otvori svoj postojeći Google Apps Script (koji importuje podatke u Sheet)
i DODAJ ovo na kraj tvoje `importData()` funkcije:

```javascript
// Dodaj ovo na KRAJ tvoje import funkcije
function notifyDashboard() {
  try {
    var url = 'https://fleet-fuel-dashboard-xxxxx.vercel.app/api/revalidate?secret=moj_tajni_token_12345';
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });
    Logger.log('Dashboard osvežen: ' + response.getContentText());
  } catch (e) {
    Logger.log('Greška pri osvežavanju dashboarda: ' + e.message);
  }
}
```

Pozovi `notifyDashboard()` na kraju tvoje import funkcije.

### Korak 5.2 — Protok podataka je sad:

```
OMV sistem → Google Script importuje → Sheet se osvezi
                                          ↓
                                    notifyDashboard()
                                          ↓
                              /api/revalidate čisti keš
                                          ↓
                            Sledeći korisnik vidi sveže podatke
```

---

## FAZA 6: Podesi dnevni email (10 min)

### Korak 6.1 — Dodaj email skriptu

Otvori Extensions → Apps Script u tvom Google Sheet-u.
Dodaj novi fajl (File → New → Script file) i nalipi
sadržaj iz `google-apps-script-email.js` koji sam ti već dao.

### Korak 6.2 — Ažuriraj CONFIG

```javascript
const CONFIG = {
  recipients: [
    "tvoj.email@firma.com",
    "sef@firma.com",
  ],
  dashboardUrl: "https://fleet-fuel-dashboard-xxxxx.vercel.app",
  sheetName: "Sheet1",  // ime taba
  // ...
};
```

### Korak 6.3 — Postavi trigger

U Apps Script editoru:
1. Klikni ▶ dugme pored `setupDailyTrigger`
2. Autorizuj permisije kad se pojavi popup
3. Gotovo — email će se slati svaki dan u 8:00

### Korak 6.4 — Testiraj

Klikni ▶ pored `testSendReport` da pošalješ test email.
Proveri inbox — treba da stigne lepo formatiran HTML email.

---

## FAZA 7: Održavanje

### Kad napraviš promenu u kodu:

```bash
git add .
git commit -m "opis promene"
git push
```

Vercel automatski deployuje novu verziju. Zero downtime.

### Kad promeniš Sheet strukturu:

Ako dodaš/preimenuješ kolone, ažuriraj `Dashboard.tsx`
(nazive kolona u parsing logici).

### Monitoring:

- **Vercel dashboard:** https://vercel.com → tvoj projekat → Analytics
- **Logovi:** Vercel → Functions → Pogledaj API logove
- **Apps Script logovi:** View → Execution log

---

## Česta pitanja

**P: Koliko košta?**
Vercel Free plan: 100GB bandwidth/mesec, neograničen deployment.
Za fleet dashboard to je više nego dovoljno. Trošak: 0 RSD.

**P: Mogu li više korisnika istovremeno?**
Da. Vercel koristi CDN — može 1000+ korisnika istovremeno bez problema.

**P: Šta ako Sheet nije dostupan?**
API vraća grešku 500, dashboard prikazuje error ekran sa "Покушај поново"
dugmetom. Čim Sheet bude ponovo dostupan, sve proraditi.

**P: Kako dodam novi grafikon?**
Edituj `components/Dashboard.tsx`, dodaj novu `useMemo` funkciju
za podatke i `<CCard>` komponentu za prikaz. Push na git → auto deploy.

**P: Da li su podaci sigurni?**
CSV se čita server-side (korisnik ne vidi Sheet URL).
Za potpunu zaštitu, dodaj Vercel Password Protection
(Team plan, $20/mesec) ili implementiraj login.

**P: Duplikati tablica?**
Pošto si sredio format u Sheet-u, dashboard koristi egzaktno podudaranje
stringa `LICENSE_PLATE_NO`. Dokle god su tablice uniformne u Sheet-u,
duplikata neće biti.
