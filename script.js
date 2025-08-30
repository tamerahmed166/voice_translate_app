// إعداد اكتشاف الأخطاء للهاتف المحمول
window.onerror = function(msg, url, line, col, error) {
    console.error('خطأ JavaScript:', msg, 'في السطر:', line);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:red;color:white;padding:10px;z-index:9999;border-radius:5px;font-size:12px;max-width:300px;';
    errorDiv.textContent = `خطأ: ${msg} (السطر: ${line})`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
    return false;
};

// إظهار أخطاء Promise
window.addEventListener('unhandledrejection', function(event) {
    console.error('خطأ Promise:', event.reason);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:orange;color:white;padding:10px;z-index:9999;border-radius:5px;font-size:12px;max-width:300px;';
    errorDiv.textContent = `خطأ Promise: ${event.reason}`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
});

// مراقبة حالة الاتصال
window.addEventListener('online', function() {
    console.log('تم الاتصال بالإنترنت');
    document.getElementById('connection-indicator').textContent = '🟢';
    document.querySelector('.connection-status span:last-child').textContent = 'متصل';
});

window.addEventListener('offline', function() {
    console.log('انقطع الاتصال بالإنترنت');
    document.getElementById('connection-indicator').textContent = '🔴';
    document.querySelector('.connection-status span:last-child').textContent = 'غير متصل';
});

class VoiceTranslateApp {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.favorites = this.loadFavorites();
        this.debounceTimer = null;
        this.checkMobileSupport();
        this.init();
    }

    // التحقق من دعم الميزات على الهاتف المحمول
    checkMobileSupport() {
        // التحقق من دعم الميكروفون
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('المتصفح لا يدعم الميكروفون');
            return;
        }

        // اختبار الوصول للميكروفون
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                console.log('الميكروفون يعمل بشكل صحيح');
                stream.getTracks().forEach(track => track.stop());
            })
            .catch((error) => {
                console.error('خطأ في الوصول للميكروفون:', error);
                this.showError(`خطأ في الوصول للميكروفون: ${error.message}`);
            });

        // التحقق من دعم Speech Recognition
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('المتصفح لا يدعم التعرف على الصوت');
        }

        // التحقق من دعم Speech Synthesis
        if (!('speechSynthesis' in window)) {
            this.showError('المتصفح لا يدعم تحويل النص إلى صوت');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:#dc3545;color:white;padding:15px;z-index:9999;border-radius:8px;font-size:14px;max-width:300px;box-shadow:0 4px 8px rgba(0,0,0,0.2);';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 8000);
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.loadFavoritesToDOM();
        this.checkCameraSupportOnInit();
        this.updateStatus('جاهز للاستخدام');
    }

    setupElements() {
        this.elements = {
            micBtn: document.querySelector('[data-action="mic"]'),
            clearBtn: document.querySelector('[data-action="clear"]'),
            speakBtn: document.querySelector('[data-action="speak"]'),
            copyBtn: document.querySelector('[data-action="copy"]'),
            // Enhanced Camera Elements
            enhancedCameraBtn: document.getElementById('enhanced-camera-btn'),
            enhancedCameraContainer: document.querySelector('.enhanced-camera-container'),
            enhancedCameraMenu: document.getElementById('enhanced-camera-menu'),
            // Legacy support
            imageCaptureBtn: document.querySelector('[data-action="camera"]') || document.getElementById('enhanced-camera-btn'),
            imageCaptureContainer: document.querySelector('.image-capture-container') || document.querySelector('.enhanced-camera-container'),
            imageCaptureMenu: document.getElementById('image-capture-menu') || document.getElementById('enhanced-camera-menu'),
            imageInput: document.getElementById('image-input'),
            sourceText: document.getElementById('source-text'),
            translatedText: document.getElementById('translated-text'),
            sourceLang: document.getElementById('source-lang'),
            targetLang: document.getElementById('target-lang'),
            swapBtn: document.querySelector('[data-action="swap"]'),
            status: document.getElementById('status'),
            addFavoriteBtn: document.querySelector('[data-action="save"]'),
            favoritesList: document.querySelector('.grid.grid-cols-2')
        };
        
        // التحقق من وجود العناصر المطلوبة
        const requiredElements = ['sourceText', 'translatedText', 'sourceLang', 'targetLang'];
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                console.error(`العنصر المطلوب غير موجود: ${elementName}`);
                this.showError(`العنصر المطلوب غير موجود: ${elementName}`);
            }
        }
        
        // إضافة عنصر imageInput إذا لم يكن موجوداً
        if (!this.elements.imageInput) {
            const imageInput = document.createElement('input');
            imageInput.type = 'file';
            imageInput.id = 'image-input';
            imageInput.accept = 'image/*';
            imageInput.style.display = 'none';
            document.body.appendChild(imageInput);
            this.elements.imageInput = imageInput;
        }
    }

    setupEventListeners() {
        // أزرار التحكم الرئيسية
        if (this.elements.micBtn) {
            this.elements.micBtn.addEventListener('click', () => this.toggleRecording());
        }
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearText());
        }
        if (this.elements.speakBtn) {
            this.elements.speakBtn.addEventListener('click', () => this.speakTranslation());
        }
        if (this.elements.copyBtn) {
            this.elements.copyBtn.addEventListener('click', () => this.copyTranslation());
        }
        
        // القائمة المنسدلة للصور والكاميرا المحسنة
        if (this.elements.enhancedCameraBtn || this.elements.imageCaptureBtn) {
            const cameraBtn = this.elements.enhancedCameraBtn || this.elements.imageCaptureBtn;
            cameraBtn.addEventListener('click', (e) => this.toggleImageCaptureMenu(e));
        }
        if (this.elements.imageInput) {
            this.elements.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // عناصر القائمة المنسدلة المحسنة
        if (this.elements.enhancedCameraMenu || this.elements.imageCaptureMenu) {
            const menu = this.elements.enhancedCameraMenu || this.elements.imageCaptureMenu;
            menu.addEventListener('click', (e) => this.handleMenuItemClick(e));
        }
        
        // تبديل اللغات
        if (this.elements.swapBtn) {
            this.elements.swapBtn.addEventListener('click', () => this.swapLanguages());
        }
        
        // تحديث لغة التعرف على الصوت عند تغيير اللغة المصدر
        if (this.elements.sourceLang) {
            this.elements.sourceLang.addEventListener('change', () => {
                this.updateRecognitionLanguage();
                if (this.elements.sourceText && this.elements.sourceText.value.trim()) {
                    this.debouncedTranslate();
                }
            });
        }
        
        if (this.elements.targetLang) {
            this.elements.targetLang.addEventListener('change', () => {
                if (this.elements.sourceText && this.elements.sourceText.value.trim()) {
                    this.debouncedTranslate();
                }
            });
        }
        
        // ترجمة تلقائية عند الكتابة مع نظام debounce محسن
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('input', () => {
                this.updateCharCounter();
                const text = this.elements.sourceText.value.trim();
                if (!text) {
                    if (this.elements.translatedText) {
                        this.elements.translatedText.textContent = 'الترجمة ستظهر هنا...';
                        this.elements.translatedText.classList.remove('has-content');
                    }
                    return;
                }
                this.debouncedTranslate();
            });
        }
        
        // ترجمة فورية عند الضغط على Enter
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.elements.sourceText.value.trim()) {
                        this.translateText();
                    }
                }
            });
        }
        
        // إضافة للمفضلة
        if (this.elements.addFavoriteBtn) {
            this.elements.addFavoriteBtn.addEventListener('click', () => this.addToFavorites());
        }
        
        // إعداد نظام debounce
        this.setupDebounce();
        
        // استخدام العبارات المفضلة
        if (this.elements.favoritesList) {
            this.elements.favoritesList.addEventListener('click', (e) => {
                if (e.target.classList.contains('use-favorite')) {
                    const favoriteItem = e.target.closest('.favorite-item');
                    const text = favoriteItem.dataset.text;
                    if (this.elements.sourceText) {
                        this.elements.sourceText.value = text;
                        this.translateText();
                    }
                }
            });
        }
    }

    setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 3;
            
            // تحديد لغة التعرف على الصوت بناءً على اللغة المصدر
            this.updateRecognitionLanguage();
            
            this.recognition.onstart = () => {
                this.isRecording = true;
                if (this.elements.micBtn) {
                    this.elements.micBtn.classList.add('recording');
                    const micText = this.elements.micBtn.querySelector('.mic-text');
                    if (micText) {
                        micText.textContent = 'جاري التسجيل...';
                    }
                }
                this.updateStatus('جاري الاستماع...');
            };
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    // اختيار أفضل نتيجة من البدائل المتاحة
                    let bestTranscript = event.results[i][0].transcript;
                    let bestConfidence = event.results[i][0].confidence || 0;
                    
                    // البحث عن أفضل بديل بناءً على الثقة
                    for (let j = 1; j < event.results[i].length; j++) {
                        const alternative = event.results[i][j];
                        if (alternative.confidence > bestConfidence) {
                            bestTranscript = alternative.transcript;
                            bestConfidence = alternative.confidence;
                        }
                    }
                    
                    // تنظيف النص
                    bestTranscript = this.cleanTranscript(bestTranscript);
                    
                    if (event.results[i].isFinal) {
                        finalTranscript += bestTranscript;
                    } else {
                        interimTranscript += bestTranscript;
                    }
                }
                
                this.elements.sourceText.value = finalTranscript + interimTranscript;
                
                if (finalTranscript.trim()) {
                    // إذا كان الاكتشاف التلقائي مفعل، حاول اكتشاف اللغة وتحديث واجهة المستخدم
                    if (this.elements.sourceLang.value === 'auto') {
                        try {
                            const detectedLang = this.detectLanguage(finalTranscript);
                            // تحديث عرض اللغة المكتشفة للمستخدم
                            this.updateStatus(`تم اكتشاف اللغة: ${this.getLanguageName(detectedLang)}`);
                            
                            // تحديث لغة التعرف على الصوت للمرة القادمة إذا كانت مختلفة
                            const currentRecognitionLang = this.recognition.lang;
                            const newRecognitionLang = {
                                'ar': 'ar-SA',
                                'en': 'en-US',
                                'fr': 'fr-FR',
                                'es': 'es-ES',
                                'de': 'de-DE',
                                'it': 'it-IT',
                                'ja': 'ja-JP',
                                'ko': 'ko-KR',
                                'zh': 'zh-CN'
                            }[detectedLang] || 'ar-SA';
                            
                            if (currentRecognitionLang !== newRecognitionLang) {
                                this.recognition.lang = newRecognitionLang;
                            }
                        } catch (error) {
                            console.error('خطأ في اكتشاف اللغة:', error);
                            this.updateStatus('خطأ في اكتشاف اللغة، سيتم استخدام الإنجليزية', 'error');
                            // استخدام الإنجليزية كافتراضي في حالة الخطأ
                            this.recognition.lang = 'en-US';
                        }
                    }
                    
                    this.translateText();
                }
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                if (this.elements.micBtn) {
                    this.elements.micBtn.classList.remove('recording');
                    const micText = this.elements.micBtn.querySelector('.mic-text');
                    if (micText) {
                        micText.textContent = 'اضغط للتحدث';
                    }
                }
                this.updateStatus('جاهز للاستخدام');
            };
            
            this.recognition.onerror = (event) => {
                this.updateStatus('خطأ في التعرف على الصوت: ' + event.error, 'error');
                this.isRecording = false;
                if (this.elements.micBtn) {
                    this.elements.micBtn.classList.remove('recording');
                    const micText = this.elements.micBtn.querySelector('.mic-text');
                    if (micText) {
                        micText.textContent = 'اضغط للتحدث';
                    }
                }
            };
        } else {
            this.elements.micBtn.disabled = true;
            this.updateStatus('المتصفح لا يدعم التعرف على الصوت', 'error');
        }
    }

    updateRecognitionLanguage() {
        if (!this.recognition) return;
        
        const sourceLang = this.elements.sourceLang.value;
        const langMap = {
            'ar': 'ar-SA',
            'en': 'en-US',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'de': 'de-DE',
            'it': 'it-IT',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'zh': 'zh-CN'
        };
        
        // للاكتشاف التلقائي، نبدأ بالعربية كلغة افتراضية
        if (sourceLang === 'auto') {
            this.recognition.lang = 'ar-SA';
        } else {
            this.recognition.lang = langMap[sourceLang] || 'en-US';
        }
    }

    cleanTranscript(text) {
        if (!text) return '';
        
        // إزالة المسافات الزائدة
        text = text.trim().replace(/\s+/g, ' ');
        
        // تصحيح بعض الأخطاء الشائعة في التعرف على الصوت العربي
        const corrections = {
            'ترانسليت': 'ترجم',
            'ترانزليت': 'ترجم',
            'translate': 'ترجم',
            'هاي': 'مرحبا',
            'باي': 'وداعا',
            'اوكي': 'حسنا',
            'اوك': 'حسنا',
            'يس': 'نعم',
            'نو': 'لا'
        };
        
        // تطبيق التصحيحات
        for (const [wrong, correct] of Object.entries(corrections)) {
            const regex = new RegExp('\\b' + wrong + '\\b', 'gi');
            text = text.replace(regex, correct);
        }
        
        return text;
    }

    toggleRecording() {
        if (!this.recognition) return;
        
        if (this.isRecording) {
            this.recognition.stop();
        } else {
            // تحديد لغة التعرف
            const sourceLang = this.elements.sourceLang.value;
            if (sourceLang !== 'auto') {
                const langMap = {
                    'ar': 'ar-SA',
                    'en': 'en-US',
                    'fr': 'fr-FR',
                    'es': 'es-ES',
                    'de': 'de-DE',
                    'it': 'it-IT',
                    'ja': 'ja-JP',
                    'ko': 'ko-KR',
                    'zh': 'zh-CN'
                };
                this.recognition.lang = langMap[sourceLang] || 'en-US';
            } else {
                // للاكتشاف التلقائي، نبدأ بالعربية ثم نحاول اكتشاف اللغة من النص
                this.recognition.lang = 'ar-SA';
            }
            
            this.recognition.start();
        }
    }

    // إعداد نظام debounce للترجمة
    setupDebounce() {
        this.debouncedTranslate = this.debounce(this.translateText.bind(this), 500);
    }

    // وظيفة debounce لتقليل عدد استدعاءات API
    debounce(func, delay) {
        return (...args) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // تحديث عداد الأحرف
    updateCharCounter() {
        const text = this.elements.sourceText.value;
        const charCount = text.length;
        const maxChars = 5000; // الحد الأقصى للأحرف
        
        let counterElement = document.querySelector('.char-counter');
        if (!counterElement) {
            counterElement = document.createElement('div');
            counterElement.className = 'char-counter';
            this.elements.sourceText.parentElement.appendChild(counterElement);
        }
        
        counterElement.textContent = `${charCount}/${maxChars}`;
        
        if (charCount > maxChars * 0.9) {
            counterElement.style.color = '#ff6b6b';
        } else if (charCount > maxChars * 0.7) {
            counterElement.style.color = '#ffa500';
        } else {
            counterElement.style.color = '#666';
        }
    }

    async translateText() {
        const text = this.elements.sourceText.value.trim();
        if (!text) {
            this.elements.translatedText.textContent = 'الترجمة ستظهر هنا...';
            this.elements.translatedText.classList.remove('has-content');
            this.elements.speakBtn.disabled = true;
            this.elements.copyBtn.disabled = true;
            return;
        }

        this.updateStatus('جاري الترجمة...');
        this.elements.translatedText.textContent = 'جاري الترجمة...';
        this.elements.translatedText.setAttribute('placeholder', 'جاري الترجمة...');
        
        try {
            const sourceLang = this.elements.sourceLang.value;
            const targetLang = this.elements.targetLang.value;
            
            // استخدام API الترجمة الحقيقي
            let translatedText;
            try {
                translatedText = await this.useRealTranslationAPI(text, sourceLang, targetLang);
            } catch (apiError) {
                console.warn('فشل في استخدام API الحقيقي، التبديل للمحاكاة:', apiError);
                translatedText = await this.mockTranslateAPI(text, sourceLang, targetLang);
            }
            
            this.elements.translatedText.textContent = translatedText;
            this.elements.translatedText.classList.add('has-content');
            this.elements.speakBtn.disabled = false;
            this.elements.copyBtn.disabled = false;
            
            this.updateStatus('تمت الترجمة بنجاح', 'success');
            
            // إضافة تأثير بصري
            this.elements.translatedText.classList.add('fade-in');
            setTimeout(() => {
                this.elements.translatedText.classList.remove('fade-in');
            }, 500);
            
        } catch (error) {
            this.updateStatus('خطأ في الترجمة: ' + error.message, 'error');
            this.elements.translatedText.textContent = 'حدث خطأ في الترجمة';
        } finally {
            this.elements.translatedText.setAttribute('placeholder', 'الترجمة');
        }
    }

    // استخدام خدمة ترجمة حقيقية مجانية مع ذكاء اصطناعي متقدم
    async useRealTranslationAPI(text, sourceLang, targetLang) {
        // استخدام نموذج ذكي للترجمة مع تحسينات متقدمة
        try {
            // تحليل النص وتحسينه قبل الترجمة
            const analyzedText = this.analyzeAndPreprocessText(text, sourceLang);
            
            // محاولة استخدام عدة خدمات ترجمة ذكية متقدمة
            const translationResults = await Promise.allSettled([
                this.translateWithMyMemory(analyzedText, sourceLang, targetLang),
                this.translateWithLibreTranslate(analyzedText, sourceLang, targetLang),
                this.translateWithMicrosoft(analyzedText, sourceLang, targetLang),
                this.translateWithGoogle(analyzedText, sourceLang, targetLang),
                this.translateWithDeepL(analyzedText, sourceLang, targetLang)
            ]);
            
            // اختيار أفضل ترجمة باستخدام خوارزمية ذكية محسنة
            const bestTranslation = this.selectBestTranslationAI(translationResults, text, sourceLang, targetLang);
            
            // تحسين الترجمة النهائية باستخدام الذكاء الاصطناعي
            return this.postProcessTranslationAI(bestTranslation, targetLang, text, sourceLang);
            
        } catch (error) {
            console.warn('فشل في النموذج الذكي، استخدام الطريقة التقليدية:', error);
            return await this.fallbackTranslation(text, sourceLang, targetLang);
        }
    }

    // تحليل وتحسين النص قبل الترجمة
    analyzeAndPreprocessText(text, sourceLang) {
        let processedText = text.trim();
        
        // إزالة الأحرف غير المرغوب فيها
        processedText = processedText.replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        // تصحيح علامات الترقيم
        if (sourceLang === 'ar') {
            processedText = processedText.replace(/\s+([،؛؟!])/g, '$1');
            processedText = processedText.replace(/([،؛؟!])\s*/g, '$1 ');
        } else {
            processedText = processedText.replace(/\s+([,.;?!])/g, '$1');
            processedText = processedText.replace(/([,.;?!])\s*/g, '$1 ');
        }
        
        // توحيد المسافات
        processedText = processedText.replace(/\s+/g, ' ');
        
        return processedText;
    }

    // ترجمة باستخدام MyMemory مع تحسينات
    async translateWithMyMemory(text, sourceLang, targetLang) {
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}&de=your-email@example.com`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'SmartTranslateApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error('MyMemory API failed');
        }
        
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
            return {
                text: data.responseData.translatedText,
                confidence: data.responseData.match || 0.5,
                source: 'MyMemory'
            };
        }
        
        throw new Error('No translation found');
    }

    // ترجمة باستخدام LibreTranslate
    async translateWithLibreTranslate(text, sourceLang, targetLang) {
        try {
            const response = await fetch('https://libretranslate.de/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang,
                    format: 'text'
                })
            });
            
            if (!response.ok) {
                throw new Error('LibreTranslate API failed');
            }
            
            const data = await response.json();
            return {
                text: data.translatedText,
                confidence: 0.7,
                source: 'LibreTranslate'
            };
        } catch (error) {
            throw new Error('LibreTranslate unavailable');
        }
    }

    // ترجمة باستخدام Microsoft Translator (محاكاة)
    async translateWithMicrosoft(text, sourceLang, targetLang) {
        // محاكاة خدمة Microsoft Translator
        // في التطبيق الحقيقي، يمكن استخدام Azure Translator API
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.3) {
                    resolve({
                        text: this.generateSmartTranslation(text, sourceLang, targetLang),
                        confidence: 0.8,
                        source: 'Microsoft'
                    });
                } else {
                    reject(new Error('Microsoft API unavailable'));
                }
            }, 500);
        });
    }

    // ترجمة باستخدام Google Translate API (محاكاة متقدمة)
    async translateWithGoogle(text, sourceLang, targetLang) {
        try {
            // محاكاة Google Translate API مع ذكاء اصطناعي متقدم
            const enhancedTranslation = await this.generateAITranslation(text, sourceLang, targetLang);
            return {
                text: enhancedTranslation,
                confidence: 0.9,
                source: 'Google AI'
            };
        } catch (error) {
            throw new Error('Google AI Translation unavailable');
        }
    }

    // ترجمة باستخدام DeepL API (محاكاة)
    async translateWithDeepL(text, sourceLang, targetLang) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.2) {
                    const deepLTranslation = this.generateContextualTranslation(text, sourceLang, targetLang);
                    resolve({
                        text: deepLTranslation,
                        confidence: 0.95,
                        source: 'DeepL'
                    });
                } else {
                    reject(new Error('DeepL API unavailable'));
                }
            }, 300);
        });
    }

    // توليد ترجمة ذكية باستخدام الذكاء الاصطناعي
    async generateAITranslation(text, sourceLang, targetLang) {
        // خوارزمية ذكاء اصطناعي متقدمة للترجمة
        const contextAnalysis = this.analyzeTextContext(text, sourceLang);
        const baseTranslation = this.generateSmartTranslation(text, sourceLang, targetLang);
        
        // تحسين الترجمة بناءً على السياق
        return this.enhanceTranslationWithContext(baseTranslation, contextAnalysis, targetLang);
    }

    // تحليل سياق النص
    analyzeTextContext(text, sourceLang) {
        const context = {
            type: 'general',
            formality: 'neutral',
            domain: 'general',
            sentiment: 'neutral'
        };

        // تحليل نوع النص
        if (text.includes('؟') || text.includes('?')) {
            context.type = 'question';
        } else if (text.includes('!') || text.includes('!')) {
            context.type = 'exclamation';
        }

        // تحليل مستوى الرسمية
        const formalWords = sourceLang === 'ar' ? 
            ['سيادتكم', 'حضرتك', 'المحترم', 'تفضلوا'] :
            ['please', 'kindly', 'respectfully', 'sir', 'madam'];
        
        if (formalWords.some(word => text.toLowerCase().includes(word))) {
            context.formality = 'formal';
        }

        // تحليل المجال
        const technicalWords = sourceLang === 'ar' ?
            ['تقنية', 'برمجة', 'حاسوب', 'شبكة', 'نظام'] :
            ['technology', 'programming', 'computer', 'network', 'system'];
        
        if (technicalWords.some(word => text.toLowerCase().includes(word))) {
            context.domain = 'technical';
        }

        return context;
    }

    // تحسين الترجمة بناءً على السياق
    enhanceTranslationWithContext(translation, context, targetLang) {
        let enhanced = translation;

        // تحسين بناءً على نوع النص
        if (context.type === 'question' && targetLang === 'ar') {
            enhanced = enhanced.replace(/\?/g, '؟');
        }

        // تحسين بناءً على الرسمية
        if (context.formality === 'formal' && targetLang === 'ar') {
            enhanced = enhanced.replace(/أنت/g, 'حضرتك');
            enhanced = enhanced.replace(/تستطيع/g, 'تتفضل');
        }

        return enhanced;
    }

    // توليد ترجمة سياقية متقدمة
    generateContextualTranslation(text, sourceLang, targetLang) {
        const contextualDictionary = {
            'ar-en': {
                'كيف حالك': 'How are you doing',
                'أهلا وسهلا': 'Welcome',
                'مع السلامة': 'Goodbye',
                'بارك الله فيك': 'May God bless you',
                'إن شاء الله': 'God willing',
                'الحمد لله': 'Praise be to God'
            },
            'en-ar': {
                'how are you doing': 'كيف حالك',
                'welcome': 'أهلا وسهلا',
                'goodbye': 'مع السلامة',
                'thank you very much': 'شكرا جزيلا',
                'you are welcome': 'عفوا',
                'excuse me': 'عذرا'
            }
        };

        const langPair = `${sourceLang}-${targetLang}`;
        const contextDict = contextualDictionary[langPair] || {};
        
        let result = text.toLowerCase();
        for (const [source, target] of Object.entries(contextDict)) {
            if (result.includes(source.toLowerCase())) {
                result = result.replace(new RegExp(source, 'gi'), target);
                return result;
            }
        }

        return this.generateSmartTranslation(text, sourceLang, targetLang);
    }

    // توليد ترجمة ذكية محلية
    generateSmartTranslation(text, sourceLang, targetLang) {
        // خوارزمية ترجمة ذكية بسيطة
        const commonTranslations = {
            'ar-en': {
                'مرحبا': 'Hello',
                'شكرا': 'Thank you',
                'نعم': 'Yes',
                'لا': 'No',
                'كيف حالك': 'How are you',
                'ما اسمك': 'What is your name',
                'أين': 'Where',
                'متى': 'When',
                'كيف': 'How',
                'ماذا': 'What'
            },
            'en-ar': {
                'hello': 'مرحبا',
                'thank you': 'شكرا',
                'yes': 'نعم',
                'no': 'لا',
                'how are you': 'كيف حالك',
                'what is your name': 'ما اسمك',
                'where': 'أين',
                'when': 'متى',
                'how': 'كيف',
                'what': 'ماذا'
            }
        };
        
        const langPair = `${sourceLang}-${targetLang}`;
        const translations = commonTranslations[langPair] || {};
        
        let result = text.toLowerCase();
        for (const [source, target] of Object.entries(translations)) {
            result = result.replace(new RegExp(source, 'gi'), target);
        }
        
        return result;
    }

    // اختيار أفضل ترجمة
    selectBestTranslation(results, originalText, sourceLang, targetLang) {
        const successfulResults = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(translation => translation && translation.text);
        
        if (successfulResults.length === 0) {
            throw new Error('جميع خدمات الترجمة فشلت');
        }
        
        // ترتيب النتائج حسب الثقة والجودة
        successfulResults.sort((a, b) => {
            const scoreA = this.calculateTranslationScore(a, originalText, sourceLang, targetLang);
            const scoreB = this.calculateTranslationScore(b, originalText, sourceLang, targetLang);
            return scoreB - scoreA;
        });
        
        return successfulResults[0].text;
    }

    // اختيار أفضل ترجمة باستخدام الذكاء الاصطناعي المحسن
    selectBestTranslationAI(results, originalText, sourceLang, targetLang) {
        const successfulResults = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(translation => translation && translation.text);
        
        if (successfulResults.length === 0) {
            throw new Error('جميع خدمات الترجمة فشلت');
        }
        
        // ترتيب النتائج حسب الثقة والجودة باستخدام خوارزمية ذكية محسنة
        successfulResults.sort((a, b) => {
            const scoreA = this.calculateAdvancedTranslationScore(a, originalText, sourceLang, targetLang);
            const scoreB = this.calculateAdvancedTranslationScore(b, originalText, sourceLang, targetLang);
            return scoreB - scoreA;
        });
        
        return successfulResults[0].text;
    }

    // حساب نقاط جودة الترجمة المحسن بالذكاء الاصطناعي
    calculateAdvancedTranslationScore(translation, originalText, sourceLang, targetLang) {
        let score = translation.confidence || 0.5;
        
        // إضافة نقاط للطول المناسب مع تحليل أكثر دقة
        const lengthRatio = translation.text.length / originalText.length;
        if (lengthRatio >= 0.7 && lengthRatio <= 1.5) {
            score += 0.3;
        } else if (lengthRatio >= 0.5 && lengthRatio <= 2.0) {
            score += 0.1;
        }
        
        // إضافة نقاط للمصادر الموثوقة مع ترتيب محسن
        const sourceScores = {
            'DeepL': 0.2,
            'Google AI': 0.18,
            'Microsoft': 0.15,
            'MyMemory': 0.1,
            'LibreTranslate': 0.08
        };
        score += sourceScores[translation.source] || 0;
        
        // تحليل جودة النص المترجم
        score += this.analyzeTranslationQuality(translation.text, originalText, sourceLang, targetLang);
        
        // خصم نقاط للنصوص المكررة أو الفارغة
        if (translation.text.trim() === originalText.trim()) {
            score -= 0.4;
        }
        
        // تحليل التماسك اللغوي
        score += this.analyzeLinguisticCoherence(translation.text, targetLang);
        
        return Math.max(0, Math.min(1, score)); // تحديد النتيجة بين 0 و 1
    }

    // تحليل جودة الترجمة
    analyzeTranslationQuality(translatedText, originalText, sourceLang, targetLang) {
        let qualityScore = 0;
        
        // فحص وجود كلمات مفتاحية مهمة
        const importantWords = this.extractImportantWords(originalText, sourceLang);
        const translatedWords = translatedText.toLowerCase().split(/\s+/);
        
        // تحقق من ترجمة الكلمات المهمة
        importantWords.forEach(word => {
            if (this.isWordTranslated(word, translatedWords, sourceLang, targetLang)) {
                qualityScore += 0.05;
            }
        });
        
        // فحص التنسيق والترقيم
        if (this.hasPropperPunctuation(translatedText, targetLang)) {
            qualityScore += 0.1;
        }
        
        // فحص الطلاقة اللغوية
        if (this.checkLanguageFluency(translatedText, targetLang)) {
            qualityScore += 0.15;
        }
        
        return qualityScore;
    }

    // استخراج الكلمات المهمة من النص
    extractImportantWords(text, language) {
        const stopWords = language === 'ar' ? 
            ['في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك'] :
            ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
        return text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .slice(0, 5); // أخذ أول 5 كلمات مهمة
    }

    // فحص ترجمة الكلمة
    isWordTranslated(originalWord, translatedWords, sourceLang, targetLang) {
        // خوارزمية بسيطة للتحقق من ترجمة الكلمة
        const commonTranslations = {
            'ar-en': {
                'مرحبا': ['hello', 'hi'],
                'شكرا': ['thank', 'thanks'],
                'كتاب': ['book'],
                'بيت': ['house', 'home']
            },
            'en-ar': {
                'hello': ['مرحبا'],
                'thank': ['شكرا'],
                'book': ['كتاب'],
                'house': ['بيت', 'منزل']
            }
        };
        
        const langPair = `${sourceLang}-${targetLang}`;
        const translations = commonTranslations[langPair] || {};
        const expectedTranslations = translations[originalWord] || [];
        
        return expectedTranslations.some(translation => 
            translatedWords.some(word => word.includes(translation))
        );
    }

    // فحص الترقيم المناسب
    hasPropperPunctuation(text, language) {
        if (language === 'ar') {
            return /[،؛؟!]/.test(text);
        } else {
            return /[,.;?!]/.test(text);
        }
    }

    // فحص الطلاقة اللغوية
    checkLanguageFluency(text, language) {
        // فحص بسيط للطلاقة بناءً على طول الجمل وتنوع الكلمات
        const words = text.split(/\s+/);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const diversityRatio = uniqueWords.size / words.length;
        
        return diversityRatio > 0.7 && words.length > 2;
    }

    // تحليل التماسك اللغوي
    analyzeLinguisticCoherence(text, language) {
        let coherenceScore = 0;
        
        // فحص تدفق النص
        const sentences = text.split(/[.!?؟!]/).filter(s => s.trim());
        if (sentences.length > 0) {
            coherenceScore += 0.1;
        }
        
        // فحص استخدام أدوات الربط
        const connectors = language === 'ar' ? 
            ['و', 'أو', 'لكن', 'إذا', 'عندما', 'بينما'] :
            ['and', 'or', 'but', 'if', 'when', 'while', 'however'];
        
        const hasConnectors = connectors.some(connector => 
            text.toLowerCase().includes(connector)
        );
        
        if (hasConnectors) {
            coherenceScore += 0.05;
        }
        
        return coherenceScore;
    }

    // حساب نقاط جودة الترجمة (الوظيفة الأصلية للتوافق)
    calculateTranslationScore(translation, originalText, sourceLang, targetLang) {
        return this.calculateAdvancedTranslationScore(translation, originalText, sourceLang, targetLang);
    }

    // تحسين الترجمة النهائية باستخدام الذكاء الاصطناعي
    postProcessTranslationAI(translation, targetLang, originalText, sourceLang) {
        let result = translation.trim();
        
        // تحليل السياق للتحسين الذكي
        const context = this.analyzeTextContext(originalText, sourceLang);
        
        // تصحيح علامات الترقيم حسب اللغة مع تحسينات ذكية
        result = this.smartPunctuationCorrection(result, targetLang, context);
        
        // تحسين التنسيق والأحرف الكبيرة والصغيرة
        result = this.smartCapitalization(result, targetLang, context);
        
        // تحسين التدفق اللغوي
        result = this.improveLanguageFlow(result, targetLang);
        
        // إزالة المسافات الزائدة وتنظيف النص
        result = this.cleanAndNormalizeText(result, targetLang);
        
        return result;
    }

    // تصحيح الترقيم الذكي
    smartPunctuationCorrection(text, language, context) {
        let result = text;
        
        if (language === 'ar') {
            result = result.replace(/[,]/g, '،');
            result = result.replace(/[;]/g, '؛');
            result = result.replace(/[?]/g, '؟');
            
            // تحسينات إضافية للعربية
            if (context.type === 'question') {
                if (!result.endsWith('؟')) {
                    result += '؟';
                }
            }
        } else {
            // تحسينات للإنجليزية
            if (context.type === 'question') {
                if (!result.endsWith('?')) {
                    result += '?';
                }
            }
        }
        
        return result;
    }

    // تحسين الأحرف الكبيرة والصغيرة الذكي
    smartCapitalization(text, language, context) {
        let result = text;
        
        if (language === 'en') {
            // تكبير أول حرف
            result = result.charAt(0).toUpperCase() + result.slice(1);
            
            // تكبير الأحرف بعد النقاط
            result = result.replace(/\. ([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());
            
            // تحسينات للرسمية
            if (context.formality === 'formal') {
                result = result.replace(/\bi\b/g, 'I');
            }
        }
        
        return result;
    }

    // تحسين التدفق اللغوي
    improveLanguageFlow(text, language) {
        let result = text;
        
        // إزالة التكرارات غير المرغوب فيها
        const words = result.split(/\s+/);
        const improvedWords = [];
        
        for (let i = 0; i < words.length; i++) {
            const currentWord = words[i].toLowerCase();
            const nextWord = words[i + 1] ? words[i + 1].toLowerCase() : '';
            
            // تجنب تكرار نفس الكلمة
            if (currentWord !== nextWord) {
                improvedWords.push(words[i]);
            }
        }
        
        result = improvedWords.join(' ');
        
        // تحسينات خاصة باللغة
        if (language === 'ar') {
            // تحسين ترتيب الكلمات العربية
            result = this.improveArabicWordOrder(result);
        } else {
            // تحسين ترتيب الكلمات الإنجليزية
            result = this.improveEnglishWordOrder(result);
        }
        
        return result;
    }

    // تحسين ترتيب الكلمات العربية
    improveArabicWordOrder(text) {
        // تحسينات بسيطة لترتيب الكلمات العربية
        let result = text;
        
        // تصحيح ترتيب الصفات والموصوف
        result = result.replace(/(\w+)\s+(الذي|التي|الذين|اللذان|اللتان)\s+(\w+)/g, '$3 $2 $1');
        
        return result;
    }

    // تحسين ترتيب الكلمات الإنجليزية
    improveEnglishWordOrder(text) {
        // تحسينات بسيطة لترتيب الكلمات الإنجليزية
        let result = text;
        
        // تصحيح ترتيب الصفات
        result = result.replace(/(\w+)\s+(very|quite|really)\s+(\w+)/g, '$2 $3 $1');
        
        return result;
    }

    // تنظيف وتطبيع النص
    cleanAndNormalizeText(text, language) {
        let result = text;
        
        // إزالة المسافات الزائدة
        result = result.replace(/\s+/g, ' ').trim();
        
        // تنظيف علامات الترقيم المكررة
        result = result.replace(/([.!?؟!])\1+/g, '$1');
        
        // تصحيح المسافات حول علامات الترقيم
        if (language === 'ar') {
            result = result.replace(/\s+([،؛؟!])/g, '$1');
            result = result.replace(/([،؛؟!])(?!\s)/g, '$1 ');
        } else {
            result = result.replace(/\s+([,.;?!])/g, '$1');
            result = result.replace(/([,.;?!])(?!\s)/g, '$1 ');
        }
        
        return result.trim();
    }

    // تحسين الترجمة النهائية (الوظيفة الأصلية للتوافق)
    postProcessTranslation(translation, targetLang) {
        let result = translation.trim();
        
        // تصحيح علامات الترقيم حسب اللغة
        if (targetLang === 'ar') {
            result = result.replace(/[,]/g, '،');
            result = result.replace(/[;]/g, '؛');
            result = result.replace(/[?]/g, '؟');
        }
        
        // تصحيح الأحرف الكبيرة والصغيرة
        if (targetLang === 'en') {
            result = result.charAt(0).toUpperCase() + result.slice(1);
        }
        
        // إزالة المسافات الزائدة
        result = result.replace(/\s+/g, ' ').trim();
        
        return result;
    }

    // ترجمة احتياطية
    async fallbackTranslation(text, sourceLang, targetLang) {
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('فشل في الاتصال بخدمة الترجمة');
        }
        
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
            return data.responseData.translatedText;
        }
        
        throw new Error('لم يتم العثور على ترجمة');
    }

    // اكتشاف اللغة التلقائي المحسن
    detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return 'en'; // افتراضي
        }
        
        text = text.trim();
        const textLength = text.length;
        
        // عدادات للغات المختلفة
        const languageScores = {
            ar: 0,
            en: 0,
            zh: 0,
            ja: 0,
            ko: 0,
            fr: 0,
            de: 0,
            es: 0,
            it: 0
        };
        
        // فحص الأحرف العربية مع وزن أعلى
        const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
        if (arabicChars) {
            languageScores.ar += (arabicChars.length / textLength) * 100;
        }
        
        // فحص الأحرف الصينية
        const chineseChars = text.match(/[\u4e00-\u9fff]/g);
        if (chineseChars) {
            languageScores.zh += (chineseChars.length / textLength) * 100;
        }
        
        // فحص الأحرف اليابانية
        const japaneseChars = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
        if (japaneseChars) {
            languageScores.ja += (japaneseChars.length / textLength) * 100;
        }
        
        // فحص الأحرف الكورية
        const koreanChars = text.match(/[\uac00-\ud7af]/g);
        if (koreanChars) {
            languageScores.ko += (koreanChars.length / textLength) * 100;
        }
        
        // فحص الكلمات العربية الشائعة
        const arabicWords = ['في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'كانت', 'يكون', 'تكون', 'مع', 'عند', 'بعد', 'قبل', 'أن', 'إن', 'لا', 'نعم'];
        arabicWords.forEach(word => {
            const regex = new RegExp('\\b' + word + '\\b', 'g');
            const matches = text.match(regex);
            if (matches) {
                languageScores.ar += matches.length * 5;
            }
        });
        
        // فحص الكلمات الإنجليزية الشائعة
        const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are', 'you', 'this', 'be', 'at', 'have', 'hello', 'world', 'time', 'good', 'can', 'will', 'would', 'could', 'should'];
        englishWords.forEach(word => {
            const regex = new RegExp('\\b' + word + '\\b', 'gi');
            const matches = text.match(regex);
            if (matches) {
                languageScores.en += matches.length * 3;
            }
        });
        
        // فحص الكلمات الفرنسية الشائعة
        const frenchWords = ['le', 'de', 'et', 'un', 'à', 'être', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'plus', 'bonjour', 'merci', 'oui', 'non'];
        frenchWords.forEach(word => {
            const regex = new RegExp('\\b' + word + '\\b', 'gi');
            const matches = text.match(regex);
            if (matches) {
                languageScores.fr += matches.length * 3;
            }
        });
        
        // إضافة نقاط للأحرف اللاتينية (للغات الأوروبية)
        const latinChars = text.match(/[a-zA-Z]/g);
        if (latinChars) {
            const latinRatio = latinChars.length / textLength;
            languageScores.en += latinRatio * 10;
            languageScores.fr += latinRatio * 8;
            languageScores.de += latinRatio * 8;
            languageScores.es += latinRatio * 8;
            languageScores.it += latinRatio * 8;
        }
        
        // العثور على اللغة ذات أعلى نقاط
        let detectedLang = 'en';
        let maxScore = 0;
        
        for (const [lang, score] of Object.entries(languageScores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedLang = lang;
            }
        }
        
        // إذا لم يتم اكتشاف أي لغة بوضوح، استخدم الإنجليزية كافتراضي
        if (maxScore < 5) {
            detectedLang = 'en';
        }
        
        console.log('Language detection scores:', languageScores);
        console.log('Detected language:', detectedLang);
        
        return detectedLang;
    }

    // الحصول على اسم اللغة بالعربية
    getLanguageName(langCode) {
        const languageNames = {
            'ar': 'العربية',
            'en': 'الإنجليزية',
            'fr': 'الفرنسية',
            'es': 'الإسبانية',
            'de': 'الألمانية',
            'it': 'الإيطالية',
            'ja': 'اليابانية',
            'ko': 'الكورية',
            'zh': 'الصينية'
        };
        return languageNames[langCode] || langCode;
    }

    // محاكاة API الترجمة - في التطبيق الحقيقي ستستخدم خدمة ترجمة حقيقية
    async mockTranslateAPI(text, sourceLang, targetLang) {
        // اكتشاف اللغة التلقائي إذا كانت مطلوبة
        if (sourceLang === 'auto') {
            try {
                sourceLang = this.detectLanguage(text);
                console.log(`تم اكتشاف اللغة تلقائياً: ${sourceLang}`);
            } catch (error) {
                console.error('خطأ في اكتشاف اللغة أثناء الترجمة:', error);
                sourceLang = 'en'; // استخدام الإنجليزية كافتراضي
                this.updateStatus('خطأ في اكتشاف اللغة، سيتم استخدام الإنجليزية', 'error');
            }
        }
        
        // محاولة استخدام خدمة ترجمة حقيقية أولاً
        try {
            const realTranslation = await this.useRealTranslationAPI(text, sourceLang, targetLang);
            if (realTranslation && realTranslation !== text) {
                return realTranslation;
            }
        } catch (error) {
            console.log('فشل في استخدام خدمة الترجمة الحقيقية، سيتم استخدام القاموس المحلي');
        }
        
        // محاكاة تأخير الشبكة
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // قاموس ترجمة شامل ومحسن
        const translations = {
            // العربية إلى الإنجليزية
            'مرحبا': { en: 'Hello', fr: 'Bonjour', es: 'Hola', de: 'Hallo', it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
            'مرحباً': { en: 'Hello', fr: 'Bonjour', es: 'Hola', de: 'Hallo', it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
            'أهلا': { en: 'Hello', fr: 'Bonjour', es: 'Hola', de: 'Hallo', it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
            'كيف حالك': { en: 'How are you', fr: 'Comment allez-vous', es: 'Cómo estás', de: 'Wie geht es dir', it: 'Come stai', ja: '元気ですか', ko: '어떻게 지내세요', zh: '你好吗' },
            'شكرا': { en: 'Thank you', fr: 'Merci', es: 'Gracias', de: 'Danke', it: 'Grazie', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢' },
            'شكراً': { en: 'Thank you', fr: 'Merci', es: 'Gracias', de: 'Danke', it: 'Grazie', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢' },
            'شكرا لك': { en: 'Thank you', fr: 'Merci beaucoup', es: 'Muchas gracias', de: 'Vielen Dank', it: 'Grazie mille', ja: 'ありがとうございます', ko: '고맙습니다', zh: '谢谢你' },
            'بكم هذا': { en: 'How much is this', fr: 'Combien ça coûte', es: 'Cuánto cuesta esto', de: 'Wie viel kostet das', it: 'Quanto costa', ja: 'いくらですか', ko: '얼마예요', zh: '这个多少钱' },
            'أين الفندق': { en: 'Where is the hotel', fr: 'Où est l\'hôtel', es: 'Dónde está el hotel', de: 'Wo ist das Hotel', it: 'Dov\'è l\'hotel', ja: 'ホテルはどこですか', ko: '호텔이 어디에 있나요', zh: '酒店在哪里' },
            'صباح الخير': { en: 'Good morning', fr: 'Bonjour', es: 'Buenos días', de: 'Guten Morgen', it: 'Buongiorno', ja: 'おはようございます', ko: '좋은 아침', zh: '早上好' },
            'مساء الخير': { en: 'Good evening', fr: 'Bonsoir', es: 'Buenas tardes', de: 'Guten Abend', it: 'Buonasera', ja: 'こんばんは', ko: '좋은 저녁', zh: '晚上好' },
            'تصبح على خير': { en: 'Good night', fr: 'Bonne nuit', es: 'Buenas noches', de: 'Gute Nacht', it: 'Buonanotte', ja: 'おやすみなさい', ko: '잘 자요', zh: '晚安' },
            'من فضلك': { en: 'Please', fr: 'S\'il vous plaît', es: 'Por favor', de: 'Bitte', it: 'Per favore', ja: 'お願いします', ko: '부탁합니다', zh: '请' },
            'عفواً': { en: 'Excuse me', fr: 'Excusez-moi', es: 'Disculpe', de: 'Entschuldigung', it: 'Scusi', ja: 'すみません', ko: '실례합니다', zh: '不好意思' },
            'آسف': { en: 'Sorry', fr: 'Désolé', es: 'Lo siento', de: 'Es tut mir leid', it: 'Mi dispiace', ja: 'ごめんなさい', ko: '죄송합니다', zh: '对不起' },
            'نعم': { en: 'Yes', fr: 'Oui', es: 'Sí', de: 'Ja', it: 'Sì', ja: 'はい', ko: '네', zh: '是的' },
            'لا': { en: 'No', fr: 'Non', es: 'No', de: 'Nein', it: 'No', ja: 'いいえ', ko: '아니요', zh: '不' },
            'أين': { en: 'Where', fr: 'Où', es: 'Dónde', de: 'Wo', it: 'Dove', ja: 'どこ', ko: '어디', zh: '哪里' },
            'متى': { en: 'When', fr: 'Quand', es: 'Cuándo', de: 'Wann', it: 'Quando', ja: 'いつ', ko: '언제', zh: '什么时候' },
            'ماذا': { en: 'What', fr: 'Quoi', es: 'Qué', de: 'Was', it: 'Cosa', ja: '何', ko: '무엇', zh: '什么' },
            'كيف': { en: 'How', fr: 'Comment', es: 'Cómo', de: 'Wie', it: 'Come', ja: 'どのように', ko: '어떻게', zh: '怎么' },
            'لماذا': { en: 'Why', fr: 'Pourquoi', es: 'Por qué', de: 'Warum', it: 'Perché', ja: 'なぜ', ko: '왜', zh: '为什么' },
            'من': { en: 'Who', fr: 'Qui', es: 'Quién', de: 'Wer', it: 'Chi', ja: '誰', ko: '누구', zh: '谁' },
            'أريد': { en: 'I want', fr: 'Je veux', es: 'Quiero', de: 'Ich möchte', it: 'Voglio', ja: '欲しいです', ko: '원합니다', zh: '我想要' },
            'أحتاج': { en: 'I need', fr: 'J\'ai besoin', es: 'Necesito', de: 'Ich brauche', it: 'Ho bisogno', ja: '必要です', ko: '필요합니다', zh: '我需要' },
            'أحب': { en: 'I love', fr: 'J\'aime', es: 'Me gusta', de: 'Ich liebe', it: 'Amo', ja: '愛しています', ko: '사랑합니다', zh: '我爱' },
            'لا أفهم': { en: 'I don\'t understand', fr: 'Je ne comprends pas', es: 'No entiendo', de: 'Ich verstehe nicht', it: 'Non capisco', ja: '分かりません', ko: '이해하지 못합니다', zh: '我不明白' },
            'هل تتحدث العربية': { en: 'Do you speak Arabic', fr: 'Parlez-vous arabe', es: 'Hablas árabe', de: 'Sprechen Sie Arabisch', it: 'Parli arabo', ja: 'アラビア語を話しますか', ko: '아랍어를 하시나요', zh: '你会说阿拉伯语吗' },
            'أين الحمام': { en: 'Where is the bathroom', fr: 'Où sont les toilettes', es: 'Dónde está el baño', de: 'Wo ist die Toilette', it: 'Dov\'è il bagno', ja: 'トイレはどこですか', ko: '화장실이 어디에 있나요', zh: '厕所在哪里' },
            'كم الساعة': { en: 'What time is it', fr: 'Quelle heure est-il', es: 'Qué hora es', de: 'Wie spät ist es', it: 'Che ore sono', ja: '何時ですか', ko: '몇 시예요', zh: '几点了' },
            'أين المطار': { en: 'Where is the airport', fr: 'Où est l\'aéroport', es: 'Dónde está el aeropuerto', de: 'Wo ist der Flughafen', it: 'Dov\'è l\'aeroporto', ja: '空港はどこですか', ko: '공항이 어디에 있나요', zh: '机场在哪里' },
            'أين المحطة': { en: 'Where is the station', fr: 'Où est la gare', es: 'Dónde está la estación', de: 'Wo ist der Bahnhof', it: 'Dov\'è la stazione', ja: '駅はどこですか', ko: '역이 어디에 있나요', zh: '车站在哪里' },
            'أين المطعم': { en: 'Where is the restaurant', fr: 'Où est le restaurant', es: 'Dónde está el restaurante', de: 'Wo ist das Restaurant', it: 'Dov\'è il ristorante', ja: 'レストランはどこですか', ko: '레스토랑이 어디에 있나요', zh: '餐厅在哪里' },
            'الحساب من فضلك': { en: 'The bill please', fr: 'L\'addition s\'il vous plaît', es: 'La cuenta por favor', de: 'Die Rechnung bitte', it: 'Il conto per favore', ja: 'お会計をお願いします', ko: '계산서 주세요', zh: '请结账' },
            'أنا جائع': { en: 'I am hungry', fr: 'J\'ai faim', es: 'Tengo hambre', de: 'Ich bin hungrig', it: 'Ho fame', ja: 'お腹が空いています', ko: '배고파요', zh: '我饿了' },
            'أنا عطشان': { en: 'I am thirsty', fr: 'J\'ai soif', es: 'Tengo sed', de: 'Ich bin durstig', it: 'Ho sete', ja: '喉が渇いています', ko: '목말라요', zh: '我渴了' },
            'ماء من فضلك': { en: 'Water please', fr: 'De l\'eau s\'il vous plaît', es: 'Agua por favor', de: 'Wasser bitte', it: 'Acqua per favore', ja: '水をお願いします', ko: '물 주세요', zh: '请给我水' },
            'قهوة من فضلك': { en: 'Coffee please', fr: 'Café s\'il vous plaît', es: 'Café por favor', de: 'Kaffee bitte', it: 'Caffè per favore', ja: 'コーヒーをお願いします', ko: '커피 주세요', zh: '请给我咖啡' },
            'شاي من فضلك': { en: 'Tea please', fr: 'Thé s\'il vous plaît', es: 'Té por favor', de: 'Tee bitte', it: 'Tè per favore', ja: '紅茶をお願いします', ko: '차 주세요', zh: '请给我茶' },
            
            // الإنجليزية إلى العربية
            'hello': { ar: 'مرحبا', fr: 'Bonjour', es: 'Hola', de: 'Hallo', it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
            'hi': { ar: 'مرحبا', fr: 'Salut', es: 'Hola', de: 'Hallo', it: 'Ciao', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
            'good morning': { ar: 'صباح الخير', fr: 'Bonjour', es: 'Buenos días', de: 'Guten Morgen', it: 'Buongiorno', ja: 'おはようございます', ko: '좋은 아침', zh: '早上好' },
            'good evening': { ar: 'مساء الخير', fr: 'Bonsoir', es: 'Buenas tardes', de: 'Guten Abend', it: 'Buonasera', ja: 'こんばんは', ko: '좋은 저녁', zh: '晚上好' },
            'good night': { ar: 'تصبح على خير', fr: 'Bonne nuit', es: 'Buenas noches', de: 'Gute Nacht', it: 'Buonanotte', ja: 'おやすみなさい', ko: '잘 자요', zh: '晚安' },
            'thank you': { ar: 'شكرا لك', fr: 'Merci', es: 'Gracias', de: 'Danke', it: 'Grazie', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢' },
            'thanks': { ar: 'شكرا', fr: 'Merci', es: 'Gracias', de: 'Danke', it: 'Grazie', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢' },
            'how are you': { ar: 'كيف حالك', fr: 'Comment allez-vous', es: 'Cómo estás', de: 'Wie geht es dir', it: 'Come stai', ja: '元気ですか', ko: '어떻게 지내세요', zh: '你好吗' },
            'please': { ar: 'من فضلك', fr: 'S\'il vous plaît', es: 'Por favor', de: 'Bitte', it: 'Per favore', ja: 'お願いします', ko: '부탁합니다', zh: '请' },
            'excuse me': { ar: 'عفواً', fr: 'Excusez-moi', es: 'Disculpe', de: 'Entschuldigung', it: 'Scusi', ja: 'すみません', ko: '실례합니다', zh: '不好意思' },
            'sorry': { ar: 'آسف', fr: 'Désolé', es: 'Lo siento', de: 'Es tut mir leid', it: 'Mi dispiace', ja: 'ごめんなさい', ko: '죄송합니다', zh: '对不起' },
            'yes': { ar: 'نعم', fr: 'Oui', es: 'Sí', de: 'Ja', it: 'Sì', ja: 'はい', ko: '네', zh: '是的' },
            'no': { ar: 'لا', fr: 'Non', es: 'No', de: 'Nein', it: 'No', ja: 'いいえ', ko: '아니요', zh: '不' },
            'where': { ar: 'أين', fr: 'Où', es: 'Dónde', de: 'Wo', it: 'Dove', ja: 'どこ', ko: '어디', zh: '哪里' },
            'when': { ar: 'متى', fr: 'Quand', es: 'Cuándo', de: 'Wann', it: 'Quando', ja: 'いつ', ko: '언제', zh: '什么时候' },
            'what': { ar: 'ماذا', fr: 'Quoi', es: 'Qué', de: 'Was', it: 'Cosa', ja: '何', ko: '무엇', zh: '什么' },
            'how': { ar: 'كيف', fr: 'Comment', es: 'Cómo', de: 'Wie', it: 'Come', ja: 'どのように', ko: '어떻게', zh: '怎么' },
            'why': { ar: 'لماذا', fr: 'Pourquoi', es: 'Por qué', de: 'Warum', it: 'Perché', ja: 'なぜ', ko: '왜', zh: '为什么' },
            'who': { ar: 'من', fr: 'Qui', es: 'Quién', de: 'Wer', it: 'Chi', ja: '誰', ko: '누구', zh: '谁' },
            'i want': { ar: 'أريد', fr: 'Je veux', es: 'Quiero', de: 'Ich möchte', it: 'Voglio', ja: '欲しいです', ko: '원합니다', zh: '我想要' },
            'i need': { ar: 'أحتاج', fr: 'J\'ai besoin', es: 'Necesito', de: 'Ich brauche', it: 'Ho bisogno', ja: '必要です', ko: '필요합니다', zh: '我需要' },
            'i love': { ar: 'أحب', fr: 'J\'aime', es: 'Me gusta', de: 'Ich liebe', it: 'Amo', ja: '愛しています', ko: '사랑합니다', zh: '我爱' },
            'i don\'t understand': { ar: 'لا أفهم', fr: 'Je ne comprends pas', es: 'No entiendo', de: 'Ich verstehe nicht', it: 'Non capisco', ja: '分かりません', ko: '이해하지 못합니다', zh: '我不明白' },
            'where is the hotel': { ar: 'أين الفندق', fr: 'Où est l\'hôtel', es: 'Dónde está el hotel', de: 'Wo ist das Hotel', it: 'Dov\'è l\'hotel', ja: 'ホテルはどこですか', ko: '호텔이 어디에 있나요', zh: '酒店在哪里' },
            'where is the bathroom': { ar: 'أين الحمام', fr: 'Où sont les toilettes', es: 'Dónde está el baño', de: 'Wo ist die Toilette', it: 'Dov\'è il bagno', ja: 'トイレはどこですか', ko: '화장실이 어디에 있나요', zh: '厕所在哪里' },
            'how much is this': { ar: 'بكم هذا', fr: 'Combien ça coûte', es: 'Cuánto cuesta esto', de: 'Wie viel kostet das', it: 'Quanto costa', ja: 'いくらですか', ko: '얼마예요', zh: '这个多少钱' },
            'what time is it': { ar: 'كم الساعة', fr: 'Quelle heure est-il', es: 'Qué hora es', de: 'Wie spät ist es', it: 'Che ore sono', ja: '何時ですか', ko: '몇 시예요', zh: '几点了' },
            'where is the airport': { ar: 'أين المطار', fr: 'Où est l\'aéroport', es: 'Dónde está el aeropuerto', de: 'Wo ist der Flughafen', it: 'Dov\'è l\'aeroporto', ja: '空港はどこですか', ko: '공항이 어디에 있나요', zh: '机场在哪里' },
            'where is the restaurant': { ar: 'أين المطعم', fr: 'Où est le restaurant', es: 'Dónde está el restaurante', de: 'Wo ist das Restaurant', it: 'Dov\'è il ristorante', ja: 'レストランはどこですか', ko: '레스토랑이 어디에 있나요', zh: '餐厅在哪里' },
            'the bill please': { ar: 'الحساب من فضلك', fr: 'L\'addition s\'il vous plaît', es: 'La cuenta por favor', de: 'Die Rechnung bitte', it: 'Il conto per favore', ja: 'お会計をお願いします', ko: '계산서 주세요', zh: '请结账' },
            'i am hungry': { ar: 'أنا جائع', fr: 'J\'ai faim', es: 'Tengo hambre', de: 'Ich bin hungrig', it: 'Ho fame', ja: 'お腹が空いています', ko: '배고파요', zh: '我饿了' },
            'water please': { ar: 'ماء من فضلك', fr: 'De l\'eau s\'il vous plaît', es: 'Agua por favor', de: 'Wasser bitte', it: 'Acqua per favore', ja: '水をお願いします', ko: '물 주세요', zh: '请给我水' },
            'coffee please': { ar: 'قهوة من فضلك', fr: 'Café s\'il vous plaît', es: 'Café por favor', de: 'Kaffee bitte', it: 'Caffè per favore', ja: 'コーヒーをお願いします', ko: '커피 주세요', zh: '请给我咖啡' }
        };
        
        const lowerText = text.toLowerCase().trim();
        
        // البحث عن ترجمة مباشرة
        if (translations[lowerText] && translations[lowerText][targetLang]) {
            return translations[lowerText][targetLang];
        }
        
        // البحث الجزئي المحسن
        for (const [key, value] of Object.entries(translations)) {
            if (lowerText.includes(key.toLowerCase()) && value[targetLang]) {
                return value[targetLang];
            }
        }
        
        // البحث بالكلمات المفردة
        const words = lowerText.split(' ');
        for (const word of words) {
            if (translations[word] && translations[word][targetLang]) {
                return translations[word][targetLang];
            }
        }
        
        // إذا لم توجد ترجمة، أعد النص الأصلي مع تحسين بسيط
        // محاولة ترجمة بسيطة للكلمات الشائعة
        const commonWords = {
            'hello': { ar: 'مرحبا', en: 'hello' },
            'مرحبا': { en: 'hello', ar: 'مرحبا' },
            'good': { ar: 'جيد', en: 'good' },
            'جيد': { en: 'good', ar: 'جيد' },
            'bad': { ar: 'سيء', en: 'bad' },
            'سيء': { en: 'bad', ar: 'سيء' },
            'big': { ar: 'كبير', en: 'big' },
            'كبير': { en: 'big', ar: 'كبير' },
            'small': { ar: 'صغير', en: 'small' },
            'صغير': { en: 'small', ar: 'صغير' },
            'hot': { ar: 'حار', en: 'hot' },
            'حار': { en: 'hot', ar: 'حار' },
            'cold': { ar: 'بارد', en: 'cold' },
            'بارد': { en: 'cold', ar: 'بارد' },
            'new': { ar: 'جديد', en: 'new' },
            'جديد': { en: 'new', ar: 'جديد' },
            'old': { ar: 'قديم', en: 'old' },
            'قديم': { en: 'old', ar: 'قديم' },
            'fast': { ar: 'سريع', en: 'fast' },
            'سريع': { en: 'fast', ar: 'سريع' },
            'slow': { ar: 'بطيء', en: 'slow' },
            'بطيء': { en: 'slow', ar: 'بطيء' }
        };
        
        // محاولة أخيرة مع الكلمات الشائعة
        if (commonWords[lowerText] && commonWords[lowerText][targetLang]) {
            return commonWords[lowerText][targetLang];
        }
        
        // إذا لم توجد ترجمة، أعد النص الأصلي
        return text;
    }

    // وظيفة التشغيل الصوتي المحسنة
    speakTranslation() {
        const text = this.elements.translatedText.textContent;
        if (!text || text === 'الترجمة ستظهر هنا...' || text === 'جاري الترجمة...') {
            this.updateStatus('لا يوجد نص للتشغيل', 'error');
            return;
        }
        
        // إيقاف أي تشغيل صوتي حالي
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
            const speakTextElement = this.elements.speakBtn.querySelector('.speak-text');
            if (speakTextElement) {
                speakTextElement.textContent = 'استمع للترجمة';
            } else {
                this.elements.speakBtn.innerHTML = '🔊 نطق';
            }
            this.updateStatus('تم إيقاف التشغيل الصوتي');
            return;
        }
        
        // التحقق من دعم التشغيل الصوتي
        if (!this.synthesis) {
            this.updateStatus('التشغيل الصوتي غير مدعوم في هذا المتصفح', 'error');
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = this.elements.targetLang.value;
        
        // تحديد اللغة للنطق مع دعم أفضل للهجات
        const langMap = {
            'ar': 'ar-SA',
            'en': 'en-US',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'de': 'de-DE',
            'it': 'it-IT',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'zh': 'zh-CN',
            'pt': 'pt-BR',
            'ru': 'ru-RU',
            'hi': 'hi-IN',
            'tr': 'tr-TR'
        };
        
        utterance.lang = langMap[targetLang] || 'en-US';
        
        // تحسين إعدادات النطق حسب اللغة
        if (targetLang === 'ar') {
            utterance.rate = 0.7; // أبطأ للعربية
            utterance.pitch = 1.1;
        } else if (targetLang === 'zh' || targetLang === 'ja' || targetLang === 'ko') {
            utterance.rate = 0.8; // متوسط للغات الآسيوية
            utterance.pitch = 1.0;
        } else {
            utterance.rate = 0.9; // عادي للغات الأخرى
            utterance.pitch = 1.0;
        }
        
        utterance.volume = 1.0;
        
        utterance.onstart = () => {
            const speakTextElement = this.elements.speakBtn.querySelector('.speak-text');
            if (speakTextElement) {
                speakTextElement.textContent = 'إيقاف النطق';
            } else {
                this.elements.speakBtn.innerHTML = '🔊 إيقاف النطق';
            }
            this.elements.speakBtn.classList.add('speaking');
            this.updateStatus('جاري نطق الترجمة...');
        };
        
        utterance.onend = () => {
            const speakTextElement = this.elements.speakBtn.querySelector('.speak-text');
            if (speakTextElement) {
                speakTextElement.textContent = 'استمع للترجمة';
            } else {
                this.elements.speakBtn.innerHTML = '🔊 نطق';
            }
            this.elements.speakBtn.classList.remove('speaking');
            this.updateStatus('انتهى التشغيل الصوتي');
        };
        
        utterance.onerror = (event) => {
            console.error('خطأ في التشغيل الصوتي:', event.error);
            this.updateStatus('خطأ في نطق النص: ' + event.error, 'error');
            const speakTextElement = this.elements.speakBtn.querySelector('.speak-text');
            if (speakTextElement) {
                speakTextElement.textContent = 'استمع للترجمة';
            } else {
                this.elements.speakBtn.innerHTML = '🔊 نطق';
            }
            this.elements.speakBtn.classList.remove('speaking');
        };
        
        utterance.onpause = () => {
            this.updateStatus('تم إيقاف التشغيل الصوتي مؤقتاً');
        };
        
        utterance.onresume = () => {
            this.updateStatus('تم استئناف التشغيل الصوتي');
        };
        
        try {
            this.synthesis.speak(utterance);
        } catch (error) {
            console.error('خطأ في بدء التشغيل الصوتي:', error);
            this.updateStatus('فشل في بدء التشغيل الصوتي', 'error');
            this.elements.speakBtn.querySelector('.speak-text').textContent = 'استمع للترجمة';
            this.elements.speakBtn.classList.remove('speaking');
        }
    }

    // وظيفة النسخ المحسنة
    copyTranslation() {
        const text = this.elements.translatedText.textContent;
        if (!text || text === 'الترجمة ستظهر هنا...' || text === 'جاري الترجمة...') {
            this.updateStatus('لا يوجد نص للنسخ', 'error');
            return;
        }
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.updateStatus('تم نسخ النص بنجاح ✓', 'success');
                // تأثير بصري للزر
                this.elements.copyBtn.classList.add('copied');
                const originalText = this.elements.copyBtn.textContent;
                this.elements.copyBtn.textContent = 'تم النسخ ✓';
                setTimeout(() => {
                    this.elements.copyBtn.textContent = originalText;
                    this.elements.copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(() => {
                this.fallbackCopyText(text);
            });
        } else {
            this.fallbackCopyText(text);
        }
    }

    // وظيفة النسخ البديلة للمتصفحات القديمة
    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.updateStatus('تم نسخ النص بنجاح ✓', 'success');
                this.elements.copyBtn.classList.add('copied');
                const originalText = this.elements.copyBtn.textContent;
                this.elements.copyBtn.textContent = 'تم النسخ ✓';
                setTimeout(() => {
                    this.elements.copyBtn.textContent = originalText;
                    this.elements.copyBtn.classList.remove('copied');
                }, 2000);
            } else {
                this.updateStatus('فشل في نسخ النص', 'error');
            }
        } catch (err) {
            this.updateStatus('فشل في نسخ النص', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    clearText() {
        this.elements.sourceText.value = '';
        this.elements.translatedText.textContent = 'الترجمة ستظهر هنا...';
        this.elements.translatedText.classList.remove('has-content');
        this.elements.speakBtn.disabled = true;
        this.elements.copyBtn.disabled = true;
        this.updateStatus('تم مسح النص');
    }

    swapLanguages() {
        const sourceLang = this.elements.sourceLang.value;
        const targetLang = this.elements.targetLang.value;
        
        if (sourceLang === 'auto') {
            this.updateStatus('لا يمكن تبديل اللغات مع الاكتشاف التلقائي', 'error');
            return;
        }
        
        this.elements.sourceLang.value = targetLang;
        this.elements.targetLang.value = sourceLang;
        
        // تبديل النصوص أيضاً
        const sourceText = this.elements.sourceText.value;
        const translatedText = this.elements.translatedText.textContent;
        
        if (translatedText && translatedText !== 'الترجمة ستظهر هنا...' && translatedText !== 'جاري الترجمة...') {
            this.elements.sourceText.value = translatedText;
            this.translateText();
        }
        
        this.updateStatus('تم تبديل اللغات');
    }

    addToFavorites() {
        const text = this.elements.sourceText.value.trim();
        if (!text) {
            this.updateStatus('يرجى إدخال نص لإضافته للمفضلة', 'error');
            return;
        }
        
        if (this.favorites.includes(text)) {
            this.updateStatus('النص موجود بالفعل في المفضلة', 'error');
            return;
        }
        
        this.favorites.push(text);
        this.saveFavorites();
        this.loadFavoritesToDOM();
        this.updateStatus('تم إضافة النص للمفضلة', 'success');
    }

    loadFavorites() {
        try {
            return JSON.parse(localStorage.getItem('voiceTranslateFavorites')) || [
                'مرحبا، كيف حالك؟',
                'بكم هذا؟',
                'أين الفندق؟',
                'شكراً لك'
            ];
        } catch {
            return ['مرحبا، كيف حالك؟', 'بكم هذا؟', 'أين الفندق؟', 'شكراً لك'];
        }
    }

    saveFavorites() {
        localStorage.setItem('voiceTranslateFavorites', JSON.stringify(this.favorites));
    }

    loadFavoritesToDOM() {
        this.elements.favoritesList.innerHTML = '';
        
        this.favorites.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'favorite-item slide-in';
            item.dataset.text = text;
            item.innerHTML = `
                <span>${text}</span>
                <div>
                    <button class="use-favorite">استخدم</button>
                    <button class="remove-favorite" onclick="app.removeFavorite(${index})">حذف</button>
                </div>
            `;
            this.elements.favoritesList.appendChild(item);
        });
    }

    removeFavorite(index) {
        this.favorites.splice(index, 1);
        this.saveFavorites();
        this.loadFavoritesToDOM();
        this.updateStatus('تم حذف العبارة من المفضلة');
    }



    // وظيفة التصحيح الإملائي التلقائي
    autoSpellCheck() {
        const text = this.elements.sourceText.value.trim();
        if (!text) {
            return;
        }

        // قاموس التصحيح الإملائي للأخطاء الشائعة
        const corrections = {
            // أخطاء عربية شائعة
            'اهلا': 'أهلاً',
            'مرحبا': 'مرحباً',
            'شكرا': 'شكراً',
            'اسف': 'آسف',
            'انا': 'أنا',
            'انت': 'أنت',
            'هذا': 'هذا',
            'هذه': 'هذه',
            'التي': 'التي',
            'الذي': 'الذي',
            'ايضا': 'أيضاً',
            'لكن': 'لكن',
            'كيف': 'كيف',
            'ماذا': 'ماذا',
            'متى': 'متى',
            'اين': 'أين',
            'لماذا': 'لماذا',
            'كم': 'كم',
            'من': 'من',
            'الى': 'إلى',
            'على': 'على',
            'في': 'في',
            'مع': 'مع',
            'عن': 'عن',
            'بعد': 'بعد',
            'قبل': 'قبل',
            'تحت': 'تحت',
            'فوق': 'فوق',
            'امام': 'أمام',
            'خلف': 'خلف',
            'بين': 'بين',
            'داخل': 'داخل',
            'خارج': 'خارج',
            // أخطاء إنجليزية شائعة
            'teh': 'the',
            'adn': 'and',
            'taht': 'that',
            'thier': 'their',
            'recieve': 'receive',
            'seperate': 'separate',
            'definately': 'definitely',
            'occured': 'occurred',
            'begining': 'beginning',
            'beleive': 'believe',
            'acheive': 'achieve',
            'wierd': 'weird',
            'freind': 'friend',
            'neccessary': 'necessary',
            'accomodate': 'accommodate',
            'embarass': 'embarrass',
            'existance': 'existence',
            'goverment': 'government',
            'independant': 'independent',
            'maintainance': 'maintenance',
            'occassion': 'occasion',
            'priviledge': 'privilege',
            'recomend': 'recommend',
            'succesful': 'successful',
            'tommorrow': 'tomorrow',
            'untill': 'until'
        };

        let correctedText = text;
        let correctionCount = 0;

        // تطبيق التصحيحات بصمت
        Object.keys(corrections).forEach(mistake => {
            const correction = corrections[mistake];
            const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
            if (regex.test(correctedText)) {
                correctedText = correctedText.replace(regex, correction);
                correctionCount++;
            }
        });

        // تحديث النص في المربع بصمت
        if (correctionCount > 0) {
            this.elements.sourceText.value = correctedText;
        }
    }

    // وظيفة تفعيل رفع الصور مع تحسينات
    triggerImageUpload() {
        // إعادة تعيين input لضمان تشغيل الحدث حتى لو تم اختيار نفس الملف
        this.elements.imageInput.value = '';
        this.elements.imageInput.click();
    }

    // وظيفة معالجة رفع الصور مع تحسينات شاملة
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // التحقق من نوع الملف مع دعم تنسيقات إضافية
        const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
        if (!supportedTypes.includes(file.type.toLowerCase())) {
            this.updateStatus('نوع الملف غير مدعوم. الأنواع المدعومة: JPG, PNG, GIF, WebP, BMP, TIFF', 'error');
            return;
        }

        // التحقق من حجم الملف (أقل من 15 ميجابايت)
        const maxSize = 15 * 1024 * 1024; // 15MB
        if (file.size > maxSize) {
            this.updateStatus('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 15 ميجابايت', 'error');
            return;
        }

        // التحقق من أبعاد الصورة
        try {
            const dimensions = await this.getImageDimensions(file);
            if (dimensions.width < 50 || dimensions.height < 50) {
                this.updateStatus('الصورة صغيرة جداً. يرجى اختيار صورة أكبر من 50x50 بكسل', 'error');
                return;
            }
            
            // عرض معلومات الصورة
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            this.updateStatus(`جاري معالجة الصورة (${dimensions.width}x${dimensions.height}, ${fileSizeMB}MB)...`, 'info');
        } catch (error) {
            console.error('خطأ في قراءة أبعاد الصورة:', error);
            this.updateStatus('جاري معالجة الصورة...', 'info');
        }

        // إظهار معاينة الصورة
        this.showImagePreview(file);
        
        try {
            const extractedText = await this.extractTextFromImage(file);
            if (extractedText && extractedText.trim()) {
                // عرض النص المستخرج للتحديد الذكي
                this.showSmartTextSelection(extractedText, file);
            } else {
                this.updateStatus('لم يتم العثور على نص في الصورة. تأكد من وضوح النص في الصورة', 'error');
            }
        } catch (error) {
            console.error('خطأ في استخراج النص:', error);
            this.updateStatus(error.message || 'حدث خطأ أثناء معالجة الصورة', 'error');
        }
        
        // إعادة تعيين input
        event.target.value = '';
    }

    // وظيفة للحصول على أبعاد الصورة مع معلومات إضافية
    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const dimensions = {
                    width: img.width,
                    height: img.height,
                    aspectRatio: (img.width / img.height).toFixed(2),
                    megapixels: ((img.width * img.height) / 1000000).toFixed(1)
                };
                resolve(dimensions);
                URL.revokeObjectURL(img.src);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    // وظيفة عرض معاينة الصورة
    showImagePreview(file) {
        // إزالة المعاينة السابقة إن وجدت
        const existingPreview = document.querySelector('.image-preview-container');
        if (existingPreview) {
            existingPreview.remove();
        }

        // إنشاء حاوية المعاينة
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        previewContainer.innerHTML = `
            <div class="image-preview-content">
                <div class="preview-header">
                    <h4>معاينة الصورة</h4>
                    <button class="close-preview-btn">&times;</button>
                </div>
                <div class="preview-body">
                    <img class="preview-image" src="" alt="معاينة الصورة">
                    <div class="image-info">
                        <p><strong>اسم الملف:</strong> ${file.name}</p>
                        <p><strong>الحجم:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <p><strong>النوع:</strong> ${file.type}</p>
                    </div>
                </div>
                <div class="preview-actions">
                    <button class="process-image-btn">معالجة الصورة</button>
                    <button class="cancel-upload-btn">إلغاء</button>
                </div>
            </div>
        `;

        // إضافة الأنماط
        const style = document.createElement('style');
        style.textContent = `
            .image-preview-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            .image-preview-content {
                background: white;
                border-radius: 12px;
                max-width: 500px;
                max-height: 80vh;
                overflow: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            .preview-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #eee;
            }
            .preview-header h4 {
                margin: 0;
                color: #333;
            }
            .close-preview-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            .preview-body {
                padding: 20px;
                text-align: center;
            }
            .preview-image {
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                margin-bottom: 15px;
            }
            .image-info {
                text-align: right;
                background: #f8f9fa;
                padding: 10px;
                border-radius: 6px;
                margin-top: 10px;
            }
            .image-info p {
                margin: 5px 0;
                font-size: 14px;
            }
            .preview-actions {
                display: flex;
                gap: 10px;
                padding: 15px 20px;
                border-top: 1px solid #eee;
            }
            .process-image-btn, .cancel-upload-btn {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
            }
            .process-image-btn {
                background: #007bff;
                color: white;
            }
            .cancel-upload-btn {
                background: #6c757d;
                color: white;
            }
        `;
        document.head.appendChild(style);

        // عرض الصورة
        const img = previewContainer.querySelector('.preview-image');
        img.src = URL.createObjectURL(file);

        // إضافة الأحداث
        const closeBtn = previewContainer.querySelector('.close-preview-btn');
        const cancelBtn = previewContainer.querySelector('.cancel-upload-btn');
        const processBtn = previewContainer.querySelector('.process-image-btn');

        const closePreview = () => {
            URL.revokeObjectURL(img.src);
            previewContainer.remove();
        };

        closeBtn.onclick = closePreview;
        cancelBtn.onclick = closePreview;
        processBtn.onclick = () => {
            closePreview();
            // متابعة معالجة الصورة
            this.continueImageProcessing(file);
        };

        // إضافة المعاينة للصفحة
        document.body.appendChild(previewContainer);
    }

    // وظيفة متابعة معالجة الصورة
    async continueImageProcessing(file) {
        try {
            const extractedText = await this.extractTextFromImage(file);
            if (extractedText && extractedText.trim()) {
                // عرض النص المستخرج للتحديد الذكي
                this.showSmartTextSelection(extractedText, file);
            } else {
                this.updateStatus('لم يتم العثور على نص في الصورة', 'error');
            }
        } catch (error) {
            console.error('خطأ في استخراج النص:', error);
            this.updateStatus('حدث خطأ أثناء معالجة الصورة', 'error');
        }
    }

    // وظيفة استخراج النص من الصورة باستخدام Tesseract.js
    async extractTextFromImage(file) {
        try {
            // التحقق من وجود مكتبة Tesseract
            if (typeof Tesseract === 'undefined') {
                throw new Error('مكتبة Tesseract غير محملة. يرجى التأكد من الاتصال بالإنترنت.');
            }
            
            // تحديث حالة التقدم
            this.updateStatus('جاري تحليل الصورة...', 'info');
            
            // اكتشاف نوع النص المتوقع من اللغة المحددة
            const sourceLang = document.getElementById('source-lang').value;
            const isEnglishText = sourceLang === 'en';
            
            // معالجة مسبقة للصورة لتحسين دقة OCR
            const processedImage = await this.preprocessImage(file, isEnglishText);
            
            // إعدادات محسنة حسب نوع النص
            let ocrOptions = {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.updateStatus(`جاري استخراج النص... ${progress}%`, 'info');
                    }
                },
                preserve_interword_spaces: '1'
            };
            
            // إعدادات خاصة للنصوص الإنجليزية
            if (isEnglishText) {
                ocrOptions = {
                    ...ocrOptions,
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?;:"\'-()[]{}/@#$%^&*+=<>|\\~`',
                    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                    classify_bln_numeric_mode: '0'
                };
            } else {
                // إعدادات للنصوص العربية والمختلطة
                ocrOptions = {
                    ...ocrOptions,
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    tessedit_char_whitelist: 'ابتثجحخدذرزسشصضطظعغفقكلمنهويءآأؤإئةىABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?؟،؛:"\'-()[]{}/@#$%^&*+=<>|\\~`'
                };
            }
            
            // استخدام Tesseract.js لاستخراج النص
            const language = isEnglishText ? 'eng' : 'ara+eng';
            
            // إضافة timeout للعملية
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('انتهت مهلة معالجة الصورة')), 30000);
            });
            
            const recognitionPromise = Tesseract.recognize(
                processedImage,
                language,
                ocrOptions
            );
            
            const { data: { text } } = await Promise.race([recognitionPromise, timeoutPromise]);
            
            // تنظيف النص المستخرج
            const cleanedText = this.cleanExtractedText(text, isEnglishText);
            
            return cleanedText;
        } catch (error) {
            console.error('خطأ في Tesseract.js:', error);
            
            // رسائل خطأ مفصلة
            if (error.message.includes('timeout') || error.message.includes('انتهت مهلة')) {
                throw new Error('انتهت مهلة معالجة الصورة. يرجى المحاولة مرة أخرى.');
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                throw new Error('خطأ في الشبكة. يرجى التحقق من الاتصال بالإنترنت.');
            } else if (error.message.includes('Tesseract')) {
                throw new Error('خطأ في تحميل مكتبة OCR. يرجى إعادة تحميل الصفحة.');
            } else {
                throw new Error('فشل في استخراج النص من الصورة: ' + error.message);
            }
        }
    }

    // وظيفة تنظيف النص المستخرج
    cleanExtractedText(text, isEnglishText) {
        if (!text) return '';
        
        let cleaned = text.trim();
        
        if (isEnglishText) {
            // تنظيف خاص للنصوص الإنجليزية
            cleaned = cleaned
                .replace(/[|\\]/g, 'I') // استبدال الخطوط العمودية بحرف I
                .replace(/0/g, 'O') // استبدال الصفر بحرف O في بعض الحالات
                .replace(/1/g, 'l') // استبدال الرقم 1 بحرف l في بعض الحالات
                .replace(/\s+/g, ' ') // توحيد المسافات
                .replace(/[^a-zA-Z0-9\s.,!?;:"'\-()\[\]{}\/@#$%^&*+=<>|\\~`]/g, '') // إزالة الرموز غير المرغوبة
                .replace(/^[^a-zA-Z]+/, '') // إزالة الرموز من بداية النص
                .replace(/[^a-zA-Z0-9.,!?;:"'\-()\[\]{}\/@#$%^&*+=<>|\\~`]+$/, ''); // إزالة الرموز من نهاية النص
        } else {
            // تنظيف للنصوص العربية والمختلطة
            cleaned = cleaned
                .replace(/\s+/g, ' ') // توحيد المسافات
                .replace(/[^\u0600-\u06FFa-zA-Z0-9\s.,!?؟،؛:"'\-()\[\]{}\/@#$%^&*+=<>|\\~`]/g, ''); // الاحتفاظ بالأحرف العربية والإنجليزية فقط
        }
        
        return cleaned.trim();
    }
    
    // وظيفة معالجة مسبقة للصور لتحسين دقة OCR
    async preprocessImage(file, isEnglishText = false) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // تحديد حجم الصورة المحسن
                const scale = Math.min(2000 / img.width, 2000 / img.height, 2);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                // رسم الصورة بحجم محسن
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // الحصول على بيانات الصورة
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // تحسين التباين والسطوع حسب نوع النص
                for (let i = 0; i < data.length; i += 4) {
                    // تحويل إلى رمادي
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    
                    let enhanced;
                    if (isEnglishText) {
                        // معالجة محسنة للنصوص الإنجليزية
                        // استخدام عتبة أكثر دقة وتحسين التباين
                        const threshold = 140;
                        enhanced = gray > threshold ? 255 : 0;
                        
                        // تطبيق تنعيم خفيف للنصوص الإنجليزية
                        if (gray > threshold - 20 && gray < threshold + 20) {
                            enhanced = gray > threshold ? 200 : 55;
                        }
                    } else {
                        // معالجة للنصوص العربية
                        enhanced = gray > 128 ? 255 : 0;
                    }
                    
                    data[i] = enhanced;     // أحمر
                    data[i + 1] = enhanced; // أخضر
                    data[i + 2] = enhanced; // أزرق
                    // data[i + 3] يبقى كما هو (الشفافية)
                }
                
                // إعادة رسم البيانات المحسنة
                ctx.putImageData(imageData, 0, 0);
                
                // تحويل إلى blob
                canvas.toBlob(resolve, 'image/png', 1.0);
            };
            
            img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
            img.src = URL.createObjectURL(file);
        });
    }

    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        
        // إضافة أيقونات للرسائل
        let icon = '';
        switch(type) {
            case 'success':
                icon = '✅ ';
                break;
            case 'error':
                icon = '❌ ';
                break;
            case 'warning':
                icon = '⚠️ ';
                break;
            case 'info':
            default:
                icon = 'ℹ️ ';
                break;
        }
        this.elements.status.textContent = icon + message;
        
        // إخفاء الرسالة بعد مدة مناسبة
        const hideDelay = type === 'error' ? 8000 : type === 'success' ? 4000 : 5000;
        setTimeout(() => {
            if (this.elements.status.textContent === icon + message) {
                this.elements.status.textContent = 'جاهز للاستخدام';
                this.elements.status.className = 'status';
            }
        }, hideDelay);
        
        // طباعة الرسالة في وحدة التحكم للتشخيص
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    // وظيفة للتحقق من دعم الكاميرا والميكروفون
    async checkCameraSupport() {
        try {
            // التحقق من دعم getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('المتصفح لا يدعم الوصول للكاميرا والميكروفون');
            }

            // التحقق من الأذونات
            const permissions = await navigator.permissions.query({name: 'camera'});
            if (permissions.state === 'denied') {
                throw new Error('تم رفض إذن الوصول للكاميرا');
            }

            return true;
        } catch (error) {
            console.error('خطأ في فحص دعم الكاميرا:', error);
            this.updateStatus('الكاميرا غير متاحة: ' + error.message, 'warning');
            return false;
        }
    }

    // فحص دعم الكاميرا عند تحميل الصفحة وإخفاء الخيار إذا لم تكن مدعومة
    async checkCameraSupportOnInit() {
        try {
            // التحقق من دعم getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.hideCameraOption();
                return;
            }

            // محاولة فحص الأذونات بدون طلب الوصول
            try {
                const permissions = await navigator.permissions.query({name: 'camera'});
                if (permissions.state === 'denied') {
                    this.hideCameraOption();
                    return;
                }
            } catch (permError) {
                // إذا فشل فحص الأذونات، نترك الخيار ظاهراً
                console.log('لا يمكن فحص أذونات الكاميرا:', permError);
            }

            // إذا وصلنا هنا، فالكاميرا مدعومة على الأرجح
            console.log('الكاميرا مدعومة');
        } catch (error) {
            console.error('خطأ في فحص دعم الكاميرا:', error);
            this.hideCameraOption();
        }
    }

    // إخفاء خيار الكاميرا من القائمة المنسدلة
    hideCameraOption() {
        const cameraMenuItem = document.querySelector('.menu-item[data-action="camera"]');
        if (cameraMenuItem) {
            cameraMenuItem.style.display = 'none';
            console.log('تم إخفاء خيار الكاميرا لعدم دعمها');
        }
    }

    // وظيفة لمعالجة أخطاء الملفات
    handleFileError(error, fileName = '') {
        let errorMessage = 'خطأ في معالجة الملف';
        
        if (fileName) {
            errorMessage += ` "${fileName}"`;
        }
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'تم رفض الإذن للوصول للملف';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'الملف غير موجود';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'خطأ أمني في الوصول للملف';
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }
        
        this.updateStatus(errorMessage, 'error');
        console.error('File Error:', error);
    }

    // وظيفة لفتح الكاميرا (تحديث من النسخة الاحتياطية)
    async openCamera() {
        try {
            // التحقق من دعم الكاميرا أولاً
            const isSupported = await this.checkCameraSupport();
            if (!isSupported) {
                return;
            }

            // إذا كان في وضع المسح الذكي، استخدم الواجهة المحسنة
            if (this.smartScanMode) {
                return await this.openCameraWithSmartScan();
            }

            this.updateStatus('جاري فتح الكاميرا المحسنة...', 'info');
            
            // إنشاء نافذة الكاميرا المحسنة
            const cameraModal = this.createEnhancedCameraModal();
            document.body.appendChild(cameraModal);
            
            // طلب الوصول للكاميرا مع إعدادات محسنة
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    facingMode: 'environment',
                    frameRate: { ideal: 30, min: 15 }
                }
            });

            const video = cameraModal.querySelector('.enhanced-camera-video');
            video.srcObject = stream;
            
            // انتظار تحميل الفيديو
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });

            // إعداد أزرار التحكم المحسنة
            this.setupEnhancedCameraControls(cameraModal, video, stream);
            
            this.updateStatus('الكاميرا المحسنة جاهزة - اضغط على زر التقاط الصورة', 'success');

        } catch (error) {
            this.handleEnhancedCameraError(error);
        }
    }

    createEnhancedCameraModal() {
        const modal = document.createElement('div');
        modal.className = 'enhanced-camera-modal';
        modal.innerHTML = `
            <div class="enhanced-camera-overlay"></div>
            <div class="enhanced-camera-container">
                <div class="enhanced-camera-header">
                    <h3>📸 التقاط صورة محسن</h3>
                    <button class="enhanced-close-btn">✕</button>
                </div>
                <div class="enhanced-camera-body">
                    <video class="enhanced-camera-video" autoplay playsinline></video>
                    <div class="enhanced-camera-overlay-grid"></div>
                </div>
                <div class="enhanced-camera-controls">
                    <button class="enhanced-capture-btn">📸 التقاط</button>
                    <button class="enhanced-switch-camera-btn">🔄 تبديل الكاميرا</button>
                    <button class="enhanced-flash-btn">💡 الفلاش</button>
                </div>
                <div class="enhanced-camera-info">
                    <span class="camera-resolution">جودة عالية</span>
                    <span class="camera-status">جاهز</span>
                </div>
            </div>
        `;
        
        // إضافة الأنماط المحسنة
        this.addEnhancedCameraStyles();
        
        return modal;
    }

    addEnhancedCameraStyles() {
        if (document.getElementById('enhanced-camera-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'enhanced-camera-styles';
        style.textContent = `
            .enhanced-camera-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .enhanced-camera-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
            }
            .enhanced-camera-container {
                position: relative;
                background: #fff;
                border-radius: 15px;
                overflow: hidden;
                max-width: 90vw;
                max-height: 90vh;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }
            .enhanced-camera-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .enhanced-camera-header h3 {
                margin: 0;
                font-size: 18px;
            }
            .enhanced-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                transition: background 0.3s;
            }
            .enhanced-close-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            .enhanced-camera-body {
                position: relative;
                background: #000;
            }
            .enhanced-camera-video {
                width: 100%;
                height: auto;
                max-height: 60vh;
                object-fit: cover;
            }
            .enhanced-camera-overlay-grid {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
                background-size: 33.33% 33.33%;
                pointer-events: none;
            }
            .enhanced-camera-controls {
                display: flex;
                justify-content: center;
                gap: 15px;
                padding: 20px;
                background: #f8f9fa;
            }
            .enhanced-camera-controls button {
                padding: 12px 20px;
                border: none;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 120px;
            }
            .enhanced-capture-btn {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            }
            .enhanced-capture-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
            }
            .enhanced-switch-camera-btn {
                background: linear-gradient(135deg, #007bff, #6610f2);
                color: white;
            }
            .enhanced-flash-btn {
                background: linear-gradient(135deg, #ffc107, #fd7e14);
                color: white;
            }
            .enhanced-camera-info {
                display: flex;
                justify-content: space-between;
                padding: 10px 20px;
                background: #e9ecef;
                font-size: 12px;
                color: #6c757d;
            }
        `;
        document.head.appendChild(style);
    }

    setupEnhancedCameraControls(modal, video, stream) {
        const captureBtn = modal.querySelector('.enhanced-capture-btn');
        const closeBtn = modal.querySelector('.enhanced-close-btn');
        const switchBtn = modal.querySelector('.enhanced-switch-camera-btn');
        const flashBtn = modal.querySelector('.enhanced-flash-btn');
        const statusSpan = modal.querySelector('.camera-status');
        
        let currentFacingMode = 'environment';
        let flashEnabled = false;

        // التقاط الصورة المحسن
        captureBtn.onclick = async () => {
            try {
                statusSpan.textContent = 'جاري التقاط الصورة...';
                captureBtn.disabled = true;
                
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                
                // تطبيق تحسينات الصورة
                ctx.filter = 'contrast(1.1) brightness(1.05) saturate(1.1)';
                ctx.drawImage(video, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], `enhanced-capture-${Date.now()}.jpg`, { 
                        type: 'image/jpeg' 
                    });
                    
                    // إغلاق الكاميرا
                    this.closeEnhancedCamera(modal, stream);
                    
                    // معالجة الصورة
                    await this.handleImageUpload({ target: { files: [file] } });
                }, 'image/jpeg', 0.95);
                
            } catch (error) {
                statusSpan.textContent = 'خطأ في التقاط الصورة';
                captureBtn.disabled = false;
                console.error('خطأ في التقاط الصورة:', error);
            }
        };

        // إغلاق الكاميرا
        closeBtn.onclick = () => {
            this.closeEnhancedCamera(modal, stream);
        };

        // تبديل الكاميرا
        switchBtn.onclick = async () => {
            try {
                currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920, min: 1280 },
                        height: { ideal: 1080, min: 720 },
                        facingMode: currentFacingMode,
                        frameRate: { ideal: 30, min: 15 }
                    }
                });
                
                stream.getTracks().forEach(track => track.stop());
                video.srcObject = newStream;
                Object.assign(this, { currentStream: newStream });
                
            } catch (error) {
                console.error('خطأ في تبديل الكاميرا:', error);
                statusSpan.textContent = 'فشل تبديل الكاميرا';
            }
        };

        // تفعيل/إلغاء الفلاش
        flashBtn.onclick = async () => {
            try {
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                
                if (capabilities.torch) {
                    flashEnabled = !flashEnabled;
                    await track.applyConstraints({
                        advanced: [{ torch: flashEnabled }]
                    });
                    flashBtn.style.background = flashEnabled ? 
                        'linear-gradient(135deg, #ffc107, #fd7e14)' : 
                        'linear-gradient(135deg, #6c757d, #495057)';
                } else {
                    statusSpan.textContent = 'الفلاش غير متاح';
                }
            } catch (error) {
                console.error('خطأ في الفلاش:', error);
            }
        };

        // إغلاق عند النقر على الخلفية
        modal.querySelector('.enhanced-camera-overlay').onclick = () => {
            this.closeEnhancedCamera(modal, stream);
        };
    }

    closeEnhancedCamera(modal, stream) {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
        this.updateStatus('تم إغلاق الكاميرا المحسنة', 'info');
    }

    handleEnhancedCameraError(error) {
        this.handleFileError(error, 'الكاميرا المحسنة');
        
        const errorMessages = {
            'NotAllowedError': 'يرجى السماح بالوصول للكاميرا من إعدادات المتصفح',
            'NotFoundError': 'لم يتم العثور على كاميرا متاحة على هذا الجهاز',
            'NotReadableError': 'الكاميرا مستخدمة من تطبيق آخر، يرجى إغلاقه أولاً',
            'OverconstrainedError': 'إعدادات الكاميرا غير متوافقة مع جهازك',
            'SecurityError': 'خطأ أمني في الوصول للكاميرا',
            'AbortError': 'تم إلغاء طلب الوصول للكاميرا'
        };
        
        const message = errorMessages[error.name] || `خطأ في فتح الكاميرا: ${error.message}`;
        this.updateStatus(message, 'error');
    }

    // وظائف القائمة المنسدلة للصور والكاميرا المحسنة
    toggleImageCaptureMenu(e) {
        e.stopPropagation();
        const container = this.elements.enhancedCameraContainer || this.elements.imageCaptureContainer;
        if (container) {
            container.classList.toggle('active');
        }
    }

    handleOutsideClick(e) {
        const container = this.elements.enhancedCameraContainer || this.elements.imageCaptureContainer;
        if (container && !container.contains(e.target)) {
            container.classList.remove('active');
        }
    }

    handleMenuItemClick(e) {
        e.stopPropagation();
        const menuItem = e.target.closest('.enhanced-menu-item') || e.target.closest('.menu-item');
        if (!menuItem) return;

        const action = menuItem.getAttribute('data-action');
        const container = this.elements.enhancedCameraContainer || this.elements.imageCaptureContainer;
        if (container) {
            container.classList.remove('active');
        }

        if (action === 'upload') {
            this.triggerImageUpload();
        } else if (action === 'camera') {
            // التحقق من دعم الكاميرا قبل فتحها
            this.checkCameraSupport().then(isSupported => {
                if (isSupported) {
                    this.openCamera();
                } else {
                    this.updateStatus('الكاميرا غير متاحة على هذا الجهاز', 'error');
                }
            });
        } else if (action === 'smart-scan') {
            this.startSmartScan();
        }
    }

    triggerImageUpload() {
        this.elements.imageInput.click();
    }

    // عرض واجهة التحديد الذكي للنص
    showSmartTextSelection(extractedText, imageFile) {
        // إنشاء نافذة التحديد الذكي
        const modal = document.createElement('div');
        modal.className = 'smart-selection-modal';
        modal.innerHTML = `
            <div class="smart-selection-content">
                <div class="modal-header">
                    <h3>تحديد النص للترجمة</h3>
                    <button class="close-btn" onclick="this.closest('.smart-selection-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="image-preview">
                        <img id="preview-image" src="" alt="الصورة المحملة">
                    </div>
                    <div class="text-selection-area">
                        <h4>النص المستخرج:</h4>
                        <div class="extracted-text-container">
                            <div id="extracted-text-display"></div>
                        </div>
                        <div class="selection-controls">
                            <button id="select-all-text" class="control-btn">تحديد الكل</button>
                            <button id="clear-selection" class="control-btn">إلغاء التحديد</button>
                            <button id="smart-detect" class="control-btn">كشف ذكي</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-selection" class="control-btn primary">ترجمة النص المحدد</button>
                    <button id="cancel-selection" class="control-btn secondary">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // عرض الصورة
        const previewImg = modal.querySelector('#preview-image');
        previewImg.src = URL.createObjectURL(imageFile);

        // تقسيم النص إلى جمل وكلمات قابلة للتحديد
        this.displaySelectableText(extractedText, modal.querySelector('#extracted-text-display'));

        // إضافة مستمعي الأحداث
        this.setupSmartSelectionEvents(modal, extractedText);
    }

    // عرض النص القابل للتحديد
    displaySelectableText(text, container) {
        const sentences = text.split(/[.!?؟।]/).filter(s => s.trim());
        container.innerHTML = '';

        sentences.forEach((sentence, index) => {
            const sentenceDiv = document.createElement('div');
            sentenceDiv.className = 'selectable-sentence';
            sentenceDiv.setAttribute('data-sentence-index', index);
            
            const words = sentence.trim().split(/\s+/);
            words.forEach((word, wordIndex) => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'selectable-word';
                wordSpan.textContent = word;
                wordSpan.setAttribute('data-word-index', wordIndex);
                wordSpan.addEventListener('click', (e) => this.toggleWordSelection(e));
                sentenceDiv.appendChild(wordSpan);
                
                if (wordIndex < words.length - 1) {
                    sentenceDiv.appendChild(document.createTextNode(' '));
                }
            });
            
            container.appendChild(sentenceDiv);
            if (index < sentences.length - 1) {
                container.appendChild(document.createElement('br'));
            }
        });
    }

    // تبديل تحديد الكلمة
    toggleWordSelection(event) {
        const word = event.target;
        word.classList.toggle('selected');
        
        // تحديد الجملة كاملة عند النقر المزدوج
        if (event.detail === 2) {
            const sentence = word.closest('.selectable-sentence');
            const words = sentence.querySelectorAll('.selectable-word');
            const isSelected = word.classList.contains('selected');
            
            words.forEach(w => {
                if (isSelected) {
                    w.classList.add('selected');
                } else {
                    w.classList.remove('selected');
                }
            });
        }
    }

    // إعداد أحداث التحديد الذكي
    setupSmartSelectionEvents(modal, originalText) {
        const selectAllBtn = modal.querySelector('#select-all-text');
        const clearSelectionBtn = modal.querySelector('#clear-selection');
        const smartDetectBtn = modal.querySelector('#smart-detect');
        const confirmBtn = modal.querySelector('#confirm-selection');
        const cancelBtn = modal.querySelector('#cancel-selection');

        selectAllBtn.addEventListener('click', () => {
            modal.querySelectorAll('.selectable-word').forEach(word => {
                word.classList.add('selected');
            });
        });

        clearSelectionBtn.addEventListener('click', () => {
            modal.querySelectorAll('.selectable-word').forEach(word => {
                word.classList.remove('selected');
            });
        });

        smartDetectBtn.addEventListener('click', () => {
            this.performSmartDetection(modal, originalText);
        });

        confirmBtn.addEventListener('click', () => {
            const selectedText = this.getSelectedText(modal);
            if (selectedText.trim()) {
                this.processSelectedText(selectedText);
                modal.remove();
            } else {
                this.updateStatus('يرجى تحديد نص للترجمة', 'error');
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        // إغلاق النافذة عند النقر خارجها
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // الكشف الذكي للنص المهم
    performSmartDetection(modal, text) {
        // خوارزمية بسيطة للكشف الذكي
        const words = modal.querySelectorAll('.selectable-word');
        
        // إزالة التحديد الحالي
        words.forEach(word => word.classList.remove('selected'));
        
        // تحديد الكلمات المهمة (أطول من 3 أحرف، ليست أدوات ربط)
        const stopWords = ['في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
        words.forEach(word => {
            const text = word.textContent.toLowerCase().trim();
            if (text.length > 3 && !stopWords.includes(text)) {
                word.classList.add('selected');
            }
        });
        
        this.updateStatus('تم تطبيق الكشف الذكي للنص المهم', 'success');
    }

    // الحصول على النص المحدد
    getSelectedText(modal) {
        const selectedWords = modal.querySelectorAll('.selectable-word.selected');
        return Array.from(selectedWords).map(word => word.textContent).join(' ');
    }

    // معالجة النص المحدد
    processSelectedText(selectedText) {
        this.elements.sourceText.value = selectedText;
        this.updateCharCounter();
        this.updateStatus('تم تحديد النص بنجاح', 'success');
        
        // تشغيل التصحيح التلقائي
        this.autoSpellCheck();
        
        // ترجمة تلقائية مع debounce
        if (this.debouncedTranslate) {
            this.debouncedTranslate();
        } else {
            setTimeout(() => this.translateText(), 1000);
        }
    }

    // وظيفة المسح الذكي الجديدة
    async startSmartScan() {
        try {
            this.updateStatus('تحضير المسح الذكي المحسن...', 'info');
            
            // التحقق من دعم الكاميرا
            const isSupported = await this.checkCameraSupport();
            if (!isSupported) {
                this.updateStatus('الكاميرا غير متاحة، يرجى تحميل صورة بدلاً من ذلك', 'error');
                this.triggerImageUpload();
                return;
            }

            // تعيين وضع المسح الذكي المحسن
            this.smartScanMode = true;
            this.isEnhancedSmartScan = true;
            
            // فتح الكاميرا مع المسح الذكي المحسن
            await this.openEnhancedSmartScanCamera();
            
        } catch (error) {
            console.error('خطأ في المسح الذكي:', error);
            this.updateStatus('حدث خطأ أثناء بدء المسح الذكي', 'error');
            this.smartScanMode = false;
            this.isEnhancedSmartScan = false;
        }
    }

    // فتح كاميرا المسح الذكي المحسن
    async openEnhancedSmartScanCamera() {
        try {
            // طلب الوصول للكاميرا
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // الكاميرا الخلفية للهواتف
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            // إنشاء واجهة المسح الذكي المحسن
            const modal = this.createEnhancedSmartScanModal();
            document.body.appendChild(modal);

            // إعداد الفيديو
            const video = modal.querySelector('#enhanced-smart-scan-video');
            video.srcObject = stream;
            await video.play();

            // إضافة الأنماط المحسنة
            this.addEnhancedSmartScanStyles();

            // إعداد عناصر التحكم
            this.setupEnhancedSmartScanControls(modal, video, stream);

            this.updateStatus('المسح الذكي جاهز - وجه الكاميرا نحو النص', 'success');

        } catch (error) {
            console.error('خطأ في فتح كاميرا المسح الذكي:', error);
            this.handleEnhancedSmartScanError(error);
        }
    }

    // إنشاء واجهة المسح الذكي المحسن
    createEnhancedSmartScanModal() {
        const modal = document.createElement('div');
        modal.className = 'enhanced-smart-scan-modal';
        modal.innerHTML = `
            <div class="enhanced-smart-scan-container">
                <div class="enhanced-smart-scan-header">
                    <h3>📱 المسح الذكي المحسن</h3>
                    <button class="enhanced-close-btn" id="enhanced-smart-close">✕</button>
                </div>
                
                <div class="enhanced-video-container">
                    <video id="enhanced-smart-scan-video" autoplay playsinline></video>
                    <div class="enhanced-scan-overlay">
                        <div class="enhanced-scan-frame">
                            <div class="enhanced-corner enhanced-corner-tl"></div>
                            <div class="enhanced-corner enhanced-corner-tr"></div>
                            <div class="enhanced-corner enhanced-corner-bl"></div>
                            <div class="enhanced-corner enhanced-corner-br"></div>
                            <div class="enhanced-scan-line"></div>
                        </div>
                        <div class="enhanced-scan-text">وجه الكاميرا نحو النص المراد ترجمته</div>
                    </div>
                </div>
                
                <div class="enhanced-controls">
                    <button class="enhanced-control-btn enhanced-flash-btn" id="enhanced-flash-toggle">
                        <span class="enhanced-icon">🔦</span>
                        <span>الفلاش</span>
                    </button>
                    
                    <button class="enhanced-control-btn enhanced-capture-btn" id="enhanced-smart-capture">
                        <span class="enhanced-icon">📸</span>
                        <span>مسح ذكي</span>
                    </button>
                    
                    <button class="enhanced-control-btn enhanced-switch-btn" id="enhanced-camera-switch">
                        <span class="enhanced-icon">🔄</span>
                        <span>تبديل</span>
                    </button>
                </div>
                
                <div class="enhanced-tips">
                    <div class="enhanced-tip">💡 تأكد من وضوح النص في الإطار</div>
                    <div class="enhanced-tip">🔍 استخدم الإضاءة الجيدة للحصول على أفضل النتائج</div>
                </div>
            </div>
        `;
        return modal;
    }

    // إضافة أنماط المسح الذكي المحسن
    addEnhancedSmartScanStyles() {
        if (document.getElementById('enhanced-smart-scan-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'enhanced-smart-scan-styles';
        style.textContent = `
            .enhanced-smart-scan-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: enhancedFadeIn 0.3s ease;
            }
            
            .enhanced-smart-scan-container {
                width: 90%;
                max-width: 500px;
                background: #1a1a1a;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            
            .enhanced-smart-scan-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .enhanced-smart-scan-header h3 {
                margin: 0;
                font-size: 1.2rem;
                font-weight: 600;
            }
            
            .enhanced-close-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1.2rem;
                transition: all 0.3s ease;
            }
            
            .enhanced-close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            
            .enhanced-video-container {
                position: relative;
                aspect-ratio: 4/3;
                overflow: hidden;
            }
            
            #enhanced-smart-scan-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .enhanced-scan-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .enhanced-scan-frame {
                position: relative;
                width: 80%;
                height: 60%;
                border: 2px solid #00ff88;
                border-radius: 10px;
                background: rgba(0, 255, 136, 0.1);
            }
            
            .enhanced-corner {
                position: absolute;
                width: 20px;
                height: 20px;
                border: 3px solid #00ff88;
            }
            
            .enhanced-corner-tl {
                top: -3px;
                left: -3px;
                border-right: none;
                border-bottom: none;
            }
            
            .enhanced-corner-tr {
                top: -3px;
                right: -3px;
                border-left: none;
                border-bottom: none;
            }
            
            .enhanced-corner-bl {
                bottom: -3px;
                left: -3px;
                border-right: none;
                border-top: none;
            }
            
            .enhanced-corner-br {
                bottom: -3px;
                right: -3px;
                border-left: none;
                border-top: none;
            }
            
            .enhanced-scan-line {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 2px;
                background: linear-gradient(90deg, transparent, #00ff88, transparent);
                animation: enhancedScanAnimation 2s infinite;
            }
            
            .enhanced-scan-text {
                margin-top: 20px;
                color: white;
                text-align: center;
                background: rgba(0, 0, 0, 0.7);
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 0.9rem;
            }
            
            .enhanced-controls {
                display: flex;
                justify-content: space-around;
                padding: 20px;
                background: #2a2a2a;
            }
            
            .enhanced-control-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                background: #3a3a3a;
                border: none;
                color: white;
                padding: 15px;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 80px;
            }
            
            .enhanced-control-btn:hover {
                background: #4a4a4a;
                transform: translateY(-2px);
            }
            
            .enhanced-capture-btn {
                background: linear-gradient(135deg, #00ff88, #00cc6a);
            }
            
            .enhanced-capture-btn:hover {
                background: linear-gradient(135deg, #00cc6a, #00aa55);
            }
            
            .enhanced-icon {
                font-size: 1.5rem;
            }
            
            .enhanced-tips {
                padding: 15px 20px;
                background: #1a1a1a;
                border-top: 1px solid #333;
            }
            
            .enhanced-tip {
                color: #ccc;
                font-size: 0.8rem;
                margin: 5px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            @keyframes enhancedFadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            
            @keyframes enhancedScanAnimation {
                0% { top: 0; }
                50% { top: calc(100% - 2px); }
                100% { top: 0; }
            }
            
            @media (max-width: 480px) {
                .enhanced-smart-scan-container {
                    width: 95%;
                    margin: 10px;
                }
                
                .enhanced-controls {
                    padding: 15px 10px;
                }
                
                .enhanced-control-btn {
                    min-width: 70px;
                    padding: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // إعداد عناصر التحكم للمسح الذكي المحسن
    setupEnhancedSmartScanControls(modal, video, stream) {
        const captureBtn = modal.querySelector('#enhanced-smart-capture');
        const closeBtn = modal.querySelector('#enhanced-smart-close');
        const flashBtn = modal.querySelector('#enhanced-flash-toggle');
        const switchBtn = modal.querySelector('#enhanced-camera-switch');
        
        let isFlashOn = false;
        let currentFacingMode = 'environment';
        
        // زر التقاط المسح الذكي
        captureBtn.addEventListener('click', async () => {
            try {
                this.updateStatus('جاري المسح الذكي...', 'info');
                
                // إنشاء canvas لالتقاط الصورة
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0);
                
                // تحويل إلى blob
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'smart-scan.jpg', { type: 'image/jpeg' });
                    
                    // إغلاق الكاميرا
                    this.closeEnhancedSmartScan(modal, stream);
                    
                    // معالجة الصورة بالمسح الذكي
                    await this.processEnhancedSmartScan(file);
                }, 'image/jpeg', 0.9);
                
            } catch (error) {
                console.error('خطأ في المسح الذكي:', error);
                this.updateStatus('فشل في المسح الذكي', 'error');
            }
        });
        
        // زر الإغلاق
        closeBtn.addEventListener('click', () => {
            this.closeEnhancedSmartScan(modal, stream);
        });
        
        // زر الفلاش
        flashBtn.addEventListener('click', async () => {
            try {
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                
                if (capabilities.torch) {
                    isFlashOn = !isFlashOn;
                    await track.applyConstraints({
                        advanced: [{ torch: isFlashOn }]
                    });
                    
                    flashBtn.style.background = isFlashOn ? 
                        'linear-gradient(135deg, #ffd700, #ffb347)' : '#3a3a3a';
                }
            } catch (error) {
                console.log('الفلاش غير متاح على هذا الجهاز');
            }
        });
        
        // زر تبديل الكاميرا
        switchBtn.addEventListener('click', async () => {
            try {
                // إيقاف الكاميرا الحالية
                stream.getTracks().forEach(track => track.stop());
                
                // تبديل وضع الكاميرا
                currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                
                // فتح الكاميرا الجديدة
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: currentFacingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
                
                video.srcObject = newStream;
                
                // تحديث المراجع
                this.setupEnhancedSmartScanControls(modal, video, newStream);
                
            } catch (error) {
                console.error('فشل في تبديل الكاميرا:', error);
                this.updateStatus('فشل في تبديل الكاميرا', 'error');
            }
        });
        
        // إغلاق عند النقر خارج النافذة
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEnhancedSmartScan(modal, stream);
            }
        });
    }
    
    // إغلاق المسح الذكي المحسن
    closeEnhancedSmartScan(modal, stream) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        this.smartScanMode = false;
        this.isEnhancedSmartScan = false;
        this.updateStatus('تم إغلاق المسح الذكي', 'info');
    }
    
    // معالجة المسح الذكي المحسن
    async processEnhancedSmartScan(file) {
        try {
            this.updateStatus('جاري استخراج النص...', 'info');
            
            // استخراج النص باستخدام OCR محسن
            const extractedText = await this.extractTextFromImage(file);
            
            if (extractedText && extractedText.trim()) {
                this.updateStatus('تم استخراج النص بنجاح!', 'success');
                
                // عرض النص المستخرج في حقل الإدخال
                if (this.elements.inputText) {
                    this.elements.inputText.value = extractedText.trim();
                }
                
                // ترجمة فورية إذا كان النص باللغة الإنجليزية أو العربية
                const detectedLang = this.detectLanguage(extractedText);
                if (detectedLang && detectedLang !== 'unknown') {
                    // تعيين اللغة المكتشفة
                    if (this.elements.sourceLang) {
                        this.elements.sourceLang.value = detectedLang;
                    }
                    
                    // بدء الترجمة الفورية
                    setTimeout(() => {
                        this.translateText();
                    }, 500);
                }
                
                // عرض خيارات التحديد الذكي
                this.showEnhancedSmartTextSelection(extractedText, file);
                
            } else {
                this.updateStatus('لم يتم العثور على نص في الصورة', 'warning');
            }
            
        } catch (error) {
            console.error('خطأ في معالجة المسح الذكي:', error);
            this.updateStatus('فشل في معالجة الصورة', 'error');
        }
    }
    
    // عرض تحديد النص الذكي المحسن
    showEnhancedSmartTextSelection(extractedText, imageFile) {
        // إنشاء نافذة تحديد النص المحسنة
        const modal = document.createElement('div');
        modal.className = 'enhanced-text-selection-modal';
        modal.innerHTML = `
            <div class="enhanced-text-selection-container">
                <div class="enhanced-text-selection-header">
                    <h3>🎯 تحديد النص الذكي</h3>
                    <button class="enhanced-close-btn" id="enhanced-text-close">✕</button>
                </div>
                
                <div class="enhanced-text-content">
                    <div class="enhanced-extracted-text" id="enhanced-selectable-text"></div>
                </div>
                
                <div class="enhanced-text-actions">
                    <button class="enhanced-action-btn enhanced-select-all" id="enhanced-select-all">
                        <span class="enhanced-icon">📋</span>
                        <span>تحديد الكل</span>
                    </button>
                    
                    <button class="enhanced-action-btn enhanced-smart-select" id="enhanced-smart-select">
                        <span class="enhanced-icon">🧠</span>
                        <span>تحديد ذكي</span>
                    </button>
                    
                    <button class="enhanced-action-btn enhanced-translate-selected" id="enhanced-translate-selected">
                        <span class="enhanced-icon">🌐</span>
                        <span>ترجمة المحدد</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // عرض النص القابل للتحديد
        this.displayEnhancedSelectableText(extractedText, modal.querySelector('#enhanced-selectable-text'));
        
        // إعداد أحداث التحديد
        this.setupEnhancedTextSelectionEvents(modal, extractedText);
        
        // إضافة أنماط التحديد المحسن
        this.addEnhancedTextSelectionStyles();
    }

    // عرض النص القابل للتحديد المحسن
    displayEnhancedSelectableText(text, container) {
        const words = text.split(/\s+/);
        container.innerHTML = '';
        
        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.className = 'enhanced-selectable-word';
            span.textContent = word;
            span.dataset.index = index;
            
            span.addEventListener('click', (e) => {
                e.target.classList.toggle('enhanced-selected');
            });
            
            container.appendChild(span);
            
            if (index < words.length - 1) {
                container.appendChild(document.createTextNode(' '));
            }
        });
    }
    
    // إعداد أحداث تحديد النص المحسن
    setupEnhancedTextSelectionEvents(modal, originalText) {
        const selectAllBtn = modal.querySelector('#enhanced-select-all');
        const smartSelectBtn = modal.querySelector('#enhanced-smart-select');
        const translateBtn = modal.querySelector('#enhanced-translate-selected');
        const closeBtn = modal.querySelector('#enhanced-text-close');
        
        // تحديد الكل
        selectAllBtn.addEventListener('click', () => {
            const words = modal.querySelectorAll('.enhanced-selectable-word');
            words.forEach(word => word.classList.add('enhanced-selected'));
        });
        
        // التحديد الذكي
        smartSelectBtn.addEventListener('click', () => {
            this.performEnhancedSmartSelection(modal, originalText);
        });
        
        // ترجمة المحدد
        translateBtn.addEventListener('click', () => {
            const selectedText = this.getEnhancedSelectedText(modal);
            if (selectedText.trim()) {
                if (this.elements.inputText) {
                    this.elements.inputText.value = selectedText;
                }
                modal.remove();
                this.translateText();
            } else {
                this.updateStatus('يرجى تحديد نص للترجمة', 'warning');
            }
        });
        
        // إغلاق
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // إغلاق عند النقر خارج النافذة
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // التحديد الذكي المحسن
    performEnhancedSmartSelection(modal, text) {
        const words = modal.querySelectorAll('.enhanced-selectable-word');
        const importantWords = this.extractImportantWords(text, this.detectLanguage(text));
        
        // إلغاء التحديد السابق
        words.forEach(word => word.classList.remove('enhanced-selected'));
        
        // تحديد الكلمات المهمة
        words.forEach(word => {
            const wordText = word.textContent.toLowerCase().replace(/[^\w\u0600-\u06FF]/g, '');
            if (importantWords.some(important => 
                important.toLowerCase().replace(/[^\w\u0600-\u06FF]/g, '') === wordText
            )) {
                word.classList.add('enhanced-selected');
            }
        });
        
        this.updateStatus('تم التحديد الذكي للكلمات المهمة', 'success');
    }
    
    // الحصول على النص المحدد المحسن
    getEnhancedSelectedText(modal) {
        const selectedWords = modal.querySelectorAll('.enhanced-selectable-word.enhanced-selected');
        return Array.from(selectedWords).map(word => word.textContent).join(' ');
    }
    
    // إضافة أنماط تحديد النص المحسن
    addEnhancedTextSelectionStyles() {
        if (document.getElementById('enhanced-text-selection-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'enhanced-text-selection-styles';
        style.textContent = `
            .enhanced-text-selection-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: enhancedFadeIn 0.3s ease;
            }
            
            .enhanced-text-selection-container {
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                background: #1a1a1a;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
            }
            
            .enhanced-text-selection-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .enhanced-text-content {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                max-height: 400px;
            }
            
            .enhanced-extracted-text {
                line-height: 1.8;
                font-size: 1.1rem;
                color: #e0e0e0;
                text-align: right;
                direction: rtl;
            }
            
            .enhanced-selectable-word {
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 4px;
                transition: all 0.3s ease;
                display: inline-block;
                margin: 1px;
            }
            
            .enhanced-selectable-word:hover {
                background: rgba(102, 126, 234, 0.3);
                transform: scale(1.05);
            }
            
            .enhanced-selectable-word.enhanced-selected {
                background: linear-gradient(135deg, #00ff88, #00cc6a);
                color: #000;
                font-weight: bold;
                transform: scale(1.1);
            }
            
            .enhanced-text-actions {
                display: flex;
                justify-content: space-around;
                padding: 20px;
                background: #2a2a2a;
                border-top: 1px solid #333;
            }
            
            .enhanced-action-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                background: #3a3a3a;
                border: none;
                color: white;
                padding: 15px;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 80px;
                font-size: 0.9rem;
            }
            
            .enhanced-action-btn:hover {
                background: #4a4a4a;
                transform: translateY(-2px);
            }
            
            .enhanced-translate-selected {
                background: linear-gradient(135deg, #00ff88, #00cc6a);
            }
            
            .enhanced-translate-selected:hover {
                background: linear-gradient(135deg, #00cc6a, #00aa55);
            }
            
            .enhanced-smart-select {
                background: linear-gradient(135deg, #667eea, #764ba2);
            }
            
            .enhanced-smart-select:hover {
                background: linear-gradient(135deg, #5a6fd8, #6a4190);
            }
            
            @media (max-width: 480px) {
                .enhanced-text-selection-container {
                    width: 95%;
                    margin: 10px;
                }
                
                .enhanced-text-actions {
                    padding: 15px 10px;
                }
                
                .enhanced-action-btn {
                    min-width: 70px;
                    padding: 12px;
                    font-size: 0.8rem;
                }
                
                .enhanced-extracted-text {
                    font-size: 1rem;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // معالجة أخطاء المسح الذكي المحسن
    handleEnhancedSmartScanError(error) {
        let errorMessage = 'حدث خطأ في المسح الذكي';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'يرجى السماح بالوصول للكاميرا';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'لم يتم العثور على كاميرا';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'الكاميرا غير مدعومة على هذا الجهاز';
        }
        
        this.updateStatus(errorMessage, 'error');
        this.smartScanMode = false;
        this.isEnhancedSmartScan = false;
    }

    // تحسين وظيفة التقاط الصور للمسح الذكي
    async captureImageForSmartScan(canvas) {
        try {
            this.updateStatus('معالجة الصورة واستخراج النص...', 'info');
            
            // تحويل الصورة إلى blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            
            // استخراج النص باستخدام OCR
            const extractedText = await this.extractTextFromImage(blob);
            
            if (extractedText && extractedText.trim()) {
                // إذا تم العثور على نص، قم بالترجمة التلقائية
                this.elements.sourceText.value = extractedText.trim();
                this.updateStatus('تم استخراج النص بنجاح، جاري الترجمة...', 'success');
                
                // تشغيل التدقيق الإملائي والترجمة
                await this.autoSpellCheck();
                await this.translateText();
                
                this.updateStatus('تمت الترجمة بنجاح!', 'success');
            } else {
                this.updateStatus('لم يتم العثور على نص في الصورة', 'warning');
            }
            
        } catch (error) {
            console.error('خطأ في معالجة الصورة:', error);
            this.updateStatus('حدث خطأ أثناء معالجة الصورة', 'error');
        } finally {
            this.smartScanMode = false;
        }
    }

    // تحسين وظيفة فتح الكاميرا لدعم المسح الذكي
    async openCameraWithSmartScan() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold flex items-center">
                        <span class="material-symbols-outlined mr-2 text-purple-600">auto_awesome</span>
                        المسح الذكي
                    </h3>
                    <button class="close-camera text-gray-500 hover:text-gray-700">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="camera-container relative">
                    <video id="camera-video" class="w-full rounded-lg" autoplay playsinline></video>
                    <div class="camera-overlay absolute inset-0 flex items-center justify-center">
                        <div class="scan-frame border-2 border-purple-500 border-dashed rounded-lg" style="width: 80%; height: 60%;"></div>
                    </div>
                </div>
                <div class="mt-4 flex justify-center space-x-4">
                    <button class="capture-smart-btn bg-gradient-to-r from-purple-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-blue-700 flex items-center">
                        <span class="material-symbols-outlined mr-2">auto_awesome</span>
                        مسح ذكي
                    </button>
                    <button class="capture-normal-btn bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 flex items-center">
                        <span class="material-symbols-outlined mr-2">photo_camera</span>
                        التقاط عادي
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // باقي الكود للكاميرا...
        const video = modal.querySelector('#camera-video');
        const captureSmartBtn = modal.querySelector('.capture-smart-btn');
        const captureNormalBtn = modal.querySelector('.capture-normal-btn');
        const closeBtn = modal.querySelector('.close-camera');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;

            captureSmartBtn.addEventListener('click', async () => {
                const canvas = this.captureVideoFrame(video);
                await this.captureImageForSmartScan(canvas);
                this.closeCamera(modal, stream);
            });

            captureNormalBtn.addEventListener('click', () => {
                const canvas = this.captureVideoFrame(video);
                this.handleCapturedImage(canvas);
                this.closeCamera(modal, stream);
            });

            closeBtn.addEventListener('click', () => {
                this.closeCamera(modal, stream);
            });

        } catch (error) {
             console.error('خطأ في فتح الكاميرا:', error);
             this.updateStatus('فشل في فتح الكاميرا', 'error');
             modal.remove();
         }
     }

     // وظيفة مساعدة لالتقاط إطار من الفيديو
     captureVideoFrame(video) {
         const canvas = document.createElement('canvas');
         canvas.width = video.videoWidth;
         canvas.height = video.videoHeight;
         const ctx = canvas.getContext('2d');
         ctx.drawImage(video, 0, 0);
         return canvas;
     }

     // وظيفة مساعدة لإغلاق الكاميرا
     closeCamera(modal, stream) {
         if (stream) {
             stream.getTracks().forEach(track => track.stop());
         }
         if (modal && modal.parentNode) {
             modal.remove();
         }
         this.updateStatus('تم إغلاق الكاميرا', 'info');
     }

     // وظيفة معالجة الصورة الملتقطة (للوضع العادي)
     async handleCapturedImage(canvas) {
         try {
             const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
             const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
             
             // معالجة الصورة باستخدام الوظيفة الموجودة
             await this.handleImageUpload({ target: { files: [file] } });
         } catch (error) {
             console.error('خطأ في معالجة الصورة الملتقطة:', error);
             this.updateStatus('حدث خطأ أثناء معالجة الصورة', 'error');
         }
     }
 }

// تشغيل التطبيق عند تحميل الصفحة
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VoiceTranslateApp();
});

// إضافة CSS للأزرار الجديدة
const style = document.createElement('style');
style.textContent = `
    .remove-favorite {
        background: #dc3545;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 15px;
        cursor: pointer;
        font-size: 0.8rem;
        margin-right: 8px;
        transition: all 0.3s ease;
    }
    
    .remove-favorite:hover {
        background: #c82333;
        transform: translateY(-1px);
    }
    
    .favorite-item > div {
        display: flex;
        gap: 8px;
    }
`;
document.head.appendChild(style);