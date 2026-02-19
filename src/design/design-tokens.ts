export const tokens = {
    colors: {
        brand: '#2563EB',
        bg: '#F8FAFC',
        surface: '#FFFFFF',

        text: {
            primary: '#0F172A',
            secondary: '#64748B',
            muted: '#94A3B8'
        },

        border: '#E2E8F0',

        // Status colors - explicitly adding these as they are essential for SaaS
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
    },

    radius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        full: '9999px'
    },

    shadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.06)',
        elevated: '0 12px 28px rgba(0,0,0,0.08)'
    },

    spacing: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px'
    },

    typography: {
        titleLg: {
            fontSize: '1.875rem', // 30px
            fontWeight: 600,
            lineHeight: '2.25rem',
        },
        titleMd: {
            fontSize: '1.25rem', // 20px
            fontWeight: 600,
            lineHeight: '1.75rem',
        },
        body: {
            fontSize: '0.875rem', // 14px
            fontWeight: 500,
            lineHeight: '1.25rem',
        },
        caption: {
            fontSize: '0.75rem', // 12px
            fontWeight: 400,
            color: '#64748B', // text-slate-500
            lineHeight: '1rem',
        }
    }
};
