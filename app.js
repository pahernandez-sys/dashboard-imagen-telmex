/**
 * TELMEX 2026 - Control de Avance & Materiales
 * Lógica Principal del Dashboard Ejecutivo
 */

// Estado Global
// Restricción de Distritos No Permitidos
const RESTRICTED_DISTRICTS = new Set(["PIX0001", "PIX0002", "PIX0003"]);

let state = {
  config: null,
  records: [],
  filteredRecords: [],
  materialsLog: [],
  charts: {},
  selectedMaterialArea: "",
  currentPage: 1,
  pageSize: 50
};

// =========================================================
const LIVE_DATA_VERSION = "2026-11-03-homologacion-modelos-v14";

// Funciones globales de normalización para homologar con el Reporte Oficial Excel (10 Cajas, 5 Casetas)
function normalizeModelName(rawModel, tipo) {
  const s = (rawModel || "").toString().trim().toUpperCase();
  const t = (tipo || "").toString().trim().toUpperCase();

  if (t === "CASETA") {
    if (s.includes("CUICUILCO")) return "CUICUILCO";
    if (s.includes("REFORMA") || s.includes("DOBLE")) return "DOBLE REFORMA";
    if (s.includes("SEMI")) return "SEMICIRCULAR";
    if (s.includes("MINI")) return "MINI";
    return "NORMAL";
  } else {
    // CAJA
    if (s.includes("KRONE")) return "KRONE";
    if (s.includes("ENVOLV")) {
      return s.includes("DOBLE") ? "ENVOLVENTE DOBLE" : "ENVOLVENTE SENCILLA";
    }
    if (s.includes("DESPLAZ") || s.includes("DEPLAS") || s.includes("DEPLAZ")) {
      return s.includes("DOBLE") ? "DESPLAZAMIENTO DOBLE" : "DESPLAZAMIENTO SENCILLA";
    }
    if (s.includes("SIECOR")) {
      if (s.includes("DOBLE")) return "SIECOR DOBLE";
      if (/\b2\s*P/i.test(s) || s.includes("2P") || s.includes("DOS P")) return "SIECOR SENCILLA 2 PTAS";
      if (/\b1\s*P/i.test(s) || s.includes("1P") || s.includes("UNA P")) return "SIECOR SENCILLA 1PTA";
      return "SIECOR SENCILLA 1PTA";
    }
    if (s.includes("TRADICIONAL")) {
      return s.includes("DOBLE") ? "TRADICIONAL DOBLE" : "TRADICIONAL SENCILLA";
    }
    return s.includes("DOBLE") ? "TRADICIONAL DOBLE" : "TRADICIONAL SENCILLA";
  }
}

function normalizeMaterialName(rawDesc) {
  const s = (rawDesc || "").toString().trim().toUpperCase();
  // Casetas
  if (s.includes("CUICUILCO")) return "CUICUILCO";
  if (s.includes("REFORMA") || (s.includes("CASETA") && s.includes("DOBLE"))) return "DOBLE REFORMA";
  if (s.includes("SEMI")) return "SEMICIRCULAR";
  if (s.includes("MINI")) return "MINI";
  if (s.includes("NORMAL") || (s.includes("LATERAL") && s.includes("CASETA"))) return "NORMAL";

  // Cajas
  if (s.includes("KRONE")) return "KRONE";
  if (s.includes("ENVOLV")) {
    return s.includes("DOBLE") ? "ENVOLVENTE DOBLE" : "ENVOLVENTE SENCILLA";
  }
  if (s.includes("DESPLAZ") || s.includes("DEPLAS") || s.includes("DEPLAZ")) {
    return s.includes("DOBLE") ? "DESPLAZAMIENTO DOBLE" : "DESPLAZAMIENTO SENCILLA";
  }
  if (s.includes("SIECOR")) {
    if (s.includes("DOBLE")) return "SIECOR DOBLE";
    if (/\b2\s*P/i.test(s) || s.includes("2P") || s.includes("DOS P")) return "SIECOR SENCILLA 2 PTAS";
    if (/\b1\s*P/i.test(s) || s.includes("1P") || s.includes("UNA P")) return "SIECOR SENCILLA 1PTA";
    return "SIECOR SENCILLA 1PTA";
  }
  if (s.includes("TRADICIONAL")) {
    return s.includes("DOBLE") ? "TRADICIONAL DOBLE" : "TRADICIONAL SENCILLA";
  }
  return s;
}
const EXCLUDED_MATERIALS = ["pintura_azul", "pintura_gris", "thinner", "sellador"];

// Funciones seguras para localStorage (previenen QuotaExceededError por límite de 5MB con miles de registros)
function safeSetStorage(key, value) {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, str);
  } catch (e) {
    console.warn(`[Storage Aviso] No se pudo persistir '${key}' en localStorage (límite de cuota):`, e.message);
  }
}

function safeGetStorage(key, defaultVal = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function safeRemoveStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}


// Obtener fecha local en formato YYYY-MM-DD evitando el desfase de zona horaria UTC
function getLocalDateStr(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parser seguro de fecha/hora a zona horaria local de México
function parseDateTimeSafe(val) {
  if (!val) return { dateStr: "", timeStr: "00:00", dateTimeStr: "", dt: null };
  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number") {
    d = new Date(val > 1e11 ? val : val * 1000);
  } else {
    let s = String(val).trim();
    if (!s.includes("Z") && !s.includes("+") && !s.includes("-", 10)) {
      s = s.replace(" ", "T");
    }
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return { dateStr: "", timeStr: "00:00", dateTimeStr: "", dt: null };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${mins}`,
    dateTimeStr: `${year}-${month}-${day} ${hours}:${mins}:${secs}`,
    dt: d
  };
}

// =========================================================
// REGLAS OFICIALES DE CORTE TELMEX 2026 (10 PM - 10 AM)
// =========================================================
function getAccountingDate(val) {
  const timeInfo = parseDateTimeSafe(val);
  if (!timeInfo.dt) return timeInfo.dateStr || "";
  const hour = timeInfo.dt.getHours();
  if (hour >= 22) {
    const nextDay = new Date(timeInfo.dt);
    nextDay.setDate(nextDay.getDate() + 1);
    return getLocalDateStr(nextDay);
  }
  return timeInfo.dateStr;
}

function getCutoffInfo(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  const hour = d.getHours();
  
  if (hour < 8) {
    // Antes de las 10:00 AM -> Muestra corte oficial cerrado de ayer a las 22:00
    const prevDate = new Date(d);
    prevDate.setDate(prevDate.getDate() - 1);
    const activeDateStr = getLocalDateStr(prevDate);
    return {
      activeReportingDate: activeDateStr,
      maxVisibleDt: `${activeDateStr} 22:00:00`,
      isFrozen: true,
      badgeText: "REPORTE OFICIAL CERRADO",
      badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      badgeDotClass: "bg-amber-400",
      statusMessage: `Reporte matutino cerrado al ${activeDateStr} (22:00 hrs). En período de entrega matutina. La jornada de hoy se liberará a las 08:00 AM.`,
      cycleLabel: `Ciclo Oficial: ${activeDateStr}`
    };
  } else if (hour >= 22) {
    // A partir de las 22:00 hrs (10 PM) -> Corte cerrado de hoy a las 22:00 para depuración
    const activeDateStr = getLocalDateStr(d);
    return {
      activeReportingDate: activeDateStr,
      maxVisibleDt: `${activeDateStr} 22:00:00`,
      isFrozen: true,
      badgeText: "CORTE 22:00 HRS ACTIVO",
      badgeClass: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
      badgeDotClass: "bg-sky-400",
      statusMessage: `Corte de las 10:00 PM activo (${activeDateStr}). Período de depuración. Registros posteriores se liberan mañana a las 10:00 AM.`,
      cycleLabel: `Ciclo Oficial: ${activeDateStr}`
    };
  } else {
    // Entre 10:00 AM y 22:00 PM -> Jornada activa en vivo
    const activeDateStr = getLocalDateStr(d);
    const hourStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return {
      activeReportingDate: activeDateStr,
      maxVisibleDt: `${activeDateStr} ${hourStr}:59`,
      isFrozen: false,
      badgeText: "JORNADA EN VIVO",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
      badgeDotClass: "bg-emerald-400 animate-pulse",
      statusMessage: `Jornada del ${activeDateStr} en vivo (${hourStr} hrs). Próximo corte oficial hoy a las 10:00 PM.`,
      cycleLabel: `Jornada Activa: ${activeDateStr}`
    };
  }
}

function renderCutoffBanner(info = null) {
  const cutoffInfo = info || getCutoffInfo();
  const banner = document.getElementById("cutoffBanner");
  const badge = document.getElementById("cutoffBadge");
  const badgeDot = document.getElementById("cutoffBadgeDot");
  const badgeText = document.getElementById("cutoffBadgeText");
  const messageEl = document.getElementById("cutoffMessage");
  const cycleLabel = document.getElementById("cutoffActiveDateLabel");

  if (!banner || !badge || !badgeText || !messageEl) return;

  badge.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm ${cutoffInfo.badgeClass}`;
  if (badgeDot) badgeDot.className = `w-2 h-2 rounded-full ${cutoffInfo.badgeDotClass}`;
  badgeText.innerText = cutoffInfo.badgeText;
  messageEl.innerText = cutoffInfo.statusMessage;
  if (cycleLabel) cycleLabel.innerText = cutoffInfo.cycleLabel;
}

function showCutoffExplanationModal() {
  const modal = document.getElementById("cutoffModal");
  if (modal) modal.classList.remove("hidden");
}

function closeCutoffModal() {
  const modal = document.getElementById("cutoffModal");
  if (modal) modal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Limpieza preventiva de claves sobredimensionadas en localStorage que saturan la cuota de 5MB
  safeRemoveStorage("telmex_dashboard_raw_records");
  safeRemoveStorage("telmex_dashboard_records");

  try { loadConfig(); } catch (e) { console.error("Error en loadConfig:", e); }
  try { checkAndMigrateLiveData(); } catch (e) { console.error("Error en checkAndMigrateLiveData:", e); }
  try { loadRecords(); } catch (e) { console.error("Error en loadRecords:", e); }
  try { loadMaterialsLog(); } catch (e) { console.error("Error en loadMaterialsLog:", e); }
  try { recalculateSuministrosFromMaterialsLog(); } catch (e) { console.error("Error en recalculateSuministros:", e); }
  try { initFilters(); } catch (e) { console.error("Error en initFilters:", e); }
  try { populateTecnicosFilter(); } catch (e) { console.error("Error en populateTecnicosFilter:", e); }
  try { initDatePresets(); } catch (e) { console.error("Error en initDatePresets:", e); }
  try { renderCutoffBanner(); } catch (e) { console.error("Error en renderCutoffBanner:", e); }
  try { applyFilters(); } catch (e) { console.error("Error en applyFilters:", e); }
  try { initBossModule(); } catch (e) { console.error("Error en initBossModule:", e); }
  try { renderMaterialsConfigTable(); } catch (e) { console.error("Error en renderMaterialsConfigTable:", e); }
  try { renderMaterialsLogTable(); } catch (e) { console.error("Error en renderMaterialsLogTable:", e); }
  try { updateSyncLabel(); } catch (e) { console.error("Error en updateSyncLabel:", e); }

  // Operación ultra rápida en vivo vía Red CDN (GitHub Pages) sin límites de cuota
  const badge = document.getElementById("lastSyncLabel");
  if (badge) {
    badge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-300 font-bold">● En vivo (Red CDN)</span>`;
  }
});

// Configuración de Conexión en Tiempo Real con Supabase (PostgreSQL Cloud)
const SUPABASE_CONFIG = {
  url: "https://xbbgcmnqtxhpnwjozzrt.supabase.co",
  anonKey: "sb_publishable_ZlrYYIXOAN_WA6ryCaCNsA_t3zCERLG"
};

// Función auxiliar para paginar consultas en Supabase PostgREST (supera el límite de 1000 filas)
async function fetchPagedFromSupabase(table, select = "*", orderBy = "id.desc") {
  const headers = {
    "apikey": SUPABASE_CONFIG.anonKey,
    "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`
  };
  const batchSize = 1000;
  let offset = 0;
  let allRows = [];
  while (true) {
    const rangeHeaders = {
      ...headers,
      "Range": `${offset}-${offset + batchSize - 1}`
    };
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${table}?select=${select}&order=${orderBy}`, { headers: rangeHeaders });
      if (!resp.ok) {
        if (resp.status !== 416) {
          console.warn(`[Supabase Aviso] Status ${resp.status} al leer ${table}`);
        }
        break;
      }
      const batch = await resp.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      allRows.push(...batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    } catch (e) {
      console.warn(`[Supabase Error Paginación]`, e);
      break;
    }
  }
  return allRows;
}

// =========================================================
// MOTOR DE CONCILIACIÓN Y DEDUPLICACIÓN CONTABLE TELMEX / IASA
// Garantiza coincidencia al 100% con el Reporte Diario Excel
// =========================================================
function deduplicateOfficialRecords(rawList) {
  if (!Array.isArray(rawList)) return { valid: [], raw: [], rawCount: 0, dupsCount: 0 };

  // Excluir registros de Guadalajara Poniente (territorio EULEN fuera de alcance IASA)
  const filteredList = rawList.filter(r => !String(r.area_trabajo || "").toUpperCase().includes("PONIENTE"));

  const START_DATE = "2026-10-26";
  const seenAssets = new Set();

  // 1. Activos registrados en la línea base oficial antes de START_DATE
  for (const r of filteredList) {
    if (r.fecha && r.fecha < START_DATE) {
      const id = String(r.identificador || "").trim().toUpperCase();
      const tipo = String(r.tipo || "CAJA").trim().toUpperCase();
      if (id && id !== "S/N" && id !== "N/A" && id !== "0") {
        seenAssets.add(`${tipo}_${id}`);
      }
    }
  }

  // 2. Orden cronológico para preservar el primer folio oficial
  const sorted = [...filteredList].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const valid = [];
  const dups = [];

  for (const r of sorted) {
    const id = String(r.identificador || "").trim().toUpperCase();
    const tipo = String(r.tipo || "CAJA").trim().toUpperCase();

    let isDup = false;
    if (r.fecha && r.fecha >= START_DATE && id && id !== "S/N" && id !== "N/A" && id !== "0") {
      const key = `${tipo}_${id}`;
      if (seenAssets.has(key)) {
        isDup = true;
      } else {
        seenAssets.add(key);
      }
    }

    r.is_duplicate = isDup;
    if (isDup) {
      dups.push(r);
    } else {
      valid.push(r);
    }
  }

  return { valid, raw: sorted, dups, rawCount: rawList.length, dupsCount: dups.length };
}

// =========================================================
// SISTEMA DE SONDEO INTELIGENTE Y AHORRO DE EGRESS (SUPABASE)
// Reduce 99.9% el consumo de ancho de banda sin perder velocidad en vivo
// =========================================================
const SUPABASE_SYNC_STATE = {
  lastCheckedId: null,
  lastTotalCount: 0,
  lastMaterialsCount: 0,
  isInitialLoaded: false,
  isChecking: false
};

// Columnas optimizadas para evitar descargar campos pesados redundantes
const SUPABASE_EVIDENCIAS_FIELDS = "id,folio,fecha_captura,tipo_elemento,asset_id,modelo,estado,area_trabajo,contratista,tecnico,oferta_colocada,existencia,comentarios,num_viniles,version_app,lat,lon,foto_despues_url,foto_antes_url";
const SUPABASE_MATERIALES_FIELDS = "id,folio,area_trabajo,contratista,tecnico,material,cantidad,fecha_entrega";

/**
 * Micro-consulta a Supabase para verificar si hay nuevos registros en la nube.
 * Solo transfiere encabezados y 1 fila (~120 bytes), evitando descargar 3.2 MB cada minuto.
 */
async function checkSupabaseHasChanges() {
  if (SUPABASE_SYNC_STATE.isChecking) return false;
  SUPABASE_SYNC_STATE.isChecking = true;

  try {
    const headers = {
      "apikey": SUPABASE_CONFIG.anonKey,
      "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`,
      "Prefer": "count=exact"
    };

    // 1. Micro-consulta a evidencias_telmex (1 registro con conteo exacto en el header Content-Range)
    const resp = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/evidencias_telmex?select=id,fecha_captura&order=id.desc&limit=1`,
      { headers }
    );

    if (!resp.ok) {
      SUPABASE_SYNC_STATE.isChecking = false;
      return false;
    }

    const contentRange = resp.headers.get("content-range");
    const totalCount = contentRange ? parseInt(contentRange.split("/")[1], 10) : 0;
    const rows = await resp.json();
    const latestId = (Array.isArray(rows) && rows.length > 0) ? rows[0].id : null;

    // 2. Micro-consulta a materiales_telmex (conteo exacto en header)
    let matsCount = 0;
    try {
      const respMats = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/materiales_telmex?select=id&order=id.desc&limit=1`,
        { headers }
      );
      if (respMats.ok) {
        const matRange = respMats.headers.get("content-range");
        matsCount = matRange ? parseInt(matRange.split("/")[1], 10) : 0;
      }
    } catch (_) {}

    // Primera evaluación tras la carga de la página
    if (!SUPABASE_SYNC_STATE.isInitialLoaded || SUPABASE_SYNC_STATE.lastCheckedId === null) {
      const localCount = (state.records && state.records.length > 0) ? (state.totalRawRecordsCount || state.records.length) : 0;
      SUPABASE_SYNC_STATE.lastCheckedId = latestId;
      SUPABASE_SYNC_STATE.lastTotalCount = totalCount;
      SUPABASE_SYNC_STATE.lastMaterialsCount = matsCount;
      SUPABASE_SYNC_STATE.isInitialLoaded = true;
      SUPABASE_SYNC_STATE.isChecking = false;

      // Si los datos precargados localmente ya coinciden con la nube, no gastamos egress
      if (localCount > 0 && Math.abs(localCount - totalCount) === 0) {
        console.log(`[Supabase Smart-Sync] Datos locales coinciden con Supabase (${localCount} registros). Cero transferencia requerida.`);
        return false;
      }
      return true; // Hay diferencia de registros, requiere sincronizar
    }

    // Evaluación en sondeo periódico cada 60s
    const hasEvidenciasChange = (latestId !== SUPABASE_SYNC_STATE.lastCheckedId || totalCount !== SUPABASE_SYNC_STATE.lastTotalCount);
    const hasMaterialsChange = (matsCount !== SUPABASE_SYNC_STATE.lastMaterialsCount);

    if (hasEvidenciasChange || hasMaterialsChange) {
      console.log(`[Supabase Smart-Sync] ¡Cambios detectados en vivo! Total: ${totalCount} (Prev: ${SUPABASE_SYNC_STATE.lastTotalCount}), Materiales: ${matsCount} (Prev: ${SUPABASE_SYNC_STATE.lastMaterialsCount})`);
      SUPABASE_SYNC_STATE.lastCheckedId = latestId;
      SUPABASE_SYNC_STATE.lastTotalCount = totalCount;
      SUPABASE_SYNC_STATE.lastMaterialsCount = matsCount;
      SUPABASE_SYNC_STATE.isChecking = false;
      return true;
    }

    SUPABASE_SYNC_STATE.isChecking = false;
    return false; // Cero cambios, 0 MB transferidos
  } catch (err) {
    console.warn("[Supabase Smart-Sync] Error en micro-chequeo:", err);
    SUPABASE_SYNC_STATE.isChecking = false;
    return false;
  }
}

/**
 * Inicialización inteligente: revisa si los datos locales están al día.
 * Si lo están, evita una descarga de 3.2 MB al abrir la página.
 */
async function initSupabaseSmartSync() {
  try {
    const needsFetch = await checkSupabaseHasChanges();
    if (needsFetch || !state.records || state.records.length === 0) {
      await loadDataFromSupabase(false);
    } else {
      const badge = document.getElementById("lastSyncLabel");
      if (badge) {
        badge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-300 font-bold">🟢 En vivo (Supabase Cloud)</span>`;
      }
    }
  } catch (err) {
    console.warn("[Supabase Smart-Sync] Inicialización fallback:", err);
    await loadDataFromSupabase(false);
  }
}

async function loadDataFromSupabase(showNotification = false) {
  try {
    // 1. Obtener todas las evidencias paginadas en vivo desde Supabase Cloud
    const dbEvs = await fetchPagedFromSupabase("evidencias_telmex", SUPABASE_EVIDENCIAS_FIELDS, "fecha_captura.desc");
    let evCount = 0;
    if (Array.isArray(dbEvs) && dbEvs.length > 0) {
      const mapped = dbEvs.map(r => {
        const timeInfo = parseDateTimeSafe(r.fecha_captura);
        const accDate = getAccountingDate(timeInfo.dt || r.fecha_captura);
        return {
          folio: r.folio || "",
          fecha: accDate,
          fecha_captura: timeInfo.dateStr,
          hora: timeInfo.timeStr,
          fecha_corte: accDate,
          created_at_iso: timeInfo.dateTimeStr || r.fecha_captura || "",
          timestamp: timeInfo.dt ? (timeInfo.dt.getTime() / 1000) : 0,
          tipo: (r.tipo_elemento || "CASETA").toUpperCase(),
          identificador: r.asset_id || r.folio || "S/N",
          modelo: normalizeModelName(r.modelo, r.tipo_elemento),
          estado: r.estado || "",
          area_trabajo: r.area_trabajo || "",
          contratista: r.contratista || "",
          tecnico: r.tecnico || "N/A",
          oferta: r.oferta_colocada || "120 MB",
          existe_bd: r.existencia || "Sí",
          comentarios: r.comentarios || "",
          num_viniles: r.num_viniles || 1,
          version: r.version_app || "Sin versión",
          latitud: r.lat,
          longitud: r.lon,
          foto_despues: r.foto_despues_url || "",
          foto_antes: r.foto_antes_url || "",
          estatus: "Aprobada"
        };
      });

      const dedupResult = deduplicateOfficialRecords(mapped);
      state.rawRecords = dedupResult.raw;
      state.records = dedupResult.valid;
      state.totalRawRecordsCount = dedupResult.rawCount;
      state.totalDuplicatesCount = dedupResult.dupsCount;
      evCount = state.records.length;

      // Evitar saturar cuota de localStorage: la información se mantiene en memoria (state)
      safeRemoveStorage("telmex_dashboard_records");
      safeRemoveStorage("telmex_dashboard_raw_records");
    }

    // 2. Obtener todas las entregas de materiales en vivo
    const dbMats = await fetchPagedFromSupabase("materiales_telmex", SUPABASE_MATERIALES_FIELDS, "fecha_entrega.desc");
    let matCount = 0;
    if (Array.isArray(dbMats) && dbMats.length > 0) {
      state.materialsLog = dbMats.map(m => {
        const timeInfo = parseDateTimeSafe(m.fecha_entrega);
        return {
          id: m.folio || "",
          area: m.area_trabajo || "",
          descripcion: normalizeMaterialName(m.material),
          cantidad: m.cantidad || 0,
          unidad: "PZAS.",
          fecha: getAccountingDate(timeInfo.dt || m.fecha_entrega),
          fecha_captura: timeInfo.dateStr,
          hora: timeInfo.timeStr,
          created_at_iso: timeInfo.dateTimeStr || m.fecha_entrega || "",
          foto: ""
        };
      });
      matCount = state.materialsLog.length;
      safeRemoveStorage("telmex_dashboard_materials_log");
    }

    if (evCount > 0 || matCount > 0) {
      // Actualizar estado del Sondeo Inteligente
      SUPABASE_SYNC_STATE.lastTotalCount = state.totalRawRecordsCount || state.records.length;
      SUPABASE_SYNC_STATE.lastMaterialsCount = state.materialsLog ? state.materialsLog.length : 0;
      if (Array.isArray(dbEvs) && dbEvs.length > 0) {
        SUPABASE_SYNC_STATE.lastCheckedId = dbEvs[0].id || null;
      }
      SUPABASE_SYNC_STATE.isInitialLoaded = true;
      const syncLabel = `Supabase Cloud (${evCount} trabajos, ${matCount} entregas)`;
      safeSetStorage("telmex_dashboard_last_sync", syncLabel);
      recalculateSuministrosFromMaterialsLog();
      populateAreaFilter();
      populateContratistasFilter();
  populateTecnicosFilter();
      applyFilters();
      renderMaterialsConfigTable();
      renderMaterialsLogTable();
      updateSyncLabel();

      const badge = document.getElementById("lastSyncLabel");
      if (badge) {
        badge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-300 font-bold">🟢 En vivo (Supabase Cloud)</span>`;
      }

      if (showNotification) {
        showToast(`✅ Conectado a Supabase: ${evCount} evidencias y ${matCount} entregas actualizadas en tiempo real.`, "success", 4000);
      }
    }
  } catch (err) {
    console.warn("[Supabase] Carga remota en vivo no disponible, operando con caché:", err);
  }
}

// Auto-migración para cargar los datos en vivo más recientes de Linkaform
function checkAndMigrateLiveData() {
  if (typeof LINKAFORM_LIVE_RECORDS !== "undefined" && Array.isArray(LINKAFORM_LIVE_RECORDS) && LINKAFORM_LIVE_RECORDS.length > 0) {
    LINKAFORM_LIVE_RECORDS.forEach(r => {
      r.modelo = normalizeModelName(r.modelo, r.tipo);
    });
    const dedupResult = deduplicateOfficialRecords(LINKAFORM_LIVE_RECORDS);
    state.rawRecords = dedupResult.raw;
    state.records = dedupResult.valid;
    state.totalRawRecordsCount = dedupResult.rawCount;
    state.totalDuplicatesCount = dedupResult.dupsCount;
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") 
      ? LINKAFORM_LIVE_MATERIALS.map(m => ({ ...m, descripcion: normalizeMaterialName(m.descripcion) })) 
      : [];
    
    // Proteger contra QuotaExceededError (5MB) en navegadores
    safeRemoveStorage("telmex_dashboard_records");
    safeRemoveStorage("telmex_dashboard_raw_records");
    safeRemoveStorage("telmex_dashboard_materials_log");

    safeSetStorage("telmex_data_version", LIVE_DATA_VERSION);
    const syncText = `Sincronización Linkaform (${state.records.length} válidos de ${state.totalRawRecordsCount} recibidos)`;
    safeSetStorage("telmex_dashboard_last_sync", syncText);
  }
}

// Cargar Configuración de Materiales (localStorage o por defecto)
function loadConfig() {
  const saved = safeGetStorage("telmex_dashboard_config");
  if (saved) {
    try {
      state.config = JSON.parse(saved);
      // Garantizar que la cuenta Linkaform esté preconfigurada
      if (!state.config.linkaform) state.config.linkaform = {};
      if (!state.config.linkaform.username) state.config.linkaform.username = DEFAULT_CONFIG.linkaform.username;
      if (!state.config.linkaform.apiKey) state.config.linkaform.apiKey = DEFAULT_CONFIG.linkaform.apiKey;
    } catch (e) {
      state.config = DEFAULT_CONFIG;
    }
  } else {
    state.config = DEFAULT_CONFIG;
  }

  // Siempre forzar el catálogo oficial homologado del Excel (10 Cajas y 5 Casetas)
  state.config.materiales = DEFAULT_CONFIG.materiales;

  // Eliminar esmalte, thinner y sellador de materiales en cualquier circunstancia
  if (state.config && state.config.materiales) {
    state.config.materiales = state.config.materiales.filter(m => {
      if (EXCLUDED_MATERIALS.includes(m.id)) return false;
      const lower = (m.nombre || "").toLowerCase();
      if (lower.includes("esmalte") || lower.includes("thinner") || lower.includes("sellador") || lower.includes("solvente")) return false;
      return true;
    });
  }
}

// Cargar Registros (LINKAFORM_LIVE_RECORDS o memoria)
function loadRecords() {
  // Si ya se migraron los datos en vivo, no sobreescribir
  if (state.records && state.records.length > 0) {
    return;
  }

  const live = (typeof LINKAFORM_LIVE_RECORDS !== "undefined" && Array.isArray(LINKAFORM_LIVE_RECORDS)) ? LINKAFORM_LIVE_RECORDS : [];
  let sourceRecords = [];
  if (live.length > 0) {
    sourceRecords = live;
  } else {
    sourceRecords = (typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : [];
  }

  sourceRecords.forEach(r => {
    r.modelo = normalizeModelName(r.modelo, r.tipo);
  });
  const dedupResult = deduplicateOfficialRecords(sourceRecords);
  state.rawRecords = dedupResult.raw;
  state.records = dedupResult.valid;
  state.totalRawRecordsCount = dedupResult.rawCount;
  state.totalDuplicatesCount = dedupResult.dupsCount;
}

// Cargar Bitácora de Suministros de Materiales (Forma 184350)
function loadMaterialsLog() {
  if (state.materialsLog && state.materialsLog.length > 0) {
    return;
  }
  const live = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined" && Array.isArray(LINKAFORM_LIVE_MATERIALS)) ? LINKAFORM_LIVE_MATERIALS : [];
  if (live.length > 0) {
    state.materialsLog = live;
    return;
  }
  state.materialsLog = [];
}

// Normalizador de texto para tolerar pequeñas variaciones o faltas ortográficas del catálogo
function normalizeMaterialStr(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/envolvelte/g, "envolvente")
    .replace(/secillo/g, "sencillo")
    .replace(/deplasamiento/g, "desplazamiento")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalizador estándar para claves de Áreas Operativas y Estados de Telmex
function normalizeAreaKey(str) {
  if (!str) return "";
  let norm = String(str)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  const ALIAS_MAP = {
    "MICHOACAN": "MICHOACANMORELIA",
    "MORELIA": "MICHOACANMORELIA",
    "CIUDADOBREGON": "CIUDADOBREGONLOSMOCH",
    "CIUDADOBREGONLOSMOCHIS": "CIUDADOBREGONLOSMOCH",
    "LOSMOCHIS": "CIUDADOBREGONLOSMOCH",
    "OBREGON": "CIUDADOBREGONLOSMOCH",
    "ESTADODEMEXICO": "ESTADODEMEXICOSUR",
    "EDOMEX": "ESTADODEMEXICOSUR",
    "TEPIC": "NAYARIT"
  };
  return ALIAS_MAP[norm] || norm;
}

// Recalcular Suministros de Materiales a partir de las entregas reales registradas
function recalculateSuministrosFromMaterialsLog() {
  if (!state.materialsLog || state.materialsLog.length === 0) return;

  const totalsByMatId = {};
  state.materialsLog.forEach(item => {
    const matId = mapMaterialDescToId(item.descripcion);
    const qty = parseFloat(item.cantidad) || 0;
    totalsByMatId[matId] = (totalsByMatId[matId] || 0) + qty;
  });

  state.config.materiales.forEach(mat => {
    mat.suministrado = totalsByMatId[mat.id] || 0;
  });
}

function updateSyncLabel() {
  const lastSync = localStorage.getItem("telmex_dashboard_last_sync");
  const labelEl = document.getElementById("lastSyncLabel");
  const countEl = document.getElementById("recordsLoadedCount");
  
  if (labelEl) {
    labelEl.innerText = lastSync ? lastSync : "Datos locales precargados";
  }
  if (countEl) {
    countEl.innerText = `${state.records.length.toLocaleString()} registros activos`;
  }
}

// =========================================================
// FILTROS Y SELECTORES
// =========================================================
function initFilters() {
  populateAreaFilter();
  populateContratistasFilter();
  populateTecnicosFilter();
  initDatePresets();
}

function populateAreaFilter() {
  const areaSelect = document.getElementById("filterArea");
  if (!areaSelect) return;
  const currentVal = areaSelect.value;
  areaSelect.innerHTML = `<option value="">-- Todas las Áreas --</option>`;

  const areaSet = new Set();
  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    Object.keys(CATALOGO_METAS.estados).forEach(est => {
      if (est) areaSet.add(est.toUpperCase().trim());
      Object.keys(CATALOGO_METAS.estados[est]).forEach(ar => {
        if (ar) areaSet.add(ar.toUpperCase().trim());
      });
    });
  }
  (state.records || []).forEach(r => {
    if (r.area_trabajo) areaSet.add(r.area_trabajo.toUpperCase().trim());
  });
  (state.materialsLog || []).forEach(m => {
    if (m.area) areaSet.add(m.area.toUpperCase().trim());
  });

  const sortedAreas = Array.from(areaSet).filter(Boolean).sort();
  sortedAreas.forEach(ar => {
    const opt = document.createElement("option");
    opt.value = ar;
    opt.innerText = ar;
    areaSelect.appendChild(opt);
  });

  if (currentVal && areaSet.has(currentVal)) {
    areaSelect.value = currentVal;
  }
}

function populateContratistasFilter() {
  const contratistaSelect = document.getElementById("filterContratista");
  if (!contratistaSelect) return;
  const currentVal = contratistaSelect.value;
  contratistaSelect.innerHTML = `<option value="">-- Todos los Contratistas --</option>`;

  const contratistas = Array.from(new Set(state.records.map(r => r.contratista).filter(Boolean))).sort();
  contratistas.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.innerText = c;
    contratistaSelect.appendChild(opt);
  });
  contratistaSelect.value = currentVal;
}

function onEstadoFilterChange() {
  applyFilters();
}

function onPresetDateChange() {
  const presetEl = document.getElementById("filterPresetDate");
  const preset = presetEl ? presetEl.value : "all";
  const customContainer = document.getElementById("customDateContainer");

  if (preset === "custom") {
    if (customContainer) customContainer.classList.remove("hidden");
  } else {
    if (customContainer) customContainer.classList.add("hidden");
    applyFilters();
  }
}

function initDatePresets() {
  const today = getLocalDateStr(new Date());
  const customDateTo = document.getElementById("customDateTo");
  const customDateFrom = document.getElementById("customDateFrom");
  if (customDateTo) customDateTo.value = today;
  if (customDateFrom) customDateFrom.value = "2026-10-01";
}

function resetFilters() {
  const filterArea = document.getElementById("filterArea");
  if (filterArea) filterArea.value = "";
  const filterTipo = document.getElementById("filterTipo");
  if (filterTipo) filterTipo.value = "";
  const filterPreset = document.getElementById("filterPresetDate");
  if (filterPreset) filterPreset.value = "all";
  const customContainer = document.getElementById("customDateContainer");
  if (customContainer) customContainer.classList.add("hidden");
  applyFilters();
}

// Verifica si un registro corresponde a un área o región seleccionada
function recordMatchesArea(r, selectedArea) {
  if (!selectedArea) return true;
  const selNorm = normalizeAreaKey(selectedArea);
  const rAreaNorm = normalizeAreaKey(r.area_trabajo);
  const rEstadoNorm = normalizeAreaKey(r.estado);

  // 1. Coincidencia directa por Área de Trabajo / Plaza (la unidad operativa oficial de Telmex)
  if (rAreaNorm && (rAreaNorm === selNorm || rAreaNorm.includes(selNorm) || selNorm.includes(rAreaNorm))) {
    return true;
  }

  // 2. Si no tiene área de trabajo, comparar por estado
  if (!rAreaNorm && rEstadoNorm === selNorm) {
    return true;
  }

  // 3. Si selectedArea es una Región macro en CATALOGO_METAS que agrupa varias plazas
  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    for (let est in CATALOGO_METAS.estados) {
      if (normalizeAreaKey(est) === selNorm && est !== selectedArea) {
        for (let ar in CATALOGO_METAS.estados[est]) {
          if (normalizeAreaKey(ar) === rAreaNorm) return true;
        }
      }
    }
  }

  return false;
}

// Normalizador y verificador de corte oficial (respeta todos los registros hasta las 22:00 hrs)
// Normalizador y verificador de corte oficial (respeta todos los registros hasta las 22:00 hrs)
function isRecordAfterCutoff(r, cutoffInfo) {
  if (!cutoffInfo || !cutoffInfo.isFrozen) return false;
  
  // Extraer fecha y hora real de captura
  const timeInfo = parseDateTimeSafe(r.created_at_iso || r.fecha_captura || r.fecha);
  const captureDate = timeInfo.dateStr || "";
  const captureTime = timeInfo.timeStr ? (timeInfo.timeStr.length === 5 ? timeInfo.timeStr + ":00" : timeInfo.timeStr) : "00:00:00";
  const captureDateTime = `${captureDate} ${captureTime}`;
  
  const cutoffLimit = cutoffInfo.maxVisibleDt || `${cutoffInfo.activeReportingDate} 22:00:00`;
  return captureDateTime > cutoffLimit;
}

// =========================================================
// APLICACIÓN DE FILTROS & CÁLCULOS
// =========================================================
function applyFilters() {
  const arEl = document.getElementById("filterArea");
  const arVal = arEl ? arEl.value.trim().toUpperCase() : "";
  const tipoEl = document.getElementById("filterTipo");
  const tipoVal = tipoEl ? tipoEl.value.trim().toUpperCase() : "";
  const presetEl = document.getElementById("filterPresetDate");
  const presetVal = presetEl ? presetEl.value : "all";

  // Rango de fechas
  let minDate = null;
  let maxDate = null;
  const today = new Date();

  if (presetVal === "today") {
    minDate = getLocalDateStr(today);
    maxDate = minDate;
  } else if (presetVal === "7days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    minDate = getLocalDateStr(d);
    maxDate = getLocalDateStr(today);
  } else if (presetVal === "30days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    minDate = getLocalDateStr(d);
    maxDate = getLocalDateStr(today);
  } else if (presetVal === "custom") {
    minDate = document.getElementById("customDateFrom") ? document.getElementById("customDateFrom").value || null : null;
    maxDate = document.getElementById("customDateTo") ? document.getElementById("customDateTo").value || null : null;
  }

  const cutoffInfo = getCutoffInfo();
  renderCutoffBanner(cutoffInfo);

  if (presetVal === "today") {
    minDate = cutoffInfo.activeReportingDate;
    maxDate = minDate;
  }

  // state.records contiene exclusivamente los activos físicos únicos validados (coincidencia 100% con Excel oficial)
  state.filteredRecords = [];

  for (const r of (state.records || [])) {
    const ident = String(r.identificador || r.id || "").trim().toUpperCase();
    if (RESTRICTED_DISTRICTS.has(ident)) continue;
    if (arVal && !recordMatchesArea(r, arVal)) continue;
    if (tipoVal && r.tipo && r.tipo.toUpperCase() !== tipoVal) continue;
    
    // Regla de corte: en período congelado, respetar todo lo capturado hasta las 22:00
    if (cutoffInfo.isFrozen && isRecordAfterCutoff(r, cutoffInfo)) {
      continue;
    }

    if (minDate && r.fecha && r.fecha < minDate) continue;
    if (maxDate && r.fecha && r.fecha > maxDate) continue;

    state.filteredRecords.push(r);
  }

  // Contar cuántos folios brutos en Linkaform corresponden a este mismo filtro (para auditoría transparente)
  let totalRawFolios = 0;
  const rawList = (state.rawRecords && state.rawRecords.length > 0) ? state.rawRecords : (state.records || []);
  for (const r of rawList) {
    const ident = String(r.identificador || r.id || "").trim().toUpperCase();
    if (RESTRICTED_DISTRICTS.has(ident)) continue;
    if (arVal && !recordMatchesArea(r, arVal)) continue;
    if (tipoVal && r.tipo && r.tipo.toUpperCase() !== tipoVal) continue;
    if (cutoffInfo.isFrozen && isRecordAfterCutoff(r, cutoffInfo)) continue;
    if (minDate && r.fecha && r.fecha < minDate) continue;
    if (maxDate && r.fecha && r.fecha > maxDate) continue;
    totalRawFolios++;
  }

  state.totalRawFoliosCount = totalRawFolios;
  state.currentPage = 1;

  // Mantener catálogo de técnicos sincronizado con el área activa
  populateTecnicosFilter();

  // Renderizar vistas
  renderKpis();
  renderMaterialsTab();
  renderAreasTab();
  renderFechasTab();
  renderRecordsTable();
  if (typeof renderBossModule === "function") { renderBossModule(); }
}

// =========================================================
// RENDERIZADO DE KPIS SUPERIORES
// =========================================================
function renderKpis() {
  const filtered = state.filteredRecords;
  const arEl = document.getElementById("filterArea");
  const arVal = arEl ? arEl.value.trim().toUpperCase() : "";
  const tipoEl = document.getElementById("filterTipo");
  const tipoVal = tipoEl ? tipoEl.value.trim().toUpperCase() : "";

  // Calcular metas correspondientes al filtro de Área
  let totalMeta = 0;
  let cajasMeta = 0;
  let casetasMeta = 0;

  if (arVal) {
    const metaData = getAreaMetas(arVal);
    cajasMeta = metaData.cajas || 0;
    casetasMeta = metaData.casetas || 0;
    totalMeta = metaData.total || (cajasMeta + casetasMeta);
  } else if (typeof CATALOGO_METAS !== "undefined") {
    totalMeta = CATALOGO_METAS.total_general;
    cajasMeta = CATALOGO_METAS.total_cajas;
    casetasMeta = CATALOGO_METAS.total_casetas;
  }

  const cajasDone = filtered.filter(r => r.tipo === "CAJA").length;
  const casetasDone = filtered.filter(r => r.tipo === "CASETA").length;
  const totalDone = filtered.length;

  let activeTargetMeta = totalMeta;
  if (tipoVal === "CAJA") activeTargetMeta = cajasMeta;
  else if (tipoVal === "CASETA") activeTargetMeta = casetasMeta;

  const totalPercent = activeTargetMeta > 0 ? ((totalDone / activeTargetMeta) * 100).toFixed(1) : "0.0";
  const cajasPercent = cajasMeta > 0 ? ((cajasDone / cajasMeta) * 100).toFixed(1) : "0.0";
  const casetasPercent = casetasMeta > 0 ? ((casetasDone / casetasMeta) * 100).toFixed(1) : "0.0";

  // Actualizar DOM KPIs
  document.getElementById("kpiTotalDone").innerText = totalDone.toLocaleString();
  document.getElementById("kpiTotalMeta").innerText = activeTargetMeta.toLocaleString();
  document.getElementById("kpiTotalPercent").innerText = `${totalPercent}%`;
  document.getElementById("kpiTotalProgressBar").style.width = `${Math.min(100, totalPercent)}%`;

  const auditSub = document.getElementById("kpiTotalAuditSub");
  if (auditSub) {
    const rawTotal = state.totalRawFoliosCount || totalDone;
    const dups = Math.max(0, rawTotal - totalDone);
    if (dups > 0) {
      auditSub.innerHTML = `<span class="text-emerald-700 font-bold">${totalDone.toLocaleString()} validados</span> <span class="text-slate-400 font-normal">(${rawTotal.toLocaleString()} folios • ${dups} dup)</span>`;
    } else {
      auditSub.innerHTML = `<span class="text-emerald-700 font-bold">${totalDone.toLocaleString()} activos validados</span>`;
    }
  }

  document.getElementById("kpiCajasDone").innerText = cajasDone.toLocaleString();
  document.getElementById("kpiCajasMeta").innerText = cajasMeta.toLocaleString();
  document.getElementById("kpiCajasPercent").innerText = `${cajasPercent}%`;
  document.getElementById("kpiCajasProgressBar").style.width = `${Math.min(100, cajasPercent)}%`;

  document.getElementById("kpiCasetasDone").innerText = casetasDone.toLocaleString();
  document.getElementById("kpiCasetasMeta").innerText = casetasMeta.toLocaleString();
  document.getElementById("kpiCasetasPercent").innerText = `${casetasPercent}%`;
  document.getElementById("kpiCasetasProgressBar").style.width = `${Math.min(100, casetasPercent)}%`;

  // Ritmo de Trabajo
  const uniqueDates = Array.from(new Set(filtered.map(r => r.fecha).filter(Boolean)));
  const activeDays = Math.max(1, uniqueDates.length);
  const avgPerDay = Math.round(totalDone / activeDays);
  
  const todayStr = getLocalDateStr(new Date());
  const doneToday = filtered.filter(r => {
    if (!r.fecha) return false;
    const recDate = String(r.fecha).replace(/\//g, "-").substring(0, 10);
    return recDate === todayStr;
  }).length;

  const kpiAvgPerDay = document.getElementById("kpiAvgPerDay");
  const kpiDoneToday = document.getElementById("kpiDoneToday");
  const kpiActiveDays = document.getElementById("kpiActiveDays");

  if (kpiAvgPerDay) {
    kpiAvgPerDay.innerHTML = `${avgPerDay.toLocaleString()} <span class="text-xs font-semibold text-slate-500">activos/día</span>`;
  }
  if (kpiDoneToday) {
    kpiDoneToday.innerText = `${doneToday.toLocaleString()} activos`;
    kpiDoneToday.className = doneToday > 0 ? "font-bold text-emerald-700" : "font-bold text-slate-500";
  }
  if (kpiActiveDays) {
    kpiActiveDays.innerText = `${activeDays} días registrados`;
  }
}

// =========================================================
// PESTAÑA 1: BALANCE DE MATERIALES (QUEDA VS FALTA POR ÁREA)
// =========================================================

// Mapeo exacto entre el registro de trabajo de campo (Forma 142786) y el catálogo de materiales
function mapRecordToMaterialId(rec) {
  const tipo = (rec.tipo || '').toUpperCase().trim();
  const modelo = normalizeModelName(rec.modelo, tipo);

  if (tipo === 'CASETA') {
    if (modelo === 'CUICUILCO') return 'cuicuilco';
    if (modelo === 'DOBLE REFORMA') return 'doble_reforma';
    if (modelo === 'SEMICIRCULAR') return 'semicircular';
    if (modelo === 'MINI') return 'caseta_mini';
    return 'caseta_normal';
  } else {
    // CAJA
    if (modelo === 'DESPLAZAMIENTO DOBLE') return 'desplazamiento_doble';
    if (modelo === 'DESPLAZAMIENTO SENCILLA') return 'desplazamiento_sencilla';
    if (modelo === 'ENVOLVENTE DOBLE') return 'envolvente_doble';
    if (modelo === 'ENVOLVENTE SENCILLA') return 'envolvente_sencilla';
    if (modelo === 'KRONE') return 'krone';
    if (modelo === 'SIECOR DOBLE') return 'siecor_doble';
    if (modelo === 'SIECOR SENCILLA 1PTA') return 'siecor_sencilla_1pta';
    if (modelo === 'SIECOR SENCILLA 2 PTAS') return 'siecor_sencilla_2_ptas';
    if (modelo === 'TRADICIONAL DOBLE') return 'tradicional_doble';
    return 'tradicional_sencilla';
  }
}

// Obtener cantidad real de viniles instalados en el activo reportado
function getRecordVinilCount(rec) {
  if (rec.num_viniles !== undefined && rec.num_viniles !== null && rec.num_viniles !== '') {
    const val = parseFloat(rec.num_viniles);
    if (!isNaN(val)) return val;
  }
  // Valor por defecto en campo si no fue capturado
  return (rec.tipo || '').toUpperCase().trim() === 'CASETA' ? 2 : 1;
}

// Mapeo normalizado de la descripción de entrega (Forma 184350) al ID de material
function mapMaterialDescToId(desc) {
  const norm = normalizeMaterialName(desc);
  if (norm === 'CUICUILCO') return 'cuicuilco';
  if (norm === 'DOBLE REFORMA') return 'doble_reforma';
  if (norm === 'SEMICIRCULAR') return 'semicircular';
  if (norm === 'MINI') return 'caseta_mini';
  if (norm === 'NORMAL') return 'caseta_normal';
  if (norm === 'DESPLAZAMIENTO DOBLE') return 'desplazamiento_doble';
  if (norm === 'DESPLAZAMIENTO SENCILLA') return 'desplazamiento_sencilla';
  if (norm === 'ENVOLVENTE DOBLE') return 'envolvente_doble';
  if (norm === 'ENVOLVENTE SENCILLA') return 'envolvente_sencilla';
  if (norm === 'KRONE') return 'krone';
  if (norm === 'SIECOR DOBLE') return 'siecor_doble';
  if (norm === 'SIECOR SENCILLA 1PTA') return 'siecor_sencilla_1pta';
  if (norm === 'SIECOR SENCILLA 2 PTAS') return 'siecor_sencilla_2_ptas';
  if (norm === 'TRADICIONAL DOBLE') return 'tradicional_doble';
  if (norm === 'TRADICIONAL SENCILLA') return 'tradicional_sencilla';

  const d = normalizeMaterialStr(desc);
  if (d.includes('pintura') && d.includes('azul')) return 'pintura_azul';
  if (d.includes('pintura') && d.includes('gris')) return 'pintura_gris';
  if (d.includes('thinner')) return 'thinner';
  if (d.includes('sellador')) return 'sellador';
  return d;
}

// Metas del Área
function getAreaMetas(areaName) {
  if (!areaName || typeof CATALOGO_METAS === "undefined" || !CATALOGO_METAS.estados) {
    return {
      cajas: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_cajas : 49829,
      casetas: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_casetas : 44919,
      total: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_general : 94748
    };
  }

  const normArea = normalizeAreaKey(areaName);
  for (let edo in CATALOGO_METAS.estados) {
    for (let ar in CATALOGO_METAS.estados[edo]) {
      if (normalizeAreaKey(ar) === normArea || normalizeAreaKey(edo) === normArea) {
        return CATALOGO_METAS.estados[edo][ar];
      }
    }
  }

  return { cajas: 1000, casetas: 500, total: 1500 };
}

// Inicializar selector de áreas de materiales
function initMaterialAreaFilter() {
  const select = document.getElementById("materialAreaSelect");
  if (!select) return;

  const currentVal = state.selectedMaterialArea || select.value || "";
  select.innerHTML = `<option value="">-- Todas las Áreas (Consolidado) --</option>`;

  const areaSet = new Set();
  (state.materialsLog || []).forEach(m => {
    if (m.area) areaSet.add(m.area.toUpperCase().trim());
  });
  (state.records || []).forEach(r => {
    if (r.area_trabajo) areaSet.add(r.area_trabajo.toUpperCase().trim());
  });

  Array.from(areaSet).sort().forEach(ar => {
    const opt = document.createElement("option");
    opt.value = ar;
    opt.innerText = ar;
    select.appendChild(opt);
  });

  select.value = currentVal;
}

function onMaterialAreaSelectChange() {
  const select = document.getElementById("materialAreaSelect");
  state.selectedMaterialArea = select ? select.value : "";
  renderMaterialsTab();
}

// Renderizado principal del Balance de Materiales
function renderMaterialsTab() {
  initMaterialAreaFilter();

  const selectedArea = state.selectedMaterialArea || "";
  const tbody = document.getElementById("materialsTableBody");
  const alertList = document.getElementById("materialsAlertList");

  if (tbody) tbody.innerHTML = "";
  if (alertList) alertList.innerHTML = "";

  // 1. Actualizar Encabezados y Badges si existen
  const badgeEl = document.getElementById("activeMaterialAreaBadge");
  const titleEl = document.getElementById("materialsTableTitle");
  const subEl = document.getElementById("materialsAreaSubtitle");

  if (badgeEl) {
    badgeEl.innerText = selectedArea ? `PLAZA: ${selectedArea}` : "TODAS LAS ÁREAS";
    badgeEl.className = selectedArea 
      ? "bg-amber-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm" 
      : "bg-telmex text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm";
  }
  if (titleEl) {
    titleEl.innerText = selectedArea 
      ? `Balance de Materiales - Plaza ${selectedArea}` 
      : "Balance General de Materiales (Consolidado Nacional)";
  }
  if (subEl) {
    subEl.innerText = selectedArea 
      ? `Suministros recibidos en ${selectedArea} vs Viniles instalados en ${selectedArea} (inventario independiente)` 
      : "Contabilización directa por número de viniles instalados en campo";
  }

  // 2. Filtrar Registros y Bitácora exclusivamente para el área activa
  const activeRecords = selectedArea 
    ? state.records.filter(r => (r.area_trabajo || "").toUpperCase().trim() === selectedArea)
    : state.records;

  const activeLog = selectedArea 
    ? state.materialsLog.filter(m => (m.area || "").toUpperCase().trim() === selectedArea)
    : state.materialsLog;

  // 3. Suministros por Material en el Área activa
  const suministrosByMat = {};
  activeLog.forEach(m => {
    const matId = mapMaterialDescToId(m.descripcion);
    const qty = parseFloat(m.cantidad) || 0;
    suministrosByMat[matId] = (suministrosByMat[matId] || 0) + qty;
  });

  // 4. Consumo Real en base a NUM_VINILES colocados en campo
  const consumidoByMat = {};
  activeRecords.forEach(r => {
    const matId = mapRecordToMaterialId(r);
    const viniles = getRecordVinilCount(r);
    consumidoByMat[matId] = (consumidoByMat[matId] || 0) + viniles;
  });

  // 5. Metas correspondientes
  const metas = getAreaMetas(selectedArea);
  const cajasMeta = metas.cajas || 0;
  const casetasMeta = metas.casetas || 0;

  let criticalCount = 0;
  const chartLabels = [];
  const chartConsumidoData = [];
  const chartStockQuedaData = [];

  // 6. Recorrer cada material del catálogo (excluyendo esmalte, thinner y sellador)
  state.config.materiales.forEach(mat => {
    if (EXCLUDED_MATERIALS.includes(mat.id)) return;
    const lowerName = (mat.nombre || "").toLowerCase();
    if (lowerName.includes("esmalte") || lowerName.includes("thinner") || lowerName.includes("sellador") || lowerName.includes("solvente")) return;

    const suministrado = suministrosByMat[mat.id] || 0;

    let consumido = 0;
    if (mat.categoria.includes("Vinil") || mat.id.includes("vinil") || mat.id.includes("caseta") || mat.id.includes("sencilla") || mat.id.includes("doble")) {
      consumido = consumidoByMat[mat.id] || 0;
    } else {
      const cajasCount = activeRecords.filter(r => r.tipo === "CAJA").length;
      const casetasCount = activeRecords.filter(r => r.tipo === "CASETA").length;
      consumido = Math.round((cajasCount * (mat.consumo_por_caja || 0)) + (casetasCount * (mat.consumo_por_caseta || 0)));
    }

    // Sobran / Queda = Suministrado - Consumido
    const queda = suministrado - consumido;
    const quedaVisual = Math.max(0, queda);

    // Requerido según la meta del área y faltante por suministrar
    const requeridoMeta = Math.round((cajasMeta * (mat.consumo_por_caja || 0)) + (casetasMeta * (mat.consumo_por_caseta || 0)));
    const falta = Math.max(0, requeridoMeta - suministrado);

    // Badges de estatus
    let statusBadge = "";
    let isCritical = false;

    if (suministrado === 0 && consumido > 0) {
      statusBadge = `<span class="badge badge-danger">🔴 Sin Surtido (-${consumido} viniles)</span>`;
      criticalCount++;
      isCritical = true;
    } else if (queda < 0) {
      statusBadge = `<span class="badge badge-danger">🔴 Déficit (${queda} viniles)</span>`;
      criticalCount++;
      isCritical = true;
    } else if (suministrado > 0 && queda <= (mat.stock_minimo_alerta || 20)) {
      statusBadge = `<span class="badge badge-warning">🟡 Stock Bajo (${queda} disponibles)</span>`;
    } else if (suministrado === 0 && consumido === 0) {
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500">⚪ Sin Movimiento</span>`;
    } else {
      statusBadge = `<span class="badge badge-success">🟢 Sobran ${formatNumber(queda)} ${mat.unidad}</span>`;
    }

    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50 transition border-b border-slate-100";
    row.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
        <span class="text-base">${mat.icono || '📦'}</span>
        <div>
          <div>${mat.nombre}</div>
          <span class="text-[10px] text-slate-400 font-normal uppercase">${mat.categoria || 'General'}</span>
        </div>
      </td>
      <td class="py-3 px-3 text-slate-500">${mat.unidad}</td>
      <td class="py-3 px-3 text-right font-semibold text-slate-700">${formatNumber(suministrado)}</td>
      <td class="py-3 px-3 text-right font-black text-telmex">${formatNumber(consumido)}</td>
      <td class="py-3 px-3 text-right font-black ${queda < 0 ? 'text-rose-700 bg-rose-50/50' : 'text-emerald-700 bg-emerald-50/40'}">${formatNumber(quedaVisual)}</td>
      <td class="py-3 px-3 text-right text-slate-500">${formatNumber(requeridoMeta)}</td>
      <td class="py-3 px-3 text-right font-black text-rose-700 bg-rose-50/40">${formatNumber(falta)}</td>
      <td class="py-3 px-4 text-center">${statusBadge}</td>
    `;
    if (tbody) tbody.appendChild(row);

    // Datos para gráfica
    if (suministrado > 0 || consumido > 0) {
      chartLabels.push(mat.nombre.length > 18 ? mat.nombre.substring(0, 16) + '...' : mat.nombre);
      chartConsumidoData.push(Math.round(consumido));
      chartStockQuedaData.push(Math.round(quedaVisual));
    }

    if (isCritical && alertList) {
      const alertItem = document.createElement("div");
      alertItem.className = "p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-start gap-2.5";
      alertItem.innerHTML = `
        <span class="text-lg">⚠️</span>
        <div>
          <strong class="font-bold text-rose-900">${mat.nombre} (${selectedArea || 'Consolidado'}):</strong>
          <p class="text-rose-800 mt-0.5">Se han instalado <strong>${formatNumber(consumido)} viniles</strong> en campo, pero en almacén ${suministrado === 0 ? 'no se tiene registro de remisión' : `solo se recibieron ${formatNumber(suministrado)}`}.</p>
        </div>
      `;
      alertList.appendChild(alertItem);
    }
  });

  if (criticalCount === 0 && alertList) {
    alertList.innerHTML = `
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
        <span>✅</span>
        <span>${selectedArea ? `La plaza ${selectedArea} cuenta con balance positivo de inventario.` : 'Todas las plazas cuentan con inventario suficiente para su ritmo actual.'}</span>
      </div>
    `;
  }

  // Actualizar KPI Card de Materiales
  const matStatusEl = document.getElementById("kpiMaterialStatus");
  const matCriticalCountEl = document.getElementById("kpiCriticalMaterialsCount");
  if (matStatusEl && matCriticalCountEl) {
    if (criticalCount > 0) {
      matStatusEl.innerText = `🔴 ${criticalCount} en Déficit`;
      matStatusEl.className = "text-lg font-black text-rose-600 mt-0.5";
    } else {
      matStatusEl.innerText = `🟢 Abastecido`;
      matStatusEl.className = "text-lg font-black text-emerald-600 mt-0.5";
    }
    matCriticalCountEl.innerText = `${criticalCount} ítems con alerta`;
  }

  // Gráfica
  renderChartMaterials(chartLabels, chartConsumidoData, chartStockQuedaData);

  // Renderizar Matriz Comparativa por Área
  renderMaterialsAreaMatrix();

  // Renderizar Bitácora filtrada
  renderMaterialsLogTable(selectedArea);
}

// Matriz Comparativa de Materiales por Plaza Operativa
function renderMaterialsAreaMatrix() {
  const tbody = document.getElementById("materialsAreaMatrixTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const areaSet = new Set();
  (state.materialsLog || []).forEach(m => {
    if (m.area) areaSet.add(m.area.toUpperCase().trim());
  });
  (state.records || []).forEach(r => {
    if (r.area_trabajo) areaSet.add(r.area_trabajo.toUpperCase().trim());
  });

  const selectedArea = state.selectedMaterialArea || "";
  const allAreas = Array.from(areaSet).sort();
  const areas = selectedArea ? allAreas.filter(a => a === selectedArea) : allAreas;
  if (areas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">No hay registros de materiales ni trabajos para esta plaza aún.</td></tr>`;
    return;
  }

  // Suministros por Área y Material
  const sumByAreaMat = {};
  (state.materialsLog || []).forEach(m => {
    const area = (m.area || "GENERAL").toUpperCase().trim();
    const matId = mapMaterialDescToId(m.descripcion);
    const qty = parseFloat(m.cantidad) || 0;
    if (!sumByAreaMat[area]) sumByAreaMat[area] = {};
    sumByAreaMat[area][matId] = (sumByAreaMat[area][matId] || 0) + qty;
  });

  // Consumo por Área y Material
  const conByAreaMat = {};
  (state.records || []).forEach(r => {
    const area = (r.area_trabajo || "GENERAL").toUpperCase().trim();
    const matId = mapRecordToMaterialId(r);
    const viniles = getRecordVinilCount(r);
    if (!conByAreaMat[area]) conByAreaMat[area] = {};
    conByAreaMat[area][matId] = (conByAreaMat[area][matId] || 0) + viniles;
  });

  areas.forEach(area => {
    const metas = getAreaMetas(area);
    const cajasMeta = metas.cajas || 0;
    const casetasMeta = metas.casetas || 0;

    const activeMatIds = new Set();
    if (sumByAreaMat[area]) {
      Object.keys(sumByAreaMat[area]).forEach(id => activeMatIds.add(id));
    }
    if (conByAreaMat[area]) {
      Object.keys(conByAreaMat[area]).forEach(id => activeMatIds.add(id));
    }

    if (activeMatIds.size === 0) return;

    activeMatIds.forEach(matId => {
      if (EXCLUDED_MATERIALS.includes(matId)) return;
      const lowerMat = (matId || "").toLowerCase();
      if (lowerMat.includes("esmalte") || lowerMat.includes("thinner") || lowerMat.includes("sellador") || lowerMat.includes("solvente") || lowerMat.includes("pintura")) return;

      const mat = state.config.materiales.find(m => m.id === matId) || {
        id: matId,
        nombre: matId.replace(/_/g, " ").toUpperCase(),
        unidad: "Pzas",
        consumo_por_caja: 0.1,
        consumo_por_caseta: 1.0,
        icono: "🏷️"
      };

      const suministrado = (sumByAreaMat[area] && sumByAreaMat[area][matId]) || 0;
      const consumido = (conByAreaMat[area] && conByAreaMat[area][matId]) || 0;
      const queda = suministrado - consumido;
      const quedaVisual = Math.max(0, queda);
      const metaReq = Math.round((cajasMeta * (mat.consumo_por_caja || 0)) + (casetasMeta * (mat.consumo_por_caseta || 0)));
      const falta = Math.max(0, metaReq - suministrado);

      let statusBadge = "";
      if (suministrado === 0 && consumido > 0) {
        statusBadge = `<span class="badge badge-danger">🔴 Sin Suministro (-${consumido})</span>`;
      } else if (queda < 0) {
        statusBadge = `<span class="badge badge-danger">🔴 Déficit (${queda})</span>`;
      } else if (suministrado > 0 && queda <= 20) {
        statusBadge = `<span class="badge badge-warning">🟡 Stock Bajo (${queda})</span>`;
      } else {
        statusBadge = `<span class="badge badge-success">🟢 Sobran ${formatNumber(queda)}</span>`;
      }

      const row = document.createElement("tr");
      row.className = "hover:bg-slate-50 transition border-b border-slate-100";
      row.innerHTML = `
        <td class="py-2.5 px-4 font-bold text-slate-800">
          <span class="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">${area}</span>
        </td>
        <td class="py-2.5 px-3 font-semibold text-slate-700 flex items-center gap-1.5">
          <span>${mat.icono || '🏷️'}</span>
          <span>${mat.nombre}</span>
        </td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-800">${formatNumber(suministrado)}</td>
        <td class="py-2.5 px-3 text-right font-black text-telmex">${formatNumber(consumido)}</td>
        <td class="py-2.5 px-3 text-right font-black ${queda < 0 ? 'text-rose-700 bg-rose-50/50' : 'text-emerald-700 bg-emerald-50/50'}">${formatNumber(quedaVisual)}</td>
        <td class="py-2.5 px-3 text-right text-slate-500">${formatNumber(metaReq)}</td>
        <td class="py-2.5 px-3 text-right font-black text-rose-700 bg-rose-50/50">${formatNumber(falta)}</td>
        <td class="py-2.5 px-4 text-center">${statusBadge}</td>
      `;
      tbody.appendChild(row);
    });
  });
}

function renderMaterialsLogTable(filterArea = "") {
  const tbody = document.getElementById("materialsLogTableBody");
  const countEl = document.getElementById("materialsLogCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  let log = state.materialsLog || [];
  if (filterArea) {
    log = log.filter(m => (m.area || "").toUpperCase().trim() === filterArea.toUpperCase().trim());
  }

  if (countEl) {
    countEl.innerText = filterArea 
      ? `${log.length} entregas en ${filterArea}` 
      : `${log.length} entregas registradas`;
  }

  if (log.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400 italic">
          No hay registros de suministros ${filterArea ? `para la plaza ${filterArea}` : ''}.
        </td>
      </tr>
    `;
    return;
  }

  log.forEach(item => {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50 transition border-b border-slate-100";
    const fotoHtml = item.foto 
      ? `<a href="${item.foto}" target="_blank" class="inline-flex items-center gap-1 text-telmex hover:text-telmex-dark font-bold underline"><span>📷</span> Ver Foto</a>`
      : `<span class="text-slate-400">Sin foto</span>`;

    row.innerHTML = `
      <td class="py-2.5 px-4 font-mono text-slate-600">${item.fecha || "S/F"}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${item.area || "GENERAL"}</td>
      <td class="py-2.5 px-3 text-slate-700 font-semibold">${item.descripcion}</td>
      <td class="py-2.5 px-3 text-right font-black text-emerald-700">${formatNumber(item.cantidad)}</td>
      <td class="py-2.5 px-3 text-slate-500">${item.unidad || "Pzas"}</td>
      <td class="py-2.5 px-4 text-center">${fotoHtml}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderChartMaterials(labels, consumido, queda) {
  const ctx = document.getElementById("chartMaterials");
  if (!ctx) return;

  if (state.charts.materials) {
    state.charts.materials.destroy();
  }

  state.charts.materials = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Consumido (Real)',
          data: consumido,
          backgroundColor: '#0055a5',
          borderRadius: 4
        },
        {
          label: 'Stock Remanente (Queda)',
          data: queda,
          backgroundColor: '#10b981',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

// =========================================================
// PESTAÑA 2: AVANCE POR ÁREAS Y ESTADOS
// =========================================================
function renderAreasTab() {
  const filtered = state.filteredRecords;
  const tbody = document.getElementById("areasTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // 1. Construir catálogo base de áreas y metas
  const areaList = [];
  const areaIndexMap = {}; // Acceso O(1) por clave normalizada

  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    Object.keys(CATALOGO_METAS.estados).forEach(est => {
      Object.keys(CATALOGO_METAS.estados[est]).forEach(ar => {
        const metaData = CATALOGO_METAS.estados[est][ar];
        const entry = {
          estado: (est === ar) ? est : ar,
          area: est,
          estRaw: est,
          arRaw: ar,
          normEst: normalizeAreaKey(est),
          normAr: normalizeAreaKey(ar),
          metaCajas: metaData.cajas || 0,
          metaCasetas: metaData.casetas || 0,
          metaTotal: metaData.total || 0,
          cajasDone: 0,
          casetasDone: 0,
          totalDone: 0
        };
        const idx = areaList.length;
        areaList.push(entry);

        if (entry.normEst && areaIndexMap[entry.normEst] === undefined) {
          areaIndexMap[entry.normEst] = idx;
        }
        if (entry.normAr && areaIndexMap[entry.normAr] === undefined) {
          areaIndexMap[entry.normAr] = idx;
        }
      });
    });
  }

  // Mapa para filas de registros no encontrados en el catálogo
  const unmappedRows = {};

  // 2. Acumular registros filtrados hacia el área correspondiente
  filtered.forEach(r => {
    const rArea = r.area_trabajo || "";
    const rEstado = r.estado || "";
    const normA = normalizeAreaKey(rArea);
    const normE = normalizeAreaKey(rEstado);

    let targetIdx = -1;

    // A) Búsqueda directa por área de trabajo (ej: TOLUCA, MORELOS, BALBUENA)
    if (normA && areaIndexMap[normA] !== undefined) {
      targetIdx = areaIndexMap[normA];
    }
    // B) Búsqueda directa por estado
    else if (normE && areaIndexMap[normE] !== undefined) {
      targetIdx = areaIndexMap[normE];
    }
    // C) Búsqueda por contención o subcadena
    else if (normA || normE) {
      for (let i = 0; i < areaList.length; i++) {
        const item = areaList[i];
        if (normA && (item.normEst.includes(normA) || normA.includes(item.normEst))) {
          targetIdx = i;
          break;
        }
        if (normA && (item.normAr.includes(normA) || normA.includes(item.normAr))) {
          targetIdx = i;
          break;
        }
        if (normE && (item.normEst.includes(normE) || item.normAr.includes(normE))) {
          targetIdx = i;
          break;
        }
      }
    }

    const isCaseta = (r.tipo === 'CASETA');

    if (targetIdx >= 0) {
      const target = areaList[targetIdx];
      if (isCaseta) {
        target.casetasDone++;
      } else {
        target.cajasDone++;
      }
      target.totalDone++;
    } else {
      // Registrar fila no catalogada para asegurar que el 100% de los trabajos se refleje
      const unmappedKey = `${rEstado || 'S/E'} - ${rArea || 'S/A'}`;
      if (!unmappedRows[unmappedKey]) {
        unmappedRows[unmappedKey] = {
          estado: rEstado || 'S/E',
          area: rArea || 'S/A',
          metaCajas: 0,
          metaCasetas: 0,
          metaTotal: 0,
          cajasDone: 0,
          casetasDone: 0,
          totalDone: 0
        };
      }
      if (isCaseta) {
        unmappedRows[unmappedKey].casetasDone++;
      } else {
        unmappedRows[unmappedKey].cajasDone++;
      }
      unmappedRows[unmappedKey].totalDone++;
    }
  });

  // 3. Consolidar todas las filas y calcular porcentajes
  const areaRows = areaList.map(item => {
    const percent = item.metaTotal > 0 ? ((item.totalDone / item.metaTotal) * 100) : 0;
    return {
      estado: item.estado,
      area: item.area,
      metaCajas: item.metaCajas,
      cajasDone: item.cajasDone,
      metaCasetas: item.metaCasetas,
      casetasDone: item.casetasDone,
      metaTotal: item.metaTotal,
      totalDone: item.totalDone,
      percent: percent
    };
  });

  Object.values(unmappedRows).forEach(u => {
    const percent = u.metaTotal > 0 ? ((u.totalDone / u.metaTotal) * 100) : (u.totalDone > 0 ? 100 : 0);
    areaRows.push({
      ...u,
      percent: percent
    });
  });

  // 4. Ordenar: primero áreas con trabajos intervenidos descendente; si empatan en 0, por meta descendente
  areaRows.sort((a, b) => {
    if (b.totalDone !== a.totalDone) {
      return b.totalDone - a.totalDone;
    }
    return b.metaTotal - a.metaTotal;
  });

  // 5. Renderizar filas en la tabla
  areaRows.forEach(item => {
    const pFormatted = item.percent.toFixed(1);
    let pBadgeClass = 'badge-danger';
    if (item.percent >= 50) pBadgeClass = 'badge-success';
    else if (item.percent >= 15) pBadgeClass = 'badge-warning';

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 area-table-row";
    tr.dataset.text = `${item.estado} ${item.area} ${item.area === 'TOLUCA' ? 'mexico edomex' : ''}`.toLowerCase();
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-bold text-slate-800">${item.estado}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-700">${item.area}</td>
      <td class="py-2.5 px-3 text-right text-slate-500">${item.metaCajas.toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right font-black text-cyan-600">${item.cajasDone.toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right text-slate-500">${item.metaCasetas.toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right font-black text-indigo-600">${item.casetasDone.toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right font-bold text-slate-800">${item.metaTotal.toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right font-black text-telmex text-sm">${item.totalDone.toLocaleString()}</td>
      <td class="py-2.5 px-4 text-center">
        <span class="badge ${pBadgeClass}">${pFormatted}%</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 6. Top 10 áreas para la gráfica
  const top10 = areaRows.slice(0, 10);
  renderChartAreas(top10);
}

function filterAreaTable() {
  const query = document.getElementById("searchAreaTableInput").value.trim().toLowerCase();
  document.querySelectorAll(".area-table-row").forEach(row => {
    const txt = row.dataset.text || '';
    row.style.display = txt.includes(query) ? "" : "none";
  });
}

function renderChartAreas(topAreas) {
  const ctx = document.getElementById("chartAreas");
  if (!ctx) return;

  if (state.charts.areas) {
    state.charts.areas.destroy();
  }

  const labels = topAreas.map(a => `${a.area} (${a.estado.substring(0,3)})`);
  const doneData = topAreas.map(a => a.totalDone);
  const metaData = topAreas.map(a => a.metaTotal);

  state.charts.areas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Intervenidos',
          data: doneData,
          backgroundColor: '#0055a5',
          borderRadius: 4
        },
        {
          label: 'Meta Total',
          data: metaData,
          backgroundColor: '#cbd5e1',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// =========================================================
// PESTAÑA 3: AVANCE POR FECHAS & TENDENCIAS
// =========================================================
function renderFechasTab() {
  const filtered = state.filteredRecords;

  // Agrupar por fecha
  const datesMap = {};
  filtered.forEach(r => {
    if (!r.fecha) return;
    if (!datesMap[r.fecha]) {
      datesMap[r.fecha] = { cajas: 0, casetas: 0, total: 0 };
    }
    if (r.tipo === 'CASETA') datesMap[r.fecha].casetas++;
    else datesMap[r.fecha].cajas++;
    datesMap[r.fecha].total++;
  });

  const sortedDates = Object.keys(datesMap).sort();
  const cajasData = [];
  const casetasData = [];
  const acumuladoData = [];
  let runningSum = 0;

  sortedDates.forEach(d => {
    const count = datesMap[d].total;
    runningSum += count;
    cajasData.push(datesMap[d].cajas);
    casetasData.push(datesMap[d].casetas);
    acumuladoData.push(runningSum);
  });

  // Renderizar Gráfica de Tendencia
  renderChartTrend(sortedDates, cajasData, casetasData, acumuladoData);

  // Doughnut de Proporción Cajas vs Casetas
  const totalCajas = filtered.filter(r => r.tipo === 'CAJA').length;
  const totalCasetas = filtered.filter(r => r.tipo === 'CASETA').length;
  renderChartDoughnut(totalCajas, totalCasetas);

  // Promedio Diario
  const activeDays = Math.max(1, sortedDates.length);
  const avgPace = Math.round(filtered.length / activeDays);
  
  const avgLabel = document.getElementById("avgTrendLabel");
  if (avgLabel) avgLabel.innerText = `${avgPace} activos/día`;
}

function renderChartTrend(dates, cajas, casetas, acumulado) {
  const ctx = document.getElementById("chartTrend");
  if (!ctx) return;

  if (state.charts.trend) {
    state.charts.trend.destroy();
  }

  state.charts.trend = new Chart(ctx, {
    data: {
      labels: dates,
      datasets: [
        {
          type: 'line',
          label: 'Avance Acumulado',
          data: acumulado,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          type: 'bar',
          label: 'Cajas por Día',
          data: cajas,
          backgroundColor: '#06b6d4',
          borderRadius: 3,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Casetas por Día',
          data: casetas,
          backgroundColor: '#6366f1',
          borderRadius: 3,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Registros Diarios' }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Acumulado' }
        }
      }
    }
  });
}

function renderChartDoughnut(cajas, casetas) {
  const ctx = document.getElementById("chartTypesDoughnut");
  if (!ctx) return;

  document.getElementById("donutCajasCount").innerText = cajas.toLocaleString();
  document.getElementById("donutCasetasCount").innerText = casetas.toLocaleString();

  if (state.charts.doughnut) {
    state.charts.doughnut.destroy();
  }

  state.charts.doughnut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cajas', 'Casetas'],
      datasets: [{
        data: [cajas, casetas],
        backgroundColor: ['#06b6d4', '#6366f1'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      cutout: '65%'
    }
  });
}

// =========================================================
// PESTAÑA 4: DETALLE DE REGISTROS (TABLA CON PAGINACIÓN)
// =========================================================
function renderRecordsTable() {
  const filtered = state.filteredRecords;
  const tbody = document.getElementById("recordsTableBody");
  tbody.innerHTML = "";

  document.getElementById("filteredRecordsBadge").innerText = `${filtered.length.toLocaleString()} registros`;

  const total = filtered.length;
  const totalPages = Math.ceil(total / state.pageSize) || 1;
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, total);
  const pageItems = filtered.slice(start, end);

  document.getElementById("recordsPaginationInfo").innerText = `Mostrando ${total > 0 ? (start + 1) : 0} - ${end} de ${total.toLocaleString()}`;
  document.getElementById("btnPrevPage").disabled = (state.currentPage <= 1);
  document.getElementById("btnNextPage").disabled = (state.currentPage >= totalPages);

  pageItems.forEach(r => {
    const isCaseta = (r.tipo === 'CASETA');
    const badgeColor = isCaseta ? 'bg-indigo-50 text-indigo-700' : 'bg-cyan-50 text-cyan-700';

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 record-row";
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-bold text-slate-800 font-mono text-[11px]">${r.folio || 'N/A'}</td>
      <td class="py-2.5 px-3 text-slate-600">${r.fecha || 'N/A'} <span class="text-[10px] text-slate-400 font-mono">${r.hora || ''}</span> ${r.fecha_captura && r.fecha_captura !== r.fecha ? `<span class="ml-1 text-[9px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded" title="Captura: ${r.fecha_captura} ${r.hora} (después de las 10 PM) -> Contabilizado en ciclo ${r.fecha}">Corte +1</span>` : ''}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">
          ${isCaseta ? '📞 CASETA' : '📦 CAJA'}
        </span>
      </td>
      <td class="py-2.5 px-3 font-bold text-telmex font-mono">${r.identificador || 'S/ID'}</td>
      <td class="py-2.5 px-3 text-slate-700 font-medium">${r.modelo || 'Sencilla'}</td>
      <td class="py-2.5 px-3 text-slate-600">${r.estado || 'N/A'}</td>
      <td class="py-2.5 px-3 text-slate-600">${r.area_trabajo || 'N/A'}</td>
      <td class="py-2.5 px-3 text-slate-700">${r.contratista || 'Sin Contratista'}</td>
      <td class="py-2.5 px-3 text-slate-700 font-medium">${r.tecnico || 'N/A'}</td>
      <td class="py-2.5 px-4 text-center">
        <span class="badge badge-success">✓ ${r.estatus || 'Aprobada'}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function changeRecordsPage(delta) {
  state.currentPage += delta;
  renderRecordsTable();
}

function filterRecordsTable() {
  const queryEl = document.getElementById("searchRecordsInput");
  const query = queryEl ? queryEl.value.trim().toLowerCase() : "";
  const tecEl = document.getElementById("filterRecordsTecnico");
  const selectedTecnico = tecEl ? tecEl.value.trim().toLowerCase() : "";

  // Base filtrada según filtros globales de área, fechas y tipo
  const arEl = document.getElementById("filterArea");
  const arVal = arEl ? arEl.value.trim().toUpperCase() : "";
  const tipoEl = document.getElementById("filterTipo");
  const tipoVal = tipoEl ? tipoEl.value.trim().toUpperCase() : "";
  const presetEl = document.getElementById("filterPresetDate");
  const presetVal = presetEl ? presetEl.value : "all";

  let minDate = null;
  let maxDate = null;
  const today = new Date();
  if (presetVal === "today") {
    minDate = getLocalDateStr(today);
    maxDate = minDate;
  } else if (presetVal === "7days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    minDate = getLocalDateStr(d);
    maxDate = getLocalDateStr(today);
  } else if (presetVal === "30days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    minDate = getLocalDateStr(d);
    maxDate = getLocalDateStr(today);
  } else if (presetVal === "custom") {
    minDate = document.getElementById("customDateFrom") ? document.getElementById("customDateFrom").value || null : null;
    maxDate = document.getElementById("customDateTo") ? document.getElementById("customDateTo").value || null : null;
  }

  const cutoffInfo = getCutoffInfo();
  if (presetVal === "today") {
    minDate = cutoffInfo.activeReportingDate;
    maxDate = minDate;
  }

  state.filteredRecords = (state.records || []).filter(r => {
    if (arVal && !recordMatchesArea(r, arVal)) return false;
    if (tipoVal && r.tipo && r.tipo.toUpperCase() !== tipoVal) return false;
    if (cutoffInfo.isFrozen && isRecordAfterCutoff(r, cutoffInfo)) return false;
    if (minDate && r.fecha && r.fecha < minDate) return false;
    if (maxDate && r.fecha && r.fecha > maxDate) return false;

    // Filtro específico por Técnico
    if (selectedTecnico) {
      const rTec = (r.tecnico || "").trim().toLowerCase();
      if (rTec !== selectedTecnico) return false;
    }

    // Filtro por búsqueda de texto
    if (query) {
      const match = (r.folio && r.folio.toLowerCase().includes(query)) ||
                    (r.identificador && r.identificador.toLowerCase().includes(query)) ||
                    (r.area_trabajo && r.area_trabajo.toLowerCase().includes(query)) ||
                    (r.contratista && r.contratista.toLowerCase().includes(query)) ||
                    (r.tecnico && r.tecnico.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  state.currentPage = 1;
  renderRecordsTable();
}

function populateTecnicosFilter() {
  const tecnicoSelect = document.getElementById("filterRecordsTecnico");
  if (!tecnicoSelect) return;
  const currentVal = tecnicoSelect.value;
  tecnicoSelect.innerHTML = `<option value="">-- Todos los Técnicos --</option>`;

  const arEl = document.getElementById("filterArea");
  const arVal = arEl ? arEl.value.trim().toUpperCase() : "";

  // Extraer técnicos disponibles (respetando área si está seleccionada)
  const pool = (arVal && typeof recordMatchesArea === "function")
    ? (state.records || []).filter(r => recordMatchesArea(r, arVal))
    : (state.records || []);

  const tecnicos = Array.from(new Set(pool.map(r => (r.tecnico || "").trim()).filter(t => t && t !== "Sin Técnico" && t !== "N/A"))).sort();
  tecnicos.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.innerText = t;
    tecnicoSelect.appendChild(opt);
  });
  if (currentVal && tecnicos.includes(currentVal)) {
    tecnicoSelect.value = currentVal;
  }
}

// =========================================================
// CAMBIO DE PESTAÑAS (TABS)
// =========================================================
function switchTab(tabId) {
  if (tabId === "tab-gerencial") {
    const isAuth = sessionStorage.getItem("GERENCIAL_AUTH_OK") === "true";
    if (!isAuth) {
      openGerencialNipModal();
      return;
    }
  }

  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

  const targetContent = document.getElementById(tabId);
  if (targetContent) targetContent.classList.remove("hidden");

  // Activar botón
  const btns = Array.from(document.querySelectorAll(".tab-btn"));
  const clickedBtn = btns.find(b => {
    const onc = b.getAttribute("onclick") || "";
    return onc.includes(tabId) || 
           (tabId === "tab-gerencial" && (onc.includes("openGerencialModule") || onc.includes("tab-gerencial"))) ||
           (tabId === "tab-pagos" && (onc.includes("openPagosModule") || onc.includes("tab-pagos")));
  });
  if (clickedBtn) clickedBtn.classList.add("active");

  // Redimensionar gráficas de Chart.js al cambiar de pestaña
  setTimeout(() => {
    Object.values(state.charts).forEach(c => {
      if (c && typeof c.resize === 'function') c.resize();
    });
  }, 100);
}

// =========================================================
// MODAL: CONFIGURAR MATERIALES
// =========================================================
function openMaterialsModal() {
  const modal = document.getElementById("materialsModal");
  if (!modal) return;
  renderMaterialsConfigTable();
  modal.classList.remove("hidden");
}

function closeMaterialsModal() {
  const modal = document.getElementById("materialsModal");
  if (modal) modal.classList.add("hidden");
}

function renderMaterialsConfigTable() {
  const tbody = document.getElementById("materialsConfigTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.config.materiales.forEach((mat, idx) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-2 px-3 font-bold text-slate-800 flex items-center gap-1.5">
        <span>${mat.icono || '📦'}</span>
        <span>${mat.nombre}</span>
      </td>
      <td class="py-2 px-2 text-slate-500 font-semibold">${mat.unidad}</td>
      <td class="py-2 px-2 text-right">
        <input type="number" step="any" id="mat_sum_${idx}" value="${mat.suministrado}" class="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-telmex font-semibold">
      </td>
      <td class="py-2 px-2 text-right">
        <input type="number" step="any" id="mat_caja_${idx}" value="${mat.consumo_por_caja}" class="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-telmex">
      </td>
      <td class="py-2 px-2 text-right">
        <input type="number" step="any" id="mat_caseta_${idx}" value="${mat.consumo_por_caseta}" class="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-telmex">
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveMaterialsConfig() {
  state.config.materiales.forEach((mat, idx) => {
    const sumEl = document.getElementById(`mat_sum_${idx}`);
    const cajaEl = document.getElementById(`mat_caja_${idx}`);
    const casetaEl = document.getElementById(`mat_caseta_${idx}`);
    
    if (sumEl) mat.suministrado = Number(sumEl.value) || 0;
    if (cajaEl) mat.consumo_por_caja = Number(cajaEl.value) || 0;
    if (casetaEl) mat.consumo_por_caseta = Number(casetaEl.value) || 0;
  });

  localStorage.setItem("telmex_dashboard_config", JSON.stringify(state.config));
  closeMaterialsModal();
  applyFilters();
  alert("✅ Configuración de materiales guardada correctamente.");
}

function resetDefaultMaterialsConfig() {
  if (confirm("¿Deseas restaurar la receta y stock de materiales a los valores predeterminados?")) {
    state.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localStorage.removeItem("telmex_dashboard_config");
    renderMaterialsConfigTable();
    applyFilters();
  }
}

// =========================================================
// SISTEMA DE NOTIFICACIONES TOAST (FEEDBACK VISUAL)
// =========================================================
let toastTimer = null;
function showToast(message, type = "info", duration = 4500) {
  const toast = document.getElementById("systemToast");
  const msgEl = document.getElementById("systemToastMsg");
  const iconEl = document.getElementById("systemToastIcon");
  if (!toast || !msgEl) return;

  if (toastTimer) clearTimeout(toastTimer);

  msgEl.innerHTML = message;

  // Clases base y estilos por tipo
  toast.className = "fixed top-5 right-5 z-50 transform transition-all duration-300 max-w-md text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border pointer-events-auto ";
  if (type === "success") {
    toast.className += "bg-emerald-900/95 border-emerald-500 shadow-emerald-950/40";
    if (iconEl) iconEl.innerText = "✅";
  } else if (type === "error") {
    toast.className += "bg-rose-900/95 border-rose-500 shadow-rose-950/40";
    if (iconEl) iconEl.innerText = "⚠️";
  } else if (type === "warning") {
    toast.className += "bg-amber-900/95 border-amber-500 shadow-amber-950/40";
    if (iconEl) iconEl.innerText = "⚡";
  } else {
    toast.className += "bg-slate-900/95 border-slate-700 shadow-slate-950/40";
    if (iconEl) iconEl.innerText = "🔄";
  }

  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-[-12px]", "pointer-events-none");
    toast.classList.add("opacity-100", "translate-y-0");
  });

  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toast.classList.remove("opacity-100", "translate-y-0");
      toast.classList.add("opacity-0", "translate-y-[-12px]", "pointer-events-none");
    }, duration);
  }
}

// =========================================================
// SINCRONIZACIÓN LINKAFORM DIRECTA (SIN VENTANA DE VALIDACIÓN)
// =========================================================
function openSyncModal() {
  triggerLinkaformSync();
}

function closeSyncModal() {
  // Modal eliminado por directiva de privacidad y automatización
}

async function triggerLinkaformSync() {
  const btn = document.getElementById("btnSyncLinkaform");
  const syncIcon = document.getElementById("syncIcon");
  const syncText = document.getElementById("syncText");

  // Estado visual del botón durante la sincronización
  if (btn) btn.disabled = true;
  if (syncIcon) syncIcon.className = "inline-block animate-spin";
  if (syncText) syncText.innerText = "Actualizando...";

  showToast("🔄 Actualizando datos en vivo con Linkaform...", "info", 2000);

  try {
    // Paso 1: Si estamos en localhost y el bridge local está activo, intentar sincronización local (timeout 3s)
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      try {
        const localCtrl = new AbortController();
        const localTimeout = setTimeout(() => localCtrl.abort(), 3000);
        const localResp = await fetch("http://127.0.0.1:8765/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: localCtrl.signal
        });
        clearTimeout(localTimeout);
        if (localResp.ok) {
          const res = await localResp.json();
          if (res.success && Array.isArray(res.records) && res.records.length > 0) {
            state.records = res.records;
          }
        }
      } catch (e) {
        console.log("Bridge local no disponible, recargando directamente desde servidor web.");
      }
    }

    // Paso 2: Recargar directamente el script de datos en vivo con cache-buster
    await reloadLiveDataScript();
    state.records = []; // Forzar refresco
    checkAndMigrateLiveData();
    loadRecords();
    loadMaterialsLog();
    recalculateSuministrosFromMaterialsLog();
    
    const nowStr = new Date().toLocaleString("es-MX");
    safeSetStorage("telmex_dashboard_last_sync", nowStr);
    populateAreaFilter();
    populateContratistasFilter();
  populateTecnicosFilter();
    applyFilters();
    renderMaterialsTab();
    renderMaterialsLogTable();
    updateSyncLabel();

    const totalActual = (state.records && state.records.length) ? state.records.length : (state.totalRawRecordsCount || 0);
    showToast(`✅ Dashboard actualizado exitosamente: ${totalActual} trabajos en vivo.`, "success", 4000);
  } catch (err) {
    console.error("Error al actualizar datos:", err);
    showToast("⚠️ Datos actualizados desde caché en vivo.", "warning", 3000);
  } finally {
    // Garantizar SIEMPRE que el botón se desbloquea y el texto vuelve a la normalidad
    if (btn) btn.disabled = false;
    if (syncIcon) syncIcon.className = "inline-block";
    if (syncText) syncText.innerText = "Sincronizar Linkaform";
  }
}

function reloadLiveDataScript() {
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="linkaform_live_data.js"]');
    if (existing) existing.remove();
    const s = document.createElement("script");
    s.src = `data/linkaform_live_data.js?v=${Date.now()}`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

// =========================================================
// MODAL: IMPORTAR ARCHIVO (EXCEL / JSON)
// =========================================================
function openImportModal() {
  document.getElementById("importModal").classList.remove("hidden");
  document.getElementById("fileImportStatus").classList.add("hidden");
}

function closeImportModal() {
  document.getElementById("importModal").classList.add("hidden");
}

function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("fileImportStatus");
  statusEl.className = "mt-3 p-3 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 block";
  statusEl.innerText = `Procesando archivo: ${file.name}...`;

  const reader = new FileReader();

  if (file.name.endsWith(".json")) {
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (Array.isArray(json)) {
          state.records = json;
          saveAndRefreshImportedRecords(file.name, json.length);
        } else {
          throw new Error("El archivo JSON debe contener un arreglo de registros.");
        }
      } catch (err) {
        statusEl.className = "mt-3 p-3 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800 block";
        statusEl.innerText = `Error al leer JSON: ${err.message}`;
      }
    };
    reader.readAsText(file);
  } else {
    // Archivo Excel (.xlsx / .xls)
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (rawJson.length === 0) {
          throw new Error("La hoja de cálculo está vacía.");
        }

        const firstRow = rawJson[0] || {};
        const isMaterialsSheet = ("Descripcion" in firstRow || "descripcion" in firstRow || "Cantidad" in firstRow || "cantidad" in firstRow) && !("Tipo" in firstRow || "tipo" in firstRow || "identificador" in firstRow);

        if (isMaterialsSheet) {
          state.materialsLog = rawJson.map(r => ({
            id: r["Folio"] || r["folio"] || r["ID"] || "",
            area: (r["Area"] || r["area"] || r["Área"] || "GENERAL").toUpperCase(),
            descripcion: (r["Descripcion"] || r["descripcion"] || r["Descripción"] || "MATERIAL").toUpperCase(),
            cantidad: parseFloat(r["Cantidad"] || r["cantidad"] || 0),
            unidad: (r["Unidad"] || r["unidad"] || r["Título de la pregunta"] || "PZAS.").toUpperCase(),
            fecha: r["Fecha"] || r["fecha"] || "",
            foto: r["Evidencia Fotografica"] || r["Foto"] || ""
          }));

          localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
          recalculateSuministrosFromMaterialsLog();
          renderMaterialsTab();
          renderMaterialsLogTable();
          saveAndRefreshImportedRecords(file.name, state.materialsLog.length, "entregas de materiales (Forma 184350)");
          return;
        }

        // Mapeo flexible de columnas para evidencias (Forma 142786)
        const mapped = rawJson.map((r, i) => {
          return {
            folio: r["Folio"] || r["folio"] || r["ID"] || `LF-${i + 1}`,
            fecha: r["Fecha"] || r["fecha"] || r["created_at"] || getLocalDateStr(),
            hora: r["Hora"] || r["hora"] || "",
            tipo: (r["Tipo"] || r["tipo"] || r["TIPO"] || "CAJA").toUpperCase(),
            identificador: r["Identificador"] || r["identificador"] || r["DISTRITO / TELEFONO"] || "S/ID",
            modelo: r["Modelo"] || r["modelo"] || "Sencilla",
            estado: (r["Estado"] || r["estado"] || r["ESTADO"] || "GUANAJUATO").toUpperCase(),
            area_trabajo: (r["Área"] || r["Area"] || r["area_trabajo"] || r["AREA TRABAJO"] || "CELAYA").toUpperCase(),
            contratista: r["Contratista"] || r["contratista"] || "Lucina Villanueva Hernández",
            estatus: r["Estatus"] || r["estatus"] || "Aprobada"
          };
        });

        state.records = mapped;
        saveAndRefreshImportedRecords(file.name, mapped.length, "trabajos de campo");

      } catch (err) {
        statusEl.className = "mt-3 p-3 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800 block";
        statusEl.innerText = `Error al procesar Excel: ${err.message}`;
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function saveAndRefreshImportedRecords(fileName, count, typeLabel = "registros") {
  safeSetStorage("telmex_dashboard_records", state.records);
  safeSetStorage("telmex_dashboard_last_sync", `Archivo: ${fileName} (${new Date().toLocaleTimeString("es-MX")})`);
  
  const statusEl = document.getElementById("fileImportStatus");
  statusEl.className = "mt-3 p-3 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 block";
  statusEl.innerText = `✅ ¡Éxito! Se cargaron ${count.toLocaleString()} ${typeLabel} correctamente.`;

  updateSyncLabel();
  populateAreaFilter();
  populateContratistasFilter();
  populateTecnicosFilter();
  applyFilters();
}

function restoreDefaultRecords() {
  const choice = confirm("¿Deseas restaurar los datos en vivo oficiales de Linkaform?\n\nPresiona Aceptar para restaurar los datos oficiales de Linkaform.");
  if (choice) {
    state.records = (typeof LINKAFORM_LIVE_RECORDS !== "undefined") ? LINKAFORM_LIVE_RECORDS : ((typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : []);
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") 
      ? LINKAFORM_LIVE_MATERIALS.map(m => ({ ...m, descripcion: normalizeMaterialName(m.descripcion) })) 
      : [];
    safeRemoveStorage("telmex_dashboard_records");
    safeRemoveStorage("telmex_dashboard_raw_records");
    safeRemoveStorage("telmex_dashboard_materials_log");
    safeSetStorage("telmex_dashboard_last_sync", "Datos oficiales Linkaform restaurados");
    recalculateSuministrosFromMaterialsLog();
    updateSyncLabel();
    populateAreaFilter();
    populateContratistasFilter();
  populateTecnicosFilter();
    applyFilters();
    renderMaterialsLogTable();
    closeImportModal();
    alert("✅ Datos oficiales de Linkaform restaurados correctamente.");
  }
}

// =========================================================
// EXPORTACIÓN A EXCEL
// =========================================================
function exportDataToExcel() {
  if (typeof XLSX === "undefined") {
    alert("La librería de exportación a Excel aún se está cargando. Intenta en unos segundos.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // Hoja 1: Matriz de Balance de Materiales por Plaza Operativa
  const matrixRows = [];
  const areaSet = new Set();
  (state.materialsLog || []).forEach(m => {
    if (m.area) areaSet.add(m.area.toUpperCase().trim());
  });
  (state.records || []).forEach(r => {
    if (r.area_trabajo) areaSet.add(r.area_trabajo.toUpperCase().trim());
  });

  const areas = Array.from(areaSet).sort();

  const sumByAreaMat = {};
  (state.materialsLog || []).forEach(m => {
    const area = (m.area || "GENERAL").toUpperCase().trim();
    const matId = mapMaterialDescToId(m.descripcion);
    const qty = parseFloat(m.cantidad) || 0;
    if (!sumByAreaMat[area]) sumByAreaMat[area] = {};
    sumByAreaMat[area][matId] = (sumByAreaMat[area][matId] || 0) + qty;
  });

  const conByAreaMat = {};
  (state.records || []).forEach(r => {
    const area = (r.area_trabajo || "GENERAL").toUpperCase().trim();
    const matId = mapRecordToMaterialId(r);
    const viniles = getRecordVinilCount(r);
    if (!conByAreaMat[area]) conByAreaMat[area] = {};
    conByAreaMat[area][matId] = (conByAreaMat[area][matId] || 0) + viniles;
  });

  areas.forEach(area => {
    const metas = getAreaMetas(area);
    const cajasMeta = metas.cajas || 0;
    const casetasMeta = metas.casetas || 0;

    const activeMatIds = new Set();
    if (sumByAreaMat[area]) {
      Object.keys(sumByAreaMat[area]).forEach(id => activeMatIds.add(id));
    }
    if (conByAreaMat[area]) {
      Object.keys(conByAreaMat[area]).forEach(id => activeMatIds.add(id));
    }

    activeMatIds.forEach(matId => {
      const mat = state.config.materiales.find(m => m.id === matId) || {
        id: matId,
        nombre: matId.replace(/_/g, " ").toUpperCase(),
        unidad: "Pzas",
        consumo_por_caja: 0.1,
        consumo_por_caseta: 1.0
      };

      const suministrado = (sumByAreaMat[area] && sumByAreaMat[area][matId]) || 0;
      const consumido = (conByAreaMat[area] && conByAreaMat[area][matId]) || 0;
      const queda = Math.max(0, suministrado - consumido);
      const metaReq = Math.round((cajasMeta * (mat.consumo_por_caja || 0)) + (casetasMeta * (mat.consumo_por_caseta || 0)));
      const falta = Math.max(0, metaReq - suministrado);

      matrixRows.push({
        "Plaza / Área": area,
        "Material": mat.nombre,
        "Unidad": mat.unidad,
        "Suministrado (Entradas)": suministrado,
        "Viniles Instalados (Consumo Real)": consumido,
        "Stock Disponible (Sobran / Queda)": queda,
        "Meta Requerida Área": metaReq,
        "Faltante por Surtir": falta,
        "Estado": suministrado === 0 && consumido > 0 ? "Sin Suministro" : (queda <= 20 ? "Stock Bajo" : "Abastecido")
      });
    });
  });

  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Inventario por Plaza");

  // Hoja 2: Bitácora de Suministros (Forma 184350)
  const logRows = (state.materialsLog || []).map(m => ({
    "Folio": m.id,
    "Fecha": m.fecha,
    "Plaza / Área": m.area,
    "Material": m.descripcion,
    "Cantidad": m.cantidad,
    "Unidad": m.unidad,
    "Enlace Foto": m.foto || "Sin Foto"
  }));
  const wsLog = XLSX.utils.json_to_sheet(logRows);
  XLSX.utils.book_append_sheet(wb, wsLog, "Entradas de Material");

  // Hoja 3: Trabajos de Campo (Forma 142786)
  const recordsRows = (state.filteredRecords || []).map(r => ({
    "Folio": r.folio,
    "Fecha": r.fecha,
    "Hora": r.hora,
    "Plaza / Área": r.area_trabajo,
    "Estado": r.estado,
    "Tipo": r.tipo,
    "Identificador": r.identificador,
    "Modelo": r.modelo,
    "Viniles Instalados": r.num_viniles !== undefined ? r.num_viniles : (r.tipo === "CASETA" ? 2 : 1),
    "Contratista": r.contratista,
    "Técnico": r.tecnico || "Sin Técnico",
    "Estatus": r.estatus
  }));
  const wsRecords = XLSX.utils.json_to_sheet(recordsRows);
  XLSX.utils.book_append_sheet(wb, wsRecords, "Trabajos de Campo");

  // Descargar
  const dateStr = getLocalDateStr();
  XLSX.writeFile(wb, `Reporte_Materiales_Telmex_Por_Area_${dateStr}.xlsx`);
}

// Normalizar nombres de área para coincidencia con la plantilla de Excel
function normalizeAreaForExcel(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Obtener fecha YYYY-MM-DD sin desfase horario para encabezados de celdas de Excel (evita desfase UTC a UTC-6)
function getExcelHeaderDateStr(v) {
  if (!v) return "";
  if (v instanceof Date) {
    const year = v.getUTCFullYear();
    const month = String(v.getUTCMonth() + 1).padStart(2, '0');
    const day = String(v.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof v === "string" && v.includes("2026")) {
    return v.trim().substring(0, 10);
  }
  return "";
}

// Descargar Réplica Oficial del Reporte Diario de Casetas y Cajas (Generado con fórmulas y formatos íntegros)
async function exportReporteDiarioExcel() {
  const dateStr = getLocalDateStr();
  showToast("📊 Descargando Reporte Diario Oficial de Casetas y Cajas...", "info", 2000);

  try {
    const fileUrl = `data/Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx?v=${Date.now()}`;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `Reporte_diarios_Casetas_y_Cajas_Contratistas_2026_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("✅ ¡Reporte Diario Oficial descargado con éxito con todas sus fórmulas y formatos!", "success", 4000);
  } catch (err) {
    console.error("Error al descargar reporte diario:", err);
    showToast("❌ No se pudo descargar el Reporte Diario.", "error", 4000);
  }
}

// Descargar Réplica Oficial de Cantidades de Materiales Recibidos Actualizada
async function exportMaterialesRecibidosExcel() {
  const dateStr = getLocalDateStr();
  showToast("📦 Descargando Réplica Oficial de Cantidades de Materiales Recibidos...", "info", 2000);

  try {
    const fileUrl = `data/CANTIDADES_MATERIALES_RECIBIDOS_ACTUALIZADO.xlsx?v=${Date.now()}`;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `CANTIDADES_MATERIALES_RECIBIDOS_Actualizado_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("✅ ¡CANTIDADES MATERIALES RECIBIDOS descargado con éxito con datos en vivo!", "success", 4000);
  } catch (err) {
    console.error("Error al descargar materiales recibidos:", err);
    showToast("❌ No se pudo descargar el archivo de Materiales Recibidos.", "error", 4000);
  }
}

// Utilidad Formato de Números
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Math.round(num).toLocaleString("es-MX");
}




// =========================================================
// MÓDULO ESPECIAL DE VALIDACIÓN DE TRABAJOS Y PAGOS A CONTRATISTAS
// =========================================================

let pagosState = {
  tipo: "CAJA", // "CAJA" o "CASETA"
  tarifaCaja: 60.00,
  tarifaCaseta: 36.00,
  tarifaActiva: 60.00,
  selectedAreas: new Set(), // Nombres de áreas seleccionadas
  contratista: "TODOS",
  tecnico: "TODOS",
  presetDate: "TODO",
  dateStart: "",
  dateEnd: "",
  currentPage: 1,
  pageSize: 50
};

let pagosFilteredRecords = [];

function getPagosNip() {
  const stored = localStorage.getItem("TELMEX_PAGOS_NIP");
  // Si no está definido o sigue siendo el valor anterior "2026", actualiza al nuevo PIN por defecto "20262"
  if (!stored || stored === "2026") {
    localStorage.setItem("TELMEX_PAGOS_NIP", "20262");
    return "20262";
  }
  return stored;
}

function openPagosModule() {
  const isAuth = sessionStorage.getItem("PAGOS_AUTH_OK") === "true";
  if (isAuth) {
    switchTab("tab-pagos");
    initPagosModule();
  } else {
    const modal = document.getElementById("nipModal");
    const input = document.getElementById("nipInput");
    const err = document.getElementById("nipErrorMsg");
    if (err) err.classList.add("hidden");
    if (input) input.value = "";
    if (modal) modal.classList.remove("hidden");
    setTimeout(() => { if (input) input.focus(); }, 150);
  }
}

function closeNipModal() {
  const modal = document.getElementById("nipModal");
  if (modal) modal.classList.add("hidden");
}

function verifyNip() {
  const input = document.getElementById("nipInput");
  const err = document.getElementById("nipErrorMsg");
  const entered = (input?.value || "").trim();
  const correct = getPagosNip();

  if (entered === correct) {
    sessionStorage.setItem("PAGOS_AUTH_OK", "true");
    closeNipModal();
    switchTab("tab-pagos");
    initPagosModule();
    showToast("🔓 Sesión de Finanzas y Pagos Autorizada.", "success", 3000);
  } else {
    if (err) {
      err.innerText = "❌ NIP Incorrecto. Acceso denegado.";
      err.classList.remove("hidden");
    }
    if (input) {
      input.classList.add("border-rose-500");
      input.select();
      setTimeout(() => input.classList.remove("border-rose-500"), 1000);
    }
  }
}

function logoutPagos() {
  sessionStorage.removeItem("PAGOS_AUTH_OK");
  switchTab("tab-materiales");
  showToast("🔒 Módulo de Pagos Bloqueado.", "info", 2500);
}

function openChangeNipModal() {
  const modal = document.getElementById("changeNipModal");
  const err = document.getElementById("changeNipErrorMsg");
  if (err) err.classList.add("hidden");
  document.getElementById("inputCurrentNip").value = "";
  document.getElementById("inputNewNip").value = "";
  if (modal) modal.classList.remove("hidden");
}

function closeChangeNipModal() {
  const modal = document.getElementById("changeNipModal");
  if (modal) modal.classList.add("hidden");
}

function saveNewNip() {
  const currInput = document.getElementById("inputCurrentNip").value.trim();
  const newInput = document.getElementById("inputNewNip").value.trim();
  const err = document.getElementById("changeNipErrorMsg");

  if (currInput !== getPagosNip()) {
    err.innerText = "El NIP actual es incorrecto.";
    err.classList.remove("hidden");
    return;
  }

  if (newInput.length < 4 || newInput.length > 8) {
    err.innerText = "El nuevo NIP debe tener entre 4 y 8 dígitos.";
    err.classList.remove("hidden");
    return;
  }

  localStorage.setItem("TELMEX_PAGOS_NIP", newInput);
  closeChangeNipModal();
  showToast("✅ NIP de Pagos actualizado exitosamente.", "success", 3500);
}

// Inicializar el Módulo de Pagos

// =========================================================================
// GESTOR DE BITÁCORA DE PAGOS Y CONCILIACIONES (ANTI-DUPLICIDAD)
// =========================================================================
const STORAGE_KEY_PAGOS = "TELMEX_HISTORIAL_PAGOS_V1";

function getPagosRegistrados() {
  // 1. Cargar pagos oficiales centralizados desde GitHub (window.TELMEX_HISTORIAL_PAGOS)
  const fromGithub = (typeof window !== "undefined" && Array.isArray(window.TELMEX_HISTORIAL_PAGOS)) 
    ? window.TELMEX_HISTORIAL_PAGOS 
    : [];

  // 2. Cargar pagos locales del navegador (localStorage)
  let fromLocal = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAGOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) fromLocal = parsed;
    }
  } catch (e) {
    console.error("Error al cargar historial de pagos local:", e);
  }

  // 3. Fusionar ambas fuentes sin duplicados (clave única: folioPago o id)
  const map = new Map();
  // Primero los de GitHub
  fromGithub.forEach(p => {
    const k = p.folioPago || p.id;
    if (k) map.set(k, p);
  });
  // Luego los locales (que pueden tener pagos más recientes)
  fromLocal.forEach(p => {
    const k = p.folioPago || p.id;
    if (k) map.set(k, p);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.fecha || a.timestamp || 0).getTime();
    const tb = new Date(b.fecha || b.timestamp || 0).getTime();
    return tb - ta; // Más recientes primero
  });
}

// Token de GitHub para sincronización directa desde el navegador (opcional)
function getGitHubToken() {
  return localStorage.getItem("TELMEX_GITHUB_TOKEN") || "";
}

function setGitHubToken(token) {
  if (token) localStorage.setItem("TELMEX_GITHUB_TOKEN", token.trim());
  else localStorage.removeItem("TELMEX_GITHUB_TOKEN");
}

// Publicar historial directamente a GitHub mediante GitHub REST API
async function publicarHistorialEnGitHub() {
  const lista = getPagosRegistrados();
  let token = getGitHubToken();

  if (!token) {
    token = prompt("🔑 Para publicar directamente a GitHub Pages, ingresa tu GitHub Personal Access Token (PAT):\n\n(Se guardará en este navegador para futuras publicaciones)");
    if (!token) return;
    setGitHubToken(token);
  }

  showToast("☁️ Conectando con GitHub API para publicar pagos...", "info", 3000);

  const owner = "pahernandez-sys";
  const repo = "dashboard-imagen-telmex";
  const filePath = "data/historial_pagos.js";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  try {
    // 1. Obtener SHA actual del archivo si existe
    let currentSha = "";
    const getRes = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      currentSha = fileData.sha;
    } else if (getRes.status === 401 || getRes.status === 403) {
      localStorage.removeItem("TELMEX_GITHUB_TOKEN");
      showToast("❌ Token de GitHub inválido o sin permisos. Ingresa un token válido.", "error", 4000);
      return;
    }

    // 2. Preparar contenido del archivo en base64
    const jsContent = `/**\n * Bitácora Oficial de Pagos y Liquidaciones a Contratistas\n * Campaña Nacional Imagen Telmex 2026\n * Almacenamiento Centralizado en GitHub\n * Última sincronización: ${new Date().toISOString()}\n */\nwindow.TELMEX_HISTORIAL_PAGOS = ${JSON.stringify(lista, null, 2)};\n`;
    
    // Codificar a UTF-8 Base64
    const utf8Bytes = new TextEncoder().encode(jsContent);
    let binary = "";
    utf8Bytes.forEach(b => binary += String.fromCharCode(b));
    const base64Content = btoa(binary);

    // 3. Hacer PUT a GitHub
    const putBody = {
      message: `chore(pagos): sincronizar bitácora oficial de ${lista.length} pagos en GitHub`,
      content: base64Content,
      branch: "main"
    };
    if (currentSha) putBody.sha = currentSha;

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify(putBody)
    });

    if (putRes.status === 200 || putRes.status === 201) {
      // Actualizar variable en memoria
      window.TELMEX_HISTORIAL_PAGOS = lista;
      showToast(`✅ ¡Éxito! ${lista.length} pagos publicados y respaldados centralizadamente en GitHub.`, "success", 4500);
    } else {
      const errJson = await putRes.json().catch(() => ({}));
      showToast(`⚠️ Error al subir a GitHub (${putRes.status}): ${errJson.message || "Verifica permisos"}`, "warning", 4500);
    }
  } catch (err) {
    console.error("Error en publicarHistorialEnGitHub:", err);
    showToast(`❌ Error de conexión con GitHub: ${err.message}`, "error", 4000);
  }
}

function savePagosRegistrados(list) {
  try {
    localStorage.setItem(STORAGE_KEY_PAGOS, JSON.stringify(list));
  } catch (e) {
    console.error("Error al guardar historial de pagos:", e);
  }
}

// Retorna el total de piezas pagadas acumuladas para tipo, área y contratista
function getPiezasPagadasAcumuladas(tipo, area, contratista) {
  const lista = getPagosRegistrados();
  const areaNorm = (area || "").trim().toUpperCase();
  const conNorm = (contratista || "").trim();

  return lista.reduce((acc, p) => {
    if (p.tipo !== tipo) return acc;
    if (areaNorm && areaNorm !== "TODAS" && areaNorm !== "TODOS" && p.area.toUpperCase() !== areaNorm) return acc;
    if (conNorm && conNorm !== "TODOS" && p.contratista !== conNorm) return acc;
    return acc + (Number(p.piezasPagadasHoy) || 0);
  }, 0);
}

// Retorna el total de piezas realizadas en Linkaform para tipo, área y contratista
function getPiezasRealizadasTotal(tipo, area, contratista) {
  const allRecords = state.records || [];
  const areaNorm = (area || "").trim().toUpperCase();
  const conNorm = (contratista || "").trim();

  return allRecords.reduce((acc, r) => {
    if (r.tipo !== tipo) return acc;
    if (areaNorm && areaNorm !== "TODAS" && areaNorm !== "TODOS") {
      const a = (r.area_trabajo || "").trim().toUpperCase();
      if (a !== areaNorm) return acc;
    }
    if (conNorm && conNorm !== "TODOS") {
      const c = (r.contratista_homologado || r.contratista || "").trim();
      if (c !== conNorm) return acc;
    }
    return acc + 1;
  }, 0);
}

// -------------------------------------------------------------------------
// MODAL DE REGISTRO DE PAGO
// -------------------------------------------------------------------------
function openRegistrarPagoModal(preselectedArea, preselectedContratista) {
  const modal = document.getElementById("modalRegistrarPago");
  if (!modal) return;

  const tipo = pagosState.tipo;
  const tarifa = pagosState.tarifaActiva;

  // Badge de Tipo
  const badgeTipo = document.getElementById("modalPagoTipoBadge");
  if (badgeTipo) {
    badgeTipo.innerText = `${tipo === "CASETA" ? "📞 CASETA" : "📦 CAJA"} ($${tarifa.toFixed(2)} MXN)`;
    badgeTipo.className = tipo === "CASETA" 
      ? "p-2 rounded-lg font-bold text-center border text-xs bg-amber-50 text-amber-900 border-amber-300"
      : "p-2 rounded-lg font-bold text-center border text-xs bg-blue-50 text-blue-900 border-blue-300";
  }

  const lblTarifa = document.getElementById("modalPagoTarifaLabel");
  if (lblTarifa) lblTarifa.innerText = `$${tarifa.toFixed(2)} MXN`;

  // Fecha de hoy por defecto
  const inputFecha = document.getElementById("modalPagoFecha");
  if (inputFecha) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    inputFecha.value = `${yyyy}-${mm}-${dd}`;
  }

  // Poblar Áreas
  const selArea = document.getElementById("modalPagoSelectArea");
  if (selArea) {
    const areas = getAvailableAreasForTipo(tipo);
    selArea.innerHTML = "";
    areas.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.innerText = a;
      selArea.appendChild(opt);
    });

    if (preselectedArea && areas.includes(preselectedArea.toUpperCase())) {
      selArea.value = preselectedArea.toUpperCase();
    } else if (pagosState.selectedAreas.size === 1) {
      selArea.value = Array.from(pagosState.selectedAreas)[0];
    } else if (areas.length > 0) {
      selArea.value = areas[0];
    }
  }

  // Poblar Contratistas para esa área
  actualizarContratistasEnModal(preselectedContratista);

  // Recalcular saldo y disponibles
  onModalPagoAreaOrConChange();

  modal.classList.remove("hidden");
}

function closeRegistrarPagoModal() {
  const modal = document.getElementById("modalRegistrarPago");
  if (modal) modal.classList.add("hidden");
}

function actualizarContratistasEnModal(preselectedContratista) {
  const tipo = pagosState.tipo;
  const selArea = document.getElementById("modalPagoSelectArea");
  const selCon = document.getElementById("modalPagoSelectContratista");
  if (!selArea || !selCon) return;

  const currentArea = selArea.value;
  const records = state.records || [];
  const conSet = new Set();

  records.forEach(r => {
    if (r.tipo === tipo) {
      const a = (r.area_trabajo || "").trim().toUpperCase();
      if (!currentArea || a === currentArea) {
        const c = (r.contratista_homologado || r.contratista || "").trim();
        if (c && c !== "Directo") conSet.add(c);
      }
    }
  });

  const sortedCon = Array.from(conSet).sort();
  selCon.innerHTML = "";
  if (sortedCon.length === 0) {
    selCon.innerHTML = '<option value="">Sin contratistas con trabajos</option>';
  } else {
    sortedCon.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.innerText = c;
      selCon.appendChild(opt);
    });
  }

  if (preselectedContratista && conSet.has(preselectedContratista)) {
    selCon.value = preselectedContratista;
  } else if (pagosState.contratista !== "TODOS" && conSet.has(pagosState.contratista)) {
    selCon.value = pagosState.contratista;
  } else if (sortedCon.length > 0) {
    selCon.value = sortedCon[0];
  }
}

function onModalPagoAreaOrConChange() {
  const tipo = pagosState.tipo;
  const selArea = document.getElementById("modalPagoSelectArea");
  const selCon = document.getElementById("modalPagoSelectContratista");
  if (!selArea || !selCon) return;

  const area = selArea.value;
  const contratista = selCon.value;

  const hechas = getPiezasRealizadasTotal(tipo, area, contratista);
  const pagadasPrevias = getPiezasPagadasAcumuladas(tipo, area, contratista);
  const disponibles = Math.max(0, hechas - pagadasPrevias);

  const elHechas = document.getElementById("modalPagoRealizadasCount");
  const elPrevias = document.getElementById("modalPagoPagadasPreviasCount");
  const elDisp = document.getElementById("modalPagoDisponiblesCount");

  if (elHechas) elHechas.innerText = formatNumber(hechas);
  if (elPrevias) elPrevias.innerText = formatNumber(pagadasPrevias);
  if (elDisp) elDisp.innerText = formatNumber(disponibles);

  const inputPiezas = document.getElementById("modalPagoInputPiezas");
  if (inputPiezas) {
    inputPiezas.max = disponibles > 0 ? disponibles : 1;
    inputPiezas.value = disponibles;
  }

  onModalPagoPiezasInput();
}

function onModalPagoPiezasInput() {
  const inputPiezas = document.getElementById("modalPagoInputPiezas");
  const montoEl = document.getElementById("modalPagoMontoCalculado");
  const remanenteEl = document.getElementById("modalPagoRemanenteInfo");
  const elDisp = document.getElementById("modalPagoDisponiblesCount");

  const piezasAPagar = parseInt(inputPiezas?.value, 10) || 0;
  const tarifa = pagosState.tarifaActiva;
  const disponibles = parseInt(elDisp?.innerText?.replace(/,/g, ""), 10) || 0;

  const totalDinero = piezasAPagar * tarifa;
  if (montoEl) montoEl.innerText = formatMoney(totalDinero);

  const remanente = disponibles - piezasAPagar;
  if (remanenteEl) {
    if (remanente > 0) {
      remanenteEl.className = "text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 mt-1";
      remanenteEl.innerText = `Quedan ${formatNumber(remanente)} piezas pendientes ($${formatMoney(remanente * tarifa)}) para el próximo pago.`;
    } else if (remanente === 0) {
      remanenteEl.className = "text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 mt-1";
      remanenteEl.innerText = `✅ Liquidación total completa (0 piezas pendientes).`;
    } else {
      remanenteEl.className = "text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 mt-1";
      remanenteEl.innerText = `⚠️ Atención: Estás pagando ${formatNumber(piezasAPagar)}, superando las ${formatNumber(disponibles)} piezas validadas en Linkaform.`;
    }
  }
}

function confirmarRegistroPago() {
  const tipo = pagosState.tipo;
  const tarifa = pagosState.tarifaActiva;
  const selArea = document.getElementById("modalPagoSelectArea");
  const selCon = document.getElementById("modalPagoSelectContratista");
  const inputPiezas = document.getElementById("modalPagoInputPiezas");
  const inputFecha = document.getElementById("modalPagoFecha");
  const inputFactura = document.getElementById("modalPagoFactura");
  const selMetodo = document.getElementById("modalPagoMetodo");
  const inputAutorizo = document.getElementById("modalPagoAutorizo");
  const inputNotas = document.getElementById("modalPagoNotas");

  const area = selArea?.value || "";
  const contratista = selCon?.value || "";
  const piezas = parseInt(inputPiezas?.value, 10) || 0;
  const fecha = inputFecha?.value || new Date().toISOString().split("T")[0];

  if (!area) {
    showToast("⚠️ Debes seleccionar una plaza.", "warning", 3000);
    return;
  }
  if (!contratista) {
    showToast("⚠️ Debes seleccionar un contratista.", "warning", 3000);
    return;
  }
  if (piezas <= 0) {
    showToast("⚠️ La cantidad de piezas a pagar debe ser mayor a 0.", "warning", 3000);
    return;
  }

  const hechas = getPiezasRealizadasTotal(tipo, area, contratista);
  const previas = getPiezasPagadasAcumuladas(tipo, area, contratista);
  const disponibles = Math.max(0, hechas - previas);
  const remanente = Math.max(0, disponibles - piezas);
  const monto = piezas * tarifa;

  const now = new Date();
  const folioPago = "PAG-" + now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, "0") + 
                    String(now.getDate()).padStart(2, "0") + "-" + 
                    String(now.getHours()).padStart(2, "0") + 
                    String(now.getMinutes()).padStart(2, "0") + 
                    String(now.getSeconds()).padStart(2, "0");

  const nuevoPago = {
    id: "PAGO_" + Date.now(),
    folioPago: folioPago,
    fecha: fecha,
    timestamp: now.toISOString(),
    area: area,
    contratista: contratista,
    tipo: tipo,
    tarifa: tarifa,
    piezasRealizadas: hechas,
    piezasPagadasPreviamente: previas,
    piezasPagadasHoy: piezas,
    piezasPendientesRemanentes: remanente,
    montoPagado: monto,
    folioFactura: (inputFactura?.value || "").trim() || "S/F",
    metodoPago: selMetodo?.value || "Transferencia Electrónica (SPEI)",
    autorizadoPor: (inputAutorizo?.value || "").trim() || "Responsable de Pagos",
    notas: (inputNotas?.value || "").trim()
  };

  const lista = getPagosRegistrados();
  lista.unshift(nuevoPago); // Agregar al inicio para orden cronológico inverso
  savePagosRegistrados(lista);

  closeRegistrarPagoModal();

  showToast(`✅ Pago registrado: ${formatMoney(monto)} a ${contratista} en ${area} (${piezas} piezas). Quedan ${remanente} pendientes.`, "success", 4500);

  // Refrescar vistas del módulo
  applyPagosFilter();
  renderHistorialPagosTable();
}

function eliminarPagoRegistrado(idPago) {
  const lista = getPagosRegistrados();
  const item = lista.find(p => p.id === idPago);
  if (!item) return;

  const conf = confirm(`¿Estás segura de eliminar/anular el pago ${item.folioPago} por ${formatMoney(item.montoPagado)} a ${item.contratista}?\n\nLas ${item.piezasPagadasHoy} piezas pagadas volverán a sumarse al saldo pendiente por pagar.`);
  if (!conf) return;

  const filtrados = lista.filter(p => p.id !== idPago);
  savePagosRegistrados(filtrados);

  showToast(`🗑️ Pago ${item.folioPago} anulado. Las piezas regresaron a saldo pendiente.`, "info", 3500);

  applyPagosFilter();
  renderHistorialPagosTable();
}

// -------------------------------------------------------------------------
// RENDERIZADO DE LA BITÁCORA DE PAGOS REGISTRADOS
// -------------------------------------------------------------------------
function toggleHistorialPagosSection() {
  const sec = document.getElementById("pagosHistorialSection");
  if (!sec) return;
  sec.scrollIntoView({ behavior: "smooth" });
}

function renderHistorialPagosTable() {
  const tbody = document.getElementById("pagosHistorialTableBody");
  const badgeTotal = document.getElementById("pagosHistorialTotalBadge");
  const badgeBtn = document.getElementById("pagosHistorialBadgeCount");
  if (!tbody) return;

  const lista = getPagosRegistrados();

  if (badgeTotal) badgeTotal.innerText = `${lista.length} pago${lista.length === 1 ? "" : "s"} registrado${lista.length === 1 ? "" : "s"}`;
  if (badgeBtn) badgeBtn.innerText = String(lista.length);

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="text-center py-8 text-slate-400">
          <div class="text-2xl mb-1">📜</div>
          <div class="font-bold text-xs text-slate-600">Aún no hay pagos registrados en la bitácora</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Usa el botón "Registrar Pago" para liquidar y conciliar piezas con contratistas.</div>
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  lista.forEach((p, idx) => {
    const tipoBadge = p.tipo === "CASETA" 
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">CASETA</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">CAJA</span>';

    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 font-mono text-[11px] font-bold text-slate-800">${p.folioPago}</td>
        <td class="p-2.5 whitespace-nowrap text-slate-600">${p.fecha}</td>
        <td class="p-2.5 font-bold text-slate-900">${p.area}</td>
        <td class="p-2.5 font-bold text-amber-950">${p.contratista}</td>
        <td class="p-2.5 text-center">${tipoBadge}</td>
        <td class="p-2.5 text-center font-black text-blue-900 text-sm bg-blue-50/50">
          ${formatNumber(p.piezasPagadasHoy)}
        </td>
        <td class="p-2.5 text-right text-slate-600 font-semibold">$${Number(p.tarifa).toFixed(2)}</td>
        <td class="p-2.5 text-right font-black text-emerald-700 text-sm bg-emerald-50/50">
          ${formatMoney(p.montoPagado)}
        </td>
        <td class="p-2.5 text-center font-bold text-amber-800">
          ${formatNumber(p.piezasPendientesRemanentes)} remanentes
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-700">${p.folioFactura || "-"}</td>
        <td class="p-2.5 text-[11px] text-slate-500 max-w-[140px] truncate" title="${p.notas || ''} (${p.autorizadoPor || ''})">
          ${p.notas ? p.notas : (p.autorizadoPor || "-")}
        </td>
        <td class="p-2.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1">
            <button type="button" onclick="imprimirComprobantePago('${p.id}')" title="Imprimir Comprobante Oficial" class="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300">
              🖨️
            </button>
            <button type="button" onclick="eliminarPagoRegistrado('${p.id}')" title="Anular este pago" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// -------------------------------------------------------------------------
// EXPORTACIÓN Y RESPALDO DE LA BITÁCORA
// -------------------------------------------------------------------------
function exportarBitacoraPagosCSV() {
  const lista = getPagosRegistrados();
  if (lista.length === 0) {
    showToast("⚠️ No hay pagos registrados para exportar.", "warning", 3000);
    return;
  }

  const headers = [
    "Folio Pago",
    "Fecha",
    "Plaza / Area",
    "Contratista",
    "Tipo Activo",
    "Piezas Pagadas",
    "Tarifa Unitaria MXN",
    "Monto Liquidado MXN",
    "Piezas Realizadas al Corte",
    "Piezas Pagadas Previas",
    "Piezas Remanentes Pendientes",
    "Factura / Ref Fiscal",
    "Metodo de Pago",
    "Autorizado Por",
    "Notas"
  ];

  const rows = lista.map(p => [
    `"${p.folioPago}"`,
    `"${p.fecha}"`,
    `"${p.area}"`,
    `"${p.contratista}"`,
    `"${p.tipo}"`,
    p.piezasPagadasHoy,
    p.tarifa,
    p.montoPagado,
    p.piezasRealizadas,
    p.piezasPagadasPreviamente,
    p.piezasPendientesRemanentes,
    `"${p.folioFactura || ''}"`,
    `"${p.metodoPago || ''}"`,
    `"${p.autorizadoPor || ''}"`,
    `"${(p.notas || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bitacora_Pagos_Contratistas_Telmex2026_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("📥 Bitácora de pagos descargada exitosamente.", "success", 3000);
}

function exportarRespaldoPagosJSON() {
  const lista = getPagosRegistrados();
  const str = JSON.stringify(lista, null, 2);
  const blob = new Blob([str], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Respaldo_Historial_Pagos_Telmex2026_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("💾 Respaldo JSON de pagos descargado.", "success", 2500);
}

function importarRespaldoPagosJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error("Formato no válido");
      savePagosRegistrados(parsed);
      showToast(`✅ Se restauraron ${parsed.length} pagos correctamente.`, "success", 3500);
      applyPagosFilter();
      renderHistorialPagosTable();
    } catch (err) {
      showToast("❌ Error al restaurar el archivo JSON: formato inválido.", "error", 4000);
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------------------
// IMPRESIÓN DE COMPROBANTE OFICIAL DE PAGO
// -------------------------------------------------------------------------
function imprimirComprobantePago(idPago) {
  const lista = getPagosRegistrados();
  const p = lista.find(it => it.id === idPago);
  if (!p) return;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Comprobante Oficial de Liquidación - ${p.folioPago}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 40px; color: #0f172a; font-size: 12px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0055a5; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-title { font-size: 20px; font-weight: 900; color: #0055a5; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; }
        .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 20px; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #0055a5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        .total-row { font-size: 14px; font-weight: bold; background: #ecfdf5; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
        .sign-box { width: 28%; text-align: center; border-top: 1px solid #64748b; padding-top: 8px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-title">IASA / PCI | CAMPAÑA NACIONAL IMAGEN TELMEX 2026</div>
          <div style="font-size: 13px; font-weight: bold; color: #334155; margin-top: 3px;">Comprobante Oficial de Conciliación y Pago a Contratistas</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 900; color: #0055a5;">${p.folioPago}</div>
          <div style="color: #64748b; font-size: 11px;">Fecha de Pago: <b>${p.fecha}</b></div>
        </div>
      </div>

      <div class="box">
        <table style="margin: 0; background: transparent;">
          <tr>
            <td style="border:none; width: 50%;"><b>Plaza / Área:</b> ${p.area}</td>
            <td style="border:none; width: 50%;"><b>Tipo de Activo:</b> ${p.tipo}</td>
          </tr>
          <tr>
            <td style="border:none;"><b>Contratista / Socio:</b> ${p.contratista}</td>
            <td style="border:none;"><b>Factura / Ref Fiscal:</b> ${p.folioFactura || "S/F"}</td>
          </tr>
          <tr>
            <td style="border:none;"><b>Método de Pago:</b> ${p.metodoPago}</td>
            <td style="border:none;"><b>Autorizado Por:</b> ${p.autorizadoPor}</td>
          </tr>
        </table>
      </div>

      <h3>Detalle de Conciliación y Liquidación:</h3>
      <table>
        <thead>
          <tr>
            <th>Concepto de Trabajo</th>
            <th style="text-align: center;">Tarifa Unitaria</th>
            <th style="text-align: center;">Piezas Realizadas</th>
            <th style="text-align: center;">Piezas Pagadas Hoy</th>
            <th style="text-align: center;">Saldo Remanente</th>
            <th style="text-align: right;">Total Liquidado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>${p.tipo === "CASETA" ? "Casetas Telefónicas" : "Cajas de Distribución"}</b> (${p.area})</td>
            <td style="text-align: center;">$${Number(p.tarifa).toFixed(2)} MXN</td>
            <td style="text-align: center;">${p.piezasRealizadas}</td>
            <td style="text-align: center; font-weight: bold; color: #0055a5;">${p.piezasPagadasHoy}</td>
            <td style="text-align: center; color: #d97706; font-weight: bold;">${p.piezasPendientesRemanentes} piezas</td>
            <td style="text-align: right; font-weight: 900; color: #059669; font-size: 13px;">$${Number(p.montoPagado).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</td>
          </tr>
          <tr class="total-row">
            <td colspan="5" style="text-align: right; padding-right: 15px;">TOTAL TRANSFERIDO EN ESTA EMISIÓN:</td>
            <td style="text-align: right; color: #059669; font-size: 16px;">$${Number(p.montoPagado).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 11px; margin-top: 15px;">
        <b>Nota de Conciliación:</b> ${p.notas ? p.notas : "Liquidación conforme a folios autorizados en Linkaform."} Quedan ${p.piezasPendientesRemanentes} piezas pendientes para la siguiente factura.
      </div>

      <div class="signatures">
        <div class="sign-box">
          <b>Elaboró / Finanzas</b><br>
          <span style="color: #64748b;">${p.autorizadoPor}</span>
        </div>
        <div class="sign-box">
          <b>Revisó / Auditoría</b><br>
          <span style="color: #64748b;">PCI / IASA</span>
        </div>
        <div class="sign-box">
          <b>Recibió Contratista</b><br>
          <span style="color: #64748b;">${p.contratista}</span>
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}


function initPagosModule() {
  // Configurar tarifas por defecto
  pagosState.tarifaActiva = pagosState.tipo === "CASETA" ? pagosState.tarifaCaseta : pagosState.tarifaCaja;
  
  // Contadores globales de tipo en botones
  updateGlobalTipoCounters();

  // Inicializar sin ningún área seleccionada por defecto (como solicita el usuario para evitar confusión)
  pagosState.selectedAreas.clear();

  // Renderizar componentes
  updateTipoButtonsVisual();
  renderAreasBoard();
  populatePagosContratistas();
  populatePagosTecnicos();
  applyPagosFilter();
  renderHistorialPagosTable();
}

function updateGlobalTipoCounters() {
  const records = state.records || [];
  let cajas = 0;
  let casetas = 0;
  records.forEach(r => {
    if (r.tipo === "CASETA") casetas++;
    else cajas++;
  });

  const cCajas = document.getElementById("pagosCounterCajasTotal");
  if (cCajas) cCajas.innerText = `${formatNumber(cajas)} folios totales`;

  const cCasetas = document.getElementById("pagosCounterCasetasTotal");
  if (cCasetas) cCasetas.innerText = `${formatNumber(casetas)} folios totales`;
}

// Paso 1: Cambiar Tipo (CAJA vs CASETA)
function setPagosTipo(tipo) {
  pagosState.tipo = tipo;
  pagosState.tarifaActiva = tipo === "CASETA" ? pagosState.tarifaCaseta : pagosState.tarifaCaja;

  // Actualizar input de tarifa
  const inpTarifa = document.getElementById("pagosInputTarifa");
  if (inpTarifa) inpTarifa.value = pagosState.tarifaActiva;

  // Actualizar badge de tarifa
  const badge = document.getElementById("pagosTarifaBadge");
  if (badge) {
    badge.innerText = `$${pagosState.tarifaActiva.toFixed(2)} MXN / pieza`;
  }

  // Al cambiar tipo, inicializar sin ningún área seleccionada
  pagosState.selectedAreas.clear();

  updateTipoButtonsVisual();
  renderAreasBoard();
  populatePagosContratistas();
  populatePagosTecnicos();
  applyPagosFilter();

  showToast(`🎯 Tipo cambiado a: ${tipo === "CASETA" ? "Casetas ($36.00)" : "Cajas ($60.00)"}`, "info", 2000);
}

function updateTipoButtonsVisual() {
  const btnCaja = document.getElementById("btnPagosTipoCaja");
  const btnCaseta = document.getElementById("btnPagosTipoCaseta");

  if (pagosState.tipo === "CAJA") {
    if (btnCaja) {
      btnCaja.className = "p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left group border-blue-600 bg-blue-50/90 shadow-md ring-2 ring-blue-500/20";
    }
    if (btnCaseta) {
      btnCaseta.className = "p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left group border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
    }
  } else {
    if (btnCaja) {
      btnCaja.className = "p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left group border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
    }
    if (btnCaseta) {
      btnCaseta.className = "p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left group border-amber-600 bg-amber-50/90 shadow-md ring-2 ring-amber-500/20";
    }
  }
}

function toggleEditTarifa() {
  const row = document.getElementById("pagosEditTarifaRow");
  if (row) row.classList.toggle("hidden");
}

function onTarifaChanged() {
  const inp = document.getElementById("pagosInputTarifa");
  const val = parseFloat(inp?.value);
  if (!isNaN(val) && val > 0) {
    pagosState.tarifaActiva = val;
    if (pagosState.tipo === "CASETA") pagosState.tarifaCaseta = val;
    else pagosState.tarifaCaja = val;
    
    const badge = document.getElementById("pagosTarifaBadge");
    if (badge) badge.innerText = `$${val.toFixed(2)} MXN / pieza`;

    applyPagosFilter();
    showToast(`💰 Tarifa actualizada a: $${val.toFixed(2)} MXN`, "success", 2000);
  }
}

function resetDefaultTarifa() {
  pagosState.tarifaCaja = 60.00;
  pagosState.tarifaCaseta = 36.00;
  pagosState.tarifaActiva = pagosState.tipo === "CASETA" ? 36.00 : 60.00;
  
  const inp = document.getElementById("pagosInputTarifa");
  if (inp) inp.value = pagosState.tarifaActiva;

  const badge = document.getElementById("pagosTarifaBadge");
  if (badge) badge.innerText = `$${pagosState.tarifaActiva.toFixed(2)} MXN / pieza`;

  applyPagosFilter();
  showToast("Tarifa oficial restablecida.", "info", 2000);
}

// Obtener todas las áreas que tengan al menos 1 registro del tipo activo
function getAvailableAreasForTipo(tipo) {
  const records = state.records || [];
  const areaCounts = {};
  records.forEach(r => {
    if (r.tipo === tipo) {
      const a = (r.area_trabajo || "").trim().toUpperCase();
      if (a) areaCounts[a] = (areaCounts[a] || 0) + 1;
    }
  });
  return Object.keys(areaCounts).sort();
}

// Paso 2: Renderizar el Tablero de Áreas
function renderAreasBoard() {
  const grid = document.getElementById("pagosAreasGrid");
  if (!grid) return;

  const records = state.records || [];
  const areaCounts = {};
  records.forEach(r => {
    if (r.tipo === pagosState.tipo) {
      const a = (r.area_trabajo || "").trim().toUpperCase();
      if (a) areaCounts[a] = (areaCounts[a] || 0) + 1;
    }
  });

  const allAreas = Object.keys(areaCounts).sort();
  grid.innerHTML = "";

  allAreas.forEach(area => {
    const count = areaCounts[area] || 0;
    const isSelected = pagosState.selectedAreas.has(area);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.onclick = () => togglePagosArea(area);

    if (isSelected) {
      btn.className = "flex items-center justify-between p-2.5 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-sm transition-all text-left text-xs";
      btn.innerHTML = `
        <div class="truncate mr-1">
          <span class="block truncate">${area}</span>
          <span class="text-[10px] text-blue-700 font-semibold">${formatNumber(count)} ${pagosState.tipo === "CASETA" ? "casetas" : "cajas"}</span>
        </div>
        <span class="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">✓</span>
      `;
    } else {
      btn.className = "flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all text-left text-xs";
      btn.innerHTML = `
        <div class="truncate mr-1">
          <span class="block truncate">${area}</span>
          <span class="text-[10px] text-slate-400 font-medium">${formatNumber(count)} ${pagosState.tipo === "CASETA" ? "casetas" : "cajas"}</span>
        </div>
        <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] shrink-0 font-bold">+</span>
      `;
    }
    grid.appendChild(btn);
  });

  updateAreasBoardHeader(allAreas.length);
}

function updateAreasBoardHeader(totalAreasCount) {
  const lbl = document.getElementById("pagosAreasSelectedLabel");
  const countBadge = document.getElementById("pagosAreasCountBadge");

  const selCount = pagosState.selectedAreas.size;
  if (countBadge) countBadge.innerText = `${selCount} / ${totalAreasCount}`;

  if (lbl) {
    if (selCount === totalAreasCount) {
      lbl.innerText = "Todas las plazas seleccionadas (Proyecto Completo)";
      lbl.className = "font-extrabold text-blue-700";
    } else if (selCount === 0) {
      lbl.innerText = "Ninguna plaza seleccionada (Selecciona una o varias plazas abajo para liquidar, o pulsa '✓ Todas')";
      lbl.className = "font-bold text-amber-600";
    } else if (selCount === 1) {
      const singleArea = Array.from(pagosState.selectedAreas)[0];
      lbl.innerText = `Solo 1 plaza: ${singleArea}`;
      lbl.className = "font-extrabold text-amber-700";
    } else {
      const arr = Array.from(pagosState.selectedAreas);
      if (arr.length <= 4) {
        lbl.innerText = `Plazas conjuntas: ${arr.join(" + ")}`;
      } else {
        lbl.innerText = `${selCount} plazas seleccionadas conjuntamente`;
      }
      lbl.className = "font-extrabold text-emerald-700";
    }
  }
}

function togglePagosArea(area) {
  if (pagosState.selectedAreas.has(area)) {
    pagosState.selectedAreas.delete(area);
  } else {
    pagosState.selectedAreas.add(area);
  }
  renderAreasBoard();
  populatePagosContratistas();
  populatePagosTecnicos();
  applyPagosFilter();
  renderHistorialPagosTable();
}

function selectAllAreas() {
  const all = getAvailableAreasForTipo(pagosState.tipo);
  all.forEach(a => pagosState.selectedAreas.add(a));
  renderAreasBoard();
  populatePagosContratistas();
  populatePagosTecnicos();
  applyPagosFilter();
  showToast("✓ Todas las áreas seleccionadas.", "info", 1500);
}

function deselectAllAreas() {
  pagosState.selectedAreas.clear();
  renderAreasBoard();
  populatePagosContratistas();
  populatePagosTecnicos();
  applyPagosFilter();
  showToast("✕ Tablero de áreas deseleccionado.", "info", 1500);
}


// Paso 3: Llenar Contratistas
function populatePagosContratistas() {
  const records = state.records || [];
  const conSelect = document.getElementById("pagosFilterContratista");
  if (!conSelect) return;

  const currentVal = conSelect.value || pagosState.contratista || "TODOS";
  const conSet = new Set();

  records.forEach(r => {
    if (r.tipo === pagosState.tipo) {
      const area = (r.area_trabajo || "").trim().toUpperCase();
      // Filtrar si el área está en las seleccionadas (o si no hay ninguna seleccionada, todas)
      if (pagosState.selectedAreas.size === 0 || pagosState.selectedAreas.has(area)) {
        const c = (r.contratista_homologado || r.contratista || "").trim();
        if (c && c !== "Directo") conSet.add(c);
      }
    }
  });

  const sorted = Array.from(conSet).sort();
  conSelect.innerHTML = `<option value="TODOS">🏢 Todos los Contratistas (${sorted.length} con trabajos)</option>`;
  sorted.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.innerText = c;
    conSelect.appendChild(opt);
  });

  if (currentVal && conSet.has(currentVal)) {
    conSelect.value = currentVal;
    pagosState.contratista = currentVal;
  } else {
    conSelect.value = "TODOS";
    pagosState.contratista = "TODOS";
  }
}

// Llenar Técnicos secundarios
function populatePagosTecnicos() {
  const records = state.records || [];
  const tecSelect = document.getElementById("pagosFilterTecnico");
  if (!tecSelect) return;

  const currentVal = tecSelect.value || pagosState.tecnico || "TODOS";
  const tecSet = new Set();

  records.forEach(r => {
    if (r.tipo === pagosState.tipo) {
      const area = (r.area_trabajo || "").trim().toUpperCase();
      if (pagosState.selectedAreas.size === 0 || pagosState.selectedAreas.has(area)) {
        const c = (r.contratista_homologado || r.contratista || "").trim();
        if (pagosState.contratista === "TODOS" || c === pagosState.contratista) {
          const t = (r.tecnico_homologado || r.tecnico || "").trim();
          if (t && t !== "Sin Técnico") tecSet.add(t);
        }
      }
    }
  });

  const sorted = Array.from(tecSet).sort();
  tecSelect.innerHTML = `<option value="TODOS">👥 Todas las Cuadrillas (${sorted.length} técnicos)</option>`;
  sorted.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.innerText = t;
    tecSelect.appendChild(opt);
  });

  if (currentVal && tecSet.has(currentVal)) {
    tecSelect.value = currentVal;
  } else {
    tecSelect.value = "TODOS";
  }
}

// Rango de Fechas
function onPagosPresetDateChange() {
  const preset = document.getElementById("pagosFilterPresetDate")?.value || "TODO";
  pagosState.presetDate = preset;
  const startEl = document.getElementById("pagosDateStart");
  const endEl = document.getElementById("pagosDateEnd");
  const customRow = document.getElementById("pagosCustomDateRow");

  if (!startEl || !endEl) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (preset === "TODO") {
    startEl.value = "";
    endEl.value = "";
    if (customRow) customRow.classList.add("hidden");
  } else if (preset === "HOY") {
    startEl.value = todayStr;
    endEl.value = todayStr;
    if (customRow) customRow.classList.add("hidden");
  } else if (preset === "AYER") {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
    startEl.value = yStr;
    endEl.value = yStr;
    if (customRow) customRow.classList.add("hidden");
  } else if (preset === "ESTA_SEMANA") {
    const curr = new Date(today);
    const day = curr.getDay(); // 0 domingo, 1 lunes
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));
    const mStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    startEl.value = mStr;
    endEl.value = todayStr;
    if (customRow) customRow.classList.add("hidden");
  } else if (preset === "MES_ACTUAL") {
    startEl.value = `${yyyy}-${mm}-01`;
    endEl.value = todayStr;
    if (customRow) customRow.classList.add("hidden");
  } else if (preset === "PERSONALIZADO") {
    if (customRow) customRow.classList.remove("hidden");
  }

  applyPagosFilter();
  renderHistorialPagosTable();
}

// Filtro Principal
function applyPagosFilter() {
  const conSelect = document.getElementById("pagosFilterContratista");
  if (conSelect) pagosState.contratista = conSelect.value;

  const tecSelect = document.getElementById("pagosFilterTecnico");
  if (tecSelect) pagosState.tecnico = tecSelect.value;

  const dStart = document.getElementById("pagosDateStart")?.value || "";
  const dEnd = document.getElementById("pagosDateEnd")?.value || "";
  pagosState.dateStart = dStart;
  pagosState.dateEnd = dEnd;

  const allRecords = state.records || [];

  pagosFilteredRecords = allRecords.filter(r => {
    // 1. Tipo (CAJA o CASETA)
    if (r.tipo !== pagosState.tipo) return false;

    // 2. Tablero de Áreas (Conjunto)
    const area = (r.area_trabajo || "").trim().toUpperCase();
    if (pagosState.selectedAreas.size === 0) {
      return false; // Si no hay áreas seleccionadas, mostrar 0 hasta que el usuario elija
    }
    if (!pagosState.selectedAreas.has(area)) {
      return false;
    }

    // 3. Contratista a Liquidar
    if (pagosState.contratista !== "TODOS") {
      const c = (r.contratista_homologado || r.contratista || "").trim();
      if (c !== pagosState.contratista) return false;
    }

    // 4. Técnico secundario
    if (pagosState.tecnico !== "TODOS") {
      const t = (r.tecnico_homologado || r.tecnico || "").trim();
      if (t !== pagosState.tecnico) return false;
    }

    // 5. Rango de Fechas
    const f = r.fecha_corte || r.fecha_captura || r.fecha || "";
    if (dStart && f && f < dStart) return false;
    if (dEnd && f && f > dEnd) return false;

    return true;
  });

  pagosState.currentPage = 1;
  updatePagosSummaryCards();
  renderPagosSubtotalesAreas();
  renderPagosModelosGrid();
  renderPagosTable();
}

// Tarjetas KPI Financieras
// Tarjetas KPI Financieras con Control de Pagos y Pendientes
function updatePagosSummaryCards() {
  const cantidadRealizadas = pagosFilteredRecords.length;
  const tarifa = pagosState.tarifaActiva;

  // Calcular piezas pagadas acumuladas para los filtros activos
  let pagadasAcumuladas = 0;
  if (pagosState.selectedAreas.size > 0) {
    pagosState.selectedAreas.forEach(area => {
      pagadasAcumuladas += getPiezasPagadasAcumuladas(pagosState.tipo, area, pagosState.contratista);
    });
  } else {
    pagadasAcumuladas = getPiezasPagadasAcumuladas(pagosState.tipo, "TODAS", pagosState.contratista);
  }

  const cantidadPendientes = Math.max(0, cantidadRealizadas - pagadasAcumuladas);
  const montoPendiente = cantidadPendientes * tarifa;
  const montoPagadoTotal = pagadasAcumuladas * tarifa;

  // Tarjeta 1: Saldo Pendiente por Liquidar
  const mDineroEl = document.getElementById("pagosKpiMontoDinero");
  if (mDineroEl) {
    mDineroEl.innerText = formatMoney(montoPendiente);
  }

  const fEl = document.getElementById("pagosKpiFormula");
  if (fEl) {
    const labelPieza = pagosState.tipo === "CASETA" ? "casetas" : "cajas";
    fEl.innerText = `${formatNumber(cantidadPendientes)} ${labelPieza} pendientes x $${tarifa.toFixed(2)} MXN`;
  }

  // Tarjeta 2: Número de Piezas Pendientes vs Hechas
  const pCountEl = document.getElementById("pagosKpiCantidadPiezas");
  if (pCountEl) pCountEl.innerText = formatNumber(cantidadPendientes);

  const pLabelEl = document.getElementById("pagosKpiPiezasLabel");
  if (pLabelEl) {
    pLabelEl.innerHTML = pagosState.tipo === "CASETA" ? "<span>📞</span> CASETAS POR LIQUIDAR" : "<span>📦</span> CAJAS POR LIQUIDAR";
  }

  const pDescEl = document.getElementById("pagosKpiPiezasDesc");
  if (pDescEl) {
    pDescEl.innerText = `${formatNumber(cantidadRealizadas)} hechas en campo | ${formatNumber(pagadasAcumuladas)} pagadas`;
  }

  // Tarjeta 3: Total Pagado Histórico
  const mPagadoEl = document.getElementById("pagosKpiMontoPagado");
  if (mPagadoEl) {
    mPagadoEl.innerText = formatMoney(montoPagadoTotal);
  }

  const pPagadasDescEl = document.getElementById("pagosKpiPiezasPagadasDesc");
  if (pPagadasDescEl) {
    pPagadasDescEl.innerText = `${formatNumber(pagadasAcumuladas)} piezas liquidadas históricamente`;
  }

  // Tarjeta 4: Contratista
  const conTitleEl = document.getElementById("pagosKpiContratistaTitle");
  if (conTitleEl) {
    if (pagosState.contratista === "TODOS") {
      conTitleEl.innerText = "Todos los Contratistas";
    } else {
      conTitleEl.innerText = pagosState.contratista;
    }
  }

  const tecSet = new Set();
  pagosFilteredRecords.forEach(r => {
    const t = (r.tecnico_homologado || r.tecnico || "").trim();
    if (t) tecSet.add(t);
  });

  const cuadCountEl = document.getElementById("pagosKpiCuadrillasCount");
  if (cuadCountEl) {
    cuadCountEl.innerText = `${tecSet.size} técnicos involucrados`;
  }
}

// Desglose por Plaza / Área con Hechas, Pagadas y Saldo Pendiente
function renderPagosSubtotalesAreas() {
  const container = document.getElementById("pagosSubtotalesAreasContainer");
  const tag = document.getElementById("pagosMatrizTotalTag");
  if (!container) return;

  const areaMap = {};
  pagosFilteredRecords.forEach(r => {
    const a = (r.area_trabajo || "").trim().toUpperCase() || "SIN ÁREA";
    if (!areaMap[a]) {
      areaMap[a] = { count: 0, tecnicos: new Set(), contratistas: new Set() };
    }
    areaMap[a].count++;
    const t = (r.tecnico_homologado || r.tecnico || "").trim();
    if (t) areaMap[a].tecnicos.add(t);
    const c = (r.contratista_homologado || r.contratista || "").trim();
    if (c) areaMap[a].contratistas.add(c);
  });

  const areasSorted = Object.keys(areaMap).sort((a, b) => areaMap[b].count - areaMap[a].count);
  const tarifa = pagosState.tarifaActiva;

  let totalGeneralPendiente = 0;
  let totalGeneralPagado = 0;

  areasSorted.forEach(area => {
    const hechas = areaMap[area].count;
    const pagadas = getPiezasPagadasAcumuladas(pagosState.tipo, area, pagosState.contratista);
    const pendientes = Math.max(0, hechas - pagadas);
    totalGeneralPendiente += (pendientes * tarifa);
    totalGeneralPagado += (pagadas * tarifa);
  });

  if (tag) {
    tag.innerText = `Saldo pendiente: ${formatMoney(totalGeneralPendiente)} | Ya pagado: ${formatMoney(totalGeneralPagado)}`;
  }

  if (areasSorted.length === 0) {
    const isNoArea = pagosState.selectedAreas.size === 0;
    container.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        ${isNoArea ? 'Selecciona una o más plazas en el tablero para ver el desglose por área, o pulsa "✓ Todas".' : 'No hay trabajos que coincidan con la combinación de filtros seleccionada.'}
      </div>
    `;
    return;
  }

  let html = `
    <table class="w-full text-left border-collapse text-xs">
      <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
        <tr>
          <th class="p-2.5">Plaza / Área</th>
          <th class="p-2.5 text-center">Hechas Campo</th>
          <th class="p-2.5 text-center text-indigo-700">Ya Pagadas</th>
          <th class="p-2.5 text-center text-emerald-800 font-black">Pendientes Pago</th>
          <th class="p-2.5 text-right">Tarifa</th>
          <th class="p-2.5 text-right font-black">Subtotal Pendiente ($)</th>
          <th class="p-2.5 text-center">Cuadrillas</th>
          <th class="p-2.5 text-center">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
  `;

  areasSorted.forEach(area => {
    const data = areaMap[area];
    const hechas = data.count;
    const pagadas = getPiezasPagadasAcumuladas(pagosState.tipo, area, pagosState.contratista);
    const pendientes = Math.max(0, hechas - pagadas);
    const subtotalPendiente = pendientes * tarifa;

    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
          <span class="text-amber-500">📍</span> ${area}
        </td>
        <td class="p-2.5 text-center font-bold text-slate-700">
          ${formatNumber(hechas)}
        </td>
        <td class="p-2.5 text-center font-bold text-indigo-700 bg-indigo-50/40">
          ${formatNumber(pagadas)}
        </td>
        <td class="p-2.5 text-center font-black ${pendientes > 0 ? 'text-emerald-700 bg-emerald-50/60' : 'text-slate-400'}">
          ${formatNumber(pendientes)}
        </td>
        <td class="p-2.5 text-right text-slate-600 font-semibold">
          $${tarifa.toFixed(2)} MXN
        </td>
        <td class="p-2.5 text-right font-black ${pendientes > 0 ? 'text-emerald-700 text-sm' : 'text-slate-400'}">
          ${formatMoney(subtotalPendiente)}
        </td>
        <td class="p-2.5 text-center text-slate-600">
          ${data.tecnicos.size} técnicos
        </td>
        <td class="p-2.5 text-center">
          <div class="flex items-center justify-center gap-1">
            <button type="button" onclick="openRegistrarPagoModal('${area}')" class="px-2.5 py-1 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1" title="Registrar pago para esta plaza">
              <span>💳</span> Pagar
            </button>
            <button type="button" onclick="focusOnlyThisArea('${area}')" class="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors">
              Filtrar
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

function renderPagosModelosGrid() {
  const grid = document.getElementById("pagosModelosGrid");
  const totalTag = document.getElementById("pagosModelosTotalTag");
  if (!grid) return;

  const modelCounts = {};
  pagosFilteredRecords.forEach(r => {
    const m = (r.modelo || "Sencilla").trim();
    modelCounts[m] = (modelCounts[m] || 0) + 1;
  });

  const sortedModels = Object.keys(modelCounts).sort((a, b) => modelCounts[b] - modelCounts[a]);
  const total = pagosFilteredRecords.length;

  if (totalTag) {
    totalTag.innerText = `${formatNumber(total)} piezas en ${sortedModels.length} modelos`;
  }

  grid.innerHTML = "";
  if (sortedModels.length === 0) {
    grid.innerHTML = '<div class="col-span-5 text-center text-slate-400 text-xs py-3">Sin modelos</div>';
    return;
  }

  sortedModels.forEach(m => {
    const c = modelCounts[m];
    const pct = total > 0 ? ((c / total) * 100).toFixed(1) : 0;

    const div = document.createElement("div");
    div.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between";
    div.innerHTML = `
      <div class="flex items-start justify-between gap-1 mb-1">
        <span class="font-bold text-slate-800 text-[11px] truncate" title="${m}">${m}</span>
        <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">${pct}%</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-black text-slate-900">${formatNumber(c)}</span>
        <span class="text-[10px] text-slate-500 font-semibold">${formatMoney(c * pagosState.tarifaActiva)}</span>
      </div>
    `;
    grid.appendChild(div);
  });
}

// Renderizar Tabla Detallada con Miniaturas de Evidencias
function renderPagosTable() {
  const tbody = document.getElementById("pagosTableBody");
  const counterInfo = document.getElementById("pagosTableCounterInfo");
  const pagInfo = document.getElementById("pagosPaginationInfo");
  const btnPrev = document.getElementById("btnPagosPrev");
  const btnNext = document.getElementById("btnPagosNext");

  if (!tbody) return;

  const total = pagosFilteredRecords.length;

  // Precalcular el estatus de pago de cada registro basado en FIFO (más antiguos primero)
  const sortedRecords = [...pagosFilteredRecords].sort((a, b) => {
    const fa = (a.fecha_corte || a.fecha_captura || a.fecha || "") + " " + (a.hora || "");
    const fb = (b.fecha_corte || b.fecha_captura || b.fecha || "") + " " + (b.hora || "");
    return fa.localeCompare(fb);
  });

  const recordPaidStatus = new Map();
  const counterPerKey = {};

  sortedRecords.forEach(r => {
    const area = (r.area_trabajo || "").trim().toUpperCase();
    const con = (r.contratista_homologado || r.contratista || "").trim();
    const key = `${pagosState.tipo}|${area}|${con}`;

    counterPerKey[key] = (counterPerKey[key] || 0) + 1;
    const pagadas = getPiezasPagadasAcumuladas(pagosState.tipo, area, con);

    const isPaid = counterPerKey[key] <= pagadas;
    recordPaidStatus.set(r, isPaid);
  });

  let totalPagadosFiltrados = 0;
  pagosFilteredRecords.forEach(r => {
    if (recordPaidStatus.get(r)) totalPagadosFiltrados++;
  });
  const totalPendientesFiltrados = Math.max(0, total - totalPagadosFiltrados);

  if (counterInfo) {
    const conName = pagosState.contratista !== "TODOS" ? `para ${pagosState.contratista}` : "generales";
    counterInfo.innerText = `Mostrando ${formatNumber(total)} trabajos ${conName} (${formatNumber(totalPendientesFiltrados)} por pagar: ${formatMoney(totalPendientesFiltrados * pagosState.tarifaActiva)} | ${formatNumber(totalPagadosFiltrados)} ya liquidados)`;
  }

  if (total === 0) {
    const isNoArea = pagosState.selectedAreas.size === 0;
    tbody.innerHTML = `
      <tr>
        <td colspan="14" class="text-center py-12 text-slate-400">
          <div class="text-3xl mb-2">${isNoArea ? '🗺️' : '🔍'}</div>
          <div class="font-bold text-sm text-slate-700">${isNoArea ? 'Ninguna plaza seleccionada en el Paso 2' : 'No se encontraron trabajos con los filtros seleccionados'}</div>
          <div class="text-xs text-slate-500 mt-1">${isNoArea ? 'Haz clic en una o varias plazas del tablero para consultar sus folios y calcular el pago, o pulsa "✓ Todas" para el costo total.' : 'Prueba seleccionando más áreas en el tablero o cambiando el contratista'}</div>
        </td>
      </tr>
    `;
    if (pagInfo) pagInfo.innerText = "Página 1 de 1";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  const totalPages = Math.ceil(total / pagosState.pageSize) || 1;
  if (pagosState.currentPage > totalPages) pagosState.currentPage = totalPages;
  if (pagosState.currentPage < 1) pagosState.currentPage = 1;

  const startIdx = (pagosState.currentPage - 1) * pagosState.pageSize;
  const endIdx = Math.min(startIdx + pagosState.pageSize, total);
  const pageRecords = pagosFilteredRecords.slice(startIdx, endIdx);

  const tarifa = pagosState.tarifaActiva;

  let html = "";
  pageRecords.forEach((r, idx) => {
    const num = startIdx + idx + 1;
    const folio = r.folio || "S/F";
    const fecha = r.fecha_captura || r.fecha || "S/F";
    const hora = r.hora || "";
    const area = r.area_trabajo || "S/A";
    const contratista = r.contratista_homologado || r.contratista || "S/C";
    const tecnico = r.tecnico_homologado || r.tecnico || "Sin Técnico";
    const tipo = r.tipo || "CAJA";
    const modelo = r.modelo || "Sencilla";
    const identificador = r.identificador || r.distrito || r.telefono || "S/D";
    const comentarios = r.comentarios || "";
    const foto = r.foto_evidencia || r.foto_despues || r.foto_antes || "";

    const isPaid = recordPaidStatus.get(r);
    const badgeEstatus = isPaid
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Liquidado</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ Por Pagar</span>';

    const fotoHtml = foto ? `
      <div class="flex items-center justify-center">
        <img src="${foto}" 
             alt="Evidencia" 
             class="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 hover:scale-110 transition-transform shadow-xs"
             loading="lazy"
             onclick="openPaymentPhotoModal('${foto}', '${folio}', '${identificador}', '${area}', '${tecnico}', '${contratista}')">
      </div>
    ` : `
      <span class="text-[10px] text-slate-300 italic block text-center">Sin foto</span>
    `;

    html += `
      <tr class="${isPaid ? 'hover:bg-slate-50' : 'bg-amber-50/20 hover:bg-amber-50/60'} transition-colors">
        <td class="p-2.5 text-center text-slate-400 font-medium">${num}</td>
        <td class="p-2.5 font-mono text-[11px] font-bold text-slate-800">${folio}</td>
        <td class="p-2.5 whitespace-nowrap text-slate-600">
          <div>${fecha}</div>
          <div class="text-[10px] text-slate-400 font-mono">${hora}</div>
        </td>
        <td class="p-2.5 font-bold text-slate-900">${area}</td>
        <td class="p-2.5 font-bold text-amber-900">${contratista}</td>
        <td class="p-2.5 text-slate-700">${tecnico}</td>
        <td class="p-2.5 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${tipo === 'CASETA' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
            ${tipo}
          </span>
        </td>
        <td class="p-2.5 font-medium text-slate-700">${modelo}</td>
        <td class="p-2.5 font-mono text-[11px] font-semibold text-slate-900">${identificador}</td>
        <td class="p-2.5 text-right font-medium text-slate-600">$${tarifa.toFixed(2)}</td>
        <td class="p-2.5 text-right font-black ${isPaid ? 'text-slate-400' : 'text-emerald-700'}">$${tarifa.toFixed(2)}</td>
        <td class="p-2.5 text-center">${badgeEstatus}</td>
        <td class="p-2.5">${fotoHtml}</td>
        <td class="p-2.5 text-slate-500 max-w-[150px] truncate" title="${comentarios}">
          ${comentarios || "-"}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  if (pagInfo) {
    pagInfo.innerText = `Página ${pagosState.currentPage} de ${totalPages} (Mostrando ${startIdx + 1}-${endIdx} de ${formatNumber(total)})`;
  }
  if (btnPrev) btnPrev.disabled = pagosState.currentPage <= 1;
  if (btnNext) btnNext.disabled = pagosState.currentPage >= totalPages;
}

function changePagosPage(delta) {
  const totalPages = Math.ceil(pagosFilteredRecords.length / pagosState.pageSize) || 1;
  const newPage = pagosState.currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    pagosState.currentPage = newPage;
    renderPagosTable();
    // Scroll suave a la tabla
    document.getElementById("tab-pagos")?.scrollIntoView({ behavior: "smooth" });
  }
}

// Modal para Visualizar Foto de Evidencia con Zoom Completo
function openPaymentPhotoModal(url, folio, iden, area, tec, con) {
  const modal = document.getElementById("paymentPhotoModal");
  const img = document.getElementById("paymentPhotoImg");
  const fEl = document.getElementById("paymentPhotoFolio");
  const dEl = document.getElementById("paymentPhotoDetails");
  const link = document.getElementById("paymentPhotoFullLink");

  if (!modal || !img) return;

  img.src = url;
  if (fEl) fEl.innerText = `Folio Linkaform: ${folio} (${iden})`;
  if (dEl) dEl.innerText = `Plaza: ${area} | Contratista: ${con} | Técnico: ${tec}`;
  if (link) link.href = url;

  modal.classList.remove("hidden");
}

function closePaymentPhotoModal() {
  const modal = document.getElementById("paymentPhotoModal");
  if (modal) modal.classList.add("hidden");
}

// Exportar Liquidación Oficial a Excel (CSV)
function exportPagosCSV() {
  if (pagosFilteredRecords.length === 0) {
    showToast("⚠️ No hay registros con los filtros actuales para exportar.", "warning", 3000);
    return;
  }

  showToast("📊 Generando archivo de liquidación para Excel...", "info", 2000);

  const tarifa = pagosState.tarifaActiva;
  const headers = [
    "No",
    "Folio Linkaform",
    "Fecha Captura",
    "Hora",
    "Fecha Corte Contable",
    "Tipo Activo",
    "Plaza / Area",
    "Empresa / Contratista",
    "Tecnico en Sitio",
    "Modelo Instalado",
    "Distrito / Telefono",
    "Tarifa Unitaria MXN",
    "Importe a Pagar MXN",
    "Oferta Colocada",
    "Comentarios",
    "URL Evidencia Fotografica"
  ];

  const rows = pagosFilteredRecords.map((r, i) => [
    i + 1,
    `"${(r.folio || '').replace(/"/g, '""')}"`,
    `"${r.fecha_captura || ''}"`,
    `"${r.hora || ''}"`,
    `"${r.fecha_corte || ''}"`,
    `"${r.tipo || ''}"`,
    `"${(r.area_trabajo || '').replace(/"/g, '""')}"`,
    `"${(r.contratista_homologado || r.contratista || '').replace(/"/g, '""')}"`,
    `"${(r.tecnico_homologado || r.tecnico || '').replace(/"/g, '""')}"`,
    `"${(r.modelo || '').replace(/"/g, '""')}"`,
    `"${(r.identificador || '').replace(/"/g, '""')}"`,
    tarifa.toFixed(2),
    tarifa.toFixed(2),
    `"${(r.oferta || '').replace(/"/g, '""')}"`,
    `"${(r.comentarios || '').replace(/"/g, '""')}"`,
    `"${(r.foto_evidencia || r.foto_despues || r.foto_antes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  
  const conSafe = pagosState.contratista !== "TODOS" ? pagosState.contratista.replace(/\s+/g, '_') : 'General';
  const tipoStr = pagosState.tipo;
  const dateStr = getLocalDateStr();
  
  a.href = url;
  a.download = `Liquidacion_${tipoStr}_${conSafe}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`✅ ¡Archivo de liquidación descargado exitosamente (${formatNumber(pagosFilteredRecords.length)} folios)!`, "success", 4000);
}

// Imprimir Carátula Oficial de Pago en PDF
function printPagosSummary() {
  if (pagosFilteredRecords.length === 0) {
    showToast("⚠️ No hay registros filtrados para imprimir.", "warning", 3000);
    return;
  }

  const tipo = pagosState.tipo;
  const tarifa = pagosState.tarifaActiva;
  const total = pagosFilteredRecords.length;
  const totalDinero = total * tarifa;
  const conName = pagosState.contratista !== "TODOS" ? pagosState.contratista : "TODOS LOS CONTRATISTAS";

  function formatFechaMX(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }

  const dStart = pagosState.dateStart || document.getElementById("pagosDateStart")?.value || "";
  const dEnd = pagosState.dateEnd || document.getElementById("pagosDateEnd")?.value || "";
  let periodoTexto = "Histórico Completo (Sin filtro de fechas)";
  if (dStart && dEnd) {
    if (dStart === dEnd) {
      periodoTexto = formatFechaMX(dStart);
    } else {
      periodoTexto = `Del ${formatFechaMX(dStart)} al ${formatFechaMX(dEnd)}`;
    }
  } else if (dStart) {
    periodoTexto = `A partir del ${formatFechaMX(dStart)}`;
  } else if (dEnd) {
    periodoTexto = `Hasta el ${formatFechaMX(dEnd)}`;
  }
  
  // Agrupar por áreas para la carátula
  const areaCounts = {};
  pagosFilteredRecords.forEach(r => {
    const a = (r.area_trabajo || "").trim().toUpperCase() || "SIN ÁREA";
    areaCounts[a] = (areaCounts[a] || 0) + 1;
  });

  const sortedAreas = Object.keys(areaCounts).sort((a, b) => areaCounts[b] - areaCounts[a]);

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Carátula de Liquidación Oficial - Imagen Telmex 2026</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 28px; color: #0f172a; margin: 0; }
        .header { border-bottom: 3px solid #0055a5; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        h1 { color: #0055a5; font-size: 20px; margin: 0; font-weight: 900; }
        .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
        .box-info { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .box-item strong { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
        .box-item span { font-size: 13px; font-weight: bold; color: #0f172a; }
        .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
        .kpi { flex: 1; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center; background: #fff; }
        .kpi-num { font-size: 24px; font-weight: 900; color: #0055a5; }
        .kpi-lbl { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-top: 2px; }
        .table-title { font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        th { background: #f1f5f9; font-weight: bold; color: #334155; }
        .signatures { display: flex; justify-content: space-around; margin-top: 60px; page-break-inside: avoid; }
        .sig-box { width: 220px; border-top: 1.5px solid #0f172a; text-align: center; padding-top: 8px; font-size: 11px; font-weight: bold; }
        .sig-sub { font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px; }
        @media print {
          body { padding: 10px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>ESTADO DE CUENTA Y CARÁTULA DE LIQUIDACIÓN OFICIAL</h1>
          <div class="subtitle">Proyecto Imagen Telmex 2026 · Conciliación Oficial de Trabajos y Facturación</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 900; color: #0055a5; font-size: 14px;">TELMEX / PCI</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Fecha Emisión: ${new Date().toLocaleDateString('es-MX')}</div>
          <div style="font-size: 10px; font-weight: 800; color: #0055a5; margin-top: 2px;">Periodo: ${periodoTexto}</div>
        </div>
      </div>

      <div class="box-info">
        <div class="box-item">
          <strong>Contratista a Liquidar:</strong>
          <span>${conName}</span>
        </div>
        <div class="box-item">
          <strong>Tipo de Activo:</strong>
          <span>${tipo === 'CASETA' ? 'Casetas Públicas' : 'Cajas (Distritos)'}</span>
        </div>
        <div class="box-item">
          <strong>Rango de Fechas:</strong>
          <span style="color: #0055a5; font-size: 12px;">${periodoTexto}</span>
        </div>
        <div class="box-item">
          <strong>Tarifa Autorizada:</strong>
          <span>$${tarifa.toFixed(2)} MXN c/u</span>
        </div>
        <div class="box-item">
          <strong>Plazas Agrupadas:</strong>
          <span>${sortedAreas.length} Áreas Conjuntas</span>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi" style="border-color: #10b981; background: #f0fdf4;">
          <div class="kpi-num" style="color: #059669;">${formatMoney(totalDinero)}</div>
          <div class="kpi-lbl">Importe Total a Liquidar (MXN)</div>
        </div>
        <div class="kpi" style="border-color: #3b82f6; background: #eff6ff;">
          <div class="kpi-num" style="color: #1d4ed8;">${formatNumber(total)}</div>
          <div class="kpi-lbl">${tipo === 'CASETA' ? 'Casetas Validadas' : 'Cajas Validadas'}</div>
        </div>
        <div class="kpi" style="border-color: #f59e0b; background: #fffbeb;">
          <div class="kpi-num" style="color: #d97706;">$${tarifa.toFixed(2)}</div>
          <div class="kpi-lbl">Costo Unitario por Pieza</div>
        </div>
      </div>

      <div class="table-title">Desglose de Facturación por Área Agrupada:</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Plaza / Área</th>
            <th style="text-align: center;">Cantidad (${tipo === 'CASETA' ? 'Casetas' : 'Cajas'})</th>
            <th style="text-align: right;">Tarifa Unitaria</th>
            <th style="text-align: right;">Subtotal a Pagar</th>
            <th style="text-align: center;">% Participación</th>
          </tr>
        </thead>
        <tbody>
          ${sortedAreas.map((a, idx) => {
            const cnt = areaCounts[a];
            const sub = cnt * tarifa;
            const pct = ((cnt / total) * 100).toFixed(1);
            return `
              <tr>
                <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                <td style="font-weight: bold;">${a}</td>
                <td style="text-align: center; font-weight: bold;">${formatNumber(cnt)}</td>
                <td style="text-align: right;">$${tarifa.toFixed(2)} MXN</td>
                <td style="text-align: right; font-weight: bold; color: #059669;">${formatMoney(sub)}</td>
                <td style="text-align: center;">${pct}%</td>
              </tr>
            `;
          }).join('')}
          <tr style="background: #f8fafc; font-weight: 900; font-size: 12px;">
            <td colspan="2" style="text-align: right;">TOTAL GENERAL LIQUIDADO:</td>
            <td style="text-align: center; color: #1d4ed8;">${formatNumber(total)}</td>
            <td style="text-align: right;">-</td>
            <td style="text-align: right; color: #059669; font-size: 13px;">${formatMoney(totalDinero)}</td>
            <td style="text-align: center;">100%</td>
          </tr>
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">
          Autorizó Pago
          <div class="sig-sub">Validación y Finanzas Telmex / PCI</div>
        </div>
        <div class="sig-box">
          Recibió de Conformidad
          <div class="sig-sub">${conName}</div>
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function formatMoney(num) {
  if (isNaN(num)) return "$0.00 MXN";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num);
}


// =========================================================
// =========================================================
// ACCESO CON NIP: MANDO GERENCIAL
// =========================================================
const GERENCIAL_NIP = "1970";

function openGerencialModule() {
  const isAuth = sessionStorage.getItem("GERENCIAL_AUTH_OK") === "true";
  if (isAuth) {
    switchTab("tab-gerencial");
    if (typeof renderBossModule === "function") renderBossModule();
  } else {
    openGerencialNipModal();
  }
}

function openGerencialNipModal() {
  const modal = document.getElementById("gerencialNipModal");
  const input = document.getElementById("gerencialNipInput");
  const err = document.getElementById("gerencialNipErrorMsg");
  if (err) err.classList.add("hidden");
  if (input) input.value = "";
  if (modal) modal.classList.remove("hidden");
  setTimeout(() => { if (input) input.focus(); }, 150);
}

function closeGerencialNipModal() {
  const modal = document.getElementById("gerencialNipModal");
  if (modal) modal.classList.add("hidden");
}

function verifyGerencialNip() {
  const input = document.getElementById("gerencialNipInput");
  const err = document.getElementById("gerencialNipErrorMsg");
  const entered = (input?.value || "").trim();

  if (entered === GERENCIAL_NIP) {
    sessionStorage.setItem("GERENCIAL_AUTH_OK", "true");
    closeGerencialNipModal();
    switchTab("tab-gerencial");
    if (typeof renderBossModule === "function") renderBossModule();
    showToast("Acceso autorizado", "success", 2000);
  } else {
    if (err) {
      err.innerText = "NIP Incorrecto. Acceso denegado.";
      err.classList.remove("hidden");
    }
    if (input) {
      input.classList.add("border-rose-500");
      input.select();
      setTimeout(() => input.classList.remove("border-rose-500"), 1000);
    }
  }
}

function logoutGerencial() {
  sessionStorage.removeItem("GERENCIAL_AUTH_OK");
  switchTab("tab-materiales");
  showToast("Sesión cerrada", "info", 2000);
}


// MÓDULO EXCLUSIVO DE MANDO GERENCIAL & RESUMEN OPERATIVO
// =========================================================

let bossState = {
  contratista: "TODOS",
  estado: "TODOS",
  area: "TODOS",
  tipo: "TODOS",
  semaforo: "TODOS",
  periodo: "all",
  dateStart: "",
  dateEnd: "",
  searchPlaza: "",
  activeSubTab: "plazas",
  isInitialized: false,
  charts: {}
};

function initBossModule() {
  populateBossFilters();
  applyBossFilters();
  bossState.isInitialized = true;
}

function renderBossModule() {
  if (!bossState.isInitialized) {
    initBossModule();
    return;
  }
  populateBossFilters(true); // preservar selección
  applyBossFilters();
}

function populateBossFilters(preserveSelection = false) {
  const records = state.records || [];

  // 1. Contratistas
  const conSelect = document.getElementById("bossFilterContratista");
  if (conSelect) {
    const curVal = preserveSelection ? (conSelect.value || bossState.contratista) : "TODOS";
    const conSet = new Set();
    records.forEach(r => {
      const c = (r.contratista_homologado || r.contratista || "").trim();
      if (c && c !== "Directo" && c !== "S/C") conSet.add(c);
    });
    const sortedCon = Array.from(conSet).sort();
    conSelect.innerHTML = `<option value="TODOS">🏢 Todos los Contratistas (${sortedCon.length})</option>`;
    sortedCon.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.innerText = c;
      conSelect.appendChild(opt);
    });
    if (curVal && (curVal === "TODOS" || conSet.has(curVal))) {
      conSelect.value = curVal;
      bossState.contratista = curVal;
    }
  }

  // 2. Estados
  const edoSelect = document.getElementById("bossFilterEstado");
  if (edoSelect) {
    const curEdo = preserveSelection ? (edoSelect.value || bossState.estado) : "TODOS";
    const edoSet = new Set();
    if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
      Object.keys(CATALOGO_METAS.estados).forEach(e => edoSet.add(e.trim().toUpperCase()));
    }
    records.forEach(r => {
      if (r.estado) edoSet.add(r.estado.trim().toUpperCase());
    });
    const sortedEdo = Array.from(edoSet).filter(Boolean).sort();
    edoSelect.innerHTML = `<option value="TODOS">🗺️ Todos los Estados (${sortedEdo.length})</option>`;
    sortedEdo.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e;
      opt.innerText = e;
      edoSelect.appendChild(opt);
    });
    if (curEdo && (curEdo === "TODOS" || edoSet.has(curEdo))) {
      edoSelect.value = curEdo;
      bossState.estado = curEdo;
    }
  }

  // 3. Plazas / Áreas
  updateBossAreaOptions(preserveSelection);
}

function updateBossAreaOptions(preserveSelection = false) {
  const arSelect = document.getElementById("bossFilterArea");
  if (!arSelect) return;

  const curArea = preserveSelection ? (arSelect.value || bossState.area) : "TODOS";
  const areaSet = new Set();
  const selEdoNorm = bossState.estado !== "TODOS" ? normalizeAreaKey(bossState.estado) : null;

  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    for (let edo in CATALOGO_METAS.estados) {
      const edoNorm = normalizeAreaKey(edo);
      if (!selEdoNorm || edoNorm === selEdoNorm) {
        Object.keys(CATALOGO_METAS.estados[edo]).forEach(ar => areaSet.add(ar.trim().toUpperCase()));
      }
    }
  }

  (state.records || []).forEach(r => {
    const rEdoNorm = r.estado ? normalizeAreaKey(r.estado) : "";
    if (!selEdoNorm || rEdoNorm === selEdoNorm) {
      if (r.area_trabajo) areaSet.add(r.area_trabajo.trim().toUpperCase());
    }
  });

  const sortedAr = Array.from(areaSet).filter(Boolean).sort();
  arSelect.innerHTML = `<option value="TODOS">📍 Todas las Plazas (${sortedAr.length})</option>`;
  sortedAr.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.innerText = a;
    arSelect.appendChild(opt);
  });

  if (curArea && (curArea === "TODOS" || areaSet.has(curArea))) {
    arSelect.value = curArea;
    bossState.area = curArea;
  } else {
    arSelect.value = "TODOS";
    bossState.area = "TODOS";
  }
}

function onBossEstadoChange() {
  const edoSelect = document.getElementById("bossFilterEstado");
  bossState.estado = edoSelect ? edoSelect.value : "TODOS";
  updateBossAreaOptions(false);
  applyBossFilters();
}

function onBossPeriodoChange() {
  const sel = document.getElementById("bossFilterPeriodo");
  const row = document.getElementById("bossCustomDateRow");
  const val = sel ? sel.value : "all";
  bossState.periodo = val;

  if (val === "custom") {
    if (row) row.classList.remove("hidden");
  } else {
    if (row) row.classList.add("hidden");
    const today = new Date();
    if (val === "today") {
      bossState.dateStart = getLocalDateStr(today);
      bossState.dateEnd = getLocalDateStr(today);
    } else if (val === "7days") {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      bossState.dateStart = getLocalDateStr(past);
      bossState.dateEnd = getLocalDateStr(today);
    } else if (val === "30days") {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      bossState.dateStart = getLocalDateStr(past);
      bossState.dateEnd = getLocalDateStr(today);
    } else {
      bossState.dateStart = "";
      bossState.dateEnd = "";
    }
  }
  applyBossFilters();
}

function resetBossFilters() {
  bossState.contratista = "TODOS";
  bossState.estado = "TODOS";
  bossState.area = "TODOS";
  bossState.tipo = "TODOS";
  bossState.semaforo = "TODOS";
  bossState.periodo = "all";
  bossState.dateStart = "";
  bossState.dateEnd = "";
  bossState.searchPlaza = "";

  const c1 = document.getElementById("bossFilterContratista"); if (c1) c1.value = "TODOS";
  const c2 = document.getElementById("bossFilterEstado"); if (c2) c2.value = "TODOS";
  const c3 = document.getElementById("bossFilterArea"); if (c3) c3.value = "TODOS";
  const c4 = document.getElementById("bossFilterTipo"); if (c4) c4.value = "TODOS";
  const c5 = document.getElementById("bossFilterSemaforo"); if (c5) c5.value = "TODOS";
  const c6 = document.getElementById("bossFilterPeriodo"); if (c6) c6.value = "all";
  const c7 = document.getElementById("bossSearchPlaza"); if (c7) c7.value = "";
  const row = document.getElementById("bossCustomDateRow"); if (row) row.classList.add("hidden");

  updateBossAreaOptions(false);
  applyBossFilters();
  showToast("🔄 Filtros gerenciales restablecidos", "info", 1500);
}

function applyBossFilters() {
  const c1 = document.getElementById("bossFilterContratista"); if (c1) bossState.contratista = c1.value;
  const c2 = document.getElementById("bossFilterEstado"); if (c2) bossState.estado = c2.value;
  const c3 = document.getElementById("bossFilterArea"); if (c3) bossState.area = c3.value;
  const c4 = document.getElementById("bossFilterTipo"); if (c4) bossState.tipo = c4.value;
  const c5 = document.getElementById("bossFilterSemaforo"); if (c5) bossState.semaforo = c5.value;
  
  if (bossState.periodo === "custom") {
    const dS = document.getElementById("bossDateStart"); if (dS) bossState.dateStart = dS.value;
    const dE = document.getElementById("bossDateEnd"); if (dE) bossState.dateEnd = dE.value;
  }

  const allRecords = state.records || [];
  const selCon = bossState.contratista !== "TODOS" ? bossState.contratista.trim().toLowerCase() : null;
  const selEdoNorm = bossState.estado !== "TODOS" ? normalizeAreaKey(bossState.estado) : null;
  const selAreaNorm = bossState.area !== "TODOS" ? normalizeAreaKey(bossState.area) : null;
  const selTipo = bossState.tipo !== "TODOS" ? bossState.tipo : null;

  // Filtrar registros
  const matchingRecords = [];
  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i];
    
    // Filtro Tipo
    if (selTipo && r.tipo !== selTipo) continue;

    // Filtro Contratista
    if (selCon) {
      const conName = (r.contratista_homologado || r.contratista || "").trim().toLowerCase();
      if (!conName.includes(selCon)) continue;
    }

    // Filtro Estado
    if (selEdoNorm) {
      const rEdoNorm = r.estado ? normalizeAreaKey(r.estado) : "";
      if (rEdoNorm !== selEdoNorm) {
        // Verificar si el estado coincide con el área o región de metas
        if (!isRecordInArea(r, bossState.estado)) continue;
      }
    }

    // Filtro Área
    if (selAreaNorm) {
      if (!isRecordInArea(r, bossState.area)) continue;
    }

    // Filtro Fechas
    if (bossState.dateStart || bossState.dateEnd) {
      const f = r.fecha || r.fecha_captura || "";
      if (bossState.dateStart && f < bossState.dateStart) continue;
      if (bossState.dateEnd && f > bossState.dateEnd) continue;
    }

    matchingRecords.push(r);
  }

  // Actualizar contador
  const countBadge = document.getElementById("bossFilterMatchCount");
  if (countBadge) {
    countBadge.innerText = `${formatNumber(matchingRecords.length)} registros filtrados de ${formatNumber(allRecords.length)}`;
  }

  // Calcular Metas y Cumplimiento
  const targets = computeBossTargets();
  renderBossKPIs(matchingRecords, targets);
  renderBossPlazasTable(matchingRecords);
  renderBossContractorsTable(matchingRecords);
  renderBossCharts(matchingRecords);
}

function computeBossTargets() {
  let metaCajas = 0;
  let metaCasetas = 0;
  let metaTotal = 0;

  if (typeof CATALOGO_METAS === "undefined" || !CATALOGO_METAS.estados) {
    return { cajas: 49829, casetas: 44919, total: 94748 };
  }

  const selEdoNorm = bossState.estado !== "TODOS" ? normalizeAreaKey(bossState.estado) : null;
  const selAreaNorm = bossState.area !== "TODOS" ? normalizeAreaKey(bossState.area) : null;

  for (let edo in CATALOGO_METAS.estados) {
    const edoNorm = normalizeAreaKey(edo);
    if (!selEdoNorm || edoNorm === selEdoNorm) {
      for (let ar in CATALOGO_METAS.estados[edo]) {
        const arNorm = normalizeAreaKey(ar);
        if (!selAreaNorm || arNorm === selAreaNorm) {
          const m = CATALOGO_METAS.estados[edo][ar];
          metaCajas += (m.cajas || 0);
          metaCasetas += (m.casetas || 0);
          metaTotal += (m.total || 0);
        }
      }
    }
  }

  if (metaTotal === 0) {
    metaTotal = CATALOGO_METAS.total_general || 94748;
    metaCajas = CATALOGO_METAS.total_cajas || 49829;
    metaCasetas = CATALOGO_METAS.total_casetas || 44919;
  }

  return { cajas: metaCajas, casetas: metaCasetas, total: metaTotal };
}

function renderBossKPIs(matchingRecords, targets) {
  let cajasDone = 0;
  let casetasDone = 0;
  const contratistasSet = new Set();
  const tecnicosSet = new Set();
  const plazasActivasSet = new Set();

  matchingRecords.forEach(r => {
    if (r.tipo === "CASETA") casetasDone++;
    else cajasDone++;

    const con = (r.contratista_homologado || r.contratista || "").trim();
    if (con && con !== "Directo" && con !== "S/C") contratistasSet.add(con);

    const tec = (r.tecnico || "").trim();
    if (tec && tec !== "N/A") tecnicosSet.add(tec);

    const ar = (r.area_trabajo || "").trim().toUpperCase();
    if (ar) plazasActivasSet.add(ar);
  });

  const totalDone = matchingRecords.length;
  const totalMeta = targets.total;
  const cajasMeta = targets.cajas;
  const casetasMeta = targets.casetas;

  const totalPct = totalMeta > 0 ? (totalDone / totalMeta) * 100 : 0;
  const cajasPct = cajasMeta > 0 ? (cajasDone / cajasMeta) * 100 : 0;
  const casetasPct = casetasMeta > 0 ? (casetasDone / casetasMeta) * 100 : 0;

  const totalFaltante = Math.max(0, totalMeta - totalDone);
  const cajasFaltante = Math.max(0, cajasMeta - cajasDone);
  const casetasFaltante = Math.max(0, casetasMeta - casetasDone);

  // KPI 1: Global
  setTextSafe("bossKpiTotalDone", formatNumber(totalDone));
  setTextSafe("bossKpiTotalMeta", formatNumber(totalMeta));
  setTextSafe("bossKpiTotalPercent", `${totalPct.toFixed(1)}%`);
  setTextSafe("bossKpiTotalFaltante", formatNumber(totalFaltante));
  setBarSafe("bossKpiTotalBar", Math.min(100, totalPct), totalPct >= 70 ? "#16a34a" : totalPct >= 30 ? "#eab308" : "#0284c7");

  // KPI 2: Cajas
  setTextSafe("bossKpiCajasDone", formatNumber(cajasDone));
  setTextSafe("bossKpiCajasMeta", formatNumber(cajasMeta));
  setTextSafe("bossKpiCajasPercent", `${cajasPct.toFixed(1)}%`);
  setTextSafe("bossKpiCajasFaltante", formatNumber(cajasFaltante));
  setBarSafe("bossKpiCajasBar", Math.min(100, cajasPct), "#06b6d4");

  // KPI 3: Casetas
  setTextSafe("bossKpiCasetasDone", formatNumber(casetasDone));
  setTextSafe("bossKpiCasetasMeta", formatNumber(casetasMeta));
  setTextSafe("bossKpiCasetasPercent", `${casetasPct.toFixed(1)}%`);
  setTextSafe("bossKpiCasetasFaltante", formatNumber(casetasFaltante));
  setBarSafe("bossKpiCasetasBar", Math.min(100, casetasPct), "#6366f1");

  // KPI 4: Fuerza Operativa
  setTextSafe("bossKpiContratistasCount", formatNumber(contratistasSet.size));
  setTextSafe("bossKpiTecnicosCount", formatNumber(tecnicosSet.size));
  setTextSafe("bossKpiPlazasActivasCount", formatNumber(plazasActivasSet.size));
}

function setTextSafe(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function setBarSafe(id, pct, color) {
  const el = document.getElementById(id);
  if (el) {
    el.style.width = `${pct}%`;
    if (color) el.style.backgroundColor = color;
  }
}

function renderBossPlazasTable(matchingRecords) {
  const tbody = document.getElementById("bossPlazasTableBody");
  if (!tbody) return;

  // 1. Agrupar registros por Plaza
  const recordsByArea = {};
  matchingRecords.forEach(r => {
    const ar = (r.area_trabajo || "").trim().toUpperCase();
    if (!recordsByArea[ar]) recordsByArea[ar] = { cajas: 0, casetas: 0, contratistas: new Set(), total: 0 };
    if (r.tipo === "CASETA") recordsByArea[ar].casetas++;
    else recordsByArea[ar].cajas++;
    recordsByArea[ar].total++;

    const con = (r.contratista_homologado || r.contratista || "").trim();
    if (con && con !== "Directo" && con !== "S/C") recordsByArea[ar].contratistas.add(con);
  });

  // 2. Construir lista consolidada de Plazas con Metas
  const rows = [];
  const selEdoNorm = bossState.estado !== "TODOS" ? normalizeAreaKey(bossState.estado) : null;
  const selAreaNorm = bossState.area !== "TODOS" ? normalizeAreaKey(bossState.area) : null;

  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    for (let edo in CATALOGO_METAS.estados) {
      const edoNorm = normalizeAreaKey(edo);
      if (!selEdoNorm || edoNorm === selEdoNorm) {
        for (let ar in CATALOGO_METAS.estados[edo]) {
          const arNorm = normalizeAreaKey(ar);
          if (!selAreaNorm || arNorm === selAreaNorm) {
            const meta = CATALOGO_METAS.estados[edo][ar];
            
            // Buscar datos hechos
            let doneData = { cajas: 0, casetas: 0, contratistas: new Set(), total: 0 };
            for (let recAr in recordsByArea) {
              if (normalizeAreaKey(recAr) === arNorm || normalizeAreaKey(recAr) === edoNorm) {
                const sub = recordsByArea[recAr];
                doneData.cajas += sub.cajas;
                doneData.casetas += sub.casetas;
                doneData.total += sub.total;
                sub.contratistas.forEach(c => doneData.contratistas.add(c));
              }
            }

            const mTotal = meta.total || 0;
            const pct = mTotal > 0 ? (doneData.total / mTotal) * 100 : 0;
            const faltante = Math.max(0, mTotal - doneData.total);

            // Semáforo
            let semStatus = "critico";
            let semBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">🔴 Crítico (&lt;30%)</span>`;
            if (pct >= 70) {
              semStatus = "avanzado";
              semBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">🟢 Avanzado (${pct.toFixed(0)}%)</span>`;
            } else if (pct >= 30) {
              semStatus = "proceso";
              semBadge = `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">🟡 En Proceso (${pct.toFixed(0)}%)</span>`;
            }

            rows.push({
              estado: edo,
              area: ar,
              contratistas: Array.from(doneData.contratistas),
              cajasDone: doneData.cajas,
              cajasMeta: meta.cajas || 0,
              casetasDone: doneData.casetas,
              casetasMeta: meta.casetas || 0,
              totalDone: doneData.total,
              totalMeta: mTotal,
              pct: pct,
              semStatus: semStatus,
              semBadge: semBadge,
              faltante: faltante
            });
          }
        }
      }
    }
  }

  // Guardar en caché para filtrado de texto rápido
  bossState.cachedPlazasData = rows;
  renderPlazasTableRows(rows);
}

function renderPlazasTableRows(rows) {
  const tbody = document.getElementById("bossPlazasTableBody");
  if (!tbody) return;

  const search = (bossState.searchPlaza || "").trim().toLowerCase();
  const selSem = bossState.semaforo;

  // Filtrar
  const filteredRows = rows.filter(r => {
    if (selSem !== "TODOS" && r.semStatus !== selSem) return false;
    if (search) {
      const matchEdo = r.estado.toLowerCase().includes(search);
      const matchAr = r.area.toLowerCase().includes(search);
      const matchCon = r.contratistas.some(c => c.toLowerCase().includes(search));
      if (!matchEdo && !matchAr && !matchCon) return false;
    }
    return true;
  });

  // Ordenar por volumen hecho (descendente)
  filteredRows.sort((a, b) => b.totalDone - a.totalDone || b.pct - a.pct);

  setTextSafe("bossPlazasTableCount", `${filteredRows.length} plazas mostradas`);

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400 font-semibold">No se encontraron plazas con los filtros seleccionados</td></tr>`;
    return;
  }

  let html = "";
  filteredRows.forEach((r, idx) => {
    const bgRow = idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";
    const cPct = r.cajasMeta > 0 ? (r.cajasDone / r.cajasMeta * 100).toFixed(0) : 0;
    const casPct = r.casetasMeta > 0 ? (r.casetasDone / r.casetasMeta * 100).toFixed(0) : 0;

    let conBadges = `<span class="text-slate-400 italic text-[11px]">Sin asignación</span>`;
    if (r.contratistas.length > 0) {
      conBadges = r.contratistas.slice(0, 2).map(c => 
        `<span class="inline-block bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 mr-1 mb-1 truncate max-w-[130px]" title="${c}">${c}</span>`
      ).join("");
      if (r.contratistas.length > 2) {
        conBadges += `<span class="text-[10px] font-bold text-telmex" title="${r.contratistas.join(', ')}">+${r.contratistas.length - 2} más</span>`;
      }
    }

    html += `
      <tr class="${bgRow} hover:bg-sky-50/60 transition-colors">
        <td class="p-2.5 font-bold text-slate-700 whitespace-nowrap">${r.estado}</td>
        <td class="p-2.5 font-black text-slate-900 whitespace-nowrap">${r.area}</td>
        <td class="p-2.5">${conBadges}</td>
        <td class="p-2.5 text-center">
          <div class="font-bold text-slate-800">${formatNumber(r.cajasDone)} <span class="text-slate-400 font-normal">/ ${formatNumber(r.cajasMeta)}</span></div>
          <div class="text-[10px] font-semibold text-cyan-700">${cPct}%</div>
        </td>
        <td class="p-2.5 text-center">
          <div class="font-bold text-slate-800">${formatNumber(r.casetasDone)} <span class="text-slate-400 font-normal">/ ${formatNumber(r.casetasMeta)}</span></div>
          <div class="text-[10px] font-semibold text-indigo-700">${casPct}%</div>
        </td>
        <td class="p-2.5 text-center font-black text-slate-900">
          <div>${formatNumber(r.totalDone)} <span class="text-slate-400 font-normal">/ ${formatNumber(r.totalMeta)}</span></div>
        </td>
        <td class="p-2.5 text-center">
          <div class="font-black text-xs ${r.pct >= 70 ? 'text-emerald-700' : r.pct >= 30 ? 'text-amber-700' : 'text-slate-600'}">${r.pct.toFixed(1)}%</div>
          <div class="w-16 mx-auto bg-slate-200 rounded-full h-1.5 overflow-hidden mt-1">
            <div class="h-1.5 rounded-full ${r.pct >= 70 ? 'bg-emerald-500' : r.pct >= 30 ? 'bg-amber-500' : 'bg-telmex'}" style="width: ${Math.min(100, r.pct)}%"></div>
          </div>
        </td>
        <td class="p-2.5 text-center whitespace-nowrap">${r.semBadge}</td>
        <td class="p-2.5 text-right font-black text-slate-700 whitespace-nowrap">${formatNumber(r.faltante)} pzas</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterBossPlazasTable() {
  const inp = document.getElementById("bossSearchPlaza");
  bossState.searchPlaza = inp ? inp.value : "";
  renderPlazasTableRows(bossState.cachedPlazasData || []);
}

function renderBossContractorsTable(matchingRecords) {
  const tbody = document.getElementById("bossContractorsTableBody");
  if (!tbody) return;

  const conMap = {};
  const totalGlobal = matchingRecords.length || 1;

  matchingRecords.forEach(r => {
    let c = (r.contratista_homologado || r.contratista || "SIN ASIGNAR").trim();
    if (!c) c = "SIN ASIGNAR";

    if (!conMap[c]) {
      conMap[c] = {
        name: c,
        cajas: 0,
        casetas: 0,
        total: 0,
        plazas: new Set(),
        tecnicos: new Set(),
        fechas: new Set()
      };
    }

    if (r.tipo === "CASETA") conMap[c].casetas++;
    else conMap[c].cajas++;
    conMap[c].total++;

    if (r.area_trabajo) conMap[c].plazas.add(r.area_trabajo.trim().toUpperCase());
    if (r.tecnico && r.tecnico !== "N/A") conMap[c].tecnicos.add(r.tecnico.trim());
    if (r.fecha) conMap[c].fechas.add(r.fecha);
  });

  const list = Object.values(conMap);
  list.sort((a, b) => b.total - a.total);

  setTextSafe("bossContractorsTableCount", `${list.length} contratistas activos`);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400 font-semibold">No se encontraron contratistas con los filtros seleccionados</td></tr>`;
    return;
  }

  let html = "";
  list.forEach((c, idx) => {
    const bgRow = idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";
    const share = (c.total / totalGlobal * 100).toFixed(1);
    const daysCount = Math.max(1, c.fechas.size);
    const avgPerDay = (c.total / daysCount).toFixed(1);

    // Estatus
    let statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Activo</span>`;
    if (c.total >= 1000) {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Alto Volumen</span>`;
    } else if (c.total >= 300) {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Producción Media</span>`;
    }

    const plazasPreview = Array.from(c.plazas).slice(0, 3).join(", ") + (c.plazas.size > 3 ? ` (+${c.plazas.size - 3})` : "");

    html += `
      <tr class="${bgRow} hover:bg-sky-50/60 transition-colors">
        <td class="p-2.5 text-center font-bold text-slate-400">#${idx + 1}</td>
        <td class="p-2.5 font-black text-slate-900">${c.name}</td>
        <td class="p-2.5 text-slate-600 text-xs" title="${Array.from(c.plazas).join(', ')}">
          <span class="font-bold text-telmex">${c.plazas.size} plazas:</span> ${plazasPreview}
        </td>
        <td class="p-2.5 text-right font-bold text-cyan-700">${formatNumber(c.cajas)}</td>
        <td class="p-2.5 text-right font-bold text-indigo-700">${formatNumber(c.casetas)}</td>
        <td class="p-2.5 text-right font-black text-slate-900 text-sm">${formatNumber(c.total)}</td>
        <td class="p-2.5 text-center font-bold text-slate-700">${share}%</td>
        <td class="p-2.5 text-center">
          <span class="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-full text-xs">${c.tecnicos.size}</span>
        </td>
        <td class="p-2.5 text-right font-bold text-slate-700">${avgPerDay} / día</td>
        <td class="p-2.5 text-center whitespace-nowrap">${statusPill}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderBossCharts(matchingRecords) {
  if (typeof Chart === "undefined") return;

  // 1. Gráfica de Avance vs Objetivo (Top Plazas)
  const ctxMetas = document.getElementById("chartBossAvanceMetas");
  if (ctxMetas) {
    if (state.charts['bossAvanceChart']) {
      state.charts['bossAvanceChart'].destroy();
    }

    // Obtener top 8 plazas por meta
    const plazasList = (bossState.cachedPlazasData || []).slice(0, 8);
    const labels = plazasList.map(p => p.area);
    const dataMetas = plazasList.map(p => p.totalMeta);
    const dataReal = plazasList.map(p => p.totalDone);

    state.charts['bossAvanceChart'] = new Chart(ctxMetas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Meta Oficial Telmex",
            data: dataMetas,
            backgroundColor: "#cbd5e1",
            borderRadius: 6
          },
          {
            label: "Avance Realizado",
            data: dataReal,
            backgroundColor: "#0055a5",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 10, weight: "bold" } } },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const pct = plazasList[idx] ? plazasList[idx].pct.toFixed(1) : 0;
                return `Cumplimiento: ${pct}%`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Gráfica por Contratista (Top 8)
  const ctxCon = document.getElementById("chartBossContractors");
  if (ctxCon) {
    if (state.charts['bossContractorsChart']) {
      state.charts['bossContractorsChart'].destroy();
    }

    const conMap = {};
    matchingRecords.forEach(r => {
      let c = (r.contratista_homologado || r.contratista || "S/A").trim();
      if (!conMap[c]) conMap[c] = { cajas: 0, casetas: 0, total: 0 };
      if (r.tipo === "CASETA") conMap[c].casetas++;
      else conMap[c].cajas++;
      conMap[c].total++;
    });

    const topCon = Object.entries(conMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    const conLabels = topCon.map(x => x[0].length > 18 ? x[0].substring(0, 18) + "..." : x[0]);
    const conCajas = topCon.map(x => x[1].cajas);
    const conCasetas = topCon.map(x => x[1].casetas);

    state.charts['bossContractorsChart'] = new Chart(ctxCon, {
      type: "bar",
      data: {
        labels: conLabels,
        datasets: [
          {
            label: "Cajas ($60)",
            data: conCajas,
            backgroundColor: "#06b6d4",
            borderRadius: 6
          },
          {
            label: "Casetas ($36)",
            data: conCasetas,
            backgroundColor: "#6366f1",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 10, weight: "bold" } } }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: "#f1f5f9" } }
        }
      }
    });
  }
}

function switchBossSubTab(subTabId) {
  bossState.activeSubTab = subTabId;

  // Botones
  const btnP = document.getElementById("bossSubTabBtnPlazas");
  const btnC = document.getElementById("bossSubTabBtnContratistas");
  const btnG = document.getElementById("bossSubTabBtnGraficas");

  [btnP, btnC, btnG].forEach(b => {
    if (b) {
      b.className = "px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 border-b-2 border-transparent flex items-center gap-2";
    }
  });

  // Paneles
  const viewP = document.getElementById("bossSubTabPlazas");
  const viewC = document.getElementById("bossSubTabContratistas");
  const viewG = document.getElementById("bossSubTabGraficas");

  if (viewP) viewP.classList.add("hidden");
  if (viewC) viewC.classList.add("hidden");
  if (viewG) viewG.classList.add("hidden");

  if (subTabId === "plazas") {
    if (btnP) btnP.className = "px-4 py-2.5 text-xs font-extrabold text-telmex border-b-2 border-telmex flex items-center gap-2";
    if (viewP) viewP.classList.remove("hidden");
  } else if (subTabId === "contratistas") {
    if (btnC) btnC.className = "px-4 py-2.5 text-xs font-extrabold text-telmex border-b-2 border-telmex flex items-center gap-2";
    if (viewC) viewC.classList.remove("hidden");
  } else if (subTabId === "graficas") {
    if (btnG) btnG.className = "px-4 py-2.5 text-xs font-extrabold text-telmex border-b-2 border-telmex flex items-center gap-2";
    if (viewG) viewG.classList.remove("hidden");
    setTimeout(() => {
      if (state.charts['bossAvanceChart']) state.charts['bossAvanceChart'].resize();
      if (state.charts['bossContractorsChart']) state.charts['bossContractorsChart'].resize();
    }, 100);
  }
}

function exportBossSummaryExcel() {
  if (typeof XLSX === "undefined") {
    showToast("⚠️ Librería Excel (XLSX) no disponible", "error");
    return;
  }

  showToast("⏳ Generando libro de Excel ejecutivo...", "info", 2000);

  const wb = XLSX.utils.book_new();

  // Hoja 1: Avance por Plaza vs Objetivo
  const plazasData = (bossState.cachedPlazasData || []).map(p => ({
    "Estado": p.estado,
    "Plaza / Área": p.area,
    "Contratistas Asignados": p.contratistas.join(", "),
    "Meta Cajas": p.cajasMeta,
    "Cajas Hechas": p.cajasDone,
    "% Avance Cajas": p.cajasMeta > 0 ? (p.cajasDone / p.cajasMeta * 100).toFixed(1) + "%" : "0%",
    "Meta Casetas": p.casetasMeta,
    "Casetas Hechas": p.casetasDone,
    "% Avance Casetas": p.casetasMeta > 0 ? (p.casetasDone / p.casetasMeta * 100).toFixed(1) + "%" : "0%",
    "Meta Total": p.totalMeta,
    "Total Hecho": p.totalDone,
    "% Cumplimiento Global": p.pct.toFixed(1) + "%",
    "Faltante Meta (Pzas)": p.faltante,
    "Estatus": p.pct >= 70 ? "Avanzado / Concluido" : p.pct >= 30 ? "En Proceso" : "Crítico / Rezago"
  }));
  const wsPlazas = XLSX.utils.json_to_sheet(plazasData);
  XLSX.utils.book_append_sheet(wb, wsPlazas, "Avance vs Objetivo Plazas");

  // Hoja 2: Rendimiento por Contratista
  const allRecords = state.records || [];
  const conMap = {};
  allRecords.forEach(r => {
    let c = (r.contratista_homologado || r.contratista || "S/A").trim();
    if (!conMap[c]) conMap[c] = { name: c, cajas: 0, casetas: 0, total: 0, plazas: new Set(), tecnicos: new Set() };
    if (r.tipo === "CASETA") conMap[c].casetas++;
    else conMap[c].cajas++;
    conMap[c].total++;
    if (r.area_trabajo) conMap[c].plazas.add(r.area_trabajo);
    if (r.tecnico) conMap[c].tecnicos.add(r.tecnico);
  });
  const conData = Object.values(conMap).sort((a,b) => b.total - a.total).map((c, idx) => ({
    "Ranking": idx + 1,
    "Empresa Contratista": c.name,
    "Plazas Atendidas": c.plazas.size,
    "Detalle de Plazas": Array.from(c.plazas).join(", "),
    "Cajas Intervenidas ($60)": c.cajas,
    "Casetas Intervenidas ($36)": c.casetas,
    "Total Piezas": c.total,
    "Técnicos Activos": c.tecnicos.size,
    "% Aportación": (c.total / allRecords.length * 100).toFixed(1) + "%"
  }));
  const wsCon = XLSX.utils.json_to_sheet(conData);
  XLSX.utils.book_append_sheet(wb, wsCon, "Ranking Contratistas");

  const todayStr = getLocalDateStr(new Date());
  XLSX.writeFile(wb, `Resumen_Operativo_Gerencial_Telmex_${todayStr}.xlsx`);
  showToast("✅ Archivo de Excel gerencial descargado con éxito", "success", 3000);
}

function printBossSummary() {
  const printWindow = window.open("", "_blank");
  const todayStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalDone = document.getElementById("bossKpiTotalDone")?.innerText || "0";
  const totalMeta = document.getElementById("bossKpiTotalMeta")?.innerText || "0";
  const totalPct = document.getElementById("bossKpiTotalPercent")?.innerText || "0%";
  const cajasDone = document.getElementById("bossKpiCajasDone")?.innerText || "0";
  const casetasDone = document.getElementById("bossKpiCasetasDone")?.innerText || "0";
  const conCount = document.getElementById("bossKpiContratistasCount")?.innerText || "0";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Resumen Operativo Gerencial - Telmex 2026</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 30px; color: #0f172a; font-size: 11px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0055a5; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: 900; color: #0055a5; }
        .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
        .kpis { display: flex; gap: 15px; margin-bottom: 20px; }
        .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
        .kpi-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .kpi-val { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
        th { background: #0055a5; color: white; padding: 6px; text-align: left; }
        td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">IASA / PCI | PROYECTO IMAGEN TELMEX 2026</div>
          <div class="subtitle">Tablero de Control Gerencial & Avance Operativo vs Metas</div>
        </div>
        <div style="text-align: right;">
          <div><b>Fecha de Emisión:</b> ${todayStr}</div>
          <div style="color: #64748b;">Filtros: Contratista [${bossState.contratista}], Estado [${bossState.estado}], Área [${bossState.area}]</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card">
          <div class="kpi-label">Avance Global</div>
          <div class="kpi-val">${totalDone} / ${totalMeta} (${totalPct})</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Cajas Realizadas</div>
          <div class="kpi-val">${cajasDone}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Casetas Realizadas</div>
          <div class="kpi-val">${casetasDone}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Contratistas Activos</div>
          <div class="kpi-val">${conCount}</div>
        </div>
      </div>

      <h3>Avance vs Objetivo por Plaza y Estado:</h3>
      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Plaza</th>
            <th>Contratistas</th>
            <th style="text-align: right;">Cajas</th>
            <th style="text-align: right;">Casetas</th>
            <th style="text-align: right;">Total Hecho</th>
            <th style="text-align: right;">Meta Total</th>
            <th style="text-align: center;">% Cumplimiento</th>
            <th style="text-align: right;">Faltante</th>
          </tr>
        </thead>
        <tbody>
          ${(bossState.cachedPlazasData || []).slice(0, 30).map(p => `
            <tr>
              <td><b>${p.estado}</b></td>
              <td>${p.area}</td>
              <td>${p.contratistas.slice(0, 2).join(', ')}</td>
              <td style="text-align: right;">${p.cajasDone} / ${p.cajasMeta}</td>
              <td style="text-align: right;">${p.casetasDone} / ${p.casetasMeta}</td>
              <td style="text-align: right; font-weight: bold;">${p.totalDone}</td>
              <td style="text-align: right;">${p.totalMeta}</td>
              <td style="text-align: center; font-weight: bold; color: ${p.pct >= 70 ? '#16a34a' : p.pct >= 30 ? '#d97706' : '#dc2626'};">${p.pct.toFixed(1)}%</td>
              <td style="text-align: right;">${p.faltante}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        window.onload = function() { window.print(); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

