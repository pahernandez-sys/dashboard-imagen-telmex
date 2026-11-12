# -*- coding: utf-8 -*-
"""
Módulo de Homologación de Nombres (Técnicos y Contratistas)
Telmex Imagen 2026

Estandariza variaciones de mayúsculas/minúsculas, acentos, errores tipográficos
y nombres invertidos para conciliación exacta de facturación y pago.
"""
import re
import unicodedata

# Partículas en nombres en español que deben quedar en minúscula (salvo al inicio)
LOWERCASE_WORDS = {"de", "del", "la", "las", "los", "san", "y", "e"}

# Mapeo canónico de Contratistas (Alias / Variaciones -> Nombre Oficial)
CONTRACTOR_MAP = {
    # Brusim
    "brusim": "Brusim",
    
    # PC Industrial / Directo
    "pc industrial": "PC Industrial",
    "pc directo": "PC Directo",
    "tecnico directo": "Técnico Directo",
    "directo": "Directo",
    "propio": "Propio",
    
    # Ingeniería Avanzada en Construcción
    "ingenieria avanzada en construccion": "Ingeniería Avanzada en Construcción",
    "ingenieria avanzada en construccion sa de cv": "Ingeniería Avanzada en Construcción S.A. de C.V.",
    "ingenieria avanzada en contruccion": "Ingeniería Avanzada en Construcción",
    "ingenieria avanzada en redes": "Ingeniería Avanzada en Redes",
    "ingenieria avanzada en redes sa de cv": "Ingeniería Avanzada en Redes S.A. de C.V.",
    "ingenieria avansada en redes": "Ingeniería Avanzada en Redes",
    
    # Personas Físicas con variaciones
    "erick mauricio herrera quiroz": "Erick Mauricio Herrera Quiroz",
    "erik mauricio quiroz herrera": "Erick Mauricio Herrera Quiroz",
    "erick herrera quiroz": "Erick Mauricio Herrera Quiroz",
    
    "jesus jose romero perez": "Jesús José Romero Pérez",
    "jesus jose romero peres": "Jesús José Romero Pérez",
    
    "ivan rosas cruz": "Iván Rosas Cruz",
    "ivan cruz rosas": "Iván Rosas Cruz",
    
    "wendy magaly castro herrera": "Wendy Magaly Castro Herrera",
    "alejandro adrian obeso": "Alejandro Adrián Obeso",
    "adrian valenzuela": "Adrián Valenzuela",
    "victor hugo lopez garcia": "Victor Hugo López García",
    "roberto melchor frutos fuentes": "Roberto Melchor Frutos Fuentes",
    "sergio beccerra franco": "Sergio Becerra Franco",
    "jose antonio esquivel": "José Antonio Esquivel",
    "jose antonio esquive": "José Antonio Esquivel",
    "victor chan": "Victor Chan",
    "morayma cadena martinez": "Morayma Cadena Martínez",
    "lucina villanueva hernandez": "Lucina Villanueva Hernández",
    "ramon magana portilla": "Ramón Magaña Portilla",
    "arturo zavala fuentes": "Arturo Zavala Fuentes",
    "jose miguel prats coutino": "José Miguel Prats Coutiño",
    "jorge alberto nava sanchez": "Jorge Alberto Nava Sánchez",
    "noe gastelum lopez": "Noé Gastélum López",
    "roberto merino merino": "Roberto Merino Merino",
    "capci": "CAPCI",
    "iasa": "IASA"
}

# Mapeo canónico de Técnicos (Typos, Invertidos, Incompletos -> Nombre Oficial)
TECHNICIAN_MAP = {
    # Esquivel (typo muy frecuente: Esquive)
    "jose antonio esquive": "José Antonio Esquivel",
    "jose antonio esquivel": "José Antonio Esquivel",
    
    # Typo en Albarrán (con cero 0)
    "juan alfred0 victorino albarran": "Juan Alfredo Victorino Albarrán",
    "juan alfredo victorino albarran": "Juan Alfredo Victorino Albarrán",
    
    # Typo en Mosso (triple s)
    "leonardo mossso rodriguez": "Leonardo Mosso Rodríguez",
    "leonardo mosso rodriguez": "Leonardo Mosso Rodríguez",
    
    # Typos en Martinez, Castillo, Castañeda
    "jair emmanuel martienez morales": "Jair Emmanuel Martínez Morales",
    "jair emmanuel martinez morales": "Jair Emmanuel Martínez Morales",
    "lucio leonardo catillo coronel": "Lucio Leonardo Castillo Coronel",
    "lucio leonardo castillo coronel": "Lucio Leonardo Castillo Coronel",
    "marco antonio cataeda garcia": "Marco Antonio Castañeda García",
    "marco antonio castaneda garcia": "Marco Antonio Castañeda García",
    "marco antonio lopez gomez": "Marco Antonio López Gómez",
    
    # Invertidos (apellidos primero)
    "hernandez pelcastre pablo arturo": "Pablo Arturo Hernández Pelcastre",
    
    # Variaciones de un solo apellido o nombres cortos
    "luis alberto lucido": "Luis Alberto Lucido Cabrera",
    "luis alberto lucido cabrera": "Luis Alberto Lucido Cabrera",
    "irvin martinez": "Irvin García Martínez",
    "irvin garcia martinez": "Irvin García Martínez",
    "alejandro navarrte": "Alejandro Navarrete",
    "alejandro navarrete": "Alejandro Navarrete",
    "gerardo gomez": "Gerardo Gómez Guzmán",
    "gerardo gomez guzman": "Gerardo Gómez Guzmán",
    
    # Acentos y mayúsculas comunes
    "efrain romero torres": "Efraín Romero Torres",
    "carlos valentin montes vazquez": "Carlos Valentín Montes Vázquez",
    "andres escobar perez": "Andrés Escobar Pérez",
    "angel lopez reyes": "Ángel López Reyes",
    "braulio josue perez martinez": "Braulio Josué Pérez Martínez",
    "miguel angel rodriguez hernandez": "Miguel Ángel Rodríguez Hernández",
    "morayma cadena martinez": "Morayma Cadena Martínez",
    "virgilio olmos cordoba": "Virgilio Olmos Córdoba",
    "daniel aguilar vazquez": "Daniel Aguilar Vázquez",
    "marcos alejandro frausto robles": "Marcos Alejandro Frausto Robles",
    "pedro mereles valdes": "Pedro Mereles Valdés",
    "norberto leyva hernandez": "Norberto Leyva Hernández",
    "juan pablo espinoza sifuentes": "Juan Pablo Espinoza Sifuentes",
    "leonardo samuel hernandez vazquez": "Leonardo Samuel Hernández Vázquez",
    "humberto hernandez velazquez": "Humberto Hernández Velázquez",
    "adonahi hurtado arambula": "Adonahi Hurtado Arámbula",
    "salomon vega guerrero": "Salomón Vega Guerrero",
    "fernando antonio saldana guerrero": "Fernando Antonio Saldaña Guerrero",
    "dulce alejandra hernandez vinas": "Dulce Alejandra Hernández Viñas",
    "osvaldo sanchez hernandez": "Osvaldo Sánchez Hernández",
    "erik jonatan suarez torres": "Erik Jonatan Suárez Torres",
    "erik antonio contreras aguilera": "Erik Antonio Contreras Aguilera",
    "noe gastelum lopez": "Noé Gastélum López",
    "rogelio yanes lozano": "Rogelio Yañes Lozano",
    "jesus servando laguna dominguez": "Jesús Servando Laguna Domínguez",
    "pedro damian pena bojorquez": "Pedro Damián Peña Bojórquez",
    "guillermo antonio torres ruiz": "Guillermo Antonio Torres Ruiz",
    "marlon brandon sanchez mora": "Marlon Brandon Sánchez Mora",
    "wenceslao gonzalez garcia": "Wenceslao González García",
    "josue denicia gomez": "Josué Denicia Gómez",
    "williams severiano cruz hernandez": "Williams Severiano Cruz Hernández",
    "victor hugo lopez garcia": "Victor Hugo López García",
    "roberto merino merino": "Roberto Merino Merino",
    "samuel romero sanchez": "Samuel Romero Sánchez",
    "eduardo alonzo rodriguez miranda": "Eduardo Alonzo Rodríguez Miranda",
    "emilio cruz": "Emilio Cruz",
    "juan carlos cortez": "Juan Carlos Cortez",
    "lucila yazmin ortega hernandez": "Lucila Yazmín Ortega Hernández",
    "jose gonzalez gonzalez": "José González González",
    "raul ruenes malagon": "Raul Ruenes Malagón",
    "freddy de jesus sosa rosado": "Freddy de Jesús Sosa Rosado",
    "hermilo gonzalez torres": "Hermilo González Torres",
    "alfredo lopez garnica": "Alfredo López Garnica",
    "edgar daniel ortiz guillen": "Edgar Daniel Ortiz Guillén"
}

def to_clean_key(name: str) -> str:
    """Convierte a minúsculas sin acentos ni caracteres especiales para búsqueda."""
    if not name:
        return ""
    # Reemplazar números que simulan letras (ej: 0 -> o)
    s = str(name).replace("0", "o")
    # Descomponer acentos
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("utf-8")
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    return " ".join(s.lower().split())

def to_title_case_spanish(name: str) -> str:
    """Aplica Title Case respetando partículas en español (de, del, la, los, etc.)."""
    if not name:
        return ""
    words = str(name).strip().split()
    if not words:
        return ""
    
    result = []
    for i, w in enumerate(words):
        w_lower = w.lower()
        if i > 0 and w_lower in LOWERCASE_WORDS:
            result.append(w_lower)
        else:
            # Mantener acrónimos (S.A., C.V., PC, CAPCI, IASA)
            if w.upper() in {"SA", "CV", "PC", "CAPCI", "IASA", "SRL", "TELMEX"}:
                result.append(w.upper())
            else:
                result.append(w.capitalize())
    return " ".join(result)

def homologar_tecnico(raw_name: str) -> str:
    """Homologa el nombre de un técnico a su forma oficial única."""
    if not raw_name or str(raw_name).strip() in ("", "Sin Técnico", "None", "null", "S/T"):
        return "Sin Técnico"
    
    clean_k = to_clean_key(raw_name)
    
    # 1. Búsqueda exacta en catálogo
    if clean_k in TECHNICIAN_MAP:
        return TECHNICIAN_MAP[clean_k]
    
    # 2. Formato estándar Title Case
    return to_title_case_spanish(raw_name)

def homologar_contratista(raw_name: str) -> str:
    """Homologa el nombre de un contratista a su forma oficial única."""
    if not raw_name or str(raw_name).strip() in ("", "None", "null", "N/A"):
        return "Directo"
    
    clean_k = to_clean_key(raw_name)
    
    # 1. Búsqueda en catálogo
    if clean_k in CONTRACTOR_MAP:
        return CONTRACTOR_MAP[clean_k]
    
    # 2. Reglas por palabras clave
    if "avanzada" in clean_k and "construccion" in clean_k:
        if "sa de cv" in clean_k:
            return "Ingeniería Avanzada en Construcción S.A. de C.V."
        return "Ingeniería Avanzada en Construcción"
    if "avanzada" in clean_k and "redes" in clean_k:
        if "sa de cv" in clean_k:
            return "Ingeniería Avanzada en Redes S.A. de C.V."
        return "Ingeniería Avanzada en Redes"
    if "brusim" in clean_k:
        return "Brusim"
    if "pc industrial" in clean_k:
        return "PC Industrial"
    if "pc directo" in clean_k:
        return "PC Directo"
    if "tecnico directo" in clean_k:
        return "Técnico Directo"
    
    return to_title_case_spanish(raw_name)

def homologar_registro(rec: dict) -> dict:
    """Aplica la homologación completa a un registro individual."""
    raw_tec = rec.get("tecnico") or ""
    raw_con = rec.get("contratista") or ""
    
    rec["tecnico_original"] = raw_tec
    rec["contratista_original"] = raw_con
    
    rec["tecnico_homologado"] = homologar_tecnico(raw_tec)
    rec["contratista_homologado"] = homologar_contratista(raw_con)
    
    # Sobrescribir campo principal para que todo el dashboard y reportes queden alineados
    rec["tecnico"] = rec["tecnico_homologado"]
    rec["contratista"] = rec["contratista_homologado"]
    
    return rec
