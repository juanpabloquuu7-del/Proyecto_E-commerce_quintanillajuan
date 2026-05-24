/**
 * events.js — Event Bus Global Desacoplado
 * ─────────────────────────────────────────────────────────────
 * Bus de eventos centralizado que desacopla completamente los
 * módulos entre sí. Compatible con Web Components, servicios,
 * páginas y cualquier capa de la arquitectura.
 *
 * Patrón: Publish / Subscribe (PubSub)
 * ─────────────────────────────────────────────────────────────
 */

// ─── Catálogo de Eventos ──────────────────────────────────────
/**
 * Nombres de eventos tipados como constantes.
 * Úsalos siempre en lugar de strings literales para evitar
 * errores de tipeo y facilitar refactors.
 *
 * @readonly
 * @enum {string}
 */
export const EVENTS = Object.freeze({
  // ── Router ────────────────────────────────────────────────
  /** Solicitud de navegación. detail: { route: string, params?: Object } */
  NAVIGATE: "lumiere:navigate",
  /** Ruta resuelta y renderizada. detail: { route: string } */
  ROUTE_CHANGED: "lumiere:route:changed",

  // ── Productos ─────────────────────────────────────────────
  /** Productos cargados en el store. detail: { products: Array } */
  PRODUCTS_LOADED: "lumiere:products:loaded",
  /** Error al cargar productos. detail: { error: string } */
  PRODUCTS_ERROR: "lumiere:products:error",
  /** Abrir modal de detalle. detail: { productId: string } */
  PRODUCT_OPEN_MODAL: "lumiere:product:open-modal",
  /** Cerrar modal de detalle. */
  PRODUCT_CLOSE_MODAL: "lumiere:product:close-modal",

  // ── Carrito ───────────────────────────────────────────────
  /** Producto añadido al carrito. detail: { item: Object } */
  CART_ITEM_ADDED: "lumiere:cart:item-added",
  /** Producto eliminado del carrito. detail: { itemId: string } */
  CART_ITEM_REMOVED: "lumiere:cart:item-removed",
  /** Cantidad actualizada. detail: { itemId: string, quantity: number } */
  CART_ITEM_UPDATED: "lumiere:cart:item-updated",
  /** Carrito vaciado. */
  CART_CLEARED: "lumiere:cart:cleared",
  /** Abrir drawer del carrito. */
  CART_OPEN: "lumiere:cart:open",
  /** Cerrar drawer del carrito. */
  CART_CLOSE: "lumiere:cart:close",
  /** Cupón aplicado. detail: { code: string, discount: number } */
  CART_COUPON_APPLIED: "lumiere:cart:coupon-applied",
  /** Cupón eliminado. */
  CART_COUPON_REMOVED: "lumiere:cart:coupon-removed",
  /** Estado del carrito actualizado (cualquier cambio). */
  CART_UPDATED: "lumiere:cart:updated",

  // ── Autenticación ─────────────────────────────────────────
  /** Login exitoso. detail: { user: Object } */
  AUTH_LOGIN: "lumiere:auth:login",
  /** Logout. */
  AUTH_LOGOUT: "lumiere:auth:logout",
  /** Registro exitoso. detail: { user: Object } */
  AUTH_REGISTER: "lumiere:auth:register",
  /** Perfil actualizado. detail: { user: Object } */
  AUTH_PROFILE_UPDATED: "lumiere:auth:profile-updated",

  // ── Pedidos ───────────────────────────────────────────────
  /** Pedido creado. detail: { order: Object } */
  ORDER_CREATED: "lumiere:order:created",
  /** Pedido cancelado. detail: { orderId: string } */
  ORDER_CANCELLED: "lumiere:order:cancelled",
  /** Lista de pedidos actualizada. */
  ORDERS_UPDATED: "lumiere:orders:updated",

  // ── Wishlist ──────────────────────────────────────────────
  /** Producto añadido a wishlist. detail: { productId: string } */
  WISHLIST_ADDED: "lumiere:wishlist:added",
  /** Producto eliminado de wishlist. detail: { productId: string } */
  WISHLIST_REMOVED: "lumiere:wishlist:removed",

  // ── Filtros ───────────────────────────────────────────────
  /** Filtros del catálogo actualizados. detail: { filters: Object } */
  FILTERS_CHANGED: "lumiere:filters:changed",
  /** Filtros reseteados a valores por defecto. */
  FILTERS_RESET: "lumiere:filters:reset",
  /** Búsqueda ejecutada. detail: { query: string } */
  SEARCH_EXECUTED: "lumiere:search:executed",

  // ── UI Global ─────────────────────────────────────────────
  /** Overlay activado. detail: { source: string } */
  OVERLAY_OPEN: "lumiere:overlay:open",
  /** Overlay desactivado. */
  OVERLAY_CLOSE: "lumiere:overlay:close",
  /** Menú mobile abierto. */
  MENU_OPEN: "lumiere:menu:open",
  /** Menú mobile cerrado. */
  MENU_CLOSE: "lumiere:menu:close",
  /** Toast solicitado. detail: { type, title, message, duration } */
  TOAST_SHOW: "lumiere:toast:show",
  /** Scroll al top. */
  SCROLL_TOP: "lumiere:scroll:top",

  // ── Checkout ──────────────────────────────────────────────
  /** Checkout iniciado. */
  CHECKOUT_STARTED: "lumiere:checkout:started",
  /** Paso de checkout cambiado. detail: { step: number } */
  CHECKOUT_STEP_CHANGED: "lumiere:checkout:step-changed",
  /** Pago completado. detail: { order: Object } */
  CHECKOUT_COMPLETED: "lumiere:checkout:completed",
  /** Pago fallido. detail: { error: string } */
  CHECKOUT_FAILED: "lumiere:checkout:failed",
});

// ─── Clase EventBus ───────────────────────────────────────────

class EventBus {
  constructor() {
    /**
     * Registro de listeners por evento.
     * Map<eventName, Set<{ handler: Function, once: boolean, id: symbol }>>
     * @private
     */
    this._listeners = new Map();

    /**
     * Historial de eventos emitidos (solo en modo debug).
     * @type {Array<{ event: string, detail: any, timestamp: string }>}
     * @private
     */
    this._history = [];

    /**
     * Modo debug — habilita logging y historial.
     * @type {boolean}
     * @private
     */
    this._debug =
      typeof window !== "undefined" && window.location.hostname === "localhost";

    /**
     * Límite del historial de eventos en modo debug.
     * @private
     */
    this._historyLimit = 100;

    /**
     * Wildcard listeners — escuchan todos los eventos.
     * Set<{ handler: Function, id: symbol }>
     * @private
     */
    this._wildcards = new Set();

    if (this._debug) {
      console.info("[EventBus] Inicializado en modo debug.");
    }
  }

  // ─── Suscripción ─────────────────────────────────────────────

  /**
   * Registra un listener para un evento.
   * Retorna una función de baja (off) para facilitar cleanup.
   *
   * @param {string}   event    — Nombre del evento (usa EVENTS.*)
   * @param {Function} handler  — Callback (detail) => void
   * @param {Object}   [options]
   * @param {boolean}  [options.once=false]  — Se auto-elimina tras primera emisión
   * @param {string}   [options.context='']  — Etiqueta para debugging
   * @returns {Function} Función de baja: () => void
   *
   * @example
   * const off = EventBus.on(EVENTS.CART_OPEN, () => drawer.open());
   * off(); // cleanup
   */
  on(event, handler, options = {}) {
    this._validateEvent(event);
    this._validateHandler(handler);

    const { once = false, context = "" } = options;

    // Wildcard: escucha todos los eventos
    if (event === "*") {
      const entry = { handler, id: Symbol(context || "wildcard"), context };
      this._wildcards.add(entry);
      if (this._debug) {
        console.debug(
          `[EventBus] on(*) registrado.${context ? ` [${context}]` : ""}`,
        );
      }
      return () => this._wildcards.delete(entry);
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    const entry = {
      handler,
      once,
      id: Symbol(context || event),
      context,
    };

    this._listeners.get(event).add(entry);

    if (this._debug) {
      console.debug(
        `[EventBus] on("${event}") registrado.`,
        context ? `[${context}]` : "",
        `Total listeners: ${this._listeners.get(event).size}`,
      );
    }

    return () => this._removeEntry(event, entry);
  }

  /**
   * Registra un listener que se ejecuta UNA SOLA VEZ.
   * Alias de on(event, handler, { once: true }).
   *
   * @param {string}   event
   * @param {Function} handler
   * @param {Object}   [options]
   * @returns {Function} Función de baja
   *
   * @example
   * EventBus.once(EVENTS.PRODUCTS_LOADED, ({ products }) => {
   *   console.log('Cargados:', products.length);
   * });
   */
  once(event, handler, options = {}) {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * Elimina un listener específico de un evento.
   * Si no se provee handler, elimina TODOS los listeners del evento.
   *
   * @param {string}    event
   * @param {Function}  [handler]
   *
   * @example
   * EventBus.off(EVENTS.CART_OPEN, myHandler);
   * EventBus.off(EVENTS.CART_OPEN); // elimina todos
   */
  off(event, handler) {
    if (event === "*") {
      if (handler) {
        this._wildcards.forEach((entry) => {
          if (entry.handler === handler) this._wildcards.delete(entry);
        });
      } else {
        this._wildcards.clear();
      }
      return;
    }

    if (!this._listeners.has(event)) return;

    if (!handler) {
      this._listeners.delete(event);
      if (this._debug) {
        console.debug(`[EventBus] off("${event}") — todos eliminados.`);
      }
      return;
    }

    const set = this._listeners.get(event);
    set.forEach((entry) => {
      if (entry.handler === handler) set.delete(entry);
    });

    if (set.size === 0) this._listeners.delete(event);

    if (this._debug) {
      console.debug(`[EventBus] off("${event}") — handler eliminado.`);
    }
  }

  // ─── Emisión ─────────────────────────────────────────────────

  /**
   * Emite un evento con un payload opcional.
   * Notifica a listeners registrados y a wildcards.
   * También dispara un CustomEvent en window para Web Components.
   *
   * @param {string} event
   * @param {*}      [detail=null]
   * @returns {number} Cantidad de listeners notificados
   *
   * @example
   * EventBus.emit(EVENTS.CART_OPEN);
   * EventBus.emit(EVENTS.CART_ITEM_ADDED, { item });
   */
  emit(event, detail = null) {
    this._validateEvent(event);

    let notified = 0;
    const toRemove = [];

    if (this._debug) {
      this._record(event, detail);
      console.debug(`[EventBus] emit("${event}")`, detail ?? "");
    }

    // Notificar listeners específicos
    if (this._listeners.has(event)) {
      this._listeners.get(event).forEach((entry) => {
        try {
          entry.handler(detail);
          notified++;
        } catch (err) {
          console.error(
            `[EventBus] Error en listener de "${event}"`,
            entry.context ? `[${entry.context}]` : "",
            err,
          );
        }
        if (entry.once) toRemove.push({ event, entry });
      });
    }

    // Limpiar once tras la iteración
    toRemove.forEach(({ event: e, entry }) => this._removeEntry(e, entry));

    // Notificar wildcards
    this._wildcards.forEach((entry) => {
      try {
        entry.handler({ event, detail });
        notified++;
      } catch (err) {
        console.error("[EventBus] Error en wildcard listener:", err);
      }
    });

    // Disparar también como CustomEvent en window
    this._dispatchDOMEvent(event, detail);

    return notified;
  }

  /**
   * Emite un evento de forma asíncrona (next microtask).
   * Evita loops síncronos o side effects inmediatos.
   *
   * @param {string} event
   * @param {*}      [detail]
   * @returns {Promise<number>}
   */
  emitAsync(event, detail = null) {
    return Promise.resolve().then(() => this.emit(event, detail));
  }

  // ─── Utilidades Públicas ──────────────────────────────────────

  /**
   * Retorna el número de listeners de un evento o el total global.
   * @param {string} [event]
   * @returns {number}
   */
  listenerCount(event) {
    if (!event) {
      let total = this._wildcards.size;
      this._listeners.forEach((set) => {
        total += set.size;
      });
      return total;
    }
    if (event === "*") return this._wildcards.size;
    return this._listeners.has(event) ? this._listeners.get(event).size : 0;
  }

  /**
   * Verifica si un evento tiene al menos un listener activo.
   * @param {string} event
   * @returns {boolean}
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * Retorna los nombres de todos los eventos con listeners activos.
   * @returns {string[]}
   */
  activeEvents() {
    return [...this._listeners.keys()];
  }

  /**
   * Elimina TODOS los listeners de todos los eventos.
   */
  clear() {
    this._listeners.clear();
    this._wildcards.clear();
    this._history = [];
    if (this._debug) console.info("[EventBus] Todos los listeners eliminados.");
  }

  /**
   * Historial de eventos emitidos (solo modo debug).
   * @param {string} [filterEvent]
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getHistory(filterEvent, limit = 20) {
    if (!this._debug) {
      console.warn("[EventBus] Historial disponible solo en modo debug.");
      return [];
    }
    const history = filterEvent
      ? this._history.filter((e) => e.event === filterEvent)
      : this._history;
    return history.slice(-limit);
  }

  /**
   * Crea un contexto agrupado de listeners para un módulo.
   * Permite limpiarlos todos juntos con .destroy().
   * Ideal para Web Components (disconnectedCallback).
   *
   * @param {string} [contextName]
   * @returns {EventBusContext}
   *
   * @example
   * // En connectedCallback():
   * this._bus = EventBus.context('CartDrawer');
   * this._bus.on(EVENTS.CART_OPEN, () => this.open());
   *
   * // En disconnectedCallback():
   * this._bus.destroy();
   */
  context(contextName = "") {
    return new EventBusContext(this, contextName);
  }

  // ─── Internos ─────────────────────────────────────────────────

  /** @private */
  _removeEntry(event, entry) {
    const set = this._listeners.get(event);
    if (!set) return;
    set.delete(entry);
    if (set.size === 0) this._listeners.delete(event);
  }

  /**
   * Dispara el evento como CustomEvent en window.
   * Permite que Web Components usen addEventListener en el DOM.
   * @private
   */
  _dispatchDOMEvent(event, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(event, { detail, bubbles: false, cancelable: false }),
      );
    } catch {
      /* entorno no-browser */
    }
  }

  /** @private */
  _record(event, detail) {
    this._history.push({ event, detail, timestamp: new Date().toISOString() });
    if (this._history.length > this._historyLimit) this._history.shift();
  }

  /** @private */
  _validateEvent(event) {
    if (typeof event !== "string" || !event.trim()) {
      throw new TypeError(
        "[EventBus] El nombre del evento debe ser un string no vacío.",
      );
    }
  }

  /** @private */
  _validateHandler(handler) {
    if (typeof handler !== "function") {
      throw new TypeError("[EventBus] El handler debe ser una función.");
    }
  }

  /** Resumen para debugging en consola. */
  debug() {
    const events = {};
    this._listeners.forEach((set, name) => {
      events[name] = set.size;
    });
    return JSON.stringify(
      {
        activeEvents: this.activeEvents(),
        listenerCounts: events,
        wildcards: this._wildcards.size,
        historyLength: this._history.length,
      },
      null,
      2,
    );
  }
}

// ─── EventBusContext ──────────────────────────────────────────

/**
 * Contexto agrupado de suscripciones.
 * Registra listeners bajo un nombre de contexto y permite
 * eliminarlos todos con destroy().
 *
 * Diseñado específicamente para Web Components.
 */
class EventBusContext {
  /**
   * @param {EventBus} bus
   * @param {string}   [name]
   */
  constructor(bus, name = "") {
    /** @private */
    this._bus = bus;
    /** @private */
    this._name = name;
    /** @private @type {Function[]} */
    this._offs = [];
  }

  /**
   * Registra un listener en el contexto.
   * @param {string}   event
   * @param {Function} handler
   * @param {Object}   [options]
   * @returns {this} — chainable
   */
  on(event, handler, options = {}) {
    const off = this._bus.on(event, handler, {
      ...options,
      context: this._name,
    });
    this._offs.push(off);
    return this;
  }

  /**
   * Registra un listener once en el contexto.
   * @param {string}   event
   * @param {Function} handler
   * @returns {this}
   */
  once(event, handler) {
    return this.on(event, handler, { once: true });
  }

  /**
   * Emite un evento a través del bus principal.
   * @param {string} event
   * @param {*}      [detail]
   * @returns {this}
   */
  emit(event, detail) {
    this._bus.emit(event, detail);
    return this;
  }

  /**
   * Elimina todos los listeners registrados en este contexto.
   * Llamar en disconnectedCallback() de Web Components.
   */
  destroy() {
    this._offs.forEach((off) => off());
    this._offs = [];
  }

  /** Número de listeners activos en este contexto. */
  get size() {
    return this._offs.length;
  }
}

// ─── Singleton ────────────────────────────────────────────────

/**
 * Instancia única del Event Bus compartida en toda la app.
 * @type {EventBus}
 */
const bus = new EventBus();

// Exponer en window en localhost para debugging en DevTools
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  window.__bus = bus;
  window.__busDebug = () => console.log(bus.debug());
  window.__busEvents = () => console.table(bus.activeEvents());
}

// Puente DOM → Bus:
// Redirige CustomEvents disparados desde index.html (footer, etc.)
// al bus interno para que el router los procese correctamente.
if (typeof window !== "undefined") {
  window.addEventListener(EVENTS.NAVIGATE, (e) => {
    if (e instanceof CustomEvent && e.detail) {
      bus.emit(EVENTS.NAVIGATE, e.detail);
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────

export default bus;
export { EventBus, EventBusContext, EVENTS };
