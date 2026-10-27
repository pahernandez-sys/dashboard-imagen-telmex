/**
 * TELMEX 2026 - Control de Avance & Materiales
 * Lógica Principal del Dashboard Ejecutivo
 */

// Estado Global
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
const LIVE_DATA_VERSION = "2026-10-23-linkaform-cutoff-v12";
const EXCLUDED_MATERIALS = ["pintura_azul", "pintura_gris", "thinner", "sellador"];

// Obtener fecha local en formato YYYY-MM-DD evitando el desfase de zona horaria UTC
function getLocalDateStr(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =========================================================
// REGLAS OFICIALES DE CORTE TELMEX 2026 (10 PM - 10 AM)
// =========================================================
function getCutoffInfo(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  const hour = d.getHours();
  
  if (hour < 10) {
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
      statusMessage: `Reporte matutino cerrado al ${activeDateStr} (22:00 hrs). En período de entrega matutina. La jornada de hoy se liberará a las 10:00 AM.`,
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
  loadConfig();
  checkAndMigrateLiveData();
  loadRecords();
  loadMaterialsLog();
  recalculateSuministrosFromMaterialsLog();
  initFilters();
  initDatePresets();
  renderCutoffBanner();
  applyFilters();
  renderMaterialsConfigTable();
  renderMaterialsLogTable();
  updateSyncLabel();

  // Conexión y carga en tiempo real desde Supabase Cloud (< 100ms)
  loadDataFromSupabase();
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

async function loadDataFromSupabase(showNotification = false) {
  try {
    // 1. Obtener todas las evidencias paginadas en vivo desde Supabase Cloud
    const dbEvs = await fetchPagedFromSupabase("evidencias_telmex", "*", "fecha_captura.desc");
    let evCount = 0;
    if (Array.isArray(dbEvs) && dbEvs.length > 0) {
      state.records = dbEvs.map(r => ({
        folio: r.folio || "",
        fecha: r.fecha_captura ? r.fecha_captura.slice(0, 10) : "",
        fecha_captura: r.fecha_captura ? r.fecha_captura.slice(0, 10) : "",
        hora: r.fecha_captura ? r.fecha_captura.slice(11, 16) : "",
        fecha_corte: r.fecha_captura ? r.fecha_captura.slice(0, 10) : "",
        created_at_iso: r.fecha_captura || "",
        timestamp: r.fecha_captura ? (new Date(r.fecha_captura).getTime() / 1000) : 0,
        tipo: (r.tipo_elemento || "CASETA").toUpperCase(),
        identificador: r.asset_id || r.folio || "S/N",
        modelo: r.modelo || "",
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
      }));
      evCount = state.records.length;
      localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
    }

    // 2. Obtener todas las entregas de materiales en vivo
    const dbMats = await fetchPagedFromSupabase("materiales_telmex", "*", "fecha_entrega.desc");
    let matCount = 0;
    if (Array.isArray(dbMats) && dbMats.length > 0) {
      state.materialsLog = dbMats.map(m => ({
        id: m.folio || "",
        area: m.area_trabajo || "",
        descripcion: m.material || "",
        cantidad: m.cantidad || 0,
        unidad: "PZAS.",
        fecha: m.fecha_entrega ? m.fecha_entrega.slice(0, 10) : "",
        fecha_captura: m.fecha_entrega ? m.fecha_entrega.slice(0, 10) : "",
        hora: m.fecha_entrega ? m.fecha_entrega.slice(11, 16) : "",
        created_at_iso: m.fecha_entrega || "",
        foto: ""
      }));
      matCount = state.materialsLog.length;
      localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
    }

    if (evCount > 0 || matCount > 0) {
      const syncLabel = `Supabase Cloud (${evCount} trabajos, ${matCount} entregas)`;
      localStorage.setItem("telmex_dashboard_last_sync", syncLabel);
      recalculateSuministrosFromMaterialsLog();
      populateAreaFilter();
      populateContratistasFilter();
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
    state.records = LINKAFORM_LIVE_RECORDS;
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") ? LINKAFORM_LIVE_MATERIALS : [];
    localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
    localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
    localStorage.setItem("telmex_data_version", LIVE_DATA_VERSION);
    const syncText = `Sincronización Linkaform (${state.records.length} trabajos, ${state.materialsLog.length} entregas)`;
    localStorage.setItem("telmex_dashboard_last_sync", syncText);
  }
}

// Cargar Configuración de Materiales (localStorage o por defecto)
function loadConfig() {
  const saved = localStorage.getItem("telmex_dashboard_config");
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

// Cargar Registros (localStorage o LINKAFORM_LIVE_RECORDS)
function loadRecords() {
  const saved = localStorage.getItem("telmex_dashboard_records");
  let records = [];
  if (saved) {
    try {
      records = JSON.parse(saved);
    } catch (e) {
      records = [];
    }
  }
  const live = (typeof LINKAFORM_LIVE_RECORDS !== "undefined" && Array.isArray(LINKAFORM_LIVE_RECORDS)) ? LINKAFORM_LIVE_RECORDS : [];
  if (live.length > records.length) {
    records = live;
    localStorage.setItem("telmex_dashboard_records", JSON.stringify(records));
  } else if (records.length === 0) {
    records = (typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : [];
  }
  state.records = records;
}

// Cargar Bitácora de Suministros de Materiales (Forma 184350)
function loadMaterialsLog() {
  const saved = localStorage.getItem("telmex_dashboard_materials_log");
  let mats = [];
  if (saved) {
    try {
      mats = JSON.parse(saved);
    } catch (e) {
      mats = [];
    }
  }
  const live = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined" && Array.isArray(LINKAFORM_LIVE_MATERIALS)) ? LINKAFORM_LIVE_MATERIALS : [];
  if (live.length > mats.length) {
    mats = live;
    localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(mats));
  }
  state.materialsLog = mats;
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
  return String(str)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

// Recalcular Suministros de Materiales a partir de las entregas reales registradas
function recalculateSuministrosFromMaterialsLog() {
  if (!state.materialsLog || state.materialsLog.length === 0) return;

  const totalsByDesc = {};
  state.materialsLog.forEach(item => {
    const norm = normalizeMaterialStr(item.descripcion);
    const qty = parseFloat(item.cantidad) || 0;
    totalsByDesc[norm] = (totalsByDesc[norm] || 0) + qty;
  });

  state.config.materiales.forEach(mat => {
    const normId = normalizeMaterialStr(mat.id);
    const normName = normalizeMaterialStr(mat.nombre);
    let matchedQty = 0;

    for (let desc in totalsByDesc) {
      if (desc === normId || normName.includes(desc) || desc.includes(normId) || (mat.alias && mat.alias.some(a => normalizeMaterialStr(a) === desc))) {
        matchedQty += totalsByDesc[desc];
      }
    }

    if (matchedQty > 0) {
      mat.suministrado = matchedQty;
    }
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

  if (rAreaNorm === selNorm || rEstadoNorm === selNorm) return true;

  // Si selectedArea es una Región/División (ej. CDMX Y CONURBADA, GUADALAJARA, MONTERREY)
  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    for (let est in CATALOGO_METAS.estados) {
      if (normalizeAreaKey(est) === rAreaNorm) {
        for (let ar in CATALOGO_METAS.estados[est]) {
          if (normalizeAreaKey(ar) === selNorm) return true;
        }
      }
    }
  }
  return false;
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

  state.filteredRecords = state.records.filter(r => {
    if (arVal && !recordMatchesArea(r, arVal)) return false;
    if (tipoVal && r.tipo && r.tipo.toUpperCase() !== tipoVal) return false;
    
    // Regla de corte: si estamos en ventana congelada, ocultar registros capturados después de las 22:00
    if (cutoffInfo.isFrozen && r.created_at_iso && r.created_at_iso > cutoffInfo.maxVisibleDt) {
      return false;
    }

    if (minDate && r.fecha && r.fecha < minDate) return false;
    if (maxDate && r.fecha && r.fecha > maxDate) return false;

    return true;
  });

  state.currentPage = 1;

  // Renderizar vistas
  renderKpis();
  renderMaterialsTab();
  renderAreasTab();
  renderFechasTab();
  renderRecordsTable();
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
  const tipo = (rec.tipo || "").toUpperCase().trim();
  const modelo = (rec.modelo || "").toUpperCase().trim();

  if (tipo === "CASETA") {
    if (modelo.includes("MINI")) return "lateral_caseta_mini_200_mb";
    if (modelo.includes("SEMICIRCULAR")) return "semicircular_200_mb";
    return "lateral_caseta_normal_200_mb";
  } else {
    // CAJA
    if (modelo.includes("TRADICIONAL DOBLE")) return "tradicional_doble_200_mb";
    if (modelo.includes("SIECOR SENCILLA 1") || modelo.includes("SIECOR 1")) return "siecor_sencilla_1_pta._200_mb";
    if (modelo.includes("SIECOR SENCILLA 2") || modelo.includes("SIECOR 2")) return "siecor_sencilla_2_ptas._200_mb";
    if (modelo.includes("SIECOR DOBLE") || modelo.includes("SIECOR")) return "siecor_doble_2_ptas._200_mb";
    if (modelo.includes("ENVOLVENTE") || modelo.includes("ENVOLVELTE")) return "envolvelte_secillo_200_mb";
    if (modelo.includes("DESPLAZAMIENTO DOBLE") || modelo.includes("DEPLASAMIENTO DOBLE")) return "deplasamiento_doble_200_mb";
    if (modelo.includes("DESPLAZAMIENTO") || modelo.includes("DEPLASAMIENTO")) return "deplasamiento_sencilla_200_mb";
    return "tradicional_sencilla_200_mb"; // Tradicional sencilla / Krone / Estándar
  }
}

// Obtener cantidad real de viniles instalados en el activo reportado
function getRecordVinilCount(rec) {
  if (rec.num_viniles !== undefined && rec.num_viniles !== null && rec.num_viniles !== "") {
    const val = parseFloat(rec.num_viniles);
    if (!isNaN(val)) return val;
  }
  // Valor por defecto en campo si no fue capturado
  return (rec.tipo || "").toUpperCase().trim() === "CASETA" ? 2 : 1;
}

// Mapeo normalizado de la descripción de entrega (Forma 184350) al ID de material
function mapMaterialDescToId(desc) {
  const d = normalizeMaterialStr(desc);
  if (d.includes("lateral") && d.includes("mini")) return "lateral_caseta_mini_200_mb";
  if (d.includes("lateral")) return "lateral_caseta_normal_200_mb";
  if (d.includes("semicircular")) return "semicircular_200_mb";
  if (d.includes("tradicional") && d.includes("doble")) return "tradicional_doble_200_mb";
  if (d.includes("tradicional")) return "tradicional_sencilla_200_mb";
  if (d.includes("siecor") && d.includes("1")) return "siecor_sencilla_1_pta._200_mb";
  if (d.includes("siecor") && d.includes("2") && !d.includes("doble")) return "siecor_sencilla_2_ptas._200_mb";
  if (d.includes("siecor") && d.includes("doble")) return "siecor_doble_2_ptas._200_mb";
  if (d.includes("envolvente") || d.includes("envolvelte")) return "envolvelte_secillo_200_mb";
  if (d.includes("desplazamiento") && d.includes("doble")) return "deplasamiento_doble_200_mb";
  if (d.includes("desplazamiento")) return "deplasamiento_sencilla_200_mb";
  if (d.includes("pintura") && d.includes("azul")) return "pintura_azul";
  if (d.includes("pintura") && d.includes("gris")) return "pintura_gris";
  if (d.includes("thinner")) return "thinner";
  if (d.includes("sellador")) return "sellador";
  return d;
}

// Metas del Área
function getAreaMetas(areaName) {
  if (!areaName || typeof CATALOGO_METAS === "undefined" || !CATALOGO_METAS.estados) {
    return {
      cajas: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_cajas : 92844,
      casetas: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_casetas : 45876,
      total: (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_general : 138720
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
  const query = document.getElementById("searchRecordsInput").value.trim().toLowerCase();
  if (!query) {
    applyFilters();
    return;
  }
  state.filteredRecords = state.records.filter(r => {
    return (r.folio && r.folio.toLowerCase().includes(query)) ||
           (r.identificador && r.identificador.toLowerCase().includes(query)) ||
           (r.area_trabajo && r.area_trabajo.toLowerCase().includes(query)) ||
           (r.contratista && r.contratista.toLowerCase().includes(query));
  });
  state.currentPage = 1;
  renderRecordsTable();
}

// =========================================================
// CAMBIO DE PESTAÑAS (TABS)
// =========================================================
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

  const targetContent = document.getElementById(tabId);
  if (targetContent) targetContent.classList.remove("hidden");

  // Activar botón
  const btns = Array.from(document.querySelectorAll(".tab-btn"));
  const clickedBtn = btns.find(b => b.getAttribute("onclick") && b.getAttribute("onclick").includes(tabId));
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
  if (syncText) syncText.innerText = "Sincronizando...";

  showToast("🔄 Conectando con Linkaform y actualizando registros y reporte...", "info", 0);

  let syncSuccess = false;

  // Paso 1: Intentar sincronización directa vía Servicio Local HTTP Bridge (si está activo en la máquina)
  try {
    const localCtrl = new AbortController();
    const localTimeout = setTimeout(() => localCtrl.abort(), 40000);
    const localResp = await fetch("http://127.0.0.1:8765/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: localCtrl.signal
    });
    clearTimeout(localTimeout);

    if (localResp.ok) {
      const res = await localResp.json();
      if (res.success) {
        syncSuccess = true;
        // 1. Adoptar los datos devueltos directamente por el servicio local en memoria (actualización instantánea)
        if (Array.isArray(res.records) && res.records.length > 0) {
          state.records = res.records;
          localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
        } else {
          await reloadLiveDataScript();
          checkAndMigrateLiveData();
          loadRecords();
        }

        if (Array.isArray(res.materials) && res.materials.length > 0) {
          state.materialsLog = res.materials;
          localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
        } else {
          loadMaterialsLog();
        }

        recalculateSuministrosFromMaterialsLog();
        const nowStr = new Date().toLocaleString("es-MX");
        localStorage.setItem("telmex_dashboard_last_sync", nowStr);
        populateAreaFilter();
        populateContratistasFilter();
        applyFilters();
        renderMaterialsTab();
        renderMaterialsLogTable();
        updateSyncLabel();

        showToast(`✅ ${res.message || "Sincronización completada con éxito. Reporte Diario actualizado."}`, "success", 6000);
      }
    }
  } catch (localErr) {
    console.log("Servicio local no activo o timeout, procediendo con sincronización directa:", localErr.message);
  }

  // Paso 2: Si no se utilizó el servicio local, refrescar directamente desde Supabase Cloud
  if (!syncSuccess) {
    try {
      await loadDataFromSupabase(true);
      syncSuccess = true;
    } catch (err) {
      console.warn("Aviso en sincronización remota:", err.message);
      showToast(`✅ Datos activos: ${state.records.length} trabajos y ${state.materialsLog.length} entregas.`, "info", 4000);
    }
  } else {
    // Si fue por servicio local, refrescar datos desde Supabase
    await loadDataFromSupabase(false);
  }

  if (btn) btn.disabled = false;
  if (syncIcon) syncIcon.className = "inline-block";
  if (syncText) syncText.innerText = "Sincronizar Linkaform";
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
  localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
  localStorage.setItem("telmex_dashboard_last_sync", `Archivo: ${fileName} (${new Date().toLocaleTimeString("es-MX")})`);
  
  const statusEl = document.getElementById("fileImportStatus");
  statusEl.className = "mt-3 p-3 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 block";
  statusEl.innerText = `✅ ¡Éxito! Se cargaron ${count.toLocaleString()} ${typeLabel} correctamente.`;

  updateSyncLabel();
  populateAreaFilter();
  populateContratistasFilter();
  applyFilters();
}

function restoreDefaultRecords() {
  const choice = confirm("¿Deseas restaurar los datos en vivo oficiales de Linkaform (107 trabajos y 10 suministros)?\n\nPresiona Aceptar para restaurar los datos oficiales de Linkaform.");
  if (choice) {
    state.records = (typeof LINKAFORM_LIVE_RECORDS !== "undefined") ? LINKAFORM_LIVE_RECORDS : ((typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : []);
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") ? LINKAFORM_LIVE_MATERIALS : [];
    localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
    localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
    localStorage.setItem("telmex_dashboard_last_sync", "Datos oficiales Linkaform restaurados");
    recalculateSuministrosFromMaterialsLog();
    updateSyncLabel();
    populateAreaFilter();
    populateContratistasFilter();
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
