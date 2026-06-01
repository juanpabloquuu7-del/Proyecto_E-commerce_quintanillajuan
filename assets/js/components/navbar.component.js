/**
 * navbar.component.js
 * Web Component <lumiere-navbar> — navegación principal para LUMIÈRE.
 * Shadow DOM · Mobile menu · Contador carrito · SPA routing · Store reactivo.
 *
 * Coloca en index.html:
 * <lumiere-navbar></lumiere-navbar>
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import Router from "../core/router.js";

// ───────── Constantes ───────────────────────────────────────────────────────

const TAG_NAME = "lumiere-navbar";

const NAV_LINKS = [
  { label: "Inicio", path: "/" },
  { label: "Catálogo", path: "/catalog" },
  { label: "Novedades", path: "/catalog?sort=newest" },
  { label: "Ofertas", path: "/catalog?onSale=true" },
  { label: "Panel Admin", path: "/admin/login" },
  { label: "reportes ventas", path: "/report" }
];

// ───────── Estilos Shadow DOM ──────────────────────────────────────────────

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    position: sticky;
    top: 0;
    z-index: 1000;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    background-color: var(--color-primary, #1a1a2e);
    color: var(--color-white, #ffffff);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .brand {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    color: var(--color-off-white, #faf8f5);
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
  }

  .nav-links a {
    color: var(--color-gray-300, #c8c2ba);
    text-decoration: none;
    font-size: 0.95rem;
    transition: color 0.2s ease;
  }

  .nav-links a:hover, .nav-links a.active {
    color: var(--color-accent, #c9a96e);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .icon-btn {
    background: none;
    border: none;
    color: currentColor;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
  }

  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: var(--color-accent, #c9a96e);
    color: var(--color-primary-dark, #0f0f1a);
    font-size: 0.75rem;
    font-weight: bold;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Bar de bÃºsqueda desplegable */
  .search-bar {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background-color: var(--color-primary-light, #16213e);
    padding: 0.75rem 2rem;
    display: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .search-bar.open {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-gray-400, #a09890);
    color: white;
    padding: 0.5rem;
    font-size: 1rem;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-accent, #c9a96e);
  }

  /* MenÃº MÃ³vil */
  .hamburger {
    display: none;
  }

  @media (max-width: 768px) {
    .nav-links { display: none; }
    .hamburger { display: block; }
  }
`;

export class LumiereNavbar extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._cartCount = 0;
    this._searchOpen = false;
    this._mobileOpen = false;
  }

  connectedCallback() {
    this.render();
    this._setupListeners();

    // Suscribirse al store para actualizar el contador del carrito reactivamente
    this._unsubscribeCart = store.subscribe("cart", (cartState) => {
      this._cartCount = cartState?.count || 0;
      const badge = this._shadow.getElementById("cart-badge");
      if (badge) {
        badge.textContent = this._cartCount;
        badge.style.display = this._cartCount > 0 ? "flex" : "none";
      }
    });
  }

  disconnectedCallback() {
    if (this._unsubscribeCart) this._unsubscribeCart();
  }

  _setupListeners() {
    // RedirecciÃ³n del logo principal
    this._shadow.getElementById("logo")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "/";
    });

    // DelegaciÃ³n de clics para los enlaces de navegaciÃ³n con data-route
    this._shadow.querySelector(".nav-links")?.addEventListener("click", (e) => {
      const link = e.target.closest("[data-route]");
      if (link) {
        e.preventDefault();
        window.location.hash = link.getAttribute("data-route");
      }
    });

    // Control del botÃ³n de la bolsa/carrito lateral
    this._shadow.getElementById("cart-btn")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("lumiere:open-cart"));
    });

    // Mostrar y ocultar barra de bÃºsqueda interna
    this._shadow.getElementById("search-btn")?.addEventListener("click", () => {
      if (this._searchOpen) {
        this._closeSearch();
      } else {
        this._openSearch();
      }
    });

    this._shadow
      .getElementById("close-search")
      ?.addEventListener("click", () => {
        this._closeSearch();
      });

    // === AGREGADO: CAPTURA REACTIVA DE BÃšSQUEDA EN EL STORE ===
    const searchInput = this._shadow.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value;

        // Si el usuario no estÃ¡ en el catÃ¡logo y empieza a escribir, lo redirigimos automÃ¡ticamente
        if (window.location.hash.split("?")[0] !== "#/catalog") {
          window.location.hash = "/catalog";
        }

        // Actualizamos los filtros globales en el store
        store.setState("filters", {
          ...store.getState("filters"),
          search: query,
        });
      });
    }
  }

  // â”€â”€ Operaciones de BÃºsqueda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _openSearch() {
    this._searchOpen = true;
    const bar = this._shadow.getElementById("search-bar");
    const input = this._shadow.getElementById("search-input");
    bar?.classList.add("open");
    requestAnimationFrame(() => input?.focus());
  }

  _closeSearch() {
    this._searchOpen = false;
    const bar = this._shadow.getElementById("search-bar");
    const input = this._shadow.getElementById("search-input");

    if (bar) bar.classList.remove("open");
    if (input) {
      input.value = ""; // Limpiamos el texto al cerrar
      // Limpiamos tambiÃ©n el filtro de bÃºsqueda del store
      store.setState("filters", {
        ...store.getState("filters"),
        search: "",
      });
    }
  }

  // â”€â”€ Renderizado Principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  render() {
    const currentHash = window.location.hash || "#/";

    const linksHTML = NAV_LINKS.map((link) => {
      const isActive =
        currentHash.replace("#", "") === link.path ? "active" : "";
      return `<li><a href="#" data-route="${link.path}" class="${isActive}">${link.label}</a></li>`;
    }).join("");

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      
      <nav>
        <button id="hamburger" class="hamburger icon-btn" aria-label="MenÃº de navegaciÃ³n mÃ³vil">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>

        <a href="#" id="logo" class="brand">LUMIÃˆRE</a>

        <ul class="nav-links">
          ${linksHTML}
        </ul>

        <div class="actions">
          <button id="search-btn" class="icon-btn" aria-label="Buscar productos">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </button>

          <button id="cart-btn" class="icon-btn" aria-label="Ver bolsa de compras">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            <span id="cart-badge" class="badge" style="display: ${this._cartCount > 0 ? "flex" : "none"};">${this._cartCount}</span>
          </button>
        </div>

        <div id="search-bar" class="search-bar">
          <input type="text" id="search-input" class="search-input" placeholder="Buscar por colecciones, prendas, calzado..." />
          <button id="close-search" class="icon-btn" aria-label="Cerrar bÃºsqueda">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </nav>
    `;
  }
}

customElements.define(TAG_NAME, LumiereNavbar);
export default LumiereNavbar;

