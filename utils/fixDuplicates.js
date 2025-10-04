const mongoose = require('mongoose');
const Company = require('../models/Company');

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sustainabilityassessment', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Main function to fix duplicates
const fixDuplicateCompanyIds = async () => {
    try {
        console.log('🔍 Starting duplicate company ID check...');
        
        // Find and fix duplicates
        const duplicates = await Company.findAndFixDuplicates();
        
        if (duplicates.length === 0) {
            console.log('✅ No duplicate company IDs found');
        } else {
            console.log(`✅ Fixed ${duplicates.length} duplicate company ID groups`);
        }
        
        // Verify all companies have unique IDs
        const allCompanies = await Company.find({}, { companyId: 1 });
        const companyIds = allCompanies.map(c => c.companyId);
        const uniqueIds = new Set(companyIds);
        
        if (companyIds.length === uniqueIds.size) {
            console.log('✅ All company IDs are now unique');
        } else {
            console.log('⚠️ Some duplicate IDs may still exist');
        }
        
        console.log(`📊 Total companies: ${companyIds.length}`);
        console.log(`📊 Unique IDs: ${uniqueIds.size}`);
        
    } catch (error) {
        console.error('❌ Error fixing duplicates:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
};

// Run the script if called directly
if (require.main === module) {
    connectDB().then(() => {
        fixDuplicateCompanyIds();
    });
}

module.exports = { fixDuplicateCompanyIds };
