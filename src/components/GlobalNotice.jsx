import { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, Megaphone } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const TYPES = {
  info:    { icon: Info,          bg: 'bg-blue-500/[0.12]',   border: 'border-blue-500/[0.18]',   text: 'text-blue-300',   dot: 'bg-blue-400'   },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/[0.12]',  border: 'border-amber-500/[0.18]',  text: 'text-amber-300',  dot: 'bg-amber-400'  },
  alert:   { icon: Megaphone,     bg: 'bg-red-500/[0.12]',    border: 'border-red-500/[0.18]',    text: 'text-red-300',    dot: 'bg-red-400'    },
};

function GlobalNotice() {
  const { userProfile } = useAuth();
  const [notice, setNotice] = useState(null);
  const [dismissedMsg, setDismissedMsg] = useState('');

  useEffect(() => {
    if (!userProfile?.id) return;

    const applyRow = (row) => {
      const d = row?.data;
      if (d && d.active && d.message) setNotice(d);
      else setNotice(null);
    };

    supabase.from('settings').select('data').eq('id', 'globalNotice').maybeSingle()
      .then(({ data }) => applyRow(data));

    const channel = supabase
      .channel('global-notice')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.globalNotice' }, (payload) => {
        applyRow(payload.new);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  // userProfile?.id: listener recriado só no login/logout, não a cada update de perfil
  }, [userProfile?.id]);

  if (!notice || dismissedMsg === notice.message) return null;

  const cfg = TYPES[notice.type] ?? TYPES.info;
  const Icon = cfg.icon;

  return (
    <div className={`w-full px-4 py-2.5 border-b flex items-center gap-3 ${cfg.bg} ${cfg.border} font-[Outfit,sans-serif] z-50`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${cfg.dot}`} />
      <Icon size={13} className={`flex-shrink-0 ${cfg.text}`} />
      <p className={`text-sm flex-1 font-medium leading-snug ${cfg.text}`}>{notice.message}</p>
      <button
        onClick={() => setDismissedMsg(notice.message)}
        className={`${cfg.text} opacity-50 hover:opacity-100 transition-opacity flex-shrink-0`}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default GlobalNotice;
