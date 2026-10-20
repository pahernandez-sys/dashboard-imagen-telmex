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

  // Catálogo Oficial de Materiales alineado con la Forma 184350
  materiales: [
    {
      id: "tradicional_sencilla_200_mb",
      nombre: "Vinil Tradicional Sencilla 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 448,
      consumo_por_caja: 0.60,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "🏷️"
    },
    {
      id: "envolvelte_secillo_200_mb",
      alias: ["envolvente_sencillo_200_mb", "envolvelte secillo 200 mb", "envolvente sencillo 200 mb"],
      nombre: "Vinil Envolvente Sencillo 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 62,
      consumo_por_caja: 0.15,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 30,
      icono: "📦"
    },
    {
      id: "tradicional_doble_200_mb",
      nombre: "Vinil Tradicional Doble 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 2000,
      consumo_por_caja: 0.15,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 150,
      icono: "🏷️"
    },
    {
      id: "siecor_sencilla_1_pta._200_mb",
      nombre: "Vinil Siecor Sencilla 1 Pta. 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 1500,
      consumo_por_caja: 0.10,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "📦"
    },
    {
      id: "siecor_sencilla_2_ptas._200_mb",
      nombre: "Vinil Siecor Sencilla 2 Ptas. 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 1000,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 80,
      icono: "📦"
    },
    {
      id: "siecor_doble_2_ptas._200_mb",
      nombre: "Vinil Siecor Doble 2 Ptas. 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 800,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 60,
      icono: "📦"
    },
    {
      id: "deplasamiento_sencilla_200_mb",
      alias: ["desplazamiento_sencilla_200_mb", "deplasamiento sencilla 200 mb", "desplazamiento sencilla 200 mb"],
      nombre: "Vinil Desplazamiento Sencilla 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 93,
      consumo_por_caja: 0.03,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 20,
      icono: "🏷️"
    },
    {
      id: "deplasamiento_doble_200_mb",
      alias: ["desplazamiento_doble_200_mb", "deplasamiento doble 200 mb", "desplazamiento doble 200 mb"],
      nombre: "Vinil Desplazamiento Doble 200 MB",
      categoria: "Viniles Cajas",
      unidad: "Pzas",
      suministrado: 15,
      consumo_por_caja: 0.02,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 10,
      icono: "🏷️"
    },
    {
      id: "lateral_caseta_normal_200_mb",
      alias: ["lateral caseta normal 200 mb"],
      nombre: "Lateral Caseta Normal 200 MB",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 602,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 1.0,
      stock_minimo_alerta: 50,
      icono: "📞"
    },
    {
      id: "lateral_caseta_mini_200_mb",
      alias: ["lateral caseta mini 200 mb"],
      nombre: "Lateral Caseta Mini 200 MB",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 64,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.3,
      stock_minimo_alerta: 20,
      icono: "📞"
    },
    {
      id: "semicircular_200_mb",
      nombre: "Vinil Semicircular 200 MB",
      categoria: "Viniles Casetas",
      unidad: "Juegos",
      suministrado: 500,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.15,
      stock_minimo_alerta: 50,
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
