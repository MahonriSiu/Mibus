#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

CIUDADES = [
    ('Managua', 'Managua', 'MGA', 12.1364, -86.2514, 18.0),
    ('Ciudad Sandino', 'Managua', 'CSD', 12.1500, -86.3500, 6.0),
    ('Tipitapa', 'Managua', 'TIP', 12.1944, -86.0950, 6.0),
    ('Ticuantepe', 'Managua', 'TIC', 11.9333, -86.2000, 4.0),
    ('Mateare', 'Managua', 'MTR', 12.2300, -86.4200, 5.0),
    ('San Rafael del Sur', 'Managua', 'SRS', 11.8500, -86.4333, 5.0),
    ('Masaya', 'Masaya', 'MSY', 11.9744, -86.0942, 8.0),
    ('Nindirí', 'Masaya', 'NDR', 12.0000, -86.1000, 4.0),
    ('Masatepe', 'Masaya', 'MST', 11.9100, -86.1450, 4.0),
    ('Granada', 'Granada', 'GRA', 11.9299, -85.9560, 7.0),
    ('Nandaime', 'Granada', 'NDM', 11.7600, -86.0500, 5.0),
    ('Jinotepe', 'Carazo', 'JTP', 11.8500, -86.2000, 6.0),
    ('Diriamba', 'Carazo', 'DRB', 11.8564, -86.2386, 6.0),
    ('Rivas', 'Rivas', 'RIV', 11.4375, -85.8283, 6.0),
    ('San Juan del Sur', 'Rivas', 'SJS', 11.2527, -85.8700, 4.0),
    ('León', 'León', 'LEO', 12.4379, -86.8780, 9.0),
    ('Nagarote', 'León', 'NGR', 12.2600, -86.5700, 4.0),
    ('La Paz Centro', 'León', 'LPC', 12.3000, -86.6667, 4.0),
    ('Telica', 'León', 'TLC', 12.5333, -86.8667, 3.0),
    ('Chinandega', 'Chinandega', 'CHD', 12.6294, -87.1311, 8.0),
    ('Chichigalpa', 'Chinandega', 'CHG', 12.5667, -87.0333, 4.0),
    ('Corinto', 'Chinandega', 'COR', 12.4833, -87.1744, 4.0),
    ('El Viejo', 'Chinandega', 'EVJ', 12.6667, -87.1667, 4.0),
    ('Somotillo', 'Chinandega', 'SMT', 13.0333, -86.9000, 4.0),
    ('Estelí', 'Estelí', 'EST', 13.0910, -86.3540, 8.0),
    ('Condega', 'Estelí', 'CND', 13.3500, -86.4000, 3.0),
    ('Somoto', 'Madriz', 'SOM', 13.4800, -86.5880, 5.0),
    ('Palacagüina', 'Madriz', 'PLC', 13.4500, -86.4167, 3.0),
    ('Ocotal', 'Nueva Segovia', 'OCO', 13.6294, -86.4750, 6.0),
    ('Jalapa', 'Nueva Segovia', 'JLP', 13.9167, -86.1333, 4.0),
    ('Jinotega', 'Jinotega', 'JNT', 13.0910, -86.0020, 7.0),
    ('San Rafael del Norte', 'Jinotega', 'SRN', 13.2000, -86.1000, 3.0),
    ('Matagalpa', 'Matagalpa', 'MTG', 12.9256, -85.9170, 7.0),
    ('Sébaco', 'Matagalpa', 'SBC', 12.8500, -86.0833, 4.0),
    ('Ciudad Darío', 'Matagalpa', 'CDR', 12.7300, -86.1200, 4.0),
    ('Río Blanco', 'Matagalpa', 'RBL', 12.9400, -85.2000, 4.0),
    ('Matiguás', 'Matagalpa', 'MTS', 12.8333, -85.4500, 3.0),
    ('Muy Muy', 'Matagalpa', 'MYM', 12.7667, -85.6167, 3.0),
    ('Boaco', 'Boaco', 'BOA', 12.4700, -85.6600, 5.0),
    ('Camoapa', 'Boaco', 'CMP', 12.3833, -85.5167, 4.0),
    ('Juigalpa', 'Chontales', 'JUI', 12.1060, -85.3640, 6.0),
    ('Acoyapa', 'Chontales', 'ACY', 11.9722, -85.1750, 3.0),
    ('Santo Tomás', 'Chontales', 'STM', 12.0667, -85.0833, 3.0),
    ('San Carlos', 'Río San Juan', 'SCR', 11.1200, -84.7800, 5.0),
    ('Bluefields', 'RACCS', 'BLU', 11.9986, -83.7574, 8.0),
    ('El Rama', 'RACCS', 'ERM', 12.1600, -84.2500, 5.0),
    ('Nueva Guinea', 'RACCS', 'NGN', 11.6833, -84.4500, 6.0),
    ('Laguna de Perlas', 'RACCS', 'LPE', 12.3500, -83.6667, 3.0),
    ('Corn Island', 'RACCS', 'COI', 12.1700, -83.0400, 4.0),
    ('Bilwi', 'RACCN', 'BIL', 14.0333, -83.3833, 6.0),
    ('Siuna', 'RACCN', 'SIU', 13.7333, -84.7667, 4.0),
    ('Rosita', 'RACCN', 'ROS', 13.9167, -84.4000, 3.0),
    ('Bonanza', 'RACCN', 'BNZ', 13.9500, -84.5833, 3.0),
    ('Waspam', 'RACCN', 'WSP', 14.7333, -83.9667, 3.0),
    ('Waslala', 'RACCN', 'WSL', 13.3333, -85.3667, 3.0)
]

SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

CARPETA = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(CARPETA, "cache_osm")


def distancia_m(a_lat, a_lng, b_lat, b_lng):
    r = 6371000.0
    p1 = math.radians(a_lat)
    p2 = math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def consulta(lat, lng, radio_km):
    d_lat = radio_km / 111.32
    d_lng = radio_km / (111.32 * math.cos(math.radians(lat)))
    caja = "(%.5f,%.5f,%.5f,%.5f)" % (lat - d_lat, lng - d_lng, lat + d_lat, lng + d_lng)
    return (
        "[out:json][timeout:90];("
        'node["highway"="bus_stop"]' + caja + ";"
        'node["public_transport"="platform"]["bus"="yes"]' + caja + ";"
        'node["public_transport"="stop_position"]["bus"="yes"]' + caja + ";"
        ");out body;"
    )


def descargar(q):
    datos = urllib.parse.urlencode({"data": q}).encode("utf-8")
    ultimo = None
    for intento in range(6):
        servidor = SERVIDORES[intento % len(SERVIDORES)]
        try:
            peticion = urllib.request.Request(servidor, data=datos, headers={"User-Agent": "MiBus-importador/1.0"})
            with urllib.request.urlopen(peticion, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            ultimo = e
            print("   reintento %d: %s" % (intento + 1, e))
            time.sleep(6 * (intento + 1))
    raise RuntimeError("No se pudo descargar: %s" % ultimo)


def prioridad(tags):
    if tags.get("highway") == "bus_stop":
        return 0
    if tags.get("public_transport") == "platform":
        return 1
    return 2


def depurar(elementos, centro):
    nodos = [e for e in elementos if e.get("type") == "node" and "lat" in e and "lon" in e]
    nodos.sort(key=lambda e: prioridad(e.get("tags", {})))
    celdas = {}
    salida = []
    for e in nodos:
        kx = int(math.floor(e["lon"] / 0.0003))
        ky = int(math.floor(e["lat"] / 0.0003))
        cerca = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for o in celdas.get((kx + dx, ky + dy), []):
                    if distancia_m(e["lat"], e["lon"], o["lat"], o["lon"]) < 12:
                        cerca = True
                        break
                if cerca:
                    break
            if cerca:
                break
        if cerca:
            continue
        celdas.setdefault((kx, ky), []).append(e)
        salida.append(e)
    salida.sort(key=lambda e: distancia_m(e["lat"], e["lon"], centro[0], centro[1]))
    return salida


def sql_texto(valor):
    valor = (valor or "").replace("\\", "\\\\").replace("'", "''").replace("\r", " ").replace("\n", " ").strip()
    return "'" + valor[:100] + "'"


def bloque_ciudad(codigo, nodos):
    sentencias = []
    sentencias.append("SET @base := (SELECT COALESCE(MAX(p.numero), 0) FROM paradas p JOIN ciudades c ON c.id = p.ciudad_id WHERE c.codigo = '%s');" % codigo)
    for i in range(0, len(nodos), 250):
        trozo = nodos[i:i + 250]
        filas = []
        for j, e in enumerate(trozo):
            rango = i + j + 1
            nombre = (e.get("tags", {}).get("name") or e.get("tags", {}).get("ref") or "")
            filas.append("SELECT %s AS nombre, %.7f AS lat, %.7f AS lng, %d AS r, %d AS osm_id" % (sql_texto(nombre), e["lat"], e["lon"], rango, e["id"]))
        sentencias.append(
            "INSERT IGNORE INTO paradas (nombre, lat, lng, orden, ciudad_id, codigo, numero, osm_id, origen, activa)\n"
            "SELECT IF(t.nombre = '', CONCAT('Parada ', @base + t.r), t.nombre), t.lat, t.lng, @base + t.r, c.id, CONCAT(c.codigo, '-', LPAD(@base + t.r, 4, '0')), @base + t.r, t.osm_id, 'osm', 1\n"
            "FROM ciudades c JOIN (\n" + "\nUNION ALL\n".join(filas) + "\n) t WHERE c.codigo = '%s';" % codigo
        )
    return "\n".join(sentencias) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Descarga las paradas de bus de OpenStreetMap y genera paradas_osm.sql")
    ap.add_argument("--ciudades", help="Códigos separados por coma, por ejemplo BLU,MGA. Por defecto todas.")
    ap.add_argument("--conservar-manuales", action="store_true", help="No borra las paradas registradas a mano.")
    ap.add_argument("--salida", default=os.path.join(CARPETA, "paradas_osm.sql"))
    ap.add_argument("--pausa", type=float, default=3.0, help="Segundos de pausa entre ciudades.")
    args = ap.parse_args()

    elegidas = set(c.strip().upper() for c in args.ciudades.split(",")) if args.ciudades else None
    ciudades = [c for c in CIUDADES if elegidas is None or c[2] in elegidas]
    if not ciudades:
        print("Ninguna ciudad coincide con los códigos indicados.")
        sys.exit(1)

    os.makedirs(CACHE, exist_ok=True)
    partes = ["SET NAMES utf8mb4;", ""]
    if not args.conservar_manuales:
        partes.append("DELETE FROM paradas WHERE origen = 'manual';")
        partes.append("")

    total = 0
    for n, (nombre, region, codigo, lat, lng, radio) in enumerate(ciudades, 1):
        archivo = os.path.join(CACHE, codigo + ".json")
        print("[%d/%d] %s (%s)" % (n, len(ciudades), nombre, codigo))
        if os.path.exists(archivo):
            with open(archivo, "r", encoding="utf-8") as f:
                datos = json.load(f)
            print("   usando datos guardados")
        else:
            datos = descargar(consulta(lat, lng, radio))
            with open(archivo, "w", encoding="utf-8") as f:
                json.dump(datos, f)
            time.sleep(args.pausa)
        nodos = depurar(datos.get("elements", []), (lat, lng))
        print("   %d paradas" % len(nodos))
        total += len(nodos)
        if nodos:
            partes.append("-- %s (%s): %d paradas" % (nombre, codigo, len(nodos)))
            partes.append(bloque_ciudad(codigo, nodos))

    with open(args.salida, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(partes))
    print("Listo: %d paradas en %s" % (total, args.salida))


if __name__ == "__main__":
    main()
