/**
 * loader.component.js
 * Web Component <lumiere-loader> — pantalla de carga elegante para LUMIÈRE.
 * Shadow DOM · Animación CSS pura · Show/hide API · Integración store/bus.
 *
 * Uso programático:
 * import LoaderComponent from './loader.component.js';
 * LoaderComponent.show();
 * LoaderComponent.show('Procesando pedido…');
 * LoaderComponent.hide();
 *
 * Vía evento global:
 * window.dispatchEvent(new CustomEvent('lumiere:loader', { detail: { visible: true } }));
 */

import bus, { EVENTS } from "../core/events.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAG_NAME = "lumiere-loader";
const FADE_MS = 360; // duración fade in/out

// ─── Estilos Shadow DOM ────────────────────────────────────────────────────────

const STYLES = `
  :host {
    display: block;
  }

  /* ── Overlay ── */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    background: #faf8f5;                 /* cream — bg de marca */
    opacity: 0;
    pointer-events: none;
    transition: opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1);
  }

  .overlay.visible {
    opacity: 1;
    pointer-events: all;
  }

  /* ── Marca ── */
  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    animation: fadeUp .55s .1s cubic-bezier(.22,.68,0,1.2) both;
  }

  .brand-name {
    font-family: 'Cormorant Garamond', 'Georgia', serif;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 300;
    letter-spacing: .35em;
    text-transform: uppercase;
    color: #1a1a2e;
    line-height: 1;
  }

  .brand-tagline {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: .65rem;
    font-weight: 400;
    letter-spacing: .3em;
    text-transform: uppercase;
    color: #c9a96e;
  }

  /* ── Diamante animado ── */
  .diamond-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    animation: fadeUp .55s .2s cubic-bezier(.22,.68,0,1.2) both;
  }

  .diamond {
    position: absolute;
    inset: 0;
    border: 1.5px solid #c9a96e;
    transform: rotate(45deg) scale(.85);
    animation: spinDiamond 2.8s cubic-bezier(.45,.05,.55,.95) infinite;
  }

  .diamond-inner {
    position: absolute;
    inset: 10px;
    border: 1px solid rgba(201,169,110,.4);
    transform: rotate(45deg);
    animation: spinDiamond 2.8s cubic-bezier(.45,.05,.55,.95) infinite reverse;
  }

  .diamond-dot {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .diamond-dot::after {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #c9a96e;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes spinDiamond {
    0%   { transform: rotate(45deg) scale(.85); }
    50%  { transform: rotate(225deg) scale(1);  }
    100% { transform: rotate(405deg) scale(.85);}
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1);   opacity: 1;  }
    50%       { transform: scale(1.6); opacity: .5; }
  }

  /* ── Línea de progreso indeterminada ── */
  .progress-track {
    width: clamp(140px, 30vw, 220px);
    height: 1px;
    background: rgba(201,169,110,.2);
    border-radius: 1px;
    overflow: hidden;
    animation: fadeUp .55s .35s cubic-bezier(.22,.68,0,1.2) both;
  }

  .progress-bar {
    height: 100%;
    width: 45%;
    background: linear-gradient(90deg, transparent, #c9a96e, transparent);
    border-radius: inherit;
    animation: slide 1.6s cubic-bezier(.4,0,.6,1) infinite;
  }

  @keyframes slide {
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(320%);  }
  }

  /* ── Mensaje ── */
  .message {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: .75rem;
    font-weight: 400;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: #1a1a2e;
    opacity: .5;
    min-height: 1em;
    text-align: center;
    padding: 0 1rem;
    animation: fadeUp .55s .4s cubic-bezier(.22,.68,0,1.2) both;
    transition: opacity .25s;
  }

  /* ── Partículas decorativas ── */
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .particle {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #c9a96e;
    opacity: 0;
    animation: drift var(--dur) var(--delay) ease-in-out infinite;
  }

  @keyframes drift {
    0%   { opacity: 0;    transform: translateY(100vh) scale(0);   }
    10%  { opacity: .6; }
    90%  { opacity: .15; }
    100% { opacity: 0;    transform: translateY(-10vh) scale(1.4); }
  }

  /* ── Entrada general ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  /* ── Spinner inline (modo compacto) ── */
  .spinner-wrap {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(250,248,245,.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1);
  }

  .spinner-wrap.visible {
    opacity: 1;
    pointer-events: all;
  }

  .spinner {
    width: 38px;
    height: 38px;
    border: 2px solid rgba(201,169,110,.25);
    border-top-color: #c9a96e;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ─── Partículas flotantes ──────────────────────────────────────────────────────

function buildParticles(count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const x = Math.random() * 100;
    const dur = 6 + Math.random() * 8;
    const delay = Math.random() * 8;
    const size = 2 + Math.random() * 3;
    return `<div class="particle" style="
      left:${x}%;
      width:${size}px;height:${size}px;
      --dur:${dur}s;--delay:${delay}s;
    "></div>`;
  }).join("");
}

// ─── Web Component ─────────────────────────────────────────────────────────────

class LumiereLoader extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._busCtx = null;
    this._visible = false;
    this._compact = false; // modo spinner inline sin overlay completo
    this._render();
  }

  // ── Observed attributes ────────────────────────────────────────────────────

  static get observedAttributes() {
    return ["message", "compact"];
  }

  attributeChangedCallback(name, _old, val) {
    if (name === "message") this._setMessage(val ?? "");
    if (name === "compact") this._compact = val !== null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    // Inicialización segura del contexto del bus si está disponible en events.js
    this._busCtx =
      typeof bus.context === "function" ? bus.context("LoaderComponent") : null;

    // Escucha eventos del bus (emitidos por el router o servicios del core)
    if (EVENTS.UI_LOADING_START) {
      bus.on(EVENTS.UI_LOADING_START, ({ message } = {}) =>
        this._show(message),
      );
    }
    if (EVENTS.UI_LOADING_END) {
      bus.on(EVENTS.UI_LOADING_END, () => this._hide());
    }

    // CustomEvent global (bridge para scripts sin acceso a módulos de ES)
    this._onWindow = ({ detail = {} }) => {
      if (detail.visible === false) this._hide();
      else this._show(detail.message ?? "");
    };
    window.addEventListener("lumiere:loader", this._onWindow);
  }

  disconnectedCallback() {
    window.removeEventListener("lumiere:loader", this._onWindow);

    // Limpieza segura de suscripciones para evitar fugas de memoria
    if (this._busCtx && typeof this._busCtx.destroy === "function") {
      this._busCtx.destroy();
    } else if (typeof bus.off === "function") {
      if (EVENTS.UI_LOADING_START) bus.off(EVENTS.UI_LOADING_START);
      if (EVENTS.UI_LOADING_END) bus.off(EVENTS.UI_LOADING_END);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    this._shadow.innerHTML = `
      <style>${STYLES}</style>

      <div class="overlay" part="overlay" aria-hidden="true" aria-live="polite" aria-label="Cargando">
        <div class="particles">${buildParticles()}</div>

        <div class="brand">
          <span class="brand-name">Lumière</span>
          <span class="brand-tagline">Fashion &amp; Style</span>
        </div>

        <div class="diamond-wrap">
          <div class="diamond"></div>
          <div class="diamond-inner"></div>
          <div class="diamond-dot"></div>
        </div>

        <div class="progress-track">
          <div class="progress-bar"></div>
        </div>

        <p class="message"></p>
      </div>

      <div class="spinner-wrap" part="spinner" aria-hidden="true">
        <div class="spinner"></div>
      </div>
    `;

    this._overlay = this._shadow.querySelector(".overlay");
    this._spinnerWrap = this._shadow.querySelector(".spinner-wrap");
    this._msgEl = this._shadow.querySelector(".message");
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  _show(message = "") {
    this._visible = true;
    this._setMessage(message);

    if (this._compact || this.hasAttribute("compact")) {
      this._overlay.classList.remove("visible");
      this._spinnerWrap.setAttribute("aria-hidden", "false");
      this._spinnerWrap.classList.add("visible");
    } else {
      this._spinnerWrap.classList.remove("visible");
      this._overlay.setAttribute("aria-hidden", "false");
      this._overlay.classList.add("visible");
    }
  }

  _hide() {
    this._visible = false;
    this._overlay.classList.remove("visible");
    this._spinnerWrap.classList.remove("visible");
    this._overlay.setAttribute("aria-hidden", "true");
    this._spinnerWrap.setAttribute("aria-hidden", "true");
  }

  _setMessage(text) {
    if (this._msgEl) this._msgEl.textContent = text ?? "";
  }
}

// ─── Registro ──────────────────────────────────────────────────────────────────

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, LumiereLoader);
}

// ─── Singleton helper ──────────────────────────────────────────────────────────

function getHost() {
  let host = document.querySelector(TAG_NAME);
  if (!host) {
    host = document.createElement(TAG_NAME);
    document.body.appendChild(host);
  }
  return host;
}

/**
 * API estática para controlar el loader sin importar el elemento.
 */
const LoaderComponent = {
  /**
   * Muestra el overlay completo de carga.
   * @param {string} [message='']
   */
  show(message = "") {
    const host = getHost();
    host.removeAttribute("compact");
    host._show(message);
  },

  /**
   * Muestra el spinner compacto con backdrop blur (sin overlay de marca).
   * Ideal para operaciones rápidas (fetch, submit).
   * @param {string} [message='']
   */
  showCompact(message = "") {
    const host = getHost();
    host.setAttribute("compact", "");
    host._show(message);
  },

  /** Actualiza el mensaje sin ocultar/mostrar el loader. */
  setMessage(message = "") {
    getHost()._setMessage(message);
  },

  /** Oculta el loader activo (cualquier modo). */
  hide() {
    getHost()._hide();
  },

  /** Indica si el loader está visible actualmente. */
  isVisible() {
    const host = document.querySelector(TAG_NAME);
    return host ? host._visible : false;
  },

  /**
   * Envuelve una Promise mostrando el loader mientras se resuelve.
   * @template T
   * @param {Promise<T>} promise
   * @param {string} [message='']
   * @param {boolean} [compact=false]
   * @returns {Promise<T>}
   */
  async wrap(promise, message = "", compact = false) {
    compact ? this.showCompact(message) : this.show(message);
    try {
      return await promise;
    } finally {
      this.hide();
    }
  },
};

export default LoaderComponent;
