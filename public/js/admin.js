// Admin Panel JavaScript

let currentEmployees = [];
let currentPage = 1;
let totalPages = 1;
let currentSort = { field: 'createdAt', order: 'desc' };
let currentFilters = { search: '', department: '', status: '' };

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initAdminPanel();
});

async function initAdminPanel() {
    // Check if user is admin
    const hasAccess = await requireAdmin();
    if (!hasAccess) return;

    // Initialize tab functionality
    initTabs();
    
    // Initialize modals
    initModals();
    
    // Load initial data
    await loadAdminData();
    
    // Initialize event listeners
    initEventListeners();
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load tab-specific data
            loadTabData(tabName);
        });
    });
}

function initModals() {
    // Employee modal
    const employeeModal = document.getElementById('employeeModal');
    const closeEmployeeModal = document.getElementById('closeEmployeeModal');
    const cancelEmployeeForm = document.getElementById('cancelEmployeeForm');
    
    closeEmployeeModal.addEventListener('click', () => hideModal('employeeModal'));
    cancelEmployeeForm.addEventListener('click', () => hideModal('employeeModal'));
    
    // Confirm modal
    const confirmModal = document.getElementById('confirmModal');
    const closeConfirmModal = document.getElementById('closeConfirmModal');
    const cancelConfirm = document.getElementById('cancelConfirm');
    
    closeConfirmModal.addEventListener('click', () => hideModal('confirmModal'));
    cancelConfirm.addEventListener('click', () => hideModal('confirmModal'));
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            hideModal(e.target.id);
        }
    });
}

function initEventListeners() {
    // Employee management
    document.getElementById('addEmployeeBtn').addEventListener('click', () => openEmployeeModal());
    document.getElementById('refreshEmployeesBtn').addEventListener('click', () => loadEmployees());
    document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
    
    // Filters and search
    document.getElementById('searchEmployees').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('filterDepartment').addEventListener('change', handleFilterChange);
    document.getElementById('filterStatus').addEventListener('change', handleFilterChange);
    
    // Table sorting
    document.querySelectorAll('.employees-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });
}

async function loadAdminData() {
    showLoading();
    
    try {
        // Load employees by default
        await loadEmployees();
        
        hideLoading();
        showContent();
    } catch (error) {
        console.error('Error loading admin data:', error);
        hideLoading();
        showError();
    }
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'employees':
            await loadEmployees();
            break;
        case 'statistics':
            await loadStatistics();
            break;
        case 'users':
            await loadUsers();
            break;
    }
}

async function loadEmployees() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10,
            sortBy: currentSort.field,
            sortOrder: currentSort.order,
            ...currentFilters
        });
        
        // Remove empty filters
        Object.keys(currentFilters).forEach(key => {
            if (!currentFilters[key]) {
                params.delete(key);
            }
        });
        
        const response = await fetch(`/api/admin/employees?${params}`);
        
        if (!response.ok) {
            throw new Error('Failed to load employees');
        }
        
        const data = await response.json();
        currentEmployees = data.data.employees;
        
        renderEmployeesTable(currentEmployees);
        renderPagination(data.data.pagination);
        
        // Load managers for the form
        await loadManagers();
        
    } catch (error) {
        console.error('Error loading employees:', error);
        showFormMessage('employeesTableBody', 'Failed to load employees', 'error');
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/employees/stats');
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        const data = await response.json();
        renderEmployeeStats(data.data);
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/protected/admin');
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const data = await response.json();
        renderSystemStats(data.stats);
        renderUsersTable(data.users);
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadManagers() {
    try {
        const response = await fetch('/api/admin/employees?status=active&limit=100');
        
        if (response.ok) {
            const data = await response.json();
            const managerSelect = document.getElementById('manager');
            
            managerSelect.innerHTML = '<option value="">Select Manager</option>';
            
            data.data.employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee._id;
                option.textContent = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName} (${employee.employeeId})`;
                managerSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading managers:', error);
    }
}

function renderEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTableBody');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No employees found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = employees.map(employee => `
        <tr>
            <td>${employee.employeeId}</td>
            <td>${employee.personalInfo.firstName} ${employee.personalInfo.lastName}</td>
            <td>${employee.personalInfo.email}</td>
            <td>${employee.jobInfo.title}</td>
            <td>${employee.jobInfo.department}</td>
            <td>
                <span class="status-badge status-${employee.status}">${employee.status}</span>
            </td>
            <td>${formatDate(employee.jobInfo.startDate)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewEmployee('${employee._id}')" title="View">
                        👁
                    </button>
                    <button class="btn-action btn-edit" onclick="editEmployee('${employee._id}')" title="Edit">
                        ✏
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteEmployee('${employee._id}', '${employee.personalInfo.firstName} ${employee.personalInfo.lastName}')" title="Delete">
                        🗑
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('employeesPagination');
    
    if (pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    totalPages = pagination.totalPages;
    currentPage = pagination.currentPage;
    
    let paginationHTML = `
        <button class="pagination-btn" ${!pagination.hasPrevPage ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            Previous
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    paginationHTML += `
        <button class="pagination-btn" ${!pagination.hasNextPage ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            Next
        </button>
        <span class="pagination-info">
            Page ${currentPage} of ${totalPages} (${pagination.totalEmployees} total)
        </span>
    `;
    
    container.innerHTML = paginationHTML;
}

function renderEmployeeStats(stats) {
    const statsContainer = document.getElementById('employeeStats');
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.overview.totalEmployees}</div>
            <div class="stat-label">Total Employees</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.overview.activeEmployees}</div>
            <div class="stat-label">Active Employees</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.overview.inactiveEmployees}</div>
            <div class="stat-label">Inactive Employees</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.overview.recentHires}</div>
            <div class="stat-label">Recent Hires (30 days)</div>
        </div>
    `;
    
    // Render department chart
    renderChart('departmentChart', stats.departmentStats, 'Department');
    
    // Render employment type chart
    renderChart('employmentTypeChart', stats.employmentTypeStats, 'Employment Type');
}

function renderChart(containerId, data, title) {
    const container = document.getElementById(containerId);
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="no-data">No data available</p>';
        return;
    }
    
    const total = data.reduce((sum, item) => sum + item.count, 0);
    
    container.innerHTML = data.map(item => {
        const percentage = total > 0 ? (item.count / total * 100) : 0;
        return `
            <div class="chart-item">
                <div class="chart-label">${item._id || 'Unknown'}</div>
                <div class="chart-value">${item.count}</div>
            </div>
            <div class="chart-bar">
                <div class="chart-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }).join('');
}

function renderSystemStats(stats) {
    const statsContainer = document.getElementById('systemStats');
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalUsers}</div>
            <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.activeUsers}</div>
            <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.adminUsers}</div>
            <div class="stat-label">Administrators</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.recentUsers}</div>
            <div class="stat-label">New Today</div>
        </div>
    `;
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">No users found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <span class="role-badge role-${user.role}">${user.role}</span>
            </td>
            <td>
                <span class="status-badge status-${user.isActive ? 'active' : 'inactive'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${formatDate(user.createdAt)}</td>
            <td>${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</td>
        </tr>
    `).join('');
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Clear form if it's the employee modal
    if (modalId === 'employeeModal') {
        clearEmployeeForm();
    }
}

function openEmployeeModal(employee = null) {
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('employeeForm');
    
    if (employee) {
        title.textContent = 'Edit Employee';
        populateEmployeeForm(employee);
        form.dataset.employeeId = employee._id;
    } else {
        title.textContent = 'Add Employee';
        clearEmployeeForm();
        delete form.dataset.employeeId;
    }
    
    showModal('employeeModal');
}

function populateEmployeeForm(employee) {
    // Personal Information
    document.getElementById('firstName').value = employee.personalInfo.firstName || '';
    document.getElementById('lastName').value = employee.personalInfo.lastName || '';
    document.getElementById('email').value = employee.personalInfo.email || '';
    document.getElementById('phone').value = employee.personalInfo.phone || '';
    document.getElementById('dateOfBirth').value = employee.personalInfo.dateOfBirth ? 
        new Date(employee.personalInfo.dateOfBirth).toISOString().split('T')[0] : '';
    
    // Address
    document.getElementById('street').value = employee.personalInfo.address?.street || '';
    document.getElementById('city').value = employee.personalInfo.address?.city || '';
    document.getElementById('state').value = employee.personalInfo.address?.state || '';
    document.getElementById('zipCode').value = employee.personalInfo.address?.zipCode || '';
    document.getElementById('country').value = employee.personalInfo.address?.country || 'United States';
    
    // Job Information
    document.getElementById('jobTitle').value = employee.jobInfo.title || '';
    document.getElementById('department').value = employee.jobInfo.department || '';
    document.getElementById('startDate').value = employee.jobInfo.startDate ? 
        new Date(employee.jobInfo.startDate).toISOString().split('T')[0] : '';
    document.getElementById('employmentType').value = employee.jobInfo.employmentType || 'full-time';
    document.getElementById('salary').value = employee.jobInfo.salary || '';
    document.getElementById('manager').value = employee.jobInfo.manager?._id || '';
    document.getElementById('status').value = employee.status || 'active';
}

function clearEmployeeForm() {
    document.getElementById('employeeForm').reset();
    document.getElementById('country').value = 'United States';
    document.getElementById('employmentType').value = 'full-time';
    document.getElementById('status').value = 'active';
    document.getElementById('employeeFormMessage').textContent = '';
    document.getElementById('employeeFormMessage').className = 'form-message';
}

// Employee CRUD Operations
async function handleEmployeeSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById('employeeFormMessage');
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    messageDiv.textContent = '';
    messageDiv.className = 'form-message';
    
    try {
        const formData = new FormData(form);
        const employeeData = formDataToObject(formData);
        
        const isEdit = form.dataset.employeeId;
        const url = isEdit ? `/api/admin/employees/${form.dataset.employeeId}` : '/api/admin/employees';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(employeeData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = isEdit ? 'Employee updated successfully!' : 'Employee created successfully!';
            messageDiv.className = 'form-message success';
            
            // Reload employees and close modal after delay
            setTimeout(() => {
                hideModal('employeeModal');
                loadEmployees();
            }, 1500);
        } else {
            messageDiv.textContent = result.message || 'Operation failed';
            messageDiv.className = 'form-message error';
            
            // Show validation errors if available
            if (result.errors && result.errors.length > 0) {
                const errorList = result.errors.map(err => `${err.field}: ${err.message}`).join(', ');
                messageDiv.textContent += ` (${errorList})`;
            }
        }
    } catch (error) {
        console.error('Error submitting employee form:', error);
        messageDiv.textContent = 'Network error. Please try again.';
        messageDiv.className = 'form-message error';
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function viewEmployee(employeeId) {
    try {
        const response = await fetch(`/api/admin/employees/${employeeId}`);
        
        if (response.ok) {
            const result = await response.json();
            openEmployeeModal(result.data);
            
            // Make form read-only
            const form = document.getElementById('employeeForm');
            const inputs = form.querySelectorAll('input, select');
            inputs.forEach(input => input.disabled = true);
            
            // Hide submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.style.display = 'none';
            
            // Change title
            document.getElementById('modalTitle').textContent = 'View Employee';
        }
    } catch (error) {
        console.error('Error viewing employee:', error);
    }
}

async function editEmployee(employeeId) {
    try {
        const response = await fetch(`/api/admin/employees/${employeeId}`);
        
        if (response.ok) {
            const result = await response.json();
            openEmployeeModal(result.data);
        }
    } catch (error) {
        console.error('Error loading employee for edit:', error);
    }
}

function deleteEmployee(employeeId, employeeName) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmAction = document.getElementById('confirmAction');
    
    confirmTitle.textContent = 'Delete Employee';
    confirmMessage.textContent = `Are you sure you want to delete ${employeeName}? This action cannot be undone.`;
    
    confirmAction.onclick = async () => {
        try {
            const response = await fetch(`/api/admin/employees/${employeeId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                hideModal('confirmModal');
                loadEmployees();
            } else {
                const result = await response.json();
                alert(result.message || 'Failed to delete employee');
            }
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Network error. Please try again.');
        }
    };
    
    showModal('confirmModal');
}

// Utility Functions
function formDataToObject(formData) {
    const obj = {};
    
    for (const [key, value] of formData.entries()) {
        if (value === '') continue; // Skip empty values
        
        const keys = key.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    return obj;
}

function handleSearch(e) {
    currentFilters.search = e.target.value;
    currentPage = 1;
    loadEmployees();
}

function handleFilterChange(e) {
    const filterId = e.target.id;
    const filterKey = filterId.replace('filter', '').toLowerCase();
    currentFilters[filterKey] = e.target.value;
    currentPage = 1;
    loadEmployees();
}

function handleSort(field) {
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }
    
    loadEmployees();
}

function changePage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        loadEmployees();
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading() {
    document.getElementById('adminLoading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('adminLoading').style.display = 'none';
}

function showContent() {
    document.getElementById('adminContent').style.display = 'block';
}

function showError() {
    document.getElementById('adminError').style.display = 'block';
}

function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    
    if (btnText && btnLoader) {
        if (isLoading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            button.disabled = true;
        } else {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            button.disabled = false;
        }
    }
}

