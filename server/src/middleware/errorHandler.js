export function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  const statusCode = err.status || 500;

  // Only expose message for operational errors (4xx).
  // For 5xx / unexpected errors, send a generic message.
  const message = statusCode < 500 ? err.message : 'Internal server error';

  res.status(statusCode).json({ error: message });
}
