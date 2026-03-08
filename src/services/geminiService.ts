import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product, RawMaterial, MaterialBatch } from "@/types";
import { calculateProductCost } from "../store";
import { calculateFinancialMetrics } from "../core/financialMetricsEngine";

export const getPricingInsights = async (
  products: Product[],
  materials: RawMaterial[],
  batches: MaterialBatch[],
  unitsOfMeasure: any[] // Use any[] or import UnitOfMeasure if preferred
) => {
  if (products.length === 0) {
    return "Agrega productos para obtener análisis de IA.";
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY no está configurada.");
    return "Falta la API Key de Gemini.";
  }

  // Log de diagnóstico para verificar que la clave se cargó correctamente (solo primeros caracteres)
  // Diagnóstico de API Key eliminado por seguridad

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Lista de modelos a intentar en orden de preferencia (Estables 2026)
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
    let lastError = "";

    const dataString = products
      .map((p) => {
        const cost = calculateProductCost(p, batches, materials, unitsOfMeasure);
        const metrics = calculateFinancialMetrics(cost, p.price, (p.target_margin || 30) / 100);
        return `Producto: ${p.name || 'Sin nombre'}, Costo FIFO: ${cost.toFixed(2)}, Precio: ${p.price.toFixed(2)}, Margen: ${(metrics.realMargin * 100).toFixed(1)}%`;
      })
      .join("\n");

    const prompt = `
Analiza la rentabilidad de estos productos y dame 3 consejos breves y prácticos para mejorar el margen de beneficio. 
Responde en español, sé conciso y profesional.

Datos:
${dataString}
    `.trim();

    // Intentamos cada modelo hasta que uno funcione
    for (const modelName of modelsToTry) {
      try {
        // Intentando modelo...
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text?.() || "No se recibió respuesta.";
        return responseText;
      } catch (e: any) {
        lastError = e.message || String(e);
        console.warn(`Modelo ${modelName} falló:`, lastError);
        // Si no es un error de "no encontrado" (404), lanzamos para el catch general
        if (!lastError.includes('404')) break;
      }
    }

    throw new Error(lastError);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error("Error Gemini Details:", errorMsg);

    if (errorMsg.includes('429') || error.status === 429) {
      return `⏳ Límite de la API excedido. Google indica: "${errorMsg}". Intenta de nuevo en unos segundos.`;
    }
    if (errorMsg.includes('404')) {
      return "🔭 Ningún modelo de IA respondió. Esto suele significar que la API Key es muy nueva o no tiene permisos. ¡REINICIA EL SERVIDOR! y si falla, revisa AI Studio.";
    }
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('400')) {
      return "🔑 API Key inválida o mal configurada. Verifica que hayas copiado la clave completa en el archivo .env.local y REINICIA el servidor con Ctrl+C y 'npm run dev'.";
    }

    return `🤖 Error de IA: ${errorMsg.split('\n')[0]}`;
  }
};
