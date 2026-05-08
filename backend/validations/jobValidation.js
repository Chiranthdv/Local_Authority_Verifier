const { z } = require("zod");

const createJobSchema = z.object({
  workerId: z.string().trim().min(1, "workerId is required"),
  serviceDate: z.string().trim().optional(),
  date: z.string().trim().optional(),
  timeSlotCode: z.string().trim().min(1, "timeSlotCode is required"),
  description: z.string().trim().max(1000).optional().default(""),
  address: z.string().trim().max(1000).optional().default("")
}).refine((data) => Boolean(data.serviceDate || data.date), {
  message: "Valid serviceDate is required",
  path: ["serviceDate"]
});

const rejectJobSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(500)
});

const jobIdParamSchema = z.object({
  id: z.string().trim().min(1, "id is required")
});

const statusQuerySchema = z.object({
  status: z.string().trim().optional()
});

function formatValidationError(result) {
  return result.error.issues[0]?.message || "Invalid request";
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: formatValidationError(result) });
    }

    req.validatedBody = result.data;
    return next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params || {});
    if (!result.success) {
      return res.status(400).json({ error: formatValidationError(result) });
    }

    req.validatedParams = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query || {});
    if (!result.success) {
      return res.status(400).json({ error: formatValidationError(result) });
    }

    req.validatedQuery = result.data;
    return next();
  };
}

module.exports = {
  validateCreateJob: validateBody(createJobSchema),
  validateRejectJob: validateBody(rejectJobSchema),
  validateJobIdParam: validateParams(jobIdParamSchema),
  validateStatusQuery: validateQuery(statusQuerySchema)
};
