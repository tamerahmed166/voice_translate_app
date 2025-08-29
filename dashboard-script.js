// متغيرات عامة
let currentLanguages = {
    from: 'ar',
    to: 'en'
};

let isRecording = false;
let recognition = null;
let savedTranslations = JSON.parse(localStorage.getItem('savedTranslations')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || {
    name: 'المستخدم',
    email: 'user@example.com',
    avatar: '👤',
    stats: {
        totalTranslations: 0,
        savedPhrases: 0,
        languagesUsed: 0
    }
};

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    loadSavedTranslations();
    updateUserStats();
    setupSpeechRecognition();
});

// تهيئة الصفحة
function initializePage() {
    // تحديث معلومات المستخدم
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }
    
    // تحديث الترحيب
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `مرحباً، ${currentUser.name}!`;
    }
    
    // تحديث الوقت
    updateTimeGreeting();
    
    // تحديث عداد الأحرف
    updateCharacterCount();
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // قائمة المستخدم المنسدلة
    const userAvatar = document.querySelector('.user-avatar');
    const userDropdown = document.querySelector('.user-dropdown');
    
    if (userAvatar && userDropdown) {
        userAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', function() {
            userDropdown.classList.remove('show');
        });
    }
    
    // تبديل اللغات
    const swapBtn = document.querySelector('.swap-languages');
    if (swapBtn) {
        swapBtn.addEventListener('click', swapLanguages);
    }
    
    // أزرار الإجراءات
    const voiceBtn = document.querySelector('[data-action="voice"]');
    const cameraBtn = document.querySelector('[data-action="camera"]');
    const clearBtn = document.querySelector('[data-action="clear"]');
    const copyBtn = document.querySelector('[data-action="copy"]');
    const shareBtn = document.querySelector('[data-action="share"]');
    const saveBtn = document.querySelector('[data-action="save"]');
    
    if (voiceBtn) voiceBtn.addEventListener('click', toggleVoiceRecording);
    if (cameraBtn) cameraBtn.addEventListener('click', openCamera);
    if (clearBtn) clearBtn.addEventListener('click', clearInput);
    if (copyBtn) copyBtn.addEventListener('click', copyOutput);
    if (shareBtn) shareBtn.addEventListener('click', shareTranslation);
    if (saveBtn) saveBtn.addEventListener('click', saveTranslation);
    
    // زر الترجمة
    const translateBtn = document.querySelector('.translate-btn');
    if (translateBtn) {
        translateBtn.addEventListener('click', performTranslation);
    }
    
    // مراقبة تغيير النص
    const textInput = document.querySelector('.text-input');
    if (textInput) {
        textInput.addEventListener('input', function() {
            updateCharacterCount();
            toggleTranslateButton();
        });
        
        textInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                performTranslation();
            }
        });
    }
    
    // تغيير اللغات
    const fromLangSelect = document.querySelector('#fromLang');
    const toLangSelect = document.querySelector('#toLang');
    
    if (fromLangSelect) {
        fromLangSelect.addEventListener('change', function() {
            currentLanguages.from = this.value;
            updateLanguageDisplay();
        });
    }
    
    if (toLangSelect) {
        toLangSelect.addEventListener('change', function() {
            currentLanguages.to = this.value;
            updateLanguageDisplay();
        });
    }
    
    // بطاقات الميزات
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('click', function() {
            const feature = this.dataset.feature;
            handleFeatureClick(feature);
        });
    });
    
    // أزرار التنقل
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });
}

// تحديث تحية الوقت
function updateTimeGreeting() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = '';
    
    if (hour < 12) {
        greeting = 'صباح الخير';
    } else if (hour < 18) {
        greeting = 'مساء الخير';
    } else {
        greeting = 'مساء الخير';
    }
    
    const welcomeSubtitle = document.querySelector('.welcome-subtitle');
    if (welcomeSubtitle) {
        welcomeSubtitle.textContent = `${greeting}! نحن هنا لمساعدتك في الترجمة والتواصل بسهولة.`;
    }
}

// تبديل اللغات
function swapLanguages() {
    const temp = currentLanguages.from;
    currentLanguages.from = currentLanguages.to;
    currentLanguages.to = temp;
    
    // تحديث القوائم المنسدلة
    const fromLangSelect = document.querySelector('#fromLang');
    const toLangSelect = document.querySelector('#toLang');
    
    if (fromLangSelect) fromLangSelect.value = currentLanguages.from;
    if (toLangSelect) toLangSelect.value = currentLanguages.to;
    
    // تبديل النصوص
    const textInput = document.querySelector('.text-input');
    const textOutput = document.querySelector('.text-output');
    
    if (textInput && textOutput && textOutput.textContent.trim()) {
        const inputText = textInput.value;
        const outputText = textOutput.textContent;
        
        textInput.value = outputText;
        textOutput.textContent = inputText;
        
        updateCharacterCount();
    }
    
    updateLanguageDisplay();
}

// تحديث عرض اللغة
function updateLanguageDisplay() {
    const languages = {
        'ar': 'العربية',
        'en': 'الإنجليزية',
        'fr': 'الفرنسية',
        'es': 'الإسبانية',
        'de': 'الألمانية',
        'it': 'الإيطالية',
        'pt': 'البرتغالية',
        'ru': 'الروسية',
        'ja': 'اليابانية',
        'ko': 'الكورية',
        'zh': 'الصينية',
        'hi': 'الهندية',
        'tr': 'التركية'
    };
    
    // تحديث تسميات الأقسام
    const inputLabel = document.querySelector('.input-section .section-label');
    const outputLabel = document.querySelector('.output-section .section-label');
    
    if (inputLabel) {
        inputLabel.textContent = languages[currentLanguages.from] || 'اللغة المصدر';
    }
    
    if (outputLabel) {
        outputLabel.textContent = languages[currentLanguages.to] || 'اللغة الهدف';
    }
}

// تسجيل الصوت
function toggleVoiceRecording() {
    const voiceBtn = document.querySelector('[data-action="voice"]');
    const voiceIndicator = document.querySelector('.voice-indicator');
    
    if (!isRecording) {
        startVoiceRecording();
        voiceBtn.classList.add('active');
        voiceIndicator.classList.add('active');
        isRecording = true;
    } else {
        stopVoiceRecording();
        voiceBtn.classList.remove('active');
        voiceIndicator.classList.remove('active');
        isRecording = false;
    }
}

// إعداد التعرف على الكلام
function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = getLanguageCode(currentLanguages.from);
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            const textInput = document.querySelector('.text-input');
            if (textInput) {
                textInput.value = transcript;
                updateCharacterCount();
                toggleTranslateButton();
            }
        };
        
        recognition.onerror = function(event) {
            console.error('خطأ في التعرف على الكلام:', event.error);
            showNotification('حدث خطأ في التعرف على الكلام', 'error');
            stopVoiceRecording();
        };
        
        recognition.onend = function() {
            stopVoiceRecording();
        };
    }
}

// بدء تسجيل الصوت
function startVoiceRecording() {
    if (recognition) {
        recognition.lang = getLanguageCode(currentLanguages.from);
        recognition.start();
    } else {
        showNotification('التعرف على الكلام غير مدعوم في هذا المتصفح', 'error');
    }
}

// إيقاف تسجيل الصوت
function stopVoiceRecording() {
    if (recognition) {
        recognition.stop();
    }
    
    const voiceBtn = document.querySelector('[data-action="voice"]');
    const voiceIndicator = document.querySelector('.voice-indicator');
    
    if (voiceBtn) voiceBtn.classList.remove('active');
    if (voiceIndicator) voiceIndicator.classList.remove('active');
    
    isRecording = false;
}

// الحصول على رمز اللغة للتعرف على الكلام
function getLanguageCode(lang) {
    const codes = {
        'ar': 'ar-SA',
        'en': 'en-US',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-BR',
        'ru': 'ru-RU',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'zh': 'zh-CN',
        'hi': 'hi-IN',
        'tr': 'tr-TR'
    };
    
    return codes[lang] || 'en-US';
}

// فتح الكاميرا
function openCamera() {
    showNotification('ميزة الكاميرا قيد التطوير', 'info');
}

// مسح النص
function clearInput() {
    const textInput = document.querySelector('.text-input');
    const textOutput = document.querySelector('.text-output');
    
    if (textInput) {
        textInput.value = '';
        updateCharacterCount();
        toggleTranslateButton();
    }
    
    if (textOutput) {
        textOutput.innerHTML = `
            <div class="placeholder-content">
                <div class="placeholder-icon">🌐</div>
                <div class="placeholder-text">الترجمة ستظهر هنا</div>
            </div>
        `;
    }
}

// نسخ النص
function copyOutput() {
    const textOutput = document.querySelector('.text-output');
    if (textOutput && textOutput.textContent.trim()) {
        navigator.clipboard.writeText(textOutput.textContent).then(() => {
            showNotification('تم نسخ النص بنجاح', 'success');
        }).catch(() => {
            showNotification('فشل في نسخ النص', 'error');
        });
    } else {
        showNotification('لا يوجد نص للنسخ', 'warning');
    }
}

// مشاركة الترجمة
function shareTranslation() {
    const textInput = document.querySelector('.text-input');
    const textOutput = document.querySelector('.text-output');
    
    if (textInput && textOutput && textInput.value.trim() && textOutput.textContent.trim()) {
        const shareData = {
            title: 'ترجمة فورية',
            text: `${textInput.value} → ${textOutput.textContent}`
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // نسخ للحافظة كبديل
            navigator.clipboard.writeText(shareData.text).then(() => {
                showNotification('تم نسخ الترجمة للمشاركة', 'success');
            });
        }
    } else {
        showNotification('لا يوجد ترجمة للمشاركة', 'warning');
    }
}

// حفظ الترجمة
function saveTranslation() {
    const textInput = document.querySelector('.text-input');
    const textOutput = document.querySelector('.text-output');
    
    if (textInput && textOutput && textInput.value.trim() && textOutput.textContent.trim()) {
        const translation = {
            id: Date.now(),
            original: textInput.value.trim(),
            translated: textOutput.textContent.trim(),
            fromLang: currentLanguages.from,
            toLang: currentLanguages.to,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('ar-SA')
        };
        
        savedTranslations.unshift(translation);
        
        // الاحتفاظ بآخر 50 ترجمة فقط
        if (savedTranslations.length > 50) {
            savedTranslations = savedTranslations.slice(0, 50);
        }
        
        localStorage.setItem('savedTranslations', JSON.stringify(savedTranslations));
        
        loadSavedTranslations();
        updateUserStats();
        
        showNotification('تم حفظ الترجمة بنجاح', 'success');
    } else {
        showNotification('لا يوجد ترجمة للحفظ', 'warning');
    }
}

// تحديث عداد الأحرف
function updateCharacterCount() {
    const textInput = document.querySelector('.text-input');
    const charCounter = document.querySelector('.char-counter');
    
    if (textInput && charCounter) {
        const count = textInput.value.length;
        const maxCount = 5000;
        charCounter.textContent = `${count}/${maxCount}`;
        
        if (count > maxCount * 0.9) {
            charCounter.style.color = '#ff4757';
        } else if (count > maxCount * 0.7) {
            charCounter.style.color = '#ffa502';
        } else {
            charCounter.style.color = '#666';
        }
    }
}

// تفعيل/تعطيل زر الترجمة
function toggleTranslateButton() {
    const textInput = document.querySelector('.text-input');
    const translateBtn = document.querySelector('.translate-btn');
    
    if (textInput && translateBtn) {
        translateBtn.disabled = !textInput.value.trim();
    }
}

// تنفيذ الترجمة
function performTranslation() {
    const textInput = document.querySelector('.text-input');
    const textOutput = document.querySelector('.text-output');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    if (!textInput || !textInput.value.trim()) {
        showNotification('يرجى إدخال نص للترجمة', 'warning');
        return;
    }
    
    // إظهار مؤشر التحميل
    if (loadingIndicator) {
        loadingIndicator.classList.add('active');
    }
    
    // محاكاة الترجمة (في التطبيق الحقيقي، ستكون هذه مكالمة API)
    setTimeout(() => {
        const translatedText = simulateTranslation(textInput.value, currentLanguages.from, currentLanguages.to);
        
        if (textOutput) {
            textOutput.textContent = translatedText;
        }
        
        if (loadingIndicator) {
            loadingIndicator.classList.remove('active');
        }
        
        // تحديث الإحصائيات
        currentUser.stats.totalTranslations++;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserStats();
        
        showNotification('تمت الترجمة بنجاح', 'success');
    }, 1500);
}

// محاكاة الترجمة
function simulateTranslation(text, fromLang, toLang) {
    // هذه دالة محاكاة - في التطبيق الحقيقي ستستخدم API ترجمة حقيقي
    const translations = {
        'ar-en': {
            'مرحبا': 'Hello',
            'كيف حالك': 'How are you',
            'شكرا': 'Thank you',
            'مع السلامة': 'Goodbye'
        },
        'en-ar': {
            'Hello': 'مرحبا',
            'How are you': 'كيف حالك',
            'Thank you': 'شكرا',
            'Goodbye': 'مع السلامة'
        }
    };
    
    const key = `${fromLang}-${toLang}`;
    const translationMap = translations[key];
    
    if (translationMap && translationMap[text]) {
        return translationMap[text];
    }
    
    // ترجمة افتراضية
    if (fromLang === 'ar' && toLang === 'en') {
        return `[Translated to English]: ${text}`;
    } else if (fromLang === 'en' && toLang === 'ar') {
        return `[مترجم إلى العربية]: ${text}`;
    } else {
        return `[Translated from ${fromLang} to ${toLang}]: ${text}`;
    }
}

// تحميل الترجمات المحفوظة
function loadSavedTranslations() {
    const savedList = document.querySelector('.saved-list');
    if (!savedList) return;
    
    if (savedTranslations.length === 0) {
        savedList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div class="empty-text">لا توجد ترجمات محفوظة</div>
                <div class="empty-subtitle">ابدأ بترجمة النصوص وحفظها لتظهر هنا</div>
            </div>
        `;
        return;
    }
    
    // عرض آخر 5 ترجمات فقط
    const recentTranslations = savedTranslations.slice(0, 5);
    
    savedList.innerHTML = recentTranslations.map(translation => `
        <div class="saved-item" data-id="${translation.id}">
            <div class="saved-content">
                <div class="saved-text">
                    <div class="original">${translation.original}</div>
                    <div class="translated">${translation.translated}</div>
                </div>
                <div class="saved-meta">
                    <span>${getLanguageName(translation.fromLang)} → ${getLanguageName(translation.toLang)}</span>
                    <span>${translation.date}</span>
                </div>
            </div>
            <div class="saved-actions">
                <button class="saved-action-btn" onclick="reuseSavedTranslation(${translation.id})" title="إعادة استخدام">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="saved-action-btn" onclick="copySavedTranslation(${translation.id})" title="نسخ">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="saved-action-btn" onclick="deleteSavedTranslation(${translation.id})" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// الحصول على اسم اللغة
function getLanguageName(code) {
    const names = {
        'ar': 'العربية',
        'en': 'الإنجليزية',
        'fr': 'الفرنسية',
        'es': 'الإسبانية',
        'de': 'الألمانية',
        'it': 'الإيطالية',
        'pt': 'البرتغالية',
        'ru': 'الروسية',
        'ja': 'اليابانية',
        'ko': 'الكورية',
        'zh': 'الصينية',
        'hi': 'الهندية',
        'tr': 'التركية'
    };
    
    return names[code] || code;
}

// إعادة استخدام ترجمة محفوظة
function reuseSavedTranslation(id) {
    const translation = savedTranslations.find(t => t.id === id);
    if (translation) {
        const textInput = document.querySelector('.text-input');
        const textOutput = document.querySelector('.text-output');
        
        if (textInput) {
            textInput.value = translation.original;
            updateCharacterCount();
            toggleTranslateButton();
        }
        
        if (textOutput) {
            textOutput.textContent = translation.translated;
        }
        
        // تحديث اللغات
        currentLanguages.from = translation.fromLang;
        currentLanguages.to = translation.toLang;
        
        const fromLangSelect = document.querySelector('#fromLang');
        const toLangSelect = document.querySelector('#toLang');
        
        if (fromLangSelect) fromLangSelect.value = currentLanguages.from;
        if (toLangSelect) toLangSelect.value = currentLanguages.to;
        
        updateLanguageDisplay();
        
        showNotification('تم استرداد الترجمة', 'success');
    }
}

// نسخ ترجمة محفوظة
function copySavedTranslation(id) {
    const translation = savedTranslations.find(t => t.id === id);
    if (translation) {
        const text = `${translation.original} → ${translation.translated}`;
        navigator.clipboard.writeText(text).then(() => {
            showNotification('تم نسخ الترجمة', 'success');
        }).catch(() => {
            showNotification('فشل في نسخ الترجمة', 'error');
        });
    }
}

// حذف ترجمة محفوظة
function deleteSavedTranslation(id) {
    if (confirm('هل أنت متأكد من حذف هذه الترجمة؟')) {
        savedTranslations = savedTranslations.filter(t => t.id !== id);
        localStorage.setItem('savedTranslations', JSON.stringify(savedTranslations));
        loadSavedTranslations();
        updateUserStats();
        showNotification('تم حذف الترجمة', 'success');
    }
}

// تحديث إحصائيات المستخدم
function updateUserStats() {
    currentUser.stats.savedPhrases = savedTranslations.length;
    
    // حساب عدد اللغات المستخدمة
    const usedLanguages = new Set();
    savedTranslations.forEach(t => {
        usedLanguages.add(t.fromLang);
        usedLanguages.add(t.toLang);
    });
    currentUser.stats.languagesUsed = usedLanguages.size;
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // تحديث العرض
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 3) {
        statCards[0].querySelector('.stat-number').textContent = currentUser.stats.totalTranslations;
        statCards[1].querySelector('.stat-number').textContent = currentUser.stats.savedPhrases;
        statCards[2].querySelector('.stat-number').textContent = currentUser.stats.languagesUsed;
    }
}

// التعامل مع نقرات بطاقات الميزات
function handleFeatureClick(feature) {
    switch (feature) {
        case 'conversation':
            showNotification('ميزة المحادثة قيد التطوير', 'info');
            break;
        case 'document':
            showNotification('ميزة ترجمة المستندات قيد التطوير', 'info');
            break;
        case 'offline':
            showNotification('ميزة الترجمة بدون إنترنت قيد التطوير', 'info');
            break;
        case 'history':
            navigateToPage('history');
            break;
        default:
            showNotification('هذه الميزة قيد التطوير', 'info');
    }
}

// التنقل بين الصفحات
function navigateToPage(page) {
    switch (page) {
        case 'home':
            // البقاء في الصفحة الحالية
            break;
        case 'history':
            window.location.href = 'history.html';
            break;
        case 'settings':
            window.location.href = 'settings.html';
            break;
        case 'profile':
            window.location.href = 'profile.html';
            break;
        default:
            showNotification('الصفحة قيد التطوير', 'info');
    }
}

// عرض الإشعارات
function showNotification(message, type = 'info') {
    // إنشاء عنصر الإشعار
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // إضافة الأنماط
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 10px;
        padding: 1rem;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 1rem;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        border-left: 4px solid ${getNotificationColor(type)};
    `;
    
    // إضافة إلى الصفحة
    document.body.appendChild(notification);
    
    // إزالة تلقائية بعد 5 ثوان
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// الحصول على أيقونة الإشعار
function getNotificationIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || icons.info;
}

// الحصول على لون الإشعار
function getNotificationColor(type) {
    const colors = {
        'success': '#2ed573',
        'error': '#ff4757',
        'warning': '#ffa502',
        'info': '#667eea'
    };
    return colors[type] || colors.info;
}

// إضافة أنماط الرسوم المتحركة
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #999;
        transition: color 0.3s ease;
    }
    
    .notification-close:hover {
        color: #333;
    }
`;
document.head.appendChild(style);

// تحديث الوقت كل دقيقة
setInterval(updateTimeGreeting, 60000);

// حفظ حالة المستخدم عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('savedTranslations', JSON.stringify(savedTranslations));
});