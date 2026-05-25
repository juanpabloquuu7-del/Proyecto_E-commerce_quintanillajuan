/**
 * router.js
 * Enrutador definitivo de LUMIÈRE con soporte de eventos nativos y personalizados.
 */
import ProductService from "../services/product.service.js";
import store from "./store.js";
import { bus, EVENTS } from "./events.js";

const ROUTES = {
  "/": "./assets/js/pages/home.page.html",
  "/catalog": "./assets/js/pages/catalog.page.html",
  "/product": "./assets/js/pages/product-detail.page.html",
  "/cart": "./assets/js/pages/cart.page.html",
  "/checkout": "./assets/js/pages/checkout.page.html",
  "/orders": "./assets/js/pages/orders.page.html",
};

export class Router {
  constructor() {
    this.appContainer = document.querySelector("#app");
    this._unsubscribeStore = null;
    this.init();
  }

  init() {
    // 1. Escuchar eventos estándar de navegación del navegador
    window.addEventListener("hashchange", () => this.handleRoute());
    window.addEventListener("DOMContentLoaded", () => this.handleRoute());

    // 2. SOLUCIÓN CORRECCIÓN: Escuchar el evento personalizado de tu index.html
    window.addEventListener("lumiere:navigate", (e) => {
      const targetRoute = e.detail.route;
      // Actualizamos el hash, lo que disparará automáticamente 'hashchange' de arriba
      window.location.hash = targetRoute;
    });
  }

  async handleRoute() {
    if (this._unsubscribeStore) {
      this._unsubscribeStore();
      this._unsubscribeStore = null;
    }

    // Limpiar el hash quitando el '#' (ej: #/cart -> /cart)
    let path = window.location.hash.slice(1) || "/";

    // Normalizar la ruta en caso de que empiece sin el slash
    if (!path.startsWith("/")) path = "/" + path;

    // Soporte para parámetros dinámicos de consulta (ej: /product?id=3)
    const routeBase = path.split("?")[0];
    const htmlTemplateUrl = ROUTES[routeBase] || ROUTES["/"];

    try {
      const response = await fetch(htmlTemplateUrl);
      if (!response.ok)
        throw new Error(`No se pudo cargar: ${htmlTemplateUrl}`);

      const htmlContent = await response.text();
      this.appContainer.innerHTML = htmlContent;

      // Disparar ciclo de vida de la página montada
      this._initPageLogic(routeBase, path);

      // ═══ APAGAR LOADER CUANDO LA VISTA CARGA CON ÉXITO ═══
      const loader = document.getElementById("page-loader");
      if (loader) {
        loader.classList.add("hidden");
      }
    } catch (error) {
      console.error("Error en enrutamiento LUMIÈRE:", error);
      this.appContainer.innerHTML = `
        <div style="text-align:center; padding:80px 20px; color:#1a1a2e;">
          <h2 style="font-family:serif; font-size:1.8rem; margin-bottom:10px;">VISTA NO DISPONIBLE</h2>
          <p style="color:#666;">Asegúrate de que el archivo de la plantilla exista en la ruta correcta.</p>
        </div>`;

      // ═══ APAGAR LOADER EN CASO DE ERROR PARA NO CONGELAR LA PANTALLA ═══
      const loader = document.getElementById("page-loader");
      if (loader) {
        loader.classList.add("hidden");
      }
    }
  }

  _initPageLogic(route, fullPath) {
    if (route === "/" || route === "/catalog") {
      this._initCatalogLogic();
    } else if (route === "/product") {
      this._initProductDetailLogic(fullPath);
    } else if (route === "/checkout") {
      this._initCheckoutLogic();
    } else if (route === "/cart") {
      console.log("Bolsa de compras inicializada.");
    } else if (route === "/orders") {
      console.log("Historial de órdenes inicializado.");
    }
  }

  _initCatalogLogic() {
    const grid = this.appContainer.querySelector("#catalog-grid");
    if (!grid) return;

    const renderProducts = () => {
      let products = ProductService.getAll() || [];
      const currentFilters = store.getState().filters || {};

      if (currentFilters.category) {
        products = products.filter(
          (p) => p.category === currentFilters.category,
        );
      }

      grid.innerHTML = "";
      if (products.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">No hay piezas disponibles.</div>`;
        return;
      }

      products.forEach((product) => {
        const card = document.createElement("lumiere-product-card");
        grid.appendChild(card);
        card.setProduct(product);
      });
    };

    this._unsubscribeStore = store.subscribe("filters", renderProducts);
    renderProducts();
    bus.emit(EVENTS.PRODUCTS_LOADED, { page: "catalog" });
  }

  _initProductDetailLogic(fullPath) {
    const urlParams = new URLSearchParams(fullPath.split("?")[1]);
    const productId = urlParams.get("id");
    if (!productId) return;

    const product = ProductService.getById(productId);
    if (!product) return;

    const imgEl = this.appContainer.querySelector("#detail-main-img");
    if (imgEl) imgEl.src = product.image;

    const nameEl = this.appContainer.querySelector("#detail-name");
    if (nameEl) nameEl.textContent = product.name;
  }

  _initCheckoutLogic() {
    const form = this.appContainer.querySelector("#checkout-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        console.log("Orden procesada en Bucaramanga con éxito.");
      });
    }
  }
}
