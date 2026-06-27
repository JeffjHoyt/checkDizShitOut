// ── CATEGORY DEFINITIONS ──────────────────────────────────────
const WORKOUT_CATEGORIES = [
  { id: 'Back',               emoji: '🏋️' },
  { id: 'Chest',              emoji: '💪' },
  { id: 'Biceps',             emoji: '💪' },
  { id: 'Triceps',            emoji: '💪' },
  { id: 'Shoulders',          emoji: '🦾' },
  { id: 'Lats',               emoji: '🏊' },
  { id: 'Abs',                emoji: '🔥' },
  { id: 'Legs',               emoji: '🦵' },
  { id: 'Functional Training', emoji: '⚡' },
  { id: 'Random',             emoji: '🎲' },
];

const RECIPE_CATEGORIES = [
  { id: 'Breakfast', emoji: '🍳' },
  { id: 'Lunch',     emoji: '🥗' },
  { id: 'Dinner',    emoji: '🍽️' },
  { id: 'Snack',     emoji: '🍎' },
  { id: 'Dessert',   emoji: '🍰' },
  { id: 'PROTEIN',   emoji: '💪' },
  { id: 'Random',    emoji: '🎲' },
];

// ── STORAGE ───────────────────────────────────────────────────
function loadData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function saveData(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getWorkouts() { return loadData('workouts'); }
function saveWorkouts(d) { saveData('workouts', d); }
function getRecipes()  { return loadData('recipes'); }
function saveRecipes(d) { saveData('recipes', d); }

// ── IDS ───────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── PLATFORM DETECTION ────────────────────────────────────────
function detectPlatform(url) {
  if (/instagram\.com/i.test(url))         return { label: 'Instagram', emoji: '📸' };
  if (/youtube\.com|youtu\.be/i.test(url)) return { label: 'YouTube',   emoji: '▶️' };
  if (/facebook\.com|fb\.watch/i.test(url))return { label: 'Facebook',  emoji: '📘' };
  if (/tiktok\.com/i.test(url))            return { label: 'TikTok',    emoji: '🎵' };
  return { label: 'Link', emoji: '🔗' };
}

// ── PREVIEW IMAGES ────────────────────────────────────────────
function getYouTubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const previewCache = {};

async function resolvePreviewImage(url) {
  if (previewCache[url] !== undefined) return previewCache[url];
  const ytId = getYouTubeId(url);
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    previewCache[url] = thumb;
    return thumb;
  }
  try {
    const res  = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
    const json = await res.json();
    const img  = json?.data?.image?.url || null;
    previewCache[url] = img;
    return img;
  } catch {
    previewCache[url] = null;
    return null;
  }
}

function loadThumb(containerEl, url, searchFallback) {
  resolvePreviewImage(url).then(imgUrl => {
    // bail out if this container was removed from the DOM by a re-render
    if (!containerEl.isConnected) return;

    // if no OG image found and we have a search term, use Unsplash
    // nonce prevents browser from serving a cached redirect meant for a different item
    const nonce = Math.random().toString(36).slice(2, 7);
    const src = imgUrl || (searchFallback
      ? `https://source.unsplash.com/400x300/?food,${encodeURIComponent(searchFallback)}&nonce=${nonce}`
      : null);
    if (!src) return;

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    img.onload = () => {
      if (!containerEl.isConnected) { img.remove(); return; }
      const ph = containerEl.querySelector('.recent-thumb-placeholder, .thumb-placeholder');
      if (ph) ph.style.display = 'none';
    };
    img.onerror = () => { img.remove(); };
    containerEl.appendChild(img);
  });
}

// ── TOAST ─────────────────────────────────────────────────────
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── TABS ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── ROUTING ───────────────────────────────────────────────────
// Hash format: #workouts/Back  or  #recipes/Dinner
function navigate(hash) {
  window.location.hash = hash;
}

window.addEventListener('hashchange', handleRoute);

function handleRoute() {
  const hash = window.location.hash.slice(1); // e.g. "workouts/Back"
  if (!hash) {
    showHome();
    return;
  }
  const [type, ...rest] = hash.split('/');
  const catId = decodeURIComponent(rest.join('/'));
  if ((type === 'workouts' || type === 'recipes') && catId) {
    showDetail(type, catId);
  } else {
    showHome();
  }
}

function showHome() {
  document.getElementById('home-view').classList.remove('hidden');
  document.getElementById('detail-view').classList.add('hidden');
  document.getElementById('main-nav').classList.remove('hidden');
}

function showDetail(type, catId) {
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('detail-view').classList.remove('hidden');
  document.getElementById('main-nav').classList.add('hidden');
  renderDetailView(type, catId);
}

document.getElementById('back-btn').addEventListener('click', () => {
  navigate('');
});

document.getElementById('home-link').addEventListener('click', () => {
  navigate('');
});

// ── HOME: CATEGORY GRID ───────────────────────────────────────
function renderCategoryGrid(type, categories, getData) {
  const gridId = type === 'workouts' ? 'workout-categories' : 'recipe-categories';
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';

  categories.forEach(cat => {
    const items = getData().filter(i => i.category === cat.id);
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-card-header">
        <span class="category-name">
          <span class="category-emoji">${cat.emoji}</span>${cat.id}
        </span>
        <span style="display:flex;align-items:center;gap:0.4rem">
          <span class="category-count">${items.length}</span>
          <span class="category-arrow">→</span>
        </span>
      </div>
    `;
    card.addEventListener('click', () => navigate(`${type}/${encodeURIComponent(cat.id)}`));
    grid.appendChild(card);
  });
}

// ── DETAIL VIEW ───────────────────────────────────────────────
function renderDetailView(type, catId) {
  const categories = type === 'workouts' ? WORKOUT_CATEGORIES : RECIPE_CATEGORIES;
  const cat = categories.find(c => c.id === catId);
  if (!cat) { navigate(''); return; }

  document.getElementById('detail-emoji').textContent = cat.emoji;
  document.getElementById('detail-name').textContent  = cat.id;

  const getData  = type === 'workouts' ? getWorkouts : getRecipes;
  const saveData = type === 'workouts' ? saveWorkouts : saveRecipes;

  const items = getData().filter(i => i.category === catId);

  const byRecent = [...items].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const byLiked  = [...items].sort((a, b) => (b.likes || 0) - (a.likes || 0));

  renderDetailCol('detail-recent', byRecent, type, getData, saveData);
  renderDetailCol('detail-liked',  byLiked,  type, getData, saveData);
}

function renderDetailCol(containerId, items, type, getData, saveData) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<p class="empty-col">Nothing here yet</p>';
    return;
  }

  items.forEach(item => {
    const platform = type === 'workouts' ? detectPlatform(item.url) : { emoji: '🍽️', label: 'Recipe' };
    const liked = item.liked || false;
    const likes = item.likes || 0;

    const card = document.createElement('div');
    card.className = 'detail-link-card';
    card.innerHTML = `
      <div class="detail-card-thumb">
        <span class="thumb-placeholder">${platform.emoji}</span>
      </div>
      <div class="detail-card-body">
        <div class="detail-card-title">${item.title || item.url}</div>
        <div class="detail-card-actions">
          <button class="like-btn ${liked ? 'liked' : ''}" data-id="${item.id}">
            <span class="heart">${liked ? '❤️' : '🤍'}</span>
            <span class="like-count">${likes}</span>
          </button>
          <a class="detail-card-open" href="${item.url}" target="_blank" rel="noopener">Open ↗</a>
          <button class="detail-card-delete" data-id="${item.id}" title="Remove">✕</button>
        </div>
      </div>
    `;

    // load preview image; for recipes fall back to title-based image search
    const thumb = card.querySelector('.detail-card-thumb');
    loadThumb(thumb, item.url, type === 'recipes' ? item.title : null);

    // like handler
    card.querySelector('.like-btn').addEventListener('click', () => {
      const all = getData();
      const target = all.find(i => i.id === item.id);
      if (!target) return;
      target.liked = !target.liked;
      target.likes = (target.likes || 0) + (target.liked ? 1 : -1);
      if (target.likes < 0) target.likes = 0;
      saveData(all);
      renderDetailView(type, item.category);
      renderRecentFeed();
    });

    // delete handler
    card.querySelector('.detail-card-delete').addEventListener('click', () => {
      const all = getData();
      const idx = all.findIndex(i => i.id === item.id);
      if (idx !== -1) all.splice(idx, 1);
      saveData(all);
      renderCategoryGrid(type, type === 'workouts' ? WORKOUT_CATEGORIES : RECIPE_CATEGORIES, getData);
      renderDetailView(type, item.category);
      renderRecentFeed();
      showToast('Removed');
    });

    container.appendChild(card);
  });
}

// ── ADD WORKOUT ───────────────────────────────────────────────
document.getElementById('add-workout-btn').addEventListener('click', () => {
  const cat   = document.getElementById('workout-category').value;
  const url   = document.getElementById('workout-url').value.trim();
  const title = document.getElementById('workout-title').value.trim();

  if (!cat)   { showToast('Please select a category'); return; }
  if (!url)   { showToast('Please paste a video link'); return; }
  if (!title) { showToast('Please add a title'); return; }
  try { new URL(url); } catch { showToast("That doesn't look like a valid URL"); return; }

  const data = getWorkouts();
  data.push({ id: uid(), category: cat, url, title, likes: 0, liked: false, addedAt: Date.now() });
  saveWorkouts(data);
  renderCategoryGrid('workouts', WORKOUT_CATEGORIES, getWorkouts);
  renderRecentFeed();

  document.getElementById('workout-category').value = '';
  document.getElementById('workout-url').value = '';
  document.getElementById('workout-title').value = '';
  showToast('Workout link added! 💪');
});

// ── ADD RECIPE ────────────────────────────────────────────────
document.getElementById('add-recipe-btn').addEventListener('click', () => {
  const cat   = document.getElementById('recipe-category').value;
  const url   = document.getElementById('recipe-url').value.trim();
  const title = document.getElementById('recipe-title').value.trim();

  if (!cat)   { showToast('Please select a category'); return; }
  if (!url)   { showToast('Please paste a recipe link'); return; }
  if (!title) { showToast('Please add a title'); return; }
  try { new URL(url); } catch { showToast("That doesn't look like a valid URL"); return; }

  const data = getRecipes();
  data.push({ id: uid(), category: cat, url, title, likes: 0, liked: false, addedAt: Date.now() });
  saveRecipes(data);
  renderCategoryGrid('recipes', RECIPE_CATEGORIES, getRecipes);
  renderRecentFeed();

  document.getElementById('recipe-category').value = '';
  document.getElementById('recipe-url').value = '';
  document.getElementById('recipe-title').value = '';
  showToast('Recipe added! 🍽️');
});

// ── RECENTLY ADDED SIDEBAR ────────────────────────────────────
function renderRecentFeed() {
  const workouts = getWorkouts().map(w => ({ ...w, type: 'workouts' }));
  const recipes  = getRecipes().map(r  => ({ ...r, type: 'recipes'  }));

  const all = [...workouts, ...recipes]
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, 20);

  const list = document.getElementById('recent-list');
  list.innerHTML = '';

  if (all.length === 0) {
    list.innerHTML = '<p class="no-links">Nothing added yet</p>';
    return;
  }

  all.forEach(item => {
    const platform = item.type === 'workouts' ? detectPlatform(item.url) : { emoji: '🍽️', label: item.category || 'Recipe' };
    const div = document.createElement('div');
    div.className = 'recent-item';
    div.innerHTML = `
      <a href="${item.url}" target="_blank" rel="noopener" class="recent-thumb-link">
        <div class="recent-thumb">
          <span class="recent-thumb-placeholder">${platform.emoji}</span>
        </div>
      </a>
      <div class="recent-info">
        <div class="recent-meta">
          <span class="recent-type-badge">${item.category}</span>
          <span class="recent-platform">${platform.label}</span>
        </div>
        <a class="recent-title" href="${item.url}" target="_blank" rel="noopener">${item.title || 'View link'}</a>
        <span class="recent-url">${item.url}</span>
      </div>
    `;
    list.appendChild(div);

    const thumb = div.querySelector('.recent-thumb');
    loadThumb(thumb, item.url, item.type === 'recipes' ? item.title : null);
  });
}

// ── INIT ──────────────────────────────────────────────────────
renderCategoryGrid('workouts', WORKOUT_CATEGORIES, getWorkouts);
renderCategoryGrid('recipes',  RECIPE_CATEGORIES,  getRecipes);
renderRecentFeed();
handleRoute();
