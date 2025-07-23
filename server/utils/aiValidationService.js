import OpenAI from 'openai';
import { BPDB, AlertDB } from './database.js';

/**
 * AI-powered validation and analysis service for blood pressure readings
 * Provides reasonableness checks, trend analysis, and health insights
 */
export class AIValidationService {
    
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });
    }

    /**
     * Validate blood pressure reading for reasonableness
     */
    static validateReading(systolic, diastolic, pulse = null, userAge = null, previousReadings = []) {
        const validation = {
            isValid: true,
            warnings: [],
            severity: 'normal',
            category: '',
            recommendations: []
        };

        // Basic range validation
        if (systolic < 70 || systolic > 250) {
            validation.isValid = false;
            validation.warnings.push(`Systolic pressure ${systolic} is outside normal measurement range (70-250)`);
        }

        if (diastolic < 40 || diastolic > 150) {
            validation.isValid = false;
            validation.warnings.push(`Diastolic pressure ${diastolic} is outside normal measurement range (40-150)`);
        }

        if (systolic <= diastolic) {
            validation.isValid = false;
            validation.warnings.push('Systolic pressure must be higher than diastolic pressure');
        }

        // Pulse validation
        if (pulse !== null) {
            if (pulse < 30 || pulse > 200) {
                validation.warnings.push(`Pulse rate ${pulse} is outside normal range (30-200)`);
            }
        }

        // Blood pressure categorization (AHA guidelines)
        if (validation.isValid) {
            if (systolic < 120 && diastolic < 80) {
                validation.category = 'Normal';
                validation.severity = 'normal';
            } else if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
                validation.category = 'Elevated';
                validation.severity = 'low';
                validation.recommendations.push('Consider lifestyle modifications');
            } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
                validation.category = 'High Blood Pressure Stage 1';
                validation.severity = 'medium';
                validation.recommendations.push('Consult with healthcare provider');
            } else if (systolic >= 140 || diastolic >= 90) {
                validation.category = 'High Blood Pressure Stage 2';
                validation.severity = 'high';
                validation.recommendations.push('Seek immediate medical attention');
            } else if (systolic > 180 || diastolic > 120) {
                validation.category = 'Hypertensive Crisis';
                validation.severity = 'critical';
                validation.recommendations.push('EMERGENCY: Seek immediate medical care');
            }
        }

        // Age-specific considerations
        if (userAge) {
            if (userAge >= 65) {
                // Isolated systolic hypertension is common in elderly
                if (systolic >= 140 && diastolic < 90) {
                    validation.warnings.push('Isolated systolic hypertension - common in older adults');
                }
            }
        }

        // Trend analysis with previous readings
        if (previousReadings.length > 0) {
            const trendAnalysis = this.analyzeTrend(systolic, diastolic, previousReadings);
            validation.trend = trendAnalysis;
            
            if (trendAnalysis.significantChange) {
                validation.warnings.push(trendAnalysis.message);
            }
        }

        return validation;
    }

    /**
     * Analyze trends in blood pressure readings
     */
    static analyzeTrend(currentSystolic, currentDiastolic, previousReadings) {
        if (previousReadings.length === 0) {
            return { trend: 'insufficient_data', significantChange: false };
        }

        const recent = previousReadings.slice(0, 5); // Last 5 readings
        const avgSystolic = recent.reduce((sum, r) => sum + r.systolic, 0) / recent.length;
        const avgDiastolic = recent.reduce((sum, r) => sum + r.diastolic, 0) / recent.length;

        const systolicChange = currentSystolic - avgSystolic;
        const diastolicChange = currentDiastolic - avgDiastolic;

        let trend = 'stable';
        let significantChange = false;
        let message = '';

        // Significant change thresholds
        if (Math.abs(systolicChange) > 20 || Math.abs(diastolicChange) > 10) {
            significantChange = true;
            
            if (systolicChange > 20 || diastolicChange > 10) {
                trend = 'increasing';
                message = 'Blood pressure has increased significantly compared to recent readings';
            } else {
                trend = 'decreasing';
                message = 'Blood pressure has decreased significantly compared to recent readings';
            }
        } else if (systolicChange > 10 || diastolicChange > 5) {
            trend = 'slightly_increasing';
        } else if (systolicChange < -10 || diastolicChange < -5) {
            trend = 'slightly_decreasing';
        }

        return {
            trend,
            significantChange,
            message,
            systolicChange: Math.round(systolicChange),
            diastolicChange: Math.round(diastolicChange),
            comparedToAverage: {
                systolic: Math.round(avgSystolic),
                diastolic: Math.round(avgDiastolic)
            }
        };
    }

    /**
     * Generate AI-powered health insights
     */
    async generateHealthInsights(userId, currentReading, recentReadings = []) {
        try {
            const systemPrompt = `
You are a healthcare AI assistant specializing in blood pressure analysis for elderly patients. 
Provide helpful, non-diagnostic insights about blood pressure patterns and general health recommendations.
Always remind users to consult healthcare providers for medical advice.

Guidelines:
- Be encouraging and supportive
- Use simple, clear language appropriate for elderly users
- Focus on lifestyle factors and general wellness
- Never provide specific medical diagnoses
- Always recommend consulting healthcare providers for concerns
`;

            const userPrompt = `
Current reading: ${currentReading.systolic}/${currentReading.diastolic}${currentReading.pulse ? ` (pulse: ${currentReading.pulse})` : ''}
Recent readings: ${recentReadings.map(r => `${r.systolic}/${r.diastolic}`).join(', ')}

Please provide:
1. A brief assessment of the current reading
2. Any patterns you notice in recent readings
3. General lifestyle recommendations
4. When to contact a healthcare provider

Keep the response concise and elderly-friendly.
`;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            return {
                success: true,
                insights: completion.choices[0].message.content,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('AI insights generation error:', error);
            return {
                success: false,
                error: 'Unable to generate insights at this time',
                insights: 'Please consult with your healthcare provider about your blood pressure readings.',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check for alert conditions and create alerts if necessary
     */
    static async checkAlertConditions(userId, reading, validation) {
        const alerts = [];

        // Critical values
        if (validation.severity === 'critical') {
            alerts.push({
                user_id: userId,
                alert_type: 'critical_bp',
                severity: 'critical',
                message: `URGENT: Blood pressure ${reading.systolic}/${reading.diastolic} requires immediate medical attention`
            });
        }

        // High values
        if (validation.severity === 'high') {
            alerts.push({
                user_id: userId,
                alert_type: 'high_bp',
                severity: 'high',
                message: `High blood pressure detected: ${reading.systolic}/${reading.diastolic}. Please consult your healthcare provider.`
            });
        }

        // Significant trend changes
        if (validation.trend && validation.trend.significantChange) {
            alerts.push({
                user_id: userId,
                alert_type: 'trend_change',
                severity: 'medium',
                message: validation.trend.message
            });
        }

        // Irregular pulse
        if (reading.pulse && (reading.pulse < 50 || reading.pulse > 120)) {
            const severity = (reading.pulse < 40 || reading.pulse > 140) ? 'high' : 'medium';
            alerts.push({
                user_id: userId,
                alert_type: 'irregular_pulse',
                severity,
                message: `Pulse rate ${reading.pulse} is outside normal range. Consider consulting your healthcare provider.`
            });
        }

        // Save alerts to database
        for (const alert of alerts) {
            try {
                await AlertDB.create(alert);
            } catch (error) {
                console.error('Error creating alert:', error);
            }
        }

        return alerts;
    }

    /**
     * Generate personalized recommendations based on user profile and readings
     */
    static generateRecommendations(reading, userAge, recentReadings = []) {
        const recommendations = [];

        // General recommendations based on BP category
        if (reading.systolic >= 140 || reading.diastolic >= 90) {
            recommendations.push({
                category: 'medical',
                priority: 'high',
                text: 'Schedule an appointment with your healthcare provider to discuss your blood pressure'
            });
        }

        if (reading.systolic >= 120 || reading.diastolic >= 80) {
            recommendations.push({
                category: 'lifestyle',
                priority: 'medium',
                text: 'Consider reducing sodium intake and increasing physical activity'
            });
        }

        // Age-specific recommendations
        if (userAge && userAge >= 65) {
            recommendations.push({
                category: 'monitoring',
                priority: 'medium',
                text: 'Monitor blood pressure regularly as recommended by your healthcare provider'
            });
        }

        // Trend-based recommendations
        if (recentReadings.length >= 3) {
            const avgSystolic = recentReadings.reduce((sum, r) => sum + r.systolic, 0) / recentReadings.length;
            if (avgSystolic > 140) {
                recommendations.push({
                    category: 'lifestyle',
                    priority: 'high',
                    text: 'Your recent readings show consistently elevated blood pressure. Please consult your doctor.'
                });
            }
        }

        return recommendations;
    }

    /**
     * Comprehensive validation and analysis
     */
    async performCompleteAnalysis(userId, reading, userProfile = {}) {
        try {
            // Get recent readings for trend analysis
            const recentReadings = await BPDB.getRecent(userId, 30);
            
            // Basic validation
            const validation = AIValidationService.validateReading(
                reading.systolic,
                reading.diastolic,
                reading.pulse,
                userProfile.age,
                recentReadings
            );

            // Generate AI insights
            const insights = await this.generateHealthInsights(userId, reading, recentReadings.slice(0, 10));

            // Check for alert conditions
            const alerts = await AIValidationService.checkAlertConditions(userId, reading, validation);

            // Generate recommendations
            const recommendations = AIValidationService.generateRecommendations(
                reading,
                userProfile.age,
                recentReadings.slice(0, 5)
            );

            return {
                validation,
                insights: insights.insights,
                alerts,
                recommendations,
                trendData: {
                    recentCount: recentReadings.length,
                    averages: recentReadings.length > 0 ? {
                        systolic: Math.round(recentReadings.reduce((sum, r) => sum + r.systolic, 0) / recentReadings.length),
                        diastolic: Math.round(recentReadings.reduce((sum, r) => sum + r.diastolic, 0) / recentReadings.length)
                    } : null
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Complete analysis error:', error);
            throw new Error('Failed to perform complete analysis');
        }
    }
}

export default AIValidationService;
