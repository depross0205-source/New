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

    var totalQuota = poolModeSetting === 'large'
      ? (parseInt(document.getElementById('btH').value) || 5)
      : (parseInt($('btQuotaTW') ? $('btQuotaTW').value : '2') || 0)
        + (parseInt($('btQuotaUS') ? $('btQuotaUS').value : '2') || 0)
        + (parseInt($('btQuotaETF') ? $('btQuotaETF').value : '1') || 0);

    // 多方缺額只記錄為 longFillSlots，後面補到 target 的 SGOV/CASH。
    // 不再 push 到 sel，避免 SGOV/CASH 被當成多方候選，甚至再流入空方候選。
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

        return true;
      });
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
    var is1330 = capMode === '1330';
    var is5050 = (capMode === '5050' || capMode === 'neutral'); // neutral 保留舊版相容
    var is1000 = capMode === '1000';
    var isShortOnly = capMode === 'short_only';
    var hasLong = (sel && sel.length > 0);
    var hasShort = (shortN > 0 && selS && selS.length > 0);

    // Capital Mode:
    // - 100/0: 100% long only.
    // - 50/50: 50% long / 50% short；空方不足不補 SGOV/CASH。
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
    // 股票部分只分配已入選名額對應權重，剩餘 long side 後面補 SGOV/CASH。
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
    // short_only 永遠不補 SGOV/CASH，否則純空模式會被稀釋成低報酬。
    if (!isShortOnly && longFillSlots > 0 && longSlotBase > 0 && lScale > 0) {
      var defensiveCode = (
        DAILY['SGOV'] &&
        DAILY['SGOV'].length > 0 &&
        getPriceOnDate(DAILY['SGOV'], scoreM) !== null
      ) ? 'SGOV' : 'CASH';

      var fillWeight = lScale * (longFillSlots / longSlotBase) * exposure;
      if (fillWeight > 0.001) {
        target[defensiveCode] = (target[defensiveCode] || 0) + fillWeight;
      }
    }

    // 非 short_only 若完全沒有可執行部位，才維持 CASH；short_only 不用多方 sel 判斷。
    if (!Object.keys(target).length && !isShortOnly) {
      target['CASH']=1.0;
    }

    // 只在 100/0 純多模式補足到 100%。
    // 50/50 與 130/30 是多空架構，不能用 1 - 淨權重 補現金，
    // 否則 50/50 的 +50% / -50% 會被誤補成 100% CASH。
    if (capMode === '1000') {
      var totalW=0;
      Object.keys(target).forEach(function(c){ totalW+=target[c]; });
      var cashW=1.0-totalW;
      if (cashW>0.001) {
        var residualCode = (DAILY['SGOV'] && DAILY['SGOV'].length>0 && getPriceOnDate(DAILY['SGOV'], scoreM)!==null) ? 'SGOV' : 'CASH';
        target[residualCode]=(target[residualCode]||0)+cashW;
      }
    }

    var shield = getShieldDecision(scoreM);
    if (shield.enabled) {
      var shieldExposure = (typeof shield.exposure === 'number') ? shield.exposure : (shield.ok ? 1.0 : 0.0);
      if (shieldExposure < 1.0) {
        var shieldCode = (DAILY['SGOV'] && DAILY['SGOV'].length && getPriceOnDate(DAILY['SGOV'], prevM)!==null && getPriceOnDate(DAILY['SGOV'], sigM)!==null) ? 'SGOV' : 'CASH';
        if (shieldExposure <= 0.0) {
          // Full defensive - 100% SGOV
          target = {};
          target[shieldCode] = 1.0;
        } else {
          // Partial exposure: scale down equity, fill rest with SGOV
          var newTarget = {};
          var sgovFill = 1.0 - shieldExposure;
          Object.keys(target).forEach(function(c) {
            if (c === 'SGOV' || c === 'CASH') return;
            newTarget[c] = (target[c] || 0) * shieldExposure;
          });
          newTarget[shieldCode] = (newTarget[shieldCode] || 0) + sgovFill;
          // Keep any existing SGOV/CASH weight scaled too
          if (target['SGOV'] && shieldCode !== 'SGOV') newTarget['SGOV'] = (target['SGOV'] || 0) * shieldExposure;
          if (target['CASH'] && shieldCode !== 'CASH') newTarget['CASH'] = (target['CASH'] || 0) * shieldExposure;
          target = newTarget;
        }
      }
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
    var allScoresCopy = sc2.filter(function(r){return r.score!==null;}).map(function(r){
      return {c:r.s.c, pool:r.s.pool, score:r.score};
    });
    records.push({month:sigM,period:recPeriod,nav:nav,bNav:bNav,holdings:hCopy,pRet:netRet,hurdle:hurdle,stockRets:stockRets,scoringM:scoreM,shield:shield,stressLevel:shield.stressLevel||0,allScores:allScoresCopy});
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

function spearmanCorr(xs, ys) {
  var n = xs.length;
  if (n < 4) return {ic: null, t: null, p: null};
  function rankArr(arr) {
    var sorted = arr.slice().sort(function(a,b){return a-b;});
    return arr.map(function(v) {
      var lo = sorted.indexOf(v), hi = sorted.lastIndexOf(v);
      return (lo + hi) / 2 + 1;
    });
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

  for (var i = 0; i < records.length - 1; i++) {
    var r = records[i], rNext = records[i + 1];
    if (!r.allScores || r.allScores.length < 10) continue;
    var sigM = r.month, sigMNext = rNext.month, scoreDate = r.scoringM || sigM;
    var maxGapMs = 14 * 86400000;
    function getCleanReturn(ticker) {
      var bars = DAILY[ticker];
      if (!bars || !bars.length) return null;
      var p0 = null, p0date = null, p1 = null, p1date = null;
      for (var j = bars.length - 1; j >= 0; j--) {
        if (!p1 && bars[j].date <= sigMNext) { p1 = bars[j].c; p1date = bars[j].date; }
        if (!p0 && bars[j].date <= sigM) { p0 = bars[j].c; p0date = bars[j].date; }
        if (p0 && p1) break;
      }
      if (!p0 || !p1 || p0 <= 0) return null;
      if (Math.abs(new Date(sigMNext) - new Date(p1date)) > maxGapMs) return null;
      if (Math.abs(new Date(sigM) - new Date(p0date)) > maxGapMs) return null;
      return p1 / p0 - 1;
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
  html+='<div class="ct" style="display:flex;justify-content:space-between;align-items:center"><span>尾部 IC 完整面板 <span style="font-size:10px;color:var(--mu);font-weight:400;margin-left:6px">'+(icRes.tail_label||getTailConfig().label)+' | Top1/3/5/10 分層 | Spread 時間序列 | N穩定帶</span></span><button class="bo sm" onclick="runTailNStabilityPanel()">掃描 N=1~15</button></div>';
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
  var panel = document.getElementById('stressWeightSweepPanel');
  if (panel) panel.innerHTML = '權重掃描準備中...';
  if (!(await ensureDataReadyForAnalysis('stress weight sweep'))) return;

  var oldOverride = STRESS_WEIGHT_OVERRIDE;
  var oldGate = document.getElementById('btShieldGate') ? document.getElementById('btShieldGate').value : null;
  var mh = parseInt(document.getElementById('btH') ? document.getElementById('btH').value : '6') || 6;
  var mode = getWeightMode();
  var init = gv('btCap') || 100000;
  var rows = [];

  if (document.getElementById('btShieldGate')) document.getElementById('btShieldGate').value = 'stress';
  if (panel) panel.innerHTML = '權重掃描中... 10% 格點，請稍候。';

  await new Promise(function(r){ setTimeout(r, 50); });

  try {
    for (var v=0; v<=100; v+=10) {
      for (var h=0; h<=100-v; h+=10) {
        for (var t=0; t<=100-v-h; t+=10) {
          var b = 100-v-h-t;
          if (v+h+t+b !== 100) continue;
          STRESS_WEIGHT_OVERRIDE = {vix:v, hy:h, trend:t, breadth:b};
          var recs = runBTcore(mh, mode);
          if (!recs || !recs.length) continue;
          var kk = kpi(recs, init);
          rows.push({vix:v,hy:h,trend:t,breadth:b,cagr:kk.cagr,mdd:kk.mdd,sharpe:kk.sharpe,nav:kk.nav});
        }
      }
    }
  } catch(e) {
    if (panel) panel.innerHTML = '權重掃描錯誤: ' + e.message;
  } finally {
    STRESS_WEIGHT_OVERRIDE = oldOverride;
    if (oldGate !== null && document.getElementById('btShieldGate')) document.getElementById('btShieldGate').value = oldGate;
  }

  rows.sort(function(a,b){
    if (Math.abs(b.sharpe-a.sharpe)>0.0001) return b.sharpe-a.sharpe;
    if (Math.abs(b.mdd-a.mdd)>0.0001) return b.mdd-a.mdd;
    return b.cagr-a.cagr;
  });

  if (!panel) return;
  if (!rows.length) { panel.innerHTML = '沒有可用結果。請確認 Stress Gate 資料與回測資料已建立。'; return; }

  function fp(v){ return (v>=0?'+':'')+(v*100).toFixed(2)+'%'; }
  var top = rows.slice(0,20);
  var best = top[0];
  var html = '<div style="margin-bottom:6px;color:var(--mu)">排序：Sharpe 優先，其次 MDD，再看 CAGR。這是粗格點搜尋，重點看前幾組是否形成穩定區，不只看第1名。</div>';
  html += '<div class="ib2" style="border:1px solid var(--gr);margin-bottom:6px"><b style="color:var(--gr)">目前最佳粗格點</b> ｜ VIX '+best.vix+' / HY '+best.hy+' / Trend '+best.trend+' / Breadth '+best.breadth+' ｜ CAGR '+fp(best.cagr)+' ｜ MDD '+fp(best.mdd)+' ｜ Sharpe '+best.sharpe.toFixed(2)+'</div>';
  html += '<table style="width:100%;font-size:11px"><thead><tr><th>#</th><th>VIX</th><th>HY</th><th>Trend</th><th>Breadth</th><th>CAGR</th><th>MDD</th><th>Sharpe</th><th>Final NAV</th><th>套用</th></tr></thead><tbody>';
  top.forEach(function(r,i){
    html += '<tr><td class="mono">'+(i+1)+'</td><td class="mono">'+r.vix+'</td><td class="mono">'+r.hy+'</td><td class="mono">'+r.trend+'</td><td class="mono">'+r.breadth+'</td><td class="mono" style="color:'+(r.cagr>=0?'var(--gr)':'var(--re)')+'">'+fp(r.cagr)+'</td><td class="mono" style="color:var(--re)">'+fp(r.mdd)+'</td><td class="mono" style="color:'+(r.sharpe>=1?'var(--gr)':r.sharpe>=0?'var(--ye)':'var(--re)')+'">'+r.sharpe.toFixed(2)+'</td><td class="mono">$'+Math.round(r.nav).toLocaleString()+'</td><td><button class="bo sm" onclick="applyStressWeightSet('+r.vix+','+r.hy+','+r.trend+','+r.breadth+')">套用</button></td></tr>';
  });
  html += '</tbody></table>';
  panel.innerHTML = html;
}

function applyStressWeightSet(v,h,t,b){
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
  var oldSkipChecked = $('btSkipMo') ? $('btSkipMo').checked : false;
  if ($('btSkipMo')) $('btSkipMo').checked = false;
  SKIP_MO=false;
  CORR_WIN=parseInt($('corrW')?$('corrW').value:'24')||24;
  sl('btLog','Calculating fair T-'+tn+' backtest...',null); showL('T-'+tn+' Fair Backtesting...');
  setTimeout(async function() {
    try {
      if (CACHE_SKIP_MO!==SKIP_MO) { await buildCache(); }
      var mh=parseInt($('btH')?$('btH').value:'3')||3;
      var mode=getWeightMode(), init=gv('btCap')||100000;
      var records=runBTcore(mh,mode,{signalN:tn});
      if (!records) { alert('Not enough data'); hideL(); return; }
      BT_RESULT={records:records,initial:init,mode:mode,mh:mh,signalTN:tn};
      BT_RESULT.icResult = calcIC(records);
      renderBT(records,init,mode);
      var dStart=records[0].month, dEnd=records[records.length-1].month;
      sl('btLog','T-'+tn+' 公平回測完成: '+dStart+' 至 '+dEnd+' | 訊號=T-'+tn+'；交易=T月底→T+1月底',true);
    } catch(err) {
      sl('btLog','Error: '+err.message,false); console.error(err);
    } finally {
      if ($('btSkipMo')) $('btSkipMo').checked = oldSkipChecked;
      SKIP_MO = oldSkipChecked;
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
  sl('btLog','Comparing N=1 to '+maxN+'...',null); showL('Comparing...');
  setTimeout(async function() {
    try {
      if (CACHE_SKIP_MO!==SKIP_MO) { await buildCache(); }
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
    var sl2 = (r.shield && r.shield.stressLevel !== undefined) ? r.shield.stressLevel : -1;
    var comp2 = (r.shield && r.shield.composite !== undefined) ? r.shield.composite : -1;
    var exp2 = (r.shield && r.shield.exposure !== undefined) ? Math.round(r.shield.exposure * 100) : 100;
    var slLabelArr = ['L0','L1','L2','L3','L4'];
    var slColorArr = ['var(--gr)','var(--gr)','var(--ye)','var(--re)','var(--re)'];
    var slBgArr = ['rgba(0,229,160,0.1)','rgba(0,229,160,0.1)','rgba(255,184,48,0.1)','rgba(255,77,109,0.1)','rgba(255,77,109,0.1)'];
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
      +'<td class="mono" style="font-weight:700;vertical-align:top;">'+r.month+(r.scoringM?'<div style="font-size:9px;color:var(--mu)">\u9078\u80a1:'+r.scoringM+'</div>':'')+'</td>'
      +'<td style="vertical-align:top;">'+holdStr+'</td>'
      +'<td class="mono" style="font-size:10px;color:var(--bl);vertical-align:top;">'+(r.hurdle*100).toFixed(1)+'%</td>'
      +'<td class="mono" style="color:'+rc+';font-weight:700;vertical-align:top;">'+(r.pRet>=0?'+':'')+(r.pRet*100).toFixed(2)+'%</td>'
      +'<td class="mono" style="color:var(--tw);font-weight:700;vertical-align:top;">$'+Math.round(r.nav).toLocaleString()+'</td>'
      +'<td class="mono" style="color:var(--mu);vertical-align:top;">$'+Math.round(r.bNav).toLocaleString()+'</td>'
      +'<td class="mono" style="color:'+ec+';font-weight:700;vertical-align:top;">'+(ex>=0?'+':'')+(ex*100).toFixed(2)+'pp</td>'
      +stressCell
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
    updFetchStat(); updTNX(); if(isAutoBuildCache()){await buildCache();}else{CACHE_BUILT=false;CACHE_TS=null;if($('cacheTxt'))$('cacheTxt').textContent='Cache: uploaded data; not built';}
    if(isPersist()) await saveAllToDB();
    sl('dlLog','Loaded! Data restored. Cache will build only when requested.',true);
  } catch(err){ sl('dlLog','Error: '+err.message,false); }
  el.value='';
}
async function clearAndReset() {
  if(!confirm('Clear all cached data and IndexedDB?'))return;
  await indexedDB.deleteDatabase('FearlessConsoleDB');
  DAILY={}; CACHE_BUILT=false; CACHE_TS=null; RAW_SCORES={};
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

  // 正式空頭名單：依 Short N、低分排序、排除多頭已選、排除 SGOV/CASH/ETF。
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

  renderSig(sel,selS,allScores,latestDate,hurdle);
  renderST(allScores,hurdle,sel.map(function(s){return s.s.c;}),rejectedMap,latestDate);
}

// FIX5: renderSig - no emoji in poolNames
function isTWSignalStock(r) {
  return !!(r && r.s && (r.s.tw === true || r.s.tw === '1' || r.s.region === 'tw' || r.s.pool === 'tw'));
}

function renderSignalGroup(title, list, type, zf, pf) {
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
      + '</div></div>';
  });
  html += '</div>';
  return html;
}

function renderSig(sel,selS,all,date,hurdle) {
  var zf=function(v){return v!==null?(v>=0?'+':'')+v.toFixed(2):'-';};
  var pf=function(v){return v!==null?(v>=0?'+':'')+(v*100).toFixed(1)+'%':'-';};
  var tnx=getTNXRate(date);
  var sigN = $('sigTN') ? ($('sigTN').value || '10') : '10';
  var html='<div style="font-size:11px;color:var(--mu);margin-bottom:9px">Signal: <b style="color:var(--tw)">T-'+sigN+'</b> | Score Date: <b style="color:var(--tw)">'+date+'</b> | ^TNX: <b style="color:var(--bl)">'+(tnx*100).toFixed(2)+'%</b> | Hurdle: <b style="color:var(--ye)">'+(hurdle*100).toFixed(2)+'%</b><br><span style="color:var(--mu)">此為信號頁獨立觀察訊號；未指定月份時使用最新資料所在月份，若尚未到達 T-N 則提示等待；正式回測仍用純月頻/半月頻。</span></div>';

  sel = sel || [];
  selS = selS || [];
  var longTW = sel.filter(isTWSignalStock);
  var longUS = sel.filter(function(r){ return !isTWSignalStock(r); });
  var shortTW = selS.filter(isTWSignalStock);
  var shortUS = selS.filter(function(r){ return !isTWSignalStock(r); });

  html += renderSignalGroup('LONG 多頭名單｜台股', longTW, 'long', zf, pf);
  html += renderSignalGroup('LONG 多頭名單｜美股 / 國際', longUS, 'long', zf, pf);
  html += renderSignalGroup('SHORT 空頭名單｜台股', shortTW, 'short', zf, pf);
  html += renderSignalGroup('SHORT 空頭名單｜美股 / 國際', shortUS, 'short', zf, pf);

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
  var capMode = capEl ? capEl.value : '1330';
  var signalN = Math.max(0, Math.min(22, parseInt($('btSignalTN') ? $('btSignalTN').value : '10') || 0));
  return {
    poolMode: poolM, n: n, wt: wt, lag: lag, freq: freq,
    regOn: regOn, regExp: regExp, shieldOn: shieldOn, shieldMA: shieldMA,
    skipMo: skipMo, ma60: ma60, cost: cost, corrT: corrT,
    indLim: indLim, shortN: shortN, capMode: capMode, signalN: signalN
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
  if (cfg.skipMo) parts.push('SkipMo');
  if (cfg.regOn) parts.push('Regime(' + cfg.regExp + '%)');
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
function wfRunWindow(startYM, endYM, opts) {
  var recs = runBTcore(null, null, opts || {});
  if (!recs || !recs.length) return recs;
  // Defensive filter: each WF window only keeps records whose rebalance month falls inside that IS/OOS range.
  return recs.filter(function(r){ return wfDateInRange(r.month, startYM, endYM); });
}
function wfPushWindowReturns(target, recs, startYM, endYM) {
  if (!recs || !recs.length) return;
  recs.forEach(function(r){ if (wfDateInRange(r.month, startYM, endYM)) target.push(r.pRet); });
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
  var wfOpts={signalN:cfg.signalN};

  sl('stressLog','Running Walk-Forward (Anchored) T-'+cfg.signalN+'...',null);
  showL('Walk-Forward Analysis T-'+cfg.signalN+'...');
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
  var wfOpts={signalN:cfg.signalN};

  sl('stressLog','Running Rolling Walk-Forward T-'+cfg.signalN+'...',null);
  showL('Rolling Walk-Forward Analysis T-'+cfg.signalN+'...');
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


async function runTNSweep() {
  if(!(await ensureDataReadyForAnalysis('T-N sweep'))) return;
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
      if (CACHE_SKIP_MO !== SKIP_MO) await buildCache();

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
      SKIP_MO = oldSkipChecked;
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
  var wfOpts={signalN:signalN};
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

