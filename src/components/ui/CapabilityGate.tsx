import React from 'react';
import { useCapabilities } from '@/platform/useCapabilities';
import { Capability } from '@/platform/capabilities.config';

interface CapabilityGateProps {
    capability: Capability;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const CapabilityGate: React.FC<CapabilityGateProps> = ({
    capability,
    children,
    fallback = null
}) => {
    const { can } = useCapabilities();

    if (can(capability)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
