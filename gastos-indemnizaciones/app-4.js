'use strict';
function liquidar(id, preset){
  const a = S.anticipos.find(x => x.id === id); const g = preset != null ? preset : +(prompt(`Importe total justificado con facturas para ${a.id} (anticipo ${eur(a.importe)})`, a.importe) || NaN); if (isNaN(g)) return;
  a.gastado = g; const dif = +(g - a.importe).toFixed(2); a.estado = 'liquidado';
  if (dif > 0) { a.liquidacion = {tipo:'negativa', diferencia:dif, estado:'pendiente'}; notify('tesoreria', `${a.id}: liquidación negativa automática, reintegrar ${eur(dif)} al centro`); }
  else if (dif < 0) { a.liquidacion = {tipo:'devolucion', diferencia:-dif, estado:'pendiente'}; notify('tesoreria', `${a.id}: el centro debe devolver ${eur(-dif)} de sobrante`); }
  else a.liquidacion = {tipo:'exacta', diferencia:0, estado:'cerrada'};
  a.history.push({t:today(), who:S.current, what:`Liquidado: justificado ${eur(g)}`}); log('Anticipo liquidado', id); save(); toast('Liquidación registrada'); route();
}
VIEWS.tesoreria = () => {
  const A = S.anticipos; const sum = s => A.filter(a => a.estado === s).reduce((t,a) => t + a.importe, 0);
  const liq = (tp) => A.filter(a => a.liquidacion?.tipo === tp && a.liquidacion.estado === 'pendiente').reduce((t,a) => t + a.liquidacion.diferencia, 0);
  $('#view').innerHTML = `<h1>Panel centralizado de tesorería</h1><p class="sub">Anticipos de todos los centros: pagos, liquidaciones, devoluciones de sobrante y reintegros por liquidación negativa.</p>
  <div class="cards"><div class="card"><div class="k">Aprobados pendientes de pago</div><div class="v">${eur(sum('aprobado'))}</div></div><div class="card"><div class="k">Pagados pendientes de liquidar</div><div class="v">${eur(sum('pagado'))}</div></div><div class="card"><div class="k">Devoluciones pendientes</div><div class="v">${eur(liq('devolucion'))}</div></div><div class="card"><div class="k">Reintegros pendientes (liq. negativas)</div><div class="v">${eur(liq('negativa'))}</div></div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Ref.</th><th>Centro</th><th>Importe</th><th>Estado</th><th>Liquidación</th><th>Acción</th></tr></thead><tbody>
  ${A.map(a => `<tr><td>${a.id}</td><td>${esc(center(a.center).name)}</td><td>${eur(a.importe)}</td><td>${stBadge(a.estado)}</td><td>${a.liquidacion?`${a.liquidacion.tipo} ${eur(a.liquidacion.diferencia)} (${a.liquidacion.estado})`:'—'}</td>
   <td>${a.estado==='aprobado'?`<button class="btn small" data-pay="${a.id}">Registrar pago</button>`:''}${a.liquidacion?.estado==='pendiente'?`<button class="btn small sec" data-close="${a.id}">${a.liquidacion.tipo==='negativa'?'Reintegrar al centro':'Registrar devolución'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
  $$('[data-pay]').forEach(b => b.onclick = () => { const a = A.find(x => x.id === b.dataset.pay); a.estado = 'pagado'; a.history.push({t:today(), who:S.current, what:'Pagado'}); notify(a.userId, `${a.id}: anticipo pagado`); log('Anticipo pagado', a.id); save(); route(); });
  $$('[data-close]').forEach(b => b.onclick = () => { const a = A.find(x => x.id === b.dataset.close); a.liquidacion.estado = a.liquidacion.tipo === 'negativa' ? 'reintegrada' : 'devuelta'; log('Liquidación cerrada', a.id); notify(a.userId, `${a.id}: liquidación cerrada`); save(); route(); });
};
/* Auditoría */
VIEWS.auditoria = () => {
  S.gastos.forEach(g => g.alerts = auditGasto(g)); save();
  const al = S.gastos.filter(g => g.alerts.length);
  $('#view').innerHTML = `<h1>Auditoría y alertas</h1><p class="sub">Alertas por desviación de kilometraje (mapas), palabras prohibidas, alertas personalizadas e incoherencias de datos (duplicados, fechas fuera de la comisión, base + IVA ≠ total, NIF no válido).</p>
  <div class="panel"><h2 style="margin-top:0">Palabras prohibidas</h2><div class="chips">${S.config.forbidden.map(w=>`<span>${esc(w)}</span>`).join('')}</div><p class="muted">Configurables en Administración. Umbral de desviación de km: ${S.config.kmDeviationPct} %.</p></div>
  <h2>Gastos con alertas (${al.length})</h2>${tableGastos(al, g => `<a class="btn small" href="#validacion/${g.id}">Revisar</a>`)}
  <h2>Registro de actividad</h2><div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Ref.</th></tr></thead><tbody>${S.audit.slice(0,50).map(x=>`<tr><td>${new Date(x.t).toLocaleString('es-ES')}</td><td>${esc(user(x.who).name)}</td><td>${esc(x.what)}</td><td>${esc(x.ref||'')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin actividad todavía en esta sesión.</td></tr>'}</tbody></table></div>`;
};
/* BI */
let charts = [];
VIEWS.informes = () => {
  $('#view').innerHTML = `<h1>Cuadro de mando (Business Intelligence)</h1><p class="sub">Filtros de auditoría, informes personalizables, estadísticas y exportación a PDF y Excel.</p>
  <div class="panel no-print"><div class="grid3">
   <label class="f">Centro<select id="bCenter"><option value="">Todos</option>${S.centers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
   <label class="f">Estado<select id="bEstado"><option value="">Todos</option><option value="pendiente_validacion">Pendiente de validación</option><option value="validado">Validado</option><option value="rechazado">Rechazado</option></select></label>
   <label class="f">Solo con alertas de auditoría<select id="bAlert"><option value="">No</option><option value="1">Sí</option></select></label>
   <label class="f">Desde<input type="date" id="bFrom"></label><label class="f">Hasta<input type="date" id="bTo"></label>
   <label class="f">Agrupar por<select id="bGroup"><option value="tipo">Tipo de gasto</option><option value="center">Centro</option><option value="user">Empleado</option><option value="month">Mes</option></select></label>
  </div><div class="row"><button class="btn sec" id="bXls">⬇ Excel</button><button class="btn sec" id="bPdf">⬇ PDF</button></div></div>
  <div id="bCards" class="cards"></div>
  <div class="grid2"><div class="panel"><div class="chart-box"><canvas id="ch1" aria-label="Importes agrupados"></canvas></div></div><div class="panel"><div class="chart-box"><canvas id="ch2" aria-label="Gastos por estado"></canvas></div></div></div>
  <div id="bTable"></div>`;
  const draw = () => {
    const f = {c:$('#bCenter').value, e:$('#bEstado').value, a:$('#bAlert').value, from:$('#bFrom').value, to:$('#bTo').value, g:$('#bGroup').value};
    S.gastos.forEach(g => g.alerts = auditGasto(g));
    const rows = S.gastos.filter(g => (!f.c || user(g.userId).center === f.c) && (!f.e || g.estado === f.e) && (!f.a || (g.alerts||[]).length) && (!f.from || g.fecha >= f.from) && (!f.to || g.fecha <= f.to));
    const key = g => f.g === 'center' ? center(user(g.userId).center).name : f.g === 'user' ? user(g.userId).name : f.g === 'month' ? g.fecha.slice(0,7) : g.tipo;
    const agg = {}; rows.forEach(g => agg[key(g)] = (agg[key(g)]||0) + g.importe);
    const est = {}; rows.forEach(g => est[g.estado] = (est[g.estado]||0) + 1);
    const tot = rows.reduce((s,g)=>s+g.importe,0);
    $('#bCards').innerHTML = `<div class="card"><div class="k">Importe total</div><div class="v">${eur(tot)}</div></div><div class="card"><div class="k">Nº de gastos</div><div class="v">${rows.length}</div></div><div class="card"><div class="k">Importe medio</div><div class="v">${eur(rows.length?tot/rows.length:0)}</div></div><div class="card"><div class="k">Con alertas</div><div class="v">${rows.filter(g=>(g.alerts||[]).length).length}</div></div>`;
    charts.forEach(c => c.destroy());
    if (window.Chart) charts = [new Chart($('#ch1'), {type:'bar', data:{labels:Object.keys(agg), datasets:[{label:'Importe (€)', data:Object.values(agg), backgroundColor:'#0b6e4f'}]}, options:{maintainAspectRatio:false, animation:false, plugins:{legend:{display:false}, title:{display:true, text:'Importe por ' + $('#bGroup').selectedOptions[0].text.toLowerCase()}}}}),
              new Chart($('#ch2'), {type:'doughnut', data:{labels:Object.keys(est).map(k => ({pendiente_validacion:'Pendiente de validación', validado:'Validado', rechazado:'Rechazado'}[k] || k)), datasets:[{data:Object.values(est), backgroundColor:['#b35c00','#1e7a3c','#b3261e','#1a4fb8']}]}, options:{maintainAspectRatio:false, animation:false, plugins:{title:{display:true, text:'Gastos por estado'}}}})];
    $('#bTable').innerHTML = tableGastos(rows); VIEWS.informes.rows = rows;
  };
  $$('#view select, #view input').forEach(x => x.onchange = draw); draw();
  $('#bXls').onclick = () => exportXLSX(VIEWS.informes.rows.map(rowContable), 'informe_gastos.xlsx');
  $('#bPdf').onclick = () => window.print();
};
/* Contabilidad */
function rowContable(g){ const u = user(g.userId); return {Referencia:g.id, Fecha:g.fecha, Empleado:u.name, NIF_empleado:u.nif||'', Centro:center(u.center).name, Tipo:g.tipo, Concepto:g.concepto||'', Cuenta:S.config.accounts[g.kind]||S.config.accounts.ticket, Base:g.base ?? g.importe, Tipo_IVA:g.ivaRate ?? '', Cuota_IVA:g.ivaCuota ?? '', Total:g.importe, NIF_emisor:g.nif||'', Emisor:g.razon||'', N_factura:g.numFactura||'', NIF_receptor:g.nifReceptor||'', Estado:g.estado, Autorizacion:g.authId||''}; }
function download(name, content, type){ const b = new Blob([content], {type}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function exportXLSX(rows, name){ if (!window.XLSX) return download(name.replace('.xlsx','.csv'), toCSV(rows, ';'), 'text/csv'); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Datos'); XLSX.writeFile(wb, name); }
function toCSV(rows, sep){ if (!rows.length) return ''; const k = Object.keys(rows[0]); const q = v => { v = String(v ?? ''); return /[";,\n\t]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; }; return [k.join(sep), ...rows.map(r => k.map(x => q(r[x])).join(sep))].join('\n'); }
function toXML(rows, root, item){ return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} generado="${new Date().toISOString()}">\n` + rows.map(r => `  <${item}>` + Object.entries(r).map(([k,v]) => `<${k}>${esc(v)}</${k}>`).join('') + `</${item}>`).join('\n') + `\n</${root}>`; }
VIEWS.contabilidad = () => {
  const sets = {
    liquidaciones: () => S.gastos.filter(g => g.estado === 'validado').map(rowContable),
    anticipos: () => S.anticipos.map(a => ({Referencia:a.id, Fecha:a.fecha, Centro:center(a.center).name, Cuenta:S.config.accounts.anticipo, Importe:a.importe, Justificado:a.gastado ?? '', Liquidacion:a.liquidacion?.tipo || '', Diferencia:a.liquidacion?.diferencia ?? '', Estado:a.estado})),
    iva: () => S.gastos.filter(g => g.estado === 'validado' && g.nifReceptor && g.nifReceptor === S.config.orgNIF).map(rowContable)
  };
  const T = {liquidaciones:'Liquidaciones de gastos validados', anticipos:'Liquidaciones de anticipos de caja', iva:'Facturas para recuperación de IVA (NIF receptor = Fundación)'};
  $('#view').innerHTML = `<h1>Integración contable y financiera</h1><p class="sub">Exportación de datos contables en XLS, CSV, TXT y XML; integración por API REST y SFTP.</p>
  ${Object.keys(sets).map(k => `<div class="panel"><h2 style="margin-top:0">${T[k]} <span class="muted">(${sets[k]().length} registros)</span></h2>
   <div class="row"><button class="btn sec small" data-x="${k}" data-f="xlsx">XLS(X)</button><button class="btn sec small" data-x="${k}" data-f="csv">CSV</button><button class="btn sec small" data-x="${k}" data-f="txt">TXT</button><button class="btn sec small" data-x="${k}" data-f="xml">XML</button></div></div>`).join('')}
  <div class="panel"><h2 style="margin-top:0">API REST y SFTP (diseño de la solución definitiva)</h2>
   <p>La solución definitiva publica una API REST documentada (OpenAPI 3) y un canal SFTP programado hacia el sistema contable. Contrato propuesto:</p>
   <pre style="background:#f3f6f5;padding:12px;border-radius:8px;overflow:auto;font-size:13px">GET  /api/v1/liquidaciones?desde=2026-01-01&amp;estado=validado
GET  /api/v1/anticipos?centro=C-SEV
GET  /api/v1/facturas-iva?periodo=2026-T4
POST /api/v1/exportaciones {"formato":"xml","conjunto":"liquidaciones"}
SFTP /export/contabilidad/AAAA-MM-DD_liquidaciones.csv (diario, 02:00)</pre>
   <button class="btn sec small" id="apiDemo">Ver respuesta JSON de ejemplo (datos actuales)</button><pre id="apiOut" class="hidden" style="background:#f3f6f5;padding:12px;border-radius:8px;overflow:auto;font-size:12px;max-height:300px"></pre></div>`;
  $$('[data-x]').forEach(b => b.onclick = () => { const rows = sets[b.dataset.x](); const n = 'export_' + b.dataset.x + '_' + today(); if (!rows.length) return toast('No hay registros'); ({xlsx:() => exportXLSX(rows, n + '.xlsx'), csv:() => download(n + '.csv', '\ufeff' + toCSV(rows, ';'), 'text/csv'), txt:() => download(n + '.txt', toCSV(rows, '\t'), 'text/plain'), xml:() => download(n + '.xml', toXML(rows, b.dataset.x, 'registro'), 'application/xml')})[b.dataset.f](); log('Exportación ' + b.dataset.f.toUpperCase(), b.dataset.x); save(); });
  $('#apiDemo').onclick = () => { $('#apiOut').textContent = JSON.stringify({data:sets.liquidaciones(), meta:{total:sets.liquidaciones().length}}, null, 2); $('#apiOut').classList.remove('hidden'); };
};
/* Administración */
VIEWS.admin = () => {
  const C = S.config;
  $('#view').innerHTML = `<h1>Administración y parametrización</h1><p class="sub">La Fundación controla la aplicación sin depender del proveedor: importes, variables, tablas de dietas, usuarios, centros, roles, flujos, tipos de documento y notificaciones.</p>
  <div class="panel"><h2 style="margin-top:0">Variables generales</h2><form id="fCfg"><div class="grid3">
   <label class="f">Precio por km (€)<input type="number" step="0.01" name="kmRate" value="${C.kmRate}"></label>
   <label class="f">Umbral desviación km (%)<input type="number" name="kmDeviationPct" value="${C.kmDeviationPct}"></label>
   <label class="f">Anticipo máximo por centro (€)<input type="number" name="anticipoMax" value="${C.anticipoMax}"></label>
   <label class="f">Franja comida desde<input type="time" name="lunchFrom" value="${C.lunchFrom}"></label>
   <label class="f">Franja comida hasta<input type="time" name="lunchTo" value="${C.lunchTo}"></label>
   <label class="f">Hora límite cena<input type="time" name="dinnerFrom" value="${C.dinnerFrom}"></label>
   <label class="f">Horas mínimas media dieta<input type="number" name="minHoursHalf" value="${C.minHoursHalf}"></label>
   <label class="f">NIF de la Fundación (receptor)<input name="orgNIF" value="${esc(C.orgNIF)}"></label>
   <label class="f">Palabras prohibidas (separadas por comas)<input name="forbidden" value="${esc(C.forbidden.join(', '))}"></label>
  </div><button class="btn">Guardar variables</button></form></div>
  <div class="panel"><h2 style="margin-top:0">Tablas de dietas</h2><div class="tbl-wrap"><table><thead><tr><th>Nombre</th><th>País</th><th>Alojamiento</th><th>Manut. completa</th><th>Media</th></tr></thead><tbody>
   ${C.dietTables.map((t,i) => `<tr><td><input data-t="${i}" data-k="name" value="${esc(t.name)}"></td><td><input data-t="${i}" data-k="country" value="${t.country}" size="3"></td><td><input data-t="${i}" data-k="alojamiento" type="number" step="0.01" value="${t.alojamiento}"></td><td><input data-t="${i}" data-k="completa" type="number" step="0.01" value="${t.completa}"></td><td><input data-t="${i}" data-k="media" type="number" step="0.01" value="${t.media}"></td></tr>`).join('')}</tbody></table></div>
   <div class="row" style="margin-top:8px"><button class="btn sec small" id="addT">+ Añadir tabla</button></div></div>
  <div class="panel"><h2 style="margin-top:0">Usuarios, roles y centros</h2><div class="tbl-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Centro</th><th>Responsable</th></tr></thead><tbody>
   ${S.users.map((u,i) => `<tr><td><input data-u="${i}" data-k="name" value="${esc(u.name)}"></td><td><select data-u="${i}" data-k="role">${['empleado','responsable','validador','tesoreria','admin'].map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td><td><select data-u="${i}" data-k="center">${S.centers.map(c=>`<option value="${c.id}" ${c.id===u.center?'selected':''}>${esc(c.name)}</option>`).join('')}</select></td><td><select data-u="${i}" data-k="manager"><option value="">—</option>${S.users.filter(x=>x.role==='responsable').map(x=>`<option value="${x.id}" ${x.id===u.manager?'selected':''}>${esc(x.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
   <form id="fU" class="row" style="margin-top:8px"><input name="name" placeholder="Nombre del nuevo usuario" required style="padding:6px"><button class="btn sec small">+ Alta de usuario</button></form>
   <form id="fC" class="row" style="margin-top:8px"><input name="name" placeholder="Nuevo centro" required style="padding:6px"><input name="city" placeholder="Ciudad" required style="padding:6px"><button class="btn sec small">+ Alta de centro</button></form></div>
  <div class="panel"><h2 style="margin-top:0">Flujos de aprobación, tipos de documento y cuentas</h2>
   <div class="kv"><div>Gasto</div><div>${C.workflows.gasto.join(' → ')}</div><div>Anticipo de caja</div><div>${C.workflows.anticipo.join(' → ')}</div><div>Viaje</div><div>${C.workflows.viaje.join(' → ')}</div><div>Tipos de gasto</div><div>${C.expenseTypes.join(', ')}</div><div>Cuentas contables</div><div>${Object.entries(C.accounts).map(([k,v])=>k+': '+v).join(' · ')}</div></div></div>
  <div class="panel"><h2 style="margin-top:0">Datos</h2><div class="row"><button class="btn sec" id="exportAll">Exportar todos los datos (JSON)</button><button class="btn danger" id="reset">Restablecer datos de demostración</button></div><p class="muted">Al finalizar la licencia, todos los datos y justificantes pueden extraerse para su custodia por la Fundación.</p></div>`;
  $('#fCfg').onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries()); ['kmRate','kmDeviationPct','anticipoMax','minHoursHalf'].forEach(k => f[k] = +f[k]); f.forbidden = f.forbidden.split(',').map(s => s.trim().toLowerCase()).filter(Boolean); Object.assign(S.config, f); log('Variables modificadas', 'config'); save(); toast('Variables guardadas'); };
  $$('[data-t]').forEach(i => i.onchange = () => { const t = S.config.dietTables[+i.dataset.t]; t[i.dataset.k] = i.type === 'number' ? +i.value : i.value; save(); toast('Tabla actualizada'); });
  $$('[data-u]').forEach(i => i.onchange = () => { S.users[+i.dataset.u][i.dataset.k] = i.value || null; save(); toast('Usuario actualizado'); renderNav(); });
  $('#addT').onclick = () => { S.config.dietTables.push({id:uid('T'), name:'Nueva tabla', country:'XX', alojamiento:0, completa:0, media:0}); save(); route(); };
  $('#fU').onsubmit = e => { e.preventDefault(); S.users.push({id:uid('U'), name:e.target.elements.name.value, role:'empleado', center:S.centers[0].id, manager:'U2'}); save(); route(); };
  $('#fC').onsubmit = e => { e.preventDefault(); S.centers.push({id:uid('C'), name:e.target.elements.name.value, city:e.target.elements.city.value, lat:37.4, lon:-4.6}); save(); route(); };
  $('#exportAll').onclick = () => download('datos_completos_' + today() + '.json', JSON.stringify(S, null, 2), 'application/json');
  $('#reset').onclick = () => { if (confirm('¿Restablecer los datos de demostración?')) { localStorage.removeItem(LS_KEY); S = seed(); save(); location.hash = '#inicio'; route(); } };
};
VIEWS.acerca = () => {
  $('#view').innerHTML = `<h1>Acerca de este prototipo</h1>
  <div class="panel"><p>Prototipo funcional presentado por <strong>Sami Halawa Ribas</strong> (NIF 02558168Q) para el expediente <strong>2026/090</strong> de Andalucía Emprende, Fundación Pública Andaluza M.P.: <em>Servicios para el desarrollo e implantación de un sistema de gestión de gastos de dietas, kilómetros y anticipos de caja</em>.</p>
  <p>Demuestra los requisitos del Pliego de Prescripciones Técnicas: autorización previa obligatoria, captura de justificantes con foto, escáner o adjunto y OCR/ICR, verificación manual de datos fiscales, anticipos de caja con control de anticipos pendientes y liquidaciones negativas, gestión de viajes, cálculo automático de dietas y de distancias con mapas, auditoría, integración contable (XLS, CSV, TXT, XML; diseño API REST/SFTP), cuadro de mando, parametrización y diseño 100 % responsive (instalable como aplicación web).</p>
  <ul><li><strong>Todos los datos son ficticios</strong> y se guardan únicamente en el almacenamiento local de este navegador.</li>
  <li>El OCR se ejecuta localmente en el navegador (Tesseract.js); las imágenes no se envían a ningún servidor.</li>
  <li>Mapas y rutas: OpenStreetMap / OSRM (servicios públicos de demostración). En producción se usará el servicio de mapas que determine la Fundación.</li>
  <li>Use el selector de la barra superior para actuar como empleada, responsable, validadora, tesorería o administrador.</li></ul>
  <p>Contacto: <a href="mailto:sami@samihalawa.com">sami@samihalawa.com</a> · <a href="https://samihalawa.com">samihalawa.com</a></p></div>
  <div class="panel"><h2 style="margin-top:0">Guion de demostración (5 minutos)</h2><ol>
   <li>Como <em>Ana (empleada)</em>: Autorización previa → enviar solicitud.</li>
   <li>Cambiar a <em>Luis (responsable)</em>: aprobar la solicitud (o denegarla y comprobar que Ana no puede registrar gastos con ella).</li>
   <li>Como Ana: Nuevo gasto (OCR) → «Probar con tique de ejemplo» → revisar campos extraídos → enviar a validación.</li>
   <li>Dietas y kilometraje: calcular ruta Sevilla–Córdoba, declarar más km de los calculados y ver la alerta.</li>
   <li>Como <em>Elena (validadora)</em>: Validación → lista de comprobación fiscal → validar.</li>
   <li>Como <em>Pedro (empleado, Málaga)</em>: Anticipos → comprobar el bloqueo por anticipo pendiente → liquidar con más gasto que anticipo (liquidación negativa automática).</li>
   <li>Como <em>Marta (tesorería)</em>: Panel de tesorería, Integración contable (exportar XML/CSV/XLSX) y Cuadro de mando.</li></ol></div>`;
};
function renderNotifs(){
  const list = S.notifs.filter(n => n.userId === S.current);
  $('#notifPanel').innerHTML = `<div class="row" style="justify-content:space-between;padding:4px 8px"><strong>Notificaciones</strong><button class="btn small sec" id="markAll">Marcar leídas</button></div>` + (list.map(n => `<div class="n ${n.read?'':'unread'}">${esc(n.text)}<br><span class="muted" style="font-size:12px">${new Date(n.t).toLocaleString('es-ES')}</span></div>`).join('') || '<div class="n muted">Sin notificaciones</div>');
  $('#markAll').onclick = () => { list.forEach(n => n.read = true); save(); renderNotifs(); renderNav(); };
}
$('#roleSel').onchange = e => { S.current = e.target.value; save(); toast('Ahora actúa como ' + me().name); route(); };
$('#menuBtn').onclick = () => $('#sidenav').classList.toggle('open');
$('#notifBtn').onclick = () => { $('#notifPanel').classList.toggle('hidden'); renderNotifs(); };
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
save(); route();
