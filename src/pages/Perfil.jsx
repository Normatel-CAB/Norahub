import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, Camera, LogOut, Save, ArrowLeft, KeyRound } from 'lucide-react';
// ThemeToggle removed: app forced to light mode
import { useTheme } from '../context/ThemeContext';
import Alert from '../components/Alert';
import { auth, db, storage } from '../services/firebase'; 
import { updatePassword, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function Perfil() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [primeiroNome, setPrimeiroNome] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [fotoURL, setFotoURL] = useState(null);
  const [novaFotoFile, setNovaFotoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [isPasswordProvider, setIsPasswordProvider] = useState(false);

  // Revogar blob URL ao desmontar ou trocar de foto, evitando memory leak
  useEffect(() => {
    return () => {
      if (fotoURL?.startsWith('blob:')) URL.revokeObjectURL(fotoURL);
    };
  }, [fotoURL]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigate('/login');
          return;
        }
        
        setNome(currentUser.displayName || '');
        setEmail(currentUser.email || '');
        
        // Verificar se é autenticação por senha (não Microsoft)
        const hasPasswordProvider = currentUser.providerData.some(
          provider => provider.providerId === 'password'
        );
        setIsPasswordProvider(hasPasswordProvider);
        
        // Prioridade: 1. Foto do Auth (Microsoft/Google - sempre tem prioridade), 2. Foto do Firestore (upload manual)
        let initialPhoto = currentUser.photoURL;
        
        if (currentUser.displayName) setPrimeiroNome(currentUser.displayName.split(' ')[0]);
        
        try {
          const docRef = doc(db, 'usuarios', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCelular(data.celular || '');
            if (!currentUser.displayName && data.nome) { setNome(data.nome); setPrimeiroNome(data.nome.split(' ')[0]); }
            
            // Se Auth não tem foto mas Firestore tem (upload manual), use do Firestore
            if (!initialPhoto && data.fotoURL) initialPhoto = data.fotoURL;
          }
        } catch (error) { 
          console.error('Erro ao buscar dados do Firestore:', error); 
        } 
        
        setFotoURL(initialPhoto);
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        setAlertInfo({ message: 'Erro ao carregar perfil. Tente novamente.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  const handleLogout = async () => { await signOut(auth); navigate('/login'); };

  const handleSave = async (e) => {
    e.preventDefault(); 
    setSaving(true); 
    setAlertInfo(null);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setAlertInfo({ message: 'Sessão expirada. Entre novamente.', type: 'error' });
        setSaving(false);
        return;
      }
      
      let downloadURL = fotoURL;
      
      // Se selecionou arquivo, faz upload
      if (novaFotoFile) {
        try {
          const storageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
          const metadata = {
            contentType: novaFotoFile.type,
            customMetadata: { uploadedBy: currentUser.uid, uploadedAt: new Date().toISOString() },
          };
          await uploadBytes(storageRef, novaFotoFile, metadata);
          downloadURL = await getDownloadURL(storageRef);
          setFotoURL(downloadURL);
        } catch (storageError) {
          if (storageError.code === 'storage/unauthorized') {
            setAlertInfo({ message: 'Sem permissão para upload. Verifique as regras do Firebase Storage.', type: 'error' });
          } else if (storageError.code === 'storage/quota-exceeded') {
            setAlertInfo({ message: 'Cota de armazenamento excedida.', type: 'error' });
          } else {
            setAlertInfo({ message: `Erro no upload: ${storageError.message}`, type: 'error' });
          }
          setSaving(false);
          return;
        }
      }

      const firestoreUpdate = { nome, celular, updatedAt: new Date() };
      if (downloadURL) firestoreUpdate.fotoURL = downloadURL;

      if (nome !== currentUser.displayName || (downloadURL && downloadURL !== currentUser.photoURL)) {
        await updateProfile(currentUser, {
          displayName: nome,
          ...(downloadURL && { photoURL: downloadURL }),
        });
        setPrimeiroNome(nome.split(' ')[0]);
      }

      await updateDoc(doc(db, 'usuarios', currentUser.uid), firestoreUpdate);

      if (novaSenha) {
        if (!senhaAtual) throw new Error('senha-atual-vazia');
        if (novaSenha !== confirmarSenha) throw new Error('senhas-nao-batem');
        if (novaSenha.length < 6) throw new Error('senha-curta');
        const credential = EmailAuthProvider.credential(currentUser.email, senhaAtual);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, novaSenha);
        setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      }

      setAlertInfo({ message: 'Perfil atualizado!', type: 'success' });
      setNovaFotoFile(null);
      
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      let msg = "Erro ao atualizar.";
      if (error.message === 'senha-atual-vazia') msg = "Digite a senha atual.";
      if (error.message === 'senhas-nao-batem') msg = "As senhas não conferem.";
      if (error.message === 'senha-curta') msg = "A senha deve ter pelo menos 6 caracteres.";
      if (error.code === 'auth/wrong-password') msg = "Senha atual incorreta.";
      if (error.code === 'auth/requires-recent-login') msg = "Refaça o login para alterar dados sensíveis.";
      setAlertInfo({ message: msg, type: 'error' });
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




  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#57B952]"></div></div>;

  return (
    <div className="min-h-screen w-full flex flex-col font-[Outfit,Poppins] overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-200 relative text-white">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#57B952]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008542]/10 rounded-full blur-3xl"></div>
      </div>
      {alertInfo && <Alert message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo(null)} />}
      {/* ThemeToggle removed */}
      <header className="relative w-full flex items-center justify-between py-3 md:py-6 px-3 md:px-8 bg-white/5 backdrop-blur-md shadow-sm border-b border-white/10 min-h-[56px] md:h-20 z-20">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-[#57B952] hover:bg-white/5 px-4 py-2 rounded-lg transition-all font-medium text-xs md:text-sm flex items-center gap-1 shrink-0 z-10 backdrop-blur-sm"><ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Voltar</span></button>
        <Link to="/" className="hidden sm:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2">
          <img 
            src={isDark ? "/img/Normatel Engenharia_BRANCO.png" : "/img/Normatel Engenharia_PRETO.png"} 
            alt="Logo" 
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-lg" 
          />
        </Link>
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0 z-10">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#57B952] bg-gray-700 flex items-center justify-center shrink-0">
            {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Avatar" /> : <User size={16} className="md:w-5 md:h-5 text-gray-500" />}
          </div>
          <span className="text-xs md:text-sm font-medium text-gray-100 hidden sm:block truncate max-w-[60px] sm:max-w-[100px] md:max-w-none"><span className="hidden md:inline">Olá, </span>{primeiroNome}</span>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-start p-4 md:p-8 relative z-10">
        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden mb-10">
            <div className="h-32 bg-gradient-to-r from-[#57B952] to-green-600 relative"></div>
            <div className="px-8 pb-8">
                <div className="relative -mt-16 mb-6 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-700 flex items-center justify-center shadow-lg group relative">
                          {fotoURL ? <img src={fotoURL} className="w-full h-full object-cover" alt="Foto de perfil" /> : <User size={48} className="text-gray-400" />}
                          <label htmlFor="foto-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                            <Camera size={24} />
                          </label>
                          <input type="file" id="foto-upload" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                      </div>
                      <label htmlFor="foto-upload" className="mt-3 px-4 py-2 bg-[#57B952] hover:bg-green-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                        <Camera size={16} />
                        Escolher Foto
                      </label>
                </div>
            <h1 className="text-2xl font-bold text-center text-white mb-1 mt-4">{nome || 'Usuário'}</h1>
            <p className="text-sm text-center text-gray-200 mb-8">{email}</p>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-medium text-gray-300 ml-1">Nome</label><input type="text" value={nome} onChange={e=>setNome(e.target.value)} className="w-full pl-4 py-2 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-white backdrop-blur-sm transition-all hover:bg-white/15 focus:ring-2 focus:ring-[#57B952] outline-none" placeholder="Seu Nome" /></div>
                    <div><label className="block text-sm font-medium text-gray-300 ml-1">Celular</label><input type="tel" value={celular} onChange={e=>setCelular(formatCelular(e.target.value))} className="w-full pl-4 py-2 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-white backdrop-blur-sm transition-all hover:bg-white/15 focus:ring-2 focus:ring-[#57B952] outline-none" placeholder="(00) 00000-0000" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-200 ml-1">Email</label><input type="email" value={email} disabled className="w-full pl-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed" /></div>
                      </div>
                    
                    {/* Seção de Alterar Senha - Apenas para login com senha */}
                    {isPasswordProvider && (
                      <div className="md:col-span-2 pt-6 border-t border-gray-700">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><KeyRound size={18} className="text-[#57B952]" /> Alterar Senha</h3>
                        <div className="grid gap-4">
                          <div><label className="block text-xs font-medium text-gray-300 ml-1">Senha Atual</label><input type="password" value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} className="w-full pl-4 py-2 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-white backdrop-blur-sm transition-all hover:bg-white/15 focus:ring-2 focus:ring-[#57B952] outline-none" placeholder="Senha atual" /></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium text-gray-300 ml-1">Nova Senha</label><input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} className="w-full pl-4 py-2 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-white backdrop-blur-sm transition-all hover:bg-white/15 focus:ring-2 focus:ring-[#57B952] outline-none" placeholder="Nova senha" /></div>
                            <div><label className="block text-xs font-medium text-gray-300 ml-1">Confirmar Nova Senha</label><input type="password" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} className="w-full pl-4 py-2 bg-white/10 border border-white/20 rounded-lg placeholder-gray-400 text-white backdrop-blur-sm transition-all hover:bg-white/15 focus:ring-2 focus:ring-[#57B952] outline-none" placeholder="Confirmar senha" /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#57B952] hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
      <footer className="w-full py-6 text-center text-gray-300 text-xs">&copy; 2025 Normatel Engenharia</footer>
    </div>
  );
}

export default Perfil;
