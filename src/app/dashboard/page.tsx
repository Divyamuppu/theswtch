"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        // No account needed — sign in anonymously so edits + chat have a
        // stable identity for this browser.
        signInAnonymously(auth).catch(() => setError(true));
      }
    });
    return unsub;
  }, []);

  if (error) {
    return (
      <div className="login">
        <div className="login-card">
          <img src="/thswtch-logo.png" alt="thswtch" />
          <h1>Couldn&apos;t connect</h1>
          <p>
            Make sure <b>Anonymous</b> sign-in is enabled in Firebase
            Authentication, then reload.
          </p>
        </div>
      </div>
    );
  }

  if (user === undefined || user === null) {
    return (
      <div className="login">
        <div className="login-card">
          <img src="/thswtch-logo.png" alt="thswtch" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} />;
}
