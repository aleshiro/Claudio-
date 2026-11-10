#!/usr/bin/env python3
"""
Prepara la foto de una botella para la tienda: quita el fondo blanco, recorta al
contorno de la botella y la guarda como PNG transparente en assets/perfumes/.

Uso (desde la carpeta del repositorio):
    python3 tools/recortar-fotos.py FOTO NOMBRE [UMBRAL]

    FOTO    archivo original (jpg, png, webp) con la botella sobre fondo blanco
    NOMBRE  nombre final sin extensión, por ejemplo  dior-sauvage-edp
    UMBRAL  opcional, 0-255. Qué tan blanco debe ser un punto para contarlo como
            fondo. 246 sirve para fondos blancos limpios; usa cerca de 200 si la
            foto trae una sombra gris alrededor de la botella.

Después, en index.html, escribe en el perfume:
    imagen: "assets/perfumes/NOMBRE.png",

Requiere Python 3 con Pillow y numpy:  pip install pillow numpy
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ALTO_FINAL = 480  # alto en píxeles; suficiente para pantallas de celular y computador
DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "perfumes")


def recortar(origen, nombre, umbral=246):
    imagen = Image.open(origen).convert("RGBA")
    # Si la foto ya trae transparencia, se aplana sobre blanco para tratarla igual que el resto.
    plana = Image.new("RGBA", imagen.size, (255, 255, 255, 255))
    plana.alpha_composite(imagen)
    datos = np.asarray(plana.convert("RGB")).astype(np.float32)
    alto, ancho, _ = datos.shape
    minimo = datos.min(axis=2)
    saturacion = datos.max(axis=2) - minimo

    # 1) Fondo: zona casi blanca y sin color que está conectada con los bordes de la imagen.
    #    Los brillos blancos dentro de la botella no se tocan porque no llegan al borde.
    tolerancia_color = 14 if umbral > 240 else 18
    candidato = ((minimo >= umbral) & (saturacion <= tolerancia_color)).astype(np.uint8) * 255
    lienzo = Image.new("L", (ancho + 2, alto + 2), 255)
    lienzo.paste(Image.fromarray(candidato, "L"), (1, 1))
    ImageDraw.floodfill(lienzo, (0, 0), 128, thresh=0)
    fondo = np.asarray(lienzo)[1:-1, 1:-1] == 128

    # 2) Transparencia: fondo invisible, botella opaca y un borde suave entre ambos.
    alfa = np.where(fondo, 0.0, 1.0)
    cerca = np.asarray(Image.fromarray((fondo * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    borde = cerca & ~fondo
    lejos_del_blanco = np.clip((255.0 - minimo) / 255.0 * 1.6, 0, 1)
    alfa[borde] = np.minimum(alfa[borde], lejos_del_blanco[borde])

    # 3) Se quita el blanco mezclado en el borde, para que no quede un halo claro sobre fondo oscuro.
    color = datos.copy()
    k = np.clip(alfa, 0.05, 1)[..., None]
    color[borde] = np.clip((datos[borde] - 255.0 * (1 - k[borde])) / k[borde], 0, 255)
    resultado = Image.fromarray(np.dstack([color, alfa * 255]).round().astype(np.uint8), "RGBA")

    # 4) Recorte al contorno con un pequeño margen y tamaño final.
    caja = Image.fromarray((alfa > 0.04).astype(np.uint8) * 255).getbbox()
    if not caja:
        raise SystemExit("No se encontró la botella: prueba con un UMBRAL más alto.")
    margen = int(0.012 * alto)
    caja = (max(0, caja[0] - margen), max(0, caja[1] - margen), min(ancho, caja[2] + margen), min(alto, caja[3] + margen))
    resultado = resultado.crop(caja)
    if resultado.height > ALTO_FINAL:
        resultado = resultado.resize((round(resultado.width * ALTO_FINAL / resultado.height), ALTO_FINAL), Image.LANCZOS)

    os.makedirs(DESTINO, exist_ok=True)
    salida = os.path.join(DESTINO, nombre + ".png")
    resultado.save(salida, optimize=True)
    print("%s  %dx%d  %d KB" % (os.path.relpath(salida), resultado.width, resultado.height, round(os.path.getsize(salida) / 1024)))
    return salida


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    recortar(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 246)
