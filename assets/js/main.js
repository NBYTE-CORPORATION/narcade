const CATEGORY_COLORS = {
  '퀴즈':     { accent: '#f59e0b', soft: 'rgba(245,158,11,0.08)',  glow: 'rgba(245,158,11,0.25)' },
  '반사':     { accent: '#06b6d4', soft: 'rgba(6,182,212,0.08)',   glow: 'rgba(6,182,212,0.25)'  },
  '아케이드': { accent: '#ec4899', soft: 'rgba(236,72,153,0.08)',  glow: 'rgba(236,72,153,0.25)' },
  '퍼즐':     { accent: '#7c3aed', soft: 'rgba(124,58,237,0.08)',  glow: 'rgba(124,58,237,0.3)'  },
};

let allGames = [];
let activeCategory = '전체';
let searchQuery = '';

function renderCards(games) {
  const grid = document.getElementById('gameGrid');
  grid.innerHTML = '';

  if (games.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <span class="no-icon">🎮</span>
        <p>검색 결과가 없습니다</p>
      </div>`;
    return;
  }

  games.forEach((game, i) => {
    const colors = CATEGORY_COLORS[game.category] || CATEGORY_COLORS['퍼즐'];
    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = `games/${game.file}`;
    card.style.animationDelay = `${i * 0.045}s`;
    card.style.setProperty('--card-accent', colors.accent);
    card.style.setProperty('--card-accent-soft', colors.soft);
    card.style.setProperty('--card-glow', colors.glow);

    card.innerHTML = `
      ${game.isNew ? '<span class="card-new-badge">NEW</span>' : ''}
      <span class="card-emoji">${game.emoji}</span>
      <span class="card-category cat-${game.category}">${game.category}</span>
      <h3 class="card-title">${game.title}</h3>
      <p class="card-desc">${game.desc}</p>
      <div class="card-play">
        <div class="play-btn">▶</div>
        <span class="play-label">플레이</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function applyFilter() {
  let result = allGames;
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
  renderCards(result);
}

window.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('assets/js/games.json');
  allGames = await res.json();

  document.getElementById('gameCount').textContent = allGames.length;
  renderCards(allGames);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      applyFilter();
    });
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    applyFilter();
  });
});
