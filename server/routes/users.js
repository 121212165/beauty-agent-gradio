import express from 'express';
import { UserDB, PreferencesDB, AlertDB } from '../utils/database.js';

const router = express.Router();

/**
 * Create a new user
 */
router.post('/create', async (req, res) => {
    try {
        const { user_id, name, birth_date, gender, emergency_contact } = req.body;

        // Validate required fields
        if (!user_id || !name) {
            return res.status(400).json({ 
                error: 'Missing required fields: user_id and name are required' 
            });
        }

        // Check if user already exists
        const existingUser = await UserDB.findByUserId(user_id);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Validate user_id format (simple alphanumeric for elderly users)
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(user_id)) {
            return res.status(400).json({ 
                error: 'User ID must be 3-20 characters long and contain only letters, numbers, hyphens, and underscores' 
            });
        }

        // Create user
        const userId = await UserDB.create({
            user_id,
            name,
            birth_date: birth_date || null,
            gender: gender || null,
            emergency_contact: emergency_contact || null
        });

        // Create default preferences
        await PreferencesDB.update(user_id, {});

        res.json({
            success: true,
            data: {
                id: userId,
                user_id,
                name,
                message: 'User created successfully'
            }
        });

    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get user information
 */
router.get('/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user preferences
        const preferences = await PreferencesDB.get(user_id);

        // Get unacknowledged alerts
        const alerts = await AlertDB.getUnacknowledged(user_id);

        // Calculate age if birth_date is available
        let age = null;
        if (user.birth_date) {
            const birthDate = new Date(user.birth_date);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        res.json({
            success: true,
            data: {
                user: {
                    ...user,
                    age
                },
                preferences,
                unacknowledged_alerts: alerts.length,
                alerts: alerts.slice(0, 5) // Return only the 5 most recent alerts
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update user information
 */
router.put('/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { name, birth_date, gender, emergency_contact } = req.body;

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare update data (only include provided fields)
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (birth_date !== undefined) updateData.birth_date = birth_date;
        if (gender !== undefined) updateData.gender = gender;
        if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Update user
        await UserDB.update(user_id, updateData);

        // Get updated user data
        const updatedUser = await UserDB.findByUserId(user_id);

        res.json({
            success: true,
            data: {
                user: updatedUser,
                message: 'User updated successfully'
            }
        });

    } catch (error) {
        console.error('User update error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all users (for multi-user support)
 */
router.get('/', async (req, res) => {
    try {
        const users = await UserDB.getAll();

        res.json({
            success: true,
            data: {
                users,
                count: users.length
            }
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get user preferences
 */
router.get('/:user_id/preferences', async (req, res) => {
    try {
        const { user_id } = req.params;

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const preferences = await PreferencesDB.get(user_id);

        res.json({
            success: true,
            data: {
                preferences
            }
        });

    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update user preferences
 */
router.put('/:user_id/preferences', async (req, res) => {
    try {
        const { user_id } = req.params;
        const preferences = req.body;

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate preference values
        const validPreferences = {};
        
        if (preferences.font_size !== undefined) {
            if (['small', 'medium', 'large', 'extra-large'].includes(preferences.font_size)) {
                validPreferences.font_size = preferences.font_size;
            }
        }
        
        if (preferences.high_contrast !== undefined) {
            validPreferences.high_contrast = Boolean(preferences.high_contrast);
        }
        
        if (preferences.voice_feedback !== undefined) {
            validPreferences.voice_feedback = Boolean(preferences.voice_feedback);
        }
        
        if (preferences.reminder_frequency !== undefined) {
            const freq = parseInt(preferences.reminder_frequency);
            if (freq >= 1 && freq <= 168) { // 1 hour to 1 week
                validPreferences.reminder_frequency = freq;
            }
        }

        // Blood pressure target ranges
        if (preferences.target_systolic_min !== undefined) {
            const val = parseInt(preferences.target_systolic_min);
            if (val >= 80 && val <= 200) {
                validPreferences.target_systolic_min = val;
            }
        }
        
        if (preferences.target_systolic_max !== undefined) {
            const val = parseInt(preferences.target_systolic_max);
            if (val >= 90 && val <= 220) {
                validPreferences.target_systolic_max = val;
            }
        }
        
        if (preferences.target_diastolic_min !== undefined) {
            const val = parseInt(preferences.target_diastolic_min);
            if (val >= 50 && val <= 120) {
                validPreferences.target_diastolic_min = val;
            }
        }
        
        if (preferences.target_diastolic_max !== undefined) {
            const val = parseInt(preferences.target_diastolic_max);
            if (val >= 60 && val <= 130) {
                validPreferences.target_diastolic_max = val;
            }
        }

        if (Object.keys(validPreferences).length === 0) {
            return res.status(400).json({ error: 'No valid preferences to update' });
        }

        // Update preferences
        await PreferencesDB.update(user_id, validPreferences);

        // Get updated preferences
        const updatedPreferences = await PreferencesDB.get(user_id);

        res.json({
            success: true,
            data: {
                preferences: updatedPreferences,
                message: 'Preferences updated successfully'
            }
        });

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get user alerts
 */
router.get('/:user_id/alerts', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { unacknowledged_only = 'false' } = req.query;

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let alerts;
        if (unacknowledged_only === 'true') {
            alerts = await AlertDB.getUnacknowledged(user_id);
        } else {
            // For now, just get unacknowledged alerts
            // Could be extended to get all alerts with pagination
            alerts = await AlertDB.getUnacknowledged(user_id);
        }

        res.json({
            success: true,
            data: {
                alerts,
                count: alerts.length
            }
        });

    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Acknowledge an alert
 */
router.put('/:user_id/alerts/:alert_id/acknowledge', async (req, res) => {
    try {
        const { user_id, alert_id } = req.params;

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Acknowledge the alert
        await AlertDB.acknowledge(parseInt(alert_id));

        res.json({
            success: true,
            data: {
                message: 'Alert acknowledged successfully'
            }
        });

    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * User switching endpoint for shared devices
 */
router.post('/switch', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Check if user exists
        const user = await UserDB.findByUserId(user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user preferences and alerts
        const preferences = await PreferencesDB.get(user_id);
        const alerts = await AlertDB.getUnacknowledged(user_id);

        res.json({
            success: true,
            data: {
                user,
                preferences,
                unacknowledged_alerts: alerts.length,
                message: `Switched to user: ${user.name}`
            }
        });

    } catch (error) {
        console.error('User switch error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
