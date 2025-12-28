import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../lib/store';
import { getBalance, getAdminStats } from '../lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => getBalance()
  });

  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => getAdminStats(),
    enabled: isAdmin
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">لوحة التحكم</h2>

      {/* User Status Alert */}
      {user?.status === 'PENDING_APPROVAL' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          ⏳ حسابك في انتظار موافقة المشرف. لا يمكنك إنشاء بوتات حتى يتم الموافقة.
        </div>
      )}

      {user?.status === 'DENIED' && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          ❌ تم رفض حسابك. تواصل مع المشرف للمزيد من المعلومات.
        </div>
      )}

      {/* Credit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">الرصيد الحالي</div>
          <div className="text-3xl font-bold text-primary-600">{balance?.balance ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">رصيد</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-500 mb-1">الاستخدام اليومي</div>
          <div className="text-3xl font-bold">
            {balance?.dailyUsed ?? 0} / {balance?.dailyLimit ?? 100}
          </div>
          <div className="text-xs text-gray-400 mt-1">رصيد</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-500 mb-1">تكلفة التشغيل</div>
          <div className="text-3xl font-bold text-orange-500">{balance?.pipelineCost ?? 10}</div>
          <div className="text-xs text-gray-400 mt-1">رصيد/تشغيل</div>
        </div>
      </div>

      {/* Admin Stats */}
      {isAdmin && stats && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">إحصائيات النظام</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold">{stats.users.total}</div>
              <div className="text-sm text-gray-500">إجمالي المستخدمين</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats.users.pending}</div>
              <div className="text-sm text-gray-500">في الانتظار</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-500">{stats.runs.successful}</div>
              <div className="text-sm text-gray-500">تشغيل ناجح</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-primary-600">{stats.payments.paid}</div>
              <div className="text-sm text-gray-500">دفعة مكتملة</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {user?.status === 'APPROVED' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">إنشاء بوت جديد</h3>
          <p className="text-gray-500 mb-4">
            صف البوت الذي تريد إنشاءه بالتفصيل، وسيقوم الذكاء الاصطناعي بإنشائه لك.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="مثال: بوت خدمة عملاء يجيب على الأسئلة الشائعة..."
              className="input flex-1"
              disabled={balance?.balance < balance?.pipelineCost}
            />
            <button
              className="btn-primary"
              disabled={balance?.balance < balance?.pipelineCost}
            >
              إنشاء
            </button>
          </div>
          {balance?.balance < balance?.pipelineCost && (
            <p className="text-red-500 text-sm mt-2">
              رصيدك غير كافٍ. يرجى شحن الرصيد أولاً.
            </p>
          )}
        </div>
      )}
    </div>
  );
}