import { useState, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  Grid3x3, Plus, Pencil, Trash2, X, Save, Power, PowerOff, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserPageHeader } from '../components/UserPageHeader';

function mapAppRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    url: row.url,
    categoria: row.categoria,
    icone: row.icone,
    cargosPermitidos: row.cargos_permitidos,
    ativo: row.ativo,
    ordem: row.ordem,
  };
}

function mapCargoRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    canManageUsers: row.can_manage_users,
    canManagePermissions: row.can_manage_permissions,
    canManageProjectMembers: row.can_manage_project_members,
    canChangeCarteiras: row.can_change_carteiras,
    canCreateCargos: row.can_create_cargos,
    canCreateProjetos: row.can_create_projetos,
    ...(row.data || {}),
  };
}

// Set curto de ícones lucide pra escolher no formulário — cobre a maioria
// dos sistemas internos sem virar uma lista infinita de rolar.
const ICON_OPTIONS = [
  'Grid3x3', 'ShoppingCart', 'Users', 'FileText', 'Wrench', 'Truck',
  'Building2', 'ClipboardList', 'Calculator', 'Shield', 'Warehouse',
  'Package', 'BarChart3', 'Calendar', 'Briefcase', 'HardHat', 'Boxes',
  'Receipt', 'UserCog', 'Building', 'Mail', 'MessageCircle', 'Contact',
];

const EMPTY_FORM = {
  nome: '', descricao: '', url: '', categoria: '', icone: 'Grid3x3',
  ordem: 0, ativo: true, cargosPermitidos: [],
};

// Sugestões de categoria (= abas em /aplicativos). O campo continua texto
// livre — isso é só autocomplete pra evitar "SMS" vs "Sms" virando duas
// abas por acidente. As categorias já cadastradas no banco também entram
// na lista (ver `categoriasSugeridas` abaixo).
const CATEGORIAS_BASE = ['SMS', 'Logística', '736', '737', '741', '743', 'Apoio Macaé'];

function AppIcon({ name, size = 20, className = '' }) {
  const Icon = (name && LucideIcons[name]) || Grid3x3;
  return <Icon size={size} className={className} />;
}

function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className="fixed top-8 right-8 z-[200] animate-fade-in">
      <div className={`border-l-4 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500' : 'bg-brand/20 border-brand'} rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[280px] text-white`}>
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
}

function AdminAplicativos() {
  const [apps, setApps] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [modal, setModal] = useState({ open: false, editingId: null });
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, app: null });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [appsRes, cargosRes] = await Promise.all([
        supabase.from('apps_normatel').select('*'),
        supabase.from('cargos').select('*'),
      ]);
      if (appsRes.error) throw appsRes.error;
      if (cargosRes.error) throw cargosRes.error;
      setApps((appsRes.data || []).map(mapAppRow));
      setCargos((cargosRes.data || []).map(mapCargoRow));
    } catch (err) {
      showToast('Erro ao carregar aplicativos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const appsOrdenados = useMemo(
    () => [...apps].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [apps]
  );

  const categoriasSugeridas = useMemo(() => {
    const doBanco = apps.map(a => (a.categoria || '').trim()).filter(Boolean);
    return Array.from(new Set([...CATEGORIAS_BASE, ...doBanco]));
  }, [apps]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, ordem: apps.length });
    setModal({ open: true, editingId: null });
  };

  const openEdit = (app) => {
    setForm({
      ...EMPTY_FORM,
      ...app,
      cargosPermitidos: Array.isArray(app.cargosPermitidos) ? app.cargosPermitidos : [],
    });
    setModal({ open: true, editingId: app.id });
  };

  const closeModal = () => setModal({ open: false, editingId: null });

  const toggleCargo = (nomeCargo) => {
    setForm(f => {
      const has = f.cargosPermitidos.includes(nomeCargo);
      return {
        ...f,
        cargosPermitidos: has
          ? f.cargosPermitidos.filter(c => c !== nomeCargo)
          : [...f.cargosPermitidos, nomeCargo],
      };
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.url.trim() || !form.categoria.trim()) {
      showToast('Preencha nome, URL e categoria.', 'error');
      return;
    }
    setSaving(true);
    try {
      const row = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        url: form.url.trim(),
        categoria: form.categoria.trim(),
        icone: form.icone || 'Grid3x3',
        ordem: Number(form.ordem) || 0,
        ativo: !!form.ativo,
        cargos_permitidos: form.cargosPermitidos,
      };
      if (modal.editingId) {
        const { error } = await supabase.from('apps_normatel').update(row).eq('id', modal.editingId);
        if (error) throw error;
        showToast('Aplicativo atualizado.');
      } else {
        const { error } = await supabase.from('apps_normatel').insert(row);
        if (error) throw error;
        showToast('Aplicativo cadastrado.');
      }
      closeModal();
      await fetchAll();
    } catch (err) {
      showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (app) => {
    try {
      const { error } = await supabase.from('apps_normatel').update({ ativo: !(app.ativo !== false) }).eq('id', app.id);
      if (error) throw error;
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, ativo: !(app.ativo !== false) } : a));
    } catch (err) {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.app) return;
    try {
      const { error } = await supabase.from('apps_normatel').delete().eq('id', confirmDelete.app.id);
      if (error) throw error;
      showToast('Aplicativo removido.');
      setConfirmDelete({ open: false, app: null });
      await fetchAll();
    } catch (err) {
      showToast('Erro ao remover.', 'error');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] nt-page-bg">
      <Toast toast={toast} />
      <UserPageHeader backTo="/aplicativos" />

      <main className="relative z-10 flex-grow p-3 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-txt flex items-center gap-3">
                <Grid3x3 size={28} className="text-brand-lite" />
                Gerenciar Aplicativos
              </h1>
              <p className="text-sm text-txt-dim mt-2">
                Cadastre os sistemas da Normatel e escolha quais cargos enxergam cada um.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow hover:scale-105 text-sm"
            >
              <Plus size={16} /> Novo Aplicativo
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}
            </div>
          ) : appsOrdenados.length === 0 ? (
            <div className="text-center py-16 nt-glass">
              <p className="text-txt-dim font-medium">Nenhum aplicativo cadastrado ainda.</p>
              <p className="text-txt-faint text-sm mt-1">Clique em "Novo Aplicativo" pra começar.</p>
            </div>
          ) : (
            <div className="nt-glass divide-y divide-hairline overflow-hidden">
              {appsOrdenados.map(app => {
                const ativo = app.ativo !== false;
                const cargosLabel = (!app.cargosPermitidos || app.cargosPermitidos.length === 0)
                  ? 'Todos os cargos'
                  : app.cargosPermitidos.join(', ');
                return (
                  <div key={app.id} className="flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors">
                    <div className="bg-brand/15 p-2.5 rounded-lg text-brand-lite shrink-0">
                      <AppIcon name={app.icone} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-txt truncate">{app.nome}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-txt-dim border border-hairline">
                          {app.categoria}
                        </span>
                        {!ativo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                            inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-txt-faint truncate mt-0.5">{app.url}</p>
                      <p className="text-xs text-txt-faint mt-0.5">Visível para: {cargosLabel}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleAtivo(app)}
                        title={ativo ? 'Desativar' : 'Ativar'}
                        className={`p-2 rounded-lg transition-colors ${ativo ? 'text-brand-lite hover:bg-surface-2' : 'text-txt-faint hover:bg-surface-2'}`}
                      >
                        {ativo ? <Power size={16} /> : <PowerOff size={16} />}
                      </button>
                      <button
                        onClick={() => openEdit(app)}
                        title="Editar"
                        className="p-2 rounded-lg text-txt-dim hover:bg-surface-2 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ open: true, app })}
                        title="Excluir"
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal criar/editar */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[150]">
          <div className="nt-glass w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-txt">
                {modal.editingId ? 'Editar Aplicativo' : 'Novo Aplicativo'}
              </h2>
              <button onClick={closeModal} className="text-txt-dim hover:text-txt">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-txt-dim mb-1 block">Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-txt focus:outline-none focus:border-brand/60"
                  placeholder="Ex: Sistema de Compras"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-txt-dim mb-1 block">Descrição</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-txt focus:outline-none focus:border-brand/60"
                  placeholder="Uma frase curta sobre o que o sistema faz"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-txt-dim mb-1 block">URL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-txt focus:outline-none focus:border-brand/60"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-txt-dim mb-1 block">Categoria (aba) *</label>
                  <input
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    list="categorias-sugeridas"
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-txt focus:outline-none focus:border-brand/60"
                    placeholder="Ex: SMS, Logística, 743..."
                  />
                  <datalist id="categorias-sugeridas">
                    {categoriasSugeridas.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                  <p className="text-[11px] text-txt-faint mt-1">
                    Cada categoria vira uma aba em /aplicativos. Use o mesmo nome de uma já existente pra cair na mesma aba.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-txt-dim mb-1 block">Ícone</label>
                  <select
                    value={form.icone}
                    onChange={e => setForm(f => ({ ...f, icone: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm text-txt focus:outline-none focus:border-brand/60"
                  >
                    {ICON_OPTIONS.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-txt-dim mb-2 block">Quem pode ver</label>
                <label className="flex items-center gap-2 text-sm text-txt-dim mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cargosPermitidos.length === 0}
                    onChange={e => setForm(f => ({ ...f, cargosPermitidos: e.target.checked ? [] : [cargos[0]?.nome].filter(Boolean) }))}
                    className="accent-brand"
                  />
                  Todos os cargos
                </label>
                {form.cargosPermitidos.length > 0 || cargos.length === 0 ? (
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto bg-surface rounded-lg p-2 border border-hairline">
                    {cargos.length === 0 && (
                      <p className="text-xs text-txt-faint col-span-2">Nenhum cargo cadastrado ainda.</p>
                    )}
                    {cargos.map(cargo => (
                      <label key={cargo.id} className="flex items-center gap-2 text-xs text-txt-dim cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.cargosPermitidos.includes(cargo.nome)}
                          onChange={() => toggleCargo(cargo.nome)}
                          className="accent-brand"
                        />
                        {cargo.nome}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-txt-dim cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  className="accent-brand"
                />
                Ativo (aparece pra quem tem acesso)
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 rounded-lg border border-hairline text-txt-dim hover:bg-surface-2 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 transition-all text-white font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmDelete.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[150]">
          <div className="nt-glass w-full max-w-sm p-6 text-center">
            <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
            <h3 className="text-txt font-bold mb-2">Excluir "{confirmDelete.app?.nome}"?</h3>
            <p className="text-txt-dim text-sm mb-5">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, app: null })}
                className="flex-1 px-4 py-2 rounded-lg border border-hairline text-txt-dim hover:bg-surface-2 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAplicativos;
