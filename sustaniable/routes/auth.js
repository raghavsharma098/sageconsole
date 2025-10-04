const express = require('express');
const router = express.Router();
const Company = require('../models/Company');

// Registration page
router.get('/register', (req, res) => {
    res.render('auth/register', { 
        title: 'Company Registration',
        error: null,
        formData: {}
    });
});

// Register company
router.post('/register', async (req, res) => {
    try {
        const { companyName, email, password, confirmPassword, industry } = req.body;

        // Validation
        if (password !== confirmPassword) {
            return res.render('auth/register', {
                title: 'Company Registration',
                error: 'Passwords do not match',
                formData: req.body
            });
        }

        // Check if company already exists
        const existingCompany = await Company.findOne({ email });
        if (existingCompany) {
            return res.render('auth/register', {
                title: 'Company Registration',
                error: 'Company with this email already exists',
                formData: req.body
            });
        }

        // Create new company
        const company = new Company({
            companyName,
            email,
            password,
            industry
        });

        await company.save();

        // Auto login after registration
        req.session.companyId = company.companyId;
        req.session.companyName = company.companyName;

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Company Registration',
            error: 'An error occurred during registration. Please try again.',
            formData: req.body
        });
    }
});

// Login page
router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Company Login',
        error: null
    });
});

// Login company
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find company
        const company = await Company.findOne({ email });
        if (!company) {
            return res.render('auth/login', {
                title: 'Company Login',
                error: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await company.comparePassword(password);
        if (!isPasswordValid) {
            return res.render('auth/login', {
                title: 'Company Login',
                error: 'Invalid email or password'
            });
        }

        // Set session
        req.session.companyId = company.companyId;
        req.session.companyName = company.companyName;

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', {
            title: 'Company Login',
            error: 'An error occurred during login. Please try again.'
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;
