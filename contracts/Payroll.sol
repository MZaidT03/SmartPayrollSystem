// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Payroll {
    address public owner;
    mapping(address => uint256) public salaries;
    mapping(address => bool) public paymentStatus;

    event PaymentSent(address indexed employee, uint256 amount, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    function setSalary(address employee, uint256 salary) external onlyOwner {
        salaries[employee] = salary;
    }

    function paySalary(address employee) external onlyOwner payable {
        require(salaries[employee] > 0, "Salary not set");
        require(address(this).balance >= salaries[employee], "Insufficient contract balance");
        require(!paymentStatus[employee], "Already paid this period");

        (bool sent, ) = employee.call{value: salaries[employee]}("");
        require(sent, "Payment failed");

        paymentStatus[employee] = true;
        emit PaymentSent(employee, salaries[employee], block.timestamp);
    }

    function resetPaymentStatus(address employee) external onlyOwner {
        paymentStatus[employee] = false;
    }

    function fundContract() external payable onlyOwner {}

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}