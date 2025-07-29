const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^EMP\d{4}$/, 'Employee ID must be in format EMP0001']
  },
  personalInfo: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
      minlength: [2, 'First name must be at least 2 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      minlength: [2, 'Last name must be at least 2 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(value) {
          if (!value) return true; // Optional field
          return value < new Date();
        },
        message: 'Date of birth cannot be in the future'
      }
    },
    address: {
      street: {
        type: String,
        trim: true,
        maxlength: [100, 'Street address cannot exceed 100 characters']
      },
      city: {
        type: String,
        trim: true,
        maxlength: [50, 'City cannot exceed 50 characters']
      },
      state: {
        type: String,
        trim: true,
        maxlength: [50, 'State cannot exceed 50 characters']
      },
      zipCode: {
        type: String,
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
      },
      country: {
        type: String,
        trim: true,
        maxlength: [50, 'Country cannot exceed 50 characters'],
        default: 'United States'
      }
    }
  },
  jobInfo: {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [100, 'Job title cannot exceed 100 characters']
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      enum: {
        values: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Customer Service', 'IT', 'Legal', 'Other'],
        message: 'Please select a valid department'
      }
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      validate: {
        validator: function(value) {
          return value <= new Date();
        },
        message: 'Start date cannot be in the future'
      }
    },
    salary: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
      max: [10000000, 'Salary cannot exceed $10,000,000']
    },
    employmentType: {
      type: String,
      enum: {
        values: ['full-time', 'part-time', 'contract', 'intern'],
        message: 'Please select a valid employment type'
      },
      default: 'full-time'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'terminated'],
      message: 'Please select a valid status'
    },
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Update the updatedAt field before saving
employeeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate employee ID automatically if not provided

 employeeSchema.pre('save', async function(next) {
  if (!this.employeeId) {
    try {
      const lastEmployee = await this.constructor.findOne({}, {}, { sort: { 'employeeId': -1 } });
      let nextId = 1;
      
      if (lastEmployee && lastEmployee.employeeId) {
        const lastIdNumber = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        nextId = lastIdNumber + 1;
      }
      
      this.employeeId = `EMP${nextId.toString().padStart(4, '0')}`;  // Ensure it follows the format EMP0001, EMP0002, etc.
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for years of service
employeeSchema.virtual('yearsOfService').get(function() {
  if (!this.jobInfo.startDate) return 0;
  const now = new Date();
  const startDate = new Date(this.jobInfo.startDate);
  return Math.floor((now - startDate) / (365.25 * 24 * 60 * 60 * 1000));
});

// Ensure virtual fields are serialized
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

// Index for better query performance
employeeSchema.index({ 'personalInfo.email': 1 });
employeeSchema.index({ 'jobInfo.department': 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ employeeId: 1 });

module.exports = mongoose.model('Employee', employeeSchema);

