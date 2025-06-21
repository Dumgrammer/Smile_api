/**
 * Simple in-memory rate limiter middleware
 * Note: For production, consider using a more robust solution with Redis
 */

// Store for rate limiting
const rateLimitStore = new Map();

// Helper to clean up old entries
const cleanupStore = () => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > data.windowMs) {
      rateLimitStore.delete(key);
    }
  }
};

// Schedule cleanup every hour
setInterval(cleanupStore, 60 * 60 * 1000);

/**
 * Rate limiting middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests per window
 * @param {string} options.message - Error message when limit is reached
 * @param {function} options.keyGenerator - Function to generate a unique key for each request
 */
const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes by default
    max = 100, // 100 requests per windowMs by default
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => {
      // IP-based limiting by default
      return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    }
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize or get existing rate limit data
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, {
        count: 0,
        resetTime: now + windowMs,
        windowMs
      });
    }

    const limiter = rateLimitStore.get(key);

    // Reset count if window has expired
    if (now > limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + windowMs;
    }

    // Increment count
    limiter.count++;

    // Calculate remaining and reset headers
    const remaining = Math.max(0, max - limiter.count);
    const reset = Math.max(0, Math.ceil((limiter.resetTime - now) / 1000));

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    // If over limit, send error response
    if (limiter.count > max) {
      return res.status(429).json({
        success: false,
        message
      });
    }

    next();
  };
};

// Configurations for different routes
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again after 15 minutes.'
});

exports.apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 requests per 10 minutes
  message: 'Too many requests from this IP, please try again after 10 minutes.'
});

// Export the main function for custom configurations
exports.rateLimit = rateLimit; 