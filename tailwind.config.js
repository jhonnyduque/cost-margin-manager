/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        // We do NOT use 'extend' for spacing and fontSize. 
        // We override them to FORBID the use of unauthorized sizes like text-[9px] or p-7.
        fontSize: {
            'display': ['32px', { lineHeight: '1.2', fontWeight: '800' }],
            'h1': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
            'h2': ['13px', { letterSpacing: '0.04em', fontWeight: '700' }],
            'body': ['14px', { lineHeight: '1.5', fontWeight: '500' }],
            'label': ['12px', { letterSpacing: '0.02em', fontWeight: '600' }],
            'caption': ['11px', { fontWeight: '500' }],
            // Standard Tailwind utilities mapped to design tokens
            'xs': ['12px', { lineHeight: '1rem' }],
            'sm': ['13px', { lineHeight: '1.25rem' }],
            'base': ['14px', { lineHeight: '1.5rem' }],
            'lg': ['16px', { lineHeight: '1.75rem' }],
            'xl': ['24px', { lineHeight: '2rem' }],
            '2xl': ['32px', { lineHeight: '2.5rem' }],
        },
        spacing: {
            '0': '0px',
            'px': '1px',
            '0.5': '2px',
            '1': '4px',
            '1.5': '6px',
            '2': '8px',
            '3': '12px',
            '4': '16px',
            '5': '20px',
            '6': '24px',
            '7': '28px',
            '8': '32px',
            '9': '36px',
            '10': '40px',
            '11': '44px',
            '12': '48px',
            '16': '64px',
            '20': '80px',
            '64': '256px',
            full: '100%',
            screen: '100vw',
        },
        extend: {
            colors: {
                text: {
                    primary: '#0F172A',
                    secondary: '#475569',
                    muted: '#94A3B8'
                },
                brand: '#2563EB',
                bg: {
                    page: '#F8FAFC',
                    card: '#FFFFFF',
                },
                success: '#059669',
                warning: '#F59E0B',
                error: '#EF4444',
                border: {
                    DEFAULT: '#E2E8F0',
                }
            },
            borderRadius: {
                xs: '2px',
                sm: '4px',   // Fine details
                md: '6px',   // Buttons, Inputs (Rectangular look)
                lg: '10px',  // Cards
                xl: '16px',  // Large modals
                full: '9999px'
            },
            boxShadow: {
                subtle: '0 1px 3px rgba(0,0,0,0.06)',
                elevated: '0 12px 28px rgba(0,0,0,0.08)'
            }
        },
    },
    plugins: [],
}
