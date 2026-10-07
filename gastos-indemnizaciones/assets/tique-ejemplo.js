// Tique de ejemplo (documento ficticio) dibujado en un canvas para probar el OCR sin subir imágenes.
window.TIQUE_EJEMPLO = (function () {
  var L = [
    ['c', 'RESTAURANTE EJEMPLO DEMO S.L.', 1], ['c', 'CIF: B12345674'], ['c', 'Calle Ejemplo 12, 14001 Córdoba'], ['', ''],
    ['l', 'FACTURA SIMPLIFICADA Nº: FS-2026-00871'], ['l', 'Fecha: 01/10/2026 Hora: 14:32'],
    ['l', '------------------------------------'],
    ['l', '1 Menú del día            14,50'], ['l', '1 Agua mineral             1,80'], ['l', '1 Café                     1,30'],
    ['l', '------------------------------------'],
    ['l', 'BASE IMPONIBLE            16,00'], ['l', 'IVA 10% CUOTA              1,60'], ['l', 'TOTAL EUR                 17,60', 1],
    ['l', '------------------------------------'], ['c', 'Documento ficticio de ejemplo']
  ];
  var W = 600, LH = 34, PAD = 30, cv = document.createElement('canvas');
  cv.width = W; cv.height = PAD * 2 + L.length * LH;
  var x = cv.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#111'; x.textBaseline = 'top';
  L.forEach(function (r, i) {
    x.font = (r[2] ? 'bold ' : '') + '22px "DejaVu Sans Mono", Consolas, "Courier New", monospace';
    var y = PAD + i * LH;
    if (r[0] === 'c') { x.textAlign = 'center'; x.fillText(r[1], W / 2, y); }
    else { x.textAlign = 'left'; x.fillText(r[1], PAD, y); }
  });
  return cv.toDataURL('image/png');
})();
