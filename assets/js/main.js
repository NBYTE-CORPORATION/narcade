/* ============================================
   나케이드 메인 — 그리드/필터/정렬/즐겨찾기 (미니멀 v3)
   arcade.js(window.Arcade)가 먼저 로드되어야 한다.
   ============================================ */
const CATEGORY_LABELS = {
  '퍼즐': 'PUZZLE',
  '아케이드': 'ARCADE',
  '반사': 'REFLEX',
  '퀴즈': 'QUIZ',
};

let allGames = [];
let activeCategory = '전체';
let searchQuery = '';
let sortMode = 'default';

/* ── 로컬 데이터 ── */
function getFavorites() { return Arcade.store.get('favorites', []); }
function setFavorites(list) { Arcade.store.set('favorites', list); }
function getPlays() { return Arcade.store.get('plays', {}); }

function isFav(id) { return getFavorites().indexOf(id) !== -1; }

function toggleFav(id) {
  let favs = getFavorites();
  if (favs.indexOf(id) === -1) favs = favs.concat([id]);
  else favs = favs.filter(f => f !== id);
  setFavorites(favs);
  Arcade.audio.play(favs.indexOf(id) !== -1 ? 'coin' : 'click');
}

/* ── 최고 기록 조회/표시 ── */
function lookupBest(game) {
  let v = Arcade.best.get(game.id);
  if (v === null && Array.isArray(game.bestSuffixes)) {
    for (const suf of game.bestSuffixes) {
      v = Arcade.best.get(game.id, { suffix: suf });
      if (v !== null) break;
    }
  }
  return v;
}

function bestNumber(v) {
  if (v && typeof v === 'object') {
    if (typeof v.score === 'number') return v.score;
    if (typeof v.time === 'number') return v.time;
    if (typeof v.ms === 'number') return v.ms;
    return NaN;
  }
  return typeof v === 'number' ? v : NaN;
}

function formatBest(game, v) {
  const n = bestNumber(v);
  if (isNaN(n)) return null;
  switch (game.bestFormat) {
    case 'ms':   return Arcade.fmtTime(n);
    case 'time': return Arcade.fmtTime(n * 1000);
    case 'score': return n.toLocaleString('ko-KR');
    default:     return String(n);
  }
}

/* ── 카드 렌더 ── */
function buildCard(game, i, featured) {
  const card = document.createElement('a');
  card.className = 'game-card' + (featured ? ' featured' : '');
  card.href = `games/${game.file}`;
  card.style.animationDelay = `${Math.min(i, 16) * 0.04}s`;

  const plays = getPlays();
  const playCount = plays[game.id] || 0;
  const bestLabel = formatBest(game, lookupBest(game));
  const fav = isFav(game.id);
  const catLabel = CATEGORY_LABELS[game.category] || game.category;

  let meta = `<span class="card-category">${catLabel}</span>`;
  if (bestLabel) meta += `<span class="chip-best">BEST ${bestLabel}</span>`;
  if (playCount > 0) meta += `<span class="chip-plays">${playCount}회</span>`;

  card.innerHTML = `
    <button type="button" class="fav-btn${fav ? ' active' : ''}"
      aria-label="${fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}" aria-pressed="${fav}">${fav ? '★' : '☆'}</button>
    ${game.isNew ? '<span class="card-new-badge">NEW</span>' : ''}
    <span class="card-emoji">${game.emoji}</span>
    <h3 class="card-title">${game.title}</h3>
    <p class="card-desc">${game.desc}</p>
    <div class="card-meta">${meta}</div>
    <div class="card-play">바로 플레이</div>
  `;

  card.querySelector('.fav-btn').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav(game.id);
    const on = isFav(game.id);
    const btn = e.currentTarget;
    btn.classList.toggle('active', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '즐겨찾기 해제' : '즐겨찾기 추가');
    renderFavRow();
  });

  return card;
}

function renderCards(games) {
  const grid = document.getElementById('gameGrid');
  grid.innerHTML = '';

  if (games.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <span class="no-icon">⌕</span>
        <p>검색 결과가 없습니다</p>
      </div>`;
    return;
  }

  // 기본 보기(전체·기본 정렬·검색 없음)에서는 첫 NEW 게임을 피처드 타일로
  const isDefaultView = activeCategory === '전체' && !searchQuery && sortMode === 'default';
  games.forEach((game, i) => {
    const featured = isDefaultView && i === 0 && game.isNew === true;
    grid.appendChild(buildCard(game, i, featured));
  });
}

/* ── 미니 카드(가로 스크롤 행) ── */
function buildMiniCard(game) {
  const a = document.createElement('a');
  a.className = 'mini-card';
  a.href = `games/${game.file}`;
  a.innerHTML = `<span class="mini-emoji">${game.emoji}</span><span class="mini-title">${game.title}</span>`;
  return a;
}

function fillRow(sectionId, rowId, games) {
  const section = document.getElementById(sectionId);
  const row = document.getElementById(rowId);
  if (!games.length) {
    section.style.display = 'none';
    row.innerHTML = '';
    return;
  }
  row.innerHTML = '';
  games.forEach(g => row.appendChild(buildMiniCard(g)));
  section.style.display = '';
}

function renderRecentRow() {
  const recent = Arcade.store.get('recent', []);
  const games = recent
    .map(r => allGames.find(g => g.id === r.id))
    .filter(Boolean);
  fillRow('recentSection', 'recentRow', games);
}

function renderFavRow() {
  const games = getFavorites()
    .map(id => allGames.find(g => g.id === id))
    .filter(Boolean);
  fillRow('favSection', 'favRow', games);
}

/* ── 필터 + 정렬 ── */
function applyFilter() {
  let result = allGames.slice();

  if (activeCategory !== '전체') {
    result = result.filter(g => g.category === activeCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.desc.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  }

  const plays = getPlays();
  const baseIndex = new Map(allGames.map((g, i) => [g.id, i]));
  switch (sortMode) {
    case 'new':
      result.sort((a, b) =>
        (b.isNew === true) - (a.isNew === true) || baseIndex.get(a.id) - baseIndex.get(b.id));
      break;
    case 'popular':
      result.sort((a, b) =>
        (plays[b.id] || 0) - (plays[a.id] || 0) || baseIndex.get(a.id) - baseIndex.get(b.id));
      break;
    case 'name':
      result.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
      break;
    default:
      break; // games.json 순서 유지
  }

  renderCards(result);
}

/* ── 부트 ── */
window.addEventListener('DOMContentLoaded', async () => {
  Arcade.migrateLegacy();

  try {
    const res = await fetch('assets/js/games.json');
    allGames = await res.json();
  } catch (e) {
    allGames = [];
  }

  document.getElementById('gameCount').textContent = allGames.length;
  const heroCount = document.getElementById('heroCount');
  if (heroCount) heroCount.textContent = allGames.length;

  renderRecentRow();
  renderFavRow();
  applyFilter();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      Arcade.audio.play('click');
      applyFilter();
    });
  });

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    applyFilter();
  });

  // '/' 단축키로 검색 포커스
  window.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  document.getElementById('sortSel').addEventListener('change', e => {
    sortMode = e.target.value;
    Arcade.audio.play('click');
    applyFilter();
  });
});
