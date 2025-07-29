// Dashboard functionality

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    loadDashboard();
    initProfileModal();
});

async function loadDashboard() {
    // Check authentication
    const isAuthenticated = await checkAuthStatus();
    
    const loadingDiv = document.getElementById('dashboardLoading');
    const contentDiv = document.getElementById('dashboardContent');
    const errorDiv = document.getElementById('dashboardError');
    
    if (!isAuthenticated) {
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        // Load dashboard data
        const response = await fetch('/api/protected/dashboard');
        
        if (response.ok) {
            const data = await response.json();
            
            // Hide loading, show content
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            
            // Populate user details
            populateUserDetails(data.user);
            
            // Load user stats
            loadUserStats(data.user);
            
            // Update activity times
            updateActivityTimes(data.user);
            
        } else {
            throw new Error('Failed to load dashboard');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
}

function populateUserDetails(user) {
    const userDetailsDiv = document.getElementById('userDetails');
    
    userDetailsDiv.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Username:</span>
            <span class="detail-value">${user.username}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${user.email}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Role:</span>
            <span class="role-badge role-${user.role}">${user.role}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Member Since:</span>
            <span class="detail-value">${formatDate(user.createdAt)}</span>
        </div>
    `;
}

function loadUserStats(user) {
    const userStatsDiv = document.getElementById('userStats');
    
    const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    const lastLoginDays = user.lastLogin ? 
        Math.floor((new Date() - new Date(user.lastLogin)) / (1000 * 60 * 60 * 24)) : 
        'Never';
    
    userStatsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-number">${accountAge}</div>
            <div class="stat-label">Days Active</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${lastLoginDays === 'Never' ? 'N/A' : lastLoginDays}</div>
            <div class="stat-label">Days Since Login</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${user.role === 'admin' ? '✓' : '○'}</div>
            <div class="stat-label">Admin Status</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">✓</div>
            <div class="stat-label">Account Active</div>
        </div>
    `;
}

function updateActivityTimes(user) {
    const lastLoginTime = document.getElementById('lastLoginTime');
    const accountCreatedTime = document.getElementById('accountCreatedTime');
    
    if (lastLoginTime) {
        lastLoginTime.textContent = formatDate(user.lastLogin);
    }
    
    if (accountCreatedTime) {
        accountCreatedTime.textContent = formatDate(user.createdAt);
    }
}

function initProfileModal() {
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeModal = document.getElementById('closeModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const profileForm = document.getElementById('profileForm');
    
    // Open modal
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', async function() {
            const user = await getCurrentUser();
            if (user) {
                document.getElementById('editUsername').value = user.username;
                document.getElementById('editEmail').value = user.email;
                profileModal.style.display = 'flex';
            }
        });
    }
    
    // Close modal
    function closeProfileModal() {
        profileModal.style.display = 'none';
        document.getElementById('profileMessage').textContent = '';
        document.getElementById('profileMessage').className = 'form-message';
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', closeProfileModal);
    }
    
    if (cancelEdit) {
        cancelEdit.addEventListener('click', closeProfileModal);
    }
    
    // Close modal when clicking outside
    if (profileModal) {
        profileModal.addEventListener('click', function(e) {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }
    
    // Handle profile form submission
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Quick action buttons
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const securityBtn = document.getElementById('securityBtn');
    
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', function() {
            location.reload();
        });
    }
    
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', function() {
            editProfileBtn.click();
        });
    }
    
    if (securityBtn) {
        securityBtn.addEventListener('click', function() {
            alert('Security settings feature coming soon!');
        });
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const messageDiv = document.getElementById('profileMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Get form data
    const formData = new FormData(e.target);
    const profileData = {
        username: formData.get('username'),
        email: formData.get('email')
    };
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    messageDiv.textContent = '';
    messageDiv.className = 'form-message';
    
    try {
        const response = await fetch('/api/protected/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = 'Profile updated successfully!';
            messageDiv.className = 'form-message success';
            
            // Reload dashboard after short delay
            setTimeout(() => {
                document.getElementById('profileModal').style.display = 'none';
                loadDashboard();
            }, 1500);
        } else {
            messageDiv.textContent = result.message || 'Update failed';
            messageDiv.className = 'form-message error';
        }
    } catch (error) {
        messageDiv.textContent = 'Network error. Please try again.';
        messageDiv.className = 'form-message error';
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

// Auto-refresh dashboard every 5 minutes
setInterval(async function() {
    const isAuthenticated = await checkAuthStatus();
    if (isAuthenticated && document.getElementById('dashboardContent').style.display !== 'none') {
        console.log('Auto-refreshing dashboard data...');
        loadDashboard();
    }
}, 5 * 60 * 1000);