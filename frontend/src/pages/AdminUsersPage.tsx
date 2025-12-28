import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, approveUser, denyUser, setUserCredits } from '../lib/api';

export default function AdminUsersPage() {
  const [filter, setFilter] = useState<string>('');
  const [creditsModal, setCreditsModal] = useState<{ userId: string; current: number } | null>(null);
  const [newCredits, setNewCredits] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', filter],
    queryFn: async () => getUsers(filter || undefined)
  });

  const approveMutation = useMutation({
    mutationFn: ({ userId, credits }: { userId: string; credits: number }) =>
      approveUser(userId, credits),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const denyMutation = useMutation({
    mutationFn: (userId: string) => denyUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const creditsMutation = useMutation({
    mutationFn: ({ userId, credits }: { userId: string; credits: number }) =>
      setUserCredits(userId, credits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreditsModal(null);
    }
  });

  const statusColors: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    DENIED: 'bg-red-100 text-red-700',
    SUSPENDED: 'bg-gray-100 text-gray-700'
  };

  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: 'في الانتظار',
    APPROVED: 'موافق',
    DENIED: 'مرفوض',
    SUSPENDED: 'موقوف'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-48"
        >
          <option value="">الكل</option>
          <option value="PENDING_APPROVAL">في الانتظار</option>
          <option value="APPROVED">موافق</option>
          <option value="DENIED">مرفوض</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">المستخدم</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الرصيد</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">البوتات</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.users?.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name || 'بدون اسم'}</div>
                    <div className="text-sm text-gray-500">@{user.username || user.telegramId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[user.status]}`}>
                      {statusLabels[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setCreditsModal({ userId: user.id, current: user.credits })}
                      className="text-primary-600 hover:underline"
                    >
                      {user.credits}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm">{user._count?.bots ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {user.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate({ userId: user.id, credits: 100 })}
                            disabled={approveMutation.isPending}
                            className="text-green-600 hover:underline text-sm"
                          >
                            موافقة
                          </button>
                          <button
                            onClick={() => denyMutation.mutate(user.id)}
                            disabled={denyMutation.isPending}
                            className="text-red-600 hover:underline text-sm"
                          >
                            رفض
                          </button>
                        </>
                      )}
                      {user.status === 'DENIED' && (
                        <button
                          onClick={() => approveMutation.mutate({ userId: user.id, credits: 100 })}
                          disabled={approveMutation.isPending}
                          className="text-green-600 hover:underline text-sm"
                        >
                          إعادة تفعيل
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.users?.length === 0 && (
            <div className="text-center py-8 text-gray-500">لا توجد نتائج</div>
          )}
        </div>
      )}

      {/* Credits Modal */}
      {creditsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">تعديل الرصيد</h3>
            <p className="text-sm text-gray-500 mb-4">الرصيد الحالي: {creditsModal.current}</p>
            <input
              type="number"
              value={newCredits}
              onChange={(e) => setNewCredits(e.target.value)}
              placeholder="الرصيد الجديد"
              className="input mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => creditsMutation.mutate({
                  userId: creditsModal.userId,
                  credits: parseInt(newCredits)
                })}
                disabled={!newCredits || creditsMutation.isPending}
                className="btn-primary flex-1"
              >
                حفظ
              </button>
              <button
                onClick={() => setCreditsModal(null)}
                className="btn-secondary flex-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}