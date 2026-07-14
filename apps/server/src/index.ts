import express from "express";
import cors from "cors";
import userRoutes from './routes/user.routes';
import tokenRoutes from './routes/token.routes';
import loanRoutes from './routes/loan.routes';
import transactionRoutes from './routes/transaction.routes';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

app.use('/users', userRoutes);
app.use('/tokens', tokenRoutes);
app.use('/loans', loanRoutes);
app.use('/transactions', transactionRoutes);

app.get("/health", (_req, res) => {
  return res.json({ health: "good", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 DebtProof server running on port ${PORT}`);
});