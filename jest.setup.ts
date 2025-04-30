// jest.setup.ts

// Set default environment variables for tests

// Client-side
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Server-side (add defaults as needed by imports in test scope)
process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb'; // Dummy DB URL
process.env.NEXT_PUBLIC_EMAIL_PROVIDER = 'none'; // Default to 'none' or a valid provider if needed
process.env.BETTER_AUTH_SECRET = 'test-auth-secret-super-secret-key'; // Dummy secret

// Add any other global setup for tests here if needed
// global.fetch = jest.fn(); 