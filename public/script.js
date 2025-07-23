// Blood Pressure Monitor - Frontend Script for Elderly Users

// Global variables
let currentUser = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let voiceFeedbackEnabled = true;
let highContrastMode = false;
let largeFontMode = false;

// Page initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Blood Pressure Monitor loaded');
    
    // Initialize default settings
    initializeApp();
    
    // Set up drag and drop for photo upload
    setupDragAndDrop();
    
    // Load users
    loadUsers();
    
    // Set default tab
    openTab(null, 'recordTab');
});

// Initialize application
function initializeApp() {
    // Check for saved preferences
    const savedPrefs = localStorage.getItem('bp_preferences');
    if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.high_contrast) toggleHighContrast();
        if (prefs.large_font) toggleLargeFont();
        if (prefs.voice_feedback !== undefined) voiceFeedbackEnabled = prefs.voice_feedback;
    }
    
    // Check for saved current user
    const savedUser = localStorage.getItem('bp_current_user');
    if (savedUser) {
        currentUser = savedUser;
        updateUserDisplay();
    }
}

// Tab switching functionality
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    
    // Hide all tab content
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }
    
    // Remove active class from all tab buttons
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    
    // Show current tab and activate button
    document.getElementById(tabName).classList.add("active");
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    } else {
        // Find and activate the correct button
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(button => {
            const buttonText = button.textContent.toLowerCase();
            if ((buttonText.includes('record') && tabName === 'recordTab') ||
                (buttonText.includes('history') && tabName === 'historyTab') ||
                (buttonText.includes('settings') && tabName === 'settingsTab')) {
                button.classList.add('active');
            }
        });
    }
    
    // Load tab-specific content
    if (tabName === 'historyTab') {
        loadHistory(7); // Load last 7 days by default
    } else if (tabName === 'settingsTab') {
        loadUserSettings();
    }
}

// User management functions
function selectUser(userId) {
    currentUser = userId;
    localStorage.setItem('bp_current_user', userId);
    updateUserDisplay();
    
    // Update active user button
    const userButtons = document.querySelectorAll('.user-btn');
    userButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(userId) || (userId === 'demo' && btn.textContent.includes('Demo'))) {
            btn.classList.add('active');
        }
    });
    
    speakText(`Switched to user ${userId}`);
}

function updateUserDisplay() {
    if (currentUser) {
        // Update any user-specific displays
        console.log(`Current user: ${currentUser}`);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                updateUserButtons(result.data.users);
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
        // Create demo user if no users exist
        updateUserButtons([]);
    }
}

function updateUserButtons(users) {
    const userButtonsContainer = document.getElementById('userButtons');
    userButtonsContainer.innerHTML = '';
    
    // Add existing users
    users.forEach(user => {
        const button = document.createElement('button');
        button.className = 'user-btn';
        button.textContent = user.name;
        button.onclick = () => selectUser(user.user_id);
        userButtonsContainer.appendChild(button);
    });
    
    // Add demo user if no users exist
    if (users.length === 0) {
        const demoButton = document.createElement('button');
        demoButton.className = 'user-btn';
        demoButton.textContent = 'Demo User';
        demoButton.onclick = () => selectUser('demo');
        userButtonsContainer.appendChild(demoButton);
    }
    
    // Add "Add New User" button
    const addButton = document.createElement('button');
    addButton.className = 'user-btn';
    addButton.textContent = '+ Add New User';
    addButton.onclick = showAddUser;
    userButtonsContainer.appendChild(addButton);
    
    // Select first user if none selected
    if (!currentUser) {
        if (users.length > 0) {
            selectUser(users[0].user_id);
        } else {
            selectUser('demo');
        }
    }
}

function showAddUser() {
    const name = prompt('Enter name for new user:');
    if (name && name.trim()) {
        const userId = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        createUser(userId, name.trim());
    }
}

async function createUser(userId, name) {
    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                name: name
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                loadUsers(); // Reload user list
                selectUser(userId);
                speakText(`User ${name} created successfully`);
            }
        } else {
            const error = await response.json();
            alert(`Error creating user: ${error.error}`);
        }
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Error creating user. Please try again.');
    }
}

// Photo upload and processing
function setupDragAndDrop() {
    const uploadArea = document.getElementById('photoUpload');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleImageFile(file);
    }
}

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    const preview = document.getElementById('imagePreview');
    const processBtn = document.getElementById('processPhotoBtn');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        processBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    speakText('Image uploaded successfully. You can now process the photo to read the blood pressure numbers.');
}

async function processPhoto() {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }
    
    const fileInput = document.getElementById('imageInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select an image first');
        return;
    }
    
    const processBtn = document.getElementById('processPhotoBtn');
    processBtn.innerHTML = '<div class="loading"></div>Reading numbers...';
    processBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('user_id', currentUser);
        
        const response = await fetch('/api/bp/photo', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayReading(result.data);
            speakText(`Blood pressure reading captured: ${result.data.reading.systolic} over ${result.data.reading.diastolic}`);
        } else {
            showError('Photo Processing Failed', result.error, result.suggestions);
        }
    } catch (error) {
        console.error('Photo processing error:', error);
        showError('Photo Processing Error', 'Failed to process the photo. Please try again.');
    } finally {
        processBtn.innerHTML = '📸 Read Numbers from Photo';
        processBtn.disabled = false;
    }
}

// Voice recording functionality
async function startVoiceRecording() {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }
    
    if (isRecording) {
        stopVoiceRecording();
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            processVoiceInput(audioBlob);
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        // Update UI
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceIndicator = document.getElementById('voiceIndicator');
        
        voiceBtn.innerHTML = '🛑 Stop Recording';
        voiceIndicator.style.display = 'block';
        
        speakText('Recording started. Please say your blood pressure reading now.');
        
        // Auto-stop after 10 seconds
        setTimeout(() => {
            if (isRecording) {
                stopVoiceRecording();
            }
        }, 10000);
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check your permissions.');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // Update UI
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceIndicator = document.getElementById('voiceIndicator');
        
        voiceBtn.innerHTML = '🎤 Start Voice Recording';
        voiceIndicator.style.display = 'none';
        
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

async function processVoiceInput(audioBlob) {
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.innerHTML = '<div class="loading"></div>Processing...';
    voiceBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('user_id', currentUser);

        const response = await fetch('/api/bp/voice', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            displayReading(result.data);
            speakText(`I heard: ${result.data.voice_details.transcription}. Blood pressure recorded as ${result.data.reading.systolic} over ${result.data.reading.diastolic}`);
        } else {
            showError('Voice Processing Failed', result.error, result.suggestions);
        }
    } catch (error) {
        console.error('Voice processing error:', error);
        showError('Voice Processing Error', 'Failed to process the voice input. Please try again.');
    } finally {
        voiceBtn.innerHTML = '🎤 Start Voice Recording';
        voiceBtn.disabled = false;
    }
}

// Manual entry functionality
async function saveManualReading() {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }

    const systolic = document.getElementById('systolic').value;
    const diastolic = document.getElementById('diastolic').value;
    const pulse = document.getElementById('pulse').value;
    const notes = document.getElementById('notes').value;

    if (!systolic || !diastolic) {
        alert('Please enter both systolic and diastolic values');
        return;
    }

    if (parseInt(systolic) <= parseInt(diastolic)) {
        alert('Systolic pressure must be higher than diastolic pressure');
        return;
    }

    try {
        const response = await fetch('/api/bp/manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser,
                systolic: parseInt(systolic),
                diastolic: parseInt(diastolic),
                pulse: pulse ? parseInt(pulse) : null,
                notes: notes || null
            })
        });

        const result = await response.json();

        if (result.success) {
            displayReading(result.data);
            clearManualInputs();
            speakText(`Blood pressure reading saved: ${systolic} over ${diastolic}`);
        } else {
            showError('Save Failed', result.error);
        }
    } catch (error) {
        console.error('Manual save error:', error);
        showError('Save Error', 'Failed to save the reading. Please try again.');
    }
}

function clearManualInputs() {
    document.getElementById('systolic').value = '';
    document.getElementById('diastolic').value = '';
    document.getElementById('pulse').value = '';
    document.getElementById('notes').value = '';
}

// Display reading results
function displayReading(data) {
    const resultsSection = document.getElementById('resultsSection');
    const readingDisplay = document.getElementById('readingDisplay');
    const analysisResults = document.getElementById('analysisResults');

    // Show results section
    resultsSection.style.display = 'block';

    // Display the reading
    const reading = data.reading;
    readingDisplay.innerHTML = `
        <div class="bp-value">${reading.systolic}/${reading.diastolic}</div>
        ${reading.pulse ? `<div class="pulse-value">Pulse: ${reading.pulse} BPM</div>` : ''}
        <div style="font-size: 1em; margin-top: 10px;">
            Recorded: ${new Date(reading.measurement_time).toLocaleString()}
        </div>
    `;

    // Display analysis
    const analysis = data.analysis;
    let analysisHTML = '';

    if (analysis.validation) {
        const validation = analysis.validation;
        const alertClass = validation.severity === 'critical' ? 'alert-danger' :
                          validation.severity === 'high' ? 'alert-danger' :
                          validation.severity === 'medium' ? 'alert-warning' : 'alert-success';

        analysisHTML += `
            <div class="alert ${alertClass}">
                <strong>Category:</strong> ${validation.category}<br>
                ${validation.warnings.length > 0 ? `<strong>Warnings:</strong> ${validation.warnings.join(', ')}<br>` : ''}
                ${validation.recommendations.length > 0 ? `<strong>Recommendations:</strong> ${validation.recommendations.join(', ')}` : ''}
            </div>
        `;
    }

    if (analysis.insights) {
        analysisHTML += `
            <div class="section">
                <h3>Health Insights</h3>
                <p>${analysis.insights}</p>
            </div>
        `;
    }

    if (analysis.alerts && analysis.alerts.length > 0) {
        analysisHTML += `
            <div class="section">
                <h3>Alerts</h3>
                ${analysis.alerts.map(alert => `
                    <div class="alert alert-${alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'danger' : 'warning'}">
                        ${alert.message}
                    </div>
                `).join('')}
            </div>
        `;
    }

    analysisResults.innerHTML = analysisHTML;

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Error display
function showError(title, message, suggestions = []) {
    const resultsSection = document.getElementById('resultsSection');
    const readingDisplay = document.getElementById('readingDisplay');
    const analysisResults = document.getElementById('analysisResults');

    resultsSection.style.display = 'block';

    readingDisplay.innerHTML = `
        <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 10px;">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;

    if (suggestions.length > 0) {
        analysisResults.innerHTML = `
            <div class="section">
                <h3>Suggestions:</h3>
                <ul>
                    ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        analysisResults.innerHTML = '';
    }

    speakText(`Error: ${title}. ${message}`);
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// History functionality
async function loadHistory(days) {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }

    const historyResults = document.getElementById('historyResults');
    historyResults.innerHTML = '<div class="loading"></div>Loading history...';

    try {
        const response = await fetch(`/api/bp/readings/${currentUser}?days=${days}`);
        const result = await response.json();

        if (result.success) {
            displayHistory(result.data.readings, days);
        } else {
            historyResults.innerHTML = `<div class="alert alert-warning">No readings found for the last ${days} days</div>`;
        }
    } catch (error) {
        console.error('History loading error:', error);
        historyResults.innerHTML = '<div class="alert alert-danger">Failed to load history</div>';
    }
}

function displayHistory(readings, days) {
    const historyResults = document.getElementById('historyResults');

    if (readings.length === 0) {
        historyResults.innerHTML = `<div class="alert alert-warning">No readings found for the last ${days} days</div>`;
        return;
    }

    let html = `<h3>Last ${days} Days (${readings.length} readings)</h3>`;
    html += '<div style="max-height: 400px; overflow-y: auto;">';

    readings.forEach(reading => {
        const date = new Date(reading.measurement_time);
        const category = getBPCategory(reading.systolic, reading.diastolic);
        const categoryClass = category.includes('Normal') ? 'alert-success' :
                            category.includes('Elevated') ? 'alert-warning' :
                            category.includes('Stage 1') ? 'alert-warning' :
                            'alert-danger';

        html += `
            <div class="alert ${categoryClass}" style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${reading.systolic}/${reading.diastolic}</strong>
                        ${reading.pulse ? ` (${reading.pulse} BPM)` : ''}
                        <br>
                        <small>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</small>
                        <br>
                        <small>Method: ${reading.entry_method}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong>${category}</strong>
                        ${reading.notes ? `<br><small>${reading.notes}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    historyResults.innerHTML = html;
}

function getBPCategory(systolic, diastolic) {
    if (systolic < 120 && diastolic < 80) return 'Normal';
    if (systolic >= 120 && systolic <= 129 && diastolic < 80) return 'Elevated';
    if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return 'High BP Stage 1';
    if (systolic >= 140 || diastolic >= 90) return 'High BP Stage 2';
    if (systolic > 180 || diastolic > 120) return 'Hypertensive Crisis';
    return 'Unknown';
}

// Export data functionality
async function exportData() {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }

    try {
        const response = await fetch(`/api/analytics/${currentUser}/export?days=90&format=csv`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentUser}_bp_readings.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            speakText('Data exported successfully');
        } else {
            alert('Failed to export data');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data');
    }
}

// Settings functionality
async function loadUserSettings() {
    if (!currentUser) return;

    try {
        const response = await fetch(`/api/users/${currentUser}`);
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                const user = result.data.user;
                const prefs = result.data.preferences;

                // Populate user info
                document.getElementById('userName').value = user.name || '';
                document.getElementById('birthDate').value = user.birth_date || '';
                document.getElementById('emergencyContact').value = user.emergency_contact || '';

                // Populate preferences
                document.getElementById('targetSystolic').value = prefs.target_systolic_max || 120;
                document.getElementById('targetDiastolic').value = prefs.target_diastolic_max || 80;
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }

    const userName = document.getElementById('userName').value;
    const birthDate = document.getElementById('birthDate').value;
    const emergencyContact = document.getElementById('emergencyContact').value;
    const targetSystolic = document.getElementById('targetSystolic').value;
    const targetDiastolic = document.getElementById('targetDiastolic').value;

    try {
        // Update user info
        const userResponse = await fetch(`/api/users/${currentUser}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: userName,
                birth_date: birthDate || null,
                emergency_contact: emergencyContact || null
            })
        });

        // Update preferences
        const prefsResponse = await fetch(`/api/users/${currentUser}/preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                target_systolic_max: parseInt(targetSystolic),
                target_diastolic_max: parseInt(targetDiastolic),
                high_contrast: highContrastMode,
                voice_feedback: voiceFeedbackEnabled
            })
        });

        if (userResponse.ok && prefsResponse.ok) {
            alert('Settings saved successfully!');
            speakText('Settings saved successfully');
            loadUsers(); // Refresh user list
        } else {
            alert('Failed to save some settings');
        }
    } catch (error) {
        console.error('Settings save error:', error);
        alert('Failed to save settings');
    }
}

// Accessibility functions
function toggleHighContrast() {
    highContrastMode = !highContrastMode;
    document.body.classList.toggle('high-contrast', highContrastMode);

    // Save preference
    const prefs = JSON.parse(localStorage.getItem('bp_preferences') || '{}');
    prefs.high_contrast = highContrastMode;
    localStorage.setItem('bp_preferences', JSON.stringify(prefs));

    speakText(highContrastMode ? 'High contrast mode enabled' : 'High contrast mode disabled');
}

function toggleLargeFont() {
    largeFontMode = !largeFontMode;
    document.body.classList.toggle('large-font', largeFontMode);

    // Save preference
    const prefs = JSON.parse(localStorage.getItem('bp_preferences') || '{}');
    prefs.large_font = largeFontMode;
    localStorage.setItem('bp_preferences', JSON.stringify(prefs));

    speakText(largeFontMode ? 'Large font mode enabled' : 'Large font mode disabled');
}

function toggleVoiceFeedback() {
    voiceFeedbackEnabled = !voiceFeedbackEnabled;

    // Save preference
    const prefs = JSON.parse(localStorage.getItem('bp_preferences') || '{}');
    prefs.voice_feedback = voiceFeedbackEnabled;
    localStorage.setItem('bp_preferences', JSON.stringify(prefs));

    speakText(voiceFeedbackEnabled ? 'Voice feedback enabled' : 'Voice feedback disabled');
}

// Text-to-speech function
function speakText(text) {
    if (!voiceFeedbackEnabled || !('speechSynthesis' in window)) {
        return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8; // Slower rate for elderly users
    utterance.pitch = 1;
    utterance.volume = 1;

    speechSynthesis.speak(utterance);
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function validateBPInput(systolic, diastolic) {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);

    if (isNaN(sys) || isNaN(dia)) {
        return { valid: false, message: 'Please enter valid numbers' };
    }

    if (sys < 70 || sys > 250) {
        return { valid: false, message: 'Systolic pressure must be between 70 and 250' };
    }

    if (dia < 40 || dia > 150) {
        return { valid: false, message: 'Diastolic pressure must be between 40 and 150' };
    }

    if (sys <= dia) {
        return { valid: false, message: 'Systolic pressure must be higher than diastolic pressure' };
    }

    return { valid: true };
}

// Keyboard shortcuts for accessibility
document.addEventListener('keydown', function(event) {
    // Alt + 1: Record tab
    if (event.altKey && event.key === '1') {
        event.preventDefault();
        openTab(null, 'recordTab');
    }

    // Alt + 2: History tab
    if (event.altKey && event.key === '2') {
        event.preventDefault();
        openTab(null, 'historyTab');
    }

    // Alt + 3: Settings tab
    if (event.altKey && event.key === '3') {
        event.preventDefault();
        openTab(null, 'settingsTab');
    }

    // Alt + V: Start voice recording
    if (event.altKey && event.key === 'v') {
        event.preventDefault();
        startVoiceRecording();
    }

    // Alt + S: Save manual reading
    if (event.altKey && event.key === 's') {
        event.preventDefault();
        saveManualReading();
    }
});

// Initialize speech synthesis voices (for better compatibility)
window.addEventListener('load', function() {
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
    }
});
