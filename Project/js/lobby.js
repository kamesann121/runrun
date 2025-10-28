document.addEventListener('DOMContentLoaded', () => {
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
  palette.forEach(c => {
    const t = document.createElement('div');
    t.className = 'skinTile';
    t.style.background = c;
    t.dataset.color = c;
    t.addEventListener('click', () => selectSkin(c));
    skinOptions.appendChild(t);
  });

  let local = null;
  let players = [];
  window.avatarMap = new Map();

  const socket = io(); // socket.io接続！

  joinBtn.addEventListener('click', () => {
    const name = (playerNameInput.value || 'Player').slice(0, 16);
    local = { id: socket.id, name, color: palette[0], helmet: false, ready: false };
    currentName.textContent = name;
    joinBtn.disabled = true;
    leaveBtn.disabled = false;
    startGameBtn.disabled = false;
    socket.emit('join', local);
  });

  leaveBtn.addEventListener('click', () => {
    socket.emit('leave');
    local = null;
    players = [];
    updatePlayersList();
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
    startGameBtn.disabled = true;
    spawnPlayers();
  });

  socket.on('updatePlayers', list => {
    players = list;
    updatePlayersList();
    spawnPlayers();
  });

  helmetToggle.addEventListener('change', () => {
    if (!local) return;
    local.helmet = helmetToggle.checked;
    socket.emit('update', local);
  });

  colorPicker.addEventListener('input', (e) => {
    const c = e.target.value;
    if (!local) return;
    local.color = c;
    selectSkin(c);
    socket.emit('update', local);
  });

  readyBtn.addEventListener('click', () => {
    if (!local) return;
    local.ready = !local.ready;
    readyBtn.textContent = local.ready ? 'Unready' : 'Ready';
    socket.emit('update', local);
  });

  function selectSkin(color) {
    if (!local) return;
    local.color = color;
    updatePlayersList();
    updateAvatarColor(color);
    document.querySelectorAll('.skinTile').forEach(t => t.classList.toggle('selected', t.dataset.color === color));
    colorPicker.value = color;
  }

  function updatePlayersList() {
    playersListEl.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'playerItem';
      li.innerHTML = `<span style="color:${p.color}">${escapeHtml(p.name)}</span><span>${p.ready ? '✅' : '—'}</span>`;
      playersListEl.appendChild(li);
    });
  }

  // Babylon.jsの初期化やspawnPlayersなどはそのままでOK！
  // 次のステップで3Dロビーの見た目をコンパクトにしていくよ！

  // ...（Babylon.js部分は省略中。次で改良する！）

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
});
