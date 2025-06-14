import express from 'express';
import userRoutes from './routes/userRouter';
import cors from 'cors'

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Your frontend URL
  credentials: true, // This is crucial for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Mount your routes
app.use('/auth', userRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the API'); 
})
// Start server on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


export default app;