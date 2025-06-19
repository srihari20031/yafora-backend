import express from 'express';
import userRoutes from './routes/userRouter';
import wishListRoutes from './routes/wishlistRouter'
import profileRoutes from './routes/profileRouter';
import productRoutes from './routes/productRouter';
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

const corsOptions: CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins: string[] = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://yafora.vercel.app',
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // This is crucial for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Mount your routes
app.use('/auth', userRoutes);
app.use('/api', wishListRoutes);
app.use('/api', profileRoutes);
app.use('/api', productRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the API'); 
});

// Start server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;