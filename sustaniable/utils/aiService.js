const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AIService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            console.warn('GEMINI_API_KEY not found. AI suggestions will use fallback data.');
            this.genAI = null;
        }
    }

    async generateSuggestions(assessment, company) {
        try {
            if (!this.genAI) {
                console.log('🔄 No Gemini AI configured, using fallback suggestions');
                const fallbackResult = this.getFallbackSuggestions(company.industry);
                return {
                    ...fallbackResult,
                    source: 'fallback',
                    timestamp: new Date().toISOString()
                };
            }

            const generalAnswers = Object.fromEntries(assessment.generalAnswers);
            const nicheAnswers = Object.fromEntries(assessment.nicheSpecificAnswers);

            const prompt = this.buildPrompt(company, generalAnswers, nicheAnswers);
            
            console.log('🤖 Attempting to generate AI suggestions for company:', company.companyName);
            
            // Try to generate content with error handling for model issues
            let result;
            let usedModel = 'gemini-1.5-flash';
            try {
                result = await this.model.generateContent(prompt);
                console.log('✅ Successfully generated AI suggestions using primary model:', usedModel);
            } catch (modelError) {
                console.log('❌ Primary model failed, trying alternative models:', modelError.message);
                
                // Try alternative models
                const alternativeModels = ['gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
                for (const modelName of alternativeModels) {
                    try {
                        console.log(`🔄 Trying model: ${modelName}`);
                        const altModel = this.genAI.getGenerativeModel({ model: modelName });
                        result = await altModel.generateContent(prompt);
                        usedModel = modelName;
                        console.log(`✅ Successfully used alternative model: ${modelName}`);
                        break;
                    } catch (altError) {
                        console.log(`❌ Model ${modelName} failed:`, altError.message);
                        continue;
                    }
                }
                
                if (!result) {
                    throw new Error('All AI models failed');
                }
            }
            
            const response = await result.response;
            const text = response.text();
            
            console.log('📝 Raw AI response received, length:', text.length, 'characters');

            const parsedResult = this.parseAIResponse(text, company.industry);
            
            return {
                ...parsedResult,
                source: 'ai',
                model: usedModel,
                timestamp: new Date().toISOString(),
                rawResponse: text.substring(0, 200) + '...' // First 200 chars for verification
            };
        } catch (error) {
            console.error('❌ AI Service error:', error.message);
            console.log('🔄 Falling back to default suggestions');
            
            const fallbackResult = this.getFallbackSuggestions(company.industry);
            return {
                ...fallbackResult,
                source: 'fallback',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    buildPrompt(company, generalAnswers, nicheAnswers) {
        return `
        As a sustainability expert, analyze the following company assessment and provide actionable recommendations:

        Company: ${company.companyName}
        Industry: ${company.industry}
        
        General Answers:
        ${JSON.stringify(generalAnswers, null, 2)}
        
        Industry-Specific Answers:
        ${JSON.stringify(nicheAnswers, null, 2)}

        Please provide:
        1. Top 5 improvement suggestions
        2. Industry best practices specific to ${company.industry}
        3. Priority action items
        4. Risk assessment (Low/Medium/High/Critical)

        Format your response as JSON with the following structure:
        {
            "improvements": ["suggestion 1", "suggestion 2", ...],
            "bestPractices": ["practice 1", "practice 2", ...],
            "actionItems": ["action 1", "action 2", ...],
            "priorityLevel": "Medium"
        }
        `;
    }

    parseAIResponse(text, industry) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Error parsing AI response:', error);
        }

        // Fallback to parsing text response
        return {
            improvements: this.extractListFromText(text, 'improvement'),
            bestPractices: this.extractListFromText(text, 'practice'),
            actionItems: this.extractListFromText(text, 'action'),
            priorityLevel: this.extractPriorityLevel(text)
        };
    }

    extractListFromText(text, type) {
        const lines = text.split('\n');
        const items = [];
        
        lines.forEach(line => {
            if (line.trim().match(/^\d+\./) || line.trim().startsWith('-') || line.trim().startsWith('•')) {
                const cleanLine = line.replace(/^\d+\.|\-|•/, '').trim();
                if (cleanLine.length > 10) {
                    items.push(cleanLine);
                }
            }
        });

        return items.slice(0, 5); // Limit to 5 items
    }

    extractPriorityLevel(text) {
        const lowKeywords = ['low', 'minor', 'minimal'];
        const mediumKeywords = ['medium', 'moderate', 'standard'];
        const highKeywords = ['high', 'important', 'significant'];
        const criticalKeywords = ['critical', 'urgent', 'immediate', 'severe'];

        const lowerText = text.toLowerCase();

        if (criticalKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'Critical';
        } else if (highKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'High';
        } else if (lowKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'Low';
        }
        
        return 'Medium';
    }

    getFallbackSuggestions(industry) {
        const industrySpecific = {
            'Manufacturing': {
                improvements: [
                    'Implement lean manufacturing principles to reduce waste',
                    'Upgrade to energy-efficient machinery and equipment',
                    'Establish a comprehensive recycling program for production waste',
                    'Implement water conservation and treatment systems',
                    'Develop supplier sustainability requirements and auditing'
                ],
                bestPractices: [
                    'ISO 14001 Environmental Management System certification',
                    'Regular environmental impact assessments',
                    'Employee training on sustainability practices',
                    'Circular economy principles in product design'
                ],
                actionItems: [
                    'Conduct energy audit within next quarter',
                    'Set measurable waste reduction targets',
                    'Implement monthly sustainability metrics reporting',
                    'Train management team on sustainability leadership'
                ]
            },
            'IT/Technology': {
                improvements: [
                    'Migrate to cloud infrastructure for better energy efficiency',
                    'Implement comprehensive e-waste recycling programs',
                    'Optimize data center cooling and power usage',
                    'Promote remote work to reduce carbon footprint',
                    'Use renewable energy sources for operations'
                ],
                bestPractices: [
                    'Green software development practices',
                    'ENERGY STAR certified equipment procurement',
                    'Carbon footprint measurement and reporting',
                    'Sustainable IT disposal and refurbishment programs'
                ],
                actionItems: [
                    'Audit current IT infrastructure energy consumption',
                    'Develop remote work sustainability policy',
                    'Partner with certified e-waste recycling vendors',
                    'Implement power management settings on all devices'
                ]
            }
        };

        const defaultSuggestions = {
            improvements: [
                'Develop and implement a formal sustainability policy',
                'Establish measurable environmental targets and KPIs',
                'Implement energy-efficient technologies and practices',
                'Create employee awareness and training programs',
                'Establish partnerships with sustainable suppliers'
            ],
            bestPractices: [
                'Regular sustainability reporting and transparency',
                'Stakeholder engagement on environmental issues',
                'Continuous improvement and innovation in sustainability',
                'Industry collaboration on sustainability initiatives'
            ],
            actionItems: [
                'Conduct baseline sustainability assessment',
                'Set short-term and long-term sustainability goals',
                'Assign sustainability champions across departments',
                'Implement monthly sustainability progress reviews'
            ]
        };

        const suggestions = industrySpecific[industry] || defaultSuggestions;
        
        return {
            ...suggestions,
            priorityLevel: 'Medium'
        };
    }

    async generateSummary(assessment, company, complianceScore) {
        try {
            if (!this.genAI) {
                console.log('🔄 No Gemini AI configured, using fallback summary');
                return this.getFallbackSummary(company, complianceScore);
            }

            const generalAnswers = Object.fromEntries(assessment.generalAnswers);
            const nicheAnswers = Object.fromEntries(assessment.nicheSpecificAnswers);

            const prompt = `
            As a sustainability expert, create a comprehensive executive summary for the following assessment:

            Company: ${company.companyName}
            Industry: ${company.industry}
            Compliance Score: ${complianceScore}%
            
            Assessment Responses:
            General: ${JSON.stringify(generalAnswers, null, 2)}
            Industry-Specific: ${JSON.stringify(nicheAnswers, null, 2)}

            Generate a detailed executive summary of 6-7 lines that covers:
            - Overall assessment performance and score context
            - Key sustainability strengths identified
            - Major areas requiring attention
            - Industry-specific observations
            - Risk assessment implications
            - Strategic recommendations overview

            Write in a professional, analytical tone suitable for executive reporting. 
            Provide only the summary text, no JSON formatting or additional structure.
            `;
            
            console.log('🤖 Generating comprehensive summary for:', company.companyName);
            
            const result = await this.model.generateContent(prompt);
            const summary = result.response.text().trim();
            
            console.log('✅ Successfully generated AI summary');
            return summary;

        } catch (error) {
            console.error('❌ Error generating AI summary:', error);
            console.log('🔄 Falling back to default summary');
            return this.getFallbackSummary(company, complianceScore);
        }
    }

    getFallbackSummary(company, complianceScore) {
        const scoreContext = complianceScore >= 80 ? 'excellent performance with strong sustainability practices' :
                           complianceScore >= 60 ? 'good performance with opportunities for enhancement' :
                           complianceScore >= 40 ? 'moderate performance requiring focused improvements' :
                           'concerning performance requiring immediate strategic intervention';

        return `Assessment completed for ${company.companyName} in the ${company.industry} industry, achieving a compliance score of ${complianceScore}%, indicating ${scoreContext}. The evaluation reveals key insights into the organization's environmental, social, and governance practices through comprehensive analysis of sustainability metrics. Industry-specific considerations for ${company.industry} operations have been thoroughly examined, highlighting both current strengths and areas requiring strategic attention. The assessment identifies critical pathways for improvement while recognizing existing sustainability initiatives that demonstrate organizational commitment. Risk factors and compliance gaps have been evaluated against industry standards and best practices. Strategic recommendations focus on actionable steps to enhance sustainability performance and achieve long-term environmental and social responsibility goals.`;
    }
}

module.exports = new AIService();
