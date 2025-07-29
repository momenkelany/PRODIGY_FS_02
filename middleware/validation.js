const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');

// Enhanced validation middleware for employee operations
const validateEmployeeId = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if ID is a valid MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        message: 'Invalid employee ID format',
        error: 'Employee ID must be a valid MongoDB ObjectId'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Validation error' });
  }
};

// Validate manager assignment
const validateManagerAssignment = async (req, res, next) => {
  try {
    if (req.body.jobInfo && req.body.jobInfo.manager) {
      const managerId = req.body.jobInfo.manager;
      
      // Check if manager exists and is active
      const manager = await Employee.findById(managerId);
      if (!manager) {
        return res.status(400).json({ 
          message: 'Invalid manager assignment',
          error: 'Specified manager does not exist'
        });
      }
      
      if (manager.status !== 'active') {
        return res.status(400).json({ 
          message: 'Invalid manager assignment',
          error: 'Specified manager is not active'
        });
      }
      
      // Prevent self-assignment as manager
      if (req.params.id && managerId === req.params.id) {
        return res.status(400).json({ 
          message: 'Invalid manager assignment',
          error: 'Employee cannot be their own manager'
        });
      }
      
      // Prevent circular management hierarchy
      if (req.params.id) {
        const isCircular = await checkCircularHierarchy(req.params.id, managerId);
        if (isCircular) {
          return res.status(400).json({ 
            message: 'Invalid manager assignment',
            error: 'This assignment would create a circular management hierarchy'
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Manager validation error:', error);
    res.status(500).json({ message: 'Manager validation failed' });
  }
};

// Helper function to check for circular hierarchy
async function checkCircularHierarchy(employeeId, managerId, visited = new Set()) {
  if (visited.has(managerId)) {
    return true; // Circular reference detected
  }
  
  if (managerId === employeeId) {
    return true; // Direct circular reference
  }
  
  visited.add(managerId);
  
  const manager = await Employee.findById(managerId);
  if (manager && manager.jobInfo.manager) {
    return await checkCircularHierarchy(employeeId, manager.jobInfo.manager.toString(), visited);
  }
  
  return false;
}

// Validate business rules
const validateBusinessRules = [
  // Custom validation for salary based on employment type
  body('jobInfo.salary').custom((value, { req }) => {
    if (value && req.body.jobInfo && req.body.jobInfo.employmentType === 'intern' && value > 50000) {
      throw new Error('Intern salary cannot exceed $50,000');
    }
    return true;
  }),
  
  // Custom validation for start date
  body('jobInfo.startDate').custom((value) => {
    if (value) {
      const startDate = new Date(value);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      if (startDate > oneYearFromNow) {
        throw new Error('Start date cannot be more than one year in the future');
      }
    }
    return true;
  }),
  
  // Custom validation for age based on date of birth
 body('personalInfo.dateOfBirth').custom((value) => {
  if (value) {
    const birthDate = new Date(value);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if the current date is before the birth date in this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Enforce age constraints
    if (age < 16) {
      throw new Error('Employee must be at least 16 years old');
    }

    if (age > 100) {
      throw new Error('Please verify the date of birth');
    }
  }
  return true;
}),
];

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  try {
    // Recursively sanitize all string inputs
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove potentially harmful characters
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(500).json({ message: 'Input processing failed' });
  }
};

// Rate limiting for admin operations
const adminRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each admin to 50 requests per windowMs
  message: {
    message: 'Too many admin requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for rate limiting instead of IP
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log the action after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const logEntry = {
          timestamp: new Date(),
          adminId: req.user ? req.user._id : null,
          adminUsername: req.user ? req.user.username : null,
          action: action,
          resourceId: req.params.id || null,
          requestBody: action.includes('CREATE') || action.includes('UPDATE') ? req.body : null,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        };
        
        console.log('AUDIT LOG:', JSON.stringify(logEntry, null, 2));
        
        // In production, you would save this to a dedicated audit log collection
        // await AuditLog.create(logEntry);
      }
      
      originalSend.call(this, body);
    };
    
    next();
  };
};

// Error handling middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      message: 'Validation failed',
      errors: errorMessages,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Security headers middleware for admin routes
const adminSecurityHeaders = (req, res, next) => {
  // Additional security headers for admin operations
  res.set({
    'X-Admin-Operation': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
};

module.exports = {
  validateEmployeeId,
  validateManagerAssignment,
  validateBusinessRules,
  sanitizeInput,
  adminRateLimit,
  auditLog,
  handleValidationErrors,
  adminSecurityHeaders
};

