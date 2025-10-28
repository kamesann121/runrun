// ローカルモックのロビー実装 + Babylon.js ステージ表示（サードパーソン風プレビュー）
document.addEventListener('DOMContentLoaded',()=> {
  const playersListEl = document.getElementById('playersList');
  const playerNameInput = document.getElementById('playerName');
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const skinOptions = document.getElementById('skinOptions');
  const helmetToggle = document.getElementById('helmetToggle');
  const readyBtn = document.getElementById('readyBtn');
  const currentName = document.getElementById('currentName');
  const startGameBtn = document.getElementById('startGameBtn');

  // 初期スキンパレット
  const palette = ['#3A86FF','#FF006E','#FFD166','#06D6A0','#8E44AD','#FF7F50'];
  palette.forEach(c=>{
    const t = document.createElement('div');
    t.className='skinTile';
    t.style.background = c;
    t.dataset.color = c;
    t.addEventListener('click', ()=> {
      selectSkin(c);
    });
    skinOptions.appendChild(t);
  });

  let local = null;
  let players = [];

  function selectSkin(color){
    if(!local) return;
    local.color = color;
    updatePlayersList();
    updateAvatarColor(color);
    document.querySelectorAll('.skinTile').forEach(t=> t.classList.toggle('selected', t.dataset.color===color));
  }

  joinBtn.addEventListener('click', ()=> {
    const name = (playerNameInput.value||'Player').slice(0,16);
    local = {id:Date.now(), name, color:palette[0], helmet:false, ready:false};
    players = [local, {id:999,name:'Bot1',color:'#FFD166',helmet:false,ready:false}];
    currentName.textContent = name;
    joinBtn.disabled = true;
    leaveBtn.disabled = false;
    updatePlayersList();
    selectSkin(local.color);
    // enable hosting controls for now
    startGameBtn.disabled = false;
  });

  leaveBtn.addEventListener('click', ()=> {
    local = null; players = []; updatePlayersList();
    joinBtn.disabled = false; leaveBtn.disabled = true; startGameBtn.disabled = true;
  });

  helmetToggle.addEventListener('change', ()=> {
    if(!local) return;
    local.helmet = helmetToggle.checked;
    updateAvatarHelmet(local.helmet);
    updatePlayersList();
  });

  readyBtn.addEventListener('click', ()=> {
    if(!local) return;
    local.ready = !local.ready;
    readyBtn.textContent = local.ready ? 'Unready' : 'Ready';
    updatePlayersList();
  });

  function updatePlayersList(){
    playersListEl.innerHTML='';
    players.forEach(p=>{
      const li=document.createElement('li');
      li.className='playerItem';
      li.innerHTML = `<span style="color:${p.color}">${p.name}</span><span>${p.ready? '✅':'—'}</span>`;
      playersListEl.appendChild(li);
    });
  }

  // Babylon.js 初期化
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer:true,stencil:true});
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.06,0.08,0.12);

  const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI/2, Math.PI/3.5, 8, new BABYLON.Vector3(0,1,0), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 18;

  const light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);
  const sun = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.3,-1,0.4), scene);
  sun.position = new BABYLON.Vector3(10,10,10);

  // ステージの地面と円形台
  const ground = BABYLON.MeshBuilder.CreateGround("g",{width:20,height:20},scene);
  const mat=new BABYLON.StandardMaterial("gm",scene); mat.diffuseColor=new BABYLON.Color3(0.08,0.12,0.09); ground.material=mat;
  const podium = BABYLON.MeshBuilder.CreateCylinder("pod",{diameter:6,height:0.5,subdivisions:32},scene);
  podium.position.y = 0.25;
  const podMat = new BABYLON.StandardMaterial("pm",scene); podMat.diffuseColor = new BABYLON.Color3(0.12,0.14,0.18); podium.material = podMat;

  // 簡易アバター生成関数（rootノードを返す）
  function createAvatar(color='#3A86FF', helmet=false){
    const root = new BABYLON.TransformNode("avatar", scene);
    const body = BABYLON.MeshBuilder.CreateCapsule("body",{height:1.2,radius:0.35},scene);
    body.parent = root; body.position.y = 1;
    const bodyMat = new BABYLON.StandardMaterial("bm",scene); bodyMat.diffuseColor = hexToColor3(color); body.material = bodyMat;
    if(helmet){
      const helm = BABYLON.MeshBuilder.CreateSphere("helm",{diameter:0.7,segments:8},scene);
      helm.parent = root; helm.position.y = 1.45;
      const hmat = new BABYLON.StandardMaterial("hm",scene); hmat.diffuseColor = new BABYLON.Color3(0.12,0.12,0.12); helm.material = hmat;
    }
    return root;
  }

  // 表示するプレイヤーのアバターマップ
  const avatarMap = new Map();
  function spawnPlayers(){
    // cleanup
    avatarMap.forEach((v)=> v.dispose && v.dispose());
    avatarMap.clear();
    // place players around podium
    players.forEach((p,i)=>{
      const root = createAvatar(p.color, p.helmet);
      const angle = (i / Math.max(1, players.length)) * Math.PI * 2;
      root.position = new BABYLON.Vector3(Math.cos(angle)*2.4,0,Math.sin(angle)*2.4);
      avatarMap.set(p.id, root);
    });
  }

  // update color/helmet on local avatar
  function updateAvatarColor(c){
    if(!local) return;
    const node = avatarMap.get(local.id);
    if(!node) return;
    node.getChildMeshes().forEach(m=>{
      if(m.material && m.name.startsWith("body")) m.material.diffuseColor = hexToColor3(c);
    });
  }
  function updateAvatarHelmet(flag){
    if(!local) return;
    spawnPlayers();
  }

  // エモート（簡易：上下にスケールするアニメ）
  document.querySelectorAll('.emoteBtn').forEach(btn=>{
    btn.addEventListener('click',()=> {
      if(!local) return;
      const node = avatarMap.get(local.id);
      if(!node) return;
      BABYLON.Animation.CreateAndStartAnimation("emote", node, "scaling.y", 30, 10, node.scaling.y, node.scaling.y*1.2, 0, null, ()=> {
        node.scaling.y = 1;
      });
    });
  });

  // joinでスポーン
  const obs = new MutationObserver(()=> spawnPlayers());
  // simple update loop to reflect list changes
  function updateLoop(){
    // sync mocked players to avatars
    spawnPlayers();
    engine.resize();
    requestAnimationFrame(updateLoop);
  }
  updateLoop();

  engine.runRenderLoop(()=> scene.render());
  window.addEventListener('resize', ()=> engine.resize());

  // helper
  function hexToColor3(hex){ const h=hex.replace('#',''); return new BABYLON.Color3(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255) }
});
