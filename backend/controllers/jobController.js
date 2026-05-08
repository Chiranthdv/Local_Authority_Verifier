const jobService = require("../services/jobService");

function handleJobError(res, error, fallbackMessage) {
  if (error instanceof jobService.JobServiceError) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...error.details
    });
  }

  return res.status(500).json({ error: fallbackMessage });
}

async function createJobRequest(req, res) {
  try {
    const result = await jobService.createJob(
      req.user.userId,
      req.validatedBody.workerId,
      req.validatedBody,
      { idempotencyKey: req.idempotencyKey }
    );

    return res.status(result.created ? 201 : 200).json({
      ...(result.job.toObject ? result.job.toObject() : result.job),
      ...(result.idempotentReplay ? { idempotentReplay: true } : {})
    });
  } catch (error) {
    return handleJobError(res, error, "Could not create job request");
  }
}

async function listCustomerRequests(req, res) {
  try {
    const jobs = await jobService.listCustomerJobs(req.user.userId, req.validatedQuery?.status);
    return res.json(jobs);
  } catch (error) {
    return handleJobError(res, error, "Could not load requests");
  }
}

async function listWorkerInbox(req, res) {
  try {
    const jobs = await jobService.listWorkerJobs(req.user.userId, req.validatedQuery?.status);
    return res.json(jobs);
  } catch (error) {
    return handleJobError(res, error, "Could not load worker inbox");
  }
}

async function acceptRequest(req, res) {
  try {
    const job = await jobService.acceptJob(req.validatedParams.id, req.user.userId);
    return res.json(job);
  } catch (error) {
    return handleJobError(res, error, "Could not accept request");
  }
}

async function rejectRequest(req, res) {
  try {
    const job = await jobService.rejectJob(
      req.validatedParams.id,
      req.user.userId,
      req.validatedBody.reason
    );
    return res.json(job);
  } catch (error) {
    return handleJobError(res, error, "Could not reject request");
  }
}

async function completeRequest(req, res) {
  try {
    const job = await jobService.completeJob(req.validatedParams.id, req.user);
    return res.json(job);
  } catch (error) {
    return handleJobError(res, error, "Could not complete request");
  }
}

async function cancelRequest(req, res) {
  try {
    const job = await jobService.cancelJob(req.validatedParams.id, req.user.userId, req.user.role);
    return res.json(job);
  } catch (error) {
    return handleJobError(res, error, "Could not cancel request");
  }
}

function listTimeSlots(req, res) {
  return res.json(jobService.getTimeSlots());
}

module.exports = {
  createJobRequest,
  listCustomerRequests,
  listWorkerInbox,
  acceptRequest,
  rejectRequest,
  completeRequest,
  cancelRequest,
  listTimeSlots
};
