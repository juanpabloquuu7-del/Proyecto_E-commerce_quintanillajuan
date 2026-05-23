/**
 * store.js — Estado Global Centralizado
 * ─────────────────────────────────────────────────────────────
 * Patrón Observable con persistencia automática en LocalStorage.
 * Arquitectura: State → Reducers → Subscribers → UI
 * ─────────────────────────────────────────────────────────────
 */

// ─── Constantes ───────────────────────────────────────────────

/** Prefijo de namespace para todas las claves de LocalStorage */
const LS_PREFIX = "lumiere_";

/** Claves de LocalStorage por slice de estado */
const LS_KEYS = {
  cart: `${LS_PREFIX}cart`,
  user: `${LS_PREFIX}user`,
  orders: `${LS_PREFIX}orders`,
  wishlist: `${LS_PREFIX}wishlist`,
  filters: `${LS_PREFIX}filters`,
};

/** Slices que se persisten automáticamente en LocalStorage */
const PERSISTED_SLICES = ["cart", "user", "orders", "wishlist", "filters"];

/** Versión del schema — incrementar si el shape del estado cambia */
const STATE_VERSION = "1.0.0";

// ─── Estado Inicial ────────────────────────────────────────────

/**
 * Construye el estado inicial completo de la aplicación.
 * Se mezcla con los datos persistidos de LocalStorage al arranque.
 * @returns {Object} Estado inicial
 */
const buildInitialState = () => ({
  /** Metadatos internos del store */
  _meta: {
    version: STATE_VERSION,
    initialized: false,
    lastUpdated: null,
  },

  // ── Productos ──────────────────────────────────────────────
  products: {
    /** @type {Array} Lista completa de productos cargados */
    items: [],
    /** @type {Object|null} Producto activo en el modal de detalle */
    active: null,
    /** @type {boolean} Estado de carga */
    loading: false,
    /** @type {string|null} Mensaje de error */
    error: null,
    /** @type {boolean} Si los productos ya fueron cargados al menos una vez */
    loaded: false,
  },

  // ── Carrito ────────────────────────────────────────────────
  cart: {
    /**
     * @type {Array<{
     *   id: string,
     *   productId: string,
     *   name: string,
     *   price: number,
     *   originalPrice: number|null,
     *   image: string,
     *   size: string,
     *   color: string,
     *   quantity: number,
     *   addedAt: string
     * }>}
     */
    items: [],
    /** @type {boolean} Si el drawer del carrito está abierto */
    isOpen: false,
    /** @type {string|null} Código de cupón aplicado */
    coupon: null,
    /** @type {number} Porcentaje de descuento del cupón (0–100) */
    discount: 0,
  },

  // ── Usuario ────────────────────────────────────────────────
  user: {
    /**
     * @type {Object|null} Datos del usuario autenticado
     * { id, name, email, avatar, createdAt }
     */
    profile: null,
    /** @type {boolean} Si el usuario está autenticado */
    isAuthenticated: false,
    /** @type {string} Token de sesión simulado */
    token: null,
    /** @type {boolean} Estado de carga de autenticación */
    loading: false,
    /** @type {string|null} Error de autenticación */
    error: null,
  },

  // ── Pedidos ────────────────────────────────────────────────
  orders: {
    /**
     * @type {Array<{
     *   id: string,
     *   items: Array,
     *   total: number,
     *   status: 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled',
     *   address: Object,
     *   payment: Object,
     *   createdAt: string,
     *   updatedAt: string
     * }>}
     */
    items: [],
    /** @type {Object|null} Pedido actualmente en vista de detalle */
    active: null,
    /** @type {boolean} Estado de carga */
    loading: false,
    /** @type {string|null} Error */
    error: null,
  },

  // ── Wishlist ───────────────────────────────────────────────
  wishlist: {
    /** @type {Array<string>} IDs de productos en wishlist */
    items: [],
  },

  // ── Filtros del Catálogo ───────────────────────────────────
  filters: {
    /** @type {string} Texto de búsqueda */
    search: "",
    /** @type {string} Categoría activa ('all' | 'mujer' | 'hombre' | 'accesorios') */
    category: "all",
    /** @type {string[]} Tallas seleccionadas */
    sizes: [],
    /** @type {string[]} Colores seleccionados */
    colors: [],
    /** @type {number} Precio mínimo */
    priceMin: 0,
    /** @type {number} Precio máximo (0 = sin límite) */
    priceMax: 0,
    /** @type {string} Campo de ordenamiento ('newest'|'price_asc'|'price_desc'|'name') */
    sortBy: "newest",
    /** @type {boolean} Solo productos en oferta */
    onSale: false,
    /** @type {boolean} Solo productos nuevos */
    onlyNew: false,
    /** @type {number} Página actual */
    page: 1,
    /** @type {number} Productos por página */
    perPage: 12,
  },

  // ── UI Global ──────────────────────────────────────────────
  ui: {
    /** @type {string} Ruta activa ('home'|'catalog'|'cart'|'checkout'|...) */
    currentRoute: "home",
    /** @type {boolean} Si el menú mobile está abierto */
    menuOpen: false,
    /** @type {boolean} Si hay una operación global en curso */
    globalLoading: false,
  },
});

// ─── Utilidades de LocalStorage ────────────────────────────────

/**
 * Lee y parsea un valor de LocalStorage de forma segura.
 * @param {string} key
 * @param {*} fallback — Valor por defecto si no existe o falla el parse
 * @returns {*}
 */
const lsGet = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Serializa y guarda un valor en LocalStorage de forma segura.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} true si se guardó correctamente
 */
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // Puede fallar si el storage está lleno (QuotaExceededError)
    console.warn(`[Store] LocalStorage lleno o bloqueado. Key: ${key}`, e);
    return false;
  }
};

/**
 * Elimina una clave de LocalStorage de forma segura.
 * @param {string} key
 */
const lsRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* silent */
  }
};

// ─── Clase Store ───────────────────────────────────────────────

class Store {
  constructor() {
    /**
     * Estado interno.
     * @type {Object}
     * @private
     */
    this._state = buildInitialState();

    /**
     * Mapa de suscriptores por slice (o '*' para global).
     * Map<string, Set<Function>>
     * @private
     */
    this._subscribers = new Map();

    /**
     * Cola de actualizaciones pendientes (batching).
     * @type {Array<{slice: string, payload: Object}>}
     * @private
     */
    this._pendingUpdates = [];

    /**
     * Si hay un flush programado.
     * @private
     */
    this._flushScheduled = false;

    // Hidratación desde LocalStorage
    this._hydrate();

    // Marcar como inicializado
    this._state._meta.initialized = true;

    console.info("[Store] Inicializado correctamente.", {
      version: STATE_VERSION,
      cartItems: this._state.cart.items.length,
      isAuth: this._state.user.isAuthenticated,
    });
  }

  // ─── Hidratación ─────────────────────────────────────────────

  /**
   * Restaura los slices persistidos desde LocalStorage.
   * Valida la versión del schema antes de restaurar.
   * @private
   */
  _hydrate() {
    const savedVersion = lsGet(`${LS_PREFIX}version`);

    // Si la versión no coincide, limpiar el storage para evitar
    // inconsistencias por cambios de schema
    if (savedVersion && savedVersion !== STATE_VERSION) {
      console.warn(
        "[Store] Versión de estado desactualizada. Limpiando storage.",
      );
      this._clearPersistedState();
      lsSet(`${LS_PREFIX}version`, STATE_VERSION);
      return;
    }

    lsSet(`${LS_PREFIX}version`, STATE_VERSION);

    // Restaurar cada slice persistido
    PERSISTED_SLICES.forEach((slice) => {
      const key = LS_KEYS[slice];
      const saved = lsGet(key);
      if (saved !== null && typeof saved === "object") {
        this._state[slice] = this._mergeDeep(this._state[slice], saved);
      }
    });

    // Asegurar que el carrito nunca tenga isOpen = true al recargar
    this._state.cart.isOpen = false;
    // Asegurar que los menús estén cerrados
    this._state.ui.menuOpen = false;
  }

  /**
   * Elimina todos los slices persistidos del LocalStorage.
   * @private
   */
  _clearPersistedState() {
    PERSISTED_SLICES.forEach((slice) => lsRemove(LS_KEYS[slice]));
    lsRemove(`${LS_PREFIX}version`);
  }

  /**
   * Persiste un slice específico en LocalStorage.
   * @param {string} slice
   * @private
   */
  _persist(slice) {
    if (!PERSISTED_SLICES.includes(slice)) return;
    const key = LS_KEYS[slice];
    if (key) lsSet(key, this._state[slice]);
  }

  // ─── Merge Profundo ───────────────────────────────────────────

  /**
   * Merge profundo de dos objetos (target ← source).
   * Arrays se reemplazan, no se concatenan.
   * @param {Object} target
   * @param {Object} source
   * @returns {Object}
   * @private
   */
  _mergeDeep(target, source) {
    const output = { ...target };
    if (!source || typeof source !== "object") return output;

    Object.keys(source).forEach((key) => {
      const srcVal = source[key];
      const tgtVal = target[key];

      if (Array.isArray(srcVal)) {
        // Arrays: reemplazar directamente
        output[key] = srcVal;
      } else if (
        srcVal !== null &&
        typeof srcVal === "object" &&
        tgtVal !== null &&
        typeof tgtVal === "object" &&
        !Array.isArray(tgtVal)
      ) {
        // Objetos anidados: merge recursivo
        output[key] = this._mergeDeep(tgtVal, srcVal);
      } else {
        output[key] = srcVal;
      }
    });

    return output;
  }

  // ─── API Pública ──────────────────────────────────────────────

  /**
   * Retorna una copia inmutable de todo el estado o de un slice.
   * @param {string} [slice] — Si se omite, retorna el estado completo.
   * @returns {Object}
   *
   * @example
   * store.getState()           // estado completo
   * store.getState('cart')     // solo el carrito
   * store.getState('user')     // solo el usuario
   */
  getState(slice) {
    if (slice) {
      if (!(slice in this._state)) {
        console.warn(`[Store] getState: slice "${slice}" no existe.`);
        return null;
      }
      return this._deepClone(this._state[slice]);
    }
    return this._deepClone(this._state);
  }

  /**
   * Actualiza un slice del estado y notifica a los suscriptores.
   * Soporta actualizaciones parciales (merge automático).
   *
   * @param {string} slice — Nombre del slice a actualizar.
   * @param {Object|Function} payload — Objeto parcial o función (prevState) => newPartial.
   * @param {Object} [options]
   * @param {boolean} [options.silent=false] — Si true, no notifica a suscriptores.
   * @param {boolean} [options.replace=false] — Si true, reemplaza el slice completo.
   *
   * @example
   * store.setState('cart', { isOpen: true })
   * store.setState('filters', prev => ({ ...prev, category: 'mujer' }))
   */
  setState(slice, payload, options = {}) {
    if (!(slice in this._state)) {
      console.warn(`[Store] setState: slice "${slice}" no existe.`);
      return;
    }

    const { silent = false, replace = false } = options;

    // Resolver payload funcional
    const resolvedPayload =
      typeof payload === "function"
        ? payload(this._deepClone(this._state[slice]))
        : payload;

    if (resolvedPayload === null || typeof resolvedPayload !== "object") {
      console.warn(`[Store] setState: payload inválido para slice "${slice}".`);
      return;
    }

    // Actualizar estado
    this._state[slice] = replace
      ? { ...resolvedPayload }
      : this._mergeDeep(this._state[slice], resolvedPayload);

    // Timestamp de última actualización
    this._state._meta.lastUpdated = new Date().toISOString();

    // Persistir si corresponde
    this._persist(slice);

    // Notificar suscriptores
    if (!silent) {
      this._notify(slice);
    }
  }

  /**
   * Actualiza múltiples slices de forma atómica.
   * Notifica una sola vez al final.
   *
   * @param {Object} updates — { [slice]: payload }
   * @param {Object} [options]
   *
   * @example
   * store.batchUpdate({
   *   cart:    { items: [] },
   *   filters: { page: 1 }
   * })
   */
  batchUpdate(updates, options = {}) {
    const { silent = false } = options;
    const affectedSlices = [];

    Object.entries(updates).forEach(([slice, payload]) => {
      if (!(slice in this._state)) {
        console.warn(`[Store] batchUpdate: slice "${slice}" no existe.`);
        return;
      }

      const resolved =
        typeof payload === "function"
          ? payload(this._deepClone(this._state[slice]))
          : payload;

      this._state[slice] = this._mergeDeep(this._state[slice], resolved);
      this._persist(slice);
      affectedSlices.push(slice);
    });

    this._state._meta.lastUpdated = new Date().toISOString();

    if (!silent) {
      // Notificar cada slice afectado y el global
      affectedSlices.forEach((slice) => this._notify(slice));
    }
  }

  /**
   * Resetea un slice a su estado inicial.
   * @param {string} slice
   * @param {boolean} [clearStorage=true]
   */
  resetSlice(slice, clearStorage = true) {
    const initial = buildInitialState();
    if (!(slice in initial)) {
      console.warn(`[Store] resetSlice: slice "${slice}" no existe.`);
      return;
    }
    this._state[slice] = initial[slice];
    if (clearStorage && LS_KEYS[slice]) {
      lsRemove(LS_KEYS[slice]);
    }
    this._notify(slice);
  }

  /**
   * Resetea el store completo (útil para logout).
   * @param {string[]} [keepSlices=[]] — Slices que NO se resetean.
   */
  resetAll(keepSlices = []) {
    const initial = buildInitialState();
    Object.keys(initial).forEach((slice) => {
      if (slice === "_meta") return;
      if (keepSlices.includes(slice)) return;
      this._state[slice] = initial[slice];
      if (LS_KEYS[slice]) lsRemove(LS_KEYS[slice]);
    });
    this._notify("*");
  }

  // ─── Suscripciones ────────────────────────────────────────────

  /**
   * Suscribe un callback a cambios en un slice específico o a todos ('*').
   * Retorna la función de desuscripción (unsubscribe).
   *
   * @param {string} slice — Nombre del slice o '*' para escuchar todo.
   * @param {Function} callback — (newSliceState, prevSliceState) => void
   * @param {Object} [options]
   * @param {boolean} [options.immediate=false] — Si true, ejecuta el callback de inmediato.
   * @returns {Function} unsubscribe
   *
   * @example
   * const unsub = store.subscribe('cart', (cart) => {
   *   console.log('Carrito actualizado:', cart.items.length);
   * });
   * // Más tarde:
   * unsub();
   */
  subscribe(slice, callback, options = {}) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "[Store] subscribe: el callback debe ser una función.",
      );
    }

    if (!this._subscribers.has(slice)) {
      this._subscribers.set(slice, new Set());
    }

    this._subscribers.get(slice).add(callback);

    // Ejecución inmediata con el estado actual
    if (options.immediate) {
      try {
        callback(this.getState(slice === "*" ? undefined : slice), null);
      } catch (err) {
        console.error("[Store] Error en callback inmediato:", err);
      }
    }

    // Retornar función de desuscripción
    return () => this.unsubscribe(slice, callback);
  }

  /**
   * Desuscribe un callback de un slice.
   * @param {string} slice
   * @param {Function} callback
   */
  unsubscribe(slice, callback) {
    const set = this._subscribers.get(slice);
    if (set) {
      set.delete(callback);
      // Limpiar el Set si quedó vacío
      if (set.size === 0) {
        this._subscribers.delete(slice);
      }
    }
  }

  /**
   * Elimina TODOS los suscriptores de un slice.
   * @param {string} [slice] — Si se omite, limpia todos los suscriptores.
   */
  clearSubscribers(slice) {
    if (slice) {
      this._subscribers.delete(slice);
    } else {
      this._subscribers.clear();
    }
  }

  // ─── Notificación Interna ──────────────────────────────────────

  /**
   * Notifica a todos los suscriptores de un slice y a los globales ('*').
   * @param {string} slice
   * @private
   */
  _notify(slice) {
    const newState = slice === "*" ? this.getState() : this.getState(slice);

    // Notificar suscriptores específicos del slice
    if (slice !== "*" && this._subscribers.has(slice)) {
      this._subscribers.get(slice).forEach((cb) => {
        try {
          cb(newState);
        } catch (err) {
          console.error(`[Store] Error en subscriber de "${slice}":`, err);
        }
      });
    }

    // Notificar suscriptores globales
    if (this._subscribers.has("*")) {
      const fullState = this.getState();
      this._subscribers.get("*").forEach((cb) => {
        try {
          cb(fullState, slice);
        } catch (err) {
          console.error("[Store] Error en subscriber global:", err);
        }
      });
    }
  }

  // ─── Selectores Derivados ──────────────────────────────────────

  /**
   * Retorna el número total de ítems en el carrito.
   * @returns {number}
   */
  get cartCount() {
    return this._state.cart.items.reduce((acc, item) => acc + item.quantity, 0);
  }

  /**
   * Retorna el subtotal del carrito (sin descuentos).
   * @returns {number}
   */
  get cartSubtotal() {
    return this._state.cart.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
  }

  /**
   * Retorna el total del carrito (con descuento de cupón).
   * @returns {number}
   */
  get cartTotal() {
    const { discount } = this._state.cart;
    const subtotal = this.cartSubtotal;
    return discount > 0 ? subtotal * (1 - discount / 100) : subtotal;
  }

  /**
   * Retorna los productos del catálogo filtrados y ordenados.
   * No muta el estado; es un selector puro.
   * @returns {Array}
   */
  get filteredProducts() {
    const { items } = this._state.products;
    const f = this._state.filters;

    let result = [...items];

    // Búsqueda por texto
    if (f.search.trim()) {
      const q = f.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q),
      );
    }

    // Categoría
    if (f.category && f.category !== "all") {
      result = result.filter((p) => p.category === f.category);
    }

    // Tallas
    if (f.sizes.length > 0) {
      result = result.filter((p) => p.sizes?.some((s) => f.sizes.includes(s)));
    }

    // Colores
    if (f.colors.length > 0) {
      result = result.filter((p) =>
        p.colors?.some((c) => f.colors.includes(c)),
      );
    }

    // Rango de precio
    if (f.priceMin > 0) {
      result = result.filter((p) => p.price >= f.priceMin);
    }
    if (f.priceMax > 0) {
      result = result.filter((p) => p.price <= f.priceMax);
    }

    // Solo en oferta
    if (f.onSale) {
      result = result.filter(
        (p) => p.onSale === true || p.originalPrice > p.price,
      );
    }

    // Solo nuevos
    if (f.onlyNew) {
      result = result.filter((p) => p.isNew === true);
    }

    // Ordenamiento
    switch (f.sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        result.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        );
    }

    return result;
  }

  /**
   * Retorna los productos filtrados para la página actual.
   * @returns {{ items: Array, total: number, totalPages: number, page: number }}
   */
  get paginatedProducts() {
    const { page, perPage } = this._state.filters;
    const all = this.filteredProducts;
    const total = all.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      items: all.slice(start, end),
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
    };
  }

  /**
   * Verifica si un producto está en el carrito.
   * @param {string} productId
   * @param {string} [size]
   * @param {string} [color]
   * @returns {boolean}
   */
  isInCart(productId, size, color) {
    return this._state.cart.items.some(
      (item) =>
        item.productId === productId &&
        (!size || item.size === size) &&
        (!color || item.color === color),
    );
  }

  /**
   * Verifica si un producto está en la wishlist.
   * @param {string} productId
   * @returns {boolean}
   */
  isInWishlist(productId) {
    return this._state.wishlist.items.includes(productId);
  }

  /**
   * Retorna el usuario autenticado o null.
   * @returns {Object|null}
   */
  get currentUser() {
    const { user } = this._state;
    return user.isAuthenticated ? this._deepClone(user.profile) : null;
  }

  // ─── Utilidades Internas ──────────────────────────────────────

  /**
   * Clona profundamente un objeto (sin referencias compartidas).
   * Usa structuredClone si está disponible, sino JSON.
   * @param {*} obj
   * @returns {*}
   * @private
   */
  _deepClone(obj) {
    try {
      return typeof structuredClone === "function"
        ? structuredClone(obj)
        : JSON.parse(JSON.stringify(obj));
    } catch {
      return { ...obj };
    }
  }

  /**
   * Retorna un snapshot del estado para debugging.
   * @returns {string} JSON formateado
   */
  debug() {
    return JSON.stringify(
      {
        _meta: this._state._meta,
        cart: { count: this.cartCount, total: this.cartTotal },
        user: {
          isAuth: this._state.user.isAuthenticated,
          name: this._state.user.profile?.name,
        },
        orders: { count: this._state.orders.items.length },
        wishlist: { count: this._state.wishlist.items.length },
        filters: this._state.filters,
        products: {
          loaded: this._state.products.loaded,
          count: this._state.products.items.length,
        },
        subscribers: Object.fromEntries(
          [...this._subscribers.entries()].map(([k, v]) => [k, v.size]),
        ),
      },
      null,
      2,
    );
  }
}

// ─── Singleton ────────────────────────────────────────────────

/**
 * Instancia única del store — se comparte en toda la aplicación.
 * @type {Store}
 */
const store = new Store();

// Exponer en window solo en desarrollo (útil para debugging)
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  window.__store = store;
  window.__storeDebug = () => console.log(store.debug());
}

// ─── Exports ──────────────────────────────────────────────────

export default store;
export { Store, LS_KEYS, LS_PREFIX, PERSISTED_SLICES };
