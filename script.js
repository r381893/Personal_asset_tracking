<script>
        // --- 設定 ---
        const STORAGE_KEY = 'assetTrackerRecords'; 
        const assetForm = document.getElementById('assetForm');
        const recordList = document.getElementById('recordList');
        const latestSummary = document.getElementById('latestSummary');
        const clearDataBtn = document.getElementById('clearDataBtn');
        const exportDataBtn = document.getElementById('exportDataBtn'); 
        const importDataBtn = document.getElementById('importDataBtn');
        const importFile = document.getElementById('importFile');
        const timeRangeControls = document.getElementById('timeRangeControls'); // 圖表控制項
        const recordTimeRangeControls = document.getElementById('recordTimeRangeControls'); // 紀錄控制項
        const totalAssetCtx = document.getElementById('totalAssetChart').getContext('2d');
        const dailyChangeCtx = document.getElementById('dailyChangeChart').getContext('2d');

        let records = []; 
        let totalAssetChart;
        let dailyChangeChart;
        // 預設為 '30' (近 1 個月)
        let currentChartRange = '30'; 
        // 預設為 '30' (近 1 個月)
        let currentRecordRange = '30'; 

        // --- 輔助函式 ---

        // 格式化數字為千位分隔，並加上 NT$ 符號
        const formatCurrency = (amount) => {
            if (isNaN(amount) || amount === null) return 'NT$ 0';
            return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
        };

        // 取得星期幾
        const getWeekday = (dateString) => {
            const days = ['日', '一', '二', '三', '四', '五', '六'];
            const date = new Date(dateString);
            if (isNaN(date)) return '';
            return `週${days[date.getDay()]}`;
        };

        // 初始化日期輸入欄位為今天的日期
        const initializeDate = () => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            
            const dateInput = document.getElementById('date');
            const todayDateString = `${year}-${month}-${day}`;
            
            if (!dateInput.value) {
                dateInput.value = todayDateString;
            }
            
            document.getElementById('weekdayDisplay').textContent = getWeekday(dateInput.value);
        };


        // --- 核心邏輯：Excel 公式模擬與數據篩選 ---

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

                const asset1Change = index === 0 ? 0 : currentAsset1 - previousAsset1;
                const asset2Change = index === 0 ? 0 : currentAsset2 - previousAsset2;
                const totalChange = index === 0 ? 0 : currentTotal - previousTotal;

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
        
        // 篩選記錄的輔助函式
        const filterRecordsByRange = (sourceRecords, range) => {
            if (range === 'all') {
                return sourceRecords;
            }

            const days = parseInt(range, 10);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            return sourceRecords.filter(r => new Date(r.date) >= cutoffDate);
        };


        // --- 數據載入、儲存與繪圖 ---

        const loadRecords = () => {
            const stored = localStorage.getItem(STORAGE_KEY);
            const rawRecords = stored ? JSON.parse(stored) : [];
            
            records = calculateRecords(rawRecords);
            
            // 載入數據後，分別根據各自的 currentRange 篩選並渲染
            const filteredChartData = filterRecordsByRange(records, currentChartRange); 
            const filteredRecordData = filterRecordsByRange(records, currentRecordRange); 

            renderRecords(filteredRecordData); 
            drawCharts(filteredChartData); 
            updateSummary();
        };

        const saveRecords = () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(r => ({ date: r.date, asset1: r.asset1, asset2: r.asset2 }))));
            loadRecords(); 
        };

        const updateSummary = () => {
            if (records.length === 0) {
                latestSummary.innerHTML = '<strong>尚未有紀錄。</strong> 請新增第一筆資產數據。';
                return;
            }

            const latest = records[records.length - 1];
            const initial = records[0];

            const totalGain = latest.totalAsset - initial.totalAsset;
            const gainPercent = initial.totalAsset !== 0 ? (totalGain / initial.totalAsset) * 100 : 0; 
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

        // 繪製圖表 (使用 filteredRecords)
        const drawCharts = (filteredRecords) => {
            if (totalAssetChart) totalAssetChart.destroy();
            if (dailyChangeChart) dailyChangeChart.destroy();

            if (filteredRecords.length < 1) {
                return;
            }
            
            const labels = filteredRecords.map(r => {
                const parts = r.date.split('-'); 
                return `${parts[1]}/${parts[2]}`; 
            });
            
            const totalAssets = filteredRecords.map(r => r.totalAsset);
            const asset1Changes = filteredRecords.map(r => r.asset1Change);
            const asset2Changes = filteredRecords.map(r => r.asset2Change);

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
                    scales: { 
                        y: { beginAtZero: false },
                        x: { ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 } }
                    }
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
                            backgroundColor: 'rgba(46, 204, 113, 0.7)', 
                        },
                        {
                            label: '資產二 (美股) 變化',
                            data: asset2Changes,
                            backgroundColor: 'rgba(230, 126, 34, 0.7)', 
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

        // 渲染歷史紀錄列表 (使用 recordsToRender)
        const renderRecords = (recordsToRender) => {
            recordList.innerHTML = '';
            
            if (recordsToRender.length === 0) {
                if (records.length > 0 && currentRecordRange !== 'all') { 
                    recordList.innerHTML = '<p class="small" style="text-align: center;">當前時間範圍內無紀錄。</p>';
                } else {
                    recordList.innerHTML = '<p class="small" style="text-align: center;">尚未有任何歷史紀錄。</p>';
                }
                return;
            }

            // 反向迭代，讓最新紀錄顯示在最上方
            [...recordsToRender].reverse().forEach((record) => {
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


        // --- 匯出/匯入邏輯 (關鍵修正在這裡) ---
        const exportData = () => {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                alert("目前本地儲存空間沒有任何數據可以匯出！");
                return;
            }
            
            // ⭐️ 修正：不再使用 Blob URL，改用 data URL 進行更可靠的下載
            const filename = `asset_data_${new Date().toISOString().slice(0, 10)}.json`;
            
            // 創建 Data URL，讓瀏覽器強制將內容視為下載檔案
            const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);

            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename; // 設置檔案名稱
            
            // 模擬點擊下載
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            alert(`數據已匯出為 ${filename}！`);
        };

        const importData = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!Array.isArray(importedData)) {
                         throw new Error("匯入的檔案格式錯誤。它應該是一個JSON陣列。");
                    }
                    if (importedData.length > 0 && 
                        (!importedData[0].date || !importedData[0].asset1 || !importedData[0].asset2)) {
                        throw new Error("數據結構不完整。請確保檔案是從本程式匯出的。");
                    }
                    if (confirm("確認要覆蓋您當前瀏覽器中的所有資產紀錄嗎？")) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData));
                        loadRecords();
                        alert("數據匯入成功！圖表和紀錄已更新。");
                    }
                } catch (error) {
                    alert(`匯入失敗: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };


        // --- 事件監聽器 (不變) ---

        // 1. 提交表單新增或更新紀錄 
        assetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newDate = document.getElementById('date').value;
            const newAsset1 = parseFloat(document.getElementById('asset1').value);
            const newAsset2 = parseFloat(document.getElementById('asset2').value);
            
            const newTotalAsset = newAsset1 + newAsset2;

            const newRecord = {
                date: newDate,
                asset1: newAsset1,
                asset2: newAsset2,
            };

            const existingIndex = records.findIndex(r => r.date === newDate);
            
            if (existingIndex > -1) {
                const existingTotalAsset = records[existingIndex].asset1 + records[existingIndex].asset2;

                if (newTotalAsset > existingTotalAsset) {
                    records[existingIndex] = newRecord; 
                    alert(`日期 ${newDate} 的資產已更新！總資產 (${formatCurrency(newTotalAsset)}) 高於舊紀錄 (${formatCurrency(existingTotalAsset)})，已採用新值。`);
                } else {
                    alert(`日期 ${newDate} 的資產紀錄維持不變。新總資產 (${formatCurrency(newTotalAsset)}) 未高於現有紀錄 (${formatCurrency(existingTotalAsset)})。`);
                }
            } else {
                records.push(newRecord); 
                alert('新紀錄已儲存！');
            }

            saveRecords(); 
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


        // 5. 匯出/匯入按鈕的監聽器
        exportDataBtn.addEventListener('click', exportData);

        importDataBtn.addEventListener('click', () => {
            importFile.click(); 
        });

        importFile.addEventListener('change', importData); 

        // 6. 圖表時間範圍按鈕監聽器 (只影響圖表)
        if (timeRangeControls) {
            timeRangeControls.addEventListener('click', (e) => {
                if (e.target.classList.contains('range-btn')) {
                    const newRange = e.target.dataset.range;
                    currentChartRange = newRange; // 更新圖表範圍
                    
                    document.querySelectorAll('.range-btn').forEach(btn => {
                        btn.style.border = 'none';
                    });
                    e.target.style.border = '2px solid #2c3e50'; 

                    const filtered = filterRecordsByRange(records, newRange); // 篩選圖表數據
                    drawCharts(filtered); // 繪製圖表
                }
            });
        }
        
        // 7. 歷史紀錄時間範圍按鈕監聽器 (只影響列表)
        if (recordTimeRangeControls) {
            recordTimeRangeControls.addEventListener('click', (e) => {
                if (e.target.classList.contains('record-range-btn')) {
                    const newRange = e.target.dataset.range;
                    currentRecordRange = newRange; // 更新紀錄範圍
                    
                    document.querySelectorAll('.record-range-btn').forEach(btn => {
                        btn.style.border = 'none';
                    });
                    e.target.style.border = '2px solid #2c3e50'; 

                    const filtered = filterRecordsByRange(records, newRange); // 篩選列表數據
                    renderRecords(filtered); // 渲染列表
                }
            });
        }


        // 頁面載入時執行 (包含初始化日期功能)
        window.onload = () => {
            initializeDate(); 
            loadRecords();
            
            // 確保頁面載入時，圖表「近 1 個月」按鈕被預設標記
            const defaultChartBtn = document.querySelector('#timeRangeControls [data-range="30"]');
            if (defaultChartBtn) {
                defaultChartBtn.style.border = '2px solid #2c3e50';
            }
            // 確保頁面載入時，紀錄「近 1 個月」按鈕被預設標記
            const defaultRecordBtn = document.querySelector('#recordTimeRangeControls [data-range="30"]');
            if (defaultRecordBtn) {
                defaultRecordBtn.style.border = '2px solid #2c3e50';
            }
        };
    </script>
