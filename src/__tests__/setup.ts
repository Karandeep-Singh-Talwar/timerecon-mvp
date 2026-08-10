import '@testing-library/jest-dom';

// Explicit test-only key. Application code has no encryption-key fallback.
process.env.TOKEN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
