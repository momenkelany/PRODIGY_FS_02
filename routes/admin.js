const express = require('express');
const Employee = require('../models/Employee');
const { requireAdmin } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const {
  validateEmployeeId,
  validateManagerAssignment,
  validateBusinessRules,
  sanitizeInput,
  adminRateLimit,
  auditLog,
  handleValidationErrors,
  adminSecurityHeaders
} = require('../middleware/validation');

const router = express.Router();

// Apply security middleware to all admin routes
router.use(adminSecurityHeaders);
router.use(adminRateLimit);
router.use(requireAdmin);
router.use(sanitizeInput);

// Validation middleware for employee creation
const validateEmployeeCreation = [
  body('personalInfo.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('personalInfo.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  body('personalInfo.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),
  body('personalInfo.phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('personalInfo.dateOfBirth')
    .optional()
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value && value >= new Date()) {
        throw new Error('Date of birth cannot be in the future');
      }
      return true;
    }),
  body('personalInfo.address.street')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters'),
  body('personalInfo.address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('City can only contain letters, spaces, hyphens, apostrophes, and periods'),
  body('personalInfo.address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  body('personalInfo.address.zipCode')
    .optional()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please enter a valid ZIP code'),
  body('jobInfo.title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Job title is required and cannot exceed 100 characters'),
  body('jobInfo.department')
    .isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Customer Service', 'IT', 'Legal', 'Other'])
    .withMessage('Please select a valid department'),
  body('jobInfo.startDate')
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value > new Date()) {
        throw new Error('Start date cannot be in the future');
      }
      return true;
    }),
  body('jobInfo.salary')
    .optional()
    .isNumeric()
    .custom((value) => {
      if (value < 0 || value > 10000000) {
        throw new Error('Salary must be between 0 and 10,000,000');
      }
      return true;
    }),
  body('jobInfo.employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'intern'])
    .withMessage('Please select a valid employment type'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'terminated'])
    .withMessage('Please select a valid status'),
  ...validateBusinessRules
];

// Validation middleware for employee updates
const validateEmployeeUpdate = [
  body('personalInfo.firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('personalInfo.lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('personalInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('personalInfo.phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('personalInfo.dateOfBirth')
    .optional()
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value && value >= new Date()) {
        throw new Error('Date of birth cannot be in the future');
      }
      return true;
    }),
  body('jobInfo.title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Job title cannot exceed 100 characters'),
  body('jobInfo.department')
    .optional()
    .isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Customer Service', 'IT', 'Legal', 'Other'])
    .withMessage('Please select a valid department'),
  body('jobInfo.startDate')
    .optional()
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value > new Date()) {
        throw new Error('Start date cannot be in the future');
      }
      return true;
    }),
  body('jobInfo.salary')
    .optional()
    .isNumeric()
    .custom((value) => {
      if (value < 0 || value > 10000000) {
        throw new Error('Salary must be between 0 and 10,000,000');
      }
      return true;
    }),
  body('jobInfo.employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'intern'])
    .withMessage('Please select a valid employment type'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'terminated'])
    .withMessage('Please select a valid status')
];

// GET /api/admin/employees - Get all employees with pagination and filtering
router.get('/employees', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('department').optional().isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Customer Service', 'IT', 'Legal', 'Other']),
  query('status').optional().isIn(['active', 'inactive', 'terminated']),
  query('sortBy').optional().isIn(['employeeId', 'personalInfo.firstName', 'personalInfo.lastName', 'jobInfo.title', 'jobInfo.department', 'jobInfo.startDate', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term cannot exceed 100 characters')
], handleValidationErrors, auditLog('READ_EMPLOYEES'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (req.query.department) filter['jobInfo.department'] = req.query.department;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { 'personalInfo.firstName': { $regex: req.query.search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: req.query.search, $options: 'i' } },
        { 'personalInfo.email': { $regex: req.query.search, $options: 'i' } },
        { employeeId: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Execute query
    const employees = await Employee.find(filter)
      .populate('jobInfo.manager', 'personalInfo.firstName personalInfo.lastName employeeId')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Employee.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      message: 'Employees retrieved successfully',
      data: {
        employees,
        pagination: {
          currentPage: page,
          totalPages,
          totalEmployees: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

// GET /api/admin/employees/:id - Get single employee
router.get('/employees/:id', validateEmployeeId, auditLog('READ_EMPLOYEE'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('jobInfo.manager', 'personalInfo.firstName personalInfo.lastName employeeId')
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: 'Employee retrieved successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }
    res.status(500).json({ message: 'Failed to fetch employee' });
  }
});

// POST /api/admin/employees - Create new employee
router.post('/employees', validateEmployeeCreation, validateManagerAssignment, handleValidationErrors, auditLog('CREATE_EMPLOYEE'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if email already exists
    const existingEmployee = await Employee.findOne({ 'personalInfo.email': req.body.personalInfo.email });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Auto-generate employeeId if not provided
    const employeeId = req.body.employeeId || generateEmployeeId();

    // Create new employee data
    const employeeData = {
      ...req.body,
      employeeId: employeeId, // Use the generated or provided employeeId
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const employee = new Employee(employeeData);
    await employee.save();

    // Populate references for response
    await employee.populate('jobInfo.manager', 'personalInfo.firstName personalInfo.lastName employeeId');
    await employee.populate('createdBy', 'username');

    res.status(201).json({
      message: 'Employee created successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    if (error.code === 11000) {
      if (error.keyPattern.employeeId) {
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
      if (error.keyPattern['personalInfo.email']) {
        return res.status(400).json({ message: 'Employee with this email already exists' });
      }
    }
    res.status(500).json({ message: 'Failed to create employee' });
  }
});
// Generate unique employee ID
function generateEmployeeId() {
  return `EMP${Math.floor(Math.random() * 10000)}`; // Simple unique ID generation logic
}


// PUT /api/admin/employees/:id - Update employee
router.put('/employees/:id', validateEmployeeId, validateEmployeeUpdate, validateManagerAssignment, handleValidationErrors, auditLog('UPDATE_EMPLOYEE'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if employee exists
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if email is being updated and if it conflicts with another employee
    if (req.body.personalInfo && req.body.personalInfo.email) {
      const emailConflict = await Employee.findOne({
        'personalInfo.email': req.body.personalInfo.email,
        _id: { $ne: req.params.id }
      });
      if (emailConflict) {
        return res.status(400).json({ message: 'Another employee with this email already exists' });
      }
    }

    // Update employee
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('jobInfo.manager', 'personalInfo.firstName personalInfo.lastName employeeId')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    res.json({
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }
    if (error.code === 11000) {
      if (error.keyPattern['personalInfo.email']) {
        return res.status(400).json({ message: 'Another employee with this email already exists' });
      }
    }
    res.status(500).json({ message: 'Failed to update employee' });
  }
});

// DELETE /api/admin/employees/:id - Delete employee
router.delete('/employees/:id', validateEmployeeId, auditLog('DELETE_EMPLOYEE'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if employee is a manager for other employees
    const managedEmployees = await Employee.find({ 'jobInfo.manager': req.params.id });
    if (managedEmployees.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete employee who is managing other employees',
        managedEmployees: managedEmployees.length
      });
    }

    await Employee.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Employee deleted successfully',
      data: {
        deletedEmployee: {
          id: employee._id,
          employeeId: employee.employeeId,
          fullName: employee.fullName
        }
      }
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }
    res.status(500).json({ message: 'Failed to delete employee' });
  }
});

// GET /api/admin/employees/stats - Get employee statistics
router.get('/employees/stats', auditLog('READ_EMPLOYEE_STATS'), async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    const inactiveEmployees = await Employee.countDocuments({ status: 'inactive' });
    const terminatedEmployees = await Employee.countDocuments({ status: 'terminated' });

    // Department statistics
    const departmentStats = await Employee.aggregate([
      { $group: { _id: '$jobInfo.department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Employment type statistics
    const employmentTypeStats = await Employee.aggregate([
      { $group: { _id: '$jobInfo.employmentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentHires = await Employee.countDocuments({
      'jobInfo.startDate': { $gte: thirtyDaysAgo }
    });

    res.json({
      message: 'Employee statistics retrieved successfully',
      data: {
        overview: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
          terminatedEmployees,
          recentHires
        },
        departmentStats,
        employmentTypeStats
      }
    });
  } catch (error) {
    console.error('Error fetching employee statistics:', error);
    res.status(500).json({ message: 'Failed to fetch employee statistics' });
  }
});

module.exports = router;

