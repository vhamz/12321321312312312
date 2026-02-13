// Import Transformers.js
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";

// Google Sheets URL (ЗАМЕНИТЕ НА ВАШ ПОСЛЕ ДЕПЛОЯ)
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
    // Inventory elements
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
    el.status.textContent = text;
}

function showError(text) {
    el.error.style.display = 'block';
    el.error.querySelector('span').textContent = text;
}

function hideError() {
    el.error.style.display = 'none';
}

function generateTransactionId() {
    return 'TRX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function updateLog(message) {
    el.systemLog.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
}

function getRandomProduct() {
    return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

async function loadReviews() {
    const res = await fetch('reviews_test.tsv');
    const text = await res.text();
    
    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            delimiter: '\t',
            complete: (r) => {
                const data = r.data.map(row => row.text).filter(t => t && t.trim());
                if (data.length === 0) reject(new Error('No reviews'));
                else resolve(data);
            },
            error: (e) => reject(e)
        });
    });
}

async function initModel() {
    setStatus('INITIALIZING AI CORE...');
    updateLog('Loading neural network model...');
    model = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    setStatus('WAREHOUSE AI ONLINE');
    updateLog('System ready. Awaiting analysis.');
    el.btn.disabled = false;
}

function getRandom() {
    return reviews[Math.floor(Math.random() * reviews.length)];
}

async function classify(text) {
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
    el.result.style.display = 'block';
    el.icon.textContent = data.icon;
    el.label.textContent = data.text;
    el.meterFill.style.width = `${data.score * 100}%`;
    el.conf.textContent = `CONFIDENCE: ${(data.score * 100).toFixed(1)}%`;
}

/**
 * НОВАЯ ФУНКЦИЯ: Принимает решение по инвентарю на основе отзыва
 */
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
        const orderQty = Math.floor(Math.random() * 50) + 20;
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

/**
 * НОВАЯ ФУНКЦИЯ: Отображает инвентарное решение
 */
function showInventoryDecision(decision, product, transactionId) {
    // Set priority class
    el.inventoryBox.className = 'inventory-box priority-' + decision.priority;
    el.inventoryBox.style.display = 'block';
    
    // Fill data
    el.inventoryTitle.textContent = decision.title;
    el.inventorySubtitle.textContent = decision.subtitle;
    el.inventoryTag.textContent = decision.tag;
    
    // Product details
    el.productId.textContent = product.id;
    el.currentStock.textContent = product.stock.toLocaleString() + ' units';
    el.aiRecommendation.textContent = decision.recommendation;
    el.suggestedOrder
