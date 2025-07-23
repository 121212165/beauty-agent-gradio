import OpenAI from 'openai';

/**
 * Voice Recognition Service for converting spoken BP readings to digital records
 * Handles natural language input like "120 over 80, pulse 75"
 */
export class VoiceService {
    
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
        });
    }

    /**
     * Convert audio buffer to text using OpenAI Whisper
     */
    async speechToText(audioBuffer, audioFormat = 'webm') {
        try {
            console.log('Converting speech to text...');
            
            // Create a temporary file-like object for the API
            const audioFile = new File([audioBuffer], `audio.${audioFormat}`, {
                type: `audio/${audioFormat}`
            });

            const transcription = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1",
                language: "en", // Support for English primarily, can be extended
                prompt: "Blood pressure reading with systolic, diastolic, and pulse values"
            });

            return {
                success: true,
                text: transcription.text,
                confidence: 0.9, // Whisper generally has high accuracy
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Speech to text error:', error);
            return {
                success: false,
                error: error.message,
                text: '',
                confidence: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parse blood pressure values from transcribed text
     */
    static parseBPFromText(text) {
        const normalizedText = text.toLowerCase().trim();
        console.log('Parsing BP from text:', normalizedText);

        const results = [];

        // Common spoken patterns for blood pressure
        const patterns = [
            // "120 over 80" or "120 over 80 pulse 75"
            /(\d{2,3})\s+over\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // "120 slash 80" or "120 slash 80 pulse 75"
            /(\d{2,3})\s+slash\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // "systolic 120 diastolic 80" or with pulse
            /systolic\s+(\d{2,3})\s+diastolic\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // "120 by 80" or "120 by 80 pulse 75"
            /(\d{2,3})\s+by\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // "top 120 bottom 80" or with pulse
            /top\s+(\d{2,3})\s+bottom\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // "120 and 80" or "120 and 80 pulse 75"
            /(\d{2,3})\s+and\s+(\d{2,3})(?:\s+pulse\s+(\d{2,3}))?/gi,
            
            // Simple number sequence "120 80 75"
            /(\d{2,3})\s+(\d{2,3})(?:\s+(\d{2,3}))?/g
        ];

        // Heart rate/pulse specific patterns
        const pulsePatterns = [
            /heart\s+rate\s+(\d{2,3})/gi,
            /pulse\s+(\d{2,3})/gi,
            /beats\s+per\s+minute\s+(\d{2,3})/gi,
            /bpm\s+(\d{2,3})/gi,
            /(\d{2,3})\s+beats/gi
        ];

        // Try each pattern
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(normalizedText)) !== null) {
                const systolic = parseInt(match[1]);
                const diastolic = parseInt(match[2]);
                const pulse = match[3] ? parseInt(match[3]) : null;
                
                if (this.isValidBPReading(systolic, diastolic)) {
                    const reading = {
                        systolic,
                        diastolic,
                        confidence: this.calculateTextConfidence(normalizedText, systolic, diastolic),
                        source: 'voice',
                        originalText: match[0]
                    };
                    
                    if (pulse && this.isValidPulse(pulse)) {
                        reading.pulse = pulse;
                    }
                    
                    results.push(reading);
                }
            }
        }

        // If no BP found but pulse mentioned, try to extract pulse separately
        if (results.length === 0) {
            for (const pattern of pulsePatterns) {
                let match;
                while ((match = pattern.exec(normalizedText)) !== null) {
                    const pulse = parseInt(match[1]);
                    if (this.isValidPulse(pulse)) {
                        results.push({
                            pulse,
                            confidence: 0.7,
                            source: 'voice',
                            originalText: match[0],
                            note: 'Pulse only - no BP reading detected'
                        });
                    }
                }
            }
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
            (systolic - diastolic) >= 15 &&
            (systolic - diastolic) <= 120
        );
    }

    /**
     * Validate pulse reading
     */
    static isValidPulse(pulse) {
        return pulse >= 30 && pulse <= 200;
    }

    /**
     * Calculate confidence based on text patterns and context
     */
    static calculateTextConfidence(text, systolic, diastolic) {
        let confidence = 0.6; // Base confidence for voice recognition
        
        // Higher confidence for explicit BP terminology
        if (text.includes('over') || text.includes('systolic') || text.includes('diastolic')) {
            confidence += 0.2;
        }
        
        // Normal ranges increase confidence
        if (systolic >= 90 && systolic <= 180 && diastolic >= 60 && diastolic <= 110) {
            confidence += 0.15;
        }
        
        // Typical pulse pressure increases confidence
        const pulsePressure = systolic - diastolic;
        if (pulsePressure >= 25 && pulsePressure <= 70) {
            confidence += 0.05;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Main function to process voice input
     */
    async processVoiceInput(audioBuffer, audioFormat = 'webm') {
        try {
            console.log('Processing voice input for BP reading...');
            
            // Convert speech to text
            const transcriptionResult = await this.speechToText(audioBuffer, audioFormat);
            
            if (!transcriptionResult.success) {
                return {
                    success: false,
                    error: 'Failed to transcribe audio',
                    readings: [],
                    timestamp: new Date().toISOString()
                };
            }

            // Parse BP values from text
            const parseResult = VoiceService.parseBPFromText(transcriptionResult.text);
            
            // Combine results
            const result = {
                success: parseResult.hasValidReading,
                transcription: transcriptionResult.text,
                confidence: transcriptionResult.confidence,
                readings: parseResult.readings,
                rawText: parseResult.rawText,
                timestamp: new Date().toISOString()
            };

            console.log('Voice processing completed:', result);
            return result;
            
        } catch (error) {
            console.error('Voice input processing error:', error);
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
     * Generate voice feedback for confirmation
     */
    static generateConfirmationText(reading) {
        const { systolic, diastolic, pulse } = reading;
        
        let confirmation = `I heard your blood pressure as ${systolic} over ${diastolic}`;
        
        if (pulse) {
            confirmation += ` with a pulse of ${pulse}`;
        }
        
        confirmation += '. Is this correct?';
        
        return confirmation;
    }

    /**
     * Provide voice prompts for elderly users
     */
    static getVoicePrompts() {
        return {
            start: "Please say your blood pressure reading. For example, say '120 over 80' or '120 over 80 pulse 75'",
            retry: "I didn't catch that. Please speak clearly and say your blood pressure reading again.",
            confirm: "Please confirm if this reading is correct by saying 'yes' or 'no'",
            success: "Thank you! Your blood pressure reading has been recorded.",
            error: "I'm having trouble understanding. You can try again or use manual entry."
        };
    }

    /**
     * Get supported voice commands and phrases
     */
    static getSupportedPhrases() {
        return [
            "120 over 80",
            "120 over 80 pulse 75",
            "systolic 120 diastolic 80",
            "top number 120 bottom number 80",
            "120 slash 80",
            "120 by 80",
            "blood pressure 120 over 80",
            "my reading is 120 over 80"
        ];
    }
}

export default VoiceService;
