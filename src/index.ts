import express from "express";

const app = express();
const port = 5005;

// To use json:
app.use(express.json());

app.get("/api/v0", (req, res) => {
  res.json({
    msg: "Hello World!"
  })
});

app.listen(port, () => {
  console.log(`Server started on port ${port}...`);
});