const db = require("../config/database");
const redis = require("../config/redis");
const { STATUSES } = require("../utils/statusMachine");

// Clears cached stats when application data changes.
// Called by applications.service after create, update, transition, delete.
async function invalidateStatsCache(userId) {
  if (redis) {
    try {
      await redis.del(`stats:overview:${userId}`);
      await redis.del(`stats:weekly:${userId}`);
    } catch (err) {
      // Not critical
    }
  }
}

async function getOverview(userId) {
  if (redis) {
    try {
      const cached = await redis.get(`stats:overview:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Redis down, skip cache
    }
  }

  const rows = await db("applications")
    .where({ user_id: userId })
    .groupBy("status")
    .select("status")
    .count("* as count");

  const byStatus = {};
  STATUSES.forEach((s) => {
    byStatus[s] = 0;
  });

  rows.forEach((row) => {
    byStatus[row.status] = parseInt(row.count, 10);
  });

  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  const passedPhoneScreen =
    byStatus.phone_screen + byStatus.technical +
    byStatus.onsite + byStatus.offer + byStatus.accepted;
  const passedTechnical =
    byStatus.technical + byStatus.onsite + byStatus.offer + byStatus.accepted;
  const passedOnsite = byStatus.onsite + byStatus.offer + byStatus.accepted;
  const passedOffer = byStatus.offer + byStatus.accepted;

  const rate = (numerator, denominator) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

  const conversionRates = {
    applied_to_phone_screen: rate(passedPhoneScreen, byStatus.applied + passedPhoneScreen),
    phone_screen_to_technical: rate(passedTechnical, byStatus.phone_screen + passedTechnical),
    technical_to_onsite: rate(passedOnsite, byStatus.technical + passedOnsite),
    onsite_to_offer: rate(passedOffer, byStatus.onsite + passedOffer),
  };

  const result = {
    total,
    by_status: byStatus,
    conversion_rates: conversionRates,
  };

  // Cache for 5 minutes
  if (redis) {
    try {
      await redis.set(`stats:overview:${userId}`, JSON.stringify(result), "EX", 300);
    } catch (err) {
      // Not critical
    }
  }

  return result;
}

async function getWeekly(userId) {
  if (redis) {
    try {
      const cached = await redis.get(`stats:weekly:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Redis down, skip cache
    }
  }

  const rows = await db("applications")
    .where({ user_id: userId })
    .select(db.raw("DATE_TRUNC('week', created_at)::date as week"))
    .count("* as count")
    .groupBy("week")
    .orderBy("week", "asc");

  // Store result BEFORE returning so we can cache it
  const result = rows.map((row) => ({
    week: row.week,
    count: parseInt(row.count, 10),
  }));

  // Cache for 5 minutes
  if (redis) {
    try {
      await redis.set(`stats:weekly:${userId}`, JSON.stringify(result), "EX", 300);
    } catch (err) {
      // Not critical
    }
  }

  return result;
}

module.exports = {
  getOverview,
  getWeekly,
  invalidateStatsCache,
};