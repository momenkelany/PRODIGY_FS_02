// Authentication utilities and global functions

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        return data.authenticated;
    } catch (error) {
        console.error('Error checking auth status:', error);
        return false;
    }
}

// Get current user information
async function getCurrentUser() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
        return null;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Logout user
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            // Redirect to home page
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize navigation based on auth status
async function initNavigation() {
    const isAuthenticated = await checkAuthStatus();
    const currentUser = isAuthenticated ? await getCurrentUser() : null;
    
    // Navigation elements
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const dashboardLink = document.getElementById('dashboardLink');
    const adminLink = document.getElementById('adminLink');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Hero elements
    const heroActions = document.getElementById('heroActions');
    const userWelcome = document.getElementById('userWelcome');
    const userName = document.getElementById('userName');
    
    if (isAuthenticated && currentUser) {
        // User is logged in
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        
        // Show admin link for admin users
        if (adminLink && currentUser.role === 'admin') {
            adminLink.style.display = 'inline-block';
        }
        
        // Update hero section on home page
        if (heroActions && userWelcome && userName) {
            heroActions.style.display = 'none';
            userWelcome.style.display = 'block';
            userName.textContent = currentUser.username;
        }
    } else {
        // User is not logged in
        if (loginLink) loginLink.style.display = 'inline-block';
        if (registerLink) registerLink.style.display = 'inline-block';
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
    
    // Add logout event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Mobile navigation toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            navLinks.classList.toggle('nav-active');
        });
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Today at ' + date.toLocaleTimeString();
    } else if (diffDays === 2) {
        return 'Yesterday at ' + date.toLocaleTimeString();
    } else if (diffDays < 7) {
        return diffDays + ' days ago';
    } else {
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    }
}

// Show loading state for buttons
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

// Display form messages
function showFormMessage(messageElement, message, type = 'info') {
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `form-message ${type}`;
    }
}

// Redirect if not authenticated
async function requireAuth() {
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Redirect if not admin
async function requireAdmin() {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = '/dashboard';
        return false;
    }
    return true;
}

// API request helper with error handling
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Export functions for use in other scripts
window.authUtils = {
    checkAuthStatus,
    getCurrentUser,
    logout,
    initNavigation,
    formatDate,
    setButtonLoading,
    showFormMessage,
    requireAuth,
    requireAdmin,
    apiRequest
};