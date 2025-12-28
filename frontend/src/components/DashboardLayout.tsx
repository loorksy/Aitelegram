import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, LogOut, Bot, BarChart3, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
}

const SidebarItem = ({ to, icon, label }: SidebarItemProps) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                isActive
                    ? "bg-violet-600/10 text-violet-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
            )
        }
    >
        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        <span className="font-medium">{label}</span>
    </NavLink>
);

export const DashboardLayout = () => {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans" dir="rtl">
            {/* Sidebar */}
            <aside className="w-64 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur-xl flex flex-col fixed h-full right-0 top-0">
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Bot className="text-white" size={20} />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                            منصة الوكيل
                        </span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <SidebarItem to="/dashboard" icon={<LayoutDashboard />} label="نظرة عامة" />
                    <SidebarItem to="/my-bots" icon={<Bot />} label="بوتاتي" />
                    <SidebarItem to="/admin-system" icon={<ShieldAlert />} label="لوحة النظام" />

                    <div className="pt-4 mt-4 border-t border-zinc-800">
                        <p className="px-4 text-xs font-semibold text-zinc-500 mb-2">الإعدادات</p>
                        <SidebarItem to="/settings" icon={<Settings />} label="الإعدادات العامة" />
                    </div>
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                        <LogOut size={20} />
                        <span className="font-medium">تسجيل الخروج</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 mr-64">
                <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/30 backdrop-blur-sm sticky top-0 z-10">
                    <h1 className="text-lg font-medium text-zinc-200">لوحة التحكم</h1>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"></div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
