import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

const AUTH_DEFAULT = { currentUser: null, userProfile: null, loading: true };

const AuthContext = createContext(AUTH_DEFAULT);

export const useAuth = () => useContext(AuthContext) ?? AUTH_DEFAULT;

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile = () => {};

    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();

      if (user) {
        setCurrentUser(user);
        const docRef = doc(db, 'usuarios', user.uid);

        // Atualiza lastSeen UMA VEZ no login — nunca dentro do onSnapshot
        // (colocar dentro do onSnapshot cria loop infinito: write → snapshot → write → ...)
        updateDoc(docRef, { lastSeen: serverTimestamp() }).catch(() => {});

        unsubscribeProfile = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data());
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          () => setLoading(false)
        );
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  // useMemo evita recriar o objeto de contexto a cada render do AuthProvider,
  // reduzindo re-renders desnecessários em todos os consumidores de useAuth()
  const value = useMemo(
    () => ({ currentUser, userProfile, loading }),
    [currentUser, userProfile, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
