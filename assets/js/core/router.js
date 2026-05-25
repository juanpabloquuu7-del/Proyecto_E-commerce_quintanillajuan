/**
 * router.js
 * Enrutador adaptado para inyección de fragmentos HTML5 puros en LUMIÈRE.
 */
import ProductService from "../services/product.service.js";
import store from "./store.js";
import { bus, EVENTS } from "./events.js";

// Mapa de rutas físicas a tus nuevos archivos HTML5 semánticos
const ROUTES = {
  "/": "./js/pages/home.page.html",
  "/catalog": "./js/pages/catalog.page.html",
  "/product": "./js/pages/product-detail.page.html",
  "/checkout": "./js/pages/checkout.page.html",
  "/cart": "./js/pages/cart.page.html", // Añadimos la ruta del carrito
};

export class Router {
  constructor() {
    this.appContainer = document.querySelector("#app");
    this._unsubscribeStore = null;
    this.init();
  }

  init() {
    window.addEventListener("hashchange", () => this.handleRoute());
    window.addEventListener("DOMContentLoaded", () => this.handleRoute());
  }

  async handleRoute() {
    // 1. Limpieza preventiva de suscripciones previas para evitar consumo de memoria
    if (this._unsubscribeStore) {
      this._unsubscribeStore();
      this._unsubscribeStore = null;
    }

    const path = window.location.hash.slice(1) || "/";

    // Soporte para parámetros dinámicos en la URL (ej: /product?id=3)
    const routeBase = path.startsWith("/product") ? "/product" : path;
    const htmlTemplateUrl = ROUTES[routeBase] || ROUTES["/"];

    try {
      // 2. Fetch asíncrono para leer el archivo .html plano
      const response = await fetch(htmlTemplateUrl);
      if (!response.ok)
        throw new Error(`Error al cargar la plantilla: ${htmlTemplateUrl}`);

      const htmlContent = await response.text();

      // 3. Inyección directa en la SPA. Al procesar esto, el navegador cargará automáticamente
      // la etiqueta <link rel="stylesheet"> que pusiste arriba de cada HTML.
      this.appContainer.innerHTML = htmlContent;

      // 4. Disparar la lógica de JavaScript correspondiente a la vista montada
      this._initPageLogic(routeBase, path);
    } catch (error) {
      console.error("Error en el enrutamiento de LUMIÈRE:", error);
      this.appContainer.innerHTML = `<p style="text-align:center; padding:50px; color:var(--color-primary, #161624);">Hubo un error al cargar este espacio.</p>`;
    }
  }

  /**
   * Conector de ciclo de vida: Ejecuta la lógica JS según la vista activa
   */
  _initPageLogic(route, fullPath) {
    if (route === "/" || route === "/catalog") {
      this._initCatalogLogic();
    } else if (route === "/product") {
      this._initProductDetailLogic(fullPath);
    } else if (route === "/checkout") {
      this._initCheckoutLogic();
    } else if (route === "/cart") {
      console.log("Carrito montado con éxito.");
      // Aquí puedes inicializar la lógica para pintar los productos del carrito
    }
  }

  /**
   * TU LÓGICA ORIGINAL DEL CATÁLOGO: Recuperada y adaptada al flujo HTML puro
   */
  _initCatalogLogic() {
    const grid = this.appContainer.querySelector("#catalog-grid");
    const sortSelect = this.appContainer.querySelector("#sort-by");
    const countEl = this.appContainer.querySelector("#catalog-count");

    if (!grid) return;

    const renderProducts = () => {
      const sortBy = sortSelect ? sortSelect.value : "default";
      let products = ProductService.getAll() || [];

      // Filtrado reactivo mediante el Slice 'filters' de tu Store Global
      const currentFilters = store.getState().filters || {};
      if (currentFilters.category) {
        products = products.filter(
          (p) => p.category === currentFilters.category,
        );
      }

      // Algoritmia de Ordenamiento
      if (sortBy === "price-asc") products.sort((a, b) => a.price - b.price);
      else if (sortBy === "price-desc")
        products.sort((a, b) => b.price - a.price);
      else if (sortBy === "name-asc")
        products.sort((a, b) => a.name.localeCompare(b.name));

      // Actualizar contador en la interfaz
      if (countEl) {
        countEl.textContent = `${products.length} ${products.length === 1 ? "producto encontrado" : "productos encontrados"}`;
      }

      grid.innerHTML = "";

      if (products.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #999;">No se encontraron piezas en esta categoría.</div>`;
        return;
      }

      // Inyección dinámica de tus componentes personalizados <lumiere-product-card>
      products.forEach((product) => {
        const card = document.createElement("lumiere-product-card");
        grid.appendChild(card);
        card.setProduct(product);
      });
    };

    // Vincular listener de ordenamiento
    if (sortSelect) {
      sortSelect.addEventListener("change", renderProducts);
    }

    // Suscripción reactiva al store de filtros
    this._unsubscribeStore = store.subscribe("filters", renderProducts);

    // Render inicial inmediato
    renderProducts();
    bus.emit(EVENTS.PRODUCTS_LOADED, { page: "catalog" });
  }

  /**
   * LÓGICA: Detalle de Producto
   */
  _initProductDetailLogic(fullPath) {
    const urlParams = new URLSearchParams(fullPath.split("?")[1]);
    const productId = urlParams.get("id");

    if (!productId) return;
    const product = ProductService.getById(productId);
    if (!product) return;

    // Sincronizar datos dinámicos con los IDs semánticos del HTML
    this.appContainer.querySelector("#detail-main-img").src = product.image;
    this.appContainer.querySelector("#detail-name").textContent = product.name;
    this.appContainer.querySelector("#detail-category").textContent =
      product.category;
    this.appContainer.querySelector("#detail-price").textContent =
      `$${product.price}`;
    this.appContainer.querySelector("#detail-description").textContent =
      product.description;

    const addBtn = this.appContainer.querySelector("#add-to-cart-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        console.log(`Producto ${product.name} enviado al Store del carrito.`);
      });
    }
  }

  /**
   * LÓGICA: Procesamiento del Formulario de Checkout
   */
  _initCheckoutLogic() {
    const form = this.appContainer.querySelector("#checkout-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        console.log("Orden capturada con éxito en Bucaramanga.");
      });
    }
  }
}
