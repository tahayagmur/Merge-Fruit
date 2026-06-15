// ╔══════════════════════════════════════════════════════════╗
// ║   CityRush 3D — Three.js / WebGL · Açık Dünya GTA tarzı    ║
// ╚══════════════════════════════════════════════════════════╝
import * as THREE from 'three';

// ─────────────── TEMEL KURULUM ───────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e0);
scene.fog = new THREE.Fog(0x87b8e0, 120, 360);

const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 1000);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ─────────────── SES MOTORU ───────────────
// Dosyalar  sounds/<isim>.mp3 (ya da .wav/.ogg) klasöründen yüklenir.
// Dosya yoksa eski WebAudio sentez sesi ('fb') çalar — oyun her durumda sesli.
let _ac=null;
function beep(freq=400,dur=0.15,type='square',vol=0.05){
  try{
    _ac=_ac||new (window.AudioContext||window.webkitAudioContext)();
    if(_ac.state==='suspended') _ac.resume();
    const o=_ac.createOscillator(), g=_ac.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=vol*AUDIO.master;
    o.connect(g); g.connect(_ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001,_ac.currentTime+dur);
    o.stop(_ac.currentTime+dur);
  }catch(e){}
}
// Ses ayarı + olay tablosu (vol: ses, loop: döngü, music: müzik kanalı, fb: dosya yoksa sentez)
const AUDIO={ master:0.9, muted:false };
const SOUNDS={
  // arayüz
  ui:        {vol:.5,           fb:()=>beep(520,0.05)},
  error:     {vol:.6,           fb:()=>beep(150,0.12,'square',0.07)},
  buy:       {vol:.7,           fb:()=>{beep(660,.08,'sine',.07);setTimeout(()=>beep(990,.12,'sine',.07),70);}},
  capture:   {vol:.8,           fb:()=>{beep(660,.08);setTimeout(()=>beep(990,.12),70);}},
  // silahlar
  shot_pistol: {vol:.6,         fb:()=>beep(220,0.05,'square',0.06)},
  shot_smg:    {vol:.45,        fb:()=>beep(260,0.04,'square',0.05)},
  shot_shotgun:{vol:.7,         fb:()=>beep(120,0.08,'square',0.08)},
  shot_rifle:  {vol:.6,         fb:()=>beep(200,0.05,'square',0.06)},
  shot_awp:    {vol:.8,         fb:()=>beep(90,0.12,'square',0.09)},
  punch:     {vol:.6,           fb:()=>beep(160,0.05,'sine',0.06)},
  grenade:   {vol:.5,           fb:()=>beep(500,0.05)},
  explosion: {vol:.85,          fb:()=>{beep(55,.45,'sawtooth',.13);beep(110,.3,'square',.1);}},
  // oyuncu / olaylar
  kill:      {vol:.5,           fb:()=>beep(300,0.05)},
  death:     {vol:.6,           fb:()=>beep(140,0.18,'sawtooth',0.06)},
  voice:     {vol:.5,           fb:()=>beep(150,0.10,'sine',0.04)},
  hurt:      {vol:.5,           fb:()=>beep(180,0.08,'square',0.05)},
  jump:      {vol:.4,           fb:()=>beep(420,0.08,'sine',0.05)},
  pickup:    {vol:.6,           fb:()=>beep(700,0.06)},
  cash:      {vol:.7,           fb:()=>beep(740,0.07,'sine',0.06)},
  levelup:   {vol:.8,           fb:()=>beep(880,0.15)},
  mission_start:{vol:.7,        fb:()=>beep(660,0.08)},
  mission_done:{vol:.85,        fb:()=>{beep(660,.08);setTimeout(()=>beep(990,.12),70);}},
  phone_msg: {vol:.7,           fb:()=>beep(700,0.09)},
  // araç
  car_enter: {vol:.6,           fb:()=>beep(330,0.10,'sine',0.05)},
  crash:     {vol:.6,           fb:()=>beep(90,0.18,'square',0.08)},
  siren:     {vol:.4},   // TEK ATIŞ (~2 sn) — yıldız her arttığında çalar
  engine:    {vol:.35},   // TEK ATIŞ (~1 sn) — araca binince bir kez çalar
  // döngüler (dosya yoksa SESSİZ — sentez döngü rahatsız edici olur)
  rain:      {vol:.30, loop:true},
  music_menu:{vol:.45, loop:true, music:true},
  music_game:{vol:.28, loop:true, music:true},
};
const SND_EXT=['mp3','wav','ogg'];
const sndCache={};
function loadSound(name){
  const cfg=SOUNDS[name]||{};
  const entry={base:null, ready:false, missing:false, cfg}; sndCache[name]=entry;
  let i=0;
  const tryNext=()=>{
    if(i>=SND_EXT.length){ entry.missing=true; return; }
    const a=new Audio(); a.preload='auto'; a.src='sounds/'+name+'.'+SND_EXT[i];
    a.addEventListener('canplaythrough',()=>{ if(!entry.ready){ entry.base=a; entry.ready=true; } },{once:true});
    a.addEventListener('error',()=>{ i++; tryNext(); },{once:true});
    a.load();
  };
  tryNext();
  return entry;
}
function preloadSounds(){ for(const n in SOUNDS) loadSound(n); }
function playSnd(name,opts){
  if(AUDIO.muted) return;
  const e=sndCache[name]||loadSound(name); const cfg=e.cfg||SOUNDS[name]||{};
  const vol=((opts&&opts.vol!=null)?opts.vol:(cfg.vol||1))*AUDIO.master;
  if(e.ready && e.base){
    if(cfg.loop){ if(e.base.paused){ e.base.loop=true; e.base.volume=vol; e.base.play().catch(()=>{}); } return; }
    const c=e.base.cloneNode(); c.volume=vol; if(opts&&opts.rate) c.playbackRate=opts.rate; c.play().catch(()=>{});
  } else if(cfg.fb && !cfg.loop){ cfg.fb(); }   // dosya yok → sentez (sadece tek-atış)
}
// sinematik mırıldanma — perde karaktere göre değişir (kalın/ince)
const VOICE_RATE={'Don Karlo':0.72,'Chief':0.9,'Viper':0.98,'Marco':1.06,'Rosa':1.32,'You':1.0,'Rival Boss':0.85,'Crossroads':0.9,'???':0.8};
function speakMumble(speaker){ if(!speaker) return; const r=(VOICE_RATE[speaker]||1.0)*(0.97+Math.random()*0.06); playSnd('voice',{rate:r,vol:0.5}); }
function stopSnd(name){ const e=sndCache[name]; if(e&&e.base){ try{ e.base.pause(); e.base.currentTime=0; }catch(_){} } }
function setMusic(name){ for(const n in SOUNDS){ if(SOUNDS[n].music && n!==name) stopSnd(n); } if(name && !AUDIO.musicOff) playSnd(name); }
function toggleMute(){ AUDIO.muted=!AUDIO.muted; if(AUDIO.muted){ for(const n in SOUNDS) if(SOUNDS[n].loop) stopSnd(n); } flash(AUDIO.muted?'🔇 Sound off':'🔊 Sound on',1.5); }
function crashSound(){ playSnd('crash'); }
preloadSounds();

// ─────────────── IŞIK ───────────────
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(60, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
sun.shadow.camera.far = 600;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xa0b0d0, 1.1));
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.8);
scene.add(hemi);

// ─────────────── DURUM ───────────────
const S = {
  mode: 'menu',
  hp: 100, maxHp: 100, money: 500, score: 0,
  wanted: 0, wantedTimer: 0, kills: 0, heatKills: 0,   // heatKills = mevcut aranma için öldürme (temizlenince sıfırlanır)
  weapon: 'fists', scoped: false, ads: false, fireMode: {},
  inCar: false, car: null,
  missionsDone: [], active: null, stageIdx: 0, prog: 0,
  shootCd: 0, deadTimer: 0, dayTime: 0.3,
  recoil: 0, chSpread: 0,   // recoil itkisi(px) ve anlık nişangah açıklığı(px)
  vy: 0, onGround: true,    // dikey hız ve yere temas (zıplama)
  stamina: 100, maxStamina: 100, sprinting: false,  // koşma
  level: 1, xp: 0,          // RPG ilerleme
  raining: false, clock: 0, rainManualT: 0,  // hava + dünya saati
  saveT: 0,                 // otomatik kayıt zamanlayıcısı
  // ── HİKÂYE / DÜNYA SİSTEMLERİ ──
  trust: { marco:10, rosa:0, viper:0, karlo:0, police:30 }, // güven (0-100)
  policeSus: 0, gangSus: 0,  // çift şüphe (0-100): polis seni mi takip ediyor, çete mi şüpheleniyor
  news: [],                  // gazete/haber kayıtları
  day: 1, lastDay: 1,        // dünya günü
  incomeT: 0,                // koruma parası zamanlayıcısı
  chapter: 1,                // hikâye bölümü
  story: { opened:false, cop:false, don:false, finale:false, ending:null, warehouseActive:false },
  messages: [], objective: '', // telefon mesajları + güncel hedef
};

// ─────────────── SİLAHLAR ───────────────
// dmg: hasar · cd: atış aralığı(sn) · speed: mermi hızı · pellets: saçma sayısı
// spread: dağılma · zoom: dürbün var mı · icon · color: mermi rengi
// chBase: nişangah dinlenme açıklığı(px) · recoil: ateşte genişleme(px) · kick: dikey geri tepme(rad)
// melee: yakın dövüş (yumruk) · range: yumruk menzili
const WEAPONS = {
  fists:  {name:'Fists',   melee:true, dmg:40, cd:0.40, range:2.8, zoom:0, icon:'👊'},
  pistol: {name:'Pistol',  dmg:25,  cd:0.30, speed:70,  pellets:1, spread:0.012, zoom:0, icon:'🔫', color:0xffee44, chBase:9,  recoil:7,  kick:0.010, modes:['single']},
  smg:    {name:'Uzi',     dmg:16,  cd:0.08, speed:75,  pellets:1, spread:0.05,  zoom:0, icon:'🧨', color:0xffcc44, chBase:15, recoil:5,  kick:0.006, modes:['auto']},
  shotgun:{name:'Shotgun', dmg:16,  cd:0.75, speed:60,  pellets:8, spread:0.14,  zoom:0, icon:'💥', color:0xff8844, chBase:24, recoil:16, kick:0.022, modes:['single','auto']},
  rifle:  {name:'AK-47',   dmg:32,  cd:0.12, speed:85,  pellets:1, spread:0.035, zoom:0, icon:'🔫', color:0xffaa33, chBase:13, recoil:9,  kick:0.012, modes:['single','auto']},
  awp:    {name:'AWP',     dmg:150, cd:1.40, speed:160, pellets:1, spread:0.0,   zoom:1, icon:'🎯', color:0xff3344, chBase:0,  recoil:0,  kick:0.0, modes:['single']},
  grenade:{name:'Grenade', thrown:true, dmg:140, cd:1.0, radius:9, zoom:0, icon:'💣', chBase:18, color:0x556633},
};
const WHEEL = ['fists','pistol','smg','shotgun','rifle','awp','grenade']; // çark sırası (1-7)
// başlangıç cephanesi (hepsi açık, deneyebilesin diye)
S.ammo = { pistol: 9999, smg: 160, shotgun: 30, rifle: 120, awp: 20, grenade: 10 };
function curW(){ return WEAPONS[S.weapon]; }
function curAmmo(){ return S.ammo[S.weapon]; }
// atış modu: 'single' (tekli) / 'auto' (tarama)
function curMode(){ const m=curW().modes; if(!m) return null; return S.fireMode[S.weapon]||m[0]; }
function toggleFireMode(){
  const m=curW().modes;
  if(!m || m.length<2){ flash('This weapon has only one fire mode',1.2); return; }
  const cur=S.fireMode[S.weapon]||m[0];
  const next=m[(m.indexOf(cur)+1)%m.length];
  S.fireMode[S.weapon]=next;
  flash('Fire mode: '+(next==='auto'?'Auto 🔁':'Single •'),1.4); beep(520,0.05);
}

// ─────────────── DÜNYA / ŞEHİR ───────────────
const WORLD = 540, HALF = WORLD/2, BLOCK = 30, ROADW = 9;  // büyük şehir (bölge fetihleri için)
// LİMAN — şehrin +Z kenarına ek olarak çıkan iskele (rıhtım) bölgesi
const HARBOR=[0,296], HARBOR_HALF_W=46, HARBOR_Z_MAX=326;  // teslimat/depo noktası ve koridor
const colliders = []; // {x,z,hw,hd} bina kutuları (yaya/araç engeli)

// DENİZ — şehrin altında devasa su düzlemi (kenarların ötesi her yönde deniz)
const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshLambertMaterial({ color: 0x1d5878 }));
sea.rotation.x = -Math.PI/2; sea.position.y = -0.5; scene.add(sea);
// zemin (şehir karası — denizin üstünde)
const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a5a3a });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// yollar (ızgara)
const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e34 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0xdcc83c });
for (let g = -HALF; g <= HALF; g += BLOCK) {
  const rH = new THREE.Mesh(new THREE.PlaneGeometry(ROADW, WORLD), roadMat);
  rH.rotation.x = -Math.PI/2; rH.position.set(g, 0.02, 0); rH.receiveShadow = true; scene.add(rH);
  const rV = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, ROADW), roadMat);
  rV.rotation.x = -Math.PI/2; rV.position.set(0, 0.02, g); rV.receiveShadow = true; scene.add(rV);
  const lH = new THREE.Mesh(new THREE.PlaneGeometry(0.4, WORLD), lineMat);
  lH.rotation.x = -Math.PI/2; lH.position.set(g, 0.04, 0); scene.add(lH);
  const lV = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 0.4), lineMat);
  lV.rotation.x = -Math.PI/2; lV.position.set(0, 0.04, g); scene.add(lV);
}

// binalar
const buildingColors = [0x6a6f80, 0x7a6258, 0x586a72, 0x6b6b58, 0x55556b, 0x78705f];
const winMat = new THREE.MeshLambertMaterial({ color: 0x9ab4d8, emissive: 0x1a2535 });
const blockCenters = [];
const boxGeo = new THREE.BoxGeometry(1,1,1);
// 3 polis karakolu konumu (bu bloklar binadan temizlenir)
const STATIONS = [[-105,-45],[105,45],[-45,105]];
const SHOP_BLOCK=[15,45];        // mağaza bu bloktaki binanın zemin katında
const SHOP=[15,33];              // dükkân etkileşim noktası (binanın yola bakan ön yüzü)
function nearStation(cx,cz){ return STATIONS.some(s=>Math.abs(cx-s[0])<2 && Math.abs(cz-s[1])<2); }
function isShopBlock(cx,cz){ return Math.abs(cx-SHOP_BLOCK[0])<2 && Math.abs(cz-SHOP_BLOCK[1])<2; }
for (let bx = -HALF + BLOCK; bx < HALF; bx += BLOCK) {
  for (let bz = -HALF + BLOCK; bz < HALF; bz += BLOCK) {
    const cx = bx - BLOCK/2, cz = bz - BLOCK/2;
    blockCenters.push([cx, cz]);
    if (nearStation(cx,cz) || isShopBlock(cx,cz)) continue;   // karakol & mağaza blokları ayrı kurulur
    if (Math.random() < 0.18) { // park
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK-10, BLOCK-10),
        new THREE.MeshLambertMaterial({ color: 0x3a9648 }));
      grass.rotation.x = -Math.PI/2; grass.position.set(cx, 0.05, cz); grass.receiveShadow = true; scene.add(grass);
      for (let t=0; t<4; t++){
        const tx = cx + (Math.random()-.5)*16, tz = cz + (Math.random()-.5)*16;
        const trunk = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x5a3a1e}));
        trunk.scale.set(0.6,2,0.6); trunk.position.set(tx,1,tz); trunk.castShadow=true; scene.add(trunk);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1,8,8), new THREE.MeshLambertMaterial({color:0x2a8a3a}));
        leaf.scale.set(2.4,2.4,2.4); leaf.position.set(tx,3.2,tz); leaf.castShadow=true; scene.add(leaf);
      }
      continue;
    }
    const n = 1 + Math.floor(Math.random()*3);
    for (let i=0; i<n; i++){
      const h = 6 + Math.random()*26, w = 5 + Math.random()*4, d = 5 + Math.random()*4;
      const ox = (Math.random()-.5)*12, oz = (Math.random()-.5)*12;
      const mat = new THREE.MeshLambertMaterial({ color: buildingColors[Math.floor(Math.random()*buildingColors.length)] });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w,h,d); b.position.set(cx+ox, h/2, cz+oz);
      b.castShadow = true; b.receiveShadow = true; scene.add(b);
      colliders.push({ x: cx+ox, z: cz+oz, hw: w/2+0.15, hd: d/2+0.15 });
      // pencere paneli
      const win = new THREE.Mesh(boxGeo, winMat);
      win.scale.set(w*0.7, h*0.5, 0.2); win.position.set(cx+ox, h*0.55, cz+oz + d/2+0.05);
      scene.add(win);
    }
  }
}

// ─────────────── POLİS KARAKOLLARI ───────────────
// Suç işleyince polisler en yakın karakoldan çıkar (rastgele spawn yok).
for(const [sx,sz] of STATIONS){
  const base=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x2a3550}));
  base.scale.set(20,9,16); base.position.set(sx,4.5,sz); base.castShadow=true; base.receiveShadow=true; scene.add(base);
  colliders.push({x:sx, z:sz, hw:10.1, hd:8.1});
  // mavi şerit (polis binası)
  const stripe=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0x2a6cff})); stripe.scale.set(20.2,1.2,16.2); stripe.position.set(sx,7.6,sz); scene.add(stripe);
  // giriş & basamak
  const door=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x141824})); door.scale.set(4,5,0.6); door.position.set(sx,2.5,sz+8.1); scene.add(door);
  // "POLICE" tabelası
  const sign=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0xffffff})); sign.scale.set(12,2,0.5); sign.position.set(sx,8.6,sz+8); scene.add(sign);
  // tepede dönen mavi ışık
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(0.8,10,10),new THREE.MeshBasicMaterial({color:0x3a8cff})); beacon.position.set(sx,9.8,sz); scene.add(beacon);
  const bl=new THREE.PointLight(0x3a8cff,2,30); bl.position.set(sx,11,sz); scene.add(bl);
}
// oyuncuya en yakın karakol noktası (polis buradan çıkar)
function nearestStation(x,z){ let best=STATIONS[0], bd=1e9; for(const s of STATIONS){ const d=(s[0]-x)**2+(s[1]-z)**2; if(d<bd){bd=d; best=s;} } return best; }

// dünya sınır duvarları (görünmez, çıkışı engeller)
function clampWorld(p){
  const m = HALF - 4;
  p.x = Math.max(-m, Math.min(m, p.x));
  // LİMAN KORİDORU: belirli x aralığında +Z yönünde iskeleye taşabilir
  let maxZ = m;
  if(Math.abs(p.x - HARBOR[0]) < HARBOR_HALF_W) maxZ = HARBOR_Z_MAX;
  p.z = Math.max(-m, Math.min(maxZ, p.z));
}
function blockedAt(x, z, r=1.2){
  for (const c of colliders){
    if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true;
  }
  return false;
}
// Yol ızgarası üzerinde hedefe doğru kovala (yollar engelsiz → her yere ulaşır)
// Yol ızgarasında oyuncuyu kovala: kavşaktan kavşağa ilerler (komşu kavşaklar yolla bağlı).
// Düğüme TAM oturup sonraki düğümü seçer → ileri-geri salınım yok, hep yolda kalır.
function gridChase(c, tx, tz, dt, speed){
  const ud=c.userData;
  if(!ud.node) ud.node={x:nearestLine(c.position.x), z:nearestLine(c.position.z)};
  const dd=dist2(c.position.x,c.position.z,ud.node.x,ud.node.z);
  if(dd<=speed*dt+0.4){
    // düğüme vardı → tam otur, oyuncuya yaklaştıran komşu kavşağı seç
    c.position.x=ud.node.x; c.position.z=ud.node.z;
    const gx=ud.node.x, gz=ud.node.z, dx=tx-gx, dz=tz-gz;
    let nx=gx, nz=gz;
    const stepX=()=>{ if(Math.abs(dx)>BLOCK*0.5){ nx=gx+Math.sign(dx)*BLOCK; nz=gz; return true; } return false; };
    const stepZ=()=>{ if(Math.abs(dz)>BLOCK*0.5){ nz=gz+Math.sign(dz)*BLOCK; nx=gx; return true; } return false; };
    // rota grubuna göre eksen önceliği (2 grup farklı koldan gelir)
    const ok = ud.routeBias===0 ? (stepX()||stepZ()) : (stepZ()||stepX());
    if(!ok){ nx=gx; nz=gz; }  // hizalı: yerinde bekle (standoff devralır)
    ud.node={ x:Math.max(-HALF+BLOCK,Math.min(HALF-BLOCK,nx)), z:Math.max(-HALF+BLOCK,Math.min(HALF-BLOCK,nz)) };
  } else {
    const ang=Math.atan2(ud.node.x-c.position.x, ud.node.z-c.position.z);
    c.rotation.y=ang;
    c.position.x += Math.sin(ang)*speed*dt;
    c.position.z += Math.cos(ang)*speed*dt;
  }
}
// Engele takılınca tek eksende kayarak etrafından dolaş (polis/yaya/rakip için basit yol bulma)
function slideMove(obj, dx, dz, r){
  const x=obj.position.x, z=obj.position.z;
  if(!blockedAt(x+dx, z+dz, r)){ obj.position.x=x+dx; obj.position.z=z+dz; return true; }
  if(!blockedAt(x+dx, z, r)){ obj.position.x=x+dx; return true; }   // sadece X ekseni
  if(!blockedAt(x, z+dz, r)){ obj.position.z=z+dz; return true; }   // sadece Z ekseni
  return false;
}

// ─────────────── OYUNCU ───────────────
const player = new THREE.Group();
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a78dc });
const torso = new THREE.Mesh(boxGeo, bodyMat); torso.scale.set(1,1.4,0.7); torso.position.y=1.1; torso.castShadow=true; player.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.45,12,12), new THREE.MeshLambertMaterial({color:0xe6be8c}));
head.position.y=2.1; head.castShadow=true; player.add(head);
// SAĞ KOL + SİLAH + NAMLU (gun = grup; gun.visible ile gizlenir, mermi namludan çıkar)
const skinMat = new THREE.MeshLambertMaterial({color:0xe6be8c});
const gun = new THREE.Group();
const armMesh = new THREE.Mesh(boxGeo, skinMat);            // ileri uzanan kol
armMesh.scale.set(0.2,0.2,0.62); armMesh.position.set(0,0,0.3); armMesh.castShadow=true; gun.add(armMesh);
const gunMesh = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x1a1a1a})); // silah gövdesi
gunMesh.scale.set(0.16,0.2,0.7); gunMesh.position.set(0,-0.02,0.66); gunMesh.castShadow=true; gun.add(gunMesh);
const muzzle = new THREE.Object3D();                        // namlu ucu (mermi çıkış noktası)
muzzle.position.set(0,-0.02,1.04); gun.add(muzzle);
gun.position.set(-0.58,1.28,0.2);                           // SAĞ el konumu (gövdeden dışarı, görünür)
gun.visible=false; player.add(gun);                         // başta yumruk seçili
// yumruk kolu (vururken kısa süre görünür)
const punchArm = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0xe6be8c}));
punchArm.scale.set(0.32,0.32,0.8); punchArm.position.set(0.25,1.3,1.0); punchArm.visible=false;
punchArm.userData={t:0}; player.add(punchArm);
player.position.set(3,0,3);
scene.add(player);

// kamera açıları
let yaw = 0, pitch = -0.12;  // serbest bakış: 0=yatay, >0 yukarı, <0 aşağı (hafif aşağı başla)
const CAM_DIST = 11;

// ─────────────── ARAÇLAR ───────────────
const carDefs = [
  {name:'Sedan',     color:0xc83232, spd:34, type:'car'},
  {name:'Sports Car',color:0xf0c828, spd:46, type:'car'},
  {name:'Van',       color:0xb4b4be, spd:26, type:'car'},
  {name:'Taxi',      color:0xf0c828, spd:32, type:'car'},
  {name:'SUV',       color:0x3c5078, spd:30, type:'car'},
  {name:'Truck',     color:0x6a4f3a, spd:24, type:'truck'},   // kamyon
  {name:'Semi',      color:0x2e5a8a, spd:20, type:'semi'},    // tır
  {name:'Lamborghini',color:0xff7a00,spd:60, type:'sport', hp:90}, // spor araba
];
const cars = [];
function makeCar(x, z, def){
  const g = new THREE.Group();
  const t = def.type||'car';
  const mat = new THREE.MeshLambertMaterial({color:def.color});
  const cabMat = new THREE.MeshLambertMaterial({color:0x223044});
  let wheelXZ = [[-1.1,1.4],[1.1,1.4],[-1.1,-1.4],[1.1,-1.4]], wheelR=0.5;
  let driverOff = [0.35,0,0.3];
  if(t==='sport'){
    // alçak, geniş, sportif (Lamborghini hissi)
    const body=new THREE.Mesh(boxGeo,mat); body.scale.set(2.5,0.7,5); body.position.y=0.55; body.castShadow=true; g.add(body);
    const hood=new THREE.Mesh(boxGeo,mat); hood.scale.set(2.3,0.35,2); hood.position.set(0,0.85,1.6); g.add(hood);
    const cabin=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x0a0a12})); cabin.scale.set(2,0.55,1.8); cabin.position.set(0,1.1,-0.3); cabin.castShadow=true; g.add(cabin);
    const spoiler=new THREE.Mesh(boxGeo,mat); spoiler.scale.set(2.4,0.15,0.5); spoiler.position.set(0,1.0,-2.5); g.add(spoiler);
    wheelXZ=[[-1.25,1.7],[1.25,1.7],[-1.25,-1.7],[1.25,-1.7]]; wheelR=0.55; driverOff=[0.3,0,0];
  } else if(t==='truck'){
    // kamyon: kabin + yük kasası
    const cab=new THREE.Mesh(boxGeo,mat); cab.scale.set(2.6,2.2,2.6); cab.position.set(0,1.3,2.6); cab.castShadow=true; g.add(cab);
    const cargo=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x8a8a92})); cargo.scale.set(2.8,2.6,5.4); cargo.position.set(0,1.6,-1.6); cargo.castShadow=true; g.add(cargo);
    const win=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x0a0a12})); win.scale.set(2.4,0.9,0.2); win.position.set(0,1.9,3.9); g.add(win);
    wheelXZ=[[-1.3,2.6],[1.3,2.6],[-1.3,-1.6],[1.3,-1.6],[-1.3,-3.4],[1.3,-3.4]]; wheelR=0.7; driverOff=[0.45,0,2.6];
  } else if(t==='semi'){
    // tır: çekici + uzun römork
    const cab=new THREE.Mesh(boxGeo,mat); cab.scale.set(2.6,2.6,3); cab.position.set(0,1.5,4.2); cab.castShadow=true; g.add(cab);
    const win=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x0a0a12})); win.scale.set(2.4,1,0.2); win.position.set(0,2.1,5.7); g.add(win);
    const trailer=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xcdd2da})); trailer.scale.set(2.8,3,9); trailer.position.set(0,1.9,-2.2); trailer.castShadow=true; g.add(trailer);
    wheelXZ=[[-1.3,4.4],[1.3,4.4],[-1.3,-3],[1.3,-3],[-1.3,-5.5],[1.3,-5.5]]; wheelR=0.7; driverOff=[0.5,0,4.2];
  } else {
    // standart araba
    const body=new THREE.Mesh(boxGeo,mat); body.scale.set(2.2,1,4.6); body.position.y=0.7; body.castShadow=true; g.add(body);
    const cabin=new THREE.Mesh(boxGeo,cabMat); cabin.scale.set(1.9,0.8,2.2); cabin.position.set(0,1.4,-0.2); cabin.castShadow=true; g.add(cabin);
  }
  // ön aks (en büyük +wz) = direksiyon tekerleri; A/D ile döner
  let maxWz=-1e9; for(const [,wz] of wheelXZ) if(wz>maxWz) maxWz=wz;
  const steerWheels=[];
  for (const [wx,wz] of wheelXZ){
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR,wheelR,0.4,12), new THREE.MeshLambertMaterial({color:0x111111}));
    wheel.rotation.z = Math.PI/2;
    const isFront = wz > maxWz-0.6;     // ön aks tekerleri
    if(isFront){
      const pivot=new THREE.Group(); pivot.position.set(wx,wheelR-0.1,wz);  // direksiyon pivotu (Y ekseninde döner)
      wheel.position.set(0,0,0); pivot.add(wheel); g.add(pivot); steerWheels.push(pivot);
    } else {
      wheel.position.set(wx,wheelR-0.1,wz); g.add(wheel);
    }
  }
  // görünür sürücü (oyuncu binince gizlenir)
  const driver=new THREE.Group();
  const dHead=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,8), new THREE.MeshLambertMaterial({color:0xe6be8c}));
  dHead.position.y=1.55; driver.add(dHead);
  const dBody=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x3a4250}));
  dBody.scale.set(0.65,0.6,0.55); dBody.position.y=1.15; driver.add(dBody);
  driver.position.set(driverOff[0],driverOff[1],driverOff[2]); g.add(driver);
  g.position.set(x,0,z);
  g.userData = { name:def.name, maxSpd:def.spd, spd:0, occupied:false, isPolice:false, driver, hp:def.hp||120, dead:false, steerWheels, steer:0 };
  scene.add(g); cars.push(g); return g;
}
// ── TRAFİK AI (GTA tarzı: NPC araçlar yol ızgarasında gider, kavşakta döner) ──
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const LINES=(()=>{ const a=[]; for(let g=-HALF;g<=HALF;g+=BLOCK) a.push(g); return a; })();
function nearestLine(v){ let best=LINES[0]; for(const l of LINES) if(Math.abs(l-v)<Math.abs(best-v)) best=l; return best; }
/** Mevcut yönden gidilebilecek bir sonraki yönü seç (U dönüşü yok, düz gitmeye eğilimli, dünya içinde). */
function pickDir(c){
  const ud=c.userData; const opts=[];
  for(const d of DIRS){
    if(ud.dx===-d[0] && ud.dz===-d[1]) continue;                 // geri dönme yok
    const nx=c.position.x+d[0]*BLOCK, nz=c.position.z+d[1]*BLOCK;
    if(nx< -HALF+BLOCK || nx> HALF-BLOCK || nz< -HALF+BLOCK || nz> HALF-BLOCK) continue;
    opts.push(d);
    if(ud.dx===d[0] && ud.dz===d[1]){ opts.push(d,d); }          // düz gitmeye ağırlık
  }
  if(!opts.length) return [-ud.dx,-ud.dz];                       // çıkmaz → geri dön
  return opts[(Math.random()*opts.length)|0];
}
/** Aracı ızgaraya oturt ve trafik durumunu başlat (oyuncudan inince de çağrılır). */
function initTraffic(c){
  const ud=c.userData;
  c.position.x=Math.max(-HALF+BLOCK, Math.min(HALF-BLOCK, nearestLine(c.position.x)));
  c.position.z=Math.max(-HALF+BLOCK, Math.min(HALF-BLOCK, nearestLine(c.position.z)));
  c.position.y=0;
  ud.ai=true; ud.dx=0; ud.dz=0;
  const d=pickDir(c); ud.dx=d[0]; ud.dz=d[1];
  ud.target={x:c.position.x+ud.dx*BLOCK, z:c.position.z+ud.dz*BLOCK};
  ud.spd=ud.maxSpd*0.4;
  c.rotation.y=Math.atan2(ud.dx, ud.dz);
}
/** Tüm trafik araçlarını her kare ilerlet (oyuncunun bindiği ve polis araçları hariç). */
function updateTraffic(dt){
  for(const c of cars){
    const ud=c.userData;
    if(!ud.ai || ud.occupied) continue;                          // oyuncu kullanıyorsa AI durur
    // 1) ÖNÜMDE ENGEL var mı? (aynı şeritte öndeki araç / yaya) — çapraz trafik sayılmaz
    let obstacle=false;
    for(const o of cars){
      if(o===c) continue;
      const rx=o.position.x-c.position.x, rz=o.position.z-c.position.z;
      const fwd=rx*ud.dx+rz*ud.dz;                 // ileri yöndeki mesafe
      const lat=Math.abs(rx*(-ud.dz)+rz*ud.dx);    // şeritten yanal sapma
      if(fwd>0.5 && fwd<6 && lat<2.2){ obstacle=true; break; }
    }
    if(!obstacle && !S.inCar){                     // önümde yaya oyuncu varsa
      const rx=player.position.x-c.position.x, rz=player.position.z-c.position.z;
      const fwd=rx*ud.dx+rz*ud.dz, lat=Math.abs(rx*(-ud.dz)+rz*ud.dx);
      if(fwd>0.5 && fwd<5 && lat<2.2) obstacle=true;
    }
    // 2) KIRMIZI IŞIK (yalnızca ana ışıklı kavşaklarda)
    const xGreen = lightPhase===1;
    const axisGreen = (ud.dx!==0) ? xGreen : !xGreen;
    const tkey = ud.target.x+','+ud.target.z;
    const distNode = (ud.dx!==0) ? Math.abs(ud.target.x-c.position.x) : Math.abs(ud.target.z-c.position.z);
    const redStop = litNodes.has(tkey) && !axisGreen && distNode<7 && distNode>0.6;
    // SIKIŞMA KIRICI: sadece engel kilitlenmesini açar (kırmızı ışığı bozmaz)
    if(obstacle){ ud.stuck=(ud.stuck||0)+dt; if(ud.stuck>5) obstacle=false; } else ud.stuck=0;
    const stop = obstacle || redStop;
    const step=(stop?0:ud.maxSpd*0.4)*dt;
    c.position.x += ud.dx*step;
    c.position.z += ud.dz*step;
    c.rotation.y = Math.atan2(ud.dx, ud.dz);
    // kavşağa (hedef düğüme) ulaştı mı? → yeni yön seç
    const t=ud.target;
    const reached = (ud.dx>0 && c.position.x>=t.x) || (ud.dx<0 && c.position.x<=t.x) ||
                    (ud.dz>0 && c.position.z>=t.z) || (ud.dz<0 && c.position.z<=t.z) ||
                    (ud.dx===0 && ud.dz===0);
    if(reached){
      c.position.x=t.x; c.position.z=t.z;
      const nd=pickDir(c); ud.dx=nd[0]; ud.dz=nd[1];
      ud.target={x:c.position.x+nd[0]*BLOCK, z:c.position.z+nd[1]*BLOCK};
    }
  }
}
// trafik araçlarını ızgara üzerine yerleştir
for (let i=0;i<176;i++){
  const x = LINES[(Math.random()*LINES.length)|0];
  const z = LINES[(Math.random()*LINES.length)|0];
  const car = makeCar(x, z, carDefs[Math.floor(Math.random()*carDefs.length)]);
  initTraffic(car);
}

// ── TRAFİK IŞIKLARI ── (faz: 0=Z ekseni yeşil, 1=X ekseni yeşil)
let lightPhase=1, lightTimer=0;
const LIGHT_PERIOD=7;
const trafficLights=[];
const litNodes=new Set();                 // sadece bu kavşaklarda ışık/dur var
const MAJOR=(()=>{ const a=[]; for(let g=-HALF+BLOCK*2; g<=HALF-BLOCK*2; g+=BLOCK*2) a.push(g); return a; })(); // ana kavşaklar (dinamik)
for(const lx of MAJOR){
  for(const lz of MAJOR){
    litNodes.add(lx+','+lz);
    const post=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x1a1a1a}));
    post.scale.set(0.3,5,0.3); post.position.set(lx+4.5,2.5,lz+4.5); scene.add(post);
    const red=new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8), new THREE.MeshBasicMaterial({color:0x550000}));
    red.position.set(lx+4.5,5.1,lz+4.5); scene.add(red);
    const grn=new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8), new THREE.MeshBasicMaterial({color:0x004400}));
    grn.position.set(lx+4.5,4.3,lz+4.5); scene.add(grn);
    trafficLights.push({red,grn});
  }
}
/** Işık fazını ilerlet ve lambaları boya (gösterilen sinyal X ekseni içindir). */
function updateTrafficLights(dt){
  lightTimer+=dt;
  if(lightTimer>=LIGHT_PERIOD){ lightTimer=0; lightPhase^=1; }
  const xGreen = lightPhase===1;
  for(const tl of trafficLights){
    tl.grn.material.color.setHex(xGreen?0x33ff55:0x044d12);
    tl.red.material.color.setHex(xGreen?0x4d0606:0xff2222);
  }
}

// ─────────────── NPC ───────────────
const npcs = [];
function makeNPC(x,z,col,name,talk,isQuest){
  const g = new THREE.Group();
  const t = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:col}));
  t.scale.set(0.85,1.5,0.6); t.position.y=1; t.castShadow=true; g.add(t);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.4,10,10), new THREE.MeshLambertMaterial({color:0xe6be8c}));
  h.position.y=1.95; g.add(h);
  g.position.set(x,0,z);
  g.userData = { name, talk, isQuest, dir:new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize(), wt:1+Math.random()*2 };
  if (isQuest){
    const mk = new THREE.Mesh(new THREE.ConeGeometry(0.5,1,4), new THREE.MeshBasicMaterial({color:0xffd24a}));
    mk.position.y=3; mk.rotation.x=Math.PI; g.add(mk); g.userData.marker=mk;
    // uzaktan görünür sarı ışık sütunu
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,40,8), new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:0.22}));
    beam.position.y=20; g.add(beam); g.userData.beam=beam;
    t.scale.set(1,1.8,0.7);
  }
  scene.add(g); npcs.push(g); return g;
}
const civNames=['Jack','Mary','Mike','Sara','John','Emily','Brian','Dana'];
const civTalk=[['Hello!','Nice day, isn\'t it?'],['Be careful around here.','Cops are patrolling.'],['I\'m in a hurry, sorry.']];
for (let i=0;i<300;i++){
  const x=-HALF+12+Math.random()*(WORLD-24), z=-HALF+12+Math.random()*(WORLD-24);
  const col=(Math.random()*0x808080+0x707070)|0;
  makeNPC(x,z,col,civNames[i%civNames.length],civTalk[i%civTalk.length],false);
}
// görev verenler
const questDefs = [
  {name:'Marco',pos:[12,12],color:0xff8c00,talk:['Hey, I was waiting for you.','You need to learn the streets.','We start small — the rest will follow.']},
  {name:'Rosa',pos:[-42,26],color:0xff64b4,talk:['So Marco brought you in.','I\'ve got speed and class.','Show me what you can do behind the wheel.']},
  {name:'Viper',pos:[36,-46],color:0x9050c8,talk:['Now you\'re at the big boys\' table.','Things get bloody here.','I need to see your courage... and your loyalty.']},
  {name:'Don Karlo',pos:[-62,-62],color:0xb41e1e,talk:['So your reputation has reached me.','Everyone in this city wears a mask.','Be loyal to me; I\'ll give you an empire.']},
];
// verilen noktayı bina/engel içindeyse en yakın boş yola/kaldırıma taşı
function freeSpot(x,z){
  if(!blockedAt(x,z,2)) return [x,z];
  for(let r=3; r<=40; r+=2){
    for(let a=0; a<16; a++){
      const ang=a*Math.PI/8;
      const nx=x+Math.cos(ang)*r, nz=z+Math.sin(ang)*r;
      if(Math.abs(nx)<HALF-6 && Math.abs(nz)<HALF-6 && !blockedAt(nx,nz,2)) return [nx,nz];
    }
  }
  return [x,z];
}
const questNpc = {};
for (const q of questDefs){
  const [fx,fz]=freeSpot(q.pos[0],q.pos[1]);
  q.pos=[fx,fz]; // çözülen boş konumu sakla (görev hedefleri bunu kullanır)
  questNpc[q.name]=makeNPC(fx,fz,q.color,q.name,q.talk,true);
}

// ─────────────── POLİS ───────────────
const police = [];      // polis ARABALARI
const footCops = [];     // arabadan inen yaya polisler
const CAR_STANDOFF = 17; // polis arabası bu mesafede durur (yapışmaz)
const FOOT_STANDOFF = 9; // yaya polis bu mesafede durup ateş eder
function makePolice(x,z){
  const g = makeCar(x,z,{name:'Police',color:0x1e2878,spd:20}); // daha YAVAŞ
  g.userData.isPolice = true; g.userData.hp = 80; g.userData.deployed = false;
  g.userData.routeBias = police.length % 2;   // 2 gruba böl → 2 farklı yoldan gelirler
  const light = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({color:0xff2222}));
  light.scale.set(1.6,0.4,0.5); light.position.set(0,2,0); g.add(light);
  g.userData.light = light;
  cars.splice(cars.indexOf(g),1); // polis ayrı listede (binilemez)
  police.push(g); return g;
}
function makeFootCop(x,z){
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x20307a}));
  body.scale.set(0.85,1.5,0.6); body.position.y=1; body.castShadow=true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4,10,10), new THREE.MeshLambertMaterial({color:0xe6be8c}));
  head.position.y=1.95; g.add(head);
  const cap = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x101840}));
  cap.scale.set(0.5,0.2,0.5); cap.position.y=2.25; g.add(cap);
  g.position.set(x,0,z);
  g.userData = { hp:40, shootCd:1+Math.random()*1.5 };
  scene.add(g); footCops.push(g); return g;
}

// ─────────────── PICKUP ───────────────
const pickups = [];
const pickColors = {money:0xffd24a, health:0x40d060, ammo:0xff9020, star:0x9050ff};
function makePickup(x,z,type){
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
    new THREE.MeshLambertMaterial({color:pickColors[type], emissive:pickColors[type], emissiveIntensity:0.3}));
  m.position.set(x,1.2,z); m.userData={type}; scene.add(m); pickups.push(m); return m;
}
for (let i=0;i<75;i++){
  const x=-HALF+12+Math.random()*(WORLD-24), z=-HALF+12+Math.random()*(WORLD-24);
  const types=['money','money','health','ammo','star'];
  makePickup(x,z,types[Math.floor(Math.random()*types.length)]);
}

// mermiler
const bullets = [];

// ═══════════════ RAKİP HEDEFLER (görev: çeteden N kişiyi yok et) ═══════════════
const rivals=[];
function makeRival(x,z){
  const g=new THREE.Group();
  const t=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x111118})); t.scale.set(0.9,1.7,0.6); t.position.y=1; t.castShadow=true; g.add(t); // siyah kıyafet
  const h=new THREE.Mesh(new THREE.SphereGeometry(0.4,10,10),new THREE.MeshLambertMaterial({color:0xd8b088})); h.position.y=2; g.add(h);
  const gunm=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x222222})); gunm.scale.set(0.18,0.18,0.85); gunm.position.set(0.45,1.3,0.45); g.add(gunm); // silah
  const mk=new THREE.Mesh(new THREE.ConeGeometry(0.5,1,4),new THREE.MeshBasicMaterial({color:0xff3030})); mk.position.y=3; mk.rotation.x=Math.PI; g.add(mk); // kırmızı işaret
  g.position.set(x,0,z);
  g.userData={ dir:new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize(), wt:1+Math.random()*2, marker:mk, hp:60, shootCd:1+Math.random()*1.5 };
  scene.add(g); rivals.push(g); return g;
}
function spawnRivals(n,cx,cz){ clearRivals(); for(let i=0;i<n;i++) makeRival(cx+(Math.random()-.5)*16, cz+(Math.random()-.5)*16); }
function clearRivals(){ for(const r of rivals) scene.remove(r); rivals.length=0; }
function rivalKilled(){
  S.score+=80; gainXp(10); playSnd('death');
  if(S.active){ const st=curStage();
    if(st && st.type==='huntTargets'){ S.prog++; flash('Target down ('+S.prog+'/'+st.count+')',1.3);
      if(S.prog>=st.count || rivals.length===0) advanceStage(); }
    else if(st && st.type==='ambush'){ S.prog++; flash('Attacker down ('+S.prog+'/'+st.count+')',1.3);
      if(S.prog>=st.count) leaderFlee(); } }
}
// ═══════════════ RAKİP LİDER (m09: limanda pusu + kovalama) ═══════════════
const AMBUSH=[HARBOR[0], HARBOR[1]-30];   // limandaki pusu noktası (rıhtım üstü)
let leaderFig=null, leaderCar=null, leaderBeam=null, leaderFleeing=false;
// takım elbiseli lider (rival olarak; pusu boyunca vurulamaz, sonra arabayla kaçar)
function makeLeader(x,z){
  const g=new THREE.Group();
  const t=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x1a2438})); t.scale.set(0.95,1.8,0.62); t.position.y=1.05; t.castShadow=true; g.add(t); // takım elbise
  const tie=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x8b1a1a})); tie.scale.set(0.16,0.7,0.05); tie.position.set(0,1.25,0.32); g.add(tie);
  const h=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,10),new THREE.MeshLambertMaterial({color:0xd8b088})); h.position.y=2.1; g.add(h);
  const mk=new THREE.Mesh(new THREE.ConeGeometry(0.6,1.3,4),new THREE.MeshBasicMaterial({color:0xffaa00})); mk.position.y=3.2; mk.rotation.x=Math.PI; g.add(mk);
  g.position.set(x,0,z);
  g.userData={ dir:new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize(), wt:1+Math.random()*2, marker:mk, hp:9999, shootCd:2, isLeader:true };
  scene.add(g); rivals.push(g); return g;
}
// pusu: 6 vurulabilir saldırgan + 1 takım elbiseli lider
function spawnAmbush(){
  clearLeader();
  spawnRivals(6, AMBUSH[0], AMBUSH[1]);
  leaderFig=makeLeader(AMBUSH[0]+4, AMBUSH[1]-4);
  leaderFleeing=false;
}
// lider arabasıyla kaçar; haritada kırmızı yanıp sönen işaret
function leaderFlee(){
  if(leaderFleeing) return; leaderFleeing=true;
  const px=leaderFig?leaderFig.position.x:AMBUSH[0], pz=leaderFig?leaderFig.position.z:AMBUSH[1];
  // lideri rivals'tan çıkar (artık araba olacak)
  if(leaderFig){ const li=rivals.indexOf(leaderFig); if(li>=0) rivals.splice(li,1); scene.remove(leaderFig); leaderFig=null; }
  leaderCar=makeCar(px, pz, {name:'Boss Car', spd:30, color:0x101014});
  leaderCar.userData.isLeaderCar=true; leaderCar.userData.hp=160;
  initTraffic(leaderCar); leaderCar.userData.maxSpd=30; leaderCar.userData.spd=18;
  // kırmızı ışık sütunu (uzaktan görünür)
  leaderBeam=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,50,10), new THREE.MeshBasicMaterial({color:0xff2020, transparent:true, opacity:0.3}));
  scene.add(leaderBeam);
  sendStoryMsg('Viper','The boss is escaping! Catch his car and blow it up — follow the red marker.');
  advanceStage(); // → kovalama aşaması
}
function clearLeader(){
  if(leaderFig){ scene.remove(leaderFig); const li=rivals.indexOf(leaderFig); if(li>=0) rivals.splice(li,1); leaderFig=null; }
  if(leaderCar){ scene.remove(leaderCar); const ci=cars.indexOf(leaderCar); if(ci>=0) cars.splice(ci,1); leaderCar=null; }
  if(leaderBeam){ scene.remove(leaderBeam); leaderBeam=null; }
  leaderFleeing=false;
}
// lider aracı patladı → havaya uçuş sinematiği + görev biter
function leaderCarDestroyed(){
  const wx=leaderCar?leaderCar.position.x:0, wz=leaderCar?leaderCar.position.z:0;
  if(leaderBeam){ scene.remove(leaderBeam); leaderBeam=null; }
  leaderCar=null;
  triggerLeaderEnd(wx,wz);
}

// görev aşaması başlayınca gereken kurulum (hedef düşmanları çağır)
function onStageStart(){ const st=curStage();
  if(st && st.type==='huntTargets' && st.target) spawnRivals(st.count, st.target[0], st.target[1]);
  if(st && st.type==='ambush'){ playMovie(AMBUSH_SHOTS, ()=>{ spawnAmbush(); }); }
}

// ═══════════════ NİŞAN ALMA MODÜLÜ (raycast) ═══════════════
// Ekran merkezinden (crosshair) dünyaya ışın gönderir, hedef noktasını
// ve crosshair'ın bir düşmanın üstünde olup olmadığını hesaplar.
// SOLID: tek sorumluluk = nişan hedefini çözmek. Diğer sistemler bunu okur.
const Aiming = {
  ray: new THREE.Raycaster(),
  center: new THREE.Vector2(0, 0),          // NDC (0,0) = ekran tam merkezi
  ground: new THREE.Plane(new THREE.Vector3(0,1,0), 0),
  aimPoint: new THREE.Vector3(),            // mermilerin gideceği dünya noktası
  onEnemy: false,                           // crosshair düşman üstünde mi?
  _groups: [],                              // her kare yeniden kullanılan liste (tahsis yok = optimize)
  /** Her kare çağrılır: hedef noktasını ve düşman temasını günceller. */
  update(){
    this.ray.setFromCamera(this.center, camera);
    // 1) vurulabilir düşmanları topla (sivil + yaya polis + polis arabası)
    const g = this._groups; g.length = 0;
    for (let i=0;i<npcs.length;i++) if(!npcs[i].userData.isQuest) g.push(npcs[i]);
    for (let i=0;i<footCops.length;i++) g.push(footCops[i]);
    for (let i=0;i<police.length;i++) g.push(police[i]);
    // 2) sadece bu kısa liste ile kesişim (binalar hariç → ucuz raycast)
    const hits = this.ray.intersectObjects(g, true);
    if (hits.length){
      this.onEnemy = true;
      this.aimPoint.copy(hits[0].point);
      return;
    }
    this.onEnemy = false;
    // 3) düşman yoksa zemin düzlemiyle kesiş (crosshair yere bakıyorsa)
    if (this.ray.ray.intersectPlane(this.ground, this.aimPoint)) return;
    // 4) zemin de yoksa ışın boyunca uzak bir nokta
    this.aimPoint.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction, 300);
  }
};

// ─────────────── MAĞAZA (gerçek bir binanın zemin katı) ───────────────
// Mağaza ayrılmış bir blokta yüksek bir binanın altındadır; tezgâh/satıcı yola bakar.
(function buildShop(){
  const bx=SHOP_BLOCK[0], bz=SHOP_BLOCK[1];   // blok merkezi (yüksek bina burada)
  const frontZ=bz-9;                          // binanın yola bakan ön yüzü (≈ SHOP[1]+? )
  // YÜKSEK BİNA (mağazanın üstünde — gerçek şehir binası)
  const bld=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x6b6258}));
  bld.scale.set(18,44,16); bld.position.set(bx,22,bz); bld.castShadow=true; bld.receiveShadow=true; scene.add(bld);
  colliders.push({x:bx, z:bz, hw:9.1, hd:8.1});
  // pencere şeritleri (kat hissi)
  for(let fy=8; fy<42; fy+=6){ const win=new THREE.Mesh(boxGeo,winMat); win.scale.set(14,3,0.2); win.position.set(bx,fy,frontZ-0.1); scene.add(win); }
  // ZEMİN KAT: kantin tezgâhı (binanın önünde, yola bakar)
  const counter=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x3a2a18})); counter.scale.set(10,1.6,1.4); counter.position.set(bx,0.8,frontZ-2.4); counter.castShadow=true; scene.add(counter);
  // çizgili tente (kırmızı)
  const awn=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xc0392b})); awn.scale.set(12,0.5,3.6); awn.position.set(bx,4.4,frontZ-1.6); awn.rotation.x=-0.18; scene.add(awn);
  for(const ax of [bx-5.6, bx+5.6]){ const pole=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x777})); pole.scale.set(0.25,4.4,0.25); pole.position.set(ax,2.2,frontZ-0.3); scene.add(pole); }
  // "SHOP" tabelası (tentenin üstünde)
  const sign=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0x30e070})); sign.scale.set(9,1.8,0.4); sign.position.set(bx,6.2,frontZ-0.2); scene.add(sign);
  // satıcı figürü (tezgâhın arkasında, binaya yaslı)
  const v=new THREE.Group();
  const vb=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x2e8b57})); vb.scale.set(0.85,1.4,0.55); vb.position.y=1.0; v.add(vb);
  const vh=new THREE.Mesh(new THREE.SphereGeometry(0.4,10,10),new THREE.MeshLambertMaterial({color:0xe6be8c})); vh.position.y=1.9; v.add(vh);
  const vcap=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xffffff})); vcap.scale.set(0.5,0.18,0.5); vcap.position.y=2.2; v.add(vcap);
  v.position.set(bx,0,frontZ-1.0); scene.add(v);   // tezgâhın gerisinde (binaya yaslı, oyuncuya bakar)
})();
// yön bulucu (yeşil ışık sütunu) — etkileşim noktasında
const shopBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,30,8), new THREE.MeshBasicMaterial({color:0x40ff80, transparent:true, opacity:0.25}));
shopBeam.position.set(SHOP[0],15,SHOP[1]); scene.add(shopBeam);

// ═══════════════ LİMAN (HARBOR) — şehrin +Z kenarına çıkan iskele ═══════════════
(function buildHarbor(){
  const x=HARBOR[0], z=HARBOR[1];
  const zStart=HALF-12, zEnd=HARBOR_Z_MAX, zMid=(zStart+zEnd)/2, zLen=zEnd-zStart;
  // RIHTIM DECK — üst yüzeyi tam zemin (y=0) hizasında, deniz seviyesinin hemen üstünde
  const deck=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x6a6a72}));
  deck.scale.set(HARBOR_HALF_W*2, 0.5, zLen); deck.position.set(x, -0.25, zMid); deck.receiveShadow=true; scene.add(deck);
  const deckTop=0.0;  // konteynerler/objeler bu zemine oturur
  // bağlantı yolu (kenardan iskeleye)
  const road=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:0x2e2e34})); road.scale.set(ROADW, 0.06, zLen); road.position.set(x,0.04,zMid); scene.add(road);
  // renkli konteynerler — HEPSİ rıhtım zeminine (deckTop) düz oturur (havada durmaz)
  const ccols=[0xc0392b,0x2980b9,0x27ae60,0xe67e22,0x8e44ad,0x16a085];
  const ch=3;
  for(let i=0;i<12;i++){
    const c=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:ccols[i%ccols.length]}));
    c.scale.set(6.5,ch,2.8); const side=i<6?-1:1; const row=i%6;
    c.position.set(x+side*33, deckTop + ch/2, zStart+14+row*8);   // taban tam deckTop'ta
    c.castShadow=true; c.receiveShadow=true; scene.add(c); }
  // birkaç tanesini düzgün üst üste istifle (alttakinin TAM üstüne — yine havada değil)
  for(let i=0;i<3;i++){
    const c=new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({color:ccols[(i+2)%ccols.length]}));
    c.scale.set(6.5,ch,2.8); const side=i<2?-1:1;
    c.position.set(x+side*33, deckTop + ch + ch/2, zStart+14+i*8);  // 2. kat: alttaki konteynerin üstü
    c.castShadow=true; scene.add(c); }
  // liman vinçleri (zemine oturur)
  for(const cx of [x-30, x+30]){
    const post=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xd0a030})); post.scale.set(1.6,22,1.6); post.position.set(cx,deckTop+11,z); post.castShadow=true; scene.add(post);
    const arm =new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xd0a030})); arm.scale.set(1.2,1.2,26); arm.position.set(cx,deckTop+21,z-12); scene.add(arm); }
  // demirli yük gemisi — ANA LİMANIN yanında, rıhtıma bitişik (suda)
  const ship=new THREE.Group();
  const hull=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x7f8c8d})); hull.scale.set(11,3.4,38); hull.position.y=1; hull.castShadow=true; ship.add(hull);
  const sdeck=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xbdc3c7})); sdeck.scale.set(9,1,34); sdeck.position.y=2.8; ship.add(sdeck);
  const tower=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xecf0f1})); tower.scale.set(7,6,7); tower.position.set(0,5.5,-12); ship.add(tower);
  for(let i=0;i<5;i++){ const cc=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:ccols[i]})); cc.scale.set(7,3,5); cc.position.set(0,4.5,2+i*5); ship.add(cc); }
  ship.position.set(x+HARBOR_HALF_W+9, 0.2, zMid); scene.add(ship);   // rıhtımın hemen yanında
  // LİMAN tabelası
  const sign=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0x40c8ff})); sign.scale.set(16,3,0.6); sign.position.set(x,deckTop+6, zStart+2); scene.add(sign);
})();

// HİKÂYE: LİMAN DEPOSU — beyaz işaret limanda (gizem görevinde açılır)
const WH=[HARBOR[0], HARBOR[1]];
const warehouseMarker = new THREE.Mesh(new THREE.CylinderGeometry(4,4,0.3,20), new THREE.MeshLambertMaterial({color:0xffffff, emissive:0x555555}));
warehouseMarker.position.set(WH[0],0.16,WH[1]); warehouseMarker.visible=false; scene.add(warehouseMarker);
const warehouseBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,44,8), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.3}));
warehouseBeam.position.set(WH[0],22,WH[1]); warehouseBeam.visible=false; scene.add(warehouseBeam);

// GÖREV HEDEF İŞARETİ (aktif aşamanın hedefini gösterir)
const missionMarker = new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,0.3,18), new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:0.45}));
missionMarker.visible=false; scene.add(missionMarker);
const missionBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,36,8), new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:0.18}));
missionBeam.visible=false; scene.add(missionBeam);

// ═══════════════ BÖLGE FETİHLERİ (TERRİTORY) ═══════════════
// Harita büyük dörtgen bölgelere ayrılır. Her bölgenin sahibi (nötr/rakip/sen),
// üyeleri ve geliri vardır. Bölge merkezindeki karargah pad'inden ele geçirilir.
const DISTRICT_NAMES=['Harbor','Old Town','Industrial','Hill District','Downtown','Shady Streets',
  'Marketplace','Coast','Highside','Railyard','The Pit','New City','Marshland','Lighthouse','Ramparts','Valley'];
const districts=[];
const ownerColor={ neutral:0x888888, rival:0xc83232, mine:0x2ecc71 };
(function buildDistricts(){
  const N=4, span=WORLD/N;                       // 4x4 = 16 bölge
  let idx=0;
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){
    const cx=-HALF+span/2+i*span, cz=-HALF+span/2+j*span;
    // merkezi en yakın yol kavşağına hizala
    const hx=Math.round(cx/BLOCK)*BLOCK, hz=Math.round(cz/BLOCK)*BLOCK;
    const owner = (idx===5)?'mine':(Math.random()<0.5?'rival':'neutral'); // başlangıçta 1 bölge senin
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,0.4,20),
      new THREE.MeshLambertMaterial({color:ownerColor[owner], emissive:0x111111}));
    pad.position.set(hx,0.2,hz); scene.add(pad);
    const flag=new THREE.Mesh(new THREE.ConeGeometry(1.4,3,4), new THREE.MeshBasicMaterial({color:ownerColor[owner]}));
    flag.position.set(hx,3.5,hz); scene.add(flag);
    districts.push({name:DISTRICT_NAMES[idx]||('District '+(idx+1)), x:hx, z:hz, span,
      owner, members:owner==='mine'?2:0, pad, flag});
    idx++;
  }
})();
function districtAt(x,z){
  for(const d of districts){ if(Math.abs(x-d.x)<d.span/2 && Math.abs(z-d.z)<d.span/2) return d; }
  return null;
}
function districtNearHQ(){
  for(const d of districts){ if(dist2(player.position.x,player.position.z,d.x,d.z)<6) return d; }
  return null;
}
function refreshDistrictVisual(d){
  d.pad.material.color.setHex(ownerColor[d.owner]);
  d.flag.material.color.setHex(ownerColor[d.owner]);
}
function captureCost(d){ return d.owner==='rival'?800:300; }
function captureDistrict(d){
  const cost=captureCost(d);
  if(S.money<cost){ flash('Need $'+cost+' to capture'); playSnd('error'); return; }
  S.money-=cost; d.owner='mine'; d.members=Math.max(1,d.members); refreshDistrictVisual(d);
  addNews(`${d.name} district captured! Protection money now flows in.`);
  flash('🏴 '+d.name+' is yours! Assign members from the phone.',3);
  playSnd('capture');
  addTrust('viper',6); addTrust('karlo',4); S.gangSus=Math.max(0,S.gangSus-5);
  saveGame();
}

// ═══════════════ GÜVEN / ŞÜPHE / HABER ═══════════════
function addTrust(who,amount){
  if(S.trust[who]==null) return;
  S.trust[who]=Math.max(0,Math.min(100,S.trust[who]+amount));
}
function addPoliceSus(n){ S.policeSus=Math.max(0,Math.min(100,S.policeSus+n)); }
function addGangSus(n){ S.gangSus=Math.max(0,Math.min(100,S.gangSus+n)); }
function addNews(text){
  S.news.unshift({day:S.day, text});
  if(S.news.length>30) S.news.pop();
  flash('📰 '+text,3);
}
// dünya saati: gün, gelir, şüphe soğuması
function updateWorld(dt){
  const CYCLE=1680;
  const dnow=Math.floor(S.clock/CYCLE)+1;
  if(dnow!==S.day){ S.day=dnow; onNewDay(); }
  S.incomeT+=dt;
  if(S.incomeT>=60){ S.incomeT=0; collectProtection(); }
  S.policeSus=Math.max(0,S.policeSus-dt*0.4);   // zamanla soğur
  S.gangSus=Math.max(0,S.gangSus-dt*0.2);
}
function collectProtection(){
  let total=0; for(const d of districts) if(d.owner==='mine') total+=d.members*40;
  if(total>0){ S.money+=total; flash('💰 Protection money: +$'+total,2.5); playSnd('cash'); }
}
function onNewDay(){
  if(S.news.length) flash('📅 Day '+S.day+' — Headline: '+S.news[0].text,3.5);
  else flash('📅 Day '+S.day+' begins',2.5);
}
function myDistrictCount(){ return districts.filter(d=>d.owner==='mine').length; }

// ─────────────── GÖREVLER ───────────────
const MISSIONS = {
  // ── BÖLÜM 1 · MARCO (sokaklara alışma) ──
  m01:{title:'Package Delivery',giver:'Marco',prereq:[],reward:300,xp:100,chapter:1,
    stages:[{type:'deliver',desc:'Find a vehicle and take the package to the drop point',target:[120,120]},
            {type:'reach',desc:"Return to Marco",target:[12,12]}]},
  m02:{title:'Kill 3 People',giver:'Marco',prereq:['m11'],reward:400,xp:120,chapter:1,
    stages:[{type:'kill',desc:'Kill 3 people',count:3},
            {type:'reach',desc:"Return to Marco",target:[12,12]}]},
  m03:{title:'Street Brawl',giver:'Marco',prereq:['m12'],reward:550,xp:160,chapter:1,
    stages:[{type:'huntTargets',desc:'Take out 5 gang members (red markers)',count:5,target:[150,150]}]},
  // ── CHAPTER 2 · ROSA (rising star) ──
  m04:{title:'Speed Test',giver:'Rosa',prereq:['m03'],reward:500,xp:150,chapter:2,
    stages:[{type:'drive',desc:'Drive a vehicle (8 seconds)',count:8}]},
  m05:{title:'Contraband Run',giver:'Rosa',prereq:['m13'],reward:700,xp:180,chapter:2,
    stages:[{type:'deliver',desc:'Take the contraband to the harbor (dock)',target:[0,296]},
            {type:'reach',desc:"Return to Rosa",target:[-42,26]}]},
  m06:{title:'VIP Escape',giver:'Rosa',prereq:['m15'],reward:900,xp:220,chapter:2,
    stages:[{type:'wanted',desc:'Draw attention — open fire, become wanted'},
            {type:'escape',desc:'Escape the police (clear your stars)'}]},
  // ── CHAPTER 3 · VIPER (descent into darkness) ──
  m07:{title:'Arms Smuggling',giver:'Viper',prereq:['m06'],reward:1000,xp:250,chapter:3,
    stages:[{type:'collect',desc:'Collect 4 weapon crates',count:4}]},
  m08:{title:'Shipment — Decision',giver:'Viper',prereq:['m14'],reward:1200,xp:300,chapter:3,
    stages:[{type:'choice',desc:'Go to the harbor (warehouse) to make the call',target:[0,296]}]},
  m09:{title:'Rival Boss',giver:'Viper',prereq:['m16'],reward:1600,xp:380,chapter:3,
    stages:[{type:'ambush',desc:'Go to the harbor — kill 6 attackers',count:6,target:[AMBUSH[0],AMBUSH[1]]},
            {type:'chase',desc:'Catch and blow up the fleeing boss\'s car (red marker)'}]},
  // ── FINALE · DON KARLO ──
  m10:{title:'The Big Score',giver:'Don Karlo',prereq:['m09'],reward:3000,xp:600,chapter:4,
    stages:[{type:'collect',desc:'Collect 5 treasures',count:5},
            {type:'reach',desc:"Return to Don Karlo",target:[-62,-62]}]},

  // ── EK GÖREVLER (hikâye zincirine örülü) ──
  // Marco (Bölüm 1)
  m11:{title:'Debt Collection',giver:'Marco',prereq:['m01'],reward:350,xp:110,chapter:1,
    stages:[{type:'huntTargets',desc:'Eliminate 3 marked debtors (red markers)',count:3,target:[150,-150]},
            {type:'reach',desc:"Return to Marco",target:[12,12]}]},
  m12:{title:'Getaway Driver',giver:'Marco',prereq:['m02'],reward:420,xp:130,chapter:1,
    stages:[{type:'deliver',desc:'Steal a car and reach the drop point',target:[-120,120]},
            {type:'reach',desc:"Return to Marco",target:[12,12]}]},
  // Rosa (Bölüm 2)
  m13:{title:'Lose the Tail',giver:'Rosa',prereq:['m04'],reward:600,xp:170,chapter:2,
    stages:[{type:'wanted',desc:'Draw heat — open fire and get wanted'},
            {type:'escape',desc:'Shake the police (clear your stars)'}]},
  m15:{title:'Midnight Run',giver:'Rosa',prereq:['m05'],reward:680,xp:190,chapter:2,
    stages:[{type:'deliver',desc:'Drive the goods to the east drop',target:[150,-90]},
            {type:'reach',desc:"Return to Rosa",target:[-42,26]}]},
  // Viper (Bölüm 3)
  m14:{title:'Turf War',giver:'Viper',prereq:['m07'],reward:1150,xp:270,chapter:3,
    stages:[{type:'huntTargets',desc:'Wipe out 6 rival gang members (red markers)',count:6,target:[-150,-150]}]},
  m16:{title:'Hit Squad',giver:'Viper',prereq:['m08'],reward:1350,xp:320,chapter:3,
    stages:[{type:'huntTargets',desc:'Take out 4 marked enforcers (red markers)',count:4,target:[150,150]},
            {type:'reach',desc:"Return to Viper",target:[36,-46]}]},
};

// pin "Return to X" stage targets to the quest giver's real (free) position
for(const id in MISSIONS){
  const m=MISSIONS[id];
  for(const st of m.stages){
    if(st.type==='reach' && /Return to/.test(st.desc||'')){
      const g=questNpc[m.giver];
      if(g) st.target=[Math.round(g.position.x), Math.round(g.position.z)];
    }
  }
}

function curStage(){ const m=MISSIONS[S.active]; return m? m.stages[S.stageIdx]:null; }
function advanceStage(){
  const m=MISSIONS[S.active]; S.stageIdx++; S.prog=0;
  if (S.stageIdx>=m.stages.length){
    S.missionsDone.push(S.active); S.money+=m.reward; S.score+=m.xp; gainXp(m.xp);
    const tk={'Marco':'marco','Rosa':'rosa','Viper':'viper','Don Karlo':'karlo'}[m.giver];
    if(tk) addTrust(tk,15);
    addNews(`A job was completed for ${m.giver}: ${m.title}.`);
    flash(`✓ MISSION COMPLETE: ${m.title}  +$${m.reward}`,3.5); playSnd('mission_done');
    const doneMid=S.active;
    S.active=null; S.stageIdx=0; clearRivals(); clearLeader(); refreshQuestMarkers(); saveGame();
    onMissionDone(doneMid);   // hikâyeyi ilerlet
  } else { setObjective(m.title+': '+m.stages[S.stageIdx].desc); flash('▶ '+m.stages[S.stageIdx].desc,3); onStageStart(); }
}
function collectEvent(type){
  if(!S.active) return; const st=curStage();
  if(st && st.type==='collect' && (type==='money'||type==='star')){
    S.prog++; if(S.prog>=st.count) advanceStage();
  }
}
// öldürme görev aşamasını ilerletir (sivil/düşman fark etmez)
function missionKill(){
  if(!S.active) return; const st=curStage();
  if(st && st.type==='kill'){ S.prog++; if(S.prog>=st.count) advanceStage(); }
}
// bu kişinin verebileceği uygun (tamamlanmamış, ön koşulu sağlanan) görev var mı?
function hasAvailableMission(name){
  for(const k in MISSIONS){ const m=MISSIONS[k];
    if(m.giver===name && !S.missionsDone.includes(k) && m.prereq.every(p=>S.missionsDone.includes(p))) return true; }
  return false;
}
// görev veren NPC işaretlerini (sarı koni) uygunluğa göre aç/kapat
function refreshQuestMarkers(){
  for(const q of questDefs){ const e=questNpc[q.name]; if(!e) continue;
    const show=hasAvailableMission(q.name);
    if(e.userData.marker) e.userData.marker.visible=show;
    if(e.userData.beam) e.userData.beam.visible=show;   // ışık sütunu da
  }
}

// ─────────────── ARAYÜZ ───────────────
const UI = {
  hpfill:document.getElementById('hpfill'), hptext:document.getElementById('hptext'),
  money:document.getElementById('money'), score:document.getElementById('score'),
  weapon:document.getElementById('weapon'), wanted:document.getElementById('wanted'),
  mission:document.getElementById('mission'), prompt:document.getElementById('prompt'),
  msg:document.getElementById('msg'), speedo:document.getElementById('speedo'),
  stamfill:document.getElementById('stamfill'), level:document.getElementById('level'),
};
let msgTimer=0;
function flash(t,d=2.5){ UI.msg.textContent=t; msgTimer=d; }

// dialog
const dlg = { active:false, lines:[], idx:0, cb:null };
function showDialog(name,lines,cb){
  dlg.active=true; dlg.lines=lines; dlg.idx=0; dlg.cb=cb;
  document.getElementById('dialog').style.display='block';
  document.getElementById('dlgName').textContent=name;
  document.getElementById('dlgText').textContent=lines[0];
}
function advanceDialog(){
  dlg.idx++;
  if(dlg.idx>=dlg.lines.length){ dlg.active=false; document.getElementById('dialog').style.display='none'; if(dlg.cb)dlg.cb(); }
  else document.getElementById('dlgText').textContent=dlg.lines[dlg.idx];
}

// shop
const SHOP_ITEMS=[
  {name:'Full Heal',price:250,act:'heal',desc:'HP fully restored'},
  {name:'Full Ammo Refill',price:300,act:'ammo',desc:'+60 ammo to every weapon'},
  {name:'Shotgun Ammo +25',price:220,act:'shotgunammo',desc:'Shotgun ammo'},
  {name:'AK-47 Ammo +90',price:300,act:'rifleammo',desc:'Rifle ammo'},
  {name:'AWP Ammo +15',price:600,act:'awpammo',desc:'Sniper ammo'},
  {name:'Grenade +5',price:450,act:'grenade',desc:'Explosive stock'},
  {name:'Armor (+25 max HP)',price:500,act:'armor',desc:'Max HP up + refill'},
  {name:'Stamina (+20)',price:400,act:'stamina',desc:'Max stamina up'},
  {name:'Super Armor (full + max)',price:1500,act:'superarmor',desc:'HP/stamina max +50'},
];
const shop={active:false,cursor:0};
let shopGreeted=false;
function openShopPanel(){ shop.active=true; shop.cursor=0; document.getElementById('shop').style.display='block'; renderShop(); beep(620,0.06); }
function openShop(){
  if(!shopGreeted){ shopGreeted=true;
    showDialog('Sam (Vendor)', ['Welcome to my canteen, friend.', 'Hot meals, cold ammo — what\'ll it be?'], openShopPanel);
  } else openShopPanel();
}
function closeShop(){ shop.active=false; document.getElementById('shop').style.display='none'; }
function renderShop(){
  document.getElementById('shopMoney').textContent=`Money: $${S.money}`;
  document.getElementById('shopList').innerHTML = SHOP_ITEMS.map((it,i)=>
    `<div class="shopItem ${i===shop.cursor?'sel':''}" data-i="${i}"><div>${it.name}<small>${it.desc}</small></div><div class="pr">$${it.price}</div></div>`
  ).join('');
  const sel=document.querySelector('.shopItem.sel'); if(sel) sel.scrollIntoView({block:'nearest'});
}
function buyShop(){
  const it=SHOP_ITEMS[shop.cursor];
  if(S.money<it.price){ flash('Not enough money!'); beep(150,0.12,'square',0.07); return; }
  S.money-=it.price;
  if(it.act==='heal')S.hp=S.maxHp;
  else if(it.act==='ammo'){ for(const k of WHEEL) if(k!=='pistol'&&k!=='fists') S.ammo[k]+=60; }
  else if(it.act==='shotgunammo')S.ammo.shotgun+=25;
  else if(it.act==='rifleammo')S.ammo.rifle+=90;
  else if(it.act==='awpammo')S.ammo.awp+=15;
  else if(it.act==='grenade')S.ammo.grenade+=5;
  else if(it.act==='armor'){S.maxHp+=25;S.hp=S.maxHp;}
  else if(it.act==='stamina'){S.maxStamina+=20;S.stamina=S.maxStamina;}
  else if(it.act==='superarmor'){S.maxHp+=50;S.maxStamina+=50;S.hp=S.maxHp;S.stamina=S.maxStamina;}
  // satın alma onay sesi (iki ton)
  beep(660,0.08,'sine',0.07); setTimeout(()=>beep(990,0.12,'sine',0.07),70);
  flash(`✓ ${it.name} purchased!`); renderShop();
}
// scroll ile gez + sol tık ile al
document.getElementById('shopList').addEventListener('click', e=>{
  const el=e.target.closest('.shopItem'); if(el){ shop.cursor=+el.dataset.i; renderShop(); buyShop(); }
});
document.getElementById('shop').addEventListener('wheel', e=>{
  if(!shop.active) return; e.preventDefault();
  shop.cursor=(shop.cursor + (e.deltaY>0?1:-1) + SHOP_ITEMS.length)%SHOP_ITEMS.length; renderShop();
}, {passive:false});

// ─────────────── TELEFON (M) ───────────────
const phone={active:false, tab:'durum', row:0};
const PHONE_TABS=['durum','mesaj','guven','bolge','haber'];
function openPhone(){ phone.active=true; phone.row=0; document.getElementById('phone').style.display='flex'; document.exitPointerLock?.(); renderPhone(); beep(620,0.05); }
function phoneBuyMember(){
  const d=districts[phone.row||0]; if(!d) return;
  if(d.owner!=='mine'){ flash('This district isn\'t yours — go capture it with [G]',2); return; }
  if(S.money<300){ flash('Need $300 for a member'); beep(150,0.1,'square',0.06); return; }
  S.money-=300; d.members++; addGangSus(2); beep(660,0.06); renderPhone();
}
function closePhone(){ phone.active=false; document.getElementById('phone').style.display='none'; if(S.mode==='play') canvas.requestPointerLock?.(); }
function pbar(v,max,color){ return `<div class="pbar"><div style="width:${Math.max(0,Math.min(100,Math.round(v/max*100)))}%;background:${color}"></div></div>`; }
function renderPhone(){
  document.querySelectorAll('#phoneTabs .ptab').forEach(t=>t.classList.toggle('on', t.dataset.tab===phone.tab));
  const el=document.getElementById('phoneBody');
  if(phone.tab==='durum'){
    const inc=districts.filter(d=>d.owner==='mine').reduce((s,d)=>s+d.members*40,0);
    el.innerHTML=`<h4>🎯 Current Objective</h4>
      <div class="pobj">${S.objective||'—'}</div>
      <h4>Character</h4>
      <div class="prow">📅 Day <b>${S.day}</b> · 📖 Chapter <b>${S.chapter}</b> · ⭐ Lv <b>${S.level}</b> · 💵 <b>$${S.money}</b></div>
      <div class="prow">🏴 Your districts: <b>${myDistrictCount()}/${districts.length}</b> · Protection income: <b>$${inc}/min</b></div>
      <h4>Suspicion Balance</h4>
      <div class="prow">👮 Police Suspicion ${pbar(S.policeSus,100,'#3b6fff')}</div>
      <div class="prow">🕶️ Gang Suspicion ${pbar(S.gangSus,100,'#ff5470')}</div>
      <p class="phint">Keep both low. Work too much for the police and the gang suspects you; work too much for the gang and the police won't trust you.</p>`;
  } else if(phone.tab==='mesaj'){
    el.innerHTML=`<h4>🎯 Objective</h4><div class="pobj">${S.objective||'—'}</div><h4>📩 Messages</h4>`+
      (S.messages.length
        ? S.messages.map(m=>`<div class="pnews"><span class="pday">${m.from}</span> ${m.text}</div>`).join('')
        : '<p class="phint">No messages yet.</p>');
  } else if(phone.tab==='guven'){
    const T=S.trust, row=(n,k,c)=>`<div class="prow">${n} ${pbar(T[k],100,c)}</div>`;
    el.innerHTML=`<h4>Trust</h4>
      ${row('Marco','marco','#ffa030')}${row('Rosa','rosa','#ff64b4')}${row('Viper','viper','#9050c8')}
      ${row('Don Karlo','karlo','#c83232')}${row('Police','police','#3b6fff')}
      <p class="phint">Completing missions raises trust and unlocks new mission chains.</p>`;
  } else if(phone.tab==='bolge'){
    el.innerHTML=`<h4>Districts</h4><p class="phint" style="margin-top:0">↑↓ to select · Enter to recruit a member (in your own district) · Go to a district and press [G] to capture</p>`+districts.map((d,i)=>{
      const own=d.owner==='mine'?'🟢 Yours':(d.owner==='rival'?'🔴 Rival':'⚪ Neutral');
      const act=d.owner==='mine'
        ? `<button class="pbtn" data-act="member" data-i="${i}">+Member ($300)</button>`
        : `<span class="pcost">Go & [G]: $${captureCost(d)}</span>`;
      return `<div class="pdist ${i===(phone.row||0)?'sel':''}" data-i="${i}"><div><b>${d.name}</b> · ${own} · 👥${d.members}</div>${act}</div>`;
    }).join('');
    const s=el.querySelector('.pdist.sel'); if(s) s.scrollIntoView({block:'nearest'});
  } else {
    el.innerHTML=`<h4>📰 Newspaper</h4>`+(S.news.length
      ? S.news.map(n=>`<div class="pnews"><span class="pday">Day ${n.day}</span> ${n.text}</div>`).join('')
      : '<p class="phint">No news yet. Leave your mark on the city!</p>');
  }
}
document.getElementById('phoneTabs').addEventListener('click', e=>{
  const t=e.target.closest('.ptab'); if(t){ phone.tab=t.dataset.tab; renderPhone(); beep(520,0.04); }
});
document.getElementById('phoneBody').addEventListener('click', e=>{
  const b=e.target.closest('.pbtn');
  if(b && b.dataset.act==='member'){ phone.row=+b.dataset.i; phoneBuyMember(); return; }
  const row=e.target.closest('.pdist'); if(row){ phone.row=+row.dataset.i; renderPhone(); }
});
document.getElementById('phoneClose').addEventListener('click', closePhone);

// ═══════════════ SİNEMATİK / ARA SAHNE ═══════════════
const cine={active:false, scenes:[], idx:0, onEnd:null};
function playCinematic(scenes, onEnd){
  cine.active=true; cine.scenes=scenes; cine.idx=0; cine.onEnd=onEnd||null;
  document.getElementById('cine').style.display='flex';
  document.exitPointerLock?.();
  showCineScene();
}
function showCineScene(){
  const s=cine.scenes[cine.idx]||{};
  document.getElementById('cineSpeaker').textContent=s.speaker||'';
  document.getElementById('cineText').textContent=s.text||'';
  document.getElementById('cineSub').textContent=s.sub||'';
  const cc=document.getElementById('cineChoice'); cc.innerHTML='';
  // yeniden animasyon
  const mid=document.querySelector('.cineMid'); mid.style.animation='none'; void mid.offsetWidth; mid.style.animation='cineFade .6s ease';
  if(s.choices){
    document.getElementById('cineHint').style.display='none';
    s.choices.forEach(ch=>{ const b=document.createElement('button'); b.className='cineBtn'; b.textContent=ch.label;
      b.onclick=(ev)=>{ ev.stopPropagation(); ch.action&&ch.action(); }; cc.appendChild(b); });
  } else { document.getElementById('cineHint').style.display='block'; }
  if(s.speaker && !s.choices) speakMumble(s.speaker); else beep(300,0.05,'sine',0.04);
}
function cineNext(){
  if(cine.scenes[cine.idx] && cine.scenes[cine.idx].choices) return; // seçim bekliyor
  cine.idx++;
  if(cine.idx>=cine.scenes.length) endCinematic();
  else showCineScene();
}
function cineSkip(){ if(cine.scenes.some(s=>s.choices)) { cine.idx=cine.scenes.findIndex(s=>s.choices); showCineScene(); return; } endCinematic(); }
function endCinematic(){
  cine.active=false; document.getElementById('cine').style.display='none';
  const cb=cine.onEnd; cine.onEnd=null;
  if(S.mode==='play') canvas.requestPointerLock?.();
  if(cb) cb();
}
document.getElementById('cine').addEventListener('click', ()=>{ if(director.active) nextMovieShot(); else if(cine.active) cineNext(); });

// ─────────────── HİKÂYE: "KRALIN GÖLGESİ" ───────────────
function setObjective(t){ S.objective=t; }
function sendStoryMsg(from,text){
  S.messages.unshift({from,text,day:S.day});
  if(S.messages.length>30) S.messages.pop();
  flash('📩 '+from+': '+text,4); playSnd('phone_msg');
}
const OPENING=[
  {sub:'A rainy night. Helicopter lights sweep over the city...'},
  {sub:'A bank robbery. Police are running. Gunshots tear through the night.'},
  {speaker:'???', text:'"There is no such thing as a hero in this city..."'},
  {speaker:'???', text:'"There are only winners and losers."'},
  {sub:'The camera closes in on a police badge fallen on the ground. The screen fades to black.'},
  {sub:'The prison gates open. You walk out — old clothes, a few dollars in your pocket.'},
  {sub:'A black car waits across the gate. Marco is inside.'},
  {speaker:'Marco', text:'"Heard you held your own inside. Want to work?"'},
  {sub:'You get in the car. Your story begins.'},
];
const COP_REVEAL=[
  {sub:'A deserted harbor warehouse. A familiar face is waiting inside.'},
  {speaker:'Chief', text:'"Did you think we forgot you in there?"'},
  {speaker:'Chief', text:'"The operation is still on. We need you to reach Don Karlo."'},
  {sub:'So you\'re still a cop... but the gang thinks you\'re a real criminal. You\'re caught between two fires.'},
];
const DON_MEET=[
  {sub:'Face to face with Don Karlo for the first time. Everyone in the room is silent.'},
  {speaker:'Don Karlo', text:'"Everyone in this city wears a mask."'},
  {speaker:'Don Karlo', text:'"What\'s under yours?"'},
  {sub:'Your heart races. He has no proof... but his eyes cut right through you.'},
];
const FINALE=[
  {sub:'The harbor operation. The city\'s entire crime network is about to fall into one hand.'},
  {sub:'You\'re no ordinary foot soldier anymore — you\'re one of the most powerful names in the city.'},
  {speaker:'You', text:'Did you come to save the city... or to take it over?'},
  {choices:[
    {label:'⚖️  JUSTICE — Help the police, make the bust', action:()=>endingJustice()},
    {label:'🩸  BETRAYAL — Sell out the police, seize the throne', action:()=>endingBetray()},
  ]},
];
function endingJustice(){
  S.story.ending='justice';
  addNews('Major raid: Don Karlo captured, the crime empire collapses.');
  playMovie(JUSTICE_SHOTS, ()=>{ setObjective('Story complete: JUSTICE ending.'); toMenu(); });
}
function endingBetray(){
  S.story.ending='betray';
  addNews('Police operation collapses. The city\'s new boss is an unknown name.');
  playMovie(BETRAY_SHOTS, ()=>{ setObjective('Story complete: BETRAYAL ending.'); toMenu(); });
}
// MORAL CHOICE: stop the shipment (police) or protect it (Viper)?
function triggerMoralChoice(){
  playMovie([
    { dur:99, speaker:'Crossroads', text:'The shipment is coming. Two voices, two orders...', sub:'Police: "Stop it." · Viper: "Protect it." What will you do?',
      setup:buildWarehouse,
      cam:(k)=>camMove(CRX+7,4,CRZ+9, CRX+7,4,CRZ+9, CRX+2,2.2,CRZ-6, 1),
      anim:(t,dt,d)=>{ if(d.lamp) d.lamp.rotation.z=Math.sin(t*1.2)*0.12; },
      choices:[
        {label:'👮 STOP the shipment — Stay loyal to the police', action:()=>{ endMovie();
          addTrust('police',20); addTrust('viper',-12); addGangSus(25);
          addNews('A weapons shipment was mysteriously raided.');
          flash('You chose the police\'s side — the gang grows suspicious.',3.5); advanceStage(); }},
        {label:'🕶️ PROTECT the shipment — Stay loyal to the gang', action:()=>{ endMovie();
          addTrust('viper',20); addTrust('karlo',10); addTrust('police',-12); addPoliceSus(25);
          addNews('The weapons shipment was delivered smoothly — the police are a step behind.');
          flash('You chose the gang\'s side — the police see you as out of control.',3.5); advanceStage(); }},
      ] },
  ]);
}
// görev tamamlanınca hikâyeyi ilerlet
function onMissionDone(mid){
  // Bölüm 1 bitince (Marco zinciri) → gizem: depoya çağrı → polis ifşası
  if(mid==='m03' && !S.story.cop && !S.story.warehouseActive){
    S.story.warehouseActive=true; warehouseMarker.visible=true; warehouseBeam.visible=true;
    sendStoryMsg('Unknown Number','The operation continues. Come to the harbor warehouse.');
    setObjective('📍 Mysterious message — Go to the harbor warehouse (white marker on map)');
  }
  // Viper zinciri bitince (Bölüm 3) → Don Karlo ile yüzleşme
  if(mid==='m09' && !S.story.don){
    S.story.don=true;
    playMovie(DON_MEET_SHOTS, ()=>{ S.chapter=4; setObjective('Talk to Don Karlo — The Big Score awaits'); });
  }
  // Büyük Vurgun bitince → FİNAL ve çift son
  if(mid==='m10' && !S.story.finale){
    S.story.finale=true;
    playMovie(FINALE_SHOTS);
  }
}

// ═══════════════ 3D SİNEMATİK YÖNETMEN ═══════════════
const director={active:false, shots:[], i:0, t:0, props:[], onEnd:null, heli:null, badge:null, gateL:null, gateR:null, copLights:null};
function setCaption(speaker,text,sub){
  document.getElementById('cineSpeaker').textContent=speaker||'';
  document.getElementById('cineText').textContent=text||'';
  document.getElementById('cineSub').textContent=sub||'';
  const mid=document.querySelector('.cineMid'); mid.style.animation='none'; void mid.offsetWidth; mid.style.animation='cineFade .6s ease';
}
function setHudHidden(h){ document.querySelectorAll('.hud').forEach(e=>e.style.visibility=h?'hidden':''); const mini=document.getElementById('mini'); if(mini) mini.style.visibility=h?'hidden':''; }
function playMovie(shots,onEnd){
  director.active=true; director.shots=shots; director.i=0; director.t=0; director.props=[]; director.onEnd=onEnd||null;
  const c=document.getElementById('cine'); c.style.display='flex'; c.classList.add('movie');
  document.getElementById('cineChoice').innerHTML=''; document.getElementById('cineHint').style.display='block';
  document.exitPointerLock?.(); setHudHidden(true); player.visible=false;
  stopSnd('engine'); stopSnd('rain');   // sinematikte ortam döngülerini sustur
  startMovieShot();
}
function clearMovieProps(){ for(const p of director.props) scene.remove(p); director.props.length=0; director.heli=null; director.badge=null; director.gateL=null; director.gateR=null; director.copLights=null; }
function startMovieShot(){
  clearMovieProps(); const s=director.shots[director.i]||{}; setCaption(s.speaker,s.text,s.sub);
  const cc=document.getElementById('cineChoice'); cc.innerHTML='';
  if(s.choices){ document.getElementById('cineHint').style.display='none';
    s.choices.forEach(ch=>{ const b=document.createElement('button'); b.className='cineBtn'; b.textContent=ch.label;
      b.onclick=(ev)=>{ ev.stopPropagation(); ch.action&&ch.action(); }; cc.appendChild(b); });
  } else document.getElementById('cineHint').style.display='block';
  if(s.setup) s.setup(director); director.t=0;
  if(s.speaker && !s.choices) speakMumble(s.speaker);   // konuşurken mırıldanma
}
function nextMovieShot(){
  if(director.shots[director.i] && director.shots[director.i].choices) return; // seçim bekliyor
  director.i++; if(director.i>=director.shots.length) endMovie(); else startMovieShot();
}
function endMovie(){
  director.active=false; clearMovieProps();
  const c=document.getElementById('cine'); c.style.display='none'; c.classList.remove('movie');
  setHudHidden(false); player.visible=true; rain.visible=S.raining;
  const cb=director.onEnd; director.onEnd=null; if(cb) cb();
}
function camMove(fx,fy,fz, tx,ty,tz, lx,ly,lz, k){
  camera.position.set(fx+(tx-fx)*k, fy+(ty-fy)*k, fz+(tz-fz)*k); camera.lookAt(lx,ly,lz);
}
function updateDirector(dt){
  // gece + yağmur atmosferi
  scene.background.setRGB(0.03,0.04,0.09); sun.intensity=0.5;
  if(scene.fog){ scene.fog.color.copy(scene.background); scene.fog.far=220; }
  rain.visible=true; rain.position.set(camera.position.x,0,camera.position.z);
  const ra=rainGeo.attributes.position.array;
  for(let i=0;i<RAIN_N;i++){ ra[i*3+1]-=60*dt; if(ra[i*3+1]<0) ra[i*3+1]=60; }
  rainGeo.attributes.position.needsUpdate=true;
  const s=director.shots[director.i]; if(!s) return;
  director.t+=dt; const k=Math.min(1, director.t/(s.dur||4));
  if(s.cam) s.cam(k, director.t); if(s.anim) s.anim(director.t, dt, director);
  if(!s.choices && director.t>=(s.dur||4)) nextMovieShot();
}
// ── AÇILIŞ ÇEKİMLERİ ──
const OPENING_SHOTS=[
  { dur:6.5, sub:'A rainy night. Helicopter lights sweep over the city...',
    setup:(d)=>{ const heli=new THREE.Group();
      const body=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x161616})); body.scale.set(3,1.4,5.5); heli.add(body);
      const tail=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x161616})); tail.scale.set(0.6,0.6,5); tail.position.z=-5; heli.add(tail);
      const rotor=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x0c0c0c})); rotor.scale.set(12,0.2,0.9); rotor.position.y=1.3; heli.add(rotor);
      const beam=new THREE.Mesh(new THREE.ConeGeometry(7,36,18,1,true),new THREE.MeshBasicMaterial({color:0xfff4cc,transparent:true,opacity:0.10,side:THREE.DoubleSide})); beam.position.y=-18; heli.add(beam);
      const light=new THREE.PointLight(0xfff0c0,2.5,80); light.position.y=-2; heli.add(light);
      heli.position.set(-55,47,28); heli.userData={rotor,beam}; scene.add(heli); d.props.push(heli); d.heli=heli; },
    cam:(k)=>camMove(-75,40,95, 75,44,95, 0,20,0, k),
    anim:(t,dt,d)=>{ if(d.heli){ d.heli.userData.rotor.rotation.y+=dt*42; d.heli.position.x=-55+t*15; } } }, // ışık helikoptere sabit (çocuk obje, birlikte hareket eder)

  { dur:6, sub:'A bank robbery. Police are running — gunshots tear through the night.',
    setup:(d)=>{ const bank=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x6a6256})); bank.scale.set(22,15,11); bank.position.set(0,7.5,-14); scene.add(bank); d.props.push(bank);
      for(let c=-1;c<=1;c++){ const col=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,11,10),new THREE.MeshLambertMaterial({color:0x8a8276})); col.position.set(c*6,5.5,-8); scene.add(col); d.props.push(col); }
      const sign=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0xffd24a})); sign.scale.set(9,1.6,0.5); sign.position.set(0,13,-8.3); scene.add(sign); d.props.push(sign);
      d.copLights=[];
      for(let i=-1;i<=1;i++){ const car=new THREE.Group();
        const b=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x1e2878})); b.scale.set(2.4,1,4.8); b.position.y=0.7; car.add(b);
        const lr=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0xff2222})); lr.scale.set(0.8,0.4,0.5); lr.position.set(-0.4,1.6,0); car.add(lr);
        const lb=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0x2244ff})); lb.scale.set(0.8,0.4,0.5); lb.position.set(0.4,1.6,0); car.add(lb);
        car.position.set(i*8,0,7); car.rotation.y=Math.PI; scene.add(car); d.props.push(car); d.copLights.push({lr,lb}); } },
    cam:(k)=>camMove(-16,3,24, 8,4.5,22, 0,7,-8, k),
    anim:(t,dt,d)=>{ const on=(performance.now()%300<150); if(d.copLights) for(const c of d.copLights){ c.lr.material.color.setHex(on?0xff2222:0x330000); c.lb.material.color.setHex(on?0x2244ff:0x001133); }
      if(Math.random()<0.22){ const f=new THREE.PointLight(0xffeeaa,4,18); f.position.set((Math.random()-.5)*18,2,9); scene.add(f); setTimeout(()=>scene.remove(f),55); } } },

  { dur:3.2, speaker:'???', text:'"There is no such thing as a hero in this city..."',
    cam:(k)=>camMove(3,2.6,9, 2,2.4,7.4, 0,2,-3, k) },
  { dur:3.2, speaker:'???', text:'"There are only winners and losers."',
    cam:(k)=>camMove(-3,2.3,8, -1.5,2.3,6.6, 0,2,-3, k) },

  { dur:4.6, sub:'The camera closes in on a police badge fallen on the ground...',
    setup:(d)=>{ const badge=new THREE.Group();
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.25,7),new THREE.MeshLambertMaterial({color:0xffd24a,emissive:0x554400})); disc.rotation.x=Math.PI/2; badge.add(disc);
      const star=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.4,5),new THREE.MeshLambertMaterial({color:0xfff2a0,emissive:0x665500})); star.position.z=0.2; badge.add(star);
      badge.position.set(0,9,0); scene.add(badge); d.props.push(badge); d.badge=badge; },
    cam:(k)=>camMove(3.5,6,5.5, 1.8,1.1,3, 0,2,0, k),
    anim:(t,dt,d)=>{ if(d.badge){ if(d.badge.position.y>0.3){ d.badge.position.y-=dt*5.2; d.badge.rotation.z+=dt*5; d.badge.rotation.x+=dt*3; } else d.badge.position.y=0.3; } } },

  { dur:4.6, sub:'The prison gates open. You walk out — a few dollars in your pocket.',
    setup:(d)=>{ const mat=new THREE.MeshLambertMaterial({color:0x4a505a});
      const wL=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x33353c})); wL.scale.set(9,12,1.5); wL.position.set(-10,6,-9); scene.add(wL); d.props.push(wL);
      const wR=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x33353c})); wR.scale.set(9,12,1.5); wR.position.set(10,6,-9); scene.add(wR); d.props.push(wR);
      const gateL=new THREE.Group(); for(let i=0;i<5;i++){ const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,10,6),mat); bar.position.set(-4.2+i*1.05,5,-9); gateL.add(bar);} scene.add(gateL); d.props.push(gateL); d.gateL=gateL;
      const gateR=new THREE.Group(); for(let i=0;i<5;i++){ const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,10,6),mat); bar.position.set(0.2+i*1.05,5,-9); gateR.add(bar);} scene.add(gateR); d.props.push(gateR); d.gateR=gateR; },
    cam:(k)=>camMove(0,5,14, 0,3.6,7, 0,5,-9, k),
    anim:(t,dt,d)=>{ const open=Math.min(7,t*2.2); if(d.gateL) d.gateL.position.x=-open; if(d.gateR) d.gateR.position.x=open; } },

  { dur:5.4, speaker:'Marco', text:'"Heard you held your own inside. Want to work?"',
    setup:(d)=>{ const car=new THREE.Group();
      const b=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x080808})); b.scale.set(2.5,1,5); b.position.y=0.7; car.add(b);
      const cab=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x10121a})); cab.scale.set(2.1,0.85,2.5); cab.position.set(0,1.45,-0.2); car.add(cab);
      for(const wz of [1.5,-1.5]) for(const wx of [-1.15,1.15]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.4,10),new THREE.MeshLambertMaterial({color:0x0a0a0a})); w.rotation.z=Math.PI/2; w.position.set(wx,0.4,wz); car.add(w); }
      const head=new THREE.PointLight(0xfff0cc,2,34); head.position.set(0,1,3.2); car.add(head);
      car.position.set(0,0,0); car.rotation.y=0.5; scene.add(car); d.props.push(car); },
    cam:(k)=>camMove(8,2.6,7.5, 4.5,2,5.5, 0,1.6,-0.5, k) },

  { dur:2.6, sub:'You get in the car. Your story begins...',
    cam:(k)=>camMove(4.5,2,5.5, 3,3,4, 0,1.5,-1, k) },
];

// ── İNSAN FİGÜRÜ (ara sahne karakterleri) ──
function makeFigure(color){
  const g=new THREE.Group();
  const t=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color})); t.scale.set(0.95,1.7,0.6); t.position.y=1; t.castShadow=true; g.add(t);
  const h=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,12),new THREE.MeshLambertMaterial({color:0xe6be8c})); h.position.y=2; g.add(h);
  return g;
}
// ── POLİS İFŞASI (depo) ──
const CRX=HARBOR[0], CRZ=HARBOR[1];   // polis ifşası limandaki depoda geçer
function buildWarehouse(d){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(36,36),new THREE.MeshLambertMaterial({color:0x201e24})); floor.rotation.x=-Math.PI/2; floor.position.set(CRX,0.06,CRZ); scene.add(floor); d.props.push(floor);
  const wm=new THREE.MeshLambertMaterial({color:0x2a2730});
  const back=new THREE.Mesh(boxGeo,wm); back.scale.set(36,14,1); back.position.set(CRX,7,CRZ-17); scene.add(back); d.props.push(back);
  const lft=new THREE.Mesh(boxGeo,wm); lft.scale.set(1,14,36); lft.position.set(CRX-17,7,CRZ); scene.add(lft); d.props.push(lft);
  const rgt=new THREE.Mesh(boxGeo,wm); rgt.scale.set(1,14,36); rgt.position.set(CRX+17,7,CRZ); scene.add(rgt); d.props.push(rgt);
  for(let i=0;i<7;i++){ const s=1.4+Math.random()*1.3; const cr=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x5a4a32})); cr.scale.set(s,s,s); cr.position.set(CRX-13+Math.random()*24,s/2,CRZ-14+Math.random()*11); cr.castShadow=true; scene.add(cr); d.props.push(cr); }
  const lamp=new THREE.Group(); const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8),new THREE.MeshBasicMaterial({color:0xfff3c0})); lamp.add(bulb); const pl=new THREE.PointLight(0xfff0c0,5,40); lamp.add(pl); lamp.position.set(CRX+2,8.5,CRZ-3); scene.add(lamp); d.props.push(lamp); d.lamp=lamp;
  const amir=makeFigure(0x223a58); amir.position.set(CRX+2,0,CRZ-8); scene.add(amir); d.props.push(amir); d.amir=amir;
}
const sway=(t,d)=>{ if(d.lamp) d.lamp.rotation.z=Math.sin(t*1.2)*0.12; };
const COP_REVEAL_SHOTS=[
  { dur:5, sub:'A deserted harbor warehouse. A familiar face is waiting inside.', setup:buildWarehouse,
    cam:(k)=>camMove(CRX+12,5.5,CRZ+14, CRX+5,3.4,CRZ+6, CRX+2,2.4,CRZ-6, k), anim:(t,dt,d)=>sway(t,d) },
  { dur:3.6, speaker:'Chief', text:'"Did you think we forgot you in there?"', setup:buildWarehouse,
    cam:(k)=>camMove(CRX+3,2.5,CRZ-1, CRX+2.4,2.4,CRZ-2.5, CRX+2,2.1,CRZ-8, k), anim:(t,dt,d)=>sway(t,d) },
  { dur:4.6, speaker:'Chief', text:'"The operation is still on. We need you to reach Don Karlo."', setup:buildWarehouse,
    cam:(k)=>camMove(CRX,2.7,CRZ-0.5, CRX+1,2.5,CRZ-2.5, CRX+2,2.1,CRZ-8, k), anim:(t,dt,d)=>sway(t,d) },
  { dur:4.2, sub:'So you\'re still a cop... but the gang thinks you\'re a real criminal. Caught between two fires.', setup:buildWarehouse,
    cam:(k)=>camMove(CRX-8,5.5,CRZ+10, CRX-3,4,CRZ+5, CRX+2,2,CRZ-6, k), anim:(t,dt,d)=>sway(t,d) },
];
// ── DON KARLO BULUŞMASI (makam) ──
const OFX=120, OFZ=-120;
function buildOffice(d){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshLambertMaterial({color:0x241a1a})); floor.rotation.x=-Math.PI/2; floor.position.set(OFX,0.06,OFZ); scene.add(floor); d.props.push(floor);
  const wm=new THREE.MeshLambertMaterial({color:0x2e2222});
  const back=new THREE.Mesh(boxGeo,wm); back.scale.set(30,13,1); back.position.set(OFX,6.5,OFZ-15); scene.add(back); d.props.push(back);
  const desk=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x3a2a18})); desk.scale.set(8,1.6,3.2); desk.position.set(OFX,0.8,OFZ-8); desk.castShadow=true; scene.add(desk); d.props.push(desk);
  const warm=new THREE.PointLight(0xffcc88,4,34); warm.position.set(OFX,6,OFZ-5); scene.add(warm); d.props.push(warm);
  const don=makeFigure(0x6a1818); don.scale.set(1.18,1.18,1.18); don.position.set(OFX,0,OFZ-11); scene.add(don); d.props.push(don); d.don=don;
}
const DON_MEET_SHOTS=[
  { dur:4.5, sub:'Face to face with Don Karlo for the first time. Everyone in the room is silent.', setup:buildOffice,
    cam:(k)=>camMove(OFX-10,4.5,OFZ+9, OFX-4,3,OFZ+3, OFX,2.6,OFZ-10, k) },
  { dur:3.6, speaker:'Don Karlo', text:'"Everyone in this city wears a mask."', setup:buildOffice,
    cam:(k)=>camMove(OFX+1.5,2.9,OFZ-3, OFX+0.5,2.7,OFZ-5, OFX,2.7,OFZ-11, k) },
  { dur:4, speaker:'Don Karlo', text:'"What\'s under yours?"', setup:buildOffice,
    cam:(k)=>camMove(OFX-1.5,2.7,OFZ-3.5, OFX,2.7,OFZ-5.5, OFX,2.7,OFZ-11, k) },
  { dur:4, sub:'Your heart races. He has no proof... but his eyes cut right through you.', setup:buildOffice,
    cam:(k)=>camMove(OFX+9,4.5,OFZ+7, OFX+4,3,OFZ+2, OFX,2.6,OFZ-10, k) },
];
// ── FİNAL + SEÇİM ──
function buildRooftop(d){
  // şehrin en yüksek gökdeleni — kahraman en üst katta, şehir aşağıda
  const tower=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x20222c})); tower.scale.set(14,80,14); tower.position.set(0,0,0); tower.castShadow=true; scene.add(tower); d.props.push(tower);
  // kule pencere şeritleri (gökdelen hissi)
  for(let fy=6; fy<78; fy+=6){ const win=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:0x5a78a8})); win.scale.set(14.2,2.2,14.2); win.position.set(0,fy,0); scene.add(win); d.props.push(win); }
  const plat=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x2a2a34})); plat.scale.set(13,1.2,13); plat.position.set(0,80.5,0); scene.add(plat); d.props.push(plat);
  // korkuluk
  for(const[sx,sz]of[[6,0],[-6,0],[0,6],[0,-6]]){ const r=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x3a3a44})); r.scale.set(sx?0.4:12,1.4,sz?0.4:12); r.position.set(sx,81.6,sz); scene.add(r); d.props.push(r); }
  const hero=makeFigure(0x1a1a22); hero.scale.set(1.4,1.4,1.4); hero.position.set(0,81.1,3); hero.rotation.y=Math.PI; scene.add(hero); d.props.push(hero); d.hero=hero;
  const moon=new THREE.PointLight(0x88aaff,2,200); moon.position.set(40,120,40); scene.add(moon); d.props.push(moon);
}
const FINALE_SHOTS=[
  { dur:5, sub:'The harbor operation. The city\'s entire crime network is about to fall into one hand.',
    cam:(k)=>camMove(-90,58,150, 90,58,150, 0,28,0, k) },
  { dur:4.5, sub:'Don Karlo aged and stepped back. Now you stand atop the city\'s tallest tower.', setup:buildRooftop,
    cam:(k)=>camMove(0,102,60, 0,90,30, 0,38,-95, k) },
  { dur:99, speaker:'You', text:'Did you come to save the city... or to take it over?', setup:buildRooftop,
    cam:(k)=>camMove(0,84.5,13, 0,84,12, 0,42,-80, 1),
    choices:[
      {label:'⚖️  JUSTICE — Help the police, make the bust', action:()=>{ endMovie(); endingJustice(); }},
      {label:'🩸  BETRAYAL — Sell out the police, seize the throne', action:()=>{ endMovie(); endingBetray(); }},
    ] },
];
const JUSTICE_SHOTS=[
  { dur:5, sub:'The big raid begins. Don Karlo is cuffed. The gang collapses overnight.', setup:buildOffice,
    cam:(k)=>camMove(OFX-10,5,OFZ+10, OFX-4,3,OFZ+4, OFX,2.5,OFZ-10, k),
    anim:(t,dt,d)=>{ if(Math.random()<0.3){ const f=new THREE.PointLight(0x4488ff,4,30); f.position.set(OFX+(Math.random()-.5)*16,3,OFZ+5); scene.add(f); setTimeout(()=>scene.remove(f),60);} } },
  { dur:4.2, speaker:'You', text:'You get your badge back. But there\'s no peace on your face.',
    cam:(k)=>camMove(3,2.6,8, 2,2.4,6, 0,2,0, k) },
  { dur:5.5, speaker:'END — JUSTICE', text:'"I committed crimes for years... never became a hero. I just survived."',
    cam:(k)=>camMove(-40,40,120, 40,40,120, 0,20,0, k) },
];
const BETRAY_SHOTS=[
  { dur:5, sub:'You destroy all records of the secret operation. The Chief is never seen again.', setup:buildWarehouse,
    cam:(k)=>camMove(CRX-8,5,CRZ+10, CRX-3,4,CRZ+5, CRX+2,2,CRZ-6, k), anim:(t,dt,d)=>sway(t,d) },
  { dur:4.5, sub:'Don Karlo grows old and steps back. The throne is empty — and you climb the tallest tower.', setup:buildRooftop,
    cam:(k)=>camMove(0,102,60, 0,90,30, 0,38,-95, k) },
  { dur:5.5, speaker:'END — BETRAYAL', text:'The phone rings: "You\'re the new king." You look down from the top of the city.', setup:buildRooftop,
    cam:(k)=>camMove(0,84.5,13, 0,84,12, 0,42,-80, k) },
];

// ── m09 PUSU SİNEMATİĞİ (liman: 7 adam konteynerları patlatmaya çalışır) ──
const AX=AMBUSH[0], AZ=AMBUSH[1];
function buildAmbushScene(d){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,50),new THREE.MeshLambertMaterial({color:0x3a3f48})); floor.rotation.x=-Math.PI/2; floor.position.set(AX,0.07,AZ); scene.add(floor); d.props.push(floor);
  const cols=[0xc0392b,0x2980b9,0xe1b12c,0x27ae60,0x884ea0];
  d.crates=[];
  for(let i=0;i<6;i++){
    const cont=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:cols[i%cols.length]}));
    cont.scale.set(6,3,2.6); cont.position.set(AX-15+i*6, 1.5, AZ-6+(i%2)*7); cont.castShadow=true; scene.add(cont); d.props.push(cont); d.crates.push(cont);
    // patlayıcı (kırmızı yanıp sönen ışık)
    const charge=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),new THREE.MeshBasicMaterial({color:0xff2020})); charge.position.set(cont.position.x, 1.5, cont.position.z+1.4); scene.add(charge); d.props.push(charge); d.crates.push(charge);
  }
  // 7 saldırgan (siyah kıyafet) + 1 takım elbiseli lider
  d.thugs=[];
  for(let i=0;i<6;i++){ const f=makeFigure(0x111118); f.position.set(AX-12+i*5, 0, AZ+5+(i%2)*3); f.rotation.y=Math.PI; scene.add(f); d.props.push(f); d.thugs.push(f); }
  const boss=makeFigure(0x1a2438); boss.scale.set(1.12,1.12,1.12); boss.position.set(AX+10,0,AZ+8); scene.add(boss); d.props.push(boss); d.boss=boss;
  // gece ışığı
  const pl=new THREE.PointLight(0xff8844,3,60); pl.position.set(AX,12,AZ+4); scene.add(pl); d.props.push(pl);
}
const ambSpark=(t,dt,d)=>{ // konteynerlere kıvılcım/patlama
  if(d.crates && Math.random()<0.12){ const c=d.crates[(Math.random()*d.crates.length)|0]; spawnExplosion(c.position.x,1.6,c.position.z); }
};
const AMBUSH_SHOTS=[
  { dur:4.5, sub:'The harbor. In the night, seven armed men plant explosives on the containers.', setup:buildAmbushScene,
    cam:(k)=>camMove(AX-26,12,AZ+24, AX+6,7,AZ+14, AX,2,AZ, k), anim:ambSpark },
  { dur:4, speaker:'Rival Boss', text:'"Blow this harbor sky high. Let it be a message to Karlo."', setup:buildAmbushScene,
    cam:(k)=>camMove(AX+14,4,AZ+13, AX+11,3,AZ+10, AX+10,2.2,AZ+8, k), anim:ambSpark },
  { dur:4, sub:'You have to stop them — take down six, but the boss will slip away.', setup:buildAmbushScene,
    cam:(k)=>camMove(AX,9,AZ-18, AX,5,AZ-6, AX,2,AZ+4, k), anim:ambSpark },
];
// ── m09 BİTİŞ: lider aracı havaya uçar ──
function buildLeaderEnd(d){
  const road=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshLambertMaterial({color:0x2e2e34})); road.rotation.x=-Math.PI/2; road.position.set(0,0.07,0); scene.add(road); d.props.push(road);
  const car=new THREE.Group();
  const body=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x101014})); body.scale.set(2.2,1,4.6); body.position.y=0.7; car.add(body);
  const cab=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x202833})); cab.scale.set(1.9,0.8,2.2); cab.position.set(0,1.4,-0.2); car.add(cab);
  car.position.set(0,0,0); scene.add(car); d.props.push(car); d.car=car;
}
const leaderEndAnim=(t,dt,d)=>{
  if(!d.car) return;
  if(t<0.6){ if(Math.random()<0.5) spawnExplosion(d.car.position.x+(Math.random()-.5)*2,1,d.car.position.z+(Math.random()-.5)*2); }
  else { // havaya fırla + dön
    d.car.position.y += 26*dt;
    d.car.rotation.x += 3.2*dt; d.car.rotation.z += 2.4*dt;
    if(Math.random()<0.25) spawnExplosion(d.car.position.x+(Math.random()-.5)*3, d.car.position.y, d.car.position.z+(Math.random()-.5)*3);
  }
};
const LEADER_END_SHOTS=[
  { dur:1.0, sub:'', setup:buildLeaderEnd,
    cam:(k)=>camMove(14,4,16, 11,3.5,13, 0,1.5,0, k), anim:leaderEndAnim },
  { dur:3.4, speaker:'', text:'His car turns into a fireball — the boss is thrown skyward inside the shredded steel.', setup:buildLeaderEnd,
    cam:(k)=>camMove(16,7,18, 16,7,18, 0,8,0, 1), anim:leaderEndAnim },
  { dur:3.2, speaker:'Viper', text:'"Clean work. You\'ve got no rivals left on these streets."', setup:buildLeaderEnd,
    cam:(k)=>camMove(10,3,12, 8,2.6,9, 0,1.5,0, k) },
];
function triggerLeaderEnd(wx,wz){
  spawnExplosion(wx,1,wz);
  playMovie(LEADER_END_SHOTS, ()=>{ advanceStage(); });   // → görev tamamlanır (ödül + Don Karlo zinciri)
}

// ─────────────── SİLAH ÇARKI ───────────────
const wheel={active:false, sel:0};
function openWheel(){ wheel.active=true; wheel.sel=Math.max(0,WHEEL.indexOf(S.weapon)); document.getElementById('wheel').style.display='flex'; renderWheel(); document.exitPointerLock?.(); }
function closeWheel(){ wheel.active=false; document.getElementById('wheel').style.display='none'; if(S.mode==='play') canvas.requestPointerLock?.(); }
// GTA tarzı DAİRESEL çark: silahlar bir çember etrafında dizilir
function renderWheel(){
  const N=WHEEL.length, R=185;
  const items = WHEEL.map((k,i)=>{
    const w=WEAPONS[k]; const isSel=i===wheel.sel;
    const ang=(i/N)*Math.PI*2 - Math.PI/2;        // tepeden başla, saat yönü
    const x=Math.cos(ang)*R, y=Math.sin(ang)*R;
    return `<div class="wseg ${isSel?'sel':''}" data-k="${k}" data-i="${i}"
       style="transform:translate(-50%,-50%) translate(${x}px,${y}px) scale(${isSel?1.18:1})">
       <div class="wi">${w.icon}</div></div>`;
  }).join('');
  const cur=WEAPONS[WHEEL[wheel.sel]], ca=S.ammo[WHEEL[wheel.sel]];
  const info = cur.melee?'Melee':`${ca>=9999?'∞':ca} ammo${cur.zoom?' · 🔭':''}`;
  const center=`<div class="wcenter"><div class="wcn">${cur.name}</div><div class="wca">${info}</div></div>`;
  document.getElementById('wheelItems').innerHTML = items + center;
}
function selectWeapon(k){
  if(!WEAPONS[k]) return;
  S.weapon=k;
  if(!WEAPONS[k].zoom) S.scoped=false;     // sadece AWP'de dürbün
  S.ads=false;                             // silah değişince omuz nişanını bırak
  gun.visible = !WEAPONS[k].melee;         // yumrukta eldeki silah görünmez
  flash(WEAPONS[k].name+' equipped',1.2);
  beep(660,0.05);
}
// çarkta üzerine gelince vurgula (tıklama onayı mousedown'da)
document.getElementById('wheelItems').addEventListener('mousemove', e=>{
  const el=e.target.closest('.wseg'); if(el && +el.dataset.i!==wheel.sel){ wheel.sel=+el.dataset.i; renderWheel(); }
});
// scroll ile silahlar arası geç
document.getElementById('wheel').addEventListener('wheel', e=>{
  if(!wheel.active) return; e.preventDefault();
  wheel.sel=(wheel.sel + (e.deltaY>0?1:-1) + WHEEL.length)%WHEEL.length; renderWheel();
}, {passive:false});

// ─────────────── GİRİŞ ───────────────
const keys = {};
let mouseHeld = false;   // sol tık basılı mı (tarama ateşi için)
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase(); keys[k]=true;
  if(director.active){ e.preventDefault(); if(k==='enter'||k===' '){ nextMovieShot(); } else if(k==='escape'){ endMovie(); } return; }
  if(cine.active){ e.preventDefault(); if(k==='enter'||k===' '){ cineNext(); } else if(k==='escape'){ cineSkip(); } return; }
  if(S.mode==='menu') return;
  if(dlg.active){ if(k==='e'||k==='enter'||k===' ') advanceDialog(); return; }
  if(shop.active){
    if(k==='arrowup')shop.cursor=(shop.cursor+SHOP_ITEMS.length-1)%SHOP_ITEMS.length,renderShop();
    else if(k==='arrowdown')shop.cursor=(shop.cursor+1)%SHOP_ITEMS.length,renderShop();
    else if(k==='enter')buyShop();
    else if(k==='escape')closeShop();
    return;
  }
  if(wheel.active){
    if(k>='1'&&k<='7'){ selectWeapon(WHEEL[+k-1]); closeWheel(); }
    else if(k==='q'||k==='tab'||k==='escape'){ e.preventDefault(); closeWheel(); }
    return;
  }
  if(phone.active){
    e.preventDefault();
    if(k==='m'||k==='escape'){ closePhone(); }
    else if(k==='arrowleft'||k==='a'||k==='q'){ const i=PHONE_TABS.indexOf(phone.tab); phone.tab=PHONE_TABS[(i+PHONE_TABS.length-1)%PHONE_TABS.length]; phone.row=0; renderPhone(); beep(520,0.04); }
    else if(k==='arrowright'||k==='d'||k==='e'){ const i=PHONE_TABS.indexOf(phone.tab); phone.tab=PHONE_TABS[(i+1)%PHONE_TABS.length]; phone.row=0; renderPhone(); beep(520,0.04); }
    else if(k==='arrowdown'||k==='s'){ if(phone.tab==='bolge'){ phone.row=Math.min(districts.length-1,(phone.row||0)+1); renderPhone(); beep(440,0.03); } }
    else if(k==='arrowup'||k==='w'){ if(phone.tab==='bolge'){ phone.row=Math.max(0,(phone.row||0)-1); renderPhone(); beep(440,0.03); } }
    else if(k==='enter'||k===' '){ if(phone.tab==='bolge') phoneBuyMember(); }
    return;
  }
  if(S.mode==='paused'){ if(k==='escape')resume(); return; }
  // oyun içi
  if(k==='escape')pauseGame();
  else if(k===' '){ e.preventDefault(); if(!S.inCar && S.onGround && S.stamina>10){ S.vy=9; S.onGround=false; S.stamina-=12; playSnd('jump'); } } // ZIPLAMA
  else if(k==='n'){ toggleMute(); } // SES AÇ/KAPAT
  else if(k==='r'){ S.raining=!S.raining; S.rainManualT=180; flash(S.raining?'🌧️ Rain started':'☀️ Skies cleared',2); } // WEATHER (manual, 3min priority)
  else if(k==='v'){ toggleFireMode(); } // ATIŞ MODU (tekli ↔ tarama)
  else if(k==='g'){ if(!S.inCar){ const d=districtNearHQ(); if(d && d.owner!=='mine') captureDistrict(d); } } // BÖLGE ELE GEÇİR
  else if(k==='m'){ openPhone(); } // TELEFON
  else if(k==='q'||k==='tab'){ e.preventDefault(); openWheel(); }
  else if(k>='1'&&k<='7'){ selectWeapon(WHEEL[+k-1]); }
  else if(k==='f'){ S.inCar?exitCar():enterCar(); }
  else if(k==='e')tryTalk();
  else if(k==='b'){ if(!S.inCar && dist2(player.position.x,player.position.z,SHOP[0],SHOP[1])<8) openShop(); }
});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });

// fare bakış (pointer lock)
addEventListener('contextmenu', e=>e.preventDefault()); // sağ tık menüsünü engelle
addEventListener('mousedown', e=>{
  if(cine.active||director.active) return;   // sinematik kendi tıklamasını yönetir
  if(S.mode!=='play') return;
  if(dlg.active||shop.active) return;
  if(wheel.active){ if(e.button===0){ selectWeapon(WHEEL[wheel.sel]); closeWheel(); } return; } // çarkta sol tık = seç
  if(document.pointerLockElement!==canvas){ canvas.requestPointerLock?.(); return; }
  if(e.button===0){
    const w=curW();
    if(w.thrown) throwGrenade();          // el bombası
    else if(w.melee){ if(!S.inCar) punch(); }  // yumruk (araçta değilken)
    else { mouseHeld=true; shoot(); }      // ilk atış; tarama modunda update devam ettirir
  }
  else if(e.button===2 && !S.inCar){ // SAĞ TIK → odaklan
    if(curW().zoom) S.scoped=true;          // AWP: dürbün
    else if(!curW().melee) S.ads=true;       // diğer silahlar: omuz nişanı (yumruk hariç)
  }
});
addEventListener('mouseup', e=>{
  if(e.button===0) mouseHeld=false;                 // tarama ateşini durdur
  if(e.button===2){ S.scoped=false; S.ads=false; }  // bırakınca normale dön
});
// araç içi serbest bakış (fare ile sağa-sola); fare durunca düz ileri döner
let carLookYaw=0, carLookPitch=0, carLookLast=0;
addEventListener('mousemove', e=>{
  if(document.pointerLockElement!==canvas) return;
  if(S.inCar){
    const sens=0.0025*SETTINGS.sens;
    carLookYaw   = Math.max(-1.5, Math.min(1.5, carLookYaw - e.movementX*sens));   // ±~85° sağa/sola bak
    carLookPitch = Math.max(-0.35, Math.min(0.45, carLookPitch - e.movementY*sens));
    carLookLast  = performance.now();   // bakış zamanı (durunca geri dönsün)
    return;
  }
  const sens = (S.scoped ? 0.0008 : (S.ads ? 0.0016 : 0.0025))*SETTINGS.sens; // dürbün/omuz nişanında hassas
  yaw -= e.movementX*sens;
  // mouse yukarı (movementY<0) → yukarı bak (pitch artar). Geniş dikey aralık.
  pitch = Math.max(-0.75, Math.min(0.85, pitch - e.movementY*sens));
});

function dist2(x1,z1,x2,z2){ return Math.hypot(x1-x2,z1-z2); }

// ─────────────── AKSİYONLAR ───────────────
function enterCar(){
  let near=null,nd=8;
  for(const c of cars){ const d=dist2(player.position.x,player.position.z,c.position.x,c.position.z); if(d<nd){nd=d;near=c;} }
  if(near){
    // GTA tarzı: içinde sürücü varsa önce onu dışarı fırlat
    if(near.userData.driver && near.userData.driver.visible) ejectDriver(near);
    S.inCar=true; S.car=near; near.userData.occupied=true; player.visible=false;
    if(near.userData.driver) near.userData.driver.visible=false; // sürücü = sen
    yaw = near.rotation.y + Math.PI; // kamerayı aracın arkasına hizala
    carLookYaw=0; carLookPitch=0;     // bakış ofsetini sıfırla (düz ileri)
    playSnd('car_enter'); playSnd('engine');
    flash(`You stole the ${near.userData.name}! Drive with WASD.`); }
}
/** Aracın sürücüsünü dışarı çekip yere fırlatan NPC olarak spawn eder. */
function ejectDriver(car){
  car.userData.driver.visible=false;
  const ang=car.rotation.y;
  const sx=car.position.x + Math.cos(ang)*2.8;   // aracın yanına
  const sz=car.position.z - Math.sin(ang)*2.8;
  const e=makeNPC(sx, sz, 0x6a6a7a, 'Driver', ['You stole my car!','Help, thief!'], false);
  e.userData.knock=1.2;   // bir süre yerde yatar (fırlatıldı)
  e.userData.panic=6;     // sonra panikle kaçar
  crashSound();
}
function exitCar(){
  stopSnd('engine');
  if(S.car){ const c=S.car, ud=c.userData;
    ud.occupied=false; ud.ai=false; ud.spd=0; ud.abandoned=true; // araç durur, sürücüsüz
    if(ud.driver) ud.driver.visible=false;
    player.position.set(c.position.x+3, 0, c.position.z);
    // EN YAKIN uygun NPC'yi bul → araca yürüyüp binsin (yoksa birini spawn et)
    let best=null, bd=70;
    for(const n of npcs){
      const u=n.userData;
      if(u.isQuest||u.toCar||u.knock>0||u.panic>0) continue;
      const d=dist2(n.position.x,n.position.z,c.position.x,c.position.z);
      if(d<bd){ bd=d; best=n; }
    }
    if(best){ best.userData.toCar=c; }
    else { const e=makeNPC(c.position.x-3.5, c.position.z+1, 0x6a6a7a, 'Pedestrian', ['I needed this!'], false); e.userData.toCar=c; }
  }
  S.inCar=false; S.car=null; player.visible=true;
}
function tryTalk(){
  for(const n of npcs){ if(dist2(player.position.x,player.position.z,n.position.x,n.position.z)<5){ talkTo(n); return; } }
}
function talkTo(n){
  const name=n.userData.name;
  // zaten aktif bir görevin varsa
  if(S.active){
    if(MISSIONS[S.active].giver===name) showDialog(name,['Mission in progress: '+curStage().desc]);
    else showDialog(name,['Finish the job you have first, then come back.']);
    return;
  }
  // bu kişinin uygun bir sonraki görevi
  let mid=null;
  for(const k in MISSIONS){ const m=MISSIONS[k];
    if(m.giver!==name || S.missionsDone.includes(k)) continue;
    if(!m.prereq.every(p=>S.missionsDone.includes(p))) continue;
    mid=k; break;
  }
  if(mid){
    const m=MISSIONS[mid];
    showDialog(name,[...n.userData.talk, `MISSION: ${m.title} — Reward $${m.reward}. Accept?`], ()=>{
      m.stages.forEach(s=>{ s._fired=false; });   // seçim bayraklarını sıfırla
      S.active=mid; S.stageIdx=0; S.prog=0;
      setObjective(m.title+': '+m.stages[0].desc); refreshQuestMarkers(); onStageStart();
      flash('NEW MISSION: '+m.title,3); playSnd('mission_start');
    });
  } else {
    // bu kişinin görevleri tükendi / kilitli
    const anyDone=Object.keys(MISSIONS).some(k=>MISSIONS[k].giver===name && S.missionsDone.includes(k));
    showDialog(name, anyDone ? ['That\'s all for now, friend. Drop by later.'] : [n.userData.talk[0]]);
  }
}
function addWanted(n=1){ const old=S.wanted; S.wanted=Math.min(5,S.wanted+n); S.wantedTimer=12; if(S.wanted>old) playSnd('siren'); }
// öldürme sayısına göre yıldız: 3->1, 8->2, 15->3, 40->4, 60->5
function wantedFromKills(k){
  if(k>=60) return 5;
  if(k>=40) return 4;
  if(k>=15) return 3;
  if(k>=8) return 2;
  if(k>=3) return 1;
  return 0;
}
// opts: {label, silent} — araç/polis de "1 kişi" sayılır ve yıldızı etkiler
function registerKill(opts){
  opts=opts||{};
  S.kills++; S.heatKills++; if(!opts.silent) playSnd('death');   // öldürme sesi (patlamada sessiz)
  const tier=wantedFromKills(S.heatKills);                // yıldız = mevcut kovalamaca öldürmesi (toplam değil)
  if(tier>S.wanted){ S.wanted=tier; flash('★ Wanted level: '+tier,2); playSnd('siren'); }
  else flash((opts.label||'Civilian killed')+' ('+S.kills+')',1.2);
  S.wantedTimer=14; // her öldürmede polisin gelme süresi tazelenir
  gainXp(8);
  missionKill();                           // öldürme görevi ilerlet
  addPoliceSus(7);                         // suç → polis şüphesi artar
  addTrust('police',-2);                   // polis güveni düşer
  if(S.kills===5)  addNews('Panic in the city over an armed attacker.');
  if(S.kills===15) addNews('Police launch a large-scale manhunt in the streets.');
  if(S.kills===40) addNews('City declares a state of emergency — the streets are unsafe.');
}
const bulletGeo=new THREE.SphereGeometry(0.16,6,6);
const _muzzle=new THREE.Vector3();
function shoot(){
  if(S.shootCd>0) return;
  const w=curW();
  if(curAmmo()<=0){ flash(w.name+' mermisi bitti!'); return; }
  S.ammo[S.weapon]--; S.shootCd=w.cd; // ateş TEK BAŞINA aranma getirmez
  playSnd('shot_'+S.weapon);   // silaha özel ateş sesi
  // namlu parıltısı konumu (sadece görsel)
  if(S.inCar){
    const c=S.car;
    const side=new THREE.Vector3(Math.cos(c.rotation.y),0,-Math.sin(c.rotation.y));
    _muzzle.set(c.position.x+side.x*1.2, 1.3, c.position.z+side.z*1.2);
  } else {
    muzzle.getWorldPosition(_muzzle);
  }
  const mf=new THREE.Mesh(new THREE.SphereGeometry(0.14,6,6), new THREE.MeshBasicMaterial({color:0xfff0a0}));
  mf.position.copy(_muzzle); scene.add(mf); setTimeout(()=>scene.remove(mf),45);
  // MERMİ NAMLUDAN ÇIKAR, crosshair'ın işaret ettiği noktaya gider (yön = aimPoint - namlu)
  const base=new THREE.Vector3().subVectors(Aiming.aimPoint, _muzzle).normalize();
  const mat=new THREE.MeshBasicMaterial({color:w.color});
  for(let p=0;p<w.pellets;p++){
    const dir=base.clone();
    if(w.spread){ dir.x+=(Math.random()-.5)*w.spread; dir.y+=(Math.random()-.5)*w.spread; dir.z+=(Math.random()-.5)*w.spread; dir.normalize(); }
    const b=new THREE.Mesh(bulletGeo, mat);
    b.position.copy(_muzzle).add(dir.clone().multiplyScalar(0.3));
    b.userData={dir, life:1.6, speed:w.speed, dmg:w.dmg};
    scene.add(b); bullets.push(b);
  }
  // GERİ TEPME: nişangah genişlemesi + hafif dikey kamera tepmesi
  S.recoil = Math.min(40, S.recoil + (w.recoil||0));
  pitch = Math.max(-0.75, Math.min(0.85, pitch + (w.kick||0))); // geri tepme aimi yukarı iter
}
// Yumruk: önündeki en yakın düşmana yakın dövüş hasarı verir
function punch(){
  if(S.inCar||S.shootCd>0) return;
  const w=WEAPONS.fists; S.shootCd=w.cd; playSnd('punch');
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)); // baktığın yön
  // hızlı yumruk animasyonu (kolu öne savur)
  if(typeof punchArm!=='undefined'){ punchArm.visible=true; punchArm.userData.t=0.12; }
  let bestD=w.range, target=null, kind='';
  const scan=(arr,k)=>{ for(const o of arr){
    if(o.userData.isQuest || o.userData.isLeader) continue;
    const dx=o.position.x-player.position.x, dz=o.position.z-player.position.z;
    const d=Math.hypot(dx,dz); if(d>bestD) continue;
    const dot=(dx/d)*fwd.x+(dz/d)*fwd.z; if(dot<0.4) continue; // önümde mi?
    bestD=d; target=o; kind=k;
  }};
  scan(rivals,'rival'); scan(npcs,'civ'); scan(footCops,'cop'); scan(police,'car');
  if(!target){ return; }
  if(kind==='rival'){ target.userData.hp-=w.dmg; if(target.userData.hp<=0){ scene.remove(target); rivals.splice(rivals.indexOf(target),1); rivalKilled(); } }
  else if(kind==='civ'){ scene.remove(target); npcs.splice(npcs.indexOf(target),1); registerKill(); S.score+=10; }
  else if(kind==='cop'){ target.userData.hp-=w.dmg; if(target.userData.hp<=0){ scene.remove(target); footCops.splice(footCops.indexOf(target),1); S.score+=150; registerKill({label:'Cop down'}); } }
  else { target.userData.hp-=w.dmg; if(target.userData.hp<=0){ scene.remove(target); police.splice(police.indexOf(target),1); S.score+=100; registerKill({label:'Cop down'}); } }
}
// ─────────────── PATLAMA / ARAÇ HASARI / EL BOMBASI ───────────────
const grenades=[], explosions=[];
function spawnExplosion(x,y,z){
  const ball=new THREE.Mesh(new THREE.SphereGeometry(1,12,12),
    new THREE.MeshBasicMaterial({color:0xff7a22, transparent:true, opacity:0.95}));
  ball.position.set(x,y,z); ball.userData={t:0}; scene.add(ball); explosions.push(ball);
  playSnd('explosion');
}
/** Bir noktada patlama: görsel + yakın NPC/polis/araç/oyuncu hasarı (zincirleme tetikler). */
function explode(x,z,radius,dmg){
  spawnExplosion(x,0.8,z);
  for(let j=npcs.length-1;j>=0;j--){ const n=npcs[j]; if(n.userData.isQuest) continue;
    if(dist2(x,z,n.position.x,n.position.z)<radius){ scene.remove(n); npcs.splice(j,1); registerKill(); S.score+=10; } }
  for(let j=footCops.length-1;j>=0;j--){ const cp=footCops[j];
    if(dist2(x,z,cp.position.x,cp.position.z)<radius){ scene.remove(cp); footCops.splice(j,1); S.score+=150; registerKill({label:'Cop down', silent:true}); } }
  for(let j=police.length-1;j>=0;j--){ const c=police[j];
    if(c.userData.dead) continue; if(dist2(x,z,c.position.x,c.position.z)<radius) damageCar(c,300); }
  for(let j=cars.length-1;j>=0;j--){ const c=cars[j];
    if(c.userData.dead||c===S.car) continue; if(dist2(x,z,c.position.x,c.position.z)<radius) damageCar(c,300); }
  // oyuncu hasarı (mesafeye göre)
  const pp=S.inCar?S.car.position:player.position;
  const pd=dist2(x,z,pp.x,pp.z);
  if(pd<radius) takeDamage(Math.max(8,Math.round(dmg*(1-pd/radius))));
}
/** Araca hasar ver; canı biterse patlat ve kaldır. */
function damageCar(car,amount){
  const ud=car.userData; if(ud.dead) return;
  ud.hp=(ud.hp!=null?ud.hp:120)-amount;
  if(ud.hp<=0){
    ud.dead=true;
    const wasPlayerCar = (S.inCar && S.car===car);
    explode(car.position.x, car.position.z, 7, 120);
    if(wasPlayerCar){ exitCar(); takeDamage(40); }
    scene.remove(car);
    const ai=cars.indexOf(car); if(ai>=0) cars.splice(ai,1);
    const pi=police.indexOf(car); if(pi>=0) police.splice(pi,1);
    S.score+=80;
    if(ud.isLeaderCar) leaderCarDestroyed();   // m09: lider aracı yok → havaya uçuş sinematiği
    else if(!wasPlayerCar) registerKill({label: ud.isPolice?'Cop down':'Vehicle destroyed', silent:true});  // araç = 1 kişi → yıldızı etkiler
  }
}
/** El bombası fırlat (kavisli atış, fitil sonunda patlar). */
function throwGrenade(){
  if(S.shootCd>0) return;
  if(S.ammo.grenade<=0){ flash('No grenades!'); return; }
  S.ammo.grenade--; S.shootCd=1.0;
  const o=S.inCar?S.car.position:player.position;
  const dir=new THREE.Vector3().subVectors(Aiming.aimPoint, o).setY(0).normalize();
  const g=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8), new THREE.MeshLambertMaterial({color:0x44551f}));
  g.position.set(o.x+dir.x*1.5, 1.6, o.z+dir.z*1.5);
  g.userData={vx:dir.x*22, vy:9, vz:dir.z*22, fuse:1.6};
  scene.add(g); grenades.push(g);
  playSnd('grenade');
}
function updateGrenades(dt){
  for(let i=grenades.length-1;i>=0;i--){ const g=grenades[i], u=g.userData;
    u.vy-=26*dt;
    g.position.x+=u.vx*dt; g.position.y+=u.vy*dt; g.position.z+=u.vz*dt;
    if(g.position.y<=0.3){ g.position.y=0.3; u.vy*=-0.4; u.vx*=0.6; u.vz*=0.6; }
    g.rotation.x+=8*dt; u.fuse-=dt;
    if(u.fuse<=0){ explode(g.position.x, g.position.z, WEAPONS.grenade.radius, WEAPONS.grenade.dmg); scene.remove(g); grenades.splice(i,1); }
  }
}
function updateExplosions(dt){
  for(let i=explosions.length-1;i>=0;i--){ const e=explosions[i]; e.userData.t+=dt;
    const s=1+e.userData.t*20; e.scale.set(s,s,s);
    e.material.opacity=Math.max(0,0.95-e.userData.t*2.4);
    if(e.userData.t>0.42){ scene.remove(e); explosions.splice(i,1); }
  }
}

// ─────────────── XP / SEVİYE ───────────────
function gainXp(n){
  S.xp+=n;
  const need=S.level*120;
  if(S.xp>=need){ S.xp-=need; S.level++; S.maxHp+=10; S.hp=S.maxHp; S.maxStamina+=10; S.stamina=S.maxStamina;
    flash('🆙 Level '+S.level+'! HP & stamina increased',3); playSnd('levelup'); }
}

// ─────────────── YAĞMUR ───────────────
const RAIN_N=1400, rainGeo=new THREE.BufferGeometry(), rainArr=new Float32Array(RAIN_N*3);
for(let i=0;i<RAIN_N;i++){ rainArr[i*3]=(Math.random()-.5)*130; rainArr[i*3+1]=Math.random()*60; rainArr[i*3+2]=(Math.random()-.5)*130; }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr,3));
const rain=new THREE.Points(rainGeo, new THREE.PointsMaterial({color:0x9ab8d8, size:0.35, transparent:true, opacity:0.55}));
rain.visible=false; scene.add(rain);
function updateRain(dt){
  if(!S.raining){ if(rain.visible) rain.visible=false; return; }
  rain.visible=true;
  const pp=S.inCar&&S.car?S.car.position:player.position;
  rain.position.set(pp.x,0,pp.z);
  const a=rainGeo.attributes.position.array;
  for(let i=0;i<RAIN_N;i++){ a[i*3+1]-=55*dt; if(a[i*3+1]<0){ a[i*3+1]=60; } }
  rainGeo.attributes.position.needsUpdate=true;
}

// ─────────────── KAYIT / YÜKLEME ───────────────
function saveGame(){
  try{ localStorage.setItem('cityrush_save', JSON.stringify({
    money:S.money, score:S.score, kills:S.kills, maxHp:S.maxHp, hp:S.hp,
    level:S.level, xp:S.xp, maxStamina:S.maxStamina, weapon:S.weapon,
    ammo:S.ammo, missionsDone:S.missionsDone, px:player.position.x, pz:player.position.z,
    trust:S.trust, policeSus:S.policeSus, gangSus:S.gangSus, news:S.news, clock:S.clock,
    districts:districts.map(d=>({owner:d.owner,members:d.members})),
    story:S.story, messages:S.messages, objective:S.objective, chapter:S.chapter
  })); }catch(e){}
}
function hasSave(){ try{ return !!localStorage.getItem('cityrush_save'); }catch(e){ return false; } }
function loadSave(){
  try{ const raw=localStorage.getItem('cityrush_save'); if(!raw) return false;
    const d=JSON.parse(raw);
    S.money=d.money??500; S.score=d.score??0; S.kills=d.kills??0;
    S.maxHp=d.maxHp??100; S.hp=d.hp??S.maxHp; S.level=d.level??1; S.xp=d.xp??0;
    S.maxStamina=d.maxStamina??100; S.stamina=S.maxStamina;
    if(d.weapon&&WEAPONS[d.weapon]) S.weapon=d.weapon;
    if(d.ammo) Object.assign(S.ammo,d.ammo);
    if(Array.isArray(d.missionsDone)) S.missionsDone=d.missionsDone;
    if(d.px!=null){ player.position.set(d.px,0,d.pz); }
    if(d.trust) Object.assign(S.trust,d.trust);
    if(d.policeSus!=null) S.policeSus=d.policeSus;
    if(d.gangSus!=null) S.gangSus=d.gangSus;
    if(Array.isArray(d.news)) S.news=d.news;
    if(d.clock!=null){ S.clock=d.clock; S.day=Math.floor(S.clock/1680)+1; }
    if(Array.isArray(d.districts)){ d.districts.forEach((sd,i)=>{ if(districts[i]){ districts[i].owner=sd.owner; districts[i].members=sd.members; refreshDistrictVisual(districts[i]); } }); }
    if(d.story) Object.assign(S.story,d.story);
    if(Array.isArray(d.messages)) S.messages=d.messages;
    if(d.objective!=null) S.objective=d.objective;
    if(d.chapter!=null) S.chapter=d.chapter;
    // depo işareti kayıttan geri
    const showWH=!!S.story.warehouseActive; warehouseMarker.visible=showWH; warehouseBeam.visible=showWH;
    gun.visible=!WEAPONS[S.weapon].melee;
    refreshQuestMarkers();
    { const st=S.active?curStage():null;
      if(st && st.type==='huntTargets' && st.target) spawnRivals(Math.max(1,st.count-(S.prog||0)), st.target[0], st.target[1]);
      else if(st && st.type==='ambush'){ clearLeader(); spawnRivals(Math.max(1,st.count-(S.prog||0)), AMBUSH[0], AMBUSH[1]); leaderFig=makeLeader(AMBUSH[0]+4, AMBUSH[1]-4); }
      else if(st && st.type==='chase'){ S.stageIdx=0; S.prog=0; clearLeader(); spawnAmbush(); setObjective('Go to the harbor — stop the attackers'); } }
    return true;
  }catch(e){ return false; }
}

let _hurtCd=0;
function takeDamage(d){ S.hp-=d; if(_hurtCd<=0){ playSnd('hurt'); _hurtCd=0.4; } if(S.hp<=0){ S.hp=0; die(); } }
function die(){
  S.deadTimer=2; S.money=Math.max(0,S.money-200); S.wanted=0; S.heatKills=0;   // yeniden başla → yıldız sıfır
  for(const c of police) scene.remove(c); police.length=0;                       // polisleri temizle
  for(const c of footCops) scene.remove(c); footCops.length=0;
  flash('Busted! You lost $200.',2);
  if(S.inCar)exitCar(); player.position.set(3,0,3); S.hp=S.maxHp;
}

// ─────────────── MENÜ / DURUM ───────────────
function startGame(){
  S.mode='play';
  document.getElementById('menu').style.display='none';
  document.getElementById('crosshair').style.display='block';
  canvas.requestPointerLock?.();
  setMusic(null);   // oyun içinde sürekli müzik YOK (sadece menüde)
  flash('Welcome to the city! Talk to people with yellow cone markers using [E].',4);
}
function newGame(){
  try{ localStorage.removeItem('cityrush_save'); }catch(e){}
  document.getElementById('menu').style.display='none';
  // önce 3D AÇILIŞ SİNEMATİĞİ, sonra oyun
  playMovie(OPENING_SHOTS, ()=>{
    S.story.opened=true;
    setObjective('Talk to Marco, take your first job (yellow cone marker)');
    sendStoryMsg('Marco','Welcome. Jobs await you in the city — find me.');
    startGame();
  });
}
function continueGame(){ loadSave(); startGame(); flash('Save loaded · Level '+S.level,3); }
function pauseGame(){ S.mode='paused'; document.getElementById('pause').style.display='flex'; document.exitPointerLock?.(); saveGame(); }
function resume(){ S.mode='play'; document.getElementById('pause').style.display='none'; canvas.requestPointerLock?.(); }
function toMenu(){ S.mode='menu'; document.getElementById('pause').style.display='none';
  document.getElementById('menu').style.display='flex'; document.getElementById('crosshair').style.display='none';
  for(const n in SOUNDS) if(SOUNDS[n].loop && !SOUNDS[n].music) stopSnd(n);   // motor/siren/yağmur sus
  setMusic('music_menu'); }

document.getElementById('btnStart').onclick=newGame;
{ const bc=document.getElementById('btnContinue');
  if(hasSave()) bc.style.display='block';
  bc.onclick=continueGame; }
document.getElementById('btnHelp').onclick=()=>alert('WASD: Move / Drive\nShift: Sprint (stamina)\nSpace: Jump\nMouse: Look around\nLeft Click: Fire / Punch / Throw grenade\nRight Click: Shoulder aim — scope on AWP\nQ: Weapon wheel (select with 1-7)\nF: Enter / exit vehicle (in car, left click = drive-by shooting)\nE: Talk, take missions · B: Shop\nR: Toggle rain · N: Toggle sound\nESC: Pause (auto-saves)\n\nWeapons: Fists, Pistol, Uzi, Shotgun, AK-47, AWP, Grenade\nShoot vehicles enough and they EXPLODE. Leveling up boosts HP/stamina.\nYour progress saves automatically — use "Continue" from the menu.');
document.getElementById('btnResume').onclick=resume;
document.getElementById('btnQuit').onclick=toMenu;

// ─────────────── AYARLAR ───────────────
const SETTINGS={ sens:1.0 };
function openSettings(){ document.getElementById('settings').style.display='flex'; document.exitPointerLock?.();
  const vol=document.getElementById('setVol'), volV=document.getElementById('setVolV');
  const mute=document.getElementById('setMute'), sens=document.getElementById('setSens'), sensV=document.getElementById('setSensV'), music=document.getElementById('setMusic');
  vol.value=Math.round(AUDIO.master*100); volV.textContent=vol.value+'%';
  mute.checked=AUDIO.muted; sens.value=Math.round(SETTINGS.sens*100); sensV.textContent=(SETTINGS.sens).toFixed(2)+'x';
  music.checked=!AUDIO.musicOff;
}
function closeSettings(){ document.getElementById('settings').style.display='none'; if(S.mode==='play') canvas.requestPointerLock?.(); }
{ const vol=document.getElementById('setVol'), volV=document.getElementById('setVolV');
  vol.addEventListener('input',()=>{ AUDIO.master=vol.value/100; volV.textContent=vol.value+'%'; });
  const mute=document.getElementById('setMute');
  mute.addEventListener('change',()=>{ AUDIO.muted=mute.checked; if(AUDIO.muted){ for(const n in SOUNDS) if(SOUNDS[n].loop) stopSnd(n); } });
  const sens=document.getElementById('setSens'), sensV=document.getElementById('setSensV');
  sens.addEventListener('input',()=>{ SETTINGS.sens=sens.value/100; sensV.textContent=SETTINGS.sens.toFixed(2)+'x'; });
  const music=document.getElementById('setMusic');
  music.addEventListener('change',()=>{ AUDIO.musicOff=!music.checked; if(AUDIO.musicOff){ for(const n in SOUNDS) if(SOUNDS[n].music) stopSnd(n); } else { setMusic(S.mode==='menu'?'music_menu':null); } });
}
document.getElementById('btnSettings').onclick=openSettings;
document.getElementById('btnSettings2').onclick=openSettings;
document.getElementById('btnSetClose').onclick=closeSettings;

// ─────────────── MİNİ HARİTA ───────────────
const mini=document.getElementById('mini'), mctx=mini.getContext('2d');
function drawMini(){
  mctx.fillStyle='#11131f'; mctx.fillRect(0,0,170,170);
  const sc=170/WORLD, ox=85, oz=85;
  // bölge sahiplik renkleri (altta)
  for(const d of districts){
    mctx.fillStyle = d.owner==='mine'?'rgba(46,204,113,.18)':(d.owner==='rival'?'rgba(200,50,50,.16)':'rgba(140,140,140,.08)');
    mctx.fillRect(ox+(d.x-d.span/2)*sc, oz+(d.z-d.span/2)*sc, d.span*sc, d.span*sc);
  }
  // yollar
  mctx.strokeStyle='#33343c'; mctx.lineWidth=2;
  for(let g=-HALF;g<=HALF;g+=BLOCK){
    mctx.beginPath();mctx.moveTo(ox+g*sc,0);mctx.lineTo(ox+g*sc,170);mctx.stroke();
    mctx.beginPath();mctx.moveTo(0,oz+g*sc);mctx.lineTo(170,oz+g*sc);mctx.stroke();
  }
  // pickup
  mctx.fillStyle='#ffd24a';
  for(const p of pickups) mctx.fillRect(ox+p.position.x*sc-1,oz+p.position.z*sc-1,2,2);
  // görev verenler (uygun görevi olanlar sarı daire)
  mctx.fillStyle='#ffd24a';
  for(const q of questDefs){ if(hasAvailableMission(q.name)){ mctx.beginPath(); mctx.arc(ox+q.pos[0]*sc,oz+q.pos[1]*sc,3,0,7); mctx.fill(); } }
  // aktif görev hedefi (yanıp sönen sarı kare)
  if(missionMarker.visible && (performance.now()%700<450)){ const mx2=Math.max(3,Math.min(167,ox+missionMarker.position.x*sc)), my2=Math.max(3,Math.min(167,oz+missionMarker.position.z*sc)); mctx.fillStyle='#ffe66a'; mctx.fillRect(mx2-3,my2-3,6,6); }
  // polis arabaları
  mctx.fillStyle='#ff3030';
  for(const c of police) mctx.fillRect(ox+c.position.x*sc-2,oz+c.position.z*sc-2,4,4);
  // yaya polisler
  mctx.fillStyle='#ff8030';
  for(const c of footCops) mctx.fillRect(ox+c.position.x*sc-1.5,oz+c.position.z*sc-1.5,3,3);
  // rakip hedefler (görev) — kırmızı
  mctx.fillStyle='#ff2a2a';
  for(const r of rivals) mctx.fillRect(ox+r.position.x*sc-2,oz+r.position.z*sc-2,4,4);
  // kaçan lider aracı — büyük yanıp sönen kırmızı
  if(leaderCar && (performance.now()%600<380)){ mctx.fillStyle='#ff0000';
    const lx=Math.max(3,Math.min(167,ox+leaderCar.position.x*sc)), ly=Math.max(3,Math.min(167,oz+leaderCar.position.z*sc));
    mctx.fillRect(lx-4,ly-4,8,8); }
  // trafik araçları (beyaz noktalar)
  mctx.fillStyle='#d8e0ff';
  for(const c of cars){ if(c.userData.ai && !c.userData.occupied) mctx.fillRect(ox+c.position.x*sc-1.5,oz+c.position.z*sc-1.5,3,3); }
  // dükkan
  mctx.fillStyle='#30e070'; mctx.fillRect(ox+SHOP[0]*sc-2,oz+SHOP[1]*sc-2,4,4);
  // liman (mavi) — kenara sabitlenir (harita dışına taşar)
  { const hx=Math.max(3,Math.min(167,ox+HARBOR[0]*sc)), hy=Math.max(3,Math.min(167,oz+HARBOR[1]*sc));
    mctx.fillStyle='#3aa0ff'; mctx.fillRect(hx-3,hy-3,6,6); }
  // hikâye depo işareti (beyaz, aktifken yanıp söner) — limanda
  if(warehouseMarker.visible && (performance.now()%600<400)){
    const wx=Math.max(3,Math.min(167,ox+WH[0]*sc)), wy=Math.max(3,Math.min(167,oz+WH[1]*sc));
    mctx.fillStyle='#ffffff'; mctx.fillRect(wx-3,wy-3,6,6); }
  // oyuncu
  const pp=S.inCar?S.car.position:player.position;
  mctx.fillStyle='#00d2ff'; mctx.beginPath(); mctx.arc(ox+pp.x*sc,oz+pp.z*sc,4,0,7); mctx.fill();
}

// ─────────────── ANA DÖNGÜ ───────────────
const clock=new THREE.Clock();
const tmpV=new THREE.Vector3();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05);
  if(director.active){ updateDirector(dt); renderer.render(scene,camera); return; } // 3D sinematik

  if(S.mode==='play' && !dlg.active && !shop.active && !wheel.active && !phone.active && !cine.active){
    update(dt);
  }
  // kamera her zaman güncellensin
  updateCamera();
  renderer.render(scene,camera);
  if(S.mode!=='menu') drawMini();
}

function updateCamera(){
  const tgt = S.inCar && S.car ? S.car.position : player.position;
  const scoped = S.scoped && !S.inCar;
  const ads = S.ads && !S.inCar && !scoped;     // omuz nişanı
  if(!S.inCar) player.visible = !scoped;        // dürbünde gövdeyi gizle
  // FOV: dürbün > omuz nişanı > normal
  const fovT = scoped ? 20 : (ads ? 50 : 65);
  camera.fov += (fovT-camera.fov)*0.4; camera.updateProjectionMatrix();
  const dist  = scoped ? 0.6 : (ads ? 4.5 : CAM_DIST);
  const headY = scoped ? 2.0 : (ads ? 2.4 : 2.4);   // bakış (kafa/omuz) yüksekliği
  // ARAÇTA: kamera aracın arkasından düz ileri bakar; fare ile sağa-sola bakılır,
  // fare durunca (≈140 ms) yumuşakça düz ileri konuma geri döner.
  let effYaw=yaw, effPitch=pitch;
  if(S.inCar && S.car){
    // fare durunca yumuşakça dinlenme konumuna dön (eski kameranın hafif yukarıdan açısı)
    if(performance.now()-carLookLast>140){ carLookYaw*=0.88; carLookPitch*=0.88; }
    effYaw   = S.car.rotation.y + Math.PI + carLookYaw;
    effPitch = -0.24 + carLookPitch;   // biraz daha yüksek + hafif aşağı bakış
  }
  // SERBEST BAKIŞ YÖNÜ: yaw yatay, pitch dikey (pitch>0 = yukarı bak)
  const cp=Math.cos(effPitch), sp=Math.sin(effPitch);
  const dir=new THREE.Vector3(-Math.sin(effYaw)*cp, sp, -Math.cos(effYaw)*cp);
  // sağ omuz ofseti (ADS/dürbünde kamera sağ omza kayar)
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const sh = (ads||scoped) ? 1.2 : 0;
  // çapa = hedefin kafa hizası + omuz ofseti
  const ax = tgt.x + rx*sh, ay = tgt.y + headY, az = tgt.z + rz*sh;
  // kamera çapanın ARKASINDA (bakış yönünün tersine dist) — yere batmasın diye taban yükseklik
  const camY = Math.max(tgt.y + 0.6, ay - dir.y*dist);
  camera.position.set(ax - dir.x*dist, camY, az - dir.z*dist);
  camera.lookAt(ax + dir.x*10, ay + dir.y*10, az + dir.z*10);
  // arayüz: dürbün overlay'i + nişangah görünürlüğü (yumruk/dürbünde gizli)
  document.getElementById('scope').style.display = scoped ? 'block' : 'none';
  const showCH = (S.mode==='play' && !scoped && !curW().melee);
  document.getElementById('crosshair').style.display = showCH ? 'block' : 'none';
}

function update(dt){
  // ── NİŞAN RAYCAST ── (crosshair hedefini her kare çöz)
  Aiming.update();

  // ── TARAMA (otomatik) ATEŞ: sol tık basılıyken ve mod 'auto' ise sürekli ateş ──
  if(mouseHeld){ const w=curW(); if(!w.melee && !w.thrown && curMode()==='auto') shoot(); }

  // ── HAREKET ──
  if(S.deadTimer>0){ S.deadTimer-=dt; }
  else if(S.inCar){
    const c=S.car, ud=c.userData;
    let acc=0; if(keys['w'])acc=1; else if(keys['s'])acc=-0.6;
    ud.spd += (acc*ud.maxSpd - ud.spd)*dt*2.2;
    let turn=0; if(keys['a'])turn=1; else if(keys['d'])turn=-1;
    if(Math.abs(ud.spd)>1) c.rotation.y += turn*1.6*dt*(ud.spd/ud.maxSpd);
    // ön tekerlek direksiyonu (A/D ile sağa/sola döner, bırakınca düzelir)
    ud.steer += (turn*0.5 - ud.steer)*Math.min(1,dt*8);
    if(ud.steerWheels) for(const p of ud.steerWheels) p.rotation.y=ud.steer;
    const fwd=new THREE.Vector3(Math.sin(c.rotation.y),0,Math.cos(c.rotation.y));
    const nx=c.position.x+fwd.x*ud.spd*dt, nz=c.position.z+fwd.z*ud.spd*dt;
    if(!blockedAt(nx,nz,1.2)){ c.position.x=nx; c.position.z=nz; } else ud.spd*=-0.3;
    clampWorld(c.position);

    // ── NPC EZME → aranma artar ──
    if(Math.abs(ud.spd)>6){
      for(let i=npcs.length-1;i>=0;i--){ const n=npcs[i];
        if(n.userData.isQuest) continue;
        if(dist2(c.position.x,c.position.z,n.position.x,n.position.z)<2.7){
          scene.remove(n); npcs.splice(i,1); registerKill(); S.score+=10; crashSound();
        }
      }
    }
    // ── ARAÇ-ARAÇ ÇARPIŞMA (trafik aracını it + korna) ──
    for(const o of cars){
      if(o===c || o.userData.occupied) continue;
      const d=dist2(c.position.x,c.position.z,o.position.x,o.position.z);
      if(d<3.8){
        const ang=Math.atan2(o.position.x-c.position.x, o.position.z-c.position.z);
        const push=(3.8-d);
        o.position.x+=Math.sin(ang)*push; o.position.z+=Math.cos(ang)*push;
        if(Math.abs(ud.spd)>10){ crashSound(); }
        ud.spd*=0.6;
      }
    }

    // kamerayı aracın ARKASINA al (180° kaydır), açı sarmasını en kısa yoldan takip et
    let tYaw = c.rotation.y + Math.PI;
    let diff = ((tYaw - yaw + Math.PI) % (Math.PI*2)) - Math.PI;
    yaw += diff*dt*3;
  } else {
    const aiming = S.ads || S.scoped;          // nişan alıyor muyuz?
    let mx=0,mz=0;
    // kamera yönüne göre hareket
    const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    if(keys['w']){mx+=fwd.x;mz+=fwd.z;} if(keys['s']){mx-=fwd.x;mz-=fwd.z;}
    if(keys['d']){mx+=right.x;mz+=right.z;} if(keys['a']){mx-=right.x;mz-=right.z;}
    const len=Math.hypot(mx,mz);
    // ── KOŞMA + STAMINA ── (Shift ile koş, nişan alırken koşamaz)
    const movingNow = len>0;
    S.sprinting = (keys['shift']||keys['shiftleft']) && movingNow && S.stamina>0 && !aiming;
    if(S.sprinting){ S.stamina=Math.max(0, S.stamina-28*dt); }
    else { S.stamina=Math.min(S.maxStamina, S.stamina + (movingNow?9:20)*dt); }
    const sp = S.sprinting ? 14 : 8;
    if(len>0){ mx/=len;mz/=len;
      slideMove(player, mx*sp*dt, mz*sp*dt, 0.7);   // duvara takılmaz, boyunca kayar
      if(!aiming) player.rotation.y=Math.atan2(mx,mz); // serbestçe yürüdüğü yöne bakar
      clampWorld(player.position);
    }
    // NİŞAN ALIRKEN: gövde her zaman kameranın baktığı yöne döner (mouse ile birlikte)
    if(aiming) player.rotation.y = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
    // ── ZIPLAMA / YERÇEKİMİ ──
    player.position.y += S.vy*dt;
    S.vy -= 26*dt;                                   // yerçekimi
    if(player.position.y <= 0){ player.position.y = 0; S.vy = 0; S.onGround = true; }
  }

  // ── ARANMA ──
  if(S.wanted>0){
    S.wantedTimer-=dt;
    if(S.wantedTimer<=0){ S.wanted=Math.max(0,S.wanted-1); S.wantedTimer=12; if(S.wanted===0) S.heatKills=0; }   // temizlendi → sıfırdan başla
    if(police.length<S.wanted*2 && Math.random()<0.025){
      const tgt=S.inCar?S.car.position:player.position;
      const st=nearestStation(tgt.x,tgt.z);           // en yakın karakoldan çıkar
      makePolice(st[0]+(Math.random()-.5)*6, st[1]+10+(Math.random()-.5)*4);  // giriş önünde
    }
  }

  const ptgt = S.inCar?S.car.position:player.position;

  // ── TRAFİK IŞIKLARI & NPC araçlar ──
  updateTrafficLights(dt);
  updateTraffic(dt);

  // ── EL BOMBASI / PATLAMA / YAĞMUR / DÜNYA / OTOMATİK KAYIT ──
  updateGrenades(dt);
  updateExplosions(dt);
  updateRain(dt);
  updateWorld(dt);
  // HİKÂYE: depoya ulaşma → polis olduğun ortaya çıkar
  if(S.story.warehouseActive && !S.story.cop){
    const pp=S.inCar&&S.car?S.car.position:player.position;
    if(dist2(pp.x,pp.z,WH[0],WH[1])<6){
      S.story.warehouseActive=false; warehouseMarker.visible=false; warehouseBeam.visible=false;
      playMovie(COP_REVEAL_SHOTS, ()=>{ S.chapter=2; addTrust('police',20);
        setObjective('Rise in the gang: work with Rosa and Viper'); saveGame(); });
    }
  }
  S.saveT+=dt; if(S.saveT>10){ S.saveT=0; saveGame(); }

  // ── POLİS ARABASI AI ── (mesafede durur, polisi indirir)
  for(let i=police.length-1;i>=0;i--){
    const c=police[i], ud=c.userData;
    if(ud.light) ud.light.material.color.setHex((performance.now()%400<200)?0xff2222:0x2244ff);
    const d=dist2(c.position.x,c.position.z,ptgt.x,ptgt.z);
    if(S.wanted>0 && !ud.deployed){          // polisi indirene kadar kovalar; sonra park eder (boş araba hareket etmez)
      if(d>CAR_STANDOFF){
        gridChase(c, ptgt.x, ptgt.z, dt, 18);   // yol ızgarasında oyuncuya doğru sür
      } else {
        // arabadan polis indir (aranma kadar, max 2 per araba)
        const n=Math.min(2, Math.max(1, S.wanted-1));
        for(let k=0;k<n;k++){
          const fc=makeFootCop(c.position.x + (Math.random()-.5)*4, c.position.z + (Math.random()-.5)*4);
          fc.userData.car=c;   // bu polis bu arabadan indi (kaçınca geri biner)
        }
        ud.deployed=true;
        if(ud.driver) ud.driver.visible=false;   // sürücü indi → araba boş görünsün
      }
    }
    if(S.wanted===0){ scene.remove(c); police.splice(i,1); }
  }

  // ── YAYA POLİS AI ── (mesafe bırakır, ateş eder)
  for(let i=footCops.length-1;i>=0;i--){
    const cop=footCops[i], ud=cop.userData;
    const d=dist2(cop.position.x,cop.position.z,ptgt.x,ptgt.z);
    // OYUNCU ARAÇLA KAÇIYOR → polis arabasına geri koş ve bin (araç tekrar kovalar)
    if(S.inCar && ud.car && ud.car.parent && police.includes(ud.car)){
      const car=ud.car, dxc=car.position.x-cop.position.x, dzc=car.position.z-cop.position.z, dc=Math.hypot(dxc,dzc);
      if(dc<3.2){ // arabaya bindi
        scene.remove(cop); footCops.splice(i,1);
        car.userData.deployed=false;                          // araç yeniden kovalar
        if(car.userData.driver) car.userData.driver.visible=true;
        continue;
      }
      cop.rotation.y=Math.atan2(dxc,dzc);
      slideMove(cop, dxc/dc*6.5*dt, dzc/dc*6.5*dt, 0.6);
      clampWorld(cop.position);
      continue;   // kaçış sırasında ateş/yaklaşma yapma, arabaya odaklan
    }
    const ang=Math.atan2(ptgt.x-cop.position.x, ptgt.z-cop.position.z);
    cop.rotation.y=ang;
    const fwd=new THREE.Vector3(Math.sin(ang),0,Math.cos(ang));
    if(d>FOOT_STANDOFF+1){             // uzaksa yaklaş (engeli dolaş)
      const moved=slideMove(cop, fwd.x*6*dt, fwd.z*6*dt, 0.6);
      if(!moved){ if(!ud.detour) ud.detour=Math.random()<0.5?1:-1;
        slideMove(cop, -fwd.z*ud.detour*6*dt, fwd.x*ud.detour*6*dt, 0.6); }
      else ud.detour=0;
    } else if(d<FOOT_STANDOFF-1){      // çok yakınsa geri çekil (yapışmaz)
      slideMove(cop, -fwd.x*4*dt, -fwd.z*4*dt, 0.6);
    }
    // mesafedeyken ateş et
    ud.shootCd-=dt;
    if(d<45 && ud.shootCd<=0){
      takeDamage(5); ud.shootCd=1.6;
      // namlu ateşi efekti
      const flash3d=new THREE.Mesh(new THREE.SphereGeometry(0.25,6,6), new THREE.MeshBasicMaterial({color:0xffdd55}));
      flash3d.position.copy(cop.position).add(new THREE.Vector3(0,1.4,0)).add(fwd.clone().multiplyScalar(0.6));
      scene.add(flash3d); setTimeout(()=>scene.remove(flash3d),60);
    }
    clampWorld(cop.position);
    if(S.wanted===0){ scene.remove(cop); footCops.splice(i,1); }
  }

  // ── NPC AI ──
  for(let ni=npcs.length-1; ni>=0; ni--){
    const n=npcs[ni];
    const ud=n.userData;
    // SÜRÜCÜ ARACA YÜRÜYOR: terk edilen araca gidip biniyor
    if(ud.toCar){
      const car=ud.toCar;
      if(!car.parent || car.userData.occupied || car.userData.ai){ ud.toCar=null; } // araç gitti/doldu → vazgeç
      else {
        const dx=car.position.x-n.position.x, dz=car.position.z-n.position.z;
        const dd=Math.hypot(dx,dz);
        if(dd<2.6){ // araca bindi → araç tekrar trafiğe katılır
          car.userData.abandoned=false;
          if(car.userData.driver) car.userData.driver.visible=true;
          initTraffic(car);
          scene.remove(n); npcs.splice(ni,1);
          continue;
        }
        n.position.x+=dx/dd*3.6*dt; n.position.z+=dz/dd*3.6*dt;
        n.rotation.y=Math.atan2(dx,dz); clampWorld(n.position);
        continue;
      }
    }
    // GÖREV VERENLER sabit durur (yoksa "X'e dön" hedefinden uzaklaşırlar)
    if(ud.isQuest){
      if(ud.marker){ ud.marker.rotation.y+=2*dt; ud.marker.position.y=3+Math.sin(performance.now()*0.004)*0.3; }
      continue;
    }
    const d=dist2(n.position.x,n.position.z,ptgt.x,ptgt.z);
    // FIRLATILAN SÜRÜCÜ: önce yerde yatar (knock), sonra panikle kaçar (panic)
    if(ud.knock>0){
      ud.knock-=dt;
      n.rotation.x=-Math.PI/2.2;          // yere düşmüş (yatık)
      n.position.y=0.4;
      if(ud.knock<=0){ n.rotation.x=0; n.position.y=0; }  // ayağa kalk
      clampWorld(n.position);
      continue;                            // yatarken hareket etmez
    }
    if(ud.panic>0 || (S.wanted>=2 && d<25)){
      if(ud.panic>0) ud.panic-=dt;
      tmpV.set(n.position.x-ptgt.x,0,n.position.z-ptgt.z).normalize();
      n.position.x+=tmpV.x*6*dt; n.position.z+=tmpV.z*6*dt;
      n.rotation.y=Math.atan2(tmpV.x,tmpV.z);
    } else {
      ud.wt-=dt; if(ud.wt<=0){ ud.dir.set(Math.random()-.5,0,Math.random()-.5).normalize(); ud.wt=1+Math.random()*2; }
      const nx=n.position.x+ud.dir.x*1.6*dt, nz=n.position.z+ud.dir.z*1.6*dt;
      if(!blockedAt(nx,nz,0.8)){ n.position.x=nx; n.position.z=nz; } else ud.wt=0;
      n.rotation.y=Math.atan2(ud.dir.x,ud.dir.z);
    }
    if(ud.marker) ud.marker.rotation.y+=2*dt, ud.marker.position.y=3+Math.sin(performance.now()*0.004)*0.3;
    clampWorld(n.position);
  }

  // ── RAKİP HEDEFLER AI (gezer, yaklaşınca ateş eder) ──
  for(let i=rivals.length-1;i>=0;i--){ const r=rivals[i], ud=r.userData;
    const d=dist2(r.position.x,r.position.z,ptgt.x,ptgt.z);
    if(d<32){
      const ang=Math.atan2(ptgt.x-r.position.x, ptgt.z-r.position.z); r.rotation.y=ang;
      if(d>8){ slideMove(r, Math.sin(ang)*3.2*dt, Math.cos(ang)*3.2*dt, 0.6); }
      ud.shootCd-=dt; if(ud.shootCd<=0){ takeDamage(4); ud.shootCd=1.9;
        const f=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,6),new THREE.MeshBasicMaterial({color:0xffdd55})); f.position.set(r.position.x+Math.sin(ang)*0.6,1.4,r.position.z+Math.cos(ang)*0.6); scene.add(f); setTimeout(()=>scene.remove(f),50); }
    } else {
      ud.wt-=dt; if(ud.wt<=0){ ud.dir.set(Math.random()-.5,0,Math.random()-.5).normalize(); ud.wt=1+Math.random()*2; }
      const nx=r.position.x+ud.dir.x*1.8*dt, nz=r.position.z+ud.dir.z*1.8*dt;
      if(!blockedAt(nx,nz,0.8)){ r.position.x=nx; r.position.z=nz; } else ud.wt=0;
      r.rotation.y=Math.atan2(ud.dir.x,ud.dir.z);
    }
    if(ud.marker){ ud.marker.rotation.y+=2.5*dt; ud.marker.position.y=3+Math.sin(performance.now()*0.005)*0.25; }
    clampWorld(r.position);
  }

  // ── MERMİLER ──
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.position.addScaledVector(b.userData.dir, (b.userData.speed||50)*dt);
    b.userData.life-=dt;
    const dmg=b.userData.dmg||25;
    let hit=false;
    // 0) RAKİP HEDEFLER → görev ilerler (aranma getirmez)
    for(let j=rivals.length-1;j>=0;j--){ const r=rivals[j];
      if(r.userData.isLeader) continue;   // lider pusuda vurulamaz (arabayla kaçacak)
      if(dist2(b.position.x,b.position.z,r.position.x,r.position.z)<1.7 && b.position.y<3){
        r.userData.hp-=dmg; hit=true; if(r.userData.hp<=0){ scene.remove(r); rivals.splice(j,1); rivalKilled(); } break; }
    }
    // 1) sivilleri vur (görev verenler hariç) → öldürme sayılır, aranma artar
    if(!hit) for(let j=npcs.length-1;j>=0;j--){
      const n=npcs[j];
      if(n.userData.isQuest) continue;           // görev verenler vurulamaz
      if(dist2(b.position.x,b.position.z,n.position.x,n.position.z)<1.6 && b.position.y<3){
        scene.remove(n); npcs.splice(j,1); registerKill(); S.score+=10; hit=true; break;
      }
    }
    // 2) yaya polisleri vur
    if(!hit) for(let j=footCops.length-1;j>=0;j--){
      const cop=footCops[j];
      if(dist2(b.position.x,b.position.z,cop.position.x,cop.position.z)<1.8 && b.position.y<3){ cop.userData.hp-=dmg; hit=true;
        if(cop.userData.hp<=0){ scene.remove(cop); footCops.splice(j,1); S.score+=150; registerKill({label:'Cop down'}); } break; }
    }
    // 3) araçları vur (polis + trafik) → yeterince hasar alınca patlar
    if(!hit) for(let j=police.length-1;j>=0;j--){
      const c=police[j]; if(c.userData.dead) continue;
      if(dist2(b.position.x,b.position.z,c.position.x,c.position.z)<2.8){ damageCar(c,dmg); hit=true; break; }
    }
    if(!hit) for(let j=cars.length-1;j>=0;j--){
      const c=cars[j]; if(c===S.car||c.userData.dead) continue;   // kendi aracını vurma
      if(dist2(b.position.x,b.position.z,c.position.x,c.position.z)<2.8){ damageCar(c,dmg); hit=true; break; }
    }
    if(hit||b.userData.life<=0 || b.position.y<0.1){ scene.remove(b); bullets.splice(i,1); }
  }

  // ── PICKUP ──
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    p.rotation.y+=2*dt; p.position.y=1.2+Math.sin(performance.now()*0.003+i)*0.2;
    if(!S.inCar && dist2(p.position.x,p.position.z,player.position.x,player.position.z)<2.5){
      const t=p.userData.type;
      if(t==='money'){S.money+=100;S.score+=50;} else if(t==='health')S.hp=Math.min(S.maxHp,S.hp+30);
      else if(t==='ammo'){ S.ammo[S.weapon]+=20; } else if(t==='star')S.score+=200;
      playSnd(t==='money'?'cash':'pickup');
      collectEvent(t); scene.remove(p); pickups.splice(i,1);
    }
  }

  // ── GÖREV AŞAMALARI + HEDEF İŞARETİ ──
  if(S.active){
    const st=curStage();
    if(st && st.type==='chase' && leaderCar){
      // kaçan liderin aracını takip et — kırmızı işaret + ışık sütunu
      missionMarker.visible=true; missionMarker.position.set(leaderCar.position.x,0.2,leaderCar.position.z);
      missionBeam.visible=true; missionBeam.position.set(leaderCar.position.x,18,leaderCar.position.z);
      if(leaderBeam){ leaderBeam.position.set(leaderCar.position.x,25,leaderCar.position.z);
        leaderBeam.material.opacity=0.18+0.18*Math.abs(Math.sin(performance.now()*0.006)); }
    }
    else if(st && st.target){ missionMarker.visible=true; missionMarker.position.set(st.target[0],0.2,st.target[1]);
      missionBeam.visible=true; missionBeam.position.set(st.target[0],18,st.target[1]); }
    else { missionMarker.visible=false; missionBeam.visible=false; }
    if(st){
      if(st.type==='reach' && dist2(ptgt.x,ptgt.z,st.target[0],st.target[1])<6) advanceStage();
      else if(st.type==='deliver' && S.inCar && dist2(ptgt.x,ptgt.z,st.target[0],st.target[1])<8) advanceStage();
      else if(st.type==='drive' && S.inCar){ S.prog+=dt; if(S.prog>=st.count) advanceStage(); }
      else if(st.type==='wanted' && S.wanted>=1) advanceStage();
      else if(st.type==='escape' && S.wanted===0 && S.stageIdx>0) advanceStage();
      else if(st.type==='choice' && !st._fired && dist2(ptgt.x,ptgt.z,st.target[0],st.target[1])<8){ st._fired=true; triggerMoralChoice(); }
      // 'kill' aşaması missionKill() ile ilerler
    }
  } else { missionMarker.visible=false; missionBeam.visible=false; }

  // ── ETKİLEŞİM İPUCU ──
  let prompt='';
  if(!S.inCar){
    for(const c of cars){ if(dist2(player.position.x,player.position.z,c.position.x,c.position.z)<7){prompt='[F] Enter vehicle';break;} }
    for(const n of npcs){ if(dist2(player.position.x,player.position.z,n.position.x,n.position.z)<5){prompt=`[E] Talk to ${n.userData.name}`;break;} }
    if(dist2(player.position.x,player.position.z,SHOP[0],SHOP[1])<8)prompt='[B] Shop';
    { const d=districtNearHQ(); if(d && d.owner!=='mine') prompt=`[G] Capture ${d.name} district ($${captureCost(d)})`;
      else if(d && d.owner==='mine') prompt=`${d.name} (your district) · [M] Phone`; }
  } else prompt='[F] Exit vehicle';
  UI.prompt.textContent=prompt;

  if(S.shootCd>0)S.shootCd-=dt;
  if(_hurtCd>0)_hurtCd-=dt;
  if(msgTimer>0){ msgTimer-=dt; if(msgTimer<=0)UI.msg.textContent=''; }
  // yumruk kolu animasyon sönümü
  if(punchArm.userData.t>0){ punchArm.userData.t-=dt; if(punchArm.userData.t<=0) punchArm.visible=false; }

  updateCrosshair(dt);

  // ── DÜNYA SAATİ: 20 dk gündüz + 8 dk gece (döngü 28 dk) ──
  S.clock += dt;
  const DAY=1200, NIGHT=480, CYCLE=DAY+NIGHT;     // saniye
  const tc=S.clock % CYCLE;
  const edge=120;                                  // 2 dk şafak/akşam geçişi
  let daylight;
  if(tc < DAY){
    if(tc<edge) daylight=tc/edge;
    else if(tc>DAY-edge) daylight=(DAY-tc)/edge;
    else daylight=1;
  } else daylight=0;
  daylight=Math.max(0,Math.min(1,daylight));
  const b=0.18+daylight*0.82;                       // gece bile hafif aydınlık

  // ── YAĞMUR PROGRAMI: 3 günde bir, günün ilk 12 dk'sı (manuel R geçici öncelikli) ──
  const dayNum=Math.floor(S.clock/CYCLE);
  const scheduledRain = (dayNum%3===2) && (tc < 720);
  if(S.rainManualT>0) S.rainManualT-=dt; else S.raining=scheduledRain;
  // ── SES DÖNGÜSÜ: sadece yağmur ambiyansı (siren artık yıldız artınca tek atış) ──
  if(!AUDIO.muted){ if(S.raining) playSnd('rain'); else stopSnd('rain'); }

  const wet = S.raining ? 0.5 : 1;                  // yağmurda hava kararır
  sun.intensity=(0.6+daylight*1.8)*wet;
  scene.background.setRGB((0.06+b*0.46)*wet, (0.09+b*0.6)*wet, (0.16+b*0.66)*wet);
  if(scene.fog){ scene.fog.color.copy(scene.background); scene.fog.far = S.raining?180:(140+daylight*220); }

  updateHUD();
}

// ── DİNAMİK NİŞANGAH ── (taban + hareket + recoil; düşmanda kırmızı)
const CH = {
  el:  document.getElementById('crosshair'),
  dot: document.querySelector('#crosshair .ch-dot'),
  t:   document.querySelector('#crosshair .ch-t'),
  b:   document.querySelector('#crosshair .ch-b'),
  l:   document.querySelector('#crosshair .ch-l'),
  r:   document.querySelector('#crosshair .ch-r'),
};
function updateCrosshair(dt){
  if(S.scoped || curW().melee) return;       // dürbünde/yumrukta crosshair gizli
  const w=curW();
  // hareket/araç → doğruluk dairesi büyür, dururken küçülür
  const moving = (keys['w']||keys['a']||keys['s']||keys['d']);
  const moveSpread = (!S.onGround ? 22 : (moving ? (S.inCar?6:12) : 0)); // zıplarken en geniş
  const target = w.chBase + moveSpread;
  S.chSpread += (target - S.chSpread) * Math.min(1, dt*12);   // yumuşak ease
  S.recoil   += (0 - S.recoil) * Math.min(1, dt*8);           // recoil sönümü
  const off = S.chSpread + S.recoil + 4;
  // düşman üstündeyse kırmızı, değilse beyaz
  CH.el.style.setProperty('--ch-col', Aiming.onEnemy ? '#ff3344' : '#ffffff');
  CH.t.style.transform = `translate(-50%,-50%) translateY(${-off}px)`;
  CH.b.style.transform = `translate(-50%,-50%) translateY(${off}px)`;
  CH.l.style.transform = `translate(-50%,-50%) translateX(${-off}px)`;
  CH.r.style.transform = `translate(-50%,-50%) translateX(${off}px)`;
  CH.dot.style.transform = `translate(-50%,-50%)`;
}

function updateHUD(){
  UI.hpfill.style.width=(S.hp/S.maxHp*100)+'%';
  UI.hpfill.style.background=S.hp>50?'#2ecc71':(S.hp<25?'#e74c3c':'#f1c40f');
  UI.hptext.textContent=`HP ${S.hp|0}/${S.maxHp}`;
  UI.stamfill.style.width=(S.stamina/S.maxStamina*100)+'%';
  UI.stamfill.style.background=S.sprinting?'#ff8c00':'#f1c40f';
  UI.level.textContent='Lv '+S.level+'  ('+(S.xp|0)+'/'+(S.level*120)+' XP)';
  UI.money.textContent='$'+S.money;
  UI.score.textContent='Score: '+S.score+'  ·  Kills: '+S.kills;
  { const w=curW(); const md=(w.modes&&w.modes.length>1)?(' · '+(curMode()==='auto'?'Auto':'Single')):'';
    UI.weapon.textContent = w.melee ? `${w.icon} ${w.name}` : `${w.icon} ${w.name} ${curAmmo()>=9999?'∞':'x'+curAmmo()}${md}`; }
  UI.wanted.textContent='★'.repeat(S.wanted)+'·'.repeat(5-S.wanted);
  UI.wanted.style.color=S.wanted>=3?'#ff4040':(S.wanted>=1?'#ff9020':'#667');
  if(S.inCar){ UI.speedo.style.display='block'; UI.speedo.textContent=Math.abs(S.car.userData.spd*2.5|0)+' km/h'; }
  else UI.speedo.style.display='none';
  if(S.active){ const m=MISSIONS[S.active], st=curStage();
    const pj=(st&&(st.type==='collect'||st.type==='kill'||st.type==='huntTargets'))?` (${S.prog}/${st.count})`:(st&&st.type==='drive')?` (${S.prog|0}/${st.count}s)`:'';
    UI.mission.innerHTML=`<b>MISSION: ${m.title}</b><br>${st?st.desc:''}${pj}`;
  } else UI.mission.innerHTML = S.objective
      ? `<b>🎯 OBJECTIVE</b><br>${S.objective}`
      : 'Talk to a person with a yellow cone marker<br>[E] to take a mission';
}

refreshQuestMarkers();   // başlangıçta sadece uygun görev verenler işaretli
// tarayıcı otomatik-oynatmayı engeller; ilk etkileşimde menü müziğini başlat
function _audioUnlock(){
  try{ _ac=_ac||new (window.AudioContext||window.webkitAudioContext)(); if(_ac.state==='suspended')_ac.resume(); }catch(e){}
  if(S.mode==='menu') setMusic('music_menu');
  window.removeEventListener('pointerdown',_audioUnlock); window.removeEventListener('keydown',_audioUnlock);
}
window.addEventListener('pointerdown',_audioUnlock); window.addEventListener('keydown',_audioUnlock);
animate();
