import { useAuth } from '@/hooks/useAuth';

export type CurrencyCode = 'USD' | 'EUR' | 'CLP' | 'COP' | 'MXN' | 'ARS' | 'PEN' | 'BRL' | 'GBP';

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; locale: string }[] = [
    { code: 'USD', label: 'Dólar (USD)', symbol: '$', locale: 'en-US' },
    { code: 'EUR', label: 'Euro (EUR)', symbol: '€', locale: 'es-ES' },
    { code: 'CLP', label: 'Peso Chileno (CLP)', symbol: '$', locale: 'es-CL' },
    { code: 'COP', label: 'Peso Colombiano (COP)', symbol: '$', locale: 'es-CO' },
    { code: 'MXN', label: 'Peso Mexicano (MXN)', symbol: '$', locale: 'es-MX' },
    { code: 'ARS', label: 'Peso Argentino (ARS)', symbol: '$', locale: 'es-AR' },
    { code: 'PEN', label: 'Sol Peruano (PEN)', symbol: 'S/', locale: 'es-PE' },
    { code: 'BRL', label: 'Real Brasileño (BRL)', symbol: 'R$', locale: 'pt-BR' },
    { code: 'GBP', label: 'Libra Esterlina (GBP)', symbol: '£', locale: 'en-GB' },
];

/**
 * Hook to get the company's currency and a formatter function.
 * Falls back to 'USD' if no currency is set.
 */
export function useCurrency() {
    const { currentCompany } = useAuth();

    const currencyCode: CurrencyCode = (currentCompany as any)?.currency || 'USD';
    const currencyInfo = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];

    const formatCurrency = (value: number): string => {
        if (isNaN(value) || !isFinite(value)) return `${currencyInfo.symbol} 0.00`;
        return new Intl.NumberFormat(currencyInfo.locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    return {
        currencyCode,
        currencySymbol: currencyInfo.symbol,
        currencyLabel: currencyInfo.label,
        locale: currencyInfo.locale,
        formatCurrency,
    };
}
