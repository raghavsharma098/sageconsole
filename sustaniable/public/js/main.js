// Main JavaScript functionality for the Sustainability Assessment Platform

document.addEventListener('DOMContentLoaded', function() {
    // Initialize common functionality
    initializeFormValidation();
    initializeFileUploads();
    initializeTooltips();
    preventUnwantedScrolling();
});

// Prevent unwanted auto-scrolling behaviors
function preventUnwantedScrolling() {
    // Prevent hash changes from causing jumpy scrolling
    if (window.location.hash) {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 1);
    }
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Prevent focus-related auto-scrolling
    document.addEventListener('focusin', function(e) {
        e.preventDefault();
    });
}

// Form validation enhancement
function initializeFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                showAlert('Please fill in all required fields correctly.', 'error');
            }
        });
    });
}

// Enhanced file upload functionality
function initializeFileUploads() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            validateFileUpload(this);
            updateFileUploadDisplay(this);
        });
    });
}

// Validate file uploads
function validateFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif'];

    if (file.size > maxSize) {
        showAlert('File size must be less than 10MB.', 'error');
        input.value = '';
        return false;
    }

    if (!allowedTypes.includes(file.type)) {
        showAlert('Please upload a valid file type (PDF, DOC, DOCX, TXT, JPG, PNG, GIF).', 'error');
        input.value = '';
        return false;
    }

    return true;
}

// Update file upload display
function updateFileUploadDisplay(input) {
    const file = input.files[0];
    const container = input.closest('.file-upload');
    
    if (file && container) {
        const existingInfo = container.querySelector('.file-info');
        if (existingInfo) {
            existingInfo.remove();
        }

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.style.cssText = 'margin-top: 1rem; padding: 0.5rem; background: #e8f5e8; border-radius: 4px; font-size: 0.9rem;';
        fileInfo.innerHTML = `
            <strong>Selected:</strong> ${file.name}<br>
            <small>Size: ${formatFileSize(file.size)}</small>
        `;
        container.appendChild(fileInfo);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Form validation
function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            highlightField(field, false);
        } else {
            highlightField(field, true);
        }
    });

    return isValid;
}

// Highlight field validation state
function highlightField(field, isValid) {
    field.style.borderColor = isValid ? '#28a745' : '#dc3545';
    
    // Remove existing validation message
    const existingMsg = field.parentNode.querySelector('.validation-message');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Add validation message for invalid fields
    if (!isValid) {
        const message = document.createElement('div');
        message.className = 'validation-message';
        message.style.cssText = 'color: #dc3545; font-size: 0.8rem; margin-top: 0.25rem;';
        message.textContent = 'This field is required.';
        field.parentNode.appendChild(message);
    }
}

// Show alert messages
function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.dynamic-alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} dynamic-alert`;
    alert.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; min-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    alert.textContent = message;

    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'float: right; cursor: pointer; font-weight: bold; margin-left: 10px;';
    closeBtn.onclick = () => alert.remove();
    alert.appendChild(closeBtn);

    document.body.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Initialize tooltips (for future use)
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            showTooltip(this, this.getAttribute('data-tooltip'));
        });
        
        element.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

// Show tooltip
function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 1000;
        max-width: 200px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
}

// Hide tooltip
function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Auto-save functionality for forms
function enableAutoSave(formId, saveUrl, interval = 30000) {
    const form = document.getElementById(formId);
    if (!form) return;

    let lastSaved = Date.now();
    let hasChanges = false;

    // Track changes
    form.addEventListener('input', function() {
        hasChanges = true;
    });

    // Auto-save interval
    setInterval(function() {
        if (hasChanges && (Date.now() - lastSaved) > interval) {
            autoSaveForm(form, saveUrl);
            hasChanges = false;
            lastSaved = Date.now();
        }
    }, 5000); // Check every 5 seconds
}

// Auto-save form data
function autoSaveForm(form, saveUrl) {
    const formData = new FormData(form);
    
    fetch(saveUrl, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAutoSaveIndicator();
        }
    })
    .catch(error => {
        console.log('Auto-save failed:', error);
    });
}

// Show auto-save indicator
function showAutoSaveIndicator() {
    const indicator = document.createElement('div');
    indicator.textContent = 'Auto-saved';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 1000;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 2000);
}

// Smooth scrolling for anchor links
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(e.target.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});

// Loading state management
function showLoading(element) {
    if (element.tagName === 'BUTTON') {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.innerHTML = '<span class="spinner"></span> Loading...';
    }
}

function hideLoading(element) {
    if (element.tagName === 'BUTTON') {
        element.disabled = false;
        element.textContent = element.dataset.originalText || 'Submit';
    }
}

// Mobile menu toggle (if needed)
function toggleMobileMenu() {
    const nav = document.querySelector('.nav');
    if (nav) {
        nav.classList.toggle('mobile-open');
    }
}

// Responsive table handling
function makeTablesResponsive() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        if (!table.parentNode.classList.contains('table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            wrapper.style.overflowX = 'auto';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// Initialize responsive tables on load
document.addEventListener('DOMContentLoaded', makeTablesResponsive);

// Export functions for global use
window.sustainAssess = {
    showAlert,
    showLoading,
    hideLoading,
    enableAutoSave,
    validateForm
};
