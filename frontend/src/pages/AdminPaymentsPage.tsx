import { useQuery } from '@tanstack/react-query';
import { getAdminPayments } from '../lib/api';

interface Payment {
  id: string;
  amount: number;
  starsAmount: number;
  status: string;
  createdAt: string;
  user?: {
    name?: string;
    username?: string;
    telegramId?: string;
  };
}

interface PaymentsResponse {
  payments: Payment[];
}

export default function AdminPaymentsPage() {
  const { data, isLoading } = useQuery<PaymentsResponse>({
    queryKey: ['adminPayments'],
    queryFn: async () => getAdminPayments()
  });

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700'
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'في الانتظار',
    PAID: 'مكتمل',
    FAILED: 'فشل'
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">سجل المدفوعات</h2>

      {isLoading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">المستخدم</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الرصيد</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Stars</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.payments?.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{payment.user?.name || 'بدون اسم'}</div>
                    <div className="text-sm text-gray-500">@{payment.user?.username || payment.user?.telegramId}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{payment.amount}</td>
                  <td className="px-4 py-3">⭐ {payment.starsAmount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[payment.status]}`}>
                      {statusLabels[payment.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(payment.createdAt).toLocaleDateString('ar')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.payments?.length === 0 && (
            <div className="text-center py-8 text-gray-500">لا توجد مدفوعات</div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-2">إجمالي</h3>
        <div className="text-3xl font-bold text-primary-600">
          ⭐ {data?.payments?.filter((p: any) => p.status === 'PAID').reduce((acc: number, p: any) => acc + (p.starsAmount || 0), 0) || 0}
        </div>
        <div className="text-sm text-gray-500">Stars محصلة</div>
      </div>
    </div>
  );
}