// Import Transformers.js
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";

// Google Sheets URL (оставь как есть или замени на свой)
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxvKf4o9VoCGRckMc-QgVySjhnFuElxcxHLmlG3E5HncjForWw1xwA5HTdGnvuu9wI/exec';

// Product database
const PRODUCTS = [
    { id: 'PROD-A7', name: 'Wireless Headphones', stock: 234, supplier: 'Samsung Electronics' },
    { id: 'PROD-B3', name: 'Smart Watch', stock: 87, supplier: 'Apple Inc' },
    { id: 'PROD-C9', name: 'Bluetooth Speaker', stock: 456, supplier: 'Sony' },
    { id: 'PROD-D2', name: 'Phone Case', stock: 1243, supplier: 'Spigen' },
    { id: 'PROD-E5', name: 'USB-C Cable', stock: 3456, supplier: 'Anker' },
    { id: 'PROD-F8', name: 'Power Bank', stock: 23, supplier: 'Xiaomi' },
    { id: 'PROD-G1', name: 'Laptop Stand', stock: 78, supplier: 'Rain Design' },
    { id: 'PROD-H4', name: 'Monitor', stock: 45, supplier: 'LG' }
];

let reviews = [];
let model = null;
let currentProduct = null;

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing...');
    
    // Инициализируем элементы после загрузки DOM
    initializeElements();
    
    // Запускаем инициализацию
    try {
        await initModel();
    } catch (e) {
        console.error('Init failed:', e);
        showError(e.message);
    }
});

// Функция для инициализации элементов
function initializeElements() {
    window.el = {
        status: document.getElementById('statusMessage'),
        error: document.getElementById('errorMessage'),
        btn: document.getElementById('analyzeButton'),
        review: document.getElementById('reviewText'),
        result: document.getElementById('resultBox'),
        icon: document.getElementById('resultIcon'),
        label: document.getElementById('resultLabel'),
        conf: document.getElementById('resultConfidence'),
        meterFill: document.getElementById('meterFill'),
        loading: document.getElementById('loadingSpinner'),
        inventoryBox: document.getElementById('inventoryBox'),
        inventoryTitle: document.getElementById('inventoryTitle'),
        inventorySubtitle: document.getElementById('inventorySubtitle'),
        inventoryTag: document.getElementById('inventoryTag'),
        productId: document.getElementById('productId'),
        currentStock: document.getElementById('currentStock'),
        aiRecommendation: document.getElementById('aiRecommendation'),
        suggestedOrder: document.getElementById('suggestedOrder'),
        inventoryPrimaryBtn: document.getElementById('inventoryPrimaryBtn'),
        inventorySecondaryBtn: document.getElementById('inventorySecondaryBtn'),
        transactionId: document.getElementById('transactionId'),
        inventoryTimestamp: document.getElementById('inventoryTimestamp'),
        systemLog: document.getElementById('systemLog')
    };
    
    console.log('Elements initialized:', window.el);
    
    // Добавляем обработчик на кнопку
    if (window.el.btn) {
        window.el.btn.addEventListener('click', analyze);
        console.log('Button handler added');
    }
}

// Helper functions
function setStatus(text) {
    if (window.el?.status) window.el.status.textContent = text;
}

function showError(text) {
    if (window.el?.error) {
        window.el.error.style.display = 'block';
        const span = window.el.error.querySelector('span');
        if (span) span.textContent = text;
    }
}

function hideError() {
    if (window.el?.error) window.el.error.style.display = 'none';
}

function generateTransactionId() {
    return 'TRX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function updateLog(message) {
    if (window.el?.systemLog) {
        window.el.systemLog.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
    }
    console.log('LOG:', message);
}

function getRandomProduct() {
    return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

async function loadReviews() {
    try {
        updateLog('Loading reviews from TSV file...');
        
        // Проверяем что файл существует
        const res = await fetch('reviews_test.tsv', { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!res.ok) {
            throw new Error(`Failed to load reviews file: ${res.status} ${res.statusText}`);
        }
        
        const text = await res.text();
        console.log('TSV content:', text.substring(0, 200));
        
        if (!text || text.trim().length === 0) {
            throw new Error('Reviews file is empty');
        }
        
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: (r) => {
                    console.log('Parsed data:', r.data);
                    
                    const data = r.data
                        .map(row => row.text)
                        .filter(t => t && typeof t === 'string' && t.trim().length > 0);
                    
                    console.log(`Found ${data.length} reviews`);
                    
                    if (data.length === 0) {
                        // Если не нашли с заголовком 'text', пробуем другой формат
                        const alternativeData = r.data
                            .map(row => row[Object.keys(row)[0]]) // берем первый ключ
                            .filter(t => t && typeof t === 'string' && t.trim().length > 0);
                        
                        if (alternativeData.length > 0) {
                            resolve(alternativeData);
                        } else {
                            reject(new Error('No valid reviews found in file'));
                        }
                    } else {
                        resolve(data);
                    }
                },
                error: (e) => {
                    console.error('Papa parse error:', e);
                    reject(e);
                }
            });
        });
    } catch (e) {
        console.error('Error loading reviews:', e);
        throw e;
    }
}

async function initModel() {
    try {
        setStatus('INITIALIZING AI CORE...');
        updateLog('Loading neural network model...');
        
        // Сначала загружаем отзывы
        setStatus('LOADING REVIEWS...');
        reviews = await loadReviews();
        setStatus(`Loaded ${reviews.length} reviews`);
        updateLog(`Loaded ${reviews.length} reviews successfully`);
        
        // Потом модель
        setStatus('LOADING AI MODEL...');
        updateLog('Loading Transformers model...');
        
        model = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
            progress_callback: (progress) => {
                console.log('Model loading progress:', progress);
            }
        });
        
        setStatus('WAREHOUSE AI ONLINE');
        updateLog('System ready. Awaiting analysis.');
        
        if (window.el?.btn) {
            window.el.btn.disabled = false;
            console.log('Button enabled');
        }
        
    } catch (e) {
        console.error('Init error:', e);
        showError(e.message);
        setStatus('ERROR: ' + e.message);
        updateLog(`ERROR: ${e.message}`);
    }
}

function getRandom() {
    if (!reviews || reviews.length === 0) {
        throw new Error('No reviews available');
    }
    return reviews[Math.floor(Math.random() * reviews.length)];
}

async function classify(text) {
    if (!model) throw new Error('Model not loaded');
    const result = await model(text);
    return result[0];
}

function mapSentiment(result) {
    const { label, score } = result;
    
    if (label === 'POSITIVE' && score > 0.5) {
        return { type: 'positive', text: 'POSITIVE', score, icon: '📈' };
    } else if (label === 'NEGATIVE' && score > 0.5) {
        return { type: 'negative', text: 'NEGATIVE', score, icon: '📉' };
    } else {
        return { type: 'neutral', text: 'NEUTRAL', score, icon: '📊' };
    }
}

function showResult(data) {
    if (!window.el) return;
    
    if (window.el.result) window.el.result.style.display = 'block';
    if (window.el.icon) window.el.icon.textContent = data.icon;
    if (window.el.label) window.el.label.textContent = data.text;
    if (window.el.meterFill) window.el.meterFill.style.width = `${data.score * 100}%`;
    if (window.el.conf) window.el.conf.textContent = `CONFIDENCE: ${(data.score * 100).toFixed(1)}%`;
}

function makeInventoryDecision(confidence, label, product) {
    let normalizedScore = 0.5;
    
    if (label === "POSITIVE") {
        normalizedScore = confidence;
    } else if (label === "NEGATIVE") {
        normalizedScore = 1.0 - confidence;
    }
    
    if (normalizedScore <= 0.4) {
        return {
            priority: 'high',
            title: '⚠️ QUALITY CONTROL ALERT',
            subtitle: `${product.name} - Quality issue detected`,
            tag: 'PRIORITY 1',
            recommendation: 'FLAG FOR QUALITY INSPECTION',
            orderText: 'HOLD ALL SHIPMENTS',
            actionBtn: {
                text: '🔍 INSPECT BATCH',
                icon: 'fa-search',
                action: () => { alert(`🔍 Quality control notified for ${product.name}`); }
            },
            actionCode: 'FLAG_QUALITY_ISSUE',
            priorityLevel: 'CRITICAL'
        };
    } else if (normalizedScore < 0.7) {
        const orderQty = Math.floor(Math.random() * 200) + 100;
        return {
            priority: 'medium',
            title: '📋 INVENTORY CHECK REQUIRED',
            subtitle: `${product.name} - Monitor stock levels`,
            tag: 'PRIORITY 2',
            recommendation: 'CHECK WAREHOUSE STOCK',
            orderText: `ORDER ${orderQty} UNITS (LOW STOCK)`,
            actionBtn: {
                text: '📦 CHECK INVENTORY',
                icon: 'fa-clipboard-list',
                action: () => { alert(`📊 Current stock: ${product.stock} units`); }
            },
            actionCode: 'CHECK_INVENTORY',
            priorityLevel: 'MEDIUM'
        };
    } else {
        const orderQty = Math.floor(Math.random() * 500) + 300;
        return {
            priority: 'low',
            title: '⚡ REORDER RECOMMENDATION',
            subtitle: `${product.name} - High demand detected`,
            tag: 'PRIORITY 3',
            recommendation: 'INCREASE STOCK LEVELS',
            orderText: `ORDER ${orderQty} UNITS (HOT ITEM)`,
            actionBtn: {
                text: '🚀 PLACE ORDER NOW',
                icon: 'fa-rocket',
                action: () => { alert(`✅ Order for ${orderQty} units from ${product.supplier}`); }
            },
            actionCode: 'REORDER_STOCK',
            priorityLevel: 'LOW'
        };
    }
}

function showInventoryDecision(decision, product, transactionId) {
    if (!window.el) return;
    
    if (window.el.inventoryBox) {
        window.el.inventoryBox.className = 'inventory-box priority-' + decision.priority;
        window.el.inventoryBox.style.display = 'block';
    }
    
    if (window.el.inventoryTitle) window.el.inventoryTitle.textContent = decision.title;
    if (window.el.inventorySubtitle) window.el.inventorySubtitle.textContent = decision.subtitle;
    if (window.el.inventoryTag) window.el.inventoryTag.textContent = decision.tag;
    if (window.el.productId) window.el.productId.textContent = product.id;
    if (window.el.currentStock) window.el.currentStock.textContent = product.stock.toLocaleString() + ' units';
    if (window.el.aiRecommendation) window.el.aiRecommendation.textContent = decision.recommendation;
    if (window.el.suggestedOrder) window.el.suggestedOrder.textContent = decision.orderText;
    
    if (window.el.inventoryPrimaryBtn) {
        window.el.inventoryPrimaryBtn.innerHTML = `<i class="fas ${decision.actionBtn.icon}"></i> ${decision.actionBtn.text}`;
        window.el.inventoryPrimaryBtn.onclick = (e) => {
            e.preventDefault();
            decision.actionBtn.action();
        };
    }
    
    if (window.el.transactionId) window.el.transactionId.textContent = transactionId;
    if (window.el.inventoryTimestamp) window.el.inventoryTimestamp.textContent = new Date().toLocaleString();
}

async function analyze() {
    console.log('Analyze button clicked');
    
    try {
        hideError();
        
        if (!reviews || reviews.length === 0) {
            throw new Error('No reviews loaded. Please refresh.');
        }
        
        if (!model) {
            throw new Error('Model not loaded yet. Please wait.');
        }
        
        if (window.el.btn) window.el.btn.disabled = true;
        if (window.el.loading) window.el.loading.style.display = 'block';
        if (window.el.result) window.el.result.style.display = 'none';
        if (window.el.inventoryBox) window.el.inventoryBox.style.display = 'none';
        
        const review = getRandom();
        currentProduct = getRandomProduct();
        
        console.log('Review:', review);
        console.log('Product:', currentProduct);
        
        if (window.el.review) window.el.review.textContent = review;
        
        updateLog(`Analyzing review for ${currentProduct.name}...`);
        
        const result = await classify(review);
        console.log('AI result:', result);
        
        const sentiment = mapSentiment(result);
        showResult(sentiment);
        
        const transactionId = generateTransactionId();
        const decision = makeInventoryDecision(result.score, result.label, currentProduct);
        showInventoryDecision(decision, currentProduct, transactionId);
        
        updateLog(`Analysis complete. Decision: ${decision.actionCode}`);
        
        // Опционально отправка в Sheets
        try {
            await fetch(SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ts_iso: new Date().toISOString(),
                    product_id: currentProduct.id,
                    review: review,
                    sentiment_label: sentiment.text,
                    sentiment_confidence: sentiment.score,
                    action_taken: decision.actionCode
                })
            });
        } catch (e) {
            console.log('Sheets logging skipped (optional)');
        }
        
    } catch (e) {
        console.error('Analysis error:', e);
        showError(e.message);
        updateLog(`ERROR: ${e.message}`);
    } finally {
        if (window.el.btn) window.el.btn.disabled = false;
        if (window.el.loading) window.el.loading.style.display = 'none';
    }
}
