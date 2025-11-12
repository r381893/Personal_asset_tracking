
// --- 設定 ---
const STORAGE_KEY = 'assetTrackerRecords'; // 確保唯一的儲存鍵
const assetForm = document.getElementById('assetForm');
const recordList = document.getElementById('recordList');
const latestSummary = document.getElementById('latestSummary');
const clearDataBtn = document.getElementById('clearDataBtn');
const totalAssetCtx = document.getElementById('totalAssetChart').getContext('2d');
const dailyChangeCtx = document.getElementById('dailyChangeChart').getContext('2d');

let records = []; // 儲存計算後的紀錄
let totalAssetChart;
let dailyChangeChart;

// --- 輔助函式 ---

// 格式化數字為千位分隔，並加上 NT$ 符號
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

// 取得星期幾
const getWeekday = (dateString) => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    return `週${days[date.getDay()]}`;
};

// --- 核心邏輯：Excel 公式模擬 ---

const calculateRecords = (rawRecords) => {
    // 依日期排序，確保變化量計算正確
    rawRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    let previousTotal = 0;
    let previousAsset1 = 0;
    let previousAsset2 = 0;

    return rawRecords.map((record, index) => {
        const currentAsset1 = parseFloat(record.asset1);
        const currentAsset2 = parseFloat(record.asset2);
        const currentTotal = currentAsset1 + currentAsset2;

        // 計算變化量 (只有第一天變化量為 0，之後為當日減前日)
        const asset1Change = index === 0 ? 0 : currentAsset1 - previousAsset1;
        const asset2Change = index === 0 ? 0 : currentAsset2 - previousAsset2;
        const totalChange = index === 0 ? 0 : currentTotal - previousTotal;

        // 更新 previous 值給下一個紀錄使用
        previousAsset1 = currentAsset1;
        previousAsset2 = currentAsset2;
        previousTotal = currentTotal;

        return {
            ...record,
            totalAsset: currentTotal,
            asset1Change: asset1Change,
            asset2Change: asset2Change,
            totalChange: totalChange,
        };
    });
};

// --- 數據載入、儲存與繪圖 ---

const loadRecords = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const rawRecords = stored ? JSON.parse(stored) : [];
    
    // 計算所有公式 (總資產和每日變化)
    records = calculateRecords(rawRecords);
    
    renderRecords();
    drawCharts();
    updateSummary();
};

const saveRecords = () => {
    // 只儲存原始輸入數據 (date, asset1, asset2) 到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(r => ({ date: r.date, asset1: r.asset1, asset2: r.asset2 }))));
    loadRecords(); // 重新載入並計算
};

const updateSummary = () => {
    if (records.length === 0) {
        latestSummary.innerHTML = '<strong>尚未有紀錄。</strong> 請新增第一筆資產數據。';
        return;
    }

    const latest = records[records.length - 1];
    const initial = records[0];

    const totalGain = latest.totalAsset - initial.totalAsset;
    const gainPercent = (totalGain / initial.totalAsset) * 100;
    const changeClass = totalGain >= 0 ? 'style="color: green; font-weight: bold;"' : 'style="color: red; font-weight: bold;"';

    latestSummary.innerHTML = `
        <div style="display:flex; justify-content: space-between;">
            <div>📅 <strong>最新紀錄日期:</strong> ${latest.date}</div>
            <div ${changeClass}>🚀 <strong>累積盈虧:</strong> ${formatCurrency(totalGain)} (${gainPercent.toFixed(2)}%)</div>
        </div>
        <hr style="border-color: #ddd; margin: 0.5rem 0;">
        <div style="text-align: right; font-size: 1.2rem;">
            <strong>最新總資產:</strong> ${formatCurrency(latest.totalAsset)}
        </div>
    `;
};

const drawCharts = () => {
    // 銷毀舊圖表
    if (totalAssetChart) totalAssetChart.destroy();
    if (dailyChangeChart) dailyChangeChart.destroy();

    if (records.length < 1) {
        // 沒有數據不繪圖
        return;
    }

    const labels = records.map(r => `${r.date} (${getWeekday(r.date)})`);
    const totalAssets = records.map(r => r.totalAsset);
    const asset1Changes = records.map(r => r.asset1Change);
    const asset2Changes = records.map(r => r.asset2Change);

    // --- 1. 總資產曲線圖 ---
    totalAssetChart = new Chart(totalAssetCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '總資產 (元)',
                data: totalAssets,
                borderColor: '#3498db',
                tension: 0.2,
                fill: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } }
        }
    });

    // --- 2. 每日變化量比較圖 ---
    dailyChangeChart = new Chart(dailyChangeCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '資產一 (台股) 變化',
                    data: asset1Changes,
                    backgroundColor: 'rgba(46, 204, 113, 0.7)', // 綠色系
                },
                {
                    label: '資產二 (美股) 變化',
                    data: asset2Changes,
                    backgroundColor: 'rgba(230, 126, 34, 0.7)', // 橘色系
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: false },
                y: { beginAtZero: true }
            }
        }
    });
};

const renderRecords = () => {
    recordList.innerHTML = '';
    
    // 反向迭代，讓最新紀錄顯示在最上方
    if (records.length === 0) {
        recordList.innerHTML = '<p class="small" style="text-align: center;">尚未有任何歷史紀錄。</p>';
        return;
    }

    [...records].reverse().forEach((record) => {
        const recordElement = document.createElement('div');
        recordElement.classList.add('record');
        
        const changeClass = record.totalChange >= 0 ? 'color: green;' : 'color: red;';

        recordElement.innerHTML = `
            <div class="record-left">
                <strong>${record.date} (${getWeekday(record.date)})</strong>
                <span class="small">總資產: ${formatCurrency(record.totalAsset)}</span>
                <span class="small" style="${changeClass}">日變化: ${formatCurrency(record.totalChange)}</span>
            </div>
            <div class="controls">
                <button class="delete-btn" data-date="${record.date}">刪除</button>
            </div>
        `;
        recordList.appendChild(recordElement);
    });
};

// --- 事件監聽器 ---

// 1. 提交表單新增或更新紀錄
assetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newDate = document.getElementById('date').value;
    const newAsset1 = document.getElementById('asset1').value;
    const newAsset2 = document.getElementById('asset2').value;

    const newRecord = {
        date: newDate,
        asset1: parseFloat(newAsset1),
        asset2: parseFloat(newAsset2),
    };

    // 檢查是否有重複日期，若有則覆蓋 (實現更新功能)
    const existingIndex = records.findIndex(r => r.date === newDate);
    
    if (existingIndex > -1) {
        // 覆蓋舊紀錄 (只覆蓋原始輸入值)
        records[existingIndex] = newRecord; 
        alert(`日期 ${newDate} 的紀錄已更新！`);
    } else {
        // 新增紀錄
        records.push(newRecord); 
        alert('新紀錄已儲存！');
    }

    saveRecords(); // 儲存到 localStorage 並重新載入
    assetForm.reset();
});

// 2. 刪除紀錄
recordList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const dateToDelete = e.target.dataset.date;
        if (confirm(`確定要刪除 ${dateToDelete} 的紀錄嗎？這將無法復原。`)) {
            records = records.filter(r => r.date !== dateToDelete);
            saveRecords();
        }
    }
});

// 3. 清除所有數據
clearDataBtn.addEventListener('click', () => {
    if (confirm('警告！確定要清除所有資產追蹤數據嗎？這將無法復原。')) {
        localStorage.removeItem(STORAGE_KEY);
        records = [];
        loadRecords();
        alert('所有數據已清除。');
    }
});

// 4. 顯示日期星期幾
document.getElementById('date').addEventListener('change', (e) => {
    document.getElementById('weekdayDisplay').textContent = getWeekday(e.target.value);
});

// 頁面載入時執行
window.onload = loadRecords;
