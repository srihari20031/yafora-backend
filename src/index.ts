import express from 'express';
import userRoutes from './routes/userRouter';
import wishListRoutes from './routes/wishlistRouter'
import profileRoutes from './routes/profileRouter';
import productRoutes from './routes/productRouter';
import cartRoutes from './routes/cartRouter';
import kycRoutes from './routes/kycRouter';
import adminRoutes from './routes/adminRouter';
import orderRoutes from './routes/orderRouter';
import sellerOrderRoutes from './routes/sellerOrderRoutes';
import reviewRoutes from './routes/reviewRouter';
import promotionRoutes from './routes/promoCodeAndReferralRouter'
import adminDashboardRoutes from './routes/adminDashboardRouter';
import deliveryRotues from './routes/deliveryRouter';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

app.set('trust proxy', 1);

// 1. Basic Express middleware first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Cookie parser BEFORE CORS
app.use(cookieParser());

// 3. DEBUG: Log environment variables
console.log('=== ENVIRONMENT DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ALLOWED_ORIGINS env var:', process.env.ALLOWED_ORIGINS);
console.log('All env vars starting with ALLOWED:', Object.keys(process.env).filter(key => key.includes('ALLOWED')));

// 4. Get allowed origins from environment
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const baseOrigins = [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://yafora.vercel.app',
    'https://shop.yafora.com',
  ];
  
  if (envOrigins) {
    const origins = envOrigins
      .split(',')
      .map(origin => origin.trim().replace(/\/$/, ''))
      .filter(origin => origin.length > 0);
    
    console.log('Origins from env:', origins);
    return [...new Set([...origins, ...baseOrigins])]; // Remove duplicates
  }
  
  console.log('Using fallback origins');
  return baseOrigins;
};

const allowedOrigins = getAllowedOrigins();
console.log('Final allowed origins:', allowedOrigins);

// 5. CORS Configuration with better debugging
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    console.log('=== CORS CHECK ===');
    console.log('Incoming origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      console.log('✅ No origin - allowing (likely server-to-server or mobile app)');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      const match = origin === allowedOrigin;
      console.log(`Comparing "${origin}" === "${allowedOrigin}": ${match}`);
      return match;
    });
    
    if (isAllowed) {
      console.log('✅ Origin allowed');
      callback(null, true);
    } else {
      console.log('❌ Origin blocked');
      console.log('Exact comparison failed. Checking for potential issues:');
      allowedOrigins.forEach(allowed => {
        console.log(`"${origin}" vs "${allowed}"`);
        console.log(`  - Length: ${origin.length} vs ${allowed.length}`);
        console.log(`  - Includes allowed: ${origin.includes(allowed)}`);
        console.log(`  - Allowed includes origin: ${allowed.includes(origin)}`);
      });
      
      // For debugging in production, let's be more permissive temporarily
      if (process.env.NODE_ENV === 'development' || origin.includes('vercel.app')) {
        console.log('🟡 Allowing due to development mode or vercel domain');
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked. Origin: ${origin} not in allowed list: ${allowedOrigins.join(', ')}`));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cookie',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

// 6. Apply CORS middleware
app.use(cors(corsOptions));

// 7. Additional request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Origin header:', req.get('Origin'));
  console.log('Referer header:', req.get('Referer'));
  console.log('User-Agent:', req.get('User-Agent'));
  console.log('---');
  next();
});

// 8. Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    allowedOrigins,
    environment: process.env.NODE_ENV 
  });
});

// 9. Routes
app.use('/auth', userRoutes);
app.use('/api/wishlist', wishListRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/kyc', kycRoutes)
app.use('/api/products', productRoutes);
app.use('/api', cartRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller-orders', sellerOrderRoutes); 
app.use('/api/reviews', reviewRoutes);
app.use('/api/promotions', promotionRoutes)
app.use('/api/admin-dashboard', adminDashboardRoutes);
app.use('/api/delivery', deliveryRotues);

app.get('/', (req, res) => {
  res.send('Welcome to the API'); 
});

// 10. Error handling middleware (should be last)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
});

export default app;