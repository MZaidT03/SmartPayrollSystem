import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import axios from "axios";

import EmployeeDetails from "./EmployeeDetails";

import "./index.css";

const App = () => {
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [employeeAddress, setEmployeeAddress] = useState("");
  const [employeeCheckAddress, setEmployeeCheckAddress] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [salary, setSalary] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [contractBalance, setContractBalance] = useState("0");
  const [employees, setEmployees] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [matchedEmployee, setMatchedEmployee] = useState(null);

  // Modal states for other modals
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isPayEmployeeModalOpen, setIsPayEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] =
    useState(false);
  const [newEmployee, setNewEmployee] = useState({
    employee_id: "",
    name: "",
    wallet_address: "",
    salary: "",
    email: "",
    payment_interval: "",
    department_id: "",
    role_id: "",
  });
  const [editEmployee, setEditEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

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

  // Fetch departments and roles
  const fetchDepartmentsAndRoles = async () => {
    try {
      const [departmentsResponse, rolesResponse] = await Promise.all([
        axios.get("http://localhost:3001/departments"),
        axios.get("http://localhost:3001/roles"),
      ]);
      setDepartments(departmentsResponse.data || []);
      setRoles(rolesResponse.data || []);
    } catch (error) {
      console.error("Error fetching departments or roles:", error);
      setError("Failed to load departments or roles: " + error.message);
    }
  };

  // Fetch employees from backend
  const fetchEmployees = async () => {
    setFetchLoading(true);
    setError("");
    try {
      const response = await axios.get("http://localhost:3001/employees");
      console.log("Fetched employees:", response.data);
      setEmployees(response.data);
    } catch (err) {
      setError("Failed to fetch employees: " + err.message);
      console.error("Fetch error:", err);
    }
    setFetchLoading(false);
  };

  // Fetch payment history from backend
  const fetchPaymentHistory = async () => {
    setFetchLoading(true);
    setError("");
    try {
      const response = await axios.get("http://localhost:3001/payment-history");
      console.log("Fetched payment history:", response.data);
      setPaymentHistory(response.data);
    } catch (err) {
      setError("Failed to fetch payment history: " + err.message);
      console.error("Fetch payment history error:", err);
    }
    setFetchLoading(false);
  };

  // Calculate total salary for an employee
  const calculateTotalSalary = (walletAddress) => {
    if (!paymentHistory || !Array.isArray(paymentHistory)) return "0.0000";
    const employeePayments = paymentHistory.filter(
      (payment) =>
        payment.wallet_address &&
        payment.wallet_address.toLowerCase() === walletAddress.toLowerCase()
    );
    const total = employeePayments.reduce(
      (sum, payment) => sum + (parseFloat(payment.amount) || 0),
      0
    );
    return total.toFixed(4);
  };

  // Initialize wallet and contract
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setError("");
        setSuccess("");
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        setSigner(signer);
        setContract(contract);
        setConnectedAddress(address);

        const owner = await contract.owner();
        setIsOwner(address.toLowerCase() === owner.toLowerCase());

        const balance = await contract.getContractBalance();
        setContractBalance(ethers.formatEther(balance));

        // Check if the connected address matches any employee's wallet address
        const matched = employees.find(
          (emp) => emp.wallet_address.toLowerCase() === address.toLowerCase()
        );
        setMatchedEmployee(matched || null);
      } catch (err) {
        setError("Failed to connect wallet: " + err.message);
      }
    } else {
      setError("Please install MetaMask!");
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      setError("");
      setSuccess("");
      setConnectedAddress("");
      setContract(null);
      setSigner(null);
      setIsOwner(false);
      setContractBalance("0");
      setMatchedEmployee(null); // Reset matched employee on disconnect
      setSuccess("Wallet disconnected successfully!");
    } catch (err) {
      setError("Failed to disconnect wallet: " + err.message);
    }
  };

  // Switch wallet
  const switchWallet = async () => {
    if (window.ethereum) {
      try {
        setError("");
        setSuccess("");
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        setSigner(signer);
        setContract(contract);
        setConnectedAddress(address);

        const owner = await contract.owner();
        setIsOwner(address.toLowerCase() === owner.toLowerCase());

        const balance = await contract.getContractBalance();
        setContractBalance(ethers.formatEther(balance));

        // Check if the new address matches any employee's wallet address
        const matched = employees.find(
          (emp) => emp.wallet_address.toLowerCase() === address.toLowerCase()
        );
        setMatchedEmployee(matched || null);

        setSuccess("Wallet switched successfully!");
      } catch (err) {
        setError("Failed to switch wallet: " + err.message);
      }
    } else {
      setError("Please install MetaMask!");
    }
  };

  // Fetch data on mount
  useEffect(() => {
    fetchEmployees();
    fetchPaymentHistory();
    fetchDepartmentsAndRoles();
  }, []);

  // Refresh contract balance and handle account/network changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

          setSigner(signer);
          setContract(contract);
          setConnectedAddress(address);

          const owner = await contract.owner();
          setIsOwner(address.toLowerCase() === owner.toLowerCase());

          const balance = await contract.getContractBalance();
          setContractBalance(ethers.formatEther(balance));

          // Check if the new address matches any employee's wallet address
          const matched = employees.find(
            (emp) => emp.wallet_address.toLowerCase() === address.toLowerCase()
          );
          setMatchedEmployee(matched || null);
        }
      };

      const handleChainChanged = () => {
        connectWallet();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [employees]); // Add employees as a dependency to ensure the list is up-to-date

  // Handle employee selection from dropdown
  const handleEmployeeSelect = (e) => {
    const employeeId = e.target.value;
    setSelectedEmployee(employeeId);
    const employee = employees.find((emp) => emp.employee_id === employeeId);
    setEmployeeAddress(employee ? employee.wallet_address : "");
  };

  // Admin: Add new employee
  const addEmployee = async () => {
    if (
      !newEmployee.employee_id ||
      !newEmployee.name ||
      !newEmployee.wallet_address ||
      !newEmployee.salary ||
      !newEmployee.email ||
      !newEmployee.department_id ||
      !newEmployee.role_id
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!ethers.isAddress(newEmployee.wallet_address)) {
      setError(
        "Invalid wallet address. Please enter a valid Ethereum address."
      );
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      await axios.post("http://localhost:3001/employees", newEmployee);
      setSuccess("Employee added successfully!");
      fetchEmployees();
      setNewEmployee({
        employee_id: "",
        name: "",
        wallet_address: "",
        salary: "",
        email: "",
        payment_interval: "",
        department_id: "",
        role_id: "",
      });
      setIsAddEmployeeModalOpen(false);
    } catch (err) {
      setError("Failed to add employee: " + err.message);
    }
    setIsLoading(false);
  };

  // Admin: Edit employee
  const openEditEmployeeModal = (employee) => {
    setEditEmployee({
      ...employee,
      department_id: employee.department_id || "",
      role_id: employee.role_id || "",
    });
    setIsEditEmployeeModalOpen(true);
  };

  const editEmployeeHandler = async () => {
    if (
      !editEmployee.employee_id ||
      !editEmployee.name ||
      !editEmployee.wallet_address ||
      !editEmployee.salary ||
      !editEmployee.email ||
      !editEmployee.department_id ||
      !editEmployee.role_id
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (!ethers.isAddress(editEmployee.wallet_address)) {
      setError(
        "Invalid wallet address. Please enter a valid Ethereum address."
      );
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      await axios.put(
        `http://localhost:3001/employees/${editEmployee.employee_id}`,
        editEmployee
      );
      setSuccess("Employee updated successfully!");
      fetchEmployees();
      setIsEditEmployeeModalOpen(false);
      setEditEmployee(null);
    } catch (err) {
      console.error("Edit error:", err);
      if (err.response) {
        setError(
          `Failed to update employee: ${err.response.status} - ${
            err.response.data.error || err.message
          }`
        );
      } else if (err.request) {
        setError(
          "Failed to update employee: No response from server (Network Error)"
        );
      } else {
        setError("Failed to update employee: " + err.message);
      }
    }
    setIsLoading(false);
  };

  // Admin: Delete employee
  const openDeleteConfirmModal = (employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteConfirmModalOpen(true);
  };

  const deleteEmployee = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      await axios.delete(
        `http://localhost:3001/employees/${employeeToDelete.employee_id}`
      );
      setSuccess("Employee deleted successfully!");
      fetchEmployees();
      setIsDeleteConfirmModalOpen(false);
      setEmployeeToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      if (err.response) {
        setError(
          `Failed to delete employee: ${err.response.status} - ${
            err.response.data.error || err.message
          }`
        );
      } else if (err.request) {
        setError(
          "Failed to delete employee: No response from server (Network Error)"
        );
      } else {
        setError("Failed to delete employee: " + err.message);
      }
    }
    setIsLoading(false);
  };

  // Admin: Set employee salary
  const setEmployeeSalary = async () => {
    if (!contract || !employeeAddress || !salary) {
      setError("Please select an employee and enter a salary.");
      return;
    }
    if (!ethers.isAddress(employeeAddress)) {
      setError(
        "Invalid employee address. Please select a valid Ethereum address."
      );
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const tx = await contract.setSalary(
        employeeAddress,
        ethers.parseEther(salary)
      );
      await tx.wait();
      setSuccess("Salary set successfully!");
    } catch (err) {
      setError("Failed to set salary: " + err.message);
    }
    setIsLoading(false);
  };

  // Admin: Pay employee salary
  const payEmployee = async () => {
    if (!contract || !employeeAddress) {
      setError("Please select an employee.");
      return;
    }
    if (!ethers.isAddress(employeeAddress)) {
      setError(
        "Invalid employee address. Please select a valid Ethereum address."
      );
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const salary = await contract.salaries(employeeAddress);
      if (salary == 0) {
        setError(
          "Salary not set for this employee. Please set the salary first."
        );
        setIsLoading(false);
        setIsPayEmployeeModalOpen(false);
        return;
      }
      const tx = await contract.paySalary(employeeAddress);
      await tx.wait();
      const balance = await contract.getContractBalance();
      setContractBalance(ethers.formatEther(balance));
      setSuccess("Payment sent successfully!");
      fetchPaymentHistory();
      setIsPayEmployeeModalOpen(false);
    } catch (err) {
      setError("Failed to pay salary: " + err.message);
    }
    setIsLoading(false);
  };

  // Admin: Fund the contract
  const fundContract = async () => {
    if (!contract || !fundAmount) {
      setError("Please enter a valid fund amount.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const tx = await contract.fundContract({
        value: ethers.parseEther(fundAmount),
      });
      await tx.wait();
      const balance = await contract.getContractBalance();
      setContractBalance(ethers.formatEther(balance));
      setSuccess("Contract funded successfully!");
    } catch (err) {
      setError("Failed to fund contract: " + err.message);
    }
    setIsLoading(false);
  };

  // Anyone: Check payment status
  const checkPaymentStatus = async () => {
    if (!contract || !employeeCheckAddress) {
      setError("Please enter a valid address.");
      return;
    }
    if (!ethers.isAddress(employeeCheckAddress)) {
      setError("Invalid address. Please enter a valid Ethereum address.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const status = await contract.paymentStatus(employeeCheckAddress);
      setPaymentStatus(status ? "Paid" : "Not Paid");
      setSuccess("Status checked successfully!");
    } catch (err) {
      setError("Failed to check status: " + err.message);
      setPaymentStatus("Error");
    }
    setIsLoading(false);
  };

  // Navigate to Employee Detail page
  const navigateToDetails = (employee) => {
    console.log("Navigating to Details page for employee:", employee);
    navigate("/employee-details", { state: { employee } });
  };

  const resetEmployeePaymentStatus = async () => {
    if (!contract || !employeeAddress) {
      setError("Please select an employee.");
      return;
    }
    if (!ethers.isAddress(employeeAddress)) {
      setError("Invalid employee address.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const tx = await contract.resetPaymentStatus(employeeAddress);
      await tx.wait();
      setSuccess("Payment status reset successfully!");
    } catch (err) {
      setError("Failed to reset payment status: " + err.message);
    }
    setIsLoading(false);
  };

  return (
    <div>
      <Routes>
        <Route
          path="/"
          element={
            <>
              {/* Header */}
              <header className="header">
                <div className="container header-content">
                  <h1 className="header-title">Smart Payroll System</h1>
                  {connectedAddress ? (
                    <div className="header-wallet">
                      <span>
                        Connected: {connectedAddress.slice(0, 6)}...
                        {connectedAddress.slice(-4)}
                      </span>
                      <button onClick={switchWallet} className="switch-btn">
                        Switch Wallet
                      </button>
                      <button
                        onClick={disconnectWallet}
                        className="cancel-btn"
                        style={{ marginLeft: "0.5rem" }}
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  ) : (
                    <button onClick={connectWallet} className="connect-btn">
                      Connect Wallet
                    </button>
                  )}
                </div>
              </header>

              {/* Main Content */}
              <main className="container">
                {/* Notifications */}
                {error && (
                  <div className="notification-error">
                    <p>{error}</p>
                  </div>
                )}
                {success && (
                  <div className="notification-success">
                    <p>{success}</p>
                  </div>
                )}

                {/* Contract Balance */}
                <div className="section">
                  <h2 className="section-title">Contract Overview</h2>
                  <p className="contract-info">
                    Contract Balance: <span>{contractBalance} ETH</span>
                  </p>
                  <p className="contract-address">
                    Contract Address: {CONTRACT_ADDRESS.slice(0, 6)}...
                    {CONTRACT_ADDRESS.slice(-4)}
                  </p>
                </div>

                {/* Employee Details for Matched Wallet (Non-Admin Only) */}
                {connectedAddress && !isOwner && matchedEmployee && (
                  <div className="section">
                    <h2 className="section-title">
                      Welcome, {matchedEmployee.name}
                    </h2>
                    <h3 className="action-title">Your Details</h3>
                    <div className="details-grid">
                      <div className="detail-item">
                        <span className="detail-label">Employee ID:</span>
                        <span>{matchedEmployee.employee_id}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Name:</span>
                        <span>{matchedEmployee.name}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Wallet Address:</span>
                        <span className="mono">
                          {matchedEmployee.wallet_address.slice(0, 6)}...
                          {matchedEmployee.wallet_address.slice(-4)}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Salary (ETH):</span>
                        <span>{matchedEmployee.salary}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Email:</span>
                        <span>{matchedEmployee.email}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Department:</span>
                        <span>{matchedEmployee.department_name || "N/A"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Role:</span>
                        <span>{matchedEmployee.role_name || "N/A"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Base Salary (ETH):</span>
                        <span>{matchedEmployee.base_salary || "N/A"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">
                          Total Salary Paid (ETH):
                        </span>
                        <span>
                          {calculateTotalSalary(matchedEmployee.wallet_address)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Check Payment Status (Accessible to Anyone) */}
                <div className="section">
                  <h2 className="section-title">Check Payment Status</h2>
                  <div className="action-section">
                    <h3 className="action-title">
                      Enter Wallet Address to Check Status
                    </h3>
                    <div className="input-group single">
                      <input
                        type="text"
                        placeholder="Wallet Address"
                        value={employeeCheckAddress}
                        onChange={(e) =>
                          setEmployeeCheckAddress(e.target.value)
                        }
                        className="input"
                      />
                    </div>
                    <button
                      onClick={checkPaymentStatus}
                      disabled={isLoading}
                      className="check-btn"
                    >
                      {isLoading ? "Checking..." : "Check Payment Status"}
                    </button>
                    {paymentStatus && (
                      <p
                        className={
                          paymentStatus === "Paid"
                            ? "status-paid"
                            : "status-not-paid"
                        }
                      >
                        Status: {paymentStatus}
                      </p>
                    )}
                  </div>
                </div>

                {/* Admin Actions (Restricted to Owner) */}
                {isOwner && (
                  <>
                    {/* Employees Table */}
                    <div className="section">
                      <div className="table-header">
                        <h2 className="section-title">Employees</h2>
                        <button
                          onClick={fetchEmployees}
                          disabled={fetchLoading}
                          className="refresh-btn"
                        >
                          {fetchLoading ? "Loading..." : "Refresh Employees"}
                        </button>
                      </div>
                      {employees.length > 0 ? (
                        <div style={{ overflowX: "auto" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Wallet Address</th>
                                <th>Salary (ETH)</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Role</th>
                                <th>Total Salary (ETH)</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employees.map((employee) => (
                                <tr key={employee.employee_id}>
                                  <td>{employee.employee_id}</td>
                                  <td>{employee.name}</td>
                                  <td className="mono">
                                    {employee.wallet_address.slice(0, 6)}...
                                    {employee.wallet_address.slice(-4)}
                                  </td>
                                  <td>{employee.salary}</td>
                                  <td>{employee.email}</td>
                                  <td>{employee.department_name || "N/A"}</td>
                                  <td>{employee.role_name || "N/A"}</td>
                                  <td>
                                    {calculateTotalSalary(
                                      employee.wallet_address
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      onClick={() =>
                                        navigateToDetails(employee)
                                      }
                                      className="action-btn"
                                      style={{
                                        marginRight: "0.5rem",
                                        padding: "0.25rem 0.5rem",
                                      }}
                                    >
                                      Details
                                    </button>
                                    <button
                                      onClick={() =>
                                        openEditEmployeeModal(employee)
                                      }
                                      className="action-btn"
                                      style={{
                                        marginRight: "0.5rem",
                                        padding: "0.25rem 0.5rem",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() =>
                                        openDeleteConfirmModal(employee)
                                      }
                                      className="cancel-btn"
                                      style={{ padding: "0.25rem 0.5rem" }}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="no-data">
                          No employees found. Try refreshing.
                        </p>
                      )}
                      <div className="action-section">
                        <h3 className="action-title">Reset Payment Status</h3>
                        <div className="input-group">
                          <select
                            value={selectedEmployee}
                            onChange={handleEmployeeSelect}
                            className="select"
                          >
                            <option value="">Select Employee</option>
                            {employees.map((employee) => (
                              <option
                                key={employee.employee_id}
                                value={employee.employee_id}
                              >
                                {employee.name} ({employee.employee_id})
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Wallet Address"
                            value={employeeAddress}
                            onChange={(e) => setEmployeeAddress(e.target.value)}
                            className="input"
                            disabled
                          />
                        </div>
                        <button
                          onClick={resetEmployeePaymentStatus}
                          disabled={isLoading}
                          className="action-btn"
                        >
                          {isLoading ? "Processing..." : "Reset Status"}
                        </button>
                      </div>
                    </div>

                    {/* Payment History */}
                    <div className="section">
                      <div className="table-header">
                        <h2 className="section-title">Payment History</h2>
                        <button
                          onClick={fetchPaymentHistory}
                          disabled={fetchLoading}
                          className="refresh-btn"
                        >
                          {fetchLoading ? "Loading..." : "Refresh History"}
                        </button>
                      </div>
                      {paymentHistory.length > 0 ? (
                        <div style={{ overflowX: "auto" }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Wallet Address</th>
                                <th>Amount (ETH)</th>
                                <th>Timestamp</th>
                                <th>Transaction Hash</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentHistory.map((payment, index) => (
                                <tr key={index}>
                                  <td>{payment.employee_id}</td>
                                  <td>{payment.name}</td>
                                  <td className="mono">
                                    {payment.wallet_address.slice(0, 6)}...
                                    {payment.wallet_address.slice(-4)}
                                  </td>
                                  <td>{payment.amount}</td>
                                  <td>{payment.timestamp}</td>
                                  <td className="mono">
                                    {payment.txHash.slice(0, 6)}...
                                    {payment.txHash.slice(-4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="no-data">
                          No payment history found. Try refreshing.
                        </p>
                      )}
                    </div>

                    {/* Admin Actions */}
                    <div className="section">
                      <h2 className="section-title">Admin Actions</h2>
                      {/* Add Employee Button */}
                      <div className="action-section">
                        <button
                          onClick={() => setIsAddEmployeeModalOpen(true)}
                          className="action-btn"
                        >
                          Add Employee
                        </button>
                      </div>

                      {/* Set Salary */}
                      <div className="action-section">
                        <h3 className="action-title">Set Employee Salary</h3>
                        <div className="input-group">
                          <select
                            value={selectedEmployee}
                            onChange={handleEmployeeSelect}
                            className="select"
                          >
                            <option value="">Select Employee</option>
                            {employees.map((employee) => (
                              <option
                                key={employee.employee_id}
                                value={employee.employee_id}
                              >
                                {employee.name} ({employee.employee_id})
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Salary (ETH)"
                            value={salary}
                            onChange={(e) => setSalary(e.target.value)}
                            className="input"
                          />
                        </div>
                        <button
                          onClick={setEmployeeSalary}
                          disabled={isLoading}
                          className="action-btn"
                        >
                          {isLoading ? "Processing..." : "Set Salary"}
                        </button>
                      </div>

                      {/* Pay Employee Button */}
                      <div className="action-section">
                        <button
                          onClick={() => setIsPayEmployeeModalOpen(true)}
                          className="pay-btn"
                        >
                          Pay Employee
                        </button>
                      </div>

                      {/* Fund Contract */}
                      <div className="action-section">
                        <h3 className="action-title">Fund Contract</h3>
                        <div className="input-group single">
                          <input
                            type="text"
                            placeholder="Fund Amount (ETH)"
                            value={fundAmount}
                            onChange={(e) => setFundAmount(e.target.value)}
                            className="input"
                          />
                        </div>
                        <button
                          onClick={fundContract}
                          disabled={isLoading}
                          className="fund-btn"
                        >
                          {isLoading ? "Processing..." : "Fund Contract"}
                        </button>
                      </div>

                      {/* Add Employee Modal */}
                      {isAddEmployeeModalOpen && (
                        <div className="modal-overlay">
                          <div className="modal">
                            <h3 className="modal-title">Add New Employee</h3>
                            <div className="modal-inputs">
                              <input
                                type="text"
                                placeholder="Employee ID (e.g., E005)"
                                value={newEmployee.employee_id}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    employee_id: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="text"
                                placeholder="Name"
                                value={newEmployee.name}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    name: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="text"
                                placeholder="Wallet Address"
                                value={newEmployee.wallet_address}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    wallet_address: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="text"
                                placeholder="Salary (ETH)"
                                value={newEmployee.salary}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    salary: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="email"
                                placeholder="Email Address"
                                value={newEmployee.email}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    email: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="number"
                                placeholder="Payment Interval (days)"
                                value={newEmployee.payment_interval}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    payment_interval: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <select
                                value={newEmployee.department_id}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    department_id: e.target.value,
                                  })
                                }
                                className="select"
                              >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                  <option
                                    key={dept.department_id}
                                    value={dept.department_id}
                                  >
                                    {dept.department_name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={newEmployee.role_id}
                                onChange={(e) =>
                                  setNewEmployee({
                                    ...newEmployee,
                                    role_id: e.target.value,
                                  })
                                }
                                className="select"
                              >
                                <option value="">Select Role</option>
                                {roles.map((role) => (
                                  <option
                                    key={role.role_id}
                                    value={role.role_id}
                                  >
                                    {role.role_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="modal-buttons">
                              <button
                                onClick={() => setIsAddEmployeeModalOpen(false)}
                                className="cancel-btn"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={addEmployee}
                                disabled={isLoading}
                                className="submit-btn"
                              >
                                {isLoading ? "Adding..." : "Add Employee"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Edit Employee Modal */}
                      {isEditEmployeeModalOpen && editEmployee && (
                        <div className="modal-overlay">
                          <div className="modal">
                            <h3 className="modal-title">Edit Employee</h3>
                            <div className="modal-inputs">
                              <input
                                type="text"
                                placeholder="Employee ID"
                                value={editEmployee.employee_id}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    employee_id: e.target.value,
                                  })
                                }
                                className="input"
                                disabled
                              />
                              <input
                                type="text"
                                placeholder="Name"
                                value={editEmployee.name}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    name: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="text"
                                placeholder="Wallet Address"
                                value={editEmployee.wallet_address}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    wallet_address: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="text"
                                placeholder="Salary (ETH)"
                                value={editEmployee.salary}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    salary: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="email"
                                placeholder="Email Address"
                                value={editEmployee.email}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    email: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <input
                                type="number"
                                placeholder="Payment Interval (days)"
                                value={editEmployee.payment_interval || ""}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    payment_interval: e.target.value,
                                  })
                                }
                                className="input"
                              />
                              <select
                                value={editEmployee.department_id}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    department_id: e.target.value,
                                  })
                                }
                                className="select"
                              >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                  <option
                                    key={dept.department_id}
                                    value={dept.department_id}
                                  >
                                    {dept.department_name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editEmployee.role_id}
                                onChange={(e) =>
                                  setEditEmployee({
                                    ...editEmployee,
                                    role_id: e.target.value,
                                  })
                                }
                                className="select"
                              >
                                <option value="">Select Role</option>
                                {roles.map((role) => (
                                  <option
                                    key={role.role_id}
                                    value={role.role_id}
                                  >
                                    {role.role_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="modal-buttons">
                              <button
                                onClick={() =>
                                  setIsEditEmployeeModalOpen(false)
                                }
                                className="cancel-btn"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={editEmployeeHandler}
                                disabled={isLoading}
                                className="submit-btn"
                              >
                                {isLoading ? "Saving..." : "Save Changes"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Delete Confirmation Modal */}
                      {isDeleteConfirmModalOpen && employeeToDelete && (
                        <div className="modal-overlay">
                          <div className="modal">
                            <h3 className="modal-title">Confirm Deletion</h3>
                            <p>
                              Are you sure you want to delete{" "}
                              {employeeToDelete.name}?
                            </p>
                            <div className="modal-buttons">
                              <button
                                onClick={() =>
                                  setIsDeleteConfirmModalOpen(false)
                                }
                                className="cancel-btn"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={deleteEmployee}
                                disabled={isLoading}
                                className="submit-btn"
                              >
                                {isLoading ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pay Employee Modal */}
                      {isPayEmployeeModalOpen && (
                        <div className="modal-overlay">
                          <div className="modal">
                            <h3 className="modal-title">Pay Employee Salary</h3>
                            <div className="modal-inputs">
                              <select
                                value={selectedEmployee}
                                onChange={handleEmployeeSelect}
                                className="select"
                              >
                                <option value="">Select Employee</option>
                                {employees.map((employee) => (
                                  <option
                                    key={employee.employee_id}
                                    value={employee.employee_id}
                                  >
                                    {employee.name} ({employee.employee_id})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Wallet Address"
                                value={employeeAddress}
                                onChange={(e) =>
                                  setEmployeeAddress(e.target.value)
                                }
                                className="input"
                                disabled
                              />
                            </div>
                            <div className="modal-buttons">
                              <button
                                onClick={() => setIsPayEmployeeModalOpen(false)}
                                className="cancel-btn"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={payEmployee}
                                disabled={isLoading}
                                className="pay-btn"
                              >
                                {isLoading ? "Paying..." : "Pay Salary"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </main>

              {/* Footer */}
              <footer className="footer">
                <p>© 2025 Smart Payroll System. All rights reserved.</p>
              </footer>
            </>
          }
        />

        <Route
          path="/employee-details"
          element={
            <EmployeeDetails calculateTotalSalary={calculateTotalSalary} />
          }
        />
      </Routes>
    </div>
  );
};

export default App;
