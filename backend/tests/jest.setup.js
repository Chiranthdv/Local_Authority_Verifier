process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || "10";
process.env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS = process.env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS || "3";
process.env.AUTH_ACCOUNT_LOCK_MINUTES = process.env.AUTH_ACCOUNT_LOCK_MINUTES || "1";
process.env.COOLDOWN_BOOKING_MS = process.env.COOLDOWN_BOOKING_MS || "0";
process.env.REDIS_ENABLED = "false";
