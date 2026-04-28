import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Shield, User, Loader2 } from 'lucide-react';
import { loginWithGoogle } from '../../lib/firebase';

export function Login({ onLogin }: { onLogin: (role: string) => void }) {
  const handleLogin = async (role: 'staff' | 'security' | 'manager' | 'guest') => {
    try {
      await loginWithGoogle();
      onLogin(role);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-10 h-10 text-red-600" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic serif">Hospitality SafeLink</h1>
        </div>

        <p className="text-sm text-gray-600 mb-8 border-l-2 border-black pl-4">
          Accelerated Emergency Response Systems. <br />
          Guest and Authorized Access Portal.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin('guest')}
            className="w-full group flex items-center justify-between border border-black p-4 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-600 group-hover:text-white" />
              <span className="font-mono text-sm uppercase tracking-widest font-black">Login as Guest</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </button>

          <div className="h-4 border-b border-black/10" />

          <button
            onClick={() => handleLogin('staff')}
            className="w-full group flex items-center justify-between border border-black p-4 hover:bg-black hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5" />
              <span className="font-mono text-sm uppercase tracking-widest">Login as Staff</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </button>

          <button
            onClick={() => handleLogin('security')}
            className="w-full group flex items-center justify-between border border-black p-4 bg-red-50 hover:bg-red-600 hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 group-hover:text-white" />
              <span className="font-mono text-sm uppercase tracking-widest">Login as Security</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </button>

          <button
            onClick={() => handleLogin('manager')}
            className="w-full group flex items-center justify-between border border-black p-4 hover:bg-black hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <span className="font-mono text-sm uppercase tracking-widest">Login as Manager</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </button>
        </div>

        <p className="mt-8 text-[10px] text-gray-400 font-mono text-center uppercase tracking-tighter">
          v1.0.4 - Secure Uplink Active
        </p>
      </motion.div>
    </div>
  );
}
