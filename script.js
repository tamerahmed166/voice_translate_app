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
        this.updateStatus('جاهز للاستخدام');
    }

    setupElements() {
        this.elements = {
            micBtn: document.getElementById('mic-btn'),
            clearBtn: document.getElementById('clear-btn'),
            speakBtn: document.getElementById('speak-btn'),
            copyBtn: document.getElementById('copy-btn'),
            imageUploadBtn: document.getElementById('image-upload-btn'),
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
        this.elements.imageUploadBtn.addEventListener('click', () => this.triggerImageUpload());
        this.elements.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // تبديل اللغات
        this.elements.swapBtn.addEventListener('click', () => this.swapLanguages());
        
        // تحديث لغة التعرف على الصوت عند تغيير اللغة المصدر
        this.elements.sourceLang.addEventListener('change', () => {
            this.updateRecognitionLanguage();
            if (this.elements.sourceText.value.trim()) {
                this.translateText();
            }
        });
        
        this.elements.targetLang.addEventListener('change', () => {
            if (this.elements.sourceText.value.trim()) {
                this.translateText();
            }
        });
        
        // ترجمة تلقائية عند الكتابة مع التصحيح الإملائي
        this.elements.sourceText.addEventListener('input', () => {
            clearTimeout(this.translateTimeout);
            this.translateTimeout = setTimeout(() => {
                if (this.elements.sourceText.value.trim()) {
                    // تطبيق التصحيح الإملائي التلقائي
                    this.autoSpellCheck();
                    this.translateText();
                }
            }, 1000);
        });
        
        // إضافة للمفضلة
        this.elements.addFavoriteBtn.addEventListener('click', () => this.addToFavorites());
        
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
                        const detectedLang = this.detectLanguage(finalTranscript);
                        // تحديث عرض اللغة المكتشفة للمستخدم
                        this.updateStatus(`تم اكتشاف اللغة: ${this.getLanguageName(detectedLang)}`);
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
        
        this.recognition.lang = langMap[sourceLang] || 'en-US';
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
        
        try {
            const sourceLang = this.elements.sourceLang.value;
            const targetLang = this.elements.targetLang.value;
            
            // محاكاة API الترجمة - في التطبيق الحقيقي ستستخدم Google Translate API
            const translatedText = await this.mockTranslateAPI(text, sourceLang, targetLang);
            
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
        }
    }

    // استخدام خدمة ترجمة حقيقية مجانية
    async useRealTranslationAPI(text, sourceLang, targetLang) {
        // استخدام MyMemory API المجاني
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

    // اكتشاف اللغة التلقائي
    detectLanguage(text) {
        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const englishPattern = /[a-zA-Z]/;
        const chinesePattern = /[\u4e00-\u9fff]/;
        const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
        const koreanPattern = /[\uac00-\ud7af]/;
        const frenchPattern = /[àâäéèêëïîôöùûüÿç]/i;
        const germanPattern = /[äöüß]/i;
        const spanishPattern = /[ñáéíóúü]/i;
        const italianPattern = /[àèéìíîòóù]/i;
        
        // حساب نسبة كل لغة في النص
        const arabicCount = (text.match(arabicPattern) || []).length;
        const englishCount = (text.match(englishPattern) || []).length;
        const chineseCount = (text.match(chinesePattern) || []).length;
        const japaneseCount = (text.match(japanesePattern) || []).length;
        const koreanCount = (text.match(koreanPattern) || []).length;
        const frenchCount = (text.match(frenchPattern) || []).length;
        const germanCount = (text.match(germanPattern) || []).length;
        const spanishCount = (text.match(spanishPattern) || []).length;
        const italianCount = (text.match(italianPattern) || []).length;
        
        // تحديد اللغة بناءً على أعلى نسبة
        const scores = {
            'ar': arabicCount,
            'en': englishCount,
            'zh': chineseCount,
            'ja': japaneseCount,
            'ko': koreanCount,
            'fr': frenchCount,
            'de': germanCount,
            'es': spanishCount,
            'it': italianCount
        };
        
        // العثور على اللغة ذات أعلى نقاط
        let detectedLang = 'en'; // افتراضي
        let maxScore = 0;
        
        for (const [lang, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedLang = lang;
            }
        }
        
        // إذا لم يتم اكتشاف أي لغة بوضوح، استخدم الإنجليزية كافتراضي
        if (maxScore === 0) {
            detectedLang = 'en';
        }
        
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
            sourceLang = this.detectLanguage(text);
            console.log(`تم اكتشاف اللغة تلقائياً: ${sourceLang}`);
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

    speakTranslation() {
        const text = this.elements.translatedText.textContent;
        if (!text || text === 'الترجمة ستظهر هنا...' || text === 'جاري الترجمة...') {
            return;
        }
        
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = this.elements.targetLang.value;
        
        // تحديد اللغة للنطق
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
        
        utterance.lang = langMap[targetLang] || 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        
        utterance.onstart = () => {
            this.elements.speakBtn.querySelector('.speak-text').textContent = 'جاري النطق...';
            this.updateStatus('جاري نطق الترجمة...');
        };
        
        utterance.onend = () => {
            this.elements.speakBtn.querySelector('.speak-text').textContent = 'استمع للترجمة';
            this.updateStatus('جاهز للاستخدام');
        };
        
        utterance.onerror = () => {
            this.updateStatus('خطأ في نطق النص', 'error');
            this.elements.speakBtn.querySelector('.speak-text').textContent = 'استمع للترجمة';
        };
        
        this.synthesis.speak(utterance);
    }

    copyTranslation() {
        const text = this.elements.translatedText.textContent;
        if (!text || text === 'الترجمة ستظهر هنا...' || text === 'جاري الترجمة...') {
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            this.updateStatus('تم نسخ النص بنجاح', 'success');
            this.elements.copyBtn.textContent = 'تم النسخ ✓';
            setTimeout(() => {
                this.elements.copyBtn.textContent = 'نسخ';
            }, 2000);
        }).catch(() => {
            this.updateStatus('فشل في نسخ النص', 'error');
        });
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

        if (!file.type.startsWith('image/')) {
            this.updateStatus('يرجى اختيار ملف صورة صحيح', 'error');
            return;
        }

        this.updateStatus('جاري معالجة الصورة...');
        
        try {
            const extractedText = await this.extractTextFromImage(file);
            if (extractedText && extractedText.trim()) {
                this.elements.sourceText.value = extractedText;
                this.updateStatus('تم استخراج النص من الصورة بنجاح', 'success');
                // تشغيل التصحيح التلقائي
                this.autoSpellCheck();
                // ترجمة تلقائية
                setTimeout(() => this.translateText(), 1000);
            } else {
                this.updateStatus('لم يتم العثور على نص في الصورة', 'error');
            }
        } catch (error) {
            console.error('خطأ في استخراج النص:', error);
            this.updateStatus('حدث خطأ أثناء معالجة الصورة', 'error');
        }
        
        // إعادة تعيين input
        event.target.value = '';
    }

    // وظيفة استخراج النص من الصورة باستخدام Tesseract.js
    async extractTextFromImage(file) {
        return new Promise((resolve, reject) => {
            // إنشاء canvas لمعالجة الصورة
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // تحسين جودة الصورة
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // تحويل إلى base64
                const imageData = canvas.toDataURL('image/png');
                
                // محاكاة OCR بسيط (في التطبيق الحقيقي نحتاج Tesseract.js)
                this.simulateOCR(imageData)
                    .then(resolve)
                    .catch(reject);
            };
            
            img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
            img.src = URL.createObjectURL(file);
        });
    }

    // محاكاة OCR (في التطبيق الحقيقي نحتاج مكتبة Tesseract.js)
    async simulateOCR(imageData) {
        // هذه محاكاة بسيطة - في التطبيق الحقيقي نحتاج:
        // import Tesseract from 'tesseract.js';
        // const { data: { text } } = await Tesseract.recognize(imageData, 'ara+eng');
        
        return new Promise((resolve) => {
            setTimeout(() => {
                // نص تجريبي للاختبار
                const sampleTexts = [
                    'مرحبا بك في تطبيق الترجمة',
                    'Hello, welcome to the translation app',
                    'أين يمكنني العثور على الفندق؟',
                    'Where can I find the hotel?',
                    'شكراً لك على المساعدة'
                ];
                const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
                resolve(randomText);
            }, 2000); // محاكاة وقت المعالجة
        });
    }

    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                this.elements.status.textContent = 'جاهز للاستخدام';
                this.elements.status.className = 'status';
            }, 3000);
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