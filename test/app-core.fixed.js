function updTotalH() {
  var t = gv('btQuotaTW') + gv('btQuotaUS') + gv('btQuotaETF');
  if (document.getElementById('poolMode').value === 'small') {
    if ($('btH')) $('btH').value = t;
  }
}

function togglePoolUI() {
  var isLarge = document.getElementById('poolMode').value === 'large';
  ['btQuotaTW', 'btQuotaUS', 'btQuotaETF'].forEach(function(id) {
    var el = document.getElementById(id);
    if(el) { el.disabled = isLarge; el.style.opacity = isLarge ? "0.3" : "1"; }
  });
  var hInput = document.getElementById('btH');
  if(hInput) { hInput.disabled = !isLarge; hInput.style.background = isLarge ? "var(--bg)" : "rgba(255,255,255,0.05)"; }
  if (!isLarge) updTotalH();
}

var DAILY={}, RAW_SCORES={}, BT_RESULT=null, CHART={}, CACHE_BUILT=false, CACHE_TS=null, SKIP_MO=false, CACHE_SKIP_MO=false, CORR_WIN=24;
var N_TREND=60; var MOM_CONSISTENCY_MULT=1.2; var REBAL_FREQ="1";

function renderPool() {
  var container = document.getElementById('poolContainer');
  if (!container) return;
  container.innerHTML = '';
  POOL_DEF.forEach(function(g, gi) {
    var ibId = 'ib_g' + gi;
    var icId = 'ic_g' + gi;
    var div = document.createElement('div');
    div.className = 'ig';
    var total = g.stocks.length;
    div.innerHTML =
      '<div class="ih" onclick="toggleInd(this)">' +
        '<span class="in">' + g.title + '</span>' +
        '<span class="ic" id="' + icId + '">' + total + '/' + total + '</span>' +
      '</div>' +
      '<div class="ib" id="' + ibId + '"></div>';
    container.appendChild(div);
    var ib = div.querySelector('.ib');
    g.stocks.forEach(function(s) {
      var isUS = !g.tw;
      var locked = s.locked || s.c === 'SGOV';
      var groupTitle = (g.title || '').toUpperCase();
      var groupPool = (s.pool || g.pool || '').toLowerCase();
      var isETFGroup = groupPool === 'etf' || groupTitle.indexOf('[ETF]') !== -1;

      // 預設選取規則：ETF 只保留 SPY / SGOV 為 ON，其餘 ETF 預設 OFF。
      // 非 ETF 維持原本 defaultOn 設定；CN 概念股仍依原設定 defaultOn:false。
      var defaultOn = (s.defaultOn === false || g.defaultOn === false) ? false : true;
      if (isETFGroup) defaultOn = (s.c === 'SPY' || s.c === 'SGOV');

      var chip = document.createElement('span');
      chip.className = 'sc' + (defaultOn ? ' act' : '') + (isUS ? ' usc' : '');
      chip.dataset.code = s.c;
      chip.dataset.type = locked ? 'tw50' : 'mid';
      chip.dataset.tw = g.tw ? '1' : '0';
      chip.dataset.pool = s.pool || g.pool || '';
      chip.dataset.region = s.region || g.region || '';
      chip.dataset.industry = s.industry || g.industry || g.title || '';
      chip.dataset.sector = s.sector || g.sector || '';
      chip.dataset.subInd = s.subInd || '';
      chip.dataset.on = defaultOn ? '1' : '0';
      chip.setAttribute('onclick', "toggleStock('" + s.c + "')");
      var inner = '<span class="cc">' + s.c + '</span>' +
                  '<span class="cn">' + s.n + '</span>';
      if (!locked) {
        inner += '<span class="cd" onclick="event.stopPropagation();deleteStock(\'' + s.c + '\')">\u00d7</span>';
      }
      chip.innerHTML = inner;
      ib.appendChild(chip);
    });
    updCountByIb(ib);
  });
}

function getEnabledStocks() {
  var result = [];
  document.querySelectorAll('[data-code][data-on="1"]').forEach(function(el) {
    var cn = el.querySelector('.cn');
    var code = el.dataset.code;
    var tw = el.dataset.tw === '1';
    var igNode = el.closest('.ig');
    var inSpan = igNode ? igNode.querySelector('.in') : null;
    var title = inSpan ? inSpan.textContent.toUpperCase() : '';
    var pool = el.dataset.pool || 'other';
    var region = el.dataset.region || '';
    if (!pool || pool === 'other') {
      if (tw) { pool = 'tw'; }
      else if (title.indexOf('[ETF]') !== -1) { pool = 'etf'; }
      else if (title.indexOf('[US]') !== -1 || title.indexOf('[CN]') !== -1 || title.indexOf('[JP]') !== -1) { pool = 'us'; }
    }
    var industry = el.dataset.industry || title;
    var sector = el.dataset.sector || industry;
    result.push({c: code, n: cn ? cn.textContent : '', type: el.dataset.type, tw: tw, pool: pool, region: region, ind: industry, industry: industry, sector: sector, subInd: el.dataset.subInd || ''});
  });
  return result;
}

var DB_NAME='FearlessConsoleDB', DB_VERSION=1;
function initDB(){return new Promise(function(resolve,reject){var request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=function(e){var db=e.target.result;if(!db.objectStoreNames.contains('stockData'))db.createObjectStore('stockData',{keyPath:'id'});};request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};});}
async function saveAllToDB(){if(!isPersist())return;try{var db=await initDB();var tx=db.transaction('stockData','readwrite');tx.objectStore('stockData').put({id:'main_cache',DAILY:DAILY,ts:new Date().toISOString()});}catch(e){console.error('DB Error:',e);}}
async function loadFromDB(){try{var db=await initDB();var tx=db.transaction('stockData','readonly');var request=tx.objectStore('stockData').get('main_cache');return new Promise(function(resolve){request.onsuccess=async function(){var res=request.result;if(res){DAILY=res.DAILY||{};updFetchStat();updTNX();if(isAutoBuildCache()){await buildCache();}else{CACHE_BUILT=false;CACHE_TS=null;if($('cacheTxt'))$('cacheTxt').textContent='Cache: data loaded; not built';}sl('dlLog','\u5f9e\u8cc7\u6599\u5eab\u6062\u5fa9\u6210\u529f ('+res.ts.slice(0,16).replace('T',' ')+')',true);resolve(true);}else resolve(false);};});}catch(e){return false;}}

function $(i){return document.getElementById(i);}
function gv(i){var e=$(i);return e?parseFloat(e.value)||0:0;}
function sl(id,msg,ok){var e=$(id);if(!e)return;e.textContent=msg;e.style.color=ok===true?'var(--gr)':ok===false?'var(--re)':'var(--mu)';}
function isPersist(){var e=$('persistToggle');return e?!!e.checked:true;}
function isAutoBuildCache(){var e=$('autoBuildCache');return e?!!e.checked:false;}
function getTailConfig(){
  var mode=$('tailMode')?$('tailMode').value:'pct';
  var pct=(parseFloat($('tailPct')?$('tailPct').value:'5')||5)/100;
  pct=Math.max(0.01,Math.min(0.50,pct));
  var count=parseInt($('tailCount')?$('tailCount').value:'10')||10;
  count=Math.max(1,count);
  return {mode:mode,pct:pct,count:count,label:(mode==='pct'?('Top/Bot '+Math.round(pct*100)+'%'):('Top/Bot '+count+'檔'))};
}
function tailBucketSize(n){
  var cfg=getTailConfig();
  if(cfg.mode==='count') return Math.max(1,Math.min(Math.floor(n/2),cfg.count));
  return Math.max(1,Math.min(Math.floor(n/2),Math.floor(n*cfg.pct)));
}
function arrAvg(a){return a&&a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;}

function showL(t){$('loadEl').classList.remove('hidden');$('loadTxt').textContent=t||'...';}
function hideL(){$('loadEl').classList.add('hidden');}
function dlBlob(b,n){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();document.body.removeChild(a);}
function dlText(t,n,ty){dlBlob(new Blob([t],{type:ty||'text/plain;charset=utf-8'}),n);}
function switchTab(name,el){var tabs=document.querySelectorAll('.tab'),panels=document.querySelectorAll('.panel');for(var i=0;i<tabs.length;i++)tabs[i].classList.remove('active');for(var i=0;i<panels.length;i++)panels[i].classList.remove('active');if(el)el.classList.add('active');var p=$('panel-'+name);if(p)p.classList.add('active');}
function toggleGroup(ibId,turnOn){var ib=$(ibId);if(!ib)return;ib.querySelectorAll('[data-code]').forEach(function(el){el.dataset.on=turnOn?'1':'0';turnOn?el.classList.add('act'):el.classList.remove('act');});updCountByIb(ib);}
function initGroupToggles(){document.querySelectorAll('.ih').forEach(function(ih){var ib=ih.nextElementSibling;if(!ib||!ib.classList.contains('ib'))return;var ibId=ib.id;if(!ibId)return;var wrap=document.createElement('span');wrap.style.cssText='display:inline-flex;align-items:center;gap:3px;margin-right:6px';var b1=document.createElement('button');b1.className='bo sm';b1.style.cssText='padding:1px 5px;font-size:10px;color:var(--gr);border-color:var(--gr)';b1.textContent='\u5168';b1.onclick=function(e){e.stopPropagation();toggleGroup(ibId,true);};var b2=document.createElement('button');b2.className='bo sm';b2.style.cssText='padding:1px 5px;font-size:10px;color:var(--re);border-color:var(--re)';b2.textContent='\u505c';b2.onclick=function(e){e.stopPropagation();toggleGroup(ibId,false);};wrap.appendChild(b1);wrap.appendChild(b2);var ic=ih.querySelector('.ic');ih.insertBefore(wrap,ic);});}
function toggleStock(code){var el=document.querySelector('[data-code="'+code+'"]');if(!el)return;var on=el.dataset.on==='1';el.dataset.on=on?'0':'1';el.classList.toggle('act',!on);updCount(el);}
function deleteStock(code){var el=document.querySelector('[data-code="'+code+'"]');if(!el||el.dataset.type==='tw50'||code==='SGOV')return;var ib=el.closest('.ib');el.remove();if(ib)updCountByIb(ib);}
function toggleInd(ih){var ib=ih.nextElementSibling;if(ib)ib.classList.toggle('col');}
function selectAll(){document.querySelectorAll('[data-code]').forEach(function(el){el.dataset.on='1';el.classList.add('act');});updAllCounts();}
function selectNone(){document.querySelectorAll('[data-code]').forEach(function(el){el.dataset.on='0';el.classList.remove('act');});updAllCounts();}
function selectTW(turnOn){document.querySelectorAll('[data-code][data-tw="1"]').forEach(function(el){el.dataset.on=turnOn?'1':'0';turnOn?el.classList.add('act'):el.classList.remove('act');});updAllCounts();}
function selectIntl(turnOn){document.querySelectorAll('[data-code][data-tw="0"]').forEach(function(el){ if(el.dataset.region==='cn') return; el.dataset.on=turnOn?'1':'0';turnOn?el.classList.add('act'):el.classList.remove('act');});updAllCounts();}
function selectCN(turnOn){document.querySelectorAll('[data-code][data-region="cn"]').forEach(function(el){el.dataset.on=turnOn?'1':'0';turnOn?el.classList.add('act'):el.classList.remove('act');});updAllCounts();}
function updCount(chip){var ib=chip.closest('.ib');if(ib)updCountByIb(ib);}
function updCountByIb(ib){var all=ib.querySelectorAll('[data-code]'),act=ib.querySelectorAll('[data-on="1"]');var ih=ib.previousElementSibling;if(ih){var ic=ih.querySelector('.ic');if(ic)ic.textContent=act.length+'/'+all.length;}}
function updAllCounts(){document.querySelectorAll('.ib').forEach(function(ib){updCountByIb(ib);});}
function addCustom(){var raw=$('cusT').value.trim().toUpperCase();var isUS=$('cusUS')&&$('cusUS').checked;var code=isUS?raw:raw.replace('.TW','');if(!code)return;if(document.querySelector('[data-code="'+code+'"]'))return;var name=$('cusN').value.trim()||code;var chip=document.createElement('span');chip.className='sc act'+(isUS?' usc':'');chip.setAttribute('onclick',"toggleStock('"+code+"')");chip.dataset.code=code;chip.dataset.type='mid';chip.dataset.tw=isUS?'0':'1';var customInd=$('cusI')?$('cusI').value:(isUS?'US-Custom':'TW-Custom');chip.dataset.industry=customInd;chip.dataset.sector=customInd;chip.dataset.region=isUS?'us':'tw';chip.dataset.pool=isUS?'us':'tw';chip.dataset.on='1';chip.innerHTML='<span class="cc">'+code+'</span><span class="cn">'+name+'</span><span class="cd" onclick="event.stopPropagation();deleteStock(\''+code+'\')">x</span>';var ibs=document.querySelectorAll('.ib');if(ibs.length)ibs[0].appendChild(chip);$('cusT').value='';$('cusN').value='';updAllCounts();}
function getStockName(code){var el=document.querySelector('[data-code="'+code+'"] .cn');return el?el.textContent:code;}
function getWeightMode(){var r=document.querySelector('input[name="wtMode"]:checked');return r?r.value:'eq';}

function getIndustryKeyFromStock(s) {
  if (!s) return 'UNKNOWN';
  if (s.c === 'CASH') return 'CASH';
  if (s.c === 'SGOV') return 'SGOV';
  return (s.industry || s.ind || s.subInd || s.sector || s.pool || 'UNKNOWN').toString();
}
function getIndustryLimit() {
  var v = parseInt($('btIndLimit') ? $('btIndLimit').value : '0');
  return isFinite(v) && v > 0 ? v : 0;
}
function canPickByIndustry(cand, selected, limit) {
  if (!limit || limit <= 0 || !cand || !cand.s) return true;
  var code = cand.s.c;
  if (code === 'SGOV' || code === 'CASH' || cand.s.pool === 'etf') return true;
  var key = getIndustryKeyFromStock(cand.s);
  var count = 0;
  selected.forEach(function(x){
    if (!x || !x.s) return;
    if (x.s.c === 'SGOV' || x.s.c === 'CASH' || x.s.pool === 'etf') return;
    if (getIndustryKeyFromStock(x.s) === key) count++;
  });
  return count < limit;
}

function buildProxies() {
  var p = $('proxyUrl') ? $('proxyUrl').value.trim() : '';
  if (p && !p.includes('url=')) p += p.endsWith('/') ? '?url=' : '/?url=';
  return [p, 'https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest='].filter(Boolean);
}

async function fp(url, proxies) {
  var last;
  for (var i = 0; i < proxies.length; i++) {
    try {
      var r = await fetch(proxies[i] + encodeURIComponent(url));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) { last = e; }
  }
  throw last || new Error('all proxies failed');
}

function buildTicker(s){if(!s.tw)return s.c;if(s.c.charAt(0)==='^'||s.c.indexOf('.')>=0)return s.c;return s.c+'.TW';}

async function fetchOHLCV(s, interval, range) {
  range = range || 'max';
  var tk = buildTicker(s);
  var proxies = buildProxies();
  var queryStr = 'range=' + range + '&interval=' + interval;
  if (range === 'max') {
    var nowUnix = Math.floor(Date.now() / 1000);
    queryStr = 'period1=0&period2=' + nowUnix + '&interval=' + interval;
  }
  var targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + tk + '?' + queryStr;
  var r = await fp(targetUrl, proxies);
  var j = await r.json();
  var ch = j.chart && j.chart.result && j.chart.result[0];
  if (!ch || !ch.timestamp) throw new Error('No Data for ' + tk);
  return ch.timestamp.map(function(ts, i) {
    var q = ch.indicators.quote[0];
    var adj = ch.indicators.adjclose && ch.indicators.adjclose[0] && ch.indicators.adjclose[0].adjclose && ch.indicators.adjclose[0].adjclose[i];
    return {
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      o: q.open[i], h: q.high[i], l: q.low[i],
      c: (adj !== undefined && adj !== null) ? adj : q.close[i],
      v: q.volume[i] || 0
    };
  }).filter(function(v){ return v.c != null; });
}

async function fetchAll() {
  var stocks = getEnabledStocks();
  if (!stocks.length) return alert('\u8acb\u5148\u9078\u64c7\u80a1\u6c60');
  var usCut = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var twCut = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var toFetch = [], upToDate = 0;
  stocks.forEach(function(s) {
    var bars = DAILY[s.c];
    var cut = s.tw ? twCut : usCut;
    if (!bars || !bars.length) { toFetch.push({s:s, range:'max'}); return; }
    var last = bars[bars.length-1].date;
    if (last < cut) {
      var days = Math.floor((new Date() - new Date(last)) / 86400000);
      var range = days <= 7 ? '5d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 365 ? '1y' : 'max';
      toFetch.push({s:s, range:range});
    } else { upToDate++; }
  });
  var benchList = [
    {s:{c:'^TNX',tw:false}},{s:{c:'^TWII',tw:true}},
    {s:{c:'RSP',tw:false}},{s:{c:'^VIX',tw:false}},{s:{c:'HYG',tw:false}}
  ];
  benchList.forEach(function(b) {
    var bars = DAILY[b.s.c];
    var cut = b.s.tw ? twCut : usCut;
    if (!bars || !bars.length) { toFetch.push({s:b.s, range:'max', isBench:true}); return; }
    var last = bars[bars.length-1].date;
    if (last < cut) {
      var days = Math.floor((new Date() - new Date(last)) / 86400000);
      var range = days <= 7 ? '5d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : '1y';
      toFetch.push({s:b.s, range:range, isBench:true});
    }
  });
  if (!toFetch.length) {
    sl('updateLog', '\u5168\u90e8\u8cc7\u6599\u5df2\u662f\u6700\u65b0 (' + upToDate + ' \u6a94)', true);
    renderStressDash(); return;
  }
  showL('\u4e26\u884c\u62b4\u53d6 ' + toFetch.length + ' \u6a94 (' + (stocks.length+5) + ' total, skip:' + upToDate + ')');
  $('fetchProg').classList.remove('hidden');
  var success = 0, failed = [], done = 0;

  async function fetchOne(item) {
    try {
      var fresh = await fetchOHLCV(item.s, '1d', item.range);
      DAILY[item.s.c] = mergeArr(DAILY[item.s.c], fresh);
      if (item.s.c === '^VIX') DAILY['VIXCLS'] = DAILY['^VIX'];
      if (item.s.c === 'HYG') {
        DAILY['BAMLH0A0HYM2'] = (DAILY['HYG']||[]).map(function(b) {
          var sp = Math.max(0.5, Math.min(20, (90/b.c-1)*35));
          return {date:b.date, o:sp, h:sp, l:sp, c:+sp.toFixed(3), v:0};
        });
      }
      success++;
    } catch(e) { failed.push(item.s.c); }
    done++;
    var pct = Math.round(done/toFetch.length*100);
    $('fetchFill').style.width = pct + '%';
    $('loadTxt').textContent = done + ' / ' + toFetch.length + '  (' + pct + '%)' + (failed.length ? '  fail:'+failed.length : '');
  }

  // Short-range first (faster), max-range last
  var shortF = toFetch.filter(function(i){return i.range!=='max';});
  var maxF   = toFetch.filter(function(i){return i.range==='max';});
  var ordered = shortF.concat(maxF);
  var BATCH = 6;
  for (var bi = 0; bi < ordered.length; bi += BATCH) {
    // yield to browser before each batch - prevents UI freeze
    await new Promise(function(r){setTimeout(r,0);});
    await Promise.all(ordered.slice(bi, bi+BATCH).map(fetchOne));
    updFetchStat();
    await new Promise(function(r){setTimeout(r,250);});
  }

  hideL(); $('fetchProg').classList.add('hidden');
  var msg = '\u5b8c\u6210! \u62b4\u53d6:'+success+' skip:'+upToDate+' fail:'+failed.length;
  if (failed.length) msg += ' ('+failed.slice(0,8).join(',')+(failed.length>8?'...':'')+')';
  sl('updateLog', msg, failed.length===0);
  if(isAutoBuildCache()){await buildCache();}else{CACHE_BUILT=false;CACHE_TS=null;if($('cacheTxt'))$('cacheTxt').textContent='Cache: data updated; not built';}
  await saveAllToDB();
  renderStressDash();
}


async function fetchUpdate() {
  var stocks = getEnabledStocks();
  var twCut = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var usCut = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var missing = [], stale = [];
  stocks.forEach(function(s) {
    if (!DAILY[s.c] || !DAILY[s.c].length) { missing.push(s); return; }
    if (DAILY[s.c][DAILY[s.c].length - 1].date < (s.tw ? twCut : usCut)) stale.push(s);
  });
  if (!missing.length && !stale.length) { sl('updateLog', 'All stocks up to date.', true); }
  var toFetch = missing.concat(stale), failed = [];
  if (toFetch.length) {
    showL('Smart update ' + toFetch.length + ' files...');
    for (var i = 0; i < toFetch.length; i++) {
      var s = toFetch[i];
      $('loadTxt').textContent = '[UPD] ' + s.c + ' (' + (i + 1) + '/' + toFetch.length + ')';
      try {
        var range = 'max';
        if (DAILY[s.c] && DAILY[s.c].length > 0) {
          var lastDate = new Date(DAILY[s.c][DAILY[s.c].length - 1].date);
          var delayDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
          if (delayDays <= 7) range = '5d';
          else if (delayDays <= 30) range = '1mo';
          else if (delayDays <= 90) range = '3mo';
          else if (delayDays <= 180) range = '6mo';
          else if (delayDays <= 365) range = '1y';
        }
        DAILY[s.c] = mergeArr(DAILY[s.c], await fetchOHLCV(s, '1d', range));
      } catch (e) { failed.push(s.c); }
      await new Promise(function(r){ setTimeout(r, 350); });
    }
    sl('updateLog', 'Done. new:' + missing.length + ' updated:' + stale.length + ' failed:' + failed.length, failed.length === 0);
  }
  var benchList = [
    {c:'^TNX',tw:false}, {c:'^TWII',tw:true}, {c:'RSP',tw:false},
    {c:'^VIX',tw:false}, {c:'HYG',tw:false}
  ];
  for (var bi = 0; bi < benchList.length; bi++) {
    var bs = benchList[bi];
    var bars = DAILY[bs.c];
    var cut = bs.tw ? twCut : usCut;
    if (bars && bars.length && bars[bars.length-1].date >= cut) continue;
    try {
      var bLast = bars && bars.length ? bars[bars.length-1].date : null;
      var bDays = bLast ? Math.floor((new Date() - new Date(bLast)) / 86400000) : 9999;
      var bRange = !bLast ? 'max' : bDays <= 7 ? '5d' : bDays <= 30 ? '1mo' : bDays <= 90 ? '3mo' : '6mo';
      $('loadTxt').textContent = '[BENCH] ' + bs.c + ' ' + bRange;
      var fresh = await fetchOHLCV(bs, '1d', bRange);
      DAILY[bs.c] = mergeArr(DAILY[bs.c], fresh);
      if (bs.c === '^VIX') DAILY['VIXCLS'] = DAILY['^VIX'];
      if (bs.c === 'HYG') {
        DAILY['BAMLH0A0HYM2'] = (DAILY['HYG'] || []).map(function(b) {
          var sp = Math.max(0.5, Math.min(20, (90 / b.c - 1) * 35));
          return { date: b.date, o: sp, h: sp, l: sp, c: +sp.toFixed(3), v: 0 };
        });
      }
    } catch (e) { console.warn('Bench update failed: ' + bs.c, e); }
    await new Promise(function(r){ setTimeout(r, 350); });
  }
  hideL(); updFetchStat();
  if(isAutoBuildCache()){await buildCache();}else{CACHE_BUILT=false;CACHE_TS=null;if($('cacheTxt'))$('cacheTxt').textContent='Cache: data updated; not built';}
  await saveAllToDB();
  renderStressDash();
}


function updTNX(){
  var bars = DAILY['^TNX'];
  if(!bars || !bars.length) return;
  var last = bars[bars.length-1];
  var sp = gv('btSpread')||0.5;
  var el = $('tnxVal'); if(el) el.textContent = last.c.toFixed(2)+'% ('+last.date+')';
  var el2 = $('tnxThresh'); if(el2) el2.textContent = 'TS: '+(last.c+sp).toFixed(2)+'%';
}

function updFetchStat(){
  var bar=$('fetchStat');if(!bar)return;var stocks=getEnabledStocks();
  bar.innerHTML=stocks.map(function(s){
    var ok=(DAILY[s.c]&&DAILY[s.c].length>0);
    var col=ok?(s.tw?'var(--te)':'var(--us)'):'var(--mu)', bg=ok?(s.tw?'var(--ted)':'var(--usd)'):'var(--sf2)', bd=ok?(s.tw?'var(--te)':'var(--us)'):'var(--bd)';
    return '<span class="bdg" style="background:'+bg+';color:'+col+';border:1px solid '+bd+'">'+s.c+'</span>';
  }).join('');
}

function calcVolatility(bars, win) {
  if (!bars || bars.length < win) return null;
  var rets = [];
  for (var j = bars.length - win + 1; j < bars.length; j++) {
    if (bars[j-1] && bars[j].c > 0 && bars[j-1].c > 0) {
      rets.push(bars[j].c / bars[j-1].c - 1);
    }
  }
  if (rets.length < 10) return null;
  var mean = rets.reduce(function(a, b){ return a + b; }, 0) / rets.length;
  var variance = rets.reduce(function(a, b){ return a + Math.pow(b - mean, 2); }, 0) / (rets.length > 1 ? rets.length - 1 : 1);
  return Math.sqrt(variance * 252);
}

// FIX2: calcMA renamed to calcSimpleMA (pure simple MA, no volume weighting)
function calcSimpleMA(bars, dateStr, period) {
  if (!bars || !bars.length) return null;
  var idx = -1;
  for (var i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date <= dateStr) { idx = i; break; }
  }
  if (idx < period - 1) return null;
  var sum = 0;
  for (var i = idx - period + 1; i <= idx; i++) {
    sum += bars[i].c;
  }
  return sum / period;
}

function getPriceOnDate(bars, dateStr) {
  if (!bars || !bars.length || dateStr < bars[0].date) return null;
  var best = bars[0].c;
  for(var i=0; i<bars.length; i++) {
    if (bars[i].date <= dateStr) best = bars[i].c;
    else break;
  }
  return best;
}

function getPrevWorkDay(bars, dateStr, offset) {
  offset = offset || 1;
  if (!bars || !bars.length) return dateStr;
  var targetIdx = -1;
  for (var i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date <= dateStr) { targetIdx = i; break; }
  }
  if (targetIdx === -1) return bars[0].date;
  if (targetIdx < offset) return bars[0].date;
  return bars[targetIdx - offset].date;
}

// FIX2: all calcMA calls updated to calcSimpleMA
function isBearishRegime(bars, dateStr, period) {
  period = period || 60;
  var ma = calcSimpleMA(bars, dateStr, period), price = getPriceOnDate(bars, dateStr);
  if (!ma || !price) return false;
  var prevDate = getPrevWorkDay(bars, dateStr, 5), prevMA = calcSimpleMA(bars, prevDate, period);
  return price < ma && (prevMA ? ma < prevMA : true);
}

function getFreq(){
  var radio=document.querySelector('input[name="btFreq"]:checked');
  if (radio) return radio.value || "1";
  var sel=$('btFreq');
  return sel ? (sel.value || "1") : "1";
}
function getAnnualPeriods(){
  return getFreq()==="2" ? 24 : 12;
}

function getMonthBarsMap(bars) {
  var map = {};
  if (!bars) return map;
  bars.forEach(function(bar) {
    var ym = bar.date.slice(0, 7);
    if (!map[ym]) map[ym] = [];
    map[ym].push(bar);
  });
  return map;
}

function getFixedTNDate(bars, monthEndDate, n) {
  n = Math.max(0, parseInt(n || 0));
  if (!bars || !bars.length || !monthEndDate) return monthEndDate;
  var ym = monthEndDate.slice(0, 7);
  var mBars = bars.filter(function(b){ return b.date.slice(0,7) === ym && b.date <= monthEndDate; });
  if (!mBars.length) return monthEndDate;
  var idx = mBars.length - 1 - n;
  if (idx < 0) idx = 0;
  return mBars[idx].date;
}

function getCurrentYM() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

function hasLaterMonth(bars, ym) {
  if (!bars || !bars.length || !ym) return false;
  for (var i = 0; i < bars.length; i++) {
    if (bars[i].date && bars[i].date.slice(0, 7) > ym) return true;
  }
  return false;
}

function pad2(n){ return String(n).padStart(2, '0'); }
function getMonthLastCalendarDate(ym){
  var y=parseInt(ym.slice(0,4),10), m=parseInt(ym.slice(5,7),10);
  return new Date(y, m, 0);
}
function fmtDateObj(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function getWeekdayDatesInMonth(ym){
  var y=parseInt(ym.slice(0,4),10), m=parseInt(ym.slice(5,7),10)-1;
  var end=getMonthLastCalendarDate(ym).getDate();
  var out=[];
  for(var d=1; d<=end; d++){
    var dt=new Date(y,m,d), wd=dt.getDay();
    if(wd!==0 && wd!==6) out.push(fmtDateObj(dt));
  }
  return out;
}
function getActualMonthEndDate(bars, ym){
  if(!bars || !bars.length || !ym) return null;
  var last=null;
  for(var i=0;i<bars.length;i++){
    if(bars[i].date && bars[i].date.slice(0,7)===ym) last=bars[i].date;
  }
  return last;
}
function getActualOrPrevTradingDay(bars, dateStr){
  if(!bars || !bars.length || !dateStr) return dateStr;
  var ans=null;
  for(var i=0;i<bars.length;i++){
    if(bars[i].date <= dateStr) ans=bars[i].date;
    else break;
  }
  return ans || dateStr;
}
function getSignalTNInfo(bars){
  if(!bars || !bars.length) return null;
  var inputYM = $('sigYM') ? ($('sigYM').value || '').trim().slice(0,7) : '';
  var lastDate = bars[bars.length-1].date;
  var ym = inputYM || lastDate.slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(ym)) return null;
  var n = Math.max(0, Math.min(22, parseInt($('sigTN') ? $('sigTN').value : '10') || 0));
  var actualMonthEnd = getActualMonthEndDate(bars, ym);
  var isComplete = hasLaterMonth(bars, ym);
  var T, tN, source;
  if(isComplete){
    T = actualMonthEnd;
    tN = getFixedTNDate(bars, T, n);
    source = 'actual';
  } else {
    var weekdays = getWeekdayDatesInMonth(ym);
    if(!weekdays.length) return null;
    T = weekdays[weekdays.length-1];
    var idx = weekdays.length - 1 - n;
    if(idx < 0) idx = 0;
    tN = weekdays[idx];
    source = 'estimated';
  }
  var ready = lastDate >= tN;
  var scoreDate = ready ? getActualOrPrevTradingDay(bars, tN) : null;
  return {ym:ym, N:n, T:T, tN:tN, scoreDate:scoreDate, ready:ready, lastDate:lastDate, source:source};
}
function getSignalMonthEnd(bars) {
  var info = getSignalTNInfo(bars);
  return info ? info.T : null;
}

function buildScoreCacheForDate(dateStr){
  if(!dateStr) return;
  var stocks=getEnabledStocks();
  stocks.forEach(function(s){
    var bars=DAILY[s.c];
    if(!bars || !bars.length) return;
    if(!RAW_SCORES[s.c]) RAW_SCORES[s.c]={};
    if(RAW_SCORES[s.c][dateStr]) return;
    var bIdx=-1;
    for(var i=0;i<bars.length;i++){
      if(bars[i].date <= dateStr) bIdx=i;
      else break;
    }
    if(bIdx >= 240){
      var cut=bars.slice(0,bIdx+1);
      RAW_SCORES[s.c][dateStr]={
        rm: rawMom(bars,bIdx),
        rb: calcBias(cut,N_TREND),
        rs: calcSlope(cut,N_TREND),
        rv: calcVol(cut,N_TREND),
        rk: calcKbar(cut,N_TREND),
        r240: bars[bIdx].c/(bars[bIdx-240]?bars[bIdx-240].c:1)-1
      };
    }
  });
}

function getPreciseRebalanceDates(bars, freq) {
  var dates = [];
  var currentMonth = "";
  var monthBars = [];
  function processMonth(mBars) {
    if(!mBars.length) return;
    if (freq === "2") {
      var midBar = mBars.filter(function(b){ return parseInt(b.date.slice(8,10)) >= 15; })[0];
      if (midBar) dates.push(midBar.date);
    }
    // 正式回測的月頻基準：每月最後一個可用交易日。
    dates.push(mBars[mBars.length - 1].date);
  }
  bars.forEach(function(bar) {
    var ym = bar.date.slice(0, 7);
    if (ym !== currentMonth) {
      if (currentMonth !== "") processMonth(monthBars);
      currentMonth = ym;
      monthBars = [];
    }
    monthBars.push(bar);
  });
  if (monthBars.length > 0) processMonth(monthBars);
  var seen = {}; var out = [];
  dates.forEach(function(d){ if(!seen[d]){ seen[d]=1; out.push(d); } });
  return out.sort();
}

function mergeArr(oldBars, newBars) {
  if (!oldBars || !oldBars.length) return newBars || [];
  if (!newBars || !newBars.length) return oldBars || [];
  var seen = {};
  oldBars.forEach(function(b){ seen[b.date] = b; });
  newBars.forEach(function(b){ seen[b.date] = b; });
  return Object.values(seen).sort(function(a, b){ return a.date.localeCompare(b.date); });
}

function calcVWMA(bars,n){if(bars.length<n)return null;var sl=bars.slice(-n),sp=0,sv=0;sl.forEach(function(b){var vol=b.v>0?b.v:1;sp+=b.c*vol;sv+=vol;});return sv>0?sp/sv:null;}
function calcBias(bars,N){var v=calcVWMA(bars,N);return v?(bars[bars.length-1].c-v)/v:null;}
function calcSlope(bars,N){if(bars.length<N+3)return null;var va=[];for(var i=bars.length-N;i<bars.length;i++){var sl=bars.slice(Math.max(0,i-N+1),i+1);var sp=0,sv=0;sl.forEach(function(b){var vol=b.v>0?b.v:1;sp+=b.c*vol;sv+=vol;});if(sv>0)va.push(sp/sv);}if(va.length<Math.floor(N/2))return null;var n=va.length,sx=0,sy=0,sxy=0,sx2=0;for(var j=0;j<n;j++){sx+=j;sy+=va[j];sxy+=j*va[j];sx2+=j*j;}var den=n*sx2-sx*sx;if(!den)return 0;return (n*sxy-sx*sy)/den/(va[0]||1);}
function calcVol(bars,N){if(bars.length<N+1)return null;var sl=bars.slice(-N),sc=[];for(var i=1;i<sl.length;i++){var pr=(sl[i].c-sl[i-1].c)/(sl[i-1].c||1);var vr=sl[i-1].v>0?sl[i].v/sl[i-1].v:1;sc.push((pr>=0?1:-1)*(pr>=0?(vr-1):(1-vr)));}return sc.length?sc.reduce(function(a,b){return a+b;},0)/sc.length:null;}
function calcKbar(bars,N){if(bars.length<N)return null;var sl=bars.slice(-N);var v=sl.map(function(b){var r=b.h-b.l;return r>0?(b.c-b.l)/r:0.5;});return v.reduce(function(a,b){return a+b;},0)/v.length;}

function momZ(bars, idx, period) {
  if (idx < period) return null;
  var ret = bars[idx].c / bars[idx - period].c - 1;
  var rets = [], start = Math.max(period, idx - 250);
  for (var i = start; i <= idx; i++) rets.push(bars[i].c / bars[i - period].c - 1);
  var mean = rets.reduce(function(a, b){ return a + b; }, 0) / rets.length;
  var std = Math.sqrt(rets.reduce(function(a, b){ return a + Math.pow(b - mean, 2); }, 0) / (rets.length > 1 ? rets.length - 1 : 1)) || 0.01;
  return (ret - mean) / std;
}

function rawMom(daily, idx) {
  if (idx < 240) return null;
  var z240 = momZ(daily, idx, 240), z120 = momZ(daily, idx, 120), z60 = momZ(daily, idx, 60);
  if (z240 === null || z120 === null || z60 === null) return null;
  var score = 0.5 * z240 + 0.3 * z120 + 0.2 * z60;
  if (z240 > 0 && z120 > 0 && z60 > 0) score *= MOM_CONSISTENCY_MULT;
  return score;
}

async function buildCache() {
  var stocks = getEnabledStocks();
  var withData = stocks.filter(function(s){ return DAILY[s.c] && DAILY[s.c].length > 0; });
  if(!withData.length){ updCacheSt(); return; }
  showL('Building V1.9 Cache...');
  RAW_SCORES = {};
  var freq = getFreq();
  var masterTicker = DAILY['^TWII'] ? '^TWII' : (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : withData[0].c));
  var refDaily = DAILY[masterTicker];
  var globalRebalDates = getPreciseRebalanceDates(refDaily, freq);
  var monthlyDates = getPreciseRebalanceDates(refDaily, "1");
  var neededDates = [];
  function addNeededDate(d) {
    if (d) neededDates.push(d);
  }
  // 回測正式使用月頻/半月頻；信號頁會獨立觀察固定 T-N，因此預建每月 T0~T22。
  globalRebalDates.forEach(function(d) {
    addNeededDate(d);
    addNeededDate(getPrevWorkDay(refDaily, d, 1));
    addNeededDate(getPrevWorkDay(refDaily, d, 2));
  });
  monthlyDates.forEach(function(d) {
    for (var k = 0; k <= 22; k++) addNeededDate(getFixedTNDate(refDaily, d, k));
  });
  var seen2 = {}; var cacheDates = [];
  neededDates.forEach(function(d){ if(!seen2[d]){ seen2[d]=1; cacheDates.push(d); } });
  cacheDates.sort();
  for(var si=0; si<withData.length; si++){
    var s=withData[si];
    $('loadTxt').textContent='Cache: '+s.c+' ('+(si+1)+'/'+withData.length+')';
    var bars=DAILY[s.c];
    RAW_SCORES[s.c]={};
    var bIdx=0;
    cacheDates.forEach(function(d){
      while(bIdx < bars.length - 1 && bars[bIdx + 1].date <= d) { bIdx++; }
      if(bars[bIdx].date <= d && bIdx >= 240){
        var cut = bars.slice(0, bIdx+1);
        RAW_SCORES[s.c][d]={
          rm: rawMom(bars, bIdx),
          rb: calcBias(cut, N_TREND),
          rs: calcSlope(cut, N_TREND),
          rv: calcVol(cut, N_TREND),
          rk: calcKbar(cut, N_TREND),
          r240: bars[bIdx].c/(bars[bIdx-240]?bars[bIdx-240].c:1)-1
        };
      }
    });
    if(si%5===4) await new Promise(function(r){ setTimeout(r,0); });
  }
  CACHE_BUILT=true; CACHE_TS=new Date().toISOString(); CACHE_SKIP_MO=SKIP_MO;
  hideL(); updCacheSt(); updTNX();
}

function updCacheSt(){var el=$('cacheTxt');if(!el)return;if(!CACHE_BUILT){el.textContent='Cache: not built';el.style.color='var(--mu)';return;}var n=Object.keys(RAW_SCORES).length;var dt=new Date(CACHE_TS).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});el.textContent='Cache OK ('+n+' stocks, '+dt+')';el.style.color='var(--gr)';}


// ===============================
// Unified data gate for Signal / Backtest / IC / Stress
// 目的：抓取頁或上傳頁完成後，回測頁不再誤判「尚未抓資料」。
// 流程：先看記憶體 DAILY；若空，從 IndexedDB 載入；若 Cache 未建立，直接用 DAILY 建立 Cache。
// 這裡只會 buildCache，不會觸發 Yahoo fetch。
// ===============================
function hasLoadedDailyData(){
  return Object.keys(DAILY || {}).some(function(k){ return DAILY[k] && DAILY[k].length > 0; });
}

async function ensureDataReadyForAnalysis(sourceLabel){
  sourceLabel = sourceLabel || 'analysis';

  if (CACHE_BUILT && hasLoadedDailyData()) return true;

  if (!hasLoadedDailyData() && isPersist()) {
    if ($('btLog')) sl('btLog', '正在從 IndexedDB 載入資料...', null);
    if ($('stressLog')) sl('stressLog', '正在從 IndexedDB 載入資料...', null);
    await loadFromDB();
  }

  if (!hasLoadedDailyData()) {
    alert('目前沒有可用價格資料。請先在「抓取」頁抓取資料，或上傳/還原資料庫。');
    return false;
  }

  if (!CACHE_BUILT) {
    if ($('btLog')) sl('btLog', '已找到價格資料，正在建立回測快取...', null);
    if ($('stressLog')) sl('stressLog', '已找到價格資料，正在建立回測快取...', null);
    await buildCache();
  }

  if (!CACHE_BUILT) {
    alert('資料已載入，但快取建立失敗或有效資料不足。請檢查資料完整性。');
    return false;
  }
  return true;
}

function crossZ(arr,cap){
  cap=cap||2;
  var vals=arr.filter(function(v){return v!==null&&!isNaN(v);});
  if(vals.length<3)return arr.map(function(v){return v===null?null:0;});
  var mean=vals.reduce(function(a,b){return a+b;},0)/vals.length;
  var std=Math.sqrt(vals.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/(vals.length>1?vals.length-1:1))||1;
  return arr.map(function(v){if(v===null)return null;return Math.max(-cap,Math.min(cap,(v-mean)/std));});
}

function getTNXRate(dateStr) {
  var rate = getPriceOnDate(DAILY['^TNX'], dateStr);
  return rate ? (rate / 100) : 0.04;
}

function getHurdle(dateStr){ return Math.max(0, getTNXRate(dateStr) + (gv('btSpread')||0.5)/100); }

// FIX2: calcMA -> calcSimpleMA
function isStrictTechnicalPass(code, dateStr) {
  var bars = DAILY[code];
  if (!bars || bars.length < 65) return false;
  var ma60 = calcSimpleMA(bars, dateStr, 60);
  var price = getPriceOnDate(bars, dateStr);
  var prevDate = getPrevWorkDay(bars, dateStr, 5);
  var prevMa60 = calcSimpleMA(bars, prevDate, 60);
  if (!ma60 || !price || !prevMa60) return false;
  return (price > ma60 && ma60 >= prevMa60);
}

function calcAllScores(dateStr) {
  var stocks = getEnabledStocks().filter(function(s){ return RAW_SCORES[s.c] && RAW_SCORES[s.c][dateStr]; });
  if (stocks.length < 3) return [];
  var mode = document.getElementById('poolMode').value;
  var w = {m:gv('wMom')/100, b:gv('wBias')/100, s:gv('wSlope')/100, v:gv('wVol')/100, k:gv('wKbar')/100};
  if (mode === 'large') {
    var rMs=[],rBs=[],rSs=[],rVs=[],rKs=[];
    var infos = stocks.map(function(s) {
      var r = RAW_SCORES[s.c][dateStr];
      rMs.push(r.rm); rBs.push(r.rb); rSs.push(r.rs); rVs.push(r.rv); rKs.push(r.rk);
      return {s:s, raw:r};
    });
    var zMs=crossZ(rMs,99),zBs=crossZ(rBs,2),zSs=crossZ(rSs,99),zVs=crossZ(rVs,2),zKs=crossZ(rKs,99);
    return infos.map(function(d,i){ return {s:d.s, score:(w.m*zMs[i]+w.b*zBs[i]+w.s*zSs[i]+w.v*zVs[i]+w.k*zKs[i]), zm:zMs[i],zb:zBs[i],zs:zSs[i],zv:zVs[i],zk:zKs[i],r240:d.raw.r240}; });
  } else {
    var poolGroups={'tw':[],'us':[],'etf':[],'other':[]};
    stocks.forEach(function(s){ if(poolGroups[s.pool]) poolGroups[s.pool].push(s); });
    var finalScores=[];
    Object.keys(poolGroups).forEach(function(p){
      var pStocks=poolGroups[p]; if(!pStocks.length) return;
      var rMs=[],rBs=[],rSs=[],rVs=[],rKs=[];
      var pinfos=pStocks.map(function(s){
        var r=RAW_SCORES[s.c][dateStr];
        rMs.push(r.rm);rBs.push(r.rb);rSs.push(r.rs);rVs.push(r.rv);rKs.push(r.rk);
        return {s:s,raw:r};
      });
      var zMs=crossZ(rMs,99),zBs=crossZ(rBs,2),zSs=crossZ(rSs,99),zVs=crossZ(rVs,2),zKs=crossZ(rKs,99);
      pinfos.forEach(function(d,i){
        finalScores.push({s:d.s, score:(w.m*zMs[i]+w.b*zBs[i]+w.s*zSs[i]+w.v*zVs[i]+w.k*zKs[i]), zm:zMs[i],zb:zBs[i],zs:zSs[i],zv:zVs[i],zk:zKs[i],r240:d.raw.r240});
      });
    });
    return finalScores;
  }
}

function calcCorr(c1, c2, dateStr) {
  var b1 = DAILY[c1], b2 = DAILY[c2];
  if (!b1 || !b2) return 0;
  function monthEndPrices(bars) {
    var map = {};
    bars.forEach(function(b){
      if (b.date > dateStr) return;
      var ym = b.date.slice(0,7);
      map[ym] = b;
    });
    return map;
  }
  var m1 = monthEndPrices(b1), m2 = monthEndPrices(b2);
  var months = Object.keys(m1).filter(function(m){ return m2[m]; }).sort();
  if (months.length < CORR_WIN + 1) return 0;
  months = months.slice(-(CORR_WIN + 1));
  var r1=[], r2=[];
  for (var i=1; i<months.length; i++) {
    var a=months[i-1], b=months[i];
    var p10=m1[a].c, p11=m1[b].c, p20=m2[a].c, p21=m2[b].c;
    if (!p10 || !p20) continue;
    r1.push(p11/p10-1);
    r2.push(p21/p20-1);
  }
  if (r1.length < Math.max(6, Math.min(12, CORR_WIN/2))) return 0;
  var avg1=r1.reduce(function(a,b){return a+b;},0)/r1.length;
  var avg2=r2.reduce(function(a,b){return a+b;},0)/r2.length;
  var num=0, d1=0, d2=0;
  for (var j=0; j<r1.length; j++) {
    num+=(r1[j]-avg1)*(r2[j]-avg2);
    d1+=Math.pow(r1[j]-avg1,2);
    d2+=Math.pow(r2[j]-avg2,2);
  }
  var denom=Math.sqrt(d1*d2);
  return denom===0 ? 0 : num/denom;
}

function getBench(dateStr) {
  var masterTicker = DAILY['^TWII'] ? '^TWII' : (DAILY['SPY'] ? 'SPY' : null);
  return masterTicker ? getPriceOnDate(DAILY[masterTicker], dateStr) : null;
}

async function fetchFRED(seriesId, apiKey, quickMode) {
  var fredUrl = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + seriesId +
    '&api_key=' + apiKey + '&file_type=json';
  if (quickMode) {
    var from = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    fredUrl += '&observation_start=' + from;
  }
  // Strategy 1: direct fetch (works if browser allows CORS from FRED)
  // Strategy 2: shield proxy with full encodeURIComponent
  // Strategy 3: allorigins fallback
  var px = $('proxyUrl') ? $('proxyUrl').value.trim() : '';
  if (px && !px.includes('url=')) px += px.endsWith('/') ? '?url=' : '/?url=';
  var strategies = [
    function() { return fetch(fredUrl); },
    function() { if (!px) throw new Error('no proxy'); return fetch(px + encodeURIComponent(fredUrl)); },
    function() { return fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(fredUrl)); },
    function() { return fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(fredUrl)); }
  ];
  var lastErr;
  for (var si = 0; si < strategies.length; si++) {
    try {
      var r = await strategies[si]();
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var text = await r.text();
      if (text.trim().charAt(0) !== '{') throw new Error('Not JSON (strategy ' + si + '): ' + text.slice(0, 80));
      var j = JSON.parse(text);
      if (j.error_message) throw new Error('FRED error: ' + j.error_message);
      if (j.error_code) throw new Error('FRED error_code ' + j.error_code);
      var obs = j.observations || [];
      var result = [];
      for (var i = 0; i < obs.length; i++) {
        var v = parseFloat(obs[i].value);
        if (!isNaN(v)) result.push({ date: obs[i].date, o: v, h: v, l: v, c: v, v: 0 });
      }
      if (!result.length) throw new Error('empty observations');
      return result;
    } catch(e) { lastErr = e; }
  }
  throw lastErr || new Error('All strategies failed for ' + seriesId);
}

function updFredStats() {
  function fmtStat(bars, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (!bars || !bars.length) {
      el.textContent = 'not fetched';
      el.style.color = 'var(--mu)';
      return;
    }
    var last = bars[bars.length - 1];
    var daysAgo = Math.floor((Date.now() - new Date(last.date)) / 86400000);
    el.textContent = last.date + '  ' + last.c.toFixed(2) + (daysAgo > 3 ? '  (' + daysAgo + 'd ago)' : '');
    el.style.color = daysAgo > 5 ? 'var(--ye)' : 'var(--gr)';
  }
  fmtStat(DAILY['VIXCLS'], 'fredVixStat');
  fmtStat(DAILY['BAMLH0A0HYM2'], 'fredHyStat');
  fmtStat(DAILY['RSP'], 'fredRspStat');
  renderStressDash();
}


var STRESS_WEIGHT_OVERRIDE = null;

function getStressWeights(){
  var raw;
  if (STRESS_WEIGHT_OVERRIDE) {
    raw = {vix:STRESS_WEIGHT_OVERRIDE.vix, hy:STRESS_WEIGHT_OVERRIDE.hy, trend:STRESS_WEIGHT_OVERRIDE.trend, breadth:STRESS_WEIGHT_OVERRIDE.breadth};
  } else {
    raw = {
      vix: Number(document.getElementById('swVix')?.value || 35),
      hy: Number(document.getElementById('swHy')?.value || 35),
      trend: Number(document.getElementById('swTrend')?.value || 20),
      breadth: Number(document.getElementById('swBreadth')?.value || 10)
    };
  }
  var sum = raw.vix + raw.hy + raw.trend + raw.breadth;
  if (!isFinite(sum) || sum <= 0) raw = {vix:35,hy:35,trend:20,breadth:10}, sum=100;
  return {vix:raw.vix/sum, hy:raw.hy/sum, trend:raw.trend/sum, breadth:raw.breadth/sum, raw:raw, sum:sum};
}

function normalizeStressWeightInputs(){
  var w = getStressWeights();
  if (document.getElementById('swVix')) document.getElementById('swVix').value = Math.round(w.vix*100);
  if (document.getElementById('swHy')) document.getElementById('swHy').value = Math.round(w.hy*100);
  if (document.getElementById('swTrend')) document.getElementById('swTrend').value = Math.round(w.trend*100);
  if (document.getElementById('swBreadth')) document.getElementById('swBreadth').value = Math.max(0, 100 - Math.round(w.vix*100) - Math.round(w.hy*100) - Math.round(w.trend*100));
}

function resetStressWeights(){
  STRESS_WEIGHT_OVERRIDE = null;
  if (document.getElementById('swVix')) document.getElementById('swVix').value = 35;
  if (document.getElementById('swHy')) document.getElementById('swHy').value = 35;
  if (document.getElementById('swTrend')) document.getElementById('swTrend').value = 20;
  if (document.getElementById('swBreadth')) document.getElementById('swBreadth').value = 10;
}

function renderStressDash() {
  var vixBars = DAILY['VIXCLS'];
  var hyBars  = DAILY['BAMLH0A0HYM2'];
  // SPY fallback: use DB (main database sp field) if DAILY['SPY'] is absent
  var spyBars = DAILY['SPY'];
  if (!spyBars || spyBars.length < 60) {
    if (DB && DB.length >= 60) {
      spyBars = DB.map(function(r){ return { date: r.d, c: r.sp }; }).filter(function(r){ return r.c && r.c > 0; });
    }
  }
  var rspBars = DAILY['RSP'];

  var COLORS = { safe:'#00e5a0', neutral:'#ffb830', danger:'#ff4d6d', dim:'#6b7a99' };

  function scoreColor(pct) {
    if (pct < 33) return COLORS.safe;
    if (pct < 66) return COLORS.neutral;
    return COLORS.danger;
  }

  function setCard(id, border) {
    var el = document.getElementById(id);
    if (el) el.style.borderColor = border;
  }

  function calcMA(bars, n) {
    if (!bars || bars.length < n) return null;
    var slice = bars.slice(-n);
    return slice.reduce(function(s, b){ return s + b.c; }, 0) / n;
  }

  // ---- Factor 1: VIX ROC ----
  var vixLevel = 0, vixRoc = null, vixPct = 0, vixVal = '--';
  if (vixBars && vixBars.length >= 22) {
    var vNow = vixBars[vixBars.length - 1].c;
    var vMA20 = calcMA(vixBars, 20);
    vixRoc = (vNow - vMA20) / vMA20;
    vixVal = vNow.toFixed(1);
    // z-score of ROC over 252-day window
    var rocs = [];
    for (var i = 21; i < vixBars.length; i++) {
      var sl = vixBars.slice(i - 20, i);
      var ma = sl.reduce(function(s,b){return s+b.c;},0)/20;
      if (ma > 0) rocs.push((vixBars[i].c - ma) / ma);
    }
    var zVix = 0;
    if (rocs.length > 10) {
      var mu = rocs.reduce(function(a,b){return a+b;},0)/rocs.length;
      var sd = Math.sqrt(rocs.reduce(function(a,b){return a+(b-mu)*(b-mu);},0)/rocs.length) || 0.01;
      zVix = (vixRoc - mu) / sd;
    }
    // mirror: high ROC = high risk. pct 0=safe 100=danger
    vixPct = Math.max(0, Math.min(100, Math.round(50 + zVix * 15)));
    vixLevel = vixPct >= 75 ? 3 : vixPct >= 50 ? 2 : vixPct >= 30 ? 1 : 0;
    document.getElementById('sfv_val').textContent = vixVal;
    document.getElementById('sfv_z').textContent = 'z = ' + zVix.toFixed(2) + '  ROC=' + (vixRoc*100).toFixed(1) + '%';
    document.getElementById('sfv_bar').style.width = vixPct + '%';
    document.getElementById('sfv_bar').style.background = scoreColor(vixPct);
    document.getElementById('sfv_val').style.color = scoreColor(vixPct);
    var lvTxt = ['Level 0 \u5b89\u5168', 'Level 1 \u8b66\u6212', 'Level 2 \u9ad8\u98a8\u96aa', 'Level 3 \u6975\u7aef'][vixLevel];
    document.getElementById('sfv_lv').textContent = lvTxt;
    document.getElementById('sfv_lv').style.color = scoreColor(vixPct);
    setCard('sf_vix', scoreColor(vixPct));
  }

  // ---- Factor 2: HY Spread ----
  var hyLevel = 0, hyPct = 0, hyVal = '--';
  if (hyBars && hyBars.length >= 22) {
    var hyNow = hyBars[hyBars.length - 1].c;
    var hyMA252 = calcMA(hyBars, Math.min(252, hyBars.length));
    var hyPrev21 = hyBars.length >= 22 ? hyBars[hyBars.length - 22].c : hyNow;
    var hyChange = hyNow - hyPrev21;
    hyVal = hyNow.toFixed(2);
    // z-score of current spread vs 252d distribution
    var hySlice = hyBars.slice(-Math.min(252, hyBars.length)).map(function(b){return b.c;});
    var hyMu = hySlice.reduce(function(a,b){return a+b;},0)/hySlice.length;
    var hySd = Math.sqrt(hySlice.reduce(function(a,b){return a+(b-hyMu)*(b-hyMu);},0)/hySlice.length) || 0.01;
    var zHY = (hyNow - hyMu) / hySd;
    // high spread = high risk
    hyPct = Math.max(0, Math.min(100, Math.round(50 + zHY * 15)));
    hyLevel = hyPct >= 75 ? 3 : hyPct >= 50 ? 2 : hyPct >= 30 ? 1 : 0;
    document.getElementById('sfh_val').textContent = hyVal + '%';
    document.getElementById('sfh_z').textContent = 'z = ' + zHY.toFixed(2) + '  \u51801M=' + (hyChange >= 0 ? '+' : '') + hyChange.toFixed(2);
    document.getElementById('sfh_bar').style.width = hyPct + '%';
    document.getElementById('sfh_bar').style.background = scoreColor(hyPct);
    document.getElementById('sfh_val').style.color = scoreColor(hyPct);
    var lvTxtH = ['Level 0 \u5b89\u5168', 'Level 1 \u8b66\u6212', 'Level 2 \u9ad8\u98a8\u96aa', 'Level 3 \u6975\u7aef'][hyLevel];
    document.getElementById('sfh_lv').textContent = lvTxtH;
    document.getElementById('sfh_lv').style.color = scoreColor(hyPct);
    setCard('sf_hy', scoreColor(hyPct));
  }

  // ---- Factor 3: Trend (SPY vs 120MA, 240MA) ----
  var trLevel = 0, trPct = 0, trVal = '--';
  if (spyBars && spyBars.length >= 122) {
    var spNow = spyBars[spyBars.length - 1].c;
    var ma60  = calcMA(spyBars, 60);
    var ma120 = calcMA(spyBars, 120);
    var ma240 = spyBars.length >= 242 ? calcMA(spyBars, 240) : null;
    var pctVsMA = (spNow / ma120 - 1) * 100;
    trVal = (pctVsMA >= 0 ? '+' : '') + pctVsMA.toFixed(1) + '%';
    // risk mapping: below 240MA=100, below 120MA=70, below 60MA=45, above all=10
    if (ma240 && spNow < ma240)      { trPct = 90; trLevel = 3; }
    else if (spNow < ma120)          { trPct = 70; trLevel = 2; }
    else if (spNow < ma60)           { trPct = 45; trLevel = 1; }
    else                             { trPct = Math.max(0, Math.round(30 - pctVsMA * 0.8)); trLevel = 0; }
    trPct = Math.max(0, Math.min(100, trPct));
    document.getElementById('sft_val').textContent = trVal;
    document.getElementById('sft_z').textContent = 'SPY vs MA120  MA240=' + (ma240 ? ma240.toFixed(0) : '--');
    document.getElementById('sft_bar').style.width = trPct + '%';
    document.getElementById('sft_bar').style.background = scoreColor(trPct);
    document.getElementById('sft_val').style.color = scoreColor(trPct);
    var lvTxtT = ['Level 0 \u5b89\u5168', 'Level 1 \u8b66\u6212', 'Level 2 \u9ad8\u98a8\u96aa', 'Level 3 \u6975\u7aef'][trLevel];
    document.getElementById('sft_lv').textContent = lvTxtT;
    document.getElementById('sft_lv').style.color = scoreColor(trPct);
    setCard('sf_tr', scoreColor(trPct));
  }

  // ---- Factor 4: Breadth (RSP/SPY vs 60MA) ----
  var brLevel = 0, brPct = 0, brVal = '--';
  if (rspBars && spyBars && rspBars.length >= 62 && spyBars.length >= 62) {
    var rspNow = rspBars[rspBars.length - 1].c;
    var spyNow = spyBars[spyBars.length - 1].c;
    var ratioNow = rspNow / spyNow;
    // build ratio series aligned by date
    var rspMap = {};
    rspBars.forEach(function(b){ rspMap[b.date] = b.c; });
    var ratioArr = [];
    spyBars.forEach(function(b){ if (rspMap[b.date] && b.c > 0) ratioArr.push(rspMap[b.date] / b.c); });
    if (ratioArr.length < 62) {
      document.getElementById('sfb_val').textContent = 'n=' + ratioArr.length;
      document.getElementById('sfb_z').textContent = 'RSP/SPY date overlap too short';
      document.getElementById('sfb_lv').textContent = 'Level -- (insufficient overlap)';
    } else {
    var rMA60 = ratioArr.length >= 60 ? ratioArr.slice(-60).reduce(function(a,b){return a+b;},0)/60 : null;
    var rSlice = ratioArr.slice(-Math.min(252, ratioArr.length));
    var rMu = rSlice.reduce(function(a,b){return a+b;},0)/rSlice.length;
    var rSd = Math.sqrt(rSlice.reduce(function(a,b){return a+(b-rMu)*(b-rMu);},0)/rSlice.length) || 0.001;
    var zBr = (ratioNow - rMu) / rSd;
    brVal = (ratioNow >= (rMA60||ratioNow) ? '+' : '') + ((ratioNow/(rMA60||ratioNow)-1)*100).toFixed(1) + '%';
    // low ratio = weak breadth = high risk (mirror)
    brPct = Math.max(0, Math.min(100, Math.round(50 - zBr * 15)));
    brLevel = brPct >= 75 ? 3 : brPct >= 50 ? 2 : brPct >= 30 ? 1 : 0;
    document.getElementById('sfb_val').textContent = brVal;
    document.getElementById('sfb_z').textContent = 'z = ' + zBr.toFixed(2) + '  ratio=' + ratioNow.toFixed(3);
    document.getElementById('sfb_bar').style.width = brPct + '%';
    document.getElementById('sfb_bar').style.background = scoreColor(brPct);
    document.getElementById('sfb_val').style.color = scoreColor(brPct);
    var lvTxtB = ['Level 0 \u5b89\u5168', 'Level 1 \u8b66\u6212', 'Level 2 \u9ad8\u98a8\u96aa', 'Level 3 \u6975\u7aef'][brLevel];
    document.getElementById('sfb_lv').textContent = lvTxtB;
    document.getElementById('sfb_lv').style.color = scoreColor(brPct);
    setCard('sf_br', scoreColor(brPct));
    } // end else ratioArr.length >= 62
  }

  // ---- Composite Score (0=safe, 100=danger) ----
  var missing = [];
  if (!vixBars || vixBars.length < 22) missing.push('^VIX(' + (vixBars ? vixBars.length : 0) + ')');
  if (!hyBars  || hyBars.length  < 22) missing.push('HYG(' + (hyBars ? hyBars.length : 0) + ')');
  if (!spyBars || spyBars.length < 122) missing.push('SPY(' + (spyBars ? spyBars.length : 0) + ')');
  if (!rspBars || rspBars.length < 62) missing.push('RSP(' + (rspBars ? rspBars.length : 0) + ')');
  var swD = getStressWeights();
  var wVix = swD.vix, wHy = swD.hy, wTr = swD.trend, wBr = swD.breadth;
  var totalW = 0;
  if (vixBars && vixBars.length >= 22)  totalW += wVix; else wVix = 0;
  if (hyBars  && hyBars.length  >= 22)  totalW += wHy; else wHy  = 0;
  if (spyBars && spyBars.length >= 122) totalW += wTr; else wTr  = 0;
  if (rspBars && rspBars.length >= 62 && spyBars && spyBars.length >= 62) totalW += wBr; else wBr = 0;
  if (totalW <= 0) {
    document.getElementById('stressNote').textContent = '\u8CC7\u6599\u4E0D\u8DB3\uFF0C\u8ACB\u5148\u6293\u53D6\u5168\u90E8\u8CC7\u6599\u3002Missing: ' + missing.join(', ');
    return;
  }
  wVix /= totalW; wHy /= totalW; wTr /= totalW; wBr /= totalW;
  var composite = Math.round(vixPct * wVix + hyPct * wHy + trPct * wTr + brPct * wBr);
  composite = Math.max(0, Math.min(100, composite));

  var bigNum = document.getElementById('stressBigNum');
  var label  = document.getElementById('stressLabel');
  var labelS = document.getElementById('stressLabelSub');
  var needle = document.getElementById('stressNeedle');
  var card   = document.getElementById('stressDashCard');

  bigNum.textContent = composite;
  bigNum.style.color = scoreColor(composite);
  needle.style.left  = composite + '%';

  var resonance = [vixLevel, hyLevel, trLevel, brLevel].filter(function(l){return l >= 2;}).length;

  if (composite < 30) {
    label.textContent = '\u5B89\u5168 SAFE';
    label.style.color = COLORS.safe;
    labelS.textContent = '\u5E02\u5834\u58D3\u529B\u6B63\u5E38\uFF0C\u53EF\u7DAD\u6301\u6EB3\u66B4\u9732';
    card.style.borderColor = COLORS.safe;
  } else if (composite < 55) {
    label.textContent = '\u4E2D\u7ACB NEUTRAL';
    label.style.color = COLORS.neutral;
    labelS.textContent = '\u90E8\u5206\u58D3\u529B\u5347\u6EAB\uFF0C\u6CE8\u610F\u76E3\u63A7';
    card.style.borderColor = COLORS.neutral;
  } else if (composite < 75) {
    label.textContent = '\u8B66\u6212 CAUTION';
    label.style.color = COLORS.neutral;
    labelS.textContent = '\u591A\u56E0\u5B50\u60E1\u5316\uFF0C\u8003\u616E\u964D\u4F4E\u66DD\u9669';
    card.style.borderColor = COLORS.neutral;
  } else {
    label.textContent = '\u5371\u967A DANGER';
    label.style.color = COLORS.danger;
    labelS.textContent = '\u9AD8\u5EA6\u5E02\u5834\u58D3\u529B\uFF0C\u5EFA\u8B70\u9632\u5B88\u6A21\u5F0F';
    card.style.borderColor = COLORS.danger;
  }

    var resNote = resonance >= 2 ? ('  +Resonance(' + resonance + ')') : '';
  var missingNote = missing.length ? '  Missing: ' + missing.join(' ') : '';
  document.getElementById('stressNote').textContent =
    'VIX=' + (wVix>0?vixPct:'--') + '/' + (vixBars?vixBars.length:0) + 'd' +
    '  HY=' + (wHy>0?hyPct:'--') + '/' + (hyBars?hyBars.length:0) + 'd' +
    '  Trend=' + (wTr>0?trPct:'--') + '/' + (spyBars?spyBars.length:0) + 'd' +
    '  Breadth=' + (wBr>0?brPct:'--') + '/' + (rspBars?rspBars.length:0) + 'd' +
    '  W=' + (wVix*100).toFixed(0) + '/' + (wHy*100).toFixed(0) + '/' + (wTr*100).toFixed(0) + '/' + (wBr*100).toFixed(0) + '%' +
    '  -> Composite=' + composite + resNote + missingNote +
    '  | Exposure: ' + (composite >= 75 ? '20%' : composite >= 55 ? '40%' : composite >= 30 ? '70%' : '100%');
}

async function fetchFredIndicators() {
  sl('fredLog', 'Fetching from Yahoo Finance...', null);
  showL('Fetching VIX + HYG + RSP...');
  var errors = [];
  // VIX via Yahoo (^VIX) -> stored as VIXCLS
  try {
    $('loadTxt').textContent = 'Yahoo: ^VIX (VIX)...';
    var vixRaw = await fetchOHLCV({c:'^VIX', tw:false}, '1d', 'max');
    if (vixRaw.length) {
      DAILY['VIXCLS'] = mergeArr(DAILY['VIXCLS'], vixRaw);
    } else { errors.push('^VIX: no data'); }
  } catch(e) { errors.push('^VIX: ' + e.message); }
  await new Promise(function(r){ setTimeout(r, 1200); });
  // HY Spread proxy: HYG/IEF spread -> stored as BAMLH0A0HYM2
  // We use HYG yield proxy: fetch HYG and IEF, compute spread as (1/price)*coupon approximation
  // Simpler: fetch HYG directly as proxy for credit conditions
  try {
    $('loadTxt').textContent = 'Yahoo: HYG (HY proxy)...';
    var hygRaw = await fetchOHLCV({c:'HYG', tw:false}, '1d', 'max');
    if (hygRaw.length) {
      // Convert HYG price to spread proxy: invert and scale so ~100 price = ~3.5% spread
      // HYG price range: 70-90, spread range 3-10%. Formula: spread = (90/price - 1) * 35
      var hygAsSpread = hygRaw.map(function(b) {
        var spread = Math.max(0.5, Math.min(20, (90 / b.c - 1) * 35));
        return { date: b.date, o: spread, h: spread, l: spread, c: +spread.toFixed(3), v: 0 };
      });
      DAILY['BAMLH0A0HYM2'] = mergeArr(DAILY['BAMLH0A0HYM2'], hygAsSpread);
    } else { errors.push('HYG: no data'); }
  } catch(e) { errors.push('HYG: ' + e.message); }
  await new Promise(function(r){ setTimeout(r, 1200); });
  // RSP (equal weight S&P breadth)
  try {
    $('loadTxt').textContent = 'Yahoo: RSP...';
    var rspFresh = await fetchOHLCV({c:'RSP', tw:false}, '1d', 'max');
    if (rspFresh.length) { DAILY['RSP'] = mergeArr(DAILY['RSP'], rspFresh); }
    else { errors.push('RSP: no data'); }
  } catch(e) { errors.push('RSP: ' + e.message); }
  hideL();
  updFredStats();
  renderStressDash();
  await saveAllToDB();
  if (errors.length) { sl('fredLog', 'Done (errors: ' + errors.join(' | ') + ')', false); }
  else { sl('fredLog', '^VIX + HYG(spread proxy) + RSP fetched OK', true); }
}

function computeStressScore(dateStr) {
  var factors = [];

  // Factor 1: VIX ROC = (VIX - VIX_20MA) / VIX_20MA
  var vixBars = DAILY['VIXCLS'];
  var vixLevel = 0;
  if (vixBars && vixBars.length >= 20) {
    var vixNow = getPriceOnDate(vixBars, dateStr);
    var vixMA20 = calcSimpleMA(vixBars, dateStr, 20);
    if (vixNow && vixMA20 && vixMA20 > 0) {
      var vixRoc = (vixNow - vixMA20) / vixMA20;
      if (vixRoc > 1.0) vixLevel = 3;
      else if (vixRoc > 0.6) vixLevel = 2;
      else if (vixRoc > 0.4) vixLevel = 1;
    }
  }
  factors.push(vixLevel);

  // Factor 2: HY Spread (BAMLH0A0HYM2)
  var hyBars = DAILY['BAMLH0A0HYM2'];
  var hyLevel = 0;
  if (hyBars && hyBars.length >= 21) {
    var hyNow = getPriceOnDate(hyBars, dateStr);
    var hyMA252 = calcSimpleMA(hyBars, dateStr, 252);
    var prevDate21 = getPrevWorkDay(hyBars, dateStr, 21);
    var hyPrev21 = getPriceOnDate(hyBars, prevDate21);
    if (hyNow && hyMA252) {
      var aboveMA = hyNow > hyMA252;
      var change1m = (hyPrev21 && hyPrev21 > 0) ? (hyNow - hyPrev21) : 0;
      if (aboveMA && change1m > 1.0) hyLevel = 3;
      else if (aboveMA && change1m > 0.5) hyLevel = 2;
      else if (aboveMA) hyLevel = 1;
    }
  }
  factors.push(hyLevel);

  // Factor 3: Trend (SPY vs 120MA and 240MA)
  var trendLevel = 0;
  var trendBars = DAILY['SPY'] || DAILY['^TWII'];
  if (trendBars && trendBars.length >= 120) {
    var trendPrice = getPriceOnDate(trendBars, dateStr);
    var ma120 = calcSimpleMA(trendBars, dateStr, 120);
    var ma240 = trendBars.length >= 240 ? calcSimpleMA(trendBars, dateStr, 240) : null;
    if (trendPrice && ma240 && trendPrice < ma240) trendLevel = 2;
    else if (trendPrice && ma120 && trendPrice < ma120) trendLevel = 1;
  }
  factors.push(trendLevel);

  // Factor 4: Breadth (RSP/SPY ratio vs 60MA)
  var breadthLevel = 0;
  var rspBars = DAILY['RSP'];
  var spyBars = DAILY['SPY'];
  if (rspBars && spyBars && rspBars.length >= 60 && spyBars.length >= 60) {
    var rspNow = getPriceOnDate(rspBars, dateStr);
    var spyNow2 = getPriceOnDate(spyBars, dateStr);
    if (rspNow && spyNow2 && spyNow2 > 0) {
      var ratioNow = rspNow / spyNow2;
      var belowCount = 0;
      for (var bi2 = 0; bi2 < 20; bi2++) {
        var dPrev = getPrevWorkDay(rspBars, dateStr, bi2);
        var rPrev = getPriceOnDate(rspBars, dPrev);
        var sPrev = getPriceOnDate(spyBars, dPrev);
        if (rPrev && sPrev && sPrev > 0) {
          var ratioPrev = rPrev / sPrev;
          var ratioMA60 = null;
          var ratioVals = [];
          for (var bj = 0; bj < 60; bj++) {
            var dj = getPrevWorkDay(rspBars, dPrev, bj);
            var rj = getPriceOnDate(rspBars, dj);
            var sj = getPriceOnDate(spyBars, dj);
            if (rj && sj && sj > 0) ratioVals.push(rj / sj);
          }
          if (ratioVals.length >= 40) {
            ratioMA60 = ratioVals.reduce(function(a,b){return a+b;},0)/ratioVals.length;
            if (ratioPrev < ratioMA60) belowCount++;
          }
        }
      }
      if (belowCount >= 16) breadthLevel = 2;
      else if (belowCount >= 10) breadthLevel = 1;
    }
  }
  factors.push(breadthLevel);

  var baseLevel = Math.max.apply(null, factors);
  var highCount = factors.filter(function(l){ return l >= 2; }).length;
  var mildCount = factors.filter(function(l){ return l >= 1; }).length;

  var stressLevel;
  if (highCount >= 3 || baseLevel === 3) stressLevel = 4;
  else if (highCount >= 2) stressLevel = 3;
  else if (highCount >= 1 || mildCount >= 3) stressLevel = 2;
  else if (mildCount >= 1) stressLevel = 1;
  else stressLevel = 0;

  // Convert factor levels to 0-100 pct scores (same scale as renderStressDash)
  var levelToPct = [10, 35, 60, 85, 100];
  var vixPctS  = levelToPct[factors[0]] || 10;
  var hyPctS   = levelToPct[factors[1]] || 10;
  var trPctS   = levelToPct[factors[2]] || 10;
  var brPctS   = levelToPct[factors[3]] || 10;
  var swC = getStressWeights();
  var composite = Math.round(vixPctS * swC.vix + hyPctS * swC.hy + trPctS * swC.trend + brPctS * swC.breadth);
  composite = Math.max(0, Math.min(100, composite));

  // New exposure rules: <60=100%, 60-70=70%, 70-80=50%, >=80=30%
  var exposure;
  if (composite < 60)      exposure = 1.0;
  else if (composite < 70) exposure = 0.7;
  else if (composite < 80) exposure = 0.5;
  else                     exposure = 0.3;

  return {
    stressLevel: stressLevel,
    composite: composite,
    exposure: exposure,
    factors: factors,
    baseLevel: baseLevel,
    highCount: highCount
  };
}

function getShieldRefBars(){
  if (DAILY['SPY'] && DAILY['SPY'].length) return {code:'SPY', bars:DAILY['SPY']};
  if (DAILY['^TWII'] && DAILY['^TWII'].length) return {code:'^TWII', bars:DAILY['^TWII']};
  return null;
}

function getShieldMA(bars, dateStr, len){
  if (!bars || !bars.length) return null;
  var vals=[];
  for (var i=0; i<bars.length; i++) {
    if (bars[i].date <= dateStr && bars[i].c != null) vals.push(bars[i].c);
    if (bars[i].date > dateStr) break;
  }
  if (vals.length < len) return null;
  vals = vals.slice(-len);
  return vals.reduce(function(a,b){return a+b;},0) / vals.length;
}

function getShieldDecision(dateStr){
  var mode = $('btShieldGate') ? $('btShieldGate').value : 'off';
  if (mode === 'off') return {enabled:false, ok:true, exposure:1.0, reason:'OFF'};

  if (mode === 'stress') {
    var ss = computeStressScore(dateStr);
    var ok = ss.composite < 60;
    return {
      enabled: true,
      ok: ok,
      exposure: ss.exposure,
      stressLevel: ss.stressLevel,
      composite: ss.composite,
      factors: ss.factors,
      reason: 'Composite=' + ss.composite + ' Exp=' + Math.round(ss.exposure * 100) + '%'
    };
  }

  // Legacy mode
  var ref = getShieldRefBars();
  if (!ref) return {enabled:true, ok:true, exposure:1.0, reason:'No ref data'};
  var maLen = parseInt($('btShieldMA') ? $('btShieldMA').value : '240') || 240;
  var price = getPriceOnDate(ref.bars, dateStr);
  var ma = getShieldMA(ref.bars, dateStr, maLen);
  if (!price || !ma) return {enabled:true, ok:true, exposure:1.0, reason:'Insufficient data', ref:ref.code};
  var pass = price >= ma;
  return {enabled:true, ok:pass, exposure: pass ? 1.0 : 0.0, price:price, ma:ma, ref:ref.code, reason:(pass?'PASS':'FAIL')};
}

