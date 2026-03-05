/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        // Governance Rule: GOV-TYPE-001 (Strict Typography Scale)
        fontSize: {
            'xs': '12px',
            'sm': '14px',
            'base': '16px',
            'lg': '18px',
            'xl': '20px',
            '2xl': '24px',
            '3xl': '30px',
            '4xl': '36px',
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
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
            },
            colors: {
                text: {
                    primary: '#0F172A',
                    secondary: '#475569',
                    muted: '#64748B'
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
