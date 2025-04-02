function goToGame(url) {
  window.location.href = url;
}

window.addEventListener("DOMContentLoaded", async () => {
  const row = document.getElementById("cardRow");
  const scrollContainer = document.getElementById("cardScroll");
  const response = await fetch("assets/js/games.json");
  const games = await response.json();

  games.forEach(game => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => goToGame(`games/${game.file}`);
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">${game.title}</div>
        <div class="card-back">플레이!</div>
      </div>
    `;
    row.appendChild(card);
  });

  const spacer = document.createElement("div");
  spacer.className = "card-spacer";
  row.appendChild(spacer);

  document.getElementById("leftBtn").addEventListener("click", () => {
    scrollContainer.scrollBy({ left: -230, behavior: "smooth" });
  });

  document.getElementById("rightBtn").addEventListener("click", () => {
    scrollContainer.scrollBy({ left: 230, behavior: "smooth" });
  });
});

// 마우스로 드래그해서 스크롤
let isDown = false;
let startX;
let scrollLeft;

scrollContainer.addEventListener('mousedown', (e) => {
  isDown = true;
  scrollContainer.classList.add('active');
  startX = e.pageX - scrollContainer.offsetLeft;
  scrollLeft = scrollContainer.scrollLeft;
});

scrollContainer.addEventListener('mouseleave', () => {
  isDown = false;
  scrollContainer.classList.remove('active');
});

scrollContainer.addEventListener('mouseup', () => {
  isDown = false;
  scrollContainer.classList.remove('active');
});

scrollContainer.addEventListener('mousemove', (e) => {
  if (!isDown) return;
  e.preventDefault();
  const x = e.pageX - scrollContainer.offsetLeft;
  const walk = (x - startX) * 1.5;
  scrollContainer.scrollLeft = scrollLeft - walk;
});
