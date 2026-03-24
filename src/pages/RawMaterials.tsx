import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  History,
  ShoppingCart,
  Printer,
  Pencil,
  AlertCircle,
  Scissors,
  RotateCcw,
  Package,
  Archive,
  MoreVertical,
} from 'lucide-react';

import { useStore, getMaterialDebt, calculateTotalFinancialDebt } from '../store';
import { RawMaterial, MaterialBatch } from '@/types';
import { UnitConverter } from '../services/inventoryEngineV2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/Badge';
import { translateError } from '@/utils/errorHandler';
import { calculateBatchArea } from '@/utils/materialCalculations';
import SupplierCombobox from '@/components/ui/SupplierCombobox';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

type EntryMode = 'rollo' | 'pieza';

interface RawMaterialFormData {
  name: string;
  description: string;
  type: string;
  category_id: string;
  base_unit_id: string;
  purchase_unit_id: string;
  display_unit_id: string;
  provider: string;
  status: 'activa' | 'inactiva';
  initialQty: number;
  unitCost: number;
  totalCost: number;
  width: number;
  unit?: string;
}

type BatchFormData = Partial<MaterialBatch> & {
  total_cost: number;
};

interface BatchStats {
  totalOriginalQty: number;
  totalRemainingQty: number;
  totalValue: number;
  weightedAvgCost: number;
  totalArea: number;
  avgCostPerM2: number;
  debtQty: number;
}

const dropdownStyle: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: 'var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  paddingTop: 'var(--space-4)',
  paddingBottom: 'var(--space-4)',
  minWidth: '11rem',
};

const dropdownBtn: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 'var(--space-8)',
  padding: 'var(--space-8) var(--space-16)',
  fontSize: 'var(--text-small-size)',
  fontWeight: 500,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  transition: 'background var(--transition-fast)',
};

const getToday = () => new Date().toISOString().split('T')[0];
const normalizeDateForInput = (value?: string | null) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

const getEmptyFormData = (): RawMaterialFormData => ({
  name: '',
  description: '',
  type: 'Tela',
  category_id: '',
  base_unit_id: '',
  purchase_unit_id: '',
  display_unit_id: '',
  provider: '',
  status: 'activa',
  initialQty: 0,
  unitCost: 0,
  totalCost: 0,
  width: 140,
});

const getEmptyBatchFormData = (provider = '', receivedUnitId = ''): BatchFormData => ({
  date: getToday(),
  provider,
  initial_quantity: 0,
  unit_cost: 0,
  total_cost: 0,
  reference: '',
  width: 140,
  length: 0,
  received_unit_id: receivedUnitId,
});

const isMaterialDimensional = (material: RawMaterial | null | undefined, unitsOfMeasure: any[]) => {
  if (!material) return false;

  const candidateUnitIds = [
    material.base_unit_id,
    material.purchase_unit_id,
    material.display_unit_id,
  ].filter(Boolean);

  const candidateSymbols = candidateUnitIds
    .map((id) => unitsOfMeasure.find((u) => u.id === id)?.symbol?.toLowerCase?.() || '')
    .filter(Boolean);

  const rawUnit = (material.unit || '').toLowerCase();

  return (
    material.type === 'Tela' &&
    (candidateSymbols.includes('m') ||
      candidateSymbols.includes('cm') ||
      candidateSymbols.includes('metro') ||
      candidateSymbols.includes('metros') ||
      rawUnit === 'metro' ||
      rawUnit === 'cm' ||
      rawUnit === 'm')
  );
};

const RawMaterials: React.FC = () => {
  const navigate = useNavigate();

  const {
    currentCompanyId,
    currentUserRole,
    rawMaterials,
    products,
    batches,
    movements,
    uomCategories,
    unitsOfMeasure,
    materialTypes,
    addRawMaterial,
    deleteRawMaterial,
    archiveMaterial,
    updateRawMaterial,
    addBatch,
    deleteBatch,
    updateBatch,
    loadUomMetadata,
  } = useStore();

  const { formatCurrency } = useCurrency();

  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes((currentUserRole as string) || '');
  const canEdit = allowedRoles.includes((currentUserRole as string) || '');
  const canDelete = allowedRoles.includes((currentUserRole as string) || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entry_mode, set_entry_mode] = useState<EntryMode>('rollo');
  const [isSaving, setIsSaving] = useState(false);
  const [editingBatchData, setEditingBatchData] = useState<MaterialBatch | null>(null);
  const [formData, setFormData] = useState<RawMaterialFormData>(getEmptyFormData());
  const [batchFormData, setBatchFormData] = useState<BatchFormData>(getEmptyBatchFormData());

  const [menuState, setMenuState] = useState<{ materialId: string; rect: DOMRect } | null>(null);
  const [batchMenuState, setBatchMenuState] = useState<{ batchId: string; rect: DOMRect } | null>(
    null
  );

  const menuRef = useRef<HTMLDivElement>(null);
  const batchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUomMetadata();
  }, [loadUomMetadata]);

  useEffect(() => {
    if (!menuState && !batchMenuState) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-kebab-trigger]')) return;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuState(null);
      }

      if (batchMenuRef.current && !batchMenuRef.current.contains(target)) {
        setBatchMenuState(null);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuState, batchMenuState]);

  useEffect(() => {
    if (!expandedMaterialId) return;

    const material = rawMaterials.find((m) => m.id === expandedMaterialId);
    if (!material) return;

    setBatchFormData(
      getEmptyBatchFormData(
        material.provider || '',
        material.purchase_unit_id || material.base_unit_id || ''
      )
    );
    set_entry_mode('rollo');
  }, [expandedMaterialId, rawMaterials]);

  const expandedMaterial = useMemo(
    () => rawMaterials.find((m) => m.id === expandedMaterialId) || null,
    [rawMaterials, expandedMaterialId]
  );

  const printDate = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  const printTitle = expandedMaterial?.name ?? 'Catálogo de Materias Primas';
  const printProvider = expandedMaterial?.provider ?? '';

  const filteredMaterials = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rawMaterials
      .filter((m) => {
        const name = m.name?.toLowerCase() || '';
        const provider = m.provider?.toLowerCase() || '';
        const type = m.type?.toLowerCase() || '';

        return !term || name.includes(term) || provider.includes(term) || type.includes(term);
      })
      .filter((m) => (unitFilter === 'todos' ? true : m.unit === unitFilter));
  }, [rawMaterials, searchTerm, unitFilter]);

  const batchStatsByMaterial = useMemo<Record<string, BatchStats>>(() => {
    const stats: Record<string, BatchStats> = {};

    rawMaterials.forEach((material) => {
      const matBatches = batches.filter((b) => b.material_id === material.id);

      const totalOriginalQty = matBatches.reduce(
        (acc, batch) => acc + ((batch as any).base_initial_quantity ?? batch.initial_quantity ?? 0),
        0
      );

      let totalRemainingQty = matBatches.reduce(
        (acc, batch) =>
          acc + ((batch as any).base_remaining_quantity ?? batch.remaining_quantity ?? 0),
        0
      );

      const totalValue = matBatches.reduce((acc, batch) => {
        const qty = (batch as any).base_initial_quantity ?? batch.initial_quantity ?? 0;
        const cost = (batch as any).cost_per_base_unit ?? batch.unit_cost ?? 0;
        return acc + qty * cost;
      }, 0);

      const totalArea = matBatches.reduce((acc, batch) => acc + (batch.area || 0), 0);
      const debtQty = getMaterialDebt(material.id, movements).pendingQty;

      totalRemainingQty -= debtQty;

      stats[material.id] = {
        totalOriginalQty,
        totalRemainingQty,
        totalValue,
        weightedAvgCost: totalOriginalQty > 0 ? totalValue / totalOriginalQty : 0,
        totalArea,
        avgCostPerM2: totalArea > 0 ? totalValue / totalArea : 0,
        debtQty,
      };
    });

    return stats;
  }, [rawMaterials, batches, movements]);

  const totalFinancialDebt = useMemo(
    () => calculateTotalFinancialDebt(movements, rawMaterials),
    [movements, rawMaterials]
  );

  const calculatedArea = useMemo(() => {
    if (entry_mode === 'rollo') {
      return (batchFormData.initial_quantity || 0) * ((batchFormData.width || 0) / 100);
    }

    return ((batchFormData.length || 0) * (batchFormData.width || 0)) / 10000;
  }, [
    entry_mode,
    batchFormData.initial_quantity,
    batchFormData.length,
    batchFormData.width,
  ]);

  const calculatedCostPerM2 = useMemo(() => {
    if (calculatedArea <= 0) return 0;

    if (entry_mode === 'rollo') {
      const total = (batchFormData.initial_quantity || 0) * (batchFormData.unit_cost || 0);
      return total / calculatedArea;
    }

    return (batchFormData.unit_cost || 0) / calculatedArea;
  }, [entry_mode, batchFormData.initial_quantity, batchFormData.unit_cost, calculatedArea]);

  const openMenu = (materialId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (menuState?.materialId === materialId) {
      setMenuState(null);
      return;
    }

    setMenuState({
      materialId,
      rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
    });
  };

  const openBatchMenu = (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (batchMenuState?.batchId === batchId) {
      setBatchMenuState(null);
      return;
    }

    setBatchMenuState({
      batchId,
      rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
    });
  };

  const handlePrint = () => {
    setMenuState(null);
    setBatchMenuState(null);
    window.print();
  };

  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCompanyId) {
      alert('Error: No hay una empresa activa.');
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const existingMaterial = rawMaterials.find((m) => m.id === editingId);
      const materialId = editingId || crypto.randomUUID();

      const selectedPurchaseUom = unitsOfMeasure.find((u) => u.id === formData.purchase_unit_id);

      const materialData: RawMaterial = {
        id: materialId,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        category_id: formData.category_id,
        base_unit_id: formData.base_unit_id,
        purchase_unit_id: formData.purchase_unit_id,
        display_unit_id: formData.display_unit_id,
        provider: formData.provider,
        status: formData.status,
        company_id: currentCompanyId,
        created_at: existingMaterial?.created_at || now,
        updated_at: now,
        deleted_at: existingMaterial?.deleted_at || null,
        unit: selectedPurchaseUom?.symbol || formData.unit,
      } as RawMaterial;

      if (editingId) {
        await updateRawMaterial(materialData);
      } else {
        await addRawMaterial(materialData);

        if (formData.initialQty > 0) {
          const purchaseUom =
            unitsOfMeasure.find((u) => u.id === formData.purchase_unit_id) ||
            unitsOfMeasure.find((u) => u.id === formData.base_unit_id);

          const factor = purchaseUom?.conversion_factor || 1;
          const baseQty = formData.initialQty * factor;
          const costPerBase = factor > 0 ? formData.unitCost / factor : formData.unitCost;
          const isDimensional = formData.type === 'Tela';
          const area = isDimensional
            ? calculateBatchArea('rollo', {
              initial_quantity: formData.initialQty,
              width: formData.width || 0,
            })
            : 0;

          const batch: MaterialBatch = {
            id: crypto.randomUUID(),
            material_id: materialId,
            date: now.split('T')[0],
            provider: formData.provider || 'Carga Inicial',
            initial_quantity: formData.initialQty,
            remaining_quantity: formData.initialQty,
            unit_cost: formData.unitCost,
            received_unit_id: formData.purchase_unit_id || formData.base_unit_id,
            base_initial_quantity: baseQty,
            base_remaining_quantity: baseQty,
            cost_per_base_unit: costPerBase,
            reference: 'Carga Inicial',
            width: formData.width,
            length: 0,
            area,
            entry_mode: 'rollo',
            company_id: currentCompanyId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: '',
            updated_by: '',
          } as MaterialBatch;

          await addBatch(batch);
        }
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(getEmptyFormData());
    } catch (error: any) {
      alert(`Hubo un error al guardar: ${translateError(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expandedMaterialId || !currentCompanyId) {
      alert('Error: No hay una empresa activa.');
      return;
    }

    setIsSaving(true);

    try {
      const material = rawMaterials.find((m) => m.id === expandedMaterialId);
      const isDimensional = isMaterialDimensional(material, unitsOfMeasure);

      let finalQty = batchFormData.initial_quantity || 0;
      let finalUnitCost = batchFormData.unit_cost || 0;
      let area = 0;

      if (!isDimensional) {
        finalQty = batchFormData.initial_quantity || 0;
        finalUnitCost = batchFormData.unit_cost || 0;
      } else if (entry_mode === 'rollo') {
        area = calculateBatchArea('rollo', {
          initial_quantity: batchFormData.initial_quantity || 0,
          width: batchFormData.width || 0,
        });
        finalUnitCost = batchFormData.unit_cost || 0;
      } else {
        area = calculateBatchArea('pieza', {
          length: batchFormData.length || 0,
          width: batchFormData.width || 0,
        });
        finalQty = (batchFormData.length || 0) / 100;
        finalUnitCost =
          finalQty > 0 ? (batchFormData.unit_cost || 0) / finalQty : 0;
      }

      const unitId =
        batchFormData.received_unit_id || material?.purchase_unit_id || material?.base_unit_id;

      const purchaseUom = unitsOfMeasure.find((u) => u.id === unitId);
      const factor = purchaseUom?.conversion_factor || 1;
      const baseQty = finalQty * factor;
      const costPerBase = factor > 0 ? finalUnitCost / factor : finalUnitCost;

      const data: MaterialBatch = {
        ...(batchFormData as MaterialBatch),
        id: crypto.randomUUID(),
        material_id: expandedMaterialId,
        initial_quantity: finalQty,
        remaining_quantity: finalQty,
        unit_cost: finalUnitCost,
        received_unit_id: unitId,
        base_initial_quantity: baseQty,
        base_remaining_quantity: baseQty,
        cost_per_base_unit: costPerBase,
        area,
        entry_mode,
        company_id: currentCompanyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MaterialBatch;

      await addBatch(data);

      setBatchFormData(
        getEmptyBatchFormData(
          material?.provider || '',
          material?.purchase_unit_id || material?.base_unit_id || ''
        )
      );
    } catch (error: any) {
      alert(`No se pudo agregar el ingreso físico: ${translateError(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingBatchData || !currentCompanyId) {
      alert('No hay empresa activa.');
      return;
    }

    setIsSaving(true);

    try {
      const original = batches.find((b) => b.id === editingBatchData.id);

      if (!original) {
        throw new Error('No se encontró el lote original.');
      }

      if (original.remaining_quantity < original.initial_quantity) {
        await updateBatch({
          ...original,
          date: editingBatchData.date,
          provider: editingBatchData.provider,
          reference: editingBatchData.reference,
          updated_at: new Date().toISOString(),
        } as MaterialBatch);

        setEditingBatchData(null);
        return;
      }

      let area = 0;
      let finalQty = editingBatchData.initial_quantity || 0;
      let finalUnitCost = editingBatchData.unit_cost || 0;

      if (editingBatchData.entry_mode === 'rollo') {
        area = calculateBatchArea('rollo', {
          initial_quantity: editingBatchData.initial_quantity || 0,
          width: editingBatchData.width || 0,
        });
        finalUnitCost = editingBatchData.unit_cost || 0;
      } else {
        area = calculateBatchArea('pieza', {
          length: editingBatchData.length || 0,
          width: editingBatchData.width || 0,
        });
        finalQty = (editingBatchData.length || 0) / 100;
        finalUnitCost = finalQty > 0 ? (editingBatchData.unit_cost || 0) / finalQty : 0;
      }

      const unitId = editingBatchData.received_unit_id || original.received_unit_id;
      const purchaseUom = unitsOfMeasure.find((u) => u.id === unitId);
      const factor = purchaseUom?.conversion_factor || 1;
      const baseQty = finalQty * factor;
      const costPerBase = factor > 0 ? finalUnitCost / factor : finalUnitCost;

      await updateBatch({
        ...editingBatchData,
        initial_quantity: finalQty,
        remaining_quantity: finalQty,
        unit_cost: finalUnitCost,
        area,
        base_initial_quantity: baseQty,
        base_remaining_quantity: baseQty,
        cost_per_base_unit: costPerBase,
        updated_at: new Date().toISOString(),
      } as MaterialBatch);

      setEditingBatchData(null);
    } catch (error: any) {
      alert(`Fallo al actualizar el lote: ${translateError(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const editingMaterialStats = editingId ? batchStatsByMaterial[editingId] : null;
  const editReadOnlyUnitCost = editingMaterialStats?.weightedAvgCost || 0;
  const editReadOnlyInvoiceCost = editingMaterialStats?.totalValue || 0;
  const editingBatchMaterial = editingBatchData
    ? rawMaterials.find((m) => m.id === editingBatchData.material_id)
    : null;
  const editingBatchIsDimensional = isMaterialDimensional(editingBatchMaterial, unitsOfMeasure);
  const editingBatchUnitSymbol =
    unitsOfMeasure.find((u) => u.id === editingBatchData?.received_unit_id)?.symbol || 'und';

  const handleOpenBatchCostEditor = () => {
    if (!editingId) return;
    const materialId = editingId;
    setIsModalOpen(false);
    setEditingId(null);
    setExpandedMaterialId(materialId);
  };

  return (
    <PageContainer>
      <style>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 1.5cm;
          }

          body * {
            visibility: hidden !important;
          }

          #print-header,
          #print-header *,
          #print-area,
          #print-area * {
            visibility: visible !important;
          }

          #print-header {
            display: flex !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 1.2cm 1.5cm 0.5cm;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #000;
            background: #fff;
            z-index: 2;
            box-sizing: border-box;
          }

          #print-area {
            position: absolute;
            top: 3.2cm;
            left: 0;
            width: 100%;
            padding: 0 1.5cm;
            box-sizing: border-box;
          }

          .no-print,
          .screen-mobile-only,
          th:last-child,
          td:last-child {
            display: none !important;
          }

          .print-desktop-area {
            display: block !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed;
            font-size: 11px;
          }

          thead {
            display: table-header-group;
          }

          thead tr {
            border-bottom: 2px solid #000;
          }

          thead th {
            padding: 6px 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #000 !important;
          }

          tbody td {
            padding: 5px 8px;
            border-bottom: 1px solid #ddd;
            color: #000 !important;
            background: #fff !important;
          }

          tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          tbody tr:last-child {
            border-top: 2px solid #000 !important;
            font-weight: 700;
          }

          .card,
          .inset-card {
            box-shadow: none !important;
            border-color: #ddd !important;
          }
        }
      `}</style>

      <div id="print-header" className="print-only" aria-hidden="true">
        <div>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#999',
              marginBottom: '4px',
            }}
          >
            BETO OS — Inventario
          </div>

          <div
            style={{
              fontSize: '20px',
              fontWeight: 900,
              color: '#000',
              lineHeight: 1,
            }}
          >
            {printTitle}
          </div>

          {printProvider ? (
            <div
              style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px',
              }}
            >
              Proveedor: {printProvider}
            </div>
          ) : null}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#999',
              marginBottom: '4px',
            }}
          >
            Fecha de emisión
          </div>

          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#000',
            }}
          >
            {printDate}
          </div>
        </div>
      </div>

      <SectionBlock>
        <UniversalPageHeader
          title="Materias Primas"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Inventario
              </span>
            </>
          }
          metadata={[
            <span key="1">Inventario Maestro y Gestión FIFO</span>,
            <span key="2">{rawMaterials.length} insumos registrados</span>,
          ]}
          actions={
            canCreate && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => navigate('/productos')}
                  icon={<Package size={16} />}
                >
                  <span className="hidden sm:inline">PRODUCTOS</span>
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingId(null);
                    setFormData(getEmptyFormData());
                    setIsModalOpen(true);
                  }}
                  icon={<Plus size={16} />}
                >
                  <span className="hidden sm:inline">NUEVO MATERIAL</span>
                </Button>
              </>
            )
          }
        />

        {totalFinancialDebt > 0 && (
          <div style={{ marginTop: 'var(--space-24)' }}>
            <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16) var(--space-20)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                <AlertCircle size={20} />
                <div>
                  <strong style={{ fontSize: 'var(--text-body-size)' }}>
                    Deuda de Inventario Detectada
                  </strong>
                  <p className="text-small" style={{ color: 'inherit', opacity: 0.8, marginTop: '2px' }}>
                    Producciones realizadas sin respaldo físico. Regularice para integridad contable.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex" style={{ flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <span className="text-small" style={{ fontWeight: 700, textTransform: 'uppercase', opacity: 0.75 }}>
                  Valorización Estimada
                </span>
                <span style={{ fontSize: 'var(--text-h3-size)', fontWeight: 900, color: 'inherit' }}>
                  {formatCurrency(totalFinancialDebt)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div
          className="no-print"
          style={{
            marginTop: 'var(--space-32)',
            borderTop: 'var(--border-default)',
            paddingTop: 'var(--space-32)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 14rem auto',
              alignItems: 'center',
              gap: 'var(--space-12)',
            }}
          >
            <div style={{ position: 'relative', minWidth: 0 }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 'var(--space-16)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Buscar por nombre, proveedor o tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
                style={{ paddingLeft: 'var(--space-48)', width: '100%' }}
              />
            </div>

            <Select
              style={{ width: '100%' }}
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
            >
              <option value="todos">Unidades: Todas</option>
              {unitsOfMeasure.map((u) => (
                <option key={u.id} value={u.symbol}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              title="Imprimir catálogo"
              icon={<Printer size={18} />}
              style={{ flexShrink: 0 }}
            />
          </div>
        </div>
      </SectionBlock>

      {/* Móvil */}
      <div
        className="cards-mobile"
        style={{
          flexDirection: 'column',
          gap: 'var(--space-16)',
          marginTop: 'var(--space-24)',
        }}
      >
        {filteredMaterials.length === 0 ? (
          <div
            className="empty-state"
            style={{
              border: '2px dashed var(--border-color-default)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div className="empty-state-icon">
              <Package size={32} />
            </div>
            <p className="text-muted">No hay materias primas registradas.</p>
          </div>
        ) : (
          filteredMaterials.map((m) => {
            const stats: BatchStats = batchStatsByMaterial[m.id] || {
              totalOriginalQty: 0,
              totalRemainingQty: 0,
              totalValue: 0,
              weightedAvgCost: 0,
              totalArea: 0,
              avgCostPerM2: 0,
              debtQty: 0,
            };

            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-16)',
                  border: 'var(--border-default)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-8)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.name}
                    </h3>
                    <p className="text-small text-muted">{m.provider || 'Varios'}</p>
                  </div>

                  <span
                    className="text-small text-muted"
                    style={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                    }}
                  >
                    {m.type}
                  </span>
                </div>

                <div
                  className="inset-card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-16)',
                    margin: 'var(--space-16) 0',
                  }}
                >
                  <div>
                    <span
                      className="text-small text-muted"
                      style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase' }}
                    >
                      Stock
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        color:
                          stats.totalRemainingQty <= 0
                            ? 'var(--state-danger)'
                            : 'var(--text-primary)',
                      }}
                    >
                      {UnitConverter.formatFromBase(
                        stats.totalRemainingQty,
                        unitsOfMeasure.find((u) => u.id === m.display_unit_id) ||
                        unitsOfMeasure.find((u) => u.id === m.base_unit_id) || {
                          symbol: m.unit,
                          conversion_factor: 1,
                        }
                      )}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="text-small text-muted"
                      style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase' }}
                    >
                      Costo Prom.
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {formatCurrency(stats.weightedAvgCost)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingTop: 'var(--space-8)',
                    borderTop: 'var(--border-default)',
                  }}
                >
                  <button
                    data-kebab-trigger
                    className="btn-ghost btn-sm"
                    onClick={(e) => openMenu(m.id, e)}
                    aria-label="Más opciones"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Escritorio */}
      <div
        className="table-responsive-wrap print-desktop-area"
        style={{ marginTop: 'var(--space-32)' }}
        id="print-area"
      >
        <div
          style={{
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius-xl)',
            border: 'var(--border-default)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table className="table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Materia Prima</th>
                <th style={{ width: '13%' }}>Categoría</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Disponible / Deuda</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Valor en Bodega</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Costo Promedio</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-24)', textAlign: 'center' }}>
                    <span className="text-muted">No hay materias primas para mostrar.</span>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => {
                  const stats: BatchStats = batchStatsByMaterial[m.id] || {
                    totalOriginalQty: 0,
                    totalRemainingQty: 0,
                    totalValue: 0,
                    weightedAvgCost: 0,
                    totalArea: 0,
                    avgCostPerM2: 0,
                    debtQty: 0,
                  };

                  const isDimensional = isMaterialDimensional(m, unitsOfMeasure);
                  const displayStock = stats.totalRemainingQty;
                  const valuation = displayStock * stats.weightedAvgCost;

                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        style={{
                          background:
                            expandedMaterialId === m.id
                              ? 'var(--surface-page)'
                              : 'var(--surface-card)',
                        }}
                      >
                        <td style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {m.name}
                            </span>
                            <span
                              className="text-small text-muted"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {m.provider || 'Varios'}
                            </span>
                          </div>
                        </td>

                        <td
                          className="text-small"
                          style={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {m.type}
                        </td>

                        <td className="align-right">
                          <span
                            style={{
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color:
                                displayStock > 0
                                  ? 'var(--state-success)'
                                  : displayStock < 0
                                    ? 'var(--state-danger)'
                                    : 'var(--text-secondary)',
                            }}
                          >
                            {UnitConverter.formatFromBase(
                              displayStock,
                              unitsOfMeasure.find((u) => u.id === m.display_unit_id) ||
                              unitsOfMeasure.find((u) => u.id === m.base_unit_id) || {
                                symbol: m.unit || 'base',
                                conversion_factor: 1,
                              }
                            )}
                          </span>
                        </td>

                        <td
                          className="align-right"
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color:
                              valuation < 0
                                ? 'var(--state-danger)'
                                : 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(valuation)}
                        </td>

                        <td
                          className="align-right"
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {formatCurrency(stats.weightedAvgCost)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            data-kebab-trigger
                            style={{
                              borderRadius: 'var(--radius-md)',
                              padding: 'var(--space-8)',
                              border:
                                menuState?.materialId === m.id
                                  ? 'var(--border-default)'
                                  : '1px solid transparent',
                              background:
                                menuState?.materialId === m.id
                                  ? 'var(--surface-muted)'
                                  : 'transparent',
                              color:
                                menuState?.materialId === m.id
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                            }}
                            onClick={(e) => openMenu(m.id, e)}
                            aria-label="Más opciones"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>

                      {expandedMaterialId === m.id && (
                        <tr
                          style={{
                            background: 'var(--surface-page)',
                            borderBottom: 'var(--border-default)',
                          }}
                        >
                          <td colSpan={6} style={{ padding: 'var(--space-24)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                              <div className="no-print card" style={{ padding: 'var(--space-24)' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 'var(--space-24)',
                                  }}
                                >
                                  <h4
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--space-8)',
                                      fontSize: 'var(--text-small-size)',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    <ShoppingCart size={14} />
                                    Registrar Nueva Entrada Física
                                  </h4>

                                  {isDimensional && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: 'var(--space-4)',
                                        background: 'var(--surface-muted)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-4)',
                                        border: 'var(--border-default)',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => set_entry_mode('rollo')}
                                        className={entry_mode === 'rollo' ? 'tab is-active' : 'tab'}
                                        style={{
                                          minHeight: '2rem',
                                          padding: '0 var(--space-12)',
                                          fontSize: 'var(--text-small-size)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 'var(--space-4)',
                                        }}
                                      >
                                        <RotateCcw size={12} />
                                        Rollo
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => set_entry_mode('pieza')}
                                        className={entry_mode === 'pieza' ? 'tab is-active' : 'tab'}
                                        style={{
                                          minHeight: '2rem',
                                          padding: '0 var(--space-12)',
                                          fontSize: 'var(--text-small-size)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 'var(--space-4)',
                                        }}
                                      >
                                        <Scissors size={12} />
                                        Pieza
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {canCreate && (
                                  <form onSubmit={handleBatchSubmit}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                        gap: 'var(--space-12)',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <div style={{ width: '8rem' }}>
                                        <Input
                                          type="date"
                                          label="Fecha"
                                          value={batchFormData.date || ''}
                                          onChange={(e) =>
                                            setBatchFormData({
                                              ...batchFormData,
                                              date: e.target.value,
                                            })
                                          }
                                          required
                                        />
                                      </div>

                                      <div style={{ flex: 1, minWidth: '10rem' }}>
                                        <SupplierCombobox
                                          label="Proveedor / Ref."
                                          value={batchFormData.provider || ''}
                                          onChange={(name) =>
                                            setBatchFormData({
                                              ...batchFormData,
                                              provider: name,
                                            })
                                          }
                                        />
                                      </div>

                                      {isDimensional ? (
                                        <>
                                          {entry_mode === 'rollo' ? (
                                            <>
                                              <div style={{ width: '6rem' }}>
                                                <Input
                                                  label="M. Lineales"
                                                  type="number"
                                                  step="0.01"
                                                  value={batchFormData.initial_quantity || ''}
                                                  onChange={(e) => {
                                                    const qty = parseFloat(e.target.value) || 0;
                                                    setBatchFormData({
                                                      ...batchFormData,
                                                      initial_quantity: qty,
                                                      total_cost: qty * (batchFormData.unit_cost || 0),
                                                    });
                                                  }}
                                                  required
                                                />
                                              </div>

                                              <div style={{ width: '8rem' }}>
                                                <Input
                                                  label="Costo / Metro (€)"
                                                  type="number"
                                                  step="0.0001"
                                                  value={batchFormData.unit_cost || ''}
                                                  onChange={(e) => {
                                                    const uc = parseFloat(e.target.value) || 0;
                                                    setBatchFormData({
                                                      ...batchFormData,
                                                      unit_cost: uc,
                                                      total_cost:
                                                        (batchFormData.initial_quantity || 0) * uc,
                                                    });
                                                  }}
                                                  required
                                                />
                                              </div>

                                              <div style={{ width: '8rem' }}>
                                                <Input
                                                  label="Costo Total (€)"
                                                  type="number"
                                                  step="0.01"
                                                  value={batchFormData.total_cost || ''}
                                                  onChange={(e) => {
                                                    const total = parseFloat(e.target.value) || 0;
                                                    const uc =
                                                      (batchFormData.initial_quantity || 0) > 0
                                                        ? total /
                                                        (batchFormData.initial_quantity || 0)
                                                        : 0;
                                                    setBatchFormData({
                                                      ...batchFormData,
                                                      total_cost: total,
                                                      unit_cost: uc,
                                                    });
                                                  }}
                                                  placeholder="Auto"
                                                />
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <div style={{ width: '6rem' }}>
                                                <Input
                                                  label="Largo (cm)"
                                                  type="number"
                                                  step="0.01"
                                                  value={batchFormData.length || ''}
                                                  onChange={(e) =>
                                                    setBatchFormData({
                                                      ...batchFormData,
                                                      length: parseFloat(e.target.value) || 0,
                                                    })
                                                  }
                                                  required
                                                />
                                              </div>

                                              <div style={{ width: '8rem' }}>
                                                <Input
                                                  label="Costo Total (€)"
                                                  type="number"
                                                  step="0.01"
                                                  value={batchFormData.unit_cost || ''}
                                                  onChange={(e) =>
                                                    setBatchFormData({
                                                      ...batchFormData,
                                                      unit_cost: parseFloat(e.target.value) || 0,
                                                    })
                                                  }
                                                  required
                                                />
                                              </div>
                                            </>
                                          )}

                                          <div style={{ width: '6rem' }}>
                                            <Input
                                              label="Ancho (cm)"
                                              type="number"
                                              step="1"
                                              value={batchFormData.width || ''}
                                              onChange={(e) =>
                                                setBatchFormData({
                                                  ...batchFormData,
                                                  width: parseInt(e.target.value) || 0,
                                                })
                                              }
                                              required
                                            />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div style={{ width: '8rem' }}>
                                            <Input
                                              label={`Cant. (${unitsOfMeasure.find(
                                                (u) =>
                                                  u.id === (m.purchase_unit_id || m.base_unit_id)
                                              )?.symbol ||
                                                m.unit ||
                                                'un'
                                                })`}
                                              type="number"
                                              step="0.01"
                                              value={batchFormData.initial_quantity || ''}
                                              onChange={(e) => {
                                                const qty = parseFloat(e.target.value) || 0;
                                                setBatchFormData({
                                                  ...batchFormData,
                                                  initial_quantity: qty,
                                                  total_cost: qty * (batchFormData.unit_cost || 0),
                                                });
                                              }}
                                              required
                                            />
                                          </div>

                                          <div style={{ width: '8rem' }}>
                                            <Input
                                              label="Costo Unit. (€)"
                                              type="number"
                                              step="0.0001"
                                              value={batchFormData.unit_cost || ''}
                                              onChange={(e) => {
                                                const uc = parseFloat(e.target.value) || 0;
                                                setBatchFormData({
                                                  ...batchFormData,
                                                  unit_cost: uc,
                                                  total_cost:
                                                    (batchFormData.initial_quantity || 0) * uc,
                                                });
                                              }}
                                              required
                                            />
                                          </div>

                                          <div style={{ width: '8rem' }}>
                                            <Input
                                              label="Costo Factura (€)"
                                              type="number"
                                              step="0.01"
                                              value={batchFormData.total_cost || ''}
                                              onChange={(e) => {
                                                const total = parseFloat(e.target.value) || 0;
                                                const uc =
                                                  (batchFormData.initial_quantity || 0) > 0
                                                    ? total / (batchFormData.initial_quantity || 0)
                                                    : 0;
                                                setBatchFormData({
                                                  ...batchFormData,
                                                  total_cost: total,
                                                  unit_cost: uc,
                                                });
                                              }}
                                              placeholder="Auto"
                                            />
                                          </div>
                                        </>
                                      )}

                                      <Button
                                        type="submit"
                                        variant="primary"
                                        icon={<Plus size={16} />}
                                        disabled={isSaving}
                                      >
                                        Añadir Lote
                                      </Button>
                                    </div>

                                    {isDimensional && (
                                      <div
                                        className="text-small text-muted"
                                        style={{
                                          marginTop: 'var(--space-12)',
                                          display: 'flex',
                                          gap: 'var(--space-16)',
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        <span>Área estimada: <strong>{calculatedArea.toFixed(2)} m²</strong></span>
                                        <span>Costo estimado / m²: <strong>{calculatedCostPerM2 > 0 ? formatCurrency(calculatedCostPerM2) : '---'}</strong></span>
                                      </div>
                                    )}
                                  </form>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <h4
                                    style={{
                                      fontSize: 'var(--text-h3-size)',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    Kardex de Lotes y Movimientos
                                  </h4>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePrint}
                                    title="Imprimir"
                                  >
                                    <Printer size={16} />
                                  </Button>
                                </div>

                                <div
                                  style={{
                                    background: 'var(--surface-card)',
                                    borderRadius: 'var(--radius-xl)',
                                    border: 'var(--border-default)',
                                    overflow: 'hidden',
                                    boxShadow: 'var(--shadow-sm)',
                                  }}
                                >
                                  <div style={{ overflowX: 'auto' }}>
                                    <table
                                      className="table"
                                      style={{ tableLayout: 'fixed', minWidth: '700px' }}
                                    >
                                      <thead>
                                        <tr>
                                          <th style={{ width: '12%' }}>Fecha</th>
                                          <th style={{ width: '10%' }}>Modo</th>
                                          <th style={{ width: '18%' }}>Proveedor</th>
                                          <th style={{ width: '15%', textAlign: 'right' }}>
                                            {isDimensional ? 'Dimensiones' : 'Cantidad Compra'}
                                          </th>
                                          {isDimensional && (
                                            <>
                                              <th
                                                style={{
                                                  width: '10%',
                                                  textAlign: 'right',
                                                  color: 'var(--state-success)',
                                                }}
                                              >
                                                Área
                                              </th>
                                              <th style={{ width: '10%', textAlign: 'right' }}>/m²</th>
                                            </>
                                          )}
                                          <th style={{ width: '15%', textAlign: 'right' }}>
                                            Costo Total
                                          </th>
                                          <th style={{ width: '15%', textAlign: 'right' }}>
                                            Restante (
                                            {
                                              unitsOfMeasure.find(
                                                (u) => u.id === (m.display_unit_id || m.base_unit_id)
                                              )?.symbol
                                            }
                                            )
                                          </th>
                                          <th style={{ width: '5%' }}></th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {batches
                                          .filter((b) => b.material_id === m.id)
                                          .sort(
                                            (a, b) =>
                                              new Date(a.date).getTime() -
                                              new Date(b.date).getTime()
                                          )
                                          .map((batch) => {
                                            const currentTotalPurchaseCost = isDimensional
                                              ? batch.entry_mode === 'pieza'
                                                ? batch.unit_cost
                                                : batch.unit_cost * batch.initial_quantity
                                              : batch.unit_cost * batch.initial_quantity;

                                            const currentCostPerM2 =
                                              isDimensional && batch.area && batch.area > 0
                                                ? currentTotalPurchaseCost / batch.area
                                                : 0;

                                            return (
                                              <tr key={batch.id}>
                                                <td
                                                  className="text-small tabular"
                                                  style={{ fontWeight: 500 }}
                                                >
                                                  {batch.date.includes('T')
                                                    ? batch.date.split('T')[0]
                                                    : batch.date}
                                                </td>

                                                <td>
                                                  {isDimensional ? (
                                                    <span
                                                      className="text-small"
                                                      style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--space-4)',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        color:
                                                          batch.entry_mode === 'pieza'
                                                            ? 'var(--state-warning)'
                                                            : 'var(--state-success)',
                                                      }}
                                                    >
                                                      {batch.entry_mode === 'pieza' ? (
                                                        <Scissors size={11} />
                                                      ) : (
                                                        <RotateCcw size={11} />
                                                      )}
                                                      {batch.entry_mode || 'Rollo'}
                                                    </span>
                                                  ) : (
                                                    <span
                                                      className="text-small text-muted"
                                                      style={{
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                      }}
                                                    >
                                                      Estándar
                                                    </span>
                                                  )}
                                                </td>

                                                <td
                                                  className="text-small"
                                                  style={{
                                                    fontWeight: 500,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                  }}
                                                  title={batch.provider}
                                                >
                                                  {batch.provider}
                                                </td>

                                                <td style={{ textAlign: 'right' }}>
                                                  <span
                                                    className="text-small tabular"
                                                    style={{
                                                      fontWeight: 500,
                                                      color: 'var(--text-primary)',
                                                      display: 'block',
                                                    }}
                                                  >
                                                    {isDimensional
                                                      ? batch.entry_mode === 'pieza'
                                                        ? `${batch.length} × ${batch.width} cm`
                                                        : `${batch.initial_quantity.toFixed(2)} ${unitsOfMeasure.find(
                                                          (u) => u.id === batch.received_unit_id
                                                        )?.symbol || 'm'
                                                        }`
                                                      : `${batch.initial_quantity.toFixed(2)} ${unitsOfMeasure.find(
                                                        (u) => u.id === batch.received_unit_id
                                                      )?.symbol || ''
                                                      }`}
                                                  </span>

                                                  {isDimensional && (
                                                    <span
                                                      className="text-small text-muted"
                                                      style={{ display: 'block' }}
                                                    >
                                                      {batch.width} cm ancho
                                                    </span>
                                                  )}
                                                </td>

                                                {isDimensional && (
                                                  <>
                                                    <td
                                                      className="align-right text-small tabular"
                                                      style={{
                                                        fontWeight: 500,
                                                        color: 'var(--state-success)',
                                                      }}
                                                    >
                                                      {batch.area
                                                        ? `${batch.area.toFixed(2)} m²`
                                                        : '---'}
                                                    </td>

                                                    <td
                                                      className="align-right text-small tabular"
                                                      style={{
                                                        fontWeight: 500,
                                                        color: 'var(--text-secondary)',
                                                      }}
                                                    >
                                                      {currentCostPerM2 > 0
                                                        ? formatCurrency(currentCostPerM2)
                                                        : '---'}
                                                    </td>
                                                  </>
                                                )}

                                                <td
                                                  className="align-right text-small tabular"
                                                  style={{ fontWeight: 500 }}
                                                >
                                                  {formatCurrency(currentTotalPurchaseCost)}
                                                </td>

                                                <td style={{ textAlign: 'right' }}>
                                                  <Badge
                                                    variant={
                                                      batch.remaining_quantity > 0
                                                        ? 'success'
                                                        : 'neutral'
                                                    }
                                                  >
                                                    {UnitConverter.formatFromBase(
                                                      (batch as any).base_remaining_quantity ??
                                                      batch.remaining_quantity,
                                                      unitsOfMeasure.find(
                                                        (u) =>
                                                          u.id ===
                                                          (m.display_unit_id || m.base_unit_id)
                                                      ) || {
                                                        symbol: '',
                                                        conversion_factor: 1,
                                                      }
                                                    )}
                                                  </Badge>
                                                </td>

                                                <td style={{ textAlign: 'center' }}>
                                                  <button
                                                    data-kebab-trigger
                                                    className="btn-ghost btn-sm"
                                                    onClick={(e) => openBatchMenu(batch.id, e)}
                                                    aria-label="Opciones de lote"
                                                  >
                                                    <MoreVertical size={14} />
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}

                                        <tr
                                          style={{
                                            background: 'var(--surface-muted)',
                                            borderTop: '2px solid var(--border-color-default)',
                                          }}
                                        >
                                          <td
                                            colSpan={isDimensional ? 4 : 3}
                                            style={{
                                              padding: 'var(--space-12) var(--space-16)',
                                              fontWeight: 700,
                                              fontSize: 'var(--text-small-size)',
                                              textTransform: 'uppercase',
                                            }}
                                          >
                                            Total
                                          </td>

                                          {isDimensional && (
                                            <>
                                              <td
                                                className="align-right text-small tabular"
                                                style={{
                                                  fontWeight: 700,
                                                  color: 'var(--state-success)',
                                                }}
                                              >
                                                {(batchStatsByMaterial[m.id]?.totalArea || 0).toFixed(2)} m²
                                              </td>

                                              <td
                                                className="align-right text-small tabular"
                                                style={{ fontWeight: 700 }}
                                              >
                                                {(batchStatsByMaterial[m.id]?.totalArea || 0) > 0
                                                  ? formatCurrency(
                                                    (batchStatsByMaterial[m.id]?.totalValue || 0) /
                                                    (batchStatsByMaterial[m.id]?.totalArea || 1)
                                                  )
                                                  : '---'}
                                              </td>
                                            </>
                                          )}

                                          <td
                                            className="align-right text-small tabular"
                                            style={{
                                              fontWeight: 700,
                                              color: 'var(--text-primary)',
                                            }}
                                          >
                                            {formatCurrency(batchStatsByMaterial[m.id]?.totalValue || 0)}
                                          </td>

                                          <td
                                            className="align-right text-small tabular"
                                            style={{
                                              fontWeight: 700,
                                              color: 'var(--state-success)',
                                            }}
                                          >
                                            {UnitConverter.formatFromBase(
                                              batchStatsByMaterial[m.id]?.totalRemainingQty || 0,
                                              unitsOfMeasure.find(
                                                (u) => u.id === (m.display_unit_id || m.base_unit_id)
                                              ) || {
                                                symbol: '',
                                                conversion_factor: 1,
                                              }
                                            )}
                                          </td>

                                          <td></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva / Editar Material */}
      {isModalOpen && (
        <div className="modal-overlay">
          <Card style={{ width: '100%', maxWidth: '36rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3
              style={{
                fontSize: 'var(--text-h2-size)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-24)',
              }}
            >
              {editingId ? 'Editar' : 'Nueva'} Materia Prima
            </h3>

            <form
              onSubmit={handleMasterSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}
            >
              <Input
                label="Nombre"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Tela de Corazón"
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
                <Select
                  label="Tipo / Categoría"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {materialTypes.length > 0 ? (
                    materialTypes.map((t: any) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Tela">Tela</option>
                      <option value="Hilo">Hilo</option>
                      <option value="Herrajes">Herrajes</option>
                      <option value="Accesorios">Accesorios</option>
                      <option value="Otros">Otros</option>
                    </>
                  )}
                </Select>

                <SupplierCombobox
                  value={formData.provider}
                  onChange={(name) => setFormData({ ...formData, provider: name })}
                  placeholder="Buscar o crear proveedor..."
                />
              </div>

              <Input
                label="Descripción"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles de la materia prima..."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
                <Select
                  label="Categoría Universal"
                  value={formData.category_id}
                  onChange={(e) => {
                    const catId = e.target.value;
                    const baseUnit = unitsOfMeasure.find((u) => u.category_id === catId && u.is_base);
                    const largestUnit = unitsOfMeasure
                      .filter((u) => u.category_id === catId)
                      .sort((a, b) => b.conversion_factor - a.conversion_factor)[0];

                    const purchaseDisplayUnit = largestUnit || baseUnit;

                    setFormData({
                      ...formData,
                      category_id: catId,
                      base_unit_id: baseUnit?.id || '',
                      purchase_unit_id: purchaseDisplayUnit?.id || '',
                      display_unit_id: purchaseDisplayUnit?.id || '',
                    });
                  }}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {uomCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>

                {formData.category_id && (() => {
                  const selectedUnit = unitsOfMeasure
                    .filter((u) => u.category_id === formData.category_id)
                    .sort((a, b) => b.conversion_factor - a.conversion_factor)[0];

                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        className="input"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-8)',
                          color: 'var(--text-secondary)',
                          cursor: 'default',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          {selectedUnit?.symbol?.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                        <span>{selectedUnit?.name}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div
                style={{
                  borderTop: 'var(--border-default)',
                  paddingTop: 'var(--space-16)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-12)',
                }}
              >
                {editingId ? (
                  <>
                    <div>
                      <label className="field-label">Costo Unitario (€)</label>
                      <div
                        className="input"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          cursor: 'default',
                        }}
                      >
                        {formatCurrency(editReadOnlyUnitCost)}
                      </div>
                    </div>

                    <div>
                      <label className="field-label">Valor total inventario (€)</label>
                      <div
                        className="input"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          cursor: 'default',
                        }}
                      >
                        {formatCurrency(editReadOnlyInvoiceCost)}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', marginTop: 'var(--space-4)' }}>
                      <p className="text-small text-muted" style={{ marginBottom: 'var(--space-8)' }}>
                        Los costos se gestionan por lote (FIFO).
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleOpenBatchCostEditor}
                      >
                        Editar costo en lote
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="field-label">Costo Unitario (€)</label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.unitCost || ''}
                        onChange={(e) => {
                          const uc = parseFloat(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            unitCost: uc,
                            totalCost: (formData.initialQty || 0) * uc,
                          });
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="field-label">Costo Factura (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.totalCost || ''}
                        onChange={(e) => {
                          const total = parseFloat(e.target.value) || 0;
                          const uc =
                            (formData.initialQty || 0) > 0
                              ? total / (formData.initialQty || 0)
                              : 0;

                          setFormData({
                            ...formData,
                            totalCost: total,
                            unitCost: uc,
                          });
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-12)',
                  alignItems: 'flex-end',
                }}
              >
                {formData.type === 'Tela' ? (
                  <Input
                    label="Ancho (cm)"
                    type="number"
                    step="1"
                    value={formData.width || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        width: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="140"
                  />
                ) : (
                  <div />
                )}

                <Input
                  label="Cantidad Inicial"
                  type="number"
                  step="0.01"
                  value={formData.initialQty || ''}
                  onChange={(e) => {
                    const qty = parseFloat(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      initialQty: qty,
                      totalCost: qty * (formData.unitCost || 0),
                    });
                  }}
                  placeholder="0"
                  disabled={!!editingId}
                />

                <div>
                  <label className="field-label">Estado</label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        status: formData.status === 'activa' ? 'inactiva' : 'activa',
                      })
                    }
                    className={`badge ${formData.status === 'activa' ? 'badge-success' : 'badge-neutral'}`}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      height: '2.5rem',
                      cursor: 'pointer',
                      fontSize: 'var(--text-small-size)',
                    }}
                  >
                    <span
                      style={{
                        width: '0.625rem',
                        height: '0.625rem',
                        borderRadius: '50%',
                        background: 'currentColor',
                        flexShrink: 0,
                        opacity: 0.6,
                      }}
                    />
                    {formData.status === 'activa' ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-12)', paddingTop: 'var(--space-8)' }}>
                <Button
                  type="button"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setFormData(getEmptyFormData());
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  style={{ flex: 1 }}
                  variant="primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando...' : 'Guardar Material'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Editar Lote */}
      {editingBatchData && (
        <div className="modal-overlay">
          <Card style={{ width: '100%', maxWidth: '28rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-8)',
                fontSize: 'var(--text-h3-size)',
                fontWeight: 600,
                marginBottom: 'var(--space-24)',
              }}
            >
              <Pencil size={18} style={{ color: 'var(--text-muted)' }} />
              Editar Registro
            </h4>

            <form
              onSubmit={handleEditBatchSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}
            >
              {editingBatchData.remaining_quantity < editingBatchData.initial_quantity && (
                <div
                  className="alert alert-warning"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)' }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-small-size)',
                      lineHeight: 1.5,
                    }}
                  >
                    ESTE LOTE YA SE HA USADO. La cantidad, costo y dimensiones no son editables
                    para mantener la coherencia FIFO.
                  </p>
                </div>
              )}

              <Input
                label="Fecha"
                type="date"
                value={editingBatchData.date}
                onChange={(e) =>
                  setEditingBatchData({ ...editingBatchData, date: e.target.value })
                }
                required
              />

              <SupplierCombobox
                label="Proveedor / Referencia"
                value={editingBatchData.provider}
                onChange={(name) =>
                  setEditingBatchData({ ...editingBatchData, provider: name })
                }
              />

              {editingBatchIsDimensional ? (
                editingBatchData.entry_mode === 'pieza' ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-12)',
                    }}
                  >
                    <Input
                      label="Largo (cm)"
                      type="number"
                      step="0.01"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.length || ''}
                      onChange={(e) =>
                        setEditingBatchData({
                          ...editingBatchData,
                          length: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <Input
                      label="Ancho (cm)"
                      type="number"
                      step="1"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.width || ''}
                      onChange={(e) =>
                        setEditingBatchData({
                          ...editingBatchData,
                          width: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-12)',
                    }}
                  >
                    <Input
                      label="M. Lineales"
                      type="number"
                      step="0.01"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.initial_quantity}
                      onChange={(e) =>
                        setEditingBatchData({
                          ...editingBatchData,
                          initial_quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <Input
                      label="Ancho (cm)"
                      type="number"
                      step="1"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.width || ''}
                      onChange={(e) =>
                        setEditingBatchData({
                          ...editingBatchData,
                          width: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )
              ) : (
                <Input
                  label={`Cantidad (${editingBatchUnitSymbol})`}
                  type="number"
                  step="0.01"
                  disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                  value={editingBatchData.initial_quantity}
                  onChange={(e) =>
                    setEditingBatchData({
                      ...editingBatchData,
                      initial_quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              )}

              <Input
                label={
                  !editingBatchIsDimensional
                    ? 'Costo Unitario (€)'
                    : editingBatchData.entry_mode === 'pieza'
                      ? 'Costo Total (€)'
                      : 'Costo Unitario (€/m)'
                }
                type="number"
                step="0.01"
                disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                value={editingBatchData.unit_cost}
                onChange={(e) =>
                  setEditingBatchData({
                    ...editingBatchData,
                    unit_cost: parseFloat(e.target.value) || 0,
                  })
                }
              />

              <div style={{ display: 'flex', gap: 'var(--space-12)', paddingTop: 'var(--space-16)' }}>
                <Button
                  type="button"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onClick={() => setEditingBatchData(null)}
                >
                  Cancelar
                </Button>

                <Button type="submit" style={{ flex: 1 }} variant="primary" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Kebab material */}
      {menuState &&
        (() => {
          const material = rawMaterials.find((m) => m.id === menuState.materialId);
          if (!material) return null;

          const { rect } = menuState;
          const menuHeight = 164;
          const openUpward = rect.bottom + menuHeight > window.innerHeight;

          const style: React.CSSProperties = {
            ...dropdownStyle,
            position: 'fixed',
            right: window.innerWidth - rect.right,
            zIndex: 9999,
            ...(openUpward
              ? { bottom: window.innerHeight - rect.top + 4 }
              : { top: rect.bottom + 4 }),
          };

          const stats = batchStatsByMaterial[material.id] || {
            totalOriginalQty: 0,
            totalRemainingQty: 0,
            totalValue: 0,
            weightedAvgCost: 0,
            totalArea: 0,
            avgCostPerM2: 0,
            debtQty: 0,
          };

          const hasLinkedProducts = products.some((p) =>
            (p.materials ?? []).some((pm: any) => pm.material_id === material.id)
          );

          const mustArchive = hasLinkedProducts || stats.totalRemainingQty > 0;
          const archiveReason = hasLinkedProducts
            ? 'Vinculada a productos activos'
            : 'Tiene stock físico con valor en libro';

          return (
            <div ref={menuRef} style={style}>
              <button
                style={dropdownBtn}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  setMenuState(null);
                  setExpandedMaterialId(expandedMaterialId === material.id ? null : material.id);
                }}
              >
                <History size={14} style={{ color: 'var(--text-muted)' }} />
                {expandedMaterialId === material.id ? 'Cerrar Detalles' : 'Ver Lotes'}
              </button>

              <div style={{ borderTop: 'var(--border-default)', margin: 'var(--space-4) 0' }} />

              {canEdit && (
                <button
                  style={dropdownBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setMenuState(null);
                    setEditingId(material.id);
                    setFormData({
                      name: material.name,
                      description: material.description || '',
                      type: material.type,
                      category_id: material.category_id || '',
                      base_unit_id: material.base_unit_id || '',
                      purchase_unit_id: material.purchase_unit_id || '',
                      display_unit_id: material.display_unit_id || '',
                      provider: material.provider || '',
                      status: (material.status as 'activa' | 'inactiva') || 'activa',
                      initialQty: stats.totalRemainingQty,
                      unitCost: stats.weightedAvgCost,
                      totalCost: stats.totalRemainingQty * stats.weightedAvgCost,
                      width: 140,
                      unit: material.unit,
                    });
                    setIsModalOpen(true);
                  }}
                >
                  <Edit2 size={14} style={{ color: 'var(--text-muted)' }} />
                  Editar Material
                </button>
              )}

              {canDelete &&
                (mustArchive ? (
                  <button
                    style={{ ...dropdownBtn, color: 'var(--state-warning)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--surface-warning-soft)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={async () => {
                      setMenuState(null);

                      if (window.confirm(`¿Archivar "${material.name}"? Razón: ${archiveReason}.`)) {
                        try {
                          await archiveMaterial(material.id);
                        } catch (err: any) {
                          alert(`Error: ${translateError(err)}`);
                        }
                      }
                    }}
                  >
                    <Archive size={14} />
                    Archivar Insumo
                  </button>
                ) : (
                  <button
                    style={{ ...dropdownBtn, color: 'var(--state-danger)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--surface-danger-soft)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={async () => {
                      setMenuState(null);

                      if (
                        window.confirm(
                          `¿Eliminar "${material.name}"? Sin stock ni productos vinculados.`
                        )
                      ) {
                        try {
                          await deleteRawMaterial(material.id);
                        } catch (err: any) {
                          alert(`No se pudo eliminar: ${translateError(err)}`);
                        }
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    Eliminar Insumo
                  </button>
                ))}
            </div>
          );
        })()}

      {/* Kebab lote */}
      {batchMenuState &&
        (() => {
          const batch = batches.find((b) => b.id === batchMenuState.batchId);
          if (!batch) return null;

          const { rect } = batchMenuState;
          const openUpward = rect.bottom + 100 > window.innerHeight;

          const style: React.CSSProperties = {
            ...dropdownStyle,
            position: 'fixed',
            right: window.innerWidth - rect.right,
            zIndex: 9999,
            ...(openUpward
              ? { bottom: window.innerHeight - rect.top + 4 }
              : { top: rect.bottom + 4 }),
          };

          return (
            <div ref={batchMenuRef} style={style}>
              {canEdit && (
                <button
                  style={dropdownBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setBatchMenuState(null);
                    setEditingBatchData({
                      ...batch,
                      date: normalizeDateForInput(batch.date) || getToday(),
                    });
                  }}
                >
                  <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                  Editar Lote
                </button>
              )}

              {canDelete && (
                <button
                  style={{ ...dropdownBtn, color: 'var(--state-danger)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--surface-danger-soft)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={async () => {
                    setBatchMenuState(null);

                    if (window.confirm('¿Eliminar este lote? Afectará el costeo FIFO.')) {
                      try {
                        await deleteBatch(batch.id);
                      } catch (err: any) {
                        alert(`Error: ${translateError(err)}`);
                      }
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar Lote
                </button>
              )}
            </div>
          );
        })()}
    </PageContainer>
  );
};

export default RawMaterials;
