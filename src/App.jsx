import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Search, ChevronDown, ChevronRight, AlertCircle, Package, Wallet, Calendar, ClipboardList, Sparkles } from "lucide-react";

const SUPABASE_URL = "https://idkjsxrqaklyhidptaon.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y-yZsch-GC8QNXYY8ja-dA_MaBE4El0";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.method === "POST" ? "return=representation" : undefined,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return res.json();
}

const PRODUCTS = [
  { key: "Panty Liner", label: "Panty Liner", initKey: "pl" },
  { key: "Night", label: "Night (\u1799\u1794\u17cb)", initKey: "night" },
  { key: "Day", label: "Day (\u1790\u17d2\u1784\u17c3)", initKey: "dayp" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function isThisMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function monthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function detectPaymentStatus(note) {
  if (!note) return null;
  const n = note.trim();
  if (!n) return null;
  if (n.includes("ខ្សះ") || n.includes("នៅខ្សះ")) return "owes";
  if (n.includes("ទូទាត់")) return "paid";
  return null;
}
function extractOwedAmount(note) {
  if (!note) return null;
  const n = note.trim();
  const oweWords = ["នៅខ្សះ", "ខ្សះ"];
  let idx = -1, wordLen = 0;
  for (const w of oweWords) {
    const i = n.indexOf(w);
    if (i !== -1) { idx = i; wordLen = w.length; break; }
  }
  if (idx === -1) return null;
  const rest = n.slice(idx + wordLen);
  const m = rest.match(/([\d]+\.?[\d]*)\s*\$/);
  return m ? parseFloat(m[1]) : null;
}
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const emptyLogForm = {
  date: todayStr(),
  storeId: "",
  product: "Panty Liner",
  sold: "",
  returned: "",
  paid: "",
  notes: "",
};

const C = {
  bg: "#0D0E12",
  bg2: "#0A0B0E",
  surface: "#16181F",
  surfaceHover: "#1B1E27",
  border: "#262A35",
  borderLight: "#32384500",
  text: "#F3F1EA",
  textDim: "#8B8FA3",
  textFaint: "#5B5F70",
  gold: "#9B7FC7",
  goldBright: "#BBA3E0",
  goldDim: "#6B5590",
  emerald: "#5FBF8F",
  emeraldBg: "#132621",
  amber: "#E0B44C",
  amberBg: "#2A2213",
  rose: "#DD7A6B",
  roseBg: "#2A1917",
};

export default function MeraConsignmentApp() {
  const [stores, setStores] = useState([]);
  const [visits, setVisits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [expanded, setExpanded] = useState(null);
  const [showPayments, setShowPayments] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showVisitedBreakdown, setShowVisitedBreakdown] = useState(false);
  const [showOwedBreakdown, setShowOwedBreakdown] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logForm, setLogForm] = useState(emptyLogForm);
  const [storeQuery, setStoreQuery] = useState("");
  const [showStoreList, setShowStoreList] = useState(false);
  const storeInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [storeRows, visitRows] = await Promise.all([
          sbFetch("stores?select=*&order=day.asc,name.asc"),
          sbFetch("visits?select=*&order=created_at.asc"),
        ]);
        setStores(
          storeRows.map((r) => ({
            id: r.id,
            day: r.day,
            name: r.name,
            firstSent: r.first_sent,
            pl: r.pl_initial,
            night: r.night_initial,
            dayp: r.day_initial,
          }))
        );
        setVisits(
          visitRows.map((r) => ({
            id: r.id,
            date: r.date,
            store: r.store_name,
            product: r.product,
            sold: Number(r.sold),
            returned: Number(r.returned),
            paid: Number(r.paid),
            notes: r.notes || "",
          }))
        );
      } catch (e) {
        setLoadError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addVisit(v) {
    try {
      const [inserted] = await sbFetch("visits", {
        method: "POST",
        body: JSON.stringify({
          date: v.date,
          store_name: v.store,
          product: v.product,
          sold: v.sold,
          returned: v.returned,
          paid: v.paid,
          notes: v.notes,
        }),
      });
      setVisits((prev) => [
        ...(prev || []),
        {
          id: inserted.id,
          date: inserted.date,
          store: inserted.store_name,
          product: inserted.product,
          sold: Number(inserted.sold),
          returned: Number(inserted.returned),
          paid: Number(inserted.paid),
          notes: inserted.notes || "",
        },
      ]);
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }

  async function submitLog(e) {
    e.preventDefault();
    if (!logForm.storeId) return;
    const store = stores.find((s) => s.id === logForm.storeId);
    if (!store) return;
    const v = {
      date: logForm.date,
      store: store.name,
      product: logForm.product,
      sold: parseFloat(logForm.sold) || 0,
      returned: parseFloat(logForm.returned) || 0,
      paid: parseFloat(logForm.paid) || 0,
      notes: logForm.notes,
    };
    await addVisit(v);
    setLogForm({ ...emptyLogForm, storeId: logForm.storeId, date: logForm.date });
    setStoreQuery(store.name);
  }

  function jumpToStore(storeName, storeId) {
    setSelectedDay(null);
    setSearch(storeName);
    setExpanded(storeId);
    setShowPayments(storeId);
    setShowBreakdown(false);
    setShowVisitedBreakdown(false);
    setShowOwedBreakdown(false);
  }

  function closeLogModal() {
    setShowLog(false);
    setLogForm(emptyLogForm);
    setStoreQuery("");
  }

  const enriched = useMemo(() => {
    const v = visits || [];
    return stores.map((s) => {
      const storeVisits = v.filter((x) => x.store === s.name);
      const products = PRODUCTS.map((p) => {
        const init = s[p.initKey];
        const sold = storeVisits.filter((x) => x.product === p.key).reduce((a, x) => a + x.sold, 0);
        const returned = storeVisits.filter((x) => x.product === p.key).reduce((a, x) => a + x.returned, 0);
        const remaining = Math.max(0, init - sold - returned);
        return { ...p, init, sold, returned, remaining };
      });
      const totalRemaining = products.reduce((a, p) => a + p.remaining, 0);
      const monthVisits = selectedMonth ? storeVisits.filter((x) => monthKey(x.date) === selectedMonth) : storeVisits;
      const totalCollected = monthVisits.reduce((a, x) => a + x.paid, 0);
      const allTimeCollected = storeVisits.reduce((a, x) => a + x.paid, 0);
      const paymentHistory = monthVisits.filter((x) => x.paid > 0).sort((a, b) => a.date.localeCompare(b.date));
      const lastVisitDate = storeVisits.length ? storeVisits.map((x) => x.date).sort().slice(-1)[0] : null;
      const visitedThisMonth = storeVisits.some((x) => isThisMonth(x.date));
      const notedVisits = storeVisits.filter((x) => x.notes && x.notes.trim());
      const latestNote = notedVisits.length ? notedVisits[notedVisits.length - 1].notes : "";
      const paymentStatus = detectPaymentStatus(latestNote);
      const owedAmount = paymentStatus === "owes" ? extractOwedAmount(latestNote) : null;
      return { ...s, products, totalRemaining, totalCollected, allTimeCollected, lastVisitDate, visitedThisMonth, latestNote, visitCount: storeVisits.length, paymentHistory, paymentStatus, owedAmount };
    });
  }, [visits, selectedMonth]);

  const filtered = useMemo(() => {
    return enriched.filter((s) => {
      if (selectedDay && s.day !== selectedDay) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [enriched, search, selectedDay]);

  const dayCounts = useMemo(() => {
    const counts = {};
    stores.forEach((s) => { counts[s.day] = (counts[s.day] || 0) + 1; });
    return counts;
  }, []);

  const availableMonths = useMemo(() => {
    const v = visits || [];
    const keys = new Set(v.map((x) => monthKey(x.date)));
    keys.add(currentMonthKey());
    return Array.from(keys).sort().reverse();
  }, [visits]);

  const stats = useMemo(() => {
    const totalRemaining = enriched.reduce((a, s) => a + s.totalRemaining, 0);
    const totalCollected = enriched.reduce((a, s) => a + s.totalCollected, 0);
    const totalOwed = enriched.reduce((a, s) => a + (s.owedAmount || 0), 0);
    const visitedCount = enriched.filter((s) => s.visitedThisMonth).length;
    return { totalRemaining, totalCollected, totalOwed, visitedCount, total: enriched.length };
  }, [enriched]);

  const monthlyBreakdown = useMemo(() => {
    return enriched
      .filter((s) => s.totalCollected > 0)
      .sort((a, b) => b.totalCollected - a.totalCollected);
  }, [enriched]);

  const visitedBreakdown = useMemo(() => {
    return enriched
      .filter((s) => s.visitedThisMonth)
      .sort((a, b) => (b.lastVisitDate || "").localeCompare(a.lastVisitDate || ""));
  }, [enriched]);

  const owedBreakdown = useMemo(() => {
    return enriched
      .filter((s) => s.owedAmount != null && s.owedAmount > 0)
      .sort((a, b) => b.owedAmount - a.owedAmount);
  }, [enriched]);

  const storeMatches = useMemo(() => {
    if (!storeQuery.trim()) return stores.slice(0, 8);
    const q = storeQuery.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [storeQuery]);

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 340px)`, fontFamily: "'Manrope', sans-serif", color: C.text, paddingBottom: 70 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,600;6..96,700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, select, textarea { font-family: inherit; }
        ::placeholder { color: ${C.textFaint}; }
        .daycell { transition: all 0.15s ease; }
        .daycell:hover { transform: translateY(-2px); border-color: ${C.gold} !important; }
        .storerow { transition: all 0.15s ease; }
        .storerow:hover { border-color: ${C.goldDim} !important; background: ${C.surfaceHover} !important; }
        .statcard { transition: all 0.2s ease; }
        .statcard:hover { border-color: ${C.goldDim}; box-shadow: 0 0 0 1px ${C.goldDim}, 0 8px 24px rgba(201,169,97,0.08); }
        .primarybtn { transition: all 0.15s ease; }
        .primarybtn:hover { box-shadow: 0 4px 20px rgba(201,169,97,0.35); transform: translateY(-1px); }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: C.gold, fontWeight: 600 }}>
              <Sparkles size={12} /> MÈRA
            </div>
            <h1 style={{ fontFamily: "'Bodoni Moda', serif", fontWeight: 600, fontSize: 34, margin: "6px 0 0", letterSpacing: "-0.01em" }}>
              Consignment Operations
            </h1>
            <div style={{ height: 2, width: 46, background: `linear-gradient(90deg, ${C.gold}, transparent)`, marginTop: 10 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 9, padding: "11px 12px", fontSize: 13, fontWeight: 600 }}
            >
              {availableMonths.map((k) => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
            <button
              onClick={() => setShowLog(true)}
              className="primarybtn"
              style={{ background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, color: "#1A1508", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.02em" }}
            >
              <Plus size={16} /> Log a visit
            </button>
          </div>
        </div>

        {saveError && (
          <div style={{ background: C.roseBg, color: C.rose, padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "18px 0", border: `1px solid ${C.rose}30` }}>
            Couldn't save \u2014 try again.
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "28px 0" }}>
          <StatCard icon={Package} label="Units remaining" value={stats.totalRemaining.toLocaleString()} />
          <StatCard
            icon={Wallet}
            label={`Collected — ${monthLabel(selectedMonth)}`}
            value={"$" + stats.totalCollected.toFixed(2)}
            onClick={monthlyBreakdown.length ? () => setShowBreakdown(!showBreakdown) : undefined}
            active={showBreakdown}
          />
          <StatCard
            icon={Calendar}
            label="Visited this month"
            value={`${stats.visitedCount} / ${stats.total}`}
            onClick={visitedBreakdown.length ? () => setShowVisitedBreakdown(!showVisitedBreakdown) : undefined}
            active={showVisitedBreakdown}
          />
          <StatCard
            icon={AlertCircle}
            label="Still owed"
            value={"$" + stats.totalOwed.toFixed(2)}
            onClick={owedBreakdown.length ? () => setShowOwedBreakdown(!showOwedBreakdown) : undefined}
            active={showOwedBreakdown}
          />
        </div>

        {showBreakdown && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              By store — {monthLabel(selectedMonth)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {monthlyBreakdown.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpToStore(s.name, s.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", borderTop: `1px solid ${C.border}`,
                    padding: "9px 4px", cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: 13, color: C.text }}>{s.name}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.emerald, flexShrink: 0, marginLeft: 12 }}>
                    ${s.totalCollected.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showVisitedBreakdown && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Visited — {monthLabel(selectedMonth)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {visitedBreakdown.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpToStore(s.name, s.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", borderTop: `1px solid ${C.border}`,
                    padding: "9px 4px", cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: 13, color: C.text }}>{s.name}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.emerald, flexShrink: 0, marginLeft: 12 }}>
                    {fmtDate(s.lastVisitDate)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showOwedBreakdown && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Still owed — by store
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {owedBreakdown.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpToStore(s.name, s.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", borderTop: `1px solid ${C.border}`,
                    padding: "9px 4px", cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: 13, color: C.text }}>{s.name}</span>
                  <span style={{ display: "flex", gap: 12, alignItems: "baseline", flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ fontSize: 11, color: C.textFaint }}>collected ${s.totalCollected.toFixed(2)}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.rose }}>${s.owedAmount.toFixed(2)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Day strip */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Visit day
          </div>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8 }}>
            <button
              onClick={() => setSelectedDay(null)}
              className="daycell"
              style={{
                flexShrink: 0, minWidth: 54, padding: "9px 6px", borderRadius: 10,
                border: selectedDay === null ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
                background: selectedDay === null ? `${C.gold}18` : C.surface,
                color: selectedDay === null ? C.goldBright : C.text,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>All</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{stores.length}</div>
            </button>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const count = dayCounts[day] || 0;
              if (!count) return null;
              const active = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(active ? null : day)}
                  className="daycell"
                  style={{
                    flexShrink: 0, minWidth: 46, padding: "9px 4px", borderRadius: 10,
                    border: active ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: active ? `${C.gold}18` : C.surface,
                    color: active ? C.goldBright : C.text,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{day}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600 }}>{count}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 18 }}>
          <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores..."
            style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: C.surface, color: C.text }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: C.textFaint, padding: "50px 0" }}>Loading\u2026</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: C.textDim }}>
            <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 19 }}>No stores match</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {filtered.map((s) => (
              <StoreRow
                key={s.id}
                store={s}
                expanded={expanded === s.id}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                showPayments={showPayments === s.id}
                onTogglePayments={() => setShowPayments(showPayments === s.id ? null : s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showLog && (
        <div onClick={closeLogModal} style={{ position: "fixed", inset: 0, background: "rgba(6,7,9,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitLog} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 22, margin: 0, fontWeight: 600 }}>Log a visit</h2>
              <button type="button" onClick={closeLogModal} style={{ background: "none", border: "none", color: C.textDim }}><X size={20} /></button>
            </div>

            <Field label="Store">
              <div style={{ position: "relative" }}>
                <input
                  ref={storeInputRef}
                  value={storeQuery}
                  onChange={(e) => { setStoreQuery(e.target.value); setLogForm({ ...logForm, storeId: "" }); setShowStoreList(true); }}
                  onFocus={() => setShowStoreList(true)}
                  placeholder="Type to search..."
                  style={inputStyle}
                  autoComplete="off"
                />
                {showStoreList && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 5, maxHeight: 200, overflowY: "auto", zIndex: 10, boxShadow: "0 12px 30px rgba(0,0,0,0.4)" }}>
                    {storeMatches.length === 0 ? (
                      <div style={{ padding: "10px 12px", fontSize: 13, color: C.textFaint }}>No matches</div>
                    ) : storeMatches.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => { setLogForm({ ...logForm, storeId: s.id }); setStoreQuery(s.name); setShowStoreList(false); }}
                        style={{ padding: "10px 12px", fontSize: 14, cursor: "pointer", borderBottom: `1px solid ${C.border}` }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {s.name}
                        <span style={{ color: C.textFaint, fontSize: 12, marginLeft: 6 }}>day {s.day}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field label="Product">
              <div style={{ display: "flex", gap: 6 }}>
                {PRODUCTS.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setLogForm({ ...logForm, product: p.key })}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: logForm.product === p.key ? `1.5px solid ${C.gold}` : `1.5px solid ${C.border}`,
                      background: logForm.product === p.key ? `${C.gold}18` : "transparent",
                      color: logForm.product === p.key ? C.goldBright : C.text,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Units sold" style={{ flex: 1 }}>
                <input type="number" value={logForm.sold} onChange={(e) => setLogForm({ ...logForm, sold: e.target.value })} style={inputStyle} placeholder="0" />
              </Field>
              <Field label="Units returned" style={{ flex: 1 }}>
                <input type="number" value={logForm.returned} onChange={(e) => setLogForm({ ...logForm, returned: e.target.value })} style={inputStyle} placeholder="0" />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Payment received ($)" style={{ flex: 1 }}>
                <input type="number" step="0.01" value={logForm.paid} onChange={(e) => setLogForm({ ...logForm, paid: e.target.value })} style={inputStyle} placeholder="0.00" />
              </Field>
              <Field label="Visit date" style={{ flex: 1 }}>
                <input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="Notes (optional)">
              <textarea value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: 55 }} />
            </Field>

            <button type="submit" disabled={!logForm.storeId} className="primarybtn" style={{ width: "100%", background: logForm.storeId ? `linear-gradient(135deg, ${C.goldBright}, ${C.gold})` : C.border, color: logForm.storeId ? "#1A1508" : C.textFaint, border: "none", borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 700, marginTop: 6 }}>
              Save visit
            </button>
            <button type="button" onClick={() => setLogForm({ ...emptyLogForm, storeId: logForm.storeId, date: logForm.date })} style={{ width: "100%", background: "none", border: "none", color: C.textDim, fontSize: 12, marginTop: 10, padding: "4px 0" }}>
              Clear form (keep store)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, onClick, active }) {
  return (
    <div
      className="statcard"
      onClick={onClick}
      style={{
        background: C.surface, border: `1px solid ${active ? C.gold : C.border}`, borderRadius: 12, padding: "16px 18px",
        cursor: onClick ? "pointer" : "default",
        boxShadow: active ? `0 0 0 1px ${C.gold}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
        <Icon size={13} color={C.gold} /> {label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600, marginTop: 8, color: C.text }}>{value}</div>
      {onClick && <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>{active ? "Hide breakdown" : "Tap to see by store"}</div>}
    </div>
  );
}

function StoreRow({ store, expanded, onToggle, showPayments, onTogglePayments }) {
  const visitedColor = store.visitedThisMonth ? C.emerald : C.amber;
  const visitedBg = store.visitedThisMonth ? C.emeraldBg : C.amberBg;
  return (
    <div className="storerow" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 13, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "15px 17px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {expanded ? <ChevronDown size={15} color={C.textDim} style={{ flexShrink: 0 }} /> : <ChevronRight size={15} color={C.textDim} style={{ flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{store.name}</div>
            <div style={{ fontSize: 11, color: C.textFaint }}>Day {store.day} · first sent {fmtDate(store.firstSent)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {store.paymentStatus && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
              background: store.paymentStatus === "paid" ? C.emeraldBg : C.roseBg,
              color: store.paymentStatus === "paid" ? C.emerald : C.rose,
              textTransform: "uppercase", letterSpacing: "0.04em",
              border: `1px solid ${store.paymentStatus === "paid" ? C.emerald : C.rose}30`,
            }}>
              {store.paymentStatus === "paid" ? "Paid" : "Owes"}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: visitedBg, color: visitedColor, textTransform: "uppercase", letterSpacing: "0.04em", border: `1px solid ${visitedColor}30` }}>
            {store.visitedThisMonth ? "Visited" : "Not yet"}
          </span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textFaint }}>Remaining</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 15, color: C.gold }}>{store.totalRemaining}</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 17px 17px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 13 }}>
            {store.products.map((p) => (
              <div key={p.key} style={{ background: C.bg2, borderRadius: 9, padding: "9px 11px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, marginTop: 3, color: C.text }}>{p.remaining}</div>
                <div style={{ fontSize: 10, color: C.textFaint }}>of {p.init}{p.returned > 0 ? ` \u00b7 ${p.returned} returned` : ""}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 18, fontSize: 12, flexWrap: "wrap", marginBottom: store.latestNote ? 10 : 0, color: C.textDim }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePayments(); }}
              style={{ background: "none", border: "none", padding: 0, color: C.textDim, fontSize: 12, cursor: store.paymentHistory.length ? "pointer" : "default", textDecoration: store.paymentHistory.length ? "underline" : "none", textDecorationColor: C.emerald + "60", textUnderlineOffset: 3 }}
              disabled={!store.paymentHistory.length}
            >
              Collected this month: <b style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.emerald }}>${store.totalCollected.toFixed(2)}</b>
            </button>
            <span style={{ color: C.textFaint }}>All-time: <b style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.textDim }}>${store.allTimeCollected.toFixed(2)}</b></span>
            {store.owedAmount != null && (
              <span style={{ color: C.rose }}>Still owes: <b style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.rose }}>${store.owedAmount.toFixed(2)}</b></span>
            )}
            {store.lastVisitDate && <span>Last visited {fmtDate(store.lastVisitDate)}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ClipboardList size={11} />{store.visitCount} visit{store.visitCount === 1 ? "" : "s"} logged</span>
          </div>

          {showPayments && store.paymentHistory.length > 0 && (
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", marginBottom: store.latestNote ? 10 : 0 }}>
              <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Payment history</div>
              {store.paymentHistory.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textDim }}>{fmtDate(v.date)} · {v.product}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.emerald, fontWeight: 600 }}>${v.paid.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {store.latestNote && (
            <div style={{ fontSize: 12, color: C.amber, fontStyle: "italic", background: C.amberBg, borderRadius: 8, padding: "8px 11px", display: "flex", gap: 6, alignItems: "flex-start", border: `1px solid ${C.amber}25` }}>
              <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
              {store.latestNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: C.bg2,
  color: C.text,
  outline: "none",
};
