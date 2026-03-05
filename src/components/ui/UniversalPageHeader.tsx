import React, { ReactNode } from 'react';
import { colors, typography, spacing } from '@/design/design-tokens';

export interface UniversalPageHeaderProps {
    /** Main title of the page (e.g. "Control Center") */
    title: string;
    /** Current context path (e.g. BETO OS / Platform / Control Center) */
    breadcrumbs?: ReactNode;
    /** Array of metadata items to display below the title */
    metadata?: ReactNode[];
    /** Semantic status indicator (e.g. "Healthy") */
    status?: ReactNode;
    /** Action buttons group (primary, secondary) */
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
        <header className={`w-full mb-6 flex flex-col gap-4`}>
            {/* 1. Breadcrumbs */}
            {breadcrumbs && (
                <div className={`${typography.text.caption} ${colors.textMuted} flex flex-wrap items-center gap-2`}>
                    {breadcrumbs}
                </div>
            )}

            {/* 2. Main Header Row (Title + Actions) */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 w-full">
                {/* Left Side: Title & Metadata */}
                <div className="flex flex-col gap-2 min-w-0">
                    <h1 className={`${typography.pageTitle} ${colors.textPrimary} truncate`}>
                        {title}
                    </h1>

                    {/* 3 & 4. Metadata Strip and Status */}
                    {(metadata.length > 0 || status) && (
                        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${typography.text.caption} ${colors.textSecondary}`}>
                            {metadata.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <div className="flex items-center whitespace-nowrap">
                                        {item}
                                    </div>
                                    {/* Separator · for all except the last item, unless there's a status */}
                                    {(idx < metadata.length - 1 || status) && (
                                        <span className={colors.textMuted}>&bull;</span>
                                    )}
                                </React.Fragment>
                            ))}

                            {status && (
                                <div className="flex items-center whitespace-nowrap">
                                    {status}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Actions Group */}
                {actions && (
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
};
