import cartService from 'js/services/cart.service.js';
import bus, { EVENTS } from 'js/core/events.js';

class ProductModal extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({ mode: 'open' });

        this.product = null;
        this.isOpen = false;

        this.handleEscape = this.handleEscape.bind(this);
        this.handleBackdrop = this.handleBackdrop.bind(this);
        this.handleAddToCart = this.handleAddToCart.bind(this);
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.handleEscape);
    }

    open(product) {
        if (!product) return;

        this.product = product;
        this.isOpen = true;

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', this.handleEscape);

        this.render();

        requestAnimationFrame(() => {
            this.shadowRoot
                ?.querySelector('.modal')
                ?.focus();
        });
    }

    close() {
        this.isOpen = false;

        document.body.style.overflow = '';
        document.removeEventListener('keydown', this.handleEscape);

        this.render();
    }

    handleEscape(event) {
        if (event.key === 'Escape') {
            this.close();
        }
    }

    handleBackdrop(event) {
        if (event.target.classList.contains('backdrop')) {
            this.close();
        }
    }

    handleAddToCart() {
        if (!this.product) return;

        try {
            cartService.addItem(this.product.id, 1);

            bus.emit(EVENTS.CART_UPDATED);

            bus.emit(EVENTS.SHOW_TOAST, {
                type: 'success',
                title: 'Producto agregado',
                message: `${this.product.name} fue agregado al carrito`
            });

            this.close();
        } catch (error) {
            bus.emit(EVENTS.SHOW_TOAST, {
                type: 'error',
                title: 'Error',
                message: error.message || 'No se pudo agregar el producto'
            });
        }
    }

    formatPrice(price = 0) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(price);
    }

    render() {
        const product = this.product;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }

                :host * {
                    box-sizing: border-box;
                }

                .backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: var(--z-modal, 500);
                    background: var(--bg-overlay, rgba(26,26,46,.65));
                    backdrop-filter: blur(4px);

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    padding: var(--space-4, 1rem);

                    animation: fadeIn .25s ease;
                }

                .modal {
                    width: 100%;
                    max-width: 1100px;
                    max-height: 92vh;

                    overflow: auto;

                    background: var(--bg-surface, #fff);

                    box-shadow: var(--shadow-xl);
                    outline: none;

                    animation: modalIn .3s ease;
                }

                .layout {
                    display: grid;
                    grid-template-columns: 1fr;
                }

                .gallery {
                    background: var(--color-gray-100);
                    position: relative;
                }

                .gallery img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    aspect-ratio: 4/5;
                }

                .content {
                    padding: var(--space-6, 1.5rem);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-5, 1.25rem);
                }

                .close-btn {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;

                    width: 44px;
                    height: 44px;

                    border: none;
                    cursor: pointer;

                    background: rgba(255,255,255,.95);
                    color: var(--text-primary);

                    font-size: 1.5rem;
                    line-height: 1;

                    z-index: 5;
                }

                .category {
                    color: var(--text-accent);
                    font-size: var(--text-xs);
                    text-transform: uppercase;
                    letter-spacing: var(--tracking-widest);
                    font-weight: var(--font-semibold);
                }

                .title {
                    font-family: var(--font-display);
                    color: var(--text-primary);
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    line-height: 1.1;
                }

                .price {
                    font-family: var(--font-display);
                    color: var(--text-primary);
                    font-size: var(--text-3xl);
                    font-weight: var(--font-semibold);
                }

                .description {
                    color: var(--text-secondary);
                    line-height: var(--leading-relaxed);
                }

                .divider {
                    height: 1px;
                    background: var(--color-gray-200);
                }

                .meta {
                    display: grid;
                    gap: var(--space-3);
                }

                .meta-item {
                    display: flex;
                    justify-content: space-between;
                    gap: var(--space-4);

                    font-size: var(--text-sm);
                    color: var(--text-secondary);
                }

                .meta-item strong {
                    color: var(--text-primary);
                }

                .actions {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                    margin-top: auto;
                }

                .btn {
                    width: 100%;
                    min-height: 54px;

                    border: none;
                    cursor: pointer;

                    background: var(--color-primary);
                    color: var(--text-inverted);

                    font-size: var(--text-sm);
                    font-weight: var(--font-semibold);

                    letter-spacing: var(--tracking-wider);
                    text-transform: uppercase;

                    transition: .25s;
                }

                .btn:hover {
                    background: var(--color-primary-dark);
                }

                .stock {
                    font-size: var(--text-sm);
                    color: var(--text-secondary);
                }

                .stock strong {
                    color: var(--text-primary);
                }

                .empty {
                    display: none;
                }

                @media (min-width: 768px) {
                    .layout {
                        grid-template-columns: 1fr 1fr;
                    }

                    .content {
                        padding: var(--space-8);
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: translateY(16px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>

            ${
                this.isOpen && product
                    ? `
                <div class="backdrop">
                    <div
                        class="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-modal-title"
                        tabindex="-1"
                    >
                        <button
                            class="close-btn"
                            aria-label="Cerrar modal"
                        >
                            ×
                        </button>

                        <div class="layout">
                            <div class="gallery">
                                <img
                                    src="${product.image || ''}"
                                    alt="${product.name || 'Producto'}"
                                    loading="lazy"
                                />
                            </div>

                            <div class="content">

                                <span class="category">
                                    ${product.category || 'LUMIÈRE'}
                                </span>

                                <h2
                                    id="product-modal-title"
                                    class="title"
                                >
                                    ${product.name || ''}
                                </h2>

                                <div class="price">
                                    ${this.formatPrice(product.price)}
                                </div>

                                <p class="description">
                                    ${product.description || 'Sin descripción disponible.'}
                                </p>

                                <div class="divider"></div>

                                <div class="meta">
                                    <div class="meta-item">
                                        <span>SKU</span>
                                        <strong>${product.sku || product.id || '-'}</strong>
                                    </div>

                                    <div class="meta-item">
                                        <span>Categoría</span>
                                        <strong>${product.category || '-'}</strong>
                                    </div>

                                    <div class="meta-item">
                                        <span>Marca</span>
                                        <strong>LUMIÈRE</strong>
                                    </div>
                                </div>

                                <div class="stock">
                                    Stock disponible:
                                    <strong>${product.stock ?? 0}</strong>
                                </div>

                                <div class="actions">
                                    <button
                                        type="button"
                                        class="btn add-cart-btn"
                                    >
                                        Agregar al carrito
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            `
                    : '<div class="empty"></div>'
            }
        `;

        if (!this.isOpen) return;

        this.shadowRoot
            .querySelector('.backdrop')
            ?.addEventListener('click', this.handleBackdrop);

        this.shadowRoot
            .querySelector('.close-btn')
            ?.addEventListener('click', () => this.close());

        this.shadowRoot
            .querySelector('.add-cart-btn')
            ?.addEventListener('click', this.handleAddToCart);
    }
}

customElements.define('product-modal', ProductModal);

export default ProductModal;
