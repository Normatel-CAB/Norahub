import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../services/notifications';
import { Bell, Check, CheckCheck, X, FileText, Upload, CheckCircle, MessageCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationCenter = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToNotifications(currentUser.uid, (notifications) => {
      setNotifications(notifications);
      const unread = notifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    
    if (notification.link) {
      navigate(notification.link);
    }
    
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(currentUser.uid);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'form_response':
        return <FileText size={18} className="text-blue-500" />;
      case 'file_upload':
        return <Upload size={18} className="text-brand-lite" />;
      case 'approval':
        return <CheckCircle size={18} className="text-purple-500" />;
      case 'comment':
        return <MessageCircle size={18} className="text-orange-500" />;
      case 'system':
        return <AlertCircle size={18} className="text-red-500" />;
      default:
        return <Bell size={18} className="text-txt-faint" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Agora';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de Notificações */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Notificações"
      >
        <Bell size={20} className="text-txt" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 nt-glass rounded-lg shadow-xl z-50 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-hairline">
            <h3 className="text-lg font-semibold text-txt">Notificações</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-brand-lite hover:brightness-110 font-medium flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={16} />
                  <span className="hidden md:inline">Marcar todas</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded"
                aria-label="Fechar"
              >
                <X size={18} className="text-txt-dim" />
              </button>
            </div>
          </div>

          {/* Lista de Notificações */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-txt-faint">
                <Bell size={48} className="mx-auto mb-3 text-txt-dim" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer transition-colors ${
                      !notification.read
                        ? 'bg-blue-500/10 hover:bg-blue-500/15'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Ícone */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-txt' : 'text-txt-dim'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-brand rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-txt-faint mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-txt-dim mt-1">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer (se houver muitas notificações) */}
          {notifications.length > 10 && (
            <div className="p-3 border-t border-hairline text-center">
              <button className="text-sm text-brand-lite hover:brightness-110 font-medium">
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
