import { generateEncryptionKey, encryptString } from '../src/lib/encryption'

async function main() {
  const masterPass = 'personalsats'   // ← your real passphrase

  console.log("Generating key from passphrase…")
  const key = await generateEncryptionKey(masterPass)

  console.log("Encrypting test payload…")
  const encrypted = await encryptString('test', key)

  console.log(`\nNEXT_PUBLIC_SAMPLE_ENCRYPTED_DATA="${encrypted}"\n`)
  console.log("Copy that line into your .env.local")
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})