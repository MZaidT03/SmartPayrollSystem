require("dotenv").config();
const { ethers } = require("ethers");
const cron = require("node-cron");

// Contract address and ABI
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ZAID_TAHIR_ADDRESS = "0xYourZaidTahirAddress"; // Replace with Zaid Tahir's wallet address
const ABI = [
  "function owner() view returns (address)",
  "function salaries(address) view returns (uint256)",
  "function paymentStatus(address) view returns (bool)",
  "function setSalary(address employee, uint256 salary) external",
  "function paySalaryManual(address employee) external payable",
  "function resetPaymentStatus(address employee) external",
  "function fundContract() external payable",
  "function getContractBalance() external view returns (uint256)",
  "function getPaymentHistory(address employee) external view returns (tuple(address employee, uint256 amount, uint256 timestamp, bytes32 txHash)[])",
  "function automatePayments() external",
  "function getEmployeeList() external view returns (address[])",
  "event PaymentSent(address indexed employee, uint256 amount, uint256 timestamp)",
  "event SalarySet(address indexed employee, uint256 salary)",
];

// Configure provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(
  "a13874728dde2656c2a2714e8c744f15d0186da272f863bd8264c6f224d234cb",
  provider
);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

// Function to reset payment status for all employees
const resetAllPaymentStatuses = async () => {
  try {
    console.log("Resetting payment statuses for all employees...");
    const employeeList = await contract.getEmployeeList();
    for (const employee of employeeList) {
      const status = await contract.paymentStatus(employee);
      if (status) {
        const tx = await contract.resetPaymentStatus(employee);
        await tx.wait();
        console.log(`Payment status reset for employee: ${employee}`);
      }
    }
    console.log("All payment statuses reset successfully.");
  } catch (error) {
    console.error("Error resetting payment statuses:", error);
  }
};

// Schedule the task to run on the 1st of every month at 00:00 PKT
cron.schedule(
  "0 0 1 * *",
  async () => {
    try {
      console.log("Running automated salary payment for all employees...");
      // Reset payment statuses before paying
      await resetAllPaymentStatuses();
      // Automate payments
      const tx = await contract.automatePayments();
      await tx.wait();
      console.log("Salaries paid successfully:", tx.hash);
    } catch (error) {
      console.error("Error automating salary payment:", error);
    }
  },
  {
    timezone: "Asia/Karachi", // Ensure the schedule runs in PKT
  }
);

// Schedule Zaid Tahir's payment every minute for testing
cron.schedule(
  "* * * * *",
  async () => {
    try {
      console.log("Running automated payment for Zaid Tahir...");
      const tx = await contract.paySalaryManual(ZAID_TAHIR_ADDRESS);
      await tx.wait();
      console.log("Zaid Tahir paid successfully:", tx.hash);
    } catch (error) {
      console.error("Error paying Zaid Tahir:", error);
    }
  },
  {
    timezone: "Asia/Karachi", // Ensure the schedule runs in PKT
  }
);

console.log("Automation script started. Waiting for scheduled tasks...");
