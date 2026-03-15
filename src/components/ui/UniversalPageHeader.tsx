import React, { ReactNode } from 'react';

// UniversalPageHeader consume clases CSS de global.css exclusivamente.
// No usar tokens como clases Tailwind ni valores hardcodeados aquí.

export interface UniversalPageHeaderProps {
    /** Título principal de la página */
    title: string;
    /** Ruta de breadcrumbs (e.g. BETO OS / Módulo / Vista) */
    breadcrumbs?: ReactNode;
    /** Items de metadata debajo del título */
    metadata?: ReactNode[];
    /** Indicador de estado semántico */
    status?: ReactNode;
    /** Acciones principales */
    actions?: ReactNode;
}

export const UniversalPageHeader: React.FC<UniversalPageHeaderProps> = ({
    title,
    breadcrumbs,
    metadata = [],
    status,
    actions,
}) => {
    return (
        <header style={{
            width: '100%',
            marginBottom: 'var(--space-24)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
        }}>

            {/* Breadcrumbs */}
            {breadcrumbs && (
                <nav className="breadcrumbs">
                    {breadcrumbs}
                </nav>
            )}

            {/* Fila principal — título + acciones */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-16)',
                flexWrap: 'wrap',
            }}>
                {/* Izquierda — título y metadata */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-8)',
                    minWidth: 0,
                }}>
                    <h1 className="text-h1" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {title}
                    </h1>

                    {/* Metadata strip + status */}
                    {(metadata.length > 0 || status) && (
                        <div className="text-small text-secondary" style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 'var(--space-8)',
                        }}>
                            {metadata.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <span style={{ whiteSpace: 'nowrap' }}>
                                        {item}
                                    </span>
                                    {(idx < metadata.length - 1 || status) && (
                                        <span className="text-muted" aria-hidden="true">•</span>
                                    )}
                                </React.Fragment>
                            ))}
                            {status && (
                                <span style={{ whiteSpace: 'nowrap' }}>
                                    {status}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Derecha — acciones */}
                {actions && (
                    <div className="row" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
};