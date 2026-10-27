"""
Cliente de conexión y sincronización con Supabase (PostgreSQL Cloud)
Campaña Imagen Telmex 2026
"""

import requests
import json
import os

# Cargar credenciales desde configuración local protegida
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "supabase_config.json")
_cfg = {}
if os.path.exists(CONFIG_PATH):
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as _f:
            _cfg = json.load(_f)
    except Exception:
        pass

SUPABASE_URL = os.environ.get("SUPABASE_URL") or _cfg.get("supabase_url") or "https://xbbgcmnqtxhpnwjozzrt.supabase.co"
SUPABASE_REST_URL = f"{SUPABASE_URL}/rest/v1"
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or _cfg.get("supabase_anon_key") or ""
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or _cfg.get("supabase_service_key") or ""

def get_headers(use_service_key=True):
    key = SUPABASE_SERVICE_KEY if use_service_key and SUPABASE_SERVICE_KEY else SUPABASE_ANON_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def clean_float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def clean_int(val, default=1):
    if val is None or val == "":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

def upsert_evidencias_batch(records_batch):
    """
    Inserta o actualiza un lote de registros de evidencias en Supabase.
    Maneja resolución de duplicados automáticamente por 'folio'.
    """
    if not records_batch:
        return True

    url = f"{SUPABASE_REST_URL}/evidencias_telmex?on_conflict=folio"
    headers = get_headers(use_service_key=True)

    formatted = []
    for r in records_batch:
        formatted.append({
            "folio": str(r.get("folio", "")).strip(),
            "asset_id": str(r.get("identificador") or r.get("asset_id") or "S/N").strip(),
            "unique_id": str(r.get("unique_id") or r.get("identificador") or "").strip(),
            "tipo_elemento": str(r.get("tipo") or r.get("tipo_elemento") or "CASETA").upper(),
            "modelo": str(r.get("modelo") or "").strip(),
            "estado": str(r.get("estado") or "").strip(),
            "area_trabajo": str(r.get("area_trabajo") or "").strip(),
            "contratista": str(r.get("contratista") or "").strip(),
            "tecnico": str(r.get("tecnico") or "N/A").strip(),
            "oferta_colocada": str(r.get("oferta") or r.get("oferta_colocada") or "").strip(),
            "num_viniles": clean_int(r.get("num_viniles"), 1),
            "existencia": str(r.get("existe_bd") or r.get("existencia") or "sí").strip(),
            "lat": clean_float(r.get("latitud") or r.get("lat")),
            "lon": clean_float(r.get("longitud") or r.get("lon")),
            "foto_despues_url": str(r.get("foto_despues") or r.get("foto_despues_url") or "").strip(),
            "foto_antes_url": str(r.get("foto_antes") or r.get("foto_antes_url") or "").strip(),
            "comentarios": str(r.get("comentarios") or "").strip(),
            "version_app": str(r.get("version") or r.get("version_app") or "").strip(),
            "fecha_captura": r.get("created_at_iso") or r.get("fecha_captura") or None
        })

    resp = requests.post(url, headers=headers, json=formatted, timeout=45)
    if resp.status_code in [200, 201]:
        return True
    else:
        print(f"  [ERROR Supabase Evidencias] HTTP {resp.status_code}: {resp.text[:300]}")
        return False

def upsert_materiales_batch(materials_batch):
    """
    Inserta o actualiza un lote de registros de materiales en Supabase.
    """
    if not materials_batch:
        return True

    url = f"{SUPABASE_REST_URL}/materiales_telmex?on_conflict=folio"
    headers = get_headers(use_service_key=True)

    formatted = []
    for idx, m in enumerate(materials_batch):
        folio_val = str(m.get("folio") or m.get("id") or f"MAT-{idx+1}").strip()
        formatted.append({
            "folio": folio_val,
            "area_trabajo": str(m.get("area_trabajo") or m.get("area") or "").strip(),
            "contratista": str(m.get("contratista") or "").strip(),
            "tecnico": str(m.get("tecnico") or "").strip(),
            "material": str(m.get("material") or m.get("descripcion") or "").strip(),
            "cantidad": clean_float(m.get("cantidad") or m.get("cantidad_recibida") or 0),
            "fecha_entrega": m.get("created_at_iso") or m.get("fecha") or None
        })

    resp = requests.post(url, headers=headers, json=formatted, timeout=45)
    if resp.status_code in [200, 201]:
        return True
    else:
        print(f"  [ERROR Supabase Materiales] HTTP {resp.status_code}: {resp.text[:300]}")
        return False

def sync_all_to_supabase(records, materials, batch_size=200):
    """
    Sube todos los registros y materiales por bloques a Supabase.
    """
    print(f"\n[Supabase Cloud] Iniciando carga de {len(records)} evidencias y {len(materials)} entregas...")

    # Evidencias
    ev_ok = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        if upsert_evidencias_batch(batch):
            ev_ok += len(batch)
            print(f"  -> Evidencias subidas: {ev_ok}/{len(records)}")
        else:
            print(f"  -> Falló bloque {i}-{i+len(batch)}")

    # Materiales
    mat_ok = 0
    for j in range(0, len(materials), batch_size):
        batch = materials[j:j + batch_size]
        if upsert_materiales_batch(batch):
            mat_ok += len(batch)
            print(f"  -> Materiales subidos: {mat_ok}/{len(materials)}")
        else:
            print(f"  -> Falló bloque materiales {j}-{j+len(batch)}")

    print(f"[Supabase Cloud OK] Sincronización exitosa: {ev_ok} evidencias y {mat_ok} materiales en Supabase.")
    return ev_ok, mat_ok
