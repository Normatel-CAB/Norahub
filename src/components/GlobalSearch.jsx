import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Briefcase, ExternalLink, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

function GlobalSearch({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState({ projects: [], cards: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState({ projects: [], cards: [], users: [] });
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.funcao === 'admin';

  // Carregar todos os dados na montagem
  useEffect(() => {
    if (isOpen) {
      loadAllData();
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Fechar com Escape (Ctrl+K é gerenciado pelo App.jsx)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const fetches = [getDocs(collection(db, 'projetos'))];
      if (isAdmin) fetches.push(getDocs(collection(db, 'usuarios')));

      const [projectsSnapshot, usersSnapshot] = await Promise.all(fetches);

      const projects = projectsSnapshot.docs
        .map(d => ({ id: d.id, type: 'project', ...d.data() }))
        .filter(p => !p.deletedAt);

      const cards = [];
      projects.forEach(project => {
        (project.extras || []).forEach(card => {
          cards.push({
            id: `${project.id}-${card.name}`,
            type: 'card',
            projectId: project.id,
            projectName: project.nome,
            ...card,
          });
        });
      });

      const users = usersSnapshot
        ? usersSnapshot.docs.map(d => ({ id: d.id, type: 'user', ...d.data() }))
        : [];

      setAllData({ projects, cards, users });
    } catch {
      // busca desabilitada se Firestore indisponível
    } finally {
      setLoading(false);
    }
  };

  // Buscar em tempo real
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults({ projects: [], cards: [], users: [] });
      return;
    }

    const term = searchTerm.toLowerCase();

    const filteredProjects = allData.projects.filter(p =>
      p.nome?.toLowerCase().includes(term) ||
      p.descricao?.toLowerCase().includes(term)
    );

    const filteredCards = allData.cards.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term) ||
      c.projectName?.toLowerCase().includes(term)
    );

    const filteredUsers = allData.users.filter(u =>
      u.nome?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    );

    setResults({
      projects: filteredProjects.slice(0, 5),
      cards: filteredCards.slice(0, 8),
      users: filteredUsers.slice(0, 5),
    });
  }, [searchTerm, allData]);

  const handleNavigate = (item) => {
    if (item.type === 'project') {
      navigate(`/projeto/${item.id}`);
    } else if (item.type === 'card') {
      navigate(`/projeto/${item.projectId}`);
    } else if (item.type === 'user') {
      navigate('/admin');
    }
    onClose();
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[600px] flex flex-col overflow-hidden border border-gray-700">
        {/* Header com Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-700">
          <Search className="text-gray-400" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar projetos, cards, arquivos... (Ctrl+K)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none bg-transparent text-white placeholder-gray-400 text-lg"
          />
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#57B952] mx-auto"></div>
              <p className="text-gray-500 mt-2">Carregando...</p>
            </div>
          ) : !searchTerm.trim() ? (
            <div className="text-center py-12">
              <Search size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Digite para buscar projetos, cards e arquivos</p>
              <p className="text-xs text-gray-400 mt-2">Use Ctrl+K para abrir a busca rapidamente</p>
            </div>
          ) : results.projects.length === 0 && results.cards.length === 0 && results.users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum resultado encontrado para "{searchTerm}"</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Projetos */}
              {results.projects.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <Briefcase size={14} /> Projetos ({results.projects.length})
                  </h3>
                  <div className="space-y-1">
                    {results.projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleNavigate(project)}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center shrink-0">
                          <Briefcase size={20} className="text-[#57B952]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{project.nome}</p>
                          <p className="text-sm text-gray-500 truncate">{project.descricao || 'Projeto'}</p>
                        </div>
                        <ExternalLink size={16} className="text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards */}
              {results.cards.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <FileText size={14} /> Cards ({results.cards.length})
                  </h3>
                  <div className="space-y-1">
                    {results.cards.map(card => (
                      <button
                        key={card.id}
                        onClick={() => handleNavigate(card)}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center shrink-0">
                          <FileText size={20} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{card.name}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {card.projectName} • {card.description || 'Card'}
                          </p>
                        </div>
                        <ExternalLink size={16} className="text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Usuários — admin only */}
              {results.users.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <User size={14} /> Usuários ({results.users.length})
                  </h3>
                  <div className="space-y-1">
                    {results.users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleNavigate(user)}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold">
                          {user.nome?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{user.nome || '—'}</p>
                          <p className="text-sm text-gray-500 truncate">{user.email} • {user.funcao || 'colaborador'}</p>
                        </div>
                        <ExternalLink size={16} className="text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer com dicas */}
        <div className="border-t border-gray-700 p-3 bg-gray-900/50 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span><kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded">↑↓</kbd> Navegar</span>
              <span><kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded">Enter</kbd> Abrir</span>
            </div>
            <span><kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded">Esc</kbd> Fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
