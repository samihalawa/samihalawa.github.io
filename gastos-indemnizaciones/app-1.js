/* Prototipo funcional · Sistema de gestión de indemnizaciones por razón del servicio y anticipos de caja
   Expediente 2026/090 · Datos ficticios · Todo el estado se guarda en localStorage de este navegador. */
'use strict';
const LS_KEY = 'ae2026090_demo_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = n => (Number(n) || 0).toLocaleString('es-ES', {style:'currency', currency:'EUR'});
const uid = p => p + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);
const fmtD = d => d ? new Date(d + (d.length === 10 ? 'T00:00' : '')).toLocaleDateString('es-ES') : '';
function offset(d){const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);}

/* Validación NIF/NIE/CIF */
function validNIF(v) {
  v = String(v || '').toUpperCase().replace(/[\s\-.]/g, '');
  const L = 'TRWAGMYFPDXBNJZSQVHLCKE';
  if (/^\d{8}[A-Z]$/.test(v)) return L[+v.slice(0, 8) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) return L[+(('XYZ'.indexOf(v[0])) + v.slice(1, 8)) % 23] === v[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const d = v.slice(1, 8); let a = 0, b = 0;
    for (let i = 0; i < 7; i++) { const n = +d[i]; if (i % 2) a += n; else { const x = n * 2; b += Math.floor(x / 10) + x % 10; } }
    const c = (10 - ((a + b) % 10)) % 10; const ctl = v[8];
    return ctl === String(c) || ctl === 'JABCDEFGHI'[c];
  }
  return false;
}

/* Datos demo */
function seed() {
  const centers = [
    {id:'C-SEV', name:'CADE Sevilla (demo)', city:'Sevilla', lat:37.3891, lon:-5.9845},
    {id:'C-MAL', name:'CADE Málaga (demo)', city:'Málaga', lat:36.7213, lon:-4.4214},
    {id:'C-GRA', name:'CADE Granada (demo)', city:'Granada', lat:37.1773, lon:-3.5986},
    {id:'C-COR', name:'CADE Córdoba (demo)', city:'Córdoba', lat:37.8882, lon:-4.7794},
    {id:'C-ALM', name:'CADE Almería (demo)', city:'Almería', lat:36.8340, lon:-2.4637},
    {id:'SSCC', name:'Servicios Centrales (demo)', city:'Sevilla', lat:37.3826, lon:-5.9963}
  ];
  const users = [
    {id:'U1', name:'Ana Ruiz (empleada)', role:'empleado', center:'C-SEV', manager:'U2', nif:'00000000T'},
    {id:'U5', name:'Pedro Gil (empleado)', role:'empleado', center:'C-MAL', manager:'U2', nif:'00000001R'},
    {id:'U2', name:'Luis Moreno (responsable)', role:'responsable', center:'C-SEV', manager:null},
    {id:'U3', name:'Marta León (tesorería)', role:'tesoreria', center:'SSCC', manager:null},
    {id:'U6', name:'Elena Sanz (validadora)', role:'validador', center:'SSCC', manager:null},
    {id:'U4', name:'Admin. del sistema', role:'admin', center:'SSCC', manager:null}
  ];
  const config = {
    orgName:'Fundación (demo)', orgNIF:'G00000000', kmRate:0.26, kmDeviationPct:15,
    lunchFrom:'14:00', lunchTo:'16:00', dinnerFrom:'21:00', minHoursHalf:5,
    anticipoMax:600, forbidden:['alcohol','tabaco','regalo','propina','minibar'],
    dietTables:[
      {id:'T-ES', name:'Tabla demo · Territorio nacional', country:'ES', alojamiento:65.00, completa:40.00, media:20.00},
      {id:'T-PT', name:'Tabla demo · Portugal', country:'PT', alojamiento:90.00, completa:55.00, media:27.50},
      {id:'T-FR', name:'Tabla demo · Francia', country:'FR', alojamiento:120.00, completa:70.00, media:35.00},
      {id:'T-BE', name:'Tabla demo · Bélgica (Bruselas)', country:'BE', alojamiento:130.00, completa:75.00, media:37.50}
    ],
    accounts:{ticket:'629000', km:'629100', dieta:'629200', alojamiento:'629300', viaje:'629400', anticipo:'555000'},
    expenseTypes:['Manutención','Alojamiento','Transporte público','Taxi','Aparcamiento','Peaje','Material de oficina','Pequeña reparación','Otros'],
    workflows:{gasto:['responsable','validador'], anticipo:['responsable','tesoreria'], viaje:['responsable']}
  };
  const a1 = {id:'AUT-0001', userId:'U1', motivo:'Jornada de asesoramiento a emprendedores', origen:'C-SEV', destino:'Córdoba', country:'ES', fIni:offset(-6), hIni:'08:00', fFin:offset(-6), hFin:'18:30', pernocta:false, transporte:'Vehículo propio', kmPrev:280, alojamiento:false, estimado:95, estado:'aprobada', approver:'U2', history:[{t:offset(-8), who:'U1', what:'Solicitada'},{t:offset(-7), who:'U2', what:'Aprobada'}]};
  const a2 = {id:'AUT-0002', userId:'U1', motivo:'Reunión de coordinación y feria de emprendimiento', origen:'C-SEV', destino:'Málaga', country:'ES', fIni:offset(3), hIni:'07:30', fFin:offset(4), hFin:'19:00', pernocta:true, transporte:'Tren', kmPrev:0, alojamiento:true, estimado:260, estado:'pendiente', approver:null, history:[{t:offset(-1), who:'U1', what:'Solicitada'}]};
  const a3 = {id:'AUT-0003', userId:'U5', motivo:'Visita a centro (denegada por agenda)', origen:'C-MAL', destino:'Granada', country:'ES', fIni:offset(-2), hIni:'09:00', fFin:offset(-2), hFin:'14:00', pernocta:false, transporte:'Vehículo propio', kmPrev:260, alojamiento:false, estimado:70, estado:'denegada', approver:'U2', history:[{t:offset(-4), who:'U5', what:'Solicitada'},{t:offset(-3), who:'U2', what:'Denegada: no procede'}]};
  const gastos = [
    {id:'GTO-0001', userId:'U1', authId:'AUT-0001', kind:'km', tipo:'Kilometraje', fecha:offset(-6), km:340, kmRuta:279, importe:+(340*0.26).toFixed(2), concepto:'Sevilla → Córdoba → Sevilla', estado:'pendiente_validacion', alerts:[], history:[{t:offset(-5), who:'U1', what:'Registrado'}]},
    {id:'GTO-0002', userId:'U1', authId:'AUT-0001', kind:'ticket', tipo:'Aparcamiento', fecha:offset(-6), importe:8.40, base:6.94, ivaRate:21, ivaCuota:1.46, nif:'B12345674', razon:'APARCAMIENTO DEMO CENTRO S.L.', direccion:'Calle Ejemplo 1, Córdoba', numFactura:'T-001234', nifReceptor:'', concepto:'Aparcamiento', estado:'validado', alerts:[], history:[{t:offset(-5), who:'U1', what:'Registrado'},{t:offset(-4), who:'U6', what:'Validado'}]},
    {id:'GTO-0003', userId:'U1', authId:'AUT-0001', kind:'dieta', tipo:'Dieta', fecha:offset(-6), importe:20.00, concepto:'Media manutención (comisión 08:00–18:30)', estado:'validado', alerts:[], history:[{t:offset(-5), who:'U1', what:'Calculada automáticamente'}]}
  ];
  const viajes = [
    {id:'VJ-0001', userId:'U1', authId:'AUT-0002', destino:'Málaga', fIni:offset(3), fFin:offset(4), hotel:{pedido:true, noches:1, coste:85, estado:'pendiente'}, coche:{pedido:false, coste:0, estado:'—'}, transporte:{tipo:'Tren', coste:62}, estado:'solicitado', incidencias:[]}
  ];
  const anticipos = [
    {id:'ANT-0001', center:'C-MAL', userId:'U5', importe:300, motivo:'Material de oficina y pequeñas reparaciones (trimestre)', fecha:offset(-20), estado:'pagado', gastado:null, history:[{t:offset(-20), who:'U5', what:'Solicitado'},{t:offset(-19), who:'U2', what:'Aprobado'},{t:offset(-18), who:'U3', what:'Pagado'}]},
    {id:'ANT-0002', center:'C-GRA', userId:'U2', importe:200, motivo:'Compras menores', fecha:offset(-40), estado:'liquidado', gastado:236.50, liquidacion:{tipo:'negativa', diferencia:36.50, estado:'reintegrada'}, history:[{t:offset(-40), who:'U2', what:'Solicitado'},{t:offset(-10), who:'U3', what:'Liquidación negativa: se reintegran 36,50 €'}]}
  ];
  return {config, centers, users, autorizaciones:[a1,a2,a3], gastos, viajes, anticipos, notifs:[{id:uid('N'), userId:'U2', text:'AUT-0002: nueva solicitud de autorización previa de Ana Ruiz', t:new Date().toISOString(), read:false}], audit:[], seq:{AUT:3, GTO:3, VJ:1, ANT:2}, current:'U1'};
}

let S = load();
function load(){ try{ const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.config) return s; }catch(e){} return seed(); }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
function next(p){ S.seq[p] = (S.seq[p]||0)+1; return p + '-' + String(S.seq[p]).padStart(4,'0'); }
const me = () => S.users.find(u => u.id === S.current);
const user = id => S.users.find(u => u.id === id) || {name:'—'};
const center = id => S.centers.find(c => c.id === id) || {name:id||'—'};
function log(what, ref){ S.audit.unshift({t:new Date().toISOString(), who:S.current, what, ref}); }
function notify(userIdOrRole, text){
  S.users.filter(u => u.id === userIdOrRole || u.role === userIdOrRole).forEach(u => S.notifs.unshift({id:uid('N'), userId:u.id, text, t:new Date().toISOString(), read:false}));
}
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add('hidden'),3200); }
const stBadge = s => {
  const map = {pendiente:['pend','Pendiente'], aprobada:['ok','Aprobada'], denegada:['ko','Denegada'], pendiente_validacion:['pend','Pendiente de validación'], validado:['ok','Validado'], rechazado:['ko','Rechazado'], solicitado:['pend','Solicitado'], aprobado:['ok','Aprobado'], pagado:['info','Pagado · pendiente de liquidar'], liquidado:['ok','Liquidado'], cancelado:['ko','Cancelado'], incidencia:['pend','Incidencia'], cerrado:['ok','Cerrado']};
  const [c,l] = map[s] || ['info', s]; return `<span class="st ${c}">${esc(l)}</span>`;
};
/* Navegación */
const ROUTES = [
  {sec:'General'},
  {id:'inicio', ico:'🏠', t:'Inicio'},
  {id:'autorizaciones', ico:'✅', t:'Autorización previa'},
  {id:'gastos', ico:'🧾', t:'Mis gastos'},
  {id:'nuevo', ico:'📷', t:'Nuevo gasto (OCR)'},
  {id:'dietas', ico:'🍽️', t:'Dietas y kilometraje'},
  {id:'viajes', ico:'🧳', t:'Viajes'},
  {id:'anticipos', ico:'💶', t:'Anticipos de caja'},
  {sec:'Gestión'},
  {id:'validacion', ico:'🔎', t:'Validación', roles:['validador','responsable','admin']},
  {id:'tesoreria', ico:'🏦', t:'Panel de tesorería', roles:['tesoreria','admin']},
  {id:'auditoria', ico:'🚩', t:'Auditoría y alertas', roles:['validador','tesoreria','admin','responsable']},
  {id:'informes', ico:'📊', t:'Cuadro de mando BI', roles:['tesoreria','admin','responsable','validador']},
  {id:'contabilidad', ico:'📤', t:'Integración contable', roles:['tesoreria','admin']},
  {id:'admin', ico:'⚙️', t:'Administración', roles:['admin']},
  {sec:'Información'},
  {id:'acerca', ico:'ℹ️', t:'Acerca del prototipo'}
];
function renderNav(){
  const r = me().role, cur = (location.hash||'#inicio').slice(1).split('/')[0];
  $('#sidenav').innerHTML = ROUTES.map(x => x.sec ? `<div class="sec">${x.sec}</div>` : (!x.roles || x.roles.includes(r)) ? `<a href="#${x.id}" class="${cur===x.id?'active':''}"><span>${x.ico}</span>${x.t}</a>` : '').join('');
  $('#roleSel').innerHTML = S.users.map(u => `<option value="${u.id}" ${u.id===S.current?'selected':''}>${esc(u.name)} · ${esc(center(u.center).city||'')}</option>`).join('');
  const n = S.notifs.filter(x => x.userId === S.current && !x.read).length;
  $('#notifCount').textContent = n; $('#notifCount').classList.toggle('hidden', !n);
}
function route(){
  const [id, arg] = (location.hash||'#inicio').slice(1).split('/');
  const r = ROUTES.find(x => x.id === id) || ROUTES[1];
  if (r.roles && !r.roles.includes(me().role)) { renderNav(); $('#view').innerHTML = `<h1>Acceso restringido</h1><p class="sub">Su rol (${me().role}) no tiene permiso para esta sección. Cambie de usuario en la barra superior.</p>`; return; }
  renderNav(); $('#sidenav').classList.remove('open');
  (VIEWS[r.id] || VIEWS.inicio)(arg); $('#view').focus({preventScroll:true}); window.scrollTo(0,0);
}
const VIEWS = {};
VIEWS.inicio = () => {
  const u = me(), mine = S.gastos.filter(g => g.userId === u.id);
  const pendVal = S.gastos.filter(g => g.estado === 'pendiente_validacion').length;
  const pendAut = S.autorizaciones.filter(a => a.estado === 'pendiente').length;
  const antAbiertos = S.anticipos.filter(a => ['solicitado','aprobado','pagado'].includes(a.estado)).length;
  $('#view').innerHTML = `
  <h1>Hola, ${esc(u.name.split(' (')[0])}</h1><p class="sub">${esc(center(u.center).name)} · rol: <strong>${esc(u.role)}</strong></p>
  <div class="cards">
    <div class="card"><div class="k">Mis gastos registrados</div><div class="v">${eur(mine.reduce((s,g)=>s+g.importe,0))}</div></div>
    <div class="card"><div class="k">Autorizaciones pendientes</div><div class="v">${pendAut}</div></div>
    <div class="card"><div class="k">Gastos pendientes de validar</div><div class="v">${pendVal}</div></div>
    <div class="card"><div class="k">Anticipos abiertos</div><div class="v">${antAbiertos}</div></div>
  </div>
  <div class="panel"><h2 style="margin-top:0">Flujo del sistema</h2>
   <ol>
    <li><strong>Autorización previa</strong> de la comisión de servicio (sustituye al formulario Excel). Sin autorización aprobada no se puede registrar el gasto.</li>
    <li><strong>Registro del gasto</strong>: foto, escaneo o adjunto del tique/factura → <strong>OCR/ICR</strong> extrae importe, fecha, NIF, razón social, dirección, nº de factura e IVA.</li>
    <li><strong>Dietas y kilometraje automáticos</strong> según país, franjas horarias, pernoctaciones y distancia calculada con mapas.</li>
    <li><strong>Verificación manual</strong> de los campos fiscales por el validador antes de que el gasto entre en el sistema.</li>
    <li><strong>Liquidación, anticipos de caja, auditoría, contabilidad y cuadro de mando</strong>.</li>
   </ol>
   <div class="row"><a class="btn" href="#autorizaciones">Solicitar autorización previa</a><a class="btn sec" href="#nuevo">Registrar gasto con foto</a><a class="btn sec" href="#dietas">Calcular dieta / km</a></div>
  </div>`;
};
