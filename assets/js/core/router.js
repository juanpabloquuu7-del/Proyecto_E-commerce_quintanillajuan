/**
 * router.js
 * Enrutador principal para LUMIÈRE.
 */

import { bus, EVENTS } from "./events.js";
import ProductService from "../services/product.service.js";
import CartService from "../services/cart.service.js";
import OrderService from "../services/order.service.js";
import AdminService from "../services/admin.service.js";
import ToastComponent from "../components/toast.component.js";

const ROUTES = {
  "/": "./assets/js/pages/home.page.html",
  "/catalog": "./assets/js/pages/catalog.page.html",
  "/product": "./assets/js/pages/product-detail.page.html",
  "/cart": "./assets/js/pages/cart.page.html",
  "/checkout": "./assets/js/pages/checkout.page.html",
  "/orders": "./assets/js/pages/orders.page.html",
  "/admin/login": "./assets/js/pages/admin-login.page.html",
  "/admin/dashboard": "./assets/js/pages/admin-dashboard.page.html",
  "/admin/categories": "./assets/js/pages/admin-categories.page.html",
  "/admin/products": "./assets/js/pages/admin-products.page.html",
  "/admin/orders": "./assets/js/pages/admin-orders.page.html",
  "/report": "./examen/reportes.html",
};

function formatCop(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getProductBadges(product) {
  const badges = [];
  if (product.onSale) badges.push("Oferta");
  if (product.isNew) badges.push("Novedad");
  return badges;
}

function buildCatalogCard(product) {
  const badges = getProductBadges(product);
  const initialSize = product.sizes?.[0] || "Única";
  const isSoldOut = product.stock <= 0;

  return `
    <article class="product-card ${isSoldOut ? "product-sold-out" : ""}">
      <div class="product-card-media">
        <img src="${product.image || product.images?.[0] || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${product.name}" />
        <div class="product-badges">
          ${badges
            .map((badge) => `<span class="badge ${badge === "Oferta" ? "badge-sale" : "badge-new"}">${badge}</span>`)
            .join("")}
          ${isSoldOut ? `<span class="badge badge-out">Agotado</span>` : ""}
        </div>
      </div>
      <div>
        <p class="product-meta">
          <span>${product.category || "Colección"}</span>
          <span>${initialSize}</span>
        </p>
        <h3>${product.name}</h3>
      </div>
      <div class="product-prices">
        <span class="price-current">${formatCop(product.price)}</span>
        ${product.compareAtPrice ? `<span class="price-compare">${formatCop(product.compareAtPrice)}</span>` : ""}
      </div>
      <p class="product-description">${product.description || "Pieza exclusiva de la colección LUMIÈRE."}</p>
      <div class="product-card-actions">
        <button type="button" class="btn-small btn-add" data-add-to-cart data-id="${product.id}" data-size="${initialSize}" ${isSoldOut ? "disabled" : ""}>${isSoldOut ? "Agotado" : "Añadir al carrito"}</button>
        <a href="#/product?id=${product.id}" class="btn-small btn-detail" data-route="/product">Ver detalle</a>
      </div>
    </article>`;
}

export class Router {
  constructor(appContainer) {
    this.appContainer = appContainer;

    window.addEventListener("hashchange", () => this.handleRoute());

    document.body.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-route]");
      if (!routeButton) return;
      event.preventDefault();
      window.location.hash = routeButton.getAttribute("data-route");
    });
  }

  async init() {
    if (!window.location.hash) {
      window.location.hash = "/";
      return;
    }

    await this.handleRoute();
  }

  async handleRoute() {
    const fullPath = window.location.hash.slice(1) || "/";
    const pathOnly = fullPath.split("?")[0];

    if (pathOnly === "/admin/login" && AdminService.isAuthenticated()) {
      window.location.hash = "/admin/dashboard";
      return;
    }

    if (pathOnly.startsWith("/admin") && pathOnly !== "/admin/login" && !AdminService.isAuthenticated()) {
      window.location.hash = "/admin/login";
      return;
    }

    const templateUrl = ROUTES[pathOnly] || ROUTES["/"];

    try {
      const response = await fetch(templateUrl);
      if (!response.ok) throw new Error("No se pudo cargar la vista");

      const htmlContent = await response.text();
      this.appContainer.innerHTML = htmlContent;
      this._runPageLogic(pathOnly, fullPath);
      bus.emit(EVENTS.ROUTE_CHANGED, { route: pathOnly });
    } catch (error) {
      console.error("❌ [Router Error]:", error);
      this.appContainer.innerHTML = `<section class="page-shell"><h1>404</h1><p>Página no encontrada</p></section>`;
    }
  }

  _runPageLogic(path, fullPath) {
    switch (path) {
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
        this._initCheckoutLogic();
        break;
      case "/orders":
        this._initOrdersLogic();
        break;
      case "/admin/login":
        this._initAdminLoginLogic();
        break;
      case "/admin/dashboard":
        this._initAdminDashboardLogic();
        break;
      case "/admin/categories":
        this._initAdminCategoriesLogic();
        break;
      case "/admin/products":
        this._initAdminProductsLogic();
        break;
      case "/admin/orders":
        this._initAdminOrdersLogic();
        break;
      default:
        break;
    }
  }

  _initHomeLogic() {
    const container = this.appContainer;
    container.innerHTML = `
      <section class="page-shell">
        <div class="hero-panel">
          <div>
            <p class="hero-tag">Editora de looks premium</p>
            <h1 class="hero-title">Lumière piensa en cada detalle para que tu estilo se vea impecable.</h1>
            <p class="hero-copy">Explora una selección curada de prendas, accesorios y calzado con una estética urbana y sofisticada, diseñada para que te sientas lista para cualquier escenario.</p>
            <div class="hero-actions">
              <button type="button" class="btn-primary" data-route="/catalog">Explorar colección</button>
              <button type="button" class="btn-secondary" data-route="/catalog?onSale=true">Ver ofertas</button>
            </div>
          </div>
          <div class="hero-stat-grid">
            <div class="stat-card"><strong>+120</strong><span>looks editoriales</span></div>
            <div class="stat-card"><strong>3 días</strong><span>para entrega express</span></div>
            <div class="stat-card"><strong>24/7</strong><span>soporte personalizado</span></div>
            <div class="stat-card"><strong>Ofertas</strong><span>exclusivas en edición limitada</span></div>
          </div>
        </div>

        <div class="featured-grid">
          <article class="promo-card">
            <h2>Prendas con sello premium</h2>
            <p>Explora estilos que combinan sobriedad, movimiento y piezas que hacen diferencia en cada look.</p>
            <button type="button" class="btn-ghost" data-route="/catalog">Ir al catálogo</button>
          </article>
          <article class="promo-card">
            <h2>Novedades que llegan primero</h2>
            <p>Descubre lo último en colección con lanzamientos recientes y edición limitada.</p>
            <button type="button" class="btn-ghost" data-route="/catalog?sort=newest">Ver novedades</button>
          </article>
        </div>
      </section>`;
  }

  _initCatalogLogic(fullPath) {
    const url = new URL(`http://localhost${fullPath}`);
    const params = url.searchParams;
    let sort = params.get("sort") || "relevance";
    let onSale = params.get("onSale") === "true";
    let category = params.get("category") || "all";
    let searchQuery = params.get("search") || "";

    const categoryOptions = [
      { id: "all", name: "Todas las categorías" },
      ...AdminService.getCategoryOptions().map((item) => ({ id: item.id, name: item.name })),
    ];

    const buildCatalogHash = (overrides = {}) => {
      const nextSort = overrides.sort ?? sort;
      const nextOnSale = overrides.onSale ?? onSale;
      const nextCategory = overrides.category ?? category;
      const nextSearch = overrides.search ?? searchQuery;

      const nextParams = new URLSearchParams();
      if (nextSearch) nextParams.set("search", nextSearch);
      if (nextOnSale) nextParams.set("onSale", "true");
      if (nextSort !== "relevance") nextParams.set("sort", nextSort);
      if (nextCategory !== "all") nextParams.set("category", nextCategory);

      return `/catalog?${nextParams.toString()}`;
    };

    const getFilters = () => ({
      ...(onSale ? { onSale: true } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(category !== "all" ? { category } : {}),
    });

    const renderCatalog = () => {
      const products = ProductService.getFiltered(getFilters(), sort);
      const results = this.appContainer.querySelector("#catalog-results");

      if (!results) return;

      if (!products.length) {
        results.innerHTML = `<div class="empty-state"><h2>No hay productos para esta vista</h2><p>Prueba con otra búsqueda o revisa las ofertas y novedades.</p></div>`;
        return;
      }

      results.innerHTML = `<div class="product-grid">${products.map(buildCatalogCard).join("")}</div>`;

      this.appContainer.querySelectorAll("[data-add-to-cart]").forEach((button) => {
        button.addEventListener("click", () => {
          const productId = String(button.dataset.id);
          const size = button.dataset.size || null;
          const result = CartService.add(productId, 1, size);

          if (!result.success) {
            ToastComponent.error(result.errors?.[0] || "No se pudo agregar al carrito.");
            return;
          }

          ToastComponent.success("Artículo añadido a la bolsa.");
          if (window.openCartModal) window.openCartModal();
        });
      });
    };

    const container = this.appContainer;
    const focusSearchInput = () => {
      const searchInput = container.querySelector("#catalog-search");
      if (!searchInput) return;
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    };

    container.innerHTML = `
      <section class="page-shell">
        <div class="catalog-header">
          <div>
            <p class="hero-tag">${onSale ? "Edición limitada" : sort === "newest" ? "Lanzamientos recientes" : "Curaduría completa"}</p>
            <h1>${onSale ? "Ofertas" : sort === "newest" ? "Novedades" : "Catálogo"}</h1>
            <p>${onSale ? "Descuentos exclusivos seleccionados para ti" : sort === "newest" ? "Lo último en LUMIÈRE para refrescar tu guardarropa" : "Explora nuestra colección y encuentra tu próxima pieza favorita"}</p>
          </div>
        </div>

        <div class="catalog-controls">
          <label class="search-box">
            <span>Buscar en la colección</span>
            <input id="catalog-search" type="search" placeholder="Prendas, accesorios o estilo" value="${searchQuery}" />
          </label>

          <label class="control-group">
            <span>Ordenar</span>
            <select id="catalog-sort">
              <option value="relevance" ${sort === "relevance" ? "selected" : ""}>Relevancia</option>
              <option value="newest" ${sort === "newest" ? "selected" : ""}>Lo más nuevo</option>
              <option value="price_asc" ${sort === "price_asc" ? "selected" : ""}>Precio: menor a mayor</option>
              <option value="price_desc" ${sort === "price_desc" ? "selected" : ""}>Precio: mayor a menor</option>
              <option value="name_asc" ${sort === "name_asc" ? "selected" : ""}>Nombre A-Z</option>
            </select>
          </label>

          <label class="control-group">
            <span>Categoría</span>
            <select id="catalog-category">
              ${categoryOptions.map((option) => `<option value="${option.id}" ${option.id === category ? "selected" : ""}>${option.name}</option>`).join("")}
            </select>
          </label>

          <label class="control-group">
            <span>Estado</span>
            <select id="catalog-filter">
              <option value="all" ${!onSale ? "selected" : ""}>Todas las piezas</option>
              <option value="sale" ${onSale ? "selected" : ""}>Solo ofertas</option>
            </select>
          </label>
        </div>

        <div class="filter-chips">
          <button type="button" class="filter-chip ${!onSale ? "active" : ""}" data-route="${buildCatalogHash({ onSale: false, sort: "relevance" })}">Todo</button>
          <button type="button" class="filter-chip ${sort === "newest" ? "active" : ""}" data-route="${buildCatalogHash({ sort: "newest" })}">Novedades</button>
          <button type="button" class="filter-chip ${onSale ? "active" : ""}" data-route="${buildCatalogHash({ onSale: true })}">Ofertas</button>
        </div>

        <div id="catalog-results"></div>
      </section>`;

    renderCatalog();
    focusSearchInput();

    container.querySelector("#catalog-search")?.addEventListener("input", (event) => {
      searchQuery = event.target.value.trim();
      renderCatalog();
      focusSearchInput();
    });

    container.querySelector("#catalog-search")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        window.location.hash = buildCatalogHash();
      }
    });

    container.querySelector("#catalog-sort")?.addEventListener("change", (event) => {
      sort = event.target.value;
      window.location.hash = buildCatalogHash();
    });

    container.querySelector("#catalog-category")?.addEventListener("change", (event) => {
      category = event.target.value;
      window.location.hash = buildCatalogHash();
    });

    container.querySelector("#catalog-filter")?.addEventListener("change", (event) => {
      onSale = event.target.value === "sale";
      window.location.hash = buildCatalogHash();
    });
  }

  _initProductDetailLogic(fullPath) {
    const params = new URLSearchParams(fullPath.split("?")[1] || "");
    const productId = params.get("id") || params.get("productId");
    const product = ProductService.getById(productId);

    if (!product) {
      this.appContainer.innerHTML = `<section class="page-shell"><div class="empty-state"><h1>Producto no disponible</h1><p>La referencia solicitada no existe o ya no está en el inventario.</p><button class="btn-primary" data-route="/catalog">Volver al catálogo</button></div></section>`;
      return;
    }

    const selectedSize = product.sizes?.[0] || "Única";
    const badges = getProductBadges(product);
    const isSoldOut = product.stock <= 0;

    this.appContainer.innerHTML = `
      <section class="page-shell">
        <div class="detail-layout">
          <div class="detail-media">
            <div class="detail-main-image">
              <img src="${product.image || product.images?.[0] || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${product.name}" />
            </div>
          </div>

          <div class="detail-info">
            <div class="detail-eyebrow">
              ${badges.map((badge) => `<span class="badge ${badge === "Oferta" ? "badge-sale" : "badge-new"}">${badge}</span>`).join("")}
            </div>
            <p class="hero-tag">${product.category}</p>
            <h1 class="detail-title">${product.name}</h1>
            <p class="detail-description">${product.description}</p>

            <div class="detail-price-row">
              <span class="price-current">${formatCop(product.price)}</span>
              ${product.compareAtPrice ? `<span class="price-compare">${formatCop(product.compareAtPrice)}</span>` : ""}
            </div>

            <div class="detail-meta-grid">
              <div class="meta-pill"><strong>SKU</strong><p>${product.sku || "—"}</p></div>
              <div class="meta-pill"><strong>Stock</strong><p>${product.stock} unidades</p></div>
            </div>

            <div>
              <p><strong>Talla</strong></p>
              <div class="size-selector">
                ${product.sizes.map((size) => `<button type="button" class="size-btn ${size === selectedSize ? "active" : ""}" data-size-btn="${size}">${size}</button>`).join("")}
              </div>
            </div>

            <div class="detail-actions">
              <button type="button" class="btn-primary" id="buy-now-btn" ${isSoldOut ? "disabled" : ""}>${isSoldOut ? "Agotado" : "Agregar a la bolsa"}</button>
              <button type="button" class="btn-secondary" data-route="/catalog">Volver al catálogo</button>
            </div>
          </div>
        </div>
      </section>`;

    let currentSize = selectedSize;

    this.appContainer.querySelectorAll("[data-size-btn]").forEach((button) => {
      button.addEventListener("click", () => {
        currentSize = button.dataset.sizeBtn;
        this.appContainer.querySelectorAll("[data-size-btn]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
      });
    });

    this.appContainer.querySelector("#buy-now-btn")?.addEventListener("click", () => {
      const result = CartService.add(String(product.id), 1, currentSize);
      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo agregar al carrito.");
        return;
      }
      ToastComponent.success(`${product.name} quedó añadido a tu bolsa.`);
      if (window.openCartModal) window.openCartModal();
    });
  }

  _initCartPageLogic() {
    const summary = CartService.getSummary();
    const subtotalEl = this.appContainer.querySelector("#cart-subtotal");
    const totalEl = this.appContainer.querySelector("#cart-total");
    const itemsContainer = this.appContainer.querySelector("#cart-items-container");

    if (!summary.items.length) {
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <h2>Tu bolsa está vacía</h2>
          <p>Explora el catálogo y añade las piezas que quieras tener listas para tu próximo look.</p>
          <button type="button" class="btn-primary" data-route="/catalog">Ver colección</button>
        </div>`;
      subtotalEl.textContent = formatCop(0);
      totalEl.textContent = formatCop(0);
      return;
    }

    itemsContainer.innerHTML = summary.items.map((item) => `
      <article class="cart-page-item">
        <img src="${item.image || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${item.name}" />
        <div class="cart-page-item-info">
          <p class="hero-tag">${item.size || "Talla única"}</p>
          <h3>${item.name}</h3>
          <p>${formatCop(item.price)} cada unidad</p>
        </div>
        <div class="cart-page-item-actions">
          <div class="cart-quantity-controls">
            <button type="button" class="qty-btn" data-cart-decrease data-product-id="${item.productId}" data-size="${item.size || ""}">−</button>
            <span>${item.quantity}</span>
            <button type="button" class="qty-btn" data-cart-increase data-product-id="${item.productId}" data-size="${item.size || ""}">+</button>
          </div>
          <strong>${formatCop(item.price * item.quantity)}</strong>
          <button type="button" class="remove-item-btn" data-cart-remove data-product-id="${item.productId}" data-size="${item.size || ""}">Quitar</button>
        </div>
      </article>`).join("");

    subtotalEl.textContent = formatCop(summary.subtotal);
    totalEl.textContent = formatCop(summary.total);

    itemsContainer.querySelectorAll("[data-cart-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = CartService.remove(button.dataset.productId, button.dataset.size || null);
        if (!result.success) {
          ToastComponent.error(result.errors?.[0] || "No se pudo quitar el artículo.");
          return;
        }
        ToastComponent.info("Artículo retirado de tu bolsa.");
        this._initCartPageLogic();
      });
    });

    itemsContainer.querySelectorAll("[data-cart-increase]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = CartService.increase(button.dataset.productId, 1, button.dataset.size || null);
        if (!result.success) {
          ToastComponent.error(result.errors?.[0] || "No se pudo aumentar la cantidad.");
          return;
        }
        this._initCartPageLogic();
      });
    });

    itemsContainer.querySelectorAll("[data-cart-decrease]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = CartService.decrease(button.dataset.productId, 1, button.dataset.size || null);
        if (!result.success) {
          ToastComponent.error(result.errors?.[0] || "No se pudo reducir la cantidad.");
          return;
        }
        this._initCartPageLogic();
      });
    });
  }

  _initCheckoutLogic() {
    const summary = CartService.getSummary();
    const checkoutItems = this.appContainer.querySelector("#checkout-items-list");
    const subtotalEl = this.appContainer.querySelector("#summary-subtotal");
    const totalEl = this.appContainer.querySelector("#summary-total");
    const form = this.appContainer.querySelector("#checkout-form");

    if (!summary.items.length) {
      checkoutItems.innerHTML = `
        <div class="empty-state">
          <h2>Tu bolsa está vacía</h2>
          <p>Agrega productos antes de continuar con el proceso de pago.</p>
          <button type="button" class="btn-primary" data-route="/catalog">Volver al catálogo</button>
        </div>`;
      subtotalEl.textContent = formatCop(0);
      totalEl.textContent = formatCop(0);
      form?.querySelector("button")?.setAttribute("disabled", "true");
      return;
    }

    checkoutItems.innerHTML = summary.items.map((item) => `
      <article class="checkout-item">
        <img src="${item.image || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${item.name}" />
        <div>
          <h3>${item.name}</h3>
          <p>${item.size || "Talla única"} • ${item.quantity} unidad(es)</p>
        </div>
        <strong>${formatCop(item.price * item.quantity)}</strong>
      </article>`).join("");

    subtotalEl.textContent = formatCop(summary.subtotal);
    totalEl.textContent = formatCop(summary.total);

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      const paymentMethod = this.appContainer.querySelector("input[name='payment-type']:checked")?.value || "card";
      const shippingAddress = {
        firstName: this.appContainer.querySelector("#bill-firstname")?.value.trim(),
        lastName: this.appContainer.querySelector("#bill-lastname")?.value.trim(),
        address: this.appContainer.querySelector("#bill-address")?.value.trim(),
        city: this.appContainer.querySelector("#bill-city")?.value.trim(),
        phone: this.appContainer.querySelector("#bill-phone")?.value.trim(),
        email: this.appContainer.querySelector("#bill-email")?.value.trim(),
      };

      const result = OrderService.createOrder({
        items: summary.items,
        subtotal: summary.subtotal,
        shippingCost: 0,
        total: summary.total,
        shippingAddress,
        paymentMethod,
      });

      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo crear el pedido.");
        return;
      }

      CartService.clear();
      ToastComponent.success("Pedido creado con éxito. Revisa tu historial para ver el estado.");
      window.location.hash = "/orders";
    });
  }

  _initOrdersLogic() {
    const orders = [...OrderService.getAllOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const tbody = this.appContainer.querySelector("#orders-tbody");
    const detailPanel = this.appContainer.querySelector("#orders-detail-panel");

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="orders-empty-msg">Aún no has realizado ningún pedido. ¡Explora nuestra colección!</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map((order, index) => `
      <tr class="order-row" data-order-index="${index}">
        <td>${order.id}</td>
        <td>${new Date(order.createdAt).toLocaleDateString("es-CO")}</td>
        <td>${order.items.length} artículo(s)</td>
        <td>${formatCop(order.total)}</td>
        <td>${order.status}</td>
      </tr>`).join("");

    tbody.querySelectorAll(".order-row").forEach((row) => {
      row.addEventListener("click", () => {
        const order = orders[Number(row.dataset.orderIndex)];
        detailPanel.innerHTML = `
          <div class="detail-card-block">
            <p><strong>ID:</strong> ${order.id}</p>
            <p><strong>Estado:</strong> ${order.status}</p>
            <p><strong>Método de pago:</strong> ${order.paymentMethod === "card" ? "Tarjeta de crédito" : "Pago contra entrega"}</p>
            <p><strong>Contacto:</strong> ${order.shippingAddress?.email || "—"}</p>
            <p><strong>Dirección:</strong> ${order.shippingAddress?.address || "—"}, ${order.shippingAddress?.city || ""}</p>
          </div>
          <div class="detail-card-block">
            <h3>Artículos</h3>
            ${order.items.map((item) => `<p>• ${item.name} (${item.quantity} × ${formatCop(item.price)})</p>`).join("")}
          </div>`;
      });
    });

    tbody.querySelector(".order-row")?.click();
  }

  _initAdminLoginLogic() {
    if (AdminService.isAuthenticated()) {
      window.location.hash = "/admin/dashboard";
      return;
    }

    const form = this.appContainer.querySelector("#admin-login-form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = this.appContainer.querySelector("#admin-email")?.value.trim() || "";
      const password = this.appContainer.querySelector("#admin-password")?.value || "";
      const result = AdminService.login(email, password);

      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo iniciar sesión.");
        return;
      }

      ToastComponent.success("Sesión de administrador iniciada.");
      window.location.hash = "/admin/dashboard";
    });
  }

  _initAdminDashboardLogic() {
    const summary = this.appContainer.querySelector("#dashboard-summary");
    const ordersContainer = this.appContainer.querySelector("#dashboard-orders");
    const lowStockContainer = this.appContainer.querySelector("#dashboard-low-stock");
    const products = ProductService.getAll();
    const orders = [...OrderService.getAllOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const revenue = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    const lowStock = products.filter((product) => product.stock < 5);

    summary.innerHTML = `
      <div class="metric-card"><span>Total pedidos</span><strong>${orders.length}</strong></div>
      <div class="metric-card"><span>Productos</span><strong>${products.length}</strong></div>
      <div class="metric-card"><span>Recaudo</span><strong>${formatCop(revenue)}</strong></div>
      <div class="metric-card"><span>Alertas stock</span><strong>${lowStock.length}</strong></div>`;

    ordersContainer.innerHTML = orders.slice(0, 4).map((order) => `
      <div class="detail-item-row">
        <div>
          <strong>${order.id}</strong>
          <p>${order.shippingAddress?.email || "—"}</p>
        </div>
        <span>${formatCop(order.total)}</span>
      </div>`).join("") || `<p class="empty-state-inline">Aún no hay pedidos registrados.</p>`;

    lowStockContainer.innerHTML = lowStock.slice(0, 4).map((product) => `
      <div class="detail-item-row">
        <div>
          <strong>${product.name}</strong>
          <p>Stock: ${product.stock}</p>
        </div>
        <span>${product.category}</span>
      </div>`).join("") || `<p class="empty-state-inline">Todo el inventario está en buen estado.</p>`;

    this.appContainer.querySelector("#admin-logout-btn")?.addEventListener("click", () => {
      AdminService.logout();
      ToastComponent.info("Sesión cerrada.");
      window.location.hash = "/admin/login";
    });
  }

  _initAdminCategoriesLogic() {
    const form = this.appContainer.querySelector("#category-form");
    const tableBody = this.appContainer.querySelector("#categories-table-body");
    const resetButton = this.appContainer.querySelector("#category-reset-btn");
    const idInput = this.appContainer.querySelector("#category-id");
    const nameInput = this.appContainer.querySelector("#category-name");
    const descriptionInput = this.appContainer.querySelector("#category-description");

    const renderCategories = () => {
      const categories = AdminService.getCategories();
      tableBody.innerHTML = categories.map((category) => `
        <tr>
          <td>${category.id}</td>
          <td>${category.name}</td>
          <td>${category.description || "—"}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-small btn-secondary" data-edit-category="${category.id}">Editar</button>
              <button type="button" class="btn-small btn-ghost" data-delete-category="${category.id}">Eliminar</button>
            </div>
          </td>
        </tr>`).join("");
    };

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const categoryId = idInput?.value || "";
      const result = categoryId
        ? AdminService.updateCategory(categoryId, {
            name: nameInput?.value.trim() || "",
            description: descriptionInput?.value.trim() || "",
          })
        : AdminService.createCategory(nameInput?.value.trim() || "", descriptionInput?.value.trim() || "");

      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo guardar la categoría.");
        return;
      }

      ToastComponent.success(categoryId ? "Categoría actualizada." : "Categoría creada.");
      form.reset();
      idInput.value = "";
      renderCategories();
    });

    resetButton?.addEventListener("click", () => {
      form.reset();
      idInput.value = "";
    });

    tableBody?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-category]");
      const deleteButton = event.target.closest("[data-delete-category]");

      if (editButton) {
        const category = AdminService.getCategories().find((item) => item.id === editButton.dataset.editCategory);
        if (!category) return;
        idInput.value = category.id;
        nameInput.value = category.name;
        descriptionInput.value = category.description || "";
        return;
      }

      if (deleteButton) {
        const result = AdminService.deleteCategory(deleteButton.dataset.deleteCategory);
        if (!result.success) {
          ToastComponent.error(result.errors?.[0] || "No se pudo eliminar la categoría.");
          return;
        }

        ToastComponent.info("Categoría eliminada.");
        renderCategories();
      }
    });

    renderCategories();
  }

  _initAdminProductsLogic() {
    const form = this.appContainer.querySelector("#product-form");
    const categorySelect = this.appContainer.querySelector("#product-category");
    const tableBody = this.appContainer.querySelector("#products-table-body");
    const resetButton = this.appContainer.querySelector("#product-reset-btn");
    const productIdInput = this.appContainer.querySelector("#product-id");

    const categoryOptions = AdminService.getCategoryOptions();
    categorySelect.innerHTML = categoryOptions.map((category) => `<option value="${category.id}">${category.name}</option>`).join("");

    const renderProducts = () => {
      const products = ProductService.getAll();
      tableBody.innerHTML = products.map((product) => `
        <tr>
          <td>${product.name}</td>
          <td>${product.category}</td>
          <td>${product.stock}</td>
          <td>${formatCop(product.price)}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-small btn-secondary" data-edit-product="${product.id}">Editar</button>
              <button type="button" class="btn-small btn-ghost" data-delete-product="${product.id}">Eliminar</button>
            </div>
          </td>
        </tr>`).join("");
    };

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {
        name: this.appContainer.querySelector("#product-name")?.value.trim() || "",
        description: this.appContainer.querySelector("#product-description")?.value.trim() || "",
        price: Number(this.appContainer.querySelector("#product-price")?.value || 0),
        compareAtPrice: this.appContainer.querySelector("#product-compare")?.value
          ? Number(this.appContainer.querySelector("#product-compare")?.value)
          : null,
        category: categorySelect.value,
        images: [this.appContainer.querySelector("#product-image")?.value.trim() || ""].filter(Boolean),
        sizes: this.appContainer.querySelector("#product-sizes")?.value.split(",").map((size) => size.trim()).filter(Boolean) || ["Única"],
        stock: Number(this.appContainer.querySelector("#product-stock")?.value || 0),
        sku: this.appContainer.querySelector("#product-sku")?.value.trim() || undefined,
        isNew: this.appContainer.querySelector("#product-is-new")?.checked ?? true,
      };

      const result = productIdInput.value
        ? ProductService.update(productIdInput.value, payload)
        : ProductService.create(payload);

      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo guardar el producto.");
        return;
      }

      ToastComponent.success(productIdInput.value ? "Producto actualizado." : "Producto creado.");
      form.reset();
      productIdInput.value = "";
      categorySelect.selectedIndex = 0;
      renderProducts();
    });

    resetButton?.addEventListener("click", () => {
      form.reset();
      productIdInput.value = "";
      categorySelect.selectedIndex = 0;
    });

    tableBody?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-product]");
      const deleteButton = event.target.closest("[data-delete-product]");

      if (editButton) {
        const product = ProductService.getById(editButton.dataset.editProduct);
        if (!product) return;

        this.appContainer.querySelector("#product-id").value = product.id;
        this.appContainer.querySelector("#product-name").value = product.name;
        this.appContainer.querySelector("#product-description").value = product.description || "";
        this.appContainer.querySelector("#product-price").value = product.price;
        this.appContainer.querySelector("#product-compare").value = product.compareAtPrice || "";
        this.appContainer.querySelector("#product-image").value = product.image || product.images?.[0] || "";
        this.appContainer.querySelector("#product-sizes").value = product.sizes.join(", ");
        this.appContainer.querySelector("#product-stock").value = product.stock;
        this.appContainer.querySelector("#product-sku").value = product.sku || "";
        this.appContainer.querySelector("#product-is-new").checked = Boolean(product.isNew);
        categorySelect.value = product.category;
        return;
      }

      if (deleteButton) {
        const success = ProductService.delete(deleteButton.dataset.deleteProduct);
        if (!success) {
          ToastComponent.error("No se pudo eliminar el producto.");
          return;
        }

        ToastComponent.info("Producto eliminado.");
        renderProducts();
      }
    });

    renderProducts();
  }

  _initAdminOrdersLogic() {
    const summary = this.appContainer.querySelector("#orders-summary");
    const tableBody = this.appContainer.querySelector("#admin-orders-body");
    const detailPanel = this.appContainer.querySelector("#admin-order-detail");
    const orders = [...OrderService.getAllOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    const processed = orders.filter((order) => /proces|exit|complet/i.test(order.status)).length;

    summary.innerHTML = `
      <div class="metric-card"><span>Total órdenes</span><strong>${orders.length}</strong></div>
      <div class="metric-card"><span>Procesadas</span><strong>${processed}</strong></div>
      <div class="metric-card"><span>Recaudo</span><strong>${formatCop(totalRevenue)}</strong></div>
      <div class="metric-card"><span>Estado</span><strong>${orders.length ? "Activo" : "Sin órdenes"}</strong></div>`;

    tableBody.innerHTML = orders.map((order, index) => `
      <tr>
        <td>${order.id}</td>
        <td>${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}</td>
        <td>${formatCop(order.total)}</td>
        <td>${order.status}</td>
        <td><button type="button" class="btn-small btn-secondary" data-view-order="${index}">Ver detalle</button></td>
      </tr>`).join("");

    tableBody?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view-order]");
      if (!button) return;

      const order = orders[Number(button.dataset.viewOrder)];
      detailPanel.innerHTML = `
        <div class="detail-card-block">
          <p><strong>Cliente:</strong> ${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}</p>
          <p><strong>Email:</strong> ${order.shippingAddress?.email || "—"}</p>
          <p><strong>Teléfono:</strong> ${order.shippingAddress?.phone || "—"}</p>
          <p><strong>Dirección:</strong> ${order.shippingAddress?.address || "—"}, ${order.shippingAddress?.city || ""}</p>
        </div>
        <div class="detail-card-block">
          <p><strong>Método de pago:</strong> ${order.paymentMethod === "card" ? "Tarjeta de crédito" : "Pago contra entrega"}</p>
          <p><strong>Subtotal:</strong> ${formatCop(order.subtotal)}</p>
          <p><strong>Total:</strong> ${formatCop(order.total)}</p>
        </div>
        <div class="detail-card-block">
          <h3>Artículos</h3>
          ${order.items.map((item) => `<p>• ${item.name} (${item.quantity} × ${formatCop(item.price)})</p>`).join("")}
        </div>`;
    });

    if (orders.length) {
      tableBody.querySelector("[data-view-order]")?.click();
    } else {
      detailPanel.innerHTML = `<p>Selecciona una orden para revisar la información completa.</p>`;
    }
  }
}

export default Router;

