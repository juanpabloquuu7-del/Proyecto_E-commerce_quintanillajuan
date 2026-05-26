/**
 * app.js
 * Punto de entrada principal de la aplicación LUMIÈRE.
 */
import { Router } from "../core/router.js";

// Esperamos a que todo el HTML esté cargado en el navegador
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 LUMIÈRE App inicializada con éxito.");

  // Encendemos el enrutador para que tome el control del contenedor #app
  window.appRouter = new Router();
});
