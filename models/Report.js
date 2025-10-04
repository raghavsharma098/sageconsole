const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportId: {
        type: String,
        unique: true
    },
    companyId: {
        type: String,
        required: true,
        ref: 'Company'
    },
    assessmentId: {
        type: String,
        required: true,
        ref: 'Assessment'
    },
    reportData: {
        summary: String,
        complianceScore: Number,
        industryObservations: String,
        weakAreas: [String],
        strengths: [String],
        recommendations: [String]
    },
    aiSuggestions: {
        improvements: [String],
        bestPractices: [String],
        actionItems: [String],
        priorityLevel: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            default: 'Medium'
        }
    },
    generatedDate: {
        type: Date,
        default: Date.now
    },
    isDownloaded: {
        type: Boolean,
        default: false
    },
    downloadCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Generate unique report ID
reportSchema.pre('save', async function(next) {
    if (this.isNew) {
        let reportId;
        let isUnique = false;
        let counter = 1;
        
        // Keep trying until we find a unique reportId
        while (!isUnique) {
            // Get the highest existing report number
            const lastReport = await mongoose.model('Report')
                .findOne({}, { reportId: 1 })
                .sort({ reportId: -1 })
                .limit(1);
            
            if (lastReport) {
                // Extract number from last reportId (e.g., "REP000003" -> 3)
                const lastNumber = parseInt(lastReport.reportId.replace('REP', ''));
                reportId = `REP${String(lastNumber + counter).padStart(6, '0')}`;
            } else {
                // No reports exist, start with REP000001
                reportId = `REP${String(counter).padStart(6, '0')}`;
            }
            
            // Check if this reportId already exists
            const existingReport = await mongoose.model('Report').findOne({ reportId });
            if (!existingReport) {
                isUnique = true;
                this.reportId = reportId;
            } else {
                counter++;
            }
        }
    }
    next();
});

module.exports = mongoose.model('Report', reportSchema);
