# Remisión en hoja Carta

## Alcance

La remisión de entrega se imprime en orientación vertical sobre una hoja Carta
de 215.9 × 279.4 mm. El navegador reserva 6 mm de margen físico en cada lado y
la plantilla usa un área de 203.9 × 267.4 mm, con 3 mm adicionales de espacio
interior para evitar que tablas y texto queden pegados al límite imprimible.

La composición usa todo el ancho disponible, permite dividir textos extensos
dentro de sus celdas y mantiene juntos los bloques de condiciones y firmas. Las
firmas se alinean al pie cuando sobra espacio. La vista en pantalla representa
la hoja completa para que la vista previa sea coherente con la impresión.

## Evidencia de validación

- PDF generado: una página, 612 × 792 puntos (`Letter`).
- El activo con mayor longitud combinada de campos en la base actual también se
  renderizó en una sola página, incluyendo descripción, credenciales,
  condiciones y tres firmas.
- Pruebas de servidor: 127 aprobadas con `node --test test/*.test.js`.
- Compilación de producción: `npm run build` aprobada con Vite.
- `git diff --check` y validación sintáctica de `src/remissionPrint.js`
  aprobadas.

## Operación y rollback

El cambio es exclusivamente de presentación en el frontend. No modifica la API,
la base de datos, las asignaciones ni las credenciales.

Para revertirlo, se puede volver al commit anterior y reconstruir el frontend.
Durante la publicación se conserva además una copia temporal del `index.html`
anterior en `/tmp/mrti-activos-index-before-letter-layout.html`; los recursos
anteriores permanecen en `dist/assets` mientras se verifica el despliegue.
