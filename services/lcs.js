const axios = require('axios');
const fs = require('fs');
const path = require('path');

let citiesCache = {
  fetchedAt: 0,
  list: [],
};

const TTL_MS = Number(process.env.LCS_CITIES_TTL_MS || 24 * 60 * 60 * 1000); // default 24h

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadCitiesFromFile() {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'lcs_cities.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        citiesCache = { fetchedAt: Date.now(), list: parsed };
        return parsed;
      }
      if (Array.isArray(parsed?.cities)) {
        citiesCache = { fetchedAt: Date.now(), list: parsed.cities };
        return parsed.cities;
      }
    }
  } catch (_) {}
  return [];
}

// Aliases: configurable via env JSON, e.g.
// LCS_CITY_ALIASES_JSON='{"zahir pir":701,"zahir peer":701,"zahirpeer":701}'
function loadAliases() {
  const raw = process.env.LCS_CITY_ALIASES_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[normalize(k)] = v;
    }
    return out;
  } catch (e) {
    return {};
  }
}
let aliases = loadAliases();
// refresh aliases when env changes at runtime not expected; provide manual refresh if needed
function setAliases(map) { aliases = map || {}; }

async function fetchCities() {
  const baseRaw = process.env.LCS_BASE_URL;
  const key = process.env.LCS_API_KEY;
  const pass = process.env.LCS_API_PASSWORD;
  if (!baseRaw || !key || !pass) {
    throw new Error('LCS env missing for cities fetch');
  }
  const base = String(baseRaw).endsWith('/') ? String(baseRaw) : `${String(baseRaw)}/`;
  const url = `${base}getAllCities/format/json/`;
  const res = await axios.post(url, { api_key: key, api_password: pass }, { timeout: 20000 });
  const data = res?.data;
  // Expect array or object per LCS; keep generic handling
  const cities = Array.isArray(data) ? data : (Array.isArray(data?.cities) ? data.cities : []);
  citiesCache = { fetchedAt: Date.now(), list: cities };
  return cities;
}

async function getCities(force = false) {
  const expired = Date.now() - citiesCache.fetchedAt > TTL_MS;
  if (force || expired || !Array.isArray(citiesCache.list) || citiesCache.list.length === 0) {
    try {
      await fetchCities();
    } catch (e) {
      // keep whatever is cached
    }
    // Fallback to ENV JSON if still empty
    if (!Array.isArray(citiesCache.list) || citiesCache.list.length === 0) {
      const raw = process.env.LCS_CITIES_JSON;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            citiesCache = { fetchedAt: Date.now(), list: parsed };
          } else if (Array.isArray(parsed?.cities)) {
            citiesCache = { fetchedAt: Date.now(), list: parsed.cities };
          }
        } catch (_) {}
      }
    }
    // Fallback to local JSON file if still empty
    if (!Array.isArray(citiesCache.list) || citiesCache.list.length === 0) {
      loadCitiesFromFile();
    }
  }
  return citiesCache.list || [];
}

// Try to resolve a city name to an LCS city id; returns { id, method, name, raw } or null
async function getCityIdByName(name) {
  const list = await getCities();
  const target = normalize(name);
  if (!target) return null;

  // 1) Alias direct hit
  if (aliases && Object.prototype.hasOwnProperty.call(aliases, target)) {
    return { id: aliases[target], method: 'alias', name: target, raw: { alias: target } };
  }

  // common fields seen in LCS payloads: CityName, city_name, CityId, city_id
  let best = null;
  let method = 'exact';
  for (const c of list) {
    const cname = normalize(c.CityName || c.city_name || c.name);
    if (cname === target) {
      best = c; method = 'exact'; break;
    }
  }
  if (!best) {
    // fallback: startsWith or includes
    for (const c of list) {
      const cname = normalize(c.CityName || c.city_name || c.name);
      if (cname.startsWith(target) || target.startsWith(cname)) {
        best = c; method = 'fuzzy'; break;
      }
    }
  }
  if (!best) return null;
  const id = best.CityID || best.city_id || best.id || best.CityId || null;
  const bestName = best.CityName || best.city_name || best.name || null;
  return id ? { id, method, name: bestName, raw: best } : null;
}

function jaccardTokens(a, b) {
  const as = new Set(String(a).split(' ').filter(Boolean));
  const bs = new Set(String(b).split(' ').filter(Boolean));
  const inter = new Set([...as].filter(x => bs.has(x))).size;
  const union = new Set([...as, ...bs]).size || 1;
  return inter / union;
}

// Suggest top candidate cities by simple heuristics
async function suggestCities(name, limit = 5) {
  const list = await getCities();
  const target = normalize(name);
  if (!target) return [];
  const scored = [];
  for (const c of list) {
    const cname = normalize(c.CityName || c.city_name || c.name);
    let score = 0;
    if (cname === target) score = 1;
    else if (cname.startsWith(target) || target.startsWith(cname)) score = 0.9;
    else if (cname.includes(target) || target.includes(cname)) score = 0.8;
    else score = jaccardTokens(cname, target) * 0.75; // softer backoff
    scored.push({
      score,
      id: c.CityID || c.city_id || c.id || c.CityId || null,
      name: c.CityName || c.city_name || c.name || '',
      raw: c,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.id).slice(0, limit);
}

module.exports = { getCities, getCityIdByName, suggestCities, setAliases, normalize };
