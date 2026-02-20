import { usePlanLimits } from '../hooks/usePlanLimits';

export function LimitIndicator({ manualData }: { manualData?: { currentUsers: number, maxUsers: number, percentageUsed: number } }) {
    const hookData = usePlanLimits();

    const {
        currentUsers,
        maxUsers,
        percentageUsed,
        isNearLimit,
        isAtLimit,
        isLoading
    } = manualData ? {
        ...manualData,
        isNearLimit: manualData.percentageUsed >= 80,
        isAtLimit: manualData.currentUsers >= manualData.maxUsers,
        isLoading: false
    } : hookData;

    if (isLoading) return <div className="h-4 w-full animate-pulse rounded bg-gray-200"></div>;

    let barColor = 'bg-green-500';
    if (percentageUsed >= 90) barColor = 'bg-red-500';
    else if (percentageUsed >= 70) barColor = 'bg-yellow-500';

    return (
        <div className="w-full rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-end justify-between">
                <span className="text-sm font-medium text-gray-700">Usuarios del Plan</span>
                <span className="font-mono text-xs text-gray-500">
                    {currentUsers} / {maxUsers}
                </span>
            </div>

            {/* Progress Bar Track */}
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                {/* Progress Bar Fill */}
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentageUsed}%` }}
                ></div>
            </div>

            {/* Contextual Messages */}
            {isAtLimit && (
                <div className="mt-1 flex items-center text-xs font-semibold text-red-600">
                    ⛔ Límite alcanzado.
                    <button className="ml-auto underline hover:text-red-800">Actualizar Plan</button>
                </div>
            )}

            {isNearLimit && !isAtLimit && (
                <div className="mt-1 text-xs font-medium text-orange-600">
                    ⚠️ Estás cerca del límite de usuarios.
                </div>
            )}

            {!isNearLimit && (
                <div className="mt-1 text-xs text-gray-400">
                    Plan activo y saludable.
                </div>
            )}
        </div>
    );
}
