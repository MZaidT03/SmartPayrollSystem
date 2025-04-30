pragma solidity ^0.8.0;

contract Payroll {
    address public owner;
    mapping(address => uint256) public salaries;
    mapping(address => bool) public paymentStatus;
    struct Payment {
        address employee;
        uint256 amount;
        uint256 timestamp;
        bytes32 txHash;
    }
    mapping(address => Payment[]) public paymentHistory;
    
    event PaymentSent(address indexed employee, uint256 amount, uint256 timestamp);
    event SalarySet(address indexed employee, uint256 salary);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function setSalary(address employee, uint256 salary) external onlyOwner {
        salaries[employee] = salary;
        emit SalarySet(employee, salary);
    }

    function paySalary(address employee) external payable onlyOwner {
        require(salaries[employee] > 0, "Salary not set");
        require(address(this).balance >= salaries[employee], "Insufficient contract balance");
        require(!paymentStatus[employee], "Already paid this cycle");

        paymentStatus[employee] = true;
        payable(employee).transfer(salaries[employee]);

        bytes32 txHash = keccak256(abi.encodePacked(employee, salaries[employee], block.timestamp));
        paymentHistory[employee].push(Payment(employee, salaries[employee], block.timestamp, txHash));
        emit PaymentSent(employee, salaries[employee], block.timestamp);
    }

    function resetPaymentStatus(address employee) external onlyOwner {
        paymentStatus[employee] = false;
    }

    function fundContract() external payable onlyOwner {}

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPaymentHistory(address employee) external view returns (Payment[] memory) {
        return paymentHistory[employee];
    }
}