import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

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

        unsubscribeProfile = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data());
              updateDoc(docRef, { lastSeen: serverTimestamp() }).catch(() => {});
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

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
