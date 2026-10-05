import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, Camera, LogOut, Save, ArrowLeft } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import Alert from '../components/Alert';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

function Perfil() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [primeiroNome, setPrimeiroNome] = useState('');
  const [fotoURL, setFotoURL] = useState(null);
  const [novaFotoFile, setNovaFotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  // Revogar blob URL ao desmontar ou trocar de foto, evitando memory leak
  useEffect(() => {
    return () => {
      if (fotoURL?.startsWith('blob:')) URL.revokeObjectURL(fotoURL);
    };
  }, [fotoURL]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { navigate('/login'); return; }

    const displayName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || userProfile?.nome || '';
    setNome(displayName);
    setEmail(currentUser.email || userProfile?.email || '');
    setCelular(userProfile?.data?.celular || '');
    if (displayName) setPrimeiroNome(displayName.split(' ')[0]);

    // Prioridade: foto do Auth (Microsoft) > foto salva no perfil (upload manual)
    const initialPhoto = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || userProfile?.foto_url || null;
    setFotoURL(initialPhoto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser?.id, userProfile?.id]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/login'); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlertInfo(null);

    try {
      if (!currentUser) {
        setAlertInfo({ message: 'Sessão expirada. Entre novamente.', type: 'error' });
        setSaving(false);
        return;
      }

      let downloadURL = fotoURL;

      // Se selecionou arquivo, faz upload no bucket `avatars`
      if (novaFotoFile) {
        try {
          const path = `${currentUser.id}/profile.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, novaFotoFile, { upsert: true, contentType: novaFotoFile.type });
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
          downloadURL = `${publicUrlData.publicUrl}?t=${Date.now()}`; // cache-bust
          setFotoURL(downloadURL);
        } catch (storageError) {
          setAlertInfo({ message: `Erro no upload: ${storageError.message}`, type: 'error' });
          setSaving(false);
          return;
        }
      }

      // Atualiza nome/foto nos metadados de Auth quando mudaram
      if (nome !== (currentUser.user_metadata?.full_name || '') || (downloadURL && downloadURL !== currentUser.user_metadata?.avatar_url)) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: { full_name: nome, ...(downloadURL ? { avatar_url: downloadURL } : {}) },
        });
        if (authUpdateError) throw authUpdateError;
        setPrimeiroNome(nome.split(' ')[0]);
      }

      const usuarioUpdate = { nome, data: { ...(userProfile?.data || {}), celular } };
      if (downloadURL) usuarioUpdate.foto_url = downloadURL;
      const { error: dbError } = await supabase.from('usuarios').update(usuarioUpdate).eq('id', currentUser.id);
      if (dbError) throw dbError;

      setAlertInfo({ message: 'Perfil atualizado!', type: 'success' });
      setNovaFotoFile(null);

    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      setAlertInfo({ message: 'Erro ao atualizar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validação de tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAlertInfo({ message: 'A foto deve ter no máximo 5MB.', type: 'error' });
      return;
    }

    // Validação de tipo
    if (!file.type.startsWith('image/')) {
      setAlertInfo({ message: 'Apenas imagens são permitidas.', type: 'error' });
      return;
    }

    setNovaFotoFile(file);
    setFotoURL(URL.createObjectURL(file));
    setAlertInfo({ message: 'Foto selecionada! Clique em "Salvar Alterações" para confirmar.', type: 'success' });
  };

  const formatCelular = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    const part1 = digits.slice(0, 2);
    const part2 = digits.slice(2, 7);
    const part3 = digits.slice(7, 11);
    if (digits.length > 7) return `(${part1}) ${part2}-${part3}`;
    if (digits.length > 2) return `(${part1}) ${part2}`;
    if (digits.length > 0) return `(${part1}`;
    return '';
  };




  if (authLoading) return <div className="min-h-screen flex items-center justify-center nt-page-bg"><div className="relative z-10 animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div></div>;

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden nt-page-bg transition-colors duration-200 relative text-txt">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-deep/10 rounded-full blur-3xl"></div>
      </div>
      {alertInfo && <Alert message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo(null)} />}
      {/* ThemeToggle removed */}
      <header className="relative w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 bg-surface-card/80 backdrop-blur-md shadow-sm border-b border-hairline min-h-[56px] md:h-20 z-20">
        <button onClick={() => navigate(-1)} className="text-txt-dim hover:text-brand-lite hover:bg-surface-2 px-4 py-2 rounded-lg transition-all font-medium text-xs md:text-sm flex items-center gap-1 shrink-0 z-10 backdrop-blur-sm"><ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Voltar</span></button>
        <Link to="/" className="hidden sm:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2">
          <img
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"}
            alt="Logo"
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg"
          />
        </Link>
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0 z-10">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-brand bg-surface-2 flex items-center justify-center shrink-0">
            {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" /> : <User size={16} className="md:w-5 md:h-5 text-txt-faint" />}
          </div>
          <span className="text-xs md:text-sm font-medium text-txt hidden sm:block truncate max-w-[60px] sm:max-w-[100px] md:max-w-none"><span className="hidden md:inline">Olá, </span>{primeiroNome}</span>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-start p-4 md:p-8 relative z-10">
        <div className="w-full max-w-2xl nt-glass overflow-hidden mb-10">
            <div className="h-32 bg-gradient-to-r from-brand-lite via-brand to-brand-deep relative"></div>
            <div className="px-8 pb-8">
                <div className="relative -mt-16 mb-6 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-surface-2 flex items-center justify-center shadow-lg group relative">
                          {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Foto de perfil" /> : <User size={48} className="text-txt-faint" />}
                          <label htmlFor="foto-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                            <Camera size={24} />
                          </label>
                          <input type="file" id="foto-upload" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                      </div>
                      <label htmlFor="foto-upload" className="mt-3 px-4 py-2 bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white text-sm font-medium rounded-lg cursor-pointer transition-all flex items-center gap-2">
                        <Camera size={16} />
                        Escolher Foto
                      </label>
                </div>
            <h1 className="text-2xl font-bold text-center text-txt mb-1 mt-4">{nome || 'Usuário'}</h1>
            <p className="text-sm text-center text-txt-dim mb-8">{email}</p>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-medium text-txt-dim ml-1">Nome</label><input type="text" value={nome} onChange={e=>setNome(e.target.value)} className="w-full pl-4 py-2 bg-surface-2 border border-hairline rounded-lg placeholder-txt-faint text-txt backdrop-blur-sm transition-all hover:border-hairline-hi focus:ring-2 focus:ring-brand outline-none" placeholder="Seu Nome" /></div>
                    <div><label className="block text-sm font-medium text-txt-dim ml-1">Celular</label><input type="tel" value={celular} onChange={e=>setCelular(formatCelular(e.target.value))} className="w-full pl-4 py-2 bg-surface-2 border border-hairline rounded-lg placeholder-txt-faint text-txt backdrop-blur-sm transition-all hover:border-hairline-hi focus:ring-2 focus:ring-brand outline-none" placeholder="(00) 00000-0000" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-txt-dim ml-1">Email</label><input type="email" value={email} disabled className="w-full pl-4 py-2 bg-surface-2 border border-hairline rounded-lg text-txt-faint cursor-not-allowed" /></div>
                      </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button type="submit" disabled={saving} className="nt-glow-btn flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-lite via-brand to-brand-deep hover:brightness-110 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                      <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors">
                        <LogOut size={18} /> Sair
                      </button>
                    </div>
                </form>
            </div>
        </div>
      </main>
      <footer className="relative z-10 w-full py-6 text-center text-txt-dim text-xs">&copy; 2025 Normatel Engenharia</footer>
    </div>
  );
}

export default Perfil;
