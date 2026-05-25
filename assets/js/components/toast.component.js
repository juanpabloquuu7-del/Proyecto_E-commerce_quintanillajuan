/**
 * toast.component.js
 * Web Component <lumiere-toast> — sistema de notificaciones apiladas para LUMIÈRE.
 * Shadow DOM · Animaciones CSS · Auto-close · Stack múltiple · 4 tipos.
 *
 * Uso programático (recomendado):
 *   import ToastComponent from './toast.component.js';
 *   ToastComponent.show('Producto añadido', 'success');
 *   ToastComponent.show('Error al procesar', 'error', { duration: 6000 });
 *
 * Uso via evento global:
 *   window.dispatchEvent(new CustomEvent('lumiere:toast', {
 *     detail: { message: 'Hola', type: 'info' }
 *   }));
 */

import { bus, EVENTS } from "../core/events.js";
// ─── Constantes ────────────────────────────────────────────────────────────────

const TAG_NAME = "lumiere-toast";
const DEFAULT_DURATION = 4000; // ms
const MAX_TOASTS = 5; // máximo visible simultáneo
const ANIMATION_MS = 320; // duración de entrada/salida CSS

// ─── Iconos SVG inline por tipo ────────────────────────────────────────────────

const ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  error: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round"/>
  </svg>`,

  warning: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.134 3.374c.39-.72 1.342-.72 1.732 0l7.07 13.06c.375.693-.11
      1.566-.866 1.566H2.93c-.756 0-1.241-.873-.866-1.566l7.07-13.06z"
      stroke="currentColor" stroke-width="1.5"/>
    <path d="M10 8v4M10 14.5v.5" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round"/>
  </svg>`,

  info: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M10 9v5M10 6.5v.5" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round"/>
  </svg>`,
};

// ─── Paleta de colores por tipo ────────────────────────────────────────────────

const THEMES = {
  success: {
    bg: "#f0faf4",
    border: "#4ade80",
    icon: "#16a34a",
    text: "#14532d",
    progress: "#16a34a",
  },
  error: {
    bg: "#fff1f1",
    border: "#f87171",
    icon: "#dc2626",
    text: "#7f1d1d",
    progress: "#dc2626",
  },
  warning: {
    bg: "#fffbeb",
    border: "#fbbf24",
    icon: "#d97706",
    text: "#78350f",
    progress: "#d97706",
  },
  info: {
    bg: "#eff6ff",
    border: "#60a5fa",
    icon: "#2563eb",
    text: "#1e3a5f",
    progress: "#2563eb",
  },
};

// ─── Estilos Shadow DOM ────────────────────────────────────────────────────────

const STYLES = `
  :host {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.625rem;
    pointer-events: none;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  @media (max-width: 480px) {
    :host {
      bottom: 0;
      right: 0;
      left: 0;
      padding: 0.75rem;
    }
  }

  .toast {
    pointer-events: all;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 300px;
    max-width: 420px;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid transparent;
    box-shadow:
      0 4px 6px -1px rgba(0,0,0,.07),
      0 2px 4px -2px rgba(0,0,0,.05),
      0 0 0 1px rgba(255,255,255,.6) inset;
    position: relative;
    overflow: hidden;
    cursor: default;

    /* Entrada: slide-up + fade */
    animation: slideIn var(--anim) cubic-bezier(.22,.68,0,1.2) forwards;
  }

  .toast.removing {
    animation: slideOut var(--anim) cubic-bezier(.4,0,1,1) forwards;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(110%) scale(.92); }
    to   { opacity: 1; transform: translateX(0)    scale(1);   }
  }

  @keyframes slideOut {
    from { opacity: 1; transform: translateX(0)    scale(1)   max-height: 120px; }
    to   { opacity: 0; transform: translateX(110%) scale(.92) max-height: 0;     }
  }

  @media (max-width: 480px) {
    .toast {
      min-width: 0;
      width: 100%;
      max-width: none;
      border-radius: 0.625rem;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(100%) scale(.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1);   }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateY(0)    scale(1);   }
      to   { opacity: 0; transform: translateY(100%) scale(.96); }
    }
  }

  /* ── Icono ── */
  .icon {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0.05rem;
  }

  /* ── Cuerpo ── */
  .body {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.3;
    margin-bottom: 0.125rem;
  }

  .message {
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.45;
    opacity: .85;
    word-break: break-word;
  }

  /* ── Botón cerrar ── */
  .close {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.125rem;
    border-radius: 0.375rem;
    color: inherit;
    opacity: .45;
    line-height: 1;
    font-size: 1rem;
    transition: opacity .15s;
    margin-top: -0.125rem;
    align-self: flex-start;
  }
  .close:hover { opacity: .85; }

  /* ── Barra de progreso ── */
  .progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 100%;
    transform-origin: left;
    border-radius: 0 0 0.75rem 0.75rem;
  }

  .progress-bar {
    height: 100%;
    width: 100%;
    transform-origin: left;
    border-radius: inherit;
    animation: shrink linear forwards;
  }

  @keyframes shrink {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }

  /* ── Hover pausa progreso ── */
  .toast:hover .progress-bar { animation-play-state: paused; }
`;

// ─── Web Component ─────────────────────────────────────────────────────────────

class LumiereToast extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._toasts = new Map(); // id → { el, timerId }
    this._counter = 0;
    this._busCtx = null;
    this._render();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    // Contexto EventBus propio del componente
    this._busCtx = bus.context?.("ToastComponent") ?? null;

    // Escucha evento global del bus
    if (EVENTS.TOAST_SHOW) {
      bus.on(EVENTS.TOAST_SHOW, (detail) => this._show(detail));
    }

    // Escucha CustomEvent en window (bridge para código sin acceso al bus)
    this._onWindowToast = (e) => this._show(e.detail ?? {});
    window.addEventListener("lumiere:toast", this._onWindowToast);
  }

  disconnectedCallback() {
    window.removeEventListener("lumiere:toast", this._onWindowToast);
    this._busCtx?.destroy?.();
    // Cancela todos los timers pendientes
    for (const { timerId } of this._toasts.values()) clearTimeout(timerId);
    this._toasts.clear();
  }

  // ── Render inicial ─────────────────────────────────────────────────────────

  _render() {
    this._shadow.innerHTML = `
      <style>
        ${STYLES}
      </style>
    `;
    // El host mismo es el contenedor (position: fixed en :host)
  }

  // ── API pública de instancia ───────────────────────────────────────────────

  /**
   * Muestra un toast.
   * @param {Object} options
   * @param {string}  options.message
   * @param {string}  [options.type='info']     — success | error | warning | info
   * @param {string}  [options.title]           — título opcional
   * @param {number}  [options.duration]        — ms (0 = no auto-close)
   * @returns {string} id del toast creado
   */
  _show({
    message = "",
    type = "info",
    title = "",
    duration = DEFAULT_DURATION,
  } = {}) {
    if (!message) return null;

    // Limita el stack; elimina el más antiguo si se supera el máximo
    if (this._toasts.size >= MAX_TOASTS) {
      const [oldestId] = this._toasts.keys();
      this._remove(oldestId, true);
    }

    const id = `toast_${++this._counter}`;
    const theme = THEMES[type] ?? THEMES.info;
    const icon = ICONS[type] ?? ICONS.info;
    const label = title || this._typeLabel(type);

    // ── Elemento toast ────────────────────────────────────────────────────
    const el = document.createElement("div");
    el.classList.add("toast");
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = `
      --anim: ${ANIMATION_MS}ms;
      background: ${theme.bg};
      border-color: ${theme.border};
      color: ${theme.text};
    `;

    el.innerHTML = `
      <span class="icon" style="color:${theme.icon};">${icon}</span>
      <div class="body">
        <div class="title">${this._escape(label)}</div>
        <div class="message">${this._escape(message)}</div>
      </div>
      <button class="close" aria-label="Cerrar notificación">&#x2715;</button>
      ${
        duration > 0
          ? `
        <div class="progress">
          <div class="progress-bar"
            style="background:${theme.progress};animation-duration:${duration}ms;">
          </div>
        </div>`
          : ""
      }
    `;

    // Botón cerrar
    el.querySelector(".close").addEventListener("click", () =>
      this._remove(id),
    );

    // Pausa auto-close al hacer hover
    if (duration > 0) {
      el.addEventListener("mouseenter", () => this._pauseTimer(id));
      el.addEventListener("mouseleave", () => this._resumeTimer(id, duration));
    }

    this._shadow.appendChild(el);

    // Timer auto-close
    const timerId =
      duration > 0 ? setTimeout(() => this._remove(id), duration) : null;

    this._toasts.set(id, { el, timerId, duration, startedAt: Date.now() });
    return id;
  }

  /**
   * Elimina un toast (con animación de salida).
   * @param {string}  id
   * @param {boolean} [instant=false] — elimina sin animación
   */
  _remove(id, instant = false) {
    const entry = this._toasts.get(id);
    if (!entry) return;

    clearTimeout(entry.timerId);
    this._toasts.delete(id);

    if (instant || !entry.el.isConnected) {
      entry.el.remove();
      return;
    }

    entry.el.classList.add("removing");
    entry.el.addEventListener("animationend", () => entry.el.remove(), {
      once: true,
    });
  }

  /** Pausa el timer guardando el tiempo restante. */
  _pauseTimer(id) {
    const entry = this._toasts.get(id);
    if (!entry || !entry.timerId) return;

    clearTimeout(entry.timerId);
    entry.remaining = entry.duration - (Date.now() - entry.startedAt);
    entry.timerId = null;
  }

  /** Reanuda el timer con el tiempo restante. */
  _resumeTimer(id, originalDuration) {
    const entry = this._toasts.get(id);
    if (!entry || entry.timerId) return;

    const remaining = entry.remaining ?? originalDuration;
    if (remaining <= 0) {
      this._remove(id);
      return;
    }

    entry.timerId = setTimeout(() => this._remove(id), remaining);
    entry.startedAt = Date.now() - (originalDuration - remaining);
  }

  /** Label por defecto según tipo. */
  _typeLabel(type) {
    return (
      {
        success: "Éxito",
        error: "Error",
        warning: "Atención",
        info: "Información",
      }[type] ?? "Aviso"
    );
  }

  /** Escapa HTML para prevenir XSS. */
  _escape(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// ─── Registro del elemento ─────────────────────────────────────────────────────

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, LumiereToast);
}

// ─── Singleton helper (API estática) ──────────────────────────────────────────

/**
 * Obtiene o crea el elemento <lumiere-toast> en el DOM.
 * @returns {LumiereToast}
 */
function getHost() {
  let host = document.querySelector(TAG_NAME);
  if (!host) {
    host = document.createElement(TAG_NAME);
    document.body.appendChild(host);
  }
  return host;
}

/**
 * API estática para mostrar toasts sin referenciar el elemento directamente.
 *
 * @example
 * ToastComponent.show('Guardado correctamente', 'success');
 * ToastComponent.show('Ocurrió un error', 'error', { duration: 6000, title: 'Error 500' });
 */
const ToastComponent = {
  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {{ duration?: number, title?: string }} [opts]
   * @returns {string|null} id del toast
   */
  show(message, type = "info", opts = {}) {
    return getHost()._show({ message, type, ...opts });
  },

  /** Atajos de tipo */
  success(message, opts = {}) {
    return this.show(message, "success", opts);
  },
  error(message, opts = {}) {
    return this.show(message, "error", opts);
  },
  warning(message, opts = {}) {
    return this.show(message, "warning", opts);
  },
  info(message, opts = {}) {
    return this.show(message, "info", opts);
  },

  /**
   * Descarta un toast por su id.
   * @param {string} id
   */
  dismiss(id) {
    getHost()._remove(id);
  },
};

export default ToastComponent;
