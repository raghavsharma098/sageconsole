const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema({
    companyId: {
        type: String,
        unique: true,
        index: true,
        validate: {
            validator: function(v) {
                return /^COMP\d{6}$/.test(v);
            },
            message: 'Company ID must be in format COMP000000'
        }
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
        enum: [
            'Manufacturing',
            'IT/Technology',
            'Healthcare',
            'Finance',
            'Retail',
            'Construction',
            'Energy',
            'Agriculture',
            'Transportation',
            'Chemicals',
            'Textile',
            'Pharmaceuticals',
            'Automobile',
            'Paper and Packaging',
            'Other Manufacturing',
            'Education',
            'Technology',
            'Other'
        ]
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

// Create unique index on companyId
companySchema.index({ companyId: 1 }, { unique: true });

// Generate unique company ID and hash password before saving
companySchema.pre('save', async function(next) {
    try {
        // Generate unique company ID for new companies
        if (this.isNew) {
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!isUnique && attempts < maxAttempts) {
                attempts++;
                
                // Get the highest existing company number
                const lastCompany = await mongoose.model('Company')
                    .findOne({}, { companyId: 1 })
                    .sort({ companyId: -1 })
                    .limit(1);
                
                let nextNumber = 1;
                if (lastCompany && lastCompany.companyId) {
                    const match = lastCompany.companyId.match(/^COMP(\d+)$/);
                    if (match) {
                        nextNumber = parseInt(match[1]) + 1;
                    }
                }
                
                const newCompanyId = `COMP${String(nextNumber).padStart(6, '0')}`;
                
                // Check if this ID already exists
                const existingCompany = await mongoose.model('Company').findOne({ companyId: newCompanyId });
                if (!existingCompany) {
                    this.companyId = newCompanyId;
                    isUnique = true;
                    console.log(`✅ Generated unique company ID: ${newCompanyId}`);
                } else {
                    console.log(`⚠️ Company ID ${newCompanyId} already exists, trying next number...`);
                    // If ID exists, try the next number
                    nextNumber++;
                }
            }
            
            if (!isUnique) {
                throw new Error('Unable to generate unique company ID after multiple attempts');
            }
        }
        
        // Hash password if it's modified
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        
        next();
    } catch (error) {
        console.error('❌ Error in Company pre-save middleware:', error);
        next(error);
    }
});

// Compare password method
companySchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to get next available company ID
companySchema.statics.getNextCompanyId = async function() {
    const lastCompany = await this.findOne({}, { companyId: 1 })
        .sort({ companyId: -1 })
        .limit(1);
    
    let nextNumber = 1;
    if (lastCompany && lastCompany.companyId) {
        const match = lastCompany.companyId.match(/^COMP(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }
    
    return `COMP${String(nextNumber).padStart(6, '0')}`;
};

// Static method to find and fix duplicate company IDs
companySchema.statics.findAndFixDuplicates = async function() {
    const duplicates = await this.aggregate([
        {
            $group: {
                _id: "$companyId",
                count: { $sum: 1 },
                docs: { $push: "$_id" }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        }
    ]);
    
    if (duplicates.length > 0) {
        console.log(`⚠️ Found ${duplicates.length} duplicate company IDs:`, duplicates);
        
        for (const duplicate of duplicates) {
            // Keep the first document, update the rest with new IDs
            const docsToUpdate = duplicate.docs.slice(1);
            
            for (const docId of docsToUpdate) {
                const newCompanyId = await this.getNextCompanyId();
                await this.findByIdAndUpdate(docId, { companyId: newCompanyId });
                console.log(`✅ Fixed duplicate: ${docId} -> ${newCompanyId}`);
            }
        }
    }
    
    return duplicates;
};

module.exports = mongoose.model('Company', companySchema);
