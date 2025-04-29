'use client'

import React from 'react'
import { PassphraseProvider, usePassphrase } from '@/lib/passphraseContext'
import PassphraseModal from '@/components/PassphraseModal'

export default function ClientGate({ children }: { children: React.ReactNode }) {
  return (
    <PassphraseProvider>
      <GateContent>{children}</GateContent>
    </PassphraseProvider>
  )
}

function GateContent({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = usePassphrase()
  // Only a client component can call usePassphrase()
  return <>{isUnlocked ? children : <PassphraseModal />}</>
} 