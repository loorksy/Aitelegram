import { useEffect, useState } from 'react';
import { ShieldCheck, Server, Cpu, Database, Activity } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { cn } from '../lib/utils';

// Mock system health data
const mockHealthData = {
  cpu: 45,
  memory: 62,
  uptime: '14d 2h 15m',
  activeBots: 124,
  version: '1.2.0',
  history: Array.from({ length: 20 }, (_, i) => ({
    time: `${10 + i}:00`,
    cpu: 30 + Math.random() * 30,
    memory: 50 + Math.random() * 20
  }))
};

const SystemCard = ({ icon, label, value, status = 'normal' }: any) => (
  <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
    <div className="flex items-center justify-between z-10">
      <div className="p-3 bg-zinc-800 rounded-lg text-zinc-400">
        {icon}
      </div>
      <div className={cn(
        "w-2 h-2 rounded-full",
        status === 'normal' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
      )} />
    </div>
    <div className="mt-4 z-10">
      <p className="text-zinc-500 text-sm font-medium">{label}</p>
      <h4 className="text-2xl font-bold text-zinc-100">{value}</h4>
    </div>
    {/* Background decoration */}
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-violet-500/5 to-transparent rounded-full blur-2xl" />
  </div>
);

export const AdminSystemPage = () => {
  const [data, setData] = useState(mockHealthData);

  useEffect(() => {
    // Poll system health
    const interval = setInterval(() => {
      // Fetch /api/admin/system/health here
      // Updating mock data smoothly
      setData(prev => ({
        ...prev,
        cpu: 30 + Math.random() * 30,
        history: [
          ...prev.history.slice(1),
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cpu: 30 + Math.random() * 30,
            memory: 50 + Math.random() * 20
          }
        ]
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100">لوحة تحكم النظام</h2>
        <p className="text-zinc-400 mt-2">مراقبة حية لأداء السيرفر وحالة البوتات.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SystemCard
          icon={<Server size={24} />}
          label="وقت التشغيل (Uptime)"
          value={data.uptime}
        />
        <SystemCard
          icon={<Cpu size={24} />}
          label="استهلاك المعالج"
          value={`${data.cpu.toFixed(1)}%`}
          status={data.cpu > 80 ? 'warning' : 'normal'}
        />
        <SystemCard
          icon={<Database size={24} />}
          label="استهلاك الذاكرة"
          value={`${data.memory.toFixed(1)}%`}
        />
        <SystemCard
          icon={<Activity size={24} />}
          label="البوتات النشطة"
          value={data.activeBots}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="أداء النظام المباشر">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.history}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" />
              <YAxis stroke="#71717a" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', color: '#fff' }} />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorCpu)"
              />
              <Area
                type="monotone"
                dataKey="memory"
                stroke="#22c55e"
                fill="none"
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">حالة الخدمات</h3>
            <ShieldCheck className="text-green-500" />
          </div>
          <div className="space-y-4">
            {[
              { name: 'PostgreSQL Database', status: 'Operational', latency: '4ms' },
              { name: 'Redis Cache', status: 'Operational', latency: '1ms' },
              { name: 'Telegram Webhook Engine', status: 'Operational', latency: '35ms' },
              { name: 'OpenAI API Connector', status: 'Operational', latency: '240ms' },
              { name: 'Payment Gateway (Stripe)', status: 'Idle', latency: '-' }
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-zinc-300 font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 font-mono">{service.latency}</span>
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full">
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
