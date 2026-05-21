/* ============================================================
   TSCRIC-LoRa Dashboard — app.js v4.0 RESEARCH EDITION
   Original v3.0 fully preserved + new systems added
   ============================================================ */

// ============================================================
// LOGIN
// ============================================================
const DASHBOARD_PASSWORD = "Aman";

function doLogin() {
  const passEl = document.getElementById('loginPass');
  const errEl  = document.getElementById('loginError');
  if (!passEl) return;
  if (passEl.value.trim() === DASHBOARD_PASSWORD) {
    setDisplay('loginScreen','none');
    setDisplay('mainHeader','block');
    setDisplay('mainContent','block');
    if (errEl) errEl.style.display = 'none';
    sessionStorage.setItem('tscric_auth','1');
    loadChartJS();
    initFirebase();
  } else {
    if (errEl) errEl.style.display = 'block';
    passEl.value = ''; passEl.focus();
  }
}

function doLogout() {
  sessionStorage.removeItem('tscric_auth');
  setDisplay('mainHeader','none'); setDisplay('mainContent','none');
  setDisplay('loginScreen','flex');
  const p = document.getElementById('loginPass');
  if (p) p.value = '';
}

// ============================================================
// FIREBASE CONFIG
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDtWF8l4QCBdwmojwClGfd32AVNuf8alAk",
  authDomain:        "ai-irrigation-system-1e112.firebaseapp.com",
  databaseURL:       "https://ai-irrigation-system-1e112-default-rtdb.firebaseio.com",
  projectId:         "ai-irrigation-system-1e112",
  storageBucket:     "ai-irrigation-system-1e112.firebasestorage.app",
  messagingSenderId: "1052849462072",
  appId:             "1:1052849462072:web:a1062de83ec2f869a8ffcd"
};

// ============================================================
// CONSTANTS
// ============================================================
const BIGHA_TO_M2  = 1333.33;
const MAX_HISTORY  = 50;
const OWM_DIRECT_KEY = "e4efeb48999d7e673042ae4700395ed2";
let owmDirectData = null;

const CROP_DATA = [
  { name:"Wheat",     delta:450,  fc:38, pwp:13 },
  { name:"Rice",      delta:1200, fc:50, pwp:28 },
  { name:"Maize",     delta:550,  fc:38, pwp:13 },
  { name:"Cotton",    delta:750,  fc:37, pwp:13 },
  { name:"Soybean",   delta:500,  fc:37, pwp:13 },
  { name:"Chickpea",  delta:350,  fc:35, pwp:12 },
  { name:"Mustard",   delta:380,  fc:34, pwp:12 },
  { name:"Sugarcane", delta:1800, fc:42, pwp:16 }
];

const WEATHER_LOCATIONS = {
  bhopal:{label:"Bhopal",lat:23.26,lon:77.41,alt:527},
  indore:{label:"Indore",lat:22.72,lon:75.86,alt:553},
  jabalpur:{label:"Jabalpur",lat:23.18,lon:79.94,alt:412},
  gwalior:{label:"Gwalior",lat:26.22,lon:78.18,alt:197},
  ujjain:{label:"Ujjain",lat:23.18,lon:75.78,alt:491},
  sagar:{label:"Sagar",lat:23.84,lon:78.74,alt:523},
  rewa:{label:"Rewa",lat:24.53,lon:81.30,alt:327},
  satna:{label:"Satna",lat:24.60,lon:80.83,alt:318},
  chhindwara:{label:"Chhindwara",lat:22.06,lon:78.93,alt:682},
  vidisha:{label:"Vidisha",lat:23.52,lon:77.81,alt:430},
  hoshangabad:{label:"Hoshangabad",lat:22.75,lon:77.72,alt:310},
  narsinghpur:{label:"Narsinghpur",lat:22.95,lon:79.19,alt:363},
  delhi:{label:"New Delhi",lat:28.61,lon:77.20,alt:216},
  mumbai:{label:"Mumbai",lat:19.08,lon:72.88,alt:14},
  pune:{label:"Pune",lat:18.52,lon:73.86,alt:560},
  nagpur:{label:"Nagpur",lat:21.15,lon:79.09,alt:310},
  lucknow:{label:"Lucknow",lat:26.85,lon:80.95,alt:111},
  patna:{label:"Patna",lat:25.60,lon:85.12,alt:55},
  jaipur:{label:"Jaipur",lat:26.91,lon:75.79,alt:431},
  chandigarh:{label:"Chandigarh",lat:30.73,lon:76.78,alt:321},
  hyderabad:{label:"Hyderabad",lat:17.38,lon:78.47,alt:536},
  bangalore:{label:"Bengaluru",lat:12.97,lon:77.59,alt:920},
  ahmedabad:{label:"Ahmedabad",lat:23.03,lon:72.58,alt:55},
  kolkata:{label:"Kolkata",lat:22.57,lon:88.36,alt:9},
  amritsar:{label:"Amritsar",lat:31.63,lon:74.87,alt:234},
  varanasi:{label:"Varanasi",lat:25.32,lon:83.00,alt:80},
  agra:{label:"Agra",lat:27.18,lon:78.01,alt:169}
};

// ============================================================
// STATE
// ============================================================
let firebaseApp=null, firebaseDB=null;
let irrigHistory=[], lastData=null, isConnected=false;
let selectedWeatherLocation='bhopal';
let watchdogTimer=null, lastDataTime=0;
let localConfig={plotArea_m2:6.0, plotArea_bigha:6.0/BIGHA_TO_M2, crop:0, weatherLocation:'bhopal'};
let updatingM2=false, updatingBigha=false;
let calibData=[
  {adc_dry:850,adc_fc:600,adc_pwp:750,vwc_fc:0.35,vwc_pwp:0.12},
  {adc_dry:845,adc_fc:595,adc_pwp:745,vwc_fc:0.35,vwc_pwp:0.12},
  {adc_dry:855,adc_fc:605,adc_pwp:755,vwc_fc:0.35,vwc_pwp:0.12}
];

// v4.0 state
const CHART_BUF = 60;
let chartBuffers={labels:[],sm1:[],sm2:[],sm3:[],csmi:[],flow:[],aiScore:[],eto:[],rainfall:[],effectiveRain:[],appliedL:[],rainfallL:[],etoLoss:[],temp:[],hum:[]};
let chartInstances={}, chartsReady=false;
let alertList_data=[], alertIdCounter=0;
let lastPumpState=false, lastFlowRate=0;
let tipAccum_mm=0, lastRainEvent=null;
let loraPacketCount=0, loraTxTimestamp=0;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded',()=>{
  if(sessionStorage.getItem('tscric_auth')==='1'){
    setDisplay('loginScreen','none');
    setDisplay('mainHeader','block');
    setDisplay('mainContent','block');
    loadHistory(); updatePreviewCard(0,6.0);
    loadChartJS(); initFirebase();
  } else {
    setTimeout(()=>{const el=document.getElementById('loginPass');if(el)el.focus();},300);
  }
});

// ============================================================
// CHART.JS LAZY LOAD
// ============================================================
function loadChartJS(){
  if(window.Chart){initAllCharts();return;}
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  s.onload=()=>{chartsReady=true;initAllCharts();};
  s.onerror=()=>console.warn('Chart.js load failed');
  document.head.appendChild(s);
}

// ============================================================
// FIREBASE INIT
// ============================================================
function initFirebase(){
  loadHistory(); updatePreviewCard(localConfig.crop,localConfig.plotArea_m2);
  loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',()=>{
    loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',()=>{
      try{
        if(!firebaseApp) firebaseApp=firebase.initializeApp(FIREBASE_CONFIG);
        firebaseDB=firebase.database();
        startSensorsListener(); startConfigListener();
        fetchOWMDirect(); setInterval(fetchOWMDirect,600000);
        setConnectionStatus('online');
        if(watchdogTimer) clearInterval(watchdogTimer);
        watchdogTimer=setInterval(connectionWatchdog,10000);
        setInterval(updateLoRaDiagnostics,30000);
        setInterval(updateSoilHealthEstimates,60000);
        setInterval(checkRainfallIntelligence,120000);
      }catch(e){
        console.error(e); setConnectionStatus('error'); showAlert('Firebase init failed: '+e.message);
      }
    });
  });
  bootstrapAIChat();
}

function loadScript(src,cb){
  const s=document.createElement('script'); s.src=src; s.onload=cb;
  s.onerror=()=>{setConnectionStatus('error');showAlert('SDK load failed');};
  document.head.appendChild(s);
}

function startSensorsListener(){
  firebaseDB.ref('tscric/sensors').on('value',snap=>{
    const data=snap.val();
    if(data){lastData=data;isConnected=true;lastDataTime=Date.now();setConnectionStatus('online');updateDashboard(data);updateLastUpdateTime();}
  },err=>{console.error(err);isConnected=false;setConnectionStatus('error');});
}

function startConfigListener(){
  firebaseDB.ref('tscric/config').on('value',snap=>{
    const cfg=snap.val(); if(!cfg) return;
    if(cfg.plotArea!==undefined){
      const area=parseFloat(cfg.plotArea);
      if(area>=1&&area<=100000){
        localConfig.plotArea_m2=area; localConfig.plotArea_bigha=area/BIGHA_TO_M2;
        silentFill('plotAreaM2',area.toFixed(2)); silentFill('plotAreaBigha',(area/BIGHA_TO_M2).toFixed(6));
        updatePreviewCard(localConfig.crop,area); updateLiveAreaBanner(area);
      }
    }
    if(cfg.crop!==undefined){
      const c=parseInt(cfg.crop); if(c>=0&&c<=7){
        localConfig.crop=c; const sel=document.getElementById('cropSelectMain'); if(sel) sel.value=c;
        updatePreviewCard(c,localConfig.plotArea_m2);
      }
    }
    if(cfg.weatherLocation!==undefined&&WEATHER_LOCATIONS[cfg.weatherLocation]){
      selectedWeatherLocation=cfg.weatherLocation; localConfig.weatherLocation=cfg.weatherLocation;
      const sel=document.getElementById('weatherLocation'); if(sel) sel.value=cfg.weatherLocation;
      onWeatherLocationChange(cfg.weatherLocation);
    }
  });
}

function saveConfig(){
  if(!firebaseDB){showAlert("Firebase not connected");return;}
  const m2=localConfig.plotArea_m2;
  const loc=WEATHER_LOCATIONS[localConfig.weatherLocation]||WEATHER_LOCATIONS.bhopal;
  firebaseDB.ref('tscric/config').set({
    plotArea:parseFloat(m2.toFixed(2)), plotArea_bigha:parseFloat((m2/BIGHA_TO_M2).toFixed(6)),
    crop:localConfig.crop, cropName:CROP_DATA[localConfig.crop].name,
    weatherLocation:localConfig.weatherLocation, weatherLocationLabel:loc.label,
    weatherLat:loc.lat, weatherLon:loc.lon, weatherAlt:loc.alt, updatedAt:Date.now()
  }).then(()=>{showSavedBadge();updateLiveAreaBanner(m2);})
    .catch(e=>showAlert("Save failed: "+e.message));
}

function sendCmd(cmd){
  if(!firebaseDB){showAlert("Firebase not connected");return;}
  const MAP={pump_on:{pumpOn:true,pumpOff:false},pump_off:{pumpOn:false,pumpOff:true},auto_on:{auto:true},manual_on:{auto:false}};
  firebaseDB.ref('tscric/commands').update(MAP[cmd]).catch(e=>showAlert("Command error: "+e.message));
}

function saveCalibration(){
  if(!firebaseDB){showAlert("Firebase not connected");return;}
  const payload={soilCalib:{}};
  for(let i=0;i<3;i++){
    const d={
      adc_dry:parseInt(document.getElementById('calib_dry_'+i)?.value)||calibData[i].adc_dry,
      adc_fc: parseInt(document.getElementById('calib_fc_'+i)?.value) ||calibData[i].adc_fc,
      adc_pwp:parseInt(document.getElementById('calib_pwp_'+i)?.value)||calibData[i].adc_pwp,
      vwc_fc: parseFloat(document.getElementById('vwc_fc_'+i)?.value) ||calibData[i].vwc_fc,
      vwc_pwp:parseFloat(document.getElementById('vwc_pwp_'+i)?.value)||calibData[i].vwc_pwp
    };
    calibData[i]=d; payload.soilCalib['ch'+i]=d;
  }
  firebaseDB.ref('tscric/config').update(payload).then(()=>{
    const b=document.getElementById('calibSavedBadge');
    if(b){b.style.display='inline-block';setTimeout(()=>b.style.display='none',3000);}
  }).catch(e=>showAlert("Calib save failed: "+e.message));
}
// ============================================================
// MASTER DASHBOARD UPDATE
// ============================================================
function updateDashboard(d){
  const sm1=fv(d.sm1),sm2=fv(d.sm2),sm3=fv(d.sm3),csmi=fv(d.csmi);
  setText('sm1Val',sm1.toFixed(1)+'%'); setText('sm2Val',sm2.toFixed(1)+'%');
  setText('sm3Val',sm3.toFixed(1)+'%'); setText('csmiVal',csmi.toFixed(1)+'%');
  setBarHeight('bar1',sm1); setBarHeight('bar2',sm2); setBarHeight('bar3',sm3); setBarHeight('barCSMI',csmi);

  setText('tempVal',fv(d.temperature).toFixed(1)); setText('humVal',fv(d.humidity).toFixed(0));
  setText('presVal',fv(d.pressure).toFixed(1));    setText('flowVal',fv(d.flowRate).toFixed(2));
  setText('aiScore',fv(d.aiScore).toFixed(1));
  setText('smvVal',fv(d.smv).toFixed(4));    setText('smaVal',fv(d.sma).toFixed(4));
  setText('tprVal',fv(d.tprScore).toFixed(3));setText('etoVal',fv(d.eto).toFixed(2));
  setText('rainVal',fv(d.rainProb).toFixed(0));
  setText('cropName',d.crop||'--'); setText('stageName',d.stage||'--'); setText('gddVal',fv(d.gdd).toFixed(0));

  // OWM
  const owmOK=d.owm_valid===true;
  setText('owmTemp',    owmOK?fv(d.owm_temp).toFixed(1)+' \u00b0C':'--');
  setText('owmHumidity',owmOK?fv(d.owm_humidity).toFixed(0)+' %':'--');
  setText('owmPressure',owmOK?fv(d.owm_pressure).toFixed(1)+' hPa':'--');
  setText('owmRain',    owmOK?fv(d.owm_rain_mm).toFixed(2)+' mm':'--');
  const owmEl=document.getElementById('owmStatus');
  if(owmEl){owmEl.textContent=owmOK?'\ud83d\udfe2 OWM Live':'\ud83d\udd34 OWM Unavailable';owmEl.className='owm-status '+(owmOK?'owm-live':'owm-dead');}

  // Comparison
  if(owmOK){
    const td=fv(d.temperature)-fv(d.owm_temp), hd=fv(d.humidity)-fv(d.owm_humidity);
    setText('cmpTemp',(td>=0?'+':'')+td.toFixed(1)+' \u00b0C vs OWM');
    setText('cmpHum', (hd>=0?'+':'')+hd.toFixed(0)+' % vs OWM');
    setEl('cmpTemp',el=>el.style.color=Math.abs(td)>3?'var(--orange)':'var(--green-light)');
    setEl('cmpHum', el=>el.style.color=Math.abs(hd)>10?'var(--orange)':'var(--green-light)');
  } else {
    setText('cmpTemp','OWM offline'); setText('cmpHum','OWM offline');
  }

  updateSensorHealth(d);

  // Water budget
  const applied=fv(d.deltaApplied),required=fv(d.deltaRequired),balance=fv(d.deltaBalance);
  const totalFlow=fv(d.totalLitres),effRain=fv(d.effectiveRain),estRain=fv(d.estimatedRain),rainCtrib=fv(d.rainfallContrib);
  setText('appliedVal',  applied.toFixed(1)+' L'); setText('requiredVal',required.toFixed(1)+' L');
  setText('balanceVal',  balance.toFixed(1)+' L'); setText('totalFlowVal',totalFlow.toFixed(1)+' L');
  setText('rainfallContrib',rainCtrib.toFixed(1)+' L');
  const pct=required>0?Math.min((applied/required)*100,100):0;
  setEl('budgetProgress',el=>el.style.width=pct.toFixed(1)+'%');
  setText('budgetPct',pct.toFixed(1)+'% of seasonal budget used');
  const eff=required>0?Math.min(((applied+rainCtrib)/required)*100,100):0;
  setText('irrigEfficiency',eff.toFixed(1)+'%');

  // Rainfall
  const tipMM=fv(d.tipBucket_mm), owmMM=owmOK?fv(d.owm_rain_mm):0;
  setText('tipBucketVal',   tipMM>0 ?tipMM.toFixed(2)+' mm':'No data');
  setText('owmRainfall',    owmMM>0 ?owmMM.toFixed(2)+' mm':'No data');
  setText('estimatedRainVal',estRain>0?'~'+estRain.toFixed(1)+' mm':'None detected');
  setText('effectiveRainVal',effRain.toFixed(2)+' mm');

  const rainProb=fv(d.rainProb);
  setText('rainProbVal',rainProb.toFixed(0)+'%');
  const rpBar=document.getElementById('rainProbBar');
  if(rpBar){rpBar.style.width=rainProb+'%';rpBar.style.background=rainProb>75?'#f85149':rainProb>35?'#f0a500':'#2ea043';}
  setText('rainCategory',rainProb<20?'\u2600\ufe0f Clear':rainProb<40?'\u26c5 Possible':rainProb<70?'\ud83c\udf26\ufe0f Likely':'\ud83c\udf27\ufe0f Rain Expected');

  // Pump
  const pumpOn=d.pump||false, autoMode=d.autoMode!==undefined?d.autoMode:true, faultOn=d.pipelineFault||false;
  setText('pumpStatusText',pumpOn?'\ud83d\udca7 PUMP ON':'\u2b55 PUMP OFF');
  setText('pumpModeText',autoMode?'\ud83e\udd16 Auto Mode':'\u270b Manual Mode');
  setEl('pumpIndicator',el=>el.className='pump-indicator'+(pumpOn?' on':''));
  setDisplay('faultBanner',faultOn?'block':'none');

  // Mode banners
  const safeMode=d.safeMode||false, offlineMode=d.offlineMode||false, adaptiveMode=d.adaptiveMode||false;
  setDisplay('safeModePanel',safeMode?'block':'none');
  setDisplay('offlineBanner',(offlineMode||adaptiveMode)?'block':'none');
  if(offlineMode||adaptiveMode) setText('offlineBannerMsg',adaptiveMode?'\ud83c\udf3f Adaptive Root-Zone Control Mode (Offline)':'\ud83d\udce1 Autonomous Offline Mode \u2014 Data stored locally');

  setDisplay('dhtFallbackBadge',(d.dhtFallback||false)?'inline-block':'none');
  setDisplay('bmpFallbackBadge',(d.bmpFallback||false)?'inline-block':'none');

  // AI circle color
  const score=fv(d.aiScore);
  setEl('aiCircle',el=>el.className='ai-circle '+(score>=65?'high':score>=35?'medium':'low'));

  // Remaining
  const daysRem=balance>0&&fv(d.eto)>0?((balance/(fv(d.eto)*(fv(d.plotArea_m2)||localConfig.plotArea_m2)*0.001)).toFixed(0)):'0';
  setText('daysRemaining',daysRem+' days'); setText('balRemaining',balance.toFixed(1)+' L');
  if(d.plotArea_m2) updateLiveAreaBanner(parseFloat(d.plotArea_m2));
  setText('connMode',d.wifiMode||'--');

  const wifiOnline=(d.wifiMode==='Online');
  setText('connStatus2',wifiOnline?'\ud83d\udfe2 Online':'\ud83d\udd34 Offline / Hotspot');
  setEl('connStatus2',el=>{el.style.background=wifiOnline?'rgba(46,160,67,0.15)':'rgba(248,81,73,0.12)';el.style.color=wifiOnline?'var(--green-light)':'var(--red)';});
  setText('loraStatus','Active');
  const pendingLogs=fv(d.offlineLogCount)||0;
  setText('offlineLogCount',pendingLogs>0?pendingLogs+' pending':'0 (synced)');
  setEl('offlineLogCount',el=>el.style.color=pendingLogs>0?'var(--orange)':'var(--green-light)');
  setText('cropStageInfo','Stage: '+(d.stage||'--')+'\u00a0|\u00a0GDD: '+fv(d.gdd).toFixed(0)+' \u00b0C\u00b7day');
  setText('owmPressure2',owmOK?'OWM: '+fv(d.owm_pressure).toFixed(1)+' hPa':'OWM: --');

  // History on pump ON
  if(pumpOn&&!lastPumpState){
    addHistoryEntry({time:new Date().toLocaleTimeString(),csmi:csmi.toFixed(1),ai:score.toFixed(1),dose:totalFlow.toFixed(1),reason:adaptiveMode?'Adaptive':autoMode?'Auto-AI':'Manual'});
  }
  lastPumpState=pumpOn;

  // v4.0 extensions
  appendChartData(d,owmOK);
  updateExplainabilityEngine(d,owmOK);
  runAlertEngine(d,owmOK);
  updateFaultDiagnostics(d);
  updateTippingBucketPanel(d);
  updateLoRaDiagnostics(d);
  updateSoilHealthEstimates(d);
  lastData=d;
}

// ============================================================
// SENSOR HEALTH
// ============================================================
function updateSensorHealth(d){
  const allFail=d.safeMode||false;
  const s1f=allFail||(fv(d.sm1)<=0&&fv(d.csmi)<=0);
  const s2f=allFail||(fv(d.sm2)<=0&&fv(d.csmi)<=0);
  const s3f=allFail||(fv(d.sm3)<=0&&fv(d.csmi)<=0);
  const items=[
    {id:'sh_sm1',name:'SM1 (15cm)',ok:!s1f,fb:false},
    {id:'sh_sm2',name:'SM2 (30cm)',ok:!s2f,fb:false},
    {id:'sh_sm3',name:'SM3 (45cm)',ok:!s3f,fb:false},
    {id:'sh_dht',name:'DHT22',ok:!d.dhtFallback,fb:d.dhtFallback},
    {id:'sh_bmp',name:'BMP280',ok:!d.bmpFallback,fb:d.bmpFallback},
    {id:'sh_flow',name:'YF-S201',ok:!d.pipelineFault,fb:false},
    {id:'sh_lora',name:'LoRa SX1278',ok:true,fb:false}
  ];
  items.forEach(s=>{
    const el=document.getElementById(s.id); if(!el) return;
    if(s.fb) el.innerHTML=`<span class="sh-dot warn"></span><span class="sh-name">${s.name}</span><span class="sh-stat warn">OWM Fallback</span>`;
    else el.innerHTML=`<span class="sh-dot ${s.ok?'ok':'fail'}"></span><span class="sh-name">${s.name}</span><span class="sh-stat ${s.ok?'ok':'fail'}">${s.ok?'OK':'FAULT'}</span>`;
  });
}

// ============================================================
// HELPERS
// ============================================================
function fv(v,def=0){return isNaN(parseFloat(v))?def:parseFloat(v);}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function setDisplay(id,d){const e=document.getElementById(id);if(e)e.style.display=d;}
function setEl(id,fn){const e=document.getElementById(id);if(e)fn(e);}
function silentFill(id,v){const e=document.getElementById(id);if(e)e.value=v;}
function setBarHeight(id,pct){const el=document.getElementById(id);if(!el)return;el.style.height=Math.max(2,Math.min(100,pct))+'%';}
function showAlert(msg){const b=document.getElementById('alertBar');if(b){b.style.display='block';b.innerText=msg;}}
function showSavedBadge(){const b=document.getElementById('configSavedBadge');if(b){b.style.display='inline-block';setTimeout(()=>b.style.display='none',3000);}}
function updateLastUpdateTime(){setText('lastUpdate','Updated '+new Date().toLocaleTimeString());}
function updateLiveAreaBanner(area_m2){const el=document.getElementById('liveArea');if(el)el.innerHTML=area_m2.toFixed(2)+' m\u00b2 ('+( area_m2/BIGHA_TO_M2).toFixed(4)+' Bigha)';}

function updatePreviewCard(cropIdx,area_m2){
  const crop=CROP_DATA[cropIdx]||CROP_DATA[0];
  const need=crop.delta*area_m2,bigha=area_m2/BIGHA_TO_M2;
  setText('prevDelta',crop.delta+' mm'); setText('prevArea',area_m2.toFixed(2)+' m\u00b2');
  setText('prevBigha',bigha.toFixed(6)+' Bigha'); setText('prevNeed',need.toFixed(1)+' L');
  setText('prevFC',crop.fc+'%'); setText('prevPWP',crop.pwp+'%');
}

function onCropChange(val){localConfig.crop=parseInt(val);updatePreviewCard(localConfig.crop,localConfig.plotArea_m2);}
function onM2Input(val){
  if(updatingM2)return;
  const m2=parseFloat(val); if(isNaN(m2))return;
  localConfig.plotArea_m2=m2; localConfig.plotArea_bigha=m2/BIGHA_TO_M2;
  updatingBigha=true; silentFill('plotAreaBigha',localConfig.plotArea_bigha.toFixed(6)); updatingBigha=false;
  updatePreviewCard(localConfig.crop,m2);
}
function onBighaInput(val){
  if(updatingBigha)return;
  const bigha=parseFloat(val); if(isNaN(bigha))return;
  const m2=bigha*BIGHA_TO_M2; localConfig.plotArea_m2=m2; localConfig.plotArea_bigha=bigha;
  updatingM2=true; silentFill('plotAreaM2',m2.toFixed(2)); updatingM2=false;
  updatePreviewCard(localConfig.crop,m2);
}
function onWeatherLocationChange(val){
  selectedWeatherLocation=val; localConfig.weatherLocation=val;
  const loc=WEATHER_LOCATIONS[val];
  if(loc){setText('weatherLocationInfo','\ud83d\udccd Lat: '+loc.lat+'\u00b0N  |  Lon: '+loc.lon+'\u00b0E  |  Alt: '+loc.alt+' m');setText('weatherLocBanner',loc.label);fetchOWMDirect();}
}

function addHistoryEntry(entry){
  irrigHistory.unshift(entry); if(irrigHistory.length>MAX_HISTORY)irrigHistory.pop();
  try{localStorage.setItem('tscric_history',JSON.stringify(irrigHistory));}catch(e){}
  renderHistory();
}
function loadHistory(){try{const s=localStorage.getItem('tscric_history');if(s)irrigHistory=JSON.parse(s);renderHistory();}catch(e){}}
function renderHistory(){
  const tbody=document.getElementById('historyBody'); if(!tbody)return;
  if(!irrigHistory.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#8b949e">No events yet</td></tr>';return;}
  tbody.innerHTML=irrigHistory.map(e=>`<tr><td>${e.time}</td><td>${e.csmi}%</td><td>${e.ai}</td><td>${e.dose} L</td><td><span class="badge badge-${e.reason==='Manual'?'manual':e.reason==='Adaptive'?'tpr':'auto'}">${e.reason}</span></td></tr>`).join('');
}

function connectionWatchdog(){
  const stale=(Date.now()-lastDataTime)/1000;
  if(lastDataTime>0&&stale>60){
    isConnected=false; setConnectionStatus('offline'); setDisplay('offlineBanner','block');
    setText('offlineBannerMsg','\u26a0\ufe0f No data for '+Math.round(stale)+'s \u2014 Device may be offline');
    if(stale>300) addAlert('warning','\u26a0\ufe0f Long Offline Period','No sensor data for '+Math.round(stale/60)+' minutes. Device offline or hotspot-only mode.',false,'alert_watchdog');
  }
}
function setConnectionStatus(status){
  const text=document.getElementById('connStatus'),dot=document.getElementById('connDot');
  if(!text)return;
  const map={online:{t:'\ud83d\udfe2 Live',c:'status-dot online'},offline:{t:'\ud83d\udfe1 Offline',c:'status-dot offline'},error:{t:'\ud83d\udd34 Error',c:'status-dot error'}};
  const s=map[status]||map.error; text.innerText=s.t; if(dot)dot.className=s.c;
}

// ============================================================
// OWM DIRECT
// ============================================================
async function fetchOWMDirect(){
  const loc=WEATHER_LOCATIONS[selectedWeatherLocation]||WEATHER_LOCATIONS.bhopal;
  const wUrl='https://api.openweathermap.org/data/2.5/weather?lat='+loc.lat+'&lon='+loc.lon+'&appid='+OWM_DIRECT_KEY+'&units=metric';
  const fUrl='https://api.openweathermap.org/data/2.5/forecast?lat='+loc.lat+'&lon='+loc.lon+'&appid='+OWM_DIRECT_KEY+'&units=metric&cnt=4';
  try{
    const [r1,r2]=await Promise.all([fetch(wUrl),fetch(fUrl)]);
    if(!r1.ok)return;
    const j=await r1.json(); const jf=r2.ok?await r2.json():null;
    let rainProb=0; if(jf&&jf.list) jf.list.forEach(s=>{if(s.pop!==undefined&&s.pop*100>rainProb)rainProb=s.pop*100;});
    owmDirectData={owm_temp:j.main?j.main.temp:null,owm_humidity:j.main?j.main.humidity:null,owm_pressure:j.main?j.main.pressure:null,owm_rain_mm:j.rain?(j.rain['1h']||j.rain['3h']||0):0,owm_rain_prob:rainProb,owm_valid:true};
    setText('owmTemp',  owmDirectData.owm_temp!==null?owmDirectData.owm_temp.toFixed(1)+' \u00b0C':'--');
    setText('owmHumidity',owmDirectData.owm_humidity!==null?owmDirectData.owm_humidity.toFixed(0)+' %':'--');
    setText('owmPressure', owmDirectData.owm_pressure!==null?owmDirectData.owm_pressure.toFixed(1)+' hPa':'--');
    setText('owmRain',   owmDirectData.owm_rain_mm>0?owmDirectData.owm_rain_mm.toFixed(2)+' mm':'0.00 mm');
    setText('owmRainfall',owmDirectData.owm_rain_mm>0?owmDirectData.owm_rain_mm.toFixed(2)+' mm':'0.00 mm');
    setText('owmPressure2','OWM: '+(owmDirectData.owm_pressure!==null?owmDirectData.owm_pressure.toFixed(1)+' hPa':'--'));
    const el=document.getElementById('owmStatus'); if(el){el.textContent='\ud83d\udfe2 OWM Live';el.className='owm-status owm-live';}
    if(!lastData){
      setText('rainVal',rainProb.toFixed(0)); setText('rainProbVal',rainProb.toFixed(0)+'%');
      const bar=document.getElementById('rainProbBar');
      if(bar){bar.style.width=(rainProb>0?rainProb:2)+'%';bar.style.background=rainProb>75?'#f85149':rainProb>35?'#f0a500':'#2ea043';}
      setText('rainCategory',rainProb<20?'\u2600\ufe0f Clear':rainProb<40?'\u26c5 Possible':rainProb<70?'\ud83c\udf26\ufe0f Likely':'\ud83c\udf27\ufe0f Rain Expected');
    }
    if(rainProb>80) addAlert('info','\ud83c\udf27\ufe0f Heavy Rain Forecast','Rain probability '+rainProb.toFixed(0)+'%. Irrigation will be suppressed automatically.',true,'alert_heavyrain');
  }catch(e){console.warn('OWM fetch failed:',e.message);}
}
// ============================================================
// v4.0 — SMART ALERT ENGINE
// ============================================================
function addAlert(severity,title,message,autoDismiss,id){
  const alertId=id||('alert_'+(++alertIdCounter));
  if(alertList_data.some(a=>a.id===alertId))return;
  alertList_data.unshift({id:alertId,severity,title,message,time:new Date().toLocaleTimeString(),autoDismiss});
  if(alertList_data.length>30)alertList_data.pop();
  renderAlertCenter();
  showToast(severity,title,message,autoDismiss?6000:0);
}

function dismissAlert(alertId){
  alertList_data=alertList_data.filter(a=>a.id!==alertId);
  renderAlertCenter();
}

function clearAllAlerts(){
  alertList_data=alertList_data.filter(a=>!a.autoDismiss);
  renderAlertCenter();
}

function renderAlertCenter(){
  const listEl=document.getElementById('alertList');
  const countEl=document.getElementById('alertBadgeCount');
  if(!listEl)return;
  const critCount=alertList_data.filter(a=>a.severity==='critical').length;
  if(countEl){
    countEl.textContent=alertList_data.length;
    countEl.className='alert-badge-count'+(alertList_data.length===0?' zero':'');
    if(critCount>0)countEl.style.background='var(--red)';
    else if(alertList_data.length>0)countEl.style.background='var(--orange)';
    else countEl.style.background='';
  }
  if(!alertList_data.length){listEl.innerHTML='<div class="alert-empty">\u2705 No active alerts \u2014 all systems nominal</div>';return;}
  listEl.innerHTML=alertList_data.map(a=>`
    <div class="alert-item sev-${a.severity}">
      <span class="alert-sev-dot"></span>
      <div class="alert-item-body">
        <div class="alert-item-title">${a.title}</div>
        <div class="alert-item-msg">${a.message}</div>
        <div class="alert-item-time">${a.time}</div>
      </div>
      <button class="alert-item-dismiss" onclick="dismissAlert('${a.id}')" title="Dismiss">\u2715</button>
    </div>`).join('');
}

function showToast(severity,title,message,duration){
  const container=document.getElementById('toast-container'); if(!container)return;
  const toast=document.createElement('div');
  toast.className=`toast toast--${severity==='critical'?'critical':severity==='warning'?'warning':severity==='success'?'success':'info'}`;
  const icons={critical:'\ud83d\udea8',warning:'\u26a0\ufe0f',info:'\u2139\ufe0f',success:'\u2705'};
  const dur=duration||(severity==='critical'?0:5000);
  toast.innerHTML=`<span class="toast-icon">${icons[severity]||'\u2139\ufe0f'}</span><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${message}</div></div><button class="toast-close" onclick="this.closest('.toast').remove()">\u2715</button>${dur>0?`<div class="toast-progress" style="animation-duration:${dur}ms;color:${severity==='critical'?'var(--red)':severity==='warning'?'var(--orange)':'var(--blue)'}"></div>`:''}`;
  container.appendChild(toast);
  if(dur>0)setTimeout(()=>{toast.classList.add('toast-exit');setTimeout(()=>toast.remove(),300);},dur);
}

function runAlertEngine(d,owmValid){
  const csmi=fv(d.csmi),flow=fv(d.flowRate),aiS=fv(d.aiScore),pumpOn=d.pump||false;

  if(csmi>0&&csmi<18){addAlert('critical','\ud83c\udf35 Critical Soil Moisture','CSMI '+csmi.toFixed(1)+'% \u2014 root zone severely dry. Immediate irrigation required.',false,'alert_lowsoil');}
  else if(csmi>0&&csmi<28){addAlert('warning','\u26a0\ufe0f Low Soil Moisture','CSMI '+csmi.toFixed(1)+'% below optimal. Schedule irrigation soon.',true,'alert_soil_warn');}
  else{alertList_data=alertList_data.filter(a=>a.id!=='alert_lowsoil'&&a.id!=='alert_soil_warn');renderAlertCenter();}

  if(csmi>80&&pumpOn) addAlert('warning','\ud83d\udca6 Overwatering Risk','Soil moisture '+csmi.toFixed(1)+'% with pump ON. Risk of deep percolation.',false,'alert_overwater');

  if(d.safeMode) addAlert('critical','\ud83d\udd34 All Soil Sensors Failed','Safe Mode activated \u2014 all 3 soil sensors offline. Check CD4051 MUX wiring immediately.',false,'alert_safemode');
  else{alertList_data=alertList_data.filter(a=>a.id!=='alert_safemode');renderAlertCenter();}

  if(d.pipelineFault) addAlert('critical','\ud83d\udeb0 Pipeline Fault','No flow detected while pump ON. Check for blockage, burst pipe, or empty tank.',false,'alert_pipeline');
  else{alertList_data=alertList_data.filter(a=>a.id!=='alert_pipeline');renderAlertCenter();}

  if(d.dhtFallback) addAlert('warning','\ud83c\udf21\ufe0f DHT22 Fault','Temperature/Humidity sensor failed. OWM fallback active.',true,'alert_dht');
  if(d.bmpFallback) addAlert('warning','\ud83c\udf00 BMP280 Fault','Pressure sensor failed. OWM fallback active.',true,'alert_bmp');

  if(d.offlineMode&&fv(d.offlineLogCount)>=40)
    addAlert('warning','\ud83d\udce1 EEPROM Near Full',fv(d.offlineLogCount)+' offline events pending. Buffer approaching 50-event limit.',true,'alert_eeprom');

  if(aiS>100) addAlert('warning','\ud83e\udd16 High AI Score','AI Score '+aiS.toFixed(1)+'/120 \u2014 extreme irrigation urgency.',true,'alert_hiai');

  if(!pumpOn&&flow>0.5){addAlert('critical','\ud83d\udca7 Flow Detected \u2014 Pump OFF','Flow '+flow.toFixed(2)+' L/min detected while pump OFF. Possible leakage or pipe burst!',false,'alert_flow_leak');}
  else{alertList_data=alertList_data.filter(a=>a.id!=='alert_flow_leak');renderAlertCenter();}
}

// ============================================================
// v4.0 — AI EXPLAINABILITY ENGINE
// ============================================================
function updateExplainabilityEngine(d,owmValid){
  const explainBody=document.getElementById('explainBody');
  const decisionText=document.getElementById('decisionText');
  if(!explainBody||!d)return;
  const csmi=fv(d.csmi),sm1=fv(d.sm1),sm2=fv(d.sm2),sm3=fv(d.sm3);
  const aiScore=fv(d.aiScore),rainProb=fv(d.rainProb),eto=fv(d.eto),flow=fv(d.flowRate),pumpOn=d.pump||false;
  const crop=CROP_DATA[localConfig.crop];
  const cards=[];

  // Soil analysis
  if(csmi<20) cards.push({type:'alert',icon:'\ud83c\udf35',title:'Critical Root-Zone Depletion',text:`CSMI ${csmi.toFixed(1)}% \u2014 deep zone (${sm3.toFixed(1)}% at 45cm) below Permanent Wilting Point. Immediate irrigation required to prevent permanent crop damage.`,badge:'CRITICAL',badgeType:'alert'});
  else if(csmi<35) cards.push({type:'warn',icon:'\u26a0\ufe0f',title:'Root-Zone Below Field Capacity',text:`CSMI ${csmi.toFixed(1)}% \u2014 SM1:${sm1.toFixed(1)}%, SM2:${sm2.toFixed(1)}%, SM3:${sm3.toFixed(1)}%. Approaching lower threshold. Plan irrigation within 2\u20134 hours.`,badge:'DRY',badgeType:'warn'});
  else if(csmi>70) cards.push({type:'info',icon:'\ud83d\udca6',title:'Root-Zone Near Field Capacity',text:`CSMI ${csmi.toFixed(1)}% \u2014 high moisture across all depths. Deep sensor (${sm3.toFixed(1)}%) shows good retention. No irrigation needed; monitor for deep percolation.`,badge:'WET',badgeType:'info'});
  else cards.push({type:'good',icon:'\u2705',title:'Optimal Root-Zone Moisture',text:`CSMI ${csmi.toFixed(1)}% in optimal range \u2014 SM1:${sm1.toFixed(1)}%, SM2:${sm2.toFixed(1)}%, SM3:${sm3.toFixed(1)}%. Crop water demand is being met.`,badge:'OPTIMAL',badgeType:'good'});

  // Depth profile
  const surfDiff=sm1-sm3;
  if(surfDiff>15) cards.push({type:'info',icon:'\ud83c\udf0a',title:'Surface Wetter Than Deep Zone',text:`Surface (${sm1.toFixed(1)}%) is ${surfDiff.toFixed(1)}% wetter than deep zone (${sm3.toFixed(1)}%). Infiltration front moving downward. Recent irrigation or rainfall detected.`,badge:'INFILTRATING',badgeType:'info'});
  else if(surfDiff<-10) cards.push({type:'warn',icon:'\ud83c\udf31',title:'Deep Zone Retaining More Moisture',text:`Deep zone (${sm3.toFixed(1)}%) holds more moisture than surface (${sm1.toFixed(1)}%). Surface evaporation active. Consider mulching to reduce moisture loss.`,badge:'EVAP LOSS',badgeType:'warn'});

  // Rain suppression
  if(rainProb>75) cards.push({type:'info',icon:'\ud83c\udf27\ufe0f',title:'Irrigation Suppressed \u2014 High Rain Probability',text:`Rain probability ${rainProb.toFixed(0)}% (threshold: 75%). Irrigation auto-delayed. Expected rainfall will contribute to root-zone moisture budget.`,badge:'RAIN DELAY',badgeType:'info'});
  else if(rainProb>35) cards.push({type:'warn',icon:'\u26c5',title:'Moderate Rain Probability \u2014 Monitoring',text:`Rain probability ${rainProb.toFixed(0)}%. System monitoring. If rain occurs, irrigation cancelled. Otherwise, normal scheduling resumes.`,badge:'MONITORING',badgeType:'warn'});

  // ETo
  if(eto>6) cards.push({type:'warn',icon:'\u2600\ufe0f',title:'High Evapotranspiration Demand',text:`ETo ${eto.toFixed(2)} mm/day indicates high atmospheric water demand. Irrigation frequency should increase to compensate for accelerated soil moisture depletion.`,badge:'HIGH ETo',badgeType:'warn'});

  // Flow
  if(pumpOn&&flow<0.5) cards.push({type:'alert',icon:'\ud83d\udeb0',title:'Low Flow During Active Pump',text:`Pump ON but flow only ${flow.toFixed(2)} L/min. Possible pipe blockage, air lock, empty tank, or pump failure. Check pipeline immediately.`,badge:'FLOW FAULT',badgeType:'alert'});
  else if(pumpOn&&flow>0) cards.push({type:'good',icon:'\u2705',title:'Water Delivery Confirmed',text:`Pump ON \u2014 flow confirmed at ${flow.toFixed(2)} L/min. Water reaching field. Monitor soil sensors for root-zone response.`,badge:'DELIVERING',badgeType:'good'});

  // AI score
  if(aiScore>=65) cards.push({type:'warn',icon:'\ud83e\udd16',title:`AI Score ${aiScore.toFixed(1)}/120 \u2014 Irrigation Triggered`,text:`Score crossed 65-point threshold. Integrates CSMI (${csmi.toFixed(1)}%), moisture velocity (SMV), temporal pattern (TPR), and ETo demand. All conditions satisfied.`,badge:'TRIGGERED',badgeType:'warn'});
  else cards.push({type:'info',icon:'\ud83e\udd16',title:`AI Score ${aiScore.toFixed(1)}/120 \u2014 Monitoring`,text:`Score is ${(65-aiScore).toFixed(0)} points below trigger. System monitoring depletion rate (SMV) and temporal pattern (TPR: ${fv(d.tprScore).toFixed(3)}) until threshold crossed.`,badge:'MONITORING',badgeType:'info'});

  explainBody.innerHTML=cards.map(c=>`<div class="explain-card explain-${c.type}"><span class="explain-icon">${c.icon}</span><div class="explain-body"><div class="explain-title">${c.title}</div><div class="explain-text">${c.text}</div></div><span class="explain-badge ${c.badgeType}">${c.badge}</span></div>`).join('');

  if(decisionText){
    let dec='';
    if(d.safeMode) dec='<strong style="color:var(--red)">IRRIGATION SUSPENDED \u2014 SAFE MODE:</strong> All soil sensors offline. Check sensor wiring immediately.';
    else if(rainProb>75) dec=`<strong style="color:var(--rain-blue)">IRRIGATION DELAYED \u2014 RAIN EXPECTED:</strong> ${rainProb.toFixed(0)}% rain probability. System will resume after rain event.`;
    else if(csmi<25&&aiScore>=65) dec=`<strong style="color:var(--red)">IRRIGATION TRIGGERED:</strong> CSMI ${csmi.toFixed(1)}% below PWP AND AI Score ${aiScore.toFixed(1)} above 65. Pulse irrigation active (30s ON / 2min OFF). Flow sensor monitoring delivery.`;
    else if(csmi<35) dec=`<strong style="color:var(--orange)">IRRIGATION PENDING:</strong> CSMI ${csmi.toFixed(1)}% approaching trigger. AI Score ${aiScore.toFixed(1)}/65 required. Monitoring moisture depletion rate.`;
    else if(csmi>70) dec=`<strong style="color:var(--blue)">NO IRRIGATION NEEDED:</strong> Root-zone ${csmi.toFixed(1)}% above optimal. Pump will not activate until CSMI drops below stage threshold.`;
    else dec=`<strong style="color:var(--green-light)">MONITORING \u2014 OPTIMAL:</strong> CSMI ${csmi.toFixed(1)}% in optimal range for ${CROP_DATA[localConfig.crop].name}. AI Score ${aiScore.toFixed(1)}/120. Standard monitoring cycle active (10s interval).`;
    decisionText.innerHTML=dec;
  }
}

// ============================================================
// v4.0 — FAULT DIAGNOSTICS
// ============================================================
function updateFaultDiagnostics(d){
  const pumpOn=d.pump||false,flow=fv(d.flowRate);
  lastFlowRate=flow;
  const expFlow=5;

  // Leakage: flow when pump OFF
  const leakScore=(!pumpOn&&flow>0.3)?Math.min(100,flow*30):0;
  updateFaultCard('fd-leakage',leakScore,leakScore>50?'alert':leakScore>10?'warn':'ok',leakScore>50?'\ud83d\udea8 LEAKAGE DETECTED!':leakScore>10?'\u26a0\ufe0f Possible Leakage':'OK \u2014 Normal Flow',leakScore.toFixed(0)+'/100');

  // Dry-run: pump ON, no flow
  const dryScore=(pumpOn&&flow<0.3)?80:0;
  updateFaultCard('fd-dryrun',dryScore,dryScore>60?'alert':'ok',dryScore>60?'\ud83d\udd34 DRY-RUN RISK!':'OK \u2014 No Dry-Run',dryScore>60?'HIGH':'Low');

  // Blockage: low flow during pump
  const blockScore=(pumpOn&&flow>0&&flow<expFlow*0.4)?Math.round((1-flow/(expFlow*0.4))*100):0;
  updateFaultCard('fd-blockage',blockScore,blockScore>60?'alert':blockScore>30?'warn':'ok',blockScore>60?'\ud83d\udeab BLOCKAGE DETECTED':blockScore>30?'\u26a0\ufe0f Reduced Flow':'OK \u2014 Flow Normal',blockScore.toFixed(0)+'%');

  // Tampering: high flow when pump OFF
  const tamperScore=(flow>expFlow*2&&!pumpOn)?85:(!pumpOn&&flow>0.1?40:0);
  updateFaultCard('fd-theft',tamperScore,tamperScore>70?'alert':tamperScore>30?'warn':'ok',tamperScore>70?'\u26a0\ufe0f ABNORMAL FLOW!':tamperScore>30?'\u26a0\ufe0f Unusual Reading':'OK \u2014 No Anomaly',tamperScore>30?flow.toFixed(2)+' L/min unexpected':'None');
}

function updateFaultCard(id,score,state,statusText,detail){
  const card=document.getElementById(id);
  const sEl=document.getElementById(id+'-status');
  const bEl=document.getElementById(id+'-bar');
  const dEl=document.getElementById(id+'-score');
  if(!card)return;
  const colors={ok:'var(--green)',warn:'var(--orange)',alert:'var(--red)'};
  card.className='fault-card fault-'+state;
  if(sEl){sEl.textContent=statusText;sEl.className='fault-card-status '+state;}
  if(bEl){bEl.style.width=Math.min(100,score)+'%';bEl.style.background=colors[state];}
  if(dEl)dEl.textContent=detail;
}

// ============================================================
// v4.0 — TIPPING BUCKET RAINFALL
// ============================================================
function updateTippingBucketPanel(d){
  const tipMM=fv(d.tipBucket_mm),tipPulse=fv(d.tipBucket_pulses)||Math.round(tipMM/0.2);
  const rainMM=fv(d.owm_rain_mm)||tipMM;
  if(tipMM>tipAccum_mm)tipAccum_mm=tipMM;
  setText('tipPulseCount',tipPulse.toFixed(0)); setText('tipAccumMM',tipAccum_mm.toFixed(2));
  setText('rainIntensityInner',rainMM.toFixed(1)+' mm/h');
  const gaugeEl=document.getElementById('rainIntensityGauge');
  if(gaugeEl){const p=Math.min(100,(rainMM/25)*100);gaugeEl.style.background=`conic-gradient(var(--rain-blue) ${p*3.6}deg, var(--bg-tertiary) 0deg)`;}
  const S=(25400/75)-254,Ia=0.2*S;
  const runoff=tipAccum_mm>Ia?Math.pow(tipAccum_mm-Ia,2)/(tipAccum_mm-Ia+S):0;
  setText('runoffEstMM',runoff.toFixed(2));
  const eff=tipAccum_mm>0?Math.round(((tipAccum_mm-runoff)/tipAccum_mm)*100):0;
  setText('effectiveRainPct',eff.toString()); setEl('rainEffBar',el=>el.style.width=eff+'%');
  if(tipMM>0||(owmDirectData&&owmDirectData.owm_rain_mm>0))lastRainEvent=Date.now();
  if(lastRainEvent){setText('dryDaysCount',((Date.now()-lastRainEvent)/86400000).toFixed(0));}
  else setText('dryDaysCount','>7');
}

function checkRainfallIntelligence(){
  if(!lastData)return;
  const tipMM=fv(lastData.tipBucket_mm);
  if(tipMM>20)addAlert('info','\ud83c\udf27\ufe0f Significant Rainfall','Tipping bucket recorded '+tipMM.toFixed(1)+' mm. Irrigation suppressed. Water budget updated.',true,'alert_rain_event');
}

// ============================================================
// v4.0 — SOIL HEALTH ESTIMATES
// ============================================================
function updateSoilHealthEstimates(d){
  const data=d||lastData; if(!data)return;
  const csmi=fv(data.csmi),temp=fv(data.temperature);
  const soilTempReal=fv(data.soilTemp);
  const soilTemp=soilTempReal>0?soilTempReal:Math.max(0,temp-3-(csmi/100)*2);
  const ecReal=fv(data.ecValue);
  const ec=ecReal>0?ecReal:Math.max(0.2,2.5-(csmi/100)*1.2+(temp/100));
  const phReal=fv(data.phValue);
  const ph=phReal>0?phReal:6.5+(csmi>50?0.3:-0.2)+(temp>35?-0.1:0);
  const salinity=ec*640;

  setText('soilTempVal',soilTemp.toFixed(1)); setText('ecVal',ec.toFixed(2));
  setText('phVal',ph.toFixed(1)); setText('salinityVal',salinity.toFixed(0));

  const tStat=soilTemp<5||soilTemp>40?'critical':soilTemp<10||soilTemp>35?'caution':'optimal';
  const eStat=ec<0.5?'caution':ec>4?'critical':'optimal';
  const pStat=ph<5.5||ph>8.0?'critical':ph<6.0||ph>7.5?'caution':'optimal';
  const sStat=salinity>1500?'critical':salinity>800?'caution':'optimal';
  const sText={optimal:'\u2705 Optimal',caution:'\u26a0\ufe0f Caution',critical:'\ud83d\udd34 Critical'};
  setText('soilTempStatus',sText[tStat]); setText('ecStatus',sText[eStat]);
  setText('phStatus',sText[pStat]);       setText('salinityStatus',sText[sStat]);
  setEl('soilTempStatus',el=>el.className='soil-health-status '+tStat);
  setEl('ecStatus',el=>el.className='soil-health-status '+eStat);
  setEl('phStatus',el=>el.className='soil-health-status '+pStat);
  setEl('salinityStatus',el=>el.className='soil-health-status '+sStat);
  setEl('soilTempBar',el=>el.style.width=Math.min(100,(soilTemp/50)*100)+'%');
  setEl('ecBar',el=>el.style.width=Math.min(100,(ec/6)*100)+'%');
  setEl('phBar',el=>el.style.width=Math.min(100,(ph/14)*100)+'%');
  setEl('salinityBar',el=>el.style.width=Math.min(100,(salinity/2000)*100)+'%');

  if(pStat==='critical')addAlert('warning','\ud83e\uddea Soil pH Critical','pH estimated at '+ph.toFixed(1)+' \u2014 outside optimal range (6.0\u20137.5). Nutrient uptake may be impaired.',true,'alert_ph');
  if(eStat==='critical')addAlert('warning','\u26a1 High Soil Salinity','EC '+ec.toFixed(2)+' mS/cm indicates high salinity. Reduce fertilizer and increase leaching irrigation.',true,'alert_ec');
}

// ============================================================
// v4.0 — LoRa DIAGNOSTICS
// ============================================================
function updateLoRaDiagnostics(d){
  const data=d||lastData;
  if(data&&data.loraPackets)loraPacketCount=fv(data.loraPackets);
  else loraPacketCount++;
  const rssi=data?fv(data.loraRSSI):-85, snr=data?fv(data.loraSNR):8;
  loraTxTimestamp=Date.now();
  setText('loraRSSI',rssi!==0?rssi.toFixed(0)+' dBm':'-- dBm');
  setText('loraSNR',snr!==0?snr.toFixed(1)+' dB':'-- dB');
  setText('loraPacketsSent',loraPacketCount.toString());
  setText('loraTxAge','just now');
  const sigQual=rssi>-80?'Excellent':rssi>-100?'Good':rssi>-110?'Fair':'Weak';
  const sigColor=rssi>-80?'var(--green-light)':rssi>-100?'var(--teal)':rssi>-110?'var(--orange)':'var(--red)';
  setText('loraSignalQuality','Signal: '+sigQual);
  setEl('loraSignalQuality',el=>el.style.color=sigColor);
  const rssiPct=rssi!==0?Math.max(0,Math.min(100,((rssi+120)/60)*100)):60;
  setEl('loraRSSIBar',el=>el.style.width=rssiPct+'%');
  const netEl=document.getElementById('loraNetStatus');
  if(netEl){const isActive=data&&(data.offlineMode||data.wifiMode==='Offline');netEl.textContent=isActive?'\u25cf Fallback Active':'\u25cf Standby';netEl.style.color=isActive?'var(--orange)':'#b08eff';}
}
// ============================================================
// v4.0 — HISTORICAL CHARTS
// ============================================================
let currentChartTab='soilMoisture';

function switchChartTab(tabId,btn){
  currentChartTab=tabId;
  document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.chart-panel').forEach(p=>p.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const panel=document.getElementById('panel-'+tabId);
  if(panel)panel.classList.add('active');
}

function appendChartData(d,owmOK){
  if(!chartsReady||!window.Chart)return;
  const lbl=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const B=chartBuffers;
  B.labels.push(lbl); B.sm1.push(fv(d.sm1)); B.sm2.push(fv(d.sm2)); B.sm3.push(fv(d.sm3)); B.csmi.push(fv(d.csmi));
  B.flow.push(fv(d.flowRate)); B.aiScore.push(fv(d.aiScore)); B.eto.push(fv(d.eto));
  B.rainfall.push(fv(d.tipBucket_mm)||(owmOK?fv(d.owm_rain_mm):0));
  B.effectiveRain.push(fv(d.effectiveRain)); B.appliedL.push(fv(d.totalLitres));
  B.rainfallL.push(fv(d.rainfallContrib)); B.etoLoss.push(fv(d.eto)*(fv(d.plotArea_m2)||6)*0.001);
  B.temp.push(fv(d.temperature)); B.hum.push(fv(d.humidity));
  Object.keys(B).forEach(k=>{if(B[k].length>CHART_BUF)B[k].shift();});
  updateAllCharts();
  if(B.sm1.length>1){
    const avg=arr=>(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1);
    setText('cstat-sm1-avg',avg(B.sm1)+'%'); setText('cstat-sm2-avg',avg(B.sm2)+'%');
    setText('cstat-sm3-avg',avg(B.sm3)+'%'); setText('cstat-csmi-avg',avg(B.csmi)+'%');
    setText('cstat-ai-max',Math.max(...B.aiScore).toFixed(1));
    setText('cstat-ai-avg',avg(B.aiScore));
    setText('cstat-ai-triggers',B.aiScore.filter(s=>s>=65).length.toString());
  }
}

function initAllCharts(){
  if(!window.Chart)return;
  Chart.defaults.color='#8b949e'; Chart.defaults.borderColor='#30363d';
  const co={
    responsive:true,maintainAspectRatio:false,animation:{duration:300},
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#161b22',borderColor:'#30363d',borderWidth:1,titleColor:'#e6edf3',bodyColor:'#8b949e'}},
    scales:{x:{grid:{color:'rgba(48,54,61,0.5)'},ticks:{color:'#8b949e',maxTicksLimit:8,font:{size:10}}},y:{grid:{color:'rgba(48,54,61,0.5)'},ticks:{color:'#8b949e',font:{size:10}}}}
  };
  const coLeg={...co,plugins:{...co.plugins,legend:{display:true,labels:{color:'#8b949e',boxWidth:10,font:{size:10}}}}};

  createChart('chart-soilMoisture',{type:'line',data:{labels:[],datasets:[
    {label:'SM1 15cm',data:[],borderColor:'#56d364',backgroundColor:'rgba(86,211,100,0.08)',tension:0.4,pointRadius:2},
    {label:'SM2 30cm',data:[],borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,0.08)',tension:0.4,pointRadius:2},
    {label:'SM3 45cm',data:[],borderColor:'#f0a500',backgroundColor:'rgba(240,165,0,0.08)',tension:0.4,pointRadius:2},
    {label:'CSMI',    data:[],borderColor:'#2dff80',backgroundColor:'rgba(45,255,128,0.1)',tension:0.4,borderWidth:2,pointRadius:2}
  ]},options:{...coLeg,scales:{...coLeg.scales,y:{...coLeg.scales.y,min:0,max:100,ticks:{...coLeg.scales.y.ticks,callback:v=>v+'%'}}}}});

  createChart('chart-irrigation',{type:'bar',data:{labels:[],datasets:[
    {label:'Applied (L)',data:[],backgroundColor:'rgba(31,111,235,0.6)',borderColor:'#1f6feb',borderWidth:1}
  ]},options:{...co}});

  createChart('chart-rainfall',{type:'bar',data:{labels:[],datasets:[
    {label:'Rainfall (mm)', data:[],backgroundColor:'rgba(88,166,255,0.6)',borderColor:'#58a6ff',borderWidth:1},
    {label:'Effective (mm)',data:[],backgroundColor:'rgba(46,160,67,0.5)',borderColor:'#56d364',borderWidth:1}
  ]},options:{...coLeg}});

  createChart('chart-eto',{type:'line',data:{labels:[],datasets:[
    {label:'ETo (mm/day)',    data:[],borderColor:'#f85149',backgroundColor:'rgba(248,81,73,0.08)',tension:0.4,pointRadius:2},
    {label:'Eff. Rain (mm)', data:[],borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,0.08)',tension:0.4,pointRadius:2}
  ]},options:{...coLeg}});

  createChart('chart-aiScore',{type:'line',data:{labels:[],datasets:[
    {label:'AI Score',data:[],borderColor:'#39d353',backgroundColor:'rgba(57,211,83,0.1)',tension:0.4,pointRadius:2,fill:true}
  ]},options:{...co,scales:{...co.scales,y:{...co.scales.y,min:0,max:120}}}});

  createChart('chart-flowRate',{type:'line',data:{labels:[],datasets:[
    {label:'Flow Rate (L/min)',data:[],borderColor:'#00d4ff',backgroundColor:'rgba(0,212,255,0.08)',tension:0.4,pointRadius:2}
  ]},options:{...co}});

  createChart('chart-waterBalance',{type:'bar',data:{labels:[],datasets:[
    {label:'Applied (L)', data:[],backgroundColor:'rgba(88,166,255,0.6)',borderColor:'#58a6ff',borderWidth:1},
    {label:'Rainfall (L)',data:[],backgroundColor:'rgba(46,160,67,0.5)',borderColor:'#56d364',borderWidth:1},
    {label:'ETo Loss (L)',data:[],backgroundColor:'rgba(248,81,73,0.4)',borderColor:'#f85149',borderWidth:1}
  ]},options:{...coLeg}});

  createChart('chart-envSensors',{type:'line',data:{labels:[],datasets:[
    {label:'Temp (\u00b0C)',    data:[],borderColor:'#f85149',backgroundColor:'rgba(248,81,73,0.08)',tension:0.4,pointRadius:2,yAxisID:'y'},
    {label:'Humidity (%)',data:[],borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,0.08)',tension:0.4,pointRadius:2,yAxisID:'y1'}
  ]},options:{...coLeg,scales:{x:co.scales.x,y:{grid:{color:'rgba(48,54,61,0.5)'},ticks:{color:'#f85149',font:{size:10}},position:'left'},y1:{grid:{color:'rgba(48,54,61,0.2)'},ticks:{color:'#58a6ff',font:{size:10}},position:'right',min:0,max:100}}}});

  chartsReady=true;
}

function createChart(id,config){
  const canvas=document.getElementById(id); if(!canvas)return;
  if(chartInstances[id]){chartInstances[id].destroy();}
  try{chartInstances[id]=new Chart(canvas,config);}catch(e){console.warn('Chart create failed:',id,e);}
}

function updateAllCharts(){
  if(!chartsReady||!window.Chart)return;
  const B=chartBuffers;
  updateChart('chart-soilMoisture',B.labels,[B.sm1,B.sm2,B.sm3,B.csmi]);
  updateChart('chart-irrigation',  B.labels,[B.appliedL]);
  updateChart('chart-rainfall',    B.labels,[B.rainfall,B.effectiveRain]);
  updateChart('chart-eto',         B.labels,[B.eto,B.effectiveRain]);
  updateChart('chart-aiScore',     B.labels,[B.aiScore]);
  updateChart('chart-flowRate',    B.labels,[B.flow]);
  updateChart('chart-waterBalance',B.labels,[B.appliedL,B.rainfallL,B.etoLoss]);
  updateChart('chart-envSensors',  B.labels,[B.temp,B.hum]);
}

function updateChart(id,labels,dataSets){
  const chart=chartInstances[id]; if(!chart)return;
  chart.data.labels=[...labels];
  dataSets.forEach((ds,i)=>{if(chart.data.datasets[i])chart.data.datasets[i].data=[...ds];});
  chart.update('none');
}
// ============================================================
// AI FARM ASSISTANT (original v3.0 fully preserved)
// ============================================================
let aiChatHistory=[], aiIsLoading=false, aiChatBooted=false;

function initAIChat(){
  const container=document.getElementById('aiChatMessages'); if(!container)return;
  container.innerHTML='';
  const offlineMode=lastData&&lastData.offlineMode;
  const welcomeMsg=offlineMode?
    'Hello! I\'m your AI Farm Assistant (Offline Mode).\n\nSystem running in autonomous offline mode using last known configuration.\nUsing local sensor data and stored algorithms to guide irrigation decisions.\n\nAsk about soil condition, irrigation, rainfall, water balance, or system status.':
    '\ud83c\udf3e Hello! I\'m your TSCRIC-LoRa AI Farm Assistant.\n\nI have access to your live sensor data \u2014 soil moisture at 3 depths, temperature, humidity, rainfall, ETo, AI irrigation score, pump status, and water budget.\n\n**Ask me anything** about your farm or use the Quick Ask buttons above.\n\nAdvisory only: I guide decisions but never directly control hardware.';
  appendAIMessage('model',welcomeMsg,true);
}

function buildFarmContext(){
  if(!lastData)return "No live sensor data available yet \u2014 waiting for Firebase connection.";
  const d=lastData, _fv=v=>isNaN(parseFloat(v))?0:parseFloat(v);
  const sh=[
    (!d.safeMode&&_fv(d.sm1)>0)?"SM1(15cm) OK":"SM1(15cm) FAULT",
    (!d.safeMode&&_fv(d.sm2)>0)?"SM2(30cm) OK":"SM2(30cm) FAULT",
    (!d.safeMode&&_fv(d.sm3)>0)?"SM3(45cm) OK":"SM3(45cm) FAULT",
    d.dhtFallback?"DHT22 FAULT [OWM fallback]":"DHT22 OK",
    d.bmpFallback?"BMP280 FAULT [OWM fallback]":"BMP280 OK",
    d.pipelineFault?"Flow/Pipeline FAULT":"Flow sensor OK"
  ].join(" | ");
  const rainSrc=_fv(d.tipBucket_mm)>0?`Tipping bucket: ${_fv(d.tipBucket_mm).toFixed(2)} mm`:_fv(d.owm_rain_mm)>0?`OWM API: ${_fv(d.owm_rain_mm).toFixed(2)} mm`:_fv(d.estimatedRain)>0?`Sensor estimate: ~${_fv(d.estimatedRain).toFixed(1)} mm`:"No rainfall detected";
  return [
    `Crop: ${d.crop||'Unknown'} | Stage: ${d.stage||'Unknown'} | GDD: ${_fv(d.gdd).toFixed(0)} \u00b0C\u00b7day`,
    `Plot: ${_fv(d.plotArea_m2).toFixed(2)} m\u00b2`,
    `SM1@15cm:${_fv(d.sm1).toFixed(1)}% | SM2@30cm:${_fv(d.sm2).toFixed(1)}% | SM3@45cm:${_fv(d.sm3).toFixed(1)}%`,
    `CSMI: ${_fv(d.csmi).toFixed(1)}%`,
    `Temp:${_fv(d.temperature).toFixed(1)}\u00b0C | Humidity:${_fv(d.humidity).toFixed(0)}% | Pressure:${_fv(d.pressure).toFixed(1)}hPa`,
    `ETo:${_fv(d.eto).toFixed(2)}mm/day`,
    `AI Score:${_fv(d.aiScore).toFixed(1)}/120 | SMV:${_fv(d.smv).toFixed(4)} | TPR:${_fv(d.tprScore).toFixed(3)}`,
    `Rain Prob:${_fv(d.rainProb).toFixed(0)}%`,
    rainSrc,
    `Effective Rain:${_fv(d.effectiveRain).toFixed(2)}mm`,
    `Flow:${_fv(d.flowRate).toFixed(2)}L/min | Total:${_fv(d.totalLitres).toFixed(1)}L`,
    `Pump:${d.pump?'ON':'OFF'} | Mode:${d.autoMode?'Auto':'Manual'} | Fault:${d.pipelineFault?'YES':'None'}`,
    `Required:${_fv(d.deltaRequired).toFixed(1)}L | Applied:${_fv(d.deltaApplied).toFixed(1)}L | Balance:${_fv(d.deltaBalance).toFixed(1)}L`,
    `Mode:${d.offlineMode?'OFFLINE':'ONLINE'} | SafeMode:${d.safeMode?'ACTIVE':'OK'}`,
    sh
  ].join("\n");
}

async function sendAIMessage(){
  const input=document.getElementById('aiUserInput'); if(!input)return;
  const text=input.value.trim(); if(!text||aiIsLoading)return;
  input.value=''; updateCharCount(0); autoResizeTextarea(input);
  appendAIMessage('user',text); await askGemini(text);
}

async function quickAsk(question){if(aiIsLoading)return;appendAIMessage('user',question);await askGemini(question);}

async function runAutoAnalysis(){
  if(aiIsLoading)return;
  appendAIMessage('user','\u26a1 Auto Farm Analysis requested');
  await askGemini("Please give me a full analysis of current farm conditions: soil moisture, irrigation recommendation, sensor health, rainfall, water balance, and any faults.");
}

async function askGemini(userQuestion){
  if(aiIsLoading)return;
  setAILoading(true); updateAIStatusBadge('thinking');
  const steps=buildThinkingSteps(userQuestion); let idx=0;
  const timer=setInterval(()=>{const b=document.getElementById('aiStatusBadge');if(b&&idx<steps.length){b.textContent='\u25ce '+steps[idx];idx++;}},400);
  await new Promise(r=>setTimeout(r,steps.length*420+300));
  clearInterval(timer);
  try{
    const reply=ruleBasedResponse(userQuestion);
    aiChatHistory.push({role:'user',parts:[{text:userQuestion}]});
    aiChatHistory.push({role:'model',parts:[{text:reply}]});
    appendAIMessage('model',reply);
    updateAIStatusBadge('ready');
  }catch(e){appendAIMessage('model','System error. Please try again.');}
  finally{setAILoading(false);}
}

function buildThinkingSteps(q){
  const q2=q.toLowerCase();
  const steps=['Sawaal samajh raha hoon...'];
  if(/temp|garmi|celsius|weather|mausam/.test(q2)){steps.push('Temperature data dekh raha hoon...');steps.push('ETo calculate kar raha hoon...');}
  else if(/pump|motor|start|band/.test(q2)){steps.push('Pump status check kar raha hoon...');steps.push('AI score evaluate kar raha hoon...');}
  else if(/baarish|rain|barish/.test(q2)){steps.push('OWM forecast dekh raha hoon...');steps.push('Rain probability calculate kar raha hoon...');}
  else if(/mitti|soil|moisture|naami/.test(q2)){steps.push('SM1, SM2, SM3 readings dekh raha hoon...');steps.push('CSMI calculate kar raha hoon...');}
  else if(/sensor|fault|kharab/.test(q2)){steps.push('Sensor health check kar raha hoon...');}
  else if(/budget|balance|litre/.test(q2)){steps.push('Water budget calculate kar raha hoon...');}
  else{steps.push('Context samajh raha hoon...');steps.push('Sensor data se match kar raha hoon...');}
  steps.push('Jawab taiyaar kar raha hoon...');
  return steps;
}

function getSoilLevel(csmi){
  if(csmi>=65)return{level:'\ud83d\udca6 Wet (above FC)',color:'#58a6ff'};
  if(csmi>=45)return{level:'\u2705 Optimal',color:'#56d364'};
  if(csmi>=30)return{level:'\u26a0\ufe0f Moderate Dry',color:'#f0a500'};
  if(csmi>=15)return{level:'\ud83d\udd34 Dry',color:'#f85149'};
  return{level:'\ud83d\udca7 Critical Dry',color:'#ff0000'};
}
function getRainInfo(){
  const d=lastData, owm=owmDirectData;
  const prob=d?fv(d.rainProb):(owm?owm.owm_rain_prob:0);
  const mm=d?(fv(d.tipBucket_mm)||fv(d.owm_rain_mm)):(owm?owm.owm_rain_mm:0);
  return{prob,mm,src:d&&fv(d.tipBucket_mm)>0?'Tipping Bucket':'OWM'};
}
function getWaterCalc(){
  const d=lastData; if(!d)return null;
  const area=fv(d.plotArea_m2)||localConfig.plotArea_m2;
  const csmi=fv(d.csmi), eto=fv(d.eto)||3;
  const fc=CROP_DATA[localConfig.crop].fc;
  const deficit=Math.max(0,(fc-csmi)/100*300*area/1000);
  const eto_l=eto*area/1000;
  return{needed:(deficit+eto_l).toFixed(1),eto_l:eto_l.toFixed(1),deficit:deficit.toFixed(1)};
}

function ruleBasedResponse(question){
  const d=lastData, owm=owmDirectData;
  const q2=question.toLowerCase(), _fv=v=>isNaN(parseFloat(v))?0:parseFloat(v);
  const has=kw=>kw.some(k=>q2.includes(k));

  // Irrigation intent
  const intent=detectIrrigationIntent(q2,has,d,_fv);
  if(intent)return irrigationMasterResponse(intent,d,_fv,owm);

  // Soil moisture
  if(has(['csmi','soil moisture','mitti','naami','sm1','sm2','sm3','moisture','soil condition'])){
    if(!d)return '\ud83d\udce1 Sensor data not available. Check Firebase connection.';
    const sl=getSoilLevel(_fv(d.csmi));
    return `\ud83c\udf31 **Soil Moisture Status**\n\nSM1 @ 15cm: **${_fv(d.sm1).toFixed(1)}%**\nSM2 @ 30cm: **${_fv(d.sm2).toFixed(1)}%**\nSM3 @ 45cm: **${_fv(d.sm3).toFixed(1)}%**\nCSMI: **${_fv(d.csmi).toFixed(1)}%**\n\nCondition: ${sl.level}\n\n${_fv(d.csmi)<30?'\u26a0\ufe0f Soil is dry \u2014 irrigation recommended soon.':_fv(d.csmi)>65?'\ud83d\udca7 Soil is wet \u2014 no irrigation needed.':'\u2705 Soil moisture is in good range.'}`;
  }

  // Rain probability
  if(has(['rain probability','baarish probability','rain prob','baarish ho','rain today','kya baarish'])){
    const ri=getRainInfo();
    return `\ud83c\udf26\ufe0f **Rain Probability Analysis**\n\nProbability: **${ri.prob.toFixed(0)}%**\nSource: ${ri.src}\nAmount: ${ri.mm.toFixed(2)} mm\n\n${ri.prob>75?'\ud83c\udf27\ufe0f **Heavy rain likely** \u2014 Irrigation automatically suppressed.':ri.prob>35?'\u26c5 Rain possible \u2014 monitoring active.':'\u2600\ufe0f Clear weather \u2014 irrigation can proceed normally.'}`;
  }

  // Water budget
  if(has(['water budget','paani budget','budget','balance remaining','water balance','seasonal water','delta'])){
    if(!d)return '\ud83d\udce1 No data available.';
    const wc=getWaterCalc();
    const pct=_fv(d.deltaRequired)>0?((_fv(d.deltaApplied)/_fv(d.deltaRequired))*100).toFixed(1):'0';
    return `\ud83d\udca7 **Water Budget Status**\n\nSeasonal Required: **${_fv(d.deltaRequired).toFixed(1)} L**\nIrrigation Applied: **${_fv(d.deltaApplied).toFixed(1)} L**\nRainfall Contribution: **${_fv(d.rainfallContrib).toFixed(1)} L**\nBalance Remaining: **${_fv(d.deltaBalance).toFixed(1)} L**\nBudget Used: **${pct}%**\n\n${wc?`\ud83d\udcca Today's Need: ~${wc.needed} L (deficit + ETo)`:''}\n\n${parseFloat(pct)>90?'\u26a0\ufe0f Budget nearly exhausted!':parseFloat(pct)>60?'\ud83d\udcca On track \u2014 normal consumption.':'\u2705 Plenty of budget remaining.'}`;
  }

  // Sensor health
  if(has(['sensor health','sensor fault','sensor kharab','sensor status','all sensors'])){
    if(!d)return '\ud83d\udce1 No data \u2014 check Firebase.';
    const issues=[];
    if(d.safeMode)issues.push('\ud83d\udd34 ALL SOIL SENSORS FAILED \u2014 Safe Mode active');
    if(d.dhtFallback)issues.push('\ud83d\udfe1 DHT22 fault \u2014 OWM fallback active');
    if(d.bmpFallback)issues.push('\ud83d\udfe1 BMP280 fault \u2014 OWM fallback active');
    if(d.pipelineFault)issues.push('\ud83d\udd34 Pipeline/Flow fault \u2014 pump stopped');
    return `\ud83e\ude7a **Sensor Health Report**\n\nSM1 (15cm): ${!d.safeMode&&_fv(d.sm1)>0?'\u2705 OK':'\ud83d\udd34 FAULT'}\nSM2 (30cm): ${!d.safeMode&&_fv(d.sm2)>0?'\u2705 OK':'\ud83d\udd34 FAULT'}\nSM3 (45cm): ${!d.safeMode&&_fv(d.sm3)>0?'\u2705 OK':'\ud83d\udd34 FAULT'}\nDHT22: ${d.dhtFallback?'\u26a0\ufe0f OWM Fallback':'\u2705 OK'}\nBMP280: ${d.bmpFallback?'\u26a0\ufe0f OWM Fallback':'\u2705 OK'}\nYF-S201 Flow: ${d.pipelineFault?'\ud83d\udd34 FAULT':'\u2705 OK'}\nLoRa SX1278: \u2705 Active\n\n${issues.length===0?'\u2705 All sensors operating normally!':'\u26a0\ufe0f Issues:\n'+issues.join('\n')}`;
  }

  // Pump
  if(has(['pump','motor','pump not','pump status','motor status'])){
    if(!d)return '\ud83d\udce1 No data \u2014 check Firebase connection.';
    const pumpOn=d.pump||false, auto=d.autoMode!==undefined?d.autoMode:true;
    return `\u2699\ufe0f **Pump Status**\n\nStatus: ${pumpOn?'\ud83d\udfe2 **PUMP ON**':'\ud83d\udd34 **PUMP OFF**'}\nMode: ${auto?'\ud83e\udd16 Auto (AI-controlled)':'\u270b Manual'}\nFlow Rate: ${_fv(d.flowRate).toFixed(2)} L/min\nPipeline Fault: ${d.pipelineFault?'\ud83d\udd34 YES \u2014 Check pipeline':'\u2705 None'}\nAI Score: ${_fv(d.aiScore).toFixed(1)}/120 (triggers at 65)\n\n${!pumpOn&&_fv(d.aiScore)<65?'\u2192 AI score below 65 threshold.':''}\n${!pumpOn&&_fv(d.rainProb)>75?'\u2192 Pump suppressed \u2014 rain probability >75%.':''}\n${d.pipelineFault?'\u2192 FAULT: Check blockage, dry pump, or empty tank!':''}`;
  }

  // Offline mode
  if(has(['offline','hotspot','lora','autonomous','eeprom','sync','reconnect'])){
    if(!d)return '\ud83d\udce1 No live data \u2014 device may be offline.';
    return `\ud83d\udce1 **Offline & Autonomous Mode**\n\nCurrent Mode: ${d.offlineMode?'\ud83d\udd34 **OFFLINE**':'\ud83d\udfe2 **ONLINE**'}\nLoRa: Active (SX1278, 433 MHz, 2-5km)\nHotspot: TSCRIC_AI (192.168.4.1 when offline)\nPending Sync Logs: ${_fv(d.offlineLogCount)||0}\n\n**How it works:**\n\u2022 WiFi lost \u2192 LoRa activates, hotspot created, EEPROM logs events\n\u2022 Auto-sync within 60s of reconnection\n\u2022 Max 50 events in EEPROM\n\u2022 Irrigation continues using local sensor data`;
  }

  // OWM
  if(has(['owm','openweathermap','cloud weather','weather api'])){
    const owmOK=owm&&owm.owm_valid;
    return `\ud83c\udf29\ufe0f **OpenWeatherMap Status**\n\nStatus: ${owmOK?'\ud83d\udfe2 **Live**':'\ud83d\udd34 **Offline**'}\n${owmOK?`Temp: ${owm.owm_temp!==null?owm.owm_temp.toFixed(1):' --'}\u00b0C\nHumidity: ${owm.owm_humidity!==null?owm.owm_humidity.toFixed(0):'--'}%\nRain(1h): ${owm.owm_rain_mm?owm.owm_rain_mm.toFixed(2):'0.00'}mm\nRain Prob: ${owm.owm_rain_prob?owm.owm_rain_prob.toFixed(0):0}%`:'No OWM data.'}\n\nPriority: Local sensors always take precedence over OWM.`;
  }

  // AI Score
  if(has(['ai score','score kya','irrigation score','score explain','trigger'])){
    if(!d)return '\ud83d\udce1 No data.';
    const score=_fv(d.aiScore);
    return `\ud83e\udd16 **AI Irrigation Score: ${score.toFixed(1)}/120**\n\nTrigger: **65**\nStatus: ${score>=65?'\u2705 **ABOVE \u2014 Irrigation triggered**':'**BELOW \u2014 Waiting'}\n\n**Components:**\n\u2022 CSMI: ${_fv(d.csmi).toFixed(1)}%\n\u2022 SMV (drying velocity): ${_fv(d.smv).toFixed(4)} %/hr\n\u2022 SMA (acceleration): ${_fv(d.sma).toFixed(4)}\n\u2022 TPR pattern: ${_fv(d.tprScore).toFixed(3)}\n\u2022 Rain prob penalty: ${_fv(d.rainProb).toFixed(0)}%\n\u2022 ETo demand: ${_fv(d.eto).toFixed(2)} mm/day\n\n${score>=65?'\u2192 All conditions met.':'\u2192 '+(65-score).toFixed(0)+' points below trigger.'}`;
  }

  // Full analysis
  if(has(['full analysis','complete analysis','farm status','system status','everything','analysis karo'])){
    if(!d)return '\ud83d\udce1 No live data \u2014 connect hardware first.';
    const sl=getSoilLevel(_fv(d.csmi)), ri=getRainInfo(), wc=getWaterCalc();
    return `\ud83d\udcca **Full Farm Status Report**\n\n\ud83c\udf3e Crop: ${d.crop||'--'} | Stage: ${d.stage||'--'} | GDD: ${_fv(d.gdd).toFixed(0)}\n\ud83d\udccd Area: ${_fv(d.plotArea_m2).toFixed(1)}m\u00b2\n\n\ud83c\udf31 Soil: ${sl.level} (CSMI ${_fv(d.csmi).toFixed(1)}%)\n   SM1:${_fv(d.sm1).toFixed(1)}% | SM2:${_fv(d.sm2).toFixed(1)}% | SM3:${_fv(d.sm3).toFixed(1)}%\n\ud83e\udd16 AI Score: ${_fv(d.aiScore).toFixed(1)}/120 \u2192 ${_fv(d.aiScore)>=65?'Triggered':'Monitoring'}\n\ud83d\udca7 Pump: ${d.pump?'\ud83d\udfe2 ON':'\ud83d\udd34 OFF'} | ${d.autoMode?'Auto':'Manual'}\n\ud83c\udf27\ufe0f Rain: ${ri.prob.toFixed(0)}% | ${ri.mm.toFixed(2)}mm\n\ud83c\udf21\ufe0f Temp: ${_fv(d.temperature).toFixed(1)}\u00b0C | Humidity: ${_fv(d.humidity).toFixed(0)}%\n\ud83d\udce1 ${d.offlineMode?'\ud83d\udd34 Offline':'\ud83d\udfe2 Online'}\n\ud83d\udcb0 Budget: ${_fv(d.deltaBalance).toFixed(1)}L remaining\n${wc?`\ud83d\udca7 Today's need: ~${wc.needed}L`:''}\n\n\ud83d\udca1 Recommendation:\n${d.pipelineFault?'\ud83d\udd34 Fix pipeline fault immediately!':d.safeMode?'\ud83d\udd34 Fix soil sensors!':ri.prob>65?'\ud83c\udf27\ufe0f Rain coming \u2014 hold irrigation.':_fv(d.csmi)<20?'\ud83d\udea8 URGENT: Irrigate now!':_fv(d.csmi)<35?'\u26a0\ufe0f Irrigate soon.':_fv(d.csmi)>75?'\ud83d\udca6 Too wet \u2014 skip.':'\u2705 Conditions optimal \u2014 continue monitoring.'}`;
  }

  // Default
  const sl=d?getSoilLevel(_fv(d.csmi)):null, ri=getRainInfo();
  return `\ud83c\udf3e **TSCRIC-LoRa Advisory**\n\n${d?`\ud83d\udcca Quick Status:\n\u2022 Soil: ${sl.level} (CSMI ${_fv(d.csmi).toFixed(1)}%)\n\u2022 AI Score: ${_fv(d.aiScore).toFixed(1)}/120\n\u2022 Pump: ${d.pump?'\ud83d\udfe2 ON':'\ud83d\udd34 OFF'}\n\u2022 Rain: ${ri.prob.toFixed(0)}%\n\u2022 Budget: ${_fv(d.deltaBalance).toFixed(1)}L remaining\n\n`:''}I can answer about:\n\u2022 Soil moisture & CSMI\n\u2022 Irrigation timing & quantity\n\u2022 Pump & pipeline status\n\u2022 Rainfall & water budget\n\u2022 Sensor health\n\u2022 Offline mode & LoRa\n\u2022 Full farm analysis\n\nUse **Quick Ask** buttons above!`;
}

function detectIrrigationIntent(q2,has,d,_fv){
  if(has(['kab sinchai','kab pani','when to irrigate','when to water','irrigation time','abhi karo']))return 'irrig_when';
  if(has(['kitni der','kitna time','how long','duration','how many times']))return 'irrig_duration';
  if(has(['kitna paani','how much water','kitne litre','quantity','amount']))return 'irrig_quantity';
  if(has(['sinchai band','paani band','stop irrigation','band karo']))return 'irrig_stop';
  if(has(['zyada paani','over water','overwater','waterlog']))return 'irrig_over';
  if(has(['kam paani','thoda paani','insufficient','under water']))return 'irrig_under';
  if(has(['baarish ke baad','after rain','baarish ho gayi']))return 'irrig_after_rain';
  if(has(['garmi mein','summer mein','hot weather','tez dhoop']))return 'irrig_heat';
  if(has(['raat mein','subah mein','early morning','evening mein']))return 'irrig_timing';
  if(has(['fasal sukh','plant dying','paudha sukh','stress','murjha','wilting']))return 'irrig_stress';
  return null;
}

function irrigationMasterResponse(intent,d,_fv,owm){
  const sl=d?getSoilLevel(_fv(d.csmi)):null, ri=getRainInfo(), calc=getWaterCalc();
  const csmi=d?_fv(d.csmi):0, temp=d?_fv(d.temperature):30, eto=d?_fv(d.eto):3;
  switch(intent){
    case 'irrig_when':{
      const L=['\u23f0 **Sinchai Kab Karni Chahiye?**\n'];
      if(!d){L.push('\ud83d\udce1 Sensor data nahi \u2014 hardware check karo.');return L.join('\n');}
      L.push('Mitti: '+(sl?sl.level:'--')+' ('+csmi.toFixed(1)+'%)');
      L.push('AI Score: '+_fv(d.aiScore).toFixed(1)+'/120 | Rain: '+ri.prob.toFixed(0)+'%\n');
      if(ri.prob>65){L.push('\ud83c\udf27\ufe0f **Abhi nahi!** Baarish '+ri.prob.toFixed(0)+'% expected.');L.push('\u2192 Baarish ke baad mitti check karo.');}
      else if(csmi<25){L.push('\ud83d\udea8 **Abhi turant karo!** Mitti bahut dry hai.');}
      else if(csmi<40){L.push('\u26a0\ufe0f **Aaj karo.** Best time: Subah 6-9 ya Shaam 5-7 baje.');}
      else{L.push('\u2705 Abhi zaroorat nahi. CSMI '+csmi.toFixed(1)+'% \u2014 theek hai.');}
      L.push('\n\ud83d\udca1 Kabhi bhi tez dhoop mein sinchai mat karo.');
      return L.join('\n');
    }
    case 'irrig_duration':{
      if(!d)return '\ud83d\udce1 Sensor data nahi.';
      const area=_fv(d.plotArea_m2)||10, flowR=_fv(d.flowRate)>0?_fv(d.flowRate):5;
      const neededL=calc?parseFloat(calc.needed):(area*0.5);
      return `\u23f1\ufe0f **Sinchai Duration**\n\nArea: ${area.toFixed(1)}m\u00b2 | Flow: ${flowR.toFixed(2)}L/min\nEstimated: ~${(neededL/flowR).toFixed(0)} minutes\n\nSystem: Pulse mode (30s ON / 2min OFF)\nStop when CSMI reaches 50-60%.`;
    }
    case 'irrig_quantity':{
      if(!d)return '\ud83d\udce1 No data.';
      const area=_fv(d.plotArea_m2)||10;
      return `\ud83d\udca7 **Paani Quantity**\n\nArea: ${area.toFixed(1)}m\u00b2 | CSMI: ${csmi.toFixed(1)}% | ETo: ${eto.toFixed(2)}mm/day\n${calc?`Deficit: ~${calc.needed}L | ETo demand: ~${calc.eto_l}L`:'Insufficient data.'}\nBudget remaining: ${_fv(d.deltaBalance).toFixed(1)}L\n${ri.prob>40?`\ud83c\udf27\ufe0f ${ri.prob.toFixed(0)}% baarish \u2014 thoda kam do.`:''}`;
    }
    case 'irrig_stop':{
      if(!d)return '\ud83d\udce1 Data nahi.';
      return `\ud83d\uded1 **Sinchai Band Kab?**\n\nCSMI: ${csmi.toFixed(1)}% | Pump: ${d.pump?'\ud83d\udfe2 ON':'\ud83d\udd34 Already OFF'}\n\n${!d.pump?'\u2705 Pump pehle se band hai.':csmi>=55?'\ud83d\uded1 **Abhi band karo!** CSMI '+csmi.toFixed(1)+'% \u2014 kaafi ho gaya.':csmi>=45?'\ud83d\udcca Thodi der aur \u2014 55% tak jaane do.':'\u23f3 Continue karo \u2014 mitti abhi dry hai ('+csmi.toFixed(1)+'%).'}`;
    }
    case 'irrig_over': return `\ud83d\udca6 **Overwatering Prevention**\n\nCSMI: ${csmi.toFixed(1)}%\n${csmi>70?'\u26a0\ufe0f Mitti already wet!\n\u2192 Irrigation immediately stop karo.\n\u2192 Drainage check karo.\n\u2192 Root rot risk!':'\u2705 Current moisture level safe.\n\u2192 Monitor CSMI \u2014 if >75%, stop irrigation.'}\n\nSystem: Deep sensor (SM3 45cm) monitors waterlogging. If SM3 > FC, pump auto-stops.`;
    case 'irrig_under': return `\ud83d\udca7 **Underwatering Detection**\n\nCSMI: ${csmi.toFixed(1)}%\n${csmi<25?'\ud83d\udea8 CONFIRMED: Mitti critically dry!\n\u2192 Irrigation start karo immediately.\n\u2192 Crop wilting risk.':csmi<35?'\u26a0\ufe0f Mitti dry ho rahi hai.\n\u2192 Plan irrigation in next 2-4 hours.':'\u2705 Moisture level adequate \u2014 no underwatering detected.'}`;
    case 'irrig_after_rain': return `\ud83c\udf27\ufe0f **Rain Ke Baad Sinchai**\n\nCSMI: ${csmi.toFixed(1)}%\nRain: ${ri.mm.toFixed(2)}mm detected\n\n${csmi>55?'\u2705 Baarish ke baad mitti '+csmi.toFixed(1)+'% \u2014 sinchai ki zaroorat nahi.':'\ud83d\udcca Mitti abhi bhi '+csmi.toFixed(1)+'% \u2014 baarish poori nahi thi.\n\u2192 3-4 ghante baad fir check karo.'}\n\nSystem automatically updates water budget with effective rainfall.`;
    case 'irrig_heat': return `\ud83d\udd25 **Garmi Mein Sinchai**\n\nTemp: ${temp.toFixed(1)}\u00b0C | ETo: ${eto.toFixed(2)}mm/day\n${temp>40?'\ud83c\udf21\ufe0f Extreme heat! ETo very high.\n\u2192 Frequency badhao: har 6-8 ghante check\n\u2192 Best time: Subah 5-6 aur Shaam 6-7\n\u2192 Mulching se 30-40% soil moisture save hoga':'\u2600\ufe0f Garmi mein:\n\u2192 Morning or evening only\n\u2192 Avoid 10am-4pm (60% evaporation)\n\u2192 Monitor CSMI every 4 hours'}`;
    case 'irrig_timing': return `\u23f0 **Sinchai Ka Best Time**\n\n\u2705 Ideal:\n\u2022 Subah 5\u20139 baje (best!)\n\u2022 Shaam 5\u20137 baje (second best)\n\n\u274c Avoid:\n\u2022 Dopahar 10am\u20134pm (60% evaporation loss)\n\u2022 Raat 9pm ke baad (fungal disease risk)\n\n${new Date().getHours()>=10&&new Date().getHours()<=16?'\u26a0\ufe0f Peak hours \u2014 subah ya shaam tak wait karo.':'\u2705 Good time for irrigation!'}`;
    case 'irrig_stress': return `\ud83d\ude30 **Crop Stress Analysis**\n\nCSMI: ${csmi.toFixed(1)}% | Temp: ${temp.toFixed(1)}\u00b0C\n\n${csmi<25?'\ud83d\udd34 Water stress confirmed \u2014 IMMEDIATELY irrigate!\n\u2192 Mitti critically dry\n\u2192 Permanent wilting risk':csmi>80?'\ud83d\udca6 Overwatering stress!\n\u2192 Drainage improve karo\n\u2192 Irrigation band karo':temp>42?'\ud83d\udd25 Heat stress!\n\u2192 Shade netting lagao\n\u2192 More frequent irrigation':'Moisture aur temp theek hai.\n\u2192 Pest/disease check karo\n\u2192 Nutrient deficiency possible\n\u2192 Soil compaction check karo'}`;
    default: return ruleBasedResponse('full analysis');
  }
}

// ── Message rendering ──────────────────────────────────────
function appendAIMessage(role,text,isWelcome){
  const container=document.getElementById('aiChatMessages'); if(!container)return;
  const wrap=document.createElement('div');
  wrap.className='ai-msg-wrap '+(role==='user'?'ai-msg-wrap--user':'ai-msg-wrap--model');
  const bubble=document.createElement('div');
  bubble.className='ai-bubble '+(role==='user'?'ai-bubble--user':'ai-bubble--model');
  bubble.innerHTML=formatAIText(text);
  const ts=document.createElement('div'); ts.className='ai-timestamp';
  ts.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(role==='model'){
    const av=document.createElement('div'); av.className='ai-avatar'; av.textContent=isWelcome?'\ud83c\udf3e':'\ud83e\udd16';
    wrap.appendChild(av); wrap.appendChild(bubble); wrap.appendChild(ts);
  } else { wrap.appendChild(ts); wrap.appendChild(bubble); }
  container.appendChild(wrap);
  container.scrollTo({top:container.scrollHeight,behavior:'smooth'});
}

function formatAIText(raw){
  if(!raw||typeof raw!=='string')return '<p>\u2014</p>';
  const lines=raw.split('\n'); let html='',inList=false,listTag='ul';
  const close=()=>{if(inList){html+=`</${listTag}>`;inList=false;}};
  const fmt=s=>s.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>');
  for(const rawLine of lines){
    const line=rawLine.trimEnd();
    if(!line.trim()){close();if(html&&!html.endsWith('<br>'))html+='<br>';continue;}
    if(/^#{1,3}\s/.test(line)){close();html+=`<p class="ai-heading">${fmt(line.replace(/^#{1,3}\s+/,''))}</p>`;continue;}
    if(/^[-*]{3,}$/.test(line.trim())){close();html+='<hr class="ai-hr">';continue;}
    const ul=line.match(/^(\s*)([-*\u2022])\s+(.+)$/);
    if(ul){if(!inList||listTag!=='ul'){close();html+='<ul>';inList=true;listTag='ul';}html+=`<li>${fmt(ul[3])}</li>`;continue;}
    const ol=line.match(/^(\s*)\d+[.)]\s+(.+)$/);
    if(ol){if(!inList||listTag!=='ol'){close();html+='<ol>';inList=true;listTag='ol';}html+=`<li>${fmt(ol[2])}</li>`;continue;}
    close(); html+=`<span>${fmt(line)}</span><br>`;
  }
  close();
  return html.replace(/(<br>)+$/,'')||'<p>\u2014</p>';
}

function setAILoading(loading){
  aiIsLoading=loading;
  const ind=document.getElementById('aiTypingIndicator');
  const btn=document.getElementById('aiSendBtn');
  const ico=document.getElementById('aiSendIcon');
  if(ind)ind.style.display=loading?'flex':'none';
  if(btn)btn.disabled=loading;
  if(ico)ico.textContent=loading?'\u23f3':'\u27a4';
  if(loading){const c=document.getElementById('aiChatMessages');if(c)c.scrollTo({top:c.scrollHeight,behavior:'smooth'});}
}

function updateAIStatusBadge(state){
  const badge=document.getElementById('aiStatusBadge'), dot=document.getElementById('aiGlowDot');
  if(!badge)return;
  const states={ready:{text:'\u25cf Ready',cls:'ai-badge--ready'},thinking:{text:'\u25ce Thinking\u2026',cls:'ai-badge--thinking'},offline:{text:'\u25cb Offline',cls:'ai-badge--offline'},error:{text:'\u25cf Error',cls:'ai-badge--error'}};
  const s=states[state]||states.ready;
  badge.textContent=s.text; badge.className='ai-status-badge '+s.cls;
  if(dot)dot.className='ai-chat-glow-dot '+s.cls;
}

function clearAIChat(){aiChatHistory=[];const c=document.getElementById('aiChatMessages');if(c)c.innerHTML='';initAIChat();}
function handleAIInputKey(event){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAIMessage();}}
function autoResizeTextarea(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';updateCharCount(el.value.length);}
function updateCharCount(len){const el=document.getElementById('aiCharCount');if(el){el.textContent=len+'/500';el.style.color=len>450?'var(--orange)':'var(--text-muted)';}}

function bootstrapAIChat(){
  if(aiChatBooted)return; aiChatBooted=true;
  initAIChat(); updateAIStatusBadge('ready');
}
