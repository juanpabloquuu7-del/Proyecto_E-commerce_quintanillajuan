/**
 * router.js — SPA Hash-Based Router
 * ─────────────────────────────────────────────────────────────
 * Router cliente sin dependencias. Maneja rutas hash (#/path),
 * lazy loading de páginas, params dinámicos, guards de auth,
 * scroll restoration y renderizado en #app.
 * ─────────────────────────────────────────────────────────────
 */

import bus, { EVENTS } from "./events.js";
import store from "./store.js";

// ─── Constantes ───────────────────────────────────────────────

/** Selector del contenedor de renderizado */
const APP_SELECTOR = "#app";

/** Ruta por defecto cuando no hay hash */
const DEFAULT_ROUTE = "/";

/** Ruta de error 404 */
const NOT_FOUND_ROUTE = "/404";

/** Transición entre páginas (ms) */
const TRANSITION_DURATION = 220;

// ─── Definición de Rutas ──────────────────────────────────────

/**
 * @typedef {Object} RouteDefinition
 * @property {string}            path       — Patrón de ruta (soporta :param)
 * @property {Function}          loader     — Import dinámico de la página
 * @property {string}            title      — Título de la pestaña
 * @property {boolean}           [auth]     — Requiere autenticación
 * @property {boolean}           [guest]    — Solo para no autenticados
 * @property {string}            [redirect] — Redirigir a esta ruta
 * @property {Object}            [meta]     — Metadatos adicionales
 */

/** @type {RouteDefinition[]} */
const ROUTES = [
  {
    path: "/",
    loader: () => import("../pages/home.page.js"),
    title: "LUMIÈRE — Moda & Estilo Contemporáneo",
    meta: { description: "Descubre la nueva colección de moda contemporánea." },
  },
  {
    path: "/catalog",
    loader: () => import("../pages/catalog.page.js"),
    title: "Catálogo — LUMIÈRE",
    meta: { description: "Explora nuestra colección completa." },
  },
  {
    path: "/product/:id",
    loader: () => import("../pages/product-detail.page.js"),
    title: "Producto — LUMIÈRE",
    meta: { description: "Detalle del producto." },
  },
  {
    path: "/cart",
    loader: () => import("../pages/cart.page.js"),
    title: "Carrito — LUMIÈRE",
    meta: { description: "Tu carrito de compras." },
  },
  {
    path: "/checkout",
    loader: () => import("../pages/checkout.page.js"),
    title: "Checkout — LUMIÈRE",
    auth: true,
    meta: { description: "Finaliza tu compra." },
  },
  {
    path: "/orders",
    loader: () => import("../pages/orders.page.js"),
    title: "Mis Pedidos — LUMIÈRE",
    auth: true,
    meta: { description: "Historial de tus pedidos." },
  },
  {
    path: "/login",
    loader: () => import("../pages/login.page.js"),
    title: "Iniciar Sesión — LUMIÈRE",
    guest: true,
    meta: { description: "Accede a tu cuenta." },
  },
  {
    path: "/register",
    loader: () => import("../pages/register.page.js"),
    title: "Crear Cuenta — LUMIÈRE",
    guest: true,
    meta: { description: "Crea tu cuenta LUMIÈRE." },
  },
  {
    path: "/404",
    loader: () => Promise.resolve({ default: { render: render404 } }),
    title: "Página no encontrada — LUMIÈRE",
  },
];

// ─── Clase Router ─────────────────────────────────────────────

class Router {
  constructor() {
    /**
     * Ruta actual resuelta.
     * @type {ResolvedRoute|null}
     * @private
     */
    this._current = null;

    /**
     * Caché de módulos de página ya importados.
     * Map<path, Module>
     * @private
     */
    this._cache = new Map();

    /**
     * Historial de posiciones de scroll por ruta.
     * Map<hash, number>
     * @private
     */
    this._scrollPositions = new Map();

    /**
     * Si hay una navegación en curso (evita solapamientos).
     * @private
     */
    this._navigating = false;

    /**
     * Referencia al contenedor #app.
     * @type {HTMLElement|null}
     * @private
     */
    this._container = null;

    /**
     * Guards de navegación registrados.
     * @type {Function[]}
     * @private
     */
    this._guards = [];

    /**
     * Hooks afterEach registrados.
     * @type {Function[]}
     * @private
     */
    this._afterHooks = [];
  }

  // ─── Inicialización ───────────────────────────────────────────

  /**
   * Inicializa el router: obtiene el container, enlaza eventos
   * y navega a la ruta actual del hash.
   */
  init() {
    this._container = document.querySelector(APP_SELECTOR);

    if (!this._container) {
      console.error(
        `[Router] Contenedor "${APP_SELECTOR}" no encontrado en el DOM.`,
      );
      return;
    }

    // Escuchar cambios de hash
    window.addEventListener("hashchange", this._onHashChange.bind(this));

    // Escuchar popstate (navegación con back/forward)
    window.addEventListener("popstate", this._onHashChange.bind(this));

    // Delegación de clicks en links internos [data-route] y [href^="#/"]
    document.addEventListener("click", this._onLinkClick.bind(this));

    // Escuchar evento global de navegación del EventBus
    bus.on(EVENTS.NAVIGATE, ({ route } = {}) => {
      if (route) this.push(route);
    });

    // Navegar a la ruta inicial
    this._navigate(this._getCurrentHash());

    console.info("[Router] Inicializado.");
  }

  // ─── Navegación Pública ───────────────────────────────────────

  /**
   * Navega a una ruta programáticamente.
   * Equivale a un <a href="#/ruta">.
   *
   * @param {string} path — Ruta sin # (ej: '/catalog', '/product/42')
   *
   * @example
   * router.push('/catalog');
   * router.push('/product/123');
   * router.push('/catalog?category=mujer');
   */
  push(path) {
    const normalized = this._normalizePath(path);
    window.location.hash = normalized;
  }

  /**
   * Reemplaza la ruta actual sin añadir una entrada al historial.
   * @param {string} path
   */
  replace(path) {
    const normalized = this._normalizePath(path);
    const url = `${window.location.pathname}${window.location.search}#${normalized}`;
    window.history.replaceState(null, "", url);
    this._navigate(normalized);
  }

  /**
   * Navega al paso anterior del historial del navegador.
   */
  back() {
    window.history.back();
  }

  /**
   * Retorna la ruta actual resuelta.
   * @returns {ResolvedRoute|null}
   */
  get current() {
    return this._current ? { ...this._current } : null;
  }

  /**
   * Retorna los params de la ruta actual.
   * @returns {Object}
   */
  get params() {
    return this._current?.params ?? {};
  }

  /**
   * Retorna los query params de la ruta actual.
   * @returns {Object}
   */
  get query() {
    return this._current?.query ?? {};
  }

  // ─── Guards ───────────────────────────────────────────────────

  /**
   * Registra un guard de navegación (beforeEach).
   * El guard puede cancelar o redirigir la navegación.
   *
   * @param {Function} guard — (to, from) => string|false|undefined
   *   Retorna:
   *   - string  → redirige a esa ruta
   *   - false   → cancela la navegación
   *   - nada    → permite la navegación
   *
   * @example
   * router.beforeEach((to) => {
   *   if (to.auth && !store.getState('user').isAuthenticated) {
   *     return '/login';
   *   }
   * });
   */
  beforeEach(guard) {
    if (typeof guard === "function") this._guards.push(guard);
  }

  /**
   * Registra un hook que se ejecuta DESPUÉS de cada navegación.
   * @param {Function} hook — (to, from) => void
   */
  afterEach(hook) {
    if (typeof hook === "function") this._afterHooks.push(hook);
  }

  // ─── Núcleo de Navegación ─────────────────────────────────────

  /**
   * Maneja el evento hashchange.
   * @private
   */
  _onHashChange() {
    this._navigate(this._getCurrentHash());
  }

  /**
   * Obtiene la ruta actual del hash de la URL.
   * @returns {string}
   * @private
   */
  _getCurrentHash() {
    const hash = window.location.hash;
    // Extraer solo la parte del path (antes del ?)
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    return raw.split("?")[0] || DEFAULT_ROUTE;
  }

  /**
   * Obtiene los query params del hash actual.
   * @returns {Object}
   * @private
   */
  _getCurrentQuery() {
    const hash = window.location.hash;
    const qmark = hash.indexOf("?");
    if (qmark === -1) return {};
    const qs = hash.slice(qmark + 1);
    return Object.fromEntries(new URLSearchParams(qs));
  }

  /**
   * Motor principal de navegación.
   * @param {string} path — Ruta normalizada
   * @private
   */
  async _navigate(path) {
    // Evitar navegaciones solapadas
    if (this._navigating) return;
    this._navigating = true;

    try {
      // 1. Guardar scroll de la ruta anterior
      this._saveScroll();

      // 2. Resolver ruta (match + params)
      const resolved = this._resolve(path);

      // 3. Ejecutar guards beforeEach
      const guardResult = await this._runGuards(resolved, this._current);
      if (guardResult === false) {
        // Guard canceló la navegación; restaurar el hash anterior
        if (this._current) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}#${this._current.path}`,
          );
        }
        return;
      }
      if (typeof guardResult === "string") {
        // Guard redirige a otra ruta
        this._navigating = false;
        this.replace(guardResult);
        return;
      }

      const prev = this._current;
      this._current = resolved;

      // 4. Actualizar store con la ruta activa
      store.setState("ui", { currentRoute: resolved.name }, { silent: true });

      // 5. Actualizar el <title>
      document.title = resolved.route.title || "LUMIÈRE";

      // 6. Actualizar meta description
      this._updateMetaDescription(resolved.route.meta?.description);

      // 7. Actualizar estado activo del navbar
      this._updateNavActiveState(resolved.path);

      // 8. Transición de salida + render de la nueva página
      await this._renderPage(resolved);

      // 9. Restaurar scroll
      this._restoreScroll(resolved.fullPath);

      // 10. Emitir evento de ruta cambiada
      bus.emit(EVENTS.ROUTE_CHANGED, {
        route: resolved.name,
        path: resolved.path,
        params: resolved.params,
        query: resolved.query,
      });

      // 11. Hooks afterEach
      this._runAfterHooks(resolved, prev);
    } catch (err) {
      console.error("[Router] Error de navegación:", err);
      this._renderError(err);
    } finally {
      this._navigating = false;
    }
  }

  // ─── Resolución de Rutas ──────────────────────────────────────

  /**
   * Resuelve una ruta en su definición y extrae params.
   *
   * @param {string} path
   * @returns {ResolvedRoute}
   * @private
   *
   * @typedef {Object} ResolvedRoute
   * @property {RouteDefinition} route
   * @property {string}          path      — Path sin query string
   * @property {string}          fullPath  — Path completo con query string
   * @property {string}          name      — Identificador limpio ('home', 'catalog'...)
   * @property {Object}          params    — Params dinámicos { id: '123' }
   * @property {Object}          query     — Query params { category: 'mujer' }
   * @property {boolean}         auth      — Requiere auth
   * @property {boolean}         guest     — Solo guest
   */
  _resolve(path) {
    const query = this._getCurrentQuery();
    const fullPath = window.location.hash.slice(1) || DEFAULT_ROUTE;

    for (const route of ROUTES) {
      const params = this._matchPath(route.path, path);
      if (params !== null) {
        return {
          route,
          path,
          fullPath,
          name: this._routeToName(route.path),
          params,
          query,
          auth: route.auth ?? false,
          guest: route.guest ?? false,
        };
      }
    }

    // Ruta 404
    const notFound = ROUTES.find((r) => r.path === NOT_FOUND_ROUTE);
    return {
      route: notFound,
      path: NOT_FOUND_ROUTE,
      fullPath: NOT_FOUND_ROUTE,
      name: "404",
      params: {},
      query: {},
      auth: false,
      guest: false,
    };
  }

  /**
   * Intenta hacer match de un patrón de ruta con un path real.
   * Soporta segmentos dinámicos :param.
   *
   * @param {string} pattern — Ej: '/product/:id'
   * @param {string} path    — Ej: '/product/42'
   * @returns {Object|null}  — Params extraídos o null si no hay match
   * @private
   *
   * @example
   * _matchPath('/product/:id', '/product/42')  → { id: '42' }
   * _matchPath('/catalog', '/product/42')       → null
   */
  _matchPath(pattern, path) {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i];
      const rp = pathParts[i];

      if (pp.startsWith(":")) {
        // Segmento dinámico
        params[pp.slice(1)] = decodeURIComponent(rp);
      } else if (pp !== rp) {
        // Segmento estático no coincide
        return null;
      }
    }

    return params;
  }

  /**
   * Convierte un path pattern en un nombre de ruta simple.
   * @param {string} pattern
   * @returns {string}
   * @private
   */
  _routeToName(pattern) {
    if (pattern === "/") return "home";
    if (pattern === "/404") return "404";
    // '/product/:id' → 'product-detail'
    return pattern
      .slice(1)
      .replace(/\/:[\w]+/g, "-detail")
      .replace(/\//g, "-");
  }

  // ─── Guards ───────────────────────────────────────────────────

  /**
   * Ejecuta todos los guards registrados en secuencia.
   * Detiene en el primero que retorne string o false.
   *
   * @param {ResolvedRoute} to
   * @param {ResolvedRoute|null} from
   * @returns {Promise<string|false|undefined>}
   * @private
   */
  async _runGuards(to, from) {
    // Guard de autenticación nativo
    const authResult = this._authGuard(to);
    if (authResult !== undefined) return authResult;

    // Guards registrados externamente
    for (const guard of this._guards) {
      try {
        const result = await guard(to, from);
        if (result === false || typeof result === "string") return result;
      } catch (err) {
        console.error("[Router] Error en guard:", err);
      }
    }
  }

  /**
   * Guard de autenticación integrado.
   * @param {ResolvedRoute} to
   * @returns {string|undefined}
   * @private
   */
  _authGuard(to) {
    const { isAuthenticated } = store.getState("user");

    // Ruta protegida y no autenticado → redirigir al login
    if (to.auth && !isAuthenticated) {
      // Guardar la ruta de destino para redirigir tras el login
      sessionStorage.setItem("lumiere_redirect", to.fullPath);
      return "/login";
    }

    // Ruta solo para guests y está autenticado → redirigir al home
    if (to.guest && isAuthenticated) {
      return "/";
    }
  }

  /**
   * Ejecuta los hooks afterEach.
   * @private
   */
  _runAfterHooks(to, from) {
    this._afterHooks.forEach((hook) => {
      try {
        hook(to, from);
      } catch (err) {
        console.error("[Router] Error en afterEach hook:", err);
      }
    });
  }

  // ─── Renderizado ──────────────────────────────────────────────

  /**
   * Carga el módulo de página y lo renderiza en #app con transición.
   * @param {ResolvedRoute} resolved
   * @private
   */
  async _renderPage(resolved) {
    const container = this._container;
    if (!container) return;

    // — Transición de salida —
    container.style.transition = `opacity ${TRANSITION_DURATION}ms ease`;
    container.style.opacity = "0";

    // Esperar la transición de salida
    await this._wait(TRANSITION_DURATION);

    // — Mostrar skeleton mientras carga —
    container.innerHTML = this._skeletonHTML();
    container.style.opacity = "1";

    // — Lazy load del módulo de página —
    const module = await this._loadModule(resolved);
    const Page = module?.default;

    if (!Page || typeof Page.render !== "function") {
      console.error(
        `[Router] La página "${resolved.name}" no exporta un objeto con render().`,
      );
      container.innerHTML = this._errorHTML("Módulo de página inválido.");
      return;
    }

    // — Renderizar la página —
    let html;
    try {
      html = await Page.render(resolved.params, resolved.query);
    } catch (err) {
      console.error(`[Router] Error renderizando "${resolved.name}":`, err);
      container.innerHTML = this._errorHTML(err.message);
      return;
    }

    // — Inyectar HTML —
    container.innerHTML = html;

    // — Ejecutar script de hidratación de la página (si existe) —
    if (typeof Page.hydrate === "function") {
      try {
        await Page.hydrate(container, resolved.params, resolved.query);
      } catch (err) {
        console.error(
          `[Router] Error en hydrate() de "${resolved.name}":`,
          err,
        );
      }
    }

    // — Transición de entrada —
    container.style.opacity = "0";
    // Forzar reflow para que la transición se aplique
    void container.offsetHeight;
    container.style.opacity = "1";

    // Limpiar transición tras completarse
    await this._wait(TRANSITION_DURATION);
    container.style.transition = "";
  }

  /**
   * Carga el módulo de una página con caché.
   * Si ya fue importado, lo retorna del caché.
   *
   * @param {ResolvedRoute} resolved
   * @returns {Promise<Object>}
   * @private
   */
  async _loadModule(resolved) {
    const cacheKey = resolved.route.path;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    try {
      const module = await resolved.route.loader();
      this._cache.set(cacheKey, module);
      return module;
    } catch (err) {
      console.error(`[Router] Error cargando módulo "${cacheKey}":`, err);
      throw new Error(`No se pudo cargar la página "${resolved.name}".`);
    }
  }

  // ─── Scroll Restoration ───────────────────────────────────────

  /**
   * Guarda la posición de scroll de la ruta actual.
   * @private
   */
  _saveScroll() {
    if (this._current) {
      this._scrollPositions.set(this._current.fullPath, window.scrollY);
    }
  }

  /**
   * Restaura el scroll de una ruta visitada previamente,
   * o va al top si es una ruta nueva.
   * @param {string} fullPath
   * @private
   */
  _restoreScroll(fullPath) {
    const saved = this._scrollPositions.get(fullPath);
    if (saved !== undefined) {
      window.scrollTo({ top: saved, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  // ─── Delegación de Links ──────────────────────────────────────

  /**
   * Intercepta clicks en links internos para navegar sin recargar.
   * Soporta:
   *   <a href="#/catalog">
   *   <a data-route="/catalog">
   *   <button data-route="/cart">
   *
   * @param {MouseEvent} e
   * @private
   */
  _onLinkClick(e) {
    // Ignorar clicks con modificadores (abrir en tab nueva, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const target = e.target.closest('[data-route], a[href^="#/"]');
    if (!target) return;

    let path;

    if (target.dataset.route) {
      path = target.dataset.route;
      e.preventDefault();
    } else if (target.tagName === "A") {
      const href = target.getAttribute("href");
      if (href && href.startsWith("#/")) {
        path = href.slice(1); // quitar el #
        e.preventDefault();
      }
    }

    if (path) {
      this.push(path);
    }
  }

  // ─── Utilidades de UI ─────────────────────────────────────────

  /**
   * Marca el link activo en la navbar.
   * Busca elementos con [data-route] o a[href^="#/"] que coincidan.
   * @param {string} path
   * @private
   */
  _updateNavActiveState(path) {
    // Quitar estado activo de todos los links de nav
    document.querySelectorAll("[data-nav-link]").forEach((el) => {
      el.classList.remove("is-active");
      el.removeAttribute("aria-current");
    });

    // Activar el link que coincide con la ruta actual
    document
      .querySelectorAll(`[data-nav-link][data-route="${path}"]`)
      .forEach((el) => {
        el.classList.add("is-active");
        el.setAttribute("aria-current", "page");
      });
  }

  /**
   * Actualiza el meta tag description.
   * @param {string} [description]
   * @private
   */
  _updateMetaDescription(description) {
    if (!description) return;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }

  /**
   * Normaliza un path asegurando que empiece con /
   * y manejando query strings.
   * @param {string} path
   * @returns {string}
   * @private
   */
  _normalizePath(path) {
    if (!path) return DEFAULT_ROUTE;
    // Si ya tiene / al inicio, ok
    return path.startsWith("/") ? path : `/${path}`;
  }

  // ─── HTMLs de Estado ──────────────────────────────────────────

  /**
   * HTML del skeleton loader mientras carga la página.
   * @returns {string}
   * @private
   */
  _skeletonHTML() {
    return `
      <div class="container mx-auto px-4 py-12 animate-pulse" aria-hidden="true" aria-label="Cargando página...">
        <div class="skeleton h-8 w-48 mb-8 rounded"></div>
        <div class="products-grid">
          ${Array.from(
            { length: 8 },
            () => `
            <div class="skeleton-card">
              <div class="skeleton skeleton-image rounded mb-3"></div>
              <div class="skeleton skeleton-text rounded mb-2"></div>
              <div class="skeleton skeleton-text rounded w-3/4 mb-2"></div>
              <div class="skeleton skeleton-text rounded w-1/2"></div>
            </div>
          `,
          ).join("")}
        </div>
      </div>
    `;
  }

  /**
   * HTML de error de renderizado.
   * @param {string} [message]
   * @returns {string}
   * @private
   */
  _renderError(err) {
    if (this._container) {
      this._container.innerHTML = this._errorHTML(err?.message);
    }
  }

  /** @private */
  _errorHTML(message = "Ocurrió un error inesperado.") {
    return `
      <div class="empty-state" role="alert">
        <svg class="empty-state-icon text-red-400" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h2 class="empty-state-title">Error al cargar la página</h2>
        <p class="empty-state-desc">${message}</p>
        <button
          onclick="router.push('/')"
          class="btn btn-primary mt-2">
          Volver al inicio
        </button>
      </div>
    `;
  }

  // ─── Utilidades ───────────────────────────────────────────────

  /**
   * Retorna una promesa que resuelve tras N milisegundos.
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Página 404 ───────────────────────────────────────────────

/**
 * Módulo inline de la página 404.
 * No requiere archivo externo.
 */
function render404() {
  return `
    <main class="empty-state min-h-screen" role="main">
      <p class="font-display text-8xl font-light text-accent tracking-widest">404</p>
      <h1 class="empty-state-title text-3xl">Página no encontrada</h1>
      <p class="empty-state-desc">
        La página que buscas no existe o fue movida.<br>
        Explora nuestra colección o regresa al inicio.
      </p>
      <div class="flex flex-col sm:flex-row items-center gap-3 mt-2">
        <button
          data-route="/"
          class="btn btn-primary">
          Ir al inicio
        </button>
        <button
          data-route="/catalog"
          class="btn btn-outline">
          Ver catálogo
        </button>
      </div>
    </main>
  `;
}

// ─── Singleton ────────────────────────────────────────────────

/**
 * Instancia única del Router.
 * @type {Router}
 */
const router = new Router();

// Registrar guard de autenticación global
router.beforeEach((to) => {
  // Este guard está integrado en _authGuard, pero aquí
  // podemos añadir guards adicionales según crezca el proyecto.
});

// Hook afterEach: cerrar el menú mobile al navegar
router.afterEach(() => {
  store.setState("ui", { menuOpen: false }, { silent: true });
  bus.emit(EVENTS.MENU_CLOSE);
});

// Escuchar evento de scroll-top del EventBus
bus.on(EVENTS.SCROLL_TOP, () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Exponer en window para debugging y para los botones inline
// (ej: onclick="router.push('/')" en páginas de error)
if (typeof window !== "undefined") {
  window.router = router;
}

// ─── Exports ──────────────────────────────────────────────────

export default router;
export { Router, ROUTES };
