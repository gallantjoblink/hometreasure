import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'customer' | 'seller' | 'admin';
  createdAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            let userData = userDoc.data() as UserProfile;
            const adminEmails = ['gallantsystem@gmail.com', 'gallantjoblink@gmail.com'];
            if (adminEmails.includes(currentUser.email || '') && userData.role !== 'admin') {
              userData.role = 'admin';
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
            }
            setProfile(userData);
          } else {
            // Create new user profile
            const adminEmails = ['gallantsystem@gmail.com', 'gallantjoblink@gmail.com'];
            const defaultRole = adminEmails.includes(currentUser.email || '') ? 'admin' : 'seller';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || 'Anonymous User',
              role: defaultRole,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
