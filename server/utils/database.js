import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const DB_PATH = path.join(__dirname, '../data/bp_monitor.db');
const db = new sqlite3.Database(DB_PATH);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

/**
 * Initialize database with required tables
 */
export async function initializeDatabase() {
    try {
        // Create data directory if it doesn't exist
        const fs = await import('fs');
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Users table for multi-user support
        await dbRun(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                birth_date DATE,
                gender TEXT CHECK(gender IN ('male', 'female', 'other')),
                emergency_contact TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Blood pressure readings table
        await dbRun(`
            CREATE TABLE IF NOT EXISTS bp_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                systolic INTEGER NOT NULL CHECK(systolic > 0 AND systolic < 300),
                diastolic INTEGER NOT NULL CHECK(diastolic > 0 AND diastolic < 200),
                pulse INTEGER CHECK(pulse > 0 AND pulse < 250),
                measurement_time DATETIME NOT NULL,
                entry_method TEXT CHECK(entry_method IN ('manual', 'photo', 'voice', 'bluetooth')),
                notes TEXT,
                is_validated BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        `);

        // AI analysis results table
        await dbRun(`
            CREATE TABLE IF NOT EXISTS ai_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reading_id INTEGER NOT NULL,
                analysis_type TEXT NOT NULL,
                confidence_score REAL,
                raw_data TEXT,
                processed_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reading_id) REFERENCES bp_readings (id)
            )
        `);

        // Alerts and notifications table
        await dbRun(`
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                reading_id INTEGER,
                alert_type TEXT NOT NULL,
                severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
                message TEXT NOT NULL,
                is_acknowledged BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id),
                FOREIGN KEY (reading_id) REFERENCES bp_readings (id)
            )
        `);

        // User preferences table
        await dbRun(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                font_size TEXT DEFAULT 'large',
                high_contrast BOOLEAN DEFAULT 1,
                voice_feedback BOOLEAN DEFAULT 1,
                reminder_frequency INTEGER DEFAULT 24,
                target_systolic_min INTEGER DEFAULT 90,
                target_systolic_max INTEGER DEFAULT 140,
                target_diastolic_min INTEGER DEFAULT 60,
                target_diastolic_max INTEGER DEFAULT 90,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        `);

        // Create indexes for better performance
        await dbRun('CREATE INDEX IF NOT EXISTS idx_bp_readings_user_time ON bp_readings(user_id, measurement_time)');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, created_at)');

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

/**
 * User management functions
 */
export const UserDB = {
    async create(userData) {
        const { user_id, name, birth_date, gender, emergency_contact } = userData;
        const result = await dbRun(
            'INSERT INTO users (user_id, name, birth_date, gender, emergency_contact) VALUES (?, ?, ?, ?, ?)',
            [user_id, name, birth_date, gender, emergency_contact]
        );
        return result.lastID;
    },

    async findByUserId(user_id) {
        return await dbGet('SELECT * FROM users WHERE user_id = ?', [user_id]);
    },

    async getAll() {
        return await dbAll('SELECT user_id, name, created_at FROM users ORDER BY name');
    },

    async update(user_id, userData) {
        const fields = Object.keys(userData).map(key => `${key} = ?`).join(', ');
        const values = Object.values(userData);
        values.push(user_id);
        
        await dbRun(
            `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            values
        );
    }
};

/**
 * Blood pressure readings functions
 */
export const BPDB = {
    async create(readingData) {
        const { user_id, systolic, diastolic, pulse, measurement_time, entry_method, notes } = readingData;
        const result = await dbRun(
            'INSERT INTO bp_readings (user_id, systolic, diastolic, pulse, measurement_time, entry_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, systolic, diastolic, pulse, measurement_time, entry_method, notes]
        );
        return result.lastID;
    },

    async getByUser(user_id, limit = 50, offset = 0) {
        return await dbAll(
            'SELECT * FROM bp_readings WHERE user_id = ? ORDER BY measurement_time DESC LIMIT ? OFFSET ?',
            [user_id, limit, offset]
        );
    },

    async getRecent(user_id, days = 7) {
        return await dbAll(
            `SELECT * FROM bp_readings 
             WHERE user_id = ? AND measurement_time >= datetime('now', '-${days} days')
             ORDER BY measurement_time DESC`,
            [user_id]
        );
    },

    async getStats(user_id, days = 30) {
        return await dbGet(
            `SELECT 
                COUNT(*) as total_readings,
                AVG(systolic) as avg_systolic,
                AVG(diastolic) as avg_diastolic,
                AVG(pulse) as avg_pulse,
                MIN(systolic) as min_systolic,
                MAX(systolic) as max_systolic,
                MIN(diastolic) as min_diastolic,
                MAX(diastolic) as max_diastolic
             FROM bp_readings 
             WHERE user_id = ? AND measurement_time >= datetime('now', '-${days} days')`,
            [user_id]
        );
    }
};

/**
 * Alerts functions
 */
export const AlertDB = {
    async create(alertData) {
        const { user_id, reading_id, alert_type, severity, message } = alertData;
        const result = await dbRun(
            'INSERT INTO alerts (user_id, reading_id, alert_type, severity, message) VALUES (?, ?, ?, ?, ?)',
            [user_id, reading_id, alert_type, severity, message]
        );
        return result.lastID;
    },

    async getUnacknowledged(user_id) {
        return await dbAll(
            'SELECT * FROM alerts WHERE user_id = ? AND is_acknowledged = 0 ORDER BY created_at DESC',
            [user_id]
        );
    },

    async acknowledge(alert_id) {
        await dbRun('UPDATE alerts SET is_acknowledged = 1 WHERE id = ?', [alert_id]);
    }
};

/**
 * User preferences functions
 */
export const PreferencesDB = {
    async get(user_id) {
        let prefs = await dbGet('SELECT * FROM user_preferences WHERE user_id = ?', [user_id]);
        if (!prefs) {
            // Create default preferences
            await dbRun('INSERT INTO user_preferences (user_id) VALUES (?)', [user_id]);
            prefs = await dbGet('SELECT * FROM user_preferences WHERE user_id = ?', [user_id]);
        }
        return prefs;
    },

    async update(user_id, preferences) {
        const fields = Object.keys(preferences).map(key => `${key} = ?`).join(', ');
        const values = Object.values(preferences);
        values.push(user_id);
        
        await dbRun(
            `UPDATE user_preferences SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            values
        );
    }
};

export { db };
