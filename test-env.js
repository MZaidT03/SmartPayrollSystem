// test-env.js
require("dotenv").config();
console.log("RPC:", process.env.SEPOLIA_RPC_URL);
console.log("Key length:", process.env.PRIVATE_KEY?.length);
