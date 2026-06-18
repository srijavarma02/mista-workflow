import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.data.user, res.data.data.token);
      navigate('/');
      toast.success(`Welcome, ${res.data.data.user.name}!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-primary-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Stores & Inventory</h1>
            <p className="text-gray-500 text-sm mt-1">Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-semibold text-gray-600 mb-2">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-1">
              <span>admin@stores.com</span><span className="text-gray-400">Admin</span>
              <span>engineer@stores.com</span><span className="text-gray-400">Site Engineer</span>
              <span>pm@stores.com</span><span className="text-gray-400">Project Manager</span>
              <span>stores@stores.com</span><span className="text-gray-400">Stores Exec</span>
            </div>
            <p className="mt-2 text-gray-400">Password: Admin@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
