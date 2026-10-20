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
// INICIALIZACIÓN
// =========================================================
const LIVE_DATA_VERSION = "2026-10-19-linkaform-live-v3";

document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  checkAndMigrateLiveData();
  loadRecords();
  loadMaterialsLog();
  recalculateSuministrosFromMaterialsLog();
  initFilters();
  initDatePresets();
  applyFilters();
  renderMaterialsConfigTable();
  renderMaterialsLogTable();
  updateSyncLabel();
});

// Auto-migración para cargar los 99 trabajos y 11 suministros oficiales de Linkaform
function checkAndMigrateLiveData() {
  const currentVer = localStorage.getItem("telmex_data_version");
  if (currentVer !== LIVE_DATA_VERSION && typeof LINKAFORM_LIVE_RECORDS !== "undefined") {
    state.records = LINKAFORM_LIVE_RECORDS;
    state.materialsLog = typeof LINKAFORM_LIVE_MATERIALS !== "undefined" ? LINKAFORM_LIVE_MATERIALS : [];
    localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
    localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
    localStorage.setItem("telmex_data_version", LIVE_DATA_VERSION);
    localStorage.setItem("telmex_dashboard_last_sync", "Sincronización Linkaform (99 trabajos, 11 entregas)");
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
}

// Cargar Registros (localStorage o LINKAFORM_LIVE_RECORDS)
function loadRecords() {
  const saved = localStorage.getItem("telmex_dashboard_records");
  if (saved) {
    try {
      state.records = JSON.parse(saved);
    } catch (e) {
      state.records = (typeof LINKAFORM_LIVE_RECORDS !== "undefined") ? LINKAFORM_LIVE_RECORDS : ((typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : []);
    }
  } else {
    state.records = (typeof LINKAFORM_LIVE_RECORDS !== "undefined") ? LINKAFORM_LIVE_RECORDS : ((typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : []);
  }
}

// Cargar Bitácora de Suministros de Materiales (Forma 184350)
function loadMaterialsLog() {
  const saved = localStorage.getItem("telmex_dashboard_materials_log");
  if (saved) {
    try {
      state.materialsLog = JSON.parse(saved);
    } catch (e) {
      state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") ? LINKAFORM_LIVE_MATERIALS : [];
    }
  } else {
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") ? LINKAFORM_LIVE_MATERIALS : [];
  }
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
  const estadoSelect = document.getElementById("filterEstado");
  const contratistaSelect = document.getElementById("filterContratista");

  // Poblar Estados desde CATALOGO_METAS
  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    const estados = Object.keys(CATALOGO_METAS.estados).sort();
    estados.forEach(est => {
      const opt = document.createElement("option");
      opt.value = est;
      opt.innerText = est;
      estadoSelect.appendChild(opt);
    });
  }

  // Poblar Contratistas únicos desde records
  populateContratistasFilter();
}

function populateContratistasFilter() {
  const contratistaSelect = document.getElementById("filterContratista");
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
  const estado = document.getElementById("filterEstado").value;
  const areaSelect = document.getElementById("filterArea");
  areaSelect.innerHTML = `<option value="">-- Todas las Áreas --</option>`;

  if (estado && typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados[estado]) {
    const areas = Object.keys(CATALOGO_METAS.estados[estado]).sort();
    areas.forEach(ar => {
      const opt = document.createElement("option");
      opt.value = ar;
      opt.innerText = ar;
      areaSelect.appendChild(opt);
    });
  }
  applyFilters();
}

function onPresetDateChange() {
  const preset = document.getElementById("filterPresetDate").value;
  const customContainer = document.getElementById("customDateContainer");

  if (preset === "custom") {
    customContainer.classList.remove("hidden");
  } else {
    customContainer.classList.add("hidden");
    applyFilters();
  }
}

function initDatePresets() {
  const today = new Date().toISOString().split("T")[0];
  const customDateTo = document.getElementById("customDateTo");
  const customDateFrom = document.getElementById("customDateFrom");
  if (customDateTo) customDateTo.value = today;
  if (customDateFrom) customDateFrom.value = "2026-10-01";
}

function resetFilters() {
  document.getElementById("filterEstado").value = "";
  document.getElementById("filterArea").innerHTML = `<option value="">-- Todas las Áreas --</option>`;
  document.getElementById("filterContratista").value = "";
  document.getElementById("filterTipo").value = "";
  document.getElementById("filterPresetDate").value = "all";
  document.getElementById("customDateContainer").classList.add("hidden");
  applyFilters();
}

// =========================================================
// APLICACIÓN DE FILTROS & CÁLCULOS
// =========================================================
function applyFilters() {
  const estVal = document.getElementById("filterEstado").value.trim().toUpperCase();
  const arVal = document.getElementById("filterArea").value.trim().toUpperCase();
  const contVal = document.getElementById("filterContratista").value.trim();
  const tipoVal = document.getElementById("filterTipo").value.trim().toUpperCase();
  const presetVal = document.getElementById("filterPresetDate").value;

  // Rango de fechas
  let minDate = null;
  let maxDate = null;
  const today = new Date();

  if (presetVal === "today") {
    minDate = today.toISOString().split("T")[0];
    maxDate = minDate;
  } else if (presetVal === "7days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    minDate = d.toISOString().split("T")[0];
    maxDate = today.toISOString().split("T")[0];
  } else if (presetVal === "30days") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    minDate = d.toISOString().split("T")[0];
    maxDate = today.toISOString().split("T")[0];
  } else if (presetVal === "custom") {
    minDate = document.getElementById("customDateFrom").value || null;
    maxDate = document.getElementById("customDateTo").value || null;
  }

  state.filteredRecords = state.records.filter(r => {
    if (estVal && r.estado && r.estado.toUpperCase() !== estVal) return false;
    if (arVal && r.area_trabajo && r.area_trabajo.toUpperCase() !== arVal) return false;
    if (contVal && r.contratista !== contVal) return false;
    if (tipoVal && r.tipo && r.tipo.toUpperCase() !== tipoVal) return false;
    
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
  const estVal = document.getElementById("filterEstado").value.trim().toUpperCase();
  const arVal = document.getElementById("filterArea").value.trim().toUpperCase();

  // Calcular metas correspondientes al filtro
  let totalMeta = 0;
  let cajasMeta = 0;
  let casetasMeta = 0;

  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    if (estVal && arVal && CATALOGO_METAS.estados[estVal] && CATALOGO_METAS.estados[estVal][arVal]) {
      const data = CATALOGO_METAS.estados[estVal][arVal];
      cajasMeta = data.cajas;
      casetasMeta = data.casetas;
      totalMeta = data.total;
    } else if (estVal && CATALOGO_METAS.estados[estVal]) {
      Object.values(CATALOGO_METAS.estados[estVal]).forEach(a => {
        cajasMeta += a.cajas;
        casetasMeta += a.casetas;
        totalMeta += a.total;
      });
    } else {
      totalMeta = CATALOGO_METAS.total_general;
      cajasMeta = CATALOGO_METAS.total_cajas;
      casetasMeta = CATALOGO_METAS.total_casetas;
    }
  }

  const cajasDone = filtered.filter(r => r.tipo === "CAJA").length;
  const casetasDone = filtered.filter(r => r.tipo === "CASETA").length;
  const totalDone = filtered.length;

  const totalPercent = totalMeta > 0 ? ((totalDone / totalMeta) * 100).toFixed(1) : "0.0";
  const cajasPercent = cajasMeta > 0 ? ((cajasDone / cajasMeta) * 100).toFixed(1) : "0.0";
  const casetasPercent = casetasMeta > 0 ? ((casetasDone / casetasMeta) * 100).toFixed(1) : "0.0";

  // Actualizar DOM KPIs
  document.getElementById("kpiTotalDone").innerText = totalDone.toLocaleString();
  document.getElementById("kpiTotalMeta").innerText = totalMeta.toLocaleString();
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
  
  const todayStr = new Date().toISOString().split("T")[0];
  const doneToday = filtered.filter(r => r.fecha === todayStr).length;

  document.getElementById("kpiAvgPerDay").innerHTML = `${avgPerDay.toLocaleString()} <span class="text-xs font-semibold text-slate-500">activos/día</span>`;
  document.getElementById("kpiDoneToday").innerText = `${doneToday.toLocaleString()} activos`;
  document.getElementById("kpiActiveDays").innerText = `${activeDays} días registrados`;
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

  const normArea = areaName.toUpperCase().trim();
  for (let edo in CATALOGO_METAS.estados) {
    for (let ar in CATALOGO_METAS.estados[edo]) {
      if (ar.toUpperCase().trim() === normArea || edo.toUpperCase().trim() === normArea) {
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
  if (!tbody) return;

  tbody.innerHTML = "";
  if (alertList) alertList.innerHTML = "";

  // 1. Actualizar Encabezados y Badges
  const badgeEl = document.getElementById("activeMaterialAreaBadge");
  const titleEl = document.getElementById("materialsTableTitle");
  const subEl = document.getElementById("materialsAreaSubtitle");

  if (badgeEl) {
    badgeEl.innerText = selectedArea ? `PLAZA: ${selectedArea}` : "TODAS LAS ÁREAS (CONSOLIDADO)";
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

  // 6. Recorrer cada material del catálogo
  state.config.materiales.forEach(mat => {
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
    tbody.appendChild(row);

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

  const areas = Array.from(areaSet).sort();
  if (areas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">No hay registros de materiales ni trabajos aún.</td></tr>`;
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
  tbody.innerHTML = "";

  // Agrupar registros por Estado y Área
  const areaCounts = {};
  filtered.forEach(r => {
    const key = `${r.estado || 'S/E'}|||${r.area_trabajo || 'S/A'}`;
    if (!areaCounts[key]) {
      areaCounts[key] = { estado: r.estado || 'S/E', area: r.area_trabajo || 'S/A', cajasDone: 0, casetasDone: 0, totalDone: 0 };
    }
    if (r.tipo === 'CASETA') {
      areaCounts[key].casetasDone++;
    } else {
      areaCounts[key].cajasDone++;
    }
    areaCounts[key].totalDone++;
  });

  // Combinar con metas del catálogo
  const areaRows = [];
  if (typeof CATALOGO_METAS !== "undefined" && CATALOGO_METAS.estados) {
    Object.keys(CATALOGO_METAS.estados).forEach(est => {
      Object.keys(CATALOGO_METAS.estados[est]).forEach(ar => {
        const metaData = CATALOGO_METAS.estados[est][ar];
        const key = `${est}|||${ar}`;
        const doneData = areaCounts[key] || { cajasDone: 0, casetasDone: 0, totalDone: 0 };
        
        const percent = metaData.total > 0 ? ((doneData.totalDone / metaData.total) * 100) : 0;

        areaRows.push({
          estado: est,
          area: ar,
          metaCajas: metaData.cajas,
          cajasDone: doneData.cajasDone,
          metaCasetas: metaData.casetas,
          casetasDone: doneData.casetasDone,
          metaTotal: metaData.total,
          totalDone: doneData.totalDone,
          percent: percent
        });
      });
    });
  }

  // Ordenar por total intervenido descendente
  areaRows.sort((a, b) => b.totalDone - a.totalDone);

  // Renderizar filas
  areaRows.forEach(item => {
    const pFormatted = item.percent.toFixed(1);
    let pBadgeClass = 'badge-danger';
    if (item.percent >= 50) pBadgeClass = 'badge-success';
    else if (item.percent >= 15) pBadgeClass = 'badge-warning';

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 area-table-row";
    tr.dataset.text = `${item.estado} ${item.area}`.toLowerCase();
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

  // Top 10 áreas para la gráfica
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

  // Promedios y Proyección
  const activeDays = Math.max(1, sortedDates.length);
  const avgPace = Math.round(filtered.length / activeDays);
  
  const avgLabel = document.getElementById("avgTrendLabel");
  const paceLabel = document.getElementById("paceCurrentLabel");
  const projDateLabel = document.getElementById("paceProjectedDate");

  if (avgLabel) avgLabel.innerText = `${avgPace} activos/día`;
  if (paceLabel) paceLabel.innerText = `${avgPace} activos/día`;

  if (projDateLabel) {
    const totalMeta = (typeof CATALOGO_METAS !== "undefined") ? CATALOGO_METAS.total_general : 138720;
    const remaining = Math.max(0, totalMeta - filtered.length);
    if (avgPace > 0) {
      const daysNeeded = Math.ceil(remaining / avgPace);
      const estDate = new Date();
      estDate.setDate(estDate.getDate() + daysNeeded);
      projDateLabel.innerText = estDate.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    } else {
      projDateLabel.innerText = "Sin datos suficientes";
    }
  }
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
      <td class="py-2.5 px-3 text-slate-600">${r.fecha || 'N/A'} <span class="text-[10px] text-slate-400 font-mono">${r.hora || ''}</span></td>
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
  renderMaterialsConfigTable();
  document.getElementById("materialsModal").classList.remove("hidden");
}

function closeMaterialsModal() {
  document.getElementById("materialsModal").classList.add("hidden");
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
// MODAL: SINCRONIZACIÓN LINKAFORM API
// =========================================================
function openSyncModal() {
  const modal = document.getElementById("syncModal");
  modal.classList.remove("hidden");

  // Cargar valores guardados o predeterminados
  const userEl = document.getElementById("inputUsername");
  if (userEl) {
    userEl.value = state.config.linkaform.username || "pahernandez@operacionpci.com.mx";
  }
  document.getElementById("inputApiKey").value = state.config.linkaform.apiKey || "003ab07a66c6795f8d3fcca2a3b6f94a7f06258e";
  document.getElementById("inputRecordsFormId").value = state.config.linkaform.recordsFormId || "142786";
  document.getElementById("inputMaterialsFormId").value = state.config.linkaform.materialsFormId || "184350";
  
  const statusMsg = document.getElementById("syncStatusMsg");
  statusMsg.classList.add("hidden");
}

function closeSyncModal() {
  document.getElementById("syncModal").classList.add("hidden");
}

async function handleLinkaformSync(e) {
  e.preventDefault();
  const userEl = document.getElementById("inputUsername");
  const username = userEl ? userEl.value.trim() : "pahernandez@operacionpci.com.mx";
  const apiKey = document.getElementById("inputApiKey").value.trim();
  const recordsFormId = document.getElementById("inputRecordsFormId").value.trim() || "142786";
  const materialsFormId = document.getElementById("inputMaterialsFormId").value.trim() || "184350";
  const statusMsg = document.getElementById("syncStatusMsg");
  const btn = document.getElementById("btnSubmitSync");

  if (!apiKey) {
    statusMsg.className = "p-3 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800 block";
    statusMsg.innerText = "Por favor ingresa tu API Key de Linkaform.";
    return;
  }

  // Guardar en config local
  state.config.linkaform.username = username;
  state.config.linkaform.apiKey = apiKey;
  state.config.linkaform.recordsFormId = recordsFormId;
  state.config.linkaform.materialsFormId = materialsFormId;
  localStorage.setItem("telmex_dashboard_config", JSON.stringify(state.config));

  btn.disabled = true;
  btn.innerHTML = `<span>⏳</span> <span>Conectando a Linkaform...</span>`;
  statusMsg.className = "p-3 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 block";
  statusMsg.innerText = "Autenticando con Linkaform API...";

  try {
    // Paso 1: Autenticación oficial Linkaform (JWT)
    statusMsg.innerText = "Paso 1/3: Autenticando usuario en Linkaform...";
    const loginResp = await fetch("https://app.linkaform.com/api/infosync/user_admin/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, api_key: apiKey })
    });

    if (!loginResp.ok) {
      let errDetail = "";
      try {
        const errJson = await loginResp.json();
        errDetail = errJson.error || errJson.detail || JSON.stringify(errJson);
      } catch (e) {
        errDetail = await loginResp.text();
      }
      throw new Error(`Fallo de autenticación en Linkaform (HTTP ${loginResp.status}): ${errDetail}. Verifique usuario (${username}) y API Key.`);
    }

    const loginData = await loginResp.json();
    const jwtToken = loginData.jwt;
    if (!jwtToken) {
      throw new Error("Linkaform no generó un token de sesión JWT válido.");
    }

    const authHeaders = {
      "Authorization": `Bearer ${jwtToken}`,
      "Content-Type": "application/json"
    };

    // Paso 2: Descargar Trabajos Realizados (Forma 142786)
    let recordsCount = 0;
    if (recordsFormId) {
      statusMsg.innerText = `Descargando trabajos de campo (Forma ${recordsFormId})...`;
      const url = `https://app.linkaform.com/api/infosync/form_answer/?form_id=${recordsFormId}&limit=1000`;
      const resp = await fetch(url, { headers: authHeaders });

      if (!resp.ok) {
        throw new Error(`Error en API Linkaform Forma ${recordsFormId} (HTTP ${resp.status}): Verifique el Token y permisos.`);
      }

      const data = await resp.json();
      const answers = data.data || data.results || data.objects || [];
      
      const mappedRecords = answers.map((item, idx) => {
        const answersObj = item.answers || {};
        
        // Manejo de fecha y hora
        let datePart = new Date().toISOString().split("T")[0];
        let timePart = "";
        if (typeof item.created_at === "number") {
          const d = new Date(item.created_at * 1000);
          datePart = d.toISOString().split("T")[0];
          timePart = d.toTimeString().substring(0, 5);
        } else if (typeof item.created_at === "string") {
          if (item.created_at.includes("T")) {
            datePart = item.created_at.split("T")[0];
            timePart = item.created_at.split("T")[1].substring(0, 5);
          } else {
            datePart = item.created_at.substring(0, 10);
            timePart = item.created_at.substring(11, 16);
          }
        }

        // Fotos antes y después
        const fotoAntesArr = answersObj["6a99e764f9c750d6db214c54"] || answersObj.foto_antes || [];
        const fotoDespuesArr = answersObj["6a99e764f9c750d6db214c55"] || answersObj.foto_despues || [];
        const fotoAntes = Array.isArray(fotoAntesArr) && fotoAntesArr.length > 0 ? (fotoAntesArr[0].file_url || fotoAntesArr[0].url || "") : "";
        const fotoDespues = Array.isArray(fotoDespuesArr) && fotoDespuesArr.length > 0 ? (fotoDespuesArr[0].file_url || fotoDespuesArr[0].url || "") : "";

        return {
          folio: item.folio || `LF-${item.id || (idx + 1)}`,
          fecha: datePart,
          hora: timePart,
          tipo: (answersObj["6ad52fc6bc424ea79992eabe"] || answersObj.tipo || "CAJA").toUpperCase(),
          identificador: answersObj["6ad52fc6bc424ea79992eabf"] || answersObj.distrito_telefono || `S/ID-${idx + 1}`,
          estado: (answersObj["6ad52fc6bc424ea79992eac0"] || answersObj.estado || "MORELOS").toUpperCase(),
          area_trabajo: (answersObj["6ad52fc6bc424ea79992eac1"] || answersObj.area_trabajo || "MORELOS").toUpperCase(),
          contratista: answersObj["6abe9357bef08742fcf94020"] || answersObj.contratista || "Victor Hugo Lopez Garcia",
          modelo: answersObj["6ab9d647dba7a0c191e6a0f6"] || answersObj.modelo || "Sencilla",
          oferta: answersObj["6a99eb8af9c750d6db214c5d"] || answersObj.oferta || "200 MB",
          existe_bd: answersObj["6ad530403c0c04d9bb2555b2"] || "Sí",
          comentarios: answersObj["6ad4df593c0c04d9bb25556e"] || "",
          latitud: answersObj["6ab6f3a4c472baf119e176e8"] || null,
          longitud: answersObj["6ab6f3a4c472baf119e176e9"] || null,
          foto_antes: fotoAntes,
          foto_despues: fotoDespues,
          estatus: item.status || "Aprobada"
        };
      });

      if (mappedRecords.length > 0) {
        state.records = mappedRecords;
        localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
        recordsCount = mappedRecords.length;
      }
    }

    // Paso 3: Descargar Control de Materiales (Forma 184350)
    let matCount = 0;
    if (materialsFormId) {
      statusMsg.innerText = `Descargando movimientos de materiales (Forma ${materialsFormId})...`;
      try {
        const matUrl = `https://app.linkaform.com/api/infosync/form_answer/?form_id=${materialsFormId}&limit=1000`;
        const matResp = await fetch(matUrl, { headers: authHeaders });

        if (matResp.ok) {
          const matData = await matResp.json();
          const matAnswers = matData.data || matData.results || matData.objects || [];
          
          state.materialsLog = matAnswers.map((item, idx) => {
            const a = item.answers || {};
            const photoArr = a["6ad69fb41583192abb37cdaa"] || a.evidencia || [];
            const photoUrl = Array.isArray(photoArr) && photoArr.length > 0 ? (photoArr[0].file_url || photoArr[0].url || "") : "";

            let fechaVal = a["6ad65b0b1b305d8b534b1e11"] || "";
            if (!fechaVal && item.created_at) {
              if (typeof item.created_at === "number") {
                fechaVal = new Date(item.created_at * 1000).toISOString().replace("T", " ").substring(0, 19);
              } else {
                fechaVal = item.created_at.substring(0, 19).replace("T", " ");
              }
            }

            let unidadVal = a["6ad695943f0d28deb4a6c9a4"] || a.unidad || "PZAS.";
            if (Array.isArray(unidadVal)) unidadVal = unidadVal[0] || "PZAS.";

            return {
              id: item.folio || item.id || `MAT-${idx + 1}`,
              area: (a["6ad695943f0d28deb4a6c9a3"] || a.area || "GENERAL").toUpperCase(),
              descripcion: (a["6ad692011583192abb37cd8f"] || a.descripcion || "MATERIAL").toUpperCase(),
              cantidad: parseFloat(a["6ad65b0b1b305d8b534b1e13"] || a.cantidad || 0),
              unidad: String(unidadVal).toUpperCase(),
              fecha: fechaVal,
              foto: photoUrl
            };
          });

          localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
          recalculateSuministrosFromMaterialsLog();
          matCount = state.materialsLog.length;
        }
      } catch (matErr) {
        console.warn("Advertencia al sincronizar materiales:", matErr);
      }
    }

    localStorage.setItem("telmex_dashboard_last_sync", new Date().toLocaleString("es-MX"));
    updateSyncLabel();
    populateContratistasFilter();
    applyFilters();
    renderMaterialsTab();
    renderMaterialsLogTable();

    statusMsg.className = "p-3 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 block";
    statusMsg.innerText = `✅ ¡Sincronización exitosa! Se descargaron ${recordsCount} trabajos (Forma ${recordsFormId}) y ${matCount} movimientos de materiales (Forma ${materialsFormId}).`;

  } catch (err) {
    statusMsg.className = "p-3 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800 block leading-relaxed";
    if (err.name === "TypeError" && (err.message.includes("fetch") || err.message.includes("Failed"))) {
      statusMsg.innerHTML = `⚠️ <strong>Nota sobre política de CORS del Navegador:</strong><br>` +
        `Las peticiones directas desde el navegador a la API de Linkaform pueden ser restringidas por CORS en dominios externos.<br><br>` +
        `✨ <strong>Los ${state.records.length} trabajos de campo y ${state.materialsLog.length} suministros ya están completamente integrados en el dashboard</strong>.<br>` +
        `Para refrescar datos nuevos en cualquier momento, puedes ejecutar <code class="bg-white px-1.5 py-0.5 rounded font-mono font-bold">python sync_linkaform.py</code> o cargar el archivo Excel en el botón <em>Cargar Datos</em>.`;
    } else {
      statusMsg.innerText = `Error: ${err.message}`;
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🚀 Iniciar Sincronización</span>`;
  }
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
            fecha: r["Fecha"] || r["fecha"] || r["created_at"] || new Date().toISOString().split("T")[0],
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
  populateContratistasFilter();
  applyFilters();
}

function restoreDefaultRecords() {
  const choice = confirm("¿Deseas restaurar los datos en vivo oficiales de Linkaform (99 trabajos y 11 suministros)?\n\nPresiona Aceptar para restaurar los datos oficiales de Linkaform.");
  if (choice) {
    state.records = (typeof LINKAFORM_LIVE_RECORDS !== "undefined") ? LINKAFORM_LIVE_RECORDS : ((typeof INITIAL_RECORDS !== "undefined") ? INITIAL_RECORDS : []);
    state.materialsLog = (typeof LINKAFORM_LIVE_MATERIALS !== "undefined") ? LINKAFORM_LIVE_MATERIALS : [];
    localStorage.setItem("telmex_dashboard_records", JSON.stringify(state.records));
    localStorage.setItem("telmex_dashboard_materials_log", JSON.stringify(state.materialsLog));
    localStorage.setItem("telmex_dashboard_last_sync", "Datos oficiales Linkaform restaurados");
    recalculateSuministrosFromMaterialsLog();
    updateSyncLabel();
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
  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Reporte_Materiales_Telmex_Por_Area_${dateStr}.xlsx`);
}

// Utilidad Formato de Números
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Math.round(num).toLocaleString("es-MX");
}
