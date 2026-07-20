const dashboardService = require('../services/dashboard.service')

async function getDashboardSummary(req, res, next) {
  try {
    const summary = await dashboardService.getDashboardSummary()
    res.status(200).json({ success: true, ...summary })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

module.exports = { getDashboardSummary }
