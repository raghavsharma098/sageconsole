const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Company = require('../models/Company');
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');

// Dashboard page
router.get('/', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.session.companyId });
        const latestAssessment = await Assessment.findOne({ companyId: req.session.companyId })
            .sort({ createdAt: -1 });
        
        // Find report that matches the latest assessment
        let latestReport = null;
        if (latestAssessment) {
            latestReport = await Report.findOne({ 
                companyId: req.session.companyId,
                assessmentId: latestAssessment.assessmentId 
            });
            
            // If no report found for latest assessment, get the most recent report
            if (!latestReport) {
                latestReport = await Report.findOne({ companyId: req.session.companyId })
                    .sort({ createdAt: -1 });
            }
        }

        res.render('dashboard/index', {
            title: 'Company Dashboard',
            company,
            assessment: latestAssessment,
            report: latestReport,
            companyId: req.session.companyId,
            companyName: req.session.companyName
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'An error occurred while loading the dashboard'
        });
    }
});

module.exports = router;
