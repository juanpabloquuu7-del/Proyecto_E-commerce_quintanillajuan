/**
 * store.js
 * Almacén de Estado Global Centralizado y Reactivo para LUMIÈRE.
 * Patrón Store con soporte de persistencia local y suscripciones por módulos.
 */

// Estado inicial por defecto de la aplicación
const DEFAULT_STATE = {
  cart: { items: [], total: 0, subtotal: 0, shipping: 0 },
  filters: { category: "all", search: "", sort: "relevance", onSale: false },
  wishlist: { items: [] },
  orders: [],
  products: { items: [], loaded: false, updatedAt: null },
};

class Store {
  constructor() {
    // Intentamos recuperar el estado previo desde el almacenamiento local o usamos el por defecto
    const savedState = localStorage.getItem("lumiere_store_state");
    this._state = savedState ? JSON.parse(savedState) : DEFAULT_STATE;
    this._listeners = new Map();
  }

  /**
   * Obtiene una porción específica del estado (slice) o el estado completo.
   * @param {string} slice Nombre de la propiedad del estado (ej. 'cart', 'filters')
   */
  getState(slice = null) {
    if (slice) {
      return this._state[slice] !== undefined ? this._state[slice] : null;
    }
    return this._state;
  }

  /**
   * Actualiza una porción del estado global y notifica de inmediato a los componentes suscritos.
   * @param {string} slice Nombre de la propiedad a modificar.
   * @param {Object|Array} newValue Nuevos datos que reemplazarán la porción antigua.
   */
  setState(slice, newValue) {
    if (this._state[slice] === undefined) {
      console.warn(
        `⚠️ Intentando inicializar un slice no registrado en el estado global: ${slice}`,
      );
    }

    this._state[slice] = newValue;

    // Sincronizamos con el almacenamiento local del navegador de forma preventiva
    localStorage.setItem("lumiere_store_state", JSON.stringify(this._state));

    // Si existen componentes escuchando este fragmento del estado, los ejecutamos
    if (this._listeners.has(slice)) {
      this._listeners.get(slice).forEach((callback) => callback(newValue));
    }
  }

  /**
   * Suscribe un componente o función a los cambios de una porción del estado.
   * @param {string} slice Fragmento del estado a observar (ej. 'cart').
   * @param {Function} callback Función que se ejecutará cada vez que mute el slice.
   * @returns {Function} Función de des-suscripción para evitar fugas de memoria en el Router.
   */
  subscribe(slice, callback) {
    if (!this._listeners.has(slice)) {
      this._listeners.set(slice, []);
    }

    this._listeners.get(slice).push(callback);

    // Retornamos un método limpio para remover la escucha cuando cambiamos de página
    return () => {
      const currentListeners = this._listeners.get(slice) || [];
      this._listeners.set(
        slice,
        currentListeners.filter((cb) => cb !== callback),
      );
    };
  }
}

// Exportamos una instancia única (Singleton) para que toda la app comparta el mismo estado
const store = new Store();
export default store;
