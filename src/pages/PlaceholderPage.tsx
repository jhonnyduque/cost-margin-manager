import React from 'react';
import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const PlaceholderPage: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400 mb-4">
                <Construction size={48} />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Module Under Construction</h2>
            <p className="text-slate-500 mt-2">
                The requested module <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{location.pathname}</span> is not yet fully implemented in Phase 11.
            </p>
        </div>
    );
};
