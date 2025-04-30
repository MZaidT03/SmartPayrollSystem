require("dotenv").config();
const ethers = require("ethers");

const CONTRACT_ADDRESS = "0xa0831742B01287Edae3e6CdC16Db3F86c4CF15ca"; // Updated to new contract address
const ABI = [
  "function getPaymentHistory(address employee) external view returns (tuple(address employee, uint256 amount, uint256 timestamp, bytes32 txHash)[])",
  "function owner() view returns (address)",
];

(async () => {
  try {
    console.log("SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL);

    // Test the provider
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const network = await provider.getNetwork();
    console.log(
      "Connected to network:",
      network.name,
      "Chain ID:",
      network.chainId.toString()
    );

    // Check if the contract exists
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      console.error("No contract found at address:", CONTRACT_ADDRESS);
      return;
    }
    console.log("Contract code exists at address:", CONTRACT_ADDRESS);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Test a simple call to verify the ABI
    const owner = await contract.owner();
    console.log("Contract owner:", owner);

    // Fetch payment history
    const employeeAddress = "0x111222333444555666777888999aAabbbCccDdD0";
    const history = await contract.getPaymentHistory(employeeAddress);
    console.log("Payment History:", history);

    // Format the history for better readability
    const formattedHistory = history.map((payment) => ({
      employee: payment.employee,
      amount: ethers.formatEther(payment.amount),
      timestamp: new Date(Number(payment.timestamp) * 1000).toISOString(),
      txHash: payment.txHash.toString(),
    }));
    console.log("Formatted Payment History:", formattedHistory);
  } catch (err) {
    console.error("Error fetching payment history:", err);
  }
})();
