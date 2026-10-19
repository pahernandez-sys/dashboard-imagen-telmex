/**
 * Configuración Global del Dashboard de Imagen Telmex 2026
 * Matriz de Materiales, Receta de Consumo y Conexión Linkaform
 */

const DEFAULT_CONFIG = {
  // Configuración de Integración Linkaform
  linkaform: {
    apiUrl: "https://app.linkaform.com/api/infosync/",
    recordsFormId: "142786", // Forma actual de Cajas y Casetas
    materialsFormId: "",      // ID de la nueva forma de materiales (se asigna al crearla)
    apiKey: ""                // Token de usuario / API Key para consultas en vivo
  },

  // Catálogo Oficial de Materiales con Unidades y Stock Suministrado Inicial
  materiales: [
    {
      id: "vinil_caja",
      nombre: "Vinil Institucional para Caja",
      categoria: "Rotulación",
      unidad: "Piezas",
      suministrado: 5000, // Cantidad entregada en almacén / campo
      consumo_por_caja: 1.0,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 300,
      icono: "🏷️"
    },
    {
      id: "vinil_caseta",
      nombre: "Vinil Copete / Franja Caseta",
      categoria: "Rotulación",
      unidad: "Piezas",
      suministrado: 2400,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 2.0,
      stock_minimo_alerta: 200,
      icono: "📞"
    },
    {
      id: "pintura_azul",
      nombre: "Esmalte Azul Telmex Oficial",
      categoria: "Pintura",
      unidad: "Litros",
      suministrado: 1800,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.80,
      stock_minimo_alerta: 100,
      icono: "🎨"
    },
    {
      id: "pintura_gris",
      nombre: "Esmalte Gris Telmex (Cajas)",
      categoria: "Pintura",
      unidad: "Litros",
      suministrado: 1500,
      consumo_por_caja: 0.25,
      consumo_por_caseta: 0.0,
      stock_minimo_alerta: 100,
      icono: "🖌️"
    },
    {
      id: "pintura_blanca",
      nombre: "Esmalte Blanco / Protección",
      categoria: "Pintura",
      unidad: "Litros",
      suministrado: 800,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 0.30,
      stock_minimo_alerta: 50,
      icono: "⚪"
    },
    {
      id: "thinner",
      nombre: "Thinner Estándar / Solvente",
      categoria: "Químicos",
      unidad: "Litros",
      suministrado: 1200,
      consumo_por_caja: 0.10,
      consumo_por_caseta: 0.25,
      stock_minimo_alerta: 80,
      icono: "🧴"
    },
    {
      id: "sellador",
      nombre: "Sellador de Poliuretano",
      categoria: "Fijación",
      unidad: "Cartuchos",
      suministrado: 600,
      consumo_por_caja: 0.05,
      consumo_por_caseta: 0.15,
      stock_minimo_alerta: 40,
      icono: "🧪"
    },
    {
      id: "tornilleria",
      nombre: "Tornillería y Remaches Acero",
      categoria: "Fijación",
      unidad: "Piezas",
      suministrado: 12000,
      consumo_por_caja: 0.0,
      consumo_por_caseta: 4.0,
      stock_minimo_alerta: 500,
      icono: "🔩"
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
