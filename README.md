# TELMEX | Dashboard Ejecutivo de Avance & Materiales 2026

Portal web gerencial y operativo para el monitoreo en tiempo real de la campaña **Imagen Telmex 2026**. Proporciona visibilidad ejecutiva sobre las metas nacionales de cajas y casetas, balance de materiales en campo y proyecciones de cumplimiento.

---

## 🎯 Capacidades Principales

1. **Control de Materiales (¿Cuánto queda y cuánto falta?):**
   * **Matriz de Consumo Teórico:** Calcula el consumo exacto multiplicando el número de cajas y casetas completadas por sus recetas unitarias (viniles, pintura azul, pintura gris, thinner, sellador, tornillería).
   * **Balance en Tiempo Real:** 
     * `Suministrado (Entradas)`: Lo entregado a contratistas o ingresado al almacén.
     * `Consumido (Real)`: Lo devengado según las evidencias registradas.
     * `Stock Actual (Queda)`: Existencias remanentes en bodega/campo.
     * `Requerido Meta Total`: El material total para cumplir el 100% de la campaña.
     * `Faltante por Surtir (Falta)`: Lo que se debe comprar/surtir urgentemente.
   * **Semáforo y Alertas:** Notificaciones automáticas de stock mínimo y déficit.

2. **Avance por Áreas y Estados:**
   * Comparativa visual de **Intervenidos vs Meta de Catálogo** (138,720 activos en 68 áreas).
   * Tabla interactiva con búsqueda por Estado (Guanajuato, Guerrero, Michoacán, etc.) y Área de Trabajo (Celaya, Irapuato, Acapulco, etc.).
   * Porcentajes de cumplimiento y semáforos de avance.

3. **Avances por Fechas & Tendencias:**
   * **Productividad Diaria:** Volumen de cajas y casetas terminadas por día.
   * **Curva S Acumulada:** Trayectoria del proyecto en el tiempo.
   * **Estimación de Cumplimiento:** Proyección de fecha de finalización calculada al ritmo actual de trabajo diario.

4. **Filtros Dinámicos Cruzados:**
   * Por Estado, Área de Trabajo, Contratista / Socio Comercial, Tipo de Activo (Cajas vs Casetas) y Periodo de Fechas (Hoy, 7 días, 30 días, Rango personalizado).

5. **Sincronización Linkaform & Carga de Archivos:**
   * **API en Vivo:** Conexión directa mediante API Token con la forma de evidencias (`142786`) y la nueva forma de materiales.
   * **Importador Excel / JSON (Drag & Drop):** Permite arrastrar reportes exportados de Linkaform para actualizar el dashboard en segundos sin necesidad de tokens.
   * **Exportación de Reportes:** Botón para descargar balances y registros a Excel con un clic.

---

## 📋 Guía para la Nueva Forma de Materiales en Linkaform

Para registrar las entradas de material suministrado a contratistas, crea una forma en Linkaform con los siguientes campos sugeridos:

| Campo en Linkaform | Tipo de Campo | Descripción |
| :--- | :--- | :--- |
| **Fecha de Entrega** | Fecha | Día en que se suministró el material |
| **Contratista / Cuadrilla** | Catálogo / Selección | Nombre del contratista (ej. Lucina Villanueva, etc.) |
| **Área de Trabajo / Almacén** | Catálogo / Texto | Celaya, Irapuato, Acapulco, etc. |
| **Tipo de Material** | Catálogo | Vinil Caja, Vinil Caseta, Pintura Azul, Pintura Gris, etc. |
| **Cantidad Suministrada** | Número | Unidades o Litros entregados |
| **Número de Remisión / Factura** | Texto | Identificador del lote o entrega |
| **Evidencia / Firma de Recibido** | Firma / Foto | Firma del responsable de almacén o cuadrilla |

*Una vez creada, copia el **ID de la Forma** y colócalo en el botón **`🔄 Sincronizar Linkaform`** del dashboard.*

---

## 🚀 Despliegue en GitHub Pages (Gratis en 2 minutos)

Este dashboard es 100% estático (HTML5, TailwindCSS, Chart.js), por lo que puede alojarse sin costo en GitHub Pages:

1. Abre tu terminal o consola en esta carpeta:
   ```bash
   cd "c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"
   ```

2. Inicializa el repositorio Git y sube tus cambios:
   ```bash
   git init
   git add .
   git commit -m "Dashboard ejecutivo Telmex 2026 inicial"
   git branch -M main
   git remote add origin https://github.com/pahernandez-sys/dashboard-imagen-telmex.git
   git push -u origin main
   ```

3. En GitHub, ingresa a tu repositorio:
   * Ve a **Settings** ➔ **Pages**.
   * En **Branch**, selecciona `main` y la carpeta `/(root)`.
   * Presiona **Save**.
   * En 1 minuto tendrás tu enlace activo:
     `https://pahernandez-sys.github.io/dashboard-imagen-telmex/`

---

## 📁 Estructura del Repositorio

* `index.html`: Interfaz del dashboard gerencial responsivo.
* `styles.css`: Estilos visuales institucionales Telmex, animaciones y diseño para impresión.
* `app.js`: Motor de cálculos matemáticos, balance de materiales, filtros y gráficas Chart.js.
* `data/metas_catalogo.js`: Metas oficiales de cajas y casetas desglosadas por estado y área (138,720 activos).
* `data/config.js`: Catálogo de materiales, receta unitaria de consumo y parámetros de integración.
* `data/sample_records.js`: Lote de 1,473 registros realistas iniciales para visualización inmediata.
