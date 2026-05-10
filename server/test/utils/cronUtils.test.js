const { expect } = require('chai')
const { buildCronSchedule, detectFrequency } = require('../../src/utils/cronUtils')

// Use local-time date construction (new Date(y, m, d, h, min)) so that
// getHours()/getMinutes() in the implementation return the values we expect,
// regardless of the machine's timezone offset.

describe('buildCronSchedule', () => {
  describe('every 1 minute', () => {
    it('returns wildcard expression regardless of creation time', () => {
      expect(buildCronSchedule(1, new Date(2024, 0, 1, 3, 33))).to.equal('* * * * *')
      expect(buildCronSchedule(1, new Date(2024, 0, 1, 0, 0))).to.equal('* * * * *')
    })
  })

  describe('sub-hour frequencies (< 60 min)', () => {
    it('anchors 10-min schedule to creation minute so first fire is exactly 10m away', () => {
      // Created at :33 → anchor = 33 % 10 = 3 → fires :03, :13, :23, :33, :43, :53
      const cron = buildCronSchedule(10, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('3/10 * * * *')
    })

    it('anchors 5-min schedule correctly', () => {
      // Created at :33 → anchor = 33 % 5 = 3 → fires :03, :08, :13, ..., :58
      const cron = buildCronSchedule(5, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('3/5 * * * *')
    })

    it('anchors 15-min schedule correctly', () => {
      // Created at :33 → anchor = 33 % 15 = 3 → fires :03, :18, :33, :48
      const cron = buildCronSchedule(15, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('3/15 * * * *')
    })

    it('anchors 30-min schedule correctly', () => {
      // Created at :33 → anchor = 33 % 30 = 3 → fires :03, :33
      const cron = buildCronSchedule(30, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('3/30 * * * *')
    })

    it('uses anchor 0 when creation minute is already aligned', () => {
      // Created at :20, freq=10 → 20 % 10 = 0 → fires :00, :10, :20, :30, :40, :50
      const cron = buildCronSchedule(10, new Date(2024, 0, 1, 3, 20))
      expect(cron).to.equal('0/10 * * * *')
    })

    it('anchors correctly when creation minute is 0', () => {
      const cron = buildCronSchedule(15, new Date(2024, 0, 1, 8, 0))
      expect(cron).to.equal('0/15 * * * *')
    })
  })

  describe('60-minute (hourly) frequency', () => {
    it('fires at the exact minute of creation, every hour', () => {
      const cron = buildCronSchedule(60, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('33 * * * *')
    })

    it('handles minute 0 correctly', () => {
      const cron = buildCronSchedule(60, new Date(2024, 0, 1, 5, 0))
      expect(cron).to.equal('0 * * * *')
    })
  })

  describe('multi-hour frequencies (180, 360, 720 min)', () => {
    it('anchors 3-hour schedule to creation hour', () => {
      // Local 3:33 → anchorHour = 3 % 3 = 0 → fires at hours 0, 3, 6, 9, ...
      const cron = buildCronSchedule(180, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('33 0/3 * * *')
    })

    it('anchors 3-hour schedule when hour is not aligned to interval', () => {
      // Local 14:45 → anchorHour = 14 % 3 = 2 → fires at hours 2, 5, 8, 11, 14, 17, 20, 23
      const cron = buildCronSchedule(180, new Date(2024, 0, 1, 14, 45))
      expect(cron).to.equal('45 2/3 * * *')
    })

    it('anchors 6-hour schedule correctly', () => {
      // Local 14:33 → anchorHour = 14 % 6 = 2 → fires at hours 2, 8, 14, 20
      const cron = buildCronSchedule(360, new Date(2024, 0, 1, 14, 33))
      expect(cron).to.equal('33 2/6 * * *')
    })

    it('anchors 12-hour schedule correctly', () => {
      // Local 3:33 → anchorHour = 3 % 12 = 3 → fires at hours 3, 15
      const cron = buildCronSchedule(720, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('33 3/12 * * *')
    })
  })

  describe('24-hour (daily) frequency', () => {
    it('fires once per day at creation time', () => {
      const cron = buildCronSchedule(1440, new Date(2024, 0, 1, 3, 33))
      expect(cron).to.equal('33 3 * * *')
    })

    it('handles midnight correctly', () => {
      const cron = buildCronSchedule(1440, new Date(2024, 0, 1, 0, 0))
      expect(cron).to.equal('0 0 * * *')
    })
  })

  describe('defaults createdAt to now when omitted', () => {
    it('returns a valid cron string without explicit createdAt', () => {
      const cron = buildCronSchedule(10)
      expect(cron).to.match(/^\d+\/10 \* \* \* \*$/)
    })
  })
})

describe('detectFrequency', () => {
  it('returns 5 for null/undefined input', () => {
    expect(detectFrequency(null)).to.equal(5)
    expect(detectFrequency(undefined)).to.equal(5)
    expect(detectFrequency('')).to.equal(5)
  })

  it('detects every-minute frequency', () => {
    expect(detectFrequency('* * * * *')).to.equal(1)
  })

  it('detects sub-hour frequencies from anchor/step format', () => {
    expect(detectFrequency('3/5 * * * *')).to.equal(5)
    expect(detectFrequency('3/10 * * * *')).to.equal(10)
    expect(detectFrequency('3/15 * * * *')).to.equal(15)
    expect(detectFrequency('3/30 * * * *')).to.equal(30)
    expect(detectFrequency('0/10 * * * *')).to.equal(10)
  })

  it('detects legacy */N sub-hour format', () => {
    expect(detectFrequency('*/5 * * * *')).to.equal(5)
    expect(detectFrequency('*/10 * * * *')).to.equal(10)
  })

  it('detects hourly frequency (plain minute field)', () => {
    expect(detectFrequency('33 * * * *')).to.equal(60)
    expect(detectFrequency('0 * * * *')).to.equal(60)
  })

  it('detects multi-hour frequencies', () => {
    expect(detectFrequency('33 0/3 * * *')).to.equal(180)
    expect(detectFrequency('33 2/6 * * *')).to.equal(360)
    expect(detectFrequency('33 3/12 * * *')).to.equal(720)
  })

  it('detects daily frequency', () => {
    expect(detectFrequency('33 3 * * *')).to.equal(1440)
    expect(detectFrequency('0 0 * * *')).to.equal(1440)
  })

  describe('round-trips with buildCronSchedule', () => {
    const cases = [1, 5, 10, 15, 30, 60, 180, 360, 720, 1440]
    const anchor = new Date(2024, 0, 1, 14, 33)  // local 14:33

    cases.forEach(freq => {
      it(`round-trips ${freq} minutes`, () => {
        const cron = buildCronSchedule(freq, anchor)
        const detected = detectFrequency(cron)
        expect(detected).to.equal(freq)
      })
    })
  })
})
