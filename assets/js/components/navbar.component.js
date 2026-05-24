/**
 * navbar.component.js
 * Web Component <lumiere-navbar> — navegación principal para LUMIÈRE.
 * Shadow DOM · Mobile menu · Contador carrito · SPA routing · Store reactivo.
 *
 * Coloca en index.html:
 *   <lumiere-navbar></lumiere-navbar>
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import router from "../core/router.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAG_NAME = "lumiere-navbar";

const NAV_LINKS = [
  { label: "Inicio", path: "/" },
  { label: "Catálogo", path: "/catalog" },
  { label: "Novedades", path: "/catalog?sort=newest" },
  { label: "Ofertas", path: "/catalog?onSale=true" },
];

// ─── Estilos Shadow DOM ────────────────────────────────────────────────────────

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    position: sticky;
    top: 0;
    z-index: 1000;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  /* ── Barra principal ── */
  nav {
    background: rgba(250,248,245,.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(201,169,110,.18);
    transition: box-shadow .3s, background .3s;
  }

  nav.scrolled {
    box-shadow: 0 4px 24px rgba(26,26,46,.07);
    background: rgba(250,248,245,.98);
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1.25rem;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* ── Logo ── */
  .logo {
    flex-shrink: 0;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    line-height: 1;
    cursor: pointer;
  }

  .logo-name {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 1.375rem;
    font-weight: 300;
    letter-spacing: .28em;
    text-transform: uppercase;
    color: #1a1a2e;
  }

  .logo-sub {
    font-size: .5rem;
    font-weight: 400;
    letter-spacing: .32em;
    text-transform: uppercase;
    color: #c9a96e;
    margin-top: 1px;
  }

  /* ── Links desktop ── */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0;
    list-style: none;
    margin-left: 2rem;
    flex: 1;
  }

  .nav-links a {
    display: block;
    padding: .35rem .9rem;
    font-size: .78rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #1a1a2e;
    text-decoration: none;
    position: relative;
    transition: color .2s;
    cursor: pointer;
  }

  .nav-links a::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: .9rem;
    right: .9rem;
    height: 1px;
    background: #c9a96e;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform .25s cubic-bezier(.4,0,.2,1);
  }

  .nav-links a:hover,
  .nav-links a.active {
    color: #c9a96e;
  }

  .nav-links a.active::after,
  .nav-links a:hover::after {
    transform: scaleX(1);
  }

  /* ── Acciones derecha ── */
  .actions {
    display: flex;
    align-items: center;
    gap: .25rem;
    margin-left: auto;
  }

  .icon-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 50%;
    color: #1a1a2e;
    transition: background .2s, color .2s;
  }

  .icon-btn:hover {
    background: rgba(201,169,110,.1);
    color: #c9a96e;
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Badge carrito ── */
  .cart-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 99px;
    background: #c9a96e;
    color: #fff;
    font-size: .6rem;
    font-weight: 700;
    letter-spacing: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transform: scale(0);
    transition: transform .2s cubic-bezier(.34,1.56,.64,1);
    pointer-events: none;
  }

  .cart-badge.visible {
    transform: scale(1);
  }

  .cart-badge.bump {
    animation: bump .3s cubic-bezier(.34,1.56,.64,1);
  }

  @keyframes bump {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.45); }
    100% { transform: scale(1); }
  }

  /* ── User pill ── */
  .user-pill {
    display: flex;
    align-items: center;
    gap: .4rem;
    padding: .3rem .75rem .3rem .45rem;
    border: 1px solid rgba(201,169,110,.35);
    border-radius: 99px;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: .72rem;
    font-weight: 500;
    letter-spacing: .04em;
    color: #1a1a2e;
    transition: background .2s, border-color .2s;
  }

  .user-pill:hover {
    background: rgba(201,169,110,.08);
    border-color: #c9a96e;
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #1a1a2e;
    color: #faf8f5;
    font-size: .65rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: .02em;
  }

  /* ── Divisor ── */
  .divider {
    width: 1px;
    height: 20px;
    background: rgba(201,169,110,.3);
    margin: 0 .25rem;
  }

  /* ── Hamburger ── */
  .hamburger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background .2s;
  }

  .hamburger:hover { background: rgba(201,169,110,.1); }

  .hamburger span {
    display: block;
    height: 1.5px;
    background: #1a1a2e;
    border-radius: 2px;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s, width .3s;
    transform-origin: center;
  }

  .hamburger span:nth-child(1) { width: 22px; }
  .hamburger span:nth-child(2) { width: 16px; }
  .hamburger span:nth-child(3) { width: 20px; }

  .hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); width: 22px; }
  .hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); width: 22px; }

  /* ── Mobile menu drawer ── */
  .mobile-menu {
    position: fixed;
    inset: 64px 0 0 0;
    background: #faf8f5;
    z-index: 999;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1.25rem 2rem;
    gap: 0;
    transform: translateX(100%);
    transition: transform .35s cubic-bezier(.4,0,.2,1);
    overflow-y: auto;
    border-top: 1px solid rgba(201,169,110,.18);
  }

  .mobile-menu.open {
    transform: translateX(0);
  }

  .mobile-menu-links {
    list-style: none;
    display: flex;
    flex-direction: column;
  }

  .mobile-menu-links a {
    display: flex;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(201,169,110,.12);
    font-size: .9rem;
    font-weight: 400;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #1a1a2e;
    text-decoration: none;
    cursor: pointer;
    transition: color .2s, padding-left .2s;
  }

  .mobile-menu-links a:hover,
  .mobile-menu-links a.active {
    color: #c9a96e;
    padding-left: .5rem;
  }

  .mobile-menu-links a.active {
    font-weight: 500;
  }

  .mobile-actions {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  .mobile-btn {
    display: block;
    padding: .85rem 1.25rem;
    border-radius: .5rem;
    font-family: inherit;
    font-size: .78rem;
    font-weight: 500;
    letter-spacing: .1em;
    text-transform: uppercase;
    text-align: center;
    cursor: pointer;
    border: none;
    transition: background .2s, color .2s;
  }

  .mobile-btn-primary {
    background: #1a1a2e;
    color: #faf8f5;
  }
  .mobile-btn-primary:hover { background: #2a2a4e; }

  .mobile-btn-outline {
    background: transparent;
    color: #1a1a2e;
    border: 1px solid rgba(26,26,46,.3);
  }
  .mobile-btn-outline:hover { border-color: #c9a96e; color: #c9a96e; }

  /* ── Backdrop mobile ── */
  .backdrop {
    display: none;
    position: fixed;
    inset: 64px 0 0 0;
    background: rgba(26,26,46,.35);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 998;
    opacity: 0;
    transition: opacity .3s;
  }
  .backdrop.open    { display: block; }
  .backdrop.visible { opacity: 1; }

  /* ── Search bar ── */
  .search-wrap {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: #faf8f5;
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
    gap: .75rem;
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s;
    z-index: 10;
  }

  .search-wrap.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: .9rem;
    color: #1a1a2e;
    outline: none;
    letter-spacing: .02em;
  }

  .search-input::placeholder { color: rgba(26,26,46,.35); }

  .search-line {
    flex: 1;
    position: relative;
  }

  .search-line::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, #c9a96e, #1a1a2e);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .divider   { display: none; }
    .user-pill { display: none; }
    .hamburger { display: flex; }
    .desktop-user { display: none; }
  }

  @media (min-width: 769px) {
    .hamburger    { display: none; }
    .mobile-menu  { display: none; }
    .backdrop     { display: none !important; }
    .desktop-user { display: flex; }
  }
`;

// ─── Iconos SVG ────────────────────────────────────────────────────────────────

const ICONS = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  orders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// ─── Web Component ─────────────────────────────────────────────────────────────

class LumiereNavbar extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._busCtx = null;
    this._mobileOpen = false;
    this._searchOpen = false;
    this._cartCount = 0;
    this._user = null;
    this._currentPath = "/";
    this._unsubs = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    this._busCtx = bus.context?.("NavbarComponent") ?? null;
    this._render();
    this._hydrate();
    this._syncFromStore();
    this._bindStore();
    this._bindBus();
    this._bindScroll();
  }

  disconnectedCallback() {
    this._unsubs.forEach((fn) => fn?.());
    this._busCtx?.destroy?.();
    window.removeEventListener("scroll", this._onScroll);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <nav part="nav">
        <div class="container">

          <a class="logo" data-route="/" aria-label="LUMIÈRE inicio">
            <span class="logo-name">Lumière</span>
            <span class="logo-sub">Fashion &amp; Style</span>
          </a>

          <ul class="nav-links" role="list">
            ${NAV_LINKS.map(
              ({ label, path }) => `
              <li><a data-route="${path}">${label}</a></li>
            `,
            ).join("")}
          </ul>

          <div class="actions">
            <button class="icon-btn" id="btn-search" aria-label="Buscar">
              ${ICONS.search}
            </button>

            <div class="divider desktop-user"></div>

            <button class="icon-btn" id="btn-cart" aria-label="Ver carrito">
              ${ICONS.cart}
              <span class="cart-badge" id="cart-badge" aria-live="polite">0</span>
            </button>

            <div class="desktop-user" id="auth-area"></div>

            <button class="hamburger" id="hamburger" aria-label="Menú" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        <!-- Search bar superpuesta -->
        <div class="search-wrap" id="search-bar" role="search">
          <button class="icon-btn" id="btn-search-close" aria-label="Cerrar búsqueda">
            ${ICONS.close}
          </button>
          <div class="search-line">
            <input
              class="search-input"
              id="search-input"
              type="search"
              placeholder="Buscar prendas, categorías…"
              autocomplete="off"
              aria-label="Buscar productos"
            />
          </div>
        </div>
      </nav>

      <!-- Mobile menu -->
      <div class="mobile-menu" id="mobile-menu" aria-hidden="true" role="dialog" aria-label="Menú de navegación">
        <ul class="mobile-menu-links" role="list">
          ${NAV_LINKS.map(
            ({ label, path }) => `
            <li><a data-route="${path}">${label}</a></li>
          `,
          ).join("")}
        </ul>
        <div class="mobile-actions" id="mobile-actions"></div>
      </div>

      <div class="backdrop" id="backdrop"></div>
    `;
  }

  // ── Hydrate ────────────────────────────────────────────────────────────────

  _hydrate() {
    const $ = (sel) => this._shadow.querySelector(sel);
    const $$ = (sel) => this._shadow.querySelectorAll(sel);

    $(".logo").addEventListener("click", (e) => {
      e.preventDefault();
      this._navigate("/");
    });

    $$(".nav-links a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        this._navigate(a.dataset.route);
      });
    });

    $$(".mobile-menu-links a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        this._closeMobile();
        this._navigate(a.dataset.route);
      });
    });

    $("#btn-search").addEventListener("click", () => this._openSearch());
    $("#btn-search-close").addEventListener("click", () => this._closeSearch());

    const searchInput = $("#search-input");
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = searchInput.value.trim();
        if (q) {
          this._closeSearch();
          this._navigate(`/catalog?search=${encodeURIComponent(q)}`);
        }
      }
      if (e.key === "Escape") this._closeSearch();
    });

    $("#btn-cart").addEventListener("click", () => {
      this._closeMobile();
      this._navigate("/cart");
    });
    $("#hamburger").addEventListener("click", () => {
      this._mobileOpen ? this._closeMobile() : this._openMobile();
    });
    $("#backdrop").addEventListener("click", () => this._closeMobile());
  }

  // ── Sync store inicial ─────────────────────────────────────────────────────

  _syncFromStore() {
    const state = store.getState();
    this._setCartCount(state.cart?.count ?? 0);
    const userState = state.user ?? {};
    this._user = userState.isAuthenticated ? userState.profile : null;
    this._renderAuthArea();
    this._setActiveLink(window.location.hash.slice(1) || "/");
  }

  // ── Store reactivo ─────────────────────────────────────────────────────────

  _bindStore() {
    const unsubCart = store.subscribe("cart", (s) =>
      this._setCartCount(s?.count ?? 0),
    );
    const unsubUser = store.subscribe("user", (s) => {
      this._user = s?.isAuthenticated ? s.profile : null;
      this._renderAuthArea();
    });
    this._unsubs.push(unsubCart, unsubUser);
  }

  // ── Bus de eventos ─────────────────────────────────────────────────────────

  _bindBus() {
    if (EVENTS.ROUTE_CHANGED) {
      bus.on(EVENTS.ROUTE_CHANGED, ({ path } = {}) => {
        this._currentPath = path ?? "/";
        this._setActiveLink(path);
        if (this._mobileOpen) this._closeMobile();
      });
    }
    if (EVENTS.CART_ITEM_ADDED) {
      bus.on(EVENTS.CART_ITEM_ADDED, () => this._bumpCartBadge());
    }
  }

  // ── Scroll shadow ──────────────────────────────────────────────────────────

  _bindScroll() {
    this._onScroll = () => {
      this._shadow
        .querySelector("nav")
        ?.classList.toggle("scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", this._onScroll, { passive: true });
    this._onScroll();
  }

  // ── Cart badge ─────────────────────────────────────────────────────────────

  _setCartCount(count) {
    const badge = this._shadow.getElementById("cart-badge");
    if (!badge) return;
    this._cartCount = count;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.toggle("visible", count > 0);
  }

  _bumpCartBadge() {
    const badge = this._shadow.getElementById("cart-badge");
    if (!badge) return;
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
    badge.addEventListener(
      "animationend",
      () => badge.classList.remove("bump"),
      { once: true },
    );
  }

  // ── Auth area ──────────────────────────────────────────────────────────────

  _renderAuthArea() {
    const area = this._shadow.getElementById("auth-area");
    const mobileArea = this._shadow.getElementById("mobile-actions");
    if (!area || !mobileArea) return;

    if (this._user) {
      const initials =
        `${this._user.firstName?.[0] ?? ""}${this._user.lastName?.[0] ?? ""}`.toUpperCase();
      const name = this._user.firstName ?? "Mi cuenta";

      area.innerHTML = `
        <div style="display:flex;align-items:center;gap:.25rem;">
          <button class="icon-btn" id="btn-orders" title="Mis pedidos" aria-label="Mis pedidos">
            ${ICONS.orders}
          </button>
          <button class="user-pill" id="btn-logout">
            <span class="user-avatar">${initials}</span>
            <span style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
          </button>
        </div>
      `;
      area
        .querySelector("#btn-orders")
        ?.addEventListener("click", () => this._navigate("/orders"));
      area.querySelector("#btn-logout")?.addEventListener("click", () => {
        bus.emit(EVENTS.USER_LOGOUT_REQUEST ?? "lumiere:logout", {});
      });

      mobileArea.innerHTML = `
        <button class="mobile-btn mobile-btn-outline" id="m-orders">Mis pedidos</button>
        <button class="mobile-btn mobile-btn-primary"  id="m-logout">Cerrar sesión</button>
      `;
      mobileArea.querySelector("#m-orders")?.addEventListener("click", () => {
        this._closeMobile();
        this._navigate("/orders");
      });
      mobileArea.querySelector("#m-logout")?.addEventListener("click", () => {
        this._closeMobile();
        bus.emit(EVENTS.USER_LOGOUT_REQUEST ?? "lumiere:logout", {});
      });
    } else {
      area.innerHTML = `
        <div style="display:flex;gap:.5rem;align-items:center;">
          <button class="user-pill" id="btn-login">
            <span class="user-avatar" style="background:#c9a96e;display:flex;align-items:center;justify-content:center;">
              ${ICONS.user}
            </span>
            <span>Ingresar</span>
          </button>
        </div>
      `;
      area
        .querySelector("#btn-login")
        ?.addEventListener("click", () => this._navigate("/login"));

      mobileArea.innerHTML = `
        <button class="mobile-btn mobile-btn-primary" id="m-login">Iniciar sesión</button>
        <button class="mobile-btn mobile-btn-outline" id="m-register">Crear cuenta</button>
      `;
      mobileArea.querySelector("#m-login")?.addEventListener("click", () => {
        this._closeMobile();
        this._navigate("/login");
      });
      mobileArea.querySelector("#m-register")?.addEventListener("click", () => {
        this._closeMobile();
        this._navigate("/register");
      });
    }
  }

  // ── Active link ────────────────────────────────────────────────────────────

  _setActiveLink(path) {
    const cleanPath = (path ?? "/").split("?")[0];
    this._shadow
      .querySelectorAll(".nav-links a, .mobile-menu-links a")
      .forEach((a) => {
        const linkPath = (a.dataset.route ?? "/").split("?")[0];
        const active =
          linkPath === cleanPath ||
          (linkPath !== "/" && cleanPath.startsWith(linkPath));
        a.classList.toggle("active", active);
      });
  }

  // ── Navegación SPA ─────────────────────────────────────────────────────────

  _navigate(path) {
    if (!path) return;
    const [route, qs] = path.split("?");
    router.navigate(
      route,
      qs ? Object.fromEntries(new URLSearchParams(qs)) : {},
    );
  }

  // ── Mobile menu ────────────────────────────────────────────────────────────

  _openMobile() {
    this._mobileOpen = true;
    const menu = this._shadow.getElementById("mobile-menu");
    const backdrop = this._shadow.getElementById("backdrop");
    const hamburger = this._shadow.getElementById("hamburger");
    menu?.classList.add("open");
    menu?.setAttribute("aria-hidden", "false");
    hamburger?.classList.add("open");
    hamburger?.setAttribute("aria-expanded", "true");
    backdrop?.classList.add("open");
    requestAnimationFrame(() => backdrop?.classList.add("visible"));
    document.body.style.overflow = "hidden";
  }

  _closeMobile() {
    this._mobileOpen = false;
    const menu = this._shadow.getElementById("mobile-menu");
    const backdrop = this._shadow.getElementById("backdrop");
    const hamburger = this._shadow.getElementById("hamburger");
    menu?.classList.remove("open");
    menu?.setAttribute("aria-hidden", "true");
    hamburger?.classList.remove("open");
    hamburger?.setAttribute("aria-expanded", "false");
    backdrop?.classList.remove("visible");
    setTimeout(() => backdrop?.classList.remove("open"), 300);
    document.body.style.overflow = "";
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  _openSearch() {
    this._searchOpen = true;
    const bar = this._shadow.getElementById("search-bar");
    const input = this._shadow.getElementById("search-input");
    bar?.classList.add("open");
    requestAnimationFrame(() => input?.focus());
  }

  _closeSearch() {
    this._searchOpen = false;
    this._shadow.getElementById("search-bar")?.classList.remove("open");
  }
}

// ─── Registro ──────────────────────────────────────────────────────────────────

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, LumiereNavbar);
}

export default LumiereNavbar;
