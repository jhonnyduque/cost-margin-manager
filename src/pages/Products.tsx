import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  PlayCircle,
  Layers,
  X,
  History,
  Copy,
  Printer,
  Archive,
  MoreVertical,
} from 'lucide-react';
import {
  useStore,
  calculateProductCost,
  calculateProductStock,
} from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { Product, DEFAULT_TARGET_MARGIN } from '@/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useCurrency } from '@/hooks/useCurrency';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

// Kebab dropdown styles — usa variables CSS del sistema
const dropdownStyle: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: 'var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  paddingTop: 'var(--space-4)',
  paddingBottom: 'var(--space-4)',
  minWidth: '11rem',
};

const dropdownBtnBase: React.CSSProperties = {
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

const Products: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUserRole,
    products,
    productMovements,
    rawMaterials,
    batches,
    unitsOfMeasure,
    deleteProduct,
    discontinueProduct,
  } = useStore();

  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canManage = allowedRoles.includes((currentUserRole as string) || '');
  const canCreate = canManage;

  const { formatCurrency } = useCurrency();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'activa' | 'inactiva' | 'todos'>('activa');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuState, setMenuState] = useState<{ productId: string; rect: DOMRect } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.reference.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((p) => (statusFilter === 'todos' ? true : (p.status || 'activa') === statusFilter));

  const handleDuplicate = (product: Product) =>
    navigate('/productos/nuevo', { state: { duplicateFrom: product } });

  const handlePrint = () => window.print();

  useEffect(() => {
    if (!menuState) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-kebab-trigger]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuState(null);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuState]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    selectedIds.size === filteredProducts.length
      ? setSelectedIds(new Set())
      : setSelectedIds(new Set(filteredProducts.map((p) => p.id)));

  const handleBatchDiscontinue = async () => {
    if (!confirm(`¿Discontinuar ${selectedIds.size} producto(s)?`)) return;
    for (const id of selectedIds) {
      try {
        await discontinueProduct(id);
      } catch (e) {
        console.error(e);
      }
    }
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} producto(s)? Esta acción es irreversible.`)) return;
    const errors: string[] = [];

    for (const id of selectedIds) {
      try {
        await deleteProduct(id);
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    if (errors.length > 0) {
      alert(`No se pudieron eliminar algunos productos:\n${errors.join('\n')}`);
    }

    setSelectedIds(new Set());
  };

  const handleDiscontinue = async (id: string) => {
    setMenuState(null);
    if (!confirm('¿Discontinuar este producto?')) return;
    try {
      await discontinueProduct(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    setMenuState(null);
    if (!confirm('¿Eliminar este producto? Esta acción es irreversible.')) return;
    try {
      await deleteProduct(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openMenu = (productId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuState?.productId === productId) {
      setMenuState(null);
      return;
    }
    setMenuState({ productId, rect: e.currentTarget.getBoundingClientRect() });
  };

  return (
    <PageContainer>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #print-area,
          #print-area * {
            visibility: visible;
          }

          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <SectionBlock>
        <UniversalPageHeader
          title="Catálogo de Productos"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Productos
              </span>
            </>
          }
          metadata={[
            <span key="1">Gestión de Escandallos (Costos FIFO)</span>,
            <span key="2">{products.length} productos registrados</span>,
          ]}
          actions={
            canCreate && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => navigate('/materias-primas')}
                  icon={<Layers size={16} />}
                >
                  <span className="hidden sm:inline">NUEVO INSUMO</span>
                </Button>

                <Button
                  variant="primary"
                  onClick={() => navigate('/productos/nuevo')}
                  icon={<Plus size={16} />}
                >
                  <span className="hidden sm:inline">NUEVO PRODUCTO</span>
                </Button>
              </>
            )
          }
        />

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
              gridTemplateColumns: 'minmax(0, 1fr) auto auto',
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
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
                style={{ paddingLeft: 'var(--space-48)', width: '100%' }}
              />
            </div>

            <Select
              style={{ width: '12rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="activa">Solo Activos</option>
              <option value="inactiva">Discontinuados</option>
              <option value="todos">Todos los productos</option>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              title="Imprimir Catálogo"
              icon={<Printer size={18} />}
              style={{ flexShrink: 0 }}
            />
          </div>
        </div>
      </SectionBlock>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-16)',
          marginTop: 'var(--space-32)',
        }}
      >
        {/* Móvil — Cards */}
        <div
          className="cards-mobile"
          style={{
            flexDirection: 'column',
            gap: 'var(--space-16)',
          }}
        >
          {filteredProducts.map((p) => {
            const cost = calculateProductCost(p, batches, rawMaterials, unitsOfMeasure);
            const metrics = calculateFinancialMetrics(
              cost,
              p.price,
              (p.target_margin ?? DEFAULT_TARGET_MARGIN) / 100
            );
            const marginOk =
              metrics.realMargin >= (p.target_margin ?? DEFAULT_TARGET_MARGIN) / 100;

            return (
              <Card key={p.id}>
                <Card.Header>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-12)',
                      flex: 1,
                      minWidth: 0,
                    }}
                    onClick={() => navigate(`/productos/detalle/${p.id}`)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelect(p.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 4, flexShrink: 0, accentColor: 'var(--state-primary)' }}
                      aria-label={`Seleccionar ${p.name}`}
                    />

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
                        {p.name}
                      </h3>
                      <p className="text-small text-muted">{p.reference || 'SIN REF'}</p>
                    </div>
                  </div>

                  <span
                    className={marginOk ? 'text-success' : 'text-warning'}
                    style={{
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {(metrics.realMargin * 100).toFixed(1)}%
                  </span>
                </Card.Header>

                <Card.Content>
                  <div
                    className="inset-card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 'var(--space-16)',
                    }}
                  >
                    <div>
                      <span
                        className="text-small text-muted"
                        style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block' }}
                      >
                        Stock
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {calculateProductStock(p.id, productMovements)}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <span
                        className="text-small text-muted"
                        style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block' }}
                      >
                        Costo FIFO
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(cost)}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="text-small text-muted"
                        style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block' }}
                      >
                        Precio
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatCurrency(p.price)}
                      </span>
                    </div>
                  </div>
                </Card.Content>

                <Card.Footer>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      data-kebab-trigger
                      className="btn-ghost btn-sm"
                      onClick={(e) => openMenu(p.id, e as any)}
                      aria-label="Más opciones"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </Card.Footer>
              </Card>
            );
          })}
        </div>

        {/* Escritorio — Tabla */}
        <div id="print-area" className="table-responsive-wrap">
          <div
            style={{
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-xl)',
              border: 'var(--border-default)',
              overflow: 'hidden',
            }}
          >
            <table className="table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '3rem' }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedIds.size === filteredProducts.length
                      }
                      onChange={toggleSelectAll}
                      style={{ accentColor: 'var(--state-primary)' }}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th style={{ width: '22%' }}>Producto</th>
                  <th style={{ width: '14%' }}>Referencia / SKU</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Stock</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Costo (FIFO)</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Precio Venta</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Margen</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((p) => {
                  const cost = calculateProductCost(p, batches, rawMaterials, unitsOfMeasure);
                  const metrics = calculateFinancialMetrics(
                    cost,
                    p.price,
                    (p.target_margin ?? DEFAULT_TARGET_MARGIN) / 100
                  );
                  const marginOk =
                    metrics.realMargin >= (p.target_margin ?? DEFAULT_TARGET_MARGIN) / 100;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: selectedIds.has(p.id)
                          ? 'var(--surface-page)'
                          : 'var(--surface-card)',
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          style={{ accentColor: 'var(--state-primary)' }}
                          aria-label={`Seleccionar ${p.name}`}
                        />
                      </td>

                      <td
                        style={{
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textTransform: 'capitalize',
                        }}
                        title={p.name}
                        onClick={() => navigate(`/productos/detalle/${p.id}`)}
                      >
                        {p.name}
                      </td>

                      <td
                        className="text-small tabular"
                        style={{
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={p.reference || '---'}
                      >
                        {p.reference || '---'}
                      </td>

                      <td className="align-right" style={{ fontWeight: 700 }}>
                        {calculateProductStock(p.id, productMovements)}
                      </td>

                      <td
                        className="align-right"
                        style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                      >
                        {formatCurrency(cost)}
                      </td>

                      <td className="align-right" style={{ fontWeight: 700 }}>
                        {formatCurrency(p.price)}
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: marginOk ? 'var(--state-success)' : 'var(--state-warning)',
                        }}
                      >
                        {(metrics.realMargin * 100).toFixed(1)}%
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          data-kebab-trigger
                          style={{
                            borderRadius: 'var(--radius-md)',
                            border:
                              menuState?.productId === p.id
                                ? 'var(--border-default)'
                                : '1px solid transparent',
                            padding: 'var(--space-8)',
                            transition: 'all var(--transition-fast)',
                            color:
                              menuState?.productId === p.id
                                ? 'var(--text-primary)'
                                : 'var(--text-muted)',
                            background:
                              menuState?.productId === p.id
                                ? 'var(--surface-muted)'
                                : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => openMenu(p.id, e)}
                          aria-label="Más opciones"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Kebab dropdown */}
      {menuState &&
        (() => {
          const product = products.find((pp) => pp.id === menuState.productId);
          if (!product) return null;

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

          return (
            <div ref={menuRef} style={style}>
              <button
                style={dropdownBtnBase}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  setMenuState(null);
                  navigate(`/productos/detalle/${product.id}`);
                }}
              >
                <History size={14} style={{ color: 'var(--text-muted)' }} />
                Ver Historial
              </button>

              <div style={{ borderTop: 'var(--border-default)', margin: 'var(--space-4) 0' }} />

              <button
                style={dropdownBtnBase}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  setMenuState(null);
                  navigate(`/produccion?productId=${product.id}`);
                }}
              >
                <PlayCircle size={14} style={{ color: 'var(--state-success)' }} />
                Producir
              </button>

              <button
                style={dropdownBtnBase}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  setMenuState(null);
                  navigate(`/productos/editar/${product.id}`);
                }}
              >
                <Edit2 size={14} style={{ color: 'var(--text-muted)' }} />
                Editar
              </button>

              {canCreate && (
                <button
                  style={dropdownBtnBase}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setMenuState(null);
                    handleDuplicate(product);
                  }}
                >
                  <Copy size={14} style={{ color: 'var(--text-muted)' }} />
                  Duplicar
                </button>
              )}

              {product.status === 'activa' && (
                <button
                  style={dropdownBtnBase}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-page)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleDiscontinue(product.id)}
                >
                  <Archive size={14} style={{ color: 'var(--text-muted)' }} />
                  Discontinuar
                </button>
              )}

              <div style={{ borderTop: 'var(--border-default)', margin: 'var(--space-4) 0' }} />

              <button
                style={{ ...dropdownBtnBase, color: 'var(--state-danger)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--surface-danger-soft)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => handleDelete(product.id)}
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </div>
          );
        })()}

      {/* Batch toolbar */}
      {selectedIds.size > 0 && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: '0 0 auto 0',
            bottom: 0,
            zIndex: 50,
            borderTop: 'var(--border-default)',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            style={{
              maxWidth: 'var(--container-xl)',
              margin: '0 auto',
              padding: 'var(--space-12) var(--space-24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-12)',
              }}
            >
              <input type="checkbox" checked readOnly style={{ accentColor: 'var(--state-primary)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-8)',
              }}
            >
              <Button variant="secondary" size="sm" onClick={handleBatchDiscontinue}>
                <Archive size={14} style={{ marginRight: 4 }} />
                Discontinuar
              </Button>

              <Button variant="ghost" size="sm" onClick={handlePrint} title="Imprimir">
                <Printer size={16} />
              </Button>

              <Button variant="danger" size="sm" onClick={handleBatchDelete}>
                <Trash2 size={14} style={{ marginRight: 4 }} />
                Eliminar
              </Button>

              <button
                className="btn-ghost btn-sm"
                style={{ marginLeft: 'var(--space-8)' }}
                onClick={() => setSelectedIds(new Set())}
                aria-label="Deseleccionar"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default Products;
