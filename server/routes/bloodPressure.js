import express from 'express';
import multer from 'multer';
import { BPDB, UserDB } from '../utils/database.js';
import OCRService from '../utils/ocrService.js';
import VoiceService from '../utils/voiceService.js';
import AIValidationService from '../utils/aiValidationService.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

/**
 * Manual blood pressure entry
 */
router.post('/manual', async (req, res) => {
    try {
        const { user_id, systolic, diastolic, pulse, notes } = req.body;

        // Validate required fields
        if (!user_id || !systolic || !diastolic) {
            return res.status(400).json({ 
                error: 'Missing required fields: user_id, systolic, diastolic' 
            });
        }

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create reading object
        const reading = {
            user_id,
            systolic: parseInt(systolic),
            diastolic: parseInt(diastolic),
            pulse: pulse ? parseInt(pulse) : null,
            measurement_time: new Date().toISOString(),
            entry_method: 'manual',
            notes: notes || null
        };

        // Perform AI validation and analysis
        const aiValidation = new AIValidationService();
        const analysis = await aiValidation.performCompleteAnalysis(user_id, reading, {
            age: user.birth_date ? new Date().getFullYear() - new Date(user.birth_date).getFullYear() : null
        });

        // Save reading to database
        const readingId = await BPDB.create(reading);

        res.json({
            success: true,
            data: {
                reading_id: readingId,
                reading,
                analysis
            }
        });

    } catch (error) {
        console.error('Manual BP entry error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Photo-based blood pressure entry using OCR
 */
router.post('/photo', upload.single('image'), async (req, res) => {
    try {
        const { user_id, notes } = req.body;
        const imageFile = req.file;

        if (!user_id) {
            return res.status(400).json({ error: 'Missing user_id' });
        }

        if (!imageFile) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Process image with OCR
        const ocrResult = await OCRService.processBPImage(imageFile.buffer);

        if (!ocrResult.success || ocrResult.readings.length === 0) {
            return res.status(400).json({
                error: 'Could not extract blood pressure reading from image',
                details: ocrResult.error || 'No valid readings found',
                rawText: ocrResult.rawText,
                suggestions: [
                    'Ensure the display is clearly visible and well-lit',
                    'Make sure numbers are not blurry or cut off',
                    'Try taking the photo from directly in front of the display'
                ]
            });
        }

        // Use the best reading (highest confidence)
        const bestReading = ocrResult.readings.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );

        // Create reading object
        const reading = {
            user_id,
            systolic: bestReading.systolic,
            diastolic: bestReading.diastolic,
            pulse: bestReading.pulse || null,
            measurement_time: new Date().toISOString(),
            entry_method: 'photo',
            notes: notes || null
        };

        // Perform AI validation and analysis
        const aiValidation = new AIValidationService();
        const analysis = await aiValidation.performCompleteAnalysis(user_id, reading, {
            age: user.birth_date ? new Date().getFullYear() - new Date(user.birth_date).getFullYear() : null
        });

        // Save reading to database
        const readingId = await BPDB.create(reading);

        res.json({
            success: true,
            data: {
                reading_id: readingId,
                reading,
                analysis,
                ocr_details: {
                    confidence: bestReading.confidence,
                    raw_text: ocrResult.rawText,
                    all_readings: ocrResult.readings
                }
            }
        });

    } catch (error) {
        console.error('Photo BP entry error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Voice-based blood pressure entry
 */
router.post('/voice', upload.single('audio'), async (req, res) => {
    try {
        const { user_id, notes } = req.body;
        const audioFile = req.file;

        if (!user_id) {
            return res.status(400).json({ error: 'Missing user_id' });
        }

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Process audio with voice recognition
        const voiceService = new VoiceService();
        const voiceResult = await voiceService.processVoiceInput(
            audioFile.buffer, 
            audioFile.mimetype.split('/')[1]
        );

        if (!voiceResult.success || voiceResult.readings.length === 0) {
            return res.status(400).json({
                error: 'Could not extract blood pressure reading from voice',
                details: voiceResult.error || 'No valid readings found',
                transcription: voiceResult.transcription,
                suggestions: [
                    'Speak clearly and slowly',
                    'Use phrases like "120 over 80" or "systolic 120 diastolic 80"',
                    'Ensure you are in a quiet environment'
                ]
            });
        }

        // Use the best reading (highest confidence)
        const bestReading = voiceResult.readings.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );

        // Create reading object
        const reading = {
            user_id,
            systolic: bestReading.systolic,
            diastolic: bestReading.diastolic,
            pulse: bestReading.pulse || null,
            measurement_time: new Date().toISOString(),
            entry_method: 'voice',
            notes: notes || null
        };

        // Perform AI validation and analysis
        const aiValidation = new AIValidationService();
        const analysis = await aiValidation.performCompleteAnalysis(user_id, reading, {
            age: user.birth_date ? new Date().getFullYear() - new Date(user.birth_date).getFullYear() : null
        });

        // Save reading to database
        const readingId = await BPDB.create(reading);

        res.json({
            success: true,
            data: {
                reading_id: readingId,
                reading,
                analysis,
                voice_details: {
                    confidence: bestReading.confidence,
                    transcription: voiceResult.transcription,
                    all_readings: voiceResult.readings
                }
            }
        });

    } catch (error) {
        console.error('Voice BP entry error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get blood pressure readings for a user
 */
router.get('/readings/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { limit = 50, offset = 0, days } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let readings;
        if (days) {
            readings = await BPDB.getRecent(user_id, parseInt(days));
        } else {
            readings = await BPDB.getByUser(user_id, parseInt(limit), parseInt(offset));
        }

        res.json({
            success: true,
            data: {
                readings,
                user_info: {
                    user_id: user.user_id,
                    name: user.name
                }
            }
        });

    } catch (error) {
        console.error('Get readings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get blood pressure statistics for a user
 */
router.get('/stats/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { days = 30 } = req.query;

        // Validate user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await BPDB.getStats(user_id, parseInt(days));
        const recentReadings = await BPDB.getRecent(user_id, parseInt(days));

        // Calculate additional statistics
        const categoryStats = calculateCategoryStats(recentReadings);
        const trendAnalysis = calculateTrendAnalysis(recentReadings);

        res.json({
            success: true,
            data: {
                period_days: parseInt(days),
                basic_stats: stats,
                category_distribution: categoryStats,
                trend_analysis: trendAnalysis,
                user_info: {
                    user_id: user.user_id,
                    name: user.name
                }
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper function to calculate BP category statistics
 */
function calculateCategoryStats(readings) {
    const categories = {
        normal: 0,
        elevated: 0,
        stage1: 0,
        stage2: 0,
        crisis: 0
    };

    readings.forEach(reading => {
        const { systolic, diastolic } = reading;
        
        if (systolic < 120 && diastolic < 80) {
            categories.normal++;
        } else if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
            categories.elevated++;
        } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
            categories.stage1++;
        } else if (systolic >= 140 || diastolic >= 90) {
            categories.stage2++;
        } else if (systolic > 180 || diastolic > 120) {
            categories.crisis++;
        }
    });

    return categories;
}

/**
 * Helper function to calculate trend analysis
 */
function calculateTrendAnalysis(readings) {
    if (readings.length < 2) {
        return { trend: 'insufficient_data' };
    }

    const sortedReadings = readings.sort((a, b) => new Date(a.measurement_time) - new Date(b.measurement_time));
    const firstHalf = sortedReadings.slice(0, Math.floor(sortedReadings.length / 2));
    const secondHalf = sortedReadings.slice(Math.floor(sortedReadings.length / 2));

    const firstAvgSys = firstHalf.reduce((sum, r) => sum + r.systolic, 0) / firstHalf.length;
    const secondAvgSys = secondHalf.reduce((sum, r) => sum + r.systolic, 0) / secondHalf.length;
    
    const firstAvgDia = firstHalf.reduce((sum, r) => sum + r.diastolic, 0) / firstHalf.length;
    const secondAvgDia = secondHalf.reduce((sum, r) => sum + r.diastolic, 0) / secondHalf.length;

    const sysChange = secondAvgSys - firstAvgSys;
    const diaChange = secondAvgDia - firstAvgDia;

    let trend = 'stable';
    if (sysChange > 5 || diaChange > 3) {
        trend = 'increasing';
    } else if (sysChange < -5 || diaChange < -3) {
        trend = 'decreasing';
    }

    return {
        trend,
        systolic_change: Math.round(sysChange),
        diastolic_change: Math.round(diaChange),
        first_period_avg: {
            systolic: Math.round(firstAvgSys),
            diastolic: Math.round(firstAvgDia)
        },
        second_period_avg: {
            systolic: Math.round(secondAvgSys),
            diastolic: Math.round(secondAvgDia)
        }
    };
}

export default router;
