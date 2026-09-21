
// === FINAL RETURN BASIS HELPERS ===
// Use each ticker's own available trading date within the target month.
// For monthly rebalance dates this becomes market-specific month-end pricing.
var MARKET_POINT_CACHE = {};
function getMarketMonthEndPoint(code, refDate) {
  var bars = DAILY[code];
  if (!bars || !bars.length || !refDate) return null;
  var lastDate = bars[bars.length - 1] ? bars[bars.length - 1].date : '';
  var ck = code + '|' + refDate + '|' + bars.length + '|' + lastDate;
  if (MARKET_POINT_CACHE.hasOwnProperty(ck)) return MARKET_POINT_CACHE[ck];
  var ym = refDate.slice(0, 7);
  // Binary search: find rightmost bar with date <= refDate
  var lo = 0, hi = bars.length - 1, best = -1;
  while (lo <= hi) {
    var mid = (lo + hi) >>> 1;
    if (bars[mid].date <= refDate) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  if (best < 0) return (MARKET_POINT_CACHE[ck] = null);
  // Scan backward from best to find same-month bar with valid close
  for (var i = best; i >= 0; i--) {
    if (bars[i].date.slice(0, 7) !== ym) break;
    if (bars[i].c != null) return (MARKET_POINT_CACHE[ck] = {date: bars[i].date, price: bars[i].c});
  }
  // Fallback: last available <= refDate (different month)
  for (var j = best; j >= 0; j--) {
    if (bars[j].c != null) return (MARKET_POINT_CACHE[ck] = {date: bars[j].date, price: bars[j].c, fallback: true});
  }
  return (MARKET_POINT_CACHE[ck] = null);
}
function clearMarketPointCache(){ MARKET_POINT_CACHE = {}; }

function getMarketMonthEndPrice(code, refDate) {
  var p = getMarketMonthEndPoint(code, refDate);
  return p ? p.price : null;
}

function getRefMonthEndDate(refDaily, refDate) {
  if (!refDaily || !refDaily.length || !refDate) return refDate;
  var ym = refDate.slice(0, 7);
  for (var i = refDaily.length - 1; i >= 0; i--) {
    if (refDaily[i].date.slice(0, 7) === ym && refDaily[i].date <= ym + '-31') return refDaily[i].date;
  }
  return refDate;
}
function getTNExecMode() {
  var e = $('btTNExecMode') || $('tnExecMode');
  return e ? e.value : 'T';
}
function getTNExecutionDate(refDaily, monthEndDate, signalN, execMode) {
  if (!monthEndDate) return null;
  if (execMode === 'NEXT' && signalN !== undefined && signalN !== null) {
    var n = Math.max(0, (parseInt(signalN, 10) || 0) - 1);
    return getFixedTNDate(refDaily, monthEndDate, n) || monthEndDate;
  }
  return monthEndDate;
}
function describeTNExecMode(execMode, n) {
  if (execMode === 'NEXT') return '訊號=T-' + n + '；交易=T-(' + Math.max(0, n - 1) + ')收盤→下期同基準';
  return '訊號=T-' + n + '；交易=T月底→下期T月底';
}


function getLatestMarketPoint(code) {
  var bars = DAILY[code];
  if (!bars || !bars.length) return null;
  for (var i = bars.length - 1; i >= 0; i--) {
    if (bars[i].c != null) return {date: bars[i].date, price: bars[i].c};
  }
  return null;
}
function fmtPx(v) {
  if (v === null || v === undefined || !isFinite(v)) return '--';
  var n = Math.abs(v) >= 1000 ? v.toFixed(0) : (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2));
  return n;
}
function fmtRet(v) {
  if (v === null || v === undefined || !isFinite(v)) return '--';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}
function calcLivePositionReturn(entryPrice, latestPrice, weight) {
  if (!entryPrice || !latestPrice || entryPrice <= 0) return null;
  var raw = latestPrice / entryPrice - 1;
  return weight < 0 ? -raw : raw;
}

function calcPriceReturnFromPair(entryPrice, exitPrice, weightSign) {
  if (!entryPrice || !exitPrice || entryPrice <= 0) return null;
  var raw = exitPrice / entryPrice - 1;
  return weightSign < 0 ? -raw : raw;
}
function calcStockPriceReturnForDisplay(sr, weightSign) {
  if (!sr) return null;
  var w = (weightSign !== undefined && weightSign !== null) ? weightSign : (sr.wEff !== undefined ? sr.wEff : sr.w);
  var pr = calcPriceReturnFromPair(sr.prevPrice, sr.currPrice, w);
  if (pr !== null) return pr;
  // SGOV synthetic / missing price fallback only. Do not use end NAV drift as stock return.
  if ((sr.note === 'SyntheticSGOV_TNX' || sr.note === 'PositiveMissingToSGOV') && sr.ret !== undefined && sr.ret !== null && isFinite(sr.ret)) return sr.ret;
  return null;
}
function getDisplayPricePairForStock(code, sr, record, isLatestRow) {
  sr = sr || {};
  var w = getEffectiveWeightForDisplay(sr);
  var entryDate = sr.prevDate || record.tradeStart || record.period || record.month;
  var entryPrice = sr.prevPrice;
  var exitDate = sr.currDate || record.tradeEnd || record.month;
  var exitPrice = sr.currPrice;

  // 只有真正 live-adjusted 的最後一期才允許用最新價；
  // 歷史區間最後列不可因為 isLatestRow 而被延伸到資料庫最新日。
  if (isLatestRow && record && record.liveAdjusted && code !== 'CASH') {
    var lp = getLatestMarketPoint(code);
    if (lp && lp.price !== null && lp.price !== undefined) {
      exitDate = lp.date;
      exitPrice = lp.price;
    }
  }

  var priceRet = calcPriceReturnFromPair(entryPrice, exitPrice, w);
  if (priceRet === null && (code === 'SGOV' || sr.note === 'SyntheticSGOV_TNX' || sr.note === 'PositiveMissingToSGOV')) {
    priceRet = (sr.ret !== undefined && sr.ret !== null && isFinite(sr.ret)) ? sr.ret : null;
  }
  return {entryDate:entryDate, entryPrice:entryPrice, exitDate:exitDate, exitPrice:exitPrice, priceRet:priceRet};
}
function getInitialWeightForDisplay(sr) {
  if (!sr) return 0;
  if (sr.wNominal !== undefined && sr.wNominal !== null && isFinite(sr.wNominal)) return sr.wNominal;
  if (sr.initialWeight !== undefined && sr.initialWeight !== null && isFinite(sr.initialWeight)) return sr.initialWeight;
  if (sr.wEff !== undefined && sr.wEff !== null && isFinite(sr.wEff)) return sr.wEff;
  if (sr.w !== undefined && sr.w !== null && isFinite(sr.w)) return sr.w;
  return 0;
}
function getEffectiveWeightForDisplay(sr) {
  if (!sr) return 0;
  if (sr.wEff !== undefined && sr.wEff !== null && isFinite(sr.wEff)) return sr.wEff;
  if (sr.w !== undefined && sr.w !== null && isFinite(sr.w)) return sr.w;
  return 0;
}
function fmtMaybePct(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '--';
  d = d === undefined ? 2 : d;
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
}


// === DISPLAY RETURN BASIS: latest row uses latest available price ===
// Backtest engine remains historical and auditable. The displayed latest month is
// marked-to-latest so Gross / Net / NAV / detail rows all share one basis.
function cloneBTRecordsForDisplay(records) {
  try { return JSON.parse(JSON.stringify(records || [])); }
  catch(e) { return (records || []).map(function(r){ return Object.assign({}, r); }); }
}
function getBTBenchmarkCodeForDisplay() {
  if (typeof DAILY === 'undefined') return null;
  if (DAILY['^TWII']) return '^TWII';
  if (DAILY['0050']) return '0050';
  if (DAILY['SPY']) return 'SPY';
  var keys = Object.keys(DAILY || {});
  return keys.length ? keys[0] : null;
}
function getLatestDisplayReturnPoint(code, fallbackDate) {
  var lp = getLatestMarketPoint(code);
  if (lp && lp.price !== null && lp.price !== undefined && isFinite(lp.price)) return lp;
  return getMarketMonthEndPoint(code, fallbackDate);
}
function recomputeDisplayHoldingsFromStockRets(stockRets, grossRet) {
  var out = {};
  var denom = 1 + (isFinite(grossRet) ? grossRet : 0);
  if (!isFinite(denom) || denom <= 0) denom = 1;
  Object.keys(stockRets || {}).forEach(function(k){
    var sr = stockRets[k] || {};
    var w = getInitialWeightForDisplay(sr);
    var r = (sr.ret !== undefined && sr.ret !== null && isFinite(sr.ret)) ? sr.ret : 0;
    var displayCode = sr.finalCode || k;
    out[displayCode] = (out[displayCode] || 0) + (w * (1 + r) / denom);
  });
  return out;
}
function adjustLatestRecordToLatestPrice(record, prevNav, prevBNav) {
  if (!record || !record.stockRets) return record;
  var latestAny = false;
  var gross = 0;
  Object.keys(record.stockRets).forEach(function(k){
    var sr = record.stockRets[k] || {};
    var initW = getInitialWeightForDisplay(sr);
    if (!initW || !isFinite(initW)) { sr.wEff = 0; return; }

    // Natural-elimination long chain: sr.finalCapital is the capital after chain at tradeEnd.
    // Mark only the finalCode leg from tradeEnd to latest price, then convert back to slot return.
    if (sr.finalCode && sr.finalCapital !== undefined && sr.finalCapital !== null && isFinite(sr.finalCapital)) {
      var fCode = sr.finalCode;
      var lpFinal = getLatestDisplayReturnPoint(fCode, record.tradeEnd || sr.currDate);
      if (lpFinal && lpFinal.price !== null && lpFinal.price !== undefined && isFinite(lpFinal.price)) {
        if (sr.currPrice && isFinite(sr.currPrice) && sr.currPrice > 0 && initW > 0) {
          var liveCapital = sr.finalCapital * (lpFinal.price / sr.currPrice);
          sr.ret = liveCapital / initW - 1;
          sr.finalCapital = liveCapital;
          sr.currDate = lpFinal.date;
          sr.currPrice = lpFinal.price;
          sr.note = (sr.note ? sr.note + '|' : '') + 'LiveLatest';
          latestAny = true;
        }
      }
    } else if (k !== 'CASH') {
      var lp = getLatestDisplayReturnPoint(k, record.tradeEnd || sr.currDate);
      if (lp && lp.price !== null && lp.price !== undefined && isFinite(lp.price) && sr.prevPrice && isFinite(sr.prevPrice) && sr.prevPrice > 0) {
        // sr.ret intentionally remains raw price return. Short P/L is produced by negative weight.
        sr.ret = lp.price / sr.prevPrice - 1;
        sr.currDate = lp.date;
        sr.currPrice = lp.price;
        sr.note = (sr.note ? sr.note + '|' : '') + 'LiveLatest';
        latestAny = true;
      }
    }

    sr.w = initW;
    sr.wEff = initW;
    sr.wNominal = initW;
    if (sr.ret !== undefined && sr.ret !== null && isFinite(sr.ret)) gross += initW * sr.ret;
  });

  if (!latestAny) return record;
  if (!isFinite(gross) || gross <= -0.9999) gross = -0.9999;
  var cost = (record.totalCost !== undefined && record.totalCost !== null && isFinite(record.totalCost)) ? record.totalCost : ((record.turnoverCost || 0) + (record.impactCost || 0));
  var net = gross - cost;
  if (!isFinite(net) || net <= -0.9999) net = -0.9999;

  record.grossRet = gross;
  record.pRet = net;
  record.nav = prevNav * (1 + net);
  record.holdings = recomputeDisplayHoldingsFromStockRets(record.stockRets, gross);
  record.liveAdjusted = true;
  record.liveBasis = 'LATEST_PRICE';
  record.liveAsOf = Object.keys(record.stockRets).reduce(function(mx,k){
    var d = record.stockRets[k] && record.stockRets[k].currDate;
    return (!mx || (d && d > mx)) ? d : mx;
  }, null);
  record.closureCostDiff = net - (gross - cost);
  record.closureNavDiff = (record.nav / prevNav - 1) - net;

  var bCode = getBTBenchmarkCodeForDisplay();
  if (bCode) {
    var b0 = getMarketMonthEndPoint(bCode, record.tradeStart || record.period || record.month);
    var b1 = getLatestDisplayReturnPoint(bCode, record.tradeEnd || record.month);
    if (b0 && b1 && b0.price > 0) record.bNav = prevBNav * (1 + (b1.price / b0.price - 1));
  }
  return record;
}
function getGlobalLatestMarketDateForDisplay() {
  if (typeof DAILY === 'undefined' || !DAILY) return null;
  var latest = null;
  Object.keys(DAILY).forEach(function(code){
    var bars = DAILY[code];
    if (!bars || !bars.length) return;
    for (var i = bars.length - 1; i >= 0; i--) {
      var b = bars[i];
      if (b && b.date && b.c !== null && b.c !== undefined && isFinite(b.c)) {
        if (!latest || b.date > latest) latest = b.date;
        break;
      }
    }
  });
  return latest;
}
function getRecordEndMonthForDisplay(record) {
  if (!record) return '';
  var d = record.tradeEnd || record.month || record.period || '';
  return String(d).slice(0, 7);
}
function shouldUseLatestPriceForDisplay(record) {
  // 只有「回測最後一期本身就是資料庫最新月份」時，才把最後一列標成即時價格。
  // 若使用者選 2010-2020，最後一列必須停在 2020 的 tradeEnd，不可延伸到 2026 最新價。
  var latestDate = getGlobalLatestMarketDateForDisplay();
  if (!record || !latestDate) return false;
  return getRecordEndMonthForDisplay(record) === latestDate.slice(0, 7);
}
function getDisplayBTRecords(records, init) {
  var recs = cloneBTRecordsForDisplay(records || []);
  if (!recs.length) return recs;
  var lastIdx = recs.length - 1;
  if (!shouldUseLatestPriceForDisplay(recs[lastIdx])) {
    recs[lastIdx].liveAdjusted = false;
    recs[lastIdx].liveBasis = 'TRADE_END';
    return recs;
  }
  var prevNav = lastIdx > 0 ? recs[lastIdx - 1].nav : init;
  var prevBNav = lastIdx > 0 ? recs[lastIdx - 1].bNav : init;
  recs[lastIdx] = adjustLatestRecordToLatestPrice(recs[lastIdx], prevNav, prevBNav);
  return recs;
}
function renderLatestHoldingsPriceBox(record) {
  if (!record || !record.stockRets || !record.liveAdjusted) return '';
  var rows = [];
  Object.keys(record.stockRets).forEach(function(k){
    if (k === 'CASH') return;
    var sr = record.stockRets[k] || {};
    var w = (sr.w !== undefined ? sr.w : (record.holdings ? record.holdings[k] : 0)) || 0;
    var entryPrice = sr.prevPrice;
    var entryDate = sr.prevDate || record.period || record.month;
    var latest = getLatestMarketPoint(k);
    var latestPrice = latest ? latest.price : null;
    var liveRet = calcLivePositionReturn(entryPrice, latestPrice, w);
    var side = w < 0 ? 'SHORT' : 'LONG';
    var sideColor = w < 0 ? 'var(--re)' : 'var(--gr)';
    var retColor = liveRet === null ? 'var(--mu)' : (liveRet >= 0 ? 'var(--gr)' : 'var(--re)');
    rows.push('<tr>'
      + '<td class="mono" style="color:var(--wh);font-weight:700">'+k+'</td>'
      + '<td>'+getStockName(k)+'</td>'
      + '<td class="mono" style="color:'+sideColor+'">'+side+'</td>'
      + '<td class="mono">'+Math.abs(w*100).toFixed(1)+'%</td>'
      + '<td class="mono">'+(entryDate||'--')+'</td>'
      + '<td class="mono" style="color:var(--tw)">'+fmtPx(entryPrice)+'</td>'
      + '<td class="mono">'+(latest?latest.date:'--')+'</td>'
      + '<td class="mono" style="color:var(--ac)">'+fmtPx(latestPrice)+'</td>'
      + '<td class="mono" style="color:'+retColor+';font-weight:700">'+fmtRet(liveRet)+'</td>'
      + '</tr>');
  });
  if (!rows.length) return '';
  return '<div class="card" style="border-top:3px solid var(--ac);margin-top:8px">'
    + '<div class="ct">最新一個月持股價格追蹤 <span style="font-size:10px;color:var(--mu);font-weight:400">買入價=目前選擇的T-N成交基準；最新市價=資料庫最後收盤價</span></div>'
    + '<div class="tw-wrap" style="max-height:none;margin-bottom:0"><table><thead><tr>'
    + '<th>Code</th><th>Name</th><th>Side</th><th>Weight</th><th>買入日</th><th>買入價</th><th>最新日</th><th>最新市價</th><th>即時損益%</th>'
    + '</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'
    + '</div>';
}
function renderSignalPriceLine(code, scoreDate, weightSign, sigN, anchorDate) {
  var refDaily = DAILY['^TWII'] || DAILY['0050'] || DAILY['SPY'] || DAILY[code];
  var monthEnd = anchorDate || getRefMonthEndDate(refDaily, scoreDate);
  var execMode = getTNExecMode();
  var entryDate = getTNExecutionDate(refDaily, monthEnd, sigN, execMode);
  var entry = getMarketMonthEndPoint(code, entryDate);
  var latest = getLatestMarketPoint(code);
  var liveRet = calcLivePositionReturn(entry ? entry.price : null, latest ? latest.price : null, weightSign || 1);
  var retColor = liveRet === null ? 'var(--mu)' : (liveRet >= 0 ? 'var(--gr)' : 'var(--re)');
  var modeLabel = execMode === 'NEXT' ? ('買入=T-(' + Math.max(0, (parseInt(sigN,10)||0)-1) + ')') : '買入=T';
  return '<div style="margin-top:5px;padding-top:5px;border-top:1px dashed var(--bd);font-size:10px;color:var(--mu);font-family:monospace;line-height:1.7">'
    + '<div>'+modeLabel+' | 買入日: <span style="color:var(--tw)">'+(entry?entry.date:'--')+'</span> | 買入價: <span style="color:var(--tw)">'+fmtPx(entry?entry.price:null)+'</span></div>'
    + '<div>最新日: <span style="color:var(--ac)">'+(latest?latest.date:'--')+'</span> | 最新市價: <span style="color:var(--ac)">'+fmtPx(latest?latest.price:null)+'</span> | 即時損益: <span style="color:'+retColor+';font-weight:700">'+fmtRet(liveRet)+'</span></div>'
    + '</div>';
}



// === NATURAL ELIMINATION HELPERS (isolated; OFF path does not alter original engine) ===
function getNaturalElimConfig(){
  var onEl = $('btNaturalElim');
  var rankEl = $('btNaturalRank');
  var execEl = $('btNaturalExec');
  var execMode = execEl ? execEl.value : 'CLOSE';
  if (execMode !== 'NEXT_CLOSE') execMode = 'CLOSE';
  return {
    enabled: !!(onEl && onEl.checked),
    rankLimit: Math.max(1, parseInt(rankEl ? rankEl.value : '10', 10) || 10),
    execMode: execMode
  };
}
function getPointOnOrBeforeNE(code, refDate){
  var bars = DAILY[code];
  if (!bars || !bars.length || !refDate) return null;
  for (var i=bars.length-1; i>=0; i--) if (bars[i].date <= refDate && bars[i].c != null) return {date:bars[i].date, price:bars[i].c};
  return null;
}
function getRefTradingDatesBetweenNE(refDaily, startDate, endDate){
  if (!refDaily || !refDaily.length || !startDate || !endDate) return [];
  return refDaily.filter(function(b){ return b.date > startDate && b.date < endDate; }).map(function(b){ return b.date; });
}
function getNextRefTradingDateNE(refDaily, dateStr){
  if (!refDaily || !refDaily.length || !dateStr) return null;
  for (var i=0; i<refDaily.length; i++) {
    if (refDaily[i].date > dateStr) return refDaily[i].date;
  }
  return null;
}
function buildNaturalRankListNE(dateStr, hurdle){
  var sc = calcAllScores(dateStr).filter(function(r){ return r && r.s && r.score !== null && r.r240 !== null && r.r240 > hurdle && r.s.c !== 'SGOV' && r.s.c !== 'CASH'; });
  sc.sort(function(a,b){ return b.score-a.score; });
  return sc;
}
function calcNaturalLongChainsNE(target, tradeStart, tradeEnd, refDaily, hurdle, rankLimit, execMode){
  execMode = (execMode === 'NEXT_CLOSE') ? 'NEXT_CLOSE' : 'CLOSE';
  var events = [], slots = [], blocked = {};
  Object.keys(target).forEach(function(c){ if ((target[c] || 0) < 0) blocked[c] = true; });
  Object.keys(target).forEach(function(c){
    var w = target[c];
    if (w > 0 && c !== 'CASH' && c !== 'SGOV') {
      var p0 = getPointOnOrBeforeNE(c, tradeStart);
      slots.push({ original:c, current:c, startDate:p0 ? p0.date : tradeStart, startPrice:p0 ? p0.price : null, initialWeight:w, capital:w, chain:[c], events:[], alive:!!(p0 && p0.price>0) });
      blocked[c] = true;
    }
  });
  if (!slots.length) return {slotDetails:{}, events:events, extraTurnover:0, finalHoldings:{}};
  var extraTurnover = 0;
  getRefTradingDatesBetweenNE(refDaily, tradeStart, tradeEnd).forEach(function(d){
    var rankList = buildNaturalRankListNE(d, hurdle);
    if (!rankList.length) return;
    var rankMap = {};
    rankList.forEach(function(r,i){ rankMap[r.s.c] = i+1; });
    slots.forEach(function(slot){
      if (!slot.alive || slot.capital <= 0 || slot.current === 'CASH') return;
      var currentRank = rankMap[slot.current] || 999999;
      if (currentRank <= rankLimit) return;
      var execDate = (execMode === 'NEXT_CLOSE') ? getNextRefTradingDateNE(refDaily, d) : d;
      if (!execDate || execDate > tradeEnd) return;
      var sell = getPointOnOrBeforeNE(slot.current, execDate);
      if (!sell || !sell.price || !slot.startPrice) return;
      slot.capital = slot.capital * (sell.price / slot.startPrice);
      if (!isFinite(slot.capital) || slot.capital < 0) slot.capital = 0;
      var heldNow = {};
      slots.forEach(function(s){ if (s.alive && s.current && s.current !== 'CASH') heldNow[s.current] = true; });
      var repl = null;
      for (var i=0; i<rankList.length; i++){
        var cand = rankList[i].s.c;
        if (heldNow[cand] || blocked[cand]) continue;
        if (slot.chain.indexOf(cand) !== -1) continue;
        var bp = getPointOnOrBeforeNE(cand, execDate);
        if (!bp || !bp.price) continue;
        repl = {code:cand, rank:i+1, point:bp};
        break;
      }
      extraTurnover += Math.abs(slot.capital) * 2; // sell + buy legs (one-way x2)
      blocked[slot.current] = false;
      if (!repl) {
        var sgovEvent = {date:execDate, signalDate:d, execDate:execDate, execMode:execMode, from:slot.current, to:'SGOV', rank:currentRank, newRank:null, inheritedCapital:slot.capital, remainingPct:slot.capital, sellDate:sell.date, sellPrice:sell.price, buyDate:null, buyPrice:null};
        events.push(sgovEvent);
        slot.events.push(sgovEvent);
        slot.current='SGOV'; slot.startDate=execDate; slot.startPrice=null; slot.chain.push('SGOV'); slot.alive=false;
        return;
      }
      var replEvent = {date:execDate, signalDate:d, execDate:execDate, execMode:execMode, from:slot.current, to:repl.code, rank:currentRank, newRank:repl.rank, inheritedCapital:slot.capital, remainingPct:slot.capital, sellDate:sell.date, sellPrice:sell.price, buyDate:repl.point.date, buyPrice:repl.point.price};
      events.push(replEvent);
      slot.events.push(replEvent);
      slot.current=repl.code; slot.startDate=repl.point.date; slot.startPrice=repl.point.price; slot.chain.push(repl.code); blocked[repl.code]=true;
    });
  });
  var slotDetails = {}, finalHoldings = {};
  slots.forEach(function(slot){
    if (slot.alive && slot.current !== 'CASH' && slot.current !== 'SGOV') {
      var end = getPointOnOrBeforeNE(slot.current, tradeEnd);
      if (end && end.price && slot.startPrice) slot.capital = slot.capital * (end.price / slot.startPrice);
    }
    if (!isFinite(slot.capital) || slot.capital < 0) slot.capital = 0;
    var r = slot.initialWeight > 0 ? (slot.capital / slot.initialWeight - 1) : 0;
    finalHoldings[slot.current] = (finalHoldings[slot.current] || 0) + slot.capital;
    slotDetails[slot.original] = {
      ret:r,
      w:slot.initialWeight,
      wNominal:slot.initialWeight,
      wEff:slot.initialWeight,
      prevDate:slot.startDate || tradeStart,
      currDate:tradeEnd,
      prevPrice:slot.startPrice,
      currPrice:end ? end.price : null,
      note: slot.chain.length>1 ? ('自然淘汰鏈: '+slot.chain.join('→')) : '',
      chain:slot.chain.slice(),
      naturalEvents:slot.events.slice(),
      finalCode:slot.current,
      finalCapital:slot.capital,
      endNavPct:slot.capital
    };
  });
  return {slotDetails:slotDetails, events:events, extraTurnover:extraTurnover, finalHoldings:finalHoldings};
}
function csvCell(v){
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
  return s;
}


function fmtNaturalChainHtmlNE(sr){
  if (!sr || !sr.naturalEvents || !sr.naturalEvents.length) return '';
  var rows = sr.naturalEvents.map(function(ev){
    var fromName = getStockName(ev.from);
    var toName = getStockName(ev.to);
    var remain = (ev.remainingPct !== undefined && ev.remainingPct !== null && isFinite(ev.remainingPct)) ? (ev.remainingPct * 100).toFixed(2) + '%' : '--';
    var rankText = ev.rank ? ('R' + ev.rank) : 'R--';
    var newRankText = ev.newRank ? ('R' + ev.newRank) : '--';
    var sigDate = ev.signalDate || ev.date || '--';
    var execDate = ev.execDate || ev.date || '--';
    var sellPx = (ev.sellPrice !== undefined && ev.sellPrice !== null && isFinite(ev.sellPrice)) ? fmtPx(ev.sellPrice) : '--';
    var buyPx = (ev.buyPrice !== undefined && ev.buyPrice !== null && isFinite(ev.buyPrice)) ? fmtPx(ev.buyPrice) : '--';
    return '<div style="font-size:9px;color:var(--mu);line-height:1.55;margin-top:2px;font-family:monospace">'
      + '<span style="color:var(--ye)">判定 ' + sigDate + '</span> '
      + '<span style="color:var(--ac)">換股 ' + execDate + '</span> '
      + '<span style="color:var(--re)">' + ev.from + (fromName && fromName !== ev.from ? ' ' + fromName : '') + '</span>'
      + ' 跌出門檻(' + rankText + ') 賣價 ' + sellPx + ' → '
      + '<span style="color:var(--gr)">' + ev.to + (toName && toName !== ev.to ? ' ' + toName : '') + '</span>'
      + (ev.to !== 'CASH' && ev.to !== 'SGOV' ? ' 新排序(' + newRankText + ') 買價 ' + buyPx : '')
      + '｜剩餘比例: <span style="color:var(--ac);font-weight:700">' + remain + '</span>'
      + '</div>';
  });
  var finalLine = '';
  if (sr.finalCode) {
    var fn = getStockName(sr.finalCode);
    var finalPct = (sr.finalCapital !== undefined && sr.finalCapital !== null && isFinite(sr.finalCapital)) ? (sr.finalCapital * 100).toFixed(2) + '%' : '--';
    finalLine = '<div style="font-size:9px;color:var(--mu);line-height:1.55;margin-top:2px;font-family:monospace">期末標的: <span style="color:var(--tw);font-weight:700">'
      + sr.finalCode + (fn && fn !== sr.finalCode ? ' ' + fn : '') + '</span>｜期末NAV比例: <span style="color:var(--ac);font-weight:700">' + finalPct + '</span></div>';
  }
  return '<div style="margin-top:4px;padding-left:8px;border-left:2px solid var(--ye)"><div style="font-size:9px;color:var(--ye);font-weight:700">自然淘汰鏈</div>' + rows.join('') + finalLine + '</div>';
}



// === MARKET PHASE GATE BACKTEST INTEGRATION ===
// Diagnostic-only by default. Exposure Control uses ONLY trailing completed
// factor-health rows (_fhCache before current period) to avoid look-ahead.
function getMarketPhaseGateMode(){
  var el = $('btMarketPhaseGate');
  return el ? (el.value || 'diagnostic') : 'diagnostic';
}
function getMarketPhaseExposureByPhase(phase){
  phase = parseInt(phase,10) || 0;
  var defaults = {1:50,2:80,3:100,4:80,5:65,6:25};
  var el = $('btPhaseExp' + phase);
  var pct = el ? parseFloat(el.value) : defaults[phase];
  if (pct === null || pct === undefined || !isFinite(pct)) pct = defaults[phase] || 100;
  return Math.max(0, Math.min(150, pct)) / 100;
}
function getMarketPhaseDecisionForBacktest(fhCache, shortN, longN){
  var mode = getMarketPhaseGateMode();
  var off = {enabled:false, control:false, mode:mode, phase:0, title:'OFF', state:'OFF', exposure:1.0, confidence:0, risk:'--', reasons:['Market Phase Gate OFF']};
  if (mode === 'off') return off;
  if (!fhCache || !fhCache.months || fhCache.months.length < Math.max(6, shortN || 6) || typeof calcMarketPhaseFromFH !== 'function') {
    return {enabled:true, control:false, mode:mode, phase:0, title:'資料不足', state:'Insufficient trailing data', exposure:1.0, confidence:0, risk:'--', reasons:['前期Factor Health樣本不足，僅診斷不降曝險']};
  }
  var mp = calcMarketPhaseFromFH(fhCache, shortN || 6, longN || 36);
  var exp = getMarketPhaseExposureByPhase(mp.phase);
  var control = (mode === 'control');
  return {
    enabled:true,
    control:control,
    mode:mode,
    phase:mp.phase || 0,
    title:mp.title || 'Phase --',
    state:mp.state || '--',
    exposure: control ? exp : 1.0,
    suggestedExposure: exp,
    exposureBand: mp.exposureBand || '--',
    confidence: mp.confidence || 0,
    risk: mp.risk || '--',
    reasons: mp.bullets || [],
    metrics: mp.metrics || {},
    heat: mp.heat || {},
    curve: mp.curve || {}
  };
}
function formatMarketPhaseMini(decision){
  if (!decision || !decision.enabled) return 'Phase OFF';
  if (!decision.phase) return 'Phase --';
  return 'P' + decision.phase + ' ' + (decision.state || '') + ' Exp=' + Math.round((decision.suggestedExposure || decision.exposure || 1)*100) + '%';
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
  var capMode=document.querySelector('input[name="capMode"]:checked')?document.querySelector('input[name="capMode"]:checked').value:'1330';
  var wtModeEl=document.querySelector('input[name="wtMode"]:checked');
  var wtMode=wtModeEl?wtModeEl.value:'eq';
  var shortTSF=!!($('btSTSF')&&$('btSTSF').checked);
  var regimeOn=$('btRegime')&&$('btRegime').value==='on';
  var regimeExp=gv('btRegimeExp')||100;
  var regimeLen = opts.regimeLen || (parseInt(($('btRegimeLen') ? $('btRegimeLen').value : '60'), 10) || 60);
  var useMA60=$('ma60Filter')?$('ma60Filter').value==='on':true;
  var tnExecMode = opts.tnExecMode || getTNExecMode();
  var naturalCfg = getNaturalElimConfig();

  var nav=INIT, bNav=INIT, records=[], holdings={SGOV:1.0};
      var DEFENSIVE=['SGOV'];

  // Incremental factor health cache for regime light performance
  var _fhCache = {months: [], factors: [['mom','Momentum'],['bias','Bias'],['slope','Slope'],['vol','Volatility'],['kbar','K-Bar'],['score','Total Score']]};

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
      records.push({month:sigM,period:prevM+" ~ "+sigM,nav:nav,bNav:bNav,holdings:{SGOV:1.0},targetWeights:{SGOV:1.0},pRet:0,hurdle:0,stockRets:{},scoringM:null,note:'No scoring base'});
      holdings={SGOV:1.0};
      continue;
    }
    var scoreM;
    if (opts.signalN !== undefined && opts.signalN !== null) {
      // T-N signal date must follow the same scoring base as normal lag mode.
      // When Skip Month is ON, use scoreBaseM (one full rebalance period earlier),
      // not prevM; otherwise T-N silently bypasses the skip-month leakage guard.
      scoreM = getFixedTNDate(refDaily, scoreBaseM, opts.signalN);
    } else {
      scoreM = (LAG === 1)
        ? getPrevWorkDay(refDaily, scoreBaseM, 1)
        : (LAG === 2 ? getPrevWorkDay(refDaily, scoreBaseM, 2) : scoreBaseM);
    }
    var tradePrevM = prevM;
    var tradeSigM = sigM;
    if (opts.signalN !== undefined && opts.signalN !== null) {
      tradePrevM = getTNExecutionDate(refDaily, prevM, opts.signalN, tnExecMode);
      tradeSigM = getTNExecutionDate(refDaily, sigM, opts.signalN, tnExecMode);
    }
    // AUDIT: T-N timing check
    auditTN(scoreM, tradePrevM, tradeSigM, opts.signalN || 0, tnExecMode);
    var tradePeriod = tradePrevM + " ~ " + tradeSigM;
    var scoringM = scoreM;
    var hurdle = getHurdle(scoringM);
    var sc2 = calcAllScores(scoringM);
    var valid=sc2.filter(function(r){ return r.score!==null; });
    valid.sort(function(a,b){ return b.score-a.score; });

    if (valid.length < 5) {
      var b0x=getPriceOnDate(refDaily,tradePrevM), b1x=getPriceOnDate(refDaily,tradeSigM);
      if(b0x&&b1x&&b0x>0) bNav*=(1+(b1x/b0x-1));
      records.push({month:sigM,period:tradePeriod,nav:nav,bNav:bNav,holdings:{SGOV:1.0},targetWeights:{SGOV:1.0},pRet:0,hurdle:hurdle,stockRets:{},scoringM:scoreM,tnExecMode:tnExecMode,tradeStart:tradePrevM,tradeEnd:tradeSigM});
      holdings={SGOV:1.0}; continue;
    }

    // Regime Adaptive Control: use trailing completed factor-health cache only.
    // It can adjust exposure, N and Freeze-new-entry without look-ahead.
    var adaptiveDecision = (typeof getRegimeAdaptiveBacktestDecision === 'function')
      ? getRegimeAdaptiveBacktestDecision(scoreM, records, _fhCache, mh)
      : {enabled:false, level:'OFF', exposure:1.0, adaptiveN:mh, freeze:false, label:'OFF', reasons:[]};
    var adaptiveN = (adaptiveDecision && adaptiveDecision.enabled && adaptiveDecision.adaptiveN)
      ? adaptiveDecision.adaptiveN : mh;
    var adaptiveFreeze = !!(adaptiveDecision && adaptiveDecision.enabled && adaptiveDecision.freeze);
    var adaptiveHeldMap = {};
    Object.keys(holdings || {}).forEach(function(c){
      if (c !== 'SGOV' && c !== 'CASH' && Math.abs(holdings[c] || 0) > 0.0001) adaptiveHeldMap[c] = true;
    });

    // FIX3: poolModeSetting declared first, exitMap uses calcSimpleMA
    var poolModeSetting = document.getElementById('poolMode').value;

    var ma60ModeEl = $('ma60FilterMode');
    var ma60Mode = ma60ModeEl ? ma60ModeEl.value : 'all'; // all = existing holdings + new candidates, held = existing holdings only
    var ma60Cache = {};
    function isMA60Blocked(c) {
      if (!useMA60 || !c || c === 'CASH' || c === 'SGOV') return false;
      if (ma60Cache.hasOwnProperty(c)) return ma60Cache[c];
      var bars = DAILY[c];
      if (!bars) return (ma60Cache[c] = false);
      var ma = calcSimpleMA(bars, scoreM, 60);
      var price = getPriceOnDate(bars, scoreM);
      var prevDate = getPrevWorkDay(refDaily, scoreM, 5);
      var prevMa = calcSimpleMA(bars, prevDate, 60);
      return (ma60Cache[c] = !!((ma && price && price < ma) || (ma && prevMa && ma < prevMa)));
    }

    var exitMap = {};
    if (useMA60) {
      Object.keys(holdings).forEach(function(c) {
        if (isMA60Blocked(c)) exitMap[c] = true;
      });
    }

    // FIX3: single unified candidate list; no double pools variable
    var mainCands = valid.filter(function(r) {
      if (r.r240 === null || r.r240 <= hurdle) return false;
      if (DEFENSIVE.indexOf(r.s.c) !== -1) return false;
      if (adaptiveFreeze && !adaptiveHeldMap[r.s.c]) return false;
      if (exitMap[r.s.c]) return false;
      if (useMA60 && ma60Mode === 'all' && isMA60Blocked(r.s.c)) return false;
      return true;
    });

    var sel = [];

    if (poolModeSetting === 'large') {
      var totalMax = adaptiveDecision.enabled ? adaptiveN : (parseInt(document.getElementById('btH').value) || 5);
      mainCands.sort(function(a,b){ return b.score-a.score; });
    // AUDIT: rank sort order
    auditRankMonotonicity(mainCands, sigM);
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

    var totalQuota = poolModeSetting === 'large'
      ? (adaptiveDecision.enabled ? adaptiveN : (parseInt(document.getElementById('btH').value) || 5))
      : (parseInt($('btQuotaTW') ? $('btQuotaTW').value : '2') || 0)
        + (parseInt($('btQuotaUS') ? $('btQuotaUS').value : '2') || 0)
        + (parseInt($('btQuotaETF') ? $('btQuotaETF').value : '1') || 0);

    // 多方缺額只記錄為 longFillSlots，後面補到 target 的 SGOV。
    // 不再 push 到 sel，避免 SGOV 被當成多方候選，甚至再流入空方候選。
    var longFillSlots = Math.max(0, totalQuota - sel.length);

    var selS=[];
    if (shortN>0) {
      var longMap={};
      sel.forEach(function(r){ longMap[r.s.c]=1; });
      var sCands = valid.filter(function(r){
        if (!r || !r.s) return false;
        if (longMap[r.s.c]) return false;

        // 防禦資產、現金、ETF 不允許進入空方。
        if (r.s.c === 'SGOV' || r.s.c === 'CASH') return false;
        if (r.s.pool === 'etf') return false;
        if (r.s.region === 'etf') return false;
        if (adaptiveFreeze && !adaptiveHeldMap[r.s.c]) return false;

        return true;
      });
      if (shortTSF) sCands=sCands.filter(function(r){ return r.r240!==null&&r.r240<0; });
      sCands.sort(function(a,b){ return a.score-b.score; });
      for (var ks=0; ks<sCands.length&&selS.length<shortN; ks++) {
        var candS=sCands[ks];
        if (selS.every(function(x){ return Math.abs(calcCorr(candS.s.c,x.s.c,scoreM))<ct; })) selS.push(candS);
      }
    }


    var marketRegimeExposure = 1.0;
    var _regimeBearish = regimeOn && isBearishRegime(refDaily, scoreM, regimeLen);
    if (_regimeBearish) marketRegimeExposure = regimeExp / 100;
    // AUDIT: Regime signal sanity
    if (regimeOn && DEBUG_AUDIT) {
      var _vwmaRef = (function(){
        try { return typeof calcVWMAOnDate === 'function' ? calcVWMAOnDate(refDaily, scoreM, regimeLen) : null; } catch(e){return null;}
      })();
      var _priceRef = (function(){
        try { return typeof getPriceOnDate === 'function' ? getPriceOnDate(refDaily, scoreM) : null; } catch(e){return null;}
      })();
      auditRegime(scoreM, _regimeBearish, _vwmaRef, _priceRef, regimeLen, sigM);
    }

    // Exposure model v3.6:
    // VWMA is the primary market switch. If VWMA is risk-on, VWMA exposure is 100% and does not reduce capital.
    // The VWMA bear exposure input is used only when VWMA is bearish.
    // 4F/3D signal is a user-adjustable multiplier; defaults keep Green at 100% and progressively reduce Yellow/Orange/Red.
    var shield = getShieldDecision(scoreM, records, _fhCache);
    var shieldExposure = (shield && shield.enabled && typeof shield.exposure === 'number') ? shield.exposure : 1.0;
    var adaptiveExposure = (adaptiveDecision && adaptiveDecision.enabled && typeof adaptiveDecision.exposure === 'number') ? adaptiveDecision.exposure : 1.0;
    var factorExposureMultiplier = (adaptiveDecision && adaptiveDecision.enabled) ? adaptiveExposure : shieldExposure;
    if (!isFinite(factorExposureMultiplier)) factorExposureMultiplier = 1.0;
    factorExposureMultiplier = Math.max(0, Math.min(1.5, factorExposureMultiplier));

    // Market Phase Gate: based on completed prior IC / factor-health rows only.
    // Diagnostic mode records the phase but leaves exposure unchanged.
    // Exposure Control mode multiplies the final risk exposure and parks residual capital in SGOV.
    var marketPhaseDecision = getMarketPhaseDecisionForBacktest(_fhCache, 6, 36);
    var marketPhaseExposure = (marketPhaseDecision && marketPhaseDecision.control && typeof marketPhaseDecision.exposure === 'number') ? marketPhaseDecision.exposure : 1.0;
    if (!isFinite(marketPhaseExposure)) marketPhaseExposure = 1.0;
    marketPhaseExposure = Math.max(0, Math.min(1.5, marketPhaseExposure));

    var vwmaActive = !!_regimeBearish;
    var vwmaExposureUsed = vwmaActive ? marketRegimeExposure : 1.0;
    var exposure = vwmaExposureUsed * factorExposureMultiplier * marketPhaseExposure;
    if (!isFinite(exposure)) exposure = 1.0;
    exposure = Math.max(0, Math.min(1, exposure));
    var exposureLayers = {
      marketRegimeExposure: marketRegimeExposure,
      vwmaExposureUsed: vwmaExposureUsed,
      vwmaActive: vwmaActive,
      shieldExposure: shieldExposure,
      adaptiveExposure: adaptiveExposure,
      factorExposureMultiplier: factorExposureMultiplier,
      marketPhaseExposure: marketPhaseExposure,
      marketPhaseMode: marketPhaseDecision ? marketPhaseDecision.mode : 'off',
      marketPhaseControl: !!(marketPhaseDecision && marketPhaseDecision.control),
      marketPhase: marketPhaseDecision ? marketPhaseDecision.phase : 0,
      exposureFormula: '(VWMA bearish ? VWMA bear exposure : 100%) * 4F multiplier * MarketPhase multiplier',
      finalExposure: exposure,
      regimeBearish: !!_regimeBearish,
      shieldMode: ($('btShieldGate') ? $('btShieldGate').value : 'off'),
      adaptiveOverlay: !!(adaptiveDecision && adaptiveDecision.enabled)
    };

    var target={};
    var is1330 = capMode === '1330';
    var is5050 = (capMode === '5050' || capMode === 'neutral'); // neutral 保留舊版相容
    var is1000 = capMode === '1000';
    var isShortOnly = capMode === 'short_only';
    var hasLong = (sel && sel.length > 0);
    var hasShort = (shortN > 0 && selS && selS.length > 0);

    // Capital Mode:
    // - 100/0: 100% long only.
    // - 50/50: 50% long / 50% short；空方不足不補 SGOV。
    // - 130/30: 有空方時 130% long / 30% short；空方不足降為 100/0。
    // - Short Only: 100% short；不得因多方 sel 為空而轉成 CASH/SGOV。
    var lScale = 0.0, sScale = 0.0;
    if (isShortOnly) {
      lScale = 0.0;
      sScale = hasShort ? 1.0 : 0.0;
    } else if (is1000) {
      lScale = hasLong ? 1.0 : 0.0;
      sScale = 0.0;
    } else if (is1330) {
      lScale = hasLong ? (hasShort ? 1.3 : 1.0) : 0.0;
      sScale = hasShort ? 0.3 : 0.0;
    } else if (is5050) {
      lScale = hasLong ? 0.5 : 0.0;
      sScale = hasShort ? 0.5 : 0.0;
    } else {
      lScale = hasLong ? 1.0 : 0.0;
      sScale = 0.0;
    }

    // 多方因市場弱化、MA、hurdle、相關係數或產業限額而不足時，
    // 股票部分只分配已入選名額對應權重，剩餘 long side 後面補 SGOV。
    var selectedLongSlots = hasLong ? sel.length : 0;
    var longSlotBase = totalQuota > 0 ? totalQuota : selectedLongSlots;
    var effectiveLongScale = lScale;
    if (!isShortOnly && longFillSlots > 0 && longSlotBase > 0) {
      effectiveLongScale = lScale * (selectedLongSlots / longSlotBase);
    }

    if (!isShortOnly && hasLong && effectiveLongScale > 0) {
      if (wtMode==='rank') {
        var ldenom=sel.length*(sel.length+1)/2;
        sel.forEach(function(r,i){ target[r.s.c]=effectiveLongScale*((sel.length-i)/ldenom)*exposure; });
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
        ivolArr.forEach(function(x){ target[x.c]=(effectiveLongScale*x.iv/volSum)*exposure; });
      } else {
        var lw=(effectiveLongScale/sel.length)*exposure;
        sel.forEach(function(r){ target[r.s.c]=lw; });
      }
    }

    if (hasShort && sScale > 0) {
      var sdenom=wtMode==='rank'?selS.length*(selS.length+1)/2:selS.length;
      selS.forEach(function(r,i){
        var weight=(wtMode==='rank')?((selS.length-i)/sdenom):(1/sdenom);
        target[r.s.c]=-sScale*weight*exposure;
      });
    }

    // 多方缺額補防禦資產：只補 long side 的缺額，不補 short side。
    // short_only 永遠不補 SGOV，否則純空模式會被稀釋成低報酬。
    if (!isShortOnly && longFillSlots > 0 && longSlotBase > 0 && lScale > 0) {
      var defensiveCode = 'SGOV';

      var fillWeight = lScale * (longFillSlots / longSlotBase) * exposure;
      if (fillWeight > 0.001) {
        target[defensiveCode] = (target[defensiveCode] || 0) + fillWeight;
      }
    }

    // 非 short_only 若完全沒有可執行部位，才維持 100% SGOV。
    // 注意：這是「初始配置」的 100%，後面不得再因 regimeFill 重複補 SGOV。
    var allDefensiveTarget = false;
    if (!Object.keys(target).length && !isShortOnly) {
      target['SGOV']=1.0;
      allDefensiveTarget = true;
    }

    // 只在 100/0 純多模式補足到 100%。
    // 50/50 與 130/30 是多空架構，不能用 1 - 淨權重 補現金，
    // 否則 50/50 的 +50% / -50% 會被誤補成 100% CASH。
    if (capMode === '1000') {
      var totalW=0;
      Object.keys(target).forEach(function(c){ totalW+=target[c]; });
      var cashW=1.0-totalW;
      if (cashW>0.001) {
        var residualCode = 'SGOV';
        target[residualCode]=(target[residualCode]||0)+cashW;
      }
    }

    // Regime 減碼保留指定動能曝險，削減掉的資金一律進 SGOV。
    // 100/0 已由上方 residual 補滿；多空模式需明確補 SGOV，否則 CSV 會出現權重未滿 100%。
    if (!isShortOnly && !allDefensiveTarget && exposure < 0.999 && capMode !== '1000') {
      var regimeFill = 1.0 - exposure;
      if (regimeFill > 0.001) target['SGOV'] = (target['SGOV'] || 0) + regimeFill;
    }

    // 初始配置守恆：只修 targetWeights 的下單權重，不修期末 drift / natural finalHoldings。
    // 期末因獲利造成 holdings / endNavPct 加總超過 100% 是正常 NAV 漂移，不可在這裡裁掉。
    if (!isShortOnly) {
      var initNet = 0;
      Object.keys(target).forEach(function(c){
        var w = target[c] || 0;
        if (c === 'SGOV' || c === 'CASH') initNet += w;
        else initNet += w;
      });
      if (initNet > 1.000001) {
        var excess = initNet - 1.0;
        ['SGOV','CASH'].forEach(function(dc){
          if (excess <= 0) return;
          var cut = Math.min(target[dc] || 0, excess);
          if (cut > 0) { target[dc] -= cut; excess -= cut; }
          if (Math.abs(target[dc] || 0) < 1e-10) delete target[dc];
        });
      }
    }

    // Shield/4-Factor exposure is already applied through the final min() cap above.
    // Do not multiply or rescale target again here; otherwise VWMA x 4-Factor x Adaptive becomes over-defensive.

    // AUDIT: Exposure accounting check
    auditExposure(target, exposure,
      (shield && shield.enabled ? (shield.exposure !== undefined ? shield.exposure : 1.0) : 1.0),
      capMode, sigM);

    var turnover=0;
    var allT=Object.keys(holdings).concat(Object.keys(target));
    var seenT={};
    allT.forEach(function(c){
      if(seenT[c]) return; seenT[c]=1;
      var oldW=holdings[c]||0, newW=target[c]||0;
      turnover+=Math.abs(newW-oldW);
    });
    turnover/=2;

    // AUDIT: Turnover sanity check (before natural elimination add-on)
    var _naturalExtraForAudit = 0;

    var baseSlippage=0.001;
    var impactMultiplier=turnover>0?Math.max(1,Math.pow(turnover/0.2,1.5)):0;
    var impactCost=baseSlippage*impactMultiplier;
    var friction=(turnover*COST)+impactCost;

    var cashRet=0;
    var s0p=getMarketMonthEndPoint('SGOV', tradePrevM), s1p=getMarketMonthEndPoint('SGOV', tradeSigM);
    if (s0p && s1p && s0p.price > 0) {
      cashRet=s1p.price/s0p.price-1;
    } else {
      var cr=getTNXRate(scoreM), cashDivisor=(freq==="2")?24:12;
      var CASH_FACTOR=0.7; // approximate cash rate discount when SGOV unavailable
      cashRet=(cr*CASH_FACTOR)/cashDivisor;
    }

    var naturalResult = null;
    var naturalExtraTurnover = 0;
    if (naturalCfg.enabled) {
      naturalResult = calcNaturalLongChainsNE(target, tradePrevM, tradeSigM, refDaily, hurdle, naturalCfg.rankLimit, naturalCfg.execMode);
      naturalExtraTurnover = naturalResult.extraTurnover || 0;
      _naturalExtraForAudit = naturalExtraTurnover;
      turnover += naturalExtraTurnover;
      // Natural elimination ON uses linear impact on actual turnover to avoid artificial cost explosions.
      impactCost = turnover * baseSlippage;
      friction = (turnover * COST) + impactCost;
    }
    auditTurnover(turnover - _naturalExtraForAudit, _naturalExtraForAudit, sigM);

    var stockRets={};
    Object.keys(target).forEach(function(c){
      var nominalW = target[c];
      if (c==='CASH' || c==='SGOV') {
        var sg0=getMarketMonthEndPoint('SGOV', tradePrevM), sg1=getMarketMonthEndPoint('SGOV', tradeSigM);
        var sgRet = (sg0 && sg1 && sg0.price>0) ? (sg1.price/sg0.price-1) : cashRet;
        stockRets['SGOV']={ret:sgRet,w:(stockRets['SGOV']?stockRets['SGOV'].w:0)+nominalW,wNominal:(stockRets['SGOV']?stockRets['SGOV'].wNominal:0)+nominalW,wEff:(stockRets['SGOV']?stockRets['SGOV'].wEff:0)+nominalW,prevDate:sg0?sg0.date:tradePrevM,currDate:sg1?sg1.date:tradeSigM,prevPrice:sg0?sg0.price:null,currPrice:sg1?sg1.price:null,note:(sg0&&sg1?'SGOV':'SyntheticSGOV_TNX')};
      } else {
        if (naturalResult && naturalResult.slotDetails && naturalResult.slotDetails[c] && nominalW > 0) {
          stockRets[c] = naturalResult.slotDetails[c];
          return;
        }
        var p0pt=getMarketMonthEndPoint(c, tradePrevM), p1pt=getMarketMonthEndPoint(c, tradeSigM);
        var retVal=(p0pt&&p1pt&&p0pt.price>0)?(p1pt.price/p0pt.price-1):null;
        // AUDIT: return basis check
        auditReturn(c, p0pt?p0pt.date:null, p0pt?p0pt.price:null,
          p1pt?p1pt.date:null, p1pt?p1pt.price:null, nominalW, sigM);
        if (nominalW < 0) auditShort(c, p0pt?p0pt.price:null, p1pt?p1pt.price:null, nominalW, sigM);
        stockRets[c]={
          ret:retVal,
          w:nominalW,
          wNominal:nominalW,
          wEff:0,
          prevDate:p0pt?p0pt.date:null,
          currDate:p1pt?p1pt.date:null,
          prevPrice:p0pt?p0pt.price:null,
          currPrice:p1pt?p1pt.price:null,
          note:(retVal===null?'Missing':((p0pt&&p0pt.fallback)||(p1pt&&p1pt.fallback)?'FallbackDate':''))
        };
      }
    });

    // Return basis, final rule:
    // Gross Return = sum(position raw return * INITIAL signed weight).
    // Net Return   = Gross Return - explicit costs.
    // Do NOT re-leverage/redistribute survivors because that makes monthly Return%
    // diverge from the visible weighted-stock contribution table.
    var validTarget={}, grossRet=0;
    var naturalOriginals = {};
    if (naturalResult && naturalResult.slotDetails) {
      Object.keys(naturalResult.slotDetails).forEach(function(c){ naturalOriginals[c] = true; });
    }

    // Natural-chain contribution is already a full strategy return for the original slot.
    Object.keys(naturalOriginals).forEach(function(c){
      var rd = stockRets[c];
      if (!rd || rd.ret === null || !isFinite(rd.ret)) return;
      var iw = (rd.wNominal !== undefined ? rd.wNominal : (rd.w !== undefined ? rd.w : (target[c] || 0))) || 0;
      rd.wEff = iw;
      rd.w = iw;
      validTarget[c] = iw;
      grossRet += iw * rd.ret;
    });

    var missingPositiveToSGOV = 0;
    Object.keys(target).forEach(function(c){
      if (naturalOriginals[c]) return;
      var w = target[c], rd = stockRets[c];
      if (!rd || rd.ret === null || !isFinite(rd.ret)) {
        if (rd) { rd.wEff = 0; rd.note = (rd.note ? rd.note + '|' : '') + 'MissingNoReturn'; }
        // Positive missing exposure is parked in SGOV rather than redistributed to winners/losers.
        // Missing short exposure is left flat because a missing borrow/price cannot be valued safely.
        if (w > 0 && c !== 'SGOV' && c !== 'CASH') missingPositiveToSGOV += w;
        return;
      }
      rd.wEff = w;
      rd.w = w;
      if (rd.wNominal === undefined || rd.wNominal === null || !isFinite(rd.wNominal)) rd.wNominal = w;
      validTarget[c] = (validTarget[c] || 0) + w;
      grossRet += w * rd.ret;
    });

    if (missingPositiveToSGOV > 0) {
      validTarget['SGOV'] = (validTarget['SGOV'] || 0) + missingPositiveToSGOV;
      var sg0m = getMarketMonthEndPoint('SGOV', tradePrevM), sg1m = getMarketMonthEndPoint('SGOV', tradeSigM);
      var sgRetM = (sg0m && sg1m && sg0m.price > 0) ? (sg1m.price / sg0m.price - 1) : cashRet;
      if (stockRets['SGOV'] && stockRets['SGOV'].ret !== null && isFinite(stockRets['SGOV'].ret)) {
        stockRets['SGOV'].w = (stockRets['SGOV'].w || 0) + missingPositiveToSGOV;
        stockRets['SGOV'].wEff = (stockRets['SGOV'].wEff || 0) + missingPositiveToSGOV;
        stockRets['SGOV'].wNominal = (stockRets['SGOV'].wNominal || 0) + missingPositiveToSGOV;
        stockRets['SGOV'].note = (stockRets['SGOV'].note || 'SGOV') + '|MissingPositiveToSGOV';
      } else {
        stockRets['SGOV'] = {ret:sgRetM,w:missingPositiveToSGOV,wNominal:missingPositiveToSGOV,wEff:missingPositiveToSGOV,prevDate:sg0m?sg0m.date:tradePrevM,currDate:sg1m?sg1m.date:tradeSigM,prevPrice:sg0m?sg0m.price:null,currPrice:sg1m?sg1m.price:null,note:'MissingPositiveToSGOV'};
      }
      grossRet += missingPositiveToSGOV * sgRetM;
    }
    if (!isFinite(grossRet)||grossRet<=-0.9999) grossRet=-0.9999;

    var turnoverCost=turnover*COST;
    var totalCost=turnoverCost+impactCost;
    var netRet=grossRet-totalCost;
    if (!isFinite(netRet)||netRet<=-0.9999) netRet=-0.9999;
    var navPrev=nav;
    nav*=(1+netRet);
    // AUDIT: NAV chain integrity
    auditNAV(navPrev, grossRet, totalCost, nav, sigM);
    // CLOSURE CHECK: independently recompute gross from stockRets to catch any
    // accumulation drift vs the running grossRet variable.
    var closureGross = 0;
    Object.keys(stockRets).forEach(function(ck){
      var sr2 = stockRets[ck];
      if (!sr2 || sr2.ret === null || !isFinite(sr2.ret)) return;
      var iw2 = (sr2.wNominal !== undefined && isFinite(sr2.wNominal)) ? sr2.wNominal : ((sr2.w !== undefined && isFinite(sr2.w)) ? sr2.w : 0);
      closureGross += iw2 * sr2.ret;
    });
    if (!isFinite(closureGross) || closureGross <= -0.9999) closureGross = -0.9999;
    var closureCostDiff = grossRet - closureGross;
    var closureNavDiff = (nav / navPrev - 1) - netRet;

    var drifted={};
    var driftDenom=(1+grossRet);
    if (!isFinite(driftDenom)||driftDenom<=0) driftDenom=1;
    for (var c in validTarget) {
      drifted[c]=(validTarget[c]*(1+(stockRets[c]?stockRets[c].ret:0)))/driftDenom;
    }
    if (naturalResult && naturalResult.finalHoldings) {
      var nd = {};
      Object.keys(drifted).forEach(function(k){
        if (target[k] > 0 && k !== 'CASH' && k !== 'SGOV') return;
        nd[k] = drifted[k];
      });
      Object.keys(naturalResult.finalHoldings).forEach(function(k){ nd[k] = (nd[k] || 0) + naturalResult.finalHoldings[k] / driftDenom; });
      drifted = nd;
    }

    var b0=getMarketMonthEndPrice(masterTicker,tradePrevM), b1=getMarketMonthEndPrice(masterTicker,tradeSigM);
    if (b0&&b1&&b0>0) bNav*=(1+(b1/b0-1));

    // Display / CSV holdings should mean end-of-period NAV weights.
    // Initial target weights are already preserved in targetWeights and stockRets.wNominal.
    // Using validTarget/finalHoldings here made the table label "期末NAV比例" logically wrong.
    var hCopy={};
    Object.keys(drifted || {}).forEach(function(k){ hCopy[k]=drifted[k]; });
    var recPeriod = tradePeriod;
    var allScoresCopy = sc2.filter(function(r){return r.score!==null;}).map(function(r){
      return {c:r.s.c, pool:r.s.pool, score:r.score, zm:r.zm, zb:r.zb, zs:r.zs, zv:r.zv, zk:r.zk};
    });
    records.push({month:sigM,period:recPeriod,nav:nav,bNav:bNav,holdings:hCopy,targetWeights:Object.assign({},target),pRet:netRet,grossRet:grossRet,turnover:turnover,turnoverCost:turnoverCost,impactCost:impactCost,totalCost:totalCost,closureCostDiff:closureCostDiff,closureNavDiff:closureNavDiff,hurdle:hurdle,stockRets:stockRets,scoringM:scoreM,regimeOn:regimeOn,regimeBearish:(regimeOn&&isBearishRegime(refDaily,scoreM,regimeLen)),regimeExposure:exposure,regimeLen:regimeLen,shield:shield,stressLevel:shield.stressLevel||0,adaptiveRegime:adaptiveDecision,marketPhaseDecision:marketPhaseDecision,marketPhase:(marketPhaseDecision?marketPhaseDecision.phase:0),marketPhaseTitle:(marketPhaseDecision?marketPhaseDecision.title:'OFF'),marketPhaseState:(marketPhaseDecision?marketPhaseDecision.state:'OFF'),marketPhaseExposure:(marketPhaseDecision?marketPhaseDecision.exposure:1.0),marketPhaseSuggestedExposure:(marketPhaseDecision?marketPhaseDecision.suggestedExposure:1.0),marketPhaseMode:(marketPhaseDecision?marketPhaseDecision.mode:'off'),marketRegimeExposure:marketRegimeExposure,shieldExposure:shieldExposure,adaptiveExposure:adaptiveExposure,finalExposure:exposure,exposureLayers:exposureLayers,allScores:allScoresCopy,naturalEvents:(naturalResult?naturalResult.events:[]),naturalOn:!!naturalResult,tnExecMode:tnExecMode,tradeStart:tradePrevM,tradeEnd:tradeSigM});
    // Incremental factor health: compute IC for just this new record and append
    if (typeof calcFactorHealthSingleRow === 'function') {
      var _fhRow = calcFactorHealthSingleRow(records[records.length - 1]);
      if (_fhRow) {
        records[records.length - 1].factorHealthRow = _fhRow;
        _fhCache.months.push(_fhRow);
      }
    }
    holdings=drifted;
  }
  return records.length>=6 ? records : null;
}

function sampleStdAnnualized(arr) {
  if (!arr || arr.length < 2) return 0;
  var avg = arr.reduce(function(a,b){ return a + b; }, 0) / arr.length;
  var variance = arr.reduce(function(a,b){ return a + Math.pow(b - avg, 2); }, 0) / (arr.length - 1);
  return Math.sqrt(Math.max(variance, 0)) * Math.sqrt(getAnnualPeriods());
}
function periodsToYears(periodCount) {
  var p = getAnnualPeriods ? getAnnualPeriods() : 12;
  return p > 0 ? periodCount / p : periodCount / 12;
}

function getRiskFreeAnnualRate() {
  return 0.015;
}
function meanReturn(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce(function(a,b){ return a + b; }, 0) / arr.length;
}
function periodSampleStd(arr) {
  if (!arr || arr.length < 2) return 0;
  var avg = meanReturn(arr);
  var variance = arr.reduce(function(a,b){ return a + Math.pow(b - avg, 2); }, 0) / (arr.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}
function geometricAnnualizedReturnFromReturns(arr, periods) {
  periods = periods || ((typeof getAnnualPeriods === 'function') ? getAnnualPeriods() : 12);
  if (!arr || !arr.length) return 0;
  var nav = arr.reduce(function(acc, r){ return acc * (1 + r); }, 1);
  if (!isFinite(nav) || nav <= 0) return -1;
  var yrs = arr.length / periods;
  return yrs > 0 ? Math.pow(nav, 1 / yrs) - 1 : 0;
}
function arithmeticAnnualizedMeanReturnFromReturns(arr, periods) {
  periods = periods || ((typeof getAnnualPeriods === 'function') ? getAnnualPeriods() : 12);
  return meanReturn(arr) * periods;
}
function annualizedVolFromReturns(arr, periods) {
  periods = periods || ((typeof getAnnualPeriods === 'function') ? getAnnualPeriods() : 12);
  return periodSampleStd(arr) * Math.sqrt(periods);
}
function calcStandardSharpeFromReturns(arr, periods, rfAnnual) {
  periods = periods || ((typeof getAnnualPeriods === 'function') ? getAnnualPeriods() : 12);
  rfAnnual = (rfAnnual === undefined || rfAnnual === null) ? getRiskFreeAnnualRate() : rfAnnual;
  var vol = annualizedVolFromReturns(arr, periods);
  if (!vol || !isFinite(vol)) return 0;
  var annualizedExcessMean = arithmeticAnnualizedMeanReturnFromReturns(arr, periods) - rfAnnual;
  return annualizedExcessMean / vol;
}

function kpi(records, init) {
  init = init || (gv('btCap')||100000);
  if (!records||!records.length) return {cagr:0,mdd:0,sharpe:0,nav:init};
  var last=records[records.length-1];
  var yrs=periodsToYears(records.length);
  var tr=last.nav/init-1, cagr=yrs>0?Math.pow(1+Math.max(tr,-0.999),1/yrs)-1:0;
  var pk=init, mdd=0;
  records.forEach(function(r){ if(r.nav>pk)pk=r.nav;
    // AUDIT: MDD continuity (only when audit is active to avoid overhead)
    if (DEBUG_AUDIT) auditMDDContinuity(pk, r.nav, r.month); var dd=(r.nav-pk)/pk; if(dd<mdd)mdd=dd; });
  var rets=records.map(function(r){ return r.pRet; });
  var periods=getAnnualPeriods();
  var sharpe=calcStandardSharpeFromReturns(rets, periods);
  return {cagr:cagr,mdd:mdd,sharpe:sharpe,nav:last.nav};
}

function spearmanCorr(xs, ys) {
  var n = xs.length;
  if (n < 4) return {ic: null, t: null, p: null};
  function rankArr(arr) {
    var idx = [];
    for (var i = 0; i < arr.length; i++) idx.push(i);
    idx.sort(function(a, b) { return arr[a] - arr[b]; });
    var ranks = new Array(arr.length);
    var i2 = 0;
    while (i2 < idx.length) {
      var j = i2;
      while (j < idx.length - 1 && arr[idx[j + 1]] === arr[idx[i2]]) j++;
      var avgRank = (i2 + j) / 2 + 1;
      for (var k = i2; k <= j; k++) ranks[idx[k]] = avgRank;
      i2 = j + 1;
    }
    return ranks;
  }
  var rx = rankArr(xs), ry = rankArr(ys);
  var mx = rx.reduce(function(a,b){return a+b;},0)/n;
  var my = ry.reduce(function(a,b){return a+b;},0)/n;
  var num = 0, dx = 0, dy = 0;
  for (var i = 0; i < n; i++) {
    num += (rx[i]-mx)*(ry[i]-my);
    dx += (rx[i]-mx)*(rx[i]-mx);
    dy += (ry[i]-my)*(ry[i]-my);
  }
  var ic = (dx*dy > 0) ? num/Math.sqrt(dx*dy) : 0;
  var t = ic * Math.sqrt((n-2)/(1-ic*ic+1e-10));
  // two-tailed p approximation via t-distribution CDF
  function tpval(t, df) {
    var x = df / (df + t*t);
    var a = 0.5, b = df/2, c = 0.5;
    // simple approximation
    var z = Math.abs(t) / Math.sqrt(df);
    var p = 2*(1 - (0.5*(1+Math.tanh(z*(0.7978845608+0.1135*z*z)))));
    return Math.max(0, Math.min(1, p));
  }
  return {ic: ic, t: t, p: tpval(Math.abs(t), n-2)};
}

function calcIC(records) {
  var monthlyIC = [];
  var tailCfg = getTailConfig();
  var layers = [1,3,5,10];

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (!r.allScores || r.allScores.length < 10) continue;
    var sigM = r.month, scoreDate = r.scoringM || sigM;
    var tradeStart = r.tradeStart || (r.period ? String(r.period).split(' ~ ')[0] : null) || sigM;
    var tradeEnd = r.tradeEnd || (r.period ? String(r.period).split(' ~ ')[1] : null) || sigM;
    var maxGapMs = 14 * 86400000;
    function getCleanReturn(ticker) {
      var p0pt = getMarketMonthEndPoint(ticker, tradeStart);
      var p1pt = getMarketMonthEndPoint(ticker, tradeEnd);
      if (!p0pt || !p1pt || !p0pt.price || p0pt.price <= 0) return null;
      if (Math.abs(new Date(tradeStart) - new Date(p0pt.date)) > maxGapMs) return null;
      if (Math.abs(new Date(tradeEnd) - new Date(p1pt.date)) > maxGapMs) return null;
      return p1pt.price / p0pt.price - 1;
    }
    var twScores=[],twRets=[],usScores=[],usRets=[],allScores2=[],allRets2=[];
    r.allScores.forEach(function(sc){
      var ret=getCleanReturn(sc.c);
      if(ret===null||!isFinite(ret)||Math.abs(ret)>2)return;
      if(sc.pool==='tw'||sc.pool==='etf'){twScores.push(sc.score);twRets.push(ret);}else{usScores.push(sc.score);usRets.push(ret);}
      allScores2.push(sc.score);allRets2.push(ret);
    });
    var resTW=twScores.length>=8?spearmanCorr(twScores,twRets):{ic:null};
    var resUS=usScores.length>=8?spearmanCorr(usScores,usRets):{ic:null};
    var resAll=allScores2.length>=10?spearmanCorr(allScores2,allRets2):{ic:null};
    var qIC=null,spreadRet=null,topTailAvg=null,botTailAvg=null,tailN=0;
    var layerRet={top1:null,top3:null,top5:null,top10:null};
    if(allScores2.length>=10){
      var paired=allScores2.map(function(s,i){return{score:s,ret:allRets2[i]};});
      paired.sort(function(a,b){return b.score-a.score;});
      tailN=tailBucketSize(paired.length);
      var topQ=paired.slice(0,tailN),botQ=paired.slice(paired.length-tailN);
      var qPaired=topQ.concat(botQ);
      if(qPaired.length>=2){
        var resQ=spearmanCorr(qPaired.map(function(x){return x.score;}),qPaired.map(function(x){return x.ret;}));
        if(resQ.ic!==null)qIC=resQ.ic;
      }
      topTailAvg=arrAvg(topQ.map(function(x){return x.ret;}));
      botTailAvg=arrAvg(botQ.map(function(x){return x.ret;}));
      if(topTailAvg!==null&&botTailAvg!==null)spreadRet=topTailAvg-botTailAvg;
      layers.forEach(function(L){if(paired.length>=L)layerRet['top'+L]=arrAvg(paired.slice(0,L).map(function(x){return x.ret;}));});
    }
    var combinedIC=null;
    if(resTW.ic!==null&&resUS.ic!==null){var wTW=twScores.length/(twScores.length+usScores.length);combinedIC=wTW*resTW.ic+(1-wTW)*resUS.ic;}
    else if(resTW.ic!==null)combinedIC=resTW.ic;else if(resUS.ic!==null)combinedIC=resUS.ic;else if(resAll.ic!==null)combinedIC=resAll.ic;
    if(combinedIC===null)continue;
    // AUDIT: IC alignment and sample size check
    auditIC('Combined', scoreDate, tradeStart, tradeEnd, combinedIC, allScores2.length, sigM);
    monthlyIC.push({month:sigM,scoreDate:scoreDate,ic:combinedIC,ic_tw:resTW.ic,ic_us:resUS.ic,ic_all:resAll.ic,ic_q:qIC,spread_ret:spreadRet,top_tail_ret:topTailAvg,bot_tail_ret:botTailAvg,top1_ret:layerRet.top1,top3_ret:layerRet.top3,top5_ret:layerRet.top5,top10_ret:layerRet.top10,tail_n:tailN,tail_label:tailCfg.label,t:resAll.t||0,p:resAll.p||1,n:allScores2.length,n_tw:twScores.length,n_us:usScores.length});
  }
  if(!monthlyIC.length)return null;
  var ics=monthlyIC.map(function(x){return x.ic;});
  var mean_ic=arrAvg(ics);
  var std_ic=Math.sqrt(ics.reduce(function(a,b){return a+Math.pow(b-mean_ic,2);},0)/Math.max(ics.length-1,1));
  var icir=std_ic>0?mean_ic/std_ic:0;
  var pos_ic=ics.filter(function(x){return x>0;}).length;
  var t_ic=mean_ic/(std_ic/Math.sqrt(ics.length)+1e-10);
  var twICs=monthlyIC.filter(function(m){return m.ic_tw!==null;}).map(function(m){return m.ic_tw;});
  var usICs=monthlyIC.filter(function(m){return m.ic_us!==null;}).map(function(m){return m.ic_us;});
  var qICs=monthlyIC.filter(function(m){return m.ic_q!==null;}).map(function(m){return m.ic_q;});
  var mean_q_ic=qICs.length?arrAvg(qICs):null;
  var std_q_ic=qICs.length>1?Math.sqrt(qICs.reduce(function(a,b){return a+Math.pow(b-mean_q_ic,2);},0)/Math.max(qICs.length-1,1)):null;
  var spreads=monthlyIC.filter(function(m){return m.spread_ret!==null;}).map(function(m){return m.spread_ret;});
  var tail_layers={};
  [1,3,5,10].forEach(function(L){var key='top'+L+'_ret';var vals=monthlyIC.filter(function(m){return m[key]!==null;}).map(function(m){return m[key];});tail_layers['Top'+L]={avg:vals.length?arrAvg(vals):null,months:vals.length};});
  return {monthlyIC:monthlyIC,mean_ic:mean_ic,std_ic:std_ic,icir:icir,pos_ic_pct:pos_ic/ics.length,t_stat:t_ic,n_months:ics.length,mean_tw_ic:twICs.length?arrAvg(twICs):null,mean_us_ic:usICs.length?arrAvg(usICs):null,mean_q_ic:mean_q_ic,icir_q:(mean_q_ic!==null&&std_q_ic>0)?mean_q_ic/std_q_ic:null,mean_spread:spreads.length?arrAvg(spreads):null,spread_pos_pct:spreads.length?spreads.filter(function(x){return x>0;}).length/spreads.length:null,tail_layers:tail_layers,tail_label:tailCfg.label};
}

function buildTailPanelHTML(icRes){
  if(!icRes||!icRes.monthlyIC)return'';
  function fp(v){return v===null||v===undefined?'--':((v>=0?'+':'')+(v*100).toFixed(2)+'%');}
  function col(v){return v===null||v===undefined?'var(--mu)':(v>0?'var(--gr)':'var(--re)');}
  var layers=icRes.tail_layers||{};
  var html='<div class="card" style="border-top:3px solid var(--ye);margin-top:8px">';
  html+='<div class="ct" style="display:flex;justify-content:space-between;align-items:center"><span>尾部 IC 完整面板 <span style="font-size:10px;color:var(--mu);font-weight:400;margin-left:6px">'+(icRes.tail_label||getTailConfig().label)+' | Top1/3/5/10 分層 | Spread 時間序列 | N穩定帶 | p-value為近似值，小樣本n&lt;30僅供參考</span></span><button class="bo sm" onclick="runTailNStabilityPanel()">掃描 N=1~15</button></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">';
  ['Top1','Top3','Top5','Top10'].forEach(function(k){var v=layers[k]?layers[k].avg:null;html+='<div class="ib2" style="margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase">'+k+' 平均下期報酬</div><div style="font-size:20px;font-weight:700;font-family:monospace;color:'+col(v)+'">'+fp(v)+'</div><div style="font-size:9px;color:var(--mu)">'+((layers[k]&&layers[k].months)||0)+' 個月</div></div>';});
  html+='</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px"><div class="ib2" style="margin-top:0;border:1px solid var(--ac)"><div style="font-size:9px;color:var(--ac);font-weight:700">尾部 Spread 平均</div><div style="font-size:22px;font-weight:700;font-family:monospace;color:'+col(icRes.mean_spread)+'">'+fp(icRes.mean_spread)+'</div><div style="font-size:9px;color:var(--mu)">Top − Bottom</div></div><div class="ib2" style="margin-top:0;border:1px solid var(--ac)"><div style="font-size:9px;color:var(--ac);font-weight:700">Spread 勝率</div><div style="font-size:22px;font-weight:700;font-family:monospace;color:'+(icRes.spread_pos_pct>=0.5?'var(--gr)':'var(--re)')+'">'+(icRes.spread_pos_pct!==null?(icRes.spread_pos_pct*100).toFixed(0)+'%':'--')+'</div><div style="font-size:9px;color:var(--mu)">每月 Spread > 0 比例</div></div><div class="ib2" style="margin-top:0"><div style="font-size:9px;color:var(--mu);font-weight:700">判讀</div><div style="font-size:10px;color:var(--mu);line-height:1.8">Top1/3 明顯高於 Top10 = alpha 集中。<br>Spread 長期為正 = 右尾辨識有效。<br>N掃描要找平台區，不追最高點。</div></div></div>';
  html+='<div id="tailNScanPanel" class="ib2" style="margin-top:0;margin-bottom:8px;color:var(--mu)">尚未執行 N=1~15 掃描。</div>';
  html+='<div class="tw-wrap" style="max-height:240px"><table><thead><tr><th>月份</th><th>Top尾部</th><th>Bottom尾部</th><th>Spread</th><th>Top1</th><th>Top3</th><th>Top5</th><th>Top10</th><th>候選數</th><th>尾部N</th></tr></thead><tbody>';
  icRes.monthlyIC.slice().reverse().forEach(function(m){html+='<tr><td class="mono">'+m.month+'</td><td class="mono" style="color:'+col(m.top_tail_ret)+'">'+fp(m.top_tail_ret)+'</td><td class="mono" style="color:'+col(m.bot_tail_ret)+'">'+fp(m.bot_tail_ret)+'</td><td class="mono" style="font-weight:700;color:'+col(m.spread_ret)+'">'+fp(m.spread_ret)+'</td><td class="mono" style="color:'+col(m.top1_ret)+'">'+fp(m.top1_ret)+'</td><td class="mono" style="color:'+col(m.top3_ret)+'">'+fp(m.top3_ret)+'</td><td class="mono" style="color:'+col(m.top5_ret)+'">'+fp(m.top5_ret)+'</td><td class="mono" style="color:'+col(m.top10_ret)+'">'+fp(m.top10_ret)+'</td><td class="mono" style="color:var(--mu)">'+m.n+'</td><td class="mono" style="color:var(--mu)">'+m.tail_n+'</td></tr>';});
  html+='</tbody></table></div></div>';
  return html;
}

async function runTailNStabilityPanel(){
  if(!(await ensureDataReadyForAnalysis('tail N stability'))) return;
  var panel=$('tailNScanPanel');if(panel)panel.innerHTML='N=1~15 掃描中...';
  setTimeout(function(){
    var origH=$('btH')?$('btH').value:'6';var mode=getWeightMode(),init=gv('btCap')||100000,rows=[];
    try{for(var n=1;n<=15;n++){if($('btH'))$('btH').value=n;var recs=runBTcore(n,mode);if(!recs){rows.push({n:n,err:true});continue;}rows.push({n:n,k:kpi(recs,init),err:false});}}
    catch(e){if(panel)panel.innerHTML='N掃描錯誤: '+e.message;}
    finally{if($('btH'))$('btH').value=origH;}
    if(!panel)return;function fp(v){return(v>=0?'+':'')+(v*100).toFixed(2)+'%';}
    var valid=rows.filter(function(r){return!r.err;});var bestS=valid.length?valid.reduce(function(a,b){return b.k.sharpe>a.k.sharpe?b:a;}):null;var bestC=valid.length?valid.reduce(function(a,b){return b.k.cagr>a.k.cagr?b:a;}):null;
    var html='<div style="font-size:10px;color:var(--mu);margin-bottom:6px">*C=最高CAGR，*S=最高Sharpe。請看 4~8 是否形成平台，不要只看單一最高值。</div><table style="width:100%;font-size:11px"><thead><tr><th>N</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Final NAV</th></tr></thead><tbody>';
    rows.forEach(function(r){if(r.err){html+='<tr><td class="mono">'+r.n+'</td><td colspan="4" style="color:var(--mu)">no data</td></tr>';return;}var mark=(bestC&&r.n===bestC.n?' *C':'')+(bestS&&r.n===bestS.n?' *S':'');html+='<tr><td class="mono" style="font-weight:700;color:'+(bestS&&r.n===bestS.n?'var(--gr)':bestC&&r.n===bestC.n?'var(--ye)':'var(--tx)')+'">'+r.n+mark+'</td><td class="mono" style="color:'+(r.k.cagr>=0?'var(--gr)':'var(--re)')+'">'+fp(r.k.cagr)+'</td><td class="mono" style="color:var(--re)">'+fp(r.k.mdd)+'</td><td class="mono" style="color:'+(r.k.sharpe>=1?'var(--gr)':r.k.sharpe>=0?'var(--ye)':'var(--re)')+'">'+r.k.sharpe.toFixed(2)+'</td><td class="mono">$'+Math.round(r.k.nav).toLocaleString()+'</td></tr>';});
    html+='</tbody></table>';panel.innerHTML=html;
  },80);
}



async function runStressWeightSweepPanel(){
  // Legacy button compatibility: this no longer scans Stress Score weights.
  // It now redirects to Regime / VWMA exposure sweep.
  var panel = document.getElementById('stressWeightSweepPanel') || document.getElementById('stressRobustPanel');
  if (panel) panel.innerHTML = '已停用 Stress Score 權重掃描，改執行 Regime / VWMA 曝光度掃描...';
  return runStressHeatmapTest();
}



// ==========================================
// Regime / VWMA Exposure Robustness Suite
// 目的：檢查「大盤風控觸發後的曝光度」是否穩健。
// 注意：這裡不再掃描 Stress Score Gate 的權重、分數門檻或曝光 map。
// 測試時一律強制 btRegime=on，且 btShieldGate=off，避免 Stress Gate 混入。
// ==========================================
function stressRobPanel(){ return document.getElementById('stressRobustPanel') || document.getElementById('stressMetrics'); }
function stressFmtPct(v){ return (v>=0?'+':'')+(v*100).toFixed(2)+'%'; }
function stressClamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
function regimeReadSweepConfig(){
  var min = parseFloat(document.getElementById('regimeSweepMin') ? document.getElementById('regimeSweepMin').value : '0');
  var max = parseFloat(document.getElementById('regimeSweepMax') ? document.getElementById('regimeSweepMax').value : '100');
  var step = parseFloat(document.getElementById('regimeSweepStep') ? document.getElementById('regimeSweepStep').value : '10');
  min = stressClamp(isFinite(min)?min:0,0,100);
  max = stressClamp(isFinite(max)?max:100,0,100);
  step = stressClamp(isFinite(step)?step:10,5,50);
  if (min > max) { var t=min; min=max; max=t; }
  var arr=[];
  for (var x=min; x<=max+1e-9; x+=step) arr.push(stressClamp(Math.round(x),0,100));
  if (arr.indexOf(100)===-1 && max===100) arr.push(100);
  return arr.filter(function(v,i,a){ return a.indexOf(v)===i; });
}

function regimeReadLengthConfig(){
  var raw = (document.getElementById('regimeTestLens') ? document.getElementById('regimeTestLens').value : '60,120,150,180,200,240,300') || '60,120,150,180,200,240,300';
  var arr = raw.split(/[,，\s]+/).map(function(x){ return parseInt(x,10); }).filter(function(v){ return isFinite(v) && v>=20 && v<=400; });
  if (!arr.length) arr = [60,120,150,180,200,240,300];
  return arr.filter(function(v,i,a){ return a.indexOf(v)===i; });
}
function regimeReadMatrixExposures(){
  var raw = (document.getElementById('regimeMatrixExps') ? document.getElementById('regimeMatrixExps').value : '30,50,70') || '30,50,70';
  var arr = raw.split(/[,，\s]+/).map(function(x){ return parseInt(x,10); }).filter(function(v){ return isFinite(v) && v>=0 && v<=100; });
  if (!arr.length) arr = [30,50,70];
  return arr.filter(function(v,i,a){ return a.indexOf(v)===i; });
}
function regimeScoreVsOff(k, offK, sensitivityPenalty){
  if(!k || !offK) return null;
  var sharpeGain = k.sharpe - offK.sharpe;
  var mddGain = k.mdd - offK.mdd; // positive = drawdown improves, because -40% > -50%
  var cagrDrag = Math.max(0, offK.cagr - k.cagr);
  var complexityPenalty = 0.06;
  sensitivityPenalty = sensitivityPenalty || 0;
  return sharpeGain + Math.max(0,mddGain)*1.5 - cagrDrag*0.35 - complexityPenalty - sensitivityPenalty;
}
function regimeSensitivityPenalty(rows){
  if(!rows || rows.length < 2) return 0.05;
  var sharpes = rows.map(function(r){return r.k ? r.k.sharpe : null;}).filter(function(v){return v!==null && isFinite(v);});
  if(sharpes.length < 2) return 0.05;
  var spread = Math.max.apply(null, sharpes) - Math.min.apply(null, sharpes);
  return Math.min(0.35, spread * 0.35);
}
function regimeGetSnapshot(){
  var ids=['btRegime','btRegimeExp','btRegimeLen','btShieldGate','regimeTestBaseExp','regimeTestLens'];
  var o={}; ids.forEach(function(id){ var el=document.getElementById(id); o[id]=el?el.value:null; }); return o;
}
function regimeRestoreSnapshot(s){ Object.keys(s||{}).forEach(function(id){ var el=document.getElementById(id); if(el && s[id]!==null) el.value=s[id]; }); }
function regimeSetExposure(expPct){
  expPct = stressClamp(Math.round(expPct), 0, 100);
  if (document.getElementById('btRegime')) document.getElementById('btRegime').value='on';
  if (document.getElementById('btRegimeExp')) document.getElementById('btRegimeExp').value=expPct;
  if (document.getElementById('regimeTestBaseExp')) document.getElementById('regimeTestBaseExp').value=expPct;
  if (document.getElementById('btShieldGate')) document.getElementById('btShieldGate').value='off';
}
function regimeRunBacktest(regOn, expPct, len){
  var snap=regimeGetSnapshot();
  var regimeLen = parseInt((len !== undefined && len !== null) ? len : (document.getElementById('btRegimeLen') ? document.getElementById('btRegimeLen').value : '60'), 10) || 60;
  if (document.getElementById('btRegime')) document.getElementById('btRegime').value = regOn ? 'on' : 'off';
  if (document.getElementById('btRegimeExp')) document.getElementById('btRegimeExp').value = stressClamp(Math.round(expPct),0,100);
  if (document.getElementById('btRegimeLen')) document.getElementById('btRegimeLen').value = regimeLen;
  if (document.getElementById('btShieldGate')) document.getElementById('btShieldGate').value='off';
  var mh=parseInt(document.getElementById('btH')?document.getElementById('btH').value:'6')||6;
  var mode=(typeof getWeightMode==='function')?getWeightMode():'eq';
  var init=gv('btCap')||100000;
  var recs=runBTcore(mh,mode,{regimeRobust:true,regimeLen:regimeLen});
  var kk=recs&&recs.length?kpi(recs,init):null;
  regimeRestoreSnapshot(snap);
  return {records:recs,k:kk,exp:expPct,regOn:regOn,len:regimeLen};
}
function regimeActivationStats(records){
  records=records||[];
  var n=records.length, active=0, expSum=0, retOn=0, retOff=0, onN=0, offN=0;
  records.forEach(function(r){
    var e=(r.regimeExposure!==undefined&&r.regimeExposure!==null)?r.regimeExposure:1;
    expSum+=e;
    if(r.regimeBearish){ active++; retOn+=(r.pRet||0); onN++; }
    else { retOff+=(r.pRet||0); offN++; }
  });
  return {n:n,active:active,activePct:n?active/n:0,avgExposure:n?expSum/n:1,bearRet:onN?retOn/onN:null,normalRet:offN?retOff/offN:null};
}
function regimePeriodValidationRows(records){
  if(!records||records.length<24) return [];
  var periods=(typeof getAnnualPeriods==='function')?getAnnualPeriods():12;
  var init=gv('btCap')||100000;
  var rows=[], chunks=[];
  var third=Math.floor(records.length/3);
  chunks.push({name:'前段', arr:records.slice(0,third)});
  chunks.push({name:'中段', arr:records.slice(third,third*2)});
  chunks.push({name:'後段', arr:records.slice(third*2)});
  chunks.forEach(function(c){
    if(!c.arr.length) return;
    var kk=stressKpiFromReturns(c.arr.map(function(r){return r.pRet||0;}), init, periods);
    var st=regimeActivationStats(c.arr);
    if(kk) rows.push({name:c.name,k:kk,stats:st});
  });
  return rows;
}
function stressKpiFromReturns(rets, init, periods){
  init=init||100000; periods=periods||12;
  if(!rets||!rets.length) return null;
  var nav=init, peak=init, mdd=0;
  rets.forEach(function(r){ nav*=(1+r); if(nav>peak)peak=nav; var dd=(nav-peak)/peak; if(dd<mdd)mdd=dd; });
  var yrs=rets.length/periods;
  var cagr=yrs>0?Math.pow(nav/init,1/yrs)-1:0;
  var sharpe=calcStandardSharpeFromReturns(rets, periods);
  return {nav:nav,cagr:cagr,mdd:mdd,sharpe:sharpe};
}
function regimeValidationHtml(records){
  var rows=regimePeriodValidationRows(records);
  var html='<div class="ib2" style="border:1px solid var(--bd);margin-top:8px"><div style="font-size:10px;color:var(--ac);font-weight:700;margin-bottom:6px">Regime period validation</div>';
  if(!rows.length) return html+'資料不足，無法切三段驗證。</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>Period</th><th>觸發月%</th><th>Avg Exp</th><th>CAGR</th><th>MDD</th><th>Sharpe</th></tr></thead><tbody>';
  rows.forEach(function(r){ html+='<tr><td>'+r.name+'</td><td class="mono">'+(r.stats.activePct*100).toFixed(1)+'%</td><td class="mono">'+(r.stats.avgExposure*100).toFixed(1)+'%</td><td class="mono">'+stressFmtPct(r.k.cagr)+'</td><td class="mono">'+stressFmtPct(r.k.mdd)+'</td><td class="mono">'+r.k.sharpe.toFixed(2)+'</td></tr>'; });
  html+='</tbody></table><div style="font-size:10px;color:var(--mu);margin-top:5px">判讀：若只在單一時段改善，代表曝光度可能吃到特定 regime；若三段都降低 MDD 且 Sharpe 不崩，可信度較高。</div></div>';
  return html;
}
function regimeSimplicityPenaltyHtml(currentK, sensitivityPenalty){
  var exp=gv('btRegimeExp')||50;
  var len=parseInt(document.getElementById('btRegimeLen') ? document.getElementById('btRegimeLen').value : '60',10)||60;
  var off=regimeRunBacktest(false,100,len);
  var html='<div class="ib2" style="border:1px solid var(--ye);margin-top:8px"><div style="font-size:10px;color:var(--ye);font-weight:700;margin-bottom:6px">Regime ON/OFF + Robust score</div>';
  if(!off.k||!currentK) return html+'資料不足，無法比較 Regime OFF vs ON。</div>';
  var sharpeGain=currentK.sharpe-off.k.sharpe, cagrGain=currentK.cagr-off.k.cagr, mddGain=currentK.mdd-off.k.mdd;
  var complexityPenalty=0.06;
  sensitivityPenalty = sensitivityPenalty || 0;
  var robustScore=regimeScoreVsOff(currentK, off.k, sensitivityPenalty);
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>Mode</th><th>VWMA Len</th><th>Bear Exp</th><th>CAGR</th><th>MDD</th><th>Sharpe</th></tr></thead><tbody>';
  html+='<tr><td>Regime OFF</td><td class="mono">--</td><td class="mono">100%</td><td class="mono">'+stressFmtPct(off.k.cagr)+'</td><td class="mono">'+stressFmtPct(off.k.mdd)+'</td><td class="mono">'+off.k.sharpe.toFixed(2)+'</td></tr>';
  html+='<tr><td>Regime ON</td><td class="mono">'+len+'</td><td class="mono">'+Math.round(exp)+'%</td><td class="mono">'+stressFmtPct(currentK.cagr)+'</td><td class="mono">'+stressFmtPct(currentK.mdd)+'</td><td class="mono">'+currentK.sharpe.toFixed(2)+'</td></tr>';
  html+='</tbody></table>';
  html+='<div style="font-size:10px;color:var(--mu);margin-top:5px">Sharpe改善='+sharpeGain.toFixed(2)+'；CAGR改善='+stressFmtPct(cagrGain)+'；MDD改善='+(mddGain>=0?'+':'')+(mddGain*100).toFixed(2)+'pct；複雜度懲罰 '+complexityPenalty.toFixed(2)+'；敏感度懲罰 '+sensitivityPenalty.toFixed(2)+'。</div>';
  html+='<div style="font-size:11px;margin-top:4px;color:'+(robustScore>0?'var(--gr)':'var(--re)')+'">Robust score = Sharpe改善 + MDD改善權重 - CAGR拖累 - 懲罰 = '+robustScore.toFixed(2)+' ｜ '+(robustScore>0?'大盤風控曝光度暫可接受':'改善不足，不建議只因回測漂亮就開啟')+'</div></div>';
  return html;
}
async function runStressHeatmapTest(){
  var panel=stressRobPanel(); if(panel)panel.innerHTML='Regime / VWMA 曝光度掃描中...';
  if(!(await ensureDataReadyForAnalysis('regime exposure sweep'))) return;
  var exposures=regimeReadSweepConfig(), rows=[];
  var len=parseInt(document.getElementById('btRegimeLen') ? document.getElementById('btRegimeLen').value : '60',10)||60;
  var off=regimeRunBacktest(false,100,len);
  try{
    for(var i=0;i<exposures.length;i++){
      var res=regimeRunBacktest(true, exposures[i], len);
      if(res.k) rows.push({exp:exposures[i],len:len,k:res.k,stats:regimeActivationStats(res.records),robust:regimeScoreVsOff(res.k, off.k, 0)});
      if(panel)panel.innerHTML='Regime / VWMA 曝光度掃描 '+(i+1)+'/'+exposures.length+'...';
      await new Promise(function(r){setTimeout(r,0);});
    }
  }catch(e){ if(panel)panel.innerHTML='Regime 曝光度掃描錯誤: '+e.message; return; }
  if(!panel) return;
  if(!rows.length){ panel.innerHTML='Regime 曝光度掃描無結果。'; return; }
  var best=rows.reduce(function(a,b){return b.k.sharpe>a.k.sharpe?b:a;});
  var html='<div class="ib2" style="border:1px solid var(--tw)"><div style="font-size:10px;color:var(--tw);font-weight:700;margin-bottom:6px">Regime / VWMA Exposure Sweep</div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-bottom:6px">固定規則：0050/SPY 低於 60VWMA 且 VWMA 下彎時，將動能部位降到指定曝光度；Stress Score Gate 強制關閉。</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>Bear Exp</th><th>觸發月%</th><th>Avg Exp</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Robust</th><th>Final NAV</th><th>套用</th></tr></thead><tbody>';
  rows.forEach(function(r){ var isBest=(r===best); html+='<tr style="outline:'+(isBest?'2px solid var(--gr)':'none')+'"><td class="mono">'+r.exp+'%</td><td class="mono">'+(r.stats.activePct*100).toFixed(1)+'%</td><td class="mono">'+(r.stats.avgExposure*100).toFixed(1)+'%</td><td class="mono" style="color:'+(r.k.cagr>=0?'var(--gr)':'var(--re)')+'">'+stressFmtPct(r.k.cagr)+'</td><td class="mono" style="color:var(--re)">'+stressFmtPct(r.k.mdd)+'</td><td class="mono" style="color:'+(r.k.sharpe>=1?'var(--gr)':r.k.sharpe>=0?'var(--ye)':'var(--re)')+'">'+r.k.sharpe.toFixed(2)+'</td><td class="mono" style="color:'+(r.robust>0?'var(--gr)':'var(--re)')+'">'+(r.robust!==null?r.robust.toFixed(2):'--')+'</td><td class="mono">$'+Math.round(r.k.nav).toLocaleString()+'</td><td><button class="bo sm" onclick="applyRegimeExposure('+r.exp+')">套用</button></td></tr>'; });
  html+='</tbody></table><div style="font-size:10px;color:var(--mu);margin-top:5px">判讀：不要只選單一最高 Sharpe。若 40~70% 區間都接近，代表曝光度設定比較穩健；若只有一格大幅勝出，反而要保守。</div></div>';
  panel.innerHTML=html;
}
async function runStressPerturbationTest(){
  var panel=stressRobPanel(); if(panel)panel.innerHTML='Regime / VWMA 曝光 ±10% 擾動測試中...';
  if(!(await ensureDataReadyForAnalysis('regime exposure perturbation'))) return;
  var base=gv('btRegimeExp')||parseFloat(document.getElementById('regimeTestBaseExp')?document.getElementById('regimeTestBaseExp').value:'50')||50;
  var variants=[base-10, base-5, base, base+5, base+10].map(function(v){return stressClamp(Math.round(v),0,100);});
  variants=variants.filter(function(v,i,a){return a.indexOf(v)===i;});
  var rows=[];
  try{ for(var i=0;i<variants.length;i++){ var res=regimeRunBacktest(true,variants[i]); if(res.k) rows.push({exp:variants[i],k:res.k,stats:regimeActivationStats(res.records)}); if(panel)panel.innerHTML='Regime 曝光 ±10% '+(i+1)+'/'+variants.length+'...'; await new Promise(function(r){setTimeout(r,0);}); } }
  catch(e){ if(panel)panel.innerHTML='Regime 曝光擾動錯誤: '+e.message; return; }
  if(!panel) return; if(!rows.length){panel.innerHTML='Regime 曝光擾動無結果。';return;}
  var sharps=rows.map(function(r){return r.k.sharpe;}); var minS=Math.min.apply(null,sharps), maxS=Math.max.apply(null,sharps), avgS=sharps.reduce(function(a,b){return a+b;},0)/sharps.length;
  var pass=minS>0 && (maxS-minS)<0.35;
  var html='<div class="ib2" style="border:1px solid var(--ye)"><div style="font-size:10px;color:var(--ye);font-weight:700;margin-bottom:6px">Regime exposure ±10% perturbation</div>';
  html+='<div style="font-size:11px;color:'+(pass?'var(--gr)':'var(--re)')+';margin-bottom:6px">Avg Sharpe '+avgS.toFixed(2)+' ｜ Min '+minS.toFixed(2)+' ｜ Max '+maxS.toFixed(2)+' ｜ '+(pass?'曝光度附近穩定':'對曝光度太敏感，需降低信任度')+'</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>Bear Exp</th><th>觸發月%</th><th>Avg Exp</th><th>CAGR</th><th>MDD</th><th>Sharpe</th></tr></thead><tbody>';
  rows.forEach(function(r){html+='<tr><td class="mono">'+r.exp+'%</td><td class="mono">'+(r.stats.activePct*100).toFixed(1)+'%</td><td class="mono">'+(r.stats.avgExposure*100).toFixed(1)+'%</td><td class="mono" style="color:'+(r.k.cagr>=0?'var(--gr)':'var(--re)')+'">'+stressFmtPct(r.k.cagr)+'</td><td class="mono" style="color:var(--re)">'+stressFmtPct(r.k.mdd)+'</td><td class="mono" style="color:'+(r.k.sharpe>0?'var(--gr)':'var(--re)')+'">'+r.k.sharpe.toFixed(2)+'</td></tr>';});
  html+='</tbody></table></div>'; panel.innerHTML=html;
}

async function runRegimeLengthRobustnessTest(){
  var panel=stressRobPanel(); if(panel)panel.innerHTML='Regime VWMA 長度穩健性掃描中...';
  if(!(await ensureDataReadyForAnalysis('regime VWMA length robustness'))) return;
  var lens=regimeReadLengthConfig();
  var exp=gv('btRegimeExp')||parseFloat(document.getElementById('regimeTestBaseExp')?document.getElementById('regimeTestBaseExp').value:'50')||50;
  var rows=[];
  try{
    for(var i=0;i<lens.length;i++){
      var off=regimeRunBacktest(false,100,lens[i]);
      var res=regimeRunBacktest(true,exp,lens[i]);
      if(res.k) rows.push({len:lens[i],exp:exp,k:res.k,stats:regimeActivationStats(res.records),robust:regimeScoreVsOff(res.k, off.k, 0)});
      if(panel) panel.innerHTML='VWMA length '+(i+1)+'/'+lens.length+'...';
      await new Promise(function(r){setTimeout(r,0);});
    }
  }catch(e){ if(panel)panel.innerHTML='VWMA 長度掃描錯誤: '+e.message; return; }
  if(!panel) return;
  if(!rows.length){panel.innerHTML='VWMA 長度掃描無結果。';return;}
  var best=rows.reduce(function(a,b){return b.robust>a.robust?b:a;});
  var html='<div class="ib2" style="border:1px solid var(--ac)"><div style="font-size:10px;color:var(--ac);font-weight:700;margin-bottom:6px">Regime VWMA length robustness</div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-bottom:6px">固定 Bear Exp '+Math.round(exp)+'%，掃描 VWMA 長度。若 120/150/180/200/240/300 多數方向一致，可信度高；若只有單一長度有效，偏擬合。</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>VWMA Len</th><th>觸發月%</th><th>Avg Exp</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Robust</th></tr></thead><tbody>';
  rows.forEach(function(r){var isBest=r===best;html+='<tr style="outline:'+(isBest?'2px solid var(--gr)':'none')+'"><td class="mono">'+r.len+'</td><td class="mono">'+(r.stats.activePct*100).toFixed(1)+'%</td><td class="mono">'+(r.stats.avgExposure*100).toFixed(1)+'%</td><td class="mono" style="color:'+(r.k.cagr>=0?'var(--gr)':'var(--re)')+'">'+stressFmtPct(r.k.cagr)+'</td><td class="mono" style="color:var(--re)">'+stressFmtPct(r.k.mdd)+'</td><td class="mono">'+r.k.sharpe.toFixed(2)+'</td><td class="mono" style="color:'+(r.robust>0?'var(--gr)':'var(--re)')+'">'+(r.robust!==null?r.robust.toFixed(2):'--')+'</td></tr>';});
  html+='</tbody></table><div style="font-size:10px;color:var(--mu);margin-top:5px">判讀：不要選單一最高長度；選相鄰多組都可接受的平台區。</div></div>';
  panel.innerHTML=html;
}
async function runRegimeStabilityMatrix(){
  var panel=stressRobPanel(); if(panel)panel.innerHTML='Regime Stability Matrix 掃描中...';
  if(!(await ensureDataReadyForAnalysis('regime stability matrix'))) return;
  var lens=regimeReadLengthConfig();
  var exps=regimeReadMatrixExposures();
  var cells={}, count=0, total=lens.length*exps.length;
  try{
    for(var i=0;i<lens.length;i++){
      var off=regimeRunBacktest(false,100,lens[i]);
      cells[lens[i]]={};
      for(var j=0;j<exps.length;j++){
        var res=regimeRunBacktest(true,exps[j],lens[i]);
        var sens=0;
        var score=res.k?regimeScoreVsOff(res.k,off.k,sens):null;
        cells[lens[i]][exps[j]]={k:res.k,score:score,stats:regimeActivationStats(res.records)};
        count++; if(panel)panel.innerHTML='Regime Matrix '+count+'/'+total+'...';
        await new Promise(function(r){setTimeout(r,0);});
      }
    }
  }catch(e){ if(panel)panel.innerHTML='Regime Matrix 錯誤: '+e.message; return; }
  var html='<div class="ib2" style="border:1px solid var(--gr)"><div style="font-size:10px;color:var(--gr);font-weight:700;margin-bottom:6px">Regime Stability Matrix</div>';
  html+='<div style="font-size:10px;color:var(--mu);margin-bottom:6px">格內數字為 Robust score。綠色連續區塊 = plateau；單一尖峰 = 過擬合風險。</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>VWMA Len / Bear Exp</th>';
  exps.forEach(function(e){html+='<th class="mono">'+e+'%</th>';}); html+='</tr></thead><tbody>';
  lens.forEach(function(len){html+='<tr><td class="mono" style="font-weight:700">'+len+'</td>'; exps.forEach(function(e){var c=cells[len][e]; var sc=c&&c.score; var col=sc===null?'var(--mu)':(sc>0.15?'var(--gr)':sc>0?'var(--ye)':'var(--re)'); var sub=c&&c.k?('S '+c.k.sharpe.toFixed(2)+' / MDD '+(c.k.mdd*100).toFixed(0)+'%'):'no data'; html+='<td class="mono" style="color:'+col+';font-weight:700">'+(sc!==null?sc.toFixed(2):'--')+'<div style="font-size:9px;color:var(--mu);font-weight:400">'+sub+'</div></td>';}); html+='</tr>';});
  html+='</tbody></table></div>';
  panel.innerHTML=html;
}
async function runStressRobustnessSuite(){
  var panel=stressRobPanel(); if(panel)panel.innerHTML='Regime / VWMA exposure robustness 準備中...';
  if(!(await ensureDataReadyForAnalysis('regime exposure robustness suite'))) return;
  var baseExp=gv('btRegimeExp')||parseFloat(document.getElementById('regimeTestBaseExp')?document.getElementById('regimeTestBaseExp').value:'50')||50;
  var len=parseInt(document.getElementById('btRegimeLen') ? document.getElementById('btRegimeLen').value : '60',10)||60;
  var current=regimeRunBacktest(true, baseExp, len);
  var html='<div class="ib2" style="border:1px solid var(--ac)"><div style="font-size:10px;color:var(--ac);font-weight:700;margin-bottom:6px">Regime / VWMA Exposure Robustness Suite</div>';
  if(!current.k){panel.innerHTML='Regime Robustness 無結果。請先確認回測資料。'; return;}
  var st=regimeActivationStats(current.records);
  html+='<div style="font-size:11px;color:var(--mu);margin-bottom:6px">Current: Regime ON｜Bearish 時曝光度 '+Math.round(baseExp)+'%｜觸發月 '+(st.activePct*100).toFixed(1)+'%｜平均曝險 '+(st.avgExposure*100).toFixed(1)+'%。Stress Score Gate 測試期間強制 OFF。</div>';
  html+='<table style="width:100%;font-size:11px"><thead><tr><th>Current</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Final NAV</th></tr></thead><tbody><tr><td>Regime ON</td><td class="mono">'+stressFmtPct(current.k.cagr)+'</td><td class="mono">'+stressFmtPct(current.k.mdd)+'</td><td class="mono">'+current.k.sharpe.toFixed(2)+'</td><td class="mono">$'+Math.round(current.k.nav).toLocaleString()+'</td></tr></tbody></table></div>';
  html+=regimeValidationHtml(current.records);
  html+=regimeSimplicityPenaltyHtml(current.k, 0);
  if(panel) panel.innerHTML=html+'<div style="font-size:10px;color:var(--mu);margin-top:8px">完整判斷請再按「曝光度掃描」與「±10% 曝光擾動」。</div>';
}
function applyRegimeExposure(exp){
  regimeSetExposure(exp);
  var panel=stressRobPanel();
  if(panel) panel.innerHTML='<div class="ib2" style="border:1px solid var(--gr);color:var(--gr)">已套用 Regime 曝光度 '+Math.round(exp)+'%。請重新執行回測確認。</div>';
}

function applyStressWeightSet(v,h,t,b){
  var panel=stressRobPanel(); if(panel) panel.innerHTML='Stress Score 權重套用已停用；請使用 Regime 曝光度掃描與套用。'; return;

  if (document.getElementById('swVix')) document.getElementById('swVix').value = v;
  if (document.getElementById('swHy')) document.getElementById('swHy').value = h;
  if (document.getElementById('swTrend')) document.getElementById('swTrend').value = t;
  if (document.getElementById('swBreadth')) document.getElementById('swBreadth').value = b;
  STRESS_WEIGHT_OVERRIDE = null;
  renderStressDash();
}

async function runTNBacktest() {
  if(!(await ensureDataReadyForAnalysis('T-N backtest'))) return;
  var tn=Math.max(0,Math.min(22,parseInt($('btSignalTN')?$('btSignalTN').value:'10')||0));
  // T-N controls the signal date inside the selected scoring month.
  // Skip Month remains an independent user option: checked = use previous rebalance period; unchecked = do not skip.
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  sl('btLog','Calculating T-'+tn+' backtest | Skip Month '+(SKIP_MO?'ON':'OFF')+'...',null); showL('T-'+tn+' Backtesting...');
  setTimeout(async function() {
    try {
      if (CACHE_SKIP_MO!==SKIP_MO) { await buildCache(); }
      var mh=parseInt($('btH')?$('btH').value:'3')||3;
      var mode=getWeightMode(), init=gv('btCap')||100000;
      var records=runBTcore(mh,mode,{signalN:tn,tnExecMode:getTNExecMode()});
      if (!records) { alert('Not enough data'); hideL(); return; }
      BT_RESULT={records:records,initial:init,mode:mode,mh:mh,signalTN:tn,tnExecMode:getTNExecMode()};
      BT_RESULT.icResult = calcIC(records);
      renderBT(records,init,mode);
      var dStart=records[0].month, dEnd=records[records.length-1].month;
      sl('btLog','T-'+tn+' 公平回測完成: '+dStart+' 至 '+dEnd+' | '+describeTNExecMode(getTNExecMode(), tn),true);
    } catch(err) {
      sl('btLog','Error: '+err.message,false); console.error(err);
    } finally {
      SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
      hideL();
    }
  }, 80);
}

async function runBT() {
  if(!(await ensureDataReadyForAnalysis('backtest'))) return;
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  sl('btLog','Calculating...',null); showL('Backtesting...');
  setTimeout(async function() {
    try {
      if (CACHE_SKIP_MO!==SKIP_MO) { await buildCache(); }
      var mh=parseInt($('btH')?$('btH').value:'3')||3;
      var mode=getWeightMode(), init=gv('btCap')||100000;
      var records=runBTcore(mh,mode);
      if (!records) { alert('Not enough data'); hideL(); return; }
      BT_RESULT={records:records,initial:init,mode:mode,mh:mh};
      BT_RESULT.icResult = calcIC(records);
      renderBT(records,init,mode);
      var dStart=records[0].month, dEnd=records[records.length-1].month;
      sl('btLog','\u56de\u6e2c\u5b8c\u6210: '+dStart+' \u81f3 '+dEnd+' (\u5171 '+records.length+' \u671f)',true);
    } catch(err) { sl('btLog','Error: '+err.message,false); console.error(err); }
    finally { hideL(); }
  }, 80);
}

// FIX4: runCompare - origH saved, restore in finally
async function runCompare() {
  if(!(await ensureDataReadyForAnalysis('compare'))) return;
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  var maxN=parseInt($('btH')?$('btH').value:'5')||5, mode=getWeightMode();
  var elMode=document.getElementById('poolMode');
  var origMode=elMode?elMode.value:'large';
  var origH=$('btH')?$('btH').value:'5';
  if (elMode) elMode.value='large';
  // Read T-N settings so Compare uses same basis as single backtest
  var tn=parseInt($('btSignalTN')?$('btSignalTN').value:'4',10); if(!isFinite(tn)) tn=4;
  var tnExec=getTNExecMode();
  var usesTN = tn > 0;
  sl('btLog','Comparing N=1 to '+maxN+(usesTN?' (T-'+tn+' '+tnExec+')':' (t-1/t-2)')+'...',null); showL('Comparing...');
  setTimeout(async function() {
    try {
      if (CACHE_SKIP_MO!==SKIP_MO) { await buildCache(); }
      var init=gv('btCap')||100000, results=[];
      var btOpts = usesTN ? {signalN:tn, tnExecMode:tnExec} : {};
      for (var n=1; n<=maxN; n++) {
        if ($('btH')) $('btH').value=n;
        var recs=runBTcore(n,mode,btOpts);
        if (recs) results.push({n:n,recs:recs,k:kpi(recs,init)});
      }
      if (!results.length) { alert('No results'); return; }
      renderCompare(results,init,mode);
      var dStart=results[0].recs[0].month;
      var dEnd=results[0].recs[results[0].recs.length-1].month;
      sl('btLog','\u6bd4\u8f03\u5b8c\u6210 N=1~'+maxN+(usesTN?' | T-'+tn+' '+tnExec:' | t-'+(document.querySelector('input[name="lagMode"]:checked')?document.querySelector('input[name="lagMode"]:checked').value:'1'))+' | \u671f\u9593: '+dStart+' \u81f3 '+dEnd,true);
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
  var recs=getDisplayBTRecords(records, init); $('btRes').classList.remove('hidden');
  var last=recs[recs.length-1];
  // Metrics (CAGR, MDD, Sharpe) must use raw records so they match kpi() used by
  // WF, Compare, Monte Carlo, T-N Sweep and all downstream analysis.
  // Display records (live-adjusted last row) are only for the table, detail rows,
  // and the Final NAV / Return shown in the card.
  var rawK=kpi(records, init);
  var cagr=rawK.cagr, mdd=rawK.mdd, sh=rawK.sharpe;
  var tr=last.nav/init-1;
  var btr=last.bNav/init-1, bcagr=periodsToYears(recs.length)>0?Math.pow(1+Math.max(btr,-0.999),1/periodsToYears(recs.length))-1:0;
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
    +'</div></div>'
    + renderLatestHoldingsPriceBox(last);

  // IC Analysis Section
  var icRes = BT_RESULT && BT_RESULT.icResult;
  var icHtml = '<div class="card" style="border-top:3px solid var(--ac);margin-top:8px">'
    + '<div class="ct" style="display:flex;justify-content:space-between;align-items:center">'
    + '<span>&#x56E0;&#x5B50;&#x6709;&#x6548;&#x6027;&#x8A3A;&#x65B7; (IC / ICIR)'
    + '<span style="font-size:10px;font-weight:400;color:var(--mu);margin-left:8px">&#x52D5;&#x80FD;&#x5206;&#x6578;&#x6392;&#x540D; vs &#x6B21;&#x6708;&#x5BE6;&#x969B;&#x5831;&#x916C;</span></span>'
    + '<span id="icToggle" style="font-size:11px;color:var(--ac);cursor:pointer" onclick="document.getElementById(\'icDetail\').classList.toggle(\'hidden\')">&#x8A73;&#x7D30; &#x25BC;</span>'
    + '</div>';
  if (!icRes || !icRes.n_months) {
    icHtml += '<div style="font-size:12px;color:var(--mu);padding:4px 0">&#x6307;&#x6A19;&#x8CC7;&#x6599;&#x4E0D;&#x8DB3;&#xFF0C;&#x7121;&#x6CD5;&#x8A08;&#x7B97; IC&#x3002;&#x8ACB;&#x78BA;&#x8A8D;&#x80A1;&#x7968;&#x6709;&#x5BF9;&#x6B21;&#x6708;&#x5BE6;&#x969B;&#x5831;&#x916C;&#x8CC7;&#x6599;&#x3002;</div>';
  } else {
    var ic = icRes.mean_ic, icir = icRes.icir, t = icRes.t_stat;
    var pos = icRes.pos_ic_pct, nm = icRes.n_months;
    var icColor = ic > 0.05 ? 'var(--gr)' : ic > 0 ? 'var(--ye)' : 'var(--re)';
    var icirColor = Math.abs(icir) > 0.5 ? 'var(--gr)' : Math.abs(icir) > 0.3 ? 'var(--ye)' : 'var(--re)';
    var verdict = ic > 0.05 && icir > 0.5 ? '\u56e0\u5b50\u6709\u6548 \u2714'
      : ic > 0 && icir > 0 ? '\u5c0f\u5e45\u6709\u6548 \u26a0'
      : '\u6548\u679c\u4e0d\u660e\u986f \u2715';
    var twICstr = icRes.mean_tw_ic !== null ? (icRes.mean_tw_ic>=0?'+':'')+icRes.mean_tw_ic.toFixed(3) : '--';
    var usICstr = icRes.mean_us_ic !== null ? (icRes.mean_us_ic>=0?'+':'')+icRes.mean_us_ic.toFixed(3) : '--';
    var twColor = (icRes.mean_tw_ic||0) > 0 ? 'var(--gr)' : 'var(--re)';
    var usColor = (icRes.mean_us_ic||0) > 0 ? 'var(--gr)' : 'var(--re)';
    icHtml += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px">'
      + '<div class="ib2" style="padding:8px;margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:3px">Mean IC</div>'
      + '<div style="font-size:20px;font-weight:700;font-family:monospace;color:'+icColor+'">'+(ic>=0?'+':'')+ic.toFixed(3)+'</div>'
      + '<div style="font-size:9px;color:var(--mu)">|t|='+Math.abs(t).toFixed(2)+'</div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:3px">ICIR</div>'
      + '<div style="font-size:20px;font-weight:700;font-family:monospace;color:'+icirColor+'">'+(icir>=0?'+':'')+icir.toFixed(3)+'</div>'
      + '<div style="font-size:9px;color:var(--mu)">IC/std(IC)</div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:3px">IC&gt;0\u6bd4\u4f8b</div>'
      + '<div style="font-size:20px;font-weight:700;font-family:monospace;color:'+(pos>0.5?'var(--gr)':'var(--re)')+'">'+(pos*100).toFixed(0)+'%</div>'
      + '<div style="font-size:9px;color:var(--mu)">'+nm+'\u500b\u6708</div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:3px">TW IC / US IC</div>'
      + '<div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:2px">'
      + '<span style="color:'+twColor+'">'+twICstr+'</span> <span style="font-size:9px;color:var(--mu)">TW</span><br>'
      + '<span style="color:'+usColor+'">'+usICstr+'</span> <span style="font-size:9px;color:var(--mu)">US</span></div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0"><div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:3px">\u8a3a\u65b7</div>'
      + '<div style="font-size:12px;font-weight:700;color:'+icColor+';margin-top:4px">'+verdict+'</div>'
      + '<div style="font-size:9px;color:var(--mu)">ICIR&gt;0.5\u70ba\u6709\u6548</div></div>'
      + '</div>';
    // IC bar explanation + Quintile IC
    var qICstr = icRes.mean_q_ic !== null ? (icRes.mean_q_ic>=0?'+':'')+icRes.mean_q_ic.toFixed(3) : '--';
    var qIRstr = icRes.icir_q    !== null ? (icRes.icir_q>=0?'+':'')+icRes.icir_q.toFixed(3)    : '--';
    var spStr  = icRes.mean_spread !== null ? ((icRes.mean_spread>=0?'+':'')+(icRes.mean_spread*100).toFixed(2)+'%') : '--';
    var qColor = (icRes.mean_q_ic||0)>0.05?'var(--gr)':(icRes.mean_q_ic||0)>0?'var(--ye)':'var(--re)';
    var spColor= (icRes.mean_spread||0)>0?'var(--gr)':'var(--re)';
    icHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;margin-top:2px">'
      + '<div class="ib2" style="padding:8px;margin-top:0;border:1px solid var(--ac)">'
      + '<div style="font-size:9px;color:var(--ac);font-weight:700;text-transform:uppercase;margin-bottom:3px">\u5206\u4f4d\u6578 IC '+(icRes.tail_label||getTailConfig().label)+'</div>'
      + '<div style="font-size:22px;font-weight:700;font-family:monospace;color:'+qColor+'">'+qICstr+'</div>'
      + '<div style="font-size:9px;color:var(--mu)">ICIR_Q = '+qIRstr+'</div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0;border:1px solid var(--ac)">'
      + '<div style="font-size:9px;color:var(--ac);font-weight:700;text-transform:uppercase;margin-bottom:3px">'+(icRes.tail_label||getTailConfig().label)+' \u5831\u916c\u5dee</div>'
      + '<div style="font-size:22px;font-weight:700;font-family:monospace;color:'+spColor+'">'+spStr+'</div>'
      + '<div style="font-size:9px;color:var(--mu)">\u6bcf\u6708\u5e73\u5747\uff0c\u6b63\u5024=\u9078\u80a1\u6709\u6548</div></div>'
      + '<div class="ib2" style="padding:8px;margin-top:0">'
      + '<div style="font-size:9px;color:var(--mu);text-transform:uppercase;margin-bottom:4px">\u89e3\u8b80\u6307\u5f15</div>'
      + '<div style="font-size:10px;color:var(--mu);line-height:1.8">'
      + 'Mean IC \u2192 \u6574\u9ad4\u6392\u5e8f\u80fd\u529b<br>'
      + '\u5206\u4f4d\u6578 IC \u2192 \u53f3\u5c3e\u8b58\u5225\u80fd\u529b<br>'
      + 'Spread \u2192 \u9078\u80a1\u652f\u6255\u80fd\u529b'
      + '</div></div>'
      + '</div>';
    icHtml += '<div style="font-size:10px;color:var(--mu);line-height:1.6;background:var(--dp);padding:5px 8px;border-radius:3px;margin-bottom:6px">'
      + 'Mean IC\u4f4e + \u5206\u4f4d\u6578 IC\u9ad8 = \u53f3\u5c3e\u8b58\u5225\u578b\u7cfb\u7d71\uff08\u9078\u80a1\u7b2c1\u22125\u540d\u80fd\u529b\u5f37\uff0c\u4e2d\u6bb5\u6392\u5e8f\u96a8\u6a5f\uff09\u3002'
      + 'Spread \u6b63\u4e14\u9ad8 = \u56e0\u5b50\u6709\u652f\u6255\u80fd\u529b\u3002'
      + '</div>';
    icHtml += buildTailPanelHTML(icRes);
    // Monthly IC detail table (collapsible)
    icHtml += '<div id="icDetail" class="hidden" style="margin-top:8px;max-height:220px;overflow-y:auto">'
      + '<table style="width:100%;font-size:11px;border-collapse:collapse">'
      + '<thead><tr style="color:var(--mu)">'
      + '<th style="text-align:left;padding:3px 6px">&#x6708;&#x4EFD;</th>'
      + '<th style="text-align:right;padding:3px 6px">IC</th>'
      + '<th style="text-align:right;padding:3px 6px">\u5206\u4f4d\u6578 IC</th>'
      + '<th style="text-align:right;padding:3px 6px">Spread</th>'
      + '<th style="text-align:right;padding:3px 6px">t\u5024</th>'
      + '<th style="text-align:right;padding:3px 6px">\u5019\u9078\u6578</th>'
      + '<th style="text-align:right;padding:3px 6px">TW/US</th>'
      + '</tr></thead><tbody>'
      + icRes.monthlyIC.map(function(m){
          var c  = m.ic>0.05?'var(--gr)':m.ic>0?'var(--ye)':'var(--re)';
          var cq = m.ic_q!==null?(m.ic_q>0.05?'var(--gr)':m.ic_q>0?'var(--ye)':'var(--re)'):'var(--dim)';
          var cs = m.spread_ret!==null?(m.spread_ret>0?'var(--gr)':'var(--re)'):'var(--dim)';
          return '<tr><td style="padding:2px 6px;font-family:monospace">'+m.month+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:'+c+';font-weight:700">'+(m.ic>=0?'+':'')+m.ic.toFixed(3)+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:'+cq+'">'+(m.ic_q!==null?(m.ic_q>=0?'+':'')+m.ic_q.toFixed(3):'--')+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:'+cs+'">'+(m.spread_ret!==null?((m.spread_ret>=0?'+':'')+(m.spread_ret*100).toFixed(1)+'%'):'--')+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:var(--mu)">'+m.t.toFixed(2)+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:var(--mu)">'+m.n+'</td>'
            +'<td style="text-align:right;padding:2px 6px;font-family:monospace;color:var(--dim)">'+(m.n_tw||0)+'/'+(m.n_us||0)+'</td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }
  icHtml += '</div>';
  var icContainer = document.getElementById('btICSection');
  if (!icContainer) {
    icContainer = document.createElement('div');
    icContainer.id = 'btICSection';
    var btMetrics = document.getElementById('btMetrics');
    btMetrics.parentNode.insertBefore(icContainer, btMetrics.nextSibling);
  }
  icContainer.innerHTML = icHtml;

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
    var grossDisplay=(r.grossRet!==undefined&&r.grossRet!==null&&isFinite(r.grossRet))?r.grossRet:0;
    var netDisplay=(r.pRet!==undefined&&r.pRet!==null&&isFinite(r.pRet))?r.pRet:(grossDisplay-((r.totalCost||0)));
    var costDisplay=(r.totalCost!==undefined&&r.totalCost!==null&&isFinite(r.totalCost))?r.totalCost:Math.max(0,grossDisplay-netDisplay);
    var ex=netDisplay-bRet;
    var grossColor=grossDisplay>=0?'var(--gr)':'var(--re)';
    var rc=netDisplay>=0?'var(--gr)':'var(--re)';
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
      return '<span title="期末NAV比例" style="background:'+bg+';color:'+col+';border:1px '+bst+' '+col+';padding:1px 6px;border-radius:3px;font-size:10px;font-family:monospace;margin:1px;">'+lbl+' '+pct+'</span>';
    }).join('');
    var sl2 = (r.shield && r.shield.stressLevel !== undefined) ? r.shield.stressLevel : -1;
    var comp2 = (r.shield && r.shield.composite !== undefined) ? r.shield.composite : -1;
    var exp2 = (r.shield && r.shield.exposure !== undefined) ? Math.round(r.shield.exposure * 100) : 100;
    var slLabelArr = ['L0','L1','L2','L3','L4'];
    var slColorArr = ['var(--gr)','var(--gr)','var(--ye)','var(--re)','var(--re)'];
    var slBgArr = ['rgba(0,229,160,0.1)','rgba(0,229,160,0.1)','rgba(255,184,48,0.1)','rgba(255,77,109,0.1)','rgba(255,77,109,0.1)'];
    var phaseDecision = r.marketPhaseDecision || null;
    var phaseN = phaseDecision ? phaseDecision.phase : (r.marketPhase || 0);
    var phaseMode = phaseDecision ? phaseDecision.mode : (r.marketPhaseMode || 'off');
    var phaseCtrl = !!(phaseDecision && phaseDecision.control);
    var phaseExp = phaseDecision ? (phaseDecision.suggestedExposure || phaseDecision.exposure || 1) : (r.marketPhaseSuggestedExposure || r.marketPhaseExposure || 1);
    var phaseRisk = phaseDecision ? (phaseDecision.risk || '--') : '--';
    var phaseColor = phaseN===3 ? 'var(--gr)' : (phaseN===4 || phaseN===2 ? 'var(--ye)' : (phaseN===5 ? 'var(--tw)' : (phaseN===6 ? 'var(--re)' : 'var(--mu)')));
    var phaseCell = '<td style="vertical-align:top;white-space:nowrap;padding:6px 8px">'
      + '<span style="border:1px solid '+phaseColor+';color:'+phaseColor+';padding:1px 6px;border-radius:3px;font-size:11px;font-family:monospace;font-weight:700">'
      + (phaseN ? ('P'+phaseN) : '--') + '</span>'
      + '<span style="font-size:11px;color:'+phaseColor+';font-weight:700;margin-left:4px">'+(Math.round(phaseExp*100))+'%</span>'
      + '<div style="font-size:9px;color:var(--mu);margin-top:2px">'+(phaseCtrl?'CONTROL':'DIAG')+'｜'+phaseRisk+'</div>'
      + '</td>';

    var stressCell;
    if (sl2 >= 0 && comp2 >= 0) {
      var sc = comp2 >= 80 ? 'var(--re)' : comp2 >= 60 ? 'var(--ye)' : 'var(--gr)';
      var sb = comp2 >= 80 ? 'rgba(255,77,109,0.1)' : comp2 >= 60 ? 'rgba(255,184,48,0.1)' : 'rgba(0,229,160,0.1)';
      var expC = exp2 >= 100 ? 'var(--gr)' : exp2 >= 70 ? 'var(--ye)' : 'var(--re)';
      var fStr = '';
      if (r.shield.factors && r.shield.factors.length === 4) {
        fStr = '<div style="font-size:9px;color:var(--mu);margin-top:2px;font-family:monospace">VIX='+r.shield.factors[0]+' HY='+r.shield.factors[1]+' Tr='+r.shield.factors[2]+' Br='+r.shield.factors[3]+'</div>';
      }
      stressCell = '<td style="vertical-align:top;white-space:nowrap;padding:6px 8px">'
        + '<span style="background:'+sb+';color:'+sc+';border:1px solid '+sc+';padding:1px 6px;border-radius:3px;font-size:12px;font-family:monospace;font-weight:700">'+comp2+'</span>'
        + '&nbsp;<span style="font-size:12px;font-family:monospace;color:'+expC+';font-weight:700">'+exp2+'%</span>'
        + fStr + '</td>';
    } else if (sl2 >= 0) {
      var sc2 = slColorArr[sl2] || 'var(--mu)';
      var sb2 = slBgArr[sl2] || '';
      var expC2 = exp2 >= 100 ? 'var(--gr)' : exp2 >= 70 ? 'var(--ye)' : 'var(--re)';
      stressCell = '<td style="vertical-align:top;white-space:nowrap;padding:6px 8px">'
        + '<span style="background:'+sb2+';color:'+sc2+';border:1px solid '+sc2+';padding:1px 6px;border-radius:3px;font-size:11px;font-family:monospace;font-weight:700">'+slLabelArr[sl2]+'</span>'
        + '&nbsp;<span style="font-size:12px;font-family:monospace;color:'+expC2+';font-weight:700">'+exp2+'%</span>'
        + '</td>';
    } else if (r.shield && !r.shield.enabled) {
      stressCell = '<td style="vertical-align:top;font-size:10px;color:var(--mu);padding:6px 8px">Stress OFF</td>';
    } else {
      stressCell = '<td style="vertical-align:top;font-size:10px;color:var(--mu);padding:6px 8px">--</td>';
    }
    var summaryRow='<tr style="border-top:2px solid var(--bd);">'
      +'<td class="mono" style="font-weight:700;vertical-align:top;">'+r.month+(r.liveAdjusted?'<div style="font-size:9px;color:var(--ac)">LIVE:'+((r.liveAsOf)||'latest')+'</div>':'')+(r.scoringM?'<div style="font-size:9px;color:var(--mu)">\u9078\u80a1:'+r.scoringM+'</div>':'')+'</td>'
      +'<td style="vertical-align:top;"><div style="font-size:9px;color:var(--mu);margin-bottom:2px">期末NAV比例</div>'+holdStr+'</td>'
      +'<td class="mono" style="font-size:10px;color:var(--bl);vertical-align:top;">'+(r.hurdle*100).toFixed(1)+'%</td>'
      +'<td class="mono" title="Gross Return = Σ(個股策略報酬 × 初始權重)，不扣成本" style="color:'+grossColor+';font-weight:700;vertical-align:top;">'+fmtMaybePct(grossDisplay,2)+'</td>'
      +'<td class="mono" title="Net Return = Gross Return - 成本；NAV只使用此數值鏈接" style="color:'+rc+';font-weight:700;vertical-align:top;">'+fmtMaybePct(netDisplay,2)+'<div style="font-size:9px;color:var(--mu);font-weight:400">Cost '+fmtMaybePct(costDisplay,2)+'</div></td>'
      +'<td class="mono" style="color:var(--mu);vertical-align:top;">$'+Math.round(r.bNav).toLocaleString()+'</td>'
      +'<td class="mono" style="color:'+ec+';font-weight:700;vertical-align:top;">'+(ex>=0?'+':'')+(ex*100).toFixed(2)+'pp</td>'
      +phaseCell
      +stressCell
      +'</tr>';
    var detailRows='';
    if (r.stockRets) {
      Object.keys(r.stockRets).forEach(function(k){
        var sr=r.stockRets[k] || {};
        var initW = getInitialWeightForDisplay(sr);
        var effW = getEffectiveWeightForDisplay(sr);
        var rawRet = (sr.ret !== undefined && sr.ret !== null && isFinite(sr.ret)) ? sr.ret : null;
        var positionRet = rawRet === null ? null : (initW < 0 ? -rawRet : rawRet);
        var contrib = rawRet === null ? 0 : rawRet * initW;
        var pnl = prevNav * contrib;
        var isShortPos=initW<0;
        var isUs=!!(document.querySelector('[data-code="'+k+'"][data-tw="0"]'));
        var col=isShortPos?'var(--bl)':(isUs?'var(--us)':'var(--tw)');
        var rc2=contrib>=0?'var(--gr)':'var(--re)';
        var retColor=(positionRet===null||!isFinite(positionRet))?'var(--mu)':(positionRet>=0?'var(--gr)':'var(--re)');
        var nm=getStockName(k);
        var dirLabel=isShortPos?'[S] ':'';
        var initPct=Math.abs(initW*100).toFixed(2)+'%';
        var effPct=Math.abs(effW*100).toFixed(2)+'%';
        var finalPct = (sr.finalCapital !== undefined && sr.finalCapital !== null && isFinite(sr.finalCapital)) ? (sr.finalCapital*100).toFixed(2)+'%' : null;
        var chainHtml = fmtNaturalChainHtmlNE(sr);
        detailRows+='<tr style="background:var(--bg);opacity:0.85;">'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);"></td>'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);font-family:monospace;font-size:11px;color:'+col+';">'
          +dirLabel+k+(nm&&nm!==k?' <span style="color:var(--mu);font-size:10px;">'+nm+'</span>':'')
          +' <span style="color:var(--mu);font-size:10px;">Weight '+initPct+'</span>'
          +(k!== 'CASH' ? '<div style="font-size:9px;color:var(--mu);margin-top:2px;line-height:1.5">'
            +(r.liveAdjusted?'最新價格':'回測價格')+'｜期初日 '+(sr.prevDate||r.tradeStart||'--')+' / 期初價 '+fmtPx(sr.prevPrice)
            +' / '+(r.liveAdjusted?'最新日 ':'期末日 ')+(sr.currDate||r.tradeEnd||'--')+' / '+(r.liveAdjusted?'最新價 ':'期末價 ')+fmtPx(sr.currPrice)
            +' / 報酬採用同一價格基準，不使用期末NAV比例反推</div>' : '')
          +chainHtml
          +'</td>'
          +'<td style="padding:3px 8px;border-bottom:1px solid var(--bd);"></td>'
          +'<td class="mono" title="個股策略報酬；多單=價格報酬，空單=價格報酬反向；自然淘汰=鏈式實際報酬" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:11px;color:'+retColor+';">'
          +fmtMaybePct(positionRet,2)
          +'</td>'
          +'<td class="mono" title="損益金額=上期NAV × Contribution" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:11px;color:'+rc2+';">'
          +(pnl>=0?'+$':'-$')+Math.abs(Math.round(pnl)).toLocaleString()
          +'</td>'
          +'<td colspan="2" title="Contribution = 個股策略報酬 × 初始權重；全體加總等於 Gross Return" style="padding:3px 8px;border-bottom:1px solid var(--bd);font-size:10px;color:'+rc2+';">'
          +'contrib: '+fmtMaybePct(contrib,2)
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
      var std=sampleStdAnnualized(rets);
      var sharpe=calcStandardSharpeFromReturns(rets, getAnnualPeriods());
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
  var init=BT_RESULT.initial;
  var recs=getDisplayBTRecords(BT_RESULT.records, init);
  var rows=['Date,Basis,Holdings,Hurdle%,GrossReturn%,Turnover%,TurnoverCost%,ImpactCost%,TotalCost%,Return%,NAV,BenchNav,Alpha%,MarketPhase,MarketPhaseMode,MarketPhaseExposure%,FinalExposure%,NaturalEvents,ClosureCostDiff%,ClosureNavDiff%'];
  recs.forEach(function(r,i){
    var pb=i>0?recs[i-1].bNav:init; var ex=r.pRet-(r.bNav/pb-1);
    var hold=Object.keys(r.holdings).map(function(k){ var nm=getStockName(k); return k+(nm&&nm!==k?'('+nm+')':'')+' '+(r.holdings[k]*100).toFixed(1)+'%'; }).join('+');
    var ev=(r.naturalEvents||[]).map(function(e){return e.date+':'+e.from+'→'+e.to+' rank='+e.rank+' cap='+(e.inheritedCapital*100).toFixed(2)+'%';}).join(' | ');
    var mp = r.marketPhaseDecision || {};
    rows.push([r.month,(r.liveAdjusted?'LATEST_PRICE':'TRADE_END'),hold,(r.hurdle*100).toFixed(2),((r.grossRet||0)*100).toFixed(3),((r.turnover||0)*100).toFixed(3),((r.turnoverCost||0)*100).toFixed(3),((r.impactCost||0)*100).toFixed(3),((r.totalCost||0)*100).toFixed(3),(r.pRet*100).toFixed(3),Math.round(r.nav),Math.round(r.bNav),(ex*100).toFixed(3),(r.marketPhase||mp.phase||0),(r.marketPhaseMode||mp.mode||'off'),(((r.marketPhaseSuggestedExposure||mp.suggestedExposure||mp.exposure||1)*100).toFixed(1)),(((r.finalExposure||1)*100).toFixed(1)),ev,((r.closureCostDiff||0)*100).toFixed(6),((r.closureNavDiff||0)*100).toFixed(6)].map(csvCell).join(','));
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
    updFetchStat(); updTNX(); if(isAutoBuildCache()){await buildCache();}else{CACHE_BUILT=false;CACHE_TS=null;CACHE_SIG=null;if($('cacheTxt'))$('cacheTxt').textContent='Cache: uploaded data; build on demand';}
    if(isPersist()) await saveAllToDB();
    sl('dlLog','Loaded! Data restored. Cache will build only when requested.',true);
  } catch(err){ sl('dlLog','Error: '+err.message,false); }
  el.value='';
}
async function clearAndReset() {
  if(!confirm('Clear all cached data and IndexedDB?'))return;
  await indexedDB.deleteDatabase('FearlessConsoleDB');
  DAILY={}; CACHE_BUILT=false; CACHE_TS=null; CACHE_SIG=null; RAW_SCORES={};
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
  if(!(await ensureDataReadyForAnalysis('signal'))) return;
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  if(CACHE_SKIP_MO!==SKIP_MO){ await buildCache(); }
  var stocks=getEnabledStocks().filter(function(s){ return RAW_SCORES[s.c]; });
  if(!stocks.length)return;
  var masterTicker = DAILY['^TWII'] ? '^TWII' : (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : stocks[0].c));
  var refDaily = DAILY[masterTicker];
  var sigInfo = getSignalTNInfo(refDaily);
  if (!sigInfo) { alert('找不到 Signal Month 資料。請輸入 YYYY-MM，或確認資料已載入。'); return; }
  var sigN = sigInfo.N;
  if (!sigInfo.ready) {
    $('sigContent').innerHTML = '<div class="ib2" style="border-left:3px solid var(--ye);color:var(--ye)">尚未到達 T-'+sigN+' 訊號日<br>頻率: <b>'+((sigInfo.freq==='2')?'半月頻':'月頻')+'</b> / 期別: <b>'+(sigInfo.label||'月底')+'</b><br>月份: <b>'+sigInfo.ym+'</b><br>T（本期再平衡日）: <b>'+sigInfo.T+'</b> '+(sigInfo.source==='estimated'?'(依週一至週五估算)':'')+'<br>T-'+sigN+': <b>'+sigInfo.tN+'</b><br>最新資料: <b>'+sigInfo.lastDate+'</b></div>';
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

  // 正式空頭名單：依 Short N、低分排序、排除多頭已選、排除 SGOV/ETF。
  var shortN=parseInt($('btSN') ? $('btSN').value : '0') || 0;
  var shortTSF=!!($('btSTSF') && $('btSTSF').checked);
  var selS=[];
  if(shortN>0){
    var longMap={};
    sel.forEach(function(r){ if(r && r.s) longMap[r.s.c]=1; });
    var sCands=allScores.filter(function(r){
      if(!r || !r.s) return false;
      if(longMap[r.s.c]) return false;
      if(r.s.c==='SGOV' || r.s.c==='CASH') return false;
      if(r.s.pool==='etf' || r.s.region==='etf') return false;
      return true;
    });
    if(shortTSF) sCands=sCands.filter(function(r){ return r.r240!==null && r.r240<0; });
    sCands.sort(function(a,b){ return a.score-b.score; });
    for(var si=0; si<sCands.length && selS.length<shortN; si++){
      var candS=sCands[si];
      if(selS.every(function(x){ return Math.abs(calcCorr(candS.s.c,x.s.c,latestDate))<ct; })) selS.push(candS);
    }
  }

  renderSig(sel,selS,allScores,latestDate,hurdle,sigInfo);
  renderST(allScores,hurdle,sel.map(function(s){return s.s.c;}),rejectedMap,latestDate);
}

// FIX5: renderSig - no emoji in poolNames
function isTWSignalStock(r) {
  return !!(r && r.s && (r.s.tw === true || r.s.tw === '1' || r.s.region === 'tw' || r.s.pool === 'tw'));
}

function renderSignalGroup(title, list, type, zf, pf, scoreDate, sigInfo) {
  var isShort = type === 'short';
  var color = isShort ? 'var(--re)' : 'var(--gr)';
  var border = isShort ? 'var(--re)' : 'var(--gr)';
  var tag = isShort ? 'SHORT #' : 'LONG #';
  var html = '';

  html += '<div style="font-size:13px;font-weight:700;color:'+color+';margin:16px 0 6px;border-bottom:1px solid '+border+';padding-bottom:4px">'+title+'</div>';

  if(!list || !list.length){
    html += '<div class="ib2" style="color:var(--mu);border-color:var(--bd);margin-bottom:8px">這個月無入選</div>';
    return html;
  }

  html += '<div class="sg">';
  list.forEach(function(r,rk){
    var cardClass = isShort ? 'scard wk' : 'scard';
    var scoreColor = isShort ? 'var(--re)' : color;
    html += '<div class="'+cardClass+'" style="border-left:3px solid '+border+'">'
      + '<div class="shdr"><div>'
      + '<div class="scode" style="color:'+scoreColor+'">'+r.s.c+'</div>'
      + '<div class="sname">'+r.s.n+'</div>'
      + '</div><span class="srank" style="background:var(--sf2);color:'+scoreColor+';border:1px solid '+border+'">'+tag+(rk+1)+'</span></div>'
      + '<div class="sscore">'+(r.score>=0?'+':'')+r.score.toFixed(2)+'</div>';

    html += '<div class="sbars">';
    [['Mom',r.zm,'var(--tw)'],['Bias',r.zb,'var(--bl)'],['Slope',r.zs,'var(--te)'],['Vol',r.zv,'var(--ye)'],['Kbar',r.zk,'var(--ac)']].forEach(function(b){
      if(b[1]===null)return;
      var w=Math.round(Math.min(100,Math.abs(b[1])*25));
      html+='<div class="sbrow"><span style="width:32px">'+b[0]+'</span><div class="sbwrap"><div class="sbfill" style="width:'+w+'%;background:'+b[2]+'"></div></div><span style="width:36px;text-align:right;font-family:monospace">'+zf(b[1])+'</span></div>';
    });
    html += '</div>';

    html += '<div style="margin-top:5px;font-size:10px;color:var(--mu);font-family:monospace">'
      + 'R240:'+pf(r.r240)+' / Pool:'+(r.s.pool||'-')+' / Region:'+(r.s.region||'-')
      + '</div>'
      + renderSignalPriceLine(r.s.c, scoreDate, isShort ? -1 : 1, ($('sigTN') ? ($('sigTN').value || 10) : 10), sigInfo ? sigInfo.T : null)
      + '</div>';
  });
  html += '</div>';
  return html;
}

function renderSig(sel,selS,all,date,hurdle,sigInfo) {
  var zf=function(v){return v!==null?(v>=0?'+':'')+v.toFixed(2):'-';};
  var pf=function(v){return v!==null?(v>=0?'+':'')+(v*100).toFixed(1)+'%':'-';};
  var tnx=getTNXRate(date);
  var sigN = $('sigTN') ? ($('sigTN').value || '10') : '10';
  var execMode = getTNExecMode();
  var freqLabel = (sigInfo && sigInfo.freq === '2') ? '半月頻' : '月頻';
  var periodLabel = sigInfo && sigInfo.label ? sigInfo.label : '月底';
  var anchorT = sigInfo && sigInfo.T ? sigInfo.T : date;
  var html='<div style="font-size:11px;color:var(--mu);margin-bottom:9px">Freq: <b style="color:var(--tw)">'+freqLabel+'</b> | 期別: <b style="color:var(--tw)">'+periodLabel+'</b> | Signal: <b style="color:var(--tw)">T-'+sigN+'</b> | T基準日: <b style="color:var(--tw)">'+anchorT+'</b> | Score Date: <b style="color:var(--tw)">'+date+'</b> | 成交基準: <b style="color:var(--ac)">'+describeTNExecMode(execMode, parseInt(sigN,10)||0)+'</b> | ^TNX: <b style="color:var(--bl)">'+(tnx*100).toFixed(2)+'%</b> | Hurdle: <b style="color:var(--ye)">'+(hurdle*100).toFixed(2)+'%</b><br><span style="color:var(--mu)">此為信號頁獨立觀察訊號；頻率會跟隨回測的月頻/半月頻設定。半月頻時，T 會改為本期半月或月底再平衡日。</span></div>';

  sel = sel || [];
  selS = selS || [];
  var longTW = sel.filter(isTWSignalStock);
  var longUS = sel.filter(function(r){ return !isTWSignalStock(r); });
  var shortTW = selS.filter(isTWSignalStock);
  var shortUS = selS.filter(function(r){ return !isTWSignalStock(r); });

  html += renderSignalGroup('LONG 多頭名單｜台股', longTW, 'long', zf, pf, date, sigInfo);
  html += renderSignalGroup('LONG 多頭名單｜美股 / 國際', longUS, 'long', zf, pf, date, sigInfo);
  html += renderSignalGroup('SHORT 空頭名單｜台股', shortTW, 'short', zf, pf, date, sigInfo);
  html += renderSignalGroup('SHORT 空頭名單｜美股 / 國際', shortUS, 'short', zf, pf, date, sigInfo);

  if(!sel.length) html+='<div style="color:var(--ye);font-size:12px;margin-bottom:9px">無多頭標的通過 TS 與篩選條件；若有設定 Short N，仍可查看空頭名單。</div>';
  if(!selS.length && (parseInt($('btSN') ? $('btSN').value : '0') || 0) > 0) html+='<div style="color:var(--ye);font-size:12px;margin-bottom:9px">Short N 已開啟，但本月無空頭入選。</div>';
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
        var yrs=periodsToYears(n), cagr=Math.pow(nav/init,1/yrs)-1;
        var std=sampleStdAnnualized(sim);
        var sharpe=calcStandardSharpeFromReturns(sim, getAnnualPeriods());
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
        var yrs=periodsToYears(n), cagr=Math.pow(nav/init,1/yrs)-1;
        var std=sampleStdAnnualized(sim);
        var sharpe=calcStandardSharpeFromReturns(sim, getAnnualPeriods());
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
  var origYrs=periodsToYears(orig.length);
  var origCagr=Math.pow(origLast.nav/origInit,1/origYrs)-1;
  var origRets=orig.map(function(r){return r.pRet;});
  var origAvg=avgArr(origRets);
  var origStd=sampleStdAnnualized(origRets);
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
  // OOS/IS is meaningful only when IS CAGR is positive.
  // If IS <= 0, a ratio can flip sign or explode and becomes misleading.
  if (!isFinite(oosCagr) || !isFinite(isCagr) || isCagr <= 0) return null;
  return oosCagr / isCagr;
}
function wfRatioColor(r) {
  if (r === null || !isFinite(r)) return 'var(--mu)';
  return r >= 0.6 ? 'var(--gr)' : (r >= 0.4 ? 'var(--ye)' : 'var(--re)');
}
function wfRatioText(r) {
  return (r === null || !isFinite(r)) ? '—' : ((r * 100).toFixed(0) + '%');
}
function wfValidRatioList(results) {
  return results.map(function(r){ return r.ratio; }).filter(function(v){ return v !== null && isFinite(v); });
}
function wfAvgRatio(results) {
  var arr = wfValidRatioList(results);
  if (!arr.length) return null;
  return arr.reduce(function(a,b){ return a+b; }, 0) / arr.length;
}
function wfMedianRatio(results) {
  var arr = wfValidRatioList(results).sort(function(a,b){return a-b;});
  if (!arr.length) return null;
  var m = Math.floor(arr.length/2);
  return arr.length % 2 ? arr[m] : (arr[m-1] + arr[m]) / 2;
}
function wfValidRatioCount(results) {
  return wfValidRatioList(results).length;
}
function wfRatioSummaryHtml(results, spliced) {
  var validN = wfValidRatioCount(results);
  return '<div class="card" style="border-top:2px solid '+wfRatioColor(spliced.medianRatio)+';padding:9px;">'
    + '<div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">Median OOS/IS</div>'
    + '<div class="mono" style="font-size:20px;color:'+wfRatioColor(spliced.medianRatio)+'">'+wfRatioText(spliced.medianRatio)+'</div>'
    + '<div style="font-size:9px;color:var(--mu)">Avg '+wfRatioText(spliced.avgRatio)+' | valid '+validN+'/'+results.length+'</div>'
    + '</div>';
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
  var capMode = capEl ? capEl.value : '1330';
  var signalN = Math.max(0, Math.min(22, parseInt($('btSignalTN') ? $('btSignalTN').value : '10') || 0));
  var tnExecMode = getTNExecMode();
  return {
    poolMode: poolM, n: n, wt: wt, lag: lag, freq: freq,
    regOn: regOn, regExp: regExp, shieldOn: shieldOn, shieldMA: shieldMA,
    skipMo: skipMo, ma60: ma60, cost: cost, corrT: corrT,
    indLim: indLim, shortN: shortN, capMode: capMode, signalN: signalN, tnExecMode: tnExecMode
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
  parts.push('Signal=T-' + cfg.signalN);
  parts.push('Exec=' + (cfg.tnExecMode === 'NEXT' ? 'T-(' + Math.max(0, cfg.signalN - 1) + ')' : 'T'));
  if (cfg.skipMo) parts.push('SkipMo');
  if (cfg.regOn) parts.push('Regime VWMA(' + cfg.regExp + '%)');
  if (cfg.shieldOn) parts.push('Shield(' + cfg.shieldMA + 'd)');
  if (cfg.ma60 === 'on') parts.push('MA60');
  if (cfg.shortN > 0) parts.push('Short=' + cfg.shortN);
  if (cfg.indLim > 0) parts.push('IndLim=' + cfg.indLim);
  return parts.join(' | ');
}

function wfDateInRange(dateStr, startYM, endYM) {
  if (!dateStr) return false;
  var ym = dateStr.slice(0, 7);
  return ym >= startYM && ym <= endYM;
}
function wfRecordReturnDate(r) {
  // WF attribution must follow the realized return date, not the signal date.
  // In T-N NEXT mode this is the actual T-(N-1) execution close for the period end.
  return (r && (r.tradeEnd || r.month)) || null;
}
function wfRunWindow(startYM, endYM, opts) {
  var recs = runBTcore(null, null, opts || {});
  if (!recs || !recs.length) return recs;
  // Keep only returns whose actual execution-period end belongs to the requested IS/OOS window.
  // This prevents a return generated by one window from leaking into the previous/next WF window.
  return recs.filter(function(r){ return wfDateInRange(wfRecordReturnDate(r), startYM, endYM); });
}
function wfPushWindowReturns(target, recs, startYM, endYM) {
  if (!recs || !recs.length) return;
  recs.forEach(function(r){ if (wfDateInRange(wfRecordReturnDate(r), startYM, endYM)) target.push(r.pRet); });
}
function wfWithDateRange(startYM, endYM, opts) {
  if ($('btS')) $('btS').value = startYM;
  if ($('btE')) $('btE').value = endYM;
  return wfRunWindow(startYM, endYM, opts || {});
}
function wfRestoreDates(origS, origE) {
  if ($('btS')) $('btS').value = origS;
  if ($('btE')) $('btE').value = origE;
}

async function runWalkForward() {
  if(!(await ensureDataReadyForAnalysis('walk-forward'))) return;
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
  var wfOpts={signalN:cfg.signalN, tnExecMode:cfg.tnExecMode};

  sl('stressLog','Running Walk-Forward (Anchored) T-'+cfg.signalN+' / '+(cfg.tnExecMode==='NEXT'?'Exec T-(' + Math.max(0,cfg.signalN-1) + ')':'Exec T')+'...',null);
  showL('Walk-Forward Analysis T-'+cfg.signalN+' / '+(cfg.tnExecMode==='NEXT'?'Exec T-(' + Math.max(0,cfg.signalN-1) + ')':'Exec T')+'...');
  setTimeout(async function(){
    try {
      if(CACHE_SKIP_MO!==SKIP_MO){ await buildCache(); }
      var results=[],combinedOOS=[];
      for(var ty=firstTestYear; ty+testWY-1<=lastYear; ty+=testWY){
        var isStart=firstYear+'-01', isEnd=(ty-1)+'-12';
        var tStart=ty+'-01', tEnd=(ty+testWY-1)+'-12';

        // Anchored WF definition:
        // IS = first available year through year before the OOS window.
        // OOS = the immediately following test window only.
        var isRecs=wfWithDateRange(isStart,isEnd,wfOpts);
        var oosRecs=wfWithDateRange(tStart,tEnd,wfOpts);

        if(!isRecs || !oosRecs || isRecs.length<2 || oosRecs.length<2) continue;
        var isK=wfKpiFromRecords(isRecs), oosK=wfKpiFromRecords(oosRecs);
        if(!isK || !oosK) continue;
        var ratio=wfSafeRatio(oosK.cagr,isK.cagr);
        wfPushWindowReturns(combinedOOS,oosRecs,tStart,tEnd);
        // AUDIT: WF window overlap and size
        auditWFWindow('ANCHORED', isStart+'~'+isEnd, tStart+'~'+tEnd,
          isK.cagr, oosK.cagr, ratio, oosRecs.length);
        results.push({isPeriod:isStart+'~'+isEnd, period:tStart+'~'+tEnd, months:oosRecs.length, isCagr:isK.cagr, isSharpe:isK.sharpe, cagr:oosK.cagr, mdd:oosK.mdd, sharpe:oosK.sharpe, ratio:ratio});
      }
      wfRestoreDates(origS,origE);
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
      wfRestoreDates(origS,origE);
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
  html+=wfRatioSummaryHtml(results, spliced);
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
  html+='<div style="font-size:10px;color:var(--mu);margin-top:8px;">OOS/IS is shown only when IS CAGR is positive. IS <= 0 windows are displayed as — and excluded from Avg/Median.</div>';
  html+='</div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}

async function runRollingWalkForward() {
  if(!(await ensureDataReadyForAnalysis('rolling walk-forward'))) return;
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
  var wfOpts={signalN:cfg.signalN, tnExecMode:cfg.tnExecMode};

  sl('stressLog','Running Rolling Walk-Forward T-'+cfg.signalN+' / '+(cfg.tnExecMode==='NEXT'?'Exec T-(' + Math.max(0,cfg.signalN-1) + ')':'Exec T')+'...',null);
  showL('Rolling Walk-Forward Analysis T-'+cfg.signalN+' / '+(cfg.tnExecMode==='NEXT'?'Exec T-(' + Math.max(0,cfg.signalN-1) + ')':'Exec T')+'...');
  setTimeout(async function(){
    try {
      if(CACHE_SKIP_MO!==SKIP_MO){ await buildCache(); }
      var results=[],combinedOOS=[];
      for(var ty=firstTestYear; ty+testY-1<=lastYear; ty+=testY){
        var trStart=(ty-trainY)+'-01', trEnd=(ty-1)+'-12';
        var teStart=ty+'-01', teEnd=(ty+testY-1)+'-12';

        // Rolling WF definition:
        // IS = fixed-length trainY window ending immediately before OOS.
        // OOS = the immediately following testY window only.
        var trainRecs=wfWithDateRange(trStart,trEnd,wfOpts);
        var oosRecs=wfWithDateRange(teStart,teEnd,wfOpts);

        if(!trainRecs||!oosRecs||trainRecs.length<2||oosRecs.length<2) continue;
        var tk=wfKpiFromRecords(trainRecs), ok=wfKpiFromRecords(oosRecs);
        if(!tk || !ok) continue;
        var ratio=wfSafeRatio(ok.cagr,tk.cagr);
        wfPushWindowReturns(combinedOOS,oosRecs,teStart,teEnd);
        // AUDIT: Rolling WF window
        auditWFWindow('ROLLING', trStart+'~'+trEnd, teStart+'~'+teEnd,
          tk.cagr, ok.cagr, ratio, oosRecs.length);
        results.push({train:trStart+'~'+trEnd, test:teStart+'~'+teEnd, months:oosRecs.length, trainCagr:tk.cagr, trainSharpe:tk.sharpe, cagr:ok.cagr, mdd:ok.mdd, sharpe:ok.sharpe, ratio:ratio});
      }
      wfRestoreDates(origS,origE);
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
      wfRestoreDates(origS,origE);
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
  html+=wfRatioSummaryHtml(results, spliced);
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
  html+='<div style="font-size:10px;color:var(--mu);margin-top:8px;">Rolling WF uses fixed-length training windows. OOS/IS is shown only when IS CAGR is positive; IS <= 0 windows are excluded from Avg/Median.</div>';
  html+='</div>';
  $('stressRes').classList.remove('hidden');
  var el=$('stressMetrics');
  if(el) el.innerHTML=el.innerHTML+html;
}


async function runTNSweep() {
  if(!(await ensureDataReadyForAnalysis('T-N sweep'))) return;
  var out = $('stressMetrics');
  var log = $('stressLog');
  if (log) sl('stressLog','Running T-N Sweep N=1~22...',null);
  showL('T-N Sweep N=1~22...');

  setTimeout(async function(){
    try {
      // T-N Sweep: N 只決定同一個 scoring month 內的訊號日。
      // Skip Month 不應被強制關閉；完全跟隨使用者勾選狀態。
      SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
      if (CACHE_SKIP_MO !== SKIP_MO) await buildCache();

      var mh = parseInt($('btH') ? $('btH').value : '6') || 6;
      var mode = getWeightMode();
      var init = gv('btCap') || 100000;
      var rows = [];
      var bestSharpe = null, bestCAGR = null, bestMDD = null;

      for (var n = 1; n <= 22; n++) {
        var records = runBTcore(mh, mode, {signalN:n,tnExecMode:getTNExecMode()});
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
        + '<div class="ct">T-N Sweep 回測表 <span style="color:var(--mu);font-size:10px">N只決定訊號日；Skip Month依目前勾選狀態；成交日依目前T-N成交基準</span></div>'
        + '<div class="ib2" style="margin-bottom:8px">最佳 Sharpe: <b>T-' + (bestSharpe ? bestSharpe.n : '-') + '</b>'
        + (bestSharpe ? ' / ' + bestSharpe.sharpe.toFixed(2) : '')
        + '　|　最佳 CAGR: <b>T-' + (bestCAGR ? bestCAGR.n : '-') + '</b>'
        + (bestCAGR ? ' / ' + (bestCAGR.cagr*100).toFixed(2) + '%' : '')
        + '　|　最低 MDD: <b>T-' + (bestMDD ? bestMDD.n : '-') + '</b>'
        + (bestMDD ? ' / ' + (bestMDD.mdd*100).toFixed(2) + '%' : '')
        + '<br>注意：T 為每個歷史月份的固定月末交易日；Skip Month 勾選才會使用前一個 rebalance period 訊號。</div>'
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
      SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
      hideL();
    }
  }, 80);
}

async function runWFNCompare() {
  if(!(await ensureDataReadyForAnalysis('WF N compare'))) return;
  SKIP_MO=!!($('btSkipMo')&&$('btSkipMo').checked);
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
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
  var signalN = Math.max(0, Math.min(22, parseInt($('btSignalTN') ? $('btSignalTN').value : '10') || 0));
  var wfOpts={signalN:signalN, tnExecMode:getTNExecMode()};
  var origS=$('btS')?$('btS').value:'';
  var origE=$('btE')?$('btE').value:'';
  var origH=$('btH')?$('btH').value:'5';
  var origPool=document.getElementById('poolMode')?document.getElementById('poolMode').value:'large';
  if(document.getElementById('poolMode')) document.getElementById('poolMode').value='large';

  function restoreAll(){
    if(document.getElementById('poolMode')) document.getElementById('poolMode').value=origPool;
    if($('btH')) $('btH').value=origH;
    wfRestoreDates(origS,origE);
    togglePoolUI();
  }
  sl('stressLog','Running WF N=2~15 comparison T-'+signalN+'...',null); showL('WF N Compare T-'+signalN+'...');
  setTimeout(async function(){
    try {
      if(CACHE_SKIP_MO!==SKIP_MO){ await buildCache(); }
      var scanN=[2,3,4,5,6,7,8,9,10,11,12,13,14,15];
      var allResults=[];
      for(var ni=0;ni<scanN.length;ni++){
        var N=scanN[ni];
        if($('btH'))$('btH').value=N;
        var oosMonths=[], ratios=[], isCagrs=[];
        for(var ty=firstTestYear;ty+testWY-1<=lastYear;ty+=testWY){
          var isStart=firstYear+'-01', isEnd=(ty-1)+'-12';
          var tStart=ty+'-01',tEnd=(ty+testWY-1)+'-12';
          var isRecs=wfWithDateRange(isStart,isEnd,wfOpts);
          var recs=wfWithDateRange(tStart,tEnd,wfOpts);
          if(!isRecs||!recs||isRecs.length<2||recs.length<2)continue;
          var isK=wfKpiFromRecords(isRecs), oosK=wfKpiFromRecords(recs);
          if(isK){ isCagrs.push(isK.cagr); }
          var ratio=(isK&&oosK)?wfSafeRatio(oosK.cagr,isK.cagr):null;
          if(ratio!==null&&isFinite(ratio)) ratios.push(ratio);
          wfPushWindowReturns(oosMonths,recs,tStart,tEnd);
        }
        wfRestoreDates(origS,origE);
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
      sl('stressLog','WF N Compare done: N=2~15, T-'+signalN,true);
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
async function runPoolCompare() {
  if(!(await ensureDataReadyForAnalysis('pool compare'))) return;
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
      var annualPeriods=(typeof getAnnualPeriods==='function')?getAnnualPeriods():12; var sYrs=oosMonths.length/annualPeriods, sCagr=sYrs>0?Math.pow(sNav/init,1/sYrs)-1:0;
      var sAvg=oosMonths.reduce(function(a,b){return a+b;},0)/oosMonths.length;
      var sStd=sampleStdAnnualized(oosMonths);
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
  
  // AUDIT: random baseline cost asymmetry
  auditRandomBaseline(gv('btC') || 0.3, 0);
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
          
          var yrs = periodsToYears(numMonths);
          var cagr = yrs > 0 ? Math.pow(nav / init, 1 / yrs) - 1 : 0;
          var std = sampleStdAnnualized(simRets);
          var sharpe = calcStandardSharpeFromReturns(simRets, getAnnualPeriods());
          
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
  var origYrs = periodsToYears(orig.records.length);
  var origCagr = Math.pow(origLast.nav / orig.initial, 1 / origYrs) - 1;
  var origRets = orig.records.map(function(r) { return r.pRet; });
  var origAvg = origRets.reduce(function(a, b) { return a + b; }, 0) / origRets.length;
  var origStd = sampleStdAnnualized(origRets);
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
async function runCostSensitivity() {
  if(!(await ensureDataReadyForAnalysis('cost sensitivity'))) return;
  var costs = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0];
  var mh = parseInt(document.getElementById('btH') ? document.getElementById('btH').value : '5') || 5;
  var mode = getWeightMode();
  var init = gv('btCap') || 100000;
  var origCost = document.getElementById('btC') ? document.getElementById('btC').value : '0.3';
  
  sl('stressLog', 'Running Cost Sensitivity...', null); 
  showL('Cost Sensitivity...');
  
  setTimeout(function() {
    try {
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

// ==========================================
// Factor Monotonicity Check
// ==========================================
async function runFactorMonotonicity() {
  if (!(await ensureDataReadyForAnalysis('factor monotonicity'))) return;
  showL('Factor Monotonicity...');
  sl('stressLog', 'Running factor monotonicity check...', null);
  setTimeout(function() {
    try {
      var stocks = getEnabledStocks().filter(function(s) {
        return DAILY[s.c] && DAILY[s.c].length > 240;
      });
      var masterTicker = DAILY['^TWII'] ? '^TWII' :
        (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : stocks[0].c));
      var refDaily = DAILY[masterTicker];
      var freq = getFreq();
      var allM = getPreciseRebalanceDates(refDaily, freq);
      var factors = ['rm', 'rb', 'rs', 'rv', 'rk'];
      var factorNames = ['Momentum', 'Bias', 'Slope', 'Vol', 'Kbar'];
      var results = {};
      factors.forEach(function(f) { results[f] = { spreads: [], hits: 0, total: 0 }; });
      var monoSignalN = Math.max(0, Math.min(22, parseInt(document.getElementById('btSignalTN') ? document.getElementById('btSignalTN').value : '4', 10) || 4));
      var monoExecMode = getTNExecMode();
      for (var idx = 2; idx < allM.length - 1; idx++) {
        var scoreDate = getFixedTNDate(refDaily, allM[idx - 1], monoSignalN);
        var holdStart = getTNExecutionDate(refDaily, allM[idx - 1], monoSignalN, monoExecMode);
        var holdEnd = getTNExecutionDate(refDaily, allM[idx], monoSignalN, monoExecMode);
        var scored = [];
        stocks.forEach(function(s) {
          if (!RAW_SCORES[s.c] || !RAW_SCORES[s.c][scoreDate]) return;
          var raw = RAW_SCORES[s.c][scoreDate];
          var p0 = getMarketMonthEndPrice(s.c, holdStart);
          var p1 = getMarketMonthEndPrice(s.c, holdEnd);
          if (!p0 || !p1 || p0 <= 0) return;
          scored.push({ c: s.c, raw: raw, fwdRet: p1 / p0 - 1 });
        });
        if (scored.length < 10) continue;
        var Q = Math.max(2, Math.floor(scored.length / 5));
        factors.forEach(function(f) {
          var valid = scored.filter(function(s) {
            return s.raw[f] !== null && s.raw[f] !== undefined && isFinite(s.raw[f]);
          });
          if (valid.length < 10) return;
          valid.sort(function(a, b) { return b.raw[f] - a.raw[f]; });
          var topAvg = valid.slice(0, Q).reduce(function(s, x) { return s + x.fwdRet; }, 0) / Q;
          var botAvg = valid.slice(-Q).reduce(function(s, x) { return s + x.fwdRet; }, 0) / Q;
          var spread = topAvg - botAvg;
          results[f].spreads.push(spread);
          results[f].total++;
          if (spread > 0) results[f].hits++;
        });
      }
      var fpc = function(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; };
      var gc2 = function(v) { return v >= 0 ? 'var(--gr)' : 'var(--re)'; };
      var html = '<div class="card" style="border-top:3px solid var(--bl);margin-bottom:10px">';
      html += '<div class="ct">FACTOR MONOTONICITY CHECK</div>';
      html += '<div style="font-size:11px;color:var(--mu);margin-bottom:8px">';
      html += 'Top quintile minus bottom quintile forward return per factor per period. ';
      html += 'Hit Rate = % of periods where top > bottom. Avg Spread = mean L/S return.</div>';
      html += '<div class="tw-wrap"><table><thead><tr>';
      html += '<th>Factor</th><th>Periods</th><th>Hit Rate</th><th>Avg Spread</th>';
      html += '<th>P25</th><th>P50</th><th>P75</th><th>Verdict</th>';
      html += '</tr></thead><tbody>';
      factors.forEach(function(f, fi) {
        var r = results[f];
        if (!r.total) {
          html += '<tr><td>' + factorNames[fi] + '</td><td colspan="7" style="color:var(--mu)">no data</td></tr>';
          return;
        }
        var hitRate = r.hits / r.total;
        var sorted = r.spreads.slice().sort(function(a, b) { return a - b; });
        function ptileFM(p) {
          var i2 = (p / 100) * (sorted.length - 1);
          var lo2 = Math.floor(i2), hi2 = Math.ceil(i2);
          return sorted[lo2] + (sorted[hi2] - sorted[lo2]) * (i2 - lo2);
        }
        var avg = r.spreads.reduce(function(a, b) { return a + b; }, 0) / r.spreads.length;
        var hitColor = hitRate >= 0.55 ? 'var(--gr)' : hitRate >= 0.45 ? 'var(--ye)' : 'var(--re)';
        var avgColor = avg > 0.005 ? 'var(--gr)' : avg > -0.005 ? 'var(--ye)' : 'var(--re)';
        var verdict = (hitRate >= 0.55 && avg > 0.003) ? 'VALID' :
                      (hitRate >= 0.45) ? 'WEAK' : 'BROKEN';
        var verdictColor = verdict === 'VALID' ? 'var(--gr)' :
                           verdict === 'WEAK' ? 'var(--ye)' : 'var(--re)';
        html += '<tr><td style="font-weight:700">' + factorNames[fi] + '</td>';
        html += '<td class="mono">' + r.total + '</td>';
        html += '<td class="mono" style="color:' + hitColor + '">' + (hitRate * 100).toFixed(1) + '%</td>';
        html += '<td class="mono" style="color:' + avgColor + '">' + fpc(avg) + '</td>';
        html += '<td class="mono" style="color:' + gc2(ptileFM(25)) + '">' + fpc(ptileFM(25)) + '</td>';
        html += '<td class="mono" style="color:' + gc2(ptileFM(50)) + '">' + fpc(ptileFM(50)) + '</td>';
        html += '<td class="mono" style="color:' + gc2(ptileFM(75)) + '">' + fpc(ptileFM(75)) + '</td>';
        html += '<td style="color:' + verdictColor + ';font-weight:700">' + verdict + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="font-size:10px;color:var(--mu);margin-top:6px">';
      html += 'VALID: hit>55% & avg>0.3% | WEAK: hit 45-55% | BROKEN: hit<45% or avg<-0.5%. ';
      html += 'WEAK factors may still serve as tiebreakers at low weight (5-10%).</div></div>';
      var targetRes = document.getElementById('stressRes');
      if (targetRes) targetRes.classList.remove('hidden');
      var el = document.getElementById('stressMetrics');
      if (el) el.innerHTML = html + el.innerHTML;
      sl('stressLog', 'Factor monotonicity check done', true);
    } catch (e) {
      sl('stressLog', 'Factor mono error: ' + e.message, false);
      console.error(e);
    }
    hideL();
  }, 80);
}

// ==========================================
// WF Factor Weight Optimizer
// Grid search over weight combos in IS windows,
// score by top-N avg forward return, validate in OOS.
// Reports best IS, best OOS, and robust (median OOS) weight sets.
// ==========================================
async function runFactorWeightOptimizer() {
  if (!(await ensureDataReadyForAnalysis('factor weight optimizer'))) return;
  showL('Factor Weight Optimizer...');
  sl('stressLog', 'Running WF Factor Weight Optimizer...', null);

  await new Promise(function(r){ setTimeout(r, 50); });

  try {
    var stocks = getEnabledStocks().filter(function(s) {
      return DAILY[s.c] && DAILY[s.c].length > 240;
    });
    var masterTicker = DAILY['^TWII'] ? '^TWII' :
      (DAILY['0050'] ? '0050' : (DAILY['SPY'] ? 'SPY' : stocks[0].c));
    var refDaily = DAILY[masterTicker];
    var freq = getFreq();
    var allM = getPreciseRebalanceDates(refDaily, freq);
    if (allM.length < 60) { sl('stressLog', 'Not enough periods (<60)', false); hideL(); return; }

    var annualPeriods = getAnnualPeriods();
    var trainPeriods = annualPeriods * 3;
    var testPeriods = annualPeriods * 1;
    var holdN = parseInt($('btH') ? $('btH').value : '5') || 5;

    // Generate weight grid: steps of 10%, sum=100%, each factor 0-80%
    var grid = [];
    var step = 10;
    for (var wm = 0; wm <= 80; wm += step) {
      for (var wb = 0; wb <= 80; wb += step) {
        if (wm + wb > 100) break;
        for (var ws = 0; ws <= 80; ws += step) {
          if (wm + wb + ws > 100) break;
          for (var wv = 0; wv <= 80; wv += step) {
            if (wm + wb + ws + wv > 100) break;
            var wk = 100 - wm - wb - ws - wv;
            if (wk < 0 || wk > 80) continue;
            grid.push([wm, wb, ws, wv, wk]);
          }
        }
      }
    }
    if (!grid.length) { sl('stressLog', 'Grid generation failed', false); hideL(); return; }
    console.log('[WF-OPT] Grid size: ' + grid.length + ' combos');

    // For each period, pre-compute per-stock raw factor values and forward returns
    // Use signalN from UI so optimizer trains on same timing as the live strategy.
    var wfOptSignalEl = document.getElementById('btSignalTN');
    var wfOptSignalN = Math.max(0, Math.min(22, parseInt(wfOptSignalEl ? wfOptSignalEl.value : '4', 10) || 4));
    var wfOptExecMode = getTNExecMode();
    var periodData = [];
    for (var idx = 2; idx < allM.length - 1; idx++) {
      var scoreDate = getFixedTNDate(refDaily, allM[idx - 1], wfOptSignalN);
      var holdStart = wfOptSignalN > 0
        ? getTNExecutionDate(refDaily, allM[idx - 1], wfOptSignalN, wfOptExecMode)
        : allM[idx - 1];
      var holdEnd = wfOptSignalN > 0
        ? getTNExecutionDate(refDaily, allM[idx], wfOptSignalN, wfOptExecMode)
        : allM[idx];
      var pStocks = [];
      stocks.forEach(function(s) {
        if (!RAW_SCORES[s.c] || !RAW_SCORES[s.c][scoreDate]) return;
        var raw = RAW_SCORES[s.c][scoreDate];
        if (raw.rm === null || raw.r240 === null) return;
        var p0 = getMarketMonthEndPrice(s.c, holdStart);
        var p1 = getMarketMonthEndPrice(s.c, holdEnd);
        if (!p0 || !p1 || p0 <= 0) return;
        pStocks.push({
          c: s.c,
          rm: raw.rm, rb: raw.rb, rs: raw.rs, rv: raw.rv, rk: raw.rk,
          r240: raw.r240, fwdRet: p1 / p0 - 1
        });
      });
      periodData.push({ idx: idx, scoreDate: scoreDate, stocks: pStocks });
    }

    // Score function: given weights and period data, return avg return of top-N
    function scoreWeights(w, periods, topN) {
      if (!w || !periods || !periods.length) return -999;
      var totalRet = 0, cnt = 0;
      for (var pi = 0; pi < periods.length; pi++) {
        var pd = periods[pi];
        if (!pd || !pd.stocks || pd.stocks.length < topN * 2) continue;

        // Cross-sectional z-score for this period
        var rms = [], rbs = [], rss = [], rvs = [], rks = [];
        var validStocks = [];
        for (var si2 = 0; si2 < pd.stocks.length; si2++) {
          var st = pd.stocks[si2];
          if (st.rm === null || st.rb === null || st.rs === null || st.rv === null || st.rk === null) continue;
          if (!isFinite(st.rm) || !isFinite(st.rb) || !isFinite(st.rs) || !isFinite(st.rv) || !isFinite(st.rk)) continue;
          rms.push(st.rm); rbs.push(st.rb); rss.push(st.rs); rvs.push(st.rv); rks.push(st.rk);
          validStocks.push(st);
        }
        if (validStocks.length < topN * 2) continue;

        var zCap = 3;
        var zms = crossZ(rms, zCap), zbs = crossZ(rbs, zCap), zss = crossZ(rss, zCap);
        var zvs = crossZ(rvs, zCap), zks = crossZ(rks, zCap);
        if (!zms || !zbs || !zss || !zvs || !zks) continue;
        if (zms.length !== validStocks.length) continue;

        var scored = [];
        for (var si3 = 0; si3 < validStocks.length; si3++) {
          var zm = zms[si3], zb = zbs[si3], zs2 = zss[si3], zv = zvs[si3], zk = zks[si3];
          if (zm === null || zb === null || zs2 === null || zv === null || zk === null) continue;
          scored.push({
            composite: w[0] * zm + w[1] * zb + w[2] * zs2 + w[3] * zv + w[4] * zk,
            fwdRet: validStocks[si3].fwdRet
          });
        }
        if (scored.length < topN) continue;
        scored.sort(function(a, b) { return b.composite - a.composite; });
        var topSlice = scored.slice(0, topN);
        var avgRet = topSlice.reduce(function(s, x) { return s + x.fwdRet; }, 0) / topSlice.length;
        totalRet += avgRet;
        cnt++;
      }
      return cnt > 0 ? totalRet / cnt : -999;
    }

    // Walk-Forward folds
    var folds = [];
    var startIdx = 0;
    while (startIdx + trainPeriods + testPeriods <= periodData.length) {
      var trainSlice = periodData.slice(startIdx, startIdx + trainPeriods);
      var testSlice = periodData.slice(startIdx + trainPeriods, startIdx + trainPeriods + testPeriods);
      folds.push({ train: trainSlice, test: testSlice, startIdx: startIdx });
      startIdx += testPeriods;
    }

    if (folds.length < 2) {
      sl('stressLog', 'Not enough data for WF folds (need 3Y train + 1Y test x2)', false);
      hideL(); return;
    }

    // Run grid search per fold
    var foldResults = [];
    var wLabels = ['Mom', 'Bias', 'Slope', 'Vol', 'Kbar'];

    for (var fi = 0; fi < folds.length; fi++) {
      $('loadTxt').textContent = 'WF Fold ' + (fi + 1) + '/' + folds.length + ' (' + grid.length + ' combos)...';
      await new Promise(function(r){ setTimeout(r, 0); });

      var fold = folds[fi];
      var bestISScore = -999, bestISWeights = null;

      // Normalize weights to fractions for scoring
      for (var gi = 0; gi < grid.length; gi++) {
        var gw = grid[gi].map(function(v) { return v / 100; });
        var isScore = scoreWeights(gw, fold.train, holdN);
        if (isScore > bestISScore) {
          bestISScore = isScore;
          bestISWeights = gw;
        }
      }

      var oosScore = scoreWeights(bestISWeights, fold.test, holdN);
      if (!bestISWeights) {
        bestISWeights = [0.2, 0.2, 0.2, 0.2, 0.2];
        bestISScore = -999;
        oosScore = -999;
      }

      // Also score the current UI weights for comparison
      var curW = [gv('wMom')/100, gv('wBias')/100, gv('wSlope')/100, gv('wVol')/100, gv('wKbar')/100];
      var curWSum = curW.reduce(function(a,b){return a+b;},0) || 1;
      curW = curW.map(function(v){return v/curWSum;});
      var curIS = scoreWeights(curW, fold.train, holdN);
      var curOOS = scoreWeights(curW, fold.test, holdN);

      foldResults.push({
        fold: fi + 1,
        bestW: bestISWeights,
        isScore: bestISScore,
        oosScore: oosScore,
        curW: curW,
        curIS: curIS,
        curOOS: curOOS,
        trainRange: fold.train[0].scoreDate + ' ~ ' + fold.train[fold.train.length-1].scoreDate,
        testRange: fold.test[0].scoreDate + ' ~ ' + fold.test[fold.test.length-1].scoreDate
      });
    }

    // Aggregate: find weight set with best median OOS across folds
    // Also tally frequency of each weight appearing as best
    var weightFreq = {};
    foldResults.forEach(function(fr) {
      var key = fr.bestW.map(function(v){ return Math.round(v*100); }).join('/');
      weightFreq[key] = (weightFreq[key] || 0) + 1;
    });
    var sortedFreq = Object.keys(weightFreq).sort(function(a,b){ return weightFreq[b]-weightFreq[a]; });

    // Average of best OOS weights (robust estimate)
    var avgW = [0,0,0,0,0];
    foldResults.forEach(function(fr) {
      for (var j=0; j<5; j++) avgW[j] += fr.bestW[j];
    });
    avgW = avgW.map(function(v){ return v / foldResults.length; });
    // Normalize
    var avgSum = avgW.reduce(function(a,b){return a+b;},0) || 1;
    avgW = avgW.map(function(v){ return v / avgSum; });

    // Score avgW on all folds OOS
    var avgOOSScores = foldResults.map(function(fr) {
      return scoreWeights(avgW, fr.test, holdN);
    });
    var avgOOSMedian = avgOOSScores.slice().sort(function(a,b){return a-b;})[Math.floor(avgOOSScores.length/2)];

    // Render results
    var fp3 = function(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(3) + '%'; };
    var gc3 = function(v) { return v >= 0 ? 'var(--gr)' : 'var(--re)'; };
    var wStr = function(w) {
      return w.map(function(v,i){ return wLabels[i] + '=' + Math.round(v*100); }).join(' / ');
    };

    var html = '<div class="card" style="border-top:3px solid var(--tw);margin-bottom:10px">';
    html += '<div class="ct">WF FACTOR WEIGHT OPTIMIZER (N=' + holdN + ', ' + folds.length + ' folds, ' + grid.length + ' combos)</div>';

    // Summary box
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
    // Robust recommendation
    html += '<div class="card" style="border-top:2px solid var(--tw);padding:9px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">ROBUST WEIGHTS (avg of IS-best)</div>';
    html += '<div class="mono" style="font-size:13px;color:var(--tw);margin-bottom:4px">' + wStr(avgW) + '</div>';
    html += '<div style="font-size:10px;color:var(--mu)">Median OOS: <span class="mono" style="color:' + gc3(avgOOSMedian) + '">' + fp3(avgOOSMedian) + '</span> /period</div>';
    html += '</div>';
    // Current weights
    var curOOSAll = foldResults.map(function(fr){ return fr.curOOS; });
    var curOOSMed = curOOSAll.slice().sort(function(a,b){return a-b;})[Math.floor(curOOSAll.length/2)];
    html += '<div class="card" style="border-top:2px solid var(--ye);padding:9px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--mu);margin-bottom:4px">CURRENT WEIGHTS (from UI)</div>';
    html += '<div class="mono" style="font-size:13px;color:var(--ye);margin-bottom:4px">' + wStr(foldResults[0].curW) + '</div>';
    html += '<div style="font-size:10px;color:var(--mu)">Median OOS: <span class="mono" style="color:' + gc3(curOOSMed) + '">' + fp3(curOOSMed) + '</span> /period</div>';
    html += '</div></div>';

    // Improvement indicator
    var improvement = avgOOSMedian - curOOSMed;
    var impColor = improvement > 0.001 ? 'var(--gr)' : improvement > -0.001 ? 'var(--ye)' : 'var(--re)';
    html += '<div style="background:var(--sf2);border:1px solid var(--bd);padding:8px;font-size:12px;margin-bottom:10px">';
    html += 'OOS Improvement: <b class="mono" style="color:' + impColor + '">' + fp3(improvement) + '</b> /period | ';
    if (improvement > 0.001) {
      html += '<span style="color:var(--gr)">Robust weights outperform current in OOS. Consider adopting.</span>';
    } else if (improvement > -0.001) {
      html += '<span style="color:var(--ye)">Difference is negligible. Current weights are adequate.</span>';
    } else {
      html += '<span style="color:var(--re)">Current weights actually perform better OOS. Grid optimum is likely overfitting IS.</span>';
    }
    html += '</div>';

    // Most frequent IS-best weight sets
    html += '<div style="font-size:11px;color:var(--mu);margin-bottom:6px">Most frequent IS-best weight sets across folds:</div>';
    html += '<div class="tw-wrap" style="margin-bottom:10px"><table><thead><tr>';
    html += '<th>Weights (M/B/S/V/K)</th><th>Frequency</th><th>% of folds</th></tr></thead><tbody>';
    sortedFreq.slice(0, 8).forEach(function(key) {
      var pct = (weightFreq[key] / foldResults.length * 100).toFixed(0);
      html += '<tr><td class="mono" style="color:var(--tw)">' + key + '</td>';
      html += '<td class="mono">' + weightFreq[key] + '/' + foldResults.length + '</td>';
      html += '<td class="mono">' + pct + '%</td></tr>';
    });
    html += '</tbody></table></div>';

    // Per-fold detail
    html += '<div class="tw-wrap"><table><thead><tr>';
    html += '<th>Fold</th><th>Train</th><th>Test</th>';
    html += '<th>IS-Best Weights</th><th>IS Avg Ret</th><th>OOS Avg Ret</th>';
    html += '<th>OOS/IS</th><th>Cur OOS</th></tr></thead><tbody>';
    foldResults.forEach(function(fr) {
      var ratio = fr.isScore > 0 ? fr.oosScore / fr.isScore : null;
      var ratioColor = ratio === null ? 'var(--mu)' : (ratio >= 0.6 ? 'var(--gr)' : ratio >= 0.3 ? 'var(--ye)' : 'var(--re)');
      var ratioText = ratio === null ? '--' : (ratio * 100).toFixed(0) + '%';
      html += '<tr>';
      html += '<td class="mono">#' + fr.fold + '</td>';
      html += '<td style="font-size:10px">' + fr.trainRange + '</td>';
      html += '<td style="font-size:10px">' + fr.testRange + '</td>';
      html += '<td class="mono" style="font-size:10px;color:var(--tw)">' + fr.bestW.map(function(v){return Math.round(v*100);}).join('/') + '</td>';
      html += '<td class="mono" style="color:' + gc3(fr.isScore) + '">' + fp3(fr.isScore) + '</td>';
      html += '<td class="mono" style="color:' + gc3(fr.oosScore) + '">' + fp3(fr.oosScore) + '</td>';
      html += '<td class="mono" style="color:' + ratioColor + '">' + ratioText + '</td>';
      html += '<td class="mono" style="color:' + gc3(fr.curOOS) + '">' + fp3(fr.curOOS) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<div style="font-size:10px;color:var(--mu);margin-top:8px">';
    html += 'Method: 3Y rolling IS / 1Y OOS. Grid = 5-factor weights in 10% steps (0-60% each, sum=100%). ';
    html += 'Scoring = avg forward return of top-' + holdN + ' stocks per period. ';
    html += 'Robust = average of per-fold IS-best weights. ';
    html += 'If OOS/IS < 30% consistently, the factor model may be unstable.</div>';

    // Apply button
    html += '<div style="margin-top:10px"><button class="bo" style="color:var(--tw);border-color:var(--tw)" ';
    html += 'onclick="applyRobustWeights([' + avgW.map(function(v){return Math.round(v*100);}).join(',') + '])">';
    html += 'Apply Robust Weights: ' + avgW.map(function(v,i){return wLabels[i]+'='+Math.round(v*100);}).join(' / ');
    html += '</button></div>';

    html += '</div>';

    var targetRes = document.getElementById('stressRes');
    if (targetRes) targetRes.classList.remove('hidden');
    var el2 = document.getElementById('stressMetrics');
    if (el2) el2.innerHTML = html + el2.innerHTML;

    sl('stressLog', 'WF Factor Weight Optimizer done (' + folds.length + ' folds, ' + grid.length + ' combos)', true);
  } catch (e) {
    sl('stressLog', 'WF Weight Optimizer error: ' + e.message, false);
    console.error(e);
  }
  hideL();
}

function applyRobustWeights(arr) {
  if (!arr || arr.length !== 5) return;
  var ids = ['wMom', 'wBias', 'wSlope', 'wVol', 'wKbar'];
  for (var i = 0; i < 5; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.value = arr[i];
  }
  invalidateScoreCache();
  alert('Weights applied: ' + ids.map(function(id,i){return id+'='+arr[i];}).join(', ') + '. Cache invalidated - rebuild on next run.');
}


async function runMomentumPlateauScan(){
  var panel=$('momPlateauPanel');
  if(panel) panel.innerHTML='Momentum Plateau 掃描中...';
  if(!(await ensureDataReadyForAnalysis('backtest'))) return;
  var oldMode=getMomentumFreqMode();
  var oldBase=getMomentumBaseWindow();
  var mode=getMomentumFreqMode();
  var start=parseInt($('momScanStart')?$('momScanStart').value:'',10)||((mode==='W')?4:20);
  var end=parseInt($('momScanEnd')?$('momScanEnd').value:'',10)||((mode==='W')?52:120);
  var step=parseInt($('momScanStep')?$('momScanStep').value:'',10)||((mode==='W')?4:10);
  if(end<start){ var t=start; start=end; end=t; }
  var rows=[];
  try{
    for(var n=start; n<=end; n+=step){
      setMomentumConfig(mode,n,true);
      await buildCache(true);
      var res=runBTcore(parseInt($('btH')?$('btH').value:'5')||5, 'plateau', {momentumScan:true});
      if(!res || !res.records || !res.records.length){ rows.push({n:n, fail:true}); continue; }
      var kp=kpi(res.records, gv('btCap')||100000);
      var avgTurn=res.records.reduce(function(a,r){return a+(r.turnover||0);},0)/res.records.length;
      rows.push({n:n, cagr:kp.cagr, sharpe:kp.sharpe, mdd:kp.mdd, mar:(kp.mdd?kp.cagr/Math.abs(kp.mdd):0), turnover:avgTurn, nav:kp.nav, months:res.records.length});
      if(panel) panel.innerHTML='Momentum Plateau 掃描中... N='+n;
      await new Promise(function(r){setTimeout(r,0);});
    }
  } finally {
    setMomentumConfig(oldMode,oldBase,true);
    await buildCache(true);
  }
  var valid=rows.filter(function(r){return !r.fail;});
  var bestSharpe=valid.reduce(function(m,r){return Math.max(m,r.sharpe);},-999);
  valid.forEach(function(r,i){
    var neigh=valid.filter(function(x){return Math.abs(x.n-r.n)<=step;});
    var avg=neigh.reduce(function(a,x){return a+x.sharpe;},0)/(neigh.length||1);
    var penalty=Math.abs(r.sharpe-avg)/(Math.abs(bestSharpe)||1);
    r.plateau=Math.max(0,100*(1-penalty));
  });
  var unit=(mode==='W')?'週':'日';
  var html='<div style="margin-bottom:8px">模式：<b style="color:var(--tw)">'+(mode==='W'?'週頻':'日頻')+'</b>；動能公式固定：<b style="color:var(--ac)">0.5*z12 + 0.3*z6 + 0.2*z3</b>；z12/z6/z3 = <b>4N/2N/N '+unit+'</b></div>';
  html+='<div class="tw-wrap" style="max-height:520px;margin-bottom:0"><table><thead><tr><th>N(z3)</th><th>z12/z6/z3</th><th>CAGR</th><th>Sharpe</th><th>MDD</th><th>MAR</th><th>Avg Turnover</th><th>Plateau</th><th>Periods</th></tr></thead><tbody>';
  rows.forEach(function(r){
    if(r.fail){ html+='<tr><td class="mono">'+r.n+'</td><td colspan="8" style="color:var(--re)">無足夠資料或回測失敗</td></tr>'; return; }
    html+='<tr>'
      +'<td class="mono" style="color:var(--wh);font-weight:700">'+r.n+'</td>'
      +'<td class="mono">'+(4*r.n)+'/'+(2*r.n)+'/'+r.n+' '+unit+'</td>'
      +'<td class="mono" style="color:'+(r.cagr>=0?'var(--gr)':'var(--re)')+'">'+(r.cagr*100).toFixed(2)+'%</td>'
      +'<td class="mono">'+r.sharpe.toFixed(2)+'</td>'
      +'<td class="mono" style="color:var(--re)">'+(r.mdd*100).toFixed(2)+'%</td>'
      +'<td class="mono">'+r.mar.toFixed(2)+'</td>'
      +'<td class="mono">'+(r.turnover*100).toFixed(1)+'%</td>'
      +'<td class="mono" style="color:'+(r.plateau>=85?'var(--gr)':r.plateau>=70?'var(--ye)':'var(--mu)')+'">'+r.plateau.toFixed(0)+'</td>'
      +'<td class="mono">'+r.months+'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div>';
  if(panel) panel.innerHTML=html;
}

window.onload = async function() {
  renderPool();
  initGroupToggles();
  togglePoolUI();

  // 啟動時先清空記憶體，再依「永久儲存」設定只載入價格資料。
  // 不自動 buildCache，避免一開頁就卡住；回測/信號/壓力測試會透過 ensureDataReadyForAnalysis() 自動建快取。
  DAILY = {};
  RAW_SCORES = {};
  CACHE_BUILT = false;
  CACHE_TS = null;
  CACHE_SIG = null;
  CACHE_SKIP_MO = false;

  if (isPersist()) {
    var loaded = await loadFromDB();
    if (loaded) {
      CACHE_BUILT = false;
      RAW_SCORES = {};
      CACHE_TS = null;
      CACHE_SKIP_MO = false;
      if ($('cacheTxt')) $('cacheTxt').textContent = 'Cache: data loaded; build on demand';
      sl('dlLog', '已從 IndexedDB 載入價格資料；回測時會自動建立快取，不會重新抓 Yahoo。', true);
    } else {
      sl('dlLog', '沒有本地資料庫。請先抓取或上傳資料。', null);
    }
  } else {
    sl('dlLog', '永久儲存關閉：本次只使用記憶體資料。', null);
  }

  updFetchStat();
  updTNX();
  updFredStats();
  renderStressDash();
  console.log('[INIT] data layer ready: DB loaded if persistToggle enabled; cache builds on demand.');
};



// ==========================================
// Factor Contribution Health Monitor v1
// - uses the same runBTcore tradeStart/tradeEnd as the live strategy
// - supports T-N signal and T / T-(N-1) execution mode
// ==========================================
function fhFmtPct(v){ return (v===null||v===undefined||!isFinite(v))?'--':((v>=0?'+':'')+(v*100).toFixed(2)+'%'); }
function fhFmtNum(v,d){ return (v===null||v===undefined||!isFinite(v))?'--':Number(v).toFixed(d==null?3:d); }
function fhAvg(arr){ arr=(arr||[]).filter(function(x){return x!==null&&x!==undefined&&isFinite(x);}); return arr.length?arr.reduce(function(a,b){return a+b;},0)/arr.length:null; }
function fhStd(arr){ arr=(arr||[]).filter(function(x){return x!==null&&x!==undefined&&isFinite(x);}); if(arr.length<2)return null; var m=fhAvg(arr); return Math.sqrt(arr.reduce(function(a,b){return a+(b-m)*(b-m);},0)/(arr.length-1)); }
function fhColor(v){ return (v===null||v===undefined||!isFinite(v))?'var(--mu)':(v>=0?'var(--gr)':'var(--re)'); }
function factorContributionValue(sc, key){
  var weights = {mom:gv('wMom')/100, bias:gv('wBias')/100, slope:gv('wSlope')/100, vol:gv('wVol')/100, kbar:gv('wKbar')/100};
  if(key==='mom') return (sc.zm||0)*weights.mom;
  if(key==='bias') return (sc.zb||0)*weights.bias;
  if(key==='slope') return (sc.zs||0)*weights.slope;
  if(key==='vol') return (sc.zv||0)*weights.vol;
  if(key==='kbar') return (sc.zk||0)*weights.kbar;
  return sc.score||0;
}
function calcFactorHealthFromRecords(records){
  var factors=[['mom','Momentum'],['bias','Bias'],['slope','Slope'],['vol','Volatility'],['kbar','K-Bar'],['score','Total Score']];
  var months=[];
  (records||[]).forEach(function(r){
    if(!r.allScores || r.allScores.length<10) return;
    var tradeStart=r.tradeStart || (r.period?String(r.period).split(' ~ ')[0]:null) || r.month;
    var tradeEnd=r.tradeEnd || (r.period?String(r.period).split(' ~ ')[1]:null) || r.month;
    var pairs=[];
    r.allScores.forEach(function(sc){
      var p0=getMarketMonthEndPoint(sc.c,tradeStart), p1=getMarketMonthEndPoint(sc.c,tradeEnd);
      if(!p0||!p1||!p0.price||p0.price<=0) return;
      var ret=p1.price/p0.price-1;
      if(!isFinite(ret)||Math.abs(ret)>2) return;
      pairs.push({sc:sc,ret:ret});
    });
    if(pairs.length<10) return;
    var row={month:r.month,scoreDate:r.scoringM||r.month,tradeStart:tradeStart,tradeEnd:tradeEnd,n:pairs.length,factors:{}};
    factors.forEach(function(f){
      var key=f[0];
      var xs=pairs.map(function(p){return key==='score'?(p.sc.score||0):factorContributionValue(p.sc,key);});
      var ys=pairs.map(function(p){return p.ret;});
      var icRes=xs.length>=10?spearmanCorr(xs,ys):{ic:null,t:null,p:null};
      var paired=xs.map(function(x,i){return{x:x,ret:ys[i]};}).sort(function(a,b){return b.x-a.x;});
      var n=Math.max(1,Math.floor(paired.length*0.2));
      var top=paired.slice(0,n), bot=paired.slice(paired.length-n);
      row.factors[key]={ic:icRes.ic,t:icRes.t,p:icRes.p,n:paired.length,avgContrib:fhAvg(xs),topRet:fhAvg(top.map(function(x){return x.ret;})),botRet:fhAvg(bot.map(function(x){return x.ret;})),spread:(fhAvg(top.map(function(x){return x.ret;}))-fhAvg(bot.map(function(x){return x.ret;})))};
    });
    months.push(row);
  });
  return {months:months,factors:factors};
}

// === INCREMENTAL Factor Health for backtest performance ===
// Instead of recalculating all records every period, compute IC for one new record
// and append to existing fh.months. O(stocks*factors) per period instead of O(periods*stocks*factors).
function calcFactorHealthSingleRow(record) {
  var factors = [['mom','Momentum'],['bias','Bias'],['slope','Slope'],['vol','Volatility'],['kbar','K-Bar'],['score','Total Score']];
  var r = record;
  if (!r || !r.allScores || r.allScores.length < 10) return null;
  var tradeStart = r.tradeStart || (r.period ? String(r.period).split(' ~ ')[0] : null) || r.month;
  var tradeEnd = r.tradeEnd || (r.period ? String(r.period).split(' ~ ')[1] : null) || r.month;
  var pairs = [];
  r.allScores.forEach(function(sc) {
    var p0 = getMarketMonthEndPoint(sc.c, tradeStart), p1 = getMarketMonthEndPoint(sc.c, tradeEnd);
    if (!p0 || !p1 || !p0.price || p0.price <= 0) return;
    var ret = p1.price / p0.price - 1;
    if (!isFinite(ret) || Math.abs(ret) > 2) return;
    pairs.push({sc: sc, ret: ret});
  });
  if (pairs.length < 10) return null;
  var row = {month: r.month, scoreDate: r.scoringM || r.month, tradeStart: tradeStart, tradeEnd: tradeEnd, n: pairs.length, factors: {}};
  factors.forEach(function(f) {
    var key = f[0];
    var xs = pairs.map(function(p) { return key === 'score' ? (p.sc.score || 0) : factorContributionValue(p.sc, key); });
    var ys = pairs.map(function(p) { return p.ret; });
    var icRes = xs.length >= 10 ? spearmanCorr(xs, ys) : {ic: null, t: null, p: null};
    var paired = xs.map(function(x, i) { return {x: x, ret: ys[i]}; }).sort(function(a, b) { return b.x - a.x; });
    var nn = Math.max(1, Math.floor(paired.length * 0.2));
    var top = paired.slice(0, nn), bot = paired.slice(paired.length - nn);
    row.factors[key] = {ic: icRes.ic, t: icRes.t, p: icRes.p, n: paired.length, avgContrib: fhAvg(xs), topRet: fhAvg(top.map(function(x) { return x.ret; })), botRet: fhAvg(bot.map(function(x) { return x.ret; })), spread: (fhAvg(top.map(function(x) { return x.ret; })) - fhAvg(bot.map(function(x) { return x.ret; })))};
  });
  return row;
}

// === 3D Signal Light System ===
// Dimensions: Level (IC value) + Slope (direction) + Streak (persistence)
// Returns: { level, slope, streak, regime, label, color, exposure, reasons, details }
function calc3DSignalLight(fhMonths, shortN, longN) {
  shortN = shortN || 6;
  longN = longN || 36;
  var minPeriods = Math.max(8, shortN + 2);
  if (!fhMonths || fhMonths.length < minPeriods) {
    return {regime: 'GREEN', label: 'DATA_INSUFFICIENT', color: 'var(--gr)',
      exposure: 1.0, score: 0, reasons: ['歷史樣本不足，暫用綠燈100%曝險'],
      details: {momIC: null, volIC: null, totalIC: null, momSlope: null, volSlope: null, momStreak: {count:0,dir:0}, volStreak: {count:0,dir:0}, matrixCell:'DATA'}};
  }

  function getICSeries(key, n) {
    var rows = fhMonths.filter(function(m) { return m.factors && m.factors[key] && m.factors[key].ic !== null && isFinite(m.factors[key].ic); });
    return rows.slice(-n).map(function(m) { return m.factors[key].ic; });
  }
  function getSpreadSeries(key, n) {
    var rows = fhMonths.filter(function(m) { return m.factors && m.factors[key] && m.factors[key].spread !== null && isFinite(m.factors[key].spread); });
    return rows.slice(-n).map(function(m) { return m.factors[key].spread; });
  }
  function calcSlope(arr) {
    if (!arr || arr.length < 3) return 0;
    var recent = arr.slice(-3);
    return (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  }
  function calcStreak(arr) {
    if (!arr || arr.length < 2) return {count: 0, dir: 0};
    var streak = 0, dir = 0;
    for (var i = arr.length - 1; i >= 1; i--) {
      var delta = arr[i] - arr[i - 1];
      var curDir = delta > 0.005 ? 1 : (delta < -0.005 ? -1 : 0);
      if (curDir === 0) break;
      if (dir === 0) { dir = curDir; streak = 1; }
      else if (curDir === dir) { streak++; }
      else break;
    }
    return {count: streak, dir: dir};
  }
  function dirLabel(slope, streak, strongBias) {
    var th = strongBias ? 0.015 : 0.01;
    if (slope > th || (streak && streak.dir > 0 && streak.count >= 2)) return 'UP';
    if (slope < -th || (streak && streak.dir < 0 && streak.count >= 2)) return 'DOWN';
    return 'FLAT';
  }

  var momSeries = getICSeries('mom', Math.min(longN, 36));
  var volSeries = getICSeries('vol', Math.min(longN, 36));
  var totalSeries = getICSeries('score', Math.min(longN, 36));
  var kbarSeries = getICSeries('kbar', Math.min(longN, 36));
  var spreadSeries = getSpreadSeries('score', Math.min(longN, 36));

  var momShort = getICSeries('mom', shortN), momLong = getICSeries('mom', longN);
  var volShort = getICSeries('vol', shortN), volLong = getICSeries('vol', longN);
  var totalShort = getICSeries('score', shortN), totalLong = getICSeries('score', longN);
  var kbarShort = getICSeries('kbar', shortN), kbarLong = getICSeries('kbar', longN);
  var spreadShort = getSpreadSeries('score', shortN), spreadLongArr = getSpreadSeries('score', longN);

  var momICavg = fhAvg(momShort), momIClong = fhAvg(momLong);
  var volICavg = fhAvg(volShort), volIClong = fhAvg(volLong);
  var totalICavg = fhAvg(totalShort), totalIClong = fhAvg(totalLong);
  var kbarICavg = fhAvg(kbarShort), kbarIClong = fhAvg(kbarLong);
  var spreadAvg = fhAvg(spreadShort), spreadLong = fhAvg(spreadLongArr);

  var momSlope = calcSlope(momSeries.slice(-6));
  var volSlope = calcSlope(volSeries.slice(-6));
  var totalSlope = calcSlope(totalSeries.slice(-6));
  var spreadSlope = calcSlope(spreadSeries.slice(-6));
  var kbarSlope = calcSlope(kbarSeries.slice(-6));

  var momStreak = calcStreak(momSeries.slice(-8));
  var volStreak = calcStreak(volSeries.slice(-8));
  var totalStreak = calcStreak(totalSeries.slice(-8));
  var spreadStreak = calcStreak(spreadSeries.slice(-8));
  var kbarStreak = calcStreak(kbarSeries.slice(-8));

  var momDir = dirLabel(momSlope, momStreak, true);
  var volDir = dirLabel(volSlope, volStreak, false);
  var matrixCell = momDir + '_' + volDir;

  var score = 0, reasons = [];
  var regime = 'YELLOW', label = 'NEUTRAL', color = 'var(--ye)';

  // Base matrix: Momentum direction x Volatility direction
  if (momDir === 'UP' && volDir === 'DOWN') {
    regime = 'GREEN'; label = 'STRONG_TREND'; score += 5;
    reasons.push('Mom↑ + Vol↓：強勢趨勢，追漲有效且市場穩定');
  } else if (momDir === 'UP' && volDir === 'FLAT') {
    regime = 'GREEN'; label = 'TREND_START'; score += 4;
    reasons.push('Mom↑ + Vol→：趨勢啟動或延續，排名可信');
  } else if (momDir === 'UP' && volDir === 'UP') {
    regime = 'YELLOW'; label = 'MIXED_TREND'; score += 1;
    reasons.push('Mom↑ + Vol↑：混合狀態，趨勢仍在但防禦需求升高');
  } else if (momDir === 'FLAT' && volDir === 'DOWN') {
    regime = 'GREEN'; label = 'RECOVERY'; score += 3;
    reasons.push('Mom→ + Vol↓：環境改善，風險偏好回升');
  } else if (momDir === 'FLAT' && volDir === 'FLAT') {
    regime = 'YELLOW'; label = 'NEUTRAL'; score += 0;
    reasons.push('Mom→ + Vol→：中性，需看 Total IC 水位');
  } else if (momDir === 'FLAT' && volDir === 'UP') {
    regime = 'YELLOW'; label = 'EARLY_WARNING'; score -= 2;
    reasons.push('Mom→ + Vol↑：早期預警，資金偏向防禦');
  } else if (momDir === 'DOWN' && volDir === 'DOWN') {
    regime = 'YELLOW'; label = 'CHOPPY'; score -= 1;
    reasons.push('Mom↓ + Vol↓：混沌，兩者同降，因子方向不明');
  } else if (momDir === 'DOWN' && volDir === 'FLAT') {
    regime = 'ORANGE'; label = 'MOM_DECAY'; score -= 3;
    reasons.push('Mom↓ + Vol→：動能衰退，排名信賴度下降');
  } else if (momDir === 'DOWN' && volDir === 'UP') {
    regime = 'RED'; label = 'REVERSAL_RISK'; score -= 6;
    reasons.push('Mom↓ + Vol↑：背離反轉，動能衰退且防禦偏好上升');
  }

  // Level confirmation
  if (totalICavg !== null) {
    if (totalICavg > 0.08) { score += 2; reasons.push('Total IC 水位強'); }
    else if (totalICavg > 0.04) { score += 1; reasons.push('Total IC 水位正常'); }
    else if (totalICavg < 0.02) { score -= 3; reasons.push('Total IC 偏低'); }
  }
  if (spreadAvg !== null) {
    if (spreadAvg > 0.04) { score += 2; reasons.push('Spread 極強'); }
    else if (spreadAvg > 0.02) { score += 1; reasons.push('Spread 健康'); }
    else if (spreadAvg < 0.01) { score -= 3; reasons.push('Spread 接近失效'); }
  }

  // Persistence confirmation
  if (momStreak.dir < 0 && momStreak.count >= 2) { score -= momStreak.count; reasons.push('Momentum 連續衰退 ' + momStreak.count + ' 期'); }
  if (momStreak.dir > 0 && momStreak.count >= 2) { score += Math.min(momStreak.count, 3); reasons.push('Momentum 連續轉強 ' + momStreak.count + ' 期'); }
  if (volStreak.dir > 0 && volStreak.count >= 2) { score -= Math.min(volStreak.count, 3); reasons.push('Volatility 連續抬頭 ' + volStreak.count + ' 期'); }
  if (spreadStreak.dir < 0 && spreadStreak.count >= 2) { score -= Math.min(spreadStreak.count, 3); reasons.push('Spread 連續收斂 ' + spreadStreak.count + ' 期'); }
  if (totalStreak.dir < 0 && totalStreak.count >= 3) { score -= 2; reasons.push('Total IC 連續下降 ' + totalStreak.count + ' 期'); }

  // K-Bar tiebreaker
  if (kbarICavg !== null && kbarIClong !== null) {
    if (kbarICavg > kbarIClong && kbarSlope >= -0.01) { score += 1; reasons.push('K-Bar 結構偏強'); }
    else if (kbarICavg < kbarIClong && kbarSlope < 0) { score -= 1; reasons.push('K-Bar 結構轉弱'); }
  }

  // Hard stops / overrides
  if ((totalICavg !== null && totalICavg < 0) || (totalStreak.dir < 0 && totalStreak.count >= 4)) {
    regime = 'RED'; label = 'STOP'; score = Math.min(score, -6);
    reasons.push('Total IC 失效或連續惡化，停止動量操作');
  } else if (score >= 5) {
    regime = 'GREEN'; label = (label === 'RECOVERY') ? 'RECOVERY' : 'TREND';
  } else if (score >= 1) {
    regime = 'YELLOW'; label = 'NORMAL';
  } else if (score >= -4) {
    regime = 'ORANGE'; label = 'CAUTION';
  } else {
    regime = 'RED'; label = 'STOP';
  }

  color = regime === 'GREEN' ? 'var(--gr)' : (regime === 'YELLOW' ? 'var(--ye)' : (regime === 'ORANGE' ? '#ff9f1c' : 'var(--re)'));

  return {
    regime: regime, label: label, color: color,
    score: score,
    exposure: getRiskRegimeExposureByLevel(regime),
    reasons: reasons,
    details: {
      matrixCell: matrixCell,
      momDir: momDir, volDir: volDir,
      momIC: momICavg, momIClong: momIClong,
      volIC: volICavg, volIClong: volIClong,
      totalIC: totalICavg, totalIClong: totalIClong,
      kbarIC: kbarICavg, kbarIClong: kbarIClong,
      momSlope: momSlope, volSlope: volSlope, totalSlope: totalSlope, spreadSlope: spreadSlope, kbarSlope: kbarSlope,
      momStreak: momStreak, volStreak: volStreak, totalStreak: totalStreak, spreadStreak: spreadStreak, kbarStreak: kbarStreak,
      spreadShort: spreadAvg, spreadLong: spreadLong
    }
  };
}

function fhSummarizeFactor(fh,key,shortN,longN){
  var rows=(fh.months||[]).filter(function(m){return m.factors && m.factors[key] && m.factors[key].ic!==null;});
  var longRows=rows.slice(-longN), shortRows=rows.slice(-shortN);
  function pack(rs){
    var ics=rs.map(function(r){return r.factors[key].ic;});
    var spreads=rs.map(function(r){return r.factors[key].spread;});
    var contribs=rs.map(function(r){return r.factors[key].avgContrib;});
    var icm=fhAvg(ics), sd=fhStd(ics);
    return {n:rs.length,ic:icm,icir:(sd&&sd>0&&icm!==null)?icm/sd:null,spread:fhAvg(spreads),contrib:fhAvg(contribs),pos:ics.length?ics.filter(function(x){return x>0;}).length/ics.length:null};
  }
  return {short:pack(shortRows),long:pack(longRows)};
}
function fhVerdict(summary){
  if(!summary || !summary.short || !summary.long || summary.short.ic===null || summary.long.ic===null) return '資料不足';
  if(summary.long.ic>0 && summary.short.ic < summary.long.ic*0.4) return '衰退警戒';
  if(summary.long.ic>0 && summary.short.ic > summary.long.ic*1.3) return '短期增強';
  if(summary.short.ic>0 && summary.long.ic>0) return '穩定有效';
  if(summary.short.ic<0 && summary.long.ic<0) return '反向/失效';
  return '混合';
}


// === Factor N-t Trend Curve ===
// Shows how each factor behaves across multiple recent windows instead of only Short-vs-Long.
function fhGetTrendWindows(){ return [3,6,9,12,18,24,36]; }
function fhTrendArrow(v){
  if(v===null||v===undefined||!isFinite(v)) return '→';
  if(v>0.015) return '↗';
  if(v<-0.015) return '↘';
  return '→';
}
function fhCalcTrendSlope(points){
  var xs=[], ys=[];
  (points||[]).forEach(function(p){ if(p && p.ic!==null && p.ic!==undefined && isFinite(p.ic)){ xs.push(p.win); ys.push(p.ic); } });
  if(xs.length<3) return null;
  var mx=fhAvg(xs), my=fhAvg(ys), num=0, den=0;
  for(var i=0;i<xs.length;i++){ num+=(xs[i]-mx)*(ys[i]-my); den+=(xs[i]-mx)*(xs[i]-mx); }
  return den?num/den:null;
}
function fhCalcHalfLife(points){
  points=(points||[]).filter(function(p){return p && p.ic!==null && p.ic!==undefined && isFinite(p.ic);});
  if(points.length<2) return null;
  var base=points[0].ic;
  if(!isFinite(base) || base<=0) return null;
  var threshold=base*0.5;
  for(var i=1;i<points.length;i++){
    if(points[i].ic<=threshold) return points[i].win;
  }
  return null;
}
function fhClassifyTrend(points){
  points=(points||[]).filter(function(p){return p && p.ic!==null && p.ic!==undefined && isFinite(p.ic);});
  if(points.length<3) return {label:'資料不足',color:'var(--mu)',slope:null,halfLife:null};
  var first=points[0].ic, last=points[points.length-1].ic;
  var slope=fhCalcTrendSlope(points);
  var half=fhCalcHalfLife(points);
  var peak=-999, peakIdx=-1;
  points.forEach(function(p,i){ if(p.ic>peak){peak=p.ic;peakIdx=i;} });
  var recent=points.slice(0,3).map(function(p){return p.ic;});
  var recentAvg=fhAvg(recent);
  var longAvg=fhAvg(points.slice(-3).map(function(p){return p.ic;}));
  var label='穩定', color='var(--ye)';
  if(recentAvg!==null && longAvg!==null && recentAvg>longAvg+0.05 && first>0){ label='短期加速'; color='var(--gr)'; }
  if(recentAvg!==null && longAvg!==null && recentAvg<longAvg-0.03){ label='短期轉弱'; color='var(--re)'; }
  if(peakIdx===0 && first>0 && last<first*0.5){ label='尖峰衰退'; color='var(--re)'; }
  if(first<0 && last>0){ label='近期翻正'; color='var(--gr)'; }
  if(first<0 && last<0){ label='反向失效'; color='var(--re)'; }
  return {label:label,color:color,slope:slope,halfLife:half};
}
function renderFactorTrendCurve(fh, windows){
  if(!fh || !fh.months || !fh.months.length || !fh.factors) return '';
  windows=windows||fhGetTrendWindows();
  var html='<div class="card" style="border-top:3px solid var(--ac);margin-top:10px">';
  html+='<div class="ct">Factor N-t Trend Curve <span style="font-size:9px;color:var(--mu);font-weight:400">Short windows: '+windows.join('/')+'；用來判斷加速、尖峰、衰退與反轉</span></div>';
  html+='<div class="ib2" style="margin-bottom:8px">解讀：左側短窗越強，代表近期因子有效性越集中；若 3/6 很強但 18/24/36 快速衰退，代表可能是短期尖峰，不等於長期穩定。</div>';
  html+='<div class="tw-wrap" style="max-height:none"><table><thead><tr><th>Factor</th>';
  windows.forEach(function(w){ html+='<th>W'+w+' IC / ICIR</th>'; });
  html+='<th>Trend</th><th>Slope</th><th>Half-life</th></tr></thead><tbody>';
  fh.factors.forEach(function(f){
    var key=f[0], name=f[1], pts=[];
    windows.forEach(function(w){ var sm=fhSummarizeFactor(fh,key,w,w); pts.push({win:w,ic:sm.short.ic,icir:sm.short.icir,spread:sm.short.spread}); });
    var tr=fhClassifyTrend(pts);
    html+='<tr><td style="font-weight:700;color:var(--wh)">'+name+'</td>';
    pts.forEach(function(p){
      html+='<td class="mono" style="color:'+fhColor(p.ic)+'">'+fhTrendArrow(p.ic)+' '+fhFmtNum(p.ic,3)+' / '+fhFmtNum(p.icir,2)+'</td>';
    });
    html+='<td style="font-weight:700;color:'+tr.color+'">'+tr.label+'</td>';
    html+='<td class="mono" style="color:'+fhColor(tr.slope)+'">'+fhFmtNum(tr.slope,4)+'</td>';
    html+='<td class="mono" style="color:var(--mu)">'+(tr.halfLife?('W'+tr.halfLife):'--')+'</td></tr>';
  });
  html+='</tbody></table></div></div>';
  return html;
}

function renderRiskRegimeBannerFromFH(fh, shortN, longN){
  if (!fh || !fh.months || !fh.months.length || typeof riskRegimeLevelFromHealthSummary !== 'function') return '';
  var r = riskRegimeLevelFromHealthSummary(fh, shortN || 6, longN || 36);
  var color = r.level === 'GREEN' ? 'var(--gr)' : (r.level === 'YELLOW' ? 'var(--ye)' : (r.level === 'ORANGE' ? '#ff9f1c' : 'var(--re)'));
  var labelMap = {GREEN:'TREND',YELLOW:'NORMAL',ORANGE:'CAUTION',RED:'STOP'};
  var emojiMap = {GREEN:'🟢',YELLOW:'🟡',ORANGE:'🟠',RED:'🔴'};
  var adviceMap = {
    GREEN:'信任排名；可依原策略操作。',
    YELLOW:'可操作但不宜加碼；觀察 Mom/Vol/Spread。',
    ORANGE:'降低動能依賴；提高 N、降低集中度、增加 SGOV。',
    RED:'動能排名失效風險高；顯著降低曝險或暫停動量操作。'
  };
  var d = r.details || {};
  function fmtIC(v){ return (v===null||v===undefined||!isFinite(v))?'--':v.toFixed(3); }
  function fmtPct(v){ return (v===null||v===undefined||!isFinite(v))?'--':((v>=0?'+':'')+(v*100).toFixed(2)+'%'); }
  function fmtSlope(v){ if(v===null||v===undefined||!isFinite(v)) return '--'; return (v>0.01?'↗':(v<-0.01?'↘':'→'))+' '+(v>=0?'+':'')+v.toFixed(3); }
  function fmtStreak(s){ if(!s||!s.count) return '--'; return (s.dir>0?'↑':'↓')+s.count+'期'; }
  var matrixMap = {
    UP_UP:'Mom↑ + Vol↑：混合；趨勢與防禦同時升高',
    UP_FLAT:'Mom↑ + Vol→：趨勢啟動 / 排名可信',
    UP_DOWN:'Mom↑ + Vol↓：強勢趨勢 / 全力跟單',
    FLAT_UP:'Mom→ + Vol↑：早期預警 / 縮小部位',
    FLAT_FLAT:'Mom→ + Vol→：中性 / 看 Total IC 水位',
    FLAT_DOWN:'Mom→ + Vol↓：環境改善 / 偏多操作',
    DOWN_UP:'Mom↓ + Vol↑：背離反轉 / 停止換股',
    DOWN_FLAT:'Mom↓ + Vol→：動能衰退 / 暫停操作',
    DOWN_DOWN:'Mom↓ + Vol↓：混沌 / 降低操作頻率'
  };
  var matrixText = matrixMap[d.matrixCell] || (d.matrixCell || '--');
  var html = '<div class="card" style="border-top:3px solid '+color+';margin-bottom:10px">';
  html += '<div class="ct">3D Regime Decision Matrix <span style="color:'+color+';font-size:12px">'+(emojiMap[r.level]||'')+' '+(labelMap[r.level]||r.label)+'</span></div>';
  html += '<div style="font-size:12px;color:var(--tx);line-height:1.9">';
  html += '<b>曝險率：</b><span class="mono" style="color:'+color+';font-weight:700">'+Math.round((r.exposure||1)*100)+'%</span>　';
  html += '<b>N：</b><span class="mono" style="color:'+color+';font-weight:700">'+(r.adaptiveN||'--')+'</span>' + ((r.baseN&&r.nMult)?'<span class="mono" style="color:var(--mu);font-size:10px">（base '+r.baseN+' × '+r.nMult.toFixed(2)+'）</span>':'') + '　';
  html += '<b>Freeze：</b><span class="mono" style="color:'+color+';font-weight:700">'+(r.freeze?'ON':'OFF')+'</span>　';
  html += '<b>Score：</b><span class="mono" style="color:'+color+';font-weight:700">'+r.score+'</span>　';
  html += '<b>矩陣：</b><span style="color:'+color+';font-weight:700">'+matrixText+'</span><br>';
  html += '<b>水位：</b>Mom '+fmtIC(d.momIC)+' / Vol '+fmtIC(d.volIC)+' / Total '+fmtIC(d.totalIC)+' / Spread '+fmtPct(d.spreadShort)+'<br>';
  html += '<b>斜率：</b>Mom '+fmtSlope(d.momSlope)+' / Vol '+fmtSlope(d.volSlope)+' / Total '+fmtSlope(d.totalSlope)+' / Spread '+fmtSlope(d.spreadSlope)+'<br>';
  html += '<b>持續性：</b>Mom '+fmtStreak(d.momStreak)+' / Vol '+fmtStreak(d.volStreak)+' / Total '+fmtStreak(d.totalStreak)+' / Spread '+fmtStreak(d.spreadStreak)+'<br>';
  html += '<b>原因：</b>'+(r.reasons&&r.reasons.length?r.reasons.join('、'):'資料不足')+'<br>';
  html += '<b>建議：</b>'+(adviceMap[r.level]||'觀察');
  html += '</div></div>';
  return html;
}



// === MARKET PHASE DASHBOARD ===
// Combines 3D Regime, Factor N-Trend Curve and IC Heatmap into one market-position verdict.
function calcHeatmapStructureStatsMP(fh, lookback){
  lookback = lookback || 6;
  var rows = (fh && fh.months) ? fh.months : [];
  var tail = rows.slice(-lookback);
  var out = {
    n: tail.length,
    trendCount: 0,
    divergeCount: 0,
    decayCount: 0,
    mixedCount: 0,
    flatCount: 0,
    negTotalCount: 0,
    latestTotalIC: null,
    latestMonth: tail.length ? tail[tail.length-1].month : null,
    avgAbsDispersion: null,
    avgPositiveRatio: null,
    lastTrendLabel: '--'
  };
  var dispersions = [], posRatios = [];
  function val(m,key){ return m && m.factors && m.factors[key] && m.factors[key].ic!==null && isFinite(m.factors[key].ic) ? m.factors[key].ic : null; }
  for(var i=0;i<tail.length;i++){
    var m = tail[i];
    var total = val(m,'score');
    if(total!==null && total < 0) out.negTotalCount++;
    if(total!==null) out.latestTotalIC = total;
    var vals=[];
    ['mom','bias','slope','vol','kbar','score'].forEach(function(k){ var v=val(m,k); if(v!==null) vals.push(v); });
    if(vals.length>=3){
      var avg = fhAvg(vals);
      dispersions.push(fhAvg(vals.map(function(x){return Math.abs(x-avg);}))); 
      posRatios.push(vals.filter(function(x){return x>0;}).length / vals.length);
    }
    if(rows.length >= 3){
      var rowIdx = rows.indexOf(m);
      if(rowIdx >= 2){
        var m0 = val(rows[rowIdx-2],'mom'), m1 = val(rows[rowIdx],'mom');
        var v0 = val(rows[rowIdx-2],'vol'), v1 = val(rows[rowIdx],'vol');
        if(m0!==null && m1!==null && v0!==null && v1!==null){
          var ms = (m1-m0)/2, vs = (v1-v0)/2;
          var lbl;
          if(ms > 0.01 && vs < -0.01) { lbl='TREND'; out.trendCount++; }
          else if(ms < -0.01 && vs > 0.01) { lbl='DIVERGE'; out.divergeCount++; }
          else if(ms < -0.01 && vs < -0.01) { lbl='DECAY'; out.decayCount++; }
          else if(ms > 0.01 && vs > 0.01) { lbl='MIXED'; out.mixedCount++; }
          else { lbl='FLAT'; out.flatCount++; }
          out.lastTrendLabel = lbl;
        }
      }
    }
  }
  out.avgAbsDispersion = dispersions.length ? fhAvg(dispersions) : null;
  out.avgPositiveRatio = posRatios.length ? fhAvg(posRatios) : null;
  return out;
}

function calcFactorCurveStateMP(fh, shortN, longN){
  var windows = fhGetTrendWindows();
  var state = {healthy:0, accel:0, weak:0, broken:0, mixed:0, labels:{}, score:0, kbarWeak:false, momHealthy:false, totalHealthy:false};
  if(!fh || !fh.factors) return state;
  fh.factors.forEach(function(f){
    var key=f[0], pts=[];
    windows.forEach(function(w){ var sm=fhSummarizeFactor(fh,key,w,w); pts.push({win:w,ic:sm.short.ic,icir:sm.short.icir,spread:sm.short.spread}); });
    var tr=fhClassifyTrend(pts);
    var sm=fhSummarizeFactor(fh,key,shortN||6,longN||36);
    var verdict=fhVerdict(sm);
    state.labels[key]=tr.label + ' / ' + verdict;
    if(verdict==='穩定有效' || verdict==='短期增強'){ state.healthy++; state.score += 1; }
    if(verdict==='短期增強' || tr.label==='短期加速' || tr.label==='近期翻正'){ state.accel++; state.score += 1; }
    if(verdict==='衰退警戒' || tr.label==='尖峰衰退' || tr.label==='短期轉弱'){ state.weak++; state.score -= 1; }
    if(verdict==='反向/失效' || tr.label==='反向失效'){ state.broken++; state.score -= 2; }
    if(verdict==='混合') { state.mixed++; }
    if(key==='kbar' && (verdict==='衰退警戒' || verdict==='反向/失效' || tr.label==='尖峰衰退' || tr.label==='短期轉弱')) state.kbarWeak=true;
    if(key==='mom' && (verdict==='穩定有效' || verdict==='短期增強') && sm.short.ic!==null && sm.short.ic>0.05) state.momHealthy=true;
    if(key==='score' && (verdict==='穩定有效' || verdict==='短期增強') && sm.short.ic!==null && sm.short.ic>0.04) state.totalHealthy=true;
  });
  return state;
}

function calcMarketPhaseFromFH(fh, shortN, longN){
  shortN = shortN || 6; longN = longN || 36;
  if(!fh || !fh.months || fh.months.length < Math.max(8, shortN+2)){
    return {phase:0, title:'資料不足', state:'Insufficient Data', color:'var(--mu)', exposureBand:'--', risk:'--', confidence:0, bullets:['樣本不足，先執行回測/因子健康度。'], metrics:{}};
  }
  var rr = (typeof riskRegimeLevelFromHealthSummary === 'function') ? riskRegimeLevelFromHealthSummary(fh, shortN, longN) : calc3DSignalLight(fh.months, shortN, longN);
  var level = rr.level || rr.regime || 'YELLOW';
  var d = rr.details || {};
  var curve = calcFactorCurveStateMP(fh, shortN, longN);
  var heat = calcHeatmapStructureStatsMP(fh, 6);
  var totalIC = d.totalIC;
  if(totalIC===null || totalIC===undefined || !isFinite(totalIC)) totalIC = heat.latestTotalIC;
  var spread = d.spreadShort;
  var momDir = d.momDir || '';
  var volDir = d.volDir || '';
  var divRatio = heat.n ? heat.divergeCount / heat.n : 0;
  var negRatio = heat.n ? heat.negTotalCount / heat.n : 0;
  var breadth = heat.avgPositiveRatio;
  var phase=2, title='Phase 2 初升/修復段', state='Recovery / Early Uptrend', color='var(--ye)', exposureBand='50–75%', risk='中', bullets=[];

  var isRiskOff = (level==='RED') || (level==='ORANGE' && negRatio>=0.5) || (totalIC!==null && totalIC<0 && negRatio>=0.5 && heat.divergeCount>=2);
  var isFragmented = (heat.divergeCount>=2 || divRatio>=0.34 || curve.kbarWeak || (breadth!==null && breadth<0.55)) && (level==='GREEN' || level==='YELLOW' || totalIC>0);
  var isStrongTrend = (level==='GREEN' && curve.momHealthy && curve.totalHealthy && heat.divergeCount<=1 && negRatio<=0.25 && totalIC!==null && totalIC>0.04);
  var isOverExtended = (level==='GREEN' && totalIC!==null && totalIC>0.10 && spread!==null && spread>0.04 && (volDir==='UP' || curve.weak>=2 || heat.mixedCount>=2));
  var isBottomChaos = (level==='ORANGE' || level==='RED') && totalIC!==null && totalIC<=0.02 && heat.trendCount===0 && heat.divergeCount<=1 && (breadth===null || breadth<0.5);

  if(isRiskOff){ phase=6; title='Phase 6 崩跌/去槓桿段'; state='Deleveraging / Risk-Off'; color='var(--re)'; exposureBand='0–33%'; risk='高'; }
  else if(isFragmented){ phase=5; title='Phase 5 結構分裂段'; state='Fragmented Bull / Late Cycle'; color='var(--tw)'; exposureBand='50–85%'; risk='偏高'; }
  else if(isOverExtended){ phase=4; title='Phase 4 過熱延伸段'; state='Over-extended Trend'; color='var(--ye)'; exposureBand='66–90%'; risk='中高'; }
  else if(isStrongTrend){ phase=3; title='Phase 3 主升段'; state='Broad Trend Expansion'; color='var(--gr)'; exposureBand='90–100%'; risk='中低'; }
  else if(isBottomChaos){ phase=1; title='Phase 1 底部混亂期'; state='Bottoming / Noisy Repair'; color='var(--mu)'; exposureBand='25–50%'; risk='中高'; }

  if(level==='GREEN') bullets.push('3D Matrix 仍為 GREEN：趨勢尚未破壞。');
  if(level==='YELLOW') bullets.push('3D Matrix 為 YELLOW：可操作但不宜加碼。');
  if(level==='ORANGE' || level==='RED') bullets.push('3D Matrix 進入警戒：排名有效性下降。');
  if(curve.momHealthy) bullets.push('Momentum N-Trend 仍健康，核心動能因子尚未失效。');
  if(curve.totalHealthy) bullets.push('Total Score 仍有正向 IC，主策略還有 alpha。');
  if(curve.kbarWeak) bullets.push('K-Bar 衰退，短線型態 alpha 正在轉弱。');
  if(heat.divergeCount>=2) bullets.push('近6期 Heatmap 出現 '+heat.divergeCount+' 次 DIVERGE，因子同步性下降。');
  if(heat.negTotalCount>=2) bullets.push('近6期 Total Score IC 有 '+heat.negTotalCount+' 次為負，短期失真升高。');
  if(breadth!==null && breadth<0.55) bullets.push('IC 正值廣度偏窄，市場主線集中或分裂。');
  if(!bullets.length) bullets.push('目前沒有明顯極端訊號，依既有曝險規則操作。');

  var confidence = 50;
  confidence += Math.min(20, Math.max(0, fh.months.length-12));
  if(heat.n>=6) confidence += 10;
  if(level==='GREEN' || level==='RED') confidence += 5;
  if(isFragmented || isStrongTrend || isRiskOff) confidence += 10;
  confidence = Math.max(0, Math.min(95, confidence));

  return {phase:phase,title:title,state:state,color:color,exposureBand:exposureBand,risk:risk,confidence:confidence,bullets:bullets,regime:rr,curve:curve,heat:heat,metrics:{level:level,totalIC:totalIC,spread:spread,divRatio:divRatio,negRatio:negRatio,breadth:breadth,momDir:momDir,volDir:volDir}};
}

function renderMarketPhaseDashboardFromFH(fh, shortN, longN){
  var mp = calcMarketPhaseFromFH(fh, shortN, longN);
  function fmtNum(v,d){ return (v===null||v===undefined||!isFinite(v))?'--':v.toFixed(d===undefined?3:d); }
  function fmtPct(v){ return (v===null||v===undefined||!isFinite(v))?'--':((v*100).toFixed(0)+'%'); }
  var html='<div class="card" style="border-top:3px solid '+mp.color+';margin-bottom:10px">';
  html+='<div class="ct">Market Phase Dashboard <span style="color:'+mp.color+';font-size:12px">'+mp.title+'</span></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:8px">';
  html+='<div class="ib2"><b>市場位階</b><br><span style="font-size:18px;color:'+mp.color+';font-weight:700">Phase '+(mp.phase||'--')+'</span><br><span style="color:var(--mu)">'+mp.state+'</span></div>';
  html+='<div class="ib2"><b>建議曝險帶</b><br><span class="mono" style="font-size:18px;color:'+mp.color+';font-weight:700">'+mp.exposureBand+'</span><br><span style="color:var(--mu)">非強制下單，只是位階建議</span></div>';
  html+='<div class="ib2"><b>風險等級</b><br><span style="font-size:18px;color:'+mp.color+';font-weight:700">'+mp.risk+'</span><br><span style="color:var(--mu)">Confidence '+mp.confidence+'%</span></div>';
  html+='<div class="ib2"><b>結構狀態</b><br><span class="mono" style="font-size:13px;color:'+mp.color+';font-weight:700">'+(mp.heat.lastTrendLabel||'--')+'</span><br><span style="color:var(--mu)">Diverge '+mp.heat.divergeCount+'/'+mp.heat.n+'｜NegTotal '+mp.heat.negTotalCount+'/'+mp.heat.n+'</span></div>';
  html+='</div>';
  html+='<div class="tw-wrap" style="max-height:none;margin-bottom:8px"><table><thead><tr><th>Layer</th><th>判斷</th><th>數據</th></tr></thead><tbody>';
  html+='<tr><td>3D Matrix</td><td style="color:'+mp.color+';font-weight:700">'+(mp.metrics.level||'--')+' / '+(mp.metrics.momDir||'--')+' + Vol '+(mp.metrics.volDir||'--')+'</td><td class="mono">TotalIC '+fmtNum(mp.metrics.totalIC,3)+'｜Spread '+fmtPct(mp.metrics.spread)+'</td></tr>';
  html+='<tr><td>N-Trend Curve</td><td>Healthy '+mp.curve.healthy+'｜Weak '+mp.curve.weak+'｜Broken '+mp.curve.broken+'</td><td class="mono">Mom '+(mp.curve.labels.mom||'--')+'｜K-Bar '+(mp.curve.labels.kbar||'--')+'</td></tr>';
  html+='<tr><td>IC Heatmap</td><td>Diverge '+mp.heat.divergeCount+'｜Trend '+mp.heat.trendCount+'｜Decay '+mp.heat.decayCount+'</td><td class="mono">PositiveBreadth '+fmtPct(mp.metrics.breadth)+'｜Dispersion '+fmtNum(mp.heat.avgAbsDispersion,3)+'</td></tr>';
  html+='</tbody></table></div>';
  html+='<div class="ib2"><b>判斷理由：</b><br>'+mp.bullets.map(function(x){return '・'+x;}).join('<br>')+'</div>';
  html+='</div>';
  return html;
}

function renderFactorHealthResult(fh,shortN,longN){
  // AUDIT: factor health status using fhSummarizeFactor
  if (DEBUG_AUDIT && fh && fh.months && fh.factors) {
    fh.factors.forEach(function(f) {
      var key = f[0], name = f[1];
      var summ = fhSummarizeFactor(fh, key, shortN || 6, longN || 36);
      if (summ && summ.short && summ.long) {
        auditFactorHealth(name, summ.long.ic, summ.short.ic);
      }
    });
  }
  if(!fh || !fh.months || !fh.months.length) return '<div class="ib2">資料不足：請先抓取資料並建立回測快取。</div>';
  var html=renderRiskRegimeBannerFromFH(fh,shortN,longN);
  html+=renderMarketPhaseDashboardFromFH(fh,shortN,longN);
  html+='<div class="ib2" style="margin-bottom:8px;border-color:var(--ac)">基準：本頁使用與實際策略相同的 <b>scoreDate / tradeStart / tradeEnd</b>。若設定 T-4 與 T-(N-1) 成交，IC 也會用同一段持有區間。p-value 為近似值，小樣本 n&lt;30 僅供參考。</div>';
  html+='<div class="tw-wrap" style="max-height:none"><table><thead><tr><th>Factor</th><th>Short '+shortN+'</th><th>Long '+longN+'</th><th>IC Δ</th><th>Short Spread</th><th>Long Spread</th><th>Contribution Δ</th><th>Status</th></tr></thead><tbody>';
  fh.factors.forEach(function(f){
    var key=f[0], name=f[1], sm=fhSummarizeFactor(fh,key,shortN,longN), d=(sm.short.ic!==null&&sm.long.ic!==null)?sm.short.ic-sm.long.ic:null;
    var vd=fhVerdict(sm); var vc=vd==='衰退警戒'?'var(--re)':(vd==='短期增強'||vd==='穩定有效'?'var(--gr)':'var(--ye)');
    html+='<tr><td style="font-weight:700;color:var(--wh)">'+name+'</td><td class="mono" style="color:'+fhColor(sm.short.ic)+'">'+fhFmtNum(sm.short.ic,3)+' / ICIR '+fhFmtNum(sm.short.icir,2)+'</td><td class="mono" style="color:'+fhColor(sm.long.ic)+'">'+fhFmtNum(sm.long.ic,3)+' / ICIR '+fhFmtNum(sm.long.icir,2)+'</td><td class="mono" style="color:'+fhColor(d)+'">'+fhFmtNum(d,3)+'</td><td class="mono" style="color:'+fhColor(sm.short.spread)+'">'+fhFmtPct(sm.short.spread)+'</td><td class="mono" style="color:'+fhColor(sm.long.spread)+'">'+fhFmtPct(sm.long.spread)+'</td><td class="mono" style="color:'+fhColor((sm.short.contrib||0)-(sm.long.contrib||0))+'">'+fhFmtNum((sm.short.contrib||0)-(sm.long.contrib||0),3)+'</td><td style="font-weight:700;color:'+vc+'">'+vd+'</td></tr>';
  });
  html+='</tbody></table></div>';
  html+=renderFactorTrendCurve(fh, fhGetTrendWindows());

  // Enhanced heatmap with IC Trend indicators
  html+='<div class="card" style="border-top:3px solid var(--tw);margin-top:10px"><div class="ct">IC Heatmap + Trend <span style="font-size:9px;color:var(--mu);font-weight:400">3p slope | streak persistence</span></div>';
  html+='<div class="tw-wrap" style="max-height:none"><table><thead><tr><th>Month</th>';
  html+=fh.factors.map(function(f){return '<th>'+f[1]+'</th>';}).join('');
  html+='<th style="color:var(--ye)">IC Trend</th></tr></thead><tbody>';

  var heatRows = fh.months.slice(-12);
  var allRows = fh.months;
  heatRows.slice().reverse().forEach(function(m, ri){
    var rowIdx = allRows.length - 1 - ri; // index in allRows
    html+='<tr><td class="mono">'+m.month+'</td>';
    html+=fh.factors.map(function(f){
      var v=m.factors[f[0]]?m.factors[f[0]].ic:null;
      return '<td class="mono" style="color:'+fhColor(v)+';font-weight:700">'+fhFmtNum(v,3)+'</td>';
    }).join('');

    // Compute rolling Mom/Vol trend at this row's point in time
    var trendLabel = '--', trendColor = 'var(--mu)';
    if (rowIdx >= 2) {
      var momICs = [];
      var volICs = [];
      for (var ti = Math.max(0, rowIdx - 2); ti <= rowIdx; ti++) {
        var mr = allRows[ti];
        if (mr.factors && mr.factors.mom && mr.factors.mom.ic !== null) momICs.push(mr.factors.mom.ic);
        if (mr.factors && mr.factors.vol && mr.factors.vol.ic !== null) volICs.push(mr.factors.vol.ic);
      }
      if (momICs.length >= 2 && volICs.length >= 2) {
        var mSlope = (momICs[momICs.length-1] - momICs[0]) / (momICs.length - 1);
        var vSlope = (volICs[volICs.length-1] - volICs[0]) / (volICs.length - 1);
        if (mSlope > 0.01 && vSlope < -0.01) {
          trendLabel = '\u2197 TREND'; trendColor = 'var(--gr)';
        } else if (mSlope < -0.01 && vSlope > 0.01) {
          trendLabel = '\u26a0 DIVERGE'; trendColor = 'var(--re)';
        } else if (mSlope < -0.01 && vSlope < -0.01) {
          trendLabel = '\u2198 DECAY'; trendColor = 'var(--ye)';
        } else if (mSlope > 0.01 && vSlope > 0.01) {
          trendLabel = '\u2194 MIXED'; trendColor = 'var(--mu)';
        } else {
          trendLabel = '\u2192 FLAT'; trendColor = 'var(--mu)';
        }
      }
    }
    html+='<td style="font-size:11px;font-weight:700;color:'+trendColor+'">'+trendLabel+'</td></tr>';
  });

  html+='</tbody></table></div></div>';
  return html;
}
function calcFactorHealthFromCachedRecords(records){
  var factors=[['mom','Momentum'],['bias','Bias'],['slope','Slope'],['vol','Volatility'],['kbar','K-Bar'],['score','Total Score']];
  var months=[];
  (records||[]).forEach(function(r){
    if (r && r.factorHealthRow) months.push(r.factorHealthRow);
  });
  if (months.length) return {months:months, factors:factors};
  return calcFactorHealthFromRecords(records||[]);
}

async function runFactorHealth(){
  if(!(await ensureDataReadyForAnalysis('factor health'))) return;
  var panel=document.getElementById('factorHealthRes'); if(panel) panel.innerHTML='<div class="ib2">計算中...</div>';
  showL('Factor Health...');
  setTimeout(function(){
    try{
      var mh=parseInt(document.getElementById('btH')?document.getElementById('btH').value:'6')||6;
      var mode=(typeof getWeightMode==='function')?getWeightMode():'eq';
      var tn=parseInt(document.getElementById('btSignalTN')?document.getElementById('btSignalTN').value:'4',10); if(!isFinite(tn)) tn=4;
      var records=runBTcore(mh,mode,{signalN:tn,tnExecMode:getTNExecMode()});
      var shortN=parseInt(document.getElementById('fhShortWin')?document.getElementById('fhShortWin').value:'6',10)||6;
      var longN=parseInt(document.getElementById('fhLongWin')?document.getElementById('fhLongWin').value:'36',10)||36;
      var fh=calcFactorHealthFromCachedRecords(records||[]);
      if(panel) panel.innerHTML=renderFactorHealthResult(fh,shortN,longN);
      hideL();
    }catch(e){ hideL(); if(panel)panel.innerHTML='<div class="ib2" style="color:var(--re)">Factor Health error: '+e.message+'</div>'; console.error(e); }
  },80);
}
