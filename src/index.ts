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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://yafora.vercel.app'];

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
    console.log('CORS Origin check:', origin); // Debug log
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

// Log all requests for debugging
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, 'Origin:', req.get('Origin'));
  next();
});

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