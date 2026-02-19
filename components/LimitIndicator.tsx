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

    if (isLoading) return <div className="animate-pulse h-4 bg-gray-200 rounded w-full"></div>;

    let barColor = 'bg-green-500';
    if (percentageUsed >= 90) barColor = 'bg-red-500';
    else if (percentageUsed >= 70) barColor = 'bg-yellow-500';

    return (
        <div className="w-full p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-gray-700">Usuarios del Plan</span>
                <span className="text-xs text-gray-500 font-mono">
                    {currentUsers} / {maxUsers}
                </span>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
                {/* Progress Bar Fill */}
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentageUsed}%` }}
                ></div>
            </div>

            {/* Contextual Messages */}
            {isAtLimit && (
                <div className="text-xs text-red-600 font-semibold mt-1 flex items-center">
                    ⛔ Límite alcanzado.
                    <button className="ml-auto underline hover:text-red-800">Actualizar Plan</button>
                </div>
            )}

            {isNearLimit && !isAtLimit && (
                <div className="text-xs text-orange-600 font-medium mt-1">
                    ⚠️ Estás cerca del límite de usuarios.
                </div>
            )}

            {!isNearLimit && (
                <div className="text-xs text-gray-400 mt-1">
                    Plan activo y saludable.
                </div>
            )}
        </div>
    );
}
