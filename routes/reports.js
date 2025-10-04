const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');
const Company = require('../models/Company');
const aiService = require('../utils/aiService');
const PDFDocument = require('pdfkit');
const path = require('path');

// Default reports page - show latest report
router.get('/', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.session.companyId });
        const latestAssessment = await Assessment.findOne({ 
            companyId: req.session.companyId,
            status: 'submitted' 
        }).sort({ createdAt: -1 });
        
        if (!latestAssessment) {
            return res.redirect('/assessment');
        }

        // Find report that matches the latest assessment
        let report = await Report.findOne({ 
            companyId: req.session.companyId,
            assessmentId: latestAssessment.assessmentId 
        });

        if (!report) {
            // If no report found, redirect to generate
            return res.redirect('/reports/generate');
        }

        res.render('reports/view', {
            title: 'Assessment Report',
            company,
            assessment: latestAssessment,
            report,
            companyId: req.session.companyId,
            companyName: req.session.companyName,
            analytics: generateAnalyticsData(latestAssessment)
        });
    } catch (error) {
        console.error('Reports page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while loading the reports'
        });
    }
});

// Regenerate report (force new generation)
router.get('/regenerate', authMiddleware, async (req, res) => {
    try {
        const assessment = await Assessment.findOne({
            companyId: req.session.companyId,
            status: 'submitted'
        });

        if (!assessment) {
            return res.redirect('/assessment');
        }

        const company = await Company.findOne({ companyId: req.session.companyId });

        // Delete existing report first
        await Report.deleteMany({
            companyId: req.session.companyId
        });

        console.log('🔄 Regenerating report with updated scoring...');

        // Generate new report with updated scoring
        const reportData = await generateReportData(assessment, company);
        const aiSuggestions = await aiService.generateSuggestions(assessment, company);

        const report = new Report({
            companyId: req.session.companyId,
            assessmentId: assessment.assessmentId,
            reportData,
            aiSuggestions: aiSuggestions.suggestions,
            aiSource: aiSuggestions.source,
            aiModel: aiSuggestions.model,
            aiTimestamp: aiSuggestions.timestamp
        });

        await report.save();

        console.log('✅ New report generated with compliance score:', reportData.complianceScore + '%');

        res.redirect('/reports');
    } catch (error) {
        console.error('Regenerate report error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while regenerating the report'
        });
    }
});

// Generate report
router.get('/generate', authMiddleware, async (req, res) => {
    try {
        console.log('🎯 GENERATE REPORT - Starting...');
        console.log('   Session Company ID:', req.session.companyId);
        
        const assessment = await Assessment.findOne({
            companyId: req.session.companyId,
            status: 'submitted'
        });

        console.log('   Found assessment:', !!assessment);
        if (assessment) {
            console.log('   Assessment ID:', assessment.assessmentId);
            console.log('   Assessment created:', assessment.createdAt);
        }

        if (!assessment) {
            console.log('   No submitted assessment found, redirecting to /assessment');
            return res.redirect('/assessment');
        }

        const company = await Company.findOne({ companyId: req.session.companyId });

        // Check if report already exists
        let report = await Report.findOne({
            companyId: req.session.companyId,
            assessmentId: assessment.assessmentId
        });

        console.log('   Existing report found:', !!report);
        if (report) {
            console.log('   Existing report score:', report.reportData.complianceScore + '%');
        }

        if (!report) {
            console.log('   🔄 Generating new report...');
            // Generate new report
            const reportData = await generateReportData(assessment, company);
            const aiSuggestions = await aiService.generateSuggestions(assessment, company);

            // Log the source of suggestions for verification
            console.log('📊 Report generation summary:');
            console.log('- Company:', company.companyName);
            console.log('- Industry:', company.industry);
            console.log('- Suggestions source:', aiSuggestions.source);
            if (aiSuggestions.model) {
                console.log('- AI Model used:', aiSuggestions.model);
            }
            if (aiSuggestions.error) {
                console.log('- AI Error:', aiSuggestions.error);
            }
            console.log('- Generated at:', aiSuggestions.timestamp);

            report = new Report({
                companyId: req.session.companyId,
                assessmentId: assessment.assessmentId,
                reportData,
                aiSuggestions
            });

            await report.save();
            console.log('   ✅ New report saved with score:', reportData.complianceScore + '%');
        }

        res.render('reports/view', {
            title: 'Assessment Report',
            company,
            assessment,
            report,
            companyId: req.session.companyId,
            companyName: req.session.companyName,
            analytics: generateAnalyticsData(assessment)
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while generating the report'
        });
    }
});

// Download report as PDF
router.get('/download/:reportId', authMiddleware, async (req, res) => {
    try {
        const report = await Report.findOne({
            reportId: req.params.reportId,
            companyId: req.session.companyId
        });

        if (!report) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Report not found'
            });
        }

        const company = await Company.findOne({ companyId: req.session.companyId });
        const assessment = await Assessment.findOne({ assessmentId: report.assessmentId });

        // Update download count
        report.downloadCount += 1;
        report.isDownloaded = true;
        await report.save();

        // Generate PDF
        const pdfBuffer = await generatePDF(report, company, assessment);

        // Set headers for PDF download
        const filename = `sustainability-report-${company.companyName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send the PDF
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while generating the PDF report'
        });
    }
});

// Generate PDF report (view in browser)
router.get('/pdf/:reportId', authMiddleware, async (req, res) => {
    try {
        const report = await Report.findOne({
            reportId: req.params.reportId,
            companyId: req.session.companyId
        });

        if (!report) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Report not found'
            });
        }

        const company = await Company.findOne({ companyId: req.session.companyId });
        const assessment = await Assessment.findOne({ assessmentId: report.assessmentId });

        // Generate PDF
        const pdfBuffer = await generatePDF(report, company, assessment);

        // Set headers to view PDF in browser
        const filename = `sustainability-report-${company.companyName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        // Send the PDF
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while generating the PDF report'
        });
    }
});

// Function to generate downloadable report content
function generateDownloadableReport(report, company, assessment) {
    const date = new Date().toLocaleDateString();
    const reportDate = new Date(report.createdAt).toLocaleDateString();
    
    return `
SUSTAINABILITY ASSESSMENT REPORT
===============================

Company Information:
-------------------
Company Name: ${company.companyName}
Industry: ${company.industry}
Email: ${company.email}
Report ID: ${report.reportId}
Generated Date: ${reportDate}
Downloaded Date: ${date}

Executive Summary:
-----------------
${report.reportData.summary}

Overall Compliance Score: ${report.reportData.complianceScore}%

Strengths Identified:
--------------------
${report.reportData.strengths.map(strength => `• ${strength}`).join('\n')}

Areas for Improvement:
---------------------
${report.reportData.weakAreas.map(area => `• ${area}`).join('\n')}

AI-Powered Recommendations:
--------------------------
${Array.isArray(report.aiSuggestions) ? 
    report.aiSuggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n') :
    report.aiSuggestions || 'No AI suggestions available'
}

Assessment Details:
------------------
Assessment Status: ${assessment ? assessment.status : 'N/A'}
Assessment Date: ${assessment ? new Date(assessment.createdAt).toLocaleDateString() : 'N/A'}

Report Statistics:
-----------------
Download Count: ${report.downloadCount}
Report Version: 1.0

---
This report was generated by the Sustainability Assessment Platform.
For questions or support, please contact your system administrator.
`;
}

// View specific report
router.get('/view/:reportId', authMiddleware, async (req, res) => {
    try {
        const report = await Report.findOne({
            reportId: req.params.reportId,
            companyId: req.session.companyId
        });

        if (!report) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Report not found'
            });
        }

        const company = await Company.findOne({ companyId: req.session.companyId });
        const assessment = await Assessment.findOne({ assessmentId: report.assessmentId });

        res.render('reports/view', {
            title: 'Assessment Report',
            company,
            assessment,
            report,
            companyId: req.session.companyId,
            companyName: req.session.companyName,
            analytics: generateAnalyticsData(assessment)
        });
    } catch (error) {
        console.error('View report error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred while viewing the report'
        });
    }
});

// Generate report data based on assessment
async function generateReportData(assessment, company) {
    const generalAnswers = Object.fromEntries(assessment.generalAnswers);
    const nicheAnswers = Object.fromEntries(assessment.nicheSpecificAnswers);

    // Calculate basic compliance score
    let score = 0;
    let totalQuestions = 0;

    // Helper function to score an answer
    const scoreAnswer = (answer, isNiche = false) => {
        if (Array.isArray(answer)) {
            // Handle array answers (checkboxes)
            if (answer.length > 0 && !answer.includes('None')) {
                // Award points based on how many positive options selected
                if (answer.length >= 3) return 2;
                else if (answer.length >= 1) return 1;
            }
            return 0;
        } else if (typeof answer === 'string') {
            const lowerAnswer = answer.toLowerCase();
            
            // High score answers (2 points)
            if (lowerAnswer.includes('yes') || 
                lowerAnswer.includes('comprehensive') ||
                lowerAnswer.includes('high') ||
                lowerAnswer.includes('fully') ||
                lowerAnswer.includes('reduction') ||
                lowerAnswer.includes('renewable') ||
                lowerAnswer.includes('recycling') ||
                lowerAnswer.includes('energy-efficient') ||
                (isNiche && (lowerAnswer.includes('61-80') || lowerAnswer.includes('81-100')))) {
                return 2;
            }
            
            // Medium score answers (1 point)
            if (lowerAnswer.includes('partial') || 
                lowerAnswer.includes('moderate') ||
                lowerAnswer.includes('planning') ||
                lowerAnswer.includes('development') ||
                lowerAnswer.includes('in development') ||
                (isNiche && (lowerAnswer.includes('41-60') || lowerAnswer.includes('21-40')))) {
                return 1;
            }
        }
        return 0;
    };

    // Score general questions
    Object.entries(generalAnswers).forEach(([key, answer]) => {
        totalQuestions++;
        score += scoreAnswer(answer, false);
    });

    // Score niche-specific questions
    Object.entries(nicheAnswers).forEach(([key, answer]) => {
        totalQuestions++;
        score += scoreAnswer(answer, true);
    });

    const complianceScore = Math.round((score / (totalQuestions * 2)) * 100);
    
    console.log('🧮 SCORING DEBUG:');
    console.log('   Total Score:', score);
    console.log('   Total Questions:', totalQuestions);
    console.log('   Max Possible:', totalQuestions * 2);
    console.log('   Compliance Score:', complianceScore + '%');

    // Identify strengths and weak areas
    const strengths = [];
    const weakAreas = [];

    if (generalAnswers.sustainability_policy === 'Yes') {
        strengths.push('Formal sustainability policy in place');
    } else {
        weakAreas.push('Lack of formal sustainability policy');
    }

    if (generalAnswers.waste_management && generalAnswers.waste_management.includes('Recycling')) {
        strengths.push('Active waste management and recycling program');
    }

    if (complianceScore < 50) {
        weakAreas.push('Overall compliance score needs improvement');
    }

    // Generate AI-powered comprehensive summary with fallback
    let aiSummary;
    try {
        console.log('🤖 Generating AI summary for:', company.companyName);
        aiSummary = await aiService.generateSummary(assessment, company, complianceScore);
        console.log('📝 Generated summary length:', aiSummary.length, 'characters');
        console.log('📄 Summary preview:', aiSummary.substring(0, 100) + '...');
    } catch (error) {
        console.error('❌ Error generating AI summary:', error);
        console.log('🔄 Using fallback summary');
        aiSummary = `Assessment completed for ${company.companyName} in the ${company.industry} industry, achieving a compliance score of ${complianceScore}%. The evaluation reveals key insights into the organization's environmental, social, and governance practices through comprehensive analysis of sustainability metrics. Industry-specific considerations for ${company.industry} operations have been thoroughly examined, highlighting both current strengths and areas requiring strategic attention. The assessment identifies critical pathways for improvement while recognizing existing sustainability initiatives that demonstrate organizational commitment. Risk factors and compliance gaps have been evaluated against industry standards and best practices. Strategic recommendations focus on actionable steps to enhance sustainability performance and achieve long-term environmental and social responsibility goals.`;
    }

    return {
        summary: aiSummary,
        complianceScore,
        industryObservations: `As a ${company.industry} company, specific attention should be paid to industry-standard sustainability practices and regulatory compliance.`,
        weakAreas,
        strengths,
        recommendations: [
            'Implement regular sustainability audits',
            'Develop measurable sustainability goals',
            'Consider industry-specific certifications',
            'Engage employees in sustainability initiatives'
        ]
    };
}

// Debug endpoint to test AI service
router.get('/debug-ai', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.session.companyId });
        const assessment = await Assessment.findOne({ companyId: req.session.companyId }).sort({ createdAt: -1 });
        
        if (!assessment) {
            return res.json({ error: 'No assessment found' });
        }

        // Test the new AI summary generation
        const reportData = await generateReportData(assessment, company);
        
        res.json({
            message: 'AI Summary Test',
            company: company.companyName,
            industry: company.industry,
            complianceScore: reportData.complianceScore,
            oldSummary: `Assessment completed for ${company.companyName} in the ${company.industry} industry. The company scored ${reportData.complianceScore}% on sustainability and compliance measures.`,
            newAISummary: reportData.summary,
            summaryLength: reportData.summary.length
        });
    } catch (error) {
        console.error('Debug AI error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to test AI service (original)
router.get('/debug-ai-original', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.session.companyId });
        
        // Create a mock assessment for testing
        const mockAssessment = {
            generalAnswers: new Map([
                ['company_size', '51-200 employees'],
                ['sustainability_policy', 'Yes'],
                ['waste_management', 'Recycling program']
            ]),
            nicheSpecificAnswers: new Map([
                ['test_question', 'Sample answer for testing']
            ])
        };

        const aiSuggestions = await aiService.generateSuggestions(mockAssessment, company);
        
        res.json({
            success: true,
            company: company.companyName,
            industry: company.industry,
            suggestions: aiSuggestions,
            debug: {
                source: aiSuggestions.source,
                model: aiSuggestions.model,
                timestamp: aiSuggestions.timestamp,
                error: aiSuggestions.error,
                rawResponsePreview: aiSuggestions.rawResponse
            }
        });
    } catch (error) {
        console.error('Debug AI error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Generate analytics data for pie charts
function generateAnalyticsData(assessment) {
    const generalAnswers = Object.fromEntries(assessment.generalAnswers || []);
    const nicheAnswers = Object.fromEntries(assessment.nicheSpecificAnswers || []);
    
    const totalGeneral = Object.keys(generalAnswers).length;
    const totalNiche = Object.keys(nicheAnswers).length;
    const totalQuestions = totalGeneral + totalNiche;
    
    // Analyze response quality
    let highQuality = 0;
    let mediumQuality = 0;
    let basicResponse = 0;
    
    const scoreAnswer = (answer, isNiche = false) => {
        if (Array.isArray(answer)) {
            if (answer.length > 0 && !answer.includes('None')) {
                if (answer.length >= 3) return 2;
                else if (answer.length >= 1) return 1;
            }
            return 0;
        } else if (typeof answer === 'string') {
            const lowerAnswer = answer.toLowerCase();
            
            // High score indicators
            if (lowerAnswer.includes('yes') || 
                lowerAnswer.includes('comprehensive') ||
                lowerAnswer.includes('high') ||
                lowerAnswer.includes('fully') ||
                lowerAnswer.includes('reduction') ||
                lowerAnswer.includes('renewable') ||
                lowerAnswer.includes('recycling') ||
                lowerAnswer.includes('energy-efficient') ||
                (isNiche && (lowerAnswer.includes('61-80') || lowerAnswer.includes('81-100')))) {
                return 2;
            }
            
            // Medium score indicators  
            if (lowerAnswer.includes('partial') || 
                lowerAnswer.includes('moderate') ||
                lowerAnswer.includes('planning') ||
                lowerAnswer.includes('development') ||
                lowerAnswer.includes('in development') ||
                (isNiche && (lowerAnswer.includes('41-60') || lowerAnswer.includes('21-40')))) {
                return 1;
            }
        }
        return 0;
    };
    
    // Analyze all answers
    Object.entries(generalAnswers).forEach(([key, answer]) => {
        const score = scoreAnswer(answer, false);
        if (score === 2) highQuality++;
        else if (score === 1) mediumQuality++;
        else basicResponse++;
    });
    
    Object.entries(nicheAnswers).forEach(([key, answer]) => {
        const score = scoreAnswer(answer, true);
        if (score === 2) highQuality++;
        else if (score === 1) mediumQuality++;
        else basicResponse++;
    });
    
    return {
        totalQuestions,
        totalGeneral,
        totalNiche,
        qualityBreakdown: {
            highQuality,
            mediumQuality,
            basicResponse
        },
        categories: [
            { name: 'General Sustainability', count: totalGeneral },
            { name: 'Industry-Specific', count: totalNiche }
        ]
    };
}

// Function to draw a pie chart
function drawPieChart(doc, centerX, centerY, radius, data) {
    const total = data.highQuality + data.mediumQuality + data.basicResponse;
    if (total === 0) return;
    
    const colors = ['#059669', '#10b981', '#34d399'];
    const values = [data.highQuality, data.mediumQuality, data.basicResponse];
    
    let currentAngle = -Math.PI / 2; // Start at top (12 o'clock)
    
    values.forEach((value, index) => {
        if (value > 0) {
            const sliceAngle = (value / total) * 2 * Math.PI;
            const endAngle = currentAngle + sliceAngle;
            
            // Draw the slice
            doc.save();
            doc.fillColor(colors[index]);
            
            // Create the path for the slice
            doc.path(`M ${centerX} ${centerY}`)
               .arc(centerX, centerY, radius, currentAngle, endAngle, false)
               .lineTo(centerX, centerY)
               .fill();
            
            doc.restore();
            currentAngle = endAngle;
        }
    });
    
    // Draw a white circle in the center for a donut effect (optional)
    doc.circle(centerX, centerY, radius * 0.3)
       .fillColor('#ffffff')
       .fill();
    
    // Add percentage labels
    currentAngle = -Math.PI / 2;
    values.forEach((value, index) => {
        if (value > 0 && total > 0) {
            const sliceAngle = (value / total) * 2 * Math.PI;
            const percentage = Math.round((value / total) * 100);
            if (percentage > 8) { // Only show label if slice is big enough (increased from 5 to 8)
                const midAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(midAngle) * (radius * 0.75);
                const labelY = centerY + Math.sin(midAngle) * (radius * 0.75);
                
                doc.fillColor('#ffffff')
                   .fontSize(9)
                   .font('Helvetica-Bold')
                   .text(`${percentage}%`, labelX - 8, labelY - 4);
            }
            currentAngle += sliceAngle;
        }
    });
}

// Function to draw a compliance score pie chart
function drawCompliancePieChart(doc, centerX, centerY, radius, achieved, remaining) {
    const total = achieved + remaining;
    if (total === 0) return;
    
    const achievedAngle = (achieved / total) * 2 * Math.PI;
    const remainingAngle = (remaining / total) * 2 * Math.PI;
    
    const scoreColor = achieved >= 80 ? '#059669' : achieved >= 60 ? '#ffc107' : '#dc3545';
    const remainingColor = '#e9ecef';
    
    let currentAngle = -Math.PI / 2; // Start at top
    
    // Draw achieved portion
    if (achieved > 0) {
        doc.save();
        doc.fillColor(scoreColor);
        doc.path(`M ${centerX} ${centerY}`)
           .arc(centerX, centerY, radius, currentAngle, currentAngle + achievedAngle, false)
           .lineTo(centerX, centerY)
           .fill();
        doc.restore();
        currentAngle += achievedAngle;
    }
    
    // Draw remaining portion
    if (remaining > 0) {
        doc.save();
        doc.fillColor(remainingColor);
        doc.path(`M ${centerX} ${centerY}`)
           .arc(centerX, centerY, radius, currentAngle, currentAngle + remainingAngle, false)
           .lineTo(centerX, centerY)
           .fill();
        doc.restore();
    }
    
    // Add percentage in center
    doc.fillColor('#333333')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text(`${achieved}%`, centerX - 12, centerY - 6);
}

// Function to draw a categories pie chart
function drawCategoriesPieChart(doc, centerX, centerY, radius, general, industrySpecific) {
    const total = general + industrySpecific;
    if (total === 0) return;
    
    const colors = ['#059669', '#10b981'];
    const values = [general, industrySpecific];
    const labels = ['General', 'Industry'];
    
    let currentAngle = -Math.PI / 2; // Start at top
    
    values.forEach((value, index) => {
        if (value > 0) {
            const sliceAngle = (value / total) * 2 * Math.PI;
            const endAngle = currentAngle + sliceAngle;
            
            // Draw the slice
            doc.save();
            doc.fillColor(colors[index]);
            doc.path(`M ${centerX} ${centerY}`)
               .arc(centerX, centerY, radius, currentAngle, endAngle, false)
               .lineTo(centerX, centerY)
               .fill();
            doc.restore();
            
            // Add percentage label if slice is big enough
            const percentage = Math.round((value / total) * 100);
            if (percentage > 15) { // Only show for larger slices
                const midAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(midAngle) * (radius * 0.75);
                const labelY = centerY + Math.sin(midAngle) * (radius * 0.75);
                
                doc.fillColor('#ffffff')
                   .fontSize(9)
                   .font('Helvetica-Bold')
                   .text(`${percentage}%`, labelX - 8, labelY - 4);
            }
            
            currentAngle = endAngle;
        }
    });
}

// Generate PDF using PDFKit
async function generatePDF(report, company, assessment) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            // Colors
            const primaryColor = '#059669';
            const secondaryColor = '#065f46';
            const accentColor = '#10b981';
            const textColor = '#333333';
            const lightGray = '#f8f9fa';
            
            // Header
            doc.rect(0, 0, doc.page.width, 140).fill(primaryColor);
            doc.fillColor('white')
               .fontSize(24)
               .font('Helvetica-Bold')
               .text('SUSTAINABILITY ASSESSMENT REPORT', 50, 35, { 
                   align: 'center',
                   width: doc.page.width - 100
               });
            
            doc.fontSize(12)
               .font('Helvetica')
               .text('Comprehensive Environmental, Social & Governance Analysis', 50, 80, { 
                   align: 'center',
                   width: doc.page.width - 100
               });
            
            // Company Information Section
            let currentY = 170;
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Company Information', 50, currentY);
            
            currentY += 30;
            const companyInfo = [
                ['Company Name:', company.companyName],
                ['Industry:', company.industry],
                ['Email:', company.email],
                ['Report ID:', report.reportId],
                ['Generated:', new Date(report.createdAt).toLocaleDateString()],
                ['Downloaded:', new Date().toLocaleDateString()]
            ];
            
            companyInfo.forEach(([label, value]) => {
                doc.fillColor(textColor)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text(label, 50, currentY);
                doc.font('Helvetica')
                   .text(value, 150, currentY);
                currentY += 18;
            });
            
            // Compliance Score with Visual
            currentY += 20;
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Overall Compliance Score', 50, currentY);
            
            currentY += 30;
            const score = report.reportData.complianceScore;
            const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#ffc107' : '#dc3545';
            
            // Score circle
            doc.circle(150, currentY + 25, 25)
               .stroke(scoreColor)
               .lineWidth(3);
            
            doc.fillColor(scoreColor)
               .fontSize(20)
               .font('Helvetica-Bold')
               .text(`${score}%`, 135, currentY + 18);
            
            // Score interpretation
            let interpretation = '';
            if (score >= 80) interpretation = 'Excellent - Strong sustainability practices';
            else if (score >= 60) interpretation = 'Good - Room for improvement';
            else if (score >= 40) interpretation = 'Fair - Significant improvements needed';
            else interpretation = 'Poor - Immediate attention required';
            
            doc.fillColor(textColor)
               .fontSize(12)
               .font('Helvetica')
               .text(interpretation, 200, currentY + 20);
            
            // Add compliance score pie chart - move it down to avoid overlap
            currentY += 80;
            doc.fillColor(secondaryColor)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('Score Breakdown', 50, currentY);
            
            currentY += 25;
            // Draw compliance pie chart on left side
            const achievedScore = score;
            const remainingScore = 100 - score;
            drawCompliancePieChart(doc, 120, currentY + 30, 35, achievedScore, remainingScore);
            
            // Legend for compliance chart positioned on right side
            const legendStartY = currentY + 10;
            doc.rect(250, legendStartY, 10, 10)
               .fillAndStroke(scoreColor, scoreColor);
            doc.fillColor(textColor)
               .fontSize(9)
               .font('Helvetica')
               .text(`Achieved: ${achievedScore}%`, 265, legendStartY + 2);
            
            doc.rect(250, legendStartY + 20, 10, 10)
               .fillAndStroke('#e9ecef', '#e9ecef');
            doc.text(`Remaining: ${remainingScore}%`, 265, legendStartY + 22);
            
            // Analytics Summary
            currentY += 100;
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            
            const analytics = generateAnalyticsData(assessment);
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Assessment Analytics', 50, currentY);
            
            currentY += 30;
            const analyticsData = [
                ['Total Questions Answered:', analytics.totalQuestions],
                ['General Sustainability Questions:', analytics.totalGeneral],
                ['Industry-Specific Questions:', analytics.totalNiche],
                ['High-Quality Responses:', analytics.qualityBreakdown.highQuality],
                ['Medium-Quality Responses:', analytics.qualityBreakdown.mediumQuality],
                ['Basic Responses:', analytics.qualityBreakdown.basicResponse]
            ];
            
            analyticsData.forEach(([label, value]) => {
                doc.fillColor(textColor)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text(label, 50, currentY);
                doc.font('Helvetica')
                   .text(value.toString(), 250, currentY);
                currentY += 18;
            });
            
            // Add Pie Chart for Response Quality Distribution
            currentY += 40;
            if (currentY > 400) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(16)
               .font('Helvetica-Bold')
               .text('Response Quality Distribution', 50, currentY);
            
            currentY += 30;
            // Draw pie chart on left side
            drawPieChart(doc, 120, currentY + 60, 50, analytics.qualityBreakdown);
            
            // Legend for pie chart on right side
            const legendItems = [
                { label: 'High Quality', color: '#059669', value: analytics.qualityBreakdown.highQuality },
                { label: 'Medium Quality', color: '#10b981', value: analytics.qualityBreakdown.mediumQuality },
                { label: 'Basic Response', color: '#34d399', value: analytics.qualityBreakdown.basicResponse }
            ];
            
            let legendY = currentY + 30;
            legendItems.forEach(item => {
                // Color box
                doc.rect(250, legendY, 12, 12)
                   .fillAndStroke(item.color, item.color);
                
                // Label and value
                doc.fillColor(textColor)
                   .fontSize(10)
                   .font('Helvetica')
                   .text(`${item.label}: ${item.value}`, 270, legendY + 2);
                
                legendY += 18;
            });
            
            // Add adequate spacing before next chart
            currentY += 150;
            
            // Add Question Categories Pie Chart
            if (analytics.totalGeneral + analytics.totalNiche > 0) {
                if (currentY > 600) {
                    doc.addPage();
                    currentY = 50;
                }
                
                doc.fillColor(secondaryColor)
                   .fontSize(16)
                   .font('Helvetica-Bold')
                   .text('Question Categories Distribution', 50, currentY);
                
                currentY += 30;
                // Draw categories pie chart on left side
                drawCategoriesPieChart(doc, 120, currentY + 60, 50, analytics.totalGeneral, analytics.totalNiche);
                
                // Legend for categories chart on right side
                const categoryLegendY = currentY + 30;
                doc.rect(250, categoryLegendY, 12, 12)
                   .fillAndStroke('#059669', '#059669');
                doc.fillColor(textColor)
                   .fontSize(10)
                   .font('Helvetica')
                   .text(`General: ${analytics.totalGeneral}`, 270, categoryLegendY + 2);
                
                doc.rect(250, categoryLegendY + 18, 12, 12)
                   .fillAndStroke('#10b981', '#10b981');
                doc.text(`Industry-Specific: ${analytics.totalNiche}`, 270, categoryLegendY + 20);
                
                currentY += 130;
            } else {
                currentY += 40; // Much less spacing if no categories chart
            }
            
            // Executive Summary
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Executive Summary', 50, currentY);
            
            currentY += 25;
            doc.fillColor(textColor)
               .fontSize(11)
               .font('Helvetica')
               .text(report.reportData.summary, 50, currentY, { 
                   width: 500, 
                   align: 'justify'
               });
            
            currentY += Math.ceil(report.reportData.summary.length / 80) * 15 + 30;
            
            // Industry Observations
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Industry-Specific Observations', 50, currentY);
            
            currentY += 25;
            doc.fillColor(textColor)
               .fontSize(11)
               .font('Helvetica')
               .text(report.reportData.industryObservations, 50, currentY, { 
                   width: 500, 
                   align: 'justify'
               });
            
            currentY += Math.ceil(report.reportData.industryObservations.length / 80) * 15 + 30;
            
            // Strengths
            if (currentY > 600) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Identified Strengths', 50, currentY);
            
            currentY += 25;
            if (report.reportData.strengths && report.reportData.strengths.length > 0) {
                report.reportData.strengths.forEach(strength => {
                    doc.circle(60, currentY + 6, 3).fill('#059669');
                    doc.fillColor(textColor)
                       .fontSize(11)
                       .font('Helvetica')
                       .text(strength, 75, currentY, { width: 470 });
                    currentY += 20;
                });
            } else {
                doc.fillColor('#666666')
                   .fontSize(11)
                   .font('Helvetica-Oblique')
                   .text('Continue your sustainability journey to build on your strengths.', 50, currentY);
                currentY += 20;
            }
            
            // Areas for Improvement
            currentY += 20;
            if (currentY > 600) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Areas for Improvement', 50, currentY);
            
            currentY += 25;
            if (report.reportData.weakAreas && report.reportData.weakAreas.length > 0) {
                report.reportData.weakAreas.forEach(weakness => {
                    doc.circle(60, currentY + 6, 3).fill('#ffc107');
                    doc.fillColor(textColor)
                       .fontSize(11)
                       .font('Helvetica')
                       .text(weakness, 75, currentY, { width: 470 });
                    currentY += 20;
                });
            } else {
                doc.fillColor('#666666')
                   .fontSize(11)
                   .font('Helvetica-Oblique')
                   .text('Great job! No major areas of concern identified.', 50, currentY);
                currentY += 20;
            }
            
            // AI Recommendations
            if (currentY > 600) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('AI-Powered Recommendations', 50, currentY);
            
            // Priority Level
            currentY += 25;
            const priorityLevel = report.aiSuggestions.priorityLevel || 'Medium';
            const priorityColor = priorityLevel === 'Critical' ? '#dc3545' : 
                                 priorityLevel === 'High' ? '#fd7e14' : 
                                 priorityLevel === 'Medium' ? '#ffc107' : '#28a745';
            
            doc.fillColor(textColor)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('Priority Level: ', 50, currentY);
            doc.fillColor(priorityColor)
               .text(priorityLevel, 140, currentY);
            
            currentY += 25;
            
            // Improvement Suggestions
            doc.fillColor(secondaryColor)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('Improvement Suggestions:', 50, currentY);
            
            currentY += 20;
            const improvements = report.aiSuggestions.improvements || [];
            if (improvements.length > 0) {
                improvements.forEach((improvement, index) => {
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                    }
                    doc.fillColor('#059669')
                       .fontSize(11)
                       .font('Helvetica-Bold')
                       .text(`${index + 1}.`, 50, currentY);
                    doc.fillColor(textColor)
                       .font('Helvetica')
                       .text(improvement, 70, currentY, { width: 470 });
                    currentY += Math.ceil(improvement.length / 70) * 15 + 10;
                });
            } else {
                doc.fillColor('#666666')
                   .fontSize(11)
                   .font('Helvetica-Oblique')
                   .text('No specific improvements identified at this time.', 50, currentY);
                currentY += 20;
            }
            
            // Best Practices
            currentY += 20;
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('Industry Best Practices:', 50, currentY);
            
            currentY += 20;
            const bestPractices = report.aiSuggestions.bestPractices || [];
            if (bestPractices.length > 0) {
                bestPractices.forEach((practice, index) => {
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                    }
                    doc.fillColor('#10b981')
                       .fontSize(11)
                       .font('Helvetica-Bold')
                       .text(`${index + 1}.`, 50, currentY);
                    doc.fillColor(textColor)
                       .font('Helvetica')
                       .text(practice, 70, currentY, { width: 470 });
                    currentY += Math.ceil(practice.length / 70) * 15 + 10;
                });
            }
            
            // Detailed Assessment Responses (New Addition)
            if (currentY > 600) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('Detailed Assessment Responses', 50, currentY);
            
            currentY += 30;
            
            // General Sustainability Questions
            doc.fillColor(secondaryColor)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('General Sustainability Questions:', 50, currentY);
            
            currentY += 20;
            const generalAnswers = Object.fromEntries(assessment.generalAnswers || []);
            Object.entries(generalAnswers).forEach(([question, answer], index) => {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                const questionText = question.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                doc.fillColor('#059669')
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text(`Q${index + 1}: ${questionText}`, 50, currentY);
                
                currentY += 15;
                const answerText = Array.isArray(answer) ? answer.join(', ') : answer.toString();
                doc.fillColor(textColor)
                   .fontSize(10)
                   .font('Helvetica')
                   .text(`Answer: ${answerText}`, 70, currentY, { width: 470 });
                
                currentY += Math.ceil(answerText.length / 80) * 12 + 15;
            });
            
            // Industry-Specific Questions
            currentY += 20;
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            
            doc.fillColor(secondaryColor)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('Industry-Specific Questions:', 50, currentY);
            
            currentY += 20;
            const nicheAnswers = Object.fromEntries(assessment.nicheSpecificAnswers || []);
            Object.entries(nicheAnswers).forEach(([question, answer], index) => {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                const questionText = question.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                doc.fillColor('#10b981')
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text(`IQ${index + 1}: ${questionText}`, 50, currentY);
                
                currentY += 15;
                const answerText = Array.isArray(answer) ? answer.join(', ') : answer.toString();
                doc.fillColor(textColor)
                   .fontSize(10)
                   .font('Helvetica')
                   .text(`Answer: ${answerText}`, 70, currentY, { width: 470 });
                
                currentY += Math.ceil(answerText.length / 80) * 12 + 15;
            });
            
            // Footer on all pages
            const pageRange = doc.bufferedPageRange();
            for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
                doc.switchToPage(i);
                
                // Footer line
                doc.strokeColor('#cccccc')
                   .lineWidth(1)
                   .moveTo(50, doc.page.height - 50)
                   .lineTo(doc.page.width - 50, doc.page.height - 50)
                   .stroke();
                
                // Footer text
                doc.fillColor('#666666')
                   .fontSize(9)
                   .font('Helvetica')
                   .text('Generated by SustainAssess Platform', 50, doc.page.height - 40);
                
                doc.text(`Page ${i - pageRange.start + 1} of ${pageRange.count}`, 0, doc.page.height - 40, { 
                    align: 'right',
                    width: doc.page.width - 100
                });
                
                doc.text(`Report ID: ${report.reportId}`, 0, doc.page.height - 25, {
                    align: 'right',
                    width: doc.page.width - 100
                });
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = router;
