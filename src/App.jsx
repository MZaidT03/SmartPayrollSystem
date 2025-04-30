import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import "./index.css";

const App = () => {
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
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
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
  });
  const [editEmployee, setEditEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  const CONTRACT_ADDRESS = "0x5629ed7D8BA555C875ADbFda22C7026633BB5140";
  const ABI = [
    "function owner() view returns (address)",
    "function salaries(address) view returns (uint256)",
    "function paymentStatus(address) view returns (bool)",
    "function setSalary(address employee, uint256 salary) external",
    "function paySalary(address employee) external payable",
    "function resetPaymentStatus(address employee) external",
    "function fundContract() external payable",
    "function getContractBalance() external view returns (uint256)",
    "event PaymentSent(address indexed employee, uint256 amount, uint256 timestamp)",
  ];

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
      } catch (err) {
        setError("Failed to connect wallet: " + err.message);
      }
    } else {
      setError("Please install MetaMask!");
    }
  };

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Refresh contract balance on network changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        connectWallet();
      });
      window.ethereum.on("chainChanged", () => {
        connectWallet();
      });
    }
  }, []);

  // Handle employee selection from dropdown
  const handleEmployeeSelect = (e) => {
    const employeeId = e.target.value;
    setSelectedEmployee(employeeId);
    const employee = employees.find((emp) => emp.employee_id === employeeId);
    setEmployeeAddress(employee ? employee.wallet_address : "");
  };

  // Owner: Add new employee
  const addEmployee = async () => {
    if (
      !newEmployee.employee_id ||
      !newEmployee.name ||
      !newEmployee.wallet_address ||
      !newEmployee.salary
    ) {
      setError("Please fill in all fields.");
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
      });
      setIsAddEmployeeModalOpen(false);
    } catch (err) {
      setError("Failed to add employee: " + err.message);
    }
    setIsLoading(false);
  };

  // Owner: Edit employee
  const openEditEmployeeModal = (employee) => {
    setEditEmployee({ ...employee });
    setIsEditEmployeeModalOpen(true);
  };

  const editEmployeeHandler = async () => {
    if (
      !editEmployee.employee_id ||
      !editEmployee.name ||
      !editEmployee.wallet_address ||
      !editEmployee.salary
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
      setError("Failed to update employee: " + err.message);
    }
    setIsLoading(false);
  };

  // Owner: Delete employee
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
      setError("Failed to delete employee: " + err.message);
    }
    setIsLoading(false);
  };

  // Owner: Set employee salary
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

  // Owner: Pay employee salary
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
      setIsPayEmployeeModalOpen(false);
    } catch (err) {
      setError("Failed to pay salary: " + err.message);
    }
    setIsLoading(false);
  };

  // Owner: Fund the contract
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

  // Employee: Check payment status
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

  return (
    <div>
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
              <button
                onClick={() =>
                  window.ethereum.request({ method: "eth_requestAccounts" })
                }
                className="switch-btn"
              >
                Switch Wallet
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
                      <td>
                        <button
                          onClick={() => openEditEmployeeModal(employee)}
                          className="action-btn"
                          style={{
                            marginRight: "0.5rem",
                            padding: "0.25rem 0.5rem",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteConfirmModal(employee)}
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
            <p className="no-data">No employees found. Try refreshing.</p>
          )}
        </div>

        {/* Owner or Employee Actions */}
        <div className="section">
          {isOwner ? (
            <>
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
                    </div>
                    <div className="modal-buttons">
                      <button
                        onClick={() => setIsEditEmployeeModalOpen(false)}
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
                      Are you sure you want to delete {employeeToDelete.name}?
                    </p>
                    <div className="modal-buttons">
                      <button
                        onClick={() => setIsDeleteConfirmModalOpen(false)}
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
                        onChange={(e) => setEmployeeAddress(e.target.value)}
                        className="input"
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
            </>
          ) : (
            <>
              <h2 className="section-title">Employee Dashboard</h2>
              <div className="action-section">
                <h3 className="action-title">Check Payment Status</h3>
                <div className="input-group single">
                  <input
                    type="text"
                    placeholder="Your Address"
                    value={employeeCheckAddress}
                    onChange={(e) => setEmployeeCheckAddress(e.target.value)}
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
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 Smart Payroll System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
