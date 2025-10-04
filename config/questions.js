// Dummy questions for the assessment
const generalQuestions = [
    {
        id: 'company_size',
        type: 'select',
        question: 'What is the size of your company?',
        options: ['1-10 employees', '11-50 employees', '51-200 employees', '201-1000 employees', '1000+ employees'],
        required: true
    },
    {
        id: 'years_operation',
        type: 'select',
        question: 'How many years has your company been in operation?',
        options: ['Less than 1 year', '1-5 years', '6-10 years', '11-20 years', 'More than 20 years'],
        required: true
    },
    {
        id: 'sustainability_policy',
        type: 'radio',
        question: 'Does your company have a formal sustainability policy?',
        options: ['Yes', 'No', 'In development'],
        required: true
    },
    {
        id: 'compliance_certifications',
        type: 'checkbox',
        question: 'Which compliance certifications does your company have?',
        options: ['ISO 14001', 'ISO 9001', 'OHSAS 18001', 'SA 8000', 'None', 'Other'],
        required: false
    },
    {
        id: 'energy_sources',
        type: 'checkbox',
        question: 'What energy sources does your company primarily use?',
        options: ['Grid electricity', 'Solar power', 'Wind power', 'Natural gas', 'Coal', 'Other renewable sources'],
        required: true
    },
    {
        id: 'waste_management',
        type: 'radio',
        question: 'How does your company manage waste?',
        options: ['Recycling program', 'Waste reduction initiatives', 'Standard disposal', 'No formal program'],
        required: true
    },
    {
        id: 'document_upload',
        type: 'file',
        question: 'Please upload a relevant document (sustainability policy, compliance certificate, audit report, etc.)',
        accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt',
        required: false
    }
];

const industrySpecificQuestions = {
    'Manufacturing': [
        {
            id: 'production_waste',
            type: 'text',
            question: 'What percentage of your production results in waste?',
            placeholder: 'Enter percentage (e.g., 15%)',
            required: true
        },
        {
            id: 'water_usage',
            type: 'select',
            question: 'How would you rate your water usage efficiency?',
            options: ['Very high efficiency', 'High efficiency', 'Moderate efficiency', 'Low efficiency', 'Very low efficiency'],
            required: true
        },
        {
            id: 'emissions_tracking',
            type: 'radio',
            question: 'Do you track carbon emissions from your manufacturing processes?',
            options: ['Yes, comprehensively', 'Yes, partially', 'No, but planning to', 'No'],
            required: true
        }
    ],
    'IT/Technology': [
        {
            id: 'server_efficiency',
            type: 'radio',
            question: 'Do you use energy-efficient servers and data centers?',
            options: ['Yes, all are energy-efficient', 'Partially', 'No, but planning to upgrade', 'No'],
            required: true
        },
        {
            id: 'remote_work',
            type: 'select',
            question: 'What percentage of your workforce works remotely?',
            options: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
            required: true
        },
        {
            id: 'ewaste_program',
            type: 'radio',
            question: 'Do you have an e-waste recycling program?',
            options: ['Yes, comprehensive program', 'Yes, basic program', 'No, but planning', 'No'],
            required: true
        }
    ],
    'Healthcare': [
        {
            id: 'medical_waste',
            type: 'radio',
            question: 'How do you handle medical waste disposal?',
            options: ['Certified medical waste disposal service', 'In-house sterilization and disposal', 'Standard waste management', 'Other'],
            required: true
        },
        {
            id: 'energy_efficiency',
            type: 'select',
            question: 'Have you implemented energy-efficient lighting and HVAC systems?',
            options: ['Yes, fully implemented', 'Partially implemented', 'Planning to implement', 'No plans'],
            required: true
        },
        {
            id: 'pharmaceutical_disposal',
            type: 'radio',
            question: 'Do you have proper pharmaceutical disposal procedures?',
            options: ['Yes, comprehensive procedures', 'Yes, basic procedures', 'No, but planning', 'No'],
            required: true
        }
    ],
    'Finance': [
        {
            id: 'digital_transformation',
            type: 'select',
            question: 'What percentage of your operations are digitized?',
            options: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
            required: true
        },
        {
            id: 'sustainable_investing',
            type: 'radio',
            question: 'Do you offer sustainable investment options?',
            options: ['Yes, comprehensive options', 'Yes, limited options', 'Planning to offer', 'No'],
            required: true
        },
        {
            id: 'paperless_operations',
            type: 'radio',
            question: 'Have you transitioned to paperless operations?',
            options: ['Fully paperless', 'Mostly paperless', 'Partially paperless', 'Still paper-based'],
            required: true
        }
    ],
    'Retail': [
        {
            id: 'packaging_materials',
            type: 'checkbox',
            question: 'What types of packaging materials do you use?',
            options: ['Biodegradable materials', 'Recycled materials', 'Plastic packaging', 'Paper packaging', 'Minimal packaging'],
            required: true
        },
        {
            id: 'supply_chain',
            type: 'radio',
            question: 'Do you evaluate suppliers based on sustainability criteria?',
            options: ['Yes, comprehensive evaluation', 'Yes, basic evaluation', 'Planning to implement', 'No'],
            required: true
        },
        {
            id: 'store_energy',
            type: 'select',
            question: 'What energy-efficient measures have you implemented in stores?',
            options: ['LED lighting and smart HVAC', 'LED lighting only', 'Smart HVAC only', 'Planning implementation', 'No measures'],
            required: true
        }
    ],
    'Construction': [
        {
            id: 'green_building',
            type: 'radio',
            question: 'Do you follow green building standards?',
            options: ['Yes, LEED certified', 'Yes, other green standards', 'Planning to adopt', 'No'],
            required: true
        },
        {
            id: 'material_sourcing',
            type: 'checkbox',
            question: 'What sustainable materials do you use?',
            options: ['Recycled materials', 'Locally sourced materials', 'Low-emission materials', 'Renewable materials', 'None'],
            required: true
        },
        {
            id: 'waste_reduction',
            type: 'text',
            question: 'What percentage of construction waste do you recycle?',
            placeholder: 'Enter percentage (e.g., 30%)',
            required: true
        }
    ],
    'Energy': [
        {
            id: 'renewable_portfolio',
            type: 'text',
            question: 'What percentage of your energy portfolio is renewable?',
            placeholder: 'Enter percentage (e.g., 45%)',
            required: true
        },
        {
            id: 'emissions_reduction',
            type: 'radio',
            question: 'Do you have carbon emissions reduction targets?',
            options: ['Yes, with specific timelines', 'Yes, general targets', 'Planning to set targets', 'No'],
            required: true
        },
        {
            id: 'grid_modernization',
            type: 'radio',
            question: 'Are you investing in smart grid technologies?',
            options: ['Yes, comprehensive investment', 'Yes, limited investment', 'Planning investment', 'No'],
            required: true
        }
    ],
    'Agriculture': [
        {
            id: 'organic_farming',
            type: 'radio',
            question: 'Do you practice organic farming methods?',
            options: ['Yes, fully organic', 'Yes, partially organic', 'Transitioning to organic', 'No'],
            required: true
        },
        {
            id: 'water_conservation',
            type: 'checkbox',
            question: 'What water conservation methods do you use?',
            options: ['Drip irrigation', 'Rainwater harvesting', 'Crop rotation', 'Drought-resistant crops', 'None'],
            required: true
        },
        {
            id: 'soil_health',
            type: 'radio',
            question: 'Do you implement soil health management practices?',
            options: ['Yes, comprehensive practices', 'Yes, basic practices', 'Planning to implement', 'No'],
            required: true
        }
    ],
    'Transportation': [
        {
            id: 'fleet_efficiency',
            type: 'select',
            question: 'What percentage of your fleet uses alternative fuels or is electric?',
            options: ['0-10%', '11-25%', '26-50%', '51-75%', '76-100%'],
            required: true
        },
        {
            id: 'route_optimization',
            type: 'radio',
            question: 'Do you use route optimization software to reduce fuel consumption?',
            options: ['Yes, comprehensive system', 'Yes, basic system', 'Planning to implement', 'No'],
            required: true
        },
        {
            id: 'maintenance_program',
            type: 'radio',
            question: 'Do you have a preventive maintenance program for vehicles?',
            options: ['Yes, comprehensive program', 'Yes, basic program', 'Planning to implement', 'No'],
            required: true
        }
    ],
    'Other': [
        {
            id: 'industry_specific_1',
            type: 'text',
            question: 'What are the main environmental challenges in your industry?',
            placeholder: 'Describe the key environmental challenges',
            required: true
        },
        {
            id: 'industry_specific_2',
            type: 'text',
            question: 'What sustainability initiatives have you implemented?',
            placeholder: 'Describe your current sustainability initiatives',
            required: true
        },
        {
            id: 'industry_specific_3',
            type: 'text',
            question: 'What are your main sustainability goals for the next 5 years?',
            placeholder: 'Describe your sustainability goals',
            required: true
        }
    ]
};

function getQuestions(industry) {
    return {
        general: generalQuestions,
        industry: industrySpecificQuestions[industry] || industrySpecificQuestions['Other']
    };
}

module.exports = {
    getQuestions,
    generalQuestions,
    industrySpecificQuestions
};
