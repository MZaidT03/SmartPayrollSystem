const express = require("express");
const cors = require("cors");
const { initDB, getEmployees, addEmployee } = require("./db");
require("dotenv").config();

const app = express();

// Enable CORS for requests from http://localhost:5173
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

initDB();

app.get("/employees", async (req, res) => {
  const employees = await getEmployees();
  res.json(employees);
});

app.post("/employees", async (req, res) => {
  const { employee_id, name, wallet_address, salary } = req.body;
  const success = await addEmployee(employee_id, name, wallet_address, salary);
  res.status(success ? 201 : 500).json({ success });
});

app.listen(3001, () => {
  console.log("Backend server running on http://localhost:3001");
});
