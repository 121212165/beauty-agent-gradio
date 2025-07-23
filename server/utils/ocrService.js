import Tesseract from 'tesseract.js';
import sharp from 'sharp';

/**
 * OCR Service for extracting blood pressure readings from images
 * Supports various blood pressure monitor display formats
 */
export class OCRService {
    
    /**
     * Preprocess image for better OCR accuracy
     */
    static async preprocessImage(imageBuffer) {
        try {
            const processedImage = await sharp(imageBuffer)
                .resize(800, 600, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .greyscale()
                .normalize()
                .sharpen()
                .threshold(128)
                .png()
                .toBuffer();
            
            return processedImage;
        } catch (error) {
            console.error('Image preprocessing error:', error);
            throw new Error('Failed to preprocess image');
        }
    }

    /**
     * Extract text from blood pressure monitor display
     */
    static async extractText(imageBuffer) {
        try {
            const preprocessedImage = await this.preprocessImage(imageBuffer);
            
            const { data: { text, confidence } } = await Tesseract.recognize(
                preprocessedImage,
                'eng',
                {
                    logger: m => console.log(m),
                    tessedit_char_whitelist: '0123456789/',
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
                }
            );

            return {
                text: text.trim(),
                confidence,
                preprocessed: true
            };
        } catch (error) {
            console.error('OCR extraction error:', error);
            throw new Error('Failed to extract text from image');
        }
    }

    /**
     * Parse blood pressure values from extracted text
     */
    static parseBPValues(text) {
        const results = [];
        
        // Common BP display patterns
        const patterns = [
            // Standard format: 120/80
            /(\d{2,3})\s*\/\s*(\d{2,3})/g,
            // Spaced format: 120 / 80
            /(\d{2,3})\s+\/\s+(\d{2,3})/g,
            // Line format: SYS 120 DIA 80
            /SYS\s*(\d{2,3})\s*DIA\s*(\d{2,3})/gi,
            // Vertical format: 120 over 80
            /(\d{2,3})\s+over\s+(\d{2,3})/gi,
            // Digital display: 120-80
            /(\d{2,3})\s*-\s*(\d{2,3})/g,
            // Two line format: 120\n80
            /(\d{2,3})\s*\n\s*(\d{2,3})/g
        ];

        // Pulse patterns
        const pulsePatterns = [
            /PULSE\s*(\d{2,3})/gi,
            /HR\s*(\d{2,3})/gi,
            /BPM\s*(\d{2,3})/gi,
            /P\s*(\d{2,3})/gi
        ];

        // Extract BP values
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const systolic = parseInt(match[1]);
                const diastolic = parseInt(match[2]);
                
                if (this.isValidBPReading(systolic, diastolic)) {
                    results.push({
                        systolic,
                        diastolic,
                        confidence: this.calculateConfidence(systolic, diastolic),
                        source: 'ocr'
                    });
                }
            }
        }

        // Extract pulse values
        const pulseValues = [];
        for (const pattern of pulsePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const pulse = parseInt(match[1]);
                if (pulse >= 30 && pulse <= 200) {
                    pulseValues.push(pulse);
                }
            }
        }

        // Combine BP and pulse readings
        if (results.length > 0 && pulseValues.length > 0) {
            results[0].pulse = pulseValues[0];
        }

        return {
            readings: results,
            rawText: text,
            hasValidReading: results.length > 0
        };
    }

    /**
     * Validate blood pressure reading ranges
     */
    static isValidBPReading(systolic, diastolic) {
        return (
            systolic >= 70 && systolic <= 250 &&
            diastolic >= 40 && diastolic <= 150 &&
            systolic > diastolic &&
            (systolic - diastolic) >= 20 &&
            (systolic - diastolic) <= 100
        );
    }

    /**
     * Calculate confidence score based on reading validity
     */
    static calculateConfidence(systolic, diastolic) {
        let confidence = 0.5; // Base confidence
        
        // Normal ranges increase confidence
        if (systolic >= 90 && systolic <= 180 && diastolic >= 60 && diastolic <= 110) {
            confidence += 0.3;
        }
        
        // Typical pulse pressure increases confidence
        const pulsePressure = systolic - diastolic;
        if (pulsePressure >= 30 && pulsePressure <= 60) {
            confidence += 0.2;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Main function to process BP monitor image
     */
    static async processBPImage(imageBuffer) {
        try {
            console.log('Starting OCR processing for BP image...');
            
            // Extract text from image
            const ocrResult = await this.extractText(imageBuffer);
            
            // Parse BP values
            const parseResult = this.parseBPValues(ocrResult.text);
            
            // Combine results
            const result = {
                success: parseResult.hasValidReading,
                confidence: ocrResult.confidence,
                readings: parseResult.readings,
                rawText: parseResult.rawText,
                processedText: ocrResult.text,
                timestamp: new Date().toISOString()
            };

            console.log('OCR processing completed:', result);
            return result;
            
        } catch (error) {
            console.error('BP image processing error:', error);
            return {
                success: false,
                error: error.message,
                confidence: 0,
                readings: [],
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate and suggest corrections for OCR results
     */
    static validateAndSuggest(readings) {
        const suggestions = [];
        
        for (const reading of readings) {
            const { systolic, diastolic, pulse } = reading;
            
            // Check for common OCR errors
            if (systolic < 80) {
                suggestions.push({
                    type: 'warning',
                    message: `Systolic reading ${systolic} seems low. Please verify the image quality.`,
                    suggestedValue: systolic + 100 // Common OCR error: missing digit
                });
            }
            
            if (diastolic > 120) {
                suggestions.push({
                    type: 'warning',
                    message: `Diastolic reading ${diastolic} seems high. Please verify the image quality.`,
                    suggestedValue: Math.floor(diastolic / 10) // Common OCR error: extra digit
                });
            }
            
            if (pulse && (pulse < 40 || pulse > 150)) {
                suggestions.push({
                    type: 'warning',
                    message: `Pulse reading ${pulse} is outside normal range. Please verify.`
                });
            }
            
            // Check for reversed readings
            if (systolic < diastolic) {
                suggestions.push({
                    type: 'error',
                    message: 'Systolic and diastolic values may be reversed.',
                    suggestedSystolic: diastolic,
                    suggestedDiastolic: systolic
                });
            }
        }
        
        return suggestions;
    }

    /**
     * Get supported monitor brands and their specific parsing rules
     */
    static getSupportedMonitors() {
        return [
            {
                brand: 'Omron',
                models: ['HEM-7120', 'HEM-7130', 'HEM-7156'],
                displayFormat: 'Standard digital with SYS/DIA labels'
            },
            {
                brand: 'A&D Medical',
                models: ['UA-611', 'UA-767'],
                displayFormat: 'Large numbers with slash separator'
            },
            {
                brand: 'Beurer',
                models: ['BM26', 'BM27'],
                displayFormat: 'LCD with clear number separation'
            },
            {
                brand: 'Generic',
                models: ['Most digital monitors'],
                displayFormat: 'Standard XXX/XX format'
            }
        ];
    }
}

export default OCRService;
