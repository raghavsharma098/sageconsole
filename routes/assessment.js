const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const Assessment = require('../models/Assessment');
const Company = require('../models/Company');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.session.companyId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and documents are allowed'));
        }
    }
});

// Function to load questions from JSON files
const loadQuestions = (industry) => {
    try {
        // Load general questions
        const generalQuestionsPath = path.join(__dirname, '../data/questions/general.json');
        let generalQuestions = [];
        if (fs.existsSync(generalQuestionsPath)) {
            generalQuestions = JSON.parse(fs.readFileSync(generalQuestionsPath, 'utf8'));
        }
        
        // Load industry-specific questions
        let industryQuestions = [];
        if (industry) {
            const industryPath = path.join(__dirname, `../data/questions/industries/${industry}.json`);
            if (fs.existsSync(industryPath)) {
                industryQuestions = JSON.parse(fs.readFileSync(industryPath, 'utf8'));
            }
        }
        
        // If no industry questions found, use default
        if (industryQuestions.length === 0) {
            const defaultPath = path.join(__dirname, '../data/questions/industries/other.json');
            if (fs.existsSync(defaultPath)) {
                industryQuestions = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
            }
        }
        
        return {
            general: generalQuestions,
            industry: industryQuestions
        };
    } catch (error) {
        console.error('Error loading questions:', error);
        // Fallback to empty questions
        return {
            general: [],
            industry: []
        };
    }
};

// Start or continue assessment
router.get('/', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.session.companyId });
        let assessment = await Assessment.findOne({ 
            companyId: req.session.companyId,
            status: { $in: ['in-progress', 'completed'] }
        });

        if (!assessment) {
            assessment = new Assessment({
                companyId: req.session.companyId
            });
            await assessment.save();
        }

        const questions = loadQuestions(company.industry);
        
        console.log(`📋 Loading questions for company: ${company.companyName} (${company.industry})`);
        console.log(`📊 General questions loaded: ${questions.general.length}`);
        console.log(`🏭 Industry questions loaded: ${questions.industry.length}`);

        res.render('assessment/questionnaire', {
            title: 'Assessment Questionnaire',
            company,
            assessment,
            questions,
            companyId: req.session.companyId,
            companyName: req.session.companyName
        });
    } catch (error) {
        console.error('Assessment error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while loading the assessment'
        });
    }
});

// Save assessment answers
router.post('/save', authMiddleware, upload.any(), async (req, res) => {
    try {
        const assessment = await Assessment.findOne({
            companyId: req.session.companyId,
            status: { $in: ['in-progress', 'completed'] }
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Save general answers
        const generalAnswers = {};
        const nicheAnswers = {};

        Object.keys(req.body).forEach(key => {
            if (key.startsWith('general_')) {
                generalAnswers[key.replace('general_', '')] = req.body[key];
            } else if (key.startsWith('niche_')) {
                nicheAnswers[key.replace('niche_', '')] = req.body[key];
            }
        });

        assessment.generalAnswers = generalAnswers;
        assessment.nicheSpecificAnswers = nicheAnswers;

        // Handle file uploads
        if (req.files && req.files.length > 0) {
            if (!assessment.uploadedDocuments) {
                assessment.uploadedDocuments = {};
            }
            
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                
                // Extract question ID from field name (general_GQ1, niche_IQ1, etc.)
                let questionId = fieldName;
                if (fieldName.startsWith('general_')) {
                    questionId = fieldName.replace('general_', '');
                } else if (fieldName.startsWith('niche_')) {
                    questionId = fieldName.replace('niche_', '');
                }
                
                assessment.uploadedDocuments[questionId] = {
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: new Date()
                };
                
                // Also store in legacy field if it's the document field
                if (fieldName === 'document') {
                    assessment.uploadedDocument = {
                        filename: file.filename,
                        originalName: file.originalname,
                        path: file.path,
                        mimetype: file.mimetype,
                        size: file.size
                    };
                }
            });
        }

        // Check if this is a submission (final submit)
        const isSubmission = req.body.submit === 'true';
        
        if (isSubmission) {
            assessment.status = 'submitted';
            assessment.submissionDate = new Date();
        } else {
            assessment.status = 'completed';
        }

        await assessment.save();

        // Handle response based on submission type
        if (isSubmission) {
            // For submission, redirect to report generation
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                // AJAX request
                res.json({ success: true, redirect: '/reports/generate' });
            } else {
                // Regular form submission
                res.redirect('/reports/generate');
            }
        } else {
            // For save progress, return JSON response
            res.json({ success: true, message: 'Assessment saved successfully' });
        }
    } catch (error) {
        console.error('Save assessment error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({ error: 'An error occurred while saving the assessment' });
        } else {
            res.status(500).render('error', {
                title: 'Error',
                message: 'An error occurred while saving the assessment'
            });
        }
    }
});

// Submit assessment for report generation
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const assessment = await Assessment.findOne({
            companyId: req.session.companyId,
            status: 'completed'
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Completed assessment not found' });
        }

        assessment.status = 'submitted';
        await assessment.save();

        // Redirect to report generation
        res.redirect('/reports/generate');
    } catch (error) {
        console.error('Submit assessment error:', error);
        res.status(500).json({ error: 'An error occurred while submitting the assessment' });
    }
});

module.exports = router;
