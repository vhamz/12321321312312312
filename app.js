// Import Transformers.js
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";

// Google Sheets URL (ЗАМЕНИ НА СВОЙ ПОСЛЕ ДЕПЛОЯ)
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

const el = {
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

function setStatus(text) {
    if (el.status) el.status.textContent = text;
}

function showError(text) {
    if (el.error) {
        el.error.style.display = 'block';
        el.error.querySelector('span').textContent = text;
    }
}

function hideError() {
    if (el.error) el.error.style.display = 'none';
}

function generateTransactionId() {
    return 'TRX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function updateLog(message) {
    if (el.systemLog) {
        el.systemLog.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
    }
}

function getRandomProduct() {
    return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

async function loadReviews() {
    try {
        updateLog('Loading reviews from TSV file...');
        const res = await fetch('reviews_test.tsv');
        if (!res.ok) throw new Error('Failed to load reviews file');
        
        const text = await res.text();
        console.log('TSV file loaded, length:', text.length);
        
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: (r) => {
                    console.log('Parsed data:', r.data);
                    const data = r.data
                        .map(row => row.text)
                        .filter(t => t && t.trim().length > 0);
                    
                    console.log('Filtered reviews:', data.length);
                    
                    if (data.length === 0) {
                        reject(new Error('No reviews found in file'));
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
        reviews = await loadReviews();
        updateLog(`Loaded ${reviews.length} reviews`);
        
        // Потом модель
        model = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        
        setStatus('WAREHOUSE AI ONLINE');
        updateLog('System ready. Awaiting analysis.');
        el.btn.disabled = false;
        
    } catch (e) {
        console.error('Init error:', e);
        showError(e.message);
        setStatus('ERROR: ' + e.message);
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
    if (el.result) el.result.style.display = 'block';
    if (el.icon) el.icon.textContent = data.icon;
    if (el.label) el.label.textContent = data.text;
    if (el.meterFill) el.meterFill.style.width = `${data.score * 100}%`;
    if (el.conf) el.conf.textContent = `CONFIDENCE: ${(data.score * 100).toFixed(1)}%`;
}

function makeInventoryDecision(confidence, label, product) {
    let normalizedScore = 0.5;
    
    if (label === "POSITIVE") {
        normalizedScore = confidence;
    } else if (label === "NEGATIVE") {
        normalizedScore = 1.0 - confidence;
    }
    
    const transactionId = generateTransactionId();
    const now = new Date();
    
    if (normalizedScore <= 0.4) {
        // QUALITY ISSUE - негативный отзыв
        return {
            priority: 'high',
            title: '⚠️ QUALITY CONTROL ALERT',
            subtitle: `${product.name} - Quality issue detected`,
            tag: 'PRIORITY 1',
            recommendation: 'FLAG FOR QUALITY INSPECTION',
            orderQty: 0,
            orderText: 'HOLD ALL SHIPMENTS',
            actionBtn: {
                text: '🔍 INSPECT BATCH',
                icon: 'fa-search',
                action: () => { alert(`🔍 Quality control team notified for ${product.name} batch #QC-${Date.now()}`); }
            },
            actionCode: 'FLAG_QUALITY_ISSUE',
            priorityLevel: 'CRITICAL'
        };
    } else if (normalizedScore < 0.7) {
        // INVENTORY CHECK - нейтральный отзыв
        const orderQty = Math.floor(Math.random() * 200) + 100;
        return {
            priority: 'medium',
            title: '📋 INVENTORY CHECK REQUIRED',
            subtitle: `${product.name} - Monitor stock levels`,
            tag: 'PRIORITY 2',
            recommendation: 'CHECK WAREHOUSE STOCK',
            orderQty: orderQty,
            orderText: `ORDER ${orderQty} UNITS (LOW STOCK)`,
            actionBtn: {
                text: '📦 CHECK INVENTORY',
                icon: 'fa-clipboard-list',
                action: () => { alert(`📊 Current stock: ${product.stock} units. Suggested reorder: ${orderQty} units`); }
            },
            actionCode: 'CHECK_INVENTORY',
            priorityLevel: 'MEDIUM'
        };
    } else {
        // REORDER - позитивный отзыв
        const orderQty = Math.floor(Math.random() * 500) + 300;
        return {
            priority: 'low',
            title: '⚡ REORDER RECOMMENDATION',
            subtitle: `${product.name} - High demand detected`,
            tag: 'PRIORITY 3',
            recommendation: 'INCREASE STOCK LEVELS',
            orderQty: orderQty,
            orderText: `ORDER ${orderQty} UNITS (HOT ITEM)`,
            actionBtn: {
                text: '🚀 PLACE ORDER NOW',
                icon: 'fa-rocket',
                action: () => { alert(`✅ Purchase order created for ${orderQty} units of ${product.name} from ${product.supplier}`); }
            },
            actionCode: 'REORDER_STOCK',
            priorityLevel: 'LOW'
        };
    }
}

function showInventoryDecision(decision, product, transactionId) {
    if (!el.inventoryBox) return;
    
    // Set priority class
    el.inventoryBox.className = 'inventory-box priority-' + decision.priority;
    el.inventoryBox.style.display = 'block';
    
    // Fill data
    if (el.inventoryTitle) el.inventoryTitle.textContent = decision.title;
    if (el.inventorySubtitle) el.inventorySubtitle.textContent = decision.subtitle;
    if (el.inventoryTag) el.inventoryTag.textContent = decision.tag;
    
    // Product details
    if (el.productId) el.productId.textContent = product.id;
    if (el.currentStock) el.currentStock.textContent = product.stock.toLocaleString() + ' units';
    if (el.aiRecommendation) el.aiRecommendation.textContent = decision.recommendation;
    if (el.suggestedOrder) el.suggestedOrder.textContent = decision.orderText;
    
    // Primary button
    if (el.inventoryPrimaryBtn) {
        const actionBtn = el.inventoryPrimaryBtn;
        actionBtn.innerHTML = `<i class="fas ${decision.actionBtn.icon}"></i> ${decision.actionBtn.text}`;
        
        // Remove old listeners and add new one
        const newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);
        el.inventoryPrimaryBtn = newBtn;
        
        el.inventoryPrimaryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            decision.actionBtn.action();
        });
    }
    
    // Secondary button
    if (el.inventorySecondaryBtn) {
        const secondaryBtn = el.inventorySecondaryBtn;
        const newSecondary = secondaryBtn.cloneNode(true);
        secondaryBtn.parentNode.replaceChild(newSecondary, secondaryBtn);
        el.inventorySecondaryBtn = newSecondary;
        
        el.inventorySecondaryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('⏰ Reminder set. Review saved for later.');
        });
    }
    
    // Footer
    if (el.transactionId) el.transactionId.textContent = transactionId;
    if (el.inventoryTimestamp) el.inventoryTimestamp.textContent = new Date().toLocaleString();
}

async function sendToSheets(review, sentiment, confidence, actionCode, priority, product, transactionId) {
    try {
        const payload = {
            ts_iso: new Date().toISOString(),
            product_id: product.id,
            review: review,
            sentiment_label: sentiment,
            sentiment_confidence: confidence,
            action_taken: actionCode,
            inventory_action: actionCode,
            priority_level: priority,
            restock_quantity: actionCode === 'REORDER_STOCK' ? Math.floor(Math.random() * 500) + 300 : 0,
            supplier_notified: actionCode === 'REORDER_STOCK' ? 'TRUE' : 'FALSE'
        };
        
        console.log('Sending to Sheets:', payload);
        
        await fetch(SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        updateLog(`Data logged to inventory system [${transactionId}]`);
        
    } catch (e) {
        console.error('Sheets error:', e);
        updateLog('Warning: Failed to log to Sheets');
    }
}

async function analyze() {
    try {
        hideError();
        
        if (!reviews || reviews.length === 0) {
            throw new Error('No reviews loaded. Please refresh.');
        }
        
        el.btn.disabled = true;
        el.loading.style.display = 'block';
        if (el.result) el.result.style.display = 'none';
        if (el.inventoryBox) el.inventoryBox.style.display = 'none';
        
        // Get random review and product
        const review = getRandom();
        currentProduct = getRandomProduct();
        
        console.log('Selected review:', review);
        console.log('Selected product:', currentProduct);
        
        if (el.review) el.review.textContent = review;
        
        updateLog(`Analyzing review for ${currentProduct.name}...`);
        
        // Classify sentiment
        const result = await classify(review);
        console.log('AI result:', result);
        
        const sentiment = mapSentiment(result);
        showResult(sentiment);
        
        // Make inventory decision
        const transactionId = generateTransactionId();
        const decision = makeInventoryDecision(result.score, result.label, currentProduct);
        showInventoryDecision(decision, currentProduct, transactionId);
        
        // Send to sheets
        await sendToSheets(
            review,
            sentiment.text,
            sentiment.score,
            decision.actionCode,
            decision.priorityLevel,
            currentProduct,
            transactionId
        );
        
        updateLog(`Analysis complete. Decision: ${decision.actionCode}`);
        
    } catch (e) {
        console.error('Analysis error:', e);
        showError(e.message);
        updateLog(`ERROR: ${e.message}`);
    } finally {
        el.btn.disabled = false;
        el.loading.style.display = 'none';
    }
}

// Initialize when page loads
async function init() {
    console.log('Initializing Inventory AI...');
    
    // Check if all elements exist
    console.log('Elements found:', {
        status: !!el.status,
        btn: !!el.btn,
        review: !!el.review
    });
    
    try {
        await initModel();
    } catch (e) {
        console.error('Init failed:', e);
        showError(e.message);
        setStatus('INIT FAILED: ' + e.message);
    }
}

// Event listeners
if (el.btn) {
    el.btn.addEventListener('click', analyze);
}

document.addEventListener('DOMContentLoaded', init);
