import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe } from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function LoginPage() {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(telegramId);
      const user = await getMe();
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <div className="card max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">🤖 AI Agent Factory</h1>
          <p className="text-gray-500">منصة إنشاء البوتات الذكية</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              معرف تيليجرام
            </label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="أدخل Telegram ID الخاص بك"
              className="input"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>للحصول على حساب، تواصل مع البوت الرئيسي</p>
          <p className="text-xs mt-2">@AgentFactoryBot</p>
        </div>
      </div>
    </div>
  );
}