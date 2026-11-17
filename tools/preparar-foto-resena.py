#!/usr/bin/env python3
"""
Prepara la foto que te mandó un cliente para publicarla junto a su reseña.

- La gira según cómo se tomó (las fotos de celular a veces vienen de lado).
- Recorta las franjas negras o blancas de los bordes (por ejemplo en capturas de pantalla).
- La achica a un máximo de 1400 px por lado, para que cargue rápido.
- La guarda como JPG en assets/resenas/ y le QUITA los datos ocultos de la foto
  (ubicación GPS, modelo del teléfono, fecha), para proteger la privacidad del cliente.

Uso (desde la carpeta del repositorio):
    python3 tools/preparar-foto-resena.py FOTO NOMBRE

    FOTO    archivo original (jpg, png, heic convertido, webp)
    NOMBRE  nombre final sin extensión, por ejemplo  camila-erba-gold

Después, en index.html, agrega a la reseña:
    fotos: ["assets/resenas/NOMBRE.jpg"],

Requiere Python 3 con Pillow:  pip install pillow
"""
import os
import sys

from PIL import Image, ImageOps

LADO_MAXIMO = 1400
DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "resenas")


def quitar_franjas(imagen):
    """Recorta franjas negras o blancas en los bordes (típicas de capturas de pantalla)."""
    gris = imagen.convert("L")
    ancho, alto = gris.size
    datos = gris.load()

    def es_franja(valores):
        prom = sum(valores) / len(valores)
        return (prom < 18 or prom > 245) and max(valores) - min(valores) < 40

    def fila(y):
        return [datos[x, y] for x in range(0, ancho, 4)]

    def columna(x):
        return [datos[x, y] for y in range(0, alto, 4)]

    arriba = 0
    while arriba < alto // 3 and es_franja(fila(arriba)):
        arriba += 1
    abajo = alto
    while abajo > alto * 2 // 3 and es_franja(fila(abajo - 1)):
        abajo -= 1
    izquierda = 0
    while izquierda < ancho // 3 and es_franja(columna(izquierda)):
        izquierda += 1
    derecha = ancho
    while derecha > ancho * 2 // 3 and es_franja(columna(derecha - 1)):
        derecha -= 1
    if (izquierda, arriba, derecha, abajo) != (0, 0, ancho, alto):
        imagen = imagen.crop((izquierda, arriba, derecha, abajo))
    return imagen


def preparar(origen, nombre):
    imagen = ImageOps.exif_transpose(Image.open(origen))
    imagen = quitar_franjas(imagen)
    if imagen.mode in ("RGBA", "LA", "P"):
        fondo = Image.new("RGB", imagen.size, (255, 255, 255))
        imagen = imagen.convert("RGBA")
        fondo.paste(imagen, mask=imagen.getchannel("A"))
        imagen = fondo
    else:
        imagen = imagen.convert("RGB")
    imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)
    os.makedirs(DESTINO, exist_ok=True)
    salida = os.path.join(DESTINO, nombre + ".jpg")
    # Guardar sin "exif" elimina la ubicación y los demás datos ocultos de la foto.
    imagen.save(salida, "JPEG", quality=82, optimize=True, progressive=True)
    print("%s  %dx%d  %d KB" % (os.path.relpath(salida), imagen.width, imagen.height, round(os.path.getsize(salida) / 1024)))
    return salida


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    preparar(sys.argv[1], sys.argv[2])
