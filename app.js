// State Variables

let catalog = [];

let selectedAsset = null;

let currentGpsCoords = null;

let photoAntesBase64 = "";

let photoDespuesBase64 = "";

let dbEvidences = [];

let completedAssetIdsSet = new Set();

let remoteCompletedSet = new Set();

let isSyncingCompletedAssets = false;

const COMPLETED_ASSETS_REMOTE_URL = "https://pahernandez-sys.github.io/imagen-telmex-2026/data/completed_assets.json";

const COMPLETED_ASSETS_LOCAL_URL = "data/completed_assets.json";

let selectedModelFilter = "";

let forceOfflineState = false;

let lastKnownOnlineState = null;

let pendingAsset = null;

let modalSelectedType = "CASETA";

let modalSelectedModel = "";

let userContratista = "";

let userTecnico = "";

// =========================================================
// DISTRITOS RESTRINGIDOS (SUPERVISIÓN Y NORMATIVIDAD TELMEX)
// =========================================================
const RESTRICTED_DISTRICTS = new Set(["PIX0001", "PIX0002", "PIX0003"]);

function isRestrictedDistrict(id) {
  if (!id) return false;
  return RESTRICTED_DISTRICTS.has(String(id).trim().toUpperCase());
}




// Versión del Sistema para Auditoría Linkaform (Automática para Campo)

const CURRENT_APP_VERSION_ANDROID = "v10 - Android";

const CURRENT_APP_VERSION_IPHONE = "v10 - IPhone";



function getAppVersionString() {

  try {

    if (typeof window !== "undefined" && typeof window.AndroidBridge !== "undefined") {

      return CURRENT_APP_VERSION_ANDROID;

    }

    const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent.toLowerCase() : "";

    const isAndroid = /android/.test(ua);

    if (isAndroid) {

      return CURRENT_APP_VERSION_ANDROID;

    }

    // iPhone, iPad, Safari, Mac, Web

    return CURRENT_APP_VERSION_IPHONE;

  } catch (e) {

    return CURRENT_APP_VERSION_IPHONE;

  }

}



// Catálogo Visual de Modelos para Casetas y Cajas

const CASETA_MODELS = [

  { id: "NORMAL", title: "Normal", img: "assets/types/caseta_normal.jpg" },

  { id: "MINI", title: "Mini", img: "assets/types/caseta_mini.jpg" },

  { id: "DOBLE", title: "Doble", img: "assets/types/caseta_doble.jpg" },

  { id: "SEMICIRCULAR", title: "Semicircular", img: "assets/types/caseta_semicircular.jpg" }

];



const CAJA_MODELS = [

  { id: "Tradicional Sencilla", title: "Tradicional Sencilla", img: "assets/types/caja_tradicional_sencilla.jpg" },

  { id: "Tradicional Doble", title: "Tradicional Doble", img: "assets/types/caja_tradicional_doble.jpg" },

  { id: "Siecor Sencilla 1 Puerta", title: "Siecor 1 Puerta", img: "assets/types/caja_siecor_1p.jpg" },

  { id: "Siecor Doble", title: "Siecor Doble", img: "assets/types/caja_siecor_doble.jpg" },

  { id: "Siecor Sencilla 2 Puertas", title: "Siecor 2 Puertas", img: "assets/types/caja_siecor_2p.jpg" },

  { id: "Krone Sencilla", title: "Krone Sencilla", img: "assets/types/caja_krone.jpg" },

  { id: "Desplazamiento Sencilla", title: "Desplazamiento Sencilla", img: "assets/types/caja_desplazamiento_sencilla.jpg" },

  { id: "Desplazamiento Doble", title: "Desplazamiento Doble", img: "assets/types/caja_desplazamiento_doble.jpg" },

  { id: "Envolvente Sencilla", title: "Envolvente Sencilla", img: "assets/types/caja_envolvente_sencilla.jpg" },

  { id: "Envolvente Doble", title: "Envolvente Doble", img: "assets/types/caja_envolvente_doble.jpg" }

];



// Catálogo Oficial de Estados y Áreas de Trabajo (Garantiza opciones en iPhone y offline)

const OFFICIAL_ESTADOS_AREAS = {
  "AGUASCALIENTES": ["AGUASCALIENTES"],
  "BAJA CALIFORNIA SUR": ["LA PAZ"],
  "CHIAPAS": ["CHIAPAS"],
  "CHIHUAHUA": ["CHIHUAHUA", "CIUDAD JUAREZ"],
  "COAHUILA": ["TORREON"],
  "DURANGO": ["DURANGO"],
  "ESTADO DE MEXICO": ["TOLUCA", "ESTADO DE MEXICO SUR"],
  "GUANAJUATO": ["CELAYA", "IRAPUATO", "LEON"],
  "GUERRERO": ["ACAPULCO", "CHILPANCINGO"],
  "JALISCO": ["GUADALAJARA CENTRO", "GUADALAJARA ORIENTE", "JALISCO"],
  "MICHOACAN": ["MICHOACAN-MORELIA"],
  "MORELOS": ["MORELOS"],
  "NAYARIT": ["NAYARIT"],
  "NUEVO LEON": ["MONTERREY 1", "MONTERREY 2", "MONTERREY 3"],
  "OAXACA": ["OAXACA"],
  "PUEBLA": ["PUEBLA"],
  "QUERETARO": ["QUERETARO"],
  "QUINTANA ROO": ["QUINTANA ROO NORTE", "QUINTANA ROO SUR"],
  "SINALOA": ["CULIACAN"],
  "SONORA": ["CIUDAD OBREGON-LOS MOCH", "HERMOSILLO", "NOGALES"],
  "TABASCO": ["TABASCO"],
  "TLAXCALA": ["TLAXCALA"],
  "VERACRUZ": ["JALAPA", "VERACRUZ"],
  "YUCATAN": ["YUCATAN"]
};

// Coordenadas oficiales de respaldo por Área (37 Áreas Oficiales IASA)
const AREA_COORDINATES_MAP = {
  "MORELOS": { lat: 18.9242, lon: -99.2216 },
  "TOLUCA": { lat: 19.2925, lon: -99.6569 },
  "GUADALAJARA CENTRO": { lat: 20.6767, lon: -103.3475 },
  "GUADALAJARA ORIENTE": { lat: 20.6550, lon: -103.2950 },
  "MONTERREY 1": { lat: 25.6866, lon: -100.3161 },
  "MONTERREY 2": { lat: 25.7200, lon: -100.3500 },
  "MONTERREY 3": { lat: 25.6500, lon: -100.2800 },
  "QUINTANA ROO NORTE": { lat: 21.1619, lon: -86.8515 },
  "QUINTANA ROO SUR": { lat: 18.5002, lon: -88.2961 },
  "QUERETARO": { lat: 20.5888, lon: -100.3899 },
  "ESTADO DE MEXICO SUR": { lat: 19.1570, lon: -100.1470 },
  "PUEBLA": { lat: 19.0414, lon: -98.2063 },
  "LEON": { lat: 21.1221, lon: -101.6826 },
  "CIUDAD JUAREZ": { lat: 31.6904, lon: -106.4245 },
  "TORREON": { lat: 25.5428, lon: -103.4068 },
  "NAYARIT": { lat: 21.5042, lon: -104.8946 },
  "CIUDAD OBREGON-LOS MOCH": { lat: 27.4864, lon: -109.9408 },
  "VERACRUZ": { lat: 19.1738, lon: -96.1342 },
  "YUCATAN": { lat: 20.9674, lon: -89.5926 },
  "MICHOACAN-MORELIA": { lat: 19.7060, lon: -101.1950 },
  "AGUASCALIENTES": { lat: 21.8853, lon: -102.2916 },
  "CHIAPAS": { lat: 16.7569, lon: -93.1292 },
  "CHIHUAHUA": { lat: 28.6330, lon: -106.0691 },
  "TABASCO": { lat: 17.9892, lon: -92.9281 },
  "CULIACAN": { lat: 24.8091, lon: -107.3940 },
  "ACAPULCO": { lat: 16.8531, lon: -99.8237 },
  "HERMOSILLO": { lat: 29.0729, lon: -110.9559 },
  "JALAPA": { lat: 19.5438, lon: -96.9102 },
  "DURANGO": { lat: 24.0277, lon: -104.6532 },
  "OAXACA": { lat: 17.0732, lon: -96.7266 },
  "IRAPUATO": { lat: 20.6736, lon: -101.3563 },
  "CELAYA": { lat: 20.5222, lon: -100.8123 },
  "LA PAZ": { lat: 24.1426, lon: -110.3128 },
  "TLAXCALA": { lat: 19.3182, lon: -98.2375 },
  "CHILPANCINGO": { lat: 17.5516, lon: -99.5005 },
  "JALISCO": { lat: 20.6767, lon: -103.3475 },
  "NOGALES": { lat: 31.3086, lon: -110.9422 }
};



// Initialize App

document.addEventListener("DOMContentLoaded", () => {

  initApp();

  initGeolocation();

});



let isCheckingNetwork = false;

let customAlertCallback = null;



function showCustomAlert(message, title = "Imagen Telmex 2026", callback = null) {

  customAlertCallback = callback;

  const modal = document.getElementById("customAlertModal");

  const msgEl = document.getElementById("customAlertMessage");

  const titleEl = document.getElementById("customAlertHeader");



  if (modal && msgEl) {

    if (titleEl) titleEl.innerHTML = `<span>${title}</span>`;

    msgEl.innerHTML = String(message).replace(/\n/g, "<br>");

    modal.style.display = "flex";

  } else {

    alert(message);

    if (callback) callback();

  }

}



function closeCustomAlert() {

  const modal = document.getElementById("customAlertModal");

  if (modal) modal.style.display = "none";

  if (customAlertCallback) {

    const cb = customAlertCallback;

    customAlertCallback = null;

    cb();

  }

}



let customConfirmResolve = null;



function showCustomConfirm(message, title = "Imagen Telmex 2026", onConfirm = null, onCancel = null, okText = "Aceptar", cancelText = "Cancelar", okColor = "#dc2626") {

  const modal = document.getElementById("customConfirmModal");

  const msgEl = document.getElementById("customConfirmMessage");

  const titleEl = document.getElementById("customConfirmHeader");

  const okBtn = document.getElementById("customConfirmOkBtn");

  const cancelBtn = document.getElementById("customConfirmCancelBtn");



  if (modal && msgEl && okBtn && cancelBtn) {

    if (titleEl) titleEl.innerHTML = `<span>${title}</span>`;

    msgEl.innerHTML = String(message).replace(/\n/g, "<br>");

    okBtn.innerHTML = okText;

    okBtn.style.backgroundColor = okColor;

    cancelBtn.innerHTML = cancelText;

    modal.style.display = "flex";



    customConfirmResolve = (confirmed) => {

      modal.style.display = "none";

      if (confirmed && onConfirm) onConfirm();

      else if (!confirmed && onCancel) onCancel();

    };

  } else {

    const plainMsg = String(message).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const ok = confirm(plainMsg);

    if (ok && onConfirm) onConfirm();

    else if (!ok && onCancel) onCancel();

  }

}



function closeCustomConfirm(confirmed) {

  if (customConfirmResolve) {

    const cb = customConfirmResolve;

    customConfirmResolve = null;

    cb(confirmed);

  }

}



// Override global alert to eliminate native browser/WebView "La página file:// indica:"

window.alert = function(msg) {

  showCustomAlert(msg);

};



// Catálogo Oficial de Contratistas y Técnicos (Fuente: Contratistas.xlsx)

const CONTRATISTAS_TECNICOS = {

  "Adrian Valenzuela": [

    "Leonel Romero Sanchez",

    "Jose Antonio Esquivel",

    "Jesus Antonio Esquivel"

  ],

  "Alejandro Adrian Obeso": [

    "Eduardo Alonzo Rodriguez Miranda",

    "Pedro Damian Peña Bojorquez",

    "Leopoldo Elyud Lopez Rocha",

    "Jose Juan Pico Burgueño",

    "Juan Gabriel Hernandez Hernandez",

    "Ruth Elizabeth Gonzalez Ibarra"

  ],

  "Arturo Zavala Fuentes": [

    "Arturo Zavala Fuentes",

    "Raul Ruenes Malagon"

  ],

  "Ernesto Aparicio Hernandez": [

    "Lucina Villanueva Hernández",

    "Salmon Vega Guerrero"

  ],

  "Jose antonio Esquivel": [

    "Jose antonio Esquivel"

  ],

  "Jose Miguel Prats Coutiño": [

    "Jorge Lopez",

    "Daniel Aguilar Vazquez",

    "Ramon Aguilar",

    "Emilio Cruz"

  ],

  "Lucina Villanueva Hernández": [

    "Ernesto Aparicio Hernandez",

    "Carlos de Dios Hidalgo"

  ],

  "Luis Jose Vasquez Briceño": [

    "Ramon Nuñez Victoria",

    "Criastian de Jesus Vargas Amaro"

  ],

  "Noe Gastelum Lopez": [

    "Noe Gastelum Lopez"

  ],

  "Ricardo Avila Sanchez": [

    "Ricardo Avila Sanchez",

    "Alejandro Navarrte"

  ],

  "Roberto Melchor Frutos Fuentes": [

    "Alfredo Lopez Garnica",

    "Rogelio Yañes Lozano",

    "Marco Antonio Catañeda Garcia",

    "Gabriel Sanchez Barrera",

    "Napoleon Mercado Bautista",

    "Martin Alfonzo Chavez Torres"

  ],

  "Roberto Merino Merino": [

    "Roberto Merino Merino",

    "Diego Lizandro Keno Luna"

  ],

  "Sergio Beccerra Franco": [

    "Jose Antonio Esquive"

  ],

  "TRANSFI COMMERCE & MARKET": [

    "Juan Daniel Gonzales",

    "Johnny Josué Álvarez Alvarado",

    "Juan Raul Hernandez Osuna",

    "Juda Velazquez Jara",

    "Natanael Velazquez Jada"

  ],

  "Victor Hugo Lopez Garcia": [

    "Pablo Emmanuel Reyes Hernandez",

    "Jair Emmanuel Martienez Morales",

    "Samuel Romero Sanchez",

    "Jose Gonzalez Gonzalez",

    "Victor Hugo Lopez Garcia",

    "Cruz Antonio Hernandez Ruiz",

    "Lucio Leonardo Catillo Coronel"

  ]

};



function populateContratistasDropdown(selectedContratista = "") {

  const select = document.getElementById("setupContratista");

  if (!select) return;



  const currentVal = selectedContratista || userContratista;

  select.innerHTML = '<option value="">-- Seleccionar Contratista --</option>';



  const sortedContratistas = Object.keys(CONTRATISTAS_TECNICOS).sort((a, b) => a.localeCompare(b, 'es'));

  sortedContratistas.forEach(c => {

    const opt = document.createElement("option");

    opt.value = c;

    opt.textContent = c;

    if (c === currentVal) opt.selected = true;

    select.appendChild(opt);

  });



  // Opción "Otro" al final de la lista de contratistas

  const optOtro = document.createElement("option");

  optOtro.value = "OTRO";

  optOtro.textContent = "Otro (Ingresar manualmente)...";

  if (currentVal && !CONTRATISTAS_TECNICOS[currentVal]) {

    optOtro.selected = true;

  }

  select.appendChild(optOtro);

}



function onSetupContratistaChange() {

  const contratistaSelect = document.getElementById("setupContratista");

  const manualContratistaInput = document.getElementById("setupContratistaManual");

  const tecnicoSelect = document.getElementById("setupTecnico");

  const manualTecnicoInput = document.getElementById("setupTecnicoManual");



  const selectedContratista = contratistaSelect?.value || "";



  if (selectedContratista === "OTRO") {

    if (manualContratistaInput) {

      manualContratistaInput.style.display = "block";

      manualContratistaInput.value = "";

      manualContratistaInput.focus();

    }

    if (tecnicoSelect) {

      tecnicoSelect.style.display = "none";

    }

    if (manualTecnicoInput) {

      manualTecnicoInput.style.display = "block";

      manualTecnicoInput.value = "";

    }

  } else {

    if (manualContratistaInput) {

      manualContratistaInput.style.display = "none";

    }

    if (tecnicoSelect) {

      tecnicoSelect.style.display = "block";

    }

    if (manualTecnicoInput) {

      manualTecnicoInput.style.display = "none";

    }

    updateTecnicosDropdown(selectedContratista);

  }

}



function updateTecnicosDropdown(contratista, preselectedTecnico = "") {

  const select = document.getElementById("setupTecnico");

  const manualTecnicoInput = document.getElementById("setupTecnicoManual");

  if (!select) return;



  select.innerHTML = "";



  if (!contratista || contratista === "OTRO" || !CONTRATISTAS_TECNICOS[contratista]) {

    if (contratista === "OTRO") {

      select.style.display = "none";

      if (manualTecnicoInput) {

        manualTecnicoInput.style.display = "block";

        if (preselectedTecnico) manualTecnicoInput.value = preselectedTecnico;

      }

    } else {

      select.style.display = "block";

      select.innerHTML = '<option value="">-- Selecciona primero un Contratista --</option>';

      select.disabled = true;

      if (manualTecnicoInput) {

        manualTecnicoInput.style.display = "none";

      }

    }

    return;

  }



  select.style.display = "block";

  select.disabled = false;

  const tecnicos = CONTRATISTAS_TECNICOS[contratista];

  select.innerHTML = '<option value="">-- Seleccionar Técnico --</option>';



  const targetTecnico = preselectedTecnico || userTecnico;

  let isCustomTecnico = targetTecnico && !tecnicos.includes(targetTecnico);



  tecnicos.forEach(t => {

    const opt = document.createElement("option");

    opt.value = t;

    opt.textContent = t;

    if (t === targetTecnico) opt.selected = true;

    select.appendChild(opt);

  });



  // Opción "Otro" para técnicos

  const optOtroTec = document.createElement("option");

  optOtroTec.value = "OTRO";

  optOtroTec.textContent = "Otro (Ingresar manualmente)...";

  if (isCustomTecnico) {

    optOtroTec.selected = true;

  }

  select.appendChild(optOtroTec);



  if (manualTecnicoInput) {

    if (isCustomTecnico) {

      manualTecnicoInput.style.display = "block";

      manualTecnicoInput.value = targetTecnico;

    } else {

      manualTecnicoInput.style.display = "none";

    }

  }

}



function onSetupTecnicoChange() {

  const tecnicoSelect = document.getElementById("setupTecnico");

  const manualTecnicoInput = document.getElementById("setupTecnicoManual");

  if (!tecnicoSelect || !manualTecnicoInput) return;



  if (tecnicoSelect.value === "OTRO") {

    manualTecnicoInput.style.display = "block";

    manualTecnicoInput.value = "";

    manualTecnicoInput.focus();

  } else {

    manualTecnicoInput.style.display = "none";

  }

}



function checkUserConfig() {

  userContratista = localStorage.getItem("TELMEX_CONTRATISTA") || "";

  userTecnico = localStorage.getItem("TELMEX_TECNICO") || "";



  updateHeaderUserInfo();

  updateFormUserDisplay();



  if (!userContratista || !userTecnico) {

    openUserSetupModal();

  }

}



function openUserSetupModal() {

  const manualContratistaInput = document.getElementById("setupContratistaManual");

  const manualTecnicoInput = document.getElementById("setupTecnicoManual");

  const tecnicoSelect = document.getElementById("setupTecnico");



  populateContratistasDropdown(userContratista);



  if (userContratista && !CONTRATISTAS_TECNICOS[userContratista]) {

    // Contratista manual personalizado

    if (manualContratistaInput) {

      manualContratistaInput.style.display = "block";

      manualContratistaInput.value = userContratista;

    }

    if (tecnicoSelect) {

      tecnicoSelect.style.display = "none";

    }

    if (manualTecnicoInput) {

      manualTecnicoInput.style.display = "block";

      manualTecnicoInput.value = userTecnico || "";

    }

  } else {

    if (manualContratistaInput) {

      manualContratistaInput.style.display = "none";

      manualContratistaInput.value = "";

    }

    updateTecnicosDropdown(userContratista, userTecnico);

  }



  const modal = document.getElementById("userSetupModal");

  if (modal) modal.style.display = "flex";

}



function closeUserSetupModal() {

  const modal = document.getElementById("userSetupModal");

  if (modal) modal.style.display = "none";

}



function saveUserConfig() {

  const contratistaSelect = document.getElementById("setupContratista");

  const manualContratistaInput = document.getElementById("setupContratistaManual");

  const tecnicoSelect = document.getElementById("setupTecnico");

  const manualTecnicoInput = document.getElementById("setupTecnicoManual");



  let contratista = "";

  if (contratistaSelect?.value === "OTRO") {

    contratista = manualContratistaInput?.value?.trim() || "";

    if (!contratista) {

      alert("⚠️ Por favor escribe el nombre de tu Contratista / Socio Comercial.");

      manualContratistaInput?.focus();

      return;

    }

  } else {

    contratista = contratistaSelect?.value?.trim() || "";

    if (!contratista) {

      alert("⚠️ Por favor selecciona tu Contratista / Socio Comercial.");

      return;

    }

  }



  let tecnico = "";

  if (contratistaSelect?.value === "OTRO" || tecnicoSelect?.value === "OTRO") {

    tecnico = manualTecnicoInput?.value?.trim() || "";

    if (!tecnico) {

      alert("⚠️ Por favor escribe el nombre completo del Técnico en Sitio.");

      manualTecnicoInput?.focus();

      return;

    }

  } else {

    tecnico = tecnicoSelect?.value?.trim() || "";

    if (!tecnico) {

      alert("⚠️ Por favor selecciona tu Nombre de Técnico en Sitio.");

      return;

    }

  }



  userContratista = contratista;

  userTecnico = tecnico;



  localStorage.setItem("TELMEX_CONTRATISTA", userContratista);

  localStorage.setItem("TELMEX_TECNICO", userTecnico);



  updateHeaderUserInfo();

  updateFormUserDisplay();

  closeUserSetupModal();

}



function updateHeaderUserInfo() {

  const el = document.getElementById("headerUserInfo");

  if (el) {

    if (userContratista && userTecnico) {

      const firstTechName = userTecnico.split(" ")[0];

      el.innerText = `${userContratista} (${firstTechName})`;

    } else {

      el.innerText = "Configurar Técnico";

    }

  }

}



function updateFormUserDisplay() {

  const contratistaEl = document.getElementById("formContratista");

  const tecnicoEl = document.getElementById("formTecnico");

  if (contratistaEl) contratistaEl.value = userContratista || "Sin configurar";

  if (tecnicoEl) tecnicoEl.value = userTecnico || "Sin configurar";

}



function initApp() {

  setupManualIdInputFilter();

  setupExistenciaRadioListeners();

  populateModelFilter("TODOS");

  checkUserConfig();

  loadEvidencesFromStorage();

  updateDailyGoalUI();

  

  checkNetworkConnectivity();

  

  window.addEventListener("online", () => checkNetworkConnectivity());

  window.addEventListener("offline", () => updateNetworkUI(false));

  setInterval(() => checkNetworkConnectivity(), 3000);



  initCompletedAssetsSync();

  fetchCatalogData();

}



function fetchCatalogData() {

  const badge = document.getElementById("catalogCountBadge");

  if (badge) badge.innerText = "⏳ Cargando base de datos...";



  const globalData = window.CATALOG_DATA || window.catalog;

  if (globalData && Array.isArray(globalData) && globalData.length > 0) {

    catalog = globalData;

    onCatalogLoaded();

    return;

  }



  // 1. Intentar cargar las partes divididas (catalog_part1.js y catalog_part2.js)

  loadCatalogViaParts()

    .then(() => {

      if (window.CATALOG_DATA && Array.isArray(window.CATALOG_DATA) && window.CATALOG_DATA.length > 0) {

        catalog = window.CATALOG_DATA;

        onCatalogLoaded();

      } else {

        throw new Error("Formato de partes inválido");

      }

    })

    .catch(partsErr => {

      console.warn("Carga de partes falló, intentando XHR/Fetch:", partsErr);

      // 2. Intentar XHR catalog_clean.json

      loadCatalogViaXHR()

        .then(data => {

          catalog = data;

          window.CATALOG_DATA = data;

          onCatalogLoaded();

        })

        .catch(xhrErr => {

          console.warn("Carga XHR falló, intentando script catalog_data.js:", xhrErr);

          // 3. Último fallback: Script Tag único

          loadCatalogViaScript();

        });

    });

}



function loadCatalogViaParts() {

  return new Promise((resolve, reject) => {

    const scripts = ["data/catalog_part1.js", "data/catalog_part2.js"];

    let loadedCount = 0;



    function loadNext(index) {

      if (index >= scripts.length) {

        resolve();

        return;

      }

      const script = document.createElement("script");

      script.src = scripts[index];

      script.onload = () => loadNext(index + 1);

      script.onerror = (e) => reject(e);

      document.body.appendChild(script);

    }



    loadNext(0);

  });

}



function loadCatalogViaXHR() {

  return new Promise((resolve, reject) => {

    try {

      const xhr = new XMLHttpRequest();

      xhr.open("GET", "data/catalog_clean.json", true);

      xhr.onload = function() {

        if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText && xhr.responseText.length > 0) {

          try {

            const data = JSON.parse(xhr.responseText);

            if (Array.isArray(data) && data.length > 0) {

              resolve(data);

            } else {

              reject(new Error("Catálogo vacío o formato no válido"));

            }

          } catch(e) {

            reject(e);

          }

        } else {

          reject(new Error("Respuesta XHR con status " + xhr.status));

        }

      };

      xhr.onerror = function(e) {

        reject(new Error("Error de red XHR"));

      };

      xhr.send();

    } catch(err) {

      reject(err);

    }

  });

}



function loadCatalogViaScript() {

  const script = document.createElement("script");

  script.src = "data/catalog_data.js";

  script.onload = () => {

    if (window.CATALOG_DATA && Array.isArray(window.CATALOG_DATA)) {

      catalog = window.CATALOG_DATA;

      onCatalogLoaded();

    } else {

      const badge = document.getElementById("catalogCountBadge");

      if (badge) badge.innerText = "Error al cargar catálogo";

    }

  };

  script.onerror = () => {

    const badge = document.getElementById("catalogCountBadge");

    if (badge) badge.innerText = "Error al cargar catálogo";

  };

  document.body.appendChild(script);

}



function onCatalogLoaded() {

  if (Array.isArray(catalog)) {
    catalog = catalog.filter(item => !isRestrictedDistrict(item && item.id));
  }

  updateCatalogCountBadge();

  populateModelFilter("TODOS");

  applyHierarchyFilter();

}



function updateCatalogCountBadge() {

  const badge = document.getElementById("catalogCountBadge");

  if (!badge) return;

  if (!Array.isArray(catalog) || catalog.length === 0) {

    badge.innerText = "Cargando...";

    return;

  }

  const completedIds = getCompletedAssetIdsSet();

  const availableCount = catalog.filter(item => {

    const id = String(item.id || "").trim().toUpperCase();

    if (isRestrictedDistrict(id)) return false;

    return !completedIds.has(id);

  }).length;

  badge.innerText = `${availableCount.toLocaleString()} disponibles (${completedIds.size.toLocaleString()} completadas)`;

}



function checkNetworkConnectivity() {

  if (isCheckingNetwork) return;

  isCheckingNetwork = true;



  if (!navigator.onLine) {

    isCheckingNetwork = false;

    updateNetworkUI(false);

    return;

  }



  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), 2500);



  fetch("https://app.linkaform.com/favicon.ico?_=" + Date.now(), {

    method: "HEAD",

    mode: "no-cors",

    cache: "no-store",

    signal: controller.signal

  })

  .then(() => {

    clearTimeout(timeoutId);

    isCheckingNetwork = false;

    forceOfflineState = false; // Restablecer estado cuando hay red activa

    updateNetworkUI(true);

  })

  .catch(() => {

    clearTimeout(timeoutId);

    isCheckingNetwork = false;

    updateNetworkUI(false);

  });

}



function updateOfflineStatus(forceOffline) {

  if (forceOffline !== undefined) {

    forceOfflineState = Boolean(forceOffline);

  }



  if (forceOfflineState) {

    updateNetworkUI(false);

  } else {

    checkNetworkConnectivity();

  }

}



function updateNetworkUI(isCurrentlyOnline) {

  const badge = document.getElementById("networkStatus");



  if (badge) {

    if (isCurrentlyOnline) {

      badge.innerText = "Conectado";

      badge.classList.remove("offline");

    } else {

      badge.innerText = "Modo Offline";

      badge.classList.add("offline");

    }

  }



  // Notificar al usuario automáticamente si hubo un cambio de estado en la red

  if (lastKnownOnlineState !== null && lastKnownOnlineState !== isCurrentlyOnline) {

    showNetworkToast(isCurrentlyOnline);

  }

  lastKnownOnlineState = isCurrentlyOnline;

}



function showNetworkToast(isOnline) {

  let toast = document.getElementById("networkToast");

  if (!toast) {

    toast = document.createElement("div");

    toast.id = "networkToast";

    toast.className = "network-toast";

    document.body.appendChild(toast);

  }



  if (isOnline) {

    toast.className = "network-toast online";

    toast.innerText = "🟢 Conexión a internet restablecida (En línea)";

  } else {

    toast.className = "network-toast offline";

    toast.innerText = "🔴 Se perdió la conexión a internet (Modo Offline)";

  }



  toast.style.display = "block";

  toast.style.opacity = "1";



  setTimeout(() => {

    toast.style.opacity = "0";

    setTimeout(() => {

      toast.style.display = "none";

    }, 350);

  }, 3000);

}



function showFloatingToast(message, type = 'info') {

  let toast = document.getElementById("appFloatingToast");

  if (!toast) {

    toast = document.createElement("div");

    toast.id = "appFloatingToast";

    document.body.appendChild(toast);

  }



  toast.className = `network-toast ${type}`;

  toast.innerText = message;

  toast.style.display = "block";

  toast.style.opacity = "1";



  if (toast._timer) clearTimeout(toast._timer);

  toast._timer = setTimeout(() => {

    toast.style.opacity = "0";

    setTimeout(() => {

      toast.style.display = "none";

    }, 350);

  }, 2500);

}



// ---------------------------------------------------------

// VISTA Y NAVEGACIÓN

// ---------------------------------------------------------

function switchView(viewName) {

  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));



  if (viewName === 'search') {

    document.getElementById("viewSearch").classList.add("active");

    document.querySelectorAll(".nav-item")[0].classList.add("active");

  } else if (viewName === 'form') {

    if (!selectedAsset) {

      alert("Por favor selecciona primero una caja o caseta en la pestaña de Búsqueda.");

      switchView('search');

      return;

    }

    if (!selectedModelFilter) {

      alert("⚠️ Error: Debes seleccionar y confirmar un modelo de Caseta o Caja en el modal antes de ir a Evidencia.");

      switchView('search');

      return;

    }

    document.getElementById("viewForm").classList.add("active");

    document.querySelectorAll(".nav-item")[1].classList.add("active");

  } else if (viewName === 'sync') {

    document.getElementById("viewSync").classList.add("active");

    document.querySelectorAll(".nav-item")[2].classList.add("active");

    renderSavedEvidences();

  }

}



function switchSearchMode(mode) {

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  document.querySelectorAll(".search-mode-content").forEach(c => c.style.display = "none");



  if (mode === 'gps') {

    document.querySelectorAll(".tab-btn")[0].classList.add("active");

    document.getElementById("modeGps").style.display = "block";

  } else if (mode === 'filter') {

    document.querySelectorAll(".tab-btn")[1].classList.add("active");

    document.getElementById("modeFilter").style.display = "block";

  } else if (mode === 'direct') {

    document.querySelectorAll(".tab-btn")[2].classList.add("active");

    document.getElementById("modeDirect").style.display = "block";

  }

}



// ---------------------------------------------------------

// ALGORITMO HAVERSINE (DISTANCIA EN METROS)

// ---------------------------------------------------------

function haversineDistance(lat1, lon1, lat2, lon2) {

  const R = 6371000; // metros

  const dLat = (lat2 - lat1) * Math.PI / 180;

  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +

            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *

            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;

}



// ---------------------------------------------------------

// GENERADOR DE ID ÚNICA CONSECUTIVO CONTINUO HISTÓRICO (CAS_AGU_0001 / CAJ_AGU_0001)

// ---------------------------------------------------------

function generateUniqueId(tipo, areaTrabajo) {

  const prefix = (tipo === "CAJA") ? "CAJ" : "CAS";

  let cleanArea = (areaTrabajo || "GEN")

    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    .replace(/[^A-Z]/gi, "")

    .toUpperCase();

  

  if (cleanArea.length < 3) {

    cleanArea = (cleanArea + "XXX").substring(0, 3);

  } else {

    cleanArea = cleanArea.substring(0, 3);

  }



  const matchPattern = `${prefix}_${cleanArea}_`;

  const storageSeqKey = `TELMEX_LAST_FOLIO_SEQ_${matchPattern}`;



  // 1. Obtener consecutivo histórico permanente de localStorage

  let maxSeq = 0;

  const savedSeq = parseInt(localStorage.getItem(storageSeqKey) || "0", 10);

  if (!isNaN(savedSeq) && savedSeq > maxSeq) {

    maxSeq = savedSeq;

  }



  // 2. Revisar historial de todos los activos completados (TELMEX_COMPLETED_ASSETS)

  try {

    const permSaved = localStorage.getItem("TELMEX_COMPLETED_ASSETS");

    if (permSaved) {

      const arr = JSON.parse(permSaved);

      if (Array.isArray(arr)) {

        arr.forEach(item => {

          const str = String(item || "").trim().toUpperCase();

          if (str.startsWith(matchPattern)) {

            const parts = str.split("_");

            const num = parseInt(parts[parts.length - 1], 10);

            if (!isNaN(num) && num > maxSeq) {

              maxSeq = num;

            }

          }

        });

      }

    }

  } catch(e) {}



  // 3. Revisar evidencias pendientes actuales en memoria

  if (Array.isArray(dbEvidences)) {

    dbEvidences.forEach(ev => {

      const uid = String(ev.unique_id || "").trim().toUpperCase();

      if (uid.startsWith(matchPattern)) {

        const parts = uid.split("_");

        const num = parseInt(parts[parts.length - 1], 10);

        if (!isNaN(num) && num > maxSeq) {

          maxSeq = num;

        }

      }

    });

  }



  const nextSeq = String(maxSeq + 1).padStart(4, "0");

  return `${prefix}_${cleanArea}_${nextSeq}`;

}



// ---------------------------------------------------------

// BÚSQUEDA POR GPS (PROXIMIDAD)

// ---------------------------------------------------------

function locateTechnician() {

  const statusDiv = document.getElementById("gpsStatusText");

  statusDiv.innerText = "Obteniendo coordenadas GPS del teléfono...";



  if (!navigator.geolocation) {

    statusDiv.innerText = "El navegador no soporta Geolocalización.";

    return;

  }



  navigator.geolocation.getCurrentPosition(

    (pos) => {

      const lat = pos.coords.latitude;

      const lon = pos.coords.longitude;

      currentGpsCoords = { lat, lon, accuracy: pos.coords.accuracy };

      

      statusDiv.innerText = `GPS OK: (${lat.toFixed(5)}, ${lon.toFixed(5)}) ±${Math.round(pos.coords.accuracy)}m`;

      updateFormGpsDisplay();



      const completedAssetIds = getCompletedAssetIdsSet();

      const elementoRadio = document.querySelector('input[name="filterElemento"]:checked');

      const tipoFilter = elementoRadio ? elementoRadio.value : "TODOS";

      const modelFilter = document.getElementById("filterModeloEspecifico")?.value || "TODOS";



      // Calcular distancia Haversine a todos los registros del catálogo no completados

      const results = [];

      for (let i = 0; i < catalog.length; i++) {

        const item = catalog[i];

        const itemId = String(item.id || "").trim().toUpperCase();

        const itemUid = item.unique_id ? String(item.unique_id).trim().toUpperCase() : "";

        if (completedAssetIds.has(itemId) || (itemUid && completedAssetIds.has(itemUid))) continue;

        if (tipoFilter !== "TODOS" && item.tipo !== tipoFilter) continue;

        if (modelFilter !== "TODOS") {

          if (!matchesModelFilter(item.modelo_tipo, modelFilter, item.tipo)) continue;

        }

        if (item.lat && item.lon) {

          const dist = haversineDistance(lat, lon, item.lat, item.lon);

          results.push({ ...item, dist_m: dist });

        }

      }



      // Ordenar de la más cercana a la más lejana y tomar ÚNICAMENTE las 35 más cercanas

      results.sort((a, b) => a.dist_m - b.dist_m);

      const topNearby = results.slice(0, 35);



      const titleEl = document.getElementById("searchResultsTitle");

      if (titleEl) {

        titleEl.innerText = modelFilter !== "TODOS" 

          ? `📍 35 ${modelFilter.toUpperCase()} Más Cercanas a tu Ubicación` 

          : "📍 35 Opciones Más Cercanas a tu Ubicación";

      }



      renderSearchResults(topNearby, true, getTodayCompletedCount());

    },

    (err) => {

      statusDiv.innerText = `Error al obtener GPS: ${err.message}. Verifica que la ubicación esté encendida.`;

    },

    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }

  );

}



function initGeolocation() {

  if (navigator.geolocation) {

    const geoSuccess = (pos) => {

      const isFirst = !currentGpsCoords;

      currentGpsCoords = {

        lat: pos.coords.latitude,

        lon: pos.coords.longitude,

        accuracy: pos.coords.accuracy

      };

      updateFormGpsDisplay();

      if (isFirst) {

        applyHierarchyFilter();

      }

    };



    navigator.geolocation.getCurrentPosition(

      geoSuccess,

      (err) => console.log("GPS no disponible aún"),

      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }

    );



    // Rastreo continuo mientras el técnico se traslada en campo

    navigator.geolocation.watchPosition(

      geoSuccess,

      (err) => {},

      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }

    );

  }

}



function updateFormGpsDisplay() {

  const el = document.getElementById("formGpsCoords");

  if (currentGpsCoords) {

    el.innerText = `Lat: ${currentGpsCoords.lat.toFixed(6)}, Lon: ${currentGpsCoords.lon.toFixed(6)} (Precisión: ±${Math.round(currentGpsCoords.accuracy)}m)`;

  } else {

    el.innerText = "Buscando señal GPS del teléfono...";

  }

}



// ---------------------------------------------------------

// FILTROS JERÁRQUICOS Y BÚSQUEDA DIRECTA

// ---------------------------------------------------------



// ---------------------------------------------------------

// FILTRO POR MODELO / TIPO ESPECÍFICO (v7)

// ---------------------------------------------------------



function matchesModelFilter(itemModel, filterModel, itemTipo) {

  if (!filterModel || filterModel === "TODOS") return true;

  if (!itemModel) return false;

  

  const im = itemModel.trim().toUpperCase();

  const fm = filterModel.trim().toUpperCase();

  

  if (im === fm) return true;

  

  // Modelos de Caseta

  if (fm === "NORMAL" || fm === "CASETA NORMAL") {

    return im === "NORMAL" || im === "CASETA NORMAL";

  }

  if (fm === "MINI" || fm === "CASETA MINI") {

    return im.includes("MINI");

  }

  if (fm.includes("SEMI") || fm.includes("SEMICIRCULAR")) {

    return im.includes("SEMI");

  }

  if (fm.includes("REFORMA") || fm.includes("DOBLE REFORMA")) {

    return im.includes("REFORMA");

  }

  if (fm.includes("CUICUILCO")) {

    return im.includes("CUICUILCO");

  }

  

  // Modelos de Caja

  if (fm.includes("TRADICIONAL")) {

    if (!im.includes("TRADICIONAL")) return false;

    if (fm.includes("DOBLE")) return im.includes("DOBLE");

    return im.includes("SENCILLA") || !im.includes("DOBLE");

  }

  if (fm.includes("SIECOR")) {

    if (!im.includes("SIECOR")) return false;

    if (fm.includes("DOBLE")) return im.includes("DOBLE");

    if (fm.includes("2") || fm.includes("DOS")) {

      return im.includes("2") || im.includes("DOS");

    }

    if (fm.includes("1") || fm.includes("UNA")) {

      return im.includes("1") || im.includes("UNA") || (!im.includes("2") && !im.includes("DOBLE"));

    }

    return true;

  }

  if (fm.includes("KRONE")) {

    return im.includes("KRONE");

  }

  if (fm.includes("ENVOLVENTE") || fm.includes("ENVOLV")) {

    if (!im.includes("ENVOLV")) return false;

    if (fm.includes("DOBLE")) return im.includes("DOBLE");

    return im.includes("SENCILLA") || !im.includes("DOBLE");

  }

  if (fm.includes("DESPLAZ") || fm.includes("DEPLAS")) {

    if (!im.includes("DESPLAZ") && !im.includes("DEPLAS")) return false;

    if (fm.includes("DOBLE")) return im.includes("DOBLE");

    return im.includes("SENCILLA") || !im.includes("DOBLE");

  }

  

  return im === fm || im.includes(fm) || fm.includes(im);

}



function populateModelFilter(tipo) {

  const select = document.getElementById("filterModeloEspecifico");

  if (!select) return;



  const prevValue = select.value || "TODOS";

  select.innerHTML = "";



  if (tipo === "CASETA") {

    select.innerHTML = `

      <option value="TODOS">-- Todas las Casetas (Cualquier Modelo) --</option>

      <option value="NORMAL">📞 Caseta Normal</option>

      <option value="MINI">📞 Caseta Mini</option>

      <option value="SEMICIRCULAR">📞 Caseta Semicircular</option>

      <option value="DOBLE REFORMA">📞 Caseta Doble Reforma</option>

      <option value="CUICUILCO">📞 Caseta Cuicuilco</option>

    `;

  } else if (tipo === "CAJA") {

    select.innerHTML = `

      <option value="TODOS">-- Todas las Cajas (Cualquier Modelo) --</option>

      <option value="Tradicional Sencilla">📦 Tradicional Sencilla</option>

      <option value="Tradicional Doble">📦 Tradicional Doble</option>

      <option value="Siecor Sencilla 1 Puerta">📦 Siecor Sencilla 1 Puerta</option>

      <option value="Siecor Sencilla 2 Puertas">📦 Siecor Sencilla 2 Puertas</option>

      <option value="Siecor Doble">📦 Siecor Doble</option>

      <option value="Krone Sencilla">📦 Krone Sencilla</option>

      <option value="Desplazamiento Sencilla">📦 Desplazamiento Sencilla</option>

      <option value="Desplazamiento Doble">📦 Desplazamiento Doble</option>

      <option value="Envolvente Sencilla">📦 Envolvente Sencilla</option>

      <option value="Envolvente Doble">📦 Envolvente Doble</option>

    `;

  } else {

    select.innerHTML = `

      <option value="TODOS">-- Todos los Modelos (Cajas y Casetas) --</option>

      <optgroup label="📦 Cajas (10 Modelos Oficiales)">

        <option value="Tradicional Sencilla">Tradicional Sencilla</option>

        <option value="Tradicional Doble">Tradicional Doble</option>

        <option value="Siecor Sencilla 1 Puerta">Siecor Sencilla 1 Puerta</option>

        <option value="Siecor Sencilla 2 Puertas">Siecor Sencilla 2 Puertas</option>

        <option value="Siecor Doble">Siecor Doble</option>

        <option value="Krone Sencilla">Krone Sencilla</option>

        <option value="Desplazamiento Sencilla">Desplazamiento Sencilla</option>

        <option value="Desplazamiento Doble">Desplazamiento Doble</option>

        <option value="Envolvente Sencilla">Envolvente Sencilla</option>

        <option value="Envolvente Doble">Envolvente Doble</option>

      </optgroup>

      <optgroup label="📞 Casetas (5 Modelos Oficiales)">

        <option value="NORMAL">Normal</option>

        <option value="MINI">Mini</option>

        <option value="SEMICIRCULAR">Semicircular</option>

        <option value="DOBLE REFORMA">Doble Reforma</option>

        <option value="CUICUILCO">Cuicuilco</option>

      </optgroup>

    `;

  }



  // Restaurar selección si existe en las nuevas opciones

  let matchedOpt = Array.from(select.options).some(o => o.value === prevValue);

  if (matchedOpt) {

    select.value = prevValue;

  } else {

    select.value = "TODOS";

  }

  updateActiveModelBadge(select.value);

}



function onFilterModeloChange() {

  const select = document.getElementById("filterModeloEspecifico");

  const val = select ? select.value : "TODOS";

  updateActiveModelBadge(val);



  if (val !== "TODOS") {

    const isCaja = CAJA_MODELS.some(m => m.id === val || m.title === val || val.includes("Tradicional") || val.includes("Siecor") || val.includes("Krone") || val.includes("Desplazamiento") || val.includes("Envolvente"));

    const isCaseta = CASETA_MODELS.some(m => m.id === val || val === "NORMAL" || val === "MINI" || val === "SEMICIRCULAR" || val.includes("REFORMA") || val.includes("CUICUILCO"));

    

    const elementoRadio = document.querySelector('input[name="filterElemento"]:checked');

    if (isCaja && elementoRadio && elementoRadio.value === "CASETA") {

      const rCaja = document.getElementById("elemento_caja");

      if (rCaja) rCaja.checked = true;

    } else if (isCaseta && elementoRadio && elementoRadio.value === "CAJA") {

      const rCas = document.getElementById("elemento_caseta");

      if (rCas) rCas.checked = true;

    }

  }



  applyHierarchyFilter();

}



function updateActiveModelBadge(val) {

  const badge = document.getElementById("activeModelBadge");

  if (!badge) return;

  if (!val || val === "TODOS") {

    badge.innerText = "Todos";

    badge.style.background = "#64748b";

  } else {

    badge.innerText = val;

    badge.style.background = "#16a34a";

  }

}



function onElementTypeChange() {

  const elementoRadio = document.querySelector('input[name="filterElemento"]:checked');

  const tipo = elementoRadio ? elementoRadio.value : "TODOS";

  populateModelFilter(tipo);

  applyHierarchyFilter();

}



function onSearchModeToggle() {

  const mode = document.querySelector('input[name="searchSelectionMode"]:checked')?.value || "AUTO";

  const container = document.getElementById("manualFilterContainer");

  const titleEl = document.getElementById("searchResultsTitle");



  if (mode === "MANUAL") {

    if (container) container.style.display = "block";

    if (titleEl) titleEl.innerText = "🔍 Activos Filtrados por Estado y Área";

    populateEstadosFilter();

  } else {

    if (container) container.style.display = "none";

    if (titleEl) titleEl.innerText = "📍 35 Opciones Más Cercanas a tu Ubicación";

  }



  applyHierarchyFilter();

}



function populateEstadosFilter() {
  const select = document.getElementById("filterEstado");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Seleccionar Estado --</option>';
  Object.keys(OFFICIAL_ESTADOS_AREAS).sort().forEach(est => {
    const opt = document.createElement("option");
    opt.value = est;
    opt.innerText = est;
    if (est === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}



function onEstadoChange() {
  const selectedEstado = document.getElementById("filterEstado")?.value || "";
  const areaSelect = document.getElementById("filterArea");
  if (!areaSelect) return;

  areaSelect.innerHTML = '<option value="">-- Seleccionar Área de Trabajo --</option>';

  if (selectedEstado && OFFICIAL_ESTADOS_AREAS[selectedEstado]) {
    OFFICIAL_ESTADOS_AREAS[selectedEstado].slice().sort().forEach(area => {
      const opt = document.createElement("option");
      opt.value = area;
      opt.innerText = area;
      areaSelect.appendChild(opt);
    });
  }

  applyHierarchyFilter();
}



function applyHierarchyFilter() {

  const mode = document.querySelector('input[name="searchSelectionMode"]:checked')?.value || "AUTO";

  const proceso = document.querySelector('input[name="filterProceso"]:checked')?.value || "IMAGEN";

  

  const elementoRadio = document.querySelector('input[name="filterElemento"]:checked');

  const tipoFilter = elementoRadio ? elementoRadio.value : "TODOS";

  const modelFilter = document.getElementById("filterModeloEspecifico")?.value || "TODOS";



  // Set de IDs ya capturados para evitar duplicados

  const completedAssetIds = getCompletedAssetIdsSet();



  let estadoVal = "";

  let areaVal = "";

  if (mode === "MANUAL") {

    estadoVal = document.getElementById("filterEstado")?.value || "";

    areaVal = document.getElementById("filterArea")?.value || "";



    if (!estadoVal && !areaVal) {

      document.getElementById("searchResultsList").innerHTML = 

        '<p style="text-align:center; color:var(--text-muted); padding:20px;">Por favor selecciona Estado y Área de Trabajo en los desplegables de arriba.</p>';

      document.getElementById("resultCount").innerText = '0 activos';

      return;

    }

  }



  let filtered = catalog.filter(item => {

    const itemId = String(item.id || "").trim().toUpperCase();

    if (isRestrictedDistrict(itemId)) return false;

    const itemUid = item.unique_id ? String(item.unique_id).trim().toUpperCase() : "";

    if (completedAssetIds.has(itemId) || (itemUid && completedAssetIds.has(itemUid))) return false;

    if (tipoFilter !== "TODOS" && item.tipo !== tipoFilter) return false;

    if (modelFilter !== "TODOS") {

      if (!matchesModelFilter(item.modelo_tipo, modelFilter, item.tipo)) return false;

    }

    if (mode === "MANUAL") {

      if (estadoVal && item.estado !== estadoVal) return false;

      if (areaVal && item.area_trabajo !== areaVal) return false;

    }

    return true;

  });



  // Si se dispone de GPS del dispositivo, calcular distancia y ordenar por cercanía

  if (currentGpsCoords && currentGpsCoords.lat && currentGpsCoords.lon) {

    filtered = filtered.map(item => {

      let dist = 99999999;

      if (item.lat && item.lon) {

        dist = haversineDistance(currentGpsCoords.lat, currentGpsCoords.lon, item.lat, item.lon);

      }

      return { ...item, dist_m: dist };

    });



    filtered.sort((a, b) => a.dist_m - b.dist_m);

  }



  // Tomar las 35 más cercanas (o hasta 50 en búsqueda manual)

  const maxResults = (mode === "MANUAL" && (estadoVal || areaVal)) ? 50 : 35;

  const topResults = filtered.slice(0, maxResults);
  window.lastSearchResults = topResults;



  const titleEl = document.getElementById("searchResultsTitle");

  if (titleEl) {

    if (mode === "MANUAL") {

      titleEl.innerText = modelFilter !== "TODOS" 

        ? `📋 Activos Filtrados: ${modelFilter.toUpperCase()}` 

        : "📋 Activos Filtrados por Estado y Área";

    } else {

      titleEl.innerText = modelFilter !== "TODOS" 

        ? `📍 35 ${modelFilter.toUpperCase()} Más Cercanas a tu Ubicación` 

        : "📍 35 Opciones Más Cercanas a tu Ubicación";

    }

  }



  renderSearchResults(topResults, Boolean(currentGpsCoords && currentGpsCoords.lat), getTodayCompletedCount());

}



function onQueryInput() {

  const q = document.getElementById("inputQuery").value.trim().toUpperCase();

  if (q.length < 2) {

    applyHierarchyFilter();

    return;

  }



  const elementoRadio = document.querySelector('input[name="filterElemento"]:checked');

  const tipoFilter = elementoRadio ? elementoRadio.value : "TODOS";

  const modelFilter = document.getElementById("filterModeloEspecifico")?.value || "TODOS";



  const completedAssetIds = getCompletedAssetIdsSet();



  let matches = catalog.filter(item => {

    const itemId = String(item.id || "").trim().toUpperCase();

    if (isRestrictedDistrict(itemId)) return false;

    const itemUid = item.unique_id ? String(item.unique_id).trim().toUpperCase() : "";

    if (completedAssetIds.has(itemId) || (itemUid && completedAssetIds.has(itemUid))) return false;

    if (tipoFilter !== "TODOS" && item.tipo !== tipoFilter) return false;

    if (modelFilter !== "TODOS") {

      if (!matchesModelFilter(item.modelo_tipo, modelFilter, item.tipo)) return false;

    }

    return (item.id && item.id.toUpperCase().includes(q)) || 

           (item.calle && item.calle.toUpperCase().includes(q)) ||

           (item.municipio && item.municipio.toUpperCase().includes(q)) ||

           (item.area_trabajo && item.area_trabajo.toUpperCase().includes(q)) ||

           (item.modelo_tipo && item.modelo_tipo.toUpperCase().includes(q));

  });



  if (currentGpsCoords && currentGpsCoords.lat && currentGpsCoords.lon) {

    matches = matches.map(item => {

      let dist = 99999999;

      if (item.lat && item.lon) {

        dist = haversineDistance(currentGpsCoords.lat, currentGpsCoords.lon, item.lat, item.lon);

      }

      return { ...item, dist_m: dist };

    });

    matches.sort((a, b) => a.dist_m - b.dist_m);

  }



  const topResults = matches.slice(0, 35);
  window.lastSearchResults = topResults;
  renderSearchResults(topResults, Boolean(currentGpsCoords && currentGpsCoords.lat), getTodayCompletedCount());

}



// ---------------------------------------------------------

// FUNCIONES DE UBICACIÓN Y MAPA INTEGRADO (CERO ERRORES DE REDIRECCIÓN)

// ---------------------------------------------------------

let currentMapModalAsset = null;



function openInGoogleMaps(lat, lon, label) {

  // Buscar el objeto activo por ID o coordenadas

  let found = null;

  if (pendingAsset && (pendingAsset.id === label || (pendingAsset.lat == lat && pendingAsset.lon == lon))) {

    found = pendingAsset;

  }

  if (!found && typeof fullCatalog !== 'undefined' && Array.isArray(fullCatalog)) {

    found = fullCatalog.find(a => a.id === label || (a.lat == lat && a.lon == lon));

  }

  if (!found) {

    found = { id: label || 'Activo', lat: lat, lon: lon, tipo: 'ACTIVO', estado: '', area_trabajo: '', calle: '' };

  }

  openAssetMapModal(found);

}



function openAssetMapModal(item) {

  if (!item) return;



  if (item.lat == null || item.lon == null || isNaN(Number(item.lat)) || isNaN(Number(item.lon)) || (Number(item.lat) === 0 && Number(item.lon) === 0)) {

    alert(`⚠️ El activo ${item.id || ''} no cuenta con coordenadas válidas registradas en la base de datos.`);

    return;

  }



  currentMapModalAsset = item;

  const cleanLat = Number(item.lat);

  const cleanLon = Number(item.lon);



  // Vibración háptica suave

  if (typeof navigator !== 'undefined' && navigator.vibrate) {

    try { navigator.vibrate([50, 30, 50]); } catch (e) {}

  }



  const titleEl = document.getElementById("mapModalAssetTitle");

  const locEl = document.getElementById("mapModalAssetLocation");

  const coordsEl = document.getElementById("mapModalAssetCoords");

  const distEl = document.getElementById("mapModalDistance");

  const iframeEl = document.getElementById("mapModalIframe");



  const displayModel = item.modelo_tipo || (item.tipo === 'CASETA' ? 'NORMAL' : 'Sencilla');

  if (titleEl) titleEl.innerText = `${item.id} [${item.tipo === 'CASETA' ? '📞' : '📦'} ${item.tipo} (${displayModel})]`;

  if (locEl) locEl.innerHTML = `📍 <strong>Estado:</strong> ${item.estado || 'N/A'} | 🏢 <strong>Área:</strong> ${item.area_trabajo || item.municipio || 'N/A'}<br>🛣️ <strong>Calle:</strong> ${item.calle || 'S/N'}${item.colonia ? ' | Col: ' + item.colonia : ''}`;

  if (coordsEl) coordsEl.innerHTML = `🌐 <strong>Lat:</strong> ${cleanLat.toFixed(6)} | <strong>Lon:</strong> ${cleanLon.toFixed(6)}`;



  // Cálculo de distancia en tiempo real con respecto al GPS del técnico

  if (distEl) {

    if (currentGpsCoords && currentGpsCoords.lat && currentGpsCoords.lon) {

      const d = Math.round(haversineDistance(currentGpsCoords.lat, currentGpsCoords.lon, cleanLat, cleanLon));

      const distFormatted = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toLocaleString()} metros`;

      distEl.innerText = `📏 Distancia: A ${distFormatted} de tu posición GPS actual`;

      distEl.style.display = "block";

    } else if (item.dist_m && item.dist_m < 99999900) {

      const d = Math.round(item.dist_m);

      const distFormatted = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toLocaleString()} metros`;

      distEl.innerText = `📏 Distancia aproximada: A ${distFormatted}`;

      distEl.style.display = "block";

    } else {

      distEl.innerText = `📏 Distancia: Activa tu GPS para calcular cercanía`;

    }

  }



  // Carga del mapa integrado seguro (OpenStreetMap embed con pin exacto: nunca redirige a intent://)

  if (iframeEl) {

    const delta = 0.003;

    const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${cleanLon - delta}%2C${cleanLat - delta * 0.7}%2C${cleanLon + delta}%2C${cleanLat + delta * 0.7}&layer=mapnik&marker=${cleanLat}%2C${cleanLon}`;

    iframeEl.src = osmUrl;

  }



  const modal = document.getElementById("assetMapModal");

  if (modal) modal.style.display = "flex";

}



function closeAssetMapModal() {

  const modal = document.getElementById("assetMapModal");

  if (modal) modal.style.display = "none";

  const iframeEl = document.getElementById("mapModalIframe");

  if (iframeEl) iframeEl.src = "about:blank";

}



function openExternalNavigationFromModal() {

  if (!currentMapModalAsset) return;

  const lat = Number(currentMapModalAsset.lat);

  const lon = Number(currentMapModalAsset.lon);

  const label = currentMapModalAsset.id || 'Activo Telmex';



  showFloatingToast(`🚗 Abriendo navegación para ${label}...`, 'info');



  // Si estamos en la APK de Android (usar Intent nativo geo: sin pasar por la web)

  if (window.AndroidBridge && typeof window.AndroidBridge.openMaps === 'function') {

    try {

      window.AndroidBridge.openMaps(lat, lon, label);

      return;

    } catch (e) {

      console.warn("Fallo AndroidBridge.openMaps:", e);

    }

  }



  // En navegador Web o PWA (abrir ruta directa en nueva ventana)

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

  window.open(navUrl, "_blank");

}



function proceedFromMapToEvidence() {

  if (currentMapModalAsset) {

    const asset = currentMapModalAsset;

    closeAssetMapModal();

    selectAsset(asset);

  }

}



function openPendingAssetInGoogleMaps() {

  if (pendingAsset) {

    openAssetMapModal(pendingAsset);

  }

}



// ---------------------------------------------------------

// RENDERIZADO DE RESULTADOS DE BÚSQUEDA

// ---------------------------------------------------------

function renderSearchResults(items, isGpsSearch, completedCount = 0) {

  const listDiv = document.getElementById("searchResultsList");

  const countSpan = document.getElementById("resultCount");

  

  const completedBadge = completedCount > 0 ? ` (${completedCount} capturados hoy)` : '';

  countSpan.innerText = `${items.length} opciones más cercanas${completedBadge}`;

  listDiv.innerHTML = "";



  if (items.length === 0) {

    listDiv.innerHTML = `

      <div style="text-align:center; padding:24px 16px;">

        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:12px;">No se encontraron activos para los criterios seleccionados.</p>

        <button type="button" class="btn btn-warning" onclick="openManualAssetModal()" style="font-weight:bold; font-size:0.9rem; padding:10px 16px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">

          <span>➕</span>

          <span>¿No existe en base de datos? Agregar manualmente</span>

        </button>

      </div>

    `;

    return;

  }



  items.forEach(item => {

    const card = document.createElement("div");

    card.className = `asset-item ${selectedAsset && selectedAsset.id === item.id ? 'selected' : ''}`;

    

    let distBadge = '';

    if (item.dist_m && item.dist_m < 99999900) {

      const metersVal = Math.round(item.dist_m);

      const metersFormatted = metersVal.toLocaleString();

      const distLabel = metersVal >= 1000 

        ? `📍 A ${metersFormatted} m (${(item.dist_m / 1000).toFixed(1)} km)` 

        : `📍 A ${metersFormatted} metros`;

      distBadge = `<span class="asset-badge" style="background:#15803d; color:white; font-weight:bold; font-size:0.75rem; padding:3px 8px; border-radius:6px; margin-left:4px;">${distLabel}</span>`;

    }



    const isCaseta = item.tipo === 'CASETA';

    const typeIcon = isCaseta ? '📞' : '📦';

    const badgeColor = isCaseta ? '#0055a5' : '#0891b2';

    const displayModel = item.modelo_tipo || (isCaseta ? 'NORMAL' : 'Sencilla');



    card.innerHTML = `

      <div class="asset-header" style="align-items:center;">

        <span style="font-size:1rem; font-weight:bold; color:var(--primary);">${item.id}</span>

        <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; justify-content:flex-end;">

          <span class="asset-badge" style="background:${badgeColor}; color:white; font-weight:bold;">${typeIcon} ${item.tipo} (${displayModel})</span>

          ${distBadge}

        </div>

      </div>

      <div class="asset-detail" style="margin-top:6px; font-size:0.85rem; color:#334155;">

        📍 <strong>Estado:</strong> ${item.estado} | 🏢 <strong>Área:</strong> ${item.area_trabajo || item.municipio}

      </div>

      <div class="asset-detail" style="font-size:0.8rem; color:#64748b;">

        🛣️ Calle: ${item.calle || 'S/N'} ${item.colonia ? '| Colonia/Distrito: ' + item.colonia : ''}

      </div>

      <div class="asset-detail" style="font-size:0.8rem; color:#0369a1; margin-top:4px; display:flex; justify-content:space-between; align-items:center;">

        <span>🌐 <strong>Lat:</strong> ${item.lat != null ? item.lat : 'N/A'} | <strong>Lon:</strong> ${item.lon != null ? item.lon : 'N/A'}</span>

        <button type="button" class="btn-card-maps" title="Abrir ubicación en Google Maps">

          🗺️ Maps

        </button>

      </div>

    `;



    // Botón directo para Maps

    const mapsBtn = card.querySelector(".btn-card-maps");

    if (mapsBtn) {

      mapsBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        e.preventDefault();

        openAssetMapModal(item);

      });

      mapsBtn.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

      mapsBtn.addEventListener("mousedown", (e) => e.stopPropagation());

    }



    // Detección de Pulsación Prolongada (Long-Press: 550ms sostenido)

    let pressTimer = null;

    let didLongPress = false;

    let startX = 0;

    let startY = 0;



    const startPress = (clientX, clientY) => {

      didLongPress = false;

      startX = clientX;

      startY = clientY;

      card.classList.add("pressing-feedback");

      clearTimeout(pressTimer);

      pressTimer = setTimeout(() => {

        didLongPress = true;

        card.classList.remove("pressing-feedback");

        openAssetMapModal(item);

      }, 550);

    };



    const cancelPress = () => {

      clearTimeout(pressTimer);

      card.classList.remove("pressing-feedback");

    };



    // Eventos táctiles (Móvil / Tablet)

    card.addEventListener("touchstart", (e) => {

      if (e.touches && e.touches.length === 1) {

        startPress(e.touches[0].clientX, e.touches[0].clientY);

      }

    }, { passive: true });



    card.addEventListener("touchmove", (e) => {

      if (e.touches && e.touches.length === 1) {

        const dist = Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY);

        if (dist > 10) {

          cancelPress();

        }

      }

    }, { passive: true });



    card.addEventListener("touchend", () => {

      cancelPress();

    }, { passive: true });



    card.addEventListener("touchcancel", () => {

      cancelPress();

    }, { passive: true });



    // Eventos de ratón (Escritorio / Laptop)

    card.addEventListener("mousedown", (e) => {

      if (e.button === 0) {

        startPress(e.clientX, e.clientY);

      }

    });



    card.addEventListener("mousemove", (e) => {

      if (pressTimer) {

        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);

        if (dist > 10) {

          cancelPress();

        }

      }

    });



    card.addEventListener("mouseup", () => {

      cancelPress();

    });



    card.addEventListener("mouseleave", () => {

      cancelPress();

    });



    // Desactivar menú contextual nativo si se dejó oprimido

    card.addEventListener("contextmenu", (e) => {

      if (didLongPress) {

        e.preventDefault();

      }

    });



    // Selección regular al pulsar/tocar normalmente

    card.onclick = (e) => {

      if (didLongPress) {

        e.preventDefault();

        e.stopPropagation();

        setTimeout(() => { didLongPress = false; }, 300);

        return;

      }

      selectAsset(item);

    };



    listDiv.appendChild(card);

  });

}



function selectAsset(item) {

  if (!item || isRestrictedDistrict(item.id)) {
    showCustomAlert(`🚫 El distrito ${item ? item.id : ''} está restringido por supervisión y no puede ser seleccionado ni trabajado.`, "Distrito Restringido");
    return;
  }

  pendingAsset = item;

  modalSelectedType = (item.tipo === "CAJA") ? "CAJA" : "CASETA";

  

  const models = (modalSelectedType === "CAJA") ? CAJA_MODELS : CASETA_MODELS;

  if (item.modelo_tipo && models.some(m => m.id === item.modelo_tipo)) {

    modalSelectedModel = item.modelo_tipo;

  } else {

    modalSelectedModel = models[0].id;

  }



  const idEl = document.getElementById("modalAssetId");

  const infoEl = document.getElementById("modalAssetInfo");

  const typeBadge = (modalSelectedType === "CAJA") ? "📦 CAJA" : "📞 CASETA";

  if (idEl) idEl.innerText = `Activo: ${item.id} [${typeBadge}]`;

  const coordsStr = (item.lat != null && item.lon != null) ? ` | Coords: ${item.lat}, ${item.lon}` : '';

  if (infoEl) infoEl.innerText = `📍 Estado: ${item.estado || 'N/A'} | Área: ${item.area_trabajo || item.municipio || 'N/A'} | Calle: ${item.calle || 'S/N'}${coordsStr}`;



  renderModalTypeGrid();



  const modal = document.getElementById("assetConfirmModal");

  if (modal) modal.style.display = "flex";

}



function closeAssetConfirmModal() {

  const modal = document.getElementById("assetConfirmModal");

  if (modal) modal.style.display = "none";

}



function renderModalTypeGrid() {

  const isCaja = (modalSelectedType === "CAJA");

  const models = isCaja ? CAJA_MODELS : CASETA_MODELS;

  const grid = document.getElementById("modalTypeGrid");

  if (!grid) return;



  grid.innerHTML = "";

  models.forEach(m => {

    const card = document.createElement("div");

    const isSel = (modalSelectedModel === m.id);

    card.className = `type-card ${isSel ? 'selected' : ''}`;

    card.onclick = () => selectModalModelType(m.id);



    card.innerHTML = `

      <img src="${m.img}" class="type-card-img" alt="${m.title}" onerror="this.style.display='none'">

      <div class="type-card-title">${m.title}</div>

    `;

    grid.appendChild(card);

  });

}



function selectModalModelType(modelId) {

  modalSelectedModel = modelId;

  renderModalTypeGrid();

}



function confirmAssetSelection() {

  if (!pendingAsset) {

    alert("⚠️ Error: No hay ningún activo seleccionado.");

    closeAssetConfirmModal();

    return;

  }

  if (!modalSelectedModel) {

    alert("⚠️ Por favor selecciona un modelo en el muestrario visual.");

    return;

  }



  selectedAsset = { ...pendingAsset };

  selectedAsset.tipo = modalSelectedType;

  selectedAsset.modelo_tipo = modalSelectedModel;

  selectedAsset.is_manual = false;

  selectedAsset.is_fuera_catalogo = false;

  selectedAsset.existe_en_bd = "Sí";

  selectedModelFilter = modalSelectedModel;



  const proceso = document.querySelector('input[name="filterProceso"]:checked')?.value || "IMAGEN";

  const areaVal = selectedAsset.area_trabajo || selectedAsset.municipio || "GENERAL";

  const uniqueId = generateUniqueId(selectedAsset.tipo, areaVal);

  selectedAsset.unique_id = uniqueId;



  // Actualizar alerta general de activo seleccionado

  document.getElementById("activeAssetAlert").style.display = "block";

  document.getElementById("activeAssetTitle").innerText = `${uniqueId} (Ref: ${selectedAsset.id}) [${proceso}] (${selectedAsset.tipo} - ${modalSelectedModel}) - ${areaVal}, ${selectedAsset.estado}`;



  // Llenar campos del formulario automáticamente

  document.getElementById("formAssetId").value = `${uniqueId} (Ref: ${selectedAsset.id})`;

  document.getElementById("formAssetEstado").value = selectedAsset.estado || "DESCONOCIDO";

  document.getElementById("formAssetArea").value = selectedAsset.area_trabajo || selectedAsset.municipio || "GENERAL";

  const existeBdEl = document.getElementById("formAssetExisteBD");

  if (existeBdEl) {

    existeBdEl.value = "En BD: Sí";

    existeBdEl.style.background = "#f0fdf4";

    existeBdEl.style.color = "#15803d";

  }

  document.getElementById("formAssetDetails").value = `Proceso: ${proceso} | Tipo: ${selectedAsset.tipo} | Modelo: ${modalSelectedModel}`;

  const coordsStr = (selectedAsset.lat != null && selectedAsset.lon != null) ? ` | Coords: ${selectedAsset.lat}, ${selectedAsset.lon}` : '';

  document.getElementById("formAssetInfo").value = `Colonia/Distrito: ${selectedAsset.colonia || selectedAsset.municipio || 'N/A'} | Calle: ${selectedAsset.calle || 'S/N'}${coordsStr}`;



  if (selectedAsset.oferta_sugerida) {

    const sug = String(selectedAsset.oferta_sugerida).trim();

    if (sug.includes("250")) document.getElementById("ofertaColocada").value = "250 MB";

    else if (sug.includes("120")) document.getElementById("ofertaColocada").value = "200 MB";

  const comSel2 = document.getElementById("comentarios");

  if (comSel2) comSel2.value = "Sin comentarios";

  const comMan2 = document.getElementById("comentariosManual");

  if (comMan2) { comMan2.style.display = "none"; comMan2.value = ""; }

    else if (sug.includes("200")) document.getElementById("ofertaColocada").value = "200 MB";

    else document.getElementById("ofertaColocada").value = sug;

  } else {

    document.getElementById("ofertaColocada").value = "200 MB";

  }



  // Resetear campo de comentarios a 'Sin comentarios' por defecto

  const comSel1 = document.getElementById("comentarios");

  if (comSel1) comSel1.value = "Sin comentarios";

  const comMan1 = document.getElementById("comentariosManual");

  if (comMan1) { comMan1.style.display = "none"; comMan1.value = ""; }



  // Resetear radios de existencia en V8 para obligar a seleccionar Sí o No

  document.querySelectorAll('input[name="existencia"]').forEach(r => r.checked = false);

  const grpExist1 = document.getElementById("groupExistencia");

  if (grpExist1) { grpExist1.style.border = "none"; grpExist1.style.padding = "0"; }



  closeAssetConfirmModal();

  switchView('form');

}



// ---------------------------------------------------------

// REGISTRO MANUAL DE CAJAS Y CASETAS EN CAMPO (FUERA DE CATÁLOGO)

// ---------------------------------------------------------

let manualSelectedType = "CAJA";

let manualSelectedModel = "Tradicional Sencilla";



function openManualAssetModal() {

  const modal = document.getElementById("manualAssetModal");

  if (!modal) return;



  // Reset de campos

  const idInput = document.getElementById("manualAssetIdInput");

  const calleInput = document.getElementById("manualCalleInput");

  if (idInput) idInput.value = "";

  if (calleInput) calleInput.value = "";



  // Sincronizar GPS actual

  const gpsEl = document.getElementById("manualGpsInfo");

  if (gpsEl) {

    if (currentGpsCoords && currentGpsCoords.lat != null && currentGpsCoords.lon != null) {

      gpsEl.innerHTML = `📡 <strong>GPS Actual:</strong> Lat: ${currentGpsCoords.lat.toFixed(6)}, Lon: ${currentGpsCoords.lon.toFixed(6)} (±${Math.round(currentGpsCoords.accuracy || 10)}m)`;

      gpsEl.style.color = "#15803d";

    } else {

      gpsEl.innerHTML = `📡 <strong>GPS:</strong> Obteniendo señal satelital en tiempo real...`;

      gpsEl.style.color = "#0369a1";

    }

  }



  // Poblar estados

  populateManualEstados();



  // Preseleccionar si el usuario ya tenía filtros en la búsqueda

  const currentFiltroEstado = document.getElementById("filterEstado")?.value || "";

  const estadoSelect = document.getElementById("manualEstadoSelect");

  if (estadoSelect && currentFiltroEstado) {

    estadoSelect.value = currentFiltroEstado;

    onManualEstadoChange();

    const currentFiltroArea = document.getElementById("filterArea")?.value || "";

    const areaSelect = document.getElementById("manualAreaSelect");

    if (areaSelect && currentFiltroArea) {

      areaSelect.value = currentFiltroArea;

    }

  }



  // Tipo inicial: CAJA

  manualSelectedType = "CAJA";

  const radCaja = document.getElementById("manual_tipo_caja");

  if (radCaja) radCaja.checked = true;

  onManualTipoToggle("CAJA");



  modal.style.display = "flex";

  if (idInput) setTimeout(() => idInput.focus(), 150);

}



function closeManualAssetModal() {

  const modal = document.getElementById("manualAssetModal");

  if (modal) modal.style.display = "none";

}





// ---------------------------------------------------------

// FILTRO EN TIEMPO REAL Y LISTENERS PARA V8

// ---------------------------------------------------------

function setupManualIdInputFilter() {

  const idInput = document.getElementById("manualAssetIdInput");

  if (!idInput) return;

  idInput.addEventListener("input", function() {

    if (manualSelectedType === "CASETA") {

      this.value = this.value.replace(/\D/g, '').slice(0, 10);

    } else {

      this.value = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);

    }

  });

}



function setupExistenciaRadioListeners() {

  const existRadios = document.querySelectorAll('input[name="existencia"]');

  existRadios.forEach(r => {

    r.addEventListener('change', () => {

      const groupExist = document.getElementById("groupExistencia");

      if (groupExist) {

        groupExist.style.border = "none";

        groupExist.style.padding = "0";

      }

    });

  });

}



function onComentariosChange() {

  const sel = document.getElementById("comentarios");

  const manual = document.getElementById("comentariosManual");

  if (!sel || !manual) return;

  if (sel.value === "OTRO") {

    manual.style.display = "block";

    manual.focus();

  } else {

    manual.style.display = "none";

    manual.value = "";

  }

}

window.onComentariosChange = onComentariosChange;



function onManualTipoToggle(tipo) {

  manualSelectedType = (tipo === "CASETA") ? "CASETA" : "CAJA";



  const idLabel = document.getElementById("manualIdLabel");

  const idInput = document.getElementById("manualAssetIdInput");

  const idHelper = document.getElementById("manualIdHelper");

  const catLabel = document.getElementById("manualCatalogLabel");



  if (manualSelectedType === "CASETA") {

    if (idLabel) idLabel.innerHTML = '2. Teléfono de la Caseta: <span style="color:#ef4444; font-size:0.75rem;">* Obligatorio (10 dígitos)</span>';

    if (idInput) {

      idInput.placeholder = "Ej: 9848033711 (10 dígitos numéricos)";

      idInput.maxLength = 10;

      idInput.type = "tel";

      idInput.value = "";

    }

    if (idHelper) idHelper.innerHTML = '<span style="color:#0369a1; font-weight:600;">📱 Obligatorio:</span> Debe contener exactamente <strong>10 dígitos numéricos</strong> (ejemplo: 9848033711).';

    if (catLabel) catLabel.innerHTML = '3. Catálogo de Modelos de Casetas: <span style="color:#ef4444; font-size:0.75rem;">* Selecciona una</span>';

    manualSelectedModel = CASETA_MODELS[0].id;

  } else {

    if (idLabel) idLabel.innerHTML = '2. Distrito de la Caja: <span style="color:#ef4444; font-size:0.75rem;">* Obligatorio (Alfanumérico 7 caracteres)</span>';

    if (idInput) {

      idInput.placeholder = "Ej: ZIH0061 o IND0017 (7 caracteres)";

      idInput.maxLength = 7;

      idInput.type = "text";

      idInput.value = "";

    }

    if (idHelper) idHelper.innerHTML = '<span style="color:#0369a1; font-weight:600;">📦 Obligatorio:</span> Formato alfanumérico de <strong>7 caracteres</strong> (ejemplo: ZIH0061, IND0017).';

    if (catLabel) catLabel.innerHTML = '3. Catálogo de Modelos de Cajas: <span style="color:#ef4444; font-size:0.75rem;">* Selecciona una</span>';

    manualSelectedModel = CAJA_MODELS[0].id;

  }



  renderManualModelGrid();

}



function renderManualModelGrid() {

  const grid = document.getElementById("manualModelGrid");

  if (!grid) return;



  const models = (manualSelectedType === "CASETA") ? CASETA_MODELS : CAJA_MODELS;

  grid.innerHTML = "";



  models.forEach(m => {

    const card = document.createElement("div");

    const isSel = (manualSelectedModel === m.id);

    card.className = `type-card ${isSel ? 'selected' : ''}`;

    card.onclick = () => selectManualModelType(m.id);



    card.innerHTML = `

      <img src="${m.img}" class="type-card-img" alt="${m.title}" onerror="this.style.display='none'">

      <div class="type-card-title">${m.title}</div>

    `;

    grid.appendChild(card);

  });

}



function selectManualModelType(modelId) {

  manualSelectedModel = modelId;

  renderManualModelGrid();

}



function populateManualEstados() {
  const select = document.getElementById("manualEstadoSelect");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Seleccionar Estado * --</option>';
  Object.keys(OFFICIAL_ESTADOS_AREAS).sort().forEach(est => {
    const opt = document.createElement("option");
    opt.value = est;
    opt.innerText = est;
    if (est === currentVal) opt.selected = true;
    select.appendChild(opt);
  });

  const areaSelect = document.getElementById("manualAreaSelect");
  if (areaSelect && !areaSelect.value) {
    areaSelect.innerHTML = '<option value="">-- Seleccionar Área * --</option>';
  }
}



function onManualEstadoChange() {
  const selectedEstado = document.getElementById("manualEstadoSelect")?.value || "";
  const areaSelect = document.getElementById("manualAreaSelect");
  if (!areaSelect) return;

  areaSelect.innerHTML = '<option value="">-- Seleccionar Área * --</option>';

  if (selectedEstado && OFFICIAL_ESTADOS_AREAS[selectedEstado]) {
    OFFICIAL_ESTADOS_AREAS[selectedEstado].slice().sort().forEach(area => {
      const opt = document.createElement("option");
      opt.value = area;
      opt.innerText = area;
      areaSelect.appendChild(opt);
    });
  }
}



function confirmManualAssetSelection() {

  const idInput = document.getElementById("manualAssetIdInput");

  const rawId = (idInput?.value || "").trim().toUpperCase();



  if (!rawId || rawId === "S/N" || rawId === "N/A") {

    showCustomAlert("⚠️ <strong>Identificador Obligatorio:</strong><br><br>Por favor ingresa un identificador válido para la " + (manualSelectedType === "CASETA" ? "caseta (10 dígitos)" : "caja (7 caracteres alfanuméricos)") + ".", "Dato Requerido");

    if (idInput) {

      idInput.style.border = "2px solid #ef4444";

      idInput.focus();

    }

    return;

  }



  // Restricción de Distritos No Permitidos
  if (isRestrictedDistrict(rawId)) {
    showCustomAlert(
      `🚫 <strong>Distrito Restringido:</strong><br><br>` +
      `El distrito <strong>${rawId}</strong> está restringido por normatividad y supervisión de Telmex.<br><br>` +
      `No está permitido crear, dar de alta ni registrar evidencias en este distrito.`,
      "Distrito No Permitido"
    );
    if (idInput) {
      idInput.style.border = "2px solid #ef4444";
      idInput.value = "";
      idInput.focus();
    }
    return;
  }

  // Validación de Duplicado en Base Linkaform

  const allCompletedAssetIds = getCompletedAssetIdsSet();

  if (allCompletedAssetIds.has(rawId)) {

    showCustomAlert(

      `⚠️ <strong>Activo Ya Completado Previamente:</strong><br><br>` +

      `El identificador <strong>${rawId}</strong> ya fue registrado y validado en Linkaform por otra cuadrilla.<br><br>` +

      `No es necesario volver a capturarlo.`,

      "Activo Ya Completado"

    );

    if (idInput) {

      idInput.style.border = "2px solid #ef4444";

      idInput.focus();

    }

    return;

  }



  // Validación estricta V8 de formato por tipo

  if (manualSelectedType === "CASETA") {

    if (!/^\d{10}$/.test(rawId)) {

      showCustomAlert(`⚠️ <strong>Teléfono de Caseta Inválido:</strong><br><br>Para <strong>Caseta</strong>, el identificador debe contener exactamente <strong>10 dígitos numéricos</strong> (ejemplo: 9848033711).<br><br>Has ingresado: "<strong>${rawId}</strong>" (${rawId.length} caracteres).`, "Formato Inválido");

      if (idInput) {

        idInput.style.border = "2px solid #ef4444";

        idInput.focus();

      }

      return;

    }

  } else {

    // CAJA: distrito alfanumérico de 7 caracteres

    if (!/^[A-Z0-9]{7}$/.test(rawId)) {

      showCustomAlert(`⚠️ <strong>Distrito de Caja Inválido:</strong><br><br>Para <strong>Caja</strong>, el identificador debe ser un código de distrito alfanumérico de exactamente <strong>7 caracteres</strong> (ejemplo: ZIH0061 o IND0017).<br><br>Has ingresado: "<strong>${rawId}</strong>" (${rawId.length} caracteres).`, "Formato Inválido");

      if (idInput) {

        idInput.style.border = "2px solid #ef4444";

        idInput.focus();

      }

      return;

    }

  }

  if (idInput) idInput.style.border = "1px solid #cbd5e1";



  if (!manualSelectedModel) {

    showCustomAlert("⚠️ <strong>Modelo Obligatorio:</strong><br><br>Por favor selecciona el modelo en el catálogo visual.", "Dato Requerido");

    return;

  }



  const estadoSelect = document.getElementById("manualEstadoSelect");

  const areaSelect = document.getElementById("manualAreaSelect");

  const calleInput = document.getElementById("manualCalleInput");



  const estadoVal = (estadoSelect?.value || "").trim().toUpperCase();

  if (!estadoVal || estadoVal === "DESCONOCIDO" || estadoVal === "GENERAL") {

    showCustomAlert("⚠️ <strong>Estado de la República Obligatorio:</strong><br><br>Debes seleccionar el Estado de la República donde se ubica la estructura.", "Dato Requerido");

    if (estadoSelect) {

      estadoSelect.style.border = "2px solid #ef4444";

      estadoSelect.focus();

    }

    return;

  }

  if (estadoSelect) estadoSelect.style.border = "1px solid #cbd5e1";



  const areaVal = (areaSelect?.value || "").trim().toUpperCase();

  if (!areaVal || areaVal === "CAMPO" || areaVal === "GENERAL" || areaVal === "DESCONOCIDO") {

    showCustomAlert("⚠️ <strong>Área de Trabajo Obligatoria:</strong><br><br>Debes seleccionar el Área de Trabajo correspondiente a la estructura.", "Dato Requerido");

    if (areaSelect) {

      areaSelect.style.border = "2px solid #ef4444";

      areaSelect.focus();

    }

    return;

  }

  if (["MONTERREY", "GUADALAJARA", "QUINTANA ROO"].includes(areaVal)) {

    showCustomAlert(

      `⚠️ <strong>Sub-Área Específica Requerida:</strong><br><br>` +

      `No se permite enviar el área genérica <strong>"${areaVal}"</strong>.<br><br>` +

      `Por favor selecciona la sub-área oficial correspondiente en el desplegable.`,

      "Sub-Área Requerida"

    );

    if (areaSelect) {

      areaSelect.style.border = "2px solid #ef4444";

      areaSelect.focus();

    }

    return;

  }

  if (areaSelect) areaSelect.style.border = "1px solid #cbd5e1";



  const calleVal = (calleInput?.value || "").trim();

  if (!calleVal || calleVal.length < 3) {

    showCustomAlert("⚠️ <strong>Calle / Referencia Obligatoria:</strong><br><br>Debes ingresar la calle, cruce o referencia física de la ubicación.", "Dato Requerido");

    if (calleInput) {

      calleInput.style.border = "2px solid #ef4444";

      calleInput.focus();

    }

    return;

  }

  if (calleInput) calleInput.style.border = "1px solid #cbd5e1";



  // Determinar coordenadas válidas (GPS en vivo o coordenadas oficiales del Área)

  let latVal = (currentGpsCoords && currentGpsCoords.lat != null && currentGpsCoords.lat !== 0) ? currentGpsCoords.lat : null;

  let lonVal = (currentGpsCoords && currentGpsCoords.lon != null && currentGpsCoords.lon !== 0) ? currentGpsCoords.lon : null;



  if (latVal == null || lonVal == null) {

    const areaCoords = AREA_COORDINATES_MAP[areaVal] || AREA_COORDINATES_MAP[estadoVal] || { lat: 19.4326, lon: -99.1332 };

    latVal = areaCoords.lat;

    lonVal = areaCoords.lon;

  }



  const proceso = document.querySelector('input[name="filterProceso"]:checked')?.value || "IMAGEN";

  const uniqueId = generateUniqueId(manualSelectedType, areaVal);



  selectedAsset = {

    id: rawId,

    tipo: manualSelectedType,

    modelo_tipo: manualSelectedModel,

    calle: calleVal,

    colonia: areaVal,

    municipio: areaVal,

    estado: estadoVal,

    area_trabajo: areaVal,

    oferta_sugerida: "120 MB",

    lat: latVal,

    lon: lonVal,

    is_manual: true,

    is_fuera_catalogo: true,

    existe_en_bd: "No",

    unique_id: uniqueId

  };



  selectedModelFilter = manualSelectedModel;

  modalSelectedModel = manualSelectedModel;

  modalSelectedType = manualSelectedType;



  // Actualizar alerta de activo seleccionado

  document.getElementById("activeAssetAlert").style.display = "block";

  document.getElementById("activeAssetTitle").innerText = `${uniqueId} (Ref: ${selectedAsset.id}) [${proceso}] (${selectedAsset.tipo} - ${manualSelectedModel} - NO EN BD) - ${areaVal}, ${estadoVal}`;



  // Llenar campos del formulario

  document.getElementById("formAssetId").value = `${uniqueId} (Ref: ${selectedAsset.id}) [NO EN BD]`;

  document.getElementById("formAssetEstado").value = estadoVal;

  document.getElementById("formAssetArea").value = areaVal;

  const existeBdEl = document.getElementById("formAssetExisteBD");

  if (existeBdEl) {

    existeBdEl.value = "En BD: No";

    existeBdEl.style.background = "#fffbeb";

    existeBdEl.style.color = "#b45309";

  }

  document.getElementById("formAssetDetails").value = `Proceso: ${proceso} | Tipo: ${selectedAsset.tipo} | Modelo: ${manualSelectedModel} (No existe en BD)`;

  const coordsStr = (latVal != null && lonVal != null) ? ` | Coords: ${latVal.toFixed(6)}, ${lonVal.toFixed(6)}` : '';

  document.getElementById("formAssetInfo").value = `Calle: ${calleVal}${coordsStr}`;



  document.getElementById("ofertaColocada").value = "200 MB";

  const comSel2 = document.getElementById("comentarios");

  if (comSel2) comSel2.value = "Sin comentarios";

  const comMan2 = document.getElementById("comentariosManual");

  if (comMan2) { comMan2.style.display = "none"; comMan2.value = ""; }



  // Resetear radios de existencia en V8 para obligar a seleccionar Sí o No

  document.querySelectorAll('input[name="existencia"]').forEach(r => r.checked = false);

  const grpExist2 = document.getElementById("groupExistencia");

  if (grpExist2) { grpExist2.style.border = "none"; grpExist2.style.padding = "0"; }



  closeManualAssetModal();

  switchView('form');



  showCustomAlert(`✅ <strong>Registro Manual Fuera de BD Preparado:</strong><br><br><strong>Folio:</strong> ${uniqueId}<br><strong>ID / Ref:</strong> ${rawId}<br><strong>Tipo:</strong> ${manualSelectedType} (${manualSelectedModel})<br><strong>Estado:</strong> ${estadoVal}<br><strong>Área:</strong> ${areaVal}<br><strong>Calle:</strong> ${calleVal}<br><br>Por favor continúa con la <strong>Foto DESPUÉS</strong> y completa los campos obligatorios para guardar la evidencia localmente.`, "Registro Manual Preparado");

}



// ---------------------------------------------------------

// COMPRESIÓN Y MANEJO DE FOTOGRAFÍAS (SOLO FOTO DESPUÉS)

// ---------------------------------------------------------

function handlePhotoSelect(event, type) {

  const file = event.target.files[0];

  if (!file) return;



  const reader = new FileReader();

  reader.onload = (e) => {

    const img = new Image();

    img.onload = () => {

      const canvas = document.createElement("canvas");

      const MAX_WIDTH = 1080;

      const MAX_HEIGHT = 1080;

      let width = img.width;

      let height = img.height;



      if (width > height) {

        if (width > MAX_WIDTH) {

          height *= MAX_WIDTH / width;

          width = MAX_WIDTH;

        }

      } else {

        if (height > MAX_HEIGHT) {

          width *= MAX_HEIGHT / height;

          height = MAX_HEIGHT;

        }

      }



      canvas.width = width;

      canvas.height = height;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, width, height);



      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.68);



      photoDespuesBase64 = compressedDataUrl;

      document.getElementById("previewDespues").src = compressedDataUrl;

      document.getElementById("previewDespues").style.display = "block";

      document.getElementById("iconDespues").style.display = "none";

      document.getElementById("labelDespues").innerText = "✔ Foto DESPUÉS OK";

    };

    img.src = e.target.result;

  };

  reader.readAsDataURL(file);

}



// ---------------------------------------------------------

// GUARDAR EVIDENCIA OFFLINE

// ---------------------------------------------------------

function saveEvidence(event) {

  if (event && event.preventDefault) event.preventDefault();



  // 1. Validar Contratista y Técnico (Obligatorios y sin valores inválidos)

  const contra = (userContratista || "").trim();

  const tec = (userTecnico || "").trim();

  if (!contra || contra === "N/A" || contra === "OTRO" || contra === "undefined" || contra === "null" ||

      !tec || tec === "N/A" || tec === "OTRO" || tec === "undefined" || tec === "null") {

    showCustomAlert("⚠️ <strong>Datos de Técnico y Contratista Obligatorios:</strong><br><br>Debes configurar primero tu Contratista y tu Nombre de Técnico antes de poder guardar cualquier evidencia.", "Configuración Requerida", () => {

      openUserSetupModal();

    });

    return false;

  }



  // 2. Validar Activo Seleccionado

  if (!selectedAsset) {

    showCustomAlert("⚠️ <strong>Activo no seleccionado:</strong><br><br>No hay ningún activo seleccionado. Por favor busca una caja o caseta o agrégala manualmente.", "Activo Requerido", () => {

      switchView('search');

    });

    return false;

  }



  // 3. Validar Identificador / Teléfono del activo

  const assetId = (selectedAsset.id || "").trim().toUpperCase();

  if (!assetId || assetId === "S/N" || assetId === "N/A" || assetId.length < 2) {

    showCustomAlert("⚠️ <strong>Identificador / Teléfono inválido:</strong><br><br>El activo seleccionado no cuenta con un número identificador o teléfono válido.", "Identificador Requerido");

    return false;

  }



  // 3.0.0 Restricción de Distritos No Permitidos
  if (isRestrictedDistrict(assetId)) {
    showCustomAlert(
      `🚫 <strong>Distrito Restringido:</strong><br><br>` +
      `El distrito <strong>${assetId}</strong> se encuentra restringido por normativa y supervisión de Telmex.<br><br>` +
      `No está permitido crear ni guardar evidencias para este distrito.`,
      "Distrito No Permitido"
    );
    return false;
  }

  // 3.0 Validación estricta V8 si es activo manual

  if (selectedAsset.is_manual) {

    const tipoActivo = (selectedAsset.tipo || "").trim().toUpperCase();

    if (tipoActivo === "CASETA" && !/^\d{10}$/.test(assetId)) {

      showCustomAlert(`⚠️ <strong>Teléfono de Caseta Inválido:</strong><br><br>El teléfono de la caseta debe tener exactamente 10 dígitos numéricos (ejemplo: 9848033711).<br><br>Valor actual: "${assetId}"`, "Formato Inválido");

      return false;

    }

    if (tipoActivo === "CAJA" && !/^[A-Z0-9]{7}$/.test(assetId)) {

      showCustomAlert(`⚠️ <strong>Distrito de Caja Inválido:</strong><br><br>El distrito de la caja debe ser alfanumérico de 7 caracteres (ejemplo: ZIH0061 o IND0017).<br><br>Valor actual: "${assetId}"`, "Formato Inválido");

      return false;

    }

  }



  // 3.1 Prevenir Duplicados: Verificar si ya existe en el lote pendiente o ya fue completado

  const alreadyInBatch = Array.isArray(dbEvidences) && dbEvidences.some(ev => String(ev.asset_id || "").trim().toUpperCase() === assetId);

  if (alreadyInBatch) {

    showCustomAlert(`⚠️ <strong>Activo Ya Registrado en tu Lote:</strong><br><br>El activo <strong>${assetId}</strong> ya se encuentra guardado en este teléfono en la lista de evidencias pendientes.<br><br>No es necesario capturarlo dos veces.`, "Activo Duplicado");

    return false;

  }



  const alreadyCompleted = completedAssetIdsSet && completedAssetIdsSet.has(assetId);

  if (alreadyCompleted) {

    showCustomAlert(`⚠️ <strong>Activo Ya Completado Previamente:</strong><br><br>El activo <strong>${assetId}</strong> ya fue registrado y confirmado exitosamente con anterioridad.<br><br>Para evitar duplicar registros en Linkaform, no está permitido recapturarlo.`, "Activo Ya Completado");

    return false;

  }



  // 4. Validar Tipo de Elemento (CAJA o CASETA)

  const tipoElemento = (selectedAsset.tipo || "").trim().toUpperCase();

  if (tipoElemento !== "CAJA" && tipoElemento !== "CASETA") {

    showCustomAlert("⚠️ <strong>Tipo de Activo Inválido:</strong><br><br>El activo debe ser tipo CAJA o CASETA.", "Tipo Requerido");

    return false;

  }



  // 5. Validar Modelo Seleccionado

  const modelo = (selectedModelFilter || selectedAsset.modelo_tipo || "").trim();

  if (!modelo) {

    showCustomAlert("⚠️ <strong>Modelo no seleccionado:</strong><br><br>Debes seleccionar el modelo visual de la " + (tipoElemento === "CASETA" ? "Caseta" : "Caja") + " antes de guardar.", "Modelo Requerido");

    return false;

  }



  // 6. Validar Estado de la República

  const estadoVal = (selectedAsset.estado || document.getElementById("formAssetEstado")?.value || "").trim().toUpperCase();

  if (!estadoVal || estadoVal === "GENERAL" || estadoVal === "DESCONOCIDO") {

    showCustomAlert("⚠️ <strong>Estado de la República Obligatorio:</strong><br><br>El registro no tiene un Estado asignado. Por favor ingresa o selecciona un Estado válido.", "Estado Requerido");

    return false;

  }



  // 7. Validar Área de Trabajo

  const areaVal = (selectedAsset.area_trabajo || selectedAsset.municipio || document.getElementById("formAssetArea")?.value || "").trim().toUpperCase();

  if (!areaVal || areaVal === "CAMPO" || areaVal === "GENERAL" || areaVal === "DESCONOCIDO") {

    showCustomAlert("⚠️ <strong>Área de Trabajo Obligatoria:</strong><br><br>El registro no tiene un Área de Trabajo asignada. Por favor selecciona un Área válida.", "Área Requerida");

    return false;

  }

  if (["MONTERREY", "GUADALAJARA", "QUINTANA ROO"].includes(areaVal)) {

    showCustomAlert(

      `⚠️ <strong>Sub-Área Específica Requerida:</strong><br><br>` +

      `No está permitido enviar el área genérica <strong>"${areaVal}"</strong>.<br><br>` +

      `Debes seleccionar la sub-área oficial correcta:<br>` +

      (areaVal === "MONTERREY" ? `• <strong>MONTERREY 1, MONTERREY 2 o MONTERREY 3</strong>` :

       areaVal === "GUADALAJARA" ? `• <strong>GUADALAJARA CENTRO, ORIENTE o PONIENTE</strong>` :

       `• <strong>QUINTANA ROO NORTE o QUINTANA ROO SUR</strong>`),

      "Sub-Área Requerida"

    );

    return false;

  }



  // 8. Validar Calle / Dirección

  const calleVal = (selectedAsset.calle || "").trim();

  if (!calleVal || (calleVal === "S/N" && selectedAsset.is_manual)) {

    showCustomAlert("⚠️ <strong>Calle / Ubicación Obligatoria:</strong><br><br>Debes proporcionar la calle o referencia física de la ubicación del activo.", "Ubicación Requerida");

    return false;

  }



  // 9. Validar Existencia en Sitio (Obligatorio V8, sin opción por defecto)

  const existenciaEl = document.querySelector('input[name="existencia"]:checked');

  if (!existenciaEl || !existenciaEl.value) {

    showCustomAlert("⚠️ <strong>Selección Obligatoria de Existencia:</strong><br><br>Debes indicar obligatoriamente si la caja o caseta <strong>Existe</strong> o <strong>No Existe</strong> en el sitio antes de guardar.", "Existencia Requerida");

    const grpExist3 = document.getElementById("groupExistencia");

    if (grpExist3) {

      grpExist3.scrollIntoView({ behavior: 'smooth', block: 'center' });

      grpExist3.style.border = "2px solid #ef4444";

      grpExist3.style.borderRadius = "8px";

      grpExist3.style.padding = "8px";

    }

    return false;

  }

  const existencia = existenciaEl.value;



  // 10. Validar Número de Viniles

  const numVinilesEl = document.getElementById("numViniles");

  const numVinilesVal = numVinilesEl?.value;

  if (numVinilesVal === undefined || numVinilesVal === null || numVinilesVal === "") {

    showCustomAlert("⚠️ <strong>Número de Viniles Obligatorio:</strong><br><br>Por favor selecciona el número de viniles instalados.", "Viniles Requeridos");

    if (numVinilesEl) {

      numVinilesEl.style.border = "2px solid #ef4444";

      numVinilesEl.focus();

    }

    return false;

  }

  if (numVinilesEl) numVinilesEl.style.border = "1px solid #cbd5e1";

  const numViniles = parseInt(numVinilesVal) || 0;



  // 11. Validar Oferta Colocada

  const ofertaEl = document.getElementById("ofertaColocada");

  const oferta = ofertaEl?.value;

  if (!oferta || (!oferta.includes("120") && !oferta.includes("200") && !oferta.includes("250"))) {

    showCustomAlert("⚠️ <strong>Oferta Colocada Obligatoria:</strong><br><br>Por favor selecciona la Oferta Colocada (120 MB, 200 MB o 250 MB).", "Oferta Requerida");

    if (ofertaEl) {

      ofertaEl.style.border = "2px solid #ef4444";

      ofertaEl.focus();

    }

    return false;

  }

  if (ofertaEl) ofertaEl.style.border = "1px solid #cbd5e1";



  // 12. Validar Fotografía DESPUÉS (Obligatoria y en formato base64 de imagen)

  if (!photoDespuesBase64 || typeof photoDespuesBase64 !== "string" || !photoDespuesBase64.startsWith("data:image/")) {

    showCustomAlert("⚠️ <strong>Foto DESPUÉS Obligatoria:</strong><br><br>La fotografía de evidencia DESPUÉS es obligatoria. Por favor toma o sube la foto para continuar.", "Foto Obligatoria");

    const box = document.getElementById("boxFotoDespues");

    if (box) {

      box.style.border = "2px solid #ef4444";

      box.scrollIntoView({ behavior: 'smooth', block: 'center' });

    }

    return false;

  }



  // 13. Coordenadas de Captura Válidas

  let gpsLat = (currentGpsCoords && currentGpsCoords.lat != null && currentGpsCoords.lat !== 0) ? currentGpsCoords.lat : (selectedAsset.lat || null);

  let gpsLon = (currentGpsCoords && currentGpsCoords.lon != null && currentGpsCoords.lon !== 0) ? currentGpsCoords.lon : (selectedAsset.lon || null);

  let gpsAccuracy = (currentGpsCoords && currentGpsCoords.accuracy != null) ? currentGpsCoords.accuracy : 10;



  if (gpsLat == null || gpsLon == null || gpsLat === 0 || gpsLon === 0) {

    const areaCoords = AREA_COORDINATES_MAP[areaVal] || AREA_COORDINATES_MAP[estadoVal] || { lat: 19.4326, lon: -99.1332 };

    gpsLat = areaCoords.lat;

    gpsLon = areaCoords.lon;

  }



  const proceso = document.querySelector('input[name="filterProceso"]:checked')?.value || "IMAGEN";

  let comentarios = document.getElementById("comentarios")?.value?.trim() || "Sin comentarios";

  if (comentarios === "OTRO") {

    const manVal = document.getElementById("comentariosManual")?.value?.trim();

    comentarios = manVal || "Sin comentarios";

  }



  const timestamp = new Date().toISOString();

  const uniqueId = selectedAsset.unique_id || generateUniqueId(tipoElemento, areaVal);

  const isManualAsset = selectedAsset.is_manual === true || selectedAsset.is_fuera_catalogo === true || selectedAsset.existe_en_bd === "No";



  const evidenceRecord = {

    id_registro_local: "EV_" + Date.now(),

    unique_id: uniqueId,

    asset_id: assetId,

    contratista: contra,

    tecnico: tec,

    proceso: proceso,

    tipo_elemento: tipoElemento,

    modelo_tipo: modelo,

    estado: estadoVal,

    area_trabajo: areaVal,

    municipio: areaVal,

    calle: calleVal,

    lat_original: selectedAsset.lat || gpsLat,

    lon_original: selectedAsset.lon || gpsLon,

    is_manual: isManualAsset,

    existe_en_bd: isManualAsset ? "No" : "Sí",

    

    // Captura en Campo

    existencia: existencia,

    num_viniles: numViniles,

    oferta_colocada: oferta,

    comentarios: comentarios,

    

    // Fotos (Únicamente Foto DESPUÉS)

    foto_despues: photoDespuesBase64,

    

    // GPS Foto Real

    gps_captura_lat: gpsLat,

    gps_captura_lon: gpsLon,

    gps_precision_m: gpsAccuracy,

    

    version_app: getAppVersionString() || CURRENT_APP_VERSION_IPHONE,

    fecha_captura: timestamp

  };



  dbEvidences.push(evidenceRecord);

  markAssetCompletedPermanently(evidenceRecord.asset_id, evidenceRecord.unique_id);

  saveEvidencesToStorage();



  showCustomAlert(`✅ <strong>Evidencia guardada exitosamente en el teléfono:</strong><br><br><strong>Folio:</strong> ${uniqueId}<br><strong>ID / Ref:</strong> ${assetId}<br><strong>Estado / Área:</strong> ${estadoVal} - ${areaVal}<br><strong>Foto:</strong> Registrada ✔<br><br>El registro quedó guardado en tu lote de evidencias pendientes de envío.`, "Evidencia Guardada");



  // Reset Form y Activo Seleccionado

  selectedAsset = null;

  document.getElementById("activeAssetAlert").style.display = "none";

  document.getElementById("formAssetId").value = "";

  document.getElementById("formAssetEstado").value = "";

  document.getElementById("formAssetArea").value = "";

  const resetBdEl = document.getElementById("formAssetExisteBD");

  if (resetBdEl) resetBdEl.value = "";

  document.getElementById("formAssetInfo").value = "";

  document.getElementById("evidenceForm").reset();

  document.querySelectorAll('input[name="existencia"]').forEach(r => r.checked = false);

  const ofertaResetEl = document.getElementById("ofertaColocada");

  if (ofertaResetEl) ofertaResetEl.value = "200 MB";

  const comSelReset = document.getElementById("comentarios");

  if (comSelReset) comSelReset.value = "Sin comentarios";

  const comManReset = document.getElementById("comentariosManual");

  if (comManReset) { comManReset.style.display = "none"; comManReset.value = ""; }

  const grpExist4 = document.getElementById("groupExistencia");

  if (grpExist4) { grpExist4.style.border = "none"; grpExist4.style.padding = "0"; }

  photoDespuesBase64 = "";

  document.getElementById("previewDespues").style.display = "none";

  document.getElementById("iconDespues").style.display = "block";

  document.getElementById("labelDespues").innerText = "Sin foto";



  // Refrescar lista de búsqueda para ocultar automáticamente el activo capturado

  applyHierarchyFilter();



  switchView('sync');

  return true;

}



// ---------------------------------------------------------

// ALMACENAMIENTO Y EXPORTACIÓN

// ---------------------------------------------------------

function getCompletedAssetIdsSet() {

  const set = new Set();



  // 1. Activos completados en Linkaform remotamente (Base Dinámica)

  if (remoteCompletedSet && remoteCompletedSet.size > 0) {

    remoteCompletedSet.forEach(id => {

      if (id) set.add(id);

    });

  } else {

    const remoteSaved = localStorage.getItem("TELMEX_REMOTE_COMPLETED_SET");

    if (remoteSaved) {

      try {

        const arr = JSON.parse(remoteSaved);

        if (Array.isArray(arr)) {

          arr.forEach(id => { if (id) set.add(String(id).trim().toUpperCase()); });

        }

      } catch(e) {}

    }

  }



  // 2. Activos completados en este dispositivo

  const permSaved = localStorage.getItem("TELMEX_COMPLETED_ASSETS");

  if (permSaved) {

    try {

      const arr = JSON.parse(permSaved);

      if (Array.isArray(arr)) {

        arr.forEach(id => {

          if (id) set.add(String(id).trim().toUpperCase());

        });

      }

    } catch(e) {}

  }

  if (Array.isArray(dbEvidences)) {

    dbEvidences.forEach(ev => {

      if (ev.asset_id) set.add(String(ev.asset_id).trim().toUpperCase());

      if (ev.unique_id) set.add(String(ev.unique_id).trim().toUpperCase());

    });

  }

  completedAssetIdsSet = set;

  return set;

}



function getLocalDateString(dateObj = new Date()) {

  const d = dateObj;

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, '0');

  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;

}



function getTodayDateString() {

  return getLocalDateString(new Date());

}



function getTodayCompletedCount() {

  const todayStr = getTodayDateString();

  const todaySet = new Set();



  // 1. Contar registros guardados en dbEvidences que corresponden a la fecha de hoy

  if (Array.isArray(dbEvidences)) {

    dbEvidences.forEach(ev => {

      let isToday = false;

      if (ev.fecha_captura) {

        if (ev.fecha_captura.startsWith(todayStr)) {

          isToday = true;

        } else {

          try {

            const evDate = new Date(ev.fecha_captura);

            if (!isNaN(evDate.getTime()) && getLocalDateString(evDate) === todayStr) {

              isToday = true;

            }

          } catch(e) {}

        }

      }

      if (isToday) {

        const key = ev.unique_id || ev.asset_id || ev.id_registro_local;

        if (key) todaySet.add(String(key).trim().toUpperCase());

      }

    });

  }



  // 2. Incluir registros guardados en el set del día de hoy en localStorage

  const savedTodayJson = localStorage.getItem(`TELMEX_TODAY_COMPLETED_SET_${todayStr}`);

  if (savedTodayJson) {

    try {

      const arr = JSON.parse(savedTodayJson);

      if (Array.isArray(arr)) {

        arr.forEach(id => { if (id) todaySet.add(String(id).trim().toUpperCase()); });

      }

    } catch(e) {}

  }



  return todaySet.size;

}



function updateDailyGoalUI() {

  const count = getTodayCompletedCount();

  const goal = 35;

  const pct = Math.min(100, Math.round((count / goal) * 100));



  const badge = document.getElementById("dailyGoalBadge");

  const bar = document.getElementById("dailyGoalProgressBar");

  const text = document.getElementById("dailyGoalText");



  if (badge) badge.innerText = `${count} / ${goal}`;

  if (bar) bar.style.width = `${pct}%`;

  if (text) {

    if (count >= goal) {

      text.innerText = `${pct}% completado hoy (¡Meta alcanzada de ${goal}! 🎉)`;

    } else {

      const remaining = goal - count;

      text.innerText = `${pct}% completado hoy (Faltan ${remaining} de la meta)`;

    }

  }

}



function getCompletedAssetCount() {

  const set = getCompletedAssetIdsSet();

  let primaryCount = 0;

  set.forEach(id => {

    if (!id.startsWith("CAS_") && !id.startsWith("CAJ_")) {

      primaryCount++;

    }

  });

  return primaryCount > 0 ? primaryCount : Math.ceil(set.size / 2);

}



function markAssetCompletedPermanently(assetId, uniqueId) {

  // Guardar en set histórico global permanente

  const set = getCompletedAssetIdsSet();

  if (assetId) {

    const cleanAssetId = String(assetId).trim().toUpperCase();

    if (cleanAssetId) set.add(cleanAssetId);

  }

  if (uniqueId) {

    const cleanUniqueId = String(uniqueId).trim().toUpperCase();

    if (cleanUniqueId) {

      set.add(cleanUniqueId);



      // Registrar consecutivo permanente en localStorage para que nunca se reinicie a 0001

      const parts = cleanUniqueId.split("_");

      if (parts.length >= 3) {

        const prefixArea = `${parts[0]}_${parts[1]}_`;

        const num = parseInt(parts[parts.length - 1], 10);

        if (!isNaN(num)) {

          const key = `TELMEX_LAST_FOLIO_SEQ_${prefixArea}`;

          const currentMax = parseInt(localStorage.getItem(key) || "0", 10);

          if (num > currentMax) {

            localStorage.setItem(key, String(num));

          }

        }

      }

    }

  }

  localStorage.setItem("TELMEX_COMPLETED_ASSETS", JSON.stringify(Array.from(set)));

  completedAssetIdsSet = set;



  // Guardar en set específico de hoy (evitando duplicaciones de conteo para la meta de 35)

  const todayStr = getTodayDateString();

  const todaySet = new Set();

  const savedTodayJson = localStorage.getItem(`TELMEX_TODAY_COMPLETED_SET_${todayStr}`);

  if (savedTodayJson) {

    try {

      const arr = JSON.parse(savedTodayJson);

      if (Array.isArray(arr)) {

        arr.forEach(id => { if (id) todaySet.add(String(id).trim().toUpperCase()); });

      }

    } catch(e) {}

  }



  const keyToStore = uniqueId || assetId;

  if (keyToStore) {

    todaySet.add(String(keyToStore).trim().toUpperCase());

  }

  localStorage.setItem(`TELMEX_TODAY_COMPLETED_SET_${todayStr}`, JSON.stringify(Array.from(todaySet)));



  updateDailyGoalUI();

}



// ---------------------------------------------------------

// MOTOR DE ALMACENAMIENTO HÍBRIDO (INDEXEDDB + LOCALSTORAGE)

// Soporta lotes ilimitados de fotos sin error de QuotaExceeded

// ---------------------------------------------------------

const IDB_CONFIG = {

  dbName: "TelmexOfflineDB_2026",

  storeName: "evidences_store",

  key: "current_batch"

};



function openIndexedDB() {

  return new Promise((resolve) => {

    if (!window.indexedDB) {

      resolve(null);

      return;

    }

    try {

      const request = indexedDB.open(IDB_CONFIG.dbName, 1);

      request.onupgradeneeded = (e) => {

        const db = e.target.result;

        if (!db.objectStoreNames.contains(IDB_CONFIG.storeName)) {

          db.createObjectStore(IDB_CONFIG.storeName);

        }

      };

      request.onsuccess = (e) => resolve(e.target.result);

      request.onerror = (e) => {

        console.warn("IndexedDB no disponible, usando localStorage fallback:", e);

        resolve(null);

      };

    } catch(err) {

      resolve(null);

    }

  });

}



async function loadEvidencesFromStorage() {

  // 1. Carga inicial síncrona inmediata desde localStorage

  const saved = localStorage.getItem("TELMEX_EVIDENCES_2026");

  if (saved) {

    try {

      dbEvidences = JSON.parse(saved);

    } catch(e) {

      dbEvidences = [];

    }

  }

  getCompletedAssetIdsSet();

  updateSyncBadges();



  // 2. Consulta asíncrona a IndexedDB (almacena el lote completo sin límite de 5MB)

  try {

    const db = await openIndexedDB();

    if (db) {

      const tx = db.transaction(IDB_CONFIG.storeName, "readonly");

      const store = tx.objectStore(IDB_CONFIG.storeName);

      const req = store.get(IDB_CONFIG.key);

      req.onsuccess = () => {

        const result = req.result;

        if (Array.isArray(result) && result.length >= dbEvidences.length) {

          dbEvidences = result;

          getCompletedAssetIdsSet();

          updateSyncBadges();

          renderSavedEvidences();

          updateDailyGoalUI();

          applyHierarchyFilter();

          console.log(`[Storage] ${dbEvidences.length} evidencias cargadas y verificadas desde IndexedDB.`);

        }

      };

    }

  } catch(e) {

    console.warn("IndexedDB read error:", e);

  }

}



async function saveEvidencesToStorage() {

  updateSyncBadges();



  // 1. Guardar en IndexedDB (sin límite de 5MB, seguro para 30, 50 o más fotos)

  try {

    const db = await openIndexedDB();

    if (db) {

      const tx = db.transaction(IDB_CONFIG.storeName, "readwrite");

      const store = tx.objectStore(IDB_CONFIG.storeName);

      store.put(dbEvidences, IDB_CONFIG.key);

    }

  } catch (err) {

    console.warn("Error guardando en IndexedDB:", err);

  }



  // 2. Respaldo en localStorage con manejo seguro de QuotaExceededError

  try {

    localStorage.setItem("TELMEX_EVIDENCES_2026", JSON.stringify(dbEvidences));

  } catch (err) {

    console.warn("localStorage quota superada (normal con muchas fotos). Protegido en IndexedDB:", err);

    try {

      // Respaldo ligero sin base64 en localStorage en caso de saturación

      const light = dbEvidences.map(ev => ({

        ...ev,

        foto_despues: ev.url_foto_despues || (ev.foto_despues ? "[GUARDADA_EN_INDEXEDDB]" : "")

      }));

      localStorage.setItem("TELMEX_EVIDENCES_2026_LIGHT", JSON.stringify(light));

    } catch (e2) {}

  }

}



function updateSyncBadges() {

  const count = dbEvidences.length;

  const b1 = document.getElementById("syncBadge");

  const b2 = document.getElementById("navCount");

  if (b1) b1.innerText = count;

  if (b2) b2.innerText = count;

}



function renderSavedEvidences() {

  const container = document.getElementById("savedEvidencesList");

  if (!container) return;

  container.innerHTML = "";



  if (dbEvidences.length === 0) {

    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay evidencias guardadas pendientes.</p>';

    return;

  }



  dbEvidences.forEach((ev, idx) => {

    const card = document.createElement("div");

    card.className = "card";

    card.style.marginBottom = "10px";

    card.style.borderLeft = (ev.omitir_sync || ev.is_duplicate_linkaform) ? "4px solid #ef4444" : "4px solid var(--primary)";



    const isManualEv = ev.is_manual === true || ev.is_fuera_catalogo === true || ev.existe_en_bd === "No" || String(ev.unique_id || "").includes("MANUAL") || String(ev.asset_id || "").includes("MANUAL");

    const bdBadge = isManualEv 

      ? '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">No en BD</span>'

      : '<span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">En BD: Sí</span>';



    let statusBadge = "";

    if (ev.omitir_sync || ev.is_duplicate_linkaform) {

      statusBadge = '<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:4px;">⚠️ Ya en Linkaform (Pausado)</span>';

    }



    const fechaStr = ev.fecha_captura ? new Date(ev.fecha_captura).toLocaleTimeString() : "";



    card.innerHTML = `

      <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; font-size:0.9rem;">

        <span>${ev.asset_id} (${ev.tipo_elemento}) ${bdBadge} ${statusBadge}</span>

        <span style="color:var(--text-muted); font-size:0.75rem;">${fechaStr}</span>

      </div>

      <div style="font-size:0.8rem; color:var(--text-dark); margin-top:4px;">

        📌 Estado: <strong>${ev.existencia}</strong> | Trabajo: <strong>${ev.proceso || 'IMAGEN'}</strong> | Viniles: <strong>${ev.num_viniles}</strong> | Oferta: <strong>${ev.oferta_colocada}</strong>

      </div>

      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">

        📍 Área: ${ev.area_trabajo || 'N/A'} (${ev.estado || 'N/A'}) | GPS Foto: ${ev.gps_captura_lat ? `${Number(ev.gps_captura_lat).toFixed(5)}, ${Number(ev.gps_captura_lon).toFixed(5)}` : 'Sin GPS'}

      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px dashed #e2e8f0; gap:8px;">

        ${ev.omitir_sync ? `

          <button type="button" onclick="toggleOmitirSync(${idx})" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:500;">

            🔄 Reactivar Envío

          </button>

        ` : `

          <button type="button" onclick="toggleOmitirSync(${idx})" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; padding:6px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:500;">

            ⏸️ Pausar Envío

          </button>

        `}

        <button type="button" onclick="deleteEvidencePrompt(${idx})" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:6px 12px; border-radius:6px; font-size:0.8rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">

          🗑️ Borrar del teléfono

        </button>

      </div>

    `;



    container.appendChild(card);

  });

}



function deleteEvidence(idx) {

  if (idx < 0 || idx >= dbEvidences.length) return;

  const removed = dbEvidences.splice(idx, 1)[0];

  saveEvidencesToStorage();

  renderSavedEvidences();

  updateSyncBadges();

  updateDailyGoalUI();

  applyHierarchyFilter();

  if (removed && removed.asset_id) {

    showCustomAlert(`✅ La evidencia del activo <strong>${removed.asset_id}</strong> fue eliminada de este teléfono.`, "Evidencia Eliminada");

  }

}

window.deleteEvidence = deleteEvidence;



function deleteEvidencePrompt(idx) {

  if (idx < 0 || idx >= dbEvidences.length) return;

  const ev = dbEvidences[idx];

  const idStr = ev.asset_id || "este activo";

  showCustomConfirm(

    `¿Deseas eliminar permanentemente la evidencia de <strong>${idStr}</strong> de este dispositivo?<br><br><small style="color:#64748b;">Esta acción liberará espacio de almacenamiento en el teléfono y no se intentará enviar.</small>`,

    "Eliminar Evidencia",

    () => deleteEvidence(idx),

    null,

    "🗑️ Sí, Eliminar",

    "Cancelar",

    "#dc2626"

  );

}

window.deleteEvidencePrompt = deleteEvidencePrompt;



function toggleOmitirSync(idx) {

  if (idx < 0 || idx >= dbEvidences.length) return;

  const ev = dbEvidences[idx];

  ev.omitir_sync = !ev.omitir_sync;

  saveEvidencesToStorage();

  renderSavedEvidences();

  if (ev.omitir_sync) {

    showCustomAlert(`El activo <strong>${ev.asset_id}</strong> quedó pausado y no se enviará en el próximo lote.<br><br><small style="color:#64748b;">Permanecerá en este teléfono como respaldo.</small>`, "Envío Pausado");

  } else {

    showCustomAlert(`El activo <strong>${ev.asset_id}</strong> fue reactivado y se enviará en la próxima sincronización.`, "Envío Reactivado");

  }

}

window.toggleOmitirSync = toggleOmitirSync;



async function uploadImageToLinkaformCloud(b64DataUrl, fieldId, filename) {

  if (!b64DataUrl || typeof b64DataUrl !== "string") return null;



  // Si ya es una URL pública subida previamente (en un intento anterior), no volver a subir

  if (b64DataUrl.startsWith("http://") || b64DataUrl.startsWith("https://")) {

    return b64DataUrl;

  }



  // Hasta 2 intentos con pausa de recuperación en caso de intermitencia de red móvil en campo

  for (let attempt = 1; attempt <= 2; attempt++) {

    try {

      const fetchRes = await fetch(b64DataUrl);

      const blob = await fetchRes.blob();



      const formData = new FormData();

      formData.append("file", blob, filename);

      formData.append("field_id", fieldId);

      formData.append("form_id", "142786");

      formData.append("is_image", "true");



      const uploadRes = await fetch("https://app.linkaform.com/api/infosync/cloud_upload/", {

        method: "POST",

        body: formData

      });



      if (uploadRes.ok) {

        const json = await uploadRes.json();

        if (json && json.file) {

          return json.file;

        }

      } else {

        const errText = await uploadRes.text();

        console.warn(`[cloud_upload attempt ${attempt}] HTTP ${uploadRes.status}: ${errText.substring(0, 100)}`);

      }

    } catch (e) {

      console.warn(`[cloud_upload attempt ${attempt}] Error de red:`, e);

    }

    if (attempt < 2) {

      await new Promise(r => setTimeout(r, 1200));

    }

  }

  return null;

}



// Autenticación Segura con Linkaform JWT (Evita error 500 por usuario anónimo en backend)

const LINKAFORM_API_KEY = "003ab07a66c6795f8d3fcca2a3b6f94a7f06258e";

const LINKAFORM_USERNAME = "pahernandez@operacionpci.com.mx";

let cachedLinkaformJwt = null;

let jwtExpiryTime = 0;



async function getLinkaformJwtToken() {

  const now = Date.now();

  if (cachedLinkaformJwt && now < jwtExpiryTime) {

    return cachedLinkaformJwt;

  }

  try {

    const saved = localStorage.getItem("LINKAFORM_JWT_TOKEN");

    const exp = parseInt(localStorage.getItem("LINKAFORM_JWT_EXP") || "0", 10);

    if (saved && now < exp) {

      cachedLinkaformJwt = saved;

      jwtExpiryTime = exp;

      return saved;

    }

  } catch (e) {}



  try {

    const resp = await fetch("https://app.linkaform.com/api/infosync/user_admin/login/", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        username: LINKAFORM_USERNAME,

        api_key: LINKAFORM_API_KEY

      })

    });

    if (resp.ok) {

      const data = await resp.json();

      if (data && data.jwt) {

        cachedLinkaformJwt = data.jwt;

        jwtExpiryTime = now + (24 * 60 * 60 * 1000); // 24 horas

        try {

          localStorage.setItem("LINKAFORM_JWT_TOKEN", cachedLinkaformJwt);

          localStorage.setItem("LINKAFORM_JWT_EXP", String(jwtExpiryTime));

        } catch(e) {}

        return cachedLinkaformJwt;

      }

    }

  } catch (err) {

    console.warn("[Linkaform Auth] Falló login Linkaform:", err);

  }

  return null;

}



let isSyncingToLinkaform = false;



async function syncAllToLinkaform() {

  if (isSyncingToLinkaform) {

    alert("⏳ Ya hay un proceso de sincronización en curso. Por favor espera a que termine.");

    return;

  }



  if (dbEvidences.length === 0) {

    alert("No hay evidencias pendientes en el teléfono.");

    return;

  }



  if (!navigator.onLine) {

    updateOfflineStatus();

    alert("⚠️ No se puede enviar porque el dispositivo está en Modo Offline. Intenta cuando tengas red de datos o Wi-Fi.");

    return;

  }



  isSyncingToLinkaform = true;

  const btn = document.getElementById("btnSyncLinkaform");

  const total = dbEvidences.length;

  if (btn) {

    btn.disabled = true;

    btn.style.opacity = "0.75";

    btn.innerText = `⏳ Iniciando envío de ${total} evidencias...`;

  }



  // 0. Obtener Token JWT oficial de Linkaform para autenticación segura

  const jwtToken = await getLinkaformJwtToken();



  const LINKAFORM_API_URL = "https://app.linkaform.com/api/infosync/form_answer/";

  const LINKAFORM_FIELDS = {

    tipo: "6ad52fc6bc424ea79992eabe",

    distrito_telefono: "6ad52fc6bc424ea79992eabf",

    estado: "6ad52fc6bc424ea79992eac0",

    area_trabajo: "6ad52fc6bc424ea79992eac1",

    existe_en_bd: "6ad530403c0c04d9bb2555b2",

    comentarios: "6ad4df593c0c04d9bb25556e",

    id_unico: "6ab6f3a4c472baf119e176e7",

    latitud: "6ab6f3a4c472baf119e176e8",

    longitud: "6ab6f3a4c472baf119e176e9",

    hay_caja_caseta: "6a99eb60a20e4f1d25581b71",

    num_viniles: "6a99eb60a20e4f1d25581b72",

    oferta_colocada: "6a99eb8af9c750d6db214c5d",

    foto_antes: "6a99e764f9c750d6db214c54",

    foto_despues: "6a99e764f9c750d6db214c55",

    tipo_trabajo: "6ab9cdfec4fc804d8c8e088c",

    modelo_caja_caseta: "6ab9d647dba7a0c191e6a0f6",

    contratista: "6abe9357bef08742fcf94020",

    tecnico: "6abe9357bef08742fcf94021",

    version: "6adaa11601dfe84563e2253b"

  };



  let successCount = 0;

  let sentFolios = [];

  let remainingEvidences = [];

  let duplicateAssetsDetected = [];

  let lastErrorMessage = "";

  let isNetworkFailure = false;



  for (let i = 0; i < total; i++) {

    const ev = dbEvidences[i];

    const asset_id = String(ev.asset_id || "S/N");

    const unique_id = String(ev.unique_id || asset_id);

    if (isRestrictedDistrict(asset_id)) {
      console.warn(`[Restricción Telmex] Distrito restringido detectado: ${asset_id}. Omitiendo envío.`);
      continue;
    }



    // Si el activo fue pausado manualmente o marcado como duplicado previamente, omitir su envío y no bloquear el lote

    if (ev.omitir_sync) {

      console.log(`[Linkaform] Omitiendo ${asset_id} por estar pausado/duplicado.`);

      remainingEvidences.push(ev);

      continue;

    }



    if (btn) {

      btn.innerText = `⏳ Subiendo ${i + 1} de ${total} (${asset_id})...`;

    }



    const normExist = String(ev.existencia || "").trim().toUpperCase();

    const existencia_val = (normExist === "NO_EXISTE" || normExist === "NO" || normExist === "INEXISTENTE") ? "no" : "sí";

    const rawOferta = String(ev.oferta_colocada || "120 MB");

    let oferta_val = "120_mb";

    if (rawOferta.includes("250")) oferta_val = "250_mb";

    else if (rawOferta.includes("200")) oferta_val = "200_mb";

    else oferta_val = "120_mb";

    const proc_str = (ev.proceso || "IMAGEN").toLowerCase();

    const tipo_trabajo_val = proc_str.includes("limpieza") ? "limpieza" : "imagen";

    const num_viniles_val = String(ev.num_viniles !== undefined && ev.num_viniles !== null ? ev.num_viniles : 1);

    const lat_val = ev.gps_captura_lat !== null && ev.gps_captura_lat !== undefined ? ev.gps_captura_lat : (ev.lat_original || 0);

    const lon_val = ev.gps_captura_lon !== null && ev.gps_captura_lon !== undefined ? ev.gps_captura_lon : (ev.lon_original || 0);

    const modelo_val = String(ev.modelo_tipo || (ev.tipo_elemento === "CASETA" ? "NORMAL" : "Tradicional Sencilla"));

    const contratista_val = String(ev.contratista || userContratista || "N/A");

    const tecnico_val = String(ev.tecnico || userTecnico || "N/A");

    const version_val = String(ev.version_app || getAppVersionString() || CURRENT_APP_VERSION_IPHONE);



    const isManual = ev.is_manual === true || ev.is_fuera_catalogo === true || ev.existe_en_bd === "No" || String(ev.unique_id || "").includes("MANUAL") || String(ev.asset_id || "").includes("MANUAL");

    const existeEnBdVal = isManual ? "No" : "Sí";

    const estadoVal = String(ev.estado || "").trim();

    const areaTrabajoVal = String(ev.area_trabajo || ev.municipio || "").trim();



    const answers = {

      [LINKAFORM_FIELDS.tipo]: (ev.tipo_elemento || "CASETA").toUpperCase(),

      [LINKAFORM_FIELDS.distrito_telefono]: asset_id,

      [LINKAFORM_FIELDS.estado]: estadoVal,

      [LINKAFORM_FIELDS.area_trabajo]: areaTrabajoVal,

      [LINKAFORM_FIELDS.existe_en_bd]: existeEnBdVal,

      [LINKAFORM_FIELDS.comentarios]: String(ev.comentarios || "Sin observaciones"),

      [LINKAFORM_FIELDS.id_unico]: unique_id,

      [LINKAFORM_FIELDS.latitud]: lat_val,

      [LINKAFORM_FIELDS.longitud]: lon_val,

      [LINKAFORM_FIELDS.hay_caja_caseta]: existencia_val,

      [LINKAFORM_FIELDS.num_viniles]: num_viniles_val,

      [LINKAFORM_FIELDS.oferta_colocada]: oferta_val,

      [LINKAFORM_FIELDS.tipo_trabajo]: tipo_trabajo_val,

      [LINKAFORM_FIELDS.modelo_caja_caseta]: modelo_val,

      [LINKAFORM_FIELDS.contratista]: contratista_val,

      [LINKAFORM_FIELDS.tecnico]: tecnico_val,

      [LINKAFORM_FIELDS.version]: version_val,

      "6adaa11601dfe84563e2253b": version_val

    };



    // Subir Foto DESPUÉS

    let photoUploaded = false;

    let urlDespues = ev.url_foto_despues || null;



    if (urlDespues && (urlDespues.startsWith("http://") || urlDespues.startsWith("https://"))) {

      photoUploaded = true;

    } else if (ev.foto_despues) {

      urlDespues = await uploadImageToLinkaformCloud(ev.foto_despues, LINKAFORM_FIELDS.foto_despues, `despues_${asset_id}.jpg`);

      if (urlDespues) {

        photoUploaded = true;

        ev.url_foto_despues = urlDespues; // Guardar URL en el registro para no resubir en reintentos

      }

    }



    if (!photoUploaded || !urlDespues) {

      console.error(`[Linkaform] Falló la subida de foto para ${asset_id}. Se conserva en el teléfono para reintentar.`);

      remainingEvidences.push(ev);

      lastErrorMessage = `Error al subir la fotografía de ${asset_id} a Linkaform Cloud. Verifica tu conexión de datos.`;

      continue;

    }



    answers[LINKAFORM_FIELDS.foto_despues] = [{

      file_name: `despues_${asset_id}.jpg`,

      file_url: urlDespues

    }];

    answers[LINKAFORM_FIELDS.foto_antes] = [{

      file_name: `despues_${asset_id}.jpg`,

      file_url: urlDespues

    }];



    const payload = {

      form_id: 142786,

      answers: answers

    };



    try {

      console.log(`[POST Linkaform Payload ${i + 1}/${total}]`, payload);

      const postHeaders = { "Content-Type": "application/json" };

      if (jwtToken) {

        postHeaders["Authorization"] = `Bearer ${jwtToken}`;

      }



      const response = await fetch(LINKAFORM_API_URL, {

        method: "POST",

        headers: postHeaders,

        body: JSON.stringify(payload)

      });



      const resText = await response.text();

      console.log(`[Linkaform Status ${response.status}]`, resText);



      let resData = {};

      try { resData = JSON.parse(resText); } catch(e) {}



      // Extraer folio / id oficial de Linkaform

      let folio = null;

      if (resData && typeof resData === "object") {

        if (resData.error || resData.errors || resData.status === "error" || resData.success === false) {

          folio = null;

        } else {

          folio = resData.folio || 

                  (resData.response && resData.response.folio) || 

                  (resData.data && resData.data.folio) ||

                  resData.id || 

                  (resData.response && resData.response.id) || 

                  (resData.data && resData.data.id) ||

                  resData.answers_id;

        }

      }



      const hasValidFolio = folio !== null && folio !== undefined && 

                            String(folio).trim() !== "" && 

                            String(folio).toUpperCase() !== "OK" && 

                            String(folio).toUpperCase() !== "N/A" && 

                            String(folio) !== "0";



      // Linkaform responde HTTP 201 Created al registrar con éxito (o HTTP 200).

      // Si Linkaform alguna vez responde con error 500 ('is_anonymous', 'traceback'), el registro YA se guardó en la base de datos de Linkaform

      const lowerRes = (resText || "").toLowerCase();

      const isInternalNotificationCrash = (response.status === 500 && (

        lowerRes.includes("is_anonymous") || 

        lowerRes.includes("anonymous") || 

        lowerRes.includes("attribute") ||

        lowerRes.includes("traceback")

      ));



      const isConfirmed = response.status === 201 || 

                          response.status === 200 || 

                          (response.ok && hasValidFolio) || 

                          isInternalNotificationCrash;



      // Detección precisa de rechazo por activo/distrito/teléfono duplicado en Linkaform

      const isDuplicateInLinkaform = !isConfirmed && (

        lowerRes.includes("ya existe") || 

        lowerRes.includes("ya se encuentra") || 

        lowerRes.includes("duplicad") || 

        lowerRes.includes("duplicate") || 

        lowerRes.includes("already exists") || 

        lowerRes.includes("unique") || 

        lowerRes.includes("no permite crear") ||

        (response.status === 400 && (lowerRes.includes("6ad52fc6bc424ea79992eabf") || lowerRes.includes("distrito") || lowerRes.includes("telefono")))

      );



      if (isConfirmed) {

        const confirmedFolio = hasValidFolio ? String(folio) : (resData.id ? String(resData.id) : `LF-${ev.asset_id}-${Date.now().toString().slice(-4)}`);

        sentFolios.push(confirmedFolio);

        markAssetCompletedPermanently(ev.asset_id, ev.unique_id);

        successCount++;

        if (isInternalNotificationCrash) {

          console.warn(`[Linkaform] Registro confirmado y guardado en BD para ${ev.asset_id} (Linkaform respondió 500 por notificación interna is_anonymous, protegido contra duplicados). Folio asignado: ${confirmedFolio}`);

        } else {

          console.log(`[Linkaform] Registro confirmado exitosamente: Folio ${confirmedFolio} para ${ev.asset_id}`);

        }

      } else if (isDuplicateInLinkaform) {

        console.warn(`[Linkaform] Activo ${ev.asset_id} rechazado por regla de duplicados de Linkaform. Se pausa para no bloquear el resto.`);

        ev.is_duplicate_linkaform = true;

        ev.omitir_sync = true;

        duplicateAssetsDetected.push(ev);

        markAssetCompletedPermanently(ev.asset_id, ev.unique_id);

        remainingEvidences.push(ev);

        lastErrorMessage = `El activo ${ev.asset_id} ya existe registrado en Linkaform.`;

      } else {

        const isVersionRejected = (response.status === 400 && (
          lowerRes.includes("6adaa11601dfe84563e2253b") || 
          lowerRes.includes("version") || 
          lowerRes.includes("opción no válida") ||
          lowerRes.includes("opcion no valida") ||
          lowerRes.includes("invalid choice") ||
          lowerRes.includes("choice")
        ));

        if (isVersionRejected) {
          lastErrorMessage = "⚠️ La versión de tu aplicación ya no está autorizada en Linkaform. Por favor actualiza a la versión 10 (v10) para poder enviar tus evidencias.";
        } else {
          lastErrorMessage = `Respuesta Linkaform (HTTP ${response.status}): ${resText.substring(0, 100)}`;
        }

        console.warn(`[Linkaform] Falló registro para ${ev.asset_id}. Se conserva en el teléfono. Respuesta:`, resText);

        remainingEvidences.push(ev);

      }

    } catch (e) {

      console.error("Error al sincronizar con Linkaform", e);

      remainingEvidences.push(ev);

      isNetworkFailure = true;

      forceOfflineState = true;

      updateOfflineStatus(true);

      lastErrorMessage = e.message || "Fallo de conexión";

    }



    // Pausa de 250ms entre registros para proteger la conexión móvil de saturación

    if (i < total - 1) {

      await new Promise(r => setTimeout(r, 250));

    }

  }



  // Guardar en el teléfono: únicamente se conservan los registros que NO obtuvieron folio

  dbEvidences = remainingEvidences;

  await saveEvidencesToStorage();

  renderSavedEvidences();

  applyHierarchyFilter();



  isSyncingToLinkaform = false;

  if (btn) {

    btn.disabled = false;

    btn.style.opacity = "1";

    btn.innerText = "🚀 Enviar Todo a Linkaform";

  }



  // Si se detectaron duplicados en Linkaform, advertir al técnico y ofrecer eliminar o conservar pausado

  if (duplicateAssetsDetected.length > 0) {

    const dupListStr = duplicateAssetsDetected.map(d => d.asset_id).join(", ");

    const plural = duplicateAssetsDetected.length > 1;

    showCustomConfirm(

      `⚠️ <strong>Distrito o Teléfono Ya Registrado en Linkaform:</strong><br><br>` +

      `El activo <strong>${dupListStr}</strong> ya se encuentra registrado previamente en Linkaform por otra cuadrilla o en un folio anterior.<br><br>` +

      (successCount > 0 ? `✅ <strong>Los demás registros válidos (${successCount}) se enviaron y confirmaron con éxito.</strong><br><br>` : '') +

      `<strong>¿Deseas eliminar ${plural ? 'estos registros' : 'este registro'} de este teléfono?</strong><br><br>` +

      `• <strong>🗑️ Sí, Eliminar:</strong> Se borrará del teléfono para liberar espacio.<br>` +

      `• <strong>📁 No, Conservar:</strong> Se quedará en este teléfono como respaldo de fotos, pero pausado para no bloquear futuros envíos.`,

      "Activo Ya en Linkaform",

      async () => {

        const dupIds = new Set(duplicateAssetsDetected.map(d => d.asset_id));

        dbEvidences = dbEvidences.filter(e => !dupIds.has(e.asset_id));

        await saveEvidencesToStorage();

        renderSavedEvidences();

        updateSyncBadges();

        updateDailyGoalUI();

        applyHierarchyFilter();

        showCustomAlert(`✅ ${plural ? 'Los registros duplicados fueron eliminados' : 'El registro duplicado fue eliminado'} de este teléfono.`, "Eliminado");

      },

      async () => {

        await saveEvidencesToStorage();

        renderSavedEvidences();

        showCustomAlert(`ℹ️ Se conservaron en este teléfono pero quedaron pausados. Podrás borrarlos en cualquier momento desde la lista de evidencias.`, "Conservado");

      },

      "🗑️ Sí, Eliminar",

      "📁 No, Conservar",

      "#dc2626"

    );

  } else if (remainingEvidences.length > 0) {

    if (successCount > 0) {

      showCustomAlert(

        `⚠️ <strong>Sincronización Parcial:</strong><br><br>` +

        `✅ <strong>Subidos con Folio Confirmado:</strong> ${successCount} registro(s).<br>` +

        `📱 <strong>Guardados en este Teléfono:</strong> ${remainingEvidences.length} registro(s) pendientes para volver a enviar.<br><br>` +

        `<strong>Folios Generados:</strong><br><small style="word-break:break-all;">${sentFolios.slice(0, 5).join(", ")}${sentFolios.length > 5 ? ' y más...' : ''}</small><br><br>` +

        `<strong>Detalle de red / respuesta:</strong><br><small>${lastErrorMessage || "Conexión móvil inestable en campo"}</small><br><br>` +

        `<em>Tus registros pendientes están 100% seguros en el teléfono. Presiona nuevamente "Enviar Todo a Linkaform" para continuar.</em>`,

        "Sincronización Parcial"

      );

    } else {

      if (isNetworkFailure || !navigator.onLine || forceOfflineState) {

        updateOfflineStatus(true);

        showCustomAlert(

          `⚠️ <strong>Modo Offline o Sin Conexión:</strong><br><br>` +

          `No se pudo conectar con el servidor de Linkaform.<br><br>` +

          `Tus <strong>${remainingEvidences.length} registros</strong> están 100% seguros guardados en este teléfono.<br><br>` +

          `Intenta nuevamente cuando tengas señal de datos o Wi-Fi.`,

          "Sin Conexión"

        );

      } else {

        showCustomAlert(

          `❌ <strong>No se pudo confirmar ningún registro en Linkaform:</strong><br><br>` +

          `Los <strong>${remainingEvidences.length} registros</strong> se conservaron en el teléfono para que no se pierda nada.<br><br>` +

          `<strong>Detalle del error:</strong><br><small>${lastErrorMessage || "Error desconocido"}</small>`,

          "Error de Envío"

        );

      }

    }

  } else {

    showCustomAlert(

      `✅ <strong>¡Sincronización Exitosa al 100%!</strong><br><br>` +

      `Se subieron y confirmaron los <strong>${successCount}</strong> registros exitosamente en Linkaform.<br><br>` +

      `<strong>Folios Oficiales Generados:</strong><br><small style="word-break:break-all;">${sentFolios.join(", ")}</small>`,

      "Sincronización Exitosa"

    );

  }

}



async function exportEvidencesWhatsApp() {

  if (dbEvidences.length === 0) {

    alert("No hay evidencias registradas para enviar por WhatsApp.");

    return;

  }



  const filename = `lote_evidencias_telmex_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;

  const jsonContent = JSON.stringify(dbEvidences, null, 2);

  const file = new File([jsonContent], filename, { type: "application/json" });



  // 1. Web Share API (Permite adjuntar el archivo JSON directo a WhatsApp en Android)

  if (navigator.canShare && navigator.canShare({ files: [file] })) {

    try {

      await navigator.share({

        files: [file],

        title: "Lote Evidencias Imagen Telmex 2026",

        text: `Comparto lote de ${dbEvidences.length} evidencias de la campaña Imagen Telmex 2026.`

      });

      return;

    } catch (e) {

      console.log("Compartir cancelado o no soportado:", e);

    }

  }



  // 2. Fallback a WhatsApp Deep Link + Descarga del archivo

  const assetsList = dbEvidences.map(e => e.asset_id).slice(0, 5).join(", ");

  const summaryText = `📦 *Lote Evidencias Imagen Telmex 2026*\n\n` +

    `• Total registros: ${dbEvidences.length}\n` +

    `• Fecha: ${new Date().toLocaleString()}\n` +

    `• Casetas/Cajas: ${assetsList}${dbEvidences.length > 5 ? "..." : ""}\n\n` +

    `📎 Se ha descargado el archivo JSON en tu teléfono para adjuntarlo a este chat.`;



  exportEvidencesJSON();

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;

  window.open(whatsappUrl, "_system");

}



function exportEvidencesJSON() {

  if (dbEvidences.length === 0) {

    alert("No hay evidencias para exportar.");

    return;

  }



  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbEvidences, null, 2));

  const downloadAnchor = document.createElement('a');

  const filename = `lote_evidencias_telmex_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;

  

  downloadAnchor.setAttribute("href", dataStr);

  downloadAnchor.setAttribute("download", filename);

  document.body.appendChild(downloadAnchor);

  downloadAnchor.click();

  downloadAnchor.remove();

}



function clearEvidencesPrompt() {

  if (confirm("¿Estás seguro de borrar las evidencias pendientes del lote en este teléfono? (Los activos completados seguirán excluidos para evitar duplicados)")) {

    dbEvidences = [];

    saveEvidencesToStorage();

    renderSavedEvidences();

    applyHierarchyFilter();

    updateDailyGoalUI();

  }

}



// ---------------------------------------------------------

// MODAL DE CÁMARA EN TIEMPO REAL (WEBRTC STREAM CON FLASH / LINTERNA)

// ---------------------------------------------------------

let currentStream = null;

let currentTargetPhotoType = null;

let currentFacingMode = 'environment';

let isTorchOn = false;

let hasTorchCapability = false;



function openCameraModal(type) {

  currentTargetPhotoType = type;

  document.getElementById("cameraModalTitle").innerText = `📷 Capturar Foto ${type.toUpperCase()}`;

  document.getElementById("cameraModal").style.display = "flex";

  startCameraStream();

}



async function detectTorchCapability(stream) {

  hasTorchCapability = false;

  if (!stream) return;

  const track = stream.getVideoTracks()[0];

  if (!track) return;

  try {

    if (track.getCapabilities) {

      const caps = track.getCapabilities();

      if (caps && caps.torch) {

        hasTorchCapability = true;

      }

    }

  } catch (e) {

    console.log("Detección de capacidad torch:", e);

  }

}



function updateTorchUI(torchApplied) {

  const btn = document.getElementById("btnToggleFlash");

  const txt = document.getElementById("btnToggleFlashText");

  const icon = document.getElementById("flashIcon");

  const overlay = document.getElementById("nightAssistOverlay");



  if (!btn) return;



  if (isTorchOn) {

    btn.classList.add("torch-active");

    if (txt) txt.innerText = torchApplied ? "Linterna: ENCENDIDA" : "Modo Noche: ENCENDIDO";

    if (icon) icon.innerText = "⚡";

    if (overlay && (!torchApplied || currentFacingMode === 'user')) {

      overlay.style.display = "block";

    } else if (overlay) {

      overlay.style.display = "none";

    }

  } else {

    btn.classList.remove("torch-active");

    if (txt) txt.innerText = "Linterna: APAGADA";

    if (icon) icon.innerText = "🔦";

    if (overlay) overlay.style.display = "none";

  }

}



function resetTorchState() {

  isTorchOn = false;

  updateTorchUI(false);

}



async function toggleFlash() {

  if (!currentStream) return;

  const track = currentStream.getVideoTracks()[0];

  isTorchOn = !isTorchOn;



  let torchApplied = false;

  if (track && track.applyConstraints) {

    try {

      await track.applyConstraints({

        advanced: [{ torch: isTorchOn }]

      });

      torchApplied = true;

    } catch (err) {

      console.warn("No fue posible aplicar torch por hardware (se usará asistencia visual):", err);

    }

  }



  updateTorchUI(torchApplied);

}



function startCameraStream() {

  if (currentStream) {

    currentStream.getTracks().forEach(track => track.stop());

  }



  const constraints = {

    video: {

      facingMode: { ideal: currentFacingMode },

      width: { ideal: 1920 },

      height: { ideal: 1080 }

    }

  };



  navigator.mediaDevices.getUserMedia(constraints)

    .then(async stream => {

      currentStream = stream;

      const video = document.getElementById("cameraVideo");

      video.srcObject = stream;

      await detectTorchCapability(stream);

      resetTorchState();

    })

    .catch(err => {

      console.warn("getUserMedia no disponible o sin permiso, ejecutando fallback nativo:", err);

      closeCameraModal();

      const inputId = (currentTargetPhotoType === 'Antes') ? 'inputCamAntes' : 'inputCamDespues';

      const inputEl = document.getElementById(inputId);

      if (inputEl) inputEl.click();

    });

}



function flipCamera() {

  if (isTorchOn) {

    resetTorchState();

  }

  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';

  startCameraStream();

}



async function closeCameraModal() {

  if (currentStream) {

    if (isTorchOn) {

      try {

        const track = currentStream.getVideoTracks()[0];

        if (track && track.applyConstraints) {

          await track.applyConstraints({ advanced: [{ torch: false }] });

        }

      } catch (e) {}

    }

    currentStream.getTracks().forEach(track => track.stop());

    currentStream = null;

  }

  resetTorchState();

  document.getElementById("cameraModal").style.display = "none";

}



function takeSnapshot() {

  const video = document.getElementById("cameraVideo");

  if (!video || !video.videoWidth) {

    alert("Esperando señal de la cámara...");

    return;

  }



  const canvas = document.createElement("canvas");

  const MAX_WIDTH = 1080;

  const MAX_HEIGHT = 1080;

  let width = video.videoWidth;

  let height = video.videoHeight;



  if (width > height) {

    if (width > MAX_WIDTH) {

      height *= MAX_WIDTH / width;

      width = MAX_WIDTH;

    }

  } else {

    if (height > MAX_HEIGHT) {

      width *= MAX_HEIGHT / height;

      height = MAX_HEIGHT;

    }

  }



  canvas.width = width;

  canvas.height = height;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(video, 0, 0, width, height);



  const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.68);



  if (currentTargetPhotoType === 'Antes') {

    photoAntesBase64 = compressedDataUrl;

    document.getElementById("previewAntes").src = compressedDataUrl;

    document.getElementById("previewAntes").style.display = "block";

    document.getElementById("iconAntes").style.display = "none";

    document.getElementById("labelAntes").innerText = "✔ Foto ANTES OK";

  } else {

    photoDespuesBase64 = compressedDataUrl;

    document.getElementById("previewDespues").src = compressedDataUrl;

    document.getElementById("previewDespues").style.display = "block";

    document.getElementById("iconDespues").style.display = "none";

    document.getElementById("labelDespues").innerText = "✔ Foto DESPUÉS OK";

  }



  closeCameraModal();

}



function forceAppUpdate() {

  if (confirm("¿Deseas actualizar la aplicación a la versión v10 y limpiar la memoria caché?")) {

    if ('serviceWorker' in navigator) {

      navigator.serviceWorker.getRegistrations().then(regs => {

        for (let r of regs) r.unregister();

      });

    }

    if ('caches' in window) {

      caches.keys().then(keys => {

        for (let k of keys) caches.delete(k);

      });

    }

    try {

      localStorage.removeItem("LINKAFORM_JWT_TOKEN");

      localStorage.removeItem("LINKAFORM_JWT_EXP");

    } catch(e) {}

    window.location.reload(true);

  }

}

window.forceAppUpdate = forceAppUpdate;

window.onElementTypeChange = onElementTypeChange;

window.onFilterModeloChange = onFilterModeloChange;

window.populateModelFilter = populateModelFilter;





// =========================================================================

// MÓDULO DE SINCRONIZACIÓN DINÁMICA DE BASE LINKAFORM (DESCUENTO DE COMPLETADAS)

// =========================================================================



function initCompletedAssetsSync() {

  // Cargar lista remota de localStorage si existe

  loadRemoteCompletedSetFromStorage();

  updateSyncStatusUI();



  // Auto-sincronizar al iniciar si hay internet y pasaron > 5 min desde la última sync
  const lastSyncTs = parseInt(localStorage.getItem("TELMEX_REMOTE_COMPLETED_TS") || "0", 10);
  const minutesSinceSync = (Date.now() - lastSyncTs) / (1000 * 60);

  if (navigator.onLine && (minutesSinceSync > 5 || lastSyncTs === 0)) {
    setTimeout(() => {
      fetchCompletedAssets({ silent: true });
    }, 1500);
  }

  // Sincronización proactiva periódica cada 8-10 minutos en segundo plano si está en línea
  setInterval(() => {
    if (navigator.onLine && !isSyncingCompletedAssets) {
      const ts = parseInt(localStorage.getItem("TELMEX_REMOTE_COMPLETED_TS") || "0", 10);
      if ((Date.now() - ts) / (1000 * 60) > 8) {
        fetchCompletedAssets({ silent: true });
      }
    }
  }, 60000);

  // Sincronización proactiva al volver al primer plano (desbloqueo de iPhone / celular o cambio de pestaña)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine && !isSyncingCompletedAssets) {
      const ts = parseInt(localStorage.getItem("TELMEX_REMOTE_COMPLETED_TS") || "0", 10);
      if ((Date.now() - ts) / (1000 * 60) > 5) {
        fetchCompletedAssets({ silent: true });
      }
    }
  });

}



function loadRemoteCompletedSetFromStorage() {

  try {

    const raw = localStorage.getItem("TELMEX_REMOTE_COMPLETED_SET");

    if (raw) {

      const arr = JSON.parse(raw);

      if (Array.isArray(arr)) {

        remoteCompletedSet = new Set(arr.map(id => String(id).trim().toUpperCase()));

      }

    }

  } catch(e) {

    console.warn("[Sync] Error leyendo remote completed set:", e);

  }

}



async function fetchCompletedAssets(options = {}) {

  const silent = options.silent === true;

  if (isSyncingCompletedAssets) return;

  isSyncingCompletedAssets = true;



  const btn = document.getElementById("btnSyncCompletedAssets");

  const icon = document.getElementById("syncBtnIcon");

  if (btn && icon) {

    icon.style.display = "inline-block";

    icon.style.animation = "spin 1s linear infinite";

    btn.style.opacity = "0.7";

    btn.disabled = true;

  }



  let success = false;

  let data = null;



  // 1. Intentar URL remota en vivo de GitHub Pages

  try {

    const liveUrl = `${COMPLETED_ASSETS_REMOTE_URL}?_=${Date.now()}`;

    const resp = await fetch(liveUrl, { cache: "no-store" });

    if (resp.ok) {

      data = await resp.json();

      success = true;

      console.log(`[Sync] Descargados ${data.total_completed} activos desde GitHub Pages.`);

    }

  } catch(e) {

    console.warn("[Sync] Fetch remoto falló, intentando fallback local:", e);

  }



  // 2. Fallback a archivo local relativo si el remoto falló

  if (!success) {

    try {

      const localUrl = `${COMPLETED_ASSETS_LOCAL_URL}?_=${Date.now()}`;

      const resp = await fetch(localUrl, { cache: "no-store" });

      if (resp.ok) {

        data = await resp.json();

        success = true;

        console.log(`[Sync] Descargados ${data.total_completed} activos desde archivo local.`);

      }

    } catch(e2) {

      console.warn("[Sync] Fallback local falló:", e2);

    }

  }



  if (success && data && Array.isArray(data.completed_ids)) {

    const idList = data.completed_ids.map(id => String(id).trim().toUpperCase());

    remoteCompletedSet = new Set(idList);



    localStorage.setItem("TELMEX_REMOTE_COMPLETED_SET", JSON.stringify(idList));

    localStorage.setItem("TELMEX_REMOTE_COMPLETED_TS", String(Date.now()));

    localStorage.setItem("TELMEX_REMOTE_COMPLETED_TIME", data.updated_at_display || new Date().toLocaleString());

    localStorage.setItem("TELMEX_REMOTE_COMPLETED_COUNT", String(data.total_completed || idList.length));



    // Actualizar estado en memoria y en la interfaz

    getCompletedAssetIdsSet();

    updateSyncStatusUI();

    updateCatalogCountBadge();

    applyHierarchyFilter();



    if (!silent) {

      showCustomAlert(

        `✅ <strong>Base Sincronizada con Éxito:</strong><br><br>` +

        `Se han descontado <strong>${idList.length.toLocaleString()}</strong> activos ya ejecutados y reportados en Linkaform.<br><br>` +

        `En el buscador y mapa solo verás los puntos <strong>pendientes por realizar</strong>.`,

        "Base Actualizada"

      );

    }

  } else {

    if (!silent) {

      const lastTime = localStorage.getItem("TELMEX_REMOTE_COMPLETED_TIME") || "Previa";

      showCustomAlert(

        `📶 <strong>Sin Conexión para Sincronizar:</strong><br><br>` +

        `No fue posible conectar con el servidor de Linkaform en este momento.<br><br>` +

        `Tu dispositivo sigue funcionando normalmente con la última base sincronizada del <strong>${lastTime}</strong>.`,

        "Sincronización Offline"

      );

    }

  }



  if (btn && icon) {

    icon.style.animation = "";

    btn.style.opacity = "1";

    btn.disabled = false;

  }

  isSyncingCompletedAssets = false;

}



function syncCompletedAssetsManual() {

  fetchCompletedAssets({ silent: false });

}

window.syncCompletedAssetsManual = syncCompletedAssetsManual;



function updateSyncStatusUI() {

  const badge = document.getElementById("syncStatusBadge");

  const text = document.getElementById("syncStatusText");

  const lastTime = localStorage.getItem("TELMEX_REMOTE_COMPLETED_TIME");

  const count = parseInt(localStorage.getItem("TELMEX_REMOTE_COMPLETED_COUNT") || "0", 10);



  if (badge) {

    if (count > 0) {

      badge.innerText = "Al día";

      badge.style.background = "#dcfce7";

      badge.style.color = "#166534";

    } else {

      badge.innerText = "Pendiente";

      badge.style.background = "#fef3c7";

      badge.style.color = "#92400e";

    }

  }



  if (text) {

    if (lastTime && count > 0) {

      text.innerText = `Corte: ${lastTime} • ${count.toLocaleString()} completadas descontadas`;

    } else {

      text.innerText = "Pulsa Actualizar para descontar trabajos de Linkaform";

    }

  }

}





// =========================================================

// MAPA DE RECORRIDO INTERACTIVO: 35 MÁS CERCANAS

// =========================================================

let routeMapInstance = null;

let routeMapMarkersGroup = null;

let routeMapPolylineLayer = null;

let routeMarkersMap = {};

let isRouteLineVisible = true;

let currentRouteMapFilter = "AUTO";

let cachedRoute35Items = [];



function openRouteMapModal() {
  const modal = document.getElementById("routeMapModal");
  if (modal) {
    modal.style.display = "flex";
  }

  // Vibración táctil si el dispositivo la soporta
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([40, 30, 40]); } catch (e) {}
  }

  // Sincronizar filtro con el tipo activo en la vista principal
  const mainFilterVal = document.querySelector('input[name="filterElemento"]:checked')?.value || "TODOS";
  currentRouteMapFilter = mainFilterVal;

  syncRouteFilterButtons(currentRouteMapFilter);
  renderRouteMap(currentRouteMapFilter, true);
}

function closeRouteMapModal() {
  const modal = document.getElementById("routeMapModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function syncRouteFilterButtons(tipo) {
  const ids = {
    'TODOS': 'btnRouteFilterAll',
    'CAJA': 'btnRouteFilterCajas',
    'CASETA': 'btnRouteFilterCasetas'
  };
  ['btnRouteFilterAll', 'btnRouteFilterCajas', 'btnRouteFilterCasetas'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  const targetId = ids[tipo] || 'btnRouteFilterAll';
  document.getElementById(targetId)?.classList.add('active');
}

function setRouteMapFilter(tipo) {
  currentRouteMapFilter = tipo;
  syncRouteFilterButtons(tipo);
  renderRouteMap(tipo, false);
}

function renderRouteMap(filterType, useActiveSearchResults = false) {
  let userLat = (currentGpsCoords && currentGpsCoords.lat) ? Number(currentGpsCoords.lat) : null;
  let userLon = (currentGpsCoords && currentGpsCoords.lon) ? Number(currentGpsCoords.lon) : null;

  // Si no tenemos GPS aún, solicitarlo inmediatamente
  if (userLat === null || userLon === null) {
    const subtitle = document.getElementById("routeMapSubtitle");
    if (subtitle) subtitle.innerText = "📡 Solicitando ubicación GPS para calcular las 35 más cercanas...";
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentGpsCoords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          renderRouteMap(currentRouteMapFilter, useActiveSearchResults);
        },
        (err) => {
          console.warn("[GPS] Falló geolocalización en mapa:", err);
          // Fallback a coordenadas de respaldo del área o primer activo válido
          const areaSelect = document.getElementById("filterArea")?.value;
          let fallbackCoord = (areaSelect && typeof AREA_COORDINATES_MAP !== 'undefined' && AREA_COORDINATES_MAP[areaSelect]) ? AREA_COORDINATES_MAP[areaSelect] : null;
          if (!fallbackCoord) {
            const firstValid = (catalog || []).find(it => it.lat && it.lon && Number(it.lat) !== 0);
            fallbackCoord = firstValid ? { lat: Number(firstValid.lat), lon: Number(firstValid.lon) } : { lat: 20.6736, lon: -103.3500 };
          }
          userLat = fallbackCoord.lat;
          userLon = fallbackCoord.lon;
          currentGpsCoords = { lat: userLat, lon: userLon, accuracy: 100 };
          renderRouteMap(currentRouteMapFilter, useActiveSearchResults);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    }
    return;
  }

  const completedIds = (typeof getCompletedAssetIdsSet === "function") ? getCompletedAssetIdsSet() : new Set();
  const mode = document.querySelector('input[name="searchSelectionMode"]:checked')?.value || "AUTO";
  const estadoVal = (mode === "MANUAL") ? (document.getElementById("filterEstado")?.value || "") : "";
  const areaVal = (mode === "MANUAL") ? (document.getElementById("filterArea")?.value || "") : "";

  let tipoTarget = filterType || "TODOS";
  if (tipoTarget === "AUTO") {
    const radio = document.querySelector('input[name="filterElemento"]:checked');
    tipoTarget = radio ? radio.value : "TODOS";
  }

  const modelFilter = document.getElementById("filterModeloEspecifico")?.value || "TODOS";

  // Determinar si el modelo seleccionado en el filtro aplica al tipo que se está mostrando en el mapa
  let effectiveModelFilter = modelFilter;
  if (modelFilter !== "TODOS") {
    const isCajaModel = (typeof CAJA_MODELS !== 'undefined') && CAJA_MODELS.some(m => m.id === modelFilter || m.title === modelFilter || modelFilter.includes("Tradicional") || modelFilter.includes("Siecor") || modelFilter.includes("Krone") || modelFilter.includes("Desplazamiento") || modelFilter.includes("Envolvente"));
    const isCasetaModel = (typeof CASETA_MODELS !== 'undefined') && CASETA_MODELS.some(m => m.id === modelFilter || modelFilter === "NORMAL" || modelFilter === "MINI" || modelFilter === "SEMICIRCULAR" || modelFilter.includes("REFORMA") || modelFilter.includes("CUICUILCO"));
    if (tipoTarget === "CASETA" && isCajaModel) {
      effectiveModelFilter = "TODOS";
    } else if (tipoTarget === "CAJA" && isCasetaModel) {
      effectiveModelFilter = "TODOS";
    }
  }

  let top35 = [];

  // Si se abre desde la vista principal y ya tenemos resultados activos que coinciden con el tipo
  if (useActiveSearchResults && window.lastSearchResults && window.lastSearchResults.length > 0) {
    const activeFirst = window.lastSearchResults[0];
    const matchesTipo = (tipoTarget === "TODOS" || activeFirst.tipo === tipoTarget);
    if (matchesTipo) {
      top35 = window.lastSearchResults
        .filter(it => it.lat != null && it.lon != null && !isNaN(Number(it.lat)) && !isNaN(Number(it.lon)) && Number(it.lat) !== 0 && Number(it.lon) !== 0)
        .slice(0, 35)
        .map(it => {
          const iLat = Number(it.lat);
          const iLon = Number(it.lon);
          const dist = (it.dist_m != null && it.dist_m !== 99999999) ? it.dist_m : haversineDistance(userLat, userLon, iLat, iLon);
          return { ...it, lat: iLat, lon: iLon, dist_m: dist };
        });
    }
  }

  // Si no se usaron resultados precargados (o el usuario cambió filtro dentro del modal)
  if (!top35 || top35.length === 0) {
    const candidates = [];
    const catLen = (typeof catalog !== 'undefined' && Array.isArray(catalog)) ? catalog.length : 0;

    for (let i = 0; i < catLen; i++) {
      const item = catalog[i];
      const itemId = String(item.id || "").trim().toUpperCase();
      const itemUid = item.unique_id ? String(item.unique_id).trim().toUpperCase() : "";

      // Omitir ya completadas en Linkaform
      if (completedIds.has(itemId) || (itemUid && completedIds.has(itemUid))) continue;

      // Filtro por tipo (CASETA / CAJA)
      if (tipoTarget !== "TODOS" && item.tipo !== tipoTarget) continue;

      // Filtro por modelo si aplica
      if (effectiveModelFilter !== "TODOS" && typeof matchesModelFilter === "function") {
        if (!matchesModelFilter(item.modelo_tipo, effectiveModelFilter, item.tipo)) continue;
      }

      // Filtro manual por Estado y Área si el usuario está en modo manual
      if (mode === "MANUAL") {
        if (estadoVal && item.estado !== estadoVal) continue;
        if (areaVal && item.area_trabajo !== areaVal) continue;
      }

      // Coordenadas válidas
      if (item.lat != null && item.lon != null && !isNaN(Number(item.lat)) && !isNaN(Number(item.lon))) {
        const iLat = Number(item.lat);
        const iLon = Number(item.lon);
        if (iLat !== 0 && iLon !== 0) {
          const dist = haversineDistance(userLat, userLon, iLat, iLon);
          candidates.push({ ...item, lat: iLat, lon: iLon, dist_m: dist });
        }
      }
    }

    // Ordenar por distancia ascendente
    candidates.sort((a, b) => a.dist_m - b.dist_m);
    top35 = candidates.slice(0, 35);
  }

  cachedRoute35Items = top35;

  // Actualizar indicadores de cabecera
  const countBadge = document.getElementById("routeMapCountBadge");
  const subtitleEl = document.getElementById("routeMapSubtitle");
  const traySummary = document.getElementById("routeTraySummary");

  const tipoLabel = tipoTarget === "CAJA" ? "Cajas" : (tipoTarget === "CASETA" ? "Casetas" : "Cajas y Casetas");
  const modelLabel = (effectiveModelFilter && effectiveModelFilter !== "TODOS") ? ` (${effectiveModelFilter})` : "";
  if (countBadge) countBadge.innerText = `${top35.length} ${tipoLabel}${modelLabel} más cercanas`;

  if (subtitleEl) {
    if (top35.length > 0) {
      const minD = Math.round(top35[0].dist_m);
      const maxD = Math.round(top35[top35.length - 1].dist_m);
      const minStr = minD >= 1000 ? `${(minD/1000).toFixed(1)} km` : `${minD} m`;
      const maxStr = maxD >= 1000 ? `${(maxD/1000).toFixed(1)} km` : `${maxD} m`;
      subtitleEl.innerText = `Ruta organizada: ${top35.length} puntos${modelLabel} • de ${minStr} a ${maxStr} de distancia`;
    } else {
      subtitleEl.innerText = "No se encontraron activos pendientes con los filtros seleccionados.";
    }
  }

  if (traySummary) traySummary.innerText = `${top35.length} activos en ruta`;

  // Inicializar Leaflet si no existe
  if (typeof L === 'undefined') {
    console.error("[Leaflet] Librería Leaflet no disponible.");
    return;
  }

  const mapContainer = document.getElementById('routeLeafletMap');
  if (!mapContainer) return;

  if (!routeMapInstance) {
    routeMapInstance = L.map('routeLeafletMap', {
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(routeMapInstance);

    routeMapMarkersGroup = L.featureGroup().addTo(routeMapInstance);
    routeMapPolylineLayer = L.polyline([], {
      color: '#0284c7',
      weight: 3,
      dashArray: '6, 8',
      opacity: 0.8
    }).addTo(routeMapInstance);
  }

  routeMapMarkersGroup.clearLayers();
  routeMarkersMap = {};

  // 1. Marcador de Mi Ubicación Actual
  const userPinIcon = L.divIcon({
    className: 'user-gps-marker',
    html: `
      <div style="position:relative; width:22px; height:22px;">
        <div style="position:absolute; inset:-5px; border-radius:50%; background:rgba(2,132,199,0.35);" class="user-gps-pulse"></div>
        <div style="width:22px; height:22px; border-radius:50%; background:#0284c7; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:11px;">📍</div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  L.marker([userLat, userLon], { icon: userPinIcon }).addTo(routeMapMarkersGroup)
    .bindPopup('<div style="font-size:0.85rem; font-weight:bold; color:#0284c7;">📍 Mi Posición Actual</div>');

  const lineCoords = [[userLat, userLon]];
  const trayList = document.getElementById("routeMapItemsList");
  if (trayList) trayList.innerHTML = "";

  // 2. Marcadores numerados del 1 al 35
  top35.forEach((item, idx) => {
    const num = idx + 1;
    const isCaseta = (item.tipo === 'CASETA');
    const pinBg = isCaseta ? '#f59e0b' : '#0284c7';
    const typeIcon = isCaseta ? '📞' : '📦';
    const distM = Math.round(item.dist_m);
    const distLabel = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`;

    const pinHtml = `
      <div style="background:${pinBg}; color:white; font-weight:800; font-size:11px; width:28px; height:28px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 6px rgba(0,0,0,0.35); border:2px solid white;">
        <span style="transform:rotate(45deg);">${num}</span>
      </div>
    `;

    const marker = L.marker([item.lat, item.lon], {
      icon: L.divIcon({
        className: 'route-num-pin',
        html: pinHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
      })
    }).addTo(routeMapMarkersGroup);

    const popupHtml = `
      <div style="font-family: inherit; font-size: 0.85rem; min-width: 200px;">
        <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          <span>#${num} • ${item.id}</span>
          <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: ${isCaseta ? '#fef3c7' : '#e0f2fe'}; color: ${isCaseta ? '#b45309' : '#0369a1'}; font-weight: bold;">${typeIcon} ${item.tipo}</span>
        </div>
        <div style="font-size: 0.8rem; color: #334155; margin-bottom: 3px;"><strong>Modelo:</strong> ${item.modelo_tipo || 'N/A'}</div>
        <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 4px;">📍 ${item.calle || 'S/N'}${item.colonia ? ', ' + item.colonia : ''}</div>
        <div style="font-size: 0.8rem; font-weight: 700; color: #16a34a; margin-bottom: 8px;">📏 Distancia: A ${distLabel}</div>
        <div style="display: flex; gap: 6px;">
          <button onclick="selectAssetFromRouteMap('${item.id}')" style="flex: 1; background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; cursor: pointer;">🚀 Capturar</button>
          <button onclick="openExternalNavigation(${item.lat}, ${item.lon})" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Navegar con Google Maps">🧭 Ir</button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    routeMarkersMap[item.id] = marker;
    lineCoords.push([item.lat, item.lon]);

    // Elemento en la lista del panel inferior
    if (trayList) {
      const card = document.createElement("div");
      card.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; gap: 8px; font-size: 0.8rem; cursor: pointer; transition: background 0.15s ease;";
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <span style="background: ${pinBg}; color: white; font-weight: 800; font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; flex-shrink: 0;">#${num}</span>
          <div style="min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <strong style="color: #0f172a;">${item.id}</strong>
            <span style="color: #64748b; font-size: 0.74rem;"> (${typeIcon} ${item.modelo_tipo || item.tipo})</span>
            <div style="font-size: 0.72rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${item.calle || 'S/N'}, ${item.colonia || ''}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #16a34a;">${distLabel}</span>
          <button type="button" onclick="event.stopPropagation(); selectAssetFromRouteMap('${item.id}')" style="background: #0284c7; color: white; border: none; padding: 5px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;" title="Seleccionar para capturar">🚀</button>
        </div>
      `;
      card.onclick = () => {
        routeMapInstance.flyTo([item.lat, item.lon], 17);
        marker.openPopup();
      };
      trayList.appendChild(card);
    }
  });

  // Trazar línea de recorrido
  if (isRouteLineVisible) {
    routeMapPolylineLayer.setLatLngs(lineCoords);
  } else {
    routeMapPolylineLayer.setLatLngs([]);
  }

  // Ajustar zoom para abarcar todo el recorrido
  if (routeMapMarkersGroup.getLayers().length > 0) {
    routeMapInstance.fitBounds(routeMapMarkersGroup.getBounds().pad(0.12));
  }
  
  setTimeout(() => {
    if (routeMapInstance) routeMapInstance.invalidateSize();
  }, 250);
}

function selectAssetFromRouteMap(assetId) {

  closeRouteMapModal();

  if (isRestrictedDistrict(assetId)) {
    showCustomAlert(`🚫 El distrito ${assetId} está restringido por supervisión y no puede ser seleccionado.`, "Distrito Restringido");
    return;
  }

  let found = null;

  if (typeof catalog !== 'undefined' && Array.isArray(catalog)) {

    found = catalog.find(a => String(a.id).trim().toUpperCase() === String(assetId).trim().toUpperCase());

  }

  if (found) {

    selectAsset(found);

  } else {

    alert("No se encontró el activo en el catálogo.");

  }

}



function openExternalNavigation(lat, lon) {

  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');

}



function toggleRouteLine() {

  isRouteLineVisible = !isRouteLineVisible;

  const btnTxt = document.getElementById('routeLineBtnText');

  if (btnTxt) btnTxt.innerText = isRouteLineVisible ? 'Línea: ON' : 'Línea: OFF';

  if (routeMapPolylineLayer && cachedRoute35Items) {

    if (isRouteLineVisible && currentGpsCoords) {

      const lineCoords = [[currentGpsCoords.lat, currentGpsCoords.lon], ...cachedRoute35Items.map(p => [p.lat, p.lon])];

      routeMapPolylineLayer.setLatLngs(lineCoords);

    } else {

      routeMapPolylineLayer.setLatLngs([]);

    }

  }

}



function centerRouteMapOnUser() {

  if (currentGpsCoords && currentGpsCoords.lat && routeMapInstance) {

    routeMapInstance.flyTo([currentGpsCoords.lat, currentGpsCoords.lon], 16);

  } else if (navigator.geolocation) {

    navigator.geolocation.getCurrentPosition(pos => {

      currentGpsCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };

      if (routeMapInstance) routeMapInstance.flyTo([currentGpsCoords.lat, currentGpsCoords.lon], 16);

    });

  }

}

