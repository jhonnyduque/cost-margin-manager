import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product, RawMaterial, MaterialBatch } from "@/types";
import { calculateProductCost, calculateMargin } from "../store";

export const getPricingInsights = async (
  products: Product[],
  materials: RawMaterial[],
  batches: MaterialBatch[]
) => {
  if (products.length === 0) {
    return "Agrega productos para obtener análisis de IA.";
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY no está configurada.");
    return "Falta la API Key de Gemini.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Modelo que funciona en free tier febrero 2026
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const dataString = products
      .map((p) => {
        const cost = calculateProductCost(p, batches, materials);
        const margin = calculateMargin(p.price, cost);
        return `Producto: ${p.name || 'Sin nombre'}, Costo FIFO: ${cost.toFixed(2)}, Precio: ${p.price.toFixed(2)}, Margen: ${margin.toFixed(1)}%`;
      })
      .join("\n");

    const prompt = `
Analiza la rentabilidad de estos productos y dame 3 consejos breves y prácticos para mejorar el margen de beneficio. 
Responde en español, sé conciso y profesional.

Datos:
${dataString}
    `.trim();

    const result = await model.generateContent(prompt);

    const responseText = result.response.text?.() || "No se recibió respuesta.";

    return responseText;
  } catch (error: any) {
    console.error("Error Gemini:", error.message || error);
    if (error.message?.includes('429') || error.status === 429) {
      return "⏳ Cuota de API temporalmente excedida. Espera 1 minuto e intenta de nuevo, o genera una nueva API Key en aistudio.google.com/apikey";
    }
    if (error.message?.includes('400') || error.message?.includes('API_KEY_INVALID')) {
      return "🔑 API Key inválida. Verifica VITE_GEMINI_API_KEY en tu archivo .env.local";
    }
    return `Error: ${error.message || "desconocido"}`;
  }
};
