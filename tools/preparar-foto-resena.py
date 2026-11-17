#!/usr/bin/env python3
"""
Prepara la foto que te mandó un cliente para publicarla junto a su reseña.

- La gira según cómo se tomó (las fotos de celular a veces vienen de lado).
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


def preparar(origen, nombre):
    imagen = ImageOps.exif_transpose(Image.open(origen))
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
