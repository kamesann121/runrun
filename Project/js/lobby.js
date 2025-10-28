// lobby.js - フィルタ対策を意識した最小依存ロビーコード
document.addEventListener('DOMContentLoaded',()=> {
  const playersListEl = document.getElementById('playersList');
  const playerNameInput = document.getElementById('playerName');
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const skinOptions = document.getElementById('skinOptions');
  const helmetToggle = document.getElementById('toggleHelmet');
  const readyBtn = document.getElementById('readyBtn');
  const currentName = document.getElementById('currentName');
  const startGameBtn = document.getElementById('startGameBtn');
  const colorPicker = document.getElementById('colorPicker');

  const palette = ['#3A86FF','#FF006E','#FFD166','#06D6A0','#8E44AD','#FF7F50'];
  palette.forEach(c=>{
    const t = document.createElement('div');
    t.className='skinTile';
    t.style.background = c;
    t.dataset.color = c;
    t.addEventListener('click', ()=> selectSkin(c));
    skinOptions.appendChild(t);
  });

  let local = null;
  let players = [];
  window.avatarMap = new Map();

  function selectSkin(color){
    if(!local) return;
    local.color = color;
    updatePlayersList();
    updateAvatarColor(color);
    document.querySelectorAll('.skinTile').forEach(t=> t.classList.toggle('selected', t.dataset.color===color));
    colorPicker.value = color;
  }

  joinBtn.addEventListener('click', ()=> {
    const name = (playerNameInput.value||'Player').slice(0,16);
    local = {id:Date.now(), name, color:palette[0], helmet:false, ready:false};
    players = [local, {id:999,name:'Bot1',color:'#FFD166',helmet:false,ready:false}];
    currentName.textContent = name;
    joinBtn.disabled = true; leaveBtn.disabled = false; startGameBtn.disabled = false;
    updatePlayersList();
    selectSkin(local.color);
    spawnPlayers();
  });

  leaveBtn.addEventListener('click', ()=> {
    local = null; players = []; updatePlayersList();
    joinBtn.disabled = false; leaveBtn.disabled = true; startGameBtn.disabled = true;
    spawnPlayers();
  });

  helmetToggle.addEventListener('change', ()=> {
    if(!local) return;
    local.helmet = helmetToggle.checked;
    updateAvatarHelmet(local.helmet);
    updatePlayersList();
  });

  colorPicker.addEventListener('input', (e)=> {
    const c = e.target.value;
    if(!local) return;
    local.color = c;
    updatePlayersList();
    updateAvatarColor(c);
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
      li.innerHTML = `<span style="color:${p.color}">${escapeHtml(p.name)}</span><span>${p.ready? '✅':'—'}</span>`;
      playersListEl.appendChild(li);
    });
  }

  // ---------- Babylon.js 初期化 ----------
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

  const ground = BABYLON.MeshBuilder.CreateGround("g",{width:20,height:20},scene);
  const mat=new BABYLON.StandardMaterial("gm",scene); mat.diffuseColor=new BABYLON.Color3(0.08,0.12,0.09); ground.material=mat;
  const podium = BABYLON.MeshBuilder.CreateCylinder("pod",{diameter:6,height:0.5,subdivisions:32},scene);
  podium.position.y = 0.25;
  const podMat = new BABYLON.StandardMaterial("pm",scene); podMat.diffuseColor = new BABYLON.Color3(0.12,0.14,0.18); podium.material = podMat;

  function createFallbackAvatar(color='#3A86FF', helmet=false){
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

  async function spawnPlayers() {
    avatarMap.forEach(v => { try { v.root && v.root.dispose(); } catch(e){} });
    avatarMap.clear();

    const modelUrl = 'assets/models/character.glb';
    let useGlb = false;
    try {
      const resp = await fetch(modelUrl, { method: 'HEAD' });
      useGlb = resp.ok;
    } catch(e) {
      useGlb = false;
    }

    if(useGlb) {
      await spawnGlbPlayers(players, scene);
    } else {
      players.forEach((p,i)=>{
        const root = createFallbackAvatar(p.color, p.helmet);
        const angle = (i / Math.max(1, players.length)) * Math.PI * 2;
        root.position = new BABYLON.Vector3(Math.cos(angle)*2.4,0,Math.sin(angle)*2.4);
        avatarMap.set(p.id, { root, anims: [] });
      });
    }
  }

  function showLoader(on) {
    const el = document.getElementById('loader');
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }

  function loadGlbAvatar(scene, url, opts = {}) {
    return new Promise((resolve, reject) => {
      BABYLON.SceneLoader.ImportMesh("", "", url, scene, (meshes, particleSystems, skeletons, animationGroups) => {
        const root = new BABYLON.TransformNode("glbRoot", scene);
        meshes.forEach(m => { m.parent = root; m.checkCollisions = false; m.receiveShadows = false; });
        root.scaling = new BABYLON.Vector3(opts.scale || 1, opts.scale || 1, opts.scale || 1);
        root.position = opts.position || new BABYLON.Vector3(0, 0, 0);
        const anims = animationGroups || [];
        const skeleton = skeletons && skeletons[0] ? skeletons[0] : null;
        resolve({ root, meshes, skeleton, anims });
      }, null, (scene, error) => reject(error));
    });
  }

  async function spawnGlbPlayers(playersList, scene) {
    showLoader(true);
    for (let i = 0; i < playersList.length; i++) {
      const p = playersList[i];
      const angle = (i / Math.max(1, playersList.length)) * Math.PI * 2;
      const pos = new BABYLON.Vector3(Math.cos(angle) * 2.4, 0, Math.sin(angle) * 2.4);
      try {
        const res = await loadGlbAvatar(scene, 'assets/models/character.glb', { scale: 1.0, position: pos });
        res.root.position = pos;
        res.meshes.forEach(m => {
          if (m.material && m.material.albedoColor) {
            m.material.albedoColor = hexToColor3(p.color || '#3A86FF');
          } else if (m.material && m.material.diffuseColor) {
            m.material.diffuseColor = hexToColor3(p.color || '#3A86FF');
          }
        });
        avatarMap.set(p.id, { root: res.root, anims: res.anims, skeleton: res.skeleton });
        if (res.anims && res.anims.length) {
          const idle = res.anims.find(a => /idle/i.test(a.name)) || res.anims[0];
          idle && idle.start(true);
        }
      } catch (e) {
        console.warn('GLB load failed for', p.name);
        const root = createFallbackAvatar(p.color, p.helmet);
        root.position = pos;
        avatarMap.set(p.id, { root, anims: [] });
      }
    }
    showLoader(false);
  }

  function playEmoteForPlayer(playerId, emoteName) {
    const rec = avatarMap.get(playerId);
    if (!rec) return;
    if (rec.anims && rec.anims.length) {
      rec.anims.forEach(a => a.stop());
      const target = rec.anims.find(a => new RegExp(emoteName, 'i').test(a.name));
      if (target) {
        target.start(false, 1.0, target.from, target.to, false);
        if (target.onAnimationGroupEndObservable) {
          target.onAnimationGroupEndObservable.addOnce(() => {
            const idle = rec.anims.find(a => /idle/i.test(a.name)) || rec.anims[0];
            idle && idle.start(true);
          });
        }
        return;
      }
    }
    const node = rec.root;
    BABYLON.Animation.CreateAndStartAnimation("pulse", node, "scaling.y", 30, 10, node.scaling.y, node.scaling.y * 1.12, 0, null, () => { node.scaling.y = 1; });
  }

  document.querySelectorAll('.emoteBtn').forEach(btn=>{
    btn.addEventListener('click',()=> {
      if(!local) return;
      const anim = btn.dataset.anim || btn.textContent;
      playEmoteForPlayer(local.id, anim);
    });
  });

  function updateAvatarColor(c){
    if(!local) return;
    const rec = avatarMap.get(local.id);
    if(!rec) return;
    rec.root.getChildMeshes().forEach(m=>{
      if(m.material && m.material.albedoColor) m.material.albedoColor = hexToColor3(c);
      else if(m.material && m.material.diffuseColor) m.material.diffuseColor = hexToColor3(c);
    });
  }

  function updateAvatarHelmet(flag){
    spawnPlayers();
  }

  engine.runRenderLoop(()=> scene.render());
  window.addEventListener('resize', ()=> engine.resize());

  function hexToColor3(hex){
    const h=(hex||'#3A86FF').replace('#','');
    const r=parseInt(h.substring(0,2),16)/255;
    const g=parseInt(h.substring(2,4),16)/255;
    const b=parseInt(h.substring(4,6),16)/255;
    return new BABYLON.Color3(r,g,b);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  spawnPlayers();
});
