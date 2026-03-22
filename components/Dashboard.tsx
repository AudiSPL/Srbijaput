"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, Area, AreaChart
} from "recharts";

// ═══════════════════════════════════════════════════════════════
// FETCH URL — koristi naš API proxy (rešava CORS)
// U development-u: http://localhost:3000/api/fleet
// U produkciji: https://tvoj-sajt.vercel.app/api/fleet
// ═══════════════════════════════════════════════════════════════
import * as XLSX from "xlsx";
const DATA_URL = "/api/fleet";

// ─── Paleta boja ────────────────────────────────────────────
const C = {
  bg: "#07080d", card: "#0f1018", cardHover: "#161825",
  border: "#1c1e2e", borderLight: "#282a42", text: "#e8e8f4",
  textMuted: "#8888aa", textDim: "#505070",
  accent: "#d4a236", accentLight: "#e8bf5a", accentGlow: "rgba(212,162,54,0.12)",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.10)",
  amber: "#f59e0b", amberDim: "rgba(245,158,11,0.10)",
  rose: "#ef4444", roseDim: "rgba(239,68,68,0.10)",
  cyan: "#06b6d4", cyanDim: "rgba(6,182,212,0.10)",
  indigo: "#6366f1", indigoDim: "rgba(99,102,241,0.10)",
};
const CC = ["#d4a236","#06b6d4","#22c55e","#ef4444","#a855f7","#ec4899","#f97316","#14b8a6","#6366f1","#84cc16"];

// ─── CSV Parser (PapaParse alternativa, zero-dependency) ────
function parseCSV(text: string) {
  const lines = text.split("\n"); if (lines.length < 2) return [];
  const headers = pLine(lines[0]); const rows: Record<string,string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const v = pLine(lines[i]);
    if (v.length >= headers.length) {
      const o: Record<string,string> = {};
      headers.forEach((h,idx) => (o[h.trim()] = v[idx]?.trim() || ""));
      rows.push(o);
    }
  }
  return rows;
}
function pLine(l: string) {
  const r: string[] = []; let c = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i+1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { r.push(c); c = ""; } else c += ch; }
  }
  r.push(c); return r;
}

function pDate(s: string) {
  if (!s) return null;
  const c = s.replace(/"/g, "").trim();
  const m = c.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +(m[6]||0));
  const d = new Date(c);
  return isNaN(d.getTime()) ? null : d;
}
function pNum(s: string) { if (!s) return 0; var c = s.replace(/[^0-9.,-]/g, ""); c = c.replace(/\./g, "").replace(",", "."); return parseFloat(c) || 0; }
function fR(n: number) { return new Intl.NumberFormat("sr-RS").format(Math.round(n)) + " RSD"; }
function fK(n: number) { if (n >= 1e6) return (n/1e6).toFixed(1) + "M"; if (n >= 1e3) return (n/1e3).toFixed(1) + "K"; return n.toFixed(0); }

const FK = ["DIZEL","BMB","MOTION","BENZIN","DIESEL","GASOLINE","EVRO DIZ","EDMAXX","MAXXM","MAXX"];
function isF(p: string) { const u = (p||"").toUpperCase(); return FK.some(k => u.includes(k)); }

// ─── Tooltip ────────────────────────────────────────────────
function TT({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"rgba(15,16,24,0.97)",border:`1px solid ${C.borderLight}`,borderRadius:10,padding:"10px 14px",backdropFilter:"blur(12px)",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
      <div style={{color:C.textMuted,fontSize:11,marginBottom:5,fontFamily:"'JetBrains Mono',monospace"}}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:p.color}}/>
          <span style={{color:C.text,fontSize:12}}>{p.name}: <strong>{fmt ? fmt(p.value) : fR(p.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Data Callout ───────────────────────────────────────────
function Callout({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",margin:"0 6px 6px 0"}}>
      <span style={{fontSize:15}}>{icon}</span>
      <div>
        <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
        <div style={{color:color||C.text,fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>
      </div>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────
function KPI({ title, value, sub, icon, dim }: { title: string; value: string; sub?: string; icon: string; color?: string; dim: string }) {
  const [h, sH] = useState(false);
  return (
    <div onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{background:h?C.cardHover:C.card,border:`1px solid ${h?C.borderLight:C.border}`,borderRadius:14,padding:"22px 24px",flex:1,minWidth:200,transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)",transform:h?"translateY(-2px)":"none",boxShadow:h?"0 8px 24px rgba(0,0,0,0.4)":"none",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:dim,filter:"blur(20px)"}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:34,height:34,borderRadius:9,background:dim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{icon}</div>
        <span style={{color:C.textMuted,fontSize:11,fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase"}}>{title}</span>
      </div>
      <div style={{fontSize:26,fontWeight:700,color:C.text,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"-0.02em"}}>{value}</div>
      {sub && <div style={{color:C.textDim,fontSize:11,marginTop:5}}>{sub}</div>}
    </div>
  );
}

// ─── Chart Card ─────────────────────────────────────────────
function CCard({ title, sub, children, extra, callouts }: any) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"22px 22px 14px",display:"flex",flexDirection:"column" as const}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <h3 style={{color:C.text,fontSize:14,fontWeight:600,margin:0}}>{title}</h3>
          {sub && <p style={{color:C.textMuted,fontSize:11,margin:"3px 0 0"}}>{sub}</p>}
        </div>
        {extra}
      </div>
      {callouts && <div style={{display:"flex",flexWrap:"wrap" as const,marginBottom:10,marginTop:6}}>{callouts}</div>}
      <div style={{flex:1,minHeight:0}}>{children}</div>
    </div>
  );
}

// ─── Pill Toggle ────────────────────────────────────────────
function Pill({ opts, val, onChange }: { opts: {l:string;v:string}[]; val: string; onChange: (v:string) => void }) {
  return (
    <div style={{display:"flex",background:C.bg,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.2s",background:val===o.v?C.accent:"transparent",color:val===o.v?"#000":C.textMuted}}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ─── Alert Panel ────────────────────────────────────────────
function AlertPanel({ show, onClose }: { show: boolean; onClose: () => void }) {
  const [freq, sFreq] = useState("dnevno");
  const [time, sTime] = useState("08:00");
  const [emails, sEmails] = useState("");
  const [saved, sSaved] = useState(false);
  const [th, sTh] = useState({ overSpend: true, lateRefuel: true, nonFuel: false });

  if (!show) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.borderLight}`,borderRadius:16,padding:32,width:"90%",maxWidth:520,boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{color:C.text,fontSize:18,fontWeight:600,margin:0}}>⚡ Подешавања обавештења</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textMuted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{color:C.textMuted,fontSize:11,fontWeight:500,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Распоред слања</label>
          <div style={{display:"flex",gap:8}}>
            {["dnevno","nedeljno","prilagođeno"].map(f => (
              <button key={f} onClick={() => sFreq(f)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${freq===f?C.accent:C.border}`,background:freq===f?C.accentGlow:"transparent",color:freq===f?C.accentLight:C.textMuted,cursor:"pointer",fontSize:13,fontWeight:500,textTransform:"capitalize"}}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{color:C.textMuted,fontSize:11,fontWeight:500,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Време слања</label>
          <input type="time" value={time} onChange={e => sTime(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:14,width:"100%",fontFamily:"'JetBrains Mono',monospace",colorScheme:"dark"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{color:C.textMuted,fontSize:11,fontWeight:500,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Email приmaоци</label>
          <input value={emails} onChange={e => sEmails(e.target.value)} placeholder="korisnik@firma.com" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontSize:13,width:"100%",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{color:C.textMuted,fontSize:11,fontWeight:500,display:"block",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Окидачи за упозорења</label>
          {[
            {k:"overSpend",l:"Прекорачење дневне потрошње",d:"Упозорење кад возило прекорачи просек за 50%"},
            {k:"lateRefuel",l:"Касно ноћно точење",d:"Упозорење на точење после 22:00"},
            {k:"nonFuel",l:"Висока вангоривна потрошња",d:"Упозорење кад вангоривна прекорачи 20% укупне"}
          ].map(item => (
            <div key={item.k} onClick={() => sTh(t => ({...t,[item.k]:!t[item.k as keyof typeof t]}))}
              style={{display:"flex",gap:12,padding:"10px 12px",borderRadius:8,cursor:"pointer",background:th[item.k as keyof typeof th]?C.accentGlow:"transparent",border:`1px solid ${th[item.k as keyof typeof th]?"rgba(212,162,54,0.3)":C.border}`,marginBottom:8,transition:"all 0.2s"}}>
              <div style={{width:18,height:18,borderRadius:4,flexShrink:0,marginTop:1,border:`2px solid ${th[item.k as keyof typeof th]?C.accent:C.textDim}`,background:th[item.k as keyof typeof th]?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:11}}>
                {th[item.k as keyof typeof th] && "✓"}
              </div>
              <div>
                <div style={{color:C.text,fontSize:13,fontWeight:500}}>{item.l}</div>
                <div style={{color:C.textDim,fontSize:11,marginTop:2}}>{item.d}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { sSaved(true); setTimeout(() => sSaved(false), 2000); }}
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:saved?C.green:`linear-gradient(135deg,${C.accent},#c4872a)`,color:saved?"#fff":"#000",fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.3s"}}>
          {saved ? "✓ Сачувано!" : "Сачувај подешавања"}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═════════════════════════════════════════════════════════════
export default function FleetDashboard() {
  const [rawData, setRawData] = useState<Record<string,string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeAgg, setTimeAgg] = useState("month");
  const [showAlerts, setShowAlerts] = useState(false);

  function exportRaw() {
    if (!filtered || filtered.length === 0) { alert("Nema podataka za export."); return; }
    const rows = filtered.map((r: Record<string,string>) => ({
      "\u0422\u0430\u0431\u043b\u0438\u0446\u0430": r.LICENSE_PLATE_NO,
      "\u0414\u0430\u0442\u0443\u043c": r.TRANSACTION_DATE,
      "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434": r.PRODUCT_INV,
      "\u0418\u0437\u043d\u043e\u0441 (RSD)": pNum(r.GROSS_CC),
      "\u0413\u043e\u0440\u0438\u0432\u043e": isF(r.PRODUCT_INV) ? "Da" : "Ne",
      "\u041b\u043e\u043a\u0430\u0446\u0438\u0458\u0430": r.SITE_TOWN,
      "\u0410\u0434\u0440\u0435\u0441\u0430": r.SITE_STREET,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transakcije");
    XLSX.writeFile(wb, "srbijaput_podaci_" + new Date().toISOString().slice(0,10) + ".xlsx");
  }

  function exportReport() {
    if (!filtered || filtered.length === 0) { alert("Nema podataka za export."); return; }
    const wb = XLSX.utils.book_new();
    const wsKPI = XLSX.utils.json_to_sheet([
      { "Metrika": "Ukupna potrosnja (RSD)", "Vrednost": Math.round(kpis.ts) },
      { "Metrika": "Broj transakcija",       "Vrednost": kpis.tt },
      { "Metrika": "Gorivo transakcije",     "Vrednost": kpis.ft },
      { "Metrika": "Vangorivno (RSD)",       "Vrednost": Math.round(kpis.nfs) },
      { "Metrika": "Vangorivno %",           "Vrednost": +((kpis.nfs/kpis.ts*100)||0).toFixed(2) },
      { "Metrika": "Aktivna vozila",         "Vrednost": kpis.uv },
    ]);
    XLSX.utils.book_append_sheet(wb, wsKPI, "KPI Rezime");
    const wsTop = XLSX.utils.json_to_sheet(c1.data.map((r: any, i: number) => ({
      "Rang": i+1, "Tablica": r.plate, "Ukupno (RSD)": Math.round(r.total),
    })));
    XLSX.utils.book_append_sheet(wb, wsTop, "Top 10 Vozila");
    const wsNF = XLSX.utils.json_to_sheet(c2.data.map((r: any, i: number) => ({
      "Rang": i+1, "Tablica": r.plate, "Vangorivno (RSD)": Math.round(r.total),
    })));
    XLSX.utils.book_append_sheet(wb, wsNF, "Vangorivna");
    const wsAll = XLSX.utils.json_to_sheet(filtered.map((r: Record<string,string>) => ({
      "Tablica": r.LICENSE_PLATE_NO, "Datum": r.TRANSACTION_DATE,
      "Proizvod": r.PRODUCT_INV, "Iznos (RSD)": pNum(r.GROSS_CC), "Lokacija": r.SITE_TOWN,
    })));
    XLSX.utils.book_append_sheet(wb, wsAll, "Sve transakcije");
    XLSX.writeFile(wb, "srbijaput_izvestaj_" + new Date().toISOString().slice(0,10) + ".xlsx");
  }
  const [src, setSrc] = useState("loading");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ─── Fetch podataka ───────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.length > 0 && parsed[0].LICENSE_PLATE_NO) {
        setRawData(parsed);
        setSrc("live");
        setLastRefresh(new Date());
      } else throw new Error("Nema podataka");
    } catch (e) {
      console.error("Greška:", e);
      setSrc("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh svakih 10 minuta
  useEffect(() => {
    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Obrada podataka ──────────────────────────────────
  const data = useMemo(() =>
    rawData.map(r => ({
      ...r,
      date: pDate(r.TRANSACTION_DATE),
      amount: pNum(r.GROSS_CC),
      plate: (r.LICENSE_PLATE_NO || "").trim(),
      product: (r.PRODUCT_INV || "").trim(),
    })).filter(r => r.date && r.plate),
  [rawData]);

  const filtered = useMemo(() => {
    let d = data;
    if (dateFrom) { const f = new Date(dateFrom); d = d.filter(r => r.date! >= f); }
    if (dateTo) { const t = new Date(dateTo); t.setHours(23,59,59); d = d.filter(r => r.date! <= t); }
    return d;
  }, [data, dateFrom, dateTo]);

  // KPI-evi
  const kpis = useMemo(() => {
    const ts = filtered.reduce((s,r) => s + r.amount, 0);
    const tt = filtered.length;
    const ft = filtered.filter(r => isF(r.product)).length;
    const nfs = filtered.filter(r => !isF(r.product)).reduce((s,r) => s + r.amount, 0);
    const uv = new Set(filtered.map(r => r.plate)).size;
    return { ts, tt, ft, nfs, uv };
  }, [filtered]);

  // Grafikon 1: Top 10 ukupno
  const c1 = useMemo(() => {
    const m: Record<string,number> = {};
    filtered.forEach(r => { m[r.plate] = (m[r.plate]||0) + r.amount; });
    const s = Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,10);
    const tp = s[0]; const tot = s.reduce((sum,e) => sum + e[1], 0);
    return { data: s.map(([plate,total]) => ({plate,total:Math.round(total)})), topP: tp?.[0], topV: tp?.[1], total: tot };
  }, [filtered]);

  // Grafikon 2: Top 10 van goriva
  const c2 = useMemo(() => {
    const m: Record<string,number> = {};
    filtered.filter(r => !isF(r.product)).forEach(r => { m[r.plate] = (m[r.plate]||0) + r.amount; });
    const s = Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,10);
    const tp = s[0]; const tot = s.reduce((sum,e) => sum + e[1], 0);
    return { data: s.map(([plate,total]) => ({plate,total:Math.round(total)})), topP: tp?.[0], topV: tp?.[1], total: tot };
  }, [filtered]);

  // Grafikon 3: Trend
  const c3 = useMemo(() => {
    const byP: Record<string,number> = {};
    filtered.forEach(r => { byP[r.plate] = (byP[r.plate]||0) + r.amount; });
    const top10 = Object.entries(byP).sort((a,b) => b[1]-a[1]).slice(0,10).map(e => e[0]);
    const bk: Record<string, Record<string,number>> = {};
    filtered.filter(r => top10.includes(r.plate)).forEach(r => {
      let key: string;
      if (timeAgg === "week") {
        const d = new Date(r.date!);
        const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        key = new Date(d.setDate(diff)).toISOString().slice(0,10);
      } else {
        key = `${r.date!.getFullYear()}-${String(r.date!.getMonth()+1).padStart(2,"0")}`;
      }
      if (!bk[key]) bk[key] = {};
      bk[key][r.plate] = (bk[key][r.plate]||0) + r.amount;
    });
    const periods = Object.keys(bk).sort();
    return {
      plates: top10,
      data: periods.map(p => { const row: any = {period:p}; top10.forEach(pl => { row[pl] = Math.round(bk[p][pl]||0); }); return row; }),
      pc: periods.length
    };
  }, [filtered, timeAgg]);

  // Grafikon 4: Najkasnije točenje
  const c4 = useMemo(() => {
    const mx: Record<string,{m:number;t:string}> = {};
    filtered.filter(r => isF(r.product)).forEach(r => {
      const mins = r.date!.getHours()*60 + r.date!.getMinutes();
      const ts = `${String(r.date!.getHours()).padStart(2,"0")}:${String(r.date!.getMinutes()).padStart(2,"0")}`;
      if (!mx[r.plate] || mins > mx[r.plate].m) mx[r.plate] = {m:mins, t:ts};
    });
    const s = Object.entries(mx).sort((a,b) => b[1].m - a[1].m).slice(0,10);
    const latest = s[0];
    return { data: s.map(([plate,info]) => ({plate,minutes:info.m,time:info.t})), lP: latest?.[0], lT: latest?.[1]?.t };
  }, [filtered]);

  const sQR = useCallback((d: number) => {
    const to = new Date(), fr = new Date();
    fr.setDate(fr.getDate()-d);
    setDateFrom(fr.toISOString().slice(0,10));
    setDateTo(to.toISOString().slice(0,10));
  }, []);

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,border:`3px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:C.textMuted,fontSize:14}}>Учитавање података флоте...</span>
    </div>
  );

  if (src === "error") return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <span style={{fontSize:48}}>⚠️</span>
      <span style={{color:C.rose,fontSize:16,fontWeight:600}}>Грешка при учитавању</span>
      <span style={{color:C.textMuted,fontSize:13}}>Проверите да ли је Google Sheet доступан</span>
      <button onClick={() => { setLoading(true); fetchData(); }}
        style={{padding:"10px 24px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8}}>
        Покушај поново
      </button>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Manrope','SF Pro Display',-apple-system,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}input[type="date"],input[type="time"]{color-scheme:dark}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(max-width:768px){.mob-hdr{padding:10px 14px!important;flex-wrap:wrap;gap:8px}.mob-hdr-title{font-size:12px!important}.mob-hdr-sub{font-size:10px!important}.mob-pad{padding:12px 10px 48px!important}.mob-grid{grid-template-columns:1fr!important}.mob-kpi{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.mob-hdr-right{width:100%;justify-content:flex-end}}`}</style>

      {/* Header */}
      <div className="mob-hdr" style={{borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100,background:"rgba(7,8,13,0.88)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <img src="/logo.png" alt="Србијапут" style={{height:42,borderRadius:6}}/>
          <div>
            <h1 style={{fontSize:16,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>Србијапут · Аналитика горива</h1>
            <span style={{fontSize:11,color:C.textDim}}>
              ● Подаци уживо · {filtered.length} трансакција · {kpis.uv} возила
              {lastRefresh && ` · Освежено ${lastRefresh.toLocaleTimeString("sr-RS")}`}
            </span>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={() => { setLoading(true); fetchData(); }}
            style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontSize:13,cursor:"pointer"}}>🔄</button>
          <button onClick={exportRaw}
            style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>📊 Подаци</button>
          <button onClick={exportReport}
            style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${C.accentGlow}`,background:C.accentGlow,color:C.accent,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>📈 Извештај</button>
          <button onClick={() => setShowAlerts(true)}
            style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>🔔 Обавештења</button>
        </div>
      </div>

      <div className="mob-pad" style={{padding:"22px 28px 48px",maxWidth:1400,margin:"0 auto"}}>
        {/* Filteri */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22,flexWrap:"wrap",animation:"fadeIn 0.4s ease"}}>
          <span style={{color:C.textMuted,fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em"}}>Филтер:</span>
          {[{l:"7Д",d:7},{l:"30Д",d:30},{l:"90Д",d:90},{l:"ОГД",d:Math.floor((Date.now()-new Date(new Date().getFullYear(),0,1).getTime())/864e5)}].map(q => (
            <button key={q.l} onClick={() => sQR(q.d)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontSize:12,cursor:"pointer"}}>{q.l}</button>
          ))}
          <div style={{width:1,height:20,background:C.border,margin:"0 4px"}}/>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.text,fontSize:12}}/>
          <span style={{color:C.textDim,fontSize:12}}>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.text,fontSize:12}}/>
          {(dateFrom||dateTo) && <button onClick={() => {setDateFrom("");setDateTo("");}} style={{padding:"5px 10px",borderRadius:6,border:"none",background:C.roseDim,color:C.rose,fontSize:11,cursor:"pointer"}}>✕ Обриши</button>}
        </div>

        {/* KPI */}
        <div className="mob-kpi" style={{display:"flex",gap:14,marginBottom:24,flexWrap:"wrap",animation:"fadeIn 0.5s ease"}}>
          <KPI title="Укупна потрошња" value={fR(kpis.ts)} sub={`${fK(kpis.ts)} за сва возила`} icon="💰" color={C.accent} dim={C.accentGlow}/>
          <KPI title="Трансакције" value={kpis.tt.toLocaleString()} sub={`${kpis.ft} гориво · ${kpis.tt-kpis.ft} остало`} icon="📊" color={C.cyan} dim={C.cyanDim}/>
          <KPI title="Вангоривна потрошња" value={fR(kpis.nfs)} sub={`${((kpis.nfs/kpis.ts)*100||0).toFixed(1)}% од укупне`} icon="🛒" color={C.amber} dim={C.amberDim}/>
          <KPI title="Активна возила" value={kpis.uv.toString()} sub="Јединствене таблице у периоду" icon="🚛" color={C.green} dim={C.greenDim}/>
        </div>

        {/* Grafikoni 1 & 2 */}
        <div className="mob-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18,animation:"fadeIn 0.6s ease"}}>
          <CCard title="Топ 10 возила по укупној потрошњи" sub="Сви производи"
            callouts={<><Callout icon="🏆" label="Највећи потрошач" value={c1.topP||"—"} color={C.accent}/><Callout icon="💰" label="Износ #1" value={fR(c1.topV||0)} color={C.accentLight}/><Callout icon="Σ" label="Укупно Топ 10" value={fR(c1.total)} color={C.text}/></>}>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={c1.data} layout="vertical" margin={{left:10,right:20,top:5,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tickFormatter={fK} tick={{fill:C.textDim,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="plate" width={85} tick={{fill:C.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="total" name="Укупно" radius={[0,6,6,0]} barSize={20}>
                  {c1.data.map((_: any,i: number) => <Cell key={i} fill={CC[i%CC.length]} fillOpacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CCard>

          <CCard title="Топ 10 – вангоривна потрошња" sub="Без: ДИЗЕЛ, БМБ, MOTION"
            callouts={<><Callout icon="🏆" label="Највећи потрошач" value={c2.topP||"—"} color={C.amber}/><Callout icon="🛒" label="Износ #1" value={fR(c2.topV||0)} color={C.amber}/><Callout icon="Σ" label="Укупно Топ 10" value={fR(c2.total)} color={C.text}/></>}>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={c2.data} layout="vertical" margin={{left:10,right:20,top:5,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tickFormatter={fK} tick={{fill:C.textDim,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="plate" width={85} tick={{fill:C.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="total" name="Вангоривно" radius={[0,6,6,0]} barSize={20}>
                  {c2.data.map((_: any,i: number) => <Cell key={i} fill={CC[(i+3)%CC.length]} fillOpacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CCard>
        </div>

        {/* Grafikon 3: Trend */}
        <div style={{marginBottom:18,animation:"fadeIn 0.7s ease"}}>
          <CCard title="Трендови потрошње – Топ 10 возила" sub={`Агрегација по ${timeAgg==="week"?"недељи":"месецу"}`}
            extra={<Pill opts={[{l:"Месечно",v:"month"},{l:"Недељно",v:"week"}]} val={timeAgg} onChange={setTimeAgg}/>}
            callouts={<><Callout icon="📅" label="Периода" value={c3.pc.toString()} color={C.cyan}/><Callout icon="📈" label="Возила" value={c3.plates.length.toString()} color={C.indigo}/><Callout icon="🔀" label="Приказ" value={timeAgg==="week"?"Недељни":"Месечни"} color={C.accentLight}/></>}>
            <ResponsiveContainer width="100%" height={370}>
              <AreaChart data={c3.data} margin={{left:10,right:20,top:10,bottom:5}}>
                <defs>{c3.plates.map((_: string, i: number) => (<linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC[i]} stopOpacity={0.22}/><stop offset="100%" stopColor={CC[i]} stopOpacity={0.02}/></linearGradient>))}</defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="period" tick={{fill:C.textDim,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fK} tick={{fill:C.textDim,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TT/>}/>
                <Legend wrapperStyle={{fontSize:11,paddingTop:12,fontFamily:"'JetBrains Mono',monospace"}} iconType="circle" iconSize={8}/>
                {c3.plates.map((plate: string, i: number) => (<Area key={plate} type="monotone" dataKey={plate} name={plate} stroke={CC[i]} strokeWidth={2} fill={`url(#g${i})`} dot={false} activeDot={{r:4,strokeWidth:2}}/>))}
              </AreaChart>
            </ResponsiveContainer>
          </CCard>
        </div>

        {/* Grafikon 4: Najkasnije */}
        <div style={{animation:"fadeIn 0.8s ease"}}>
          <CCard title="Топ 10 најкасније точе гориво" sub="Возила са најкаснијим точењем у току дана"
            callouts={<><Callout icon="🌙" label="Најкасније точење" value={c4.lT||"—"} color={C.rose}/><Callout icon="🚛" label="Возило" value={c4.lP||"—"} color={C.rose}/><Callout icon="⚠️" label="После 21ч" value={c4.data.filter(d=>d.minutes>1260).length+" возила"} color={C.amber}/></>}>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={c4.data} layout="vertical" margin={{left:10,right:30,top:5,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" domain={[0,1440]}
                  tickFormatter={(v: number) => `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`}
                  tick={{fill:C.textDim,fontSize:11}} axisLine={false} tickLine={false}
                  ticks={[360,480,600,720,840,960,1080,1200,1320,1440]}/>
                <YAxis type="category" dataKey="plate" width={85} tick={{fill:C.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}} axisLine={false} tickLine={false}/>
                <Tooltip content={({active,payload,label}: any) => {
                  if (!active || !payload?.length) return null;
                  const item = c4.data.find(d => d.plate === label);
                  return (<div style={{background:"rgba(15,16,24,0.97)",border:`1px solid ${C.borderLight}`,borderRadius:10,padding:"10px 14px",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
                    <div style={{color:C.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{label}</div>
                    <div style={{color:C.text,fontSize:14,marginTop:4}}>Последње точење: <strong style={{color:C.rose}}>{item?.time}</strong></div>
                  </div>);
                }}/>
                <Bar dataKey="minutes" name="Време" radius={[0,6,6,0]} barSize={20}>
                  {c4.data.map((e: any, i: number) => <Cell key={i} fill={e.minutes>1260?C.rose:e.minutes>1080?C.amber:C.cyan} fillOpacity={0.8}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:6,paddingBottom:4}}>
              {[{c:C.cyan,l:"Пре 18:00"},{c:C.amber,l:"18:00–21:00"},{c:C.rose,l:"После 21:00"}].map(l => (
                <div key={l.l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:l.c}}/><span style={{color:C.textDim,fontSize:11}}>{l.l}</span></div>
              ))}
            </div>
          </CCard>
        </div>

        <div style={{textAlign:"center",marginTop:36,padding:"18px 0",borderTop:`1px solid ${C.border}`}}>
          <img src="/logo.png" alt="Србијапут" style={{height:32,marginBottom:8,opacity:0.5}}/>
          <div style={{color:C.textDim,fontSize:11}}>Аналитика горива флоте · Подаци се освежавају дневно · Аутоматски refresh на 10 мин</div>
        </div>
      </div>

      <AlertPanel show={showAlerts} onClose={() => setShowAlerts(false)}/>
    </div>
  );
}

