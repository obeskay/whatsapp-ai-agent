// Secure CORS Configuration
export const getCorsConfig = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://your-dashboard.com',
    'https://your-admin.com'
  ];

  // Add localhost for development only
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3004');
  }

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS policy'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
  };
};
