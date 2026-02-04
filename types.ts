
export type Status = 'activa' | 'inactiva';
export type Unit = 'metro' | 'cm' | 'kg' | 'gramo' | 'bobina' | 'unidad' | 'litro';
export type MovementType = 'ingreso' | 'egreso';

export interface RawMaterial {
  id: string;
  name: string;
  description: string;
  type: string;
  unit: Unit;
  provider: string;
  status: Status;
}

export interface StockMovement {
  id: string;
  materialId: string;
  batchId: string; // Referencia al lote original
  date: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
  reference: string; // Nombre del proveedor o nombre del producto producido
}

export interface MaterialBatch {
  id: string;
  materialId: string;
  date: string;
  provider: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  reference?: string;
  width?: number; // Ancho útil en cm
  length?: number; // Largo en cm (para piezas)
  area?: number;  // Área total en m²
  entryMode?: 'rollo' | 'pieza';
}

export interface ProductMaterial {
  materialId: string;
  quantity: number;
  consumptionUnit: Unit;
}

export interface Product {
  id: string;
  name: string;
  reference: string;
  price: number;
  targetMargin: number;
  materials: ProductMaterial[];
  status: Status;
  createdAt: string;
}
