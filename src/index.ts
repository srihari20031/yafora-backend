import express from 'express';
import userRoutes from './routes/userRouter';
import wishListRoutes from './routes/wishlistRouter'
import profileRoutes from './routes/profileRouter';
import productRoutes from './routes/productRouter';
import cartRoutes from './routes/cartRouter';
import cors from 'cors';

const app = express();

// CORS Configuration - Fixed for credentials
interface CorsOptions {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  optionsSuccessStatus: number;
}

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins - make sure these match exactly
    const allowedOrigins: string[] = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://yafora.vercel.app', // Your exact frontend URL
      // Add any other domains you might use
    ];
    
    console.log('CORS Origin check:', origin); // Debug log
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true, // This is crucial for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Set-Cookie'], // Important for cookie handling
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false, // Pass control to next handler
};


// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Mount your routes
app.use('/auth', userRoutes);
app.use('/api', wishListRoutes);
app.use('/api', profileRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the API'); 
});

// Start server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;