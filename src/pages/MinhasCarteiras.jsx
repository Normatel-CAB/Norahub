import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, ChevronDown, ChevronRight, ExternalLink, Link2,
  FileText, Phone, Mail, Globe, ArrowLeft, Folder, Lock,
  Search, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCarteiras } from '../services/carteiras';

const LINK_ICONS = {
  link:      <Globe className="w-3.5 h-3.5" />,
  documento: <FileText className="w-3.5 h-3.5" />,
  contato:   <Phone className="w-3.5 h-3.5" />,
  email:     <Mail className="w-3.5 h-3.5" />,
};

function LinkRow({ link }) {
  const icon = LINK_ICONS[link.tipo] ?? LINK_ICONS.link;
  const isClickable = link.url && link.tipo !== 'contato' && link.tipo !== 'email';

  const handleClick = () => {
    if (!isClickable) return;
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.03] transition-all ${
        isClickable ? 'cursor-pointer hover:bg-white/[0.07] hover:border-white/10 group' : ''
      }`}
    >
      <span className="text-white/40 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{link.nome}</p>
        {link.descricao && (
          <p className="text-xs text-white/40 truncate mt-0.5">{link.descricao}</p>
        )}
        {link.url && (
          <p className="text-xs text-white/30 truncate mt-0.5">{link.url}</p>
        )}
      </div>
      {isClickable && (
        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
      )}
    </div>
  );
}

function CarteiraCard({ carteira }) {
  const [expanded, setExpanded] = useState(false);
  const links = carteira.links ?? [];

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden"
      style={{ borderLeftColor: carteira.cor, borderLeftWidth: 3 }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${carteira.cor}25` }}
        >
          <Layers className="w-4 h-4" style={{ color: carteira.cor }} />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90">{carteira.nome}</p>
          {carteira.descricao && (
            <p className="text-xs text-white/40 truncate mt-0.5">{carteira.descricao}</p>
          )}
        </div>

        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{
            color: carteira.cor,
            backgroundColor: `${carteira.cor}20`,
            borderColor: `${carteira.cor}40`,
          }}
        >
          {links.length} {links.length === 1 ? 'link' : 'links'}
        </span>

        {expanded
          ? <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />}
      </button>

      {/* Links list */}
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {links.length === 0 ? (
            <p className="text-xs text-white/30 italic py-2">Nenhum link cadastrado nesta carteira.</p>
          ) : (
            links.map(link => <LinkRow key={link.id} link={link} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function MinhasCarteiras() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [carteiras, setCarteiras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdmin = userProfile?.funcao === 'admin';
  const carteiraIds = userProfile?.carteiras ?? [];

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoading(true);
      const { success, carteiras: all } = await getCarteiras();
      if (success) {
        const filtered = isAdmin ? all : all.filter(c => carteiraIds.includes(c.id));
        setCarteiras(filtered);
      }
      setLoading(false);
    })();
  }, [currentUser, userProfile]);

  const visible = carteiras.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.descricao ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalLinks = carteiras.reduce((sum, c) => sum + (c.links?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] via-[#151821] to-[#0f1117] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Minhas Carteiras</h1>
            <p className="text-xs text-white/40">Setores e links atribuídos à sua conta</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{carteiras.length}</p>
              <p className="text-xs text-white/40">Carteiras</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{totalLinks}</p>
              <p className="text-xs text-white/40">Links disponíveis</p>
            </div>
          </div>
        </div>

        {/* Search */}
        {carteiras.length > 2 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar carteira..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25 focus:bg-white/8 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : carteiras.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-sm font-semibold text-white/60 mb-1">Nenhuma carteira atribuída</p>
            <p className="text-xs text-white/30">Você ainda não possui carteiras atribuídas. Contate seu gerente.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <Folder className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">Nenhuma carteira encontrada para "{search}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(c => <CarteiraCard key={c.id} carteira={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
