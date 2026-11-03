/**
 * Configuración Global del Dashboard de Imagen Telmex 2026
 * Matriz de Materiales, Receta de Consumo y Conexión Linkaform
 */

const DEFAULT_CONFIG = {
  // Configuración de Integración Linkaform
  linkaform: {
    apiUrl: "https://app.linkaform.com/api/infosync/",
    recordsFormId: "142786",  // Forma de Trabajos Realizados (Cajas y Casetas)
    materialsFormId: "184350", // Forma Oficial de Recepción y Control de Materiales
    username: "pahernandez@operacionpci.com.mx", // Usuario Linkaform
    apiKey: "003ab07a66c6795f8d3fcca2a3b6f94a7f06258e" // Token de usuario / API Key para consultas en vivo
  },

  // Mapeo Oficial de Campos Linkaform
  linkaformFields: {
    // Forma 142786 - Evidencias de Campo
    records: {
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
      modelo: "6ab9d647dba7a0c191e6a0f6",
      contratista: "6abe9357bef08742fcf94020",
      tecnico: "6abe9357bef08742fcf94021"
    },
    // Forma 184350 - Control de Materiales
    materials: {
      area: "6ad695943f0d28deb4a6c9a3",
      descripcion: "6ad692011583192abb37cd8f",
      cantidad: "6ad65b0b1b305d8b534b1e13",
      unidad: "6ad695943f0d28deb4a6c9a4",
      fecha: "6ad65b0b1b305d8b534b1e11",
      evidencia: "6ad69fb41583192abb37cdaa"
    }
  },

  // Catálogo Oficial de Materiales alineado 100% con el Reporte Oficial Excel (10 Cajas, 5 Casetas)
  materiales: [
    // --- CAJAS (10 TIPOS OFICIALES) ---
    {
      id: "desplazamiento_doble",
      alias: ["DESPLAZAMIENTO DOBLE", "deplasamiento_doble_200_mb", "desplazamiento_doble_200_mb", "deplasamiento doble 200 mb", "desplazamiento doble 200 mb", "desplazamiento doble", "deplasamiento doble"],
      nombre: "DESPLAZAMIENTO DOBLE",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 10,
      icono: "🏷️"
    },
    {
      id: "desplazamiento_sencilla",
      alias: ["DESPLAZAMIENTO SENCILLA", "deplasamiento_sencilla_200_mb", "desplazamiento_sencilla_200_mb", "deplasamiento sencilla 200 mb", "desplazamiento sencilla 200 mb", "desplazamiento sencilla", "deplasamiento sencilla", "deplazamiento sencilla 2 ptas 200 mb"],
      nombre: "DESPLAZAMIENTO SENCILLA",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.08,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 20,
      icono: "🏷️"
    },
    {
      id: "envolvente_doble",
      alias: ["ENVOLVENTE DOBLE", "envolvente_doble_200_mb", "envolvente doble 200 mb", "envolvente doble"],
      nombre: "ENVOLVENTE DOBLE",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 15,
      icono: "📦"
    },
    {
      id: "envolvente_sencilla",
      alias: ["ENVOLVENTE SENCILLA", "envolvelte_secillo_200_mb", "envolvente_sencillo_200_mb", "envolvelte secillo 200 mb", "envolvente sencillo 200 mb", "envolvente sencilla"],
      nombre: "ENVOLVENTE SENCILLA",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.08,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 25,
      icono: "📦"
    },
    {
      id: "krone",
      alias: ["KRONE", "krone", "krone sencilla", "krone_sencilla"],
      nombre: "KRONE",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 20,
      icono: "🏷️"
    },
    {
      id: "siecor_doble",
      alias: ["SIECOR DOBLE", "siecor_doble_2_ptas._200_mb", "siecor_doble_200_mb", "siecor doble 2 ptas. 200 mb", "siecor doble 200 mb", "siecor doble"],
      nombre: "SIECOR DOBLE",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.10,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 50,
      icono: "📦"
    },
    {
      id: "siecor_sencilla_1pta",
      alias: ["SIECOR SENCILLA 1PTA", "siecor_sencilla_1_pta._200_mb", "siecor sencilla 1 pta. 200 mb", "siecor sencilla 1 puerta", "siecor sencilla 1pta", "siecor sencilla 1 pta"],
      nombre: "SIECOR SENCILLA 1PTA",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.20,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "📦"
    },
    {
      id: "siecor_sencilla_2_ptas",
      alias: ["SIECOR SENCILLA 2 PTAS", "siecor_sencilla_2_ptas._200_mb", "siecor sencilla 2 ptas. 200 mb", "siecor sencilla 2 puertas", "siecor sencilla 2 ptas", "siecor sencilla 2 ptas."],
      nombre: "SIECOR SENCILLA 2 PTAS",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.25,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "📦"
    },
    {
      id: "tradicional_doble",
      alias: ["TRADICIONAL DOBLE", "tradicional_doble_200_mb", "tradicional doble 200 mb", "tradicional doble"],
      nombre: "TRADICIONAL DOBLE",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 50,
      icono: "🏷️"
    },
    {
      id: "tradicional_sencilla",
      alias: ["TRADICIONAL SENCILLA", "tradicional_sencilla_200_mb", "tradicional sencilla 200 mb", "tradicional sencilla", "sencilla"],
      nombre: "TRADICIONAL SENCILLA",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 0,
      consumo_por_caja: 0.20,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "🏷️"
    },

    // --- CASETAS (5 TIPOS OFICIALES) ---
    {
      id: "caseta_normal",
      alias: ["NORMAL", "lateral_caseta_normal_200_mb", "lateral caseta normal 200 mb", "caseta normal", "normal"],
      nombre: "NORMAL",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 0,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.80,
      stock_minimo_alerta: 50,
      icono: "📞"
    },
    {
      id: "caseta_mini",
      alias: ["MINI", "lateral_caseta_mini_200_mb", "lateral caseta mini 200 mb", "caseta mini", "mini"],
      nombre: "MINI",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 0,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.15,
      stock_minimo_alerta: 20,
      icono: "📞"
    },
    {
      id: "semicircular",
      alias: ["SEMICIRCULAR", "semicircular_200_mb", "lateral semi circular derecho/izquierdo", "lateral semicircular", "semicircular"],
      nombre: "SEMICIRCULAR",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 0,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.03,
      stock_minimo_alerta: 10,
      icono: "📞"
    },
    {
      id: "doble_reforma",
      alias: ["DOBLE REFORMA", "doble_reforma", "reforma", "doble", "caseta doble"],
      nombre: "DOBLE REFORMA",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 0,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.01,
      stock_minimo_alerta: 5,
      icono: "📞"
    },
    {
      id: "cuicuilco",
      alias: ["CUICUILCO", "cuicuilco", "caseta cuicuilco"],
      nombre: "CUICUILCO",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 0,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.01,
      stock_minimo_alerta: 5,
      icono: "📞"
    }
  ],

  // Metas Generales del Proyecto
  proyecto: {
    nombre: "Campaña Imagen Telmex 2026",
    cliente: "TELMEX / Red Uno",
    fecha_inicio: "2026-10-01",
    fecha_meta_fin: "2026-12-31"
  }
};
