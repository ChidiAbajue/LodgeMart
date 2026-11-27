// validate(schema) — parses req.body with a zod schema and replaces it with the
// clean (trimmed, lower-cased, unknown-fields-rejected) result. A failure throws
// ZodError, which the error middleware turns into 400 VALIDATION_ERROR.
export const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};

// validateParams(schema) — same for URL params (e.g. /orders/:id must be a uuid).
export const validateParams = (schema) => (req, res, next) => {
  req.params = schema.parse(req.params);
  next();
};
