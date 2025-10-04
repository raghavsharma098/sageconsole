const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema({
    companyId: {
        type: String,
        unique: true
    },
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    industry: {
        type: String,
        required: true,
        enum: ['Manufacturing', 'IT/Technology', 'Healthcare', 'Finance', 'Retail', 'Construction', 'Energy', 'Agriculture', 'Transportation', 'Other']
    },
    registrationDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Generate unique company ID and hash password before saving
companySchema.pre('save', async function(next) {
    try {
        // Generate unique company ID for new companies
        if (this.isNew) {
            const count = await mongoose.model('Company').countDocuments();
            this.companyId = `COMP${String(count + 1).padStart(6, '0')}`;
        }
        
        // Hash password if it's modified
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
companySchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Company', companySchema);
