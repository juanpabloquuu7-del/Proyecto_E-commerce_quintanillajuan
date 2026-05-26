/**
 * storage.service.js — Wrapper Profesional de LocalStorage
 * ─────────────────────────────────────────────────────────────
 * Abstrae el acceso a localStorage con:
 *   - Namespace automático para evitar colisiones
 *   - Parseo/serialización JSON segura
 *   - TTL (Time To Live) por clave
 *   - Manejo de errores (QuotaExceededError, JSON inválido, etc.)
 *   - API fluida y predecible
 *   - Soporte para sessionStorage como fallback
 * ─────────────────────────────────────────────────────────────
 */

// ─── Constantes ───────────────────────────────────────────────

/** Prefijo global de namespace para todas las claves */
const NAMESPACE = "ecommerce_";

/**
 * Claves predefinidas del sistema.
 * Usar siempre estas constantes en lugar de strings literales.
 * @readonly
 * @enum {string}
 */
export const STORAGE_KEYS = Object.freeze({
  // Auth
  USER: "user",
  TOKEN: "token",

  // Carrito
  CART: "cart",
  CART_COUPON: "cart_coupon",

  // Catálogo
  PRODUCTS: "products",
  PRODUCTS_CACHE: "products_cache",

  // Pedidos
  ORDERS: "orders",

  // Wishlist
  WISHLIST: "wishlist",

  // Filtros
  FILTERS: "filters",

  // UI
  THEME: "theme",
  LAST_ROUTE: "last_route",

  // Newsletter
  NEWSLETTER: "newsletter",

  // Metadatos
  VERSION: "version",
  INITIALIZED: "initialized",
});

// ─── Clase StorageService ─────────────────────────────────────

class StorageService {
  /**
   * @param {Object}  [options]
   * @param {string}  [options.namespace=NAMESPACE]     — Prefijo de claves
   * @param {Storage} [options.driver=localStorage]     — Driver de almacenamiento
   * @param {boolean} [options.silent=false]            — Suprimir warnings en consola
   */
  constructor(options = {}) {
    /**
     * Prefijo que se antepone a todas las claves.
     * @type {string}
     * @private
     */
    this._ns = options.namespace ?? NAMESPACE;

    /**
     * Driver de almacenamiento (localStorage o sessionStorage).
     * @type {Storage}
     * @private
     */
    this._driver = options.driver ?? localStorage;

    /**
     * Si true, suprime los console.warn internos.
     * @type {boolean}
     * @private
     */
    this._silent = options.silent ?? false;

    /**
     * Si el driver está disponible y operativo.
     * @type {boolean}
     * @private
     */
    this._available = this._checkAvailability();
  }

  // ─── Disponibilidad ───────────────────────────────────────────

  /**
   * Verifica si el driver está disponible.
   * localStorage puede estar bloqueado en modo incógnito o
   * por políticas de seguridad del navegador.
   *
   * @returns {boolean}
   * @private
   */
  _checkAvailability() {
    try {
      const testKey = `${this._ns}__test__`;
      this._driver.setItem(testKey, "1");
      this._driver.removeItem(testKey);
      return true;
    } catch {
      this._warn(
        "Storage no disponible. Las funciones de persistencia estarán desactivadas.",
        "El modo incógnito o las políticas del navegador pueden estar bloqueando el acceso.",
      );
      return false;
    }
  }

  /**
   * Indica si el driver está disponible.
   * @returns {boolean}
   */
  get isAvailable() {
    return this._available;
  }

  // ─── Construcción de Claves ───────────────────────────────────

  /**
   * Construye la clave real con namespace.
   * @param {string} key — Clave sin prefijo
   * @returns {string}   — Clave con prefijo (ej: 'ecommerce_cart')
   * @private
   */
  _buildKey(key) {
    if (!key || typeof key !== "string") {
      throw new TypeError(
        `[StorageService] La clave debe ser un string no vacío. Recibido: ${key}`,
      );
    }
    return `${this._ns}${key}`;
  }

  /**
   * Quita el namespace de una clave completa.
   * @param {string} fullKey
   * @returns {string}
   * @private
   */
  _stripKey(fullKey) {
    return fullKey.startsWith(this._ns)
      ? fullKey.slice(this._ns.length)
      : fullKey;
  }

  // ─── Serialización ────────────────────────────────────────────

  /**
   * Serializa un valor a JSON de forma segura.
   * Envuelve el valor junto con metadatos (timestamp, ttl).
   *
   * @param {*}      value
   * @param {Object} [meta]
   * @returns {string|null}
   * @private
   */
  _serialize(value, meta = {}) {
    try {
      const envelope = {
        v: value, // value
        t: Date.now(), // timestamp de escritura
        ...meta,
      };
      return JSON.stringify(envelope);
    } catch (err) {
      this._warn("Error al serializar valor:", err.message);
      return null;
    }
  }

  /**
   * Deserializa un string JSON de forma segura.
   * Valida TTL si fue configurado.
   *
   * @param {string} raw     — String JSON crudo del storage
   * @param {*}      fallback — Valor por defecto si falla
   * @returns {*}
   * @private
   */
  _deserialize(raw, fallback = null) {
    if (raw === null || raw === undefined) return fallback;

    try {
      const envelope = JSON.parse(raw);

      // Verificar que sea un envelope válido
      if (typeof envelope !== "object" || !("v" in envelope)) {
        // Compatibilidad con valores guardados sin envelope (formato antiguo)
        return envelope ?? fallback;
      }

      // Verificar TTL si existe
      if (envelope.ttl && envelope.t) {
        const age = Date.now() - envelope.t;
        const maxAge = envelope.ttl * 1000; // ttl en segundos → ms
        if (age > maxAge) {
          // Valor expirado — no retornar
          return fallback;
        }
      }

      return envelope.v ?? fallback;
    } catch {
      // JSON inválido — no lanzar, retornar fallback
      this._warn(`Valor corrupto en storage. Retornando fallback.`);
      return fallback;
    }
  }

  // ─── API Principal ────────────────────────────────────────────

  /**
   * Guarda un valor en el storage con namespace automático.
   *
   * @param {string} key      — Clave (sin prefijo)
   * @param {*}      value    — Valor a guardar (se serializa a JSON)
   * @param {Object} [options]
   * @param {number} [options.ttl]    — Tiempo de vida en segundos
   * @returns {boolean}              — true si se guardó correctamente
   *
   * @example
   * storage.set('cart', cartData);
   * storage.set('token', 'abc123', { ttl: 3600 }); // expira en 1 hora
   * storage.set(STORAGE_KEYS.USER, userObj);
   */
  set(key, value, options = {}) {
    if (!this._available) return false;

    const fullKey = this._buildKey(key);
    const meta = {};

    if (options.ttl && typeof options.ttl === "number" && options.ttl > 0) {
      meta.ttl = options.ttl;
    }

    const serialized = this._serialize(value, meta);
    if (serialized === null) return false;

    try {
      this._driver.setItem(fullKey, serialized);
      return true;
    } catch (err) {
      if (err.name === "QuotaExceededError" || err.code === 22) {
        this._warn(
          "QuotaExceededError: Storage lleno.",
          "Considera limpiar entradas antiguas con storage.clear() o storage.remove().",
        );
      } else {
        this._warn("Error al guardar en storage:", err.message);
      }
      return false;
    }
  }

  /**
   * Recupera un valor del storage.
   *
   * @param {string} key       — Clave (sin prefijo)
   * @param {*}      [fallback=null] — Valor si la clave no existe o expiró
   * @returns {*}
   *
   * @example
   * const cart   = storage.get('cart', { items: [] });
   * const user   = storage.get(STORAGE_KEYS.USER);
   * const theme  = storage.get('theme', 'light');
   */
  get(key, fallback = null) {
    if (!this._available) return fallback;

    try {
      const fullKey = this._buildKey(key);
      const raw = this._driver.getItem(fullKey);

      if (raw === null) return fallback;

      const value = this._deserialize(raw, fallback);

      // Si el valor expiró, limpiar la entrada del storage
      if (value === fallback && raw !== null) {
        this._silentRemove(fullKey);
      }

      return value;
    } catch (err) {
      this._warn(`Error al leer clave "${key}":`, err.message);
      return fallback;
    }
  }

  /**
   * Elimina una clave del storage.
   *
   * @param {string} key — Clave (sin prefijo)
   * @returns {boolean}  — true si existía y fue eliminada
   *
   * @example
   * storage.remove('cart');
   * storage.remove(STORAGE_KEYS.TOKEN);
   */
  remove(key) {
    if (!this._available) return false;

    try {
      const fullKey = this._buildKey(key);
      const existed = this._driver.getItem(fullKey) !== null;
      this._driver.removeItem(fullKey);
      return existed;
    } catch (err) {
      this._warn(`Error al eliminar clave "${key}":`, err.message);
      return false;
    }
  }

  /**
   * Verifica si una clave existe en el storage
   * (y no ha expirado si tiene TTL).
   *
   * @param {string} key — Clave (sin prefijo)
   * @returns {boolean}
   *
   * @example
   * if (storage.exists('user')) {
   *   // usuario logueado
   * }
   */
  exists(key) {
    if (!this._available) return false;

    try {
      const fullKey = this._buildKey(key);
      const raw = this._driver.getItem(fullKey);
      if (raw === null) return false;

      // Verificar TTL
      const sentinel = Symbol("__not_found__");
      const value = this._deserialize(raw, sentinel);
      return value !== sentinel;
    } catch {
      return false;
    }
  }

  /**
   * Elimina TODAS las claves del namespace actual.
   * Solo afecta a claves con el prefijo 'ecommerce_'.
   * NO toca claves de otras aplicaciones en el mismo dominio.
   *
   * @param {string[]} [except=[]] — Claves a conservar (sin prefijo)
   * @returns {number}             — Cantidad de claves eliminadas
   *
   * @example
   * storage.clear();                       // limpia todo
   * storage.clear(['theme', 'newsletter']); // conserva esas claves
   */
  clear(except = []) {
    if (!this._available) return 0;

    try {
      const exceptKeys = except.map((k) => this._buildKey(k));
      const toDelete = [];

      // Iterar todas las claves del driver
      for (let i = 0; i < this._driver.length; i++) {
        const fullKey = this._driver.key(i);
        if (fullKey.startsWith(this._ns) && !exceptKeys.includes(fullKey)) {
          toDelete.push(fullKey);
        }
      }

      // Eliminar fuera del loop para no alterar el índice
      toDelete.forEach((k) => this._driver.removeItem(k));

      return toDelete.length;
    } catch (err) {
      this._warn("Error al limpiar storage:", err.message);
      return 0;
    }
  }

  // ─── API Extendida ────────────────────────────────────────────

  /**
   * Retorna todas las claves del namespace actual (sin prefijo).
   * @returns {string[]}
   *
   * @example
   * storage.keys(); // ['cart', 'user', 'orders', ...]
   */
  keys() {
    if (!this._available) return [];

    try {
      const result = [];
      for (let i = 0; i < this._driver.length; i++) {
        const fullKey = this._driver.key(i);
        if (fullKey.startsWith(this._ns)) {
          result.push(this._stripKey(fullKey));
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Retorna todas las entradas del namespace como un objeto.
   * @returns {Object} — { key: value, ... }
   *
   * @example
   * storage.all(); // { cart: {...}, user: {...} }
   */
  all() {
    return this.keys().reduce((acc, key) => {
      acc[key] = this.get(key);
      return acc;
    }, {});
  }

  /**
   * Actualiza parcialmente un objeto almacenado (shallow merge).
   * Si la clave no existe, actúa como set().
   *
   * @param {string} key
   * @param {Object} partial  — Objeto parcial a mergear
   * @param {Object} [options]
   * @returns {boolean}
   *
   * @example
   * storage.merge('filters', { category: 'mujer', page: 1 });
   */
  merge(key, partial, options = {}) {
    if (typeof partial !== "object" || partial === null) {
      this._warn(`merge(): el segundo argumento debe ser un objeto.`);
      return false;
    }
    const current = this.get(key, {});
    const merged = Array.isArray(current)
      ? partial // Arrays: reemplazar, no mergear
      : { ...current, ...partial };
    return this.set(key, merged, options);
  }

  /**
   * Actualiza un array almacenado añadiendo un ítem al final.
   * Si la clave no existe, crea el array.
   *
   * @param {string} key
   * @param {*}      item
   * @param {Object} [options]
   * @returns {boolean}
   *
   * @example
   * storage.push('wishlist', '42');
   */
  push(key, item, options = {}) {
    const arr = this.get(key, []);
    if (!Array.isArray(arr)) {
      this._warn(`push(): el valor de "${key}" no es un array.`);
      return false;
    }
    arr.push(item);
    return this.set(key, arr, options);
  }

  /**
   * Retorna el tamaño aproximado en bytes de todas las claves del namespace.
   * @returns {number}
   */
  sizeInBytes() {
    if (!this._available) return 0;
    return (
      this.keys().reduce((total, key) => {
        const fullKey = this._buildKey(key);
        const raw = this._driver.getItem(fullKey) ?? "";
        return total + fullKey.length + raw.length;
      }, 0) * 2
    ); // UTF-16: ~2 bytes por carácter
  }

  /**
   * Retorna el tamaño aproximado en KB.
   * @returns {string} — ej: '14.3 KB'
   */
  sizeInKB() {
    return (this.sizeInBytes() / 1024).toFixed(2) + " KB";
  }

  /**
   * Elimina todas las claves con TTL vencido del namespace.
   * Útil para llamar periódicamente y limpiar entradas obsoletas.
   * @returns {number} — Cantidad de claves eliminadas
   */
  purgeExpired() {
    if (!this._available) return 0;

    let count = 0;
    const sentinel = Symbol("expired");

    this.keys().forEach((key) => {
      const fullKey = this._buildKey(key);
      const raw = this._driver.getItem(fullKey);
      if (raw === null) return;

      const value = this._deserialize(raw, sentinel);
      if (value === sentinel) {
        this._driver.removeItem(fullKey);
        count++;
      }
    });

    return count;
  }

  // ─── Atajos Semánticos ────────────────────────────────────────

  /**
   * Guarda la sesión del usuario.
   * @param {Object} user
   * @param {string} token
   */
  saveSession(user, token) {
    this.set(STORAGE_KEYS.USER, user);
    this.set(STORAGE_KEYS.TOKEN, token, { ttl: 86400 }); // 24h
  }

  /**
   * Elimina la sesión del usuario.
   */
  clearSession() {
    this.remove(STORAGE_KEYS.USER);
    this.remove(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(`${this._ns}redirect`);
  }

  /**
   * Retorna el usuario guardado o null.
   * @returns {Object|null}
   */
  getUser() {
    return this.get(STORAGE_KEYS.USER, null);
  }

  /**
   * Retorna el token guardado o null.
   * @returns {string|null}
   */
  getToken() {
    return this.get(STORAGE_KEYS.TOKEN, null);
  }

  /**
   * Guarda el carrito.
   * @param {Object} cart
   */
  saveCart(cart) {
    return this.set(STORAGE_KEYS.CART, cart);
  }

  /**
   * Retorna el carrito o un estado vacío.
   * @returns {Object}
   */
  getCart() {
    return this.get(STORAGE_KEYS.CART, {
      items: [],
      coupon: null,
      discount: 0,
    });
  }

  /**
   * Guarda los pedidos del usuario.
   * @param {Array} orders
   */
  saveOrders(orders) {
    return this.set(STORAGE_KEYS.ORDERS, orders);
  }

  /**
   * Retorna los pedidos guardados.
   * @returns {Array}
   */
  getOrders() {
    return this.get(STORAGE_KEYS.ORDERS, []);
  }

  /**
   * Guarda los filtros activos del catálogo.
   * @param {Object} filters
   */
  saveFilters(filters) {
    return this.set(STORAGE_KEYS.FILTERS, filters);
  }

  /**
   * Retorna los filtros guardados.
   * @returns {Object}
   */
  getFilters() {
    return this.get(STORAGE_KEYS.FILTERS, {});
  }

  /**
   * Guarda la wishlist del usuario.
   * @param {string[]} ids
   */
  saveWishlist(ids) {
    return this.set(STORAGE_KEYS.WISHLIST, ids);
  }

  /**
   * Retorna los IDs de la wishlist.
   * @returns {string[]}
   */
  getWishlist() {
    return this.get(STORAGE_KEYS.WISHLIST, []);
  }

  // ─── Internos ─────────────────────────────────────────────────

  /**
   * Elimina una clave completa (con prefijo) sin validación extra.
   * @param {string} fullKey — Clave ya con namespace
   * @private
   */
  _silentRemove(fullKey) {
    try {
      this._driver.removeItem(fullKey);
    } catch {
      /* silent */
    }
  }

  /**
   * Emite un warning en consola (respeta el flag _silent).
   * @param {...*} args
   * @private
   */
  _warn(...args) {
    if (!this._silent) {
      console.warn("[StorageService]", ...args);
    }
  }

  /**
   * Retorna un resumen del estado del storage para debugging.
   * @returns {string}
   */
  debug() {
    return JSON.stringify(
      {
        namespace: this._ns,
        available: this._available,
        keys: this.keys(),
        sizeKB: this.sizeInKB(),
        entriesCount: this.keys().length,
      },
      null,
      2,
    );
  }
}

// ─── Instancias ───────────────────────────────────────────────

/**
 * Instancia principal — usa localStorage.
 * @type {StorageService}
 */
const storage = new StorageService({
  namespace: NAMESPACE,
  driver: localStorage,
  silent: false,
});

/**
 * Instancia de sesión — usa sessionStorage.
 * Los datos se borran al cerrar la pestaña.
 * @type {StorageService}
 */
const sessionStorage_ = new StorageService({
  namespace: NAMESPACE,
  driver: sessionStorage,
  silent: true,
});

// Debugging en localhost
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  window.__storage = storage;
  window.__storageDebug = () => console.log(storage.debug());
  window.__storageAll = () => console.table(storage.all());

  // Purgar expirados automáticamente en dev
  const expired = storage.purgeExpired();
  if (expired > 0) {
    console.info(
      `[StorageService] ${expired} entrada(s) expirada(s) eliminadas.`,
    );
  }
}

// ─── Exports ──────────────────────────────────────────────────

export default storage;
export {
  StorageService,
  
  NAMESPACE,
  sessionStorage_ as sessionStorage,
};

