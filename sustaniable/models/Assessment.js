const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
    companyId: {
        type: String,
        required: true,
        ref: 'Company'
    },
    assessmentId: {
        type: String,
        unique: true
    },
    generalAnswers: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    nicheSpecificAnswers: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    uploadedDocument: {
        filename: String,
        originalName: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed', 'submitted'],
        default: 'in-progress'
    },
    submissionDate: {
        type: Date
    },
    lastModified: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Generate unique assessment ID
assessmentSchema.pre('save', async function(next) {
    if (this.isNew) {
        const count = await mongoose.model('Assessment').countDocuments();
        this.assessmentId = `ASS${String(count + 1).padStart(6, '0')}`;
    }
    this.lastModified = new Date();
    next();
});

module.exports = mongoose.model('Assessment', assessmentSchema);
