/* Solar Load Calculator - logic */
(function(){
  var KEY = 'solar-load-calc-v1';
  var STD_VA = [500,1000,1500,2000,2500,3000,3500,5000,7500,10000];
  var STD_A = [10,20,30,40,50,60,80,100,150];
  var COLORS = ['#FFB400','#FF5A3C','#12B886','#2F7BFF','#9B5DE5','#00B8D9','#F15BB5','#8AC926'];
  var uid = 0;
  var $ = function(s){ return document.querySelector(s); };
  var nf = function(d){ return new Intl.NumberFormat('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}); };
  var F0 = nf(0), F1 = nf(1), F2 = nf(2);
  var f0 = function(n){ return F0.format(n); }, f1 = function(n){ return F1.format(n); }, f2 = function(n){ return F2.format(n); };
  var num = function(v,d,min,max){
    var x = parseFloat(v);
    if(!isFinite(x)) return d;
    return Math.min(Math.max(x,min),max);
  };
  var colorOf = function(id){ return COLORS[(Number(id) - 1) % COLORS.length]; };
  var mk = function(n,q,w,h,m){ return {id:++uid,name:n,qty:q,w:w,h:h,motor:!!m}; };

  var IC = {
    panel:'<svg class="ti" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M3 21 8 7h21l-5 14z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 7 10.5 21M18 7l-1 14M23.5 7l-2 14M5.5 14h21" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M14 21v6M9 27h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    ctrl:'<svg class="ti" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="4" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8"/><path d="M17.5 9l-6 9h4.5l-1.5 6 6.5-9.5h-4.5z" fill="currentColor"/></svg>',
    batt:'<svg class="ti" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect x="3" y="9" width="22" height="14" rx="3" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8"/><path d="M28 14v4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M8 13v6M13 13v6M18 13v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    inv:'<svg class="ti" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect x="3" y="6" width="26" height="20" rx="4" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8"/><path d="M7 16c2-7 4-7 6 0s4 7 6 0 3-4 6-1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
  };

  var PRESETS = {
    hostel:{label:'Hostel room',rows:[
      ['LED bulb',3,9,6,0],['Ceiling fan',1,60,8,1],['Phone charger',2,10,3,0],['Laptop',1,65,5,0],
      ['TV (32 in)',1,50,4,0],['Mini fridge',1,90,8,1],['Wi-Fi router',1,12,24,0]]},
    flat:{label:'Two-bedroom flat',rows:[
      ['LED bulb',10,9,6,0],['Ceiling fan',3,60,8,1],['TV (43 in)',1,80,6,0],['Decoder',1,25,6,0],
      ['Refrigerator',1,150,10,1],['Laptop',2,65,5,0],['Phone charger',4,10,3,0],['Wi-Fi router',1,12,24,0],
      ['Water pump',1,750,0.5,1],['Pressing iron',1,1000,0.5,0]]},
    shop:{label:'Small shop',rows:[
      ['LED bulb',4,9,10,0],['Chest freezer',1,200,12,1],['Standing fan',1,60,10,1],['POS charger',1,10,10,0],
      ['Phone charger',2,10,4,0],['Wi-Fi router',1,12,24,0],['Sound system',1,40,6,0]]}
  };

  var S0 = {psh:5,pr:75,eff:90,dod:50,days:1,batAh:200,panelW:400,sim:100,volt:'auto'};
  var S = Object.assign({},S0);
  var rows = [];
  var example = '';

  function loadPreset(k){
    rows = PRESETS[k].rows.map(function(r){ return mk(r[0],r[1],r[2],r[3],r[4]); });
    example = PRESETS[k].label;
  }

  function restore(){
    try{
      var j = JSON.parse(localStorage.getItem(KEY));
      if(j && Array.isArray(j.rows) && j.S){
        rows = j.rows.slice(0,40).map(function(r){
          return mk(String(r.name||'').slice(0,40), r.qty, r.w, r.h, r.motor);
        });
        Object.keys(S0).forEach(function(k){ if(j.S[k] !== undefined) S[k] = j.S[k]; });
        return true;
      }
    }catch(e){}
    return false;
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify({rows:rows,S:S})); }catch(e){}
  }

  /* ---------- calculation ---------- */
  function pick(arr,x){
    for(var i=0;i<arr.length;i++){ if(arr[i] >= x) return arr[i]; }
    return null;
  }
  function calc(){
    var items = rows.map(function(r){
      var q = num(r.qty,0,0,999), w = num(r.w,0,0,20000), h = num(r.h,0,0,24);
      return {id:r.id,name:r.name,q:q,w:w,h:h,motor:!!r.motor,P:q*w,E:q*w*h};
    });
    var P = 0, E = 0;
    items.forEach(function(i){ P += i.P; E += i.E; });
    var c = {items:items,P:P,E:E};
    c.psh = num(S.psh,5,0.5,10);
    c.pr = num(S.pr,75,10,100)/100;
    c.eff = num(S.eff,90,50,100)/100;
    c.dod = num(S.dod,50,10,100)/100;
    c.days = num(S.days,1,0.5,10);
    c.batAh = num(S.batAh,200,10,2000);
    c.panelW = num(S.panelW,400,50,1000);
    c.sim = num(S.sim,100,10,100)/100;
    c.ok = E > 0;
    if(!c.ok) return c;

    c.Esys = E / c.eff;
    c.Parr = c.Esys / (c.psh * c.pr);
    c.nPan = Math.max(1, Math.ceil(c.Parr / c.panelW - 1e-9));
    c.Pinst = c.nPan * c.panelW;

    c.Prun = P * c.sim;
    c.maxMotor = 0;
    items.forEach(function(i){ if(i.motor && i.q > 0 && i.w > c.maxMotor) c.maxMotor = i.w; });
    c.Wreq = c.Prun * 1.25;
    c.VAcont = c.Wreq / 0.8;
    c.VAsurge = (c.Prun + 2 * c.maxMotor) / 1.6;
    c.VAreq = Math.max(c.VAcont, c.VAsurge);
    c.VAstd = pick(STD_VA, c.VAreq) || Math.ceil(c.VAreq / 1000) * 1000;
    c.Vauto = c.VAstd <= 1000 ? 12 : (c.VAstd <= 3000 ? 24 : 48);
    c.V = S.volt === 'auto' ? c.Vauto : num(S.volt,c.Vauto,12,48);

    c.Cwh = c.Esys * c.days / c.dod;
    c.Cah = c.Cwh / c.V;
    c.series = Math.max(1, Math.round(c.V / 12));
    c.parallel = Math.max(1, Math.ceil(c.Cah / c.batAh - 1e-9));
    c.bats = c.series * c.parallel;

    c.Ic = c.Pinst / c.V * 1.25;
    c.IcStd = pick(STD_A, c.Ic) || Math.ceil(c.Ic / 50) * 50;
    c.Ibat = c.Prun / (c.V * c.eff);
    return c;
  }
  function vaLabel(va){ return va >= 1000 ? (va / 1000) + ' kVA' : va + ' VA'; }

  /* ---------- rows ---------- */
  function rowHTML(r){
    var id = 'r' + r.id;
    return '' +
      '<div class="f f-name"><label class="lbl" for="'+id+'-n">Appliance</label><span class="dot"></span><input id="'+id+'-n" type="text" maxlength="40" data-k="name" autocomplete="off"></div>' +
      '<div class="f f-qty"><label class="lbl" for="'+id+'-q">Qty</label><input id="'+id+'-q" type="number" inputmode="numeric" min="0" step="1" data-k="qty"></div>' +
      '<div class="f f-w"><label class="lbl" for="'+id+'-w">Watts</label><input id="'+id+'-w" type="number" inputmode="decimal" min="0" step="1" data-k="w"></div>' +
      '<div class="f f-h"><label class="lbl" for="'+id+'-h">Hours per day</label><input id="'+id+'-h" type="number" inputmode="decimal" min="0" max="24" step="0.5" data-k="h"></div>' +
      '<label class="f-m" title="Fans, fridges, freezers and pumps need extra current to start"><input id="'+id+'-m" type="checkbox" data-k="motor"><span>Motor</span></label>' +
      '<div class="wh"><output></output><small>Wh/day</small></div>' +
      '<button class="rm" type="button" data-rm="1">&times;</button>' +
      '<div class="share"><i></i></div>';
  }
  function buildRows(){
    var box = $('#rows');
    box.innerHTML = '';
    rows.forEach(function(r){
      var d = document.createElement('div');
      d.className = 'row';
      d.dataset.id = r.id;
      d.innerHTML = rowHTML(r);
      d.querySelector('[data-k="name"]').value = r.name;
      d.querySelector('[data-k="qty"]').value = r.qty;
      d.querySelector('[data-k="w"]').value = r.w;
      d.querySelector('[data-k="h"]').value = r.h;
      d.querySelector('[data-k="motor"]').checked = !!r.motor;
      d.querySelector('.dot').style.background = colorOf(r.id);
      d.querySelector('.share i').style.background = colorOf(r.id);
      d.querySelector('.rm').setAttribute('aria-label','Remove ' + (r.name || 'appliance'));
      box.appendChild(d);
    });
  }

  /* ---------- rendering ---------- */
  function L(f,s,r){
    return '<div class="calc"><p class="fx">'+f+'</p><p class="sb">= '+(s ? s+' = ' : '')+'<b>'+r+'</b></p></div>';
  }
  function step(n,cls,title,body){
    return '<li class="step '+cls+'"><span class="b">'+n+'</span><h3>'+title+'</h3>'+body+'</li>';
  }
  function why(t){ return '<p class="why">'+t+'</p>'; }
  function tile(cls,icon,label,val,sub){
    return '<div class="tile '+cls+'">'+IC[icon]+'<div class="tl">'+label+'</div><div class="tv">'+val+'</div><div class="ts">'+sub+'</div></div>';
  }

  function renderKpi(c){
    $('#kpi').innerHTML =
      '<div><div class="k">Daily energy</div><div class="v">'+f2(c.E/1000)+'<small>kWh</small></div></div>' +
      '<div><div class="k">Connected load</div><div class="v">'+f0(c.P)+'<small>W</small></div></div>';
  }

  function renderSummary(c){
    var box = $('#summary');
    if(!c.ok){
      box.innerHTML = '<p class="empty">Add at least one appliance with watts and hours per day. The recommended system appears here.</p>';
      return;
    }
    var notes = [];
    if(c.Ibat > 150) notes.push('At '+c.V+' V this inverter pulls about '+f0(c.Ibat)+' A from the batteries. Pick a higher system voltage to keep cable size and heat down.');
    if(c.maxMotor > 0 && c.VAsurge > c.VAcont) notes.push('Motor start-up sets the inverter size here, not the running load.');
    var h = '<div class="tiles">';
    h += tile('sun-c','panel','Solar panels', c.nPan+' &times; '+f0(c.panelW)+' W', 'Array needs '+f0(c.Parr)+' W. '+c.nPan+' panels give '+f0(c.Pinst)+' W.');
    h += tile('coral-c','ctrl','Charge controller', c.IcStd+' A MPPT', 'Calculated '+f1(c.Ic)+' A at '+c.V+' V.');
    h += tile('leaf-c','batt','Batteries', c.bats+' &times; 12 V '+f0(c.batAh)+' Ah', c.series+' in series, '+c.parallel+' in parallel. Bank needs '+f0(c.Cah)+' Ah at '+c.V+' V ('+f1(c.Cwh/1000)+' kWh).');
    h += tile('sky-c','inv','Inverter', vaLabel(c.VAstd)+', '+c.V+' V', 'Needs '+f0(c.VAreq)+' VA, rounded up to a standard size.');
    h += '</div>';
    h += '<p class="flow">Listed in power-flow order: sun, panels, controller, batteries, inverter, loads.</p>';
    if(notes.length) h += '<div class="notes">'+notes.map(function(n){ return '<p class="note">'+n+'</p>'; }).join('')+'</div>';
    box.innerHTML = h;
  }

  function renderSteps(c){
    var ol = $('#steps');
    if(!c.ok){ ol.innerHTML = '<li class="empty">The steps appear once you add an appliance.</li>'; return; }
    var s = '';
    s += step(1,'plum-c','Connected load',
      L('P = &Sigma; (qty &times; watts)','',f0(c.P)+' W') +
      why('This is the power drawn if every appliance ran at the same moment.'));
    s += step(2,'plum-c','Daily energy used',
      L('E<sub>load</sub> = &Sigma; (qty &times; watts &times; hours)','',f0(c.E)+' Wh/day') +
      why('That is '+f2(c.E/1000)+' kWh each day. The coloured bar above the list shows each appliance\'s share.'));
    s += step(3,'plum-c','Energy the system must supply',
      L('E<sub>sys</sub> = E<sub>load</sub> &divide; &eta;<sub>inv</sub>', f0(c.E)+' &divide; '+f2(c.eff), f0(c.Esys)+' Wh/day') +
      why('The inverter wastes some energy as heat, so the panels and batteries must supply more than the appliances use.'));
    s += step(4,'sun-c','Solar array size',
      L('P<sub>array</sub> = E<sub>sys</sub> &divide; (PSH &times; PR)', f0(c.Esys)+' &divide; ('+f1(c.psh)+' &times; '+f2(c.pr)+')', f0(c.Parr)+' W') +
      L('Panels = P<sub>array</sub> &divide; panel rating, rounded up', f0(c.Parr)+' &divide; '+f0(c.panelW)+' = '+f2(c.Parr/c.panelW), c.nPan+' panels ('+f0(c.Pinst)+' W)') +
      why('PSH is the number of hours per day the sun delivers 1,000 W per square metre. PR covers heat, dust and cable losses.'));
    s += step(5,'sky-c','Inverter and system voltage',
      L('P<sub>run</sub> = P &times; share running together', f0(c.P)+' &times; '+f2(c.sim), f0(c.Prun)+' W') +
      L('P<sub>inv</sub> = P<sub>run</sub> &times; 1.25', f0(c.Prun)+' &times; 1.25', f0(c.Wreq)+' W') +
      L('S = P<sub>inv</sub> &divide; power factor', f0(c.Wreq)+' &divide; 0.8', f0(c.VAcont)+' VA') +
      L('S<sub>start</sub> = (P<sub>run</sub> + 2 &times; largest motor) &divide; (2 &times; 0.8)', '('+f0(c.Prun)+' + 2 &times; '+f0(c.maxMotor)+') &divide; 1.6', f0(c.VAsurge)+' VA') +
      L('Standard size at or above the larger of S and S<sub>start</sub>','',vaLabel(c.VAstd)) +
      L('System voltage','',c.V+' V') +
      why('The 1.25 factor leaves 25% headroom. Motors pull about three times their rated power for a moment, and most inverters can deliver twice their rating briefly. Up to 1 kVA uses 12 V, up to 3 kVA uses 24 V, above that 48 V. Higher voltage means lower current and thinner cables.'));
    s += step(6,'leaf-c','Battery bank',
      L('C = E<sub>sys</sub> &times; days &divide; DoD', f0(c.Esys)+' &times; '+f1(c.days)+' &divide; '+f2(c.dod), f0(c.Cwh)+' Wh') +
      L('C<sub>Ah</sub> = C &divide; V<sub>sys</sub>', f0(c.Cwh)+' &divide; '+c.V, f0(c.Cah)+' Ah') +
      L('Series = V<sub>sys</sub> &divide; 12', c.V+' &divide; 12', c.series) +
      L('Parallel strings = C<sub>Ah</sub> &divide; battery Ah, rounded up', f0(c.Cah)+' &divide; '+f0(c.batAh), c.parallel) +
      L('Batteries = series &times; parallel', c.series+' &times; '+c.parallel, c.bats+' &times; 12 V '+f0(c.batAh)+' Ah') +
      why('Depth of discharge (DoD) is how much of the battery you may use. Lead-acid lasts longer at 50%, lithium handles 80%.'));
    s += step(7,'coral-c','Charge controller',
      L('I = P<sub>installed</sub> &divide; V<sub>sys</sub> &times; 1.25', f0(c.Pinst)+' &divide; '+c.V+' &times; 1.25', f1(c.Ic)+' A') +
      L('Standard size at or above I','',c.IcStd+' A') +
      why('The 1.25 margin covers panels that briefly produce more than their rating in strong sun.'));
    ol.innerHTML = s;
  }

  function renderLive(c){
    var box = $('#live');
    if(!c.ok){ box.innerHTML = '<span><i style="--k:#FFB400"></i>Add an appliance to begin</span>'; return; }
    box.innerHTML =
      '<span><i style="--k:#FFB400"></i>'+c.nPan+' &times; '+f0(c.panelW)+' W panels</span>' +
      '<span><i style="--k:#E8452A"></i>'+c.IcStd+' A controller</span>' +
      '<span><i style="--k:#12B886"></i>'+c.bats+' batteries</span>' +
      '<span><i style="--k:#2F7BFF"></i>'+vaLabel(c.VAstd)+' inverter</span>';
  }

  function renderStack(c){
    var st = $('#stack');
    st.innerHTML = '';
    if(!c.ok) return;
    c.items.forEach(function(it){
      if(it.E <= 0) return;
      var seg = document.createElement('i');
      seg.style.width = (it.E / c.E * 100) + '%';
      seg.style.background = colorOf(it.id);
      seg.setAttribute('title', (it.name || 'Appliance') + ': ' + f0(it.E) + ' Wh/day');
      st.appendChild(seg);
    });
  }

  function summaryText(c){
    if(!c.ok) return 'No appliances added yet.';
    return [
      'Solar load calculation',
      'Connected load: '+f0(c.P)+' W',
      'Daily energy: '+f0(c.E)+' Wh ('+f2(c.E/1000)+' kWh)',
      'Solar panels: '+c.nPan+' x '+f0(c.panelW)+' W ('+f0(c.Pinst)+' W)',
      'Charge controller: '+c.IcStd+' A MPPT',
      'Batteries: '+c.bats+' x 12 V '+f0(c.batAh)+' Ah ('+c.series+' series, '+c.parallel+' parallel)',
      'Inverter: '+vaLabel(c.VAstd)+' at '+c.V+' V',
      'Assumptions: PSH '+f1(c.psh)+', PR '+f0(c.pr*100)+'%, inverter '+f0(c.eff*100)+'%, DoD '+f0(c.dod*100)+'%, '+f1(c.days)+' day(s) autonomy'
    ].join('\n');
  }

  var last = null;
  function update(){
    var c = calc();
    last = c;
    var rowEls = document.querySelectorAll('#rows .row');
    c.items.forEach(function(it,i){
      var el = rowEls[i];
      if(!el) return;
      el.querySelector('output').textContent = f0(it.E);
      el.querySelector('.share i').style.width = (c.E > 0 ? (it.E / c.E * 100) : 0) + '%';
    });
    $('#tot').innerHTML = '<b>'+f0(c.P)+' W</b> connected &middot; <b>'+f0(c.E)+' Wh/day</b>';
    var note = $('#exNote');
    if(example){ note.hidden = false; note.textContent = 'Example loaded: ' + example + '. Edit the rows or clear them to use your own appliances.'; }
    else { note.hidden = true; }
    $('#voltHint').textContent = c.ok ? ('Using ' + c.V + ' V' + (S.volt === 'auto' ? ' for a ' + vaLabel(c.VAstd) + ' inverter.' : '.')) : '';
    if(c.ok){ renderKpi(c); } else { $('#kpi').innerHTML = '<div><div class="k">Daily energy</div><div class="v">0<small>kWh</small></div></div><div><div class="k">Connected load</div><div class="v">0<small>W</small></div></div>'; }
    renderSummary(c);
    renderSteps(c);
    renderLive(c);
    renderStack(c);
    $('#dockText').textContent = c.ok
      ? f2(c.E/1000)+' kWh/day · '+c.nPan+' panels · '+c.bats+' batt · '+vaLabel(c.VAstd)
      : 'Add appliances';
    save();
  }

  /* ---------- events ---------- */
  var rowsBox = $('#rows');
  rowsBox.addEventListener('input', function(e){
    var t = e.target, k = t.dataset.k;
    if(!k) return;
    var row = t.closest('.row');
    var r = rows.filter(function(x){ return String(x.id) === row.dataset.id; })[0];
    if(!r) return;
    r[k] = t.type === 'checkbox' ? t.checked : t.value;
    if(k === 'name') row.querySelector('.rm').setAttribute('aria-label','Remove ' + (t.value || 'appliance'));
    example = '';
    update();
  });
  rowsBox.addEventListener('click', function(e){
    var b = e.target.closest('[data-rm]');
    if(!b) return;
    var id = b.closest('.row').dataset.id;
    rows = rows.filter(function(x){ return String(x.id) !== id; });
    example = '';
    buildRows();
    update();
  });
  $('#add').addEventListener('click', function(){
    rows.push(mk('',1,'','',0));
    example = '';
    buildRows();
    update();
    var inputs = document.querySelectorAll('#rows .row [data-k="name"]');
    if(inputs.length) inputs[inputs.length - 1].focus();
  });
  $('#clear').addEventListener('click', function(){
    rows = [];
    example = '';
    buildRows();
    update();
  });
  document.querySelectorAll('[data-preset]').forEach(function(b){
    b.addEventListener('click', function(){
      loadPreset(b.dataset.preset);
      buildRows();
      update();
    });
  });
  Object.keys(S0).forEach(function(k){
    var el = document.getElementById(k);
    if(!el) return;
    el.value = S[k];
    el.addEventListener('input', function(){ S[k] = el.value; update(); });
  });
  document.querySelectorAll('[data-dod]').forEach(function(b){
    b.addEventListener('click', function(){
      S.dod = b.dataset.dod;
      document.getElementById('dod').value = S.dod;
      update();
    });
  });

  var statusT;
  function say(t){
    var s = $('#status');
    s.textContent = t;
    clearTimeout(statusT);
    statusT = setTimeout(function(){ s.textContent = ''; }, 3000);
  }
  $('#copy').addEventListener('click', function(){
    var text = summaryText(last || calc());
    var fallback = function(){
      var ta = $('#fallback');
      ta.hidden = false;
      ta.value = text;
      ta.focus();
      ta.select();
      say('Select the text and copy it.');
    };
    try{
      navigator.clipboard.writeText(text).then(function(){ say('Copied.'); }, fallback);
    }catch(e){ fallback(); }
  });
  $('#dockGo').addEventListener('click', function(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('#results').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
  });

  /* ---------- start ---------- */
  if(!restore()) loadPreset('hostel');
  Object.keys(S0).forEach(function(k){ var el = document.getElementById(k); if(el) el.value = S[k]; });
  buildRows();
  update();
})();
