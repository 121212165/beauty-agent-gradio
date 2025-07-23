import express from 'express';
import { BPDB, UserDB } from '../utils/database.js';
import AIValidationService from '../utils/aiValidationService.js';

const router = express.Router();

/**
 * Get comprehensive analytics for a user
 */
router.get('/:user_id/summary', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { days = 30 } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get readings for the specified period
        const readings = await BPDB.getRecent(user_id, parseInt(days));
        
        if (readings.length === 0) {
            return res.json({
                success: true,
                data: {
                    message: 'No readings found for the specified period',
                    period_days: parseInt(days),
                    user_info: { user_id: user.user_id, name: user.name }
                }
            });
        }

        // Generate comprehensive analytics
        const analytics = await generateComprehensiveAnalytics(readings, user, parseInt(days));

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get trend analysis for a user
 */
router.get('/:user_id/trends', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { period = '30d' } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Parse period
        const days = parsePeriod(period);
        const readings = await BPDB.getRecent(user_id, days);

        if (readings.length < 2) {
            return res.json({
                success: true,
                data: {
                    message: 'Insufficient data for trend analysis (minimum 2 readings required)',
                    readings_count: readings.length
                }
            });
        }

        // Generate trend analysis
        const trendAnalysis = generateTrendAnalysis(readings, days);

        res.json({
            success: true,
            data: trendAnalysis
        });

    } catch (error) {
        console.error('Trend analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get weekly/monthly reports
 */
router.get('/:user_id/reports/:type', async (req, res) => {
    try {
        const { user_id, type } = req.params;
        const { weeks = 4, months = 3 } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let report;
        if (type === 'weekly') {
            report = await generateWeeklyReport(user_id, parseInt(weeks));
        } else if (type === 'monthly') {
            report = await generateMonthlyReport(user_id, parseInt(months));
        } else {
            return res.status(400).json({ error: 'Invalid report type. Use "weekly" or "monthly"' });
        }

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get data for charts and visualizations
 */
router.get('/:user_id/charts', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { type = 'line', days = 30 } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const readings = await BPDB.getRecent(user_id, parseInt(days));

        let chartData;
        switch (type) {
            case 'line':
                chartData = generateLineChartData(readings);
                break;
            case 'bar':
                chartData = generateBarChartData(readings);
                break;
            case 'category':
                chartData = generateCategoryChartData(readings);
                break;
            default:
                return res.status(400).json({ error: 'Invalid chart type' });
        }

        res.json({
            success: true,
            data: chartData
        });

    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Export data in CSV format
 */
router.get('/:user_id/export', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { days = 90, format = 'csv' } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const readings = await BPDB.getRecent(user_id, parseInt(days));

        if (format === 'csv') {
            const csv = generateCSV(readings, user);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${user_id}_bp_readings.csv"`);
            res.send(csv);
        } else {
            return res.status(400).json({ error: 'Only CSV format is currently supported' });
        }

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper function to generate comprehensive analytics
 */
async function generateComprehensiveAnalytics(readings, user, days) {
    const analytics = {
        period_days: days,
        user_info: { user_id: user.user_id, name: user.name },
        summary: {
            total_readings: readings.length,
            date_range: {
                start: readings[readings.length - 1]?.measurement_time,
                end: readings[0]?.measurement_time
            }
        }
    };

    // Basic statistics
    const systolicValues = readings.map(r => r.systolic);
    const diastolicValues = readings.map(r => r.diastolic);
    const pulseValues = readings.filter(r => r.pulse).map(r => r.pulse);

    analytics.statistics = {
        systolic: calculateStats(systolicValues),
        diastolic: calculateStats(diastolicValues),
        pulse: pulseValues.length > 0 ? calculateStats(pulseValues) : null
    };

    // Category distribution
    analytics.categories = calculateCategoryDistribution(readings);

    // Trend analysis
    analytics.trends = generateTrendAnalysis(readings, days);

    // Entry method distribution
    analytics.entry_methods = calculateEntryMethodDistribution(readings);

    // Time patterns
    analytics.time_patterns = calculateTimePatterns(readings);

    // AI insights
    if (readings.length > 0) {
        const aiValidation = new AIValidationService();
        const latestReading = readings[0];
        const userAge = user.birth_date ? new Date().getFullYear() - new Date(user.birth_date).getFullYear() : null;
        
        try {
            const insights = await aiValidation.generateHealthInsights(
                user.user_id, 
                latestReading, 
                readings.slice(1, 11)
            );
            analytics.ai_insights = insights.insights;
        } catch (error) {
            console.error('AI insights error:', error);
            analytics.ai_insights = 'AI insights temporarily unavailable';
        }
    }

    return analytics;
}

/**
 * Helper function to calculate basic statistics
 */
function calculateStats(values) {
    if (values.length === 0) return null;

    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
        min: Math.min(...values),
        max: Math.max(...values),
        average: Math.round(sum / values.length * 10) / 10,
        median: sorted.length % 2 === 0 
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)],
        count: values.length
    };
}

/**
 * Helper function to calculate category distribution
 */
function calculateCategoryDistribution(readings) {
    const categories = {
        normal: 0,
        elevated: 0,
        stage1_hypertension: 0,
        stage2_hypertension: 0,
        hypertensive_crisis: 0
    };

    readings.forEach(reading => {
        const { systolic, diastolic } = reading;
        
        if (systolic < 120 && diastolic < 80) {
            categories.normal++;
        } else if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
            categories.elevated++;
        } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
            categories.stage1_hypertension++;
        } else if (systolic >= 140 || diastolic >= 90) {
            categories.stage2_hypertension++;
        } else if (systolic > 180 || diastolic > 120) {
            categories.hypertensive_crisis++;
        }
    });

    return categories;
}

/**
 * Helper function to generate trend analysis
 */
function generateTrendAnalysis(readings, days) {
    if (readings.length < 2) {
        return { status: 'insufficient_data' };
    }

    // Sort readings by date
    const sortedReadings = readings.sort((a, b) => new Date(a.measurement_time) - new Date(b.measurement_time));
    
    // Split into periods for comparison
    const midpoint = Math.floor(sortedReadings.length / 2);
    const firstHalf = sortedReadings.slice(0, midpoint);
    const secondHalf = sortedReadings.slice(midpoint);

    const firstAvg = {
        systolic: firstHalf.reduce((sum, r) => sum + r.systolic, 0) / firstHalf.length,
        diastolic: firstHalf.reduce((sum, r) => sum + r.diastolic, 0) / firstHalf.length
    };

    const secondAvg = {
        systolic: secondHalf.reduce((sum, r) => sum + r.systolic, 0) / secondHalf.length,
        diastolic: secondHalf.reduce((sum, r) => sum + r.diastolic, 0) / secondHalf.length
    };

    const changes = {
        systolic: secondAvg.systolic - firstAvg.systolic,
        diastolic: secondAvg.diastolic - firstAvg.diastolic
    };

    let trend = 'stable';
    if (changes.systolic > 5 || changes.diastolic > 3) {
        trend = 'increasing';
    } else if (changes.systolic < -5 || changes.diastolic < -3) {
        trend = 'decreasing';
    }

    return {
        trend,
        changes: {
            systolic: Math.round(changes.systolic * 10) / 10,
            diastolic: Math.round(changes.diastolic * 10) / 10
        },
        periods: {
            first: {
                systolic: Math.round(firstAvg.systolic),
                diastolic: Math.round(firstAvg.diastolic),
                readings: firstHalf.length
            },
            second: {
                systolic: Math.round(secondAvg.systolic),
                diastolic: Math.round(secondAvg.diastolic),
                readings: secondHalf.length
            }
        }
    };
}

/**
 * Helper function to calculate entry method distribution
 */
function calculateEntryMethodDistribution(readings) {
    const methods = {};
    readings.forEach(reading => {
        methods[reading.entry_method] = (methods[reading.entry_method] || 0) + 1;
    });
    return methods;
}

/**
 * Helper function to calculate time patterns
 */
function calculateTimePatterns(readings) {
    const hourCounts = new Array(24).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);

    readings.forEach(reading => {
        const date = new Date(reading.measurement_time);
        hourCounts[date.getHours()]++;
        dayOfWeekCounts[date.getDay()]++;
    });

    return {
        by_hour: hourCounts,
        by_day_of_week: dayOfWeekCounts,
        most_common_hour: hourCounts.indexOf(Math.max(...hourCounts)),
        most_common_day: dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))
    };
}

/**
 * Helper function to generate line chart data
 */
function generateLineChartData(readings) {
    const sortedReadings = readings.sort((a, b) => new Date(a.measurement_time) - new Date(b.measurement_time));
    
    return {
        labels: sortedReadings.map(r => new Date(r.measurement_time).toLocaleDateString()),
        datasets: [
            {
                label: 'Systolic',
                data: sortedReadings.map(r => r.systolic),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)'
            },
            {
                label: 'Diastolic',
                data: sortedReadings.map(r => r.diastolic),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)'
            }
        ]
    };
}

/**
 * Helper function to generate bar chart data
 */
function generateBarChartData(readings) {
    const categories = calculateCategoryDistribution(readings);
    
    return {
        labels: ['Normal', 'Elevated', 'Stage 1', 'Stage 2', 'Crisis'],
        datasets: [{
            label: 'Number of Readings',
            data: [
                categories.normal,
                categories.elevated,
                categories.stage1_hypertension,
                categories.stage2_hypertension,
                categories.hypertensive_crisis
            ],
            backgroundColor: [
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(153, 102, 255, 0.6)'
            ]
        }]
    };
}

/**
 * Helper function to generate category chart data
 */
function generateCategoryChartData(readings) {
    const categories = calculateCategoryDistribution(readings);
    const total = readings.length;
    
    return {
        labels: ['Normal', 'Elevated', 'Stage 1 Hypertension', 'Stage 2 Hypertension', 'Hypertensive Crisis'],
        datasets: [{
            data: [
                Math.round(categories.normal / total * 100),
                Math.round(categories.elevated / total * 100),
                Math.round(categories.stage1_hypertension / total * 100),
                Math.round(categories.stage2_hypertension / total * 100),
                Math.round(categories.hypertensive_crisis / total * 100)
            ],
            backgroundColor: [
                '#4CAF50',
                '#FFC107',
                '#FF9800',
                '#F44336',
                '#9C27B0'
            ]
        }]
    };
}

/**
 * Helper function to generate CSV export
 */
function generateCSV(readings, user) {
    const headers = [
        'Date',
        'Time',
        'Systolic',
        'Diastolic',
        'Pulse',
        'Entry Method',
        'Notes'
    ];

    const rows = readings.map(reading => {
        const date = new Date(reading.measurement_time);
        return [
            date.toLocaleDateString(),
            date.toLocaleTimeString(),
            reading.systolic,
            reading.diastolic,
            reading.pulse || '',
            reading.entry_method,
            reading.notes || ''
        ];
    });

    const csvContent = [
        `# Blood Pressure Readings for ${user.name} (${user.user_id})`,
        `# Generated on ${new Date().toLocaleString()}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

/**
 * Helper function to parse period string
 */
function parsePeriod(period) {
    const match = period.match(/^(\d+)([dwmy])$/);
    if (!match) return 30; // default to 30 days

    const [, num, unit] = match;
    const number = parseInt(num);

    switch (unit) {
        case 'd': return number;
        case 'w': return number * 7;
        case 'm': return number * 30;
        case 'y': return number * 365;
        default: return 30;
    }
}

/**
 * Helper function to generate weekly report
 */
async function generateWeeklyReport(userId, weeks) {
    const days = weeks * 7;
    const readings = await BPDB.getRecent(userId, days);
    
    // Group readings by week
    const weeklyData = [];
    for (let i = 0; i < weeks; i++) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - i * 7);

        const weekReadings = readings.filter(r => {
            const readingDate = new Date(r.measurement_time);
            return readingDate >= weekStart && readingDate < weekEnd;
        });

        if (weekReadings.length > 0) {
            const avgSystolic = weekReadings.reduce((sum, r) => sum + r.systolic, 0) / weekReadings.length;
            const avgDiastolic = weekReadings.reduce((sum, r) => sum + r.diastolic, 0) / weekReadings.length;

            weeklyData.push({
                week: i + 1,
                start_date: weekStart.toISOString().split('T')[0],
                end_date: weekEnd.toISOString().split('T')[0],
                readings_count: weekReadings.length,
                average_systolic: Math.round(avgSystolic),
                average_diastolic: Math.round(avgDiastolic),
                readings: weekReadings
            });
        }
    }

    return {
        type: 'weekly',
        weeks_requested: weeks,
        weeks_with_data: weeklyData.length,
        data: weeklyData.reverse() // Most recent first
    };
}

/**
 * Helper function to generate monthly report
 */
async function generateMonthlyReport(userId, months) {
    const days = months * 30;
    const readings = await BPDB.getRecent(userId, days);
    
    // Group readings by month
    const monthlyData = [];
    for (let i = 0; i < months; i++) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - (i + 1));
        monthStart.setDate(1);
        const monthEnd = new Date();
        monthEnd.setMonth(monthEnd.getMonth() - i);
        monthEnd.setDate(1);

        const monthReadings = readings.filter(r => {
            const readingDate = new Date(r.measurement_time);
            return readingDate >= monthStart && readingDate < monthEnd;
        });

        if (monthReadings.length > 0) {
            const avgSystolic = monthReadings.reduce((sum, r) => sum + r.systolic, 0) / monthReadings.length;
            const avgDiastolic = monthReadings.reduce((sum, r) => sum + r.diastolic, 0) / monthReadings.length;

            monthlyData.push({
                month: i + 1,
                start_date: monthStart.toISOString().split('T')[0],
                end_date: monthEnd.toISOString().split('T')[0],
                readings_count: monthReadings.length,
                average_systolic: Math.round(avgSystolic),
                average_diastolic: Math.round(avgDiastolic),
                categories: calculateCategoryDistribution(monthReadings),
                readings: monthReadings
            });
        }
    }

    return {
        type: 'monthly',
        months_requested: months,
        months_with_data: monthlyData.length,
        data: monthlyData.reverse() // Most recent first
    };
}

export default router;
