'use strict';

/* =========================================================
   Table des matières
   =========================================================
   1) Initialisation
      1.1) Point d’entrée (DOMContentLoaded)
   2) Navigation
      2.1) Menu burger (ouverture/fermeture + accessibilité)
      2.2) Dark / Light theme
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
  initThemeToggle();
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
   2.2) Thème (Light / Dark) – toggle + persistance
   ========================================================= */
function initThemeToggle() {
  const root = document.documentElement; // <html>
  const btn = document.querySelector('[data-theme-toggle]');
  const STORAGE_KEY = 'theme'; // 'light' | 'dark'

  const getSystemTheme = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

  const getSavedTheme = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  };

  const applyTheme = (theme, { persist = false } = {}) => {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');

    if (btn) {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? 'Activer le thème clair' : 'Activer le thème sombre');

      // Optionnel : switch icône FontAwesome
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon', !isDark);
        icon.classList.toggle('fa-lightbulb', isDark);
      }
    }

    if (persist) saveTheme(theme);
  };

  // 1) Thème initial : localStorage sinon système
  const saved = getSavedTheme();
  const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
  applyTheme(initial, { persist: false });

  // 2) Toggle au clic
  if (btn) {
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, { persist: true });
    });
  }

  // 3) Si l’utilisateur n’a PAS choisi manuellement, suivre le système
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', () => {
      const stillNoChoice = !getSavedTheme();
      if (stillNoChoice) applyTheme(getSystemTheme(), { persist: false });
    });
  }
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

  const refreshEveryMs = 30 * 60 * 1000; // 30 min (ajuste si besoin)

  function weatherIconClass(code) {
    // Codes WMO Open-Meteo : https://open-meteo.com/en/docs
    if (code === 0) return 'fa-sun';
    if (code === 1 || code === 2) return 'fa-cloud-sun';
    if (code === 3) return 'fa-cloud';
    if (code === 45 || code === 48) return 'fa-smog';
    if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'fa-cloud-rain';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'fa-snowflake';
    if (code >= 95) return 'fa-bolt';
    return 'fa-cloud';
  }

  function weatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return '❄️';
    if (code >= 95) return '⛈️';
    return '⛅';
  }

  async function loadAndRender() {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
    url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timezone', timezone);

    try {
      const data = await fetchJson(url.toString(), { cache: 'no-store' });

      const current = data && data.current ? data.current : null;
      const temp = current ? current.temperature_2m : null;
      const wind = current ? current.wind_speed_10m : null;
      const hum = current ? current.relative_humidity_2m : null;
      const code = current ? current.weather_code : null;
      const updatedAt = current ? current.time : null;

      const daily = data && data.daily ? data.daily : null;
      const min = daily && Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
      const max = daily && Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;

      const meta = weatherMeta(code);
      const icon = weatherIconClass(code);
      const emoji = weatherEmoji(code);

      const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';

      const updatedTitle = updatedLabel
        ? ` title="Dernière mise à jour : ${escapeHtml(updatedLabel)}"`
        : '';

      // Rendu : remplit uniquement la zone dynamique (.weather-content).
      content.innerHTML = `
        <div class="weather-summary">
          <p class="weather-condition">${escapeHtml(meta.label)}</p>
          <span class="weather-hero-icon" aria-hidden="true">${emoji}</span>
        </div>

        <dl class="weather-stats">
          <div class="weather-row">
            <dt><i class="fa-solid fa-temperature-three-quarters" aria-hidden="true"></i>Température</dt>
            <dd><strong>${formatNumber(temp)}°C</strong></dd>
          </div>

          <div class="weather-row">
            <dt><i class="fa-solid fa-wind" aria-hidden="true"></i>Vent</dt>
            <dd><strong>${formatNumber(wind)} km/h</strong></dd>
          </div>

          <div class="weather-row">
            <dt><i class="fa-solid fa-droplet" aria-hidden="true"></i>Humidité</dt>
            <dd><strong>${formatNumber(hum)}%</strong></dd>
          </div>

          <div class="weather-row">
            <dt><i class="fa-solid fa-arrows-up-down" aria-hidden="true"></i>Min / Max</dt>
            <dd><strong>${formatNumber(min)}°C / ${formatNumber(max)}°C</strong></dd>
          </div>
        </dl>

        <p class="weather-footnote"${updatedTitle}>
          <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
          Mise à jour auto · Open-Meteo
        </p>
      `;
    } catch (err) {
      content.innerHTML = `
        <p class="placeholder-text">Impossible de charger la météo (${escapeHtml(String(err && err.message ? err.message : err))}).</p>
      `;
    }
  }

  await loadAndRender();

  // Auto-refresh (évite les doublons si init rappelée)
  if (!el.__weatherInterval) {
    el.__weatherInterval = window.setInterval(loadAndRender, refreshEveryMs);
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
