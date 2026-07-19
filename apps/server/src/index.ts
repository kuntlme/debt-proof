import express, { Express } from "express";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import tokenRoutes from "./routes/token.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import loanRequestRoutes from "./routes/loanRequest.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import bankAccountRoutes from "./routes/bankAccount.routes.js";

const app: Express = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://debt-proof-client.vercel.app",
];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    const isAllowed = allowedOrigins.some(allowed => {
      return allowed.replace(/\/$/, "") === normalizedOrigin;
    }) || 
    normalizedOrigin.endsWith(".vercel.app") || 
    /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
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
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`🚀 DebtProof server running on port ${PORT}`);
  });
}