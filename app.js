// ==============================================
// SMART INVENTORY AI - MAIN APPLICATION
// ==============================================

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";

// Конфигурация
const CONFIG = {
    sheetsUrl: 'https://script.google.com/macros/s/AKfycbxvKf4o9VoCGRckMc-QgVySjhnFuElxcxHLmlG3E5HncjForWw1xwA5HTdGnvuu9wI/exec',
    reviewsFile: 'reviews_test.tsv',
    appVersion: '2.0.0'
};

// База данных продуктов
const PRODUCTS = [
    { id: 'PROD-001', name: 'Wireless Headphones', stock: 234, supplier: 'Samsung' },
    { id: 'PROD-002', name: 'Smart Watch', stock: 87, supplier: 'Apple' },
    { id: 'PROD-003', name: 'Bluetooth Speaker', stock: 456, supplier: 'Sony' },
    { id: 'PROD-004', name: 'Phone Case', stock: 1243, supplier: 'Spigen' },
    { id: 'PROD-005', name: 'USB-C Cable', stock: 3456, supplier: 'Anker' },
    { id: 'PROD-006', name: 'Power Bank', stock: 23, supplier: 'Xiaomi' },
    { id: 'PROD-007', name: 'Laptop Stand', stock: 78, supplier: 'Rain Design' },
    { id: 'PROD-008', name: '4K Monitor', stock: 45, supplier: 'LG' }
];

// Состояние приложения
const state = {
    reviews: [],
    model: null,
    currentProduct: null,
    isInitialized: false
};

// DOM элементы
const dom = {};

// ==============================================
// Инициализация DOM элементов
// ==============================================
function initDom() {
    const ids = [
        'statusMessage', 'statusLed', 'errorMessage', 'analyzeBtn',
        'reviewText', 'resultBox', 'resultIcon', 'resultLabel',
        'progressFill', 'resultConfidence', 'loadingSpinner',
        'inventoryBox', 'inventoryIcon', 'inventoryTitle', 'inventorySubtitle',
        'priorityBadge', 'productId', 'productName', 'currentStock',
        'aiRecommendation', 'primaryActionBtn', 'secondaryActionBtn',
        'transactionId', 'timestamp', 'systemLog',
        'statStock', 'statAlerts', 'statDecisions', 'batchId'
    ];
    
    ids.forEach(id => {
        dom[id] = document.getElementById(id);
    });
    
    console.log('✅ DOM initialized');
}

// ==============================================
// Вспомогательные функции
// ==============================================
function setStatus(text, isReady = false) {
    if (dom.statusMessage) dom.statusMessage.textContent = text;
    if (dom.statusLed) {
        dom.statusLed.className = isReady ? 'led active' : 'led';
    }
}

function showError(text) {
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'block';
        dom.errorMessage.querySelector('span').textContent = text;
    }
    log(`❌ ERROR: ${text}`);
}

function hideError() {
    if (dom.errorMessage) dom.errorMessage.style.display = 'none';
}

function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (dom.systemLog) {
        dom.systemLog.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
    }
}

function generateTransactionId() {
    return 'TXN-' + Date.now().toString(36).toUpperCase() + 
           '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getRandomProduct() {
    return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

function updateStats() {
    if (dom.statStock) dom.statStock.textContent = '15,842';
    if (dom.statAlerts) dom.statAlerts.textContent = '23';
    if (dom.statDecisions) dom.statDecisions.textContent = '1,337';
    if (dom.batchId) dom.batchId.textContent = `BATCH #WH-${new Date().getFullYear()}`;
}

// ==============================================
// Загрузка отзывов из TSV
// ==============================================
async function loadReviews() {
    return new Promise((resolve, reject) => {
        log('📂 Loading reviews from TSV...');
        
        Papa.parse(CONFIG.reviewsFile, {
            download: true,
            header: true,
            delimiter: '\t',
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    const reviews = results.data
                        .map(row => row.text)
                        .filter(text => text && text.trim().length > 0);
                    
                    if (reviews.length > 0) {
                        log(`✅ Loaded ${reviews.length} reviews`);
                        resolve(reviews);
                    } else {
                        reject(new Error('No valid reviews found'));
                    }
                } else {
                    reject(new Error('Failed to parse TSV'));
                }
            },
            error: (error) => {
                reject(new Error(`Failed to load reviews: ${error}`));
            }
        });
    });
}

// ==============================================
// Инициализация AI модели
// ==============================================
async function initModel() {
    try {
        setStatus('🔄 Loading AI model...');
        log('🤖 Initializing Transformers pipeline...');
        
        state.model = await pipeline(
            'text-classification',
            'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
            { 
                progress_callback: (progress) => {
                    if (progress.status === 'progress') {
                        setStatus(`Loading model... ${Math.round(progress.progress * 100)}%`);
                    }
                }
            }
        );
        
        log('✅ AI model ready');
        return true;
    } catch (error) {
        log(`❌ Model initialization failed: ${error.message}`);
        throw error;
    }
}

// ==============================================
// Анализ тональности
// ==============================================
async function analyzeSentiment(text) {
    if (!state.model) throw new Error('Model not loaded');
    
    const result = await state.model(text);
    return result[0];
}

function formatSentiment(result) {
    const { label, score } = result;
    
    if (label === 'POSITIVE' && score > 0.5) {
        return { 
            type: 'positive', 
            label: 'POSITIVE', 
            score, 
            icon: '📈',
            color: '#4caf50'
        };
    } else if (label === 'NEGATIVE' && score > 0.5) {
        return { 
            type: 'negative', 
            label: 'NEGATIVE', 
            score, 
            icon: '📉',
            color: '#f44336'
        };
    } else {
        return { 
            type: 'neutral', 
            label: 'NEUTRAL', 
            score, 
            icon: '📊',
            color: '#ff9800'
        };
    }
}

// ==============================================
// Бизнес-логика для инвентаря
// ==============================================
function makeInventoryDecision(sentiment, product) {
    const { label, score } = sentiment;
    
    // Нормализуем score от 0 до 1, где 1 = лучший результат
    let normalizedScore = label === 'POSITIVE' ? score : 1 - score;
    
    if (normalizedScore <= 0.3) {
        // Критический случай -质量问题
        return {
            priority: 'high',
            title: '⚠️ QUALITY ALERT',
            subtitle: `${product.name} - Quality issue detected`,
            badge: 'CRITICAL',
            recommendation: 'FLAG FOR QUALITY INSPECTION',
            action: 'INSPECT BATCH',
            actionIcon: 'fa-search',
            actionCode: 'QUALITY_CHECK',
            message: `Immediate quality check required for ${product.name}`,
            btnText: '🔍 Inspect Now'
        };
    } else if (normalizedScore <= 0.6) {
        // Средний случай - проверить запасы
        return {
            priority: 'medium',
            title: '📋 INVENTORY CHECK',
            subtitle: `${product.name} - Monitor stock levels`,
            badge: 'MEDIUM',
            recommendation: 'CHECK WAREHOUSE STOCK',
            action: 'VERIFY STOCK',
            actionIcon: 'fa-clipboard-list',
            actionCode: 'STOCK_CHECK',
            message: `Review stock levels for ${product.name}`,
            btnText: '📦 Check Stock'
        };
    } else {
        // Хороший случай - пополнить запасы
        return {
            priority: 'low',
            title: '⚡ REORDER RECOMMENDED',
            subtitle: `${product.name} - High demand detected`,
            badge: 'LOW',
            recommendation: 'INCREASE STOCK LEVELS',
            action: 'ORDER NOW',
            actionIcon: 'fa-rocket',
            actionCode: 'REORDER',
            message: `Place reorder for ${product.name} from ${product.supplier}`,
            btnText: '🚀 Place Order'
        };
    }
}

// ==============================================
// Отображение результатов
// ==============================================
function showSentimentResult(sentiment) {
    dom.resultBox.style.display = 'block';
    dom.resultIcon.textContent = sentiment.icon;
    dom.resultLabel.textContent = sentiment.label;
    dom.resultLabel.style.color = sentiment.color;
    dom.progressFill.style.width = `${sentiment.score * 100}%`;
    dom.progressFill.style.background = sentiment.color;
    dom.resultConfidence.textContent = `Confidence: ${(sentiment.score * 100).toFixed(1)}%`;
}

function showInventoryDecision(decision, product, transactionId) {
    // Set priority class
    dom.inventoryBox.className = `inventory-box priority-${decision.priority}`;
    dom.inventoryBox.style.display = 'block';
    
    // Fill data
    dom.inventoryTitle.textContent = decision.title;
    dom.inventorySubtitle.textContent = decision.subtitle;
    dom.priorityBadge.textContent = decision.badge;
    dom.productId.textContent = product.id;
    dom.productName.textContent = product.name;
    dom.currentStock.textContent = `${product.stock.toLocaleString()} units`;
    dom.aiRecommendation.textContent = decision.recommendation;
    
    // Primary button
    dom.primaryActionBtn.innerHTML = `<i class="fas ${decision.actionIcon}"></i> ${decision.btnText}`;
    dom.primaryActionBtn.onclick = () => {
        alert(`✅ ${decision.message}`);
        log(`Action executed: ${decision.actionCode}`);
    };
    
    // Secondary button
    dom.secondaryActionBtn.onclick = () => {
        alert('⏰ Reminder set for later');
        log('Action postponed');
    };
    
    // Footer
    dom.transactionId.textContent = transactionId;
    dom.timestamp.textContent = new Date().toLocaleString();
}

// ==============================================
// Отправка в Google Sheets
// ==============================================
async function logToSheets(review, sentiment, product, decision, transactionId) {
    try {
        const payload = {
            timestamp: new Date().toISOString(),
            product_id: product.id,
            product_name: product.name,
            review: review,
            sentiment_label: sentiment.label,
            sentiment_score: sentiment.score,
            action_taken: decision.actionCode,
            priority: decision.priority,
            ticket_id: transactionId
        };
        
        log('📤 Sending to Google Sheets...');
        
        await fetch(CONFIG.sheetsUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        log('✅ Data logged to sheets');
    } catch (error) {
        log(`⚠️ Sheets logging failed: ${error.message}`);
    }
}

// ==============================================
// Основная функция анализа
// ==============================================
async function analyze() {
    try {
        hideError();
        
        // Проверки
        if (!state.isInitialized) {
            throw new Error('System not initialized yet');
        }
        
        if (state.reviews.length === 0) {
            throw new Error('No reviews available');
        }
        
        // UI обновления
        dom.analyzeBtn.disabled = true;
        dom.loadingSpinner.style.display = 'block';
        dom.resultBox.style.display = 'none';
        dom.inventoryBox.style.display = 'none';
        
        // Выбираем случайный отзыв и продукт
        const review = state.reviews[Math.floor(Math.random() * state.reviews.length)];
        state.currentProduct = getRandomProduct();
        
        dom.reviewText.textContent = review;
        log(`📝 Analyzing: "${review.substring(0, 50)}..."`);
        
        // Анализируем тональность
        const aiResult = await analyzeSentiment(review);
        const sentiment = formatSentiment(aiResult);
        
        showSentimentResult(sentiment);
        log(`🤖 Sentiment: ${sentiment.label} (${(sentiment.score * 100).toFixed(1)}%)`);
        
        // Принимаем решение по инвентарю
        const decision = makeInventoryDecision(aiResult, state.currentProduct);
        const transactionId = generateTransactionId();
        
        showInventoryDecision(decision, state.currentProduct, transactionId);
        log(`📊 Decision: ${decision.actionCode}`);
        
        // Логируем в Google Sheets
        await logToSheets(review, sentiment, state.currentProduct, decision, transactionId);
        
    } catch (error) {
        showError(error.message);
        log(`❌ ${error.message}`);
    } finally {
        dom.analyzeBtn.disabled = false;
        dom.loadingSpinner.style.display = 'none';
    }
}

// ==============================================
// Инициализация приложения
// ==============================================
async function init() {
    try {
        log('🚀 Starting Inventory AI System');
        initDom();
        updateStats();
        
        setStatus('📂 Loading reviews...');
        state.reviews = await loadReviews();
        
        setStatus('🤖 Loading AI model...');
        await initModel();
        
        setStatus('✅ System ready', true);
        state.isInitialized = true;
        
        log('🎉 System initialized successfully');
        
    } catch (error) {
        showError(`Init failed: ${error.message}`);
        setStatus('❌ Init failed');
        log(`💥 Fatal: ${error.message}`);
    }
}

// ==============================================
// Event Listeners
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Обработчик кнопки
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyze);
    }
});
