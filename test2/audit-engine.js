// ============================================================
// AUDIT ENGINE v2.0
// System-level self-verification layer for TW Momentum Strategy
// Base file: latest uploaded v3 final.zip
// Scope: audit only. Core strategy logic is not changed here.
// ============================================================

var DEBUG_AUDIT = false;

var AUDIT_LOG = [];
var AUDIT_SUMMARY = {};
var AUDIT_LAST_STATIC = null;
var AUDIT_LAST_BT = null;

var AUDIT_CATEGORIES = [
  'TN','EXPOSURE','RETURN','SHORT','NAV','TURNOVER','CORR','IC','WF',
  'RANDOM','UI','FACTOR','REGIME','RANK','MDD','STATIC','DATA','CACHE',
  'SHARPE','ANNUAL','CSV','SIGNAL'
];

function auditInitSummary(){
  AUDIT_SUMMARY = {};
  AUDIT_CATEGORIES.forEach(function(k){ AUDIT_SUMMARY[k.toLowerCase()] = []; });
}
auditInitSummary();

function auditRound(v, d){
  d = d || 4;
  if (v === null || v === undefined || !isFinite(v)) return null;
  var p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

function auditPct(v, d){
  if (v === null || v === undefined || !isFinite(v)) return null;
  return auditRound(v * 100, d === undefined ? 2 : d) + '%';
}

function auditCategoryKey(category){
  return String(category || 'ui').toLowerCase().replace(/[^a-z]/g,'') || 'ui';
}

function auditLog(level, category, data) {
  if (!DEBUG_AUDIT) return;
  level = level || 'INFO';
  category = category || 'UI';
  data = data || {};
  var entry = { level: level, cat: category, ts: Date.now(), data: data };
  AUDIT_LOG.push(entry);

  var key = auditCategoryKey(category);
  if (!AUDIT_SUMMARY[key]) AUDIT_SUMMARY[key] = [];
  if (level === 'WARN' || level === 'ERROR' || level === 'CRITICAL') {
    AUDIT_SUMMARY[key].push(entry);
  }

  var tag = '[' + level + '][' + category + ']';
  var msg;
  try { msg = tag + ' ' + JSON.stringify(data); }
  catch(e){ msg = tag + ' [unserializable]'; }

  if (level === 'CRITICAL' || level === 'ERROR') console.error(msg);
  else if (level === 'WARN') console.warn(msg);
  else console.log(msg);
}

function auditClear() {
  AUDIT_LOG = [];
  auditInitSummary();
  AUDIT_LAST_STATIC = null;
  AUDIT_LAST_BT = null;
  var el = document.getElementById('auditPanel');
  if (el) el.innerHTML = renderAuditDashboard();
}

function auditSeverityScore(level){
  if (level === 'CRITICAL') return 4;
  if (level === 'ERROR') return 3;
  if (level === 'WARN') return 2;
  return 1;
}

function auditOverallStatus(){
  var max = 1;
  AUDIT_LOG.forEach(function(e){ max = Math.max(max, auditSeverityScore(e.level)); });
  if (max >= 4) return 'CRITICAL';
  if (max >= 3) return 'ERROR';
  if (max >= 2) return 'WARN';
  return 'PASS';
}


function auditChineseMeaning(level, cat, issue){
  var base = {
    'TN':'T-N 訊號與實際交易日期是否一致。',
    'EXPOSURE':'檢查多空與 SGOV 部位加總是否守恆。',
    'RETURN':'檢查個股報酬計算基準是否正確。',
    'SHORT':'檢查放空方向與報酬正負是否正確。',
    'NAV':'檢查 NAV 是否依照報酬正確鏈接。',
    'TURNOVER':'檢查換手率是否異常膨脹或重複計算。',
    'CORR':'檢查相關係數是否使用未來資料。',
    'IC':'檢查 IC 樣本數與穩定性。',
    'WF':'檢查 Walk-Forward 是否有 IS/OOS 污染。',
    'REGIME':'檢查 Regime / VWMA 判斷是否一致。',
    'RANK':'檢查排序結果是否正確由大到小。',
    'MDD':'檢查 MDD 峰值追蹤是否連續。',
    'UI':'檢查 Signal / Backtest / CSV 是否一致。',
    'FACTOR':'檢查因子近期效果是否衰退。',
    'STATIC':'檢查系統必要函數與模組是否正常載入。',
    'DATA':'檢查回測資料與結果是否完整。'
  };

  var severity = {
    'PASS':'正常，未發現異常。',
    'INFO':'正常資訊紀錄。',
    'WARN':'有潛在問題，但不一定造成績效失真。',
    'ERROR':'已發現明確邏輯或計算錯誤。',
    'CRITICAL':'可能導致 NAV 或報酬失真。'
  };

  return (base[cat] || '系統檢查。') + ' ' + (severity[level] || '') + (issue ? (' 問題：' + issue) : '');
}

function auditStatusDescription(status){
  if (status === 'PASS') return '正常：沒有偵測到會破壞計算一致性的問題。';
  if (status === 'WARN') return '警戒：有潛在不一致或解讀限制，通常不代表報酬已失真，但需要人工判讀。';
  if (status === 'ERROR') return '錯誤：偵測到明確邏輯或資料異常，該區塊結果不宜直接採信。';
  if (status === 'CRITICAL') return '嚴重：可能造成 NAV、曝險或報酬失真，必須先修正再使用結果。';
  return '';
}

function auditBadge(status){
  var color = status === 'PASS' ? 'var(--gr)' :
              status === 'WARN' ? 'var(--ye)' :
              status === 'ERROR' ? 'var(--re)' : 'var(--re)';
  var border = color;
  return '<span class="bdg" style="border:1px solid '+border+';color:'+color+';background:rgba(255,255,255,0.03)">'+status+'</span>';
}

function auditHasFn(name){
  try { return typeof window[name] === 'function'; } catch(e){ return false; }
}

// ============================================================
// STATIC / GLOBAL SYSTEM AUDIT
// ============================================================
function auditStaticSystem(){
  if (!DEBUG_AUDIT) return;
  var requiredFns = [
    '$','gv','getAnnualPeriods','getTNExecMode','getTNExecutionDate',
    'getFixedTNDate','runBTcore','kpi','calcAllScores','getEnabledStocks',
    'getMarketMonthEndPoint','getLatestMarketPoint','calc3DSignalLight','calcFactorHealthSingleRow','getRiskRegimeDecisionFromRecords'
  ];
  var missing = [];
  requiredFns.forEach(function(fn){ if (!auditHasFn(fn)) missing.push(fn); });

  var rec = {
    requiredFnsMissing: missing,
    hasChartJS: !!window.Chart,
    hasPOOL_DEF: typeof POOL_DEF !== 'undefined' && POOL_DEF && POOL_DEF.length,
    hasCANONICAL: typeof CANONICAL !== 'undefined',
    cacheBuilt: typeof CACHE_BUILT !== 'undefined' ? CACHE_BUILT : null,
    annualPeriods: auditHasFn('getAnnualPeriods') ? getAnnualPeriods() : null,
    tnExecMode: auditHasFn('getTNExecMode') ? getTNExecMode() : null,
    signalN: (document.getElementById('btSignalTN') ? document.getElementById('btSignalTN').value : null),
    ma60Mode: (document.getElementById('ma60FilterMode') ? document.getElementById('ma60FilterMode').value : null)
  };
  AUDIT_LAST_STATIC = rec;

  if (missing.length) {
    auditLog('ERROR','STATIC', Object.assign({}, rec, {issue:'Required functions missing: '+missing.join(', ')}));
  } else {
    auditLog('INFO','STATIC', rec);
  }

  if (rec.annualPeriods !== 12 && rec.annualPeriods !== 24) {
    auditLog('WARN','ANNUAL', Object.assign({}, rec, {issue:'annualPeriods is not 12/monthly or 24/half-month'}));
  }

  if (typeof CANONICAL !== 'undefined') {
    var sw = (+CANONICAL.swVix || 0) + (+CANONICAL.swHy || 0) + (+CANONICAL.swTrend || 0) + (+CANONICAL.swBreadth || 0);
    if (Math.abs(sw - 100) > 0.001) {
      auditLog('WARN','STATIC', {issue:'Stress Score weights do not sum to 100', sum:sw, canonical:CANONICAL});
    }
  }

  var scripts = Array.prototype.slice.call(document.querySelectorAll('script[src]')).map(function(s){ return s.getAttribute('src'); });
  ['audit-engine.js','pool-data.js','app-core.js','app-backtest.js'].forEach(function(s){
    if (scripts.indexOf(s) === -1) auditLog('WARN','STATIC',{issue:'Script not found in index.html script list', script:s, scripts:scripts});
  });
}

// ============================================================
// 1. T-N AUDIT
// ============================================================
function auditTN(scoreDate, tradeStart, tradeEnd, signalN, execMode) {
  if (!DEBUG_AUDIT) return;
  var holdDays = null;
  if (tradeStart && tradeEnd) holdDays = Math.round((new Date(tradeEnd) - new Date(tradeStart)) / 86400000);
  var rec = { signalN: signalN, execMode: execMode, scoreDate: scoreDate,
              tradeStart: tradeStart, tradeEnd: tradeEnd, holdingDays: holdDays };

  if (!scoreDate || !tradeStart || !tradeEnd) {
    auditLog('WARN','TN', Object.assign({}, rec, {issue:'missing scoreDate/tradeStart/tradeEnd'}));
    return;
  }
  if (tradeStart < scoreDate) {
    auditLog('ERROR','TN', Object.assign({}, rec, {issue:'tradeStart < scoreDate: execution before signal'}));
    return;
  }
  if (tradeStart === scoreDate) {
    auditLog('WARN','TN', Object.assign({}, rec, {issue:'tradeStart == scoreDate: same-day signal/execution, verify intended'}));
    return;
  }
  if (tradeEnd <= tradeStart) {
    auditLog('ERROR','TN', Object.assign({}, rec, {issue:'tradeEnd <= tradeStart: holding period zero or negative'}));
    return;
  }
  var ap = auditHasFn('getAnnualPeriods') ? getAnnualPeriods() : 12;
  var minHold = (ap >= 24) ? 1 : 3;
  var maxHold = (ap >= 24) ? 35 : 70;
  if (holdDays !== null && (holdDays < minHold || holdDays > maxHold)) {
    auditLog('WARN','TN', Object.assign({}, rec, {issue:'holdingDays outside expected range for current frequency', annualPeriods:ap, minHold:minHold, maxHold:maxHold}));
  } else {
    auditLog('INFO','TN', rec);
  }
}

// ============================================================
// 2. EXPOSURE AUDIT
// ============================================================
function auditExposure(target, regimeExposure, shieldExposure, capMode, period) {
  if (!DEBUG_AUDIT) return;
  target = target || {};
  var grossLong = 0, grossShort = 0, sgov = 0, cash = 0, other = 0;
  Object.keys(target).forEach(function(c) {
    var w = +(target[c] || 0);
    if (!isFinite(w)) return;
    if (c === 'SGOV') sgov += w;
    else if (c === 'CASH') cash += w;
    else if (w > 0) grossLong += w;
    else if (w < 0) grossShort += Math.abs(w);
    else other += w;
  });
  var grossExposure = grossLong + grossShort;
  var netRiskExposure = grossLong - grossShort;
  var totalPortfolio = netRiskExposure + sgov + cash;
  var rec = { period: period, capMode: capMode,
    grossLong: auditRound(grossLong), grossShort: auditRound(grossShort),
    grossExposure: auditRound(grossExposure), netRiskExposure: auditRound(netRiskExposure),
    SGOV: auditRound(sgov), cash: auditRound(cash), totalPortfolio: auditRound(totalPortfolio),
    regimeExposure: regimeExposure, shieldExposure: shieldExposure };

  var tol = 0.015;
  if (Math.abs(totalPortfolio - 1.0) > tol) {
    var severity = Math.abs(totalPortfolio - 1.0) > 0.05 ? 'CRITICAL' : 'WARN';
    auditLog(severity, 'EXPOSURE', Object.assign({}, rec, {
      issue: 'net portfolio not conserved; expected about 1.0'
    }));
  } else if (sgov < -0.0001 || cash < -0.0001) {
    auditLog('ERROR','EXPOSURE', Object.assign({}, rec, {issue:'negative defensive bucket'}));
  } else {
    auditLog('INFO','EXPOSURE', rec);
  }
}


// ============================================================
// 2b. END-HOLDING DRIFT AUDIT
// ============================================================
function auditEndHoldingDrift(holdings, period) {
  if (!DEBUG_AUDIT) return;
  holdings = holdings || {};
  var grossLong = 0, grossShort = 0, sgov = 0, cash = 0;
  Object.keys(holdings).forEach(function(c) {
    var w = +(holdings[c] || 0);
    if (!isFinite(w)) return;
    if (c === 'SGOV') sgov += w;
    else if (c === 'CASH') cash += w;
    else if (w > 0) grossLong += w;
    else if (w < 0) grossShort += Math.abs(w);
  });
  var netRiskExposure = grossLong - grossShort;
  var totalPortfolio = netRiskExposure + sgov + cash;
  var driftFromOne = totalPortfolio - 1.0;
  var rec = {
    period: period,
    grossLong: auditRound(grossLong),
    grossShort: auditRound(grossShort),
    SGOV: auditRound(sgov),
    cash: auditRound(cash),
    endHoldingNet: auditRound(totalPortfolio),
    driftFromOne: auditPct(driftFromOne, 2),
    interpretation: '期末漂移權重：這是持倉經價格漲跌後的比例，不要求等於100%。若 NAV 鏈接通過，通常不是曝險錯誤。'
  };
  if (Math.abs(driftFromOne) > 0.50) {
    auditLog('WARN','EXPOSURE', Object.assign({}, rec, {issue:'end-holding drift is very large; verify extreme return or data adjustment'}));
  } else {
    auditLog('INFO','EXPOSURE', rec);
  }
}

// ============================================================
// 3. RETURN BASIS AUDIT
// ============================================================
function auditReturn(code, entryDate, entryPrice, exitDate, exitPrice, weight, period) {
  if (!DEBUG_AUDIT) return;
  var rawRet = (entryPrice && exitPrice && entryPrice > 0) ? (exitPrice / entryPrice - 1) : null;
  var weightedRet = (rawRet !== null) ? rawRet * weight : null;
  var rec = { code: code, period: period, entryDate: entryDate, entryPrice: entryPrice,
    exitDate: exitDate, exitPrice: exitPrice, weight: auditRound(weight),
    rawRet: auditPct(rawRet,3), weightedRet: auditPct(weightedRet,3) };

  if (entryPrice === null || entryPrice === undefined) auditLog('ERROR','RETURN', Object.assign({}, rec, {issue:'entryPrice null'}));
  else if (exitPrice === null || exitPrice === undefined) auditLog('ERROR','RETURN', Object.assign({}, rec, {issue:'exitPrice null'}));
  else if (rawRet !== null && Math.abs(rawRet) > 0.8) auditLog('WARN','RETURN', Object.assign({}, rec, {issue:'extreme raw return, verify adjusted close'}));
  else auditLog('INFO','RETURN', rec);
}

// ============================================================
// 4. SHORT AUDIT
// ============================================================
function auditShort(code, entryPrice, exitPrice, weight, period) {
  if (!DEBUG_AUDIT) return;
  if (weight >= 0) return;
  var longRet = (entryPrice && exitPrice && entryPrice > 0) ? (exitPrice / entryPrice - 1) : null;
  var shortRet = longRet !== null ? -longRet : null;
  var contribution = longRet !== null ? weight * longRet : null;
  var rec = { code: code, period: period, entryPrice: entryPrice, exitPrice: exitPrice,
    weight: auditRound(weight), longRet: auditPct(longRet,3), shortRet: auditPct(shortRet,3),
    contribution: auditPct(contribution,3) };
  if (longRet === null) auditLog('ERROR','SHORT', Object.assign({}, rec, {issue:'missing price data for short'}));
  else auditLog('INFO','SHORT', rec);
}

// ============================================================
// 5. NAV CHAIN AUDIT
// ============================================================
function auditNAV(prevNAV, grossRet, totalCost, actualNAV, period) {
  if (!DEBUG_AUDIT) return;
  if (!isFinite(prevNAV) || !isFinite(grossRet) || !isFinite(totalCost) || !isFinite(actualNAV)) {
    auditLog('ERROR','NAV', {period:period, issue:'non-finite NAV input', prevNAV:prevNAV, grossRet:grossRet, totalCost:totalCost, actualNAV:actualNAV});
    return;
  }
  var netRet = grossRet - totalCost;
  var expectedNAV = prevNAV * (1 + netRet);
  var drift = Math.abs(actualNAV - expectedNAV);
  var rec = { period: period, prevNAV: auditRound(prevNAV), grossRet: auditPct(grossRet,4),
    totalCost: auditPct(totalCost,4), netRet: auditPct(netRet,4), expectedNAV: auditRound(expectedNAV),
    actualNAV: auditRound(actualNAV), drift: auditRound(drift,6) };

  if (drift > 0.001) auditLog('CRITICAL','NAV', Object.assign({}, rec, {issue:'navDriftDetected'}));
  else if (drift > 0.0001) auditLog('WARN','NAV', Object.assign({}, rec, {issue:'minor NAV drift'}));
  else auditLog('INFO','NAV', rec);
}

// ============================================================
// 6. TURNOVER AUDIT
// ============================================================
function auditTurnover(turnoverBase, naturalExtraTurnover, period) {
  if (!DEBUG_AUDIT) return;
  turnoverBase = +turnoverBase || 0;
  naturalExtraTurnover = +naturalExtraTurnover || 0;
  var total = turnoverBase + naturalExtraTurnover;
  var rec = { period: period, rebalanceTurnover: auditPct(turnoverBase,1),
    naturalElimTurnover: auditPct(naturalExtraTurnover,1), total: auditPct(total,1) };
  if (total > 2.0) auditLog('WARN','TURNOVER', Object.assign({}, rec, {issue:'turnover > 200%, possible double counting'}));
  else auditLog('INFO','TURNOVER', rec);
}

// ============================================================
// 7. CORRELATION AUDIT
// ============================================================
function auditCorr(code1, code2, corrValue, corrDate, scoreDate) {
  if (!DEBUG_AUDIT) return;
  var rec = { code1: code1, code2: code2, corr: auditRound(corrValue), corrDate: corrDate, scoreDate: scoreDate };
  if (corrDate && scoreDate && corrDate > scoreDate) auditLog('WARN','CORR', Object.assign({}, rec, {issue:'corrDate > scoreDate: possible look-ahead'}));
  else auditLog('INFO','CORR', rec);
}

// ============================================================
// 8. IC AUDIT
// ============================================================
function auditIC(factor, scoreDate, tradeStart, tradeEnd, icValue, n, period) {
  if (!DEBUG_AUDIT) return;
  var rec = { factor: factor, period: period, scoreDate: scoreDate, tradeStart: tradeStart,
    tradeEnd: tradeEnd, IC: auditRound(icValue), n: n };
  if (n < 15) auditLog('WARN','IC', Object.assign({}, rec, {issue:'small sample IC; interpret cautiously'}));
  else if (icValue !== null && isFinite(icValue) && Math.abs(icValue) > 0.6) auditLog('WARN','IC', Object.assign({}, rec, {issue:'unusually large IC; verify data'}));
  else auditLog('INFO','IC', rec);
}

// ============================================================
// 9. WF AUDIT
// ============================================================
function auditWFWindow(type, isRange, oosRange, isCagr, oosCagr, ratio, oosMonths) {
  if (!DEBUG_AUDIT) return;
  var rec = { type: type, IS: isRange, OOS: oosRange,
    IS_CAGR: auditPct(isCagr,2), OOS_CAGR: auditPct(oosCagr,2), ratio: auditPct(ratio,1), oosMonths: oosMonths };
  var isEnd = isRange ? isRange.split('~')[1].trim() : null;
  var oosStart = oosRange ? oosRange.split('~')[0].trim() : null;
  if (isEnd && oosStart && oosStart <= isEnd) auditLog('ERROR','WF', Object.assign({}, rec, {issue:'OOS overlaps or touches IS range'}));
  else if (oosMonths < 6) auditLog('WARN','WF', Object.assign({}, rec, {issue:'very short OOS window'}));
  else auditLog('INFO','WF', rec);
}

// ============================================================
// 10. RANDOM BASELINE AUDIT
// ============================================================
function auditRandomBaseline(strategyCostPct, baselineCostPct) {
  if (!DEBUG_AUDIT) return;
  var rec = { strategyCost: strategyCostPct + '%', baselineCost: baselineCostPct + '%' };
  if (baselineCostPct === 0 && strategyCostPct > 0) auditLog('WARN','RANDOM', Object.assign({}, rec, {issue:'random baseline cost asymmetry'}));
  else auditLog('INFO','RANDOM', rec);
}

// ============================================================
// 11. UI / SIGNAL-BACKTEST CONSISTENCY AUDIT
// ============================================================
function auditUIConsistency(signalStocks, btLastHoldings, signalDate, btDate) {
  if (!DEBUG_AUDIT) return;
  if (!signalStocks || !btLastHoldings) return;
  var sigCodes = signalStocks.map(function(s){ return s.c || s; }).sort();
  var btCodes = Object.keys(btLastHoldings).filter(function(c){ return c !== 'SGOV' && c !== 'CASH'; }).sort();
  var missing = sigCodes.filter(function(c){ return btCodes.indexOf(c) === -1; });
  var extra = btCodes.filter(function(c){ return sigCodes.indexOf(c) === -1; });
  var rec = { signalDate: signalDate, btDate: btDate, missingInBT: missing, extraInBT: extra, signalCodes: sigCodes, btCodes: btCodes };
  if (missing.length || extra.length) auditLog('WARN','UI', Object.assign({}, rec, {issue:'signal/backtest holdings mismatch; check T-N/frequency/settings'}));
  else auditLog('INFO','UI', rec);
}

// ============================================================
// 12. FACTOR HEALTH AUDIT
// ============================================================
function auditFactorHealth(factorName, ic36m, ic6m) {
  if (!DEBUG_AUDIT) return;
  var ratio = (ic36m !== null && ic36m !== undefined && Math.abs(ic36m) > 0.005) ? ic6m / Math.abs(ic36m) : null;
  var status;
  if (ratio === null || !isFinite(ratio)) status = 'INSUFFICIENT_DATA';
  else if (ratio > 0.8) status = 'HEALTHY';
  else if (ratio > 0.5) status = 'WEAKENING';
  else if (ratio > 0.3) status = 'DECAYING';
  else status = 'COLLAPSING';
  var rec = { factor: factorName, IC_36m: auditRound(ic36m), IC_6m: auditRound(ic6m), ratio: auditRound(ratio,3), status: status };
  if (status === 'COLLAPSING' || status === 'DECAYING') auditLog('WARN','FACTOR', rec);
  else auditLog('INFO','FACTOR', rec);
}

// ============================================================
// 13. REGIME / RANK / MDD
// ============================================================
function auditRegime(scoreDate, isBearish, vwmaPrice, marketPrice, regimeLen, period) {
  if (!DEBUG_AUDIT) return;
  var rec = { period: period, scoreDate: scoreDate, isBearish: isBearish,
    vwmaLen: regimeLen, vwmaPrice: auditRound(vwmaPrice,3), marketPrice: auditRound(marketPrice,3) };
  if (isBearish && vwmaPrice && marketPrice && marketPrice > vwmaPrice) auditLog('ERROR','REGIME', Object.assign({}, rec, {issue:'bearish flag contradicts market price > VWMA'}));
  else auditLog('INFO','REGIME', rec);
}

function auditRankMonotonicity(scores, period) {
  if (!DEBUG_AUDIT) return;
  if (!scores || scores.length < 4) return;
  var violations = 0;
  for (var i=0; i<scores.length-1; i++) if (scores[i].score < scores[i+1].score) violations++;
  var rec = { period: period, n: scores.length, violations: violations,
    topScore: auditRound(scores[0].score), bottomScore: auditRound(scores[scores.length-1].score) };
  if (violations > 0) auditLog('ERROR','RANK', Object.assign({}, rec, {issue:'candidate list not sorted descending'}));
  else auditLog('INFO','RANK', rec);
}

function auditMDDContinuity(peakSoFar, currentNAV, period) {
  if (!DEBUG_AUDIT) return;
  var rec = { period: period, peak: auditRound(peakSoFar), nav: auditRound(currentNAV),
    dd: peakSoFar ? auditPct((currentNAV - peakSoFar) / peakSoFar, 2) : null };
  if (currentNAV > peakSoFar * 1.0001) auditLog('WARN','MDD', Object.assign({}, rec, {issue:'NAV exceeds supplied peak; peak tracker may lag'}));
  else auditLog('INFO','MDD', rec);
}

// ============================================================
// POST-RUN BT_RESULT AUDIT
// ============================================================

function auditTNConsistencySummary(records){
  if (!DEBUG_AUDIT || !records || !records.length) return;
  var mismatches = 0, missing = 0, checked = 0;
  var uiN = document.getElementById('btSignalTN') ? +document.getElementById('btSignalTN').value : null;
  var uiExec = auditHasFn('getTNExecMode') ? getTNExecMode() : null;
  records.forEach(function(r){
    if (!r || !r.scoringM) return;
    checked++;
    if (!r.tradeStart || !r.tradeEnd) missing++;
    if (r.tnExecMode && uiExec && r.tnExecMode !== uiExec) mismatches++;
  });
  var rec = {checked:checked, missingTradeDates:missing, execModeMismatch:mismatches, uiSignalN:uiN, uiExecMode:uiExec};
  if (missing || mismatches) auditLog('WARN','TN', Object.assign({}, rec, {issue:'BT_RESULT T-N metadata incomplete or inconsistent with current UI'}));
  else auditLog('INFO','TN', rec);
}


function auditExposureLayers(record){
  if (!DEBUG_AUDIT || !record) return;
  var layers = record.exposureLayers || {};
  var rec = {
    period: record.month,
    marketRegimeExposure: auditPct(layers.marketRegimeExposure !== undefined ? layers.marketRegimeExposure : record.marketRegimeExposure),
    shieldExposure: auditPct(layers.shieldExposure !== undefined ? layers.shieldExposure : record.shieldExposure),
    adaptiveExposure: auditPct(layers.adaptiveExposure !== undefined ? layers.adaptiveExposure : record.adaptiveExposure),
    finalExposure: auditPct(layers.finalExposure !== undefined ? layers.finalExposure : record.finalExposure),
    shieldMode: layers.shieldMode || (record.shield && record.shield.reason ? 'see shield.reason' : null),
    adaptiveOverlay: layers.adaptiveOverlay !== undefined ? layers.adaptiveOverlay : !!(record.adaptiveRegime && record.adaptiveRegime.enabled),
    adaptiveLevel: record.adaptiveRegime ? record.adaptiveRegime.level : null,
    adaptiveN: record.adaptiveRegime ? (record.adaptiveRegime.adaptiveN || record.adaptiveRegime.n) : null,
    adaptiveFreeze: record.adaptiveRegime ? !!record.adaptiveRegime.freeze : false
  };
  var vwmaUsed = isFinite(layers.vwmaExposureUsed) ? layers.vwmaExposureUsed : 1.0;
  var fm = isFinite(layers.factorExposureMultiplier) ? layers.factorExposureMultiplier : 1.0;
  var mph = isFinite(layers.marketPhaseExposure) ? layers.marketPhaseExposure : 1.0;
  if (isFinite(layers.finalExposure)) {
    var expected = Math.max(0, Math.min(1, vwmaUsed * fm * mph));
    if (Math.abs(expected - layers.finalExposure) > 0.0001) {
      auditLog('ERROR','REGIME', Object.assign({}, rec, {
        issue:'final exposure mismatch: expected vwma('+auditRound(vwmaUsed)+') * factor('+auditRound(fm)+') * phase('+auditRound(mph)+') = '+auditRound(expected)+' but got '+auditRound(layers.finalExposure),
        expectedExposure: auditRound(expected)
      }));
      return;
    }
  }
  auditLog('INFO','REGIME', rec);
}
function auditBTResultObject(btResult){
  if (!DEBUG_AUDIT) return;
  var records = null;
  if (btResult && Array.isArray(btResult)) records = btResult;
  else if (btResult && Array.isArray(btResult.records)) records = btResult.records;
  else if (typeof BT_RESULT !== 'undefined') {
    if (Array.isArray(BT_RESULT)) records = BT_RESULT;
    else if (BT_RESULT && Array.isArray(BT_RESULT.records)) records = BT_RESULT.records;
  }

  if (!records || !records.length) {
    auditLog('WARN','DATA', {issue:'No BT_RESULT records available. Run backtest first.'});
    return;
  }

  AUDIT_LAST_BT = { records: records.length, first: records[0].month, last: records[records.length-1].month };
  auditTNConsistencySummary(records);

  var prev = null;
  var peak = null;
  records.forEach(function(r, i){
    if (!r) return;

    if (r.tradeStart || r.tradeEnd || r.scoringM) {
      auditTN(r.scoringM, r.tradeStart, r.tradeEnd, r.signalN || (document.getElementById('btSignalTN') ? +document.getElementById('btSignalTN').value : null), r.tnExecMode || (auditHasFn('getTNExecMode') ? getTNExecMode() : null));
    }

    auditExposureLayers(r);

    if (r.targetWeights) {
      auditExposure(r.targetWeights, r.finalExposure !== undefined ? r.finalExposure : r.regimeExposure, r.shieldExposure !== undefined ? r.shieldExposure : (r.shield && r.shield.exposure), r.capMode || null, r.month);
    } else if (r.holdings) {
      auditEndHoldingDrift(r.holdings, r.month);
    }

    if (prev && isFinite(prev.nav) && isFinite(r.pRet) && isFinite(r.nav)) {
      var expected = prev.nav * (1 + r.pRet);
      var drift = Math.abs(expected - r.nav);
      if (drift > Math.max(0.01, Math.abs(r.nav)*0.0005)) {
        auditLog('CRITICAL','NAV', {
          period:r.month, prevNAV:auditRound(prev.nav), periodRet:auditPct(r.pRet,4),
          expectedNAV:auditRound(expected), actualNAV:auditRound(r.nav), drift:auditRound(drift,6),
          issue:'BT_RESULT adjacent NAV chain drift'
        });
      }
    }

    if (r.nav && isFinite(r.nav)) {
      if (peak === null || r.nav > peak) peak = r.nav;
      auditMDDContinuity(peak, r.nav, r.month);
    }

    if (r.stockRets) {
      Object.keys(r.stockRets).forEach(function(c){
        var sr = r.stockRets[c];
        if (!sr || c === 'SGOV' || c === 'CASH') return;
        if (sr.w < 0) auditShort(c, sr.prevPrice, sr.currPrice, sr.w, r.month);
      });
    }

    prev = r;
  });
}

// ============================================================
// SYSTEM HEALTH SUMMARY / UI RENDERER
// ============================================================
function auditCategoryStatus(cat){
  var entries = AUDIT_LOG.filter(function(e){ return auditCategoryKey(e.cat) === auditCategoryKey(cat); });
  if (!entries.length) return 'PASS';
  var max = 1;
  entries.forEach(function(e){ max = Math.max(max, auditSeverityScore(e.level)); });
  if (max >= 4) return 'CRITICAL';
  if (max >= 3) return 'ERROR';
  if (max >= 2) return 'WARN';
  return 'PASS';
}

function renderAuditFindings(limit){
  limit = limit || 60;
  var items = AUDIT_LOG.filter(function(e){ return e.level !== 'INFO'; }).slice(-limit).reverse();
  if (!items.length) return '<div style="font-size:11px;color:var(--gr)">目前沒有 WARN / ERROR / CRITICAL。</div>';
  var html = '<div class="tw-wrap" style="max-height:360px"><table><thead><tr><th>Level</th><th>Category</th><th>狀態解讀</th><th>Detail</th></tr></thead><tbody>';
  items.forEach(function(e){
    var color = e.level === 'WARN' ? 'var(--ye)' : 'var(--re)';
    var detail = '';
    try { detail = e.data.issue ? e.data.issue : JSON.stringify(e.data).slice(0,240); } catch(err){ detail = ''; }
    var zh = auditChineseMeaning(e.level, e.cat, detail);
    html += '<tr><td class="mono" style="color:'+color+';font-weight:700">'+e.level+'</td><td class="mono">'+e.cat+'</td><td style="white-space:normal">'+zh+'</td><td style="white-space:normal">'+detail+'</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function renderAuditLogTable(limit){
  limit = limit || 120;
  var items = AUDIT_LOG.slice(-limit).reverse();
  var html = '<div class="tw-wrap" style="max-height:420px"><table><thead><tr><th>Time</th><th>Level</th><th>Cat</th><th>Data</th></tr></thead><tbody>';
  items.forEach(function(e){
    var color = e.level === 'INFO' ? 'var(--mu)' : (e.level === 'WARN' ? 'var(--ye)' : 'var(--re)');
    var data = '';
    try { data = JSON.stringify(e.data).slice(0,500); } catch(err){ data = ''; }
    html += '<tr><td class="mono">'+new Date(e.ts).toLocaleTimeString()+'</td><td class="mono" style="color:'+color+';font-weight:700">'+e.level+'</td><td class="mono">'+e.cat+'</td><td style="white-space:normal;font-size:10px">'+data+'</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function renderAuditDashboard(){
  var enabled = DEBUG_AUDIT;
  var total = AUDIT_LOG.length;
  var criticals = AUDIT_LOG.filter(function(e){ return e.level === 'CRITICAL'; }).length;
  var errors = AUDIT_LOG.filter(function(e){ return e.level === 'ERROR'; }).length;
  var warns = AUDIT_LOG.filter(function(e){ return e.level === 'WARN'; }).length;
  var overall = auditOverallStatus();

  var categories = [
    ['STATIC','靜態載入 / 必要函數'],
    ['DATA','資料與回測結果'],
    ['TN','T-N 時間一致性'],
    ['EXPOSURE','目標曝險 / SGOV / 期末漂移'],
    ['RETURN','個股報酬基準'],
    ['SHORT','放空方向'],
    ['NAV','NAV 鏈接'],
    ['TURNOVER','換手率'],
    ['IC','IC / 因子健康'],
    ['WF','Walk-Forward'],
    ['REGIME','Regime / VWMA'],
    ['RANK','排序單調性'],
    ['MDD','MDD 峰值追蹤'],
    ['UI','UI 顯示一致性']
  ];

  var html = '';
  html += '<div class="card" style="border-top:3px solid '+(overall==='PASS'?'var(--gr)':overall==='WARN'?'var(--ye)':'var(--re)')+'">';
  html += '<div class="ct">SYSTEM AUDIT DASHBOARD <span>'+auditBadge(overall)+'</span></div>';
  html += '<div style="font-size:12px;color:var(--mu);line-height:1.8;margin-bottom:8px">';
  html += 'Audit Mode 用來檢查整個系統的時間基準、曝險守恆、NAV 鏈接、Sharpe/IC/WF 一致性。它不改變策略，只回報狀態。<br>';
  html += '目前狀態：<b style="color:var(--wh)">'+auditStatusDescription(overall)+'</b>';
  html += '</div>';
  html += '<div class="g3">';
  html += '<div class="scard"><div class="sname">Audit Mode</div><div class="sscore" style="color:'+(enabled?'var(--gr)':'var(--mu)')+'">'+(enabled?'ON':'OFF')+'</div></div>';
  html += '<div class="scard"><div class="sname">Log Entries</div><div class="sscore">'+total+'</div></div>';
  html += '<div class="scard"><div class="sname">WARN / ERROR / CRITICAL</div><div class="sscore" style="color:'+(criticals||errors?'var(--re)':warns?'var(--ye)':'var(--gr)')+'">'+warns+' / '+errors+' / '+criticals+'</div></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  html += '<button class="btw sm" onclick="enableAudit();auditStaticSystem();auditBTResultObject();auditReport()">開啟並立即稽核</button>';
  html += '<button class="bo sm" onclick="auditStaticSystem();auditBTResultObject();auditReport()">重新稽核目前狀態</button>';
  html += '<button class="bo sm" onclick="auditExportLog()">匯出 JSON Log</button>';
  html += '<button class="bo sm" onclick="auditClear()">清除 Audit Log</button>';
  html += '<button class="bo sm" onclick="disableAudit();auditReport()">關閉 Audit Mode</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card"><div class="ct">狀態總覽</div>';
  html += '<div class="tw-wrap" style="max-height:none"><table><thead><tr><th>區塊</th><th>狀態</th><th>結果代表的意義</th></tr></thead><tbody>';
  categories.forEach(function(pair){
    var st = auditCategoryStatus(pair[0]);
    html += '<tr><td>'+pair[1]+'</td><td>'+auditBadge(st)+'</td><td style="white-space:normal">'+auditStatusDescription(st)+'</td></tr>';
  });
  html += '</tbody></table></div></div>';

  html += '<div class="card"><div class="ct">問題清單</div>'+renderAuditFindings(80)+'</div>';
  html += '<div class="card"><div class="ct">最近 Audit Log</div>'+renderAuditLogTable(120)+'</div>';

  html += '<div class="card"><div class="ct">稽核清單說明</div><div class="ib2">';
  html += '<b>A 資料層：</b>adj close、market month-end、cache、缺資料 fallback。<br>';
  html += '<b>B 訊號層：</b>T-N 固定日期、T/NEXT、半月頻。<br>';
  html += '<b>C 排序層：</b>crossZ、ranking、corr、industry cap、MA60。<br>';
  html += '<b>D 組合層：</b>130/30、50/50、SGOV fill、自然淘汰、turnover。<br>';
  html += '<b>E 報酬層：</b>tradeStart→tradeEnd、short sign、NAV、CAGR、MDD。<br>';
  html += '<b>F 風控層：</b>Shield、Stress Gate、VWMA Regime。<br>';
  html += '<b>G 壓測層：</b>MC、Bootstrap、WF、Optimizer、T-N Sweep。<br>';
  html += '<b>H 統計層：</b>Sharpe、IC、p-value、random baseline。<br>';
  html += '<b>I UI層：</b>Signal/Backtest/CSV/Latest price 顯示一致性。';
  html += '</div></div>';

  return html;
}

function renderAuditSummary(){ return renderAuditDashboard(); }

function auditExportLog() {
  var blob = new Blob([JSON.stringify(AUDIT_LOG, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'audit_log_' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

window.enableAudit = function() {
  DEBUG_AUDIT = true;
  auditLog('INFO','STATIC',{issue:'Audit Mode enabled'});
  var btns = document.querySelectorAll('[data-audit-toggle]');
  Array.prototype.forEach.call(btns, function(b){ b.textContent = 'Audit Mode: ON'; });
  console.log('[AUDIT] Audit Mode ON.');
};

window.disableAudit = function() {
  DEBUG_AUDIT = false;
  var btns = document.querySelectorAll('[data-audit-toggle]');
  Array.prototype.forEach.call(btns, function(b){ b.textContent = 'Audit Mode: OFF'; });
  console.log('[AUDIT] Audit Mode OFF.');
};

window.auditReport = function() {
  var html = renderAuditDashboard();
  var el = document.getElementById('auditPanel');
  if (el) el.innerHTML = html;
  var el2 = document.getElementById('stressAuditPanel');
  if (el2) el2.innerHTML = html;
  if (!el && !el2) console.log(html.replace(/<[^>]+>/g,''));
};

window.runFullAudit = function(){
  if (!DEBUG_AUDIT) DEBUG_AUDIT = true;
  auditStaticSystem();
  auditBTResultObject();
  auditReport();
};

document.addEventListener('DOMContentLoaded', function(){
  try { auditReport(); } catch(e) { console.error('[AUDIT INIT]', e); }
});
