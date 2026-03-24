import React from 'react';

// LayoutPrimitives consume variables CSS de global.css exclusivamente.
// No usar tokens de spacing como clases Tailwind — generan clases dinámicas
// que Tailwind no puede purgar y causan inconsistencias.

/**
 * PageContainer
 * Padding y max-width estándar para todas las páginas.
 */
export const PageContainer: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => (
    <div
        className={className}
        style={{
            width: '100%',
            maxWidth: 'var(--container-xl)',
            margin: '0 auto',
            padding: 'var(--space-8) var(--space-32) var(--space-32)',
        }}
    >
        {children}
    </div>
);

/**
 * SectionBlock
 * Espaciado vertical estándar entre secciones del dashboard.
 */
export const SectionBlock: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => (
    <section
        className={`section ${className}`.trim()}
    >
        {children}
    </section>
);

/**
 * CardGrid
 * Grid responsivo para cards basado en el sistema de 12 columnas.
 * cols: 1 | 2 | 3 | 4
 */
export const CardGrid: React.FC<{
    children: React.ReactNode;
    cols?: 1 | 2 | 3 | 4;
    className?: string;
}> = ({ children, cols = 4, className = '' }) => {

    const gridClass: Record<number, string> = {
        1: 'grid',
        2: 'grid grid-2',
        3: 'grid grid-3',
        4: 'grid grid-4',
    };

    return (
        <div className={`${gridClass[cols]} ${className}`.trim()}>
            {children}
        </div>
    );
};