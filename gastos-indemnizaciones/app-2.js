'use strict';
VIEWS.autorizaciones = () => {
  const u = me(), canApprove = ['responsable','admin'].includes(u.role);
  const list = S.autorizaciones.filter(a => canApprove ? true : a.userId === u.id);
  $('#view').innerHTML = `
  <h1>Autorización previa de comisiones de servicio</h1><p class="sub">Obligatoria antes de cualquier gasto. Recoge los mismos campos que la creación del gasto para que el responsable decida con toda la información.</p>
  <div class="panel"><h2 style="margin-top:0">Nueva solicitud</h2>
   <form id="fAut">
    <label class="f">Motivo de la comisión<input name="motivo" required placeholder="p. ej. Taller de emprendimiento en Jaén"></label>
    <div class="grid3">
     <label class="f">Centro de origen<select name="origen">${S.centers.map(c=>`<option value="${c.id}" ${c.id===u.center?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
     <label class="f">Destino (ciudad)<input name="destino" required placeholder="Jaén"></label>
     <label class="f">País / tabla<select name="country">${S.config.dietTables.map(t=>`<option value="${t.country}">${t.country} · ${esc(t.name.replace('Tabla demo · ',''))}</option>`).join('')}</select></label>
     <label class="f">Fecha de salida<input type="date" name="fIni" required value="${offset(2)}"></label>
     <label class="f">Hora de salida<input type="time" name="hIni" required value="08:00"></label>
     <label class="f">Fecha de regreso<input type="date" name="fFin" required value="${offset(2)}"></label>
     <label class="f">Hora de regreso<input type="time" name="hFin" required value="18:00"></label>
     <label class="f">Transporte<select name="transporte"><option>Vehículo propio</option><option>Tren</option><option>Autobús</option><option>Avión</option><option>Vehículo de alquiler</option></select></label>
     <label class="f">Km previstos (vehículo propio)<input type="number" name="kmPrev" min="0" value="0"></label>
    </div>
    <div class="row"><label><input type="checkbox" name="pernocta"> Pernocta</label><label><input type="checkbox" name="alojamiento"> Necesita alojamiento</label></div>
    <label class="f">Importe estimado (€)<input type="number" step="0.01" name="estimado" min="0" value="0"></label>
    <button class="btn" type="submit">Enviar a mi responsable</button>
   </form></div>
  <h2>${canApprove ? 'Solicitudes del equipo' : 'Mis solicitudes'}</h2>
  <div class="tbl-wrap"><table><thead><tr><th>Ref.</th><th>Solicitante</th><th>Motivo / destino</th><th>Fechas</th><th>Estimado</th><th>Estado</th><th></th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${a.id}</td><td>${esc(user(a.userId).name)}</td><td>${esc(a.motivo)}<br><span class="muted">${esc(center(a.origen).city)} → ${esc(a.destino)} (${a.country}) · ${esc(a.transporte)}${a.pernocta?' · pernocta':''}</span></td><td>${fmtD(a.fIni)} ${a.hIni}<br>${fmtD(a.fFin)} ${a.hFin}</td><td>${eur(a.estimado)}</td><td>${stBadge(a.estado)}</td>
   <td>${canApprove && a.estado==='pendiente' ? `<button class="btn small" data-ap="${a.id}">Aprobar</button> <button class="btn small danger" data-de="${a.id}">Denegar</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
  $('#fAut').onsubmit = e => {
    e.preventDefault(); const f = new FormData(e.target);
    const a = Object.fromEntries(f.entries()); a.pernocta = f.has('pernocta'); a.alojamiento = f.has('alojamiento'); a.kmPrev = +a.kmPrev; a.estimado = +a.estimado;
    if (a.fFin < a.fIni) return toast('La fecha de regreso no puede ser anterior a la de salida');
    Object.assign(a, {id:next('AUT'), userId:u.id, estado:'pendiente', history:[{t:today(), who:u.id, what:'Solicitada'}]});
    S.autorizaciones.unshift(a); notify(u.manager || 'responsable', `${a.id}: nueva solicitud de autorización previa de ${u.name}`); log('Autorización solicitada', a.id); save(); toast('Solicitud enviada al responsable'); route();
  };
  $$('[data-ap]').forEach(b => b.onclick = () => decideAut(b.dataset.ap, true));
  $$('[data-de]').forEach(b => b.onclick = () => decideAut(b.dataset.de, false));
};
function decideAut(id, ok){
  const a = S.autorizaciones.find(x => x.id === id); let motivo = '';
  if (!ok) motivo = prompt('Motivo de la denegación', 'No procede') || 'No procede';
  a.estado = ok ? 'aprobada' : 'denegada'; a.approver = S.current; a.history.push({t:today(), who:S.current, what: ok ? 'Aprobada' : 'Denegada: ' + motivo});
  notify(a.userId, `${a.id} ${ok ? 'APROBADA: ya puede registrar los gastos' : 'DENEGADA: ' + motivo}`); log(ok?'Autorización aprobada':'Autorización denegada', id); save(); toast(ok ? 'Autorización aprobada' : 'Autorización denegada'); route();
}
VIEWS.gastos = () => {
  const u = me(), list = S.gastos.filter(g => g.userId === u.id);
  $('#view').innerHTML = `<h1>Mis gastos</h1><p class="sub">Tiques, kilometraje y dietas vinculados a autorizaciones previas.</p>
  <div class="row no-print" style="margin-bottom:12px"><a class="btn" href="#nuevo">📷 Nuevo gasto con foto / adjunto</a><a class="btn sec" href="#dietas">Calcular dieta o km</a></div>${tableGastos(list)}`;
};
function tableGastos(list, actions){
  if (!list.length) return '<div class="panel muted">No hay gastos.</div>';
  return `<div class="tbl-wrap"><table><thead><tr><th>Ref.</th><th>Fecha</th><th>Empleado</th><th>Tipo / concepto</th><th>Emisor</th><th>Importe</th><th>Estado</th>${actions?'<th></th>':''}</tr></thead><tbody>
  ${list.map(g => `<tr><td>${g.id}<br><span class="muted">${g.authId||''}</span></td><td>${fmtD(g.fecha)}</td><td>${esc(user(g.userId).name)}</td><td>${esc(g.tipo)}<br><span class="muted">${esc(g.concepto||'')}</span>${(g.alerts||[]).map(a=>`<div class="st pend" style="margin-top:4px">⚠ ${esc(a)}</div>`).join('')}</td><td>${esc(g.razon||'')}<br><span class="muted">${esc(g.nif||'')}</span></td><td><strong>${eur(g.importe)}</strong></td><td>${stBadge(g.estado)}</td>${actions?`<td>${actions(g)}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
/* Nuevo gasto con OCR */
VIEWS.nuevo = () => {
  const u = me(); const auts = S.autorizaciones.filter(a => a.userId === u.id);
  const ok = auts.filter(a => a.estado === 'aprobada');
  $('#view').innerHTML = `<h1>Nuevo gasto con captura de justificante</h1><p class="sub">Haga una foto con el móvil, escanee o adjunte el tique/factura. El OCR se ejecuta en el propio navegador (la imagen no se envía a terceros).</p>
  ${ok.length ? '' : `<div class="alert err"><strong>No tiene ninguna autorización previa aprobada.</strong> El sistema no permite registrar gastos sin autorización previa${auts.some(a=>a.estado==='denegada')?' (las autorizaciones denegadas no pueden usarse)':''}. <a href="#autorizaciones">Solicitar autorización</a></div>`}
  <div class="grid2">
   <div class="panel"><h2 style="margin-top:0">1 · Justificante</h2>
    <div class="drop" id="drop"><p>Arrastre aquí la imagen o</p>
     <div class="row" style="justify-content:center"><label class="btn"><input id="file" type="file" accept="image/*" capture="environment" hidden>📷 Foto / adjuntar</label>
     <button class="btn sec" id="sample" type="button">Probar con tique de ejemplo</button></div></div>
    <div id="ocrStatus" class="hidden" style="margin-top:10px"><div class="muted" id="ocrMsg">Leyendo…</div><div class="progress"><div id="ocrBar"></div></div></div>
    <img id="prev" class="preview hidden" alt="Vista previa del justificante" style="margin-top:10px">
    <details style="margin-top:8px"><summary class="muted">Texto reconocido (OCR)</summary><pre id="ocrText" style="white-space:pre-wrap;font-size:12px"></pre></details>
   </div>
   <div class="panel"><h2 style="margin-top:0">2 · Datos extraídos (revise)</h2>
    <form id="fG">
     <label class="f">Autorización previa<select name="authId" required ${ok.length?'':'disabled'}>${ok.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.motivo)} (${fmtD(a.fIni)})</option>`).join('')}</select></label>
     <label class="f">Tipo de gasto<select name="tipo">${S.config.expenseTypes.map(t=>`<option>${t}</option>`).join('')}</select></label>
     <div class="grid2">
      <label class="f" data-k="importe">Importe total (€)<input name="importe" type="number" step="0.01" required></label>
      <label class="f" data-k="fecha">Fecha del documento<input name="fecha" type="date" required></label>
      <label class="f" data-k="nif">NIF emisor<input name="nif"></label>
      <label class="f" data-k="numFactura">Nº factura / tique<input name="numFactura"></label>
     </div>
     <label class="f" data-k="razon">Razón social del emisor<input name="razon"></label>
     <label class="f" data-k="direccion">Dirección fiscal<input name="direccion"></label>
     <div class="grid3">
      <label class="f" data-k="ivaRate">Tipo IVA (%)<input name="ivaRate" type="number" step="0.1"></label>
      <label class="f" data-k="base">Base imponible<input name="base" type="number" step="0.01"></label>
      <label class="f" data-k="ivaCuota">Cuota IVA<input name="ivaCuota" type="number" step="0.01"></label>
     </div>
     <label class="f" data-k="nifReceptor">NIF receptor (si la factura está a nombre de la Fundación)<input name="nifReceptor"></label>
     <label class="f">Concepto / observaciones<input name="concepto"></label>
     <div id="checks"></div>
     <button class="btn" type="submit" ${ok.length?'':'disabled'}>Enviar a validación</button>
    </form></div></div>`;
  let imgData = null;
  const handle = async (blobOrUrl) => {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    $('#prev').src = url; $('#prev').classList.remove('hidden');
    imgData = await toDataURL(url, 900);
    $('#ocrStatus').classList.remove('hidden'); $('#ocrMsg').textContent = 'Cargando motor OCR…';
    try {
      const res = await Tesseract.recognize(url, 'spa', {logger: m => { if (m.status) { $('#ocrMsg').textContent = ({'recognizing text':'Reconociendo texto','loading language traineddata':'Cargando idioma español','initializing api':'Inicializando'}[m.status]||m.status) + '…'; $('#ocrBar').style.width = Math.round((m.progress||0)*100)+'%'; } }});
      const txt = res.data.text; $('#ocrText').textContent = txt;
      fillForm(parseReceipt(txt), res.data.confidence);
      $('#ocrMsg').textContent = `OCR completado · confianza media ${Math.round(res.data.confidence)} %. Revise los campos marcados en naranja.`; $('#ocrBar').style.width = '100%';
      window.__ocrDone = true;
    } catch (err) { $('#ocrMsg').textContent = 'No se pudo ejecutar el OCR (' + err.message + '). Introduzca los datos manualmente.'; }
  };
  $('#file').onchange = e => e.target.files[0] && handle(e.target.files[0]);
  $('#sample').onclick = () => handle(window.TIQUE_EJEMPLO || 'assets/tique-ejemplo.png');
  const drop = $('#drop'); drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--pri)'; };
  drop.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; f && handle(f); };
  $('#fG').oninput = () => liveChecks();
  $('#fG').onsubmit = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries());
    const a = S.autorizaciones.find(x => x.id === f.authId);
    if (!a || a.estado !== 'aprobada') return toast('Autorización no válida');
    const g = {id:next('GTO'), userId:u.id, authId:f.authId, kind:'ticket', tipo:f.tipo, fecha:f.fecha, importe:+f.importe, base:+f.base||null, ivaRate:+f.ivaRate||null, ivaCuota:+f.ivaCuota||null, nif:(f.nif||'').toUpperCase(), razon:f.razon, direccion:f.direccion, numFactura:f.numFactura, nifReceptor:(f.nifReceptor||'').toUpperCase(), concepto:f.concepto, img:imgData, estado:'pendiente_validacion', history:[{t:today(), who:u.id, what:'Registrado con OCR'}]};
    g.alerts = auditGasto(g);
    S.gastos.unshift(g); notify('validador', `${g.id}: nuevo gasto pendiente de validación (${eur(g.importe)})`); log('Gasto registrado', g.id); save(); toast('Gasto enviado a validación'); location.hash = '#gastos';
  };
};
function toDataURL(url, max){ return new Promise(r => { const i = new Image(); i.crossOrigin='anonymous'; i.onload = () => { const k = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement('canvas'); c.width = i.width*k; c.height = i.height*k; c.getContext('2d').drawImage(i,0,0,c.width,c.height); try{ r(c.toDataURL('image/jpeg', .7)); }catch(e){ r(null); } }; i.onerror = () => r(null); i.src = url; }); }
function num(s){ if (s == null) return null; s = String(s).replace(/\s/g,''); if (/,\d{2}$/.test(s)) s = s.replace(/\./g,'').replace(',', '.'); return parseFloat(s); }
function parseReceipt(txt){
  const lines = txt.split(/\n/).map(l => l.trim()).filter(Boolean); const T = txt.toUpperCase(); const out = {conf:{}};
  const fixDigits = x => x[0] + x.slice(1, 8).replace(/O/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8') + x.slice(8);
  const cand = (T.match(/\b[A-Z0-9][0-9OILSB\-]{7,8}[0-9A-Z]\b/g) || []).map(x => x.replace(/-/g,'')).filter(x => x.length === 9);
  const nifs = []; cand.forEach(x => { const y = /^[0-9O]/.test(x) ? fixDigits('0' + x.slice(1)).replace(/^0/, x[0] === 'O' ? '0' : x[0]) : fixDigits(x); const z = validNIF(x) ? x : validNIF(y) ? y : null; if (z && !nifs.includes(z)) nifs.push(z); });
  out.nif = nifs[0] || ''; out.conf.nif = out.nif && validNIF(out.nif) ? 'ok' : 'low';
  if (nifs[1]) { out.nifReceptor = nifs[1]; out.conf.nifReceptor = validNIF(nifs[1]) ? 'ok' : 'low'; }
  const d = T.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (d) { const y = d[3].length === 2 ? '20' + d[3] : d[3]; out.fecha = `${y}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`; out.conf.fecha = 'ok'; } else out.conf.fecha = 'low';
  const lastNum = l => { const m = l && l.match(/(\d{1,5}[.,]\d{2})(?!.*\d[.,]\d{2})/); return m ? num(m[1]) : null; };
  let tot = null; for (const l of lines) { const L = l.toUpperCase(); if (/TOTAL/.test(L) && !/SUBTOTAL|BASE/.test(L)) { const v = lastNum(L); if (v != null) tot = v; } }
  if (tot == null) { const all = (T.match(/\d{1,5}[.,]\d{2}/g)||[]).map(num); if (all.length) tot = Math.max(...all); out.conf.importe = 'low'; } else out.conf.importe = 'ok';
  out.importe = tot;
  const iva = T.match(/IVA[^\n%]{0,12}?(\d{1,2}(?:[.,]\d{1,2})?)\s?%/) || T.match(/(\d{1,2})\s?%\s?IVA/);
  if (iva) { out.ivaRate = num(iva[1]); out.conf.ivaRate = [4,5,10,21].includes(out.ivaRate) ? 'ok' : 'low'; } else out.conf.ivaRate = 'low';
  out.base = lastNum(lines.find(l => /BASE/i.test(l))); out.ivaCuota = lastNum(lines.find(l => /CUOTA/i.test(l)));
  if (out.importe && out.ivaRate && out.base == null) out.base = +(out.importe / (1 + out.ivaRate/100)).toFixed(2);
  if (out.importe && out.base != null && out.ivaCuota == null) out.ivaCuota = +(out.importe - out.base).toFixed(2);
  if (out.base && out.ivaCuota && out.ivaRate && Math.abs(out.base * out.ivaRate / 100 - out.ivaCuota) < 0.02 && Math.abs(out.base + out.ivaCuota - (out.importe || 0)) > 0.02) {
    out.importeLeido = out.importe; out.importe = +(out.base + out.ivaCuota).toFixed(2); out.conf.importe = 'low'; out.corregido = true;
  }
  const fac = txt.match(/(?:FACTURA(?:\s+SIMPLIFICADA)?|TIQUE|TICKET|FRA\.?)[^\n:#]{0,10}[:#]\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i) || txt.match(/\b([A-Z]{1,4}-\d{2,4}-\d{2,8})\b/);
  out.numFactura = fac ? fac[1] : ''; out.conf.numFactura = fac ? 'ok' : 'low';
  const dir = lines.find(l => /\b(C\/|CALLE|AVDA|AVENIDA|PLAZA|PZA|PASEO|CTRA)\b/i.test(l)); out.direccion = dir || ''; out.conf.direccion = dir ? 'ok' : 'low';
  const rz = lines.find(l => /\b(S\.?L\.?U?|S\.?A\.?|S\.?COOP|C\.?B\.?)\.?$/i.test(l)) || lines[0]; out.razon = rz || ''; out.conf.razon = rz ? 'ok' : 'low';
  return out;
}
function fillForm(f, conf){
  const form = $('#fG'); ['importe','fecha','nif','numFactura','razon','direccion','ivaRate','base','ivaCuota','nifReceptor'].forEach(k => {
    if (f[k] != null && f[k] !== '') form.elements[k].value = f[k];
    const lab = form.querySelector(`[data-k="${k}"]`); if (lab) lab.classList.toggle('lowconf', f.conf[k] === 'low' || conf < 60);
  });
  if (f.corregido) $('#checks').dataset.note = `Importe leído ${f.importeLeido} corregido a ${f.importe} por coherencia base + IVA (verifique)`; else delete $('#checks').dataset.note;
  if (/aparc|parking/i.test(f.razon)) form.elements.tipo.value = 'Aparcamiento';
  else if (/bar|cafet|rest/i.test(f.razon)) form.elements.tipo.value = 'Manutención';
  liveChecks();
}
function liveChecks(){
  const f = $('#fG'); if (!f) return; const out = [];
  const nif = f.elements.nif.value; if (nif) out.push(validNIF(nif) ? ['ok', `NIF emisor ${nif} válido (dígito de control correcto)`] : ['err', `NIF emisor ${nif} no supera la validación del dígito de control`]);
  const r = f.elements.nifReceptor.value; if (r) out.push(r.toUpperCase() === S.config.orgNIF ? ['ok','NIF receptor = Fundación: IVA recuperable'] : ['warn', 'NIF receptor distinto del de la Fundación']);
  const b = +f.elements.base.value, c = +f.elements.ivaCuota.value, t = +f.elements.importe.value;
  if (b && c && t) out.push(Math.abs(b + c - t) < 0.02 ? ['ok','Base + cuota = total'] : ['warn', `Base + cuota (${(b+c).toFixed(2)}) ≠ total (${t.toFixed(2)})`]);
  const fecha = f.elements.fecha.value, a = S.autorizaciones.find(x => x.id === f.elements.authId.value);
  if (fecha && a && (fecha < a.fIni || fecha > a.fFin)) out.push(['warn', `La fecha del documento no está dentro de la comisión autorizada (${fmtD(a.fIni)}–${fmtD(a.fFin)}): se generará alerta`]);
  const words = S.config.forbidden.filter(w => (($('#ocrText')?.textContent||'') + ' ' + f.elements.concepto.value).toLowerCase().includes(w)); if (words.length) out.push(['err', 'Contiene palabras no permitidas: ' + words.join(', ')]);
  if ($('#checks').dataset.note) out.unshift(['info', 'ICR: ' + $('#checks').dataset.note]);
  $('#checks').innerHTML = out.map(([k, m]) => `<div class="alert ${k}">${esc(m)}</div>`).join('');
}
function auditGasto(g){
  const al = [];
  if (g.kind === 'km' && g.kmRuta && g.km > g.kmRuta * (1 + S.config.kmDeviationPct/100)) al.push(`Desviación de kilometraje: declarados ${g.km} km vs ${g.kmRuta} km de ruta (+${Math.round((g.km/g.kmRuta-1)*100)} %)`);
  if (g.nif && !validNIF(g.nif)) al.push('NIF del emisor no válido');
  const dup = S.gastos.find(x => x.id !== g.id && x.nif && x.nif === g.nif && x.numFactura && x.numFactura === g.numFactura);
  if (dup) al.push(`Posible duplicado de ${dup.id} (mismo NIF y nº de factura)`);
  const a = S.autorizaciones.find(x => x.id === g.authId);
  if (a && g.fecha && (g.fecha < a.fIni || g.fecha > a.fFin)) al.push('Fecha fuera del periodo autorizado');
  const words = S.config.forbidden.filter(w => (String(g.concepto||'') + ' ' + String(g.razon||'')).toLowerCase().includes(w)); if (words.length) al.push('Palabras no permitidas: ' + words.join(', '));
  if (g.base && g.ivaCuota && Math.abs(g.base + g.ivaCuota - g.importe) > 0.02) al.push('Incoherencia: base + IVA ≠ total');
  return al;
}
