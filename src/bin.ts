#!/usr/bin/env node

import { createRepositoryNode } from './bootstrap.ts'

const signals = ['SIGINT', 'SIGTERM'] as const

async function main(): Promise<void> {
  let requestShutdown!: () => void
  let shutdownRequested = false
  const shutdown = new Promise<void>((resolve) => {
    requestShutdown = () => {
      if (shutdownRequested) return
      shutdownRequested = true
      for (const signal of signals) {
        process.off(signal, requestShutdown)
      }
      resolve()
    }
  })

  for (const signal of signals) {
    process.once(signal, requestShutdown)
  }

  try {
    const node = await createRepositoryNode()

    if (!shutdownRequested) {
      // Test runners may attach an IPC channel to observe deterministic readiness.
      process.send?.('ready')
    }

    await shutdown
    await node.dispose()
  } finally {
    for (const signal of signals) {
      process.off(signal, requestShutdown)
    }
  }
}

main().catch((error) => {
  console.error('Failed to start Repository node.', error)
  process.exitCode = 1
})
