import React from 'react';
import { cn } from '../lib/utils';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}

export const ChartCard = ({ title, subtitle, children, className }: ChartCardProps) => (
    <div className={cn("bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6", className)}>
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
            {subtitle && <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>}
        </div>
        <div className="h-[300px] w-full">
            {children}
        </div>
    </div>
);
