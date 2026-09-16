#!/usr/bin/env node

import { createRepositoryNode } from './bootstrap.ts'

const signals = ['SIGINT', 'SIGTERM'] as const

async function main(): Promise<void> {
  const node = await createRepositoryNode()

  const shutdownComplete = new Promise<void>((resolve) => {
    let shuttingDown = false

    const shutdown = async () => {
      if (shuttingDown) return
      shuttingDown = true

      for (const signal of signals) {
        process.off(signal, shutdown)
      }

      try {
        await node.dispose()
      } catch (error) {
        console.error('Failed to dispose Repository node cleanly.', error)
        process.exitCode = 1
      } finally {
        resolve()
      }
    }

    for (const signal of signals) {
      process.once(signal, shutdown)
    }
  })

  // Test runners may attach an IPC channel to observe deterministic readiness.
  process.send?.('ready')
  await shutdownComplete
}

main().catch((error) => {
  console.error('Failed to start Repository node.', error)
  process.exitCode = 1
})
