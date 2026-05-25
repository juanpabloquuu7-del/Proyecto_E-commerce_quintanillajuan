/**
 * catalog.page.js
 * Vista oficial del Catálogo para LUMIÈRE.
 * Renderiza la grilla de productos, barra de filtros reactiva y ordenamiento.
 */

import { bus, EVENTS } from "../core/events.js";
import store from "../core/store.js";
import ProductService from "../services/product.service.js";

export default class CatalogPage {
  constructor() {
    this.container = null;
    this._unsubscribeStore = null;
  }

  /**
   * Método para el ciclo de vida de tu Router.
   * Renderiza la estructura inicial en el #app.
   * @returns {string} HTML de la página
   */
  render() {
    return /* html */ `
      <div class="catalog-page container py-8 animate-fade-in" style="max-width: 1200px; margin: 0 auto; padding: 20px;">
        <header class="catalog-header mb-8 text-center" style="margin-bottom: 40px;">
          <h1 style="font-family: var(--font-secondary); font-size: 2.5rem; color: var(--color-primary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
            Colección LUMIÈRE
          </h1>
          <p style="color: var(--color-gray-400); font-size: 0.95rem;">
            Diseño contemporáneo con carácter exclusivo.
          </p>
        </header>

        <div class="catalog-layout" style="display: grid; grid-template-columns: 1fr; gap: 30px;">
          <div class="catalog-toolbar" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gray-100); padding-bottom: 15px; margin-bottom: 20px;">
            <div id="catalog-count" style="font-size: 0.88rem; color: var(--color-gray-400);">
              Cargando productos...
            </div>
            
            <div class="sort-wrapper">
              <label for="catalog-sort" style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px; color: var(--color-primary);">Ordenar por:</label>
              <select id="catalog-sort" style="padding: 6px 12px; border: 1px solid var(--color-gray-200); font-size: 0.88rem; background: transparent; outline: none; cursor: pointer;">
                <option value="default">Relevancia</option>
                <option value="price-asc">Precio: Menor a Mayor</option>
                <option value="price-desc">Precio: Mayor a Menor</option>
                <option value="name-asc">Nombre: A-Z</option>
              </select>
            </div>
          </div>

          <main id="catalog-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 30px 20px;">
            </main>
        </div>
      </div>
    `;
  }

  /**
   * Inicializa la lógica una vez el HTML está montado en el DOM por el router.
   */
  init() {
    this.container = document.querySelector("#app");
    if (!this.container) return;

    this._setupSortListener();
    this._renderProducts();

    // Suscribirse de forma reactiva a los filtros del store global
    this._unsubscribeStore = store.subscribe("filters", () => {
      this._renderProducts();
    });

    bus.emit(EVENTS.PRODUCTS_LOADED, { page: "catalog" });
  }

  /**
   * Se ejecuta automáticamente al salir de la página (limpieza de memoria).
   */
  destroy() {
    if (this._unsubscribeStore) {
      this._unsubscribeStore();
    }
  }

  _setupSortListener() {
    const sortSelect = this.container.querySelector("#catalog-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this._renderProducts(e.target.value);
      });
    }
  }

  /**
   * Obtiene, filtra, ordena y pinta los productos en la grilla
   */
  _renderProducts(sortBy = "default") {
    const grid = this.container.querySelector("#catalog-grid");
    const countEl = this.container.querySelector("#catalog-count");
    if (!grid) return;

    // 1. Obtener productos desde tu servicio oficial
    let products = ProductService.getAll() || [];

    // 2. Filtrar reactivamente por el slice 'filters' del store
    const currentFilters = store.getState().filters || {};
    if (currentFilters.category) {
      products = products.filter((p) => p.category === currentFilters.category);
    }

    // 3. Ordenar
    if (sortBy === "price-asc") {
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      products.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name-asc") {
      products.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 4. Contador de la UI
    if (countEl) {
      countEl.textContent = `${products.length} ${products.length === 1 ? "producto encontrado" : "productos encontrados"}`;
    }

    grid.innerHTML = "";

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-gray-400);">
          <p style="font-size: 1.1rem; margin-bottom: 10px;">No se encontraron productos.</p>
        </div>
      `;
      return;
    }

    // 5. Instanciar e inyectar tus componentes personalizados <lumiere-product-card>
    products.forEach((product) => {
      const card = document.createElement("lumiere-product-card");
      grid.appendChild(card);
      card.setProduct(product); // Inyección por API pública
    });
  }
}
