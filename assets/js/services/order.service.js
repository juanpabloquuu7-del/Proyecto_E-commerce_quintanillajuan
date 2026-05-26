/**
 * order.service.js
 * Servicio de Negocio para la Gestión, Validación y Persistencia de Pedidos.
 * Conexión directa con el Store global de LUMIÈRE.
 */

import store from "../core/store.js";

export class OrderService {
  /**
   * Obtiene la lista completa de órdenes registradas históricamente por el cliente.
   * @returns {Array} Listado de pedidos estructurados.
   */
  static getAllOrders() {
    return store.getState("orders") || [];
  }

  /**
   * Procesa, valida y crea un nuevo pedido en el ecosistema.
   * @param {Object} orderData Estructura base que contiene ítems, totales y dirección.
   * @returns {Object} Resultado de la operación conteniendo banderas de éxito y errores.
   */
  static createOrder(orderData) {
    const errors = [];

    // Validaciones lógicas obligatorias de negocio
    if (!orderData.items || orderData.items.length === 0) {
      errors.push(
        "No es posible generar una orden con la bolsa de compras vacía.",
      );
    }

    const addr = orderData.shippingAddress || {};
    if (
      !addr.firstName ||
      !addr.lastName ||
      !addr.address ||
      !addr.city ||
      !addr.phone ||
      !addr.email
    ) {
      errors.push(
        "Todos los campos del formulario de facturación y despacho son obligatorios.",
      );
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Estructuración del objeto final de la Orden estilo Ecommerce Profesional
    const newOrder = {
      id: `LMR-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now().toString().substr(-4)}`,
      items: [...orderData.items],
      shippingAddress: { ...addr },
      paymentMethod: orderData.paymentMethod || "credit_card",
      subtotal: orderData.subtotal,
      shippingCost: orderData.shippingCost || 0,
      total: orderData.total,
      status: "Procesado con Éxito",
      createdAt: new Date().toISOString(),
    };

    // Recuperamos las órdenes previas, inyectamos la nueva al inicio y actualizamos el Store
    const currentOrders = store.getState("orders") || [];
    store.setState("orders", [newOrder, ...currentOrders]);

    return {
      success: true,
      order: newOrder,
    };
  }

  /**
   * Recupera una orden específica basándose en su ID único.
   * @param {string} orderId Código identificador de la orden.
   */
  static getOrderById(orderId) {
    const orders = this.getAllOrders();
    return orders.find((o) => o.id === orderId) || null;
  }
}

export default OrderService;
