/**
 * router.js
 * Enrutador definitivo y global de LUMIÈRE.
 * Inyección asíncrona de páginas, control de estado reactivo, gestión de catálogo,
 * detalle de producto, checkout completo e historial de órdenes.
 */

import ProductService from "../services/product.service.js";
import store from "./store.js";
import { bus, EVENTS } from "./events.js";
import CartService from "../services/cart.service.js";
import OrderService from "../services/order.service.js";

const ROUTES = {
  "/": "./assets/js/pages/home.page.html",
  "/catalog": "./assets/js/pages/catalog.page.html",
  "/product": "./assets/js/pages/product-detail.page.html",
  "/cart": "./assets/js/pages/cart.page.html",
  "/checkout": "./assets/js/pages/checkout.page.html",
  "/orders": "./assets/js/pages/orders.page.html",
};

// Formateador global para pesos colombianos (COP)
const fmtCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export class Router {
  constructor() {
    this.appContainer = document.querySelector("#app");
    this._unsubscribeStore = null;
    this.init();
  }

  init() {
    // 1. Escuchar eventos estándar de navegación por Hash
    window.addEventListener("hashchange", () => this.handleRoute());
    window.addEventListener("DOMContentLoaded", () => this.handleRoute());

    // 2. Interceptar el evento personalizado de navegación semántica (lumiere:navigate)
    window.addEventListener("lumiere:navigate", (e) => {
      const targetRoute = e.detail.route;
      window.location.hash = targetRoute;
    });

    // 3. Capturar clics globales en elementos con atributo [data-route]
    document.body.addEventListener("click", (e) => {
      const routeBtn = e.target.closest("[data-route]");
      if (routeBtn) {
        e.preventDefault();
        const path = routeBtn.getAttribute("data-route");
        window.location.hash = path;
      }
    });
  }

  /**
   * Resuelve la ruta actual evaluando el hash del navegador e inyecta la vista correspondiente.
   */
  async handleRoute() {
    // Limpieza preventiva de suscripciones previas para evitar memory leaks
    if (this._unsubscribeStore) {
      this._unsubscribeStore();
      this._unsubscribeStore = null;
    }

    const fullPath = window.location.hash.slice(1) || "/";
    const pathOnly = fullPath.split("?")[0];

    const templateUrl = ROUTES[pathOnly] || ROUTES["/"];

    try {
      // Inyección asíncrona de la plantilla HTML limpia
      const response = await fetch(templateUrl);
      if (!response.ok)
        throw new Error(`Error al cargar la plantilla: ${templateUrl}`);

      const htmlContent = await response.text();
      this.appContainer.innerHTML = htmlContent;

      // Despachar lógica especializada según el segmento renderizado
      switch (pathOnly) {
        case "/":
          this._initHomeLogic();
          break;
        case "/catalog":
          this._initCatalogLogic(fullPath);
          break;
        case "/product":
          this._initProductDetailLogic(fullPath);
          break;
        case "/cart":
          this._initCartPageLogic();
          break;
        case "/checkout":
          this._initCheckoutLogic(fullPath);
          break;
        case "/orders":
          this._initOrdersLogic();
          break;
        default:
          bus.emit(EVENTS.ROUTE_CHANGED, { route: pathOnly });
      }
    } catch (error) {
      console.error("❌ [Router Error]:", error);
      this.appContainer.innerHTML = `
        <div style="text-align: center; padding: 80px 20px; color: var(--color-primary, #1a1a2e);">
          <h2>Ha ocurrido un inconveniente al cargar esta sección.</h2>
          <p style="margin-top: 12px; color: var(--color-gray-400, #a09890);">Por favor, intenta regresar al inicio.</p>
          <a href="#/" style="display: inline-block; margin-top: 24px; color: var(--color-accent, #c9a96e); text-decoration: underline;">Volver a la tienda</a>
        </div>
      `;
    }
  }

  /**
   * Lógica para la Página de Inicio (Home)
   * Carga productos destacados o novedades en la landing.
   */
  _initHomeLogic() {
    const featuredGrid = this.appContainer.querySelector(
      "#featured-products-grid",
    );
    if (!featuredGrid) return;

    // Tomamos los primeros 4 productos marcados como nuevos o destacados
    const products = (ProductService.getAll() || []).slice(0, 4);

    featuredGrid.innerHTML = "";
    products.forEach((product) => {
      const card = document.createElement("lumiere-product-card");
      featuredGrid.appendChild(card);
      card.setProduct(product);
    });

    bus.emit(EVENTS.ROUTE_CHANGED, { route: "/" });
  }

  /**
   * Inicializa la lógica reactiva del catálogo, enlazando filtros y renderizando tarjetas web component.
   */
  _initCatalogLogic(fullPath) {
    const grid = this.appContainer.querySelector("#catalog-grid");
    if (!grid) return;

    const urlParams = new URLSearchParams(fullPath.split("?")[1]);
    const categoryParam = urlParams.get("category");
    const saleParam = urlParams.get("onSale");

    if (categoryParam || saleParam) {
      store.setState("filters", {
        category: categoryParam || "all",
        onSale: saleParam === "true",
      });
    }

    const renderProducts = () => {
      let products = ProductService.getAll() || [];
      const currentFilters = store.getState("filters") || {
        category: "all",
        onSale: false,
      };

      if (currentFilters.category && currentFilters.category !== "all") {
        products = products.filter(
          (p) => p.category === currentFilters.category,
        );
      }

      if (currentFilters.onSale) {
        products = products.filter(
          (p) => p.onSale === true || p.compareAtPrice > p.price,
        );
      }

      grid.innerHTML = "";

      if (products.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-gray-400);">No se encontraron piezas exclusivas en esta selección.</div>`;
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

  /**
   * Vincula los datos dinámicos a la vista de detalle extendido y activa el procesamiento de tallas y carrito.
   */
  _initProductDetailLogic(fullPath) {
    const urlParams = new URLSearchParams(fullPath.split("?")[1]);
    const productId = urlParams.get("id");
    if (!productId) return;

    const product = ProductService.getById(productId);
    if (!product) {
      this.appContainer.innerHTML = `
        <div style="text-align: center; padding: 100px 20px; color: var(--color-primary);">
          <h2>La pieza solicitada no se encuentra disponible en nuestro catálogo actual.</h2>
          <a href="#/catalog" style="display: inline-block; margin-top: 20px; color: var(--color-accent);">Regresar al catálogo</a>
        </div>
      `;
      return;
    }

    const imgEl = this.appContainer.querySelector("#detail-main-img");
    if (imgEl) {
      imgEl.src = product.image || (product.images && product.images[0]);
      imgEl.alt = product.name;
    }

    const categoryEl = this.appContainer.querySelector("#detail-category");
    if (categoryEl) categoryEl.textContent = product.category || "Colección";

    const nameEl = this.appContainer.querySelector("#detail-name");
    if (nameEl) nameEl.textContent = product.name;

    const descEl = this.appContainer.querySelector("#detail-description");
    if (descEl) {
      descEl.textContent =
        product.description ||
        "Esta exclusiva pieza refleja la sofisticación vanguardista de la alta costura urbana de LUMIÈRE, confeccionada con estándares de calidad superior.";
    }

    const priceEl = this.appContainer.querySelector("#detail-price");
    if (priceEl) priceEl.textContent = fmtCOP.format(product.price);

    const sizeButtons = this.appContainer.querySelectorAll(".size-btn");
    let selectedSize = "M";

    sizeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        sizeButtons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-checked", "true");
        selectedSize = btn.textContent.trim();
      });
    });

    const addToCartBtn = this.appContainer.querySelector("#add-to-cart-btn");
    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", () => {
        if (product.stock <= 0) {
          bus.emit(EVENTS.CART_UPDATED, {
            action: "error_stock",
            productId: product.id,
          });
          return;
        }

        CartService.addItem(product.id, 1, selectedSize);
        bus.emit(EVENTS.CART_UPDATED, {
          action: "add_item",
          productId: product.id,
          size: selectedSize,
        });
      });
    }

    bus.emit(EVENTS.PRODUCTS_LOADED, { page: "product-detail", productId });
  }

  /**
   * Lógica para la vista de Carrito dedicada de pantalla completa (/cart)
   */
  _initCartPageLogic() {
    const tableBody = this.appContainer.querySelector("#cart-table-body");
    const totalEl = this.appContainer.querySelector("#cart-page-total");

    if (!tableBody) return;

    const renderCartPage = () => {
      const cartState = store.getState("cart") || { items: [], total: 0 };
      tableBody.innerHTML = "";

      if (cartState.items.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--color-gray-400);">Tu bolsa de compras está vacía.</td></tr>`;
        if (totalEl) totalEl.textContent = fmtCOP.format(0);
        return;
      }

      cartState.items.forEach((item) => {
        const prod = ProductService.getById(item.productId) || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding: 12px; display: flex; align-items: center; gap: 12px;">
            <img src="${prod.image || (prod.images && prod.images[0])}" style="width: 45px; height: 60px; object-fit: cover; border-radius: 4px;" />
            <div>
              <h5 style="margin:0; font-size: 14px;">${prod.name}</h5>
              <p style="margin:2px 0 0 0; font-size:11px; color: var(--color-gray-400);">Talla: ${item.size || "M"}</p>
            </div>
          </td>
          <td style="padding: 12px;">${fmtCOP.format(item.price)}</td>
          <td style="padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="qty-minus" data-id="${item.productId}" data-size="${item.size || "M"}" style="background: none; border: 1px solid #ccc; width: 24px; height: 24px; cursor: pointer;">-</button>
              <span>${item.quantity}</span>
              <button class="qty-plus" data-id="${item.productId}" data-size="${item.size || "M"}" style="background: none; border: 1px solid #ccc; width: 24px; height: 24px; cursor: pointer;">+</button>
            </div>
          </td>
          <td style="padding: 12px; font-weight: 600;">${fmtCOP.format(item.price * item.quantity)}</td>
        `;
        tableBody.appendChild(tr);
      });

      if (totalEl) totalEl.textContent = fmtCOP.format(cartState.total);

      // Eventos para cambiar cantidades en la página de carrito
      tableBody.querySelectorAll(".qty-plus").forEach((btn) => {
        btn.addEventListener("click", () => {
          CartService.addItem(btn.dataset.id, 1, btn.dataset.size);
        });
      });

      tableBody.querySelectorAll(".qty-minus").forEach((btn) => {
        btn.addEventListener("click", () => {
          CartService.updateQuantity(btn.dataset.id, -1, btn.dataset.size);
        });
      });
    };

    this._unsubscribeStore = store.subscribe("cart", renderCartPage);
    renderCartPage();
  }

  /**
   * Inicializa la interfaz de checkout, listando los ítems de la bolsa y vinculando el formulario de cobro.
   */
  _initCheckoutLogic(fullPath) {
    const form = this.appContainer.querySelector("#checkout-form");
    const itemsListContainer = this.appContainer.querySelector(
      "#checkout-items-list",
    );
    const subtotalEl = this.appContainer.querySelector("#summary-subtotal");
    const totalEl = this.appContainer.querySelector("#summary-total");

    const renderCheckoutSummary = () => {
      const cartState = store.getState("cart") || {
        items: [],
        total: 0,
        subtotal: 0,
      };

      if (!cartState.items || cartState.items.length === 0) {
        window.location.hash = "#/catalog";
        return;
      }

      if (itemsListContainer) {
        itemsListContainer.innerHTML = cartState.items
          .map((item) => {
            const prod = ProductService.getById(item.productId) || {};
            return `
            <div class="summary-item" style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center;">
              <img src="${prod.image || (prod.images && prod.images[0])}" alt="${prod.name}" style="width: 50px; height: 65px; object-fit: cover; border-radius: 4px;" />
              <div style="flex: 1;">
                <h4 style="font-size: 14px; font-weight: 500; color: var(--color-primary); margin: 0;">${prod.name}</h4>
                <p style="font-size: 12px; color: var(--color-gray-400); margin: 2px 0 0 0;">Cant: ${item.quantity} • Talla: ${item.size || "M"}</p>
              </div>
              <span style="font-size: 14px; font-weight: 600; color: var(--color-primary);">${fmtCOP.format(item.price * item.quantity)}</span>
            </div>
          `;
          })
          .join("");
      }

      if (subtotalEl)
        subtotalEl.textContent = fmtCOP.format(cartState.subtotal);
      if (totalEl) totalEl.textContent = fmtCOP.format(cartState.total);
    };

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const cartState = store.getState("cart");
        if (!cartState || cartState.items.length === 0) return;

        const shippingDetails = {
          firstName: form.querySelector("#bill-firstname")?.value.trim(),
          lastName: form.querySelector("#bill-lastname")?.value.trim(),
          address: form.querySelector("#bill-address")?.value.trim(),
          city: form.querySelector("#bill-city")?.value.trim(),
          phone: form.querySelector("#bill-phone")?.value.trim(),
          email: form.querySelector("#bill-email")?.value.trim(),
        };

        const paymentMethodElement = form.querySelector(
          'input[name="payment-type"]:checked',
        );
        const paymentMethod = paymentMethodElement
          ? paymentMethodElement.value
          : "credit_card";

        try {
          const orderResult = OrderService.createOrder({
            items: cartState.items,
            shippingAddress: shippingDetails,
            paymentMethod:
              paymentMethod === "delivery" ? "cash" : "credit_card",
            subtotal: cartState.subtotal,
            shippingCost: cartState.shipping || 0,
            total: cartState.total,
          });

          if (orderResult && orderResult.success) {
            // Descontar stock local de productos adquiridos antes de limpiar
            cartState.items.forEach((item) => {
              ProductService.decrementStock(item.productId, item.quantity);
            });

            CartService.clearCart();
            bus.emit(EVENTS.ORDER_CREATED, { order: orderResult.order });
            window.location.hash = "#/orders";
          }
        } catch (err) {
          console.error("❌ [Checkout Error]:", err);
        }
      });
    }

    this._unsubscribeStore = store.subscribe("cart", renderCheckoutSummary);
    renderCheckoutSummary();
  }

  /**
   * Inicializa la Vista del Historial de Pedidos (/orders) consumiendo el OrderService
   */
  _initOrdersLogic() {
    const container = this.appContainer.querySelector(
      "#orders-history-container",
    );
    if (!container) return;

    const orders = OrderService.getAllOrders() || [];

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--color-gray-400);">
          <p>Aún no has realizado adquisiciones en tu historial.</p>
          <a href="#/catalog" style="color: var(--color-accent); text-decoration: underline; margin-top: 12px; display: inline-block;">Ver Catálogo</a>
        </div>
      `;
      return;
    }

    // Renderizamos las órdenes históricas en bloques limpios
    container.innerHTML = orders
      .map((order) => {
        const itemsHTML = order.items
          .map((item) => {
            const prod = ProductService.getById(item.productId) || {};
            return `<li>${prod.name || "Prenda Exclusiva"} (x${item.quantity}) - Talla ${item.size || "M"}</li>`;
          })
          .join("");

        return `
        <div class="order-card" style="border: 1px solid #eaeaea; padding: 20px; margin-bottom: 16px; border-radius: 6px; background: #fff;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f5f5f5; padding-bottom: 10px; margin-bottom: 10px;">
            <div>
              <strong style="color: var(--color-primary);">Código de Orden: #${order.id.slice(0, 8)}</strong>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--color-gray-400);">${new Date(order.createdAt).toLocaleDateString("es-CO")}</p>
            </div>
            <span style="padding: 4px 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #e2f0d9; color: #385723; border-radius: 4px;">
              ${order.status || "Procesado"}
            </span>
          </div>
          <ul style="padding-left: 20px; font-size: 14px; color: #555;">
            ${itemsHTML}
          </ul>
          <div style="text-align: right; margin-top: 10px; font-weight: 600; font-size: 15px;">
            Total Adquisición: <span style="color: var(--color-primary);">${fmtCOP.format(order.total)}</span>
          </div>
        </div>
      `;
      })
      .join("");

    bus.emit(EVENTS.ROUTE_CHANGED, { route: "/orders" });
  }
}

export default Router;
