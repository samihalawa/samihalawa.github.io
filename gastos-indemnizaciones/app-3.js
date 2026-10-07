'use strict';
/* Dietas y kilometraje */
VIEWS.dietas = () => {
  const u = me(); const ok = S.autorizaciones.filter(a => a.userId === u.id && a.estado === 'aprobada');
  $('#view').innerHTML = `<h1>Cálculo automático de dietas y kilometraje</h1><p class="sub">Según país y tabla de dietas, día, franja horaria y pernoctaciones. Distancia calculada automáticamente con mapas (OpenStreetMap/OSRM).</p>
  <div class="grid2">
   <div class="panel"><h2 style="margin-top:0">Dietas</h2>
    <form id="fD">
     <label class="f">Autorización previa (rellena los datos)<select name="authId"><option value="">—</option>${ok.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.destino)} ${fmtD(a.fIni)}</option>`).join('')}</select></label>
     <label class="f">Tabla de dietas / país<select name="table">${S.config.dietTables.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
     <div class="grid2"><label class="f">Salida<input type="datetime-local" name="ini" value="${offset(0)}T08:00"></label><label class="f">Regreso<input type="datetime-local" name="fin" value="${offset(1)}T17:30"></label></div>
     <label><input type="checkbox" name="pernocta" checked> Con pernoctación (alojamiento justificado aparte)</label>
     <div id="dRes" style="margin-top:12px"></div>
     <button class="btn" type="button" id="dSave" disabled>Registrar dieta como gasto</button>
    </form></div>
   <div class="panel"><h2 style="margin-top:0">Kilometraje</h2>
    <form id="fK">
     <div class="grid2"><label class="f">Origen<input name="o" value="${esc(center(u.center).city || 'Sevilla')}"></label><label class="f">Destino<input name="d" value="Córdoba"></label></div>
     <label><input type="checkbox" name="ida" checked> Ida y vuelta</label>
     <div class="row" style="margin:8px 0"><button class="btn sec" type="button" id="kCalc">Calcular ruta</button><span class="muted" id="kMsg"></span></div>
     <div id="map"></div>
     <div class="grid2" style="margin-top:10px"><label class="f">Km de ruta calculados<input name="kmRuta" readonly></label><label class="f">Km declarados<input name="km" type="number" min="0"></label></div>
     <label class="f">Autorización previa<select name="authId">${ok.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.destino)} ${fmtD(a.fIni)}</option>`).join('')}</select></label>
     <div id="kRes"></div>
     <button class="btn" type="button" id="kSave" ${ok.length?'':'disabled'}>Registrar kilometraje</button>
    </form></div></div>
  <div class="panel"><h2 style="margin-top:0">Reglas aplicadas (parametrizables en Administración)</h2>
   <ul><li>Días con pernoctación: manutención completa; alojamiento hasta el máximo de la tabla contra factura.</li>
   <li>Día de regreso: media manutención si el regreso es posterior a las ${S.config.lunchTo}; completa si es posterior a las ${S.config.dinnerFrom}.</li>
   <li>Comisión sin pernoctar: media manutención si dura al menos ${S.config.minHoursHalf} h y cubre la franja ${S.config.lunchFrom}–${S.config.lunchTo}.</li>
   <li>Kilometraje: ${eur(S.config.kmRate)}/km · alerta de auditoría si lo declarado supera la ruta en más de un ${S.config.kmDeviationPct} %.</li>
   <li class="muted">Importes y reglas de ejemplo: la Fundación los configura según su normativa vigente.</li></ul></div>`;
  const fD = $('#fD'); let lastDiet = null;
  const calcD = () => {
    const f = Object.fromEntries(new FormData(fD).entries()); const per = fD.elements.pernocta.checked;
    const t = S.config.dietTables.find(x => x.id === f.table); const r = calcDiet(f.ini, f.fin, per, t); lastDiet = {r, t};
    $('#dRes').innerHTML = r.error ? `<div class="alert err">${r.error}</div>` : `<div class="tbl-wrap"><table><thead><tr><th>Día</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${r.lines.map(l=>`<tr><td>${fmtD(l.d)}</td><td>${esc(l.c)}</td><td>${eur(l.v)}</td></tr>`).join('')}<tr><td></td><td><strong>Total manutención</strong></td><td><strong>${eur(r.total)}</strong></td></tr>${r.nights?`<tr><td></td><td class="muted">Alojamiento: ${r.nights} noche(s), máximo ${eur(t.alojamiento)}/noche contra factura</td><td class="muted">≤ ${eur(r.nights*t.alojamiento)}</td></tr>`:''}</tbody></table></div>`;
    $('#dSave').disabled = !!r.error || !fD.elements.authId.value || !r.total;
  };
  fD.oninput = calcD;
  fD.elements.authId.onchange = () => { const a = S.autorizaciones.find(x => x.id === fD.elements.authId.value); if (a) { fD.elements.ini.value = a.fIni + 'T' + a.hIni; fD.elements.fin.value = a.fFin + 'T' + a.hFin; fD.elements.pernocta.checked = a.pernocta; const t = S.config.dietTables.find(x => x.country === a.country); if (t) fD.elements.table.value = t.id; } calcD(); };
  calcD();
  $('#dSave').onclick = () => { const a = fD.elements.authId.value; const g = {id:next('GTO'), userId:u.id, authId:a, kind:'dieta', tipo:'Dieta', fecha:fD.elements.ini.value.slice(0,10), importe:lastDiet.r.total, concepto:lastDiet.r.lines.map(l=>l.c).join(' + ') + ' · ' + lastDiet.t.name, estado:'pendiente_validacion', history:[{t:today(), who:u.id, what:'Dieta calculada automáticamente'}]}; g.alerts = auditGasto(g); S.gastos.unshift(g); notify('validador', `${g.id}: dieta pendiente de validación`); log('Dieta registrada', g.id); save(); toast('Dieta registrada'); location.hash = '#gastos'; };
  const map = L.map('map').setView([37.4, -4.6], 7); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:18, attribution:'© OpenStreetMap'}).addTo(map); let layer = null;
  const fK = $('#fK');
  const kChecks = () => { const km = +fK.elements.km.value, kr = +fK.elements.kmRuta.value; if (!km) { $('#kRes').innerHTML=''; return; } const dev = kr ? (km/kr - 1)*100 : 0; $('#kRes').innerHTML = `<div class="alert ${kr && dev > S.config.kmDeviationPct ? 'warn' : 'ok'}">Importe: <strong>${eur(km*S.config.kmRate)}</strong> (${km} km × ${eur(S.config.kmRate)})${kr ? ` · desviación respecto a la ruta: ${dev.toFixed(1)} %${dev > S.config.kmDeviationPct ? ' → se generará alerta de auditoría' : ''}` : ''}</div>`; };
  fK.oninput = kChecks;
  $('#kCalc').onclick = async () => {
    $('#kMsg').textContent = 'Calculando…'; let note = '';
    try {
      const [p1, p2] = await Promise.all([geocode(fK.elements.o.value), geocode(fK.elements.d.value)]);
      let km, geo;
      try { const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=full&geometries=geojson`).then(r => r.json()); km = r.routes[0].distance / 1000; geo = r.routes[0].geometry; }
      catch (e) { km = haversine(p1, p2) * 1.25; geo = {type:'LineString', coordinates:[[p1.lon,p1.lat],[p2.lon,p2.lat]]}; note = ' (servicio de rutas no disponible: estimación geodésica × 1,25)'; }
      if (fK.elements.ida.checked) km *= 2; km = Math.round(km);
      if (layer) map.removeLayer(layer); layer = L.geoJSON(geo, {style:{color:'#0b6e4f', weight:5}}).addTo(map); map.fitBounds(layer.getBounds(), {padding:[20,20]});
      fK.elements.kmRuta.value = km; if (!fK.elements.km.value) fK.elements.km.value = km; $('#kMsg').textContent = `Ruta por carretera: ${km} km${fK.elements.ida.checked ? ' (ida y vuelta)' : ''}${note}`; kChecks();
    } catch (e) { $('#kMsg').textContent = 'No se encontró la localidad: ' + e.message; }
  };
  $('#kSave').onclick = () => { const km = +fK.elements.km.value; if (!km) return toast('Indique los km'); const au = S.autorizaciones.find(a=>a.id===fK.elements.authId.value) || {}; const g = {id:next('GTO'), userId:u.id, authId:au.id, kind:'km', tipo:'Kilometraje', fecha:au.fIni || today(), km, kmRuta:+fK.elements.kmRuta.value || null, importe:+(km*S.config.kmRate).toFixed(2), concepto:`${fK.elements.o.value} → ${fK.elements.d.value}${fK.elements.ida.checked?' (ida y vuelta)':''}`, estado:'pendiente_validacion', history:[{t:today(), who:u.id, what:'Kilometraje registrado'}]}; g.alerts = auditGasto(g); S.gastos.unshift(g); notify('validador', `${g.id}: kilometraje pendiente de validación${g.alerts.length?' (con alertas)':''}`); log('Kilometraje registrado', g.id); save(); toast('Kilometraje registrado'); location.hash = '#gastos'; };
};
const CITY = {'sevilla':{lat:37.3891,lon:-5.9845}, 'málaga':{lat:36.7213,lon:-4.4214}, 'malaga':{lat:36.7213,lon:-4.4214}, 'granada':{lat:37.1773,lon:-3.5986}, 'córdoba':{lat:37.8882,lon:-4.7794}, 'cordoba':{lat:37.8882,lon:-4.7794}, 'almería':{lat:36.8340,lon:-2.4637}, 'almeria':{lat:36.8340,lon:-2.4637}, 'jaén':{lat:37.7796,lon:-3.7849}, 'jaen':{lat:37.7796,lon:-3.7849}, 'huelva':{lat:37.2614,lon:-6.9447}, 'cádiz':{lat:36.5271,lon:-6.2886}, 'cadiz':{lat:36.5271,lon:-6.2886}, 'madrid':{lat:40.4168,lon:-3.7038}};
async function geocode(q){
  const k = q.trim().toLowerCase(); if (CITY[k]) return CITY[k];
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es,pt,fr,be&q=${encodeURIComponent(q)}`, {headers:{'Accept-Language':'es'}}).then(r => r.json());
  if (!r[0]) throw new Error(q); return {lat:+r[0].lat, lon:+r[0].lon};
}
function haversine(a, b){ const R = 6371, t = x => x*Math.PI/180; const d1 = t(b.lat-a.lat), d2 = t(b.lon-a.lon); const h = Math.sin(d1/2)**2 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(d2/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function calcDiet(ini, fin, pernocta, t){
  const a = new Date(ini), b = new Date(fin); if (!(b > a)) return {error:'El regreso debe ser posterior a la salida'};
  const hm = s => { const [h,m] = s.split(':').map(Number); return h*60+m; }; const C = S.config;
  const lines = []; const ds = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const days = []; for (let d = new Date(a.getFullYear(), a.getMonth(), a.getDate()); d <= b; d.setDate(d.getDate()+1)) days.push(new Date(d));
  const mins = d => d.getHours()*60 + d.getMinutes();
  if (days.length === 1 || !pernocta) {
    const dur = (b - a) / 3.6e6; const s = mins(a), e = mins(b) + (days.length - 1) * 1440;
    if (dur >= C.minHoursHalf && s <= hm(C.lunchFrom) && e >= hm(C.lunchTo)) lines.push({d:ds(a), c:'Media manutención (comisión sin pernoctar que cubre la franja de comida)', v:t.media});
    else lines.push({d:ds(a), c:'Sin derecho a manutención (no cubre la franja o la duración mínima)', v:0});
    return {lines, total:lines.reduce((s,l)=>s+l.v,0), nights:0};
  }
  days.forEach((d, i) => {
    if (i < days.length - 1) lines.push({d:ds(d), c:'Manutención completa (día con pernoctación)', v:t.completa});
    else { const e = mins(b); if (e >= hm(C.dinnerFrom)) lines.push({d:ds(d), c:'Manutención completa (regreso posterior a las ' + C.dinnerFrom + ')', v:t.completa}); else if (e >= hm(C.lunchTo)) lines.push({d:ds(d), c:'Media manutención (regreso posterior a las ' + C.lunchTo + ')', v:t.media}); else lines.push({d:ds(d), c:'Día de regreso sin manutención', v:0}); }
  });
  return {lines, total:+lines.reduce((s,l)=>s+l.v,0).toFixed(2), nights:days.length - 1};
}
/* Validación */
VIEWS.validacion = (id) => {
  if (id) return validarDetalle(id);
  const list = S.gastos.filter(g => g.estado === 'pendiente_validacion');
  $('#view').innerHTML = `<h1>Bandeja de validación</h1><p class="sub">Verificación manual obligatoria de los datos fiscales antes de que el gasto se incorpore al sistema: importe y fecha, NIF y razón social, dirección fiscal, nº de factura y NIF receptor.</p>${tableGastos(list, g => `<a class="btn small" href="#validacion/${g.id}">Revisar</a>`)}`;
};
function validarDetalle(id){
  const g = S.gastos.find(x => x.id === id); if (!g) return VIEWS.validacion();
  const checks = [['Revisión de importe y fecha', `${eur(g.importe)} · ${fmtD(g.fecha)}`], ['Validación del NIF y razón social', `${g.nif||'—'} ${g.nif ? (validNIF(g.nif)?'✔ válido':'✖ no válido') : ''} · ${g.razon||'—'}`], ['Validación de dirección fiscal', g.direccion||'—'], ['Verificación del número de factura o tique', g.numFactura||'—'], ['Validación del NIF receptor en facturas', g.nifReceptor||'(tique simplificado: no aplica)']];
  const fiscal = g.kind === 'ticket';
  $('#view').innerHTML = `<h1>Validar ${g.id}</h1><p class="sub">${esc(user(g.userId).name)} · ${esc(g.tipo)} · autorización ${g.authId||'—'}</p>
  ${(g.alerts||[]).map(a => `<div class="alert warn">⚠ ${esc(a)}</div>`).join('')}
  <div class="grid2"><div class="panel">${g.img ? `<img class="preview" src="${g.img}" alt="Justificante">` : `<div class="muted">Sin imagen (${g.kind === 'km' ? 'kilometraje calculado con mapas' : g.kind === 'dieta' ? 'dieta calculada automáticamente' : 'sin adjunto'})</div>`}
   <div class="kv" style="margin-top:12px"><div>Concepto</div><div>${esc(g.concepto||'')}</div>${g.kind==='km'?`<div>Km declarados / ruta</div><div>${g.km} / ${g.kmRuta||'—'}</div>`:''}${g.base?`<div>Base / IVA</div><div>${eur(g.base)} + ${g.ivaRate} % (${eur(g.ivaCuota)})</div>`:''}</div></div>
  <div class="panel"><h2 style="margin-top:0">Lista de comprobación</h2>
   ${fiscal ? checks.map(([l,v]) => `<label style="display:block;margin-bottom:10px"><input type="checkbox" class="chk"> <strong>${l}</strong><br><span class="muted">${esc(v)}</span></label>`).join('') : '<p class="muted">Gasto calculado por el sistema: compruebe concepto e importe.</p><label><input type="checkbox" class="chk"> Concepto e importe correctos</label>'}
   <label class="f" style="margin-top:10px">Observaciones<input id="obs"></label>
   <div class="row"><button class="btn" id="vOk" disabled>Validar e incorporar</button><button class="btn danger" id="vKo">Rechazar / devolver</button></div></div></div>`;
  const upd = () => $('#vOk').disabled = !$$('.chk').every(c => c.checked); $$('.chk').forEach(c => c.onchange = upd);
  $('#vOk').onclick = () => { g.estado = 'validado'; g.history.push({t:today(), who:S.current, what:'Validado ' + ($('#obs').value||'')}); notify(g.userId, `${g.id} validado (${eur(g.importe)})`); log('Gasto validado', g.id); save(); toast('Gasto validado'); location.hash = '#validacion'; };
  $('#vKo').onclick = () => { const m = $('#obs').value || prompt('Motivo del rechazo', 'Datos incorrectos') || 'Datos incorrectos'; g.estado = 'rechazado'; g.history.push({t:today(), who:S.current, what:'Rechazado: ' + m}); notify(g.userId, `${g.id} rechazado: ${m}`); log('Gasto rechazado', g.id); save(); toast('Gasto rechazado'); location.hash = '#validacion'; };
}
/* Viajes */
const costeViaje = v => (v.hotel.pedido ? v.hotel.coste : 0) + (v.coche.pedido ? v.coche.coste : 0) + (v.transporte.coste || 0);
VIEWS.viajes = () => {
  const u = me(), mgr = ['responsable','admin','tesoreria'].includes(u.role);
  const list = S.viajes.filter(v => mgr || v.userId === u.id); const ok = S.autorizaciones.filter(a => a.userId === u.id && a.estado !== 'denegada');
  $('#view').innerHTML = `<h1>Gestión de viajes</h1><p class="sub">Creación de viajes desde web responsive, solicitudes de hotel y vehículo de alquiler, aprobaciones, panel centralizado, analítica de costes, imprevistos y cancelaciones.</p>
  <div class="panel"><h2 style="margin-top:0">Nuevo viaje</h2><form id="fV"><div class="grid3">
   <label class="f">Autorización previa<select name="authId">${ok.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.destino)} ${fmtD(a.fIni)} ${a.estado==='pendiente'?'(pendiente)':''}</option>`).join('')}</select></label>
   <label class="f">Transporte<select name="tt"><option>Tren</option><option>Autobús</option><option>Avión</option><option>Vehículo propio</option></select></label>
   <label class="f">Coste transporte estimado (€)<input type="number" step="0.01" name="tc" value="0"></label>
   <label class="f"><span><input type="checkbox" name="hotel"> Solicitar hotel · noches</span><input type="number" name="noches" min="0" value="1"></label>
   <label class="f">Coste hotel estimado (€)<input type="number" step="0.01" name="hc" value="0"></label>
   <label class="f"><span><input type="checkbox" name="coche"> Vehículo de alquiler · coste (€)</span><input type="number" step="0.01" name="cc" value="0"></label>
  </div><button class="btn" ${ok.length?'':'disabled'}>Solicitar viaje</button></form></div>
  <div class="cards"><div class="card"><div class="k">Viajes</div><div class="v">${list.length}</div></div><div class="card"><div class="k">Coste total previsto</div><div class="v">${eur(list.filter(v=>v.estado!=='cancelado').reduce((s,v)=>s+costeViaje(v),0))}</div></div><div class="card"><div class="k">Con incidencias</div><div class="v">${list.filter(v=>v.incidencias.length).length}</div></div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Ref.</th><th>Viajero</th><th>Destino / fechas</th><th>Hotel</th><th>Vehículo</th><th>Transporte</th><th>Coste</th><th>Estado</th><th></th></tr></thead><tbody>
  ${list.map(v => `<tr><td>${v.id}<br><span class="muted">${v.authId}</span></td><td>${esc(user(v.userId).name)}</td><td>${esc(v.destino)}<br>${fmtD(v.fIni)}–${fmtD(v.fFin)}${v.incidencias.map(i=>`<div class="st pend">${esc(i)}</div>`).join('')}</td><td>${v.hotel.pedido?`${v.hotel.noches} noche(s) · ${eur(v.hotel.coste)}<br>${stBadge(v.hotel.estado)}`:'—'}</td><td>${v.coche.pedido?`${eur(v.coche.coste)}<br>${stBadge(v.coche.estado)}`:'—'}</td><td>${esc(v.transporte.tipo)} · ${eur(v.transporte.coste)}</td><td><strong>${eur(costeViaje(v))}</strong></td><td>${stBadge(v.estado)}</td>
   <td>${mgr && v.estado==='solicitado' ? `<button class="btn small" data-va="${v.id}">Aprobar</button> `:''}${v.estado!=='cancelado'?`<button class="btn small sec" data-vi="${v.id}">Imprevisto</button> <button class="btn small danger" data-vc="${v.id}">Cancelar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#fV').onsubmit = e => { e.preventDefault(); const f = e.target.elements; const a = S.autorizaciones.find(x => x.id === f.authId.value); if (!a) return; const v = {id:next('VJ'), userId:u.id, authId:a.id, destino:a.destino, fIni:a.fIni, fFin:a.fFin, hotel:{pedido:f.hotel.checked, noches:+f.noches.value, coste:+f.hc.value, estado:f.hotel.checked?'pendiente':'—'}, coche:{pedido:f.coche.checked, coste:+f.cc.value, estado:f.coche.checked?'pendiente':'—'}, transporte:{tipo:f.tt.value, coste:+f.tc.value}, estado:'solicitado', incidencias:[]}; S.viajes.unshift(v); notify(u.manager||'responsable', `${v.id}: nueva solicitud de viaje a ${v.destino}`); log('Viaje solicitado', v.id); save(); toast('Viaje solicitado'); route(); };
  $$('[data-va]').forEach(b => b.onclick = () => { const v = S.viajes.find(x => x.id === b.dataset.va); v.estado = 'aprobado'; if (v.hotel.pedido) v.hotel.estado = 'aprobado'; if (v.coche.pedido) v.coche.estado = 'aprobado'; notify(v.userId, `${v.id} aprobado`); log('Viaje aprobado', v.id); save(); route(); });
  $$('[data-vi]').forEach(b => b.onclick = () => { const v = S.viajes.find(x => x.id === b.dataset.vi); const m = prompt('Describa el imprevisto (retraso, cambio de hotel, coste adicional…)'); if (!m) return; const extra = +(prompt('Coste adicional (€)', '0') || 0); v.incidencias.push(m + (extra ? ` (+${eur(extra)})` : '')); v.transporte.coste += extra; v.estado = 'incidencia'; notify('responsable', `${v.id}: imprevisto registrado`); log('Imprevisto en viaje', v.id); save(); route(); });
  $$('[data-vc]').forEach(b => b.onclick = () => { const v = S.viajes.find(x => x.id === b.dataset.vc); if (!confirm('¿Cancelar el viaje ' + v.id + '?')) return; v.estado = 'cancelado'; v.hotel.estado = v.hotel.pedido ? 'cancelado' : '—'; v.coche.estado = v.coche.pedido ? 'cancelado' : '—'; notify('responsable', `${v.id} cancelado`); log('Viaje cancelado', v.id); save(); route(); });
};
/* Anticipos */
VIEWS.anticipos = () => {
  const u = me(), list = S.anticipos.filter(a => ['tesoreria','admin','responsable'].includes(u.role) || a.center === u.center);
  const pend = S.anticipos.filter(a => a.center === u.center && ['solicitado','aprobado','pagado'].includes(a.estado));
  const canResp = ['responsable','admin'].includes(u.role);
  $('#view').innerHTML = `<h1>Anticipos de caja de los centros</h1><p class="sub">Solicitud y aprobación por roles, pago por tesorería, liquidación con devolución de sobrante o liquidación negativa automatizada.</p>
  <div class="panel"><h2 style="margin-top:0">Solicitar anticipo para ${esc(center(u.center).name)}</h2>
   ${pend.length ? `<div class="alert err"><strong>Control automático:</strong> el centro tiene anticipos pendientes de liquidar (${pend.map(p=>p.id).join(', ')}). No se puede solicitar un nuevo anticipo hasta liquidarlos.</div>` : ''}
   <form id="fA"><div class="grid2"><label class="f">Importe (máx. ${eur(S.config.anticipoMax)})<input type="number" step="0.01" name="importe" min="1" max="${S.config.anticipoMax}" required></label><label class="f">Finalidad<input name="motivo" required placeholder="Material de oficina, pequeñas reparaciones…"></label></div>
   <button class="btn" ${pend.length?'disabled':''}>Solicitar</button></form></div>
  <div class="tbl-wrap"><table><thead><tr><th>Ref.</th><th>Centro</th><th>Solicitante</th><th>Finalidad</th><th>Importe</th><th>Justificado</th><th>Liquidación</th><th>Estado</th><th></th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${a.id}</td><td>${esc(center(a.center).name)}</td><td>${esc(user(a.userId).name)}</td><td>${esc(a.motivo)}</td><td>${eur(a.importe)}</td><td>${a.gastado!=null?eur(a.gastado):'—'}</td><td>${a.liquidacion?`${a.liquidacion.tipo==='negativa'?'Negativa: reintegro al centro':a.liquidacion.tipo==='devolucion'?'Devolución de sobrante':'Exacta'} ${eur(a.liquidacion.diferencia)}<br>${stBadge(a.liquidacion.estado==='pendiente'?'pendiente':'cerrado')}`:'—'}</td><td>${stBadge(a.estado)}</td>
   <td>${canResp && a.estado==='solicitado' ? `<button class="btn small" data-aa="${a.id}">Aprobar</button>`:''}${a.estado==='pagado' && (a.center===u.center || u.role==='admin') ? `<button class="btn small sec" data-al="${a.id}">Liquidar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#fA').onsubmit = e => { e.preventDefault(); if (pend.length) return; const f = e.target.elements; const imp = +f.importe.value; if (imp > S.config.anticipoMax) return toast('Supera el máximo permitido'); const a = {id:next('ANT'), center:u.center, userId:u.id, importe:imp, motivo:f.motivo.value, fecha:today(), estado:'solicitado', gastado:null, history:[{t:today(), who:u.id, what:'Solicitado'}]}; S.anticipos.unshift(a); notify('responsable', `${a.id}: solicitud de anticipo de caja ${eur(imp)} (${center(u.center).name})`); log('Anticipo solicitado', a.id); save(); toast('Anticipo solicitado'); route(); };
  $$('[data-aa]').forEach(b => b.onclick = () => { const a = S.anticipos.find(x => x.id === b.dataset.aa); a.estado = 'aprobado'; a.history.push({t:today(), who:S.current, what:'Aprobado'}); notify('tesoreria', `${a.id}: anticipo aprobado pendiente de pago`); notify(a.userId, `${a.id}: anticipo aprobado`); log('Anticipo aprobado', a.id); save(); route(); });
  $$('[data-al]').forEach(b => b.onclick = () => liquidar(b.dataset.al));
};
