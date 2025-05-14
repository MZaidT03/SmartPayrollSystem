import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./index.css";

const EmployeeDetails = ({ calculateTotalSalary }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const employee = location.state?.employee;

  const goBack = () => {
    navigate("/");
  };

  if (!employee) {
    return (
      <div className="container">
        <div className="notification-error">
          <p>No employee data provided.</p>
        </div>
        <button onClick={() => navigate("/")} className="cancel-btn">
          Go Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h2 className="section-title ">Details for {employee.name}</h2>
      <div className="section">
        <h3 className="action-title">Employee Information</h3>
        <div className="details-grid p-10">
          <div className="detail-item">
            <span className="detail-label m-10">Employee ID:</span>
            <span>{employee.employee_id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Name:</span>
            <span>{employee.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Wallet Address:</span>
            <span className="mono">{employee.wallet_address}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Salary (ETH):</span>
            <span>{employee.salary}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email:</span>
            <span>{employee.email}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Department:</span>
            <span>{employee.department_name || "N/A"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Role:</span>
            <span>{employee.role_name || "N/A"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Base Salary (ETH):</span>
            <span>{employee.base_salary || "N/A"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Salary Paid (ETH):</span>
            <span>{calculateTotalSalary(employee.wallet_address)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <button onClick={goBack} className="cancel-btn">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default EmployeeDetails;
