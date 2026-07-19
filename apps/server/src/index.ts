import express from "express";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import tokenRoutes from "./routes/token.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import loanRequestRoutes from "./routes/loanRequest.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import bankAccountRoutes from "./routes/bankAccount.routes.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));

// Parse JSON bodies globally.
// NOTE: /payments/webhook overrides this with express.raw() at route level
// so HMAC signature verification still works correctly.
app.use(express.json());

app.use('/payments', paymentRoutes);

app.use('/users', userRoutes);
app.use('/tokens', tokenRoutes);
app.use('/loans', loanRoutes);
app.use('/transactions', transactionRoutes);
app.use('/loan-requests', loanRequestRoutes);
app.use('/bank-accounts', bankAccountRoutes);

app.get("/health", (_req, res) => {
  return res.json({ health: "good", timestamp: new Date().toISOString() });
});

// Export for Vercel serverless handler
export default app;

// Start the server when run directly (local dev)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 DebtProof server running on port ${PORT}`);
});