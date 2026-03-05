import React from 'react';
import { spacing } from '@/design/design-tokens';

/**
 * 🧱 PageContainer
 * Standard viewport padding and max-width for all pages.
 */
export const PageContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`w-full mx-auto ${spacing.pLg} md:${spacing.pXl} animate-in fade-in duration-500 ${className}`}>
        {children}
    </div>
);

/**
 * 🧱 SectionBlock
 * Standard vertical spacing between dashboard sections.
 */
export const SectionBlock: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <section className={`flex flex-col ${spacing.xl} ${className}`}>
        {children}
    </section>
);

/**
 * 🧱 CardGrid
 * Responsive grid for cards based on the 8px grid system.
 */
export const CardGrid: React.FC<{
    children: React.ReactNode;
    cols?: 1 | 2 | 3 | 4;
    className?: string;
}> = ({
    children,
    cols = 4,
    className = ''
}) => {
        const gridCols = {
            1: "grid-cols-1",
            2: "grid-cols-1 md:grid-cols-2",
            3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        };

        return (
            <div className={`grid ${gridCols[cols]} ${spacing.lg} ${className}`}>
                {children}
            </div>
        );
    };
