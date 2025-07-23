# Blood Pressure Monitor for Elderly Users v1.0

An AI-powered blood pressure monitoring system designed specifically for elderly users, featuring multiple data entry methods and comprehensive health analytics.

## 🎯 Core Features

### AI-Powered Data Entry
- **📸 Photo Recognition (OCR)**: Take a photo of any blood pressure monitor display to automatically extract readings
- **🎤 Voice Recognition**: Say your reading naturally (e.g., "120 over 80, pulse 75")
- **✏️ Manual Entry**: Large, easy-to-use number inputs with validation
- **🤖 AI Validation**: Automatic reasonableness checks and health insights

### Elderly-Friendly Design
- **🔤 Large Fonts & High Contrast**: Accessibility options for visual impairments
- **🔊 Voice Feedback**: Audio confirmation and guidance
- **👥 Multi-User Support**: Easy switching between family members
- **📱 Cross-Platform**: Works on smartphones, tablets, and computers

### Health Analytics
- **📊 Trend Analysis**: Track blood pressure patterns over time
- **⚠️ Smart Alerts**: Automatic detection of concerning readings
- **📈 Visual Charts**: Simple graphs showing health trends
- **📋 Reports**: Weekly and monthly health summaries
- **💾 Data Export**: CSV export for healthcare providers

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Modern web browser with camera/microphone access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd blood-pressure-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🏗️ Architecture

### Backend (Node.js/Express)
- **OCR Service**: Tesseract.js for reading BP monitor displays
- **Voice Service**: OpenAI Whisper for speech-to-text
- **AI Validation**: GPT-powered health insights and validation
- **Database**: SQLite for local data storage
- **Analytics**: Comprehensive trend analysis and reporting

### Frontend (Vanilla JS)
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG 2.1 AA compliant
- **Progressive Web App**: Offline capabilities
- **Voice Interface**: Web Speech API integration

### Key Components
```
├── server/
│   ├── app.js                 # Main Express server
│   ├── routes/
│   │   ├── bloodPressure.js   # BP data entry endpoints
│   │   ├── users.js           # User management
│   │   └── analytics.js       # Health analytics
│   └── utils/
│       ├── database.js        # SQLite database layer
│       ├── ocrService.js      # Photo recognition
│       ├── voiceService.js    # Voice processing
│       └── aiValidationService.js # AI health insights
├── public/
│   └── script.js              # Frontend JavaScript
└── index.html                 # Main UI
```

## 📱 Usage Guide

### For Elderly Users

1. **Select Your Profile**
   - Choose your name from the user list
   - Or create a new profile with simple setup

2. **Record Your Blood Pressure**
   - **📸 Photo Method**: Point camera at your BP monitor and tap "Take Photo"
   - **🎤 Voice Method**: Tap microphone and say "120 over 80"
   - **✏️ Manual Method**: Type numbers using large buttons

3. **View Your Health**
   - See immediate feedback on your reading
   - Check trends in the History tab
   - Export data for your doctor

### For Caregivers

1. **Multi-User Setup**
   - Create profiles for multiple family members
   - Easy switching between users
   - Separate health tracking for each person

2. **Monitor Health Trends**
   - Weekly and monthly reports
   - Alert notifications for concerning readings
   - Data export for healthcare providers

## 🔧 Configuration

### Environment Variables
```bash
# AI Services
OPENAI_API_KEY=your_openai_key
DASHSCOPE_API_KEY=your_dashscope_key  # Alternative AI provider

# Database
DB_PATH=./server/data/bp_monitor.db

# Server
PORT=3000
NODE_ENV=production
```

### User Preferences
- Font size (small, medium, large, extra-large)
- High contrast mode
- Voice feedback on/off
- Target blood pressure ranges
- Reminder frequency

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Manual Testing Scenarios
1. **Photo Recognition**: Test with various BP monitor brands
2. **Voice Recognition**: Test with different accents and speech patterns
3. **Accessibility**: Test with screen readers and keyboard navigation
4. **Multi-User**: Test user switching and data isolation

## 📊 Supported Blood Pressure Monitors

The OCR system supports most digital blood pressure monitors including:
- Omron (HEM-7120, HEM-7130, HEM-7156)
- A&D Medical (UA-611, UA-767)
- Beurer (BM26, BM27)
- Most generic digital monitors with clear LCD displays

## 🔒 Privacy & Security

- **Local Data Storage**: All health data stored locally by default
- **Optional Cloud Sync**: Encrypted cloud backup available
- **HIPAA Considerations**: Designed with healthcare privacy in mind
- **Data Encryption**: All sensitive data encrypted at rest
- **User Control**: Easy data export and deletion

## 🌐 Browser Compatibility

- **Chrome/Edge**: Full feature support
- **Firefox**: Full feature support
- **Safari**: Full feature support (iOS 14.3+)
- **Mobile Browsers**: Optimized for touch interfaces

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Create an issue on GitHub
- Check the documentation wiki
- Contact the development team

## 🗺️ Roadmap

### Version 1.1 (Planned)
- [ ] Bluetooth integration with smart BP monitors
- [ ] Family member monitoring dashboard
- [ ] Advanced AI health recommendations
- [ ] Integration with electronic health records

### Version 1.2 (Future)
- [ ] Medication tracking integration
- [ ] Telemedicine platform integration
- [ ] Advanced analytics and machine learning
- [ ] Multi-language support

---

**Built with ❤️ for elderly users and their families**