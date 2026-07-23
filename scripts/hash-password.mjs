import { randomBytes, pbkdf2Sync } from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: npm run hash-password -- <password>')
  process.exit(1)
}

const ITERATIONS = 100_000
const salt = randomBytes(16)
const derived = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')

console.log(`${salt.toString('hex')}:${derived.toString('hex')}`)
