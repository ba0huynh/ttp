import { seed } from './seed/index.ts'

export { seed }

// Run directly when executed via CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  seed().catch((err) => {
    console.error('❌ Database seeding failed:', err)
    process.exit(1)
  })
}
