import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            let tentativas = 0;
            let perfil = null;
            while (tentativas < 5 && !perfil) {
              try {
                const docRef = doc(db, 'usuarios', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  setUserProfile(docSnap.data());
                  perfil = docSnap.data();
                } else {
                  tentativas++;
                  await new Promise(res => setTimeout(res, 1000));
                }
              } catch (error) {
                if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
                  tentativas++;
                  await new Promise(res => setTimeout(res, 1000));
                } else {
                  console.error("Erro ao buscar perfil:", error);
                  break;
                }
              }
            }
          } else {
            setCurrentUser(null);
            setUserProfile(null);
          }
          setLoading(false); 
        });
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error("Erro na persistência:", error);
        setLoading(false);
      });
  }, []);

  const value = { currentUser, userProfile, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}