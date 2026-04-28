/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Login } from './components/auth/Login';
import { PanicInterface } from './components/crisis/PanicInterface';
import { CommandCenter } from './components/dashboard/CommandCenter';
import { GuestAssistant } from './components/assistant/GuestAssistant';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(localStorage.getItem('userRole'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newRole = localStorage.getItem('userRole') || 'staff';
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              role: newRole,
              lastSeen: serverTimestamp()
            });
            setRole(newRole);
          } else {
            setRole(userSnap.data().role);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (selectedRole: string) => {
    setRole(selectedRole);
    localStorage.setItem('userRole', selectedRole);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Role based views
  if (role === 'security' || role === 'manager') {
    return <CommandCenter />;
  }

  if (role === 'guest') {
    return <GuestAssistant />;
  }

  return <PanicInterface />;
}

