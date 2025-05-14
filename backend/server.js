const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const nodemailer = require("nodemailer");
const ethers = require("ethers");
const cron = require("node-cron");
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

// Email configuration using nodemailer with enhanced logging
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "muhammadzaidtahir90@gmail.com",
    pass: "obit mojs rdbt aars",
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter configuration error:", error);
  } else {
    console.log("Email transporter is ready");
  }
});

// Function to send email with retry logic and detailed logging
const sendEmailWithRetry = async (mailOptions, retries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(
        `Email sent successfully (Attempt ${attempt}):`,
        info.response
      );
      return true;
    } catch (err) {
      console.error(`Attempt ${attempt} failed to send email:`, err);
      if (attempt === retries) {
        console.error("All retry attempts failed:", err);
        throw err;
      }
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

// Validate SEPOLIA_RPC_URL and ADMIN_PRIVATE_KEY
if (!process.env.SEPOLIA_RPC_URL) {
  console.error("Error: SEPOLIA_RPC_URL is not defined in .env");
  process.exit(1);
}
console.log("Using SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL);

let provider, wallet, contract;
try {
  provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  if (process.env.ADMIN_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  } else {
    console.warn("ADMIN_PRIVATE_KEY not set. Scheduled payments disabled.");
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  }
} catch (err) {
  console.error("Failed to initialize Ethereum provider or wallet:", err);
  console.warn("Falling back to read-only mode without scheduled payments.");
  provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

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
const markEventAsProcessed = async (txHash, eventType, blockNumber) => {
  await pool.query(
    "INSERT INTO processed_events (tx_hash, event_type, block_number) VALUES ($1, $2, $3) ON CONFLICT (tx_hash) DO NOTHING",
    [txHash, eventType, blockNumber]
  );
};

// Function to process PaymentSent event and save to payment_history
const processPaymentSentEvent = async (employee, amount, timestamp, event) => {
  try {
    // Ensure the event has a transactionHash
    if (!event || !event.transactionHash) {
      console.error("Invalid PaymentSent event data, skipping...");
      return;
    }

    const txHash = event.transactionHash;
    const hasBeenProcessed = await hasEventBeenProcessed(txHash);
    if (hasBeenProcessed) {
      console.log(
        `PaymentSent event with txHash ${txHash} already processed, skipping...`
      );
      return;
    }

    const result = await pool.query(
      "SELECT employee_id, name, email FROM employees WHERE wallet_address ILIKE $1",
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
      await pool.query(
        "INSERT INTO payment_history (employee_id, wallet_address, amount, timestamp, tx_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING",
        [
          employeeData.employee_id,
          employee,
          ethers.formatEther(amount),
          new Date(Number(timestamp) * 1000).toISOString(),
          txHash,
        ]
      );
      await markEventAsProcessed(txHash, "PaymentSent", event.blockNumber);
      console.log(
        `Payment email sent to ${employeeData.email} and saved to payment_history`
      );
    } else {
      console.log(
        `No email found for employee ${employee}, skipping email but saving to history`
      );
      await pool.query(
        "INSERT INTO payment_history (wallet_address, amount, timestamp, tx_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (tx_hash) DO NOTHING",
        [
          employee,
          ethers.formatEther(amount),
          new Date(Number(timestamp) * 1000).toISOString(),
          txHash,
        ]
      );
      await markEventAsProcessed(txHash, "PaymentSent", event.blockNumber);
    }
  } catch (err) {
    console.error("Error processing PaymentSent event:", err);
  }
};

// Function to process SalarySet event
const processSalarySetEvent = async (employee, salary, event) => {
  try {
    if (!event || !event.transactionHash) {
      console.error("Invalid SalarySet event data, skipping...");
      return;
    }

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
      await markEventAsProcessed(txHash, "SalarySet", event.blockNumber);
      console.log(`Salary update email sent to ${employeeData.email}`);
    } else {
      console.log(`No email found for employee ${employee}, skipping email`);
    }
  } catch (err) {
    console.error("Error sending salary update email:", err);
  }
};

// Function to get the last processed block number
const getLastProcessedBlock = async () => {
  try {
    const result = await pool.query(
      "SELECT COALESCE(MAX(block_number), 0) as last_block FROM processed_events"
    );
    const lastBlock = Number(result.rows[0].last_block) || 0;
    console.log(`Last processed block from DB: ${lastBlock}`);
    return lastBlock;
  } catch (err) {
    console.error("Error fetching last processed block:", err);
    return 0;
  }
};

// Function to get a safe starting block
const getSafeStartingBlock = async () => {
  try {
    const latestBlock = await provider.getBlockNumber();
    console.log(`Latest block number: ${latestBlock}`);
    return Math.max(1, latestBlock - 10000); // Start 10,000 blocks ago, ensure at least block 1
  } catch (err) {
    console.error("Error fetching latest block:", err);
    return 1; // Fallback to block 1 if provider fails
  }
};

// Sync past events in chunks of 500 blocks (removed early exit logic)
const syncPastEvents = async (eventFilter, processEvent, eventName) => {
  let fromBlock = await getLastProcessedBlock();
  const latestBlock = await provider.getBlockNumber();
  console.log(
    `Syncing ${eventName} events from block ${fromBlock} to ${latestBlock}...`
  );

  if (fromBlock <= 0) {
    fromBlock = await getSafeStartingBlock();
    console.log(`Adjusted fromBlock to safe starting block: ${fromBlock}`);
  }

  while (fromBlock < latestBlock) {
    const toBlock = Math.min(fromBlock + 499, latestBlock); // 500 block range
    console.log(
      `Fetching ${eventName} events from block ${fromBlock} to ${toBlock}...`
    );
    try {
      const events = await contract.queryFilter(
        eventFilter,
        fromBlock,
        toBlock
      );
      console.log(
        `Found ${events.length} ${eventName} events in range ${fromBlock} to ${toBlock}`
      );
      for (const event of events) {
        if (eventName === "PaymentSent") {
          const { employee, amount, timestamp } = event.args;
          await processEvent(employee, amount, timestamp, event);
        } else if (eventName === "SalarySet") {
          const { employee, salary } = event.args;
          await processEvent(employee, salary, event);
        }
      }
      await pool.query(
        "INSERT INTO processed_events (tx_hash, event_type, block_number) VALUES ($1, $2, $3) ON CONFLICT (tx_hash) DO UPDATE SET block_number = $3",
        [
          `sync_marker_${eventName}_${toBlock}`,
          `sync_marker_${eventName}`,
          toBlock,
        ]
      );
      fromBlock = toBlock + 1;
    } catch (err) {
      console.error(
        `Error syncing ${eventName} events from ${fromBlock} to ${toBlock}:`,
        err
      );
      break; // Exit on error, can be resumed later
    }
  }
  console.log(
    `Finished syncing ${eventName} events up to block ${latestBlock}`
  );
};

// Sync past events on startup
(async () => {
  try {
    await syncPastEvents(
      contract.filters.PaymentSent(),
      processPaymentSentEvent,
      "PaymentSent"
    );
    await syncPastEvents(
      contract.filters.SalarySet(),
      processSalarySetEvent,
      "SalarySet"
    );
  } catch (err) {
    console.error("Error syncing past events:", err);
  }
})();

// Listen for new PaymentSent and SalarySet events
contract.on("PaymentSent", async (employee, amount, timestamp, event) => {
  console.log(
    `New PaymentSent event detected: Employee ${employee}, Amount ${ethers.formatEther(
      amount
    )} ETH, Timestamp ${timestamp}`
  );
  await processPaymentSentEvent(employee, amount, timestamp, event);
});

contract.on("SalarySet", async (employee, salary, event) => {
  console.log(
    `New SalarySet event detected: Employee ${employee}, Salary ${ethers.formatEther(
      salary
    )} ETH`
  );
  await processSalarySetEvent(employee, salary, event);
});

// Automatic payment scheduling (only if wallet is initialized)
if (wallet) {
  cron.schedule("0 0 * * *", async () => {
    console.log("Checking for scheduled payments...");
    try {
      const employeesResult = await pool.query(
        "SELECT employee_id, wallet_address, salary, payment_interval FROM employees WHERE salary > 0"
      );
      const employees = employeesResult.rows;

      for (const employee of employees) {
        const { employee_id, wallet_address, salary, payment_interval } =
          employee;
        let lastPayment = null;
        try {
          const lastPaymentResult = await pool.query(
            "SELECT MAX(timestamp) as last_payment FROM payment_history WHERE wallet_address = $1",
            [wallet_address]
          );
          lastPayment = lastPaymentResult.rows[0]?.last_payment;
        } catch (err) {
          if (err.code === "42P01") {
            console.log(
              `Table payment_history does not exist yet. Treating as no prior payments for ${wallet_address}`
            );
          } else {
            console.error(
              `Error querying payment_history for ${wallet_address}:`,
              err
            );
            continue;
          }
        }

        const now = new Date();
        const daysSinceLastPayment = lastPayment
          ? (now - new Date(lastPayment)) / (1000 * 60 * 60 * 24)
          : payment_interval + 1;

        if (daysSinceLastPayment >= payment_interval) {
          const paymentStatus = await contract.paymentStatus(wallet_address);
          if (!paymentStatus) {
            console.log(
              `Processing scheduled payment for ${wallet_address}...`
            );
            const salaryInWei = ethers.parseEther(salary.toString());
            const tx = await contract.paySalary(wallet_address, {
              value: salaryInWei,
              gasLimit: 1000000,
            });
            const receipt = await tx.wait();
            console.log(`Scheduled payment successful for ${wallet_address}`);

            const timestamp = new Date();
            const txHash = receipt.transactionHash;
            const result = await pool.query(
              "SELECT employee_id, name, email FROM employees WHERE wallet_address ILIKE $1",
              [wallet_address]
            );
            const employeeData = result.rows[0];
            if (employeeData && employeeData.email) {
              const mailOptions = {
                from: "muhammadzaidtahir90@gmail.com",
                to: employeeData.email,
                subject: "Scheduled Salary Payment Notification",
                text: `Dear ${
                  employeeData.name
                },\n\nYour scheduled salary of ${salary} ETH has been paid on ${timestamp.toISOString()}.\n\nBest regards,\nSmart Payroll System`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
                    <h2 style="color: #333;">Scheduled Salary Payment Notification</h2>
                    <p>Dear ${employeeData.name},</p>
                    <p>Your scheduled salary of <strong>${salary} ETH</strong> has been paid on <strong>${timestamp.toISOString()}</strong>.</p>
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
              console.log(
                `Scheduled payment email sent to ${employeeData.email}`
              );
            } else {
              console.log(
                `No email found for ${wallet_address}, skipping email`
              );
            }
            try {
              await pool.query(
                "INSERT INTO payment_history (employee_id, wallet_address, amount, timestamp, tx_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING",
                [
                  employee_id,
                  wallet_address,
                  salary,
                  timestamp.toISOString(),
                  txHash,
                ]
              );
              console.log(
                `Payment recorded in payment_history for ${wallet_address}`
              );
            } catch (err) {
              console.error(
                `Error saving scheduled payment to payment_history for ${wallet_address}:`,
                err
              );
            }
          } else {
            console.log(
              `Payment status is true for ${wallet_address}, resetting...`
            );
            const resetTx = await contract.resetPaymentStatus(wallet_address);
            await resetTx.wait();
          }
        }
      }
    } catch (err) {
      console.error("Error in scheduled payments:", err);
    }
  });
} else {
  console.warn(
    "Scheduled payments disabled due to missing or invalid ADMIN_PRIVATE_KEY."
  );
}

// Get all departments
app.get("/departments", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM departments");
    res.json(result.rows);
  } catch (err) {
    console.error("GET /departments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new department
app.post("/departments", async (req, res) => {
  const { department_name } = req.body;
  try {
    await pool.query(
      "INSERT INTO departments (department_name) VALUES ($1) RETURNING *",
      [department_name]
    );
    res.status(201).json({ message: "Department added successfully" });
  } catch (err) {
    console.error("POST /departments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all roles
app.get("/roles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM roles");
    res.json(result.rows);
  } catch (err) {
    console.error("GET /roles error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new role
app.post("/roles", async (req, res) => {
  const { role_name, base_salary } = req.body;
  try {
    await pool.query(
      "INSERT INTO roles (role_name, base_salary) VALUES ($1, $2) RETURNING *",
      [role_name, base_salary]
    );
    res.status(201).json({ message: "Role added successfully" });
  } catch (err) {
    console.error("POST /roles error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all employees with department and role details
app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, d.department_name, r.role_name, r.base_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN roles r ON e.role_id = r.role_id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /employees error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new employee
app.post("/employees", async (req, res) => {
  const {
    employee_id,
    name,
    wallet_address,
    salary,
    email,
    payment_interval,
    department_id,
    role_id,
  } = req.body;
  try {
    await pool.query(
      "INSERT INTO employees (employee_id, name, wallet_address, salary, email, payment_interval, department_id, role_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        employee_id,
        name,
        wallet_address,
        salary,
        email,
        payment_interval || 30,
        department_id,
        role_id,
      ]
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
  const {
    name,
    wallet_address,
    salary,
    email,
    payment_interval,
    department_id,
    role_id,
  } = req.body;
  try {
    const result = await pool.query(
      "UPDATE employees SET name = $1, wallet_address = $2, salary = $3, email = $4, payment_interval = $5, department_id = $6, role_id = $7 WHERE employee_id = $8",
      [
        name,
        wallet_address,
        salary,
        email,
        payment_interval || 30,
        department_id,
        role_id,
        id,
      ]
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

// Record attendance
app.post("/attendance", async (req, res) => {
  const { employee_id, date, status, check_in_time, check_out_time } = req.body;
  console.log("Received attendance request:", req.body);
  try {
    await pool.query(
      "INSERT INTO attendance (employee_id, date, status, check_in_time, check_out_time) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (employee_id, date) DO UPDATE SET status = $3, check_in_time = $4, check_out_time = $5",
      [employee_id, date, status, check_in_time, check_out_time]
    );
    res.status(201).json({ message: "Attendance recorded successfully" });
  } catch (err) {
    console.error("POST /attendance error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get attendance for an employee
app.get("/attendance/:employee_id", async (req, res) => {
  const { employee_id } = req.params;
  const { start_date, end_date } = req.query;
  try {
    const result = await pool.query(
      "SELECT * FROM attendance WHERE employee_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date",
      [employee_id, start_date, end_date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /attendance/:employee_id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Apply for leave
app.post("/leaves", async (req, res) => {
  const { employee_id, start_date, end_date, leave_type } = req.body;
  try {
    await pool.query(
      "INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *",
      [employee_id, start_date, end_date, leave_type]
    );
    res
      .status(201)
      .json({ message: "Leave application submitted successfully" });
  } catch (err) {
    console.error("POST /leaves error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get leave requests
app.get("/leaves", async (req, res) => {
  const { employee_id, status } = req.query;
  try {
    let query = "SELECT * FROM leaves WHERE 1=1";
    const params = [];
    if (employee_id) {
      query += " AND employee_id = $1";
      params.push(employee_id);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    query += " ORDER BY applied_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /leaves error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get payment history for all employees from the database
app.get("/payment-history", async (req, res) => {
  try {
    console.log("Fetching payment history from database...");
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
        history = await pool.query(
          "SELECT * FROM payment_history WHERE wallet_address ILIKE $1 ORDER BY timestamp DESC",
          [employee.wallet_address]
        );
        console.log(
          `Payment history for ${employee.wallet_address} from DB:`,
          history.rows
        );
      } catch (err) {
        console.error(
          `Error fetching payment history for ${employee.wallet_address} from DB:`,
          err
        );
        continue;
      }

      for (const payment of history.rows) {
        try {
          paymentHistory.push({
            employee_id: employee.employee_id,
            name: employee.name,
            wallet_address: employee.wallet_address,
            amount: payment.amount,
            timestamp: payment.timestamp,
            txHash: payment.tx_hash,
            payment_interval: employee.payment_interval,
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

// New endpoint to record payment and send email
app.post("/payment-history", async (req, res) => {
  const { employee_id, name, wallet_address, amount, timestamp, txHash } =
    req.body;

  try {
    console.log("Received payment data:", {
      employee_id,
      name,
      wallet_address,
      amount,
      timestamp,
      txHash,
    });

    if (!employee_id || !wallet_address || !amount || !timestamp || !txHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if payment is already recorded
    const existingPayment = await pool.query(
      "SELECT tx_hash FROM payment_history WHERE tx_hash = $1",
      [txHash]
    );
    if (existingPayment.rows.length > 0) {
      console.log(
        `Payment with txHash ${txHash} already recorded, skipping...`
      );
      return res.status(200).json({ message: "Payment already recorded" });
    }

    // Save to database
    await pool.query(
      "INSERT INTO payment_history (employee_id, name, wallet_address, amount, timestamp, tx_hash) VALUES ($1, $2, $3, $4, $5, $6)",
      [employee_id, name, wallet_address, amount, timestamp, txHash]
    );
    console.log(`Payment saved to payment_history for ${wallet_address}`);

    // Fetch employee email
    const employeeResult = await pool.query(
      "SELECT email FROM employees WHERE employee_id = $1",
      [employee_id]
    );
    const employeeData = employeeResult.rows[0];
    if (employeeData && employeeData.email) {
      const mailOptions = {
        from: "muhammadzaidtahir90@gmail.com",
        to: employeeData.email,
        subject: "Salary Payment Notification",
        text: `Dear ${name},\n\nYour salary of ${amount} ETH has been paid on ${timestamp}.\nTransaction Hash: ${txHash}\n\nBest regards,\nSmart Payroll System`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Salary Payment Notification</h2>
            <p>Dear ${name},</p>
            <p>Your salary of <strong>${amount} ETH</strong> has been paid on <strong>${timestamp}</strong>.</p>
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
      console.log(`Payment email sent to ${employeeData.email}`);
    } else {
      console.log(
        `No email found for employee_id ${employee_id}, skipping email`
      );
    }

    res.status(200).json({ message: "Payment recorded and email sent" });
  } catch (err) {
    console.error("POST /payment-history error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
