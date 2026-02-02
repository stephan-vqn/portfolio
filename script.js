'use strict';

/* =========================================================
   Table des matières
   =========================================================
   1) Initialisation
      1.1) Point d’entrée (DOMContentLoaded)
   2) Navigation
      2.1) Menu burger (ouverture/fermeture + accessibilité)
   3) Widgets
      3.1) GitHub (profil + 3 repos récents)
      3.2) Météo (Open-Meteo)
   4) UI
      4.1) Bouton "retour en haut"
   5) Utilitaires
      5.1) Météo (WMO) : libellé + icône
      5.2) Formatage nombres
      5.3) Sécurité HTML (escape)
      5.4) Fetch JSON (helper)
   ========================================================= */


/* =========================================================
   1) Initialisation
   ========================================================= */

/* 1.1) Point d’entrée */
document.addEventListener('DOMContentLoaded', () => {
  initBurgerMenu();
  initBackToTop();
  initGithubWidget();
  initWeatherWidget();
});


/* =========================================================
   2) Navigation
   ========================================================= */

/* 2.1) Menu burger */
function initBurgerMenu() {
  const nav = document.querySelector('.nav-bento');
  const burger = document.querySelector('.nav-burger');
  const menu = document.getElementById('primary-nav');

  if (!nav || !burger || !menu) return;

  const setOpen = (isOpen) => {
    nav.classList.toggle('nav-open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  };

  const isOpen = () => nav.classList.contains('nav-open');

  burger.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(!isOpen());
  });

  // Fermeture au clic en dehors.
  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (!nav.contains(e.target)) setOpen(false);
  });

  // Fermeture via la touche Échap.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Fermeture quand un lien du menu est cliqué (délégation d’événement).
  menu.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) setOpen(false);
  });
}


/* =========================================================
   3) Widgets
   ========================================================= */

/* 3.1) GitHub : profil + 3 repos récents */
async function initGithubWidget() {
  const el = document.getElementById('github-widget');
  if (!el) return;

  // Identifiant GitHub depuis l'attribut data.
  const githubUser = (el.dataset.githubUser || '').trim();

  // Placeholder : identifiant absent ou non remplacé.
  if (!githubUser || githubUser.toUpperCase().includes('TON-')) {
    el.innerHTML = `
      <p class="widget-title">GitHub</p>
      <p class="placeholder-text">Renseigne ton identifiant GitHub dans <code>data-github-user</code> (HTML).</p>
    `;
    return;
  }

  const user = encodeURIComponent(githubUser);

  try {
    // Profil + repos (3 plus récents) en parallèle.
    const [profile, repos] = await Promise.all([
      fetchJson(`https://api.github.com/users/${user}`, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      }),
      fetchJson(`https://api.github.com/users/${user}/repos?sort=updated&per_page=3`, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      })
    ]);

    const repoList = Array.isArray(repos) && repos.length
      ? `<ul class="github-repos">
          ${repos.map((r) => `
            <li>
              <a href="${escapeHtml(r.html_url)}" target="_blank" rel="noopener">
                ${escapeHtml(r.name)}
              </a>
              ${r.description ? `<span class="github-repo-desc">${escapeHtml(r.description)}</span>` : ''}
            </li>
          `).join('')}
        </ul>`
      : `<p class="placeholder-text">Aucun dépôt public récent trouvé.</p>`;

    el.innerHTML = `
      <div class="github-header">
        <img class="github-avatar" src="${escapeHtml(profile.avatar_url)}" alt="" loading="lazy" decoding="async" />
        <div class="github-meta">
          <p class="widget-title">${escapeHtml(profile.name || profile.login)}</p>
          <p class="placeholder-text">@${escapeHtml(profile.login)} · ${Number(profile.public_repos || 0)} repos publics</p>
        </div>
      </div>

      ${repoList}

      <a class="widget-link" href="${escapeHtml(profile.html_url)}" target="_blank" rel="noopener">
        Voir le profil
      </a>
    `;
  } catch (err) {
    el.innerHTML = `
      <p class="widget-title">GitHub</p>
      <p class="placeholder-text">Impossible de charger le widget (${escapeHtml(String(err && err.message ? err.message : err))}).</p>
    `;
  }
}


/* 3.2) Météo : Open-Meteo */
async function initWeatherWidget() {
  const el = document.getElementById('weather-widget');
  if (!el) return;

  // Le HTML contient un header fixe + un conteneur .weather-content pour le rendu dynamique.
  const content = el.querySelector('.weather-content') || el;

  const lat = Number(el.dataset.lat);
  const lon = Number(el.dataset.lon);
  const timezone = (el.dataset.timezone || 'Europe/Paris').trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    content.innerHTML = `<p class="placeholder-text">Coordonnées invalides.</p>`;
    return;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', timezone);

  try {
    const data = await fetchJson(url.toString(), { cache: 'no-store' });

    const current = data && data.current ? data.current : null;
    const temp = current ? current.temperature_2m : null;
    const wind = current ? current.wind_speed_10m : null;
    const code = current ? current.weather_code : null;

    const meta = weatherMeta(code);

    // Rendu : remplit uniquement la zone dynamique (.weather-content).
    // (Le header “Météo - Toulouse” reste celui du HTML)
    content.innerHTML = `
      <p class="weather-main">${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</p>
      <p class="placeholder-text">
        Température : <strong>${formatNumber(temp)}°C</strong> · Vent : <strong>${formatNumber(wind)} km/h</strong>
      </p>
      <p class="placeholder-text">Données : Open-Meteo</p>
    `;
  } catch (err) {
    content.innerHTML = `
      <p class="placeholder-text">Impossible de charger la météo (${escapeHtml(String(err && err.message ? err.message : err))}).</p>
    `;
  }
}


/* =========================================================
   4) UI
   ========================================================= */

/* 4.1) Bouton : retour en haut */
function initBackToTop() {
  // Markup de référence (déjà présent dans index.html). :contentReference[oaicite:2]{index=2}
  // Fallback : si le bouton n’existe pas, on l’injecte au début du <body>.
  const BACK_TO_TOP_MARKUP = `
    <!-- Bouton : retour en haut -->
    <button
      class="back-to-top"
      type="button"
      aria-label="Retour en haut de la page"
      title="Retour en haut"
    >
      <svg
        class="back-to-top-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6 14l6-6 6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  `.trim();

  let btn = document.querySelector('.back-to-top');

  if (!btn) {
    const wrap = document.createElement('div');
    wrap.innerHTML = BACK_TO_TOP_MARKUP;
    btn = wrap.querySelector('.back-to-top');
    if (btn) document.body.prepend(btn);
  }

  if (!btn) return;

  const SHOW_AFTER = 300; // px de scroll avant apparition.

  const toggleVisibility = () => {
    btn.classList.toggle('is-visible', window.scrollY > SHOW_AFTER);
  };

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  toggleVisibility();
  window.addEventListener('scroll', toggleVisibility, { passive: true });
}


/* =========================================================
   5) Utilitaires
   ========================================================= */

/* 5.1) Météo : libellé + icône (WMO/Open-Meteo) */
function weatherMeta(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) {
    return { icon: '🌡️', label: 'Conditions inconnues' };
  }

  // Icône
  let icon = '🌡️';
  if (c === 0) icon = '☀️';
  else if (c === 1 || c === 2) icon = '🌤️';
  else if (c === 3) icon = '☁️';
  else if (c === 45 || c === 48) icon = '🌫️';
  else if ([51, 53, 55, 61, 63, 65, 66, 67].includes(c)) icon = '🌧️';
  else if ([71, 73, 75, 77, 85, 86].includes(c)) icon = '🌨️';
  else if ([80, 81, 82].includes(c)) icon = '🌦️';
  else if ([95, 96, 99].includes(c)) icon = '⛈️';

  // Libellé
  let label = 'Météo variable';
  if (c === 0) label = 'Ciel dégagé';
  else if (c === 1 || c === 2) label = 'Peu nuageux';
  else if (c === 3) label = 'Couvert';
  else if (c === 45 || c === 48) label = 'Brouillard';
  else if (c === 51 || c === 53 || c === 55) label = 'Bruine';
  else if (c === 61 || c === 63 || c === 65) label = 'Pluie';
  else if (c === 66 || c === 67) label = 'Pluie verglaçante';
  else if (c === 71 || c === 73 || c === 75) label = 'Neige';
  else if (c === 77) label = 'Grains de neige';
  else if (c === 80 || c === 81 || c === 82) label = 'Averses';
  else if (c === 85 || c === 86) label = 'Averses de neige';
  else if (c === 95) label = 'Orage';
  else if (c === 96 || c === 99) label = 'Orage (grêle)';

  return { icon, label };
}

/* 5.2) Formatage : nombres */
function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return String(Math.round(v));
}

/* 5.3) Sécurité : échappement HTML */
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* 5.4) Fetch JSON : helper */
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Erreur réseau (${res.status})`);
  }
  return res.json();
}
