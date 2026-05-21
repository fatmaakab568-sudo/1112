import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVWEdRdTg9V3SaOQs1Yk45GfIUXSTATec",
    authDomain: "sddk-4508a.firebaseapp.com",
    projectId: "sddk-4508a",
    storageBucket: "sddk-4508a.firebasestorage.app",
    messagingSenderId: "566951481232",
    appId: "1:566951481232:web:c209ffd007be16c176ed15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const pwaModal = document.getElementById('pwa-modal');
    if (pwaModal) pwaModal.style.display = 'block';
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW setup failed', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {

    const installBtn = document.getElementById('pwa-install-btn');
    const closeBtn = document.getElementById('pwa-close-btn');
    const pwaModal = document.getElementById('pwa-modal');

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (pwaModal) pwaModal.style.display = 'none';
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (pwaModal) pwaModal.style.display = 'none';
        });
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('fin-date').value = today;

    let records = JSON.parse(localStorage.getItem('systemRecords')) || [];
    let financials = JSON.parse(localStorage.getItem('financialRecords')) || [];

    async function fetchFirebaseData() {
        try {
            const recQuery = await getDocs(collection(db, "systemRecords"));
            let tempRec = [];
            recQuery.forEach(docSnap => tempRec.push(docSnap.data()));
            if(tempRec.length > 0) {
                records = tempRec;
                localStorage.setItem('systemRecords', JSON.stringify(records));
            }

            const finQuery = await getDocs(collection(db, "financialRecords"));
            let tempFin = [];
            finQuery.forEach(docSnap => tempFin.push(docSnap.data()));
            if(tempFin.length > 0) {
                financials = tempFin;
                localStorage.setItem('financialRecords', JSON.stringify(financials));
            }

            if (document.getElementById('tab-transactions').classList.contains('active')) renderTransactions();
            if (document.getElementById('tab-financial').classList.contains('active')) renderFinancials();
            if (document.getElementById('tab-dashboard').classList.contains('active')) updateDashboard();
            if (document.getElementById('tab-warehouse').classList.contains('active')) updateWarehouseView();
            updateFinMaterials();
        } catch (err) {
            console.log("Firebase sync failed, using local cache.", err);
        }
    }
    fetchFirebaseData();

    // دوال التنسيق
    function fmt(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('en-US');
    }

    function parseVal(input) {
        const val = input.value || input;
        if(typeof val === 'string') {
            return parseFloat(val.replace(/,/g, '')) || 0;
        }
        return parseFloat(val) || 0;
    }

    function attachCommaFormat(input) {
        if(!input) return;
        input.addEventListener('input', function () {
            const raw = this.value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
            if (raw === '' || raw === '.' || raw === '-') { this.value = raw; return; }
            const parts = raw.split('.');
            parts[0] = Number(parts[0]).toLocaleString('en-US');
            this.value = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
        });
    }

    // التبويبات
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(targetId) {
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (targetNav) targetNav.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'tab-transactions') renderTransactions();
        if (targetId === 'tab-financial')    renderFinancials();
        if (targetId === 'tab-dashboard')    updateDashboard();
        if (targetId === 'tab-warehouse')    updateWarehouseView();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    // --- حسابات البيانات ---
    const qtyInput           = document.getElementById('quantity');
    const purchaseInput      = document.getElementById('purchase-price');
    const sellingInput       = document.getElementById('selling-price');
    const amountReceivedInput= document.getElementById('amount-received');
    const totalSaleDisplay   = document.getElementById('total-sale-display');
    const netProfitDisplay   = document.getElementById('net-profit-display');
    const remainingDebtDisplay=document.getElementById('remaining-debt-display');

    attachCommaFormat(qtyInput);
    attachCommaFormat(purchaseInput);
    attachCommaFormat(sellingInput);
    attachCommaFormat(amountReceivedInput);
    attachCommaFormat(document.getElementById('fin-amount'));
    attachCommaFormat(document.getElementById('fin-tonnage'));

    function calculateLive() {
        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const selling  = parseVal(sellingInput);
        const received = parseVal(amountReceivedInput);

        const totalSale    = qty * selling;
        const netProfit    = (selling - purchase) * qty;
        const totalPurchase= qty * purchase;
        const remaining    = totalPurchase - received;

        totalSaleDisplay.textContent    = fmt(totalSale);
        netProfitDisplay.textContent    = fmt(netProfit);
        remainingDebtDisplay.textContent= fmt(remaining);
    }

    function autoFillReceived() {
        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const total    = qty * purchase;
        amountReceivedInput.value = total > 0 ? fmt(Math.round(total)) : '';
        calculateLive();
    }

    qtyInput.addEventListener('input', autoFillReceived);
    purchaseInput.addEventListener('input', () => { autoFillReceived(); saveDefaultPrices(); });
    sellingInput.addEventListener('input',  () => { calculateLive();    saveDefaultPrices(); });
    amountReceivedInput.addEventListener('input', calculateLive);

    function saveDefaultPrices() {
        const p = parseVal(purchaseInput);
        const s = parseVal(sellingInput);
        if (p) localStorage.setItem('defaultPurchasePrice', p);
        if (s) localStorage.setItem('defaultSellingPrice', s);
    }

    function loadDefaultPrices() {
        const defPurchase = localStorage.getItem('defaultPurchasePrice');
        const defSelling  = localStorage.getItem('defaultSellingPrice');
        if (defPurchase && !purchaseInput.value) purchaseInput.value = fmt(Number(defPurchase));
        if (defSelling  && !sellingInput.value)  sellingInput.value  = fmt(Number(defSelling));
        calculateLive();
    }

    loadDefaultPrices();

    // --- حفظ حركة البيانات ---
    const form = document.getElementById('record-form');
    const recordIdInput = document.getElementById('record-id');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentId = recordIdInput.value;
        const inputDate = document.getElementById('date').value;
        const inputCar = document.getElementById('car-info').value.trim();

        const isCarDuplicate = records.some(rec =>
            rec.date === inputDate &&
            rec.carInfo.trim().toLowerCase() === inputCar.toLowerCase() &&
            String(rec.id) !== String(currentId)
        );

        if (isCarDuplicate) {
            alert(`عذراً، السيارة (${inputCar}) مسجلة مسبقاً بتاريخ ${inputDate}.\nيمكن تسجيلها في يوم مختلف.`);
            return;
        }

        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const selling  = parseVal(sellingInput);
        const received = parseVal(amountReceivedInput);
        const cashier  = document.getElementById('cashier-name').value.trim();

        const recordData = {
            id: currentId ? parseInt(currentId) : Date.now(),
            date: inputDate,
            driverName: document.getElementById('driver-name').value.trim(),
            companyName: document.getElementById('company-name').value.trim(),
            carInfo: inputCar,
            materialType: document.getElementById('material-type').value.trim(),
            unitType: document.getElementById('unit-type').value,
            quantity: qty,
            purchasePrice: purchase,
            sellingPrice: selling,
            totalSale: qty * selling,
            netProfit: (selling - purchase) * qty,
            cashierName: cashier || 'بدون صندوق',
            amountReceived: received,
            remainingDebt: (qty * purchase) - received
        };

        if (currentId) {
            const index = records.findIndex(r => String(r.id) === String(currentId));
            if (index !== -1) records[index] = recordData;
            alert('✅ تم تعديل الحركة بنجاح!');
        } else {
            records.push(recordData);
            alert('✅ تم حفظ الحركة بنجاح!');
        }

        localStorage.setItem('systemRecords', JSON.stringify(records));
        setDoc(doc(db, "systemRecords", String(recordData.id)), recordData).catch(err => console.log(err));
        resetSalesForm();
    });

    function resetSalesForm() {
        form.reset();
        recordIdInput.value = '';
        submitBtn.textContent = 'حفظ البيانات';
        document.getElementById('date').value = today;
        loadDefaultPrices();
    }

    // --- جدول الحركات اليومية ---
    const transactionsBody = document.getElementById('transactions-body');
    const searchDriver = document.getElementById('search-driver');
    const searchCompany = document.getElementById('search-company');
    const searchDate = document.getElementById('search-date');

    function renderTransactions() {
        transactionsBody.innerHTML = '';
        const driverFilter = searchDriver.value.trim().toLowerCase();
        const companyFilter = searchCompany.value.trim().toLowerCase();
        const dateFilter = searchDate.value;

        const filteredRecords = records.filter(rec => {
            const matchDriver = driverFilter ? rec.driverName.toLowerCase().includes(driverFilter) : true;
            const matchCompany = companyFilter ? rec.companyName.toLowerCase().includes(companyFilter) : true;
            const matchDate = dateFilter ? rec.date === dateFilter : true;
            return matchDriver && matchCompany && matchDate;
        });

        if (filteredRecords.length === 0) {
            transactionsBody.innerHTML = `<tr class="empty-row"><td colspan="13">لا توجد حركات مطابقة للبحث</td></tr>`;
            return;
        }

        filteredRecords.sort((a, b) => b.id - a.id).forEach(rec => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rec.date}</td>
                <td>${rec.driverName}</td>
                <td>${rec.carInfo}</td>
                <td>${rec.companyName}</td>
                <td>${rec.materialType} (${rec.unitType})</td>
                <td>${fmt(rec.quantity)}</td>
                <td>${fmt(rec.purchasePrice)}</td>
                <td>${fmt(rec.sellingPrice)}</td>
                <td style="color:var(--accent-color); font-weight:bold;">${rec.cashierName}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(rec.amountReceived)}</td>
                <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit edit-sale" data-id="${rec.id}">تعديل</button>
                        <button class="action-btn btn-delete delete-sale" data-id="${rec.id}">حذف</button>
                    </div>
                </td>
            `;
            transactionsBody.appendChild(tr);
        });
    }

    transactionsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = records.find(r => r.id === id);
            if (rec) {
                recordIdInput.value = rec.id;
                document.getElementById('date').value = rec.date;
                document.getElementById('driver-name').value = rec.driverName;
                document.getElementById('company-name').value = rec.companyName;
                document.getElementById('car-info').value = rec.carInfo;
                document.getElementById('material-type').value = rec.materialType;
                document.getElementById('unit-type').value = rec.unitType;
                qtyInput.value             = rec.quantity;
                purchaseInput.value        = fmt(rec.purchasePrice);
                sellingInput.value         = fmt(rec.sellingPrice);
                document.getElementById('cashier-name').value = rec.cashierName;
                amountReceivedInput.value  = fmt(rec.amountReceived);
                submitBtn.textContent = 'تعديل البيانات';
                calculateLive();
                switchTab('tab-add');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('delete-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
                records = records.filter(r => r.id !== id);
                localStorage.setItem('systemRecords', JSON.stringify(records));
                deleteDoc(doc(db, "systemRecords", String(id))).catch(err => console.log(err));
                renderTransactions();
            }
        }
    });

    searchDriver.addEventListener('input', renderTransactions);
    searchCompany.addEventListener('input', renderTransactions);
    searchDate.addEventListener('change', renderTransactions);


    // ==========================================================
    // الصندوق ذو المنطق المزدوج (قبض شركة / إيداع وسحب فورمن)
    // ==========================================================
    const finForm = document.getElementById('financial-form');
    const finIdInput = document.getElementById('financial-id');
    const finSubmitBtn = document.getElementById('fin-submit-btn');
    const finType = document.getElementById('fin-type');
    const receiptFields = document.getElementById('receipt-fields');
    const fundFields = document.getElementById('fund-fields');
    const finEntity = document.getElementById('fin-entity');
    const finMaterial = document.getElementById('fin-material');
    const finTonnage = document.getElementById('fin-tonnage');
    const finAmount = document.getElementById('fin-amount');
    const debtHint = document.getElementById('debt-hint');

    // إظهار وإخفاء الحقول حسب نوع السند
    function toggleFinFields() {
        if (finType.value === 'receipt') {
            receiptFields.style.display = 'block';
            fundFields.style.display = 'none';
        } else {
            // إيداع أو سحب للفورمن
            receiptFields.style.display = 'none';
            fundFields.style.display = 'block';
        }
    }
    finType.addEventListener('change', toggleFinFields);
    toggleFinFields(); 

    // جلب المواد تلقائياً في سند القبض
    function updateFinMaterials() {
        if (finType.value !== 'receipt') return;
        const entityVal = finEntity.value.trim().toLowerCase();
        const currentSelected = finMaterial.value;
        finMaterial.innerHTML = '<option value="">كل المواد</option>';
        if (!entityVal) return;

        const mats = [...new Set(
            records.filter(r => r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal))
                   .map(r => r.materialType).filter(Boolean)
        )];

        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            if (m === currentSelected || mats.length === 1) opt.selected = true;
            finMaterial.appendChild(opt);
        });
    }

    // إظهار الطنية المتبقية وحساب المبلغ تلقائيا للشركات
    function autoFillDebt(skipInputs = false) {
        if (finType.value !== 'receipt') {
            debtHint.style.display = 'none';
            return;
        }
        
        const entityVal = finEntity.value.trim().toLowerCase();
        const matVal = finMaterial.value;

        if (!entityVal) {
            debtHint.style.display = 'none';
            if (!skipInputs) {
                finTonnage.value = '';
                finAmount.value = '';
            }
            return;
        }

        let totalQty = 0;
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal)) {
                if (!matVal || r.materialType === matVal) totalQty += (r.quantity || 0);
            }
        });

        financials.forEach(f => {
            if (f.type === 'receipt' && f.entityName && f.entityName.toLowerCase().includes(entityVal)) {
                if (!matVal || f.material === matVal) {
                    totalQty -= (parseFloat(f.tonnage) || 0);
                }
            }
        });

        debtHint.style.display = 'block';
        const matText = matVal ? `من مادة (${matVal})` : 'لكل المواد';
        if (totalQty > 0) {
            debtHint.innerHTML = `<i class="fas fa-info-circle"></i> الطنية المتبقية لهذه الجهة ${matText}: <strong>${fmt(totalQty)}</strong>`;
        } else {
            debtHint.innerHTML = `<i class="fas fa-check-circle" style="color:var(--profit-color)"></i> لا توجد طنية متبقية لهذه الجهة`;
        }

        if (!skipInputs) {
            finTonnage.value = totalQty > 0 ? totalQty : '';
            autoCalculateFinAmount();
        }
    }

    function autoCalculateFinAmount() {
        if (finType.value !== 'receipt') return;
        const entityVal = finEntity.value.trim().toLowerCase();
        const tonnageVal = parseVal(finTonnage);
        const matVal = finMaterial.value;
        
        if (!entityVal || tonnageVal <= 0) {
            finAmount.value = '';
            return;
        }

        let sellingPrice = 0;
        const lastRecord = [...records].reverse().find(r =>
            (r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal)) &&
            (!matVal || r.materialType === matVal)
        );

        if (lastRecord) sellingPrice = lastRecord.sellingPrice || 0;
        else sellingPrice = parseFloat(localStorage.getItem('defaultSellingPrice')) || 0;

        if (sellingPrice > 0) {
            finAmount.value = fmt(Math.round(tonnageVal * sellingPrice));
        } else {
            finAmount.value = '';
        }
    }

    finEntity.addEventListener('input', () => { updateFinMaterials(); autoFillDebt(false); });
    finMaterial.addEventListener('change', () => autoFillDebt(false));
    finTonnage.addEventListener('input', autoCalculateFinAmount);

    finForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = finIdInput.value;
        const typeVal = finType.value;
        
        let data = {
            id: id ? parseInt(id) : Date.now(),
            date: document.getElementById('fin-date').value,
            type: typeVal,
            amount: parseVal(finAmount),
            notes: document.getElementById('fin-notes').value.trim()
        };

        if (typeVal === 'receipt') {
            data.entityName = finEntity.value.trim();
            data.material = finMaterial.value;
            data.tonnage = parseVal(finTonnage);
            data.cashierName = ''; 
        } else {
            data.cashierName = document.getElementById('fin-cashier').value.trim();
            data.entityName = '';
            data.material = '';
            data.tonnage = 0;
        }

        if (id) {
            const idx = financials.findIndex(f => f.id.toString() === id);
            if (idx > -1) financials[idx] = data;
            alert('✅ تم تعديل السند بنجاح!');
        } else {
            financials.push(data);
            alert('✅ تم حفظ العملية بنجاح!');
        }

        localStorage.setItem('financialRecords', JSON.stringify(financials));
        setDoc(doc(db, "financialRecords", String(data.id)), data).catch(err => console.log(err));
        finForm.reset();
        finIdInput.value = '';
        document.getElementById('fin-date').value = today;
        finMaterial.innerHTML = '<option value="">كل المواد</option>';
        debtHint.style.display = 'none';
        finSubmitBtn.textContent = 'حفظ السند';
        toggleFinFields();
        renderFinancials();
    });

    // عرض سجل الصندوق
    function renderFinancials() {
        const body = document.getElementById('financial-body');
        body.innerHTML = '';

        if (financials.length === 0) {
            body.innerHTML = `<tr class="empty-row"><td colspan="8">لا توجد حركات مسجلة</td></tr>`;
            return;
        }

        [...financials].sort((a, b) => b.id - a.id).forEach(f => {
            const tr = document.createElement('tr');
            
            let typeHTML = '';
            let targetName = '';
            let matTonnage = '-';

            if (f.type === 'receipt') {
                typeHTML = `<span class="icon-receipt"><i class="fas fa-arrow-circle-down"></i></span><span style="color:#00e676; font-weight:bold;">قبض</span>`;
                targetName = f.entityName || '-';
                const m = f.material || 'كل المواد';
                const t = f.tonnage ? `${fmt(f.tonnage)} طن` : '-';
                matTonnage = `${m} <br><small>(${t})</small>`;
            } else if (f.type === 'deposit') {
                typeHTML = `<span class="icon-receipt"><i class="fas fa-wallet"></i></span><span style="color:#00d2ff; font-weight:bold;">إيداع صندوق</span>`;
                targetName = f.cashierName || f.fundName || f.entityName || '-';
            } else {
                typeHTML = `<span class="icon-payment"><i class="fas fa-arrow-circle-up"></i></span><span style="color:#ff5252; font-weight:bold;">سحب مصروف</span>`;
                targetName = f.cashierName || f.fundName || f.entityName || '-';
            }

            tr.innerHTML = `
                <td>${f.date}</td>
                <td>${typeHTML}</td>
                <td style="color:var(--accent-color); font-weight:bold;">${targetName}</td>
                <td>${matTonnage}</td>
                <td style="font-weight:bold;">${fmt(f.amount)}</td>
                <td>${f.notes || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit fin-edit" data-id="${f.id}">تعديل</button>
                        <button class="action-btn btn-delete fin-delete" data-id="${f.id}">حذف</button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    document.getElementById('financial-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('fin-edit')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = financials.find(f => f.id === id);
            if (rec) {
                finIdInput.value = rec.id;
                document.getElementById('fin-date').value = rec.date;
                
                let t = rec.type;
                if(t === 'payment') t = 'withdraw'; // توافقية للسجلات القديمة
                finType.value = t;
                toggleFinFields();
                
                if (t === 'receipt') {
                    finEntity.value = rec.entityName || rec.companyName || '';
                    finEntity.dispatchEvent(new Event('input')); // جلب المواد
                    setTimeout(() => {
                        finMaterial.value = rec.material || '';
                    }, 50);
                    finTonnage.value = rec.tonnage ? fmt(rec.tonnage) : '';
                } else {
                    document.getElementById('fin-cashier').value = rec.cashierName || rec.fundName || rec.entityName || '';
                }

                finAmount.value = fmt(rec.amount);
                document.getElementById('fin-notes').value = rec.notes || '';
                
                finSubmitBtn.textContent = 'تعديل السند';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('fin-delete')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل متأكد من حذف هذا السند نهائياً؟')) {
                financials = financials.filter(f => f.id !== id);
                localStorage.setItem('financialRecords', JSON.stringify(financials));
                deleteDoc(doc(db, "financialRecords", String(id))).catch(err => console.log(err));
                renderFinancials();
            }
        }
    });


    // --- كشف الحساب التفصيلي للشركات ---
    document.getElementById('stmt-entity').addEventListener('input', function () {
        const entity = this.value.trim().toLowerCase();
        const matSel = document.getElementById('stmt-material');
        matSel.innerHTML = '<option value="all">كل المواد</option>';
        if (!entity) {
            document.getElementById('stmt-result').style.display = 'none';
            return;
        }

        const mats = [...new Set(
            records.filter(r => r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity))
                   .map(r => r.materialType).filter(Boolean)
        )];

        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            matSel.appendChild(opt);
        });

        document.getElementById('btn-generate-stmt').click();
    });

    document.getElementById('stmt-from').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-to').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-material').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());

    document.getElementById('btn-generate-stmt').addEventListener('click', () => {
        const from = document.getElementById('stmt-from').value;
        const to = document.getElementById('stmt-to').value;
        const entity = document.getElementById('stmt-entity').value.trim().toLowerCase();
        const matFilter = document.getElementById('stmt-material').value;

        if (!entity) {
            document.getElementById('stmt-result').style.display = 'none';
            return;
        }

        let stmtRecords = [];

        // 1. المشتريات (ديون على الشركة بسعر البيع)
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity)) {
                if ((!from || r.date >= from) && (!to || r.date <= to)) {
                    if (matFilter !== 'all' && r.materialType !== matFilter) return;
                    stmtRecords.push({
                        date: r.date,
                        type: 'حركة شراء',
                        person: r.driverName,
                        car: r.carInfo,
                        material: r.materialType,
                        quantity: r.quantity,
                        purchasePrice: r.sellingPrice,
                        debit: r.quantity * r.sellingPrice, // المبلغ المطلوب من الشركة
                        credit: 0
                    });
                }
            }
        });

        // 2. سندات القبض (الشركة تدفع وتسدد ديونها)
        financials.forEach(f => {
            if (f.type === 'receipt' && f.entityName && f.entityName.toLowerCase().includes(entity)) {
                if (matFilter !== 'all' && f.material && f.material !== matFilter) return;
                if ((!from || f.date >= from) && (!to || f.date <= to)) {
                    stmtRecords.push({
                        date: f.date,
                        type: '✅ سند قبض (تسديد)',
                        person: f.entityName,
                        car: '-',
                        material: f.material || '-',
                        quantity: f.tonnage ? fmt(f.tonnage) : '-',
                        purchasePrice: '-',
                        debit: 0,
                        credit: f.amount // المبلغ الواصل من الشركة
                    });
                }
            }
        });

        stmtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        const stmtBody = document.getElementById('stmt-body');
        stmtBody.innerHTML = '';

        let totalDebit = 0;
        let totalCredit = 0;

        if (stmtRecords.length === 0) {
            stmtBody.innerHTML = `<tr class="empty-row"><td colspan="9">لا توجد حركات لهذه الجهة في الفترة المحددة</td></tr>`;
        } else {
            stmtRecords.forEach(row => {
                totalDebit += row.debit;
                totalCredit += row.credit;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.date}</td>
                    <td style="font-size:0.85rem;">${row.type}</td>
                    <td>${row.person}</td>
                    <td>${row.car}</td>
                    <td>${row.material}</td>
                    <td dir="ltr">${row.quantity}</td>
                    <td>${row.purchasePrice !== '-' ? fmt(row.purchasePrice) : '-'}</td>
                    <td style="color:#ff5252; font-weight:bold;">${row.debit > 0 ? fmt(row.debit) : '-'}</td>
                    <td style="color:#00e676; font-weight:bold;">${row.credit > 0 ? fmt(row.credit) : '-'}</td>
                `;
                stmtBody.appendChild(tr);
            });
        }

        const finalBalance = totalDebit - totalCredit;
        document.getElementById('stmt-final-balance').textContent = fmt(finalBalance);
        document.getElementById('stmt-total-paid').textContent = fmt(totalCredit);
        document.getElementById('stmt-result').style.display = 'block';
    });


    // --- الإحصائيات وأرصدة الصناديق (العُهد) ---
    const filterCompanySelect = document.getElementById('filter-company');
    const filterDriverInput = document.getElementById('filter-driver');

    function updateDashboard() {
        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))];
        const currentSelection = filterCompanySelect.value;
        filterCompanySelect.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company; option.textContent = company;
            filterCompanySelect.appendChild(option);
        });
        filterCompanySelect.value = currentSelection || 'all';
        
        calculateDashboardStats();
    }

    function calculateDashboardStats() {
        
        // --- 1. حساب وعرض أرصدة عُهد الفورمنية فقط ---
        let funds = {};
        
        // الإيداع والسحب الخاص بالفورمنية
        financials.forEach(f => {
            if (f.type === 'receipt') return; // سند القبض خاص بالشركات
            
            let name = (f.cashierName || f.fundName || f.entityName || f.boxName || '').trim();
            if (!name) return;
            if (!funds[name]) funds[name] = 0;
            
            if (f.type === 'deposit') {
                funds[name] += (parseFloat(f.amount) || 0); // تمويل
            } else if (f.type === 'withdraw' || f.type === 'payment') {
                funds[name] -= (parseFloat(f.amount) || 0); // مصروف
            }
        });

        // المبالغ التي دفعها الفورمن في شاشة البيانات
        records.forEach(r => {
            let name = (r.cashierName || '').trim();
            if (name && r.amountReceived) {
                if (!funds[name]) funds[name] = 0;
                funds[name] -= (parseFloat(r.amountReceived) || 0);
            }
        });

        const fundGrid = document.getElementById('fund-balances-grid');
        fundGrid.innerHTML = '';
        
        const fNames = Object.keys(funds);
        if (fNames.length === 0) {
            fundGrid.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1;">لا توجد عُهد مالية مسجلة للفورمنية حالياً.</p>';
        } else {
            fNames.forEach(name => {
                const bal = funds[name];
                const isNegative = bal < 0; 
                const box = document.createElement('div');
                
                box.className = `stat-box glass-panel-inner ${isNegative ? 'warning' : ''}`;
                if (!isNegative && bal > 0) box.style.borderColor = 'var(--profit-color)';
                else if (isNegative) box.style.borderColor = 'var(--danger-color)';

                const colorStyle = isNegative ? 'color: var(--danger-color);' : (bal > 0 ? 'color: var(--profit-color);' : 'color: white;');
                
                box.innerHTML = `
                    <h3 style="${isNegative ? 'color: var(--danger-color);' : ''}"><i class="fas fa-wallet"></i> فورمن/صندوق: ${name}</h3>
                    <p style="${colorStyle} font-weight:bold; font-size:1.5rem;" dir="ltr">${fmt(bal)}</p>
                    ${isNegative ? '<small style="color:var(--danger-color); display:block; margin-top:5px; font-size:0.85rem; font-weight:bold;">(دفع من حسابه الشخصي)</small>' : ''}
                `;
                fundGrid.appendChild(box);
            });
        }

        // --- 2. إحصائيات العمل العامة (مع خصم سندات القبض) ---
        const selectedCompany = filterCompanySelect.value;
        const driverFilter = filterDriverInput.value.trim().toLowerCase();

        let filteredRecords = records;

        if (selectedCompany !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.companyName === selectedCompany);
        }
        if (driverFilter) {
            filteredRecords = filteredRecords.filter(r => r.driverName.toLowerCase().includes(driverFilter));
        }

        let finalTotalQty = 0;
        let finalTotalProfit = 0;
        let finalTotalSales = 0;
        let finalTotalPurchases = 0;
        let currentDebt = 0;

        filteredRecords.forEach(rec => {
            finalTotalQty += (rec.quantity || 0);
            finalTotalProfit += (rec.netProfit || 0);
            finalTotalSales += ((rec.quantity || 0) * (rec.sellingPrice || 0));
            finalTotalPurchases += ((rec.quantity || 0) * (rec.purchasePrice || 0));
            currentDebt += ((rec.quantity || 0) * (rec.sellingPrice || 0)); // ديون الشركة بسعر البيع
        });

        // طرح سندات القبض الخاصة بالشركات لتقليل الديون العامة والطنية المباعة
        let deductedTonnage = 0;
        let deductedDebt = 0;

        financials.forEach(f => {
            if (f.type === 'receipt') {
                let matchComp = true;
                if (selectedCompany !== 'all') {
                    const eName = (f.entityName || '').toLowerCase();
                    matchComp = eName.includes(selectedCompany.toLowerCase());
                }
                
                if (matchComp) {
                    deductedDebt += (parseFloat(f.amount) || 0);
                    deductedTonnage += (parseFloat(f.tonnage) || 0);
                }
            }
        });

        document.getElementById('stat-total-qty').textContent = fmt(Math.max(0, finalTotalQty - deductedTonnage));
        document.getElementById('stat-total-profit').textContent = fmt(finalTotalProfit);
        document.getElementById('stat-total-debt').textContent = fmt(currentDebt - deductedDebt);
        if (document.getElementById('stat-total-sales')) document.getElementById('stat-total-sales').textContent = fmt(finalTotalSales);
        if (document.getElementById('stat-total-purchases')) document.getElementById('stat-total-purchases').textContent = fmt(finalTotalPurchases);
        
        // جدول الفلترة
        const detailSection = document.getElementById('detail-section');
        const detailBody = document.getElementById('detail-body');
        if(detailBody) detailBody.innerHTML = '';

        if (selectedCompany !== 'all' || driverFilter) {
            if(detailSection) detailSection.style.display = 'block';

            if (filteredRecords.length === 0) {
                if(detailBody) detailBody.innerHTML = `<tr class="empty-row"><td colspan="11">لا توجد حركات مطابقة</td></tr>`;
            } else {
                [...filteredRecords].sort((a, b) => b.id - a.id).forEach(rec => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${rec.date}</td>
                        <td>${rec.driverName}</td>
                        <td>${rec.carInfo}</td>
                        <td>${rec.materialType}</td>
                        <td>${fmt(rec.quantity)}</td>
                        <td>${rec.unitType}</td>
                        <td>${fmt(rec.purchasePrice)}</td>
                        <td>${fmt(rec.sellingPrice)}</td>
                        <td>${fmt(rec.amountReceived)}</td>
                        <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                        <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                    `;
                    if(detailBody) detailBody.appendChild(tr);
                });
            }
        } else {
            if(detailSection) detailSection.style.display = 'none';
        }
    }

    filterCompanySelect.addEventListener('change', calculateDashboardStats);
    filterDriverInput.addEventListener('input', calculateDashboardStats);

    // ============================================================
    // عرض أرصدة المخزن (مع خصم الكميات من سندات القبض)
    // ============================================================
    function updateWarehouseView() {
        const compSel = document.getElementById('wh-filter-company');
        const matSel  = document.getElementById('wh-filter-mat-view');

        const prevComp = compSel.value;
        const prevMat  = matSel.value;

        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))].sort();
        compSel.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            compSel.appendChild(opt);
        });
        compSel.value = companies.includes(prevComp) ? prevComp : 'all';

        const mats = [...new Set(records.map(r => r.materialType).filter(Boolean))].sort();
        matSel.innerHTML = '<option value="all">كل المواد</option>';
        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            matSel.appendChild(opt);
        });
        matSel.value = mats.includes(prevMat) ? prevMat : 'all';

        renderWhBalance();
    }

    function renderWhBalance() {
        const grid     = document.getElementById('wh-balance-grid');
        const compVal  = document.getElementById('wh-filter-company').value;
        const matVal   = document.getElementById('wh-filter-mat-view').value;
        grid.innerHTML = '';

        let base = records;
        if (compVal !== 'all') base = base.filter(r => r.companyName === compVal);
        if (matVal  !== 'all') base = base.filter(r => r.materialType === matVal);

        const mats = [...new Set(base.map(r => r.materialType).filter(Boolean))];

        if (mats.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">لا توجد بيانات</p>';
            return;
        }

        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';

        mats.forEach(mat => {
            const recs       = base.filter(r => r.materialType === mat);
            let totalQty   = recs.reduce((s, r) => s + (r.quantity || 0), 0);
            let totalPurch = recs.reduce((s, r) => s + (r.quantity || 0) * (r.purchasePrice || 0), 0);
            let totalSale  = recs.reduce((s, r) => s + ((r.quantity || 0) * (r.sellingPrice || 0)), 0);
            const unit       = recs[0]?.unitType || '';

            // طرح الكميات التي تم قبضها من الصندوق (سند قبض شركة) لكي يفرغ المخزن
            let usedQty = 0;
            financials.forEach(f => {
                if (f.type === 'receipt' && (!f.material || f.material === mat)) {
                    let matchComp = true;
                    if (compVal !== 'all') {
                        const eName = (f.entityName || '').toLowerCase();
                        const cVal = compVal.toLowerCase();
                        matchComp = eName.includes(cVal) || cVal.includes(eName);
                    }
                    if (matchComp) {
                        usedQty += (parseFloat(f.tonnage) || 0);
                    }
                }
            });

            const originalQty = totalQty;
            let currentQty = totalQty - usedQty;
            if (currentQty < 0) currentQty = 0;

            if (originalQty > 0) {
                let ratio = currentQty / originalQty;
                totalPurch = Math.round(totalPurch * ratio);
                totalSale  = Math.round(totalSale * ratio);
            } else {
                totalPurch = 0;
                totalSale  = 0;
            }

            if (currentQty <= 0) return; // تم تسديد المادة بالكامل ولا تظهر في المخزن

            const box = document.createElement('div');
            box.className = 'glass-panel-inner wh-balance-box';
            box.style.borderColor = 'var(--accent-color)';
            box.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:bold; font-size:1.05rem;">${mat}</span>
                    <span style="font-size:0.8rem; background:rgba(0,230,118,0.15); color:#00e676; padding:2px 8px; border-radius:12px;">${unit}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">الكمية المتبقية</div>
                        <div style="color:#fff; font-weight:bold; font-size:1rem;">${fmt(currentQty)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">قيمة الشراء</div>
                        <div style="color:#ff5252; font-weight:bold;">${fmt(totalPurch)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">قيمة البيع</div>
                        <div style="color:#00e676; font-weight:bold;">${fmt(totalSale)}</div>
                    </div>
                </div>
            `;
            grid.appendChild(box);
        });

        if (grid.innerHTML === '') {
            grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">المخزن فارغ (تم تسديد كل الكميات)</p>';
        }
    }

    document.getElementById('wh-filter-company').addEventListener('change', () => { renderWhBalance(); });
    document.getElementById('wh-filter-mat-view').addEventListener('change', () => { renderWhBalance(); });

    // تشغيل مبدئي
    updateWarehouseView();
});
