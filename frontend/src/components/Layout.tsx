import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const navItems = [
    { path: '/', label: 'لوحة التحكم', icon: '🏠' },
    { path: '/credits', label: 'الرصيد', icon: '💰' }
  ];

  const adminItems = [
    { path: '/admin/users', label: 'المستخدمين', icon: '👥' },
    { path: '/admin/payments', label: 'المدفوعات', icon: '💳' },
    { path: '/admin/runs', label: 'السجلات', icon: '📋' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary-600">🤖 AI Agent Factory</h1>
            <span className="text-sm text-gray-500">مرحباً، {user?.name || user?.username || 'مستخدم'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
              {user?.credits || 0} رصيد
            </span>
            <span className="text-xs px-2 py-1 rounded bg-gray-100">
              {user?.role === 'OWNER' ? 'مالك' : user?.role === 'ADMIN' ? 'مشرف' : 'مستخدم'}
            </span>
            <button onClick={logout} className="text-gray-500 hover:text-red-500 text-sm">
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          <nav className="card space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="border-t my-2"></div>
                <div className="px-4 py-2 text-xs text-gray-400 font-medium">إدارة</div>
                {adminItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}