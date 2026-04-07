const Review = require("../models/Review");
const Job = require("../models/Job");

async function calculateTrustScore(workerId) {
  const reviews = await Review.find({ workerId });
  const jobs = await Job.find({ workerId, status: "completed" });

  let score = 50;
  score += Math.min(jobs.length * 10, 30);
  const fiveStars = reviews.filter((review) => review.rating === 5).length;
  score += Math.min(fiveStars * 5, 20);

  return Math.min(Math.max(score, 0), 100);
}

module.exports = calculateTrustScore;
