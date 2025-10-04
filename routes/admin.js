const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');

// Admin credentials
const ADMIN_CREDENTIALS = {
    id: 'admin',
    password: 'admin123'
};

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
    if (req.session.adminLoggedIn) {
        return next();
    }
    res.redirect('/admin/login');
}

// Root admin route - redirect to login or dashboard
router.get('/', (req, res) => {
    if (req.session.adminLoggedIn) {
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin/login');
    }
});

// Admin login page
router.get('/login', (req, res) => {
    res.render('admin/login', { 
        title: 'Admin Login',
        error: req.query.error 
    });
});

// Admin login POST
router.post('/login', (req, res) => {
    const { id, password } = req.body;
    
    if (id === ADMIN_CREDENTIALS.id && password === ADMIN_CREDENTIALS.password) {
        req.session.adminLoggedIn = true;
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/admin/login?error=Invalid credentials');
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.adminLoggedIn = false;
    res.redirect('/admin/login');
});

// Admin dashboard
router.get('/dashboard', requireAdminAuth, async (req, res) => {
    try {
        const totalCompanies = await Company.countDocuments();
        const totalAssessments = await Assessment.countDocuments();
        const totalReports = await Report.countDocuments();
        
        // Get recent reports and manually populate company data
        const reports = await Report.find()
            .sort({ generatedDate: -1 })
            .limit(10);
            
        const recentReports = [];
        for (const report of reports) {
            const company = await Company.findOne({ companyId: report.companyId });
            if (company) {
                recentReports.push({
                    ...report.toObject(),
                    companyId: company
                });
            }
        }

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: {
                totalCompanies,
                totalAssessments,
                totalReports
            },
            recentReports
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Server error');
    }
});

// View all compliance scores
router.get('/compliance-scores', requireAdminAuth, async (req, res) => {
    try {
        const reportData = await Report.find()
            .sort({ generatedDate: -1 });
            
        const reports = [];
        for (const report of reportData) {
            const company = await Company.findOne({ companyId: report.companyId });
            if (company) {
                reports.push({
                    ...report.toObject(),
                    companyId: company
                });
            }
        }

        res.render('admin/compliance-scores', {
            title: 'All Compliance Scores',
            reports
        });
    } catch (error) {
        console.error('Error fetching compliance scores:', error);
        res.status(500).send('Server error');
    }
});

// Manage assessment questions
router.get('/questions', requireAdminAuth, async (req, res) => {
    try {
        // Load questions from JSON files
        const fs = require('fs');
        const path = require('path');
        
        const generalQuestions = JSON.parse(
            fs.readFileSync(path.join(__dirname, '../data/questions/general.json'), 'utf8')
        );
        
        // Load industry-specific questions
        const industriesDir = path.join(__dirname, '../data/questions/industries');
        const industryFiles = fs.readdirSync(industriesDir);
        const industryQuestions = {};
        
        for (const file of industryFiles) {
            const industry = path.basename(file, '.json');
            industryQuestions[industry] = JSON.parse(
                fs.readFileSync(path.join(industriesDir, file), 'utf8')
            );
        }

        res.render('admin/questions', {
            title: 'Manage Questions',
            generalQuestions,
            industryQuestions
        });
    } catch (error) {
        console.error('Error loading questions:', error);
        res.status(500).send('Server error');
    }
});

// Update general questions
router.post('/questions/general', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const questionsPath = path.join(__dirname, '../data/questions/general.json');
        const updatedQuestions = req.body.questions;
        
        fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2));
        
        res.json({ success: true, message: 'General questions updated successfully' });
    } catch (error) {
        console.error('Error updating general questions:', error);
        res.status(500).json({ success: false, error: 'Failed to update questions' });
    }
});

// Update industry-specific questions
router.post('/questions/industry/:industry', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { industry } = req.params;
        
        const questionsPath = path.join(__dirname, `../data/questions/industries/${industry}.json`);
        const updatedQuestions = req.body.questions;
        
        fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2));
        
        res.json({ success: true, message: `${industry} questions updated successfully` });
    } catch (error) {
        console.error('Error updating industry questions:', error);
        res.status(500).json({ success: false, error: 'Failed to update questions' });
    }
});

// Add new question
router.post('/questions/add', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { type, industry, question, requiresDocument } = req.body;
        
        let questionsPath;
        let maxId = 0;
        
        if (type === 'general') {
            questionsPath = path.join(__dirname, '../data/questions/general.json');
            // Scan for highest GQ number in general.json
            if (fs.existsSync(questionsPath)) {
                const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
                questions.forEach(q => {
                    if (q.id && q.id.startsWith('GQ')) {
                        const num = parseInt(q.id.replace('GQ', ''));
                        if (num > maxId) maxId = num;
                    }
                });
            }
        } else {
            questionsPath = path.join(__dirname, `../data/questions/industries/${industry}.json`);
            // Scan for highest IQ number in industry file
            if (fs.existsSync(questionsPath)) {
                const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
                questions.forEach(q => {
                    if (q.id && q.id.startsWith('IQ')) {
                        const num = parseInt(q.id.replace('IQ', ''));
                        if (num > maxId) maxId = num;
                    }
                });
            }
        }
        
        // Generate new ID
        const newId = type === 'general' ? `GQ${maxId + 1}` : `IQ${maxId + 1}`;
        
        // Add new question
        let questions = [];
        if (fs.existsSync(questionsPath)) {
            questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        }
        
        // Determine question type based on requiresDocument
        let qType = question.type;
        if (requiresDocument === 'true' || requiresDocument === true) {
            qType = 'file-upload';
        }
        
        const newQuestion = {
            id: newId,
            question: question.question,
            type: qType,
            options: question.options || [],
            category: question.category,
            requiresDocument: (requiresDocument === 'true' || requiresDocument === true),
            allowMultiple: question.allowMultiple || false
        };
        
        questions.push(newQuestion);
        fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
        
        console.log(`✅ Added new ${type} question:`, newQuestion);
        
        res.json({ success: true, message: 'Question added successfully', question: newQuestion });
    } catch (error) {
        console.error('Error adding question:', error);
        res.status(500).json({ success: false, error: 'Failed to add question' });
    }
});

// Delete question - general
router.delete('/questions/general/:id', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { id } = req.params;
        
        const questionsPath = path.join(__dirname, '../data/questions/general.json');
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        const updatedQuestions = questions.filter(q => q.id !== id);
        
        fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2));
        
        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ success: false, error: 'Failed to delete question' });
    }
});

// Delete question - industry specific
router.delete('/questions/industry/:industry/:id', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { industry, id } = req.params;
        
        const questionsPath = path.join(__dirname, `../data/questions/industries/${industry}.json`);
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        const updatedQuestions = questions.filter(q => q.id !== id);
        
        fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2));
        
        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ success: false, error: 'Failed to delete question' });
    }
});

// Update question - general
router.put('/questions/general/:id', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { id } = req.params;
        const { question, category, type, options } = req.body;
        
        const questionsPath = path.join(__dirname, '../data/questions/general.json');
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        
        const questionIndex = questions.findIndex(q => q.id === id);
        if (questionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        
        // Update the question
        questions[questionIndex] = {
            id,
            question,
            type,
            options: options || [],
            category
        };
        
        fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
        
        res.json({ success: true, message: 'Question updated successfully' });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ success: false, error: 'Failed to update question' });
    }
});

// Update question - industry specific
router.put('/questions/industry/:industry/:id', requireAdminAuth, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const { industry, id } = req.params;
        const { question, category, type, options } = req.body;
        
        const questionsPath = path.join(__dirname, `../data/questions/industries/${industry}.json`);
        const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        
        const questionIndex = questions.findIndex(q => q.id === id);
        if (questionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        
        // Update the question
        questions[questionIndex] = {
            id,
            question,
            type,
            options: options || [],
            category
        };
        
        fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
        
        res.json({ success: true, message: 'Question updated successfully' });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ success: false, error: 'Failed to update question' });
    }
});

// View detailed company report
router.get('/company/:companyId/report', requireAdminAuth, async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findOne({ companyId });
        if (!company) {
            return res.status(404).send('Company not found');
        }
        
        const report = await Report.findOne({ companyId: company._id }).sort({ generatedDate: -1 });
        const assessment = await Assessment.findOne({ companyId: company._id }).sort({ createdDate: -1 });
        
        res.render('admin/company-report', {
            title: `Report - ${company.companyName}`,
            company,
            report,
            assessment
        });
    } catch (error) {
        console.error('Error fetching company report:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
