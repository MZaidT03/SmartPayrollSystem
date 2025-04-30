const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const nodemailer = require("nodemailer");
const ethers = require("ethers");
require("dotenv").config();

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

// Email configuration using nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "muhammadzaidtahir90@gmail.com",
    pass: "bpvd yvhm jxxf xqhq", // Replace with new App Password if needed
  },
});

// Function to send email with retry logic
const sendEmailWithRetry = async (mailOptions, retries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err) {
      console.error(`Attempt ${attempt} failed to send email:`, err);
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Smart contract configuration
const CONTRACT_ADDRESS = "0xa0831742B01287Edae3e6CdC16Db3F86c4CF15ca";
const ABI = [
  "function owner() view returns (address)",
  "function salaries(address) view returns (uint256)",
  "function paymentStatus(address) view returns (bool)",
  "function setSalary(address employee, uint256 salary) external",
  "function paySalary(address employee) external payable",
  "function resetPaymentStatus(address employee) external",
  "function fundContract() external payable",
  "function getContractBalance() external view returns (uint256)",
  "function getPaymentHistory(address employee) external view returns (tuple(address employee, uint256 amount, uint256 timestamp, bytes32 txHash)[])",
  "event PaymentSent(address indexed employee, uint256 amount, uint256 timestamp)",
  "event SalarySet(address indexed employee, uint256 salary)",
];

// Validate SEPOLIA_RPC_URL
if (!process.env.SEPOLIA_RPC_URL) {
  console.error("Error: SEPOLIA_RPC_URL is not defined in .env");
  process.exit(1);
}
console.log("Using SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL);

let provider;
try {
  provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
} catch (err) {
  console.error("Failed to initialize Ethereum provider:", err);
  process.exit(1);
}

const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Test contract connection
(async () => {
  try {
    const owner = await contract.owner();
    console.log("Contract owner:", owner);
  } catch (err) {
    console.error("Failed to connect to smart contract:", err);
    process.exit(1);
  }
})();

// Test endpoint to fetch payment history for a specific address
app.get("/test-payment-history", async (req, res) => {
  try {
    const employeeAddress = "0x111222333444555666777888999aAabbbCccDdD0";
    console.log(
      `Fetching payment history for test address: ${employeeAddress}`
    );
    const history = await contract.getPaymentHistory(employeeAddress);
    console.log(`Payment history for ${employeeAddress}:`, history);

    const formattedHistory = history.map((payment) => ({
      employee: payment.employee,
      amount: ethers.formatEther(payment.amount),
      timestamp: new Date(Number(payment.timestamp) * 1000).toISOString(),
      txHash: payment.txHash.toString(),
    }));
    res.json(formattedHistory);
  } catch (err) {
    console.error("GET /test-payment-history error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint to send a test email
app.get("/test-email", async (req, res) => {
  try {
    const mailOptions = {
      from: "muhammadzaidtahir90@gmail.com",
      to: "muhammadzaidtahir90@gmail.com",
      subject: "Test Email from Smart Payroll",
      text: "This is a test email from the Smart Payroll System.",
      html: "<h1>Test Email</h1><p>This is a test email from the Smart Payroll System.</p>",
    };
    await sendEmailWithRetry(mailOptions);
    res.json({ message: "Test email sent successfully" });
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Function to check if an event has been processed
const hasEventBeenProcessed = async (txHash) => {
  const result = await pool.query(
    "SELECT tx_hash FROM processed_events WHERE tx_hash = $1",
    [txHash]
  );
  return result.rows.length > 0;
};

// Function to mark an event as processed
const markEventAsProcessed = async (txHash, eventType) => {
  await pool.query(
    "INSERT INTO processed_events (tx_hash, event_type) VALUES ($1, $2) ON CONFLICT (tx_hash) DO NOTHING",
    [txHash, eventType]
  );
};

// Function to process PaymentSent event
const processPaymentSentEvent = async (employee, amount, timestamp, event) => {
  try {
    const txHash = event.transactionHash;
    const hasBeenProcessed = await hasEventBeenProcessed(txHash);
    if (hasBeenProcessed) {
      console.log(
        `PaymentSent event with txHash ${txHash} already processed, skipping...`
      );
      return;
    }

    const result = await pool.query(
      "SELECT name, email FROM employees WHERE wallet_address ILIKE $1",
      [employee]
    );
    const employeeData = result.rows[0];
    if (employeeData && employeeData.email) {
      const mailOptions = {
        from: "muhammadzaidtahir90@gmail.com",
        to: employeeData.email,
        subject: "Salary Payment Notification",
        text: `Dear ${
          employeeData.name
        },\n\nYour salary of ${ethers.formatEther(
          amount
        )} ETH has been paid on ${new Date(
          Number(timestamp) * 1000
        ).toISOString()}.\n\nBest regards,\nSmart Payroll System`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Salary Payment Notification</h2>
            <p>Dear ${employeeData.name},</p>
            <p>Your salary of <strong>${ethers.formatEther(
              amount
            )} ETH</strong> has been paid on <strong>${new Date(
          Number(timestamp) * 1000
        ).toISOString()}</strong>.</p>
            <p>Thank you for your hard work!</p>
            <p style="margin-top: 20px;">Best regards,<br>Smart Payroll System</p>
            <footer style="margin-top: 20px; font-size: 12px; color: #777;">
              <p>Transaction Hash: ${txHash}</p>
              <p>© 2025 Smart Payroll System. All rights reserved.</p>
            </footer>
          </div>
        `,
      };
      await sendEmailWithRetry(mailOptions);
      await markEventAsProcessed(txHash, "PaymentSent");
      console.log(`Payment email sent to ${employeeData.email}`);
    } else {
      console.log(`No email found for employee ${employee}`);
    }
  } catch (err) {
    console.error("Error sending payment email:", err);
  }
};

// Function to process SalarySet event
const processSalarySetEvent = async (employee, salary, event) => {
  try {
    const txHash = event.transactionHash;
    const hasBeenProcessed = await hasEventBeenProcessed(txHash);
    if (hasBeenProcessed) {
      console.log(
        `SalarySet event with txHash ${txHash} already processed, skipping...`
      );
      return;
    }

    const result = await pool.query(
      "SELECT name, email FROM employees WHERE wallet_address ILIKE $1",
      [employee]
    );
    const employeeData = result.rows[0];
    if (employeeData && employeeData.email) {
      const mailOptions = {
        from: "muhammadzaidtahir90@gmail.com",
        to: employeeData.email,
        subject: "Salary Update Notification",
        text: `Dear ${
          employeeData.name
        },\n\nYour salary has been updated to ${ethers.formatEther(
          salary
        )} ETH.\n\nBest regards,\nSmart Payroll System`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Salary Update Notification</h2>
            <p>Dear ${employeeData.name},</p>
            <p>Your salary has been updated to <strong>${ethers.formatEther(
              salary
            )} ETH</strong>.</p>
            <p>If you have any questions, please contact the HR department.</p>
            <p style="margin-top: 20px;">Best regards,<br>Smart Payroll System</p>
            <footer style="margin-top: 20px; font-size: 12px; color: #777;">
              <p>© 2025 Smart Payroll System. All rights reserved.</p>
            </footer>
          </div>
        `,
      };
      await sendEmailWithRetry(mailOptions);
      await markEventAsProcessed(txHash, "SalarySet");
      console.log(`Salary update email sent to ${employeeData.email}`);
    } else {
      console.log(`No email found for employee ${employee}`);
    }
  } catch (err) {
    console.error("Error sending salary update email:", err);
  }
};

// Sync past events on startup
(async () => {
  try {
    console.log("Syncing past PaymentSent events...");
    const fromBlock = 0; // Adjust this to a more recent block if needed
    const toBlock = "latest";
    const paymentSentEvents = await contract.queryFilter(
      contract.filters.PaymentSent(),
      fromBlock,
      toBlock
    );
    console.log(`Found ${paymentSentEvents.length} past PaymentSent events`);
    for (const event of paymentSentEvents) {
      const { employee, amount, timestamp } = event.args;
      await processPaymentSentEvent(employee, amount, timestamp, event);
    }

    console.log("Syncing past SalarySet events...");
    const salarySetEvents = await contract.queryFilter(
      contract.filters.SalarySet(),
      fromBlock,
      toBlock
    );
    console.log(`Found ${salarySetEvents.length} past SalarySet events`);
    for (const event of salarySetEvents) {
      const { employee, salary } = event.args;
      await processSalarySetEvent(employee, salary, event);
    }
  } catch (err) {
    console.error("Error syncing past events:", err);
  }
})();

// Listen for new PaymentSent and SalarySet events
contract.on("PaymentSent", processPaymentSentEvent);
contract.on("SalarySet", processSalarySetEvent);

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
  const { employee_id, name, wallet_address, salary, email } = req.body;
  try {
    await pool.query(
      "INSERT INTO employees (employee_id, name, wallet_address, salary, email) VALUES ($1, $2, $3, $4, $5)",
      [employee_id, name, wallet_address, salary, email]
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
  const { name, wallet_address, salary, email } = req.body;
  try {
    const result = await pool.query(
      "UPDATE employees SET name = $1, wallet_address = $2, salary = $3, email = $4 WHERE employee_id = $5",
      [name, wallet_address, salary, email, id]
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

// Get payment history for all employees
app.get("/payment-history", async (req, res) => {
  try {
    console.log("Fetching payment history...");
    const employeesResult = await pool.query("SELECT * FROM employees");
    const employees = employeesResult.rows;
    if (employees.length === 0) {
      console.log("No employees found in the database.");
      res.json([]);
      return;
    }
    console.log("Employees:", employees);

    const paymentHistory = [];
    for (const employee of employees) {
      console.log(
        `Fetching payment history for employee: ${employee.wallet_address}`
      );
      let history;
      try {
        history = await contract.getPaymentHistory(employee.wallet_address);
        console.log(`Payment history for ${employee.wallet_address}:`, history);
      } catch (err) {
        console.error(
          `Error fetching payment history for ${employee.wallet_address}:`,
          err
        );
        continue;
      }

      for (const payment of history) {
        try {
          console.log(
            `Processing payment for ${employee.wallet_address}:`,
            payment
          );
          paymentHistory.push({
            employee_id: employee.employee_id,
            name: employee.name,
            wallet_address: employee.wallet_address,
            amount: ethers.formatEther(payment.amount),
            timestamp: new Date(Number(payment.timestamp) * 1000).toISOString(),
            txHash: payment.txHash.toString(),
          });
        } catch (err) {
          console.error(
            `Error processing payment for ${employee.wallet_address}:`,
            err
          );
        }
      }
    }

    console.log("Final payment history:", paymentHistory);
    res.json(paymentHistory);
  } catch (err) {
    console.error("GET /payment-history error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
