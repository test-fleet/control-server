const mongoose = require('mongoose')
const { SceneResult } = require('../models/results.models')
const runDispatchService = require('../services/runDispatch.service')
const resultsService = require('../services/results.service')

const SWEEP_INTERVAL_MS = 15 * 1000

let timer = null

// Finalizes dispatches whose deadline has passed. Only the zero-report case
// needs a write here — a partial report count is already rendered as
// 'incomplete' live by results.service's aggregation, with no lag and no
// sweep dependency. This just catches the case where nothing exists yet for
// results.service to compute against.
async function sweepOnce() {
  if (mongoose.connection.readyState !== 1) return

  const claimed = await runDispatchService.claimOverdue()

  for (const dispatch of claimed) {
    try {
      const reported = await SceneResult.countDocuments({ runId: dispatch.runId })
      if (reported === 0) {
        await resultsService.recordIncompleteRun(dispatch)
        console.log(`[dispatchSweeper] run ${dispatch.runId} (scene ${dispatch.sceneId}) timed out with zero reports — marked incomplete`)
      }
    } catch (err) {
      console.error(`[dispatchSweeper] failed to finalize run ${dispatch.runId}:`, err)
    }
  }
}

function start() {
  if (timer) return
  timer = setInterval(() => sweepOnce().catch(err => console.error('[dispatchSweeper] tick failed:', err)), SWEEP_INTERVAL_MS)
  timer.unref()
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = { start, stop, sweepOnce }
