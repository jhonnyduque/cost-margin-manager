/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                // Semantic Aliases mapped to Design Tokens
                brand: '#2563EB',   // tokens.colors.brand
                bg: '#F8FAFC',      // tokens.colors.bg
                surface: '#FFFFFF', // tokens.colors.surface
                border: '#E2E8F0',  // tokens.colors.border

                text: {
                    primary: '#0F172A',   // tokens.colors.text.primary
                    secondary: '#64748B', // tokens.colors.text.secondary
                    muted: '#94A3B8'      // tokens.colors.text.muted
                },

                // Status
                success: '#10B981', // tokens.colors.success
                warning: '#F59E0B', // tokens.colors.warning
                error: '#EF4444',   // tokens.colors.error
            },
            borderRadius: {
                sm: '8px',   // tokens.radius.sm
                md: '12px',  // tokens.radius.md
                lg: '20px',  // tokens.radius.lg
                full: '9999px'
            },
            boxShadow: {
                subtle: '0 1px 3px rgba(0,0,0,0.06)',    // tokens.shadow.subtle
                elevated: '0 12px 28px rgba(0,0,0,0.08)' // tokens.shadow.elevated
            }
        },
    },
    plugins: [],
}
