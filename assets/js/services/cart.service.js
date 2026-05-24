/**
 * cart.service.js
 * Servicio de carrito persistente para LUMIÈRE Fashion & Style.
 * Persistencia localStorage · Sincronización store global · Eventos automáticos.
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import storage from "./storage.service.js";
import ProductService from "./product.service.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ecommerce_cart";
const MAX_QUANTITY = 99; // máximo por línea de ítem
const MAX_ITEMS = 50; // máximo de líneas distintas en el carrito

// ─── Helpers internos ──────────────────────────────────────────────────────────

/** Lee el estado del carrito desde localStorage. */
function readCart() {
  return storage.get(STORAGE_KEY) ?? { items: [], updatedAt: null };
}

/** Persiste el carrito y sincroniza el store global. */
function writeCart(cart) {
  cart.updatedAt = new Date().toISOString();
  storage.set(STORAGE_KEY, cart);

  // Sincroniza el slice 'cart' del store con totales derivados
  store.setState("cart", {
    items: cart.items,
    total: CartService.getTotal(cart.items),
    count: CartService.getCount(cart.items),
    subtotal: CartService.getSubtotal(cart.items),
    savings: CartService.getSavings(cart.items),
  });
}

/**
 * Construye la clave única de línea de carrito.
 * Un mismo producto con distinta talla/color es una línea diferente.
 */
function lineKey(productId, size, color) {
  return [productId, size ?? "", color ?? ""].join("::");
}

/**
 * Valida los parámetros de entrada comunes a add/increase/decrease.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInput(productId, qty, size, color) {
  const errors = [];

  if (!productId || typeof productId !== "string") {
    errors.push("productId es obligatorio y debe ser un string.");
  }

  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1) {
    errors.push("La cantidad debe ser un entero mayor a 0.");
  }

  if (q > MAX_QUANTITY) {
    errors.push(`La cantidad máxima por producto es ${MAX_QUANTITY}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Servicio ───────────────────────────────────────────────────────────────────

const CartService = {
  // ── Init ────────────────────────────────────────────────────────────────────

  /**
   * Inicializa el slice 'cart' del store con datos persistidos.
   * Llamar desde app.js durante el bootstrap.
   */
  init() {
    const cart = readCart();

    // Limpieza defensiva: elimina ítems cuyo producto ya no exista
    const valid = cart.items.filter((item) => {
      const exists = ProductService.getById(item.productId);
      return Boolean(exists);
    });

    if (valid.length !== cart.items.length) {
      cart.items = valid;
      writeCart(cart);
    } else {
      // Solo sincroniza el store sin re-persistir
      store.setState("cart", {
        items: cart.items,
        total: this.getTotal(cart.items),
        count: this.getCount(cart.items),
        subtotal: this.getSubtotal(cart.items),
        savings: this.getSavings(cart.items),
      });
    }

    return cart.items;
  },

  // ── ADD ─────────────────────────────────────────────────────────────────────

  /**
   * Agrega un producto al carrito o incrementa su cantidad si ya existe la misma línea.
   * @param {string}      productId
   * @param {number}      [qty=1]
   * @param {string|null} [size=null]    - Talla seleccionada.
   * @param {string|null} [color=null]   - Color seleccionado.
   * @returns {{ success: boolean, item?: Object, errors?: string[] }}
   */
  add(productId, qty = 1, size = null, color = null) {
    // 1. Validaciones de input
    const { valid, errors } = validateInput(productId, qty, size, color);
    if (!valid) return { success: false, errors };

    // 2. El producto debe existir
    const product = ProductService.getById(productId);
    if (!product) {
      return { success: false, errors: ["El producto no existe."] };
    }

    // 3. Verificar talla requerida
    if (product.sizes?.length > 0 && !size) {
      return { success: false, errors: ["Debes seleccionar una talla."] };
    }

    // 4. Verificar stock disponible
    if (!ProductService.hasStock(productId, qty)) {
      return {
        success: false,
        errors: ["Stock insuficiente para la cantidad solicitada."],
      };
    }

    const cart = readCart();
    const key = lineKey(productId, size, color);
    const idx = cart.items.findIndex((i) => i.key === key);

    if (idx !== -1) {
      // Línea ya existente → incrementar
      const newQty = cart.items[idx].quantity + Number(qty);

      if (newQty > MAX_QUANTITY) {
        return {
          success: false,
          errors: [
            `No puedes añadir más de ${MAX_QUANTITY} unidades del mismo artículo.`,
          ],
        };
      }

      if (!ProductService.hasStock(productId, newQty)) {
        return {
          success: false,
          errors: ["No hay suficiente stock para esa cantidad."],
        };
      }

      cart.items[idx].quantity = newQty;
      cart.items[idx].updatedAt = new Date().toISOString();

      writeCart(cart);
      bus.emit(EVENTS.CART_UPDATED, {
        action: "increase",
        item: cart.items[idx],
        cart: cart.items,
      });
      return { success: true, item: cart.items[idx] };
    } else {
      // Nueva línea
      if (cart.items.length >= MAX_ITEMS) {
        return {
          success: false,
          errors: [
            `El carrito no puede tener más de ${MAX_ITEMS} artículos distintos.`,
          ],
        };
      }

      const item = {
        key,
        productId,
        quantity: Number(qty),
        size: size ?? null,
        color: color ?? null,
        // Snapshot de precio al momento de agregar
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        // Snapshot de datos visuales para el drawer/page sin re-consultar
        name: product.name,
        image: product.images?.[0] ?? null,
        slug: product.slug ?? productId,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      cart.items.push(item);
      writeCart(cart);

      bus.emit(EVENTS.CART_ITEM_ADDED, { item, cart: cart.items });
      return { success: true, item };
    }
  },

  // ── REMOVE ──────────────────────────────────────────────────────────────────

  /**
   * Elimina completamente una línea del carrito.
   * @param {string}      productId
   * @param {string|null} [size=null]
   * @param {string|null} [color=null]
   * @returns {{ success: boolean, errors?: string[] }}
   */
  remove(productId, size = null, color = null) {
    if (!productId)
      return { success: false, errors: ["productId es obligatorio."] };

    const cart = readCart();
    const key = lineKey(productId, size, color);
    const idx = cart.items.findIndex((i) => i.key === key);

    if (idx === -1) {
      return { success: false, errors: ["El artículo no está en el carrito."] };
    }

    const [removed] = cart.items.splice(idx, 1);
    writeCart(cart);

    bus.emit(EVENTS.CART_ITEM_REMOVED, { item: removed, cart: cart.items });
    return { success: true };
  },

  // ── INCREASE ────────────────────────────────────────────────────────────────

  /**
   * Incrementa la cantidad de una línea en `qty` unidades.
   * @param {string}      productId
   * @param {number}      [qty=1]
   * @param {string|null} [size=null]
   * @param {string|null} [color=null]
   * @returns {{ success: boolean, item?: Object, errors?: string[] }}
   */
  increase(productId, qty = 1, size = null, color = null) {
    const { valid, errors } = validateInput(productId, qty, size, color);
    if (!valid) return { success: false, errors };

    const cart = readCart();
    const key = lineKey(productId, size, color);
    const idx = cart.items.findIndex((i) => i.key === key);

    if (idx === -1) {
      return { success: false, errors: ["El artículo no está en el carrito."] };
    }

    const newQty = cart.items[idx].quantity + Number(qty);

    if (newQty > MAX_QUANTITY) {
      return {
        success: false,
        errors: [`Máximo ${MAX_QUANTITY} unidades por artículo.`],
      };
    }

    if (!ProductService.hasStock(productId, newQty)) {
      return { success: false, errors: ["Stock insuficiente."] };
    }

    cart.items[idx].quantity = newQty;
    cart.items[idx].updatedAt = new Date().toISOString();
    writeCart(cart);

    bus.emit(EVENTS.CART_UPDATED, {
      action: "increase",
      item: cart.items[idx],
      cart: cart.items,
    });
    return { success: true, item: cart.items[idx] };
  },

  // ── DECREASE ────────────────────────────────────────────────────────────────

  /**
   * Decrementa la cantidad de una línea en `qty` unidades.
   * Si la cantidad resultante es ≤ 0, elimina la línea.
   * @param {string}      productId
   * @param {number}      [qty=1]
   * @param {string|null} [size=null]
   * @param {string|null} [color=null]
   * @returns {{ success: boolean, item?: Object|null, errors?: string[] }}
   */
  decrease(productId, qty = 1, size = null, color = null) {
    const { valid, errors } = validateInput(productId, qty, size, color);
    if (!valid) return { success: false, errors };

    const cart = readCart();
    const key = lineKey(productId, size, color);
    const idx = cart.items.findIndex((i) => i.key === key);

    if (idx === -1) {
      return { success: false, errors: ["El artículo no está en el carrito."] };
    }

    const newQty = cart.items[idx].quantity - Number(qty);

    if (newQty <= 0) {
      // Elimina la línea automáticamente
      const [removed] = cart.items.splice(idx, 1);
      writeCart(cart);
      bus.emit(EVENTS.CART_ITEM_REMOVED, { item: removed, cart: cart.items });
      return { success: true, item: null };
    }

    cart.items[idx].quantity = newQty;
    cart.items[idx].updatedAt = new Date().toISOString();
    writeCart(cart);

    bus.emit(EVENTS.CART_UPDATED, {
      action: "decrease",
      item: cart.items[idx],
      cart: cart.items,
    });
    return { success: true, item: cart.items[idx] };
  },

  // ── CLEAR ───────────────────────────────────────────────────────────────────

  /**
   * Vacía el carrito completamente.
   * @returns {{ success: boolean }}
   */
  clear() {
    writeCart({ items: [] });
    bus.emit(EVENTS.CART_CLEARED, {});
    return { success: true };
  },

  // ── GETTERS ─────────────────────────────────────────────────────────────────

  /**
   * Retorna todas las líneas del carrito enriquecidas con datos actuales del producto.
   * @returns {Object[]}
   */
  getItems() {
    return readCart().items;
  },

  /**
   * Retorna la cantidad total de unidades en el carrito (suma de qty de todas las líneas).
   * @param {Object[]} [items] - Opcional: pasar items directamente para evitar re-lectura.
   * @returns {number}
   */
  getCount(items) {
    const list = items ?? readCart().items;
    return list.reduce((acc, i) => acc + i.quantity, 0);
  },

  /**
   * Subtotal sin descuentos (precio actual × cantidad).
   * @param {Object[]} [items]
   * @returns {number}
   */
  getSubtotal(items) {
    const list = items ?? readCart().items;
    return list.reduce((acc, i) => acc + i.price * i.quantity, 0);
  },

  /**
   * Total a pagar (igual al subtotal; extensible para cupones/impuestos).
   * @param {Object[]} [items]
   * @returns {number}
   */
  getTotal(items) {
    return this.getSubtotal(items);
  },

  /**
   * Ahorro total respecto a los precios comparativos (precio tachado).
   * @param {Object[]} [items]
   * @returns {number}
   */
  getSavings(items) {
    const list = items ?? readCart().items;
    return list.reduce((acc, i) => {
      if (!i.compareAtPrice || i.compareAtPrice <= i.price) return acc;
      return acc + (i.compareAtPrice - i.price) * i.quantity;
    }, 0);
  },

  /**
   * Resumen completo del carrito.
   * @returns {{ items: Object[], count: number, subtotal: number, total: number, savings: number }}
   */
  getSummary() {
    const items = this.getItems();
    return {
      items,
      count: this.getCount(items),
      subtotal: this.getSubtotal(items),
      total: this.getTotal(items),
      savings: this.getSavings(items),
    };
  },

  // ── UTILITIES ───────────────────────────────────────────────────────────────

  /**
   * Comprueba si un producto (con variante opcional) ya está en el carrito.
   * @param {string}      productId
   * @param {string|null} [size=null]
   * @param {string|null} [color=null]
   * @returns {boolean}
   */
  contains(productId, size = null, color = null) {
    const key = lineKey(productId, size, color);
    return readCart().items.some((i) => i.key === key);
  },

  /**
   * Retorna la cantidad actual de una línea específica (0 si no existe).
   * @param {string}      productId
   * @param {string|null} [size=null]
   * @param {string|null} [color=null]
   * @returns {number}
   */
  getLineQuantity(productId, size = null, color = null) {
    const key = lineKey(productId, size, color);
    const item = readCart().items.find((i) => i.key === key);
    return item?.quantity ?? 0;
  },

  /**
   * Actualiza los snapshots de precio de todos los ítems con el precio actual del producto.
   * Útil para sincronizar tras cambios de precio en el catálogo.
   * @returns {{ updated: number }}
   */
  syncPrices() {
    const cart = readCart();
    let updated = 0;

    cart.items = cart.items.map((item) => {
      const product = ProductService.getById(item.productId);
      if (!product) return item;

      const priceChanged =
        product.price !== item.price ||
        product.compareAtPrice !== item.compareAtPrice;

      if (priceChanged) {
        updated++;
        return {
          ...item,
          price: product.price,
          compareAtPrice: product.compareAtPrice ?? null,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    if (updated > 0) {
      writeCart(cart);
      bus.emit(EVENTS.CART_UPDATED, {
        action: "sync_prices",
        cart: cart.items,
      });
    }

    return { updated };
  },

  /**
   * Formatea un precio como string de moneda.
   * @param {number} amount
   * @param {string} [currency='USD']
   * @returns {string}
   */
  formatPrice(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  },
};

export default CartService;
