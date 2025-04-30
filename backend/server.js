const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  user: "payroll_user",
  password: "SmartPayroll2025",
  host: "localhost",
  port: 5432,
  database: "smart_payroll",
});

// Test database connection
pool.connect((err) => {
  if (err) {
    console.error("Database connection error:", err.stack);
  } else {
    console.log("Connected to the database");
  }
});

// Get all employees
app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees");
    res.json(result.rows);
  } catch (err) {
    console.error("GET /employees error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new employee
app.post("/employees", async (req, res) => {
  const { employee_id, name, wallet_address, salary } = req.body;
  try {
    await pool.query(
      "INSERT INTO employees (employee_id, name, wallet_address, salary) VALUES ($1, $2, $3, $4)",
      [employee_id, name, wallet_address, salary]
    );
    res.status(201).json({ message: "Employee added successfully" });
  } catch (err) {
    console.error("POST /employees error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update an employee
app.put("/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, wallet_address, salary } = req.body;
  try {
    const result = await pool.query(
      "UPDATE employees SET name = $1, wallet_address = $2, salary = $3 WHERE employee_id = $4",
      [name, wallet_address, salary, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error("PUT /employees/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete an employee
app.delete("/employees/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM employees WHERE employee_id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("DELETE /employees/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
