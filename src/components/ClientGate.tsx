'use client'

import React from 'react'
import { EncryptionProvider } from '@/context/EncryptionContext'
import PassphraseModal from '@/components/PassphraseModal'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Spinner } from '@/components/Spinner'
import { PassphraseProvider, usePassphrase } from '@/lib/passphraseContext'

export default function ClientGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser()

  // 1) While we're fetching user session, show spinner
  if (isLoading) {
    return <Spinner />
  }
  // 2) If not authenticated, skip encryption and just render login UI
  if (!user) {
    return <>{children}</>
  }
  // 3) Only once authenticated do we enter encryption context
  return (
    <EncryptionProvider>
      <PassphraseProvider>
        <PassphraseGate>{children}</PassphraseGate>
      </PassphraseProvider>
    </EncryptionProvider>
  )
}

function PassphraseGate({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = usePassphrase();
  if (!isUnlocked) {
    return <PassphraseModal />;
  }
  return <>{children}</>;
} 