import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBalance, getCreditHistory, getPaymentConfig, createPayment, getPaymentHistory } from '../lib/api';

export default function CreditsPage() {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => getBalance()
  });

  const { data: config } = useQuery({
    queryKey: ['paymentConfig'],
    queryFn: async () => getPaymentConfig()
  });

  const { data: history } = useQuery({
    queryKey: ['creditHistory'],
    queryFn: async () => getCreditHistory()
  });

  const { data: payments } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: async () => getPaymentHistory()
  });

  const createMutation = useMutation({
    mutationFn: async (starsAmount: number) => createPayment(starsAmount),
    onSuccess: async (data) => {
      if (data.invoiceLink) {
        // Open Telegram Stars payment link
        window.open(data.invoiceLink, '_blank');
        alert(`تم إنشاء رابط الدفع. يرجى إكمال الدفع في Telegram لاستلام ${data.creditsToReceive} رصيد.`);
      }
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['paymentHistory'] });
      setSelectedPackage(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'حدث خطأ أثناء إنشاء الدفع');
    }
  });

  const handleBuyCredits = () => {
    if (selectedPackage) {
      createMutation.mutate(selectedPackage);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">الرصيد والشحن</h2>

      {/* Current Balance */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">رصيدك الحالي</div>
            <div className="text-4xl font-bold text-primary-600">{balance?.balance ?? 0}</div>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-500">الاستخدام اليومي</div>
            <div className="text-xl">
              {balance?.dailyUsed ?? 0} / {balance?.dailyLimit ?? 100}
            </div>
          </div>
        </div>
      </div>

      {/* Buy Credits */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">شحن الرصيد</h3>
        
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm mb-4">
          💫 الدفع عبر Telegram Stars - سيتم فتح رابط الدفع في Telegram
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {config?.packages?.map((pkg: any) => (
            <button
              key={pkg.stars}
              onClick={() => setSelectedPackage(pkg.stars)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedPackage === pkg.stars
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <div className="text-2xl font-bold text-primary-600">{pkg.credits}</div>
              <div className="text-sm text-gray-500">رصيد</div>
              <div className="mt-2 text-lg font-medium">⭐ {pkg.stars}</div>
            </button>
          ))}
        </div>

        <button
          onClick={handleBuyCredits}
          disabled={!selectedPackage || createMutation.isPending}
          className="btn-primary w-full"
        >
          {createMutation.isPending ? 'جاري المعالجة...' : 'شراء الآن'}
        </button>
      </div>

      {/* Payment History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">سجل المدفوعات</h3>
        {payments?.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد مدفوعات</p>
        ) : (
          <div className="space-y-2">
            {payments?.map((payment: any) => (
              <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium">{payment.amount} رصيد</div>
                  <div className="text-sm text-gray-500">⭐ {payment.starsAmount} Stars</div>
                </div>
                <div className="text-left">
                  <span className={`px-2 py-1 rounded text-xs ${
                    payment.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {payment.status === 'PAID' ? 'مكتمل' : payment.status === 'PENDING' ? 'في الانتظار' : 'فشل'}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(payment.createdAt).toLocaleDateString('ar')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Credit History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">سجل الرصيد</h3>
        {history?.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد معاملات</p>
        ) : (
          <div className="space-y-2">
            {history?.slice(0, 10).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium">
                    {tx.amount > 0 ? '+' : ''}{tx.amount} رصيد
                  </div>
                  <div className="text-sm text-gray-500">{tx.reason}</div>
                </div>
                <div className="text-left text-sm text-gray-500">
                  الرصيد: {tx.balanceAfter}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}