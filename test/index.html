var DAILY={}, RAW_SCORES={}, BT_RESULT=null, CHART={}, CACHE_BUILT=false, CACHE_TS=null, SKIP_MO=false, CACHE_SKIP_MO=false, CORR_WIN=24;
var N_TREND=60; var MOM_CONSISTENCY_MULT=1.2; var REBAL_FREQ="1";

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
        '<span style="display:inline-flex;align-items:center;gap:3px;margin-right:6px">' +
          '<button class="bo sm" style="padding:1px 5px;font-size:10px;color:var(--gr);border-color:var(--gr)" onclick="event.stopPropagation();selectGroup(this,true)">全</button>' +
          '<button class="bo sm" style="padding:1px 5px;font-size:10px;color:var(--re);border-color:var(--re)" onclick="event.stopPropagation();selectGroup(this,false)">停</button>' +
        '</span>' +
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
async function saveAllToDB(){try{var db=await initDB();var tx=db.transaction('stockData','readwrite');tx.objectStore('stockData').put({id:'main_cache',DAILY:DAILY,ts:new Date().toISOString()});}catch(e){console.error('DB Error:',e);}}
async function loadFromDB(){try{var db=await initDB();var tx=db.transaction('stockData','readonly');var request=tx.objectStore('stockData').get('main_cache');return new Promise(function(resolve){request.onsuccess=async function(){var res=request.result;if(res){DAILY=res.DAILY||{};updFetchStat();updTNX();markCacheDirty('loadFromDB');sl('dlLog','從資料庫恢復成功 ('+res.ts.slice(0,16).replace('T',' ')+')，Cache 將延後建立。',true);resolve(true);}else resolve(false);};});}catch(e){return false;}}

function $(i){return document.getElementById(i);}
function gv(i){var e=$(i);return e?parseFloat(e.value)||0:0;}
function sl(id,msg,ok){var e=$(id);if(!e)return;e.textContent=msg;e.style.color=ok===true?'var(--gr)':ok===false?'var(--re)':'var(--mu)';}
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
function selectGroup(btn, turnOn) {
  var ib = btn.closest('.ig').querySelector('.ib');
  if (!ib) return;
  ib.querySelectorAll('[data-code]').forEach(function(el) {
    if (el.dataset.type === 'tw50') return; // 鎖定項目不動
    el.dataset.on = turnOn ? '1' : '0';
    turnOn ? el.classList.add('act') : el.classList.remove('act');
  });
  updAllCounts();
}
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


// FETCH FAST MODE / LAZY CACHE
var FETCH_CFG = {
  concurrency: 6,          // 多點抓取並發數；過高容易被 Yahoo/proxy 限流
  failWaitMs: 1000,        // 原 fetchAll 失敗/每檔等待 2000ms，降 50%
  updateWaitMs: 175,       // 原 update 每檔 350ms，降 50%
  startDate: '1993-01-01', // Yahoo 有資料才會回；沒有則從上市日起算
  lazyCache: true          // 抓取/上傳/更新後不立刻 buildCache，等信號/回測前才建
};

function unixDateUTC(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function resetDerivedViews(reason) {
  BT_RESULT = null;
  if (CHART.n) { try { CHART.n.destroy(); } catch(e){} CHART.n = null; }
  if (CHART.d) { try { CHART.d.destroy(); } catch(e){} CHART.d = null; }
  var btRes = $('btRes');
  if (btRes) btRes.classList.add('hidden');
  var btMetrics = $('btMetrics');
  if (btMetrics) btMetrics.innerHTML = '';
  var btBody = $('btBody');
  if (btBody) btBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--mu);padding:12px;font-size:12px">資料已更新，請重新執行回測。</td></tr>';
  if ($('wfRes')) $('wfRes').classList.add('hidden');
  if ($('rollRes')) $('rollRes').classList.add('hidden');
  if ($('tnRes')) $('tnRes').classList.add('hidden');
  if (reason) console.log('[DERIVED RESET]', reason);
}
function markCacheDirty(reason) {
  CACHE_BUILT = false;
  CACHE_TS = null;
  RAW_SCORES = {};
  resetDerivedViews(reason || 'data changed');
  updCacheSt();
  if (reason) console.log('[CACHE DIRTY]', reason);
}
async function ensureCacheBuilt(reason) {
  if (!CACHE_BUILT || CACHE_SKIP_MO !== SKIP_MO) {
    sl('dlLog', 'Building cache for ' + (reason || 'calculation') + '...', null);
    await buildCache();
    await saveAllToDB();
  }
  return CACHE_BUILT;
}
async function mapLimit(items, limit, worker) {
  var idx = 0, done = 0, results = [];
  limit = Math.max(1, Math.min(limit || 1, items.length || 1));
  async function runOne() {
    while (idx < items.length) {
      var my = idx++;
      results[my] = await worker(items[my], my);
      done++;
      if ($('fetchFill')) $('fetchFill').style.width = ((done / items.length) * 100) + '%';
      updFetchStat();
    }
  }
  var runners = [];
  for (var i = 0; i < limit; i++) runners.push(runOne());
  await Promise.all(runners);
  return results;
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
    queryStr = 'period1=' + unixDateUTC(FETCH_CFG.startDate) + '&period2=' + nowUnix + '&interval=' + interval;
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
  if(!stocks.length) return alert('請先選擇股池');
  if (!confirm('重新抓取會以新抓到的資料覆蓋目前記憶體與 IndexedDB，避免混用舊資料。是否繼續？')) return;
  showL('多點抓取全歷史日線...');
  $('fetchProg').classList.remove('hidden');
  $('fetchFill').style.width = '0%';
  var success = 0, failed = [];
  var freshDaily = {};
  await mapLimit(stocks, FETCH_CFG.concurrency, async function(s, i) {
    $('loadTxt').textContent = '抓取: ' + s.c + ' (' + (i+1) + '/' + stocks.length + ')';
    try {
      var bars = await fetchOHLCV(s, '1d', 'max');
      if (!bars || !bars.length) throw new Error('empty bars');
      freshDaily[s.c] = bars;
      success++;
      return true;
    } catch(e) {
      failed.push(s.c);
      console.error(s.c, e);
      await sleep(FETCH_CFG.failWaitMs);
      return false;
    }
  });
  try {
    $('loadTxt').textContent = '同步大盤基準...(^TNX, ^TWII)';
    var bench = [{c:'^TNX', tw:false}, {c:'^TWII', tw:true}];
    await mapLimit(bench, 2, async function(bs) {
      try {
        var bars = await fetchOHLCV(bs, '1d', 'max');
        if (bars && bars.length) freshDaily[bs.c] = bars;
      } catch(e) { console.warn('Bench Fetch Error: ' + bs.c, e); }
      return true;
    });
  } catch(e) { console.error('Bench Fetch Error', e); }

  // 關鍵修正：完整重抓採用 freshDaily 整包替換，不再把失敗標的保留成舊資料。
  DAILY = freshDaily;
  hideL(); $('fetchProg').classList.add('hidden');
  updFetchStat(); updTNX();
  markCacheDirty('fetchAll:fresh-replace');
  await saveAllToDB();
  sl('dlLog', '重新抓取完成。成功:' + success + ' 失敗:' + failed.length + '。已用新資料整包覆蓋舊資料庫；回測結果已清空，下一次回測會用新資料重建 Cache。', failed.length === 0);
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
  if (!missing.length && !stale.length) { sl('updateLog', '所有資料已是最新狀態。', true); return; }
  var toFetch = missing.concat(stale), failed = [];
  showL('多點智慧更新 ' + toFetch.length + ' 檔標的...');
  $('fetchProg').classList.remove('hidden');
  $('fetchFill').style.width = '0%';
  await mapLimit(toFetch, FETCH_CFG.concurrency, async function(s, i) {
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
      await sleep(FETCH_CFG.updateWaitMs);
      return true;
    } catch (e) { failed.push(s.c); console.warn('Update failed: ' + s.c, e); await sleep(FETCH_CFG.updateWaitMs); return false; }
  });
  var benchList = [{c:'^TNX',tw:false},{c:'^TWII',tw:true}];
  await mapLimit(benchList, 2, async function(bs) {
    if (!DAILY[bs.c] || !DAILY[bs.c].length) return false;
    var lastBenchDate = DAILY[bs.c][DAILY[bs.c].length - 1].date;
    var benchCut = bs.tw ? twCut : usCut;
    if (lastBenchDate >= benchCut) return true;
    try {
      var bDelayDays = Math.floor((new Date() - new Date(lastBenchDate)) / (1000 * 60 * 60 * 24));
      var bRange = bDelayDays <= 7 ? '5d' : bDelayDays <= 30 ? '1mo' : bDelayDays <= 90 ? '3mo' : '6mo';
      DAILY[bs.c] = mergeArr(DAILY[bs.c], await fetchOHLCV(bs, '1d', bRange));
      return true;
    } catch (e) { console.warn('Bench update failed: ' + bs.c, e); return false; }
  });
  hideL(); $('fetchProg').classList.add('hidden'); updFetchStat();
  markCacheDirty('fetchUpdate');
  await saveAllToDB();
  sl('updateLog', '更新完成。新增:' + missing.length + ' 續接:' + stale.length + ' 失敗:' + failed.length + '。Cache 延後到信號/回測前自動重建。', failed.length === 0);
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
  var on = $('btShieldGate') && $('btShieldGate').value === 'on';
  if (!on) return {enabled:false, ok:true, reason:'OFF'};
  var ref = getShieldRefBars();
  if (!ref) return {enabled:true, ok:true, reason:'No ref data'};
  var maLen = parseInt($('btShieldMA') ? $('btShieldMA').value : '240') || 240;
  var price = getPriceOnDate(ref.bars, dateStr);
  var ma = getShieldMA(ref.bars, dateStr, maLen);
  if (!price || !ma) return {enabled:true, ok:true, reason:'Insufficient shield data', ref:ref.code};
  return {enabled:true, ok:price >= ma, price:price, ma:ma, ref:ref.code, reason:(price >= ma ? 'PASS' : 'FAIL')};
}

function runBTcore(mh, mode, opts) {
  opts = opts || {};
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  if (!CACHE_BUILT) return null;
  var stocks = getEnabledStocks().filter(function(s){ return DAILY[s.c]; });
  if (stocks.length < 3) return null;
  var masterTicker = DAILY['^TWII'] ? '^TWII' : (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : stocks[0].c));
  var refDaily = DAILY[masterTicker]; if (!refDaily) return null;
  var freq = getFreq();
  var allM = getPreciseRebalanceDates(refDaily, freq);
  var rawS = $('btS') ? ($('btS').value||'').trim().slice(0,10) : '';
  var rawE = $('btE') ? ($('btE').value||'').trim().slice(0,10) : '';
  var lagEl = document.querySelector('input[name="lagMode"]:checked');
  var LAG = lagEl ? parseInt(lagEl.value) : 1;
  var skipMoOnGlobal = !!($('btSkipMo') && $('btSkipMo').checked);
  var MIN = skipMoOnGlobal ? 2 : 1, cS = MIN;
  if (rawS) { for(var i=cS; i<allM.length; i++){ if(allM[i]>=rawS){ cS=i; break; } } }
  var cE=allM.length-1;
  if (rawE) { for(var i2=cE; i2>=cS; i2--){ if(allM[i2]<=rawE){ cE=i2; break; } } }
  if (cS>cE) return null;

  var INIT=gv('btCap')||100000, COST=(gv('btC')||0.3)/100, ct=gv('corrT')||0.75;
  var indLimit=getIndustryLimit();
  var shortN=parseInt($('btSN')?$('btSN').value:'0')||0;
  var capMode=document.querySelector('input[name="capMode"]:checked')?document.querySelector('input[name="capMode"]:checked').value:'neutral';
  var wtModeEl=document.querySelector('input[name="wtMode"]:checked');
  var wtMode=wtModeEl?wtModeEl.value:'eq';
  var shortTSF=!!($('btSTSF')&&$('btSTSF').checked);
  var regimeOn=$('btRegime')&&$('btRegime').value==='on';
  var regimeExp=gv('btRegimeExp')||100;
  var useMA60=$('ma60Filter')?$('ma60Filter').value==='on':true;

  var nav=INIT, bNav=INIT, records=[], holdings={CASH:1.0};
      var DEFENSIVE=['SGOV'];



  for (var idx=cS; idx<=cE; idx++) {
    var sigM = allM[idx];
    var prevM = allM[idx - 1];

    // Formal backtest is strictly month/half-month based.
    // T-N is only an independent signal-page observation and must not affect NAV.
    // Normal mode: score from previous rebalance date's t-1/t-2.
    // Skip Month ON: score from one full rebalance period earlier's t-1/t-2.
    var scoreBaseM = skipMoOnGlobal ? allM[idx - 2] : prevM;
    if (!scoreBaseM) {
      var b0skip=getPriceOnDate(refDaily,prevM), b1skip=getPriceOnDate(refDaily,sigM);
      if(b0skip&&b1skip&&b0skip>0) bNav*=(1+(b1skip/b0skip-1));
      records.push({month:sigM,period:prevM+" ~ "+sigM,nav:nav,bNav:bNav,holdings:{CASH:1.0},pRet:0,hurdle:0,stockRets:{},scoringM:null,note:'No scoring base'});
      holdings={CASH:1.0};
      continue;
    }
    var scoreM;
    if (opts.signalN !== undefined && opts.signalN !== null) {
      scoreM = getFixedTNDate(refDaily, prevM, opts.signalN);
    } else {
      scoreM = (LAG === 1)
        ? getPrevWorkDay(refDaily, scoreBaseM, 1)
        : (LAG === 2 ? getPrevWorkDay(refDaily, scoreBaseM, 2) : scoreBaseM);
    }
    var scoringM = scoreM;
    var hurdle = getHurdle(scoringM);
    var sc2 = calcAllScores(scoringM);
    var valid=sc2.filter(function(r){ return r.score!==null; });
    valid.sort(function(a,b){ return b.score-a.score; });

    if (valid.length < 5) {
      var b0x=getPriceOnDate(refDaily,prevM), b1x=getPriceOnDate(refDaily,sigM);
      if(b0x&&b1x&&b0x>0) bNav*=(1+(b1x/b0x-1));
      records.push({month:sigM,period:prevM+" ~ "+sigM,nav:nav,bNav:bNav,holdings:{CASH:1.0},pRet:0,hurdle:hurdle,stockRets:{},scoringM:scoreM});
      holdings={CASH:1.0}; continue;
    }

    // FIX3: poolModeSetting declared first, exitMap uses calcSimpleMA
    var poolModeSetting = document.getElementById('poolMode').value;

    var exitMap = {};
    if (useMA60) {
      Object.keys(holdings).forEach(function(c) {
        if (c === 'CASH') return;
        var bars = DAILY[c]; if (!bars) return;
        var ma = calcSimpleMA(bars, scoreM, 60);
        var price = getPriceOnDate(bars, scoreM);
        var prevDate = getPrevWorkDay(refDaily, scoreM, 5);
        var prevMa = calcSimpleMA(bars, prevDate, 60);
        if ((ma && price && price < ma) || (ma && prevMa && ma < prevMa)) exitMap[c] = true;
      });
    }

    // FIX3: single unified candidate list; no double pools variable
    var mainCands = valid.filter(function(r) {
      if (r.r240 === null || r.r240 <= hurdle) return false;
      if (DEFENSIVE.indexOf(r.s.c) !== -1) return false;
      if (exitMap[r.s.c]) return false;
      return true;
    });

    var sel = [];

    if (poolModeSetting === 'large') {
      var totalMax = parseInt(document.getElementById('btH').value) || 5;
      mainCands.sort(function(a,b){ return b.score-a.score; });
      for (var ci=0; ci<mainCands.length; ci++) {
        if (sel.length >= totalMax) break;
        var cand = mainCands[ci];
        if (sel.every(function(x){ return Math.abs(calcCorr(cand.s.c,x.s.c,scoreM))<ct; }) && canPickByIndustry(cand, sel, indLimit)) sel.push(cand);
      }
    } else {
      var qTW=parseInt($('btQuotaTW')?$('btQuotaTW').value:'2')||0;
      var qUS=parseInt($('btQuotaUS')?$('btQuotaUS').value:'2')||0;
      var qETF=parseInt($('btQuotaETF')?$('btQuotaETF').value:'1')||0;
      var localPools={'tw':[],'us':[],'etf':[]};
      mainCands.forEach(function(r){ if(localPools[r.s.pool]) localPools[r.s.pool].push(r); });
      var quotaMap={'tw':qTW,'us':qUS,'etf':qETF};
      ['us','tw','etf'].forEach(function(p) {
        localPools[p].sort(function(a,b){ return b.score-a.score; });
        var quota=quotaMap[p], picked=0;
        for (var j=0; j<localPools[p].length; j++) {
          if (picked>=quota) break;
          var cand=localPools[p][j];
          if (sel.every(function(x){ return Math.abs(calcCorr(cand.s.c,x.s.c,scoreM))<ct; }) && canPickByIndustry(cand, sel, indLimit)) { sel.push(cand); picked++; }
        }
      });
    }

        var totalQuota = poolModeSetting==='large' ? (parseInt(document.getElementById('btH').value)||5) : (parseInt($('btQuotaTW')?$('btQuotaTW').value:'2')||0)+(parseInt($('btQuotaUS')?$('btQuotaUS').value:'2')||0)+(parseInt($('btQuotaETF')?$('btQuotaETF').value:'1')||0);
    var slots = totalQuota - sel.length;
    if (slots > 0) {
      var hasSGOV = DAILY['SGOV'] && DAILY['SGOV'].length > 0 && getPriceOnDate(DAILY['SGOV'], scoreM) !== null;
      if (hasSGOV) {
        var sgovFill={s:{c:'SGOV',n:'0-3M Treasury',pool:'etf',tw:false},score:0,r240:0,zm:0,zb:0,zs:0,zv:0,zk:0};
        for (var ks2=0; ks2<slots; ks2++) sel.push(sgovFill);
      } else {
        var cashFill={s:{c:'CASH',n:'Cash',pool:'etf',tw:false},score:0,r240:0,zm:0,zb:0,zs:0,zv:0,zk:0};
        for (var ks3=0; ks3<slots; ks3++) sel.push(cashFill);
      }
    }

    var selS=[];
    if (shortN>0) {
      var longMap={};
      sel.forEach(function(r){ longMap[r.s.c]=1; });
      var sCands=valid.filter(function(r){ return !longMap[r.s.c]; });
      if (shortTSF) sCands=sCands.filter(function(r){ return r.r240!==null&&r.r240<0; });
      sCands.sort(function(a,b){ return a.score-b.score; });
      for (var ks=0; ks<sCands.length&&selS.length<shortN; ks++) {
        var candS=sCands[ks];
        if (selS.every(function(x){ return Math.abs(calcCorr(candS.s.c,x.s.c,scoreM))<ct; })) selS.push(candS);
      }
    }


    var exposure=1.0;
    if (regimeOn&&isBearishRegime(refDaily,scoreM,60)) exposure=regimeExp/100;

    var target={};
    if (!sel.length) {
      target['CASH']=1.0;
    } else {
      var is1330=capMode==='1330';
      // Capital Mode:
      // - 130/30: no shorts => 100% long; with shorts => 130% long / 30% short.
      // - 50/50: no shorts => 50% long, residual 50% to SGOV/CASH; with shorts => 50% long / 50% short.
      var lScale=is1330?1.0:0.5, sScale=0.0;
      if (shortN>0&&selS&&selS.length>0) { lScale=is1330?1.3:0.5; sScale=is1330?0.3:0.5; }
      if (wtMode==='rank') {
        var ldenom=sel.length*(sel.length+1)/2;
        sel.forEach(function(r,i){ target[r.s.c]=lScale*((sel.length-i)/ldenom)*exposure; });
      } else if (wtMode==='ivol') {
        var volSum=0;
        var ivolArr=sel.map(function(r){
          var bars=DAILY[r.s.c];
          var cut=bars.filter(function(b){ return b.date<=scoreM; });
          var v=calcVolatility(cut,60);
          v=(v&&v>0)?v:0.20;
          volSum+=1/v;
          return {c:r.s.c,iv:1/v};
        });
        ivolArr.forEach(function(x){ target[x.c]=(lScale*x.iv/volSum)*exposure; });
      } else {
        var lw=(lScale/sel.length)*exposure;
        sel.forEach(function(r){ target[r.s.c]=lw; });
      }
      if (shortN>0&&selS&&selS.length>0) {
        var sdenom=wtMode==='rank'?selS.length*(selS.length+1)/2:selS.length;
        selS.forEach(function(r,i){
          var weight=(wtMode==='rank')?((selS.length-i)/sdenom):(1/sdenom);
          target[r.s.c]=-sScale*weight*exposure;
        });
      }
    }

    var totalW=0;
    Object.keys(target).forEach(function(c){ totalW+=target[c]; });
    var cashW=1.0-totalW;
    if (cashW>0.001) {
      var useSgovForResidual = (capMode==='neutral' && shortN===0 && DAILY['SGOV'] && DAILY['SGOV'].length>0 && getPriceOnDate(DAILY['SGOV'], scoreM)!==null);
      var residualCode = useSgovForResidual ? 'SGOV' : 'CASH';
      target[residualCode]=(target[residualCode]||0)+cashW;
    }

    var shield = getShieldDecision(scoreM);
    if (shield.enabled && !shield.ok) {
      var shieldCode = (DAILY['SGOV'] && DAILY['SGOV'].length && getPriceOnDate(DAILY['SGOV'], prevM)!==null && getPriceOnDate(DAILY['SGOV'], sigM)!==null) ? 'SGOV' : 'CASH';
      target = {};
      target[shieldCode] = 1.0;
    }

    var turnover=0;
    var allT=Object.keys(holdings).concat(Object.keys(target));
    var seenT={};
    allT.forEach(function(c){
      if(seenT[c]) return; seenT[c]=1;
      var oldW=holdings[c]||0, newW=target[c]||0;
      turnover+=Math.abs(newW-oldW);
    });
    turnover/=2;

    var baseSlippage=0.001;
    var impactMultiplier=Math.max(1,Math.pow(turnover/0.2,1.5));
    var impactCost=baseSlippage*impactMultiplier;
    var friction=(turnover*COST)+impactCost;

    var cashRet=0;
    if (DAILY['SGOV']&&getPriceOnDate(DAILY['SGOV'],prevM)&&getPriceOnDate(DAILY['SGOV'],sigM)) {
      var s0=getPriceOnDate(DAILY['SGOV'],prevM), s1=getPriceOnDate(DAILY['SGOV'],sigM);
      cashRet=s1/s0-1;
    } else {
      var cr=getTNXRate(scoreM), cashDivisor=(freq==="2")?24:12;
      var CASH_FACTOR=0.7; // approximate cash rate discount when SGOV unavailable
      cashRet=(cr*CASH_FACTOR)/cashDivisor;
    }

    var stockRets={};
    Object.keys(target).forEach(function(c){
      if (c==='CASH') { stockRets[c]={ret:cashRet,w:target[c]}; }
      else {
        var p0=getPriceOnDate(DAILY[c],prevM), p1=getPriceOnDate(DAILY[c],sigM);
        var retVal=(p0&&p1&&p0>0)?(p1/p0-1):null;
        stockRets[c]={ret:retVal, w:target[c]};
      }
    });

    var grossRet=0, validTarget={}, forcedCash=0;
    for (var c in target) {
      var w=target[c], rData=stockRets[c];
      if (rData.ret===null) { forcedCash+=w; stockRets[c]={ret:0,w:0,note:'Missing'}; }
      else { grossRet+=w*rData.ret; validTarget[c]=w; }
    }
    if (forcedCash>0) {
      validTarget['CASH']=(validTarget['CASH']||0)+forcedCash;
      grossRet+=forcedCash*cashRet;
      stockRets['CASH']={ret:cashRet,w:validTarget['CASH']};
    }
    if (!isFinite(grossRet)||grossRet<=-0.9999) grossRet=-0.9999;

    var netRet=(1-friction)*(1+grossRet)-1;
    nav*=(1+netRet);

    var drifted={};
    for (var c in validTarget) {
      drifted[c]=(validTarget[c]*(1+(stockRets[c]?stockRets[c].ret:0)))/(1+grossRet);
    }

    var b0=getPriceOnDate(refDaily,prevM), b1=getPriceOnDate(refDaily,sigM);
    if (b0&&b1&&b0>0) bNav*=(1+(b1/b0-1));

    var hCopy={};
    Object.keys(target).forEach(function(k){ hCopy[k]=target[k]; });
    var recPeriod = prevM + " ~ " + sigM;
    records.push({month:sigM,period:recPeriod,nav:nav,bNav:bNav,holdings:hCopy,pRet:netRet,hurdle:hurdle,stockRets:stockRets,scoringM:scoreM,shield:shield});
    holdings=drifted;
  }
  return records.length>=6 ? records : null;
}

function kpi(records, init) {
  init = init || (gv('btCap')||100000);
  if (!records||!records.length) return {cagr:0,mdd:0,sharpe:0,nav:init};
  var last=records[records.length-1];
  var yrs=(new Date(last.month)-new Date(records[0].month))/(365.25*86400000);
  var tr=last.nav/init-1, cagr=yrs>0?Math.pow(1+Math.max(tr,-0.999),1/yrs)-1:0;
  var pk=init, mdd=0;
  records.forEach(function(r){ if(r.nav>pk)pk=r.nav; var dd=(r.nav-pk)/pk; if(dd<mdd)mdd=dd; });
  var rets=records.map(function(r){ return r.pRet; });
  var avg=rets.reduce(function(a,b){return a+b;},0)/rets.length;
  var variance=rets.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/(rets.length>1?rets.length-1:1);
  var periods=getAnnualPeriods();
  var std=Math.sqrt(variance)*Math.sqrt(periods)||1;
  return {cagr:cagr,mdd:mdd,sharpe:(cagr-0.015)/std,nav:last.nav};
}


function runTNBacktest() {
  if (!Object.keys(DAILY).length) { alert('Fetch data first'); return; }
  var tn=Math.max(0,Math.min(22,parseInt($('btSignalTN')?$('btSignalTN').value:'10')||0));
  SKIP_MO=false;
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  sl('btLog','Calculating fair T-'+tn+' backtest...',null); showL('T-'+tn+' Fair Backtesting...');
  setTimeout(async function() {
    try {
      await ensureCacheBuilt('backtest');
      var mh=parseInt($('btH')?$('btH').value:'3')||3;
      var mode=getWeightMode(), init=gv('btCap')||100000;
      var records=runBTcore(mh,mode,{signalN:tn});
      if (!records) { alert('Not enough data'); hideL(); return; }
      BT_RESULT={records:records,initial:init,mode:mode,mh:mh,signalTN:tn};
      renderBT(records,init,mode);
      var dStart=records[0].month, dEnd=records[records.length-1].month;
      sl('btLog','T-'+tn+' 公平回測完成: '+dStart+' 至 '+dEnd+' | 訊號=T-'+tn+'；交易=T月底→T+1月底',true);
    } catch(err) {
      sl('btLog','Error: '+err.message,false); console.error(err);
    } finally { hideL(); }
  }, 80);
}

function runBT() {
  if (!Object.keys(DAILY).length) { alert('Fetch data first'); return; }
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  sl('btLog','Calculating...',null); showL('Backtesting...');
  setTimeout(async function() {
    try {
      await ensureCacheBuilt('backtest');
      var mh=parseInt($('btH')?$('btH').value:'3')||3;
      var mode=getWeightMode(), init=gv('btCap')||100000;
      var records=runBTcore(mh,mode);
      if (!records) { alert('Not enough data'); hideL(); return; }
      BT_RESULT={records:records,initial:init,mode:mode,mh:mh};
      renderBT(records,init,mode);
      var dStart=records[0].month, dEnd=records[records.length-1].month;
      sl('btLog','\u56de\u6e2c\u5b8c\u6210: '+dStart+' \u81f3 '+dEnd+' (\u5171 '+records.length+' \u671f)',true);
    } catch(err) { sl('btLog','Error: '+err.message,false); console.error(err); }
    finally { hideL(); }
  }, 80);
}

// FIX4: runCompare - origH saved, restore in finally
function runCompare() {
  if (!Object.keys(DAILY).length) { alert('Fetch data first'); return; }
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  var maxN=parseInt($('btH')?$('btH').value:'5')||5, mode=getWeightMode();
  var elMode=document.getElementById('poolMode');
  var origMode=elMode?elMode.value:'large';
  var origH=$('btH')?$('btH').value:'5';
  if (elMode) elMode.value='large';
  sl('btLog','Comparing N=1 to '+maxN+'...',null); showL('Comparing...');
  setTimeout(async function() {
    try {
      await ensureCacheBuilt('backtest');
      var init=gv('btCap')||100000, results=[];
      for (var n=1; n<=maxN; n++) {
        if ($('btH')) $('btH').value=n;
        var recs=runBTcore(n,mode);
        if (recs) results.push({n:n,recs:recs,k:kpi(recs,init)});
      }
      if (!results.length) { alert('No results'); return; }
      renderCompare(results,init,mode);
      var dStart=results[0].recs[0].month;
      var dEnd=results[0].recs[results[0].recs.length-1].month;
      sl('btLog','\u6bd4\u8f03\u5b8c\u6210 N=1~'+maxN+' | \u671f\u9593: '+dStart+' \u81f3 '+dEnd,true);
    } catch(err) { sl('btLog','Error: '+err.message,false); console.error(err); }
    finally {
      if (elMode) elMode.value=origMode;
      if ($('btH')) $('btH').value=origH;
      hideL();
    }
  }, 80);
}
var CMP_COLORS=['#ff6b9d','#a78bfa','#00d4aa','#ffb830','#4d9fff','#00e5a0','#ff4d6d','#7eb8ff'];
function renderCompare(results,init,mode) {
  $('btRes').classList.remove('hidden');
  var fmt=function(v,p,pl){return (pl&&v>=0?'+':'')+(p?(v*100).toFixed(2)+'%':v.toFixed(2));};
  var html='<div class="tw-wrap" style="margin-bottom:10px"><table><thead><tr><th>N</th><th>Weight</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Final NAV</th></tr></thead><tbody>';
  results.forEach(function(res,i){
    var k=res.k;
    html+='<tr><td class="mono" style="font-weight:700;color:'+CMP_COLORS[i%CMP_COLORS.length]+'">'+res.n+'</td>'
      +'<td style="font-size:10px;color:var(--mu)">'+(mode==='rank'?'Rank':'Equal')+'</td>'
      +'<td class="mono" style="color:'+(k.cagr>=0?'var(--gr)':'var(--re)')+'">'+fmt(k.cagr,true,true)+'</td>'
      +'<td class="mono" style="color:var(--re)">'+fmt(k.mdd,true)+'</td>'
      +'<td class="mono" style="color:'+(k.sharpe>=1?'var(--gr)':k.sharpe>=0?'var(--ye)':'var(--re)')+'">'+k.sharpe.toFixed(2)+'</td>'
      +'<td class="mono" style="color:var(--wh)">$'+Math.round(k.nav).toLocaleString()+'</td></tr>';
  });
  html+='</tbody></table></div>';
  $('btMetrics').innerHTML=html;
  $('chartArea').style.display='block'; $('btnChart').textContent='Hide Charts';
  if(CHART.n)CHART.n.destroy(); if(CHART.d)CHART.d.destroy();
  var labels=results[0].recs.map(function(r){return r.month;});
  var datasets=results.map(function(res,i){return {label:'N='+res.n,data:res.recs.map(function(r){return r.nav;}),borderColor:CMP_COLORS[i%CMP_COLORS.length],borderWidth:2,pointRadius:0};});
  datasets.push({label:'TAIEX',data:results[0].recs.map(function(r){return r.bNav;}),borderColor:'#3d4a66',borderWidth:1,pointRadius:0});
  var sc={x:{ticks:{color:'#6b7a99',maxTicksLimit:12},grid:{color:'#1a2030'}},y:{ticks:{color:'#6b7a99'},grid:{color:'#1a2030'}}};
  var opt={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},animation:{duration:200},plugins:{legend:{labels:{color:'#6b7a99',boxWidth:10,font:{size:11}}}}};
  CHART.n=new Chart($('navC').getContext('2d'),{type:'line',data:{labels:labels,datasets:datasets},options:Object.assign({},opt,{scales:Object.assign({},sc,{y:Object.assign({},sc.y,{type:'logarithmic'})})})});
  $('btBody').innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--mu);padding:12px;font-size:12px">Run single backtest to see monthly holdings detail.</td></tr>';
}

function renderBT(records,init,mode) {
  var recs=records; $('btRes').classList.remove('hidden');
  var last=recs[recs.length-1];
  var yrs=(new Date(last.month)-new Date(recs[0].month))/(365.25*86400000);
  var tr=last.nav/init-1, cagr=yrs>0?Math.pow(1+Math.max(tr,-0.999),1/yrs)-1:0;
  var btr=last.bNav/init-1, bcagr=yrs>0?Math.pow(1+Math.max(btr,-0.999),1/yrs)-1:0;
  var pk=init, mdd=0;
  recs.forEach(function(r){if(r.nav>pk)pk=r.nav;var dd=(r.nav-pk)/pk;if(dd<mdd)mdd=dd;});
  var rets=recs.map(function(r){return r.pRet;});
  var avg=rets.reduce(function(a,b){return a+b;},0)/rets.length;
  var std=Math.sqrt(rets.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/(rets.length>1?rets.length-1:1))*Math.sqrt(12)||1;
  var sh=(cagr-0.015)/std;
  var fmt=function(v,p,pl){return (pl&&v>=0?'+':'')+(p?(v*100).toFixed(2)+'%':v.toFixed(2));};
  var modeLabel=mode==='rank'?'Rank-Weighted':'Equal-Weighted';
  $('btMetrics').innerHTML=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
    +'<div class="card" style="border-top:3px solid var(--tw);">'
    +'<div class="ct">Strategy V1.9 ('+modeLabel+')</div>'
    +'<div class="mr"><span>Final NAV</span><span class="mv wh">$'+Math.round(last.nav).toLocaleString()+'</span></div>'
    +'<div class="mr"><span>Return</span><span class="mv '+(tr>=0?'tg':'tr')+'">'+fmt(tr,true,true)+'</span></div>'
    +'<div class="mr"><span>CAGR</span><span class="mv">'+fmt(cagr,true)+'</span></div>'
    +'<div class="mr"><span>MDD</span><span class="mv tr">'+fmt(mdd,true)+'</span></div>'
    +'<div class="mr"><span>Sharpe</span><span class="mv tg">'+sh.toFixed(2)+'</span></div>'
    +'</div>'
    +'<div class="card" style="border-top:3px solid var(--mu);">'
    +'<div class="ct">TAIEX Benchmark</div>'
    +'<div class="mr"><span>Return</span><span class="mv '+(btr>=0?'tg':'tr')+'">'+fmt(btr,true,true)+'</span></div>'
    +'<div class="mr"><span>CAGR</span><span class="mv">'+fmt(bcagr,true)+'</span></div>'
    +'<div class="mr"><span>Alpha</span><span class="mv '+((cagr-bcagr)>=0?'tg':'tr')+'">'+fmt(cagr-bcagr,true,true)+'</span></div>'
    +'</div></div>';

  if ($('chartArea').style.display!=='none') {
    if(CHART.n)CHART.n.destroy(); if(CHART.d)CHART.d.destroy();
    var lbs=recs.map(function(r){return r.month.slice(2,7);});
    var navs=recs.map(function(r){return r.nav;}), bnavs=recs.map(function(r){return r.bNav;});
    var dds=[],bdds=[];
    var p=init,bp=init;
    recs.forEach(function(r){
      if(r.nav>p)p=r.nav; dds.push((r.nav-p)/p*100);
      if(r.bNav>bp)bp=r.bNav; bdds.push((r.bNav-bp)/bp*100);
    });
    Chart.defaults.color='#6b7a99';
    Chart.defaults.font.family="'IBM Plex Mono', monospace";
    var ctxN=$('navC').getContext('2d'), ctxD=$('ddC').getContext('2d');
    CHART.n=new Chart(ctxN,{type:'line',data:{labels:lbs,datasets:[
      {label:'Strategy',data:navs,borderColor:'#ff6b9d',borderWidth:2,pointRadius:0,tension:0.1},
      {label:'TAIEX',data:bnavs,borderColor:'#4d9fff',borderWidth:1.5,borderDash:[3,3],pointRadius:0,tension:0.1}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:12,font:{size:10}}}},scales:{x:{grid:{color:'#252d3d'},ticks:{maxTicksLimit:8,font:{size:9}}},y:{grid:{color:'#252d3d'},ticks:{font:{size:10}}}}}});
    CHART.d=new Chart(ctxD,{type:'line',data:{labels:lbs,datasets:[
      {label:'Strat DD%',data:dds,borderColor:'#ff4d6d',backgroundColor:'rgba(255,77,109,0.1)',borderWidth:1,fill:true,pointRadius:0,tension:0.1},
      {label:'Bench DD%',data:bdds,borderColor:'#6b7a99',borderWidth:1,borderDash:[2,2],pointRadius:0,tension:0.1}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{grid:{color:'#252d3d'},ticks:{font:{size:10}},max:0}}}});
  }

  $('btBody').innerHTML=recs.slice().reverse().map(function(r,ri){
    var idx2=recs.length-1-ri;
    var pb=idx2>0?recs[idx2-1].bNav:init;
    var prevNav=idx2>0?recs[idx2-1].nav:init;
    var bRet=r.bNav/pb-1;
    var ex=r.pRet-bRet;
    var rc=r.pRet>=0?'var(--gr)':'var(--re)';
    var ec=ex>=0?'var(--gr)':'var(--re)';
    var holdStr=Object.keys(r.holdings).map(function(k){
      var wt=r.holdings[k];
      var isShort=wt<0;
      var isUs=!!(document.querySelector('[data-code="'+k+'"][data-tw="0"]'));
      var col=isShort?'var(--bl)':(isUs?'var(--us)':'var(--tw)');
      var bg=isShort?'var(--bld)':(isUs?'var(--usd)':'var(--twd)');
      var bst=isShort?'dashed':'solid';
      var nm=getStockName(k);
      var pct=Math.abs(wt*100).toFixed(0)+'%';
      var lbl=(isShort?'S ':'')+k+(nm&&nm!==k?' '+nm:'');
      return '<span style="background:'+bg+';color:'+col+';border:1px '+bst+' '+col+';padding:1px 6px;border-radius:3px;font-size:10px;font-family:monospace;margin:1px;">'+lbl+' '+pct+'</span>';
    }).join('');
    var summaryRow='<tr style="border-top:2px solid var(--bd);">'
      +'<td class="mono" style="font-weight:700;vertical-align:top;">'+r.month+(r.scoringM?'<div style="font-size:9px;color:var(--mu)">\u9078\u80a1:'+r.scoringM+'</div>':'')+'</td>'
      +'<td style="vertical-align:top;">'+holdStr+'</td>'
      +'<td class="mono" style="font-size:10px;color:var(--bl);vertical-align:top;">'+(r.hurdle*100).toFixed(1)+'%</td>'
      +'<td class="mono" style="color:'+rc+';font-weight:700;vertical-align:top;">'+(r.pRet>=0?'+':'')+(r.pRet*100).toFixed(2)+'%</td>'
      +'<td class="mono" style="color:var(--tw);font-weight:700;vertical-align:top;">$'+Math.round(r.nav).toLocaleString()+'</td>'
      +'<td class="mono" style="color:var(--mu);vertical-align:top;">$'+Math.round(r.bNav).toLocaleString()+'</td>'
      +'<td class="mono" style="color:'+ec+';font-weight:700;vertical-align:top;">'+(ex>=0?'+':'')+(ex*100).toFixed(2)+'pp</td>'
      +'</tr>';
    var detailRows='';
    if (r.stockRets) {
      Object.keys(r.stockRets).forEach(function(k){
        var sr=r.stockRets[k], ret=sr.ret, w=sr.w||0;
        var contrib=ret*w, pnl=prevNav*contrib;
        var isShortPos=w<0;
        var isUs=!!(document.querySelector('[data-code="'+k+'"][data-tw="0"]'));
        var col=isShortPos?'var(--bl)':(isUs?'var(--us)':'var(--tw)');
        var rc2=contrib>=0?'var(--gr)':'var(--re)';
        var nm=getStockName(k);
        var dirLabel=isShortPos?'[S] ':'';
        var absPct=Math.abs(w*100).toFixed(0)+'%';
        detailRows+='<tr style="background:var(--bg);opacity:0.85;">'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);"></td>'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);font-family:monospace;font-size:11px;color:'+col+';">'
          +dirLabel+k+(nm&&nm!==k?' <span style="color:var(--mu);font-size:10px;">'+nm+'</span>':'')
          +' <span style="color:var(--mu);font-size:10px;">'+absPct+'</span>'
          +'</td>'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);"></td>'
          +'<td class="mono" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:11px;color:var(--mu);">'
          +(ret>=0?'+':'')+(ret*100).toFixed(2)+'%'
          +'</td>'
          +'<td class="mono" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:11px;color:'+rc2+';">'
          +(pnl>=0?'+$':'-$')+Math.abs(Math.round(pnl)).toLocaleString()
          +'</td>'
          +'<td colspan="2" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:10px;color:'+rc2+';">'
          +'contrib: '+(contrib>=0?'+':'')+(contrib*100).toFixed(2)+'%'
          +(sr.entry?'<span style="font-size:9px;color:var(--mu);margin-left:6px;font-family:monospace">T-9:'+sr.entry+'</span>':'')+'</td></tr>';
      });
    }
    return summaryRow+detailRows;
  }).join('');
}

function pct(v,d){return (v>=0?'+':'')+(v*100).toFixed(d===undefined?1:d)+'%';}
function median(arr){if(!arr.length)return 0;var s=arr.slice().sort(function(a,b){return a-b;});var m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function percentile(arr,p){if(!arr.length)return 0;var s=arr.slice().sort(function(a,b){return a-b;});var i=(p/100)*(s.length-1);var lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);}

function runRolling() {
  if (!BT_RESULT) { alert('Run backtest first'); return; }
  var recs=BT_RESULT.records, init=BT_RESULT.initial;
  var periods=[1,2,3,5].filter(function(n){var e=$('rl'+n);return e&&e.checked;});
  if (!periods.length) { alert('Select at least one period'); return; }
  var res={};
  var freq=getFreq();
  periods.forEach(function(N){
    var mo=(freq==="2")?N*24:N*12, wins=[];
    for (var i=0; i+mo<=recs.length; i++) {
      var sub=recs.slice(i,i+mo);
      var navS=i>0?recs[i-1].nav:init, navE=sub[sub.length-1].nav;
      var cagr=Math.pow(navE/navS,1/N)-1;
      var bNavS=i>0?recs[i-1].bNav:init, bNavE=sub[sub.length-1].bNav;
      var bcagr=Math.pow(bNavE/bNavS,1/N)-1;
      var rets=sub.map(function(r){return r.pRet;});
      var avg=rets.reduce(function(a,b){return a+b;},0)/rets.length;
      var variance=rets.reduce(function(a,b){return a+(b-avg)*(b-avg);},0)/rets.length;
      var std=Math.sqrt(variance)*Math.sqrt(freq==="2"?24:12);
      var sharpe=std>0?(cagr-0.015)/std:0;
      var peak=navS, mdd=0;
      sub.forEach(function(r){if(r.nav>peak)peak=r.nav;var dd=(r.nav-peak)/peak;if(dd<mdd)mdd=dd;});
      wins.push({cagr:cagr,bcagr:bcagr,std:std,sharpe:sharpe,mdd:mdd});
    }
    res[N]=wins;
  });
  renderRolling(res,periods);
}

function renderRolling(res,periods) {
  var el=$('rollingRes');
  if(!el)return; el.classList.remove('hidden');
  var fmt=function(v,d){return (v>=0?'+':'')+(v*100).toFixed(d===undefined?1:d)+'%';};
  var fmtN=function(v,d){return v.toFixed(d===undefined?2:d);};
  var gc=function(v){return v>=0?'var(--gr)':'var(--re)';};
  var html='<div class="card"><div class="ct">\u6ede\u52d5\u5831\u916c\u5206\u6790 (CAGR)</div>';
  periods.forEach(function(N){
    var ws=res[N]; if(!ws||!ws.length)return;
    var cagrs=ws.map(function(w){return w.cagr;}), bcagrs=ws.map(function(w){return w.bcagr;}), stds=ws.map(function(w){return w.std;}), sharpes=ws.map(function(w){return w.sharpe;}), mdds=ws.map(function(w){return w.mdd;});
    var winRate=cagrs.filter(function(v){return v>0;}).length/cagrs.length;
    var beatRate=ws.filter(function(w){return w.cagr>w.bcagr;}).length/ws.length;
    html+='<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:var(--tw);margin-bottom:6px">'+N+' \u5e74 ('+ws.length+' \u7a97\u53e3)</div><div class="tw-wrap" style="max-height:none"><table><thead><tr><th>\u6307\u6a19</th><th>\u4e2d\u4f4d</th><th>\u5e73\u5747</th><th>P10</th><th>P90</th><th>\u52dd\u7387</th><th>\u8d85TAIEX</th></tr></thead><tbody>';
    var rows=[['\u5e74\u5316CAGR',cagrs,true],['\u5e74\u5316\u6a19\u6e96\u5dee',stds,false],['Sharpe',sharpes,false],['MDD',mdds,true]];
    rows.forEach(function(row){
      var label=row[0],arr=row[1],isCagr=row[2];
      var med=median(arr),avg=arr.reduce(function(a,b){return a+b;},0)/arr.length,p10=percentile(arr,10),p90=percentile(arr,90);
      var isPct=label!=='Sharpe', f=function(v){return isPct?fmt(v,1):fmtN(v,2);};
      html+='<tr><td style="color:var(--mu);font-size:10px">'+label+'</td><td class="mono" style="color:'+gc(med)+'">'+f(med)+'</td><td class="mono" style="color:'+gc(avg)+'">'+f(avg)+'</td><td class="mono" style="color:'+gc(p10)+'">'+f(p10)+'</td><td class="mono" style="color:'+gc(p90)+'">'+f(p90)+'</td>';
      if(isCagr&&label==='\u5e74\u5316CAGR'){html+='<td class="mono" style="color:var(--gr)">'+(winRate*100).toFixed(0)+'%</td><td class="mono" style="color:var(--ye)">'+(beatRate*100).toFixed(0)+'%</td>';}else{html+='<td></td><td></td>';}
      html+='</tr>';
    });
    var bmed=median(bcagrs),bavg=bcagrs.reduce(function(a,b){return a+b;},0)/bcagrs.length,bp10=percentile(bcagrs,10),bp90=percentile(bcagrs,90),bwin=bcagrs.filter(function(v){return v>0;}).length/bcagrs.length;
    html+='<tr style="border-top:1px solid var(--bhi)"><td style="color:var(--mu);font-size:10px">TAIEX CAGR</td><td class="mono" style="color:'+gc(bmed)+'">'+fmt(bmed,1)+'</td><td class="mono" style="color:'+gc(bavg)+'">'+fmt(bavg,1)+'</td><td class="mono" style="color:'+gc(bp10)+'">'+fmt(bp10,1)+'</td><td class="mono" style="color:'+gc(bp90)+'">'+fmt(bp90,1)+'</td><td class="mono" style="color:var(--mu)">'+(bwin*100).toFixed(0)+'%</td><td></td></tr></tbody></table></div></div>';
  });
  html+='</div>'; el.innerHTML=html;
}

function toggleCharts(btn) {
  var area=$('chartArea'); if(!area)return;
  var hidden=area.style.display==='none'; area.style.display=hidden?'block':'none';
  btn.textContent=hidden?'Hide Charts':'Show Charts (NAV / MDD)';
  if(hidden&&CHART.n){CHART.n.resize();if(CHART.d)CHART.d.resize();}
}
// FIX1: all ghost variable references removed
function dlJson() {
  if (!DAILY || !Object.keys(DAILY).length) { sl('dlLog','No data',false); return; }
  var obj = { ts: new Date().toISOString(), DAILY: DAILY };
  dlBlob(new Blob([JSON.stringify(obj)],{type:'application/json'}), 'V1.9_'+new Date().toISOString().slice(0,10)+'.json');
  sl('dlLog','JSON downloaded',true);
}
function dlOHLCV() {
  var rows=['code,date,o,h,l,c,v'];
  Object.keys(DAILY).forEach(function(k){ DAILY[k].forEach(function(w){ rows.push(k+','+w.date+','+w.o+','+w.h+','+w.l+','+w.c+','+w.v); }); });
  dlText(rows.join('\n'),'V1.9_OHLCV_'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');
  sl('dlLog','OHLCV CSV downloaded',true);
}
function dlMonthly() { alert('V1.9 uses DAILY data natively. Please use OHLCV export.'); }
function dlBtCsv() {
  if (!BT_RESULT) { sl('btLog','Run backtest first',false); return; }
  var recs=BT_RESULT.records, init=BT_RESULT.initial, rows=['Date,Holdings,Hurdle%,Return%,NAV,BenchNav,Alpha%'];
  recs.forEach(function(r,i){
    var pb=i>0?recs[i-1].bNav:init; var ex=r.pRet-(r.bNav/pb-1);
    var hold=Object.keys(r.holdings).map(function(k){ var nm=getStockName(k); return k+(nm&&nm!==k?'('+nm+')':'')+(r.holdings[k]<0.99?' '+(r.holdings[k]*100).toFixed(0)+'%':''); }).join('+');
    rows.push([r.month,hold,(r.hurdle*100).toFixed(2),(r.pRet*100).toFixed(3),Math.round(r.nav),Math.round(r.bNav),(ex*100).toFixed(3)].join(','));
  });
  dlText(rows.join('\n'),'V1.9_Backtest_'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');
}
async function upJson(el) {
  var file=el.files[0]; if(!file)return;
  sl('dlLog','Loading '+file.name+'...',null);
  try {
    var text=await file.text(); var obj=JSON.parse(text);
    if(!obj.DAILY){ sl('dlLog','Error: no DAILY field',false); return; }
    DAILY=obj.DAILY||{};
    updFetchStat(); updTNX(); markCacheDirty('jsonUpload'); await saveAllToDB();
    sl('dlLog','Loaded! Cache 延後到信號/回測前自動重建。',true);
  } catch(err){ sl('dlLog','Error: '+err.message,false); }
  el.value='';
}
async function clearAndReset() {
  if(!confirm('Clear all cached data and IndexedDB?'))return;
  await new Promise(function(resolve){
    var req = indexedDB.deleteDatabase('FearlessConsoleDB');
    req.onsuccess = req.onerror = req.onblocked = function(){ resolve(); };
  });
  DAILY={}; CACHE_BUILT=false; CACHE_TS=null; RAW_SCORES={};
  resetDerivedViews('clearAndReset');
  sl('dlLog','DB cleared. Please run Fetch All.',true);
  updFetchStat(); updCacheSt();
}
function debugDataLen() {
  var keys=Object.keys(DAILY); var msg='DAILY stocks: '+keys.length;
  if(keys.length){
    msg+='\n'+keys[0]+': '+DAILY[keys[0]].length+' days';
    msg+='\n'+keys[keys.length-1]+': '+DAILY[keys[keys.length-1]].length+' days';
  }
  msg+='\nRAW_SCORES keys: '+Object.keys(RAW_SCORES).length; alert(msg);
}

// FIX5: checkDataHealth - no emoji in JS strings
function checkDataHealth() {
  var stocks=getEnabledStocks(); var now=new Date(); var tbody=$('healthBody');
  var staleNum=0, totalDelay=0, html='';
  stocks.forEach(function(s){
    var data=DAILY[s.c]; var delay=999, lastD='\u7121\u8cc7\u6599';
    if(data&&data.length>0){
      var lastDate=new Date(data[data.length-1].date);
      lastD=data[data.length-1].date;
      delay=Math.floor((now-lastDate)/(1000*60*60*24));
    }
    var isStale=delay>5; if(isStale)staleNum++; if(delay!==999)totalDelay+=delay;
    var statusLabel=isStale
      ? '<span style="color:var(--re)">\u2718 \u9700\u66f4\u65b0</span>'
      : '<span style="color:var(--te)">\u2714 \u6b63\u5e38</span>';
    html+='<tr>'
      +'<td>'+(s.tw?'TW \u53f0\u80a1':'US \u7f8e\u80a1')+'</td>'
      +'<td class="mono">'+s.c+'</td>'
      +'<td class="mono">'+lastD+'</td>'
      +'<td class="mono">'+(delay===999?'?':delay+'d')+'</td>'
      +'<td>'+statusLabel+'</td>'
      +'</tr>';
  });
  tbody.innerHTML=html||'<tr><td colspan="5">\u7121\u555f\u7528\u4e2d\u7684\u6a19\u7684</td></tr>';
  $('staleCount').textContent=staleNum;
  $('avgDelay').textContent=stocks.length?(totalDelay/stocks.length).toFixed(1):0;
}
async function calcSignal() {
  if(!Object.keys(DAILY).length){ alert('請先抓取或載入資料'); return; }
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  await ensureCacheBuilt('signal');
  var stocks=getEnabledStocks().filter(function(s){ return RAW_SCORES[s.c]; });
  if(!stocks.length)return;
  var masterTicker = DAILY['^TWII'] ? '^TWII' : (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : stocks[0].c));
  var refDaily = DAILY[masterTicker];
  var sigInfo = getSignalTNInfo(refDaily);
  if (!sigInfo) { alert('找不到 Signal Month 資料。請輸入 YYYY-MM，或確認資料已載入。'); return; }
  var sigN = sigInfo.N;
  if (!sigInfo.ready) {
    $('sigContent').innerHTML = '<div class="ib2" style="border-left:3px solid var(--ye);color:var(--ye)">尚未到達 T-'+sigN+' 訊號日<br>月份: <b>'+sigInfo.ym+'</b><br>T（月末）: <b>'+sigInfo.T+'</b> '+(sigInfo.source==='estimated'?'(依週一至週五估算)':'')+'<br>T-'+sigN+': <b>'+sigInfo.tN+'</b><br>最新資料: <b>'+sigInfo.lastDate+'</b></div>';
    $('stCard').classList.add('hidden');
    return;
  }
  var latestDate = sigInfo.scoreDate || sigInfo.tN;
  buildScoreCacheForDate(latestDate);
  var hurdle=getHurdle(latestDate);
  var allScores=calcAllScores(latestDate);
  if (!allScores.length) {
    await buildCache();
    buildScoreCacheForDate(latestDate);
    allScores=calcAllScores(latestDate);
  }
  if (!allScores.length) { alert('T-'+sigN+' 訊號日 '+latestDate+' 沒有足夠資料。請先重新抓取/重建快取。'); return; }
  var mode=$('poolMode').value, ct=gv('corrT')||0.75;
  var indLimit=getIndustryLimit();
  var sel=[], rejectedMap={};
  allScores.forEach(function(r){ if(r.r240<=hurdle) rejectedMap[r.s.c]='\u0054\u0053 \u6DD8\u6C70'; });
  if(mode==='large'){
    var candidates=allScores.filter(function(r){return !rejectedMap[r.s.c];}).sort(function(a,b){return b.score-a.score;});
    var totalMax=parseInt($('btH').value)||5;
    for(var ci=0; ci<candidates.length; ci++){
      var cand=candidates[ci];
      if(sel.length>=totalMax){ rejectedMap[cand.s.c]='\u540d\u984d\u5df2\u6eff'; continue; }
      if(!sel.every(function(x){ return Math.abs(calcCorr(cand.s.c,x.s.c,latestDate))<ct; })) rejectedMap[cand.s.c]='\u76f8\u95dc\u6027\u904e\u9ad8';
      else if(!canPickByIndustry(cand, sel, indLimit)) rejectedMap[cand.s.c]='同產業限額';
      else sel.push(cand);
    }
  } else {
    var sub={'tw':[],'us':[],'etf':[]};
    allScores.filter(function(r){ return !rejectedMap[r.s.c]; }).forEach(function(r){ if(sub[r.s.pool]) sub[r.s.pool].push(r); });
    ['us','tw','etf'].forEach(function(p){
      var q={'tw':gv('btQuotaTW'),'us':gv('btQuotaUS'),'etf':gv('btQuotaETF')}[p], picked=0;
      var list=sub[p].sort(function(a,b){return b.score-a.score;});
      for(var ci2=0; ci2<list.length; ci2++){
        var cand=list[ci2];
        if(picked>=q){ rejectedMap[cand.s.c]='\u914d\u984d\u5df2\u6eff'; continue; }
        if(!sel.every(function(x){ return Math.abs(calcCorr(cand.s.c,x.s.c,latestDate))<ct; })){ rejectedMap[cand.s.c]='\u76f8\u95dc\u6027\u904e\u9ad8'; }
        else if(!canPickByIndustry(cand, sel, indLimit)){ rejectedMap[cand.s.c]='同產業限額'; }
        else { sel.push(cand); picked++; }
      }
    });
  }
  renderSig(sel,allScores.slice().sort(function(a,b){return a.score-b.score;}).slice(0,3),allScores,latestDate,hurdle);
  renderST(allScores,hurdle,sel.map(function(s){return s.s.c;}),rejectedMap,latestDate);
}

// FIX5: renderSig - no emoji in poolNames
function renderSig(sel,wk,all,date,hurdle) {
  var zf=function(v){return v!==null?(v>=0?'+':'')+v.toFixed(2):'-';};
  var pf=function(v){return v!==null?(v>=0?'+':'')+(v*100).toFixed(1)+'%':'-';};
  var tnx=getTNXRate(date);
  var sigN = $('sigTN') ? ($('sigTN').value || '10') : '10';
  var html='<div style="font-size:11px;color:var(--mu);margin-bottom:9px">Signal: <b style="color:var(--tw)">T-'+sigN+'</b> | Score Date: <b style="color:var(--tw)">'+date+'</b> | ^TNX: <b style="color:var(--bl)">'+(tnx*100).toFixed(2)+'%</b> | Hurdle: <b style="color:var(--ye)">'+(hurdle*100).toFixed(2)+'%</b><br><span style="color:var(--mu)">此為信號頁獨立觀察訊號；未指定月份時使用最新資料所在月份，若尚未到達 T-N 則提示等待；正式回測仍用純月頻/半月頻。</span></div>';
  var selPools={'us':[],'tw':[],'etf':[]};
  sel.forEach(function(r){ var p=r.s.pool; if(p==='us'||p==='tw'||p==='etf') selPools[p].push(r); });
  // FIX5: pure ASCII/unicode labels, no surrogate-pair emoji
  var poolNames={'us':'US \u7f8e\u80a1\u914d\u7f6e','tw':'TW \u53f0\u80a1\u914d\u7f6e','etf':'ETF \u914d\u7f6e'};
  var poolColors={'us':'var(--us)','tw':'var(--tw)','etf':'var(--ac)'};
  ['us','tw','etf'].forEach(function(p){
    var pItems=selPools[p];
    if(!pItems||!pItems.length)return;
    html+='<div style="font-size:13px;font-weight:700;color:'+poolColors[p]+';margin:16px 0 6px;border-bottom:1px solid '+poolColors[p]+';padding-bottom:4px">'+poolNames[p]+' (\u5165\u9078 '+pItems.length+' \u6a94)</div><div class="sg">';
    pItems.forEach(function(r,rk){
      var col=poolColors[p], rbg='var(--sf2)';
      html+='<div class="scard" style="border-left:3px solid '+col+'"><div class="shdr"><div><div class="scode" style="color:'+col+'">'+r.s.c+'</div><div class="sname">'+r.s.n+'</div></div><span class="srank" style="background:'+rbg+';color:'+col+';border:1px solid '+col+'">#'+(rk+1)+'</span></div>';
      html+='<div class="sscore">'+(r.score>=0?'+':'')+r.score.toFixed(2)+'</div><div class="sbars">';
      [['Mom',r.zm,'var(--tw)'],['Bias',r.zb,'var(--bl)'],['Slope',r.zs,'var(--te)'],['Vol',r.zv,'var(--ye)'],['Kbar',r.zk,'var(--ac)']].forEach(function(b){
        if(b[1]===null)return;
        var w=Math.round(Math.min(100,Math.abs(b[1])*25));
        html+='<div class="sbrow"><span style="width:32px">'+b[0]+'</span><div class="sbwrap"><div class="sbfill" style="width:'+w+'%;background:'+b[2]+'"></div></div><span style="width:36px;text-align:right;font-family:monospace">'+zf(b[1])+'</span></div>';
      });
      html+='</div><div style="margin-top:5px;font-size:10px;color:var(--mu);font-family:monospace">R240:'+pf(r.r240)+'</div></div>';
    });
    html+='</div>';
  });
  if(!sel.length) html+='<div style="color:var(--ye);font-size:12px;margin-bottom:9px">\u7121\u6a19\u7684\u901a\u904e TS \u8207\u5b63\u7dda\u9580\u6ebb - \u5168\u6578\u6301\u6709\u73fe\u91d1</div>';
  $('sigContent').innerHTML=html;
}

function renderST(all,hurdle,selectedCodes,rejectedMap,scoreM) {
  $('stCard').classList.remove('hidden');
  var zf=function(v){return (v!==null?(v>=0?'+':'')+v.toFixed(2):'-');};
  var pf=function(v){return (v!==null?(v>=0?'+':'')+(v*100).toFixed(1)+'%':'-');};
  var html='';
  ['tw','us','etf'].forEach(function(pKey){
    var pStocks=all.filter(function(r){return r.s.pool===pKey;}).sort(function(a,b){return b.score-a.score;});
    if(!pStocks.length)return;
    html+='<tr><td colspan="12" style="background:var(--sf2);color:var(--tx);font-weight:700;text-align:center;padding:8px;">'+pKey.toUpperCase()+' \u7af6\u722d\u6392\u884c</td></tr>';
    pStocks.forEach(function(r,i){
      var isSel=selectedCodes.indexOf(r.s.c)!==-1;
      var reason=rejectedMap[r.s.c]||'\u540d\u6b21\u9760\u5f8c';
      var status=isSel?'<span style="color:var(--gr)">\u2605 \u5165\u9078</span>':'<span style="color:var(--mu);font-size:11px">'+reason+'</span>';
      html+='<tr><td>'+(i+1)+'</td><td style="color:'+(r.s.tw?'var(--tw)':'var(--us)')+'">'+r.s.c+'</td><td>'+r.s.n+'</td><td>'+status+'</td><td>'+zf(r.score)+'</td><td>'+zf(r.zm)+'</td><td>'+zf(r.zb)+'</td><td>'+zf(r.zs)+'</td><td>'+zf(r.zv)+'</td><td>'+zf(r.zk)+'</td><td style="color:'+(r.r240>hurdle?'var(--gr)':'var(--re)')+'">'+pf(r.r240)+'</td><td>'+(isStrictTechnicalPass(r.s.c,scoreM)?'Y':'N')+'</td></tr>';
    });
  });
  $('stBody').innerHTML=html;
}
function runMonteCarlo() {
  if(!BT_RESULT){ alert('Run backtest first'); return; }
  var simN=parseInt($('stSimN')?$('stSimN').value:'1000')||1000;
  var rets=BT_RESULT.records.map(function(r){ return r.pRet; });
  var init=BT_RESULT.initial, n=rets.length;
  sl('stressLog','Running Monte Carlo x'+simN+'...',null); showL('Monte Carlo...');
  setTimeout(function(){
    try {
      var cagrs=[],mdds=[],sharpes=[];
      for(var s=0;s<simN;s++){
        var sim=[];
        for(var i=0;i<n;i++) sim.push(rets[Math.floor(Math.random()*n)]);
        var nav=init,peak=init,mdd=0;
        sim.forEach(function(r){ nav*=(1+r); if(nav>peak)peak=nav; var dd=(nav-peak)/peak; if(dd<mdd)mdd=dd; });
        var yrs=n/12, cagr=Math.pow(nav/init,1/yrs)-1;
        var avg=sim.reduce(function(a,b){return a+b;},0)/sim.length;
        var std=Math.sqrt(sim.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/sim.length)*Math.sqrt(12);
        var sharpe=std>0?(cagr-0.015)/std:0;
        cagrs.push(cagr); mdds.push(mdd); sharpes.push(sharpe);
      }
      renderStress(cagrs,mdds,sharpes,'Monte Carlo',simN);
      sl('stressLog','Monte Carlo \u5b8c\u6210 '+simN+' \u6b21',true);
    } catch(e){ sl('stressLog','Error: '+e.message,false); }
    finally{ hideL(); }
  },80);
}

function runBlockBootstrap() {
  if(!BT_RESULT){ alert('Run backtest first'); return; }
  var simN=parseInt($('stSimN')?$('stSimN').value:'1000')||1000;
  var blk=parseInt($('stBlock')?$('stBlock').value:'4')||4;
  var rets=BT_RESULT.records.map(function(r){ return r.pRet; });
  var init=BT_RESULT.initial, n=rets.length;
  sl('stressLog','Running Block Bootstrap x'+simN+' block='+blk+'...',null); showL('Block Bootstrap...');
  setTimeout(function(){
    try {
      var cagrs=[],mdds=[],sharpes=[];
      for(var s=0;s<simN;s++){
        var sim=[];
        while(sim.length<n){
          var start=Math.floor(Math.random()*(n-blk+1));
          for(var b=0;b<blk&&sim.length<n;b++) sim.push(rets[start+b]);
        }
        var nav=init,peak=init,mdd=0;
        sim.forEach(function(r){ nav*=(1+r); if(nav>peak)peak=nav; var dd=(nav-peak)/peak; if(dd<mdd)mdd=dd; });
        var yrs=n/12, cagr=Math.pow(nav/init,1/yrs)-1;
        var avg=sim.reduce(function(a,b){return a+b;},0)/sim.length;
        var std=Math.sqrt(sim.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/sim.length)*Math.sqrt(12);
        var sharpe=std>0?(cagr-0.015)/std:0;
        cagrs.push(cagr); mdds.push(mdd); sharpes.push(sharpe);
      }
      renderStress(cagrs,mdds,sharpes,'Block Bootstrap (blk='+blk+')',simN);
      sl('stressLog','Block Bootstrap \u5b8c\u6210 '+simN+' \u6b21',true);
    } catch(e){ sl('stressLog','Error: '+e.message,false); }
    finally{ hideL(); }
  },80);
}

function renderStress(cagrs,mdds,sharpes,label,simN) {
  function ptile(arr,p){var s=arr.slice().sort(function(a,b){return a-b;});var i=(p/100)*(s.length-1);var lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);}
  function avgArr(arr){return arr.reduce(function(a,b){return a+b;},0)/arr.length;}
  function fmtP(v){return (v>=0?'+':'')+(v*100).toFixed(2)+'%';}
  function fmtN(v){return v.toFixed(2);}
  function gc(v){return v>=0?'var(--gr)':'var(--re)';}
  var winRate=cagrs.filter(function(v){return v>0;}).length/simN;
  var orig=BT_RESULT.records, origInit=BT_RESULT.initial, origLast=orig[orig.length-1];
  var origYrs=(new Date(origLast.month)-new Date(orig[0].month))/(365.25*86400000);
  var origCagr=Math.pow(origLast.nav/origInit,1/origYrs)-1;
  var origRets=orig.map(function(r){return r.pRet;});
  var origAvg=avgArr(origRets);
  var origStd=Math.sqrt(origRets.reduce(function(a,b){return a+Math.pow(b-origAvg,2);},0)/origRets.length)*Math.sqrt(12);
  var origSharpe=origStd>0?(origCagr-0.015)/origStd:0;
  var origPeak=origInit,origMdd=0;
  orig.forEach(function(r){if(r.nav>origPeak)origPeak=r.nav;var dd=(r.nav-origPeak)/origPeak;if(dd<origMdd)origMdd=dd;});
  var rows=[['\u6307\u6a19 CAGR',cagrs,true,origCagr],['\u6307\u6a19 MDD',mdds,true,origMdd],['\u6307\u6a19 Sharpe',sharpes,false,origSharpe]];
  var html='<div class="card" style="border-top:3px solid var(--ac);margin-bottom:10px;">';
  html+='<div class="ct">'+label+' (N='+simN+')</div>';
  html+='<div class="tw-wrap"><table><thead><tr><th></th><th>P10</th><th>P25</th><th>P50</th><th>P75</th><th>P90</th><th>\u5e73\u5747</th><th>\u539f\u59cb</th></tr></thead><tbody>';
  rows.forEach(function(row){
    var name=row[0],arr=row[1],isPct=row[2],origVal=row[3];
    var f=isPct?fmtP:fmtN;
    var p10=ptile(arr,10),p25=ptile(arr,25),med=ptile(arr,50),p75=ptile(arr,75),p90=ptile(arr,90),av=avgArr(arr);
    html+='<tr><td style="color:var(--mu);font-size:10px">'+name+'</td>'
      +'<td class="mono" style="color:'+gc(p10)+'">'+f(p10)+'</td>'
      +'<td class="mono" style="color:'+gc(p25)+'">'+f(p25)+'</td>'
      +'<td class="mono" style="color:'+gc(med)+'">'+f(med)+'</td>'
      +'<td class="mono" style="color:'+gc(p75)+'">'+f(p75)+'</td>'
      +'<td class="mono" style="color:'+gc(p90)+'">'+f(p90)+'</td>'
      +'<td class="mono" style="color:'+gc(av)+'">'+f(av)+'</td>'
      +'<td class="mono" style="color:var(--ye)">'+f(origVal)+'</td></tr>';
  });
  html+='<tr><td style="color:var(--mu);font-size:10px">\u52dd\u7387(CAGR>0)</td>'
    +'<td colspan="7" class="mono" style="color:var(--gr)">'+(winRate*100).toFixed(1)+'%</td></tr>';
  html+='</tbody></table></div></div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}
// FIX4: runWalkForward - togglePoolUI() called on restore

function wfSafeRatio(oosCagr, isCagr) {
  if (!isFinite(oosCagr) || !isFinite(isCagr) || Math.abs(isCagr) < 1e-9) return null;
  return oosCagr / isCagr;
}
function wfRatioColor(r) {
  if (r === null || !isFinite(r)) return 'var(--mu)';
  return r >= 0.6 ? 'var(--gr)' : (r >= 0.4 ? 'var(--ye)' : 'var(--re)');
}
function wfRatioText(r) {
  return (r === null || !isFinite(r)) ? 'NA' : ((r * 100).toFixed(0) + '%');
}
function wfAvgRatio(results) {
  var arr = results.map(function(r){ return r.ratio; }).filter(function(v){ return v !== null && isFinite(v); });
  if (!arr.length) return null;
  return arr.reduce(function(a,b){ return a+b; }, 0) / arr.length;
}
function wfMedianRatio(results) {
  var arr = results.map(function(r){ return r.ratio; }).filter(function(v){ return v !== null && isFinite(v); }).sort(function(a,b){return a-b;});
  if (!arr.length) return null;
  var m = Math.floor(arr.length/2);
  return arr.length % 2 ? arr[m] : (arr[m-1] + arr[m]) / 2;
}
function wfKpiFromRecords(recs) {
  if (!recs || !recs.length) return null;
  var init = recs[0].nav / (1 + recs[0].pRet);
  return kpi(recs, init);
}

function wfCollectSettings() {
  var poolM = document.getElementById('poolMode') ? document.getElementById('poolMode').value : 'large';
  var n = poolM === 'large' ? (parseInt($('btH') ? $('btH').value : '5') || 5)
    : ((parseInt($('btQuotaTW') ? $('btQuotaTW').value : '0') || 0) + (parseInt($('btQuotaUS') ? $('btQuotaUS').value : '0') || 0) + (parseInt($('btQuotaETF') ? $('btQuotaETF').value : '0') || 0));
  var wtEl = document.querySelector('input[name="wtMode"]:checked');
  var wt = wtEl ? wtEl.value : 'eq';
  var lagEl = document.querySelector('input[name="lagMode"]:checked');
  var lag = lagEl ? lagEl.value : '1';
  var freq = getFreq();
  var regOn = $('btRegime') && $('btRegime').value === 'on';
  var regExp = gv('btRegimeExp') || 100;
  var shieldOn = $('btShieldGate') && $('btShieldGate').value === 'on';
  var shieldMA = parseInt($('btShieldMA') ? $('btShieldMA').value : '240') || 240;
  var skipMo = !!($('btSkipMo') && $('btSkipMo').checked);
  var ma60 = $('ma60Filter') ? $('ma60Filter').value : 'off';
  var cost = (gv('btC') || 0.3);
  var corrT = gv('corrT') || 0.75;
  var indLim = parseInt($('btIndLimit') ? $('btIndLimit').value : '0') || 0;
  var shortN = parseInt($('btSN') ? $('btSN').value : '0') || 0;
  var capEl = document.querySelector('input[name="capMode"]:checked');
  var capMode = capEl ? capEl.value : 'neutral';
  return {
    poolMode: poolM, n: n, wt: wt, lag: lag, freq: freq,
    regOn: regOn, regExp: regExp, shieldOn: shieldOn, shieldMA: shieldMA,
    skipMo: skipMo, ma60: ma60, cost: cost, corrT: corrT,
    indLim: indLim, shortN: shortN, capMode: capMode
  };
}
function wfSettingsTag(cfg, trainY, testY, label) {
  var parts = [];
  parts.push(label);
  parts.push('N=' + cfg.n);
  parts.push('Pool=' + (cfg.poolMode === 'large' ? 'Large' : 'Small'));
  parts.push('Wt=' + cfg.wt.toUpperCase());
  parts.push('Train=' + trainY + 'Y');
  parts.push('Test=' + testY + 'Y');
  parts.push('Freq=' + (cfg.freq === '2' ? 'Semi' : 'Mo'));
  parts.push('Lag=t-' + cfg.lag);
  if (cfg.skipMo) parts.push('SkipMo');
  if (cfg.regOn) parts.push('Regime(' + cfg.regExp + '%)');
  if (cfg.shieldOn) parts.push('Shield(' + cfg.shieldMA + 'd)');
  if (cfg.ma60 === 'on') parts.push('MA60');
  if (cfg.shortN > 0) parts.push('Short=' + cfg.shortN);
  if (cfg.indLim > 0) parts.push('IndLim=' + cfg.indLim);
  return parts.join(' | ');
}

function runWalkForward() {
  if(!Object.keys(DAILY).length){ alert('請先抓取或載入資料'); return; }
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  var minTY=parseInt($('wfMinTrain')?$('wfMinTrain').value:'8')||8;
  var testWY=parseInt($('wfTestWin')?$('wfTestWin').value:'1')||1;
  var masterTicker=DAILY['^TWII']?'^TWII':(DAILY['SPY']?'SPY':null);
  if(!masterTicker){ alert('No benchmark data'); return; }
  var refDaily=DAILY[masterTicker];
  var freq=getFreq();
  var allM=getPreciseRebalanceDates(refDaily,freq);
  if(!allM.length)return;
  var firstYear=parseInt(allM[0].slice(0,4)), lastYear=parseInt(allM[allM.length-1].slice(0,4));
  var firstTestYear=firstYear+minTY;
  if(firstTestYear>lastYear){ alert('Not enough data for Walk-Forward'); return; }
  var init=gv('btCap')||100000;
  var origS=$('btS')?$('btS').value:'';
  var origE=$('btE')?$('btE').value:'';
  var cfg=wfCollectSettings();
  sl('stressLog','Running Walk-Forward (Anchored)...',null); showL('Walk-Forward Analysis...');
  setTimeout(async function(){
    try {
      await ensureCacheBuilt('Walk-Forward');
      var results=[],combinedOOS=[];
      for(var ty=firstTestYear; ty+testWY-1<=lastYear; ty+=testWY){
        var isStart=firstYear+'-01', isEnd=(ty-1)+'-12';
        var tStart=ty+'-01', tEnd=(ty+testWY-1)+'-12';
        if($('btS'))$('btS').value=isStart;
        if($('btE'))$('btE').value=isEnd;
        var isRecs=runBTcore();
        if($('btS'))$('btS').value=tStart;
        if($('btE'))$('btE').value=tEnd;
        var oosRecs=runBTcore();
        if(!isRecs || !oosRecs || isRecs.length<2 || oosRecs.length<2) continue;
        var isK=wfKpiFromRecords(isRecs), oosK=wfKpiFromRecords(oosRecs);
        if(!isK || !oosK) continue;
        var ratio=wfSafeRatio(oosK.cagr,isK.cagr);
        oosRecs.forEach(function(r){ combinedOOS.push(r.pRet); });
        results.push({isPeriod:isStart+'~'+isEnd, period:tStart+'~'+tEnd, months:oosRecs.length, isCagr:isK.cagr, isSharpe:isK.sharpe, cagr:oosK.cagr, mdd:oosK.mdd, sharpe:oosK.sharpe, ratio:ratio});
      }
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      togglePoolUI();
      if(!combinedOOS.length){ sl('stressLog','No OOS results',false); hideL(); return; }
      var sNav=init,sPeak=init,sMdd=0;
      combinedOOS.forEach(function(r){ sNav*=(1+r); if(sNav>sPeak)sPeak=sNav; var dd=(sNav-sPeak)/sPeak; if(dd<sMdd)sMdd=dd; });
      var periods=getAnnualPeriods();
      var sYrs=combinedOOS.length/periods, sCagr=sYrs>0?Math.pow(sNav/init,1/sYrs)-1:0;
      var sAvg=combinedOOS.reduce(function(a,b){return a+b;},0)/combinedOOS.length;
      var sStd=Math.sqrt(combinedOOS.reduce(function(a,b){return a+Math.pow(b-sAvg,2);},0)/(combinedOOS.length>1?combinedOOS.length-1:1))*Math.sqrt(periods);
      var sSharpe=sStd>0?(sCagr-0.015)/sStd:0;
      var settingsLabel=wfSettingsTag(cfg,minTY,testWY,'ANCHORED WF');
      renderWalkForward(results,{cagr:sCagr,mdd:sMdd,sharpe:sSharpe,months:combinedOOS.length,avgRatio:wfAvgRatio(results),medianRatio:wfMedianRatio(results)},settingsLabel);
      sl('stressLog','Walk-Forward: '+results.length+' windows, OOS='+combinedOOS.length+' periods',true);
    } catch(e){
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      togglePoolUI();
      sl('stressLog','Error: '+e.message,false); console.error(e);
    }
    hideL();
  },80);
}

function renderWalkForward(results,spliced,settingsLabel) {
  function fp(v){return (v>=0?'+':'')+(v*100).toFixed(2)+'%';}
  function gc(v){return v>=0?'var(--gr)':'var(--re)';}
  var html='<div class="card" style="border-top:3px solid var(--ye);margin-bottom:10px;">';
  html+='<div class="ct">WALK-FORWARD ANALYSIS (ANCHORED)</div>';
  if(settingsLabel) html+='<div style="font-size:10px;color:var(--mu);margin-bottom:8px;word-break:break-all;">'+settingsLabel+'</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
  html+='<div class="card" style="border-top:2px solid var(--gr);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">OOS CAGR (spliced)</div><div class="mono" style="font-size:20px;color:'+gc(spliced.cagr)+'">'+fp(spliced.cagr)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid var(--re);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">OOS MDD (spliced)</div><div class="mono" style="font-size:20px;color:var(--re)">'+fp(spliced.mdd)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid var(--bl);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">OOS Sharpe (spliced)</div><div class="mono" style="font-size:20px;color:'+gc(spliced.sharpe)+'">'+spliced.sharpe.toFixed(2)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid '+wfRatioColor(spliced.avgRatio)+';padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Avg OOS/IS</div><div class="mono" style="font-size:20px;color:'+wfRatioColor(spliced.avgRatio)+'">'+wfRatioText(spliced.avgRatio)+'</div><div style="font-size:9px;color:var(--mu)">Median '+wfRatioText(spliced.medianRatio)+'</div></div>';
  html+='</div>';
  var winCount=results.filter(function(r){return r.cagr>0;}).length;
  var winRate=results.length>0?winCount/results.length:0;
  html+='<div style="font-size:11px;color:var(--mu);margin-bottom:6px;">Win rate(CAGR>0): <b style="color:'+(winRate>=0.7?'var(--gr)':winRate>=0.5?'var(--ye)':'var(--re)')+'">'+(winRate*100).toFixed(0)+'%</b>';
  html+=' ('+winCount+'/'+results.length+' windows) | OOS periods: <b>'+spliced.months+'</b></div>';
  html+='<div class="tw-wrap"><table><thead><tr><th>IS Period</th><th>OOS Period</th><th>Mo</th><th>IS CAGR</th><th>OOS CAGR</th><th>OOS/IS</th><th>MDD</th><th>Sharpe</th><th>Status</th></tr></thead><tbody>';
  results.forEach(function(r){
    var ok=r.cagr>0;
    html+='<tr><td class="mono" style="font-size:11px">'+r.isPeriod+'</td><td class="mono" style="font-size:11px">'+r.period+'</td><td class="mono">'+r.months+'</td>'
      +'<td class="mono" style="color:'+gc(r.isCagr)+'">'+fp(r.isCagr)+'</td>'
      +'<td class="mono" style="color:'+gc(r.cagr)+'">'+fp(r.cagr)+'</td>'
      +'<td class="mono" style="color:'+wfRatioColor(r.ratio)+'">'+wfRatioText(r.ratio)+'</td>'
      +'<td class="mono" style="color:var(--re)">'+fp(r.mdd)+'</td>'
      +'<td class="mono" style="color:'+gc(r.sharpe)+'">'+r.sharpe.toFixed(2)+'</td>'
      +'<td style="color:'+(ok?'var(--gr)':'var(--re)')+';font-size:11px">'+(ok?'Profit':'Loss')+'</td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-top:8px;">OOS/IS = each window OOS CAGR divided by IS CAGR. Average is computed from window-level ratios.</div>';
  html+='</div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}

function runRollingWalkForward() {
  if(!Object.keys(DAILY).length){ alert('請先抓取或載入資料'); return; }
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  var trainY=parseInt($('wfMinTrain')?$('wfMinTrain').value:'8')||8;
  var testY=parseInt($('wfTestWin')?$('wfTestWin').value:'1')||1;
  var masterTicker=DAILY['^TWII']?'^TWII':(DAILY['SPY']?'SPY':null);
  if(!masterTicker){ alert('No benchmark data'); return; }
  var refDaily=DAILY[masterTicker];
  var freq=getFreq();
  var allM=getPreciseRebalanceDates(refDaily,freq);
  if(!allM.length) return;
  var firstYear=parseInt(allM[0].slice(0,4)), lastYear=parseInt(allM[allM.length-1].slice(0,4));
  var firstTestYear=firstYear+trainY;
  if(firstTestYear>lastYear){ alert('Not enough data for Rolling Walk-Forward'); return; }
  var init=gv('btCap')||100000;
  var origS=$('btS')?$('btS').value:'';
  var origE=$('btE')?$('btE').value:'';
  var cfg=wfCollectSettings();
  sl('stressLog','Running Rolling Walk-Forward...',null); showL('Rolling Walk-Forward Analysis...');
  setTimeout(async function(){
    try {
      await ensureCacheBuilt('Walk-Forward');
      var results=[],combinedOOS=[];
      for(var ty=firstTestYear; ty+testY-1<=lastYear; ty+=testY){
        var trStart=(ty-trainY)+'-01', trEnd=(ty-1)+'-12';
        var teStart=ty+'-01', teEnd=(ty+testY-1)+'-12';
        if($('btS'))$('btS').value=trStart;
        if($('btE'))$('btE').value=trEnd;
        var trainRecs=runBTcore();
        if($('btS'))$('btS').value=teStart;
        if($('btE'))$('btE').value=teEnd;
        var oosRecs=runBTcore();
        if(!trainRecs||!oosRecs||trainRecs.length<2||oosRecs.length<2) continue;
        var tk=wfKpiFromRecords(trainRecs), ok=wfKpiFromRecords(oosRecs);
        if(!tk || !ok) continue;
        var ratio=wfSafeRatio(ok.cagr,tk.cagr);
        oosRecs.forEach(function(r){ combinedOOS.push(r.pRet); });
        results.push({train:trStart+'~'+trEnd, test:teStart+'~'+teEnd, months:oosRecs.length, trainCagr:tk.cagr, trainSharpe:tk.sharpe, cagr:ok.cagr, mdd:ok.mdd, sharpe:ok.sharpe, ratio:ratio});
      }
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      togglePoolUI();
      if(!combinedOOS.length){ sl('stressLog','No rolling OOS results',false); hideL(); return; }
      var sNav=init,sPeak=init,sMdd=0;
      combinedOOS.forEach(function(r){ sNav*=(1+r); if(sNav>sPeak)sPeak=sNav; var dd=(sNav-sPeak)/sPeak; if(dd<sMdd)sMdd=dd; });
      var periods=getAnnualPeriods();
      var sYrs=combinedOOS.length/periods, sCagr=sYrs>0?Math.pow(sNav/init,1/sYrs)-1:0;
      var sAvg=combinedOOS.reduce(function(a,b){return a+b;},0)/combinedOOS.length;
      var sStd=Math.sqrt(combinedOOS.reduce(function(a,b){return a+Math.pow(b-sAvg,2);},0)/(combinedOOS.length>1?combinedOOS.length-1:1))*Math.sqrt(periods);
      var sSharpe=sStd>0?(sCagr-0.015)/sStd:0;
      var settingsLabel=wfSettingsTag(cfg,trainY,testY,'ROLLING WF');
      renderRollingWalkForward(results,{cagr:sCagr,mdd:sMdd,sharpe:sSharpe,months:combinedOOS.length,avgRatio:wfAvgRatio(results),medianRatio:wfMedianRatio(results)},settingsLabel);
      sl('stressLog','Rolling Walk-Forward: '+results.length+' windows, OOS='+combinedOOS.length+' periods',true);
    } catch(e){
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      togglePoolUI();
      sl('stressLog','Error: '+e.message,false); console.error(e);
    }
    hideL();
  },80);
}

function renderRollingWalkForward(results,spliced,settingsLabel) {
  function fp(v){return (v>=0?'+':'')+(v*100).toFixed(2)+'%';}
  function gc(v){return v>=0?'var(--gr)':'var(--re)';}
  var html='<div class="card" style="border-top:3px solid var(--tw);margin-bottom:10px;">';
  html+='<div class="ct">ROLLING WALK-FORWARD ANALYSIS</div>';
  if(settingsLabel) html+='<div style="font-size:10px;color:var(--mu);margin-bottom:8px;word-break:break-all;">'+settingsLabel+'</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
  html+='<div class="card" style="border-top:2px solid var(--gr);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Rolling OOS CAGR</div><div class="mono" style="font-size:20px;color:'+gc(spliced.cagr)+'">'+fp(spliced.cagr)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid var(--re);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Rolling OOS MDD</div><div class="mono" style="font-size:20px;color:var(--re)">'+fp(spliced.mdd)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid var(--bl);padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Rolling OOS Sharpe</div><div class="mono" style="font-size:20px;color:'+gc(spliced.sharpe)+'">'+spliced.sharpe.toFixed(2)+'</div></div>';
  html+='<div class="card" style="border-top:2px solid '+wfRatioColor(spliced.avgRatio)+';padding:9px;"><div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Avg OOS/IS</div><div class="mono" style="font-size:20px;color:'+wfRatioColor(spliced.avgRatio)+'">'+wfRatioText(spliced.avgRatio)+'</div><div style="font-size:9px;color:var(--mu)">Median '+wfRatioText(spliced.medianRatio)+'</div></div>';
  html+='</div>';
  var winCount=results.filter(function(r){return r.cagr>0;}).length;
  var winRate=results.length?winCount/results.length:0;
  html+='<div style="font-size:11px;color:var(--mu);margin-bottom:6px;">Rolling windows: <b>'+results.length+'</b> | Win rate(CAGR>0): <b style="color:'+(winRate>=0.7?'var(--gr)':winRate>=0.5?'var(--ye)':'var(--re)')+'">'+(winRate*100).toFixed(0)+'%</b> | OOS periods: <b>'+spliced.months+'</b></div>';
  html+='<div class="tw-wrap"><table><thead><tr><th>Train Period</th><th>OOS Period</th><th>Mo</th><th>IS CAGR</th><th>OOS CAGR</th><th>OOS/IS</th><th>OOS MDD</th><th>OOS Sharpe</th></tr></thead><tbody>';
  results.forEach(function(r){
    html+='<tr><td class="mono" style="font-size:11px">'+r.train+'</td><td class="mono" style="font-size:11px">'+r.test+'</td><td class="mono">'+r.months+'</td>'
      +'<td class="mono" style="color:'+gc(r.trainCagr)+'">'+fp(r.trainCagr)+'</td>'
      +'<td class="mono" style="color:'+gc(r.cagr)+'">'+fp(r.cagr)+'</td>'
      +'<td class="mono" style="color:'+wfRatioColor(r.ratio)+'">'+wfRatioText(r.ratio)+'</td>'
      +'<td class="mono" style="color:var(--re)">'+fp(r.mdd)+'</td>'
      +'<td class="mono" style="color:'+gc(r.sharpe)+'">'+r.sharpe.toFixed(2)+'</td></tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-top:8px;">Rolling WF uses fixed-length training windows. OOS/IS ratio is computed per window, then averaged.</div>';
  html+='</div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}


function runTNSweep() {
  if (!Object.keys(DAILY).length) { alert('Fetch data first'); return; }
  var out = $('stressMetrics');
  var log = $('stressLog');
  if (log) sl('stressLog','Running T-N Sweep N=1~22...',null);
  showL('T-N Sweep N=1~22...');

  setTimeout(async function(){
    var oldSkipChecked = $('btSkipMo') ? $('btSkipMo').checked : false;
    try {
      // T-N Sweep 是獨立公平回測：N 只決定名單；交易一律 T 月底收盤買、T+1 月底收盤賣。
      // 因此強制不套用 Skip Month，避免混入另一套訊號延遲定義。
      if ($('btSkipMo')) $('btSkipMo').checked = false;
      SKIP_MO = false;
      await ensureCacheBuilt('T-N Sweep');

      var mh = parseInt($('btH') ? $('btH').value : '6') || 6;
      var mode = getWeightMode();
      var init = gv('btCap') || 100000;
      var rows = [];
      var bestSharpe = null, bestCAGR = null, bestMDD = null;

      for (var n = 1; n <= 22; n++) {
        var records = runBTcore(mh, mode, {signalN:n});
        if (!records || !records.length) {
          rows.push({n:n, ok:false});
          continue;
        }
        var k = kpi(records, init);
        var row = {n:n, ok:true, cagr:k.cagr, sharpe:k.sharpe, mdd:k.mdd, nav:k.nav, periods:records.length};
        rows.push(row);
        if (!bestSharpe || row.sharpe > bestSharpe.sharpe) bestSharpe = row;
        if (!bestCAGR || row.cagr > bestCAGR.cagr) bestCAGR = row;
        if (!bestMDD || row.mdd > bestMDD.mdd) bestMDD = row; // mdd is negative; higher is shallower
        if (log) log.textContent = '[T-N Sweep] N=' + n + ' done';
      }

      var canvasId = 'tnSweepChart_' + Date.now();
      var html = '<div class="card">'
        + '<div class="ct">T-N Sweep 回測表 <span style="color:var(--mu);font-size:10px">N只決定名單；買賣價格固定為 T 月底 → T+1 月底</span></div>'
        + '<div class="ib2" style="margin-bottom:8px">最佳 Sharpe: <b>T-' + (bestSharpe ? bestSharpe.n : '-') + '</b>'
        + (bestSharpe ? ' / ' + bestSharpe.sharpe.toFixed(2) : '')
        + '　|　最佳 CAGR: <b>T-' + (bestCAGR ? bestCAGR.n : '-') + '</b>'
        + (bestCAGR ? ' / ' + (bestCAGR.cagr*100).toFixed(2) + '%' : '')
        + '　|　最低 MDD: <b>T-' + (bestMDD ? bestMDD.n : '-') + '</b>'
        + (bestMDD ? ' / ' + (bestMDD.mdd*100).toFixed(2) + '%' : '')
        + '<br>注意：T 為每個歷史月份的固定月末交易日；不是資料最新更新日。</div>'
        + '<div class="cw"><div class="ct2">T-N Sweep Chart</div><div style="position:relative;height:220px"><canvas id="'+canvasId+'"></canvas></div></div>'
        + '<div class="tw-wrap"><table><thead><tr>'
        + '<th>N</th><th>Periods</th><th>CAGR</th><th>Sharpe</th><th>MDD</th><th>Final NAV</th><th>標記</th>'
        + '</tr></thead><tbody>';

      rows.forEach(function(r){
        if (!r.ok) {
          html += '<tr><td class="mono">T-' + r.n + '</td><td colspan="6" style="color:var(--re)">No result</td></tr>';
          return;
        }
        var tags = [];
        if (bestSharpe && r.n === bestSharpe.n) tags.push('Best Sharpe');
        if (bestCAGR && r.n === bestCAGR.n) tags.push('Best CAGR');
        if (bestMDD && r.n === bestMDD.n) tags.push('Best MDD');
        html += '<tr>'
          + '<td class="mono">T-' + r.n + '</td>'
          + '<td class="mono">' + r.periods + '</td>'
          + '<td class="mono ' + (r.cagr>=0?'tg':'tr') + '">' + (r.cagr*100).toFixed(2) + '%</td>'
          + '<td class="mono">' + r.sharpe.toFixed(2) + '</td>'
          + '<td class="mono tr">' + (r.mdd*100).toFixed(2) + '%</td>'
          + '<td class="mono">$' + Math.round(r.nav).toLocaleString() + '</td>'
          + '<td>' + tags.join(' / ') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div></div>';
      if (out) {
        $('stressRes').classList.remove('hidden');
        out.innerHTML = html + out.innerHTML;
      }

      if (typeof Chart !== 'undefined') {
        if (CHART.tnSweep) CHART.tnSweep.destroy();
        var okRows = rows.filter(function(r){ return r.ok; });
        var ctx = document.getElementById(canvasId);
        if (ctx) {
          CHART.tnSweep = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
              labels: okRows.map(function(r){ return 'T-' + r.n; }),
              datasets: [
                {label:'CAGR %', data:okRows.map(function(r){ return +(r.cagr*100).toFixed(2); }), borderWidth:2, pointRadius:2, yAxisID:'y'},
                {label:'Sharpe', data:okRows.map(function(r){ return +r.sharpe.toFixed(2); }), borderWidth:2, pointRadius:2, yAxisID:'y1'}
              ]
            },
            options: {
              responsive:true,
              maintainAspectRatio:false,
              interaction:{mode:'index',intersect:false},
              plugins:{legend:{labels:{color:'#6b7a99'}}},
              scales:{
                x:{ticks:{color:'#6b7a99'},grid:{color:'#1a2030'}},
                y:{type:'linear',position:'left',ticks:{color:'#6b7a99'},grid:{color:'#1a2030'}},
                y1:{type:'linear',position:'right',ticks:{color:'#6b7a99'},grid:{drawOnChartArea:false}}
              }
            }
          });
        }
      }
      if (log) sl('stressLog','T-N Sweep completed: N=1~22',true);
    } catch(e) {
      console.error(e);
      if (log) sl('stressLog','T-N Sweep Error: '+e.message,false);
    } finally {
      if ($('btSkipMo')) $('btSkipMo').checked = oldSkipChecked;
      hideL();
    }
  }, 80);
}

function runWFNCompare() {
  if(!Object.keys(DAILY).length){ alert('請先抓取或載入資料'); return; }
  var minTY=parseInt($('wfMinTrain')?$('wfMinTrain').value:'8')||8;
  var testWY=parseInt($('wfTestWin')?$('wfTestWin').value:'1')||1;
  var masterTicker=DAILY['^TWII']?'^TWII':(DAILY['SPY']?'SPY':null);
  if(!masterTicker){ alert('No benchmark data'); return; }
  var refDaily=DAILY[masterTicker];
  var freq=getFreq();
  var allM=getPreciseRebalanceDates(refDaily,freq);
  if(!allM.length){ alert('No rebalance dates'); return; }
  var firstYear=parseInt(allM[0].slice(0,4)), lastYear=parseInt(allM[allM.length-1].slice(0,4));
  var firstTestYear=firstYear+minTY;
  if(firstTestYear>lastYear){ alert('Not enough data'); return; }
  var init=gv('btCap')||100000;
  var wtEl=document.querySelector('input[name="wtMode"]:checked');
  var mode=wtEl?wtEl.value:'eq';
  var origS=$('btS')?$('btS').value:'';
  var origE=$('btE')?$('btE').value:'';
  var origH=$('btH')?$('btH').value:'5';
  var origPool=document.getElementById('poolMode')?document.getElementById('poolMode').value:'large';
  if(document.getElementById('poolMode')) document.getElementById('poolMode').value='large';
  function restoreAll(){
    if(document.getElementById('poolMode')) document.getElementById('poolMode').value=origPool;
    if($('btH')) $('btH').value=origH;
    if($('btS')) $('btS').value=origS;
    if($('btE')) $('btE').value=origE;
    togglePoolUI();
  }
  sl('stressLog','Running WF N=2~15 comparison...',null); showL('WF N Compare...');
  setTimeout(function(){
    try {
      var scanN=[2,3,4,5,6,7,8,9,10,11,12,13,14,15];
      var allResults=[];
      for(var ni=0;ni<scanN.length;ni++){
        var N=scanN[ni];
        if($('btH'))$('btH').value=N;
        var oosMonths=[], ratios=[], isCagrs=[];
        for(var ty=firstTestYear;ty+testWY-1<=lastYear;ty+=testWY){
          var isStart=firstYear+'-01', isEnd=(ty-1)+'-12';
          var tStart=ty+'-01',tEnd=(ty+testWY-1)+'-12';
          if($('btS'))$('btS').value=isStart;
          if($('btE'))$('btE').value=isEnd;
          var isRecs=runBTcore(N,mode);
          if($('btS'))$('btS').value=tStart;
          if($('btE'))$('btE').value=tEnd;
          var recs=runBTcore(N,mode);
          if(!isRecs||!recs||isRecs.length<2||recs.length<2)continue;
          var isK=wfKpiFromRecords(isRecs), oosK=wfKpiFromRecords(recs);
          if(isK){ isCagrs.push(isK.cagr); }
          var ratio=(isK&&oosK)?wfSafeRatio(oosK.cagr,isK.cagr):null;
          if(ratio!==null&&isFinite(ratio)) ratios.push(ratio);
          recs.forEach(function(r){ oosMonths.push(r.pRet); });
        }
        if($('btS'))$('btS').value=origS;
        if($('btE'))$('btE').value=origE;
        if(!oosMonths.length){ allResults.push({N:N,err:true}); continue; }
        var sNav=init,sPeak=init,sMdd=0;
        oosMonths.forEach(function(r){ sNav*=(1+r); if(sNav>sPeak)sPeak=sNav; var dd=(sNav-sPeak)/sPeak; if(dd<sMdd)sMdd=dd; });
        var periods=getAnnualPeriods();
        var sYrs=oosMonths.length/periods, sCagr=sYrs>0?Math.pow(sNav/init,1/sYrs)-1:0;
        var sAvg=oosMonths.reduce(function(a,b){return a+b;},0)/oosMonths.length;
        var sStd=Math.sqrt(oosMonths.reduce(function(a,b){return a+Math.pow(b-sAvg,2);},0)/(oosMonths.length>1?oosMonths.length-1:1))*Math.sqrt(periods);
        var sSharpe=sStd>0?(sCagr-0.015)/sStd:0;
        var winRate=oosMonths.filter(function(r){return r>0;}).length/oosMonths.length;
        var avgRatio=ratios.length?ratios.reduce(function(a,b){return a+b;},0)/ratios.length:null;
        var avgIS=isCagrs.length?isCagrs.reduce(function(a,b){return a+b;},0)/isCagrs.length:null;
        allResults.push({N:N,cagr:sCagr,mdd:sMdd,sharpe:sSharpe,nav:sNav,months:oosMonths.length,winRate:winRate,ratio:avgRatio,isCagr:avgIS,err:false});
      }
      restoreAll();
      renderWFNCompare(allResults,init,minTY,testWY);
      sl('stressLog','WF N Compare done: N=2~15',true);
    } catch(e){
      restoreAll();
      sl('stressLog','Error: '+e.message,false); console.error(e);
    }
    hideL();
  },80);
}

function renderWFNCompare(results,init,minTY,testWY) {
  function fp(v){return (v>=0?'+':'')+(v*100).toFixed(2)+'%';}
  function gc(v){return v>=0?'var(--gr)':'var(--re)';}
  function sc(v){return v>=1.0?'var(--gr)':v>=0.7?'var(--ye)':'var(--re)';}
  var valid=results.filter(function(r){return !r.err;});
  if(!valid.length)return;
  var bestCagr=valid.reduce(function(a,b){return b.cagr>a.cagr?b:a;});
  var bestSharpe=valid.reduce(function(a,b){return b.sharpe>a.sharpe?b:a;});
  var ratioValid=valid.filter(function(r){return r.ratio!==null&&isFinite(r.ratio);});
  var bestRatio=ratioValid.length?ratioValid.reduce(function(a,b){return b.ratio>a.ratio?b:a;}):null;
  var html='<div class="card" style="border-top:3px solid var(--ac);margin-bottom:10px;">';
  html+='<div class="ct">WF N COMPARE (Large Pool, Train='+minTY+'Y, Test='+testWY+'Y)</div>';
  html+='<div class="tw-wrap"><table><thead><tr><th>N</th><th>IS CAGR</th><th>OOS CAGR</th><th>OOS/IS</th><th>OOS MDD</th><th>OOS Sharpe</th><th>Win Rate</th><th>OOS Months</th><th>Final NAV</th></tr></thead><tbody>';
  results.forEach(function(r){
    if(r.err){ html+='<tr><td class="mono">'+r.N+'</td><td colspan="8" style="color:var(--mu)">no data</td></tr>'; return; }
    var isBestC=r.N===bestCagr.N, isBestS=r.N===bestSharpe.N, isBestR=bestRatio&&r.N===bestRatio.N;
    var rowStyle=(isBestC||isBestS||isBestR)?'background:var(--sf2);':'';
    html+='<tr style="'+rowStyle+'">';
    html+='<td class="mono" style="font-weight:700;color:'+(isBestS?'var(--gr)':isBestC?'var(--tw)':isBestR?'var(--ye)':'var(--tx)')+'">'+r.N+(isBestC?' *C':'')+(isBestS?' *S':'')+(isBestR?' *R':'')+'</td>';
    html+='<td class="mono" style="color:'+(r.isCagr===null?'var(--mu)':gc(r.isCagr))+'">'+(r.isCagr===null?'NA':fp(r.isCagr))+'</td>';
    html+='<td class="mono" style="color:'+gc(r.cagr)+'">'+fp(r.cagr)+'</td>';
    html+='<td class="mono" style="color:'+wfRatioColor(r.ratio)+'">'+wfRatioText(r.ratio)+'</td>';
    html+='<td class="mono" style="color:var(--re)">'+fp(r.mdd)+'</td>';
    html+='<td class="mono" style="color:'+sc(r.sharpe)+'">'+r.sharpe.toFixed(2)+'</td>';
    html+='<td class="mono" style="color:'+(r.winRate>=0.6?'var(--gr)':'var(--ye)')+'">'+(r.winRate*100).toFixed(0)+'%</td>';
    html+='<td class="mono" style="color:var(--mu)">'+r.months+'</td>';
    html+='<td class="mono" style="color:var(--wh)">$'+Math.round(r.nav).toLocaleString()+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-bottom:10px;">*C = best OOS CAGR | *S = best OOS Sharpe | *R = best OOS/IS ratio</div>';
  html+='<div id="wfnChartWrap" style="position:relative;height:220px;margin-bottom:8px"><canvas id="wfnChart"></canvas></div>';
  html+='</div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
  setTimeout(function(){
    var ctx=document.getElementById('wfnChart');
    if(!ctx||typeof Chart==='undefined')return;
    var labels=valid.map(function(r){return 'N='+r.N;});
    var cagrData=valid.map(function(r){return (r.cagr*100).toFixed(2);});
    var sharpeData=valid.map(function(r){return r.sharpe.toFixed(2);});
    var mddData=valid.map(function(r){return (r.mdd*100).toFixed(2);});
    var ratioData=valid.map(function(r){return r.ratio===null?null:(r.ratio*100).toFixed(0);});
    var gridColor='#1a2030', tickColor='#6b7a99';
    new Chart(ctx.getContext('2d'),{type:'line',data:{labels:labels,datasets:[
      {label:'OOS CAGR %',data:cagrData,borderColor:'#00e5a0',borderWidth:2,pointRadius:4,yAxisID:'y'},
      {label:'OOS/IS %',data:ratioData,borderColor:'#4d9fff',borderWidth:2,pointRadius:4,borderDash:[2,2],yAxisID:'y'},
      {label:'OOS Sharpe',data:sharpeData,borderColor:'#ffb830',borderWidth:2,pointRadius:4,yAxisID:'y2'},
      {label:'OOS MDD %',data:mddData,borderColor:'#ff4d6d',borderWidth:2,pointRadius:4,borderDash:[4,3],yAxisID:'y'}
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:{duration:300},plugins:{legend:{labels:{color:tickColor,boxWidth:10,font:{size:11}}}},scales:{x:{ticks:{color:tickColor},grid:{color:gridColor}},y:{position:'left',ticks:{color:tickColor,callback:function(v){return v+'%';}},grid:{color:gridColor},title:{display:true,text:'CAGR / MDD / OOS-IS %',color:tickColor,font:{size:10}}},y2:{position:'right',ticks:{color:'#ffb830'},grid:{drawOnChartArea:false},title:{display:true,text:'Sharpe',color:'#ffb830',font:{size:10}}}}}});
  },100);
}
// FIX4: runPoolCompare - restoreAll includes togglePoolUI
function runPoolCompare() {
  if(!Object.keys(DAILY).length){ alert('請先抓取或載入資料'); return; }
  var minTY=parseInt($('wfMinTrain')&&$('wfMinTrain').value?$('wfMinTrain').value:'8')||8;
  var testWY=parseInt($('wfTestWin')&&$('wfTestWin').value?$('wfTestWin').value:'1')||1;
  var etfQ=parseInt($('wfETFQuota')&&$('wfETFQuota').value?$('wfETFQuota').value:'1');
  if(isNaN(etfQ)||etfQ<0)etfQ=1;
  var masterTicker=DAILY['^TWII']?'^TWII':(DAILY['SPY']?'SPY':null);
  if(!masterTicker){ alert('No benchmark data'); return; }
  var refDaily=DAILY[masterTicker];
  if(!refDaily||!refDaily.length){ alert('No benchmark data loaded'); return; }
  var freq=getFreq();
  var allM=getPreciseRebalanceDates(refDaily,freq);
  if(!allM||!allM.length){ alert('No rebalance dates'); return; }
  var firstYear=parseInt(allM[0].slice(0,4)), lastYear=parseInt(allM[allM.length-1].slice(0,4));
  var firstTestYear=firstYear+minTY;
  if(firstTestYear>lastYear){ alert('Not enough data (need '+minTY+' train years)'); return; }
  var init=gv('btCap')||100000;
  var wtEl=document.querySelector('input[name="wtMode"]:checked');
  var mode=wtEl?wtEl.value:'eq';
  var origS=$('btS')?$('btS').value:'';
  var origE=$('btE')?$('btE').value:'';
  var origH=$('btH')?$('btH').value:'5';
  var origPool=document.getElementById('poolMode')?document.getElementById('poolMode').value:'large';
  var origTW=$('btQuotaTW')?$('btQuotaTW').value:'2';
  var origUS=$('btQuotaUS')?$('btQuotaUS').value:'2';
  var origETF=$('btQuotaETF')?$('btQuotaETF').value:'1';

  function restoreAll(){
    if(document.getElementById('poolMode')) document.getElementById('poolMode').value=origPool;
    if($('btQuotaTW')) $('btQuotaTW').value=origTW;
    if($('btQuotaUS')) $('btQuotaUS').value=origUS;
    if($('btQuotaETF')) $('btQuotaETF').value=origETF;
    if($('btH')) $('btH').value=origH;
    if($('btS')) $('btS').value=origS;
    if($('btE')) $('btE').value=origE;
    togglePoolUI(); // FIX4
  }

  sl('stressLog','Running Pool Compare A+B...',null); showL('Pool Compare A+B...');

  function runOneWF(poolMode,tw,us,etf,totalN){
    try {
      if(document.getElementById('poolMode')) document.getElementById('poolMode').value=poolMode;
      if($('btQuotaTW')) $('btQuotaTW').value=tw;
      if($('btQuotaUS')) $('btQuotaUS').value=us;
      if($('btQuotaETF')) $('btQuotaETF').value=etf;
      if($('btH')) $('btH').value=totalN;
      var oosMonths=[];
      for(var ty=firstTestYear;ty+testWY-1<=lastYear;ty+=testWY){
        var tS=ty+'-01',tE=(ty+testWY-1)+'-12';
        if($('btS'))$('btS').value=tS;
        if($('btE'))$('btE').value=tE;
        var recs=runBTcore(totalN,mode);
        if(!recs||recs.length<2)continue;
        recs.forEach(function(r){ oosMonths.push(r.pRet); });
      }
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      if(!oosMonths.length)return null;
      var sNav=init,sPeak=init,sMdd=0;
      oosMonths.forEach(function(r){ sNav*=(1+r); if(sNav>sPeak)sPeak=sNav; var dd=(sNav-sPeak)/sPeak; if(dd<sMdd)sMdd=dd; });
      var sYrs=oosMonths.length/12, sCagr=sYrs>0?Math.pow(sNav/init,1/sYrs)-1:0;
      var sAvg=oosMonths.reduce(function(a,b){return a+b;},0)/oosMonths.length;
      var sStd=Math.sqrt(oosMonths.reduce(function(a,b){return a+Math.pow(b-sAvg,2);},0)/oosMonths.length)*Math.sqrt(12);
      var sSharpe=sStd>0?(sCagr-0.015)/sStd:0;
      return {cagr:sCagr,mdd:sMdd,sharpe:sSharpe,nav:sNav,months:oosMonths.length};
    } catch(innerE){
      if($('btS'))$('btS').value=origS;
      if($('btE'))$('btE').value=origE;
      console.error('runOneWF error:',innerE); return null;
    }
  }

  setTimeout(function(){
    try {
      var planA=[
        {n:2+etfQ,tw:1,us:1,etf:etfQ},{n:3+etfQ,tw:2,us:1,etf:etfQ},
        {n:4+etfQ,tw:2,us:2,etf:etfQ},{n:5+etfQ,tw:3,us:2,etf:etfQ},
        {n:6+etfQ,tw:3,us:3,etf:etfQ},{n:7+etfQ,tw:4,us:3,etf:etfQ},
        {n:8+etfQ,tw:4,us:4,etf:etfQ},{n:9+etfQ,tw:5,us:4,etf:etfQ}
      ];
      var partA=[];
      for(var ai=0;ai<planA.length;ai++){
        var p=planA[ai];
        $('loadTxt').textContent='Part A: N='+p.n+' ('+(ai+1)+'/'+planA.length+')';
        var res=runOneWF('large',p.tw,p.us,p.etf,p.n);
        partA.push({n:p.n,tw:p.tw,us:p.us,etf:p.etf,res:res});
      }
      var twRange=[1,2,3,4,5], usRange=[1,2,3,4,5];
      var totalB=twRange.length*usRange.length, bi=0;
      var partB=[];
      for(var ti=0;ti<twRange.length;ti++){
        partB.push([]);
        for(var ui=0;ui<usRange.length;ui++){
          var tw=twRange[ti],us=usRange[ui],totalN=tw+us+etfQ;
          bi++;
          $('loadTxt').textContent='Part B: TW='+tw+' US='+us+' ('+bi+'/'+totalB+')';
          var res2=runOneWF('small',tw,us,etfQ,totalN);
          partB[ti].push({tw:tw,us:us,etf:etfQ,n:totalN,res:res2});
        }
      }
      restoreAll();
      renderPoolCompare(partA,partB,twRange,usRange,init,minTY,testWY,etfQ);
      sl('stressLog','Pool Compare A+B done (ETF='+etfQ+')',true);
    } catch(e){
      restoreAll();
      sl('stressLog','Error: '+e.message,false); console.error('runPoolCompare error:',e);
    }
    hideL();
  },80);
}

function renderPoolCompare(partA,partB,twRange,usRange,init,minTY,testWY,etfQ) {
  function fp(v){return (v>=0?'+':'')+(v*100).toFixed(2)+'%';}
  function gc(v){return v>=0?'var(--gr)':'var(--re)';}
  function sc(v){return v>=1.0?'var(--gr)':v>=0.7?'var(--ye)':'var(--re)';}
  function heatColor(v,mn,mx){
    if(v===null||v===undefined)return '#1a2030';
    var t=mx>mn?(v-mn)/(mx-mn):0.5;
    t=Math.max(0,Math.min(1,t));
    var r=Math.round(255*(1-t)), g=Math.round(229*t);
    return 'rgb('+r+','+g+',80)';
  }
  var validA=partA.filter(function(p){return p.res;});
  var bestAS=validA.length?validA.reduce(function(a,b){return b.res.sharpe>a.res.sharpe?b:a;}):null;
  var bestAC=validA.length?validA.reduce(function(a,b){return b.res.cagr>a.res.cagr?b:a;}):null;
  var html='<div class="card" style="border-top:3px solid var(--ac);margin-bottom:10px;">';
  html+='<div class="ct">POOL COMPARE (Train='+minTY+'Y / Test='+testWY+'Y / ETF='+etfQ+')</div>';
  html+='<div style="background:var(--sf2);border:1px solid var(--bd);border-radius:3px;padding:10px;margin-bottom:14px;">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px">PART A - Large Pool (ETF='+etfQ+' fixed)</div>';
  html+='<div class="tw-wrap"><table><thead><tr><th>N</th><th>TW</th><th>US</th><th>ETF</th><th>OOS CAGR</th><th>OOS MDD</th><th>Sharpe</th><th>Final NAV</th></tr></thead><tbody>';
  partA.forEach(function(p){
    if(!p.res){ html+='<tr><td class="mono">'+p.n+'</td><td>'+p.tw+'</td><td>'+p.us+'</td><td>'+p.etf+'</td><td colspan="4" style="color:var(--mu)">no data</td></tr>'; return; }
    var isBestS=bestAS&&p.n===bestAS.n, isBestC=bestAC&&p.n===bestAC.n;
    var mark=isBestS?' *S':(isBestC?' *C':''), nameCol=isBestS?'var(--gr)':isBestC?'var(--tw)':'var(--tx)';
    html+='<tr style="'+((isBestS||isBestC)?'background:rgba(255,255,255,0.04)':'')+'">';
    html+='<td class="mono" style="font-weight:700;color:'+nameCol+'">'+p.n+mark+'</td>';
    html+='<td class="mono" style="color:var(--tw)">'+p.tw+'</td><td class="mono" style="color:var(--us)">'+p.us+'</td><td class="mono" style="color:var(--mu)">'+p.etf+'</td>';
    html+='<td class="mono" style="color:'+gc(p.res.cagr)+'">'+fp(p.res.cagr)+'</td>';
    html+='<td class="mono" style="color:var(--re)">'+fp(p.res.mdd)+'</td>';
    html+='<td class="mono" style="color:'+sc(p.res.sharpe)+'">'+p.res.sharpe.toFixed(2)+'</td>';
    html+='<td class="mono" style="color:var(--wh)">$'+Math.round(p.res.nav).toLocaleString()+'</td></tr>';
  });
  html+='</tbody></table></div><div style="font-size:10px;color:var(--mu);margin-top:4px;">*S = best Sharpe | *C = best CAGR</div></div>';

  var allSharpes=[],allCagrs=[];
  for(var ti=0;ti<partB.length;ti++){for(var ui=0;ui<partB[ti].length;ui++){var cell=partB[ti][ui];if(cell&&cell.res){allSharpes.push(cell.res.sharpe);allCagrs.push(cell.res.cagr);}}}
  var minSh=allSharpes.length?Math.min.apply(null,allSharpes):0, maxSh=allSharpes.length?Math.max.apply(null,allSharpes):1;
  var minCa=allCagrs.length?Math.min.apply(null,allCagrs):0, maxCa=allCagrs.length?Math.max.apply(null,allCagrs):1;
  var bestB=null;
  for(var ti2=0;ti2<partB.length;ti2++){for(var ui2=0;ui2<partB[ti2].length;ui2++){var cell=partB[ti2][ui2];if(!cell||!cell.res)continue;if(!bestB||cell.res.sharpe>bestB.res.sharpe)bestB=cell;}}

  html+='<div style="background:var(--sf2);border:1px solid var(--bd);border-radius:3px;padding:10px;margin-bottom:14px;">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--ye);margin-bottom:6px">PART B - Small Pool Matrix (ETF='+etfQ+' fixed, TW x US heatmap)</div>';
  function makeHeatTable(label,minVal,maxVal,valFn,fmtFn){
    var t='<div style="margin-bottom:12px"><div style="font-size:10px;color:var(--mu);margin-bottom:4px;font-weight:700">'+label+'</div>';
    t+='<div style="overflow-x:auto"><table style="border-collapse:separate;border-spacing:3px;">';
    t+='<thead><tr><th style="font-size:10px;color:var(--mu);padding:3px 6px">TW \\ US</th>';
    for(var uii=0;uii<usRange.length;uii++) t+='<th style="font-size:10px;color:var(--us);padding:3px 8px">US='+usRange[uii]+'</th>';
    t+='</tr></thead><tbody>';
    for(var tii=0;tii<twRange.length;tii++){
      t+='<tr><td style="font-size:10px;color:var(--tw);font-weight:700;padding:3px 6px">TW='+twRange[tii]+'</td>';
      for(var uii2=0;uii2<usRange.length;uii2++){
        var cell=partB[tii]&&partB[tii][uii2]?partB[tii][uii2]:null;
        var v=cell&&cell.res?valFn(cell.res):null;
        var bgCol=heatColor(v,minVal,maxVal);
        var isBest=bestB&&cell&&cell.tw===bestB.tw&&cell.us===bestB.us;
        var border=isBest?'2px solid #fff':'1px solid #252d3d';
        t+='<td style="background:'+bgCol+';border:'+border+';padding:5px 8px;text-align:center;border-radius:3px;">';
        t+='<div class="mono" style="font-size:12px;color:#000;font-weight:700">'+(v!==null&&v!==undefined?fmtFn(v):'--')+'</div>';
        if(isBest)t+='<div style="font-size:9px;color:#000;font-weight:700">BEST</div>';
        t+='</td>';
      }
      t+='</tr>';
    }
    t+='</tbody></table></div></div>';
    return t;
  }
  html+=makeHeatTable('OOS SHARPE HEATMAP',minSh,maxSh,function(r){return r.sharpe;},function(v){return v.toFixed(2);});
  html+=makeHeatTable('OOS CAGR HEATMAP',minCa,maxCa,function(r){return r.cagr;},function(v){return fp(v);});
  if(bestB&&bestB.res){
    html+='<div style="background:var(--bd);border-radius:3px;padding:8px;font-size:11px;margin-top:6px;">';
    html+='Best small-pool combo: <b style="color:var(--tw)">TW='+bestB.tw+'</b> + <b style="color:var(--us)">US='+bestB.us+'</b> + ETF='+etfQ+' (N='+bestB.n+')';
    html+=' | Sharpe <b style="color:var(--gr)">'+bestB.res.sharpe.toFixed(2)+'</b>';
    html+=' | CAGR <b style="color:var(--gr)">'+fp(bestB.res.cagr)+'</b>';
    html+=' | MDD <b style="color:var(--re)">'+fp(bestB.res.mdd)+'</b></div>';
  }
  html+='</div></div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}
// ==========================================
// 1. Random Baseline 隨機基準分析 (極速防卡死版)
// ==========================================
function runRandomBaseline() {
  if (!BT_RESULT || !BT_RESULT.records) { alert('請先執行單次回測，再跑壓力測試！'); return; }
  var simN = parseInt(document.getElementById('stSimN') ? document.getElementById('stSimN').value : '1000') || 1000;
  var records = BT_RESULT.records;
  var init = BT_RESULT.initial || 100000;
  var N = BT_RESULT.mh || parseInt(document.getElementById('btH') ? document.getElementById('btH').value : '5') || 5; 
  var stocks = getEnabledStocks().filter(function(s) { return DAILY[s.c] && DAILY[s.c].length > 0; });
  if (stocks.length < N) { alert('股池中的有效標的數量不足！'); return; }
  
  sl('stressLog', 'Running Random Baseline x' + simN + '...', null); 
  showL('Random Baseline (預先計算中)...');
  
  setTimeout(function() {
    try {
      var numMonths = records.length;
      var precalcRets = []; 
      
      // 優化：提早在迴圈外算好所有股票每個月的報酬，消滅百萬次查價
      for (var ri = 0; ri < numMonths; ri++) {
        if (ri === 0) { precalcRets.push([]); continue; }
        var prevM = records[ri - 1].month;
        var currM = records[ri].month;
        var monthValidRets = [];
        for (var si = 0; si < stocks.length; si++) {
          var p0 = getPriceOnDate(DAILY[stocks[si].c], prevM);
          var p1 = getPriceOnDate(DAILY[stocks[si].c], currM);
          if (p0 && p1 && p0 > 0) {
            monthValidRets.push(p1 / p0 - 1);
          }
        }
        precalcRets.push(monthValidRets);
      }

      var cagrs = [], mdds = [], sharpes = [];
      var currentSim = 0;
      var chunkSize = 50; // 分塊處理，徹底防止瀏覽器判定網頁無回應

      function processChunk() {
        var endSim = Math.min(currentSim + chunkSize, simN);
        
        for (var s = currentSim; s < endSim; s++) {
          var nav = init, peak = init, mdd = 0, simRets = [];
          for (var rj = 0; rj < numMonths; rj++) {
            if (rj === 0) { simRets.push(0); continue; }
            var availableRets = precalcRets[rj];
            var availCount = availableRets.length;
            var grossRet = 0;
            
            if (availCount > 0) {
              var picks = Math.min(N, availCount);
              var sum = 0;
              // 局部洗牌
              var copy = availableRets.slice();
              for (var k = 0; k < picks; k++) {
                var rIdx = k + Math.floor(Math.random() * (availCount - k));
                var tmp = copy[k]; copy[k] = copy[rIdx]; copy[rIdx] = tmp;
                sum += copy[k];
              }
              grossRet = sum / picks;
            }
            
            nav *= (1 + grossRet);
            if (nav > peak) peak = nav;
            var dd = (nav - peak) / peak;
            if (dd < mdd) mdd = dd;
            simRets.push(grossRet);
          }
          
          var yrs = numMonths / 12;
          var cagr = yrs > 0 ? Math.pow(nav / init, 1 / yrs) - 1 : 0;
          var avg = simRets.reduce(function(a, b) { return a + b; }, 0) / simRets.length;
          var variance = simRets.reduce(function(a, b) { return a + Math.pow(b - avg, 2); }, 0) / simRets.length;
          var std = Math.sqrt(variance) * Math.sqrt(12);
          var sharpe = std > 0 ? (cagr - 0.015) / std : 0;
          
          cagrs.push(cagr); mdds.push(mdd); sharpes.push(sharpe);
        }
        
        currentSim = endSim;
        
        if (currentSim < simN) {
          var el = document.getElementById('loadTxt');
          if(el) el.textContent = 'Random Baseline (' + currentSim + '/' + simN + ') ...';
          setTimeout(processChunk, 0); 
        } else {
          renderRandomBaseline(cagrs, mdds, sharpes, simN, N);
          sl('stressLog', 'Random Baseline 完成 x' + simN, true);
          hideL();
        }
      }
      processChunk();
    } catch(e) { 
      sl('stressLog', 'Error: ' + e.message, false); 
      console.error(e);
      hideL();
    }
  }, 50);
}

function renderRandomBaseline(cagrs, mdds, sharpes, simN, N) {
  function ptile(arr, p) { 
    var s = arr.slice().sort(function(a, b) { return a - b; });
    var i = (p / 100) * (s.length - 1);
    var lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }
  function fp(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; }
  function gc(v) { return v >= 0 ? 'var(--gr)' : 'var(--re)'; }
  
  var orig = BT_RESULT;
  var origLast = orig.records[orig.records.length - 1];
  var origYrs = (new Date(origLast.month) - new Date(orig.records[0].month)) / (365.25 * 86400000);
  var origCagr = Math.pow(origLast.nav / orig.initial, 1 / origYrs) - 1;
  var origRets = orig.records.map(function(r) { return r.pRet; });
  var origAvg = origRets.reduce(function(a, b) { return a + b; }, 0) / origRets.length;
  var origStd = Math.sqrt(origRets.reduce(function(a, b) { return a + Math.pow(b - origAvg, 2); }, 0) / origRets.length) * Math.sqrt(12);
  var origSharpe = origStd > 0 ? (origCagr - 0.015) / origStd : 0;
  var origPeak = orig.initial, origMdd = 0;
  orig.records.forEach(function(r) { 
    if (r.nav > origPeak) origPeak = r.nav; 
    var dd = (r.nav - origPeak) / origPeak; 
    if (dd < origMdd) origMdd = dd; 
  });
  
  var beatCagr = cagrs.filter(function(v) { return origCagr > v; }).length / simN;
  var beatSharpe = sharpes.filter(function(v) { return origSharpe > v; }).length / simN;
  var beatCol = beatCagr >= 0.8 ? 'var(--gr)' : beatCagr >= 0.6 ? 'var(--ye)' : 'var(--re)';
  var verdict = beatCagr >= 0.8 ? 'STRONG ALPHA' : beatCagr >= 0.6 ? 'WEAK ALPHA' : 'NO EDGE';
  
  var html = '<div class="card" style="border-top:3px solid var(--gr);margin-bottom:10px;">';
  html += '<div class="ct">RANDOM BASELINE (N=' + N + ' x' + simN + ')</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">';
  html += '<div class="card" style="border-top:2px solid ' + beatCol + ';padding:9px;">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">CAGR 超越隨機率</div>';
  html += '<div class="mono" style="font-size:20px;color:' + beatCol + '">' + (beatCagr * 100).toFixed(1) + '%</div></div>';
  html += '<div class="card" style="border-top:2px solid ' + beatCol + ';padding:9px;">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Sharpe 超越隨機率</div>';
  html += '<div class="mono" style="font-size:20px;color:' + beatCol + '">' + (beatSharpe * 100).toFixed(1) + '%</div></div></div>';
  html += '<div style="background:var(--sf2);border:1px solid var(--bd);padding:8px;font-size:12px;margin-bottom:10px;">';
  html += '評定: <b style="color:' + beatCol + '">' + verdict + '</b> | ';
  html += '策略 CAGR <b style="color:var(--ye)">' + fp(origCagr) + '</b> | ';
  html += '隨機 P50 <b style="color:var(--mu)">' + fp(ptile(cagrs, 50)) + '</b></div>';
  html += '<div class="tw-wrap"><table><thead><tr>';
  html += '<th>指標</th><th>P10</th><th>P25</th><th>P50</th><th>P75</th><th>P90</th><th>策略實際</th></tr></thead><tbody>';
  
  var rows = [ ['CAGR', cagrs, true, origCagr], ['MDD', mdds, true, origMdd], ['Sharpe', sharpes, false, origSharpe] ];
  rows.forEach(function(row) {
    var name = row[0], arr = row[1], isPct = row[2], actual = row[3];
    var f = isPct ? fp : function(v) { return v.toFixed(2); };
    html += '<tr><td style="color:var(--mu);font-size:10px">' + name + '</td>';
    [10, 25, 50, 75, 90].forEach(function(p) {
      var v = ptile(arr, p);
      html += '<td class="mono" style="color:' + gc(v) + '">' + f(v) + '</td>';
    });
    html += '<td class="mono" style="color:var(--ye);font-weight:700">' + f(actual) + '</td></tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="font-size:10px;color:var(--mu);margin-top:8px;">隨機基準: 每期從全股池隨機抽N檔等權重買入 (不計交易成本)</div>';
  html += '</div>';

  var targetRes = document.getElementById('stressRes');
  if(targetRes) targetRes.classList.remove('hidden');
  var el = document.getElementById('stressMetrics');
  if (el) el.innerHTML = el.innerHTML + html;
}

// ==========================================
// 2. Cost Sensitivity 交易成本敏感度分析
// ==========================================
function runCostSensitivity() {
  if (!Object.keys(DAILY).length) { alert('請先抓取或載入資料'); return; }
  var costs = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0];
  var mh = parseInt(document.getElementById('btH') ? document.getElementById('btH').value : '5') || 5;
  var mode = getWeightMode();
  var init = gv('btCap') || 100000;
  var origCost = document.getElementById('btC') ? document.getElementById('btC').value : '0.3';
  
  sl('stressLog', 'Running Cost Sensitivity...', null); 
  showL('Cost Sensitivity...');
  
  setTimeout(async function() {
    try {
      await ensureCacheBuilt('Cost Sensitivity');
      var results = [];
      for (var ci = 0; ci < costs.length; ci++) {
        if (document.getElementById('btC')) document.getElementById('btC').value = costs[ci];
        var recs = runBTcore(mh, mode);
        if (recs && recs.length >= 6) {
          results.push({ cost: costs[ci], k: kpi(recs, init) });
        } else {
          results.push({ cost: costs[ci], k: null });
        }
      }
      if (document.getElementById('btC')) document.getElementById('btC').value = origCost;
      renderCostSensitivity(results, mh);
      sl('stressLog', 'Cost Sensitivity 完成', true);
    } catch(e) {
      if (document.getElementById('btC')) document.getElementById('btC').value = origCost;
      sl('stressLog', 'Error: ' + e.message, false);
      console.error(e);
    }
    hideL();
  }, 80);
}

function renderCostSensitivity(results, N) {
  function fp(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; }
  function gc(v) { return v >= 0 ? 'var(--gr)' : 'var(--re)'; }
  function sc(v) { return v >= 1.0 ? 'var(--gr)' : v >= 0.7 ? 'var(--ye)' : 'var(--re)'; }
  
  var breakEven = null;
  for (var i = 0; i < results.length - 1; i++) {
    if (results[i].k && results[i + 1].k) {
      if (results[i].k.cagr > 0 && results[i + 1].k.cagr <= 0) { breakEven = results[i].cost; break;}
    }
  }
  
  var html = '<div class="card" style="border-top:3px solid var(--ye);margin-bottom:10px;">';
  html += '<div class="ct">COST SENSITIVITY (N=' + N + ')</div>';
  if (breakEven !== null) {
    html += '<div style="background:var(--red);border:1px solid var(--re);padding:8px;font-size:12px;margin-bottom:10px;">';
    html += '損益轉負門檻 (Break-even Cost): <b style="color:var(--re)">~' + breakEven.toFixed(1) + '%</b></div>';
  } else {
    html += '<div style="background:var(--ted);border:1px solid var(--te);padding:8px;font-size:12px;margin-bottom:10px;">';
    html += '<b style="color:var(--te)">測試範圍內皆維持正報酬</b></div>';
  }
  
  html += '<div class="tw-wrap"><table><thead><tr>';
  html += '<th>Friction Cost</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Decay</th></tr></thead><tbody>';
  
  var baseCagr = results[0] && results[0].k ? results[0].k.cagr : null;
  
  results.forEach(function(r) {
    if (!r.k) { html += '<tr><td class="mono">' + r.cost.toFixed(1) + '%</td><td colspan="4" style="color:var(--mu)">no data</td></tr>'; return; }
    var decay = baseCagr !== null ? r.k.cagr - baseCagr : null;
    var isNeg = r.k.cagr <= 0;
    var isCurrent = Math.abs(r.cost - (gv('btC') || 0.3)) < 0.05;
    
    html += '<tr style="' + (isNeg ? 'background:var(--red);' : isCurrent ? 'background:var(--sf2);' : '') + '">';
    html += '<td class="mono" style="font-weight:700;color:' + (isNeg ? 'var(--re)' : isCurrent ? 'var(--ye)' : 'var(--tx)') + '">';
    html += r.cost.toFixed(1) + '%' + (isCurrent ? ' *' : '') + '</td>';
    html += '<td class="mono" style="color:' + gc(r.k.cagr) + ';font-weight:' + (isNeg ? '700' : '400') + '">' + fp(r.k.cagr) + '</td>';
    html += '<td class="mono" style="color:var(--re)">' + fp(r.k.mdd) + '</td>';
    html += '<td class="mono" style="color:' + sc(r.k.sharpe) + '">' + r.k.sharpe.toFixed(2) + '</td>';
    html += '<td class="mono" style="color:' + (decay !== null && decay < -0.02 ? 'var(--re)' : 'var(--mu)') + '">';
    html += decay !== null ? fp(decay) : '-';
    html += '</td></tr>';
  });
  
  html += '</tbody></table></div>';
  html += '<div style="font-size:10px;color:var(--mu);margin-top:8px;">* = current setting | Decay = relative to 0.0% cost</div>';
  html += '</div>';

  var targetRes = document.getElementById('stressRes');
  if(targetRes) targetRes.classList.remove('hidden');
  var el = document.getElementById('stressMetrics');
  if (el) el.innerHTML = el.innerHTML + html;
}
window.onload = function() {
  renderPool();
  initGroupToggles();
  togglePoolUI();

  // 啟動時不自動從 IndexedDB 載入快取。
  // 目的：避免舊 DAILY / RAW_SCORES 污染 WF、Rolling WF、T-N Sweep 結果。
  DAILY = {};
  RAW_SCORES = {};
  CACHE_BUILT = false;
  CACHE_TS = null;
  CACHE_SKIP_MO = false;

  updFetchStat();
  updTNX();
  sl('dlLog', 'Clean start：已停用啟動自動快取載入，請手動抓取或 JSON 還原。', true);
  console.log('[INIT] clean start: IndexedDB auto-load disabled.');
};
