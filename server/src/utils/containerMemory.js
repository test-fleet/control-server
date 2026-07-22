const fs = require('fs')
const os = require('os')

// os.totalmem()/os.freemem() report the host's memory, not the container's
// cgroup limit/usage — inside Docker that makes the numbers reflect every
// process on the box, not just this one. Read cgroup accounting directly so
// callers can show container-scoped memory instead.
function readContainerMemory() {
  try {
    if (fs.existsSync('/sys/fs/cgroup/memory.current')) {
      const used = parseInt(fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8').trim(), 10)
      const maxRaw = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim()
      const total = maxRaw === 'max' ? os.totalmem() : parseInt(maxRaw, 10)
      return { used, total, scope: 'container' }
    }

    if (fs.existsSync('/sys/fs/cgroup/memory/memory.usage_in_bytes')) {
      const used = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8').trim(), 10)
      const limitRaw = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').trim(), 10)
      const total = limitRaw > os.totalmem() ? os.totalmem() : limitRaw
      return { used, total, scope: 'container' }
    }
  } catch (_) {
    // fall through to host stats below
  }

  return { used: os.totalmem() - os.freemem(), total: os.totalmem(), scope: 'host' }
}

module.exports = { readContainerMemory }
