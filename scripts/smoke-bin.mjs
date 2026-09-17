import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'

const child = spawn(process.execPath, [resolve('lib/bin.js')], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
})

let stdout = ''
let stderr = ''
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', (chunk) => { stdout += chunk })
child.stderr.on('data', (chunk) => { stderr += chunk })

const timeout = setTimeout(() => {
  child.kill('SIGKILL')
}, 3_000)

const exit = once(child, 'exit')
const readiness = await Promise.race([
  once(child, 'message').then(([message]) => ({ kind: 'ready', message })),
  exit.then(([code, signal]) => ({ kind: 'exit', code, signal })),
])

if (readiness.kind === 'exit') {
  clearTimeout(timeout)
  throw new Error(
    `Repository bin exited before readiness (code=${String(readiness.code)}, signal=${String(readiness.signal)}).\n${stderr}`,
  )
}
if (readiness.message !== 'ready') {
  child.kill('SIGKILL')
  await exit
  clearTimeout(timeout)
  throw new Error(`Repository bin emitted unexpected readiness message: ${String(readiness.message)}`)
}

child.kill('SIGTERM')
const [code, signal] = await exit
clearTimeout(timeout)

if (code !== 0 || signal !== null) {
  throw new Error(
    `Repository bin did not exit cleanly after SIGTERM (code=${String(code)}, signal=${String(signal)}).\n${stderr}`,
  )
}
if (stdout !== '' || stderr !== '') {
  throw new Error(`Repository bin emitted unexpected output.\nstdout:\n${stdout}\nstderr:\n${stderr}`)
}

process.stdout.write('Repository executable smoke test passed.\n')
