import express from "express";
const app = express();
app.use(express.json())

app.get("/health", (req, res) => {
    return res.json({heath: "good"});
})

app.listen(8080, () => {
    console.log("listening the port");
})