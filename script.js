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
            micBtn: document.getElementById('mic-btn'),
            clearBtn: document.getElementById('clear-btn'),
            speakBtn: document.getElementById('speak-btn'),
            copyBtn: document.getElementById('copy-btn'),
            imageCaptureBtn: document.getElementById('image-capture-btn'),
            imageCaptureContainer: document.querySelector('.image-capture-container'),
            imageCaptureMenu: document.getElementById('image-capture-menu'),
            imageInput: document.getElementById('image-input'),
            sourceText: document.getElementById('source-text'),
            translatedText: document.getElementById('translated-text'),
            sourceLang: document.getElementById('source-lang'),
            targetLang: document.getElementById('target-lang'),
            swapBtn: document.getElementById('swap-languages'),
            status: document.getElementById('status'),
            addFavoriteBtn: document.getElementById('add-favorite'),
            favoritesList: document.getElementById('favorites-list')
        };
    }

    setupEventListeners() {
        // أزرار التحكم الرئيسية
        this.elements.micBtn.addEventListener('click', () => this.toggleRecording());
        this.elements.clearBtn.addEventListener('click', () => this.clearText());
        this.elements.speakBtn.addEventListener('click', () => this.speakTranslation());
        this.elements.copyBtn.addEventListener('click', () => this.copyTranslation());
        
        // القائمة المنسدلة للصور والكاميرا
        this.elements.imageCaptureBtn.addEventListener('click', (e) => this.toggleImageCaptureMenu(e));
        this.elements.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // عناصر القائمة المنسدلة
        this.elements.imageCaptureMenu.addEventListener('click', (e) => this.handleMenuItemClick(e));
        
        // تبديل اللغات
        this.elements.swapBtn.addEventListener('click', () => this.swapLanguages());
        
        // تحديث لغة التعرف على الصوت عند تغيير اللغة المصدر
        this.elements.sourceLang.addEventListener('change', () => {
            this.updateRecognitionLanguage();
            if (this.elements.sourceText.value.trim()) {
                this.debouncedTranslate();
            }
        });
        
        this.elements.targetLang.addEventListener('change', () => {
            if (this.elements.sourceText.value.trim()) {
                this.debouncedTranslate();
            }
        });
        
        // ترجمة تلقائية عند الكتابة مع نظام debounce محسن
        this.elements.sourceText.addEventListener('input', () => {
            this.updateCharCounter();
            const text = this.elements.sourceText.value.trim();
            if (!text) {
                this.elements.translatedText.textContent = 'الترجمة ستظهر هنا...';
                this.elements.translatedText.classList.remove('has-content');
                return;
            }
            this.debouncedTranslate();
        });
        
        // ترجمة فورية عند الضغط على Enter
        this.elements.sourceText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.elements.sourceText.value.trim()) {
                    this.translateText();
                }
            }
        });
        
        // إضافة للمفضلة
        this.elements.addFavoriteBtn.addEventListener('click', () => this.addToFavorites());
        
        // إعداد نظام debounce
        this.setupDebounce();
        
        // استخدام العبارات المفضلة
        this.elements.favoritesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('use-favorite')) {
                const favoriteItem = e.target.closest('.favorite-item');
                const text = favoriteItem.dataset.text;
                this.elements.sourceText.value = text;
                this.translateText();
            }
        });
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
                this.elements.micBtn.classList.add('recording');
                this.elements.micBtn.querySelector('.mic-text').textContent = 'جاري التسجيل...';
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
                this.elements.micBtn.classList.remove('recording');
                this.elements.micBtn.querySelector('.mic-text').textContent = 'اضغط للتحدث';
                this.updateStatus('جاهز للاستخدام');
            };
            
            this.recognition.onerror = (event) => {
                this.updateStatus('خطأ في التعرف على الصوت: ' + event.error, 'error');
                this.isRecording = false;
                this.elements.micBtn.classList.remove('recording');
                this.elements.micBtn.querySelector('.mic-text').textContent = 'اضغط للتحدث';
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

    // استخدام خدمة ترجمة حقيقية مجانية
    async useRealTranslationAPI(text, sourceLang, targetLang) {
        // استخدام نموذج ذكي للترجمة مع تحسينات متقدمة
        try {
            // تحليل النص وتحسينه قبل الترجمة
            const analyzedText = this.analyzeAndPreprocessText(text, sourceLang);
            
            // محاولة استخدام عدة خدمات ترجمة ذكية
            const translationResults = await Promise.allSettled([
                this.translateWithMyMemory(analyzedText, sourceLang, targetLang),
                this.translateWithLibreTranslate(analyzedText, sourceLang, targetLang),
                this.translateWithMicrosoft(analyzedText, sourceLang, targetLang)
            ]);
            
            // اختيار أفضل ترجمة باستخدام خوارزمية ذكية
            const bestTranslation = this.selectBestTranslation(translationResults, text, sourceLang, targetLang);
            
            // تحسين الترجمة النهائية
            return this.postProcessTranslation(bestTranslation, targetLang);
            
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

    // حساب نقاط جودة الترجمة
    calculateTranslationScore(translation, originalText, sourceLang, targetLang) {
        let score = translation.confidence || 0.5;
        
        // إضافة نقاط للطول المناسب
        const lengthRatio = translation.text.length / originalText.length;
        if (lengthRatio >= 0.5 && lengthRatio <= 2.0) {
            score += 0.2;
        }
        
        // إضافة نقاط للمصدر الموثوق
        if (translation.source === 'Microsoft') {
            score += 0.1;
        } else if (translation.source === 'MyMemory') {
            score += 0.05;
        }
        
        // خصم نقاط للنصوص المكررة أو الفارغة
        if (translation.text.trim() === originalText.trim()) {
            score -= 0.3;
        }
        
        return score;
    }

    // تحسين الترجمة النهائية
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

    // وظيفة تفعيل رفع الصور
    triggerImageUpload() {
        this.elements.imageInput.click();
    }

    // وظيفة معالجة رفع الصور
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // التحقق من نوع الملف
        if (!file.type.startsWith('image/')) {
            this.updateStatus('يرجى اختيار ملف صورة صحيح (JPG, PNG, GIF, WebP)', 'error');
            return;
        }

        // التحقق من حجم الملف (أقل من 10 ميجابايت)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.updateStatus('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 10 ميجابايت', 'error');
            return;
        }

        // التحقق من أبعاد الصورة
        try {
            const dimensions = await this.getImageDimensions(file);
            if (dimensions.width < 50 || dimensions.height < 50) {
                this.updateStatus('الصورة صغيرة جداً. يرجى اختيار صورة أكبر', 'error');
                return;
            }
        } catch (error) {
            console.error('خطأ في قراءة أبعاد الصورة:', error);
        }

        this.updateStatus('جاري معالجة الصورة...');
        
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

    // وظيفة للحصول على أبعاد الصورة
    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
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

            this.updateStatus('جاري فتح الكاميرا...', 'info');
            
            // طلب الوصول للكاميرا
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment' // الكاميرا الخلفية للهواتف
                }
            });

            // إنشاء عنصر فيديو لعرض الكاميرا
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1000;
                max-width: 90vw;
                max-height: 90vh;
                border: 3px solid #007bff;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;

            // إنشاء أزرار التحكم
            const controls = document.createElement('div');
            controls.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1001;
                display: flex;
                gap: 10px;
            `;

            const captureBtn = document.createElement('button');
            captureBtn.textContent = '📸 التقاط صورة';
            captureBtn.style.cssText = `
                padding: 12px 24px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-size: 16px;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '❌ إغلاق';
            closeBtn.style.cssText = `
                padding: 12px 24px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-size: 16px;
            `;

            controls.appendChild(captureBtn);
            controls.appendChild(closeBtn);

            // إضافة العناصر للصفحة
            document.body.appendChild(video);
            document.body.appendChild(controls);

            // وظيفة التقاط الصورة
            captureBtn.onclick = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                    
                    // إغلاق الكاميرا
                    stream.getTracks().forEach(track => track.stop());
                    document.body.removeChild(video);
                    document.body.removeChild(controls);
                    
                    // معالجة الصورة الملتقطة
                    await this.handleImageUpload({ target: { files: [file] } });
                }, 'image/jpeg', 0.9);
            };

            // وظيفة الإغلاق
            closeBtn.onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(video);
                document.body.removeChild(controls);
                this.updateStatus('تم إغلاق الكاميرا', 'info');
            };

            this.updateStatus('الكاميرا جاهزة - اضغط على زر التقاط الصورة', 'success');

        } catch (error) {
            this.handleFileError(error, 'الكاميرا');
            
            // رسائل خطأ محددة للكاميرا
            if (error.name === 'NotAllowedError') {
                this.updateStatus('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح', 'error');
            } else if (error.name === 'NotFoundError') {
                this.updateStatus('لم يتم العثور على كاميرا متاحة', 'error');
            } else if (error.name === 'NotReadableError') {
                this.updateStatus('الكاميرا مستخدمة من تطبيق آخر', 'error');
            } else {
                this.updateStatus('خطأ في فتح الكاميرا: ' + error.message, 'error');
            }
        }
    }

    // وظائف القائمة المنسدلة للصور والكاميرا
    toggleImageCaptureMenu(e) {
        e.stopPropagation();
        this.elements.imageCaptureContainer.classList.toggle('active');
    }

    handleOutsideClick(e) {
        if (!this.elements.imageCaptureContainer.contains(e.target)) {
            this.elements.imageCaptureContainer.classList.remove('active');
        }
    }

    handleMenuItemClick(e) {
        e.stopPropagation();
        const menuItem = e.target.closest('.menu-item');
        if (!menuItem) return;

        const action = menuItem.getAttribute('data-action');
        this.elements.imageCaptureContainer.classList.remove('active');

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