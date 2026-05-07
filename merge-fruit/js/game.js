'use strict';

const Engine    = Matter.Engine;
const Bodies    = Matter.Bodies;
const Body      = Matter.Body;
const Composite = Matter.Composite;
const Events    = Matter.Events;

// ── MEYVE TANIMLARI ─────────────────────────────────────────────
const FRUITS = [
    { level:0,  label:'Erik',          emoji:'🟣', color:'#5e2165', radius:22,  score:2,    imgSource:'assets/images/plum.png?v=10' },
    { level:1,  label:'Cilek',         emoji:'🍓', color:'#ff3366', radius:30,  score:4,    imgSource:'assets/images/strawberry.png?v=10' },
    { level:2,  label:'Uzum',          emoji:'🍇', color:'#b300b3', radius:40,  score:8,    imgSource:'assets/images/grape.png?v=10' },
    { level:3,  label:'Elma',          emoji:'🍎', color:'#e60000', radius:52,  score:16,   imgSource:'assets/images/apple.png?v=10' },
    { level:4,  label:'Portakal',      emoji:'🍊', color:'#ff8000', radius:64,  score:32,   imgSource:'assets/images/orange.png?v=10' },
    { level:5,  label:'Seftali',       emoji:'🍑', color:'#ff9999', radius:76,  score:64,   imgSource:'assets/images/peach.png?v=10' },
    { level:6,  label:'Mango',         emoji:'🥭', color:'#ffcc00', radius:88,  score:128,  imgSource:'assets/images/mango.png?v=10' },
    { level:7,  label:'Ejder',         emoji:'🐉', color:'#ff0066', radius:88,  score:256,  imgSource:'assets/images/dragonfruit.png?v=12', imgScale:1.25 },
    { level:8,  label:'Ananas',        emoji:'🍍', color:'#ffb300', radius:126, score:512,  imgSource:'assets/images/pineapple.png?v=10' },
    { level:9,  label:'Kavun',         emoji:'🍈', color:'#ccff66', radius:135, score:1024, imgSource:'assets/images/melon.png?v=10',       imgScale:1.08 },
    { level:10, label:'Karpuz',        emoji:'🍉', color:'#00cc00', radius:158, score:2048, imgSource:'assets/images/watermelon.png?v=10',  imgScale:1.08 }
];
FRUITS.forEach(function(f) {
    if (f.imgSource) { f.img = new Image(); f.img.src = f.imgSource; }
});

// ── DEEP SEA TANIMLARI ──────────────────────────────────────────
const DEEPSEA = [
    { level:0,  label:'Plankton',      emoji:'🦠', color:'#00ff00', radius:22,  score:2,    isDeepSea:true, imgSource:'assets/images/ds_1.png' },
    { level:1,  label:'Karides',       emoji:'🦐', color:'#ff00ff', radius:30,  score:4,    isDeepSea:true, imgSource:'assets/images/ds_2.png' },
    { level:2,  label:'Denizanasi',    emoji:'🪼', color:'#0088ff', radius:40,  score:8,    isDeepSea:true, imgSource:'assets/images/ds_3.png' },
    { level:3,  label:'Mercan',        emoji:'🪸', color:'#ff8800', radius:52,  score:16,   isDeepSea:true, imgSource:'assets/images/ds_4.png' },
    { level:4,  label:'Istiridye',     emoji:'🦪', color:'#ffffff', radius:64,  score:32,   isDeepSea:true, imgSource:'assets/images/ds_5.png' },
    { level:5,  label:'Fener Baligi',  emoji:'🐡', color:'#88ff00', radius:76,  score:64,   isDeepSea:true, imgSource:'assets/images/ds_6.png' },
    { level:6,  label:'Yilan Baligi',  emoji:'🐍', color:'#00ffff', radius:88,  score:128,  isDeepSea:true, imgSource:'assets/images/ds_7.png' },
    { level:7,  label:'Murekkep',      emoji:'🦑', color:'#8888ff', radius:88,  score:256,  isDeepSea:true, imgSource:'assets/images/ds_8.png' },
    { level:8,  label:'Deniz Ati',     emoji:'🐉', color:'#ffd700', radius:126, score:512,  isDeepSea:true, imgSource:'assets/images/ds_9.png' },
    { level:9,  label:'Amfora',        emoji:'🏺', color:'#0044ff', radius:135, score:1024, isDeepSea:true, imgSource:'assets/images/ds_10.png' },
    { level:10, label:'Vatoz',         emoji:'🐟', color:'#aa00ff', radius:158, score:2048, isDeepSea:true, imgSource:'assets/images/ds_11.png' },
    { level:11, label:'Kaplumbaga',    emoji:'🐢', color:'#00ffaa', radius:175, score:4096, isDeepSea:true, imgSource:'assets/images/ds_12.png' },
    { level:12, label:'Kapi',          emoji:'⛩️', color:'#aaaaaa', radius:195, score:8192, isDeepSea:true, imgSource:'assets/images/ds_13.png' },
    { level:13, label:'Kalp',          emoji:'❤️', color:'#ff0044', radius:220, score:16384,isDeepSea:true, imgSource:'assets/images/ds_14.png' }
];
DEEPSEA.forEach(function(s) {
    if (s.imgSource) { s.img = new Image(); s.img.src = s.imgSource; }
});

// ── TAŞ GÖRSELİ ÜRETİMİ ─────────────────────────────────────────
function drawStonePattern(oc, stone, cx, cy, r) {
    oc.save();
    oc.beginPath(); oc.arc(cx, cy, r, 0, Math.PI*2); oc.clip();
    var ga = 2.39996; // golden angle
    switch (stone.level) {
        case 0: // Kum – kum taneleri
            for (var i = 0; i < 90; i++) {
                var d = Math.sqrt(i/90)*r*0.88, a = i*ga;
                oc.beginPath();
                oc.arc(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 1.4, 0, Math.PI*2);
                oc.fillStyle = i%3===0 ? 'rgba(90,70,40,0.28)' : 'rgba(160,130,80,0.18)';
                oc.fill();
            }
            break;
        case 1: // Çakıl – pürüzsüz, ince çatlak
            oc.beginPath();
            oc.moveTo(cx-r*0.08, cy-r*0.45);
            oc.bezierCurveTo(cx+r*0.12, cy-r*0.1, cx-r*0.18, cy+r*0.15, cx+r*0.06, cy+r*0.52);
            oc.strokeStyle = 'rgba(50,50,50,0.22)'; oc.lineWidth = 1.5; oc.stroke();
            oc.beginPath();
            oc.moveTo(cx-r*0.35, cy+r*0.1);
            oc.bezierCurveTo(cx, cy+r*0.05, cx+r*0.2, cy+r*0.2, cx+r*0.38, cy-r*0.05);
            oc.strokeStyle = 'rgba(50,50,50,0.15)'; oc.lineWidth = 1; oc.stroke();
            break;
        case 2: // Granit – renkli benekler
            var gCols = ['rgba(200,70,70,0.32)','rgba(30,30,30,0.38)','rgba(230,220,200,0.28)','rgba(180,60,60,0.22)'];
            for (var i = 0; i < 70; i++) {
                var d = Math.sqrt(i/70)*r*0.9, a = i*ga;
                oc.beginPath();
                oc.arc(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 2.2, 0, Math.PI*2);
                oc.fillStyle = gCols[i%4]; oc.fill();
            }
            break;
        case 3: // Mermer – damarlar
            oc.lineWidth = 1.5;
            [['rgba(130,130,160,0.42)',[[-0.6,-0.35],[0.15,0.05],[0.5,0.6]]],
             ['rgba(110,110,140,0.32)',[[-0.25,-0.72],[0.38,-0.08],[-0.12,0.58]]],
             ['rgba(160,160,180,0.28)','S']].forEach(function(v, vi) {
                oc.strokeStyle = v[0]; oc.beginPath();
                if (vi < 2) {
                    var pts = v[1];
                    oc.moveTo(cx+pts[0][0]*r, cy+pts[0][1]*r);
                    oc.bezierCurveTo(cx+pts[1][0]*r, cy+pts[1][1]*r, cx+pts[1][0]*r, cy+pts[1][1]*r, cx+pts[2][0]*r, cy+pts[2][1]*r);
                } else {
                    oc.moveTo(cx+r*0.28, cy-r*0.6);
                    oc.bezierCurveTo(cx-r*0.1, cy-r*0.2, cx+r*0.15, cy+r*0.25, cx-r*0.2, cy+r*0.55);
                }
                oc.stroke();
            });
            break;
        case 4: // Obsidyen – keskin kırık çizgiler
            oc.lineWidth = 1;
            [['rgba(140,100,220,0.32)',[-0.4,-0.25,0.15,0.55]],
             ['rgba(180,140,255,0.22),[0.2,-0.55,-0.35,0.3]'],
             ['rgba(100,60,180,0.28)',[0.45,-0.1,-0.1,0.48]]].forEach(function(v) {
                if (!Array.isArray(v[1])) return;
                oc.strokeStyle = v[0]; oc.beginPath();
                oc.moveTo(cx+v[1][0]*r, cy+v[1][1]*r);
                oc.lineTo(cx+v[1][2]*r, cy+v[1][3]*r);
                oc.stroke();
            });
            var og = oc.createRadialGradient(cx-r*0.5,cy-r*0.5,0, cx-r*0.2,cy-r*0.2, r*0.5);
            og.addColorStop(0,'rgba(160,100,255,0.35)'); og.addColorStop(1,'rgba(0,0,0,0)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=og; oc.fill();
            break;
        case 5: // Ametist – altıgen kristal
            var pts5 = [];
            for (var i=0;i<6;i++) { var a=i*Math.PI/3-Math.PI/6; pts5.push([cx+Math.cos(a)*r*0.62,cy+Math.sin(a)*r*0.62]); }
            oc.lineWidth=1.5; oc.strokeStyle='rgba(220,160,255,0.38)';
            pts5.forEach(function(p){ oc.beginPath(); oc.moveTo(cx,cy); oc.lineTo(p[0],p[1]); oc.stroke(); });
            oc.beginPath();
            pts5.forEach(function(p,i){ if(i===0) oc.moveTo(p[0],p[1]); else oc.lineTo(p[0],p[1]); });
            oc.closePath(); oc.strokeStyle='rgba(180,80,255,0.25)'; oc.stroke();
            // inner glow
            var ag = oc.createRadialGradient(cx,cy,0,cx,cy,r*0.5);
            ag.addColorStop(0,'rgba(200,100,255,0.3)'); ag.addColorStop(1,'rgba(150,0,255,0)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=ag; oc.fill();
            break;
        case 6: // Yakut – iç kırmızı parıltı
            var rg = oc.createRadialGradient(cx,cy,0,cx,cy,r*0.72);
            rg.addColorStop(0,'rgba(255,60,60,0.42)'); rg.addColorStop(1,'rgba(200,0,0,0)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=rg; oc.fill();
            oc.lineWidth=1; oc.strokeStyle='rgba(255,180,180,0.3)';
            [[-0.18,-0.35,0.08,0.28],[0.12,-0.28,-0.15,0.38],[-0.3,0.05,0.22,-0.05]].forEach(function(l){
                oc.beginPath(); oc.moveTo(cx+l[0]*r,cy+l[1]*r); oc.lineTo(cx+l[2]*r,cy+l[3]*r); oc.stroke();
            });
            break;
        case 7: // Zümrüt – basamaklı kesim
            oc.lineWidth=1.5; oc.strokeStyle='rgba(80,255,140,0.3)';
            [0.32,0.56,0.8].forEach(function(s){ var w=r*s*1.22,h=r*s*0.78; oc.strokeRect(cx-w,cy-h,w*2,h*2); });
            var eg = oc.createRadialGradient(cx,cy,0,cx,cy,r*0.55);
            eg.addColorStop(0,'rgba(50,255,100,0.28)'); eg.addColorStop(1,'rgba(0,180,60,0)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=eg; oc.fill();
            break;
        case 8: // Safir – yıldız asterizm
            oc.lineWidth=2; oc.strokeStyle='rgba(150,210,255,0.42)';
            for(var i=0;i<3;i++){
                var a=i*Math.PI/3;
                oc.beginPath();
                oc.moveTo(cx+Math.cos(a)*r*0.85, cy+Math.sin(a)*r*0.85);
                oc.lineTo(cx-Math.cos(a)*r*0.85, cy-Math.sin(a)*r*0.85);
                oc.stroke();
            }
            var sg = oc.createRadialGradient(cx,cy,0,cx,cy,r*0.32);
            sg.addColorStop(0,'rgba(200,230,255,0.55)'); sg.addColorStop(1,'rgba(80,160,255,0)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=sg; oc.fill();
            break;
        case 9: // Altın – ışın çizgileri
            for(var i=0;i<16;i++){
                var a=i*Math.PI/8;
                var inner=r*(i%2===0?0.28:0.48);
                oc.lineWidth=i%2===0?1.8:1;
                oc.strokeStyle=i%2===0?'rgba(255,240,80,0.4)':'rgba(180,130,0,0.25)';
                oc.beginPath();
                oc.moveTo(cx+Math.cos(a)*inner, cy+Math.sin(a)*inner);
                oc.lineTo(cx+Math.cos(a)*r*0.88, cy+Math.sin(a)*r*0.88);
                oc.stroke();
            }
            break;
        case 10: // Elmas – çok facetli gökkuşağı
            oc.lineWidth=1;
            for(var i=0;i<8;i++){
                var a=i*Math.PI/4+Math.PI/8;
                oc.strokeStyle=['rgba(255,255,255,0.5)','rgba(180,220,255,0.4)','rgba(255,180,220,0.35)'][i%3];
                oc.beginPath(); oc.moveTo(cx,cy);
                oc.lineTo(cx+Math.cos(a)*r*0.78, cy+Math.sin(a)*r*0.78);
                oc.stroke();
            }
            var dg = oc.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
            dg.addColorStop(0,'rgba(255,80,80,0.18)'); dg.addColorStop(0.33,'rgba(80,255,100,0.18)');
            dg.addColorStop(0.66,'rgba(80,80,255,0.18)'); dg.addColorStop(1,'rgba(255,220,80,0.18)');
            oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=dg; oc.fill();
            break;
    }
    oc.restore();
}

function generateStoneImage(stone, size) {
    size = size || 200;
    var el = document.createElement('canvas');
    el.width = size; el.height = size;
    var oc = el.getContext('2d');
    var cx = size/2, cy = size/2, r = size/2 - 3;
    // Base sphere
    var g = oc.createRadialGradient(cx-r*0.3, cy-r*0.35, r*0.05, cx, cy, r);
    g.addColorStop(0, stone.hi); g.addColorStop(0.45, stone.color); g.addColorStop(1, stone.sh);
    oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=g; oc.fill();
    // Pattern
    drawStonePattern(oc, stone, cx, cy, r);
    // Specular highlight
    var spec = oc.createRadialGradient(cx-r*0.38,cy-r*0.42,0, cx-r*0.18,cy-r*0.22, r*0.58);
    spec.addColorStop(0,'rgba(255,255,255,0.42)');
    spec.addColorStop(0.5,'rgba(255,255,255,0.12)');
    spec.addColorStop(1,'rgba(255,255,255,0)');
    oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2); oc.fillStyle=spec; oc.fill();
    // Rim
    oc.beginPath(); oc.arc(cx,cy,r,0,Math.PI*2);
    oc.strokeStyle='rgba(255,255,255,0.18)'; oc.lineWidth=2; oc.stroke();
    return el.toDataURL('image/png');
}

// ── TAŞ TANIMLARI ───────────────────────────────────────────────
const STONES = [
    { level:0,  label:'Kum',      color:'#c8b89a', hi:'#f0e0c0', sh:'#8a7560', radius:22,  score:2,    isStone:true },
    { level:1,  label:'Cakil',    color:'#9b9b9b', hi:'#d2d2d2', sh:'#505050', radius:30,  score:4,    isStone:true },
    { level:2,  label:'Granit',   color:'#a08078', hi:'#c8a090', sh:'#604030', radius:40,  score:8,    isStone:true },
    { level:3,  label:'Mermer',   color:'#d8d0c8', hi:'#f4f0ec', sh:'#9090a0', radius:52,  score:16,   isStone:true },
    { level:4,  label:'Obsidyen', color:'#282040', hi:'#504070', sh:'#080818', radius:64,  score:32,   isStone:true },
    { level:5,  label:'Ametist',  color:'#9040c0', hi:'#c878f0', sh:'#501880', radius:76,  score:64,   isStone:true },
    { level:6,  label:'Yakut',    color:'#c81020', hi:'#f04858', sh:'#700808', radius:88,  score:128,  isStone:true },
    { level:7,  label:'Zumrut',   color:'#107840', hi:'#38c068', sh:'#064020', radius:88,  score:256,  isStone:true },
    { level:8,  label:'Safir',    color:'#1040a0', hi:'#2870d8', sh:'#081058', radius:126, score:512,  isStone:true },
    { level:9,  label:'Altin',    color:'#d09818', hi:'#f8d048', sh:'#805800', radius:135, score:1024, isStone:true },
    { level:10, label:'Elmas',    color:'#90d0f0', hi:'#e0f8ff', sh:'#408090', radius:158, score:2048, isStone:true }
];
// Taş görsellerini oluştur
STONES.forEach(function(s) {
    var dataUrl = generateStoneImage(s, 200);
    s.img = new Image(); s.imgScale = 0.96;
    s.imgSource = dataUrl; s.img.src = dataUrl;
});

// ── AKTİF TEMA ──────────────────────────────────────────────────
var currentTheme = 'fruits';
var ITEMS = FRUITS;

// ── DURUM DEGİSKENLERİ ──────────────────────────────────────────
var engine, world, canvas, ctx;
var width = 0, height = 0;
var nextFruitLevel = 0;
var previewX = 0;
var isDropping    = false;
var isGameOver    = false;
var isGameStarted = false;
var bombMode      = false;
var score  = 0;
var coins  = 0;
var boosts = { shake:0, bomb:0, swap:0, upgrade:0 };
var particles  = [];
var gameLoopId = null;
var lastTime   = 0;
var WALL_T = 60;

// ── MOD DEĞİŞKENLERİ ────────────────────────────────────────────
var currentMode   = 'normal';
var lives         = 3;
var timeLeft      = 90;
var timerInterval = null;
var speedTimer    = null;
var speedDelay    = 3000;

// ── SES SİSTEMİ ──────────────────────────────────────────────────
var audioCtx = null;
var isMuted  = (localStorage.getItem('mf_muted') === '1');
var audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var buf = audioCtx.createBuffer(1,1,22050), src = audioCtx.createBufferSource();
        src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
        audioUnlocked = true;
    } catch(e) {}
}
document.addEventListener('click',      unlockAudio, { once: false });
document.addEventListener('touchstart', unlockAudio, { once: false });

function getAudioCtx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(freq, type, dur, vol, delay) {
    if (isMuted) return;
    var ac = getAudioCtx(); if (!ac || ac.state === 'suspended') return;
    try {
        var t = ac.currentTime + (delay||0), o = ac.createOscillator(), g = ac.createGain(), comp = ac.createDynamicsCompressor();
        o.connect(g); g.connect(comp); comp.connect(ac.destination);
        o.type = type||'sine'; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(Math.min(vol||0.4, 0.8), t);
        g.gain.exponentialRampToValueAtTime(0.001, t+(dur||0.2));
        o.start(t); o.stop(t+(dur||0.2)+0.05);
    } catch(e) {}
}
function playMergeSound(lvl)  { var f=260+lvl*80; playTone(f,'sine',0.15,0.5); playTone(f*1.5,'triangle',0.12,0.3,0.07); }
function playDropSound()      { playTone(180,'sine',0.08,0.3); playTone(120,'sine',0.06,0.2,0.04); }
function playGameOverSound()  { [440,330,220,150].forEach(function(f,i){ playTone(f,'sawtooth',0.3+i*0.1,0.5-i*0.05,i*0.2); }); }
function playWatermelonSound(){ [523,659,784,880,1047].forEach(function(f,i){ playTone(f,'sine',0.4,0.5,i*0.1); }); }
function playComboSound(n)    { var f=400+n*100; playTone(f,'triangle',0.2,0.5); playTone(f*1.2,'sine',0.15,0.3,0.08); }

// ── EN İYİ SKOR ──────────────────────────────────────────────────
var bestScore = parseInt(localStorage.getItem('mf_best')||'0', 10);
function updateBestScore() { if(score>bestScore){ bestScore=score; localStorage.setItem('mf_best',bestScore); return true; } return false; }
function refreshBestScoreUI() { var el=$('best-score-header'); if(el) el.innerText=bestScore; }

// ── COMBO ─────────────────────────────────────────────────────────
var comboCount=0, lastMergeTime=0, COMBO_TIMEOUT=2200, mergeFlashes=[];
function showComboDisplay(txt) {
    var el=$('combo-display'); if(!el) return;
    el.textContent=txt; el.classList.remove('hidden');
    void el.offsetWidth; el.style.animation='none'; void el.offsetWidth; el.style.animation='';
    setTimeout(function(){ el.classList.add('hidden'); }, 900);
}

// ── TUTORIAL ──────────────────────────────────────────────────────
var hasSeenTutorial = !!localStorage.getItem('mf_tutorial');
function showTutorial() {
    if (hasSeenTutorial) return;
    var el=$('tutorial-overlay'); if(!el) return;
    el.classList.remove('hidden');
    setTimeout(function(){ el.classList.add('hidden'); }, 3200);
    localStorage.setItem('mf_tutorial','1'); hasSeenTutorial=true;
}

// ── DİL SİSTEMİ ──────────────────────────────────────────────────
var LANG = localStorage.getItem('mf_lang') || ((navigator.language||'').startsWith('tr') ? 'tr' : 'en');

var STRINGS = {
    tr: {
        play:'▶ OYNA', storeBtn:'🛒 MAĞAZA', settingsBtn:'⚙️ AYARLAR',
        themeLabel:['🍎 Meyve Teması','🪨 Taş Teması', '🌊 Derin Deniz Teması'],
        modeTitle:'MOD SEÇ',
        modeNormal:'Normal',      modeNormalDesc:'Klasik sonsuz oyun',
        modeSpeed:'Hız Modu',     modeSpeedDesc:'Otomatik düşüyor, hızlanıyor!',
        modeSurvival:'Hayatta Kal', modeSurvivalDesc:'3 canın var, dikkatli ol!',
        modeTime:'Süre Modu',     modeTimeDesc:'90 saniyede max skor!',
        backBtn:'← Geri',
        scoreLbl:'SKOR', bestLbl:'EN İYİ', coinLbl:'COIN', nextLbl:'SIRADAKİ',
        livesLbl:'CANLAR', timeLbl:'SÜRE',
        gameOverTitle:'OYUN BİTTİ!', scoreLine:'Skorun:',
        namePlaceholder:'Adını gir...', saveScore:'SKORU KAYDET',
        mainMenu:'🏠 ANA MENÜ', topScores:'🏆 EN İYİ SKORLAR',
        newRecord:'🏆 YENİ REKORsun! En İyi: ', bestScoreStr:'🥇 En İyi Skorun: ',
        noScores:'Henüz skor kaydedilmedi.',
        settingsTitle:'AYARLAR', soundLbl:'Ses', langLbl:'Dil', settingsBack:'← Geri',
        soundOn:'🔊 Açık', soundOff:'🔇 Kapalı',
        storeTitleTxt:'MAĞAZA', storeSub:'Boost satın al, oyunu kolaylaştır!',
        closeBtn:'✕ Kapat', returnBtn:'← Oyuna Dön',
        tutTxt:'Meyveleri düşür, birleştir!',
        adBoostWon:" boost'u kazanıldı!", notEnough:'Yetersiz!',
    },
    en: {
        play:'▶ PLAY', storeBtn:'🛒 STORE', settingsBtn:'⚙️ SETTINGS',
        themeLabel:['🍎 Fruit Theme','🪨 Stone Theme', '🌊 Deep Sea Theme'],
        modeTitle:'SELECT MODE',
        modeNormal:'Normal',    modeNormalDesc:'Classic endless game',
        modeSpeed:'Speed Mode', modeSpeedDesc:'Auto-drops and speeds up!',
        modeSurvival:'Survival', modeSurvivalDesc:'3 lives — be careful!',
        modeTime:'Time Mode',   modeTimeDesc:'Max score in 90 seconds!',
        backBtn:'← Back',
        scoreLbl:'SCORE', bestLbl:'BEST', coinLbl:'COIN', nextLbl:'NEXT',
        livesLbl:'LIVES', timeLbl:'TIME',
        gameOverTitle:'GAME OVER!', scoreLine:'Score:',
        namePlaceholder:'Enter name...', saveScore:'SAVE SCORE',
        mainMenu:'🏠 MAIN MENU', topScores:'🏆 TOP SCORES',
        newRecord:'🏆 NEW RECORD! Best: ', bestScoreStr:'🥇 Your Best: ',
        noScores:'No scores saved yet.',
        settingsTitle:'SETTINGS', soundLbl:'Sound', langLbl:'Language', settingsBack:'← Back',
        soundOn:'🔊 On', soundOff:'🔇 Off',
        storeTitleTxt:'STORE', storeSub:'Buy boosts to help your game!',
        closeBtn:'✕ Close', returnBtn:'← Back to Game',
        tutTxt:'Drop & merge to win!',
        adBoostWon:' boost earned!', notEnough:'Not enough!',
    }
};

function setText(id, txt) { var el=$(id); if(el) el.innerText=txt; }

function applyLanguage(lang) {
    LANG = lang;
    localStorage.setItem('mf_lang', lang);
    var s = STRINGS[lang] || STRINGS.en;
    setText('play-btn',       s.play);
    setText('store-btn',      s.storeBtn);
    setText('settings-btn',   s.settingsBtn);
    setText('mode-select-h',  s.modeTitle);
    setText('mn-normal',      s.modeNormal);    setText('md-normal-desc',  s.modeNormalDesc);
    setText('mn-speed',       s.modeSpeed);     setText('md-speed-desc',   s.modeSpeedDesc);
    setText('mn-survival',    s.modeSurvival);  setText('md-survival-desc',s.modeSurvivalDesc);
    setText('mn-time',        s.modeTime);      setText('md-time-desc',    s.modeTimeDesc);
    setText('mode-back-btn',  s.backBtn);
    setText('score-lbl',      s.scoreLbl);
    setText('best-lbl',       s.bestLbl);
    setText('coin-lbl',       s.coinLbl);
    setText('next-lbl',       s.nextLbl);
    setText('lives-lbl',      s.livesLbl);
    setText('timer-lbl',      s.timeLbl);
    setText('game-over-title',s.gameOverTitle);
    setText('score-line-lbl', s.scoreLine);
    setText('save-score-btn', s.saveScore);
    setText('restart-btn',    s.mainMenu);
    setText('lb-title',       s.topScores);
    setText('settings-title', s.settingsTitle);
    setText('settings-sound-lbl', s.soundLbl);
    setText('settings-lang-lbl',  s.langLbl);
    setText('settings-back-btn',  s.settingsBack);
    setText('store-title-txt', s.storeTitleTxt);
    setText('store-sub-txt',   s.storeSub);
    setText('store-back-btn',  s.closeBtn);
    setText('store-return-btn',s.returnBtn);
    setText('tutorial-text',   s.tutTxt);
    var muteEl = $('mute-btn');
    if (muteEl) muteEl.innerText = isMuted ? s.soundOff : s.soundOn;
    var themeEl = $('theme-btn');
    if (themeEl) {
        var tIdx = currentTheme === 'fruits' ? 0 : (currentTheme === 'stones' ? 1 : 2);
        themeEl.innerText = s.themeLabel[tIdx];
    }
    var np = $('player-name'); if(np) np.placeholder = s.namePlaceholder;
    document.querySelectorAll('.lang-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.lang===lang); });
}

// ── DOM ─────────────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
var scoreDisplay    = $('score-display');
var nextItemDisplay = $('next-item-display');
var gameContainer   = $('game-container');
var canvasContainer = $('canvas-container');
var gameOverLine    = $('game-over-line');
var modal           = $('game-over-modal');
var finalScoreEl    = $('final-score');
var restartBtn      = $('restart-btn');
var saveBtn         = $('save-score-btn');
var playerNameInput = $('player-name');
var leaderboardList = $('leaderboard-list');
var mainMenu        = $('main-menu');
var modeSelectEl    = $('mode-select');
var storeMenu       = $('store-menu');
var settingsMenu    = $('settings-menu');
var inGameHeader    = $('in-game-header');
var adOverlay       = $('ad-overlay');
var playBtn         = $('play-btn');
var storeBtn        = $('store-btn');
var storeBackBtn    = $('store-back-btn');
var storeReturnBtn  = $('store-return-btn');
var adStateLoading  = $('ad-state-loading');
var adStateWatching = $('ad-state-watching');
var adStateReward   = $('ad-state-reward');
var adStateError    = $('ad-state-error');
var adProgressFill  = $('ad-progress-fill');
var adRewardText    = $('ad-reward-text');
var adCloseBtn      = $('ad-close-btn');

// ── KAYIT ────────────────────────────────────────────────────────
function loadGameState() {
    try { var d=JSON.parse(localStorage.getItem('suikaGameState')); if(d){ coins=d.coins||0; boosts=d.boosts||{shake:0,bomb:0,swap:0,upgrade:0}; } } catch(e){}
    updateHUDs();
}
function saveGameState() {
    localStorage.setItem('suikaGameState', JSON.stringify({ coins:coins, boosts:boosts }));
}
function updateHUDs() {
    $('coin-display').innerText = coins;
    if($('store-coin-display')) $('store-coin-display').innerText = coins;
    var sb=$('store-count-shake-badge');   if(sb) sb.innerText='x'+boosts.shake;
    var bb=$('store-count-bomb-badge');    if(bb) bb.innerText='x'+boosts.bomb;
    var wb=$('store-count-swap-badge');    if(wb) wb.innerText='x'+boosts.swap;
    var ub=$('store-count-upgrade-badge'); if(ub) ub.innerText='x'+boosts.upgrade;
    $('count-shake').innerText=boosts.shake; $('count-bomb').innerText=boosts.bomb;
    $('count-swap').innerText=boosts.swap;   $('count-upgrade').innerText=boosts.upgrade;
}
function updateScore(v) {
    score=v; scoreDisplay.innerText=score;
    scoreDisplay.style.transform='scale(1.3)';
    setTimeout(function(){ scoreDisplay.style.transform='scale(1)'; },150);
}
function updateLeaderboardUI() {
    var s=STRINGS[LANG]||STRINGS.en;
    var scores=JSON.parse(localStorage.getItem('suikaScores'))||[];
    if(!scores.length){ leaderboardList.innerHTML='<li>'+s.noScores+'</li>'; return; }
    leaderboardList.innerHTML=scores.map(function(sc,i){ return '<li><span>'+(i+1)+'. '+sc.name+'</span><span>'+sc.score+'</span></li>'; }).join('');
}
function saveScore() {
    var name=playerNameInput.value.trim()||'Player';
    var list=JSON.parse(localStorage.getItem('suikaScores'))||[];
    list.push({ name:name, score:score, date:new Date().toLocaleDateString() });
    list.sort(function(a,b){ return b.score-a.score; });
    localStorage.setItem('suikaScores', JSON.stringify(list.slice(0,5)));
    updateLeaderboardUI();
    playerNameInput.value='';
    var s=STRINGS[LANG]||STRINGS.en;
    saveBtn.innerText='✓ OK';
    setTimeout(function(){ saveBtn.innerText=s.saveScore; },2000);
}

// ── FİZİK ────────────────────────────────────────────────────────
function createBoundaries() {
    var opt={isStatic:true,friction:0.1,restitution:0.2,render:{fillStyle:'transparent'}};
    Composite.add(world,[
        Bodies.rectangle(-WALL_T/2,       height/2, WALL_T, height*2, opt),
        Bodies.rectangle(width+WALL_T/2,  height/2, WALL_T, height*2, opt),
        Bodies.rectangle(width/2, height+WALL_T/2,  width*2, WALL_T,  opt)
    ]);
}

// ── SIRADAKİ ÖĞE ─────────────────────────────────────────────────
function getRandomFruitLevel() { return Math.floor(Math.random()*3); }
function setNextFruit() {
    nextFruitLevel = getRandomFruitLevel();
    var f = ITEMS[nextFruitLevel];
    var src = f.imgSource || (f.img && f.img.src);
    nextItemDisplay.innerHTML = src
        ? '<img src="'+src+'" style="width:100%;height:100%;object-fit:contain;">'
        : f.emoji;
}
function createPreviewFruit() { if(!isGameOver) previewX=width/2; }

// ── GİRİŞ OLAYLARI ───────────────────────────────────────────────
function getXY(e) {
    var rect=canvas.getBoundingClientRect();
    var src=(e.touches&&e.touches.length>0)?e.touches[0]:e;
    return { x:src.clientX-rect.left, y:src.clientY-rect.top };
}

// FIX 1: Tıklanan/dokunulan noktaya preview'i taşı → mouseup/touchend drop eder
function handlePointerSetPos(e) {
    if (isDropping||isGameOver||!isGameStarted||bombMode) return;
    e.preventDefault();
    var p=getXY(e), r=ITEMS[nextFruitLevel].radius;
    previewX=Math.max(r, Math.min(p.x, width-r));
}
function handlePointerMove(e) {
    if (isDropping||isGameOver||!isGameStarted||bombMode) return;
    e.preventDefault();
    var p=getXY(e), r=ITEMS[nextFruitLevel].radius;
    previewX=Math.max(r, Math.min(p.x, width-r));
}
function handlePointerDown(e) { // Bomba modu
    if (!isGameStarted||isGameOver||!bombMode) return;
    e.preventDefault();
    var p=getXY(e), bodies=Composite.allBodies(world);
    for(var i=0;i<bodies.length;i++){
        var b=bodies[i]; if(b.label!=='fruit') continue;
        var dx=b.position.x-p.x, dy=b.position.y-p.y;
        if(Math.sqrt(dx*dx+dy*dy)<=b.circleRadius){
            Composite.remove(world,b); boosts.bomb--; saveGameState(); updateHUDs();
            bombMode=false; $('btn-bomb').style.outline=''; break;
        }
    }
}
function handlePointerDrop(e) {
    if (isDropping||isGameOver||!isGameStarted||bombMode) return;
    if(e) e.preventDefault();
    isDropping=true; playDropSound();
    var cfg=ITEMS[nextFruitLevel];
    var body=Bodies.circle(previewX, 50, cfg.radius, {
        restitution:0.2, friction:0.1, density:0.001*(cfg.level+1), label:'fruit',
        customData:{ level:cfg.level, emoji:cfg.emoji, color:cfg.color, hasDropped:true }
    });
    Composite.add(world,body);
    setNextFruit();
    setTimeout(function(){ isDropping=false; createPreviewFruit(); },600);
}

// ── ÇARPIŞMA ─────────────────────────────────────────────────────
function handleCollisions(event) {
    var toRemove=[],toAdd=[],pairs=event.pairs;
    for(var i=0;i<pairs.length;i++){
        var bA=pairs[i].bodyA, bB=pairs[i].bodyB;
        if(bA.label!=='fruit'||bB.label!=='fruit') continue;
        if(bA.customData.level!==bB.customData.level) continue;
        if(toRemove.indexOf(bA)>=0||toRemove.indexOf(bB)>=0) continue;
        if(bA.customData.level>=ITEMS.length-1) continue;
        toRemove.push(bA,bB);
        var lvl=bA.customData.level+1, cfg=ITEMS[lvl];
        var nx=(bA.position.x+bB.position.x)/2, ny=(bA.position.y+bB.position.y)/2;
        var nb=Bodies.circle(nx,ny,cfg.radius,{
            restitution:0.2,friction:0.1,density:0.001*(lvl+1),label:'fruit',
            customData:{ level:cfg.level,emoji:cfg.emoji,color:cfg.color,hasDropped:true }
        });
        Body.setVelocity(nb,{x:(Math.random()-.5)*2, y:(Math.random()-.5)*2});
        toAdd.push(nb);
        coins+=5; saveGameState(); updateHUDs();
        var now=Date.now();
        if(now-lastMergeTime<COMBO_TIMEOUT){ comboCount++; } else { comboCount=1; }
        lastMergeTime=now;
        var mult=comboCount>=6?4:comboCount>=4?3:comboCount>=2?2:1;
        updateScore(score+cfg.score*mult);
        if(comboCount>=2){ playComboSound(comboCount); showComboDisplay(comboCount>=6?'🔥 x4 COMBO!':comboCount>=4?'⚡ x3 COMBO!':'✨ x2 COMBO!'); }
        playMergeSound(lvl);
        mergeFlashes.push({ x:nx,y:ny,r:cfg.radius*1.8,life:1,color:cfg.color });
        if(lvl===ITEMS.length-1){
            playWatermelonSound();
            for(var w=0;w<30;w++){
                var a=Math.random()*Math.PI*2, spd=Math.random()*9+4;
                var pc = '#ff3366';
                if(cfg.isStone) pc = (w%2===0?cfg.hi:cfg.sh);
                else if(cfg.isDeepSea) pc = (w%2===0?cfg.color:'#ffffff');
                else pc = (w%2===0?'#00cc00':'#ff3366');
                particles.push({x:nx,y:ny,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,color:pc,life:1.5,decay:0.02,radius:Math.random()*7+3});
            }
        }
        spawnParticles(nx,ny,cfg.color);
        triggerShake();
    }
    if(toRemove.length){ Composite.remove(world,toRemove); Composite.add(world,toAdd); }
}

function spawnParticles(x,y,color) {
    for(var i=0;i<15;i++){
        var a=Math.random()*Math.PI*2, s=Math.random()*5+2;
        particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,color:color,life:1,decay:Math.random()*.02+.02,radius:Math.random()*4+2});
    }
}
function triggerShake() {
    gameContainer.classList.remove('shake'); void gameContainer.offsetWidth;
    gameContainer.classList.add('shake');
    setTimeout(function(){ gameContainer.classList.remove('shake'); },300);
}

// ── OYUN BİTİŞİ ──────────────────────────────────────────────────
function checkGameOver() {
    if(isGameOver) return;
    var threshold=height*0.15, danger=false, bodies=Composite.allBodies(world);
    for(var i=0;i<bodies.length;i++){
        var b=bodies[i];
        if(b.label!=='fruit'||!b.customData||!b.customData.hasDropped) continue;
        if(b.position.y-b.circleRadius<threshold){
            if(Math.abs(b.velocity.y)<1&&Math.abs(b.velocity.x)<1){
                danger=true;
                if(!b.dangerTime) b.dangerTime=Date.now();
                else if(Date.now()-b.dangerTime>1500){ triggerGameOver(); return; }
            }
        } else { b.dangerTime=0; }
    }
    if(danger) gameOverLine.classList.add('danger'); else gameOverLine.classList.remove('danger');
}
function triggerGameOver() {
    if(currentMode==='survival'&&lives>1){
        lives--; updateModeUI(); playGameOverSound();
        var threshold=height*0.15, bodies=Composite.allBodies(world), toRemove=[];
        for(var i=0;i<bodies.length;i++){
            var b=bodies[i];
            if(b.label==='fruit'&&b.position.y-b.circleRadius<threshold+b.circleRadius*2) toRemove.push(b);
        }
        if(toRemove.length) Composite.remove(world,toRemove);
        gameOverLine.classList.remove('danger');
        Composite.allBodies(world).forEach(function(b){ b.dangerTime=0; });
        return;
    }
    isGameOver=true; stopModeLogic(); playGameOverSound();
    finalScoreEl.innerText=score;
    var isNew=updateBestScore(), s=STRINGS[LANG]||STRINGS.en, bestLine=$('best-score-line');
    if(bestLine) bestLine.innerText=isNew?s.newRecord+bestScore:s.bestScoreStr+bestScore;
    refreshBestScoreUI();
    modal.classList.remove('hidden'); playerNameInput.focus();
}

// ── ÖĞE ÇİZİMİ ──────────────────────────────────────────────────
function drawStone(cfg, x, y, r) { // Fallback (görsel yüklenmediyse)
    var g=ctx.createRadialGradient(x-r*0.32,y-r*0.38,r*0.06,x,y,r);
    g.addColorStop(0,cfg.hi); g.addColorStop(0.45,cfg.color); g.addColorStop(1,cfg.sh);
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5; ctx.stroke();
}
function drawItem(cfg, cx, cy, r, centered) {
    if (cfg.isDeepSea) {
        if (cfg.img && cfg.img.complete && cfg.img.naturalWidth > 0) {
            var w = cfg.img.naturalWidth;
            var h = cfg.img.naturalHeight;
            var maxDim = Math.max(w, h);
            // Dairesel fiziksel gövdenin yarıçapını, canlının en geniş noktasını kapsayacak şekilde dinamik ayarlıyoruz.
            // maxDim, tam olarak çap (2*r) olacak şekilde ölçeklenir.
            var drawW = (w / maxDim) * r * 2;
            var drawH = (h / maxDim) * r * 2;
            if (centered) ctx.drawImage(cfg.img, -drawW/2, -drawH/2, drawW, drawH);
            else          ctx.drawImage(cfg.img, cx - drawW/2, cy - drawH/2, drawW, drawH);
        } else {
            // Yüklenene kadar fallback olarak nokta çiz
            ctx.beginPath(); ctx.arc(centered?0:cx, centered?0:cy, r, 0, Math.PI*2); 
            ctx.fillStyle = cfg.color; ctx.fill();
        }
        return;
    }
    
    var dr=r*(cfg.imgScale||1.0);
    if(cfg.img&&cfg.img.complete&&cfg.img.naturalWidth>0){
        if(centered) ctx.drawImage(cfg.img,-dr,-dr,dr*2,dr*2);
        else         ctx.drawImage(cfg.img,cx-dr,cy-dr,dr*2,dr*2);
    } else if(cfg.isStone) {
        drawStone(cfg, centered?0:cx, centered?0:cy, r);
    } else {
        ctx.font=(r*1.2)+'px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(cfg.emoji, centered?0:cx, centered?r*0.1:cy+r*0.1);
    }
}

// ── RENDER ───────────────────────────────────────────────────────
function renderLoop(time) {
    gameLoopId=requestAnimationFrame(renderLoop);
    var delta=time-lastTime; lastTime=time;
    if(isGameStarted&&!isGameOver) Engine.update(engine,Math.min(delta||16.66,33));
    ctx.clearRect(0,0,width,height); checkGameOver();
    if(!isDropping&&!isGameOver&&isGameStarted){
        var cfg=ITEMS[nextFruitLevel];
        ctx.save(); ctx.globalAlpha=0.55;
        drawItem(cfg,previewX,50,cfg.radius,false);
        ctx.restore();
    }
    var bodies=Composite.allBodies(world);
    for(var i=0;i<bodies.length;i++){
        var b=bodies[i]; if(b.label!=='fruit'||!b.customData) continue;
        ctx.save(); ctx.translate(b.position.x,b.position.y); ctx.rotate(b.angle);
        drawItem(ITEMS[b.customData.level],0,0,b.circleRadius,true);
        ctx.restore();
    }
    for(var j=particles.length-1;j>=0;j--){
        var p=particles[j];
        ctx.save(); ctx.globalAlpha=p.life>1?1:p.life;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=p.decay; if(p.life<=0) particles.splice(j,1);
    }
    for(var k=mergeFlashes.length-1;k>=0;k--){
        var fl=mergeFlashes[k];
        ctx.save(); ctx.globalAlpha=fl.life*0.6;
        ctx.beginPath(); ctx.arc(fl.x,fl.y,fl.r*(2-fl.life),0,Math.PI*2);
        ctx.strokeStyle=fl.color; ctx.lineWidth=4*fl.life; ctx.stroke(); ctx.restore();
        fl.life-=0.08; if(fl.life<=0) mergeFlashes.splice(k,1);
    }
}

// ── OYUN BAŞLATMA / SIFIRLAMA ─────────────────────────────────────
function restartGame() {
    stopModeLogic(); Composite.clear(world); createBoundaries();
    score=0; updateScore(0); comboCount=0; lastMergeTime=0; mergeFlashes=[];
    isGameOver=false; isDropping=false; bombMode=false; particles=[];
    $('btn-bomb').style.outline='';
    modal.classList.add('hidden'); gameOverLine.classList.remove('danger');
    setNextFruit(); createPreviewFruit(); lastTime=performance.now();
}
function initGame() {
    canvas=document.createElement('canvas'); ctx=canvas.getContext('2d');
    canvasContainer.appendChild(canvas);
    engine=Engine.create(); world=engine.world; engine.gravity.y=1.5;
    width=400; height=600; canvas.width=width; canvas.height=height;
    ctx.imageSmoothingEnabled=true;
    createBoundaries(); updateScore(0); setNextFruit(); createPreviewFruit();
    canvas.addEventListener('mousedown',   handlePointerSetPos, { passive:false }); // FIX 1
    canvas.addEventListener('touchstart',  handlePointerSetPos, { passive:false }); // FIX 1
    canvas.addEventListener('mousemove',   handlePointerMove,   { passive:false });
    canvas.addEventListener('touchmove',   handlePointerMove,   { passive:false });
    canvas.addEventListener('mouseup',     handlePointerDrop,   { passive:false });
    canvas.addEventListener('touchend',    handlePointerDrop,   { passive:false });
    canvas.addEventListener('pointerdown', handlePointerDown,   { passive:false }); // Bomba
    Events.on(engine,'collisionStart',handleCollisions);
    lastTime=performance.now(); gameLoopId=requestAnimationFrame(renderLoop);
    updateLeaderboardUI(); loadGameState();
}

// ── MAĞAZA ───────────────────────────────────────────────────────
function openStore(fromGame) {
    storeMenu.classList.remove('hidden'); updateHUDs();
    storeReturnBtn.style.display=(fromGame&&isGameStarted&&!isGameOver)?'block':'none';
}

// ── REKLAM ───────────────────────────────────────────────────────
function setAdState(s){ adStateLoading.style.display=s==='loading'?'':'none'; adStateWatching.style.display=s==='watching'?'':'none'; adStateReward.style.display=s==='reward'?'':'none'; adStateError.style.display=s==='error'?'':'none'; }
var adProgressInterval=null;
function stopAdProgress(){
    if(adProgressInterval){ clearInterval(adProgressInterval); adProgressInterval=null; }
    if(adOverlay._noAdTimer){ clearTimeout(adOverlay._noAdTimer); adOverlay._noAdTimer=null; }
    if(adOverlay._simInterval){ clearInterval(adOverlay._simInterval); adOverlay._simInterval=null; }
    adProgressFill.style.width='100%';
}
function giveBoostReward(type,name){
    boosts[type]++; saveGameState(); updateHUDs();
    var icons={shake:'🫨',bomb:'💣',swap:'🔄',upgrade:'⭐'}, s=STRINGS[LANG]||STRINGS.en;
    adRewardText.innerText=(icons[type]||'🎁')+' '+name+s.adBoostWon;
    setAdState('reward'); setTimeout(function(){ adOverlay.classList.add('hidden'); },2500);
}
function showRewardedAd(type,name){
    adOverlay.classList.remove('hidden'); setAdState('loading');
    if(typeof adBreak==='function'){
        adBreak({
            type:'reward',name:'boost-'+type,
            beforeReward:function(show){ setAdState('watching'); adProgressFill.style.width='0%'; var e=0; adProgressInterval=setInterval(function(){ e+=200; adProgressFill.style.width=Math.min(e/30000*100,99)+'%'; },200); show(); },
            adDismissed:function(){ stopAdProgress(); adOverlay.classList.add('hidden'); },
            adViewed:function(){ stopAdProgress(); giveBoostReward(type,name); },
            afterAd:function(){}
        });
        adOverlay._noAdTimer=setTimeout(function(){ if(adStateLoading.style.display!=='none') setAdState('error'); },8000);
    } else {
        setAdState('watching'); var p=0; adProgressFill.style.width='0%';
        adOverlay._simInterval=setInterval(function(){ p+=3.3; adProgressFill.style.width=Math.min(p,100)+'%'; if(p>=100){ clearInterval(adOverlay._simInterval); giveBoostReward(type,name); } },1000);
    }
}

// ── MOD MANTIĞI ──────────────────────────────────────────────────
function stopModeLogic(){
    if(speedTimer)    { clearTimeout(speedTimer);     speedTimer=null; }
    if(timerInterval) { clearInterval(timerInterval); timerInterval=null; }
}
function updateModeUI(){
    var lb=$('lives-board'), tb=$('timer-board'), le=$('lives-display'), te=$('timer-display');
    if(lb) lb.classList.toggle('hidden', currentMode!=='survival');
    if(tb) tb.classList.toggle('hidden', currentMode!=='time');
    if(currentMode==='survival'&&le) le.innerText='❤️'.repeat(Math.max(0,lives));
    if(currentMode==='time'&&te){ te.innerText=timeLeft; te.classList.toggle('urgent',timeLeft<=10); }
}
function scheduleSpeedDrop(){
    speedTimer=setTimeout(function(){
        if(!isGameOver&&isGameStarted&&!isDropping) handlePointerDrop(null);
        speedDelay=Math.max(600,speedDelay-80); scheduleSpeedDrop();
    },speedDelay);
}
function startTimer(){
    timerInterval=setInterval(function(){
        if(isGameOver||!isGameStarted) return;
        timeLeft=Math.max(0,timeLeft-1); updateModeUI();
        if(timeLeft<=0){ clearInterval(timerInterval); timerInterval=null; triggerGameOver(); }
    },1000);
}
function startModeLogic(){ stopModeLogic(); if(currentMode==='speed') scheduleSpeedDrop(); if(currentMode==='time') startTimer(); }
function startGameWithMode(mode){
    currentMode=mode;
    if(modeSelectEl) modeSelectEl.classList.add('hidden');
    canvasContainer.classList.remove('hidden'); inGameHeader.classList.remove('hidden');
    try{
        var cw=gameContainer.offsetWidth||400, hh=inGameHeader.offsetHeight||80, ch=gameContainer.offsetHeight||700;
        width=cw; height=Math.max(ch-hh,300);
    } catch(e){ width=400; height=580; }
    canvas.width=width; canvas.height=height; ctx.imageSmoothingEnabled=true;
    lives=3; timeLeft=90; speedDelay=3000;
    updateModeUI(); restartGame(); isGameStarted=true; showTutorial(); refreshBestScoreUI(); startModeLogic();
}

// ── UI OLAYLARI ──────────────────────────────────────────────────
playBtn.addEventListener('click', function(){
    mainMenu.classList.add('hidden');
    if(modeSelectEl) modeSelectEl.classList.remove('hidden'); else startGameWithMode('normal');
});
restartBtn.addEventListener('click', function(){
    stopModeLogic(); modal.classList.add('hidden');
    canvasContainer.classList.add('hidden'); inGameHeader.classList.add('hidden');
    var lb=$('lives-board'),tb=$('timer-board');
    if(lb) lb.classList.add('hidden'); if(tb) tb.classList.add('hidden');
    mainMenu.classList.remove('hidden'); isGameStarted=false;
});
saveBtn.addEventListener('click', saveScore);
storeBtn.addEventListener('click',       function(){ openStore(false); });
storeBackBtn.addEventListener('click',   function(){ storeMenu.classList.add('hidden'); });
storeReturnBtn.addEventListener('click', function(){ storeMenu.classList.add('hidden'); });
if(adCloseBtn) adCloseBtn.addEventListener('click', function(){ adOverlay.classList.add('hidden'); });

// Mod butonları
['normal','speed','survival','time'].forEach(function(m){
    var btn=$('mode-'+m); if(btn) btn.addEventListener('click', function(){ startGameWithMode(m); });
});
var modeBackBtn=$('mode-back-btn');
if(modeBackBtn) modeBackBtn.addEventListener('click', function(){ if(modeSelectEl) modeSelectEl.classList.add('hidden'); mainMenu.classList.remove('hidden'); });

// FIX 2: Tema butonu — mevcut temayı göster
var themeBtn=$('theme-btn');
if(themeBtn){
    themeBtn.addEventListener('click', function(){
        if (currentTheme === 'fruits') {
            currentTheme = 'stones';
            ITEMS = STONES;
        } else if (currentTheme === 'stones') {
            currentTheme = 'deepsea';
            ITEMS = DEEPSEA;
        } else {
            currentTheme = 'fruits';
            ITEMS = FRUITS;
        }
        var s = STRINGS[LANG] || STRINGS.en;
        var tIdx = currentTheme === 'fruits' ? 0 : (currentTheme === 'stones' ? 1 : 2);
        themeBtn.innerText = s.themeLabel[tIdx];
        
        // Tema değişiminde arkaplanı ayarla
        document.body.className = currentTheme + '-theme';
        
        if(isGameStarted){ setNextFruit(); createPreviewFruit(); }
    });
}

// Ayarlar
var settingsBtn=$('settings-btn');
if(settingsBtn) settingsBtn.addEventListener('click', function(){ mainMenu.classList.add('hidden'); if(settingsMenu) settingsMenu.classList.remove('hidden'); });
var settingsBackBtn=$('settings-back-btn');
if(settingsBackBtn) settingsBackBtn.addEventListener('click', function(){ if(settingsMenu) settingsMenu.classList.add('hidden'); mainMenu.classList.remove('hidden'); });

// Dil butonları
document.querySelectorAll('.lang-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ applyLanguage(btn.dataset.lang); });
});

// Ses (mute) — artık Ayarlar'da
var muteBtn=$('mute-btn');
if(muteBtn){
    muteBtn.addEventListener('click', function(){
        isMuted=!isMuted;
        localStorage.setItem('mf_muted', isMuted?'1':'0');
        var s=STRINGS[LANG]||STRINGS.en;
        muteBtn.innerText=isMuted?s.soundOff:s.soundOn;
        if(!isMuted) getAudioCtx();
    });
}

// Boost butonları
$('btn-shake').addEventListener('click', function(){
    if(!isGameStarted||isGameOver) return;
    if(boosts.shake>0){ boosts.shake--; saveGameState(); updateHUDs(); Composite.allBodies(world).forEach(function(b){ if(b.label==='fruit') Body.applyForce(b,b.position,{x:(Math.random()-.5)*.08,y:-Math.random()*.06}); }); } else openStore(true);
});
$('btn-bomb').addEventListener('click', function(){
    if(!isGameStarted||isGameOver) return;
    if(boosts.bomb>0){ bombMode=true; $('btn-bomb').style.outline='3px solid #ef4444'; } else openStore(true);
});
$('btn-swap').addEventListener('click', function(){
    if(!isGameStarted||isGameOver) return;
    if(boosts.swap>0){ boosts.swap--; saveGameState(); updateHUDs(); setNextFruit(); createPreviewFruit(); } else openStore(true);
});
$('btn-upgrade').addEventListener('click', function(){
    if(!isGameStarted||isGameOver) return;
    if(boosts.upgrade>0){ boosts.upgrade--; saveGameState(); updateHUDs(); if(nextFruitLevel<ITEMS.length-1){ nextFruitLevel++; createPreviewFruit(); } } else openStore(true);
});

var BOOST_NAMES={shake:'Shake',bomb:'Bomb',swap:'Swap',upgrade:'Upgrade'};
document.querySelectorAll('.buy-coin-btn,.store-buy-coin').forEach(function(btn){
    btn.addEventListener('click', function(){
        var type=btn.dataset.type, price=parseInt(btn.dataset.price,10), s=STRINGS[LANG]||STRINGS.en;
        if(coins>=price){ coins-=price; boosts[type]++; saveGameState(); updateHUDs(); btn.style.transform='scale(0.92)'; setTimeout(function(){ btn.style.transform=''; },150); }
        else{ var orig=btn.textContent; btn.textContent=s.notEnough; btn.style.background='#ef4444'; setTimeout(function(){ btn.textContent=orig; btn.style.background=''; },1200); }
    });
});
document.querySelectorAll('.buy-ad-btn,.store-buy-ad').forEach(function(btn){
    btn.addEventListener('click', function(){ showRewardedAd(btn.dataset.type, BOOST_NAMES[btn.dataset.type]||btn.dataset.type); });
});

if(typeof adConfig==='function') adConfig({ preloadAdBreaks:'on', sound:'on' });

initGame();
applyLanguage(LANG); // Dil uygula
