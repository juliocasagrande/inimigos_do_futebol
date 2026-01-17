// ==========================
// GOOGLE SHEETS (PUBLICADO NA WEB)
// ==========================

// ✅ Use o ID publicado (2PACX-...) - NÃO é o mesmo do /d/1T_Gy...
export const PUBLISHED_ID =
  "2PACX-1vSpYqMuzSsXqjixKp0a4eTsuoaqtQMwfnqXsXb8w5z3gIrUt4yO5oQPTBgP8BnSwQ-8in26XBEjiWVL";

// Mantém o SPREADSHEET_ID só para cache/identificação (não usado na URL de fetch)
export const SPREADSHEET_ID = "1T_Gy78qVK4s2nSlpkmrWw7jxeG3isc9Ln1GWcr8nw3E";

export const SEASONS = {
  "2025": { gid: "557483612", label: "2025" },
  "2026": { gid: "19389941", label: "2026" },
};

export const SEASON_OPTIONS = [
  { value: "2026", label: "Temporada 2026", years: ["2026"] },
  { value: "2025", label: "Temporada 2025", years: ["2025"] },
  { value: "2025_2026", label: "2025 + 2026 (Geral)", years: ["2025", "2026"] },
];

// ✅ URL correta para planilha publicada (gera CSV direto por gid)
function csvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?gid=${gid}&single=true&output=csv`;
}

// ==========================
// NORMALIZADORES
// ==========================
function normNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  return Number(s.replace(",", ".")) || 0;
}

function normText(v) {
  return String(v ?? "").trim();
}

function normPos(v) {
  const s = normText(v).toUpperCase();
  if (!s) return "";
  // normaliza variações comuns de goleiro
  if (s === "GOLEIRO" || s === "GK" || s === "G" || s === "GOL") return "GOL";
  return s;
}

// ==========================
// CSV ROBUSTO (SUPORTA ASPAS)
// ==========================
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    // escape de aspas dentro de campo: ""
    if (c === '"' && inQuotes && n === '"') {
      cur += '"';
      i++;
      continue;
    }

    // abre/fecha aspas
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    // separador de coluna
    if (c === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    // quebra de linha
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++; // CRLF
      row.push(cur);
      cur = "";

      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    cur += c;
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  return rows;
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao baixar CSV: ${res.status}`);
  const text = await res.text();

  const rows = parseCsv(text);
  if (!rows.length) return [];

  const header = rows[0].map((h) => String(h || "").trim());

  return rows.slice(1).map((cols) => {
    const obj = {};
    header.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });
}

// ==========================
// MAPEAMENTO DA LINHA
// ==========================
function mapRow(row) {
  const nome = normText(row["Nome"]);
  const pres = normNumber(row["Presencas"]);
  const gols = normNumber(row["Gols"]);

  // ✅ novo (opcional): DD (defesas) para goleiros
  const dd = normNumber(row["DD"] || row["Defesas"] || row["Defesas Difíceis"] || row["Defesas Dificeis"]);

  const hasAttrs = Boolean(
    row["Ritmo"] ||
      row["Passe"] ||
      row["Drible"] ||
      row["Defesa"] ||
      row["Finalização"] ||
      row["Finalizacao"] ||
      row["Físico"] ||
      row["Fisico"]
  );

  if (!nome) return null;
  if (!hasAttrs && pres === 0 && gols === 0 && dd === 0) return null;

  return {
    Nome: nome,
    Presencas: pres,
    Gols: gols,
    DD: dd, // ✅ fica 0 se a coluna não existir

    Ritmo: normNumber(row["Ritmo"]),
    Finalizacao: normNumber(row["Finalização"] || row["Finalizacao"]),
    Passe: normNumber(row["Passe"]),
    Drible: normNumber(row["Drible"]),
    Defesa: normNumber(row["Defesa"]),
    Fisico: normNumber(row["Físico"] || row["Fisico"]),
    Posicao: normPos(row["Posição"] || row["Posicao"]),
  };
}

// ==========================
// MERGE (2025 + 2026)
// ==========================
function wavg(a, pa, b, pb) {
  const total = pa + pb;
  if (total <= 0) return a || b || 0;
  return (a * pa + b * pb) / total;
}

function mergePlayers(oldP, newP) {
  const pa = oldP?.Presencas ?? 0;
  const pb = newP?.Presencas ?? 0;

  return {
    Nome: oldP?.Nome || newP?.Nome || "",
    Presencas: pa + pb,
    Gols: (oldP?.Gols ?? 0) + (newP?.Gols ?? 0),
    DD: (oldP?.DD ?? 0) + (newP?.DD ?? 0), // ✅ soma DD nas temporadas

    Ritmo: wavg(oldP?.Ritmo ?? 0, pa, newP?.Ritmo ?? 0, pb),
    Finalizacao: wavg(oldP?.Finalizacao ?? 0, pa, newP?.Finalizacao ?? 0, pb),
    Passe: wavg(oldP?.Passe ?? 0, pa, newP?.Passe ?? 0, pb),
    Drible: wavg(oldP?.Drible ?? 0, pa, newP?.Drible ?? 0, pb),
    Defesa: wavg(oldP?.Defesa ?? 0, pa, newP?.Defesa ?? 0, pb),
    Fisico: wavg(oldP?.Fisico ?? 0, pa, newP?.Fisico ?? 0, pb),

    // posição: prioriza a temporada mais recente (newP)
    Posicao: newP?.Posicao || oldP?.Posicao || "",
  };
}

// ==========================
// CACHE + LOAD
// ==========================
function cacheKey(optionValue) {
  return `pelada:v2:players:${PUBLISHED_ID}:${optionValue}`;
}

export async function loadPlayers(optionValue) {
  const option = SEASON_OPTIONS.find((o) => o.value === optionValue) || SEASON_OPTIONS[0];

  const key = cacheKey(option.value);
  const cached = localStorage.getItem(key);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      refreshPlayers(option, key).catch(() => {});
      return parsed;
    } catch {}
  }

  return await refreshPlayers(option, key);
}

async function refreshPlayers(option, key) {
  const datasets = await Promise.all(
    option.years.map(async (y) => {
      const season = SEASONS[y];
      const rows = await fetchCsv(csvUrl(season.gid));
      return rows.map(mapRow).filter(Boolean);
    })
  );

  if (datasets.length === 1) {
    localStorage.setItem(key, JSON.stringify(datasets[0]));
    return datasets[0];
  }

  const map = new Map();
  for (const players of datasets) {
    for (const p of players) {
      const k = p.Nome.toLowerCase();
      const cur = map.get(k);
      map.set(k, cur ? mergePlayers(cur, p) : p);
    }
  }

  const merged = Array.from(map.values());
  localStorage.setItem(key, JSON.stringify(merged));
  return merged;
}
