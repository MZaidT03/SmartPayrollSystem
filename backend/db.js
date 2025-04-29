const { Pool } = require("pg");

const pool = new Pool({
  user: "payroll_user",
  password: "SmartPayroll2025",
  host: "localhost",
  port: 5432,
  database: "smart_payroll",
});

async function initDB() {
  try {
    const client = await pool.connect();
    console.log(
      "PostgreSQL pool created, connected to database:",
      process.env.DB_NAME
    );
    const res = await client.query(
      "SELECT current_database(), current_schema()"
    );
    console.log(
      "Current database:",
      res.rows[0].current_database,
      "Current schema:",
      res.rows[0].current_schema
    );
    client.release();
  } catch (error) {
    console.error("Error initializing DB:", error.message, error.stack);
  }
}

async function getEmployees() {
  try {
    console.log("Fetching employees from database:", process.env.DB_NAME);
    const result = await pool.query(
      "SELECT employee_id, name, wallet_address, salary FROM public.employees"
    );
    console.log("Query result:", result.rows);
    return result.rows;
  } catch (error) {
    console.error("Error fetching employees:", error.message, error.stack);
    return [];
  }
}

async function addEmployee(employee_id, name, wallet_address, salary) {
  try {
    console.log("Adding employee:", {
      employee_id,
      name,
      wallet_address,
      salary,
    });
    await pool.query(
      "INSERT INTO public.employees (employee_id, name, wallet_address, salary) VALUES ($1, $2, $3, $4)",
      [employee_id, name, wallet_address, salary]
    );
    console.log("Employee added successfully");
    return true;
  } catch (error) {
    console.error("Error adding employee:", error.message, error.stack);
    return false;
  }
}

module.exports = { initDB, getEmployees, addEmployee };
