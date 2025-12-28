import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminRuns } from '../lib/api';

export default function AdminRunsPage() {
  const [userId, setUserId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminRuns', userId],
    queryFn: () => getAdminRuns(userId || undefined)
  });

  const statusColors: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">سجل التشغيلات</h2>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="فلتر بمعرف المستخدم..."
          className="input w-64"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">المستخدم</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">النية</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الوقت</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.runs?.map((run: any) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{run.user?.name || 'بدون اسم'}</div>
                    <div className="text-sm text-gray-500">@{run.user?.username || run.user?.telegramId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded bg-gray-100 text-sm">
                      {run.intent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[run.status] || 'bg-gray-100'}`}>
                      {run.status}
                    </span>
                    {run.errorMessage && (
                      <div className="text-xs text-red-500 mt-1">{run.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{run.latencyMs}ms</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(run.createdAt).toLocaleString('ar')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.runs?.length === 0 && (
            <div className="text-center py-8 text-gray-500">لا توجد تشغيلات</div>
          )}
        </div>
      )}
    </div>
  );
}