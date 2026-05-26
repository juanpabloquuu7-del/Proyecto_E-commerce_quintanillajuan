/**
 * app.js
 * Punto de entrada principal de la aplicación LUMIÈRE.
 */

import { Router } from "../core/router.js";
import ProductService from "../services/product.service.js";
import CartService from "../services/cart.service.js";
import ToastComponent from "../components/toast.component.js";
import "../components/navbar.component.js";

function formatCop(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function renderCartModal() {
  const cartModal = document.getElementById("cart-modal");
  const cartItems = document.getElementById("cart-items");
  const cartSummary = document.getElementById("cart-summary");
  const cartTotal = document.getElementById("cart-total");
  const cartSavings = document.getElementById("cart-savings");

  if (!cartModal || !cartItems || !cartSummary || !cartTotal || !cartSavings) {
    return;
  }

  const summary = CartService.getSummary();

  if (!summary.items.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <p>Tu bolsa aún está vacía.</p>
        <small>Explora el catálogo y agrega tus prendas favoritas.</small>
      </div>`;
    cartSummary.innerHTML = "";
    cartTotal.textContent = formatCop(0);
    cartSavings.textContent = formatCop(0);
    return;
  }

  cartItems.innerHTML = summary.items
    .map((item) => `
      <article class="cart-item">
        <img src="${item.image || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${item.name}" />
        <div>
          <h4>${item.name}</h4>
          <p>${item.size ? `Talla ${item.size}` : "Talla única"}</p>
          <p>${item.quantity} × ${formatCop(item.price)}</p>
        </div>
        <div class="cart-item-actions">
          <strong>${formatCop(item.price * item.quantity)}</strong>
          <button type="button" class="remove-item-btn" data-remove-item data-product-id="${item.productId}" data-size="${item.size ?? ""}">Quitar</button>
        </div>
      </article>
    `)
    .join("");

  cartSummary.innerHTML = `
    <div class="cart-total-row">
      <span>Subtotal</span>
      <span>${formatCop(summary.subtotal)}</span>
    </div>
    <div class="cart-total-row">
      <span>Ahorro</span>
      <span>${formatCop(summary.savings)}</span>
    </div>`;

  cartTotal.textContent = formatCop(summary.total);
  cartSavings.textContent = formatCop(summary.savings);

  cartItems.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.dataset.productId;
      const size = button.dataset.size || null;
      const result = CartService.remove(productId, size);

      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo quitar el artículo.");
        return;
      }

      ToastComponent.info("Artículo retirado de tu bolsa.");
      renderCartModal();
    });
  });
}

function openCartModal() {
  const cartModal = document.getElementById("cart-modal");
  const backdrop = document.getElementById("cart-modal-backdrop");

  if (!cartModal || !backdrop) return;

  renderCartModal();
  cartModal.classList.add("open");
  backdrop.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeCartModal() {
  const cartModal = document.getElementById("cart-modal");
  const backdrop = document.getElementById("cart-modal-backdrop");

  if (!cartModal || !backdrop) return;

  cartModal.classList.remove("open");
  backdrop.classList.remove("open");
  document.body.classList.remove("modal-open");
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando entorno de LUMIÈRE...");

  try {
    const seedResult = await ProductService.init();
    console.log(
      `📦 Catálogo listo (${seedResult.origin}): ${seedResult.count} productos.`,
    );
  } catch (error) {
    console.error("❌ Error al inicializar el catálogo de productos:", error);
  }

  CartService.init();

  document.getElementById("cart-modal-backdrop")?.addEventListener("click", closeCartModal);
  document.getElementById("cart-close")?.addEventListener("click", closeCartModal);
  document.getElementById("cart-checkout")?.addEventListener("click", () => {
    closeCartModal();
    window.location.hash = "/checkout";
  });

  window.addEventListener("lumiere:open-cart", openCartModal);
  window.openCartModal = openCartModal;

  const appContainer = document.getElementById("app");

  if (appContainer) {
    const router = new Router(appContainer);
    await router.init();
    window.appRouter = router;
  } else {
    console.error("❌ Error fatal: No se encontró el elemento #app en el DOM.");
  }
});
