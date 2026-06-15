import express from "express";
import userRoutes from './routes/user.routes'
import tokenRoutes from './routes/token.routes'
import loanRoutes from './routes/loan.routes'
import transactionRoutes from './routes/transaction.routes'

const app = express();
app.use(express.json())
app.use('/users', userRoutes);
app.use('/tokens', tokenRoutes);
app.use('/loans', loanRoutes);
app.use('/transactions', transactionRoutes);

app.get("/health", (req, res) => {
    return res.json({heath: "good"});
})

app.listen(8080, () => {
    console.log("listening the port");
})