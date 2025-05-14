const { Wallet } = require("ethers");
require("dotenv").config();

const privateKey = process.env.ADMIN_PRIVATE_KEY;
try {
  const wallet = new Wallet(privateKey);
  console.log("Valid private key. Address:", wallet.address);
} catch (err) {
  console.error("Invalid private key:", err);
}
