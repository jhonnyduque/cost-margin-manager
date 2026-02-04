
import { GoogleGenAI } from "@google/genai";
import { Product, RawMaterial, MaterialBatch } from "../types";
import { calculateProductCost, calculateMargin } from "../store";

// Updated to accept batches to use FIFO cost calculation from store.ts
export const getPricingInsights = async (products: Product[], materials: RawMaterial[], batches: MaterialBatch[]) => {
  if (products.length === 0) return "Agrega productos para obtener análisis de IA.";

  // Fix: Initializing GoogleGenAI right before making an API call to ensure it uses the correct context/key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const dataString = products.map(p => {
    // Using calculateProductCost to correctly calculate FIFO cost instead of missing property costPerUnit
    const cost = calculateProductCost(p, batches, materials);
    const margin = calculateMargin(p.price, cost);
    return `Producto: ${p.name}, Costo: ${cost.toFixed(2)}, Precio: ${p.price.toFixed(2)}, Margen: ${margin.toFixed(1)}%`;
  }).join("\n");

  try {
    // Calling generateContent directly with the required model and contents.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza la rentabilidad de estos productos y dame 3 consejos breves para mejorar el margen de beneficio en español. Sé conciso y profesional.
      
      Datos:
      ${dataString}`,
      config: {
        temperature: 0.7,
        // Removed maxOutputTokens to follow guidelines recommending avoidance when thinkingBudget is not used.
      }
    });

    // Extracting the text output using the .text property directly.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "No se pudo obtener el análisis de IA en este momento.";
  }
};
