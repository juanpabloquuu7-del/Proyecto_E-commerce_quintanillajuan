/**
 * events.js
 * Sistema de Bus de Eventos (Event Bus) centralizado para LUMIÈRE.
 * Permite la comunicación desacoplada y reactiva entre Web Components, Servicios y el Router.
 */

/**
 * Diccionario de eventos globales de la aplicación.
 * Centraliza las cadenas de texto para evitar errores de tipeo en los emisores y suscriptores.
 */
export const EVENTS = {
  // Eventos de Navegación y Rutas
  ROUTE_CHANGED: "lumiere:route:changed",
  NAVIGATE_TO: "lumiere:navigate",

  // Eventos del Catálogo y Productos
  PRODUCTS_LOADED: "lumiere:products:loaded",
  PRODUCT_OPEN_MODAL: "lumiere:product:open_modal",

  // Eventos de la Bolsa de Compras (Carrito)
  CART_UPDATED: "lumiere:cart:updated",
  CART_TOGGLE: "lumiere:cart:toggle",

  // Eventos de Procesamiento de Órdenes (Checkout)
  ORDER_CREATED: "lumiere:order:created",
  ORDER_STATUS_CHANGED: "lumiere:order:status_changed",
};

class EventBus {
  constructor() {
    this.bus = document.createElement("div");
  }

  /**
   * Suscribe un callback a un evento específico del ecosistema.
   * @param {string} event Nombre del evento (Usar diccionario EVENTS).
   * @param {Function} callback Función receptora que procesará los datos.
   */
  on(event, callback) {
    this.bus.addEventListener(event, (e) => callback(e.detail));
  }

  /**
   * Elimina la suscripción de un callback a un evento específico.
   * @param {string} event Nombre del evento.
   * @param {Function} callback Función de referencia a remover.
   */
  off(event, callback) {
    this.bus.removeEventListener(event, callback);
  }

  /**
   * Emite un evento global transmitiendo un payload de datos a todos los componentes suscritos.
   * @param {string} event Nombre del evento (Usar diccionario EVENTS).
   * @param {Object} detail Carga útil o datos adjuntos del evento.
   */
  emit(event, detail = {}) {
    const customEvent = new CustomEvent(event, {
      detail,
      bubbles: true,
      composed: true, // Permite que el evento atraviese la barrera del Shadow DOM si es necesario
    });
    this.bus.dispatchEvent(customEvent);
  }
}

// Instancia única (Singleton) para asegurar un único canal de comunicación global
export const bus = new EventBus();
export default bus;
  