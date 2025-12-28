import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Users, MousePointer2, MessageSquare } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { cn } from '../lib/utils';

interface BotStats {
    overview: {
        totalUsers: number;
        activeUsers: number;
        totalMessages: number;
        totalInteractions: number;
    };
    dailyActivity: Array<{
        date: string;
        users: number;
        interactions: number;
    }>;
    topInteractions: Array<{
        type: string;
        count: number;
    }>;
}

const StatCard = ({ icon, label, value, trend }: any) => (
    <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-violet-500/10 rounded-lg text-violet-400">
                {icon}
            </div>
            {trend && (
                <span className={cn(
                    "text-sm font-medium px-2 py-1 rounded-full",
                    trend > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <p className="text-zinc-400 text-sm font-medium">{label}</p>
        <h4 className="text-2xl font-bold text-zinc-100 mt-1">{value}</h4>
    </div>
);

export const BotDetailsPage = () => {
    const { id } = useParams();
    const [stats, setStats] = useState<BotStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'analytics' | 'editor'>('analytics');
    const [editorData, setEditorData] = useState({ welcomeText: '', menuLabels: [] as any[] });

    // Mock fetch - replace with actual API call
    useEffect(() => {
        const fetchStats = async () => {
            try {
                // const res = await fetch(\`/api/bots/\${id}/stats\`);
                // const data = await res.json();

                // Mock data for UI development
                await new Promise(r => setTimeout(r, 1000));
                setStats({
                    overview: {
                        totalUsers: 1250,
                        activeUsers: 843,
                        totalMessages: 15420,
                        totalInteractions: 4500
                    },
                    dailyActivity: [
                        { date: 'Sat', users: 120, interactions: 400 },
                        { date: 'Sun', users: 150, interactions: 480 },
                        { date: 'Mon', users: 180, interactions: 520 },
                        { date: 'Tue', users: 140, interactions: 380 },
                        { date: 'Wed', users: 200, interactions: 600 },
                        { date: 'Thu', users: 250, interactions: 750 },
                        { date: 'Fri', users: 300, interactions: 900 }
                    ],
                    topInteractions: [
                        { type: 'Button Click', count: 2400 },
                        { type: 'Menu View', count: 1500 },
                        { type: 'Command', count: 600 }
                    ]
                });

                // Mock editor data
                setEditorData({
                    welcomeText: 'مرحبا بك في البوت! كيف يمكنني مساعدتك؟',
                    menuLabels: [
                        { title: '📦 طلب جديد', action: 'new_order' },
                        { title: '📞 تواصل معنا', action: 'contact' },
                        { title: '❓ الأسئلة الشائعة', action: 'faq' }
                    ]
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [id]);

    const handleSaveContent = async () => {
        // API Call: PUT /api/bots/:id/content
        alert('سيتم حفظ التعديلات: ' + JSON.stringify(editorData));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-zinc-100">إدارة البوت</h2>
                    <p className="text-zinc-400 mt-2">تحكم كامل في المحتوى والإحصائيات.</p>
                </div>
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            activeTab === 'analytics' ? "bg-violet-600 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        📊 الإحصائيات
                    </button>
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            activeTab === 'editor' ? "bg-violet-600 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        ✏️ المحرر اليدوي
                    </button>
                </div>
            </div>

            {activeTab === 'analytics' ? (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            icon={<Users size={24} />}
                            label="إجمالي المستخدمين"
                            value={stats?.overview.totalUsers}
                            trend={12}
                        />
                        <StatCard
                            icon={<Activity size={24} />}
                            label="المستخدمين النشطين"
                            value={stats?.overview.activeUsers}
                            trend={5}
                        />
                        <StatCard
                            icon={<MessageSquare size={24} />}
                            label="إجمالي الرسائل"
                            value={stats?.overview.totalMessages}
                            trend={24}
                        />
                        <StatCard
                            icon={<MousePointer2 size={24} />}
                            label="التفاعلات"
                            value={stats?.overview.totalInteractions}
                            trend={-2}
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <ChartCard title="النشاط اليومي (آخر 7 أيام)" className="lg:col-span-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats?.dailyActivity}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis dataKey="date" stroke="#71717a" />
                                    <YAxis stroke="#71717a" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                                        itemStyle={{ color: '#e4e4e7' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="users"
                                        stroke="#8b5cf6"
                                        strokeWidth={3}
                                        dot={{ stroke: '#8b5cf6', strokeWidth: 2, r: 4, fill: '#18181b' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="interactions"
                                        stroke="#ec4899"
                                        strokeWidth={3}
                                        dot={{ stroke: '#ec4899', strokeWidth: 2, r: 4, fill: '#18181b' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="أنواع التفاعل">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.topInteractions} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                    <XAxis type="number" stroke="#71717a" />
                                    <YAxis dataKey="type" type="category" width={100} stroke="#71717a" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                                        itemStyle={{ color: '#e4e4e7' }}
                                        cursor={{ fill: '#27272a', opacity: 0.4 }}
                                    />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
                </>
            ) : (
                <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-8 max-w-4xl mx-auto">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">رسالة الترحيب</label>
                            <textarea
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-100 focus:ring-2 focus:ring-violet-600 outline-none h-32"
                                value={editorData.welcomeText}
                                onChange={(e) => setEditorData({ ...editorData, welcomeText: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-2">قائمة الأزرار (القائمة الرئيسية)</label>
                            <div className="space-y-3">
                                {editorData.menuLabels.map((item, idx) => (
                                    <div key={idx} className="flex gap-3">
                                        <input
                                            type="text"
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 focus:ring-2 focus:ring-violet-600 outline-none"
                                            placeholder="عنوان الزر"
                                            value={item.title}
                                            onChange={(e) => {
                                                const newMenu = [...editorData.menuLabels];
                                                newMenu[idx].title = e.target.value;
                                                setEditorData({ ...editorData, menuLabels: newMenu });
                                            }}
                                        />
                                        <input
                                            type="text"
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 focus:ring-2 focus:ring-violet-600 outline-none"
                                            placeholder="الإجراء / الرد"
                                            value={item.action}
                                            onChange={(e) => {
                                                const newMenu = [...editorData.menuLabels];
                                                newMenu[idx].action = e.target.value;
                                                setEditorData({ ...editorData, menuLabels: newMenu });
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                const newMenu = editorData.menuLabels.filter((_, i) => i !== idx);
                                                setEditorData({ ...editorData, menuLabels: newMenu });
                                            }}
                                            className="p-3 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setEditorData({ ...editorData, menuLabels: [...editorData.menuLabels, { title: '', action: '' }] })}
                                    className="w-full py-3 border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
                                >
                                    + إضافة زر جديد
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-800 flex justify-end">
                            <button
                                onClick={handleSaveContent}
                                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-lg font-bold transition-all"
                            >
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
