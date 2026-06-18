import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Package, ClipboardList, ShoppingCart, Truck,
  CheckSquare, ArrowUpDown, RotateCcw, FileText, Bot, Users,
  Building2, Receipt, Shield, Bell, ChevronLeft, ChevronRight,
  LogOut, Menu, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';

const navItems = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/',                 roles: ['*'] },
  { label: 'Inventory',          icon: Package,          path: '/inventory',         roles: ['*'] },
  { label: 'Material Requests',  icon: ClipboardList,    path: '/material-requests', roles: ['*'] },
  { label: 'Purchase Orders',    icon: ShoppingCart,     path: '/purchase-orders',   roles: ['admin','procurement','stores_executive','project_manager'] },
  { label: 'Vendors',            icon: Building2,        path: '/vendors',           roles: ['admin','procurement','project_manager'] },
  { label: 'GRNs',               icon: Truck,            path: '/grns',              roles: ['admin','stores_executive','qaqc','procurement'] },
  { label: 'Material Issues',    icon: ArrowUpDown,      path: '/material-issues',   roles: ['admin','stores_executive','project_manager','site_engineer'] },
  { label: 'Material Returns',   icon: RotateCcw,        path: '/material-returns',  roles: ['*'] },
  { label: 'Invoices',           icon: Receipt,          path: '/invoices',          roles: ['admin','finance','procurement'] },
  { label: 'Projects',           icon: CheckSquare,      path: '/projects',          roles: ['*'] },
  { label: 'Reports',            icon: FileText,         path: '/reports',           roles: ['admin','project_manager','finance','stores_executive'] },
  { label: 'AI Assistant',       icon: Bot,              path: '/ai-assistant',      roles: ['*'] },
  { label: 'Users',              icon: Users,            path: '/users',             roles: ['admin'] },
  { label: 'Audit Log',          icon: Shield,           path: '/audit',             roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const visibleNav = navItems.filter(
    (item) => item.roles.includes('*') || (user && item.roles.includes(user.role))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-primary-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-primary-800" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">Stores & Inventory</p>
            <p className="text-primary-300 text-xs">Management System</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all
               ${isActive ? 'bg-white text-primary-900 font-semibold shadow-sm' : 'text-primary-100 hover:bg-primary-800 hover:text-white'}`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className={`border-t border-primary-800 p-4 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && user && (
          <div className="mb-3">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <p className="text-primary-300 text-xs capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        )}
        <button onClick={handleLogout} className="flex items-center gap-2 text-primary-300 hover:text-white text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-primary-900 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-10 bg-primary-800 rounded-r-lg text-white flex items-center justify-center"
          style={{ left: collapsed ? '3.5rem' : '15.5rem' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-primary-900 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 md:flex-none">
            <input
              type="search"
              placeholder="Search..."
              className="w-full md:w-64 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-gray-500 text-xs capitalize">{user.role.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
