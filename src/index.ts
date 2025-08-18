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
import adminDashboardRouter from './routes/adminDashboardRouter';
import cors from 'cors';
import cookieParser from 'cookie-parser';


const app = express();

app.set('trust proxy', 1);
// 1. Basic Express middleware first
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add this for form data


// 2. Cookie parser BEFORE CORS (important for credential handling)
app.use(cookieParser());

// 3. CORS Configuration
const allowedOrigins = ['https://yafora.vercel.app', 'http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    console.log('CORS Origin check:', origin);
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
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

// 4. Apply CORS middleware
app.use(cors(corsOptions));

// 5. Request logging AFTER CORS (so CORS headers are already set)
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, 'Origin:', req.get('Origin'));
  next();
});

// 6. Routes
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
app.use('/api/admin-dashboard', adminDashboardRouter);

app.get('/', (req, res) => {
  res.send('Welcome to the API'); 
});

// 7. Error handling middleware (should be last)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



export default app;