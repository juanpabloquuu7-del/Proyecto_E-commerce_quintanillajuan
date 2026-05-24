/**
 * order.service.js
 * Gestión completa de pedidos para LUMIÈRE Fashion & Style.
 * Persistencia localStorage · Sincronización store global · Eventos automáticos.
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import storage from "./storage.service.js";
import CartService from "./cart.service.js";
import ProductService from "./product.service.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ecommerce_orders";

/** Flujo de estados permitido: cada estado sólo puede avanzar a los listados. */
const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [], // estado final exitoso
  cancelled: [], // estado final negativo
};

const VALID_STATUSES = Object.keys(STATUS_TRANSITIONS);

/** Métodos de pago aceptados. */
const VALID_PAYMENT_METHODS = [
  "credit_card",
  "debit_card",
  "paypal",
  "bank_transfer",
  "cash",
];

/** Labels legibles para la UI. */
const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  processing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// ─── Helpers internos ──────────────────────────────────────────────────────────

/** Genera un número de orden legible: LUM-YYYYMMDD-XXXX */
function generateOrderNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LUM-${ymd}-${suffix}`;
}

/** Genera ID interno único. */
function generateId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Lee todos los pedidos desde localStorage. */
function readAll() {
  return storage.get(STORAGE_KEY) ?? [];
}

/** Persiste todos los pedidos y sincroniza el store. */
function writeAll(orders) {
  storage.set(STORAGE_KEY, orders);
  store.setState("orders", { items: orders, loading: false, error: null });
}

// ─── Validaciones de checkout ──────────────────────────────────────────────────

/**
 * Valida la dirección de envío.
 * @param {Object} address
 * @returns {string[]} array de errores
 */
function validateAddress(address) {
  const errors = [];
  if (!address || typeof address !== "object") {
    return ["La dirección de envío es obligatoria."];
  }

  const required = {
    firstName: "Nombre",
    lastName: "Apellido",
    street: "Dirección",
    city: "Ciudad",
    country: "País",
    zipCode: "Código postal",
  };

  for (const [field, label] of Object.entries(required)) {
    const val = address[field];
    if (!val || String(val).trim().length === 0) {
      errors.push(`${label} es obligatorio.`);
    }
  }

  if (address.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
    errors.push("El email no tiene un formato válido.");
  }

  if (address.phone && !/^\+?[\d\s\-().]{6,20}$/.test(address.phone)) {
    errors.push("El teléfono no tiene un formato válido.");
  }

  if (address.zipCode && String(address.zipCode).trim().length < 3) {
    errors.push("El código postal debe tener al menos 3 caracteres.");
  }

  return errors;
}

/**
 * Valida los datos de pago.
 * @param {Object} payment
 * @returns {string[]} array de errores
 */
function validatePayment(payment) {
  const errors = [];
  if (!payment || typeof payment !== "object") {
    return ["Los datos de pago son obligatorios."];
  }

  if (!VALID_PAYMENT_METHODS.includes(payment.method)) {
    errors.push(
      `Método de pago inválido. Opciones: ${VALID_PAYMENT_METHODS.join(", ")}.`,
    );
  }

  if (payment.method === "credit_card" || payment.method === "debit_card") {
    if (!payment.cardHolder || payment.cardHolder.trim().length < 2) {
      errors.push("El nombre del titular de la tarjeta es obligatorio.");
    }
    // Solo validamos que vengan los campos, nunca almacenamos datos sensibles reales
    if (!payment.lastFour || !/^\d{4}$/.test(String(payment.lastFour))) {
      errors.push("Los últimos 4 dígitos de la tarjeta son obligatorios.");
    }
  }

  return errors;
}

/**
 * Valida los ítems del carrito para checkout:
 * existencia, stock disponible y precio consistente.
 * @param {Object[]} items
 * @returns {string[]} array de errores
 */
function validateItems(items) {
  const errors = [];

  if (!Array.isArray(items) || items.length === 0) {
    return ["El carrito está vacío."];
  }

  for (const item of items) {
    const product = ProductService.getById(item.productId);

    if (!product) {
      errors.push(
        `El producto "${item.name ?? item.productId}" ya no está disponible.`,
      );
      continue;
    }

    if (product.stock < item.quantity) {
      errors.push(
        `Stock insuficiente para "${product.name}": solicitado ${item.quantity}, disponible ${product.stock}.`,
      );
    }

    if (product.price !== item.price) {
      errors.push(
        `El precio de "${product.name}" ha cambiado. Por favor, refresca el carrito.`,
      );
    }
  }

  return errors;
}

// ─── Cálculos de totales ────────────────────────────────────────────────────────

/**
 * Calcula los totales del pedido a partir de las líneas de ítem.
 * @param {Object[]} items
 * @param {number}   [shippingCost=0]
 * @param {number}   [discount=0]      - Descuento en valor absoluto.
 * @returns {{ subtotal, shipping, discount, tax, total }}
 */
function calculateTotals(items, shippingCost = 0, discount = 0) {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const savings = items.reduce((acc, i) => {
    if (!i.compareAtPrice || i.compareAtPrice <= i.price) return acc;
    return acc + (i.compareAtPrice - i.price) * i.quantity;
  }, 0);

  const discountApplied = Math.min(discount, subtotal); // no puede ser mayor que el subtotal
  const taxable = subtotal - discountApplied;
  const tax = parseFloat((taxable * 0.0).toFixed(2)); // IVA configurable; 0 por defecto
  const total = parseFloat((taxable + tax + shippingCost).toFixed(2));

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    savings: parseFloat(savings.toFixed(2)),
    shipping: parseFloat(shippingCost.toFixed(2)),
    discount: parseFloat(discountApplied.toFixed(2)),
    tax,
    total,
  };
}

// ─── Servicio ───────────────────────────────────────────────────────────────────

const OrderService = {
  // ── Init ────────────────────────────────────────────────────────────────────

  /**
   * Inicializa el slice 'orders' del store con datos persistidos.
   * Llamar desde app.js durante el bootstrap.
   */
  init() {
    const orders = readAll();
    store.setState("orders", { items: orders, loading: false, error: null });
    return orders;
  },

  // ── CREATE ──────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo pedido a partir del estado actual del carrito.
   *
   * @param {Object} payload
   * @param {Object}   payload.shippingAddress  - Dirección de envío (ver validateAddress).
   * @param {Object}   payload.billingAddress   - Dirección de facturación (opcional; usa shipping si omite).
   * @param {Object}   payload.payment          - Datos de pago (ver validatePayment).
   * @param {string}   [payload.userId]         - ID del usuario autenticado (null si guest).
   * @param {string}   [payload.notes]          - Notas del cliente.
   * @param {number}   [payload.shippingCost=0]
   * @param {number}   [payload.discount=0]
   * @param {string}   [payload.couponCode]
   *
   * @returns {{ success: boolean, order?: Object, errors?: string[] }}
   */
  create(payload) {
    // ── 1. Validar estructura del payload ───────────────────────────────────
    if (!payload || typeof payload !== "object") {
      return { success: false, errors: ["Payload de pedido inválido."] };
    }

    const {
      shippingAddress,
      billingAddress,
      payment,
      userId = null,
      notes = "",
      shippingCost = 0,
      discount = 0,
      couponCode = null,
    } = payload;

    const errors = [
      ...validateAddress(shippingAddress),
      ...validatePayment(payment),
    ];

    if (billingAddress) {
      const billingErrors = validateAddress(billingAddress);
      errors.push(...billingErrors.map((e) => `[Facturación] ${e}`));
    }

    if (errors.length > 0) return { success: false, errors };

    // ── 2. Validar ítems del carrito ────────────────────────────────────────
    const cartItems = CartService.getItems();
    const itemErrors = validateItems(cartItems);
    if (itemErrors.length > 0) return { success: false, errors: itemErrors };

    // ── 3. Calcular totales ─────────────────────────────────────────────────
    const totals = calculateTotals(
      cartItems,
      Number(shippingCost),
      Number(discount),
    );

    // ── 4. Snapshot de líneas (inmutable en el pedido) ──────────────────────
    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image ?? null,
      size: item.size ?? null,
      color: item.color ?? null,
      quantity: item.quantity,
      price: item.price,
      compareAtPrice: item.compareAtPrice ?? null,
      lineTotal: parseFloat((item.price * item.quantity).toFixed(2)),
    }));

    // ── 5. Construir el pedido ──────────────────────────────────────────────
    const now = new Date().toISOString();
    const order = {
      id: generateId(),
      orderNumber: generateOrderNumber(),
      status: "pending",
      userId,

      items: orderItems,
      totals,

      shippingAddress: { ...shippingAddress },
      billingAddress: billingAddress
        ? { ...billingAddress }
        : { ...shippingAddress },

      // Sólo almacenamos datos NO sensibles del pago
      payment: {
        method: payment.method,
        cardHolder: payment.cardHolder ?? null,
        lastFour: payment.lastFour ?? null,
        status: "approved", // en una app real vendría de la pasarela
      },

      couponCode: couponCode ?? null,
      notes: notes.trim(),

      // Trazabilidad de estados
      statusHistory: [{ status: "pending", at: now, note: "Pedido creado." }],

      createdAt: now,
      updatedAt: now,
      confirmedAt: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
    };

    // ── 6. Persistir pedido ─────────────────────────────────────────────────
    const orders = readAll();
    orders.unshift(order); // más reciente primero
    writeAll(orders);

    // ── 7. Decrementar stock de cada producto ───────────────────────────────
    for (const item of orderItems) {
      ProductService.decrementStock(item.productId, item.quantity);
    }

    // ── 8. Vaciar carrito ───────────────────────────────────────────────────
    CartService.clear();

    // ── 9. Emitir evento ────────────────────────────────────────────────────
    bus.emit(EVENTS.ORDER_CREATED, { order });

    return { success: true, order };
  },

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Retorna todos los pedidos ordenados por fecha descendente.
   * @param {string|null} [userId] - Si se provee, filtra por usuario.
   * @returns {Object[]}
   */
  getAll(userId = null) {
    const orders = readAll();
    if (!userId) return orders;
    return orders.filter((o) => o.userId === userId);
  },

  /**
   * Retorna un pedido por su ID interno.
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    if (!id) return null;
    return readAll().find((o) => o.id === id) ?? null;
  },

  /**
   * Retorna un pedido por su número de orden legible (LUM-...).
   * @param {string} orderNumber
   * @returns {Object|null}
   */
  getByOrderNumber(orderNumber) {
    if (!orderNumber) return null;
    return readAll().find((o) => o.orderNumber === orderNumber) ?? null;
  },

  // ── UPDATE STATUS ───────────────────────────────────────────────────────────

  /**
   * Actualiza el estado de un pedido siguiendo el flujo de transiciones permitido.
   *
   * @param {string} id         - ID del pedido.
   * @param {string} newStatus  - Nuevo estado.
   * @param {string} [note]     - Nota opcional para el historial.
   * @returns {{ success: boolean, order?: Object, errors?: string[] }}
   */
  updateStatus(id, newStatus, note = "") {
    if (!id) return { success: false, errors: ["ID de pedido obligatorio."] };
    if (!newStatus)
      return { success: false, errors: ["El nuevo estado es obligatorio."] };

    if (!VALID_STATUSES.includes(newStatus)) {
      return {
        success: false,
        errors: [`Estado inválido. Opciones: ${VALID_STATUSES.join(", ")}.`],
      };
    }

    const orders = readAll();
    const idx = orders.findIndex((o) => o.id === id);

    if (idx === -1) {
      return { success: false, errors: [`Pedido "${id}" no encontrado.`] };
    }

    const order = orders[idx];
    const allowed = STATUS_TRANSITIONS[order.status] ?? [];

    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        errors: [
          `No se puede pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[newStatus]}".`,
          allowed.length
            ? `Transiciones permitidas: ${allowed.map((s) => STATUS_LABELS[s]).join(", ")}.`
            : "Este pedido está en un estado final.",
        ],
      };
    }

    const now = new Date().toISOString();

    // Actualizar timestamps específicos
    const timestamps = {
      confirmed: "confirmedAt",
      shipped: "shippedAt",
      delivered: "deliveredAt",
      cancelled: "cancelledAt",
    };
    if (timestamps[newStatus]) {
      order[timestamps[newStatus]] = now;
    }

    // Si se cancela, restaurar stock
    if (newStatus === "cancelled" && order.status !== "delivered") {
      for (const item of order.items) {
        ProductService.update(item.productId, {
          stock:
            (ProductService.getById(item.productId)?.stock ?? 0) +
            item.quantity,
        });
      }
    }

    order.status = newStatus;
    order.updatedAt = now;
    order.statusHistory.push({
      status: newStatus,
      at: now,
      note: note.trim() || STATUS_LABELS[newStatus],
    });

    orders[idx] = order;
    writeAll(orders);

    bus.emit(EVENTS.ORDER_UPDATED, {
      order,
      previousStatus: orders[idx]?.status,
    });
    return { success: true, order };
  },

  // ── UTILITIES ───────────────────────────────────────────────────────────────

  /**
   * Retorna los estados válidos con sus labels para la UI.
   * @returns {{ value: string, label: string }[]}
   */
  getStatuses() {
    return VALID_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  },

  /**
   * Label legible de un estado.
   * @param {string} status
   * @returns {string}
   */
  getStatusLabel(status) {
    return STATUS_LABELS[status] ?? status;
  },

  /**
   * Retorna las transiciones de estado disponibles desde el estado actual.
   * @param {string} currentStatus
   * @returns {{ value: string, label: string }[]}
   */
  getAvailableTransitions(currentStatus) {
    return (STATUS_TRANSITIONS[currentStatus] ?? []).map((s) => ({
      value: s,
      label: STATUS_LABELS[s],
    }));
  },

  /**
   * Formatea un precio como string de moneda (delega a CartService).
   * @param {number} amount
   * @returns {string}
   */
  formatPrice(amount) {
    return CartService.formatPrice(amount);
  },

  /**
   * Estadísticas básicas de pedidos de un usuario.
   * @param {string|null} [userId]
   * @returns {{ total: number, byStatus: Object, totalSpent: number }}
   */
  getStats(userId = null) {
    const orders = this.getAll(userId);
    const byStatus = VALID_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {},
    );

    let totalSpent = 0;
    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
      if (order.status === "delivered") totalSpent += order.totals.total;
    }

    return {
      total: orders.length,
      byStatus,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
    };
  },
};

export default OrderService;
