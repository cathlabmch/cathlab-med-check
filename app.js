const API_URL = "https://script.google.com/macros/s/AKfycbyCG5h6hCagw0Lh_CAwVuTw-a5yneALPcbSx_f5cwlfRJMvt2JSvQJ4I9V6urtiRqJg/exec";

let APP_STATE = {
    user: null,
    role: null,
    master: [],
    lots: [],
    activeType: 'ALL',
    activeSearch: '',
    selectedBarcode: null,
    scanner: null
};

document.addEventListener("DOMContentLoaded", () => {
    const inputEmp = document.getElementById("input-empid");
    if (inputEmp) {
        inputEmp.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) btnLogin.addEventListener("click", handleLogin);
    
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) btnLogout.addEventListener("click", handleLogout);

    // [เพิ่มเติมเพื่อรองรับปุ่มพิมพ์หน้า Dashboard เดิม]
    const btnPrintDashboard = document.querySelector(".btn-print-dashboard") || document.querySelector("button[onclick*='print']");
    if (btnPrintDashboard && !btnPrintDashboard.getAttribute("onclick")) {
        btnPrintDashboard.addEventListener("click", () => printReport('dashboard'));
    }
});

function showLoading(msg = "กำลังบันทึกข้อมูล...") {
    Swal.fire({
        title: msg,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
}

async function handleLogin() {
    const inputEmp = document.getElementById("input-empid");
    if (!inputEmp) return;
    
    const empId = inputEmp.value.trim();
    if(!empId) return Swal.fire("กรุณาระบุข้อมูล", "โปรดระบุรหัสพนักงานก่อนดำเนินการต่อ", "warning");

    showLoading("กำลังตรวจสอบรหัสผู้ใช้งาน...");

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "login", empId: empId })
        });
        
        if (!res.ok) throw new Error("Network response was not ok");
        const result = await res.json();

        if(result.success) {
            APP_STATE.user = result.name;
            APP_STATE.role = result.role;
            
            document.getElementById("txt-user-name").innerText = result.name;
            
            const loginDate = new Date().toLocaleDateString('th-TH');
            const loginTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            document.getElementById("txt-login-time").innerText = `ล็อกอินเมื่อ: ${loginDate} ${loginTime} น.`;
            
            if(result.role === "Admin") {
                const menuAdmin = document.getElementById("menu-admin");
                if (menuAdmin) menuAdmin.classList.remove("hidden");
            }
            
            document.getElementById("login-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            
            await reloadDataFromServer();
            navigate('dashboard');
            Swal.close();
        } else {
            Swal.fire({
                title: "ไม่สามารถเข้าสู่ระบบได้",
                text: "รหัสพนักงานไม่ถูกต้อง หรือไม่พบในระบบปฏิบัติการ CATH LAB โปรดติดต่อผู้ดูแลระบบ",
                icon: "error",
                confirmButtonColor: "#F6C2C2",
                confirmButtonText: "ตกลง"
            });
            inputEmp.value = ""; 
            inputEmp.focus();
        }
    } catch (err) {
        console.error("Login Error:", err);
        Swal.fire("เชื่อมต่อล้มเหลว", "เกิดข้อผิดพลาดกับเซิร์ฟเวอร์", "error");
        inputEmp.value = "";
        inputEmp.focus();
    }
}

async function reloadDataFromServer() {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "fetchAllData" })
        });
        const result = await res.json();
        
        if (result.success && result.data) {
            APP_STATE.master = result.data.master || [];
            APP_STATE.lots = result.data.lots || [];

            renderDashboard();
            renderInspectList();
        } else {
            console.error("โครงสร้างข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง", result);
            Swal.fire("ข้อมูลไม่ตรงระบบ", "เซิร์ฟเวอร์ส่งข้อมูลกลับมาผิดพลาด", "error");
        }
    } catch(e) {
        console.error("โหลดข้อมูลล้มเหลว:", e);
        Swal.fire("การเชื่อมต่อขัดข้อง", "ไม่สามารถดึงข้อมูลคลังยาได้เนื่องจากระบบฐานข้อมูลขัดข้อง", "error");
    } finally {
        if (Swal.isVisible()) {
            Swal.close();
        }
    }
}

function navigate(menu) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.querySelectorAll(".nav-item").forEach(i => {
        i.className = "nav-item w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 text-slate-600 hover:bg-[#D4EDF4]/30";
    });

    const targetSection = document.getElementById(`section-${menu}`);
    if (targetSection) targetSection.classList.remove("hidden");
    
    const event = window.event;
    if(event && event.currentTarget) {
        event.currentTarget.className = "nav-item w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 bg-[#D4EDF4] text-[#2C5282] shadow-xs";
    } else {
        const items = document.querySelectorAll(".nav-item");
        items.forEach(btn => {
            if(btn.getAttribute("onclick").includes(menu)) {
                btn.className = "nav-item w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 bg-[#D4EDF4] text-[#2C5282] shadow-xs";
            }
        });
    }
    
    if(menu === 'dashboard') renderDashboard();
    if(menu === 'inspect') renderInspectList();
    if(menu === 'admin') renderAdminList();
}

function renderDashboard() {
    const tbody = document.getElementById("table-dashboard-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const today = new Date();
    const limitDate = new Date();
    limitDate.setMonth(today.getMonth() + 9); 

    let filtered = [];

    APP_STATE.lots.forEach(lot => {
        if (!lot.expDate) return;
        const exp = new Date(lot.expDate);
        if(exp >= today && exp <= limitDate) {
            const masterItem = APP_STATE.master.find(m => m.barcodeId && lot.barcodeId && m.barcodeId.toString() === lot.barcodeId.toString());
            filtered.push({ 
                ...lot, 
                drugName: masterItem ? masterItem.drugName : "ไม่ระบุชื่อยา", 
                unit: masterItem ? masterItem.unit : "-",
                type: masterItem ? masterItem.type : "-"
            });
        }
    });

    filtered.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    // กำหนดคลาสระบุตัวตนสำหรับการสั่งพิมพ์แบบ All-inclusive
    const tableEl = tbody.closest("table");
    if (tableEl) {
        tableEl.classList.add("official-print-table");
    }

    filtered.forEach(item => {
        const exp = new Date(item.expDate);
        const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
        
        let colorClass = "";
        let monthBadge = "";
        
        if (diffMonths <= 3) {
            colorClass = "bg-[#F6C2C2]/40 border-l-4 border-[#F6C2C2] text-[#632525]";
            monthBadge = `<span class="px-2 py-0.5 bg-[#F6C2C2] text-[#7A2E2E] rounded-md font-bold text-[11px] shadow-2xs animate-pulse">อีก ${diffMonths} เดือน (วิกฤต)</span>`;
        } else if (diffMonths <= 6) {
            colorClass = "bg-[#F9FBBA]/40 border-l-4 border-[#E2E67A] text-[#52541C]";
            monthBadge = `<span class="px-2 py-0.5 bg-[#F9FBBA] text-[#61631F] rounded-md font-bold text-[11px] shadow-2xs">อีก ${diffMonths} เดือน</span>`;
        } else {
            colorClass = "bg-[#D4EDF4]/20 border-l-4 border-[#B0E2F0] text-[#1F3E47]";
            monthBadge = `<span class="px-2 py-0.5 bg-[#D4EDF4] text-[#2C5282] rounded-md font-bold text-[11px] shadow-2xs">อีก ${diffMonths} เดือน</span>`;
        }

        const tr = document.createElement("tr");
        tr.className = `${colorClass} hover:bg-slate-100/50 transition-colors border-b border-slate-100/60`;
        
        tr.innerHTML = `
            <td class="p-4 font-mono text-xs font-semibold text-center">${item.barcodeId || ''}</td>
            <td class="p-4 font-bold text-xs sm:text-sm text-slate-700">${item.drugName || ''}</td>
            <td class="p-4 text-xs font-medium text-center">${item.lotNumber || ''}</td>
            <td class="p-4 text-xs font-medium text-center">${new Date(item.expDate).toLocaleDateString('th-TH')}</td>
            <td class="p-4 text-center">${monthBadge}</td>
            <td class="p-4 text-center font-black text-sm text-slate-800">${item.qty || 0}</td>
            <td class="p-4 text-xs font-medium text-slate-500 text-center">${item.unit || ''}</td>
            <td class="p-4 text-xs font-medium text-slate-600">${item.storage || '-'}</td>
            <td class="p-4 text-xs italic text-slate-400 font-medium">${item.note || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterByType(type) {
    APP_STATE.activeType = type;
    document.querySelectorAll("#type-pills button").forEach(b => {
        b.className = "text-xs px-3 py-1.5 rounded-xl border font-bold transition-colors pill-inactive cursor-pointer";
    });
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.className = "text-xs px-3 py-1.5 rounded-xl border font-bold transition-colors pill-active cursor-pointer";
    }
    renderInspectList();
}

function searchMedicines() {
    const searchBox = document.getElementById("search-box");
    if (searchBox) {
        APP_STATE.activeSearch = searchBox.value.toLowerCase();
        renderInspectList();
    }
}

function renderInspectList() {
    const container = document.getElementById("inspect-list-container");
    if (!container) return;
    container.innerHTML = "";

    let filteredMaster = APP_STATE.master.filter(item => {
        if (!item.drugName || !item.barcodeId) return false;
        const drugType = item.type ? item.type.trim() : "";
        const matchesType = (APP_STATE.activeType === 'ALL' || drugType === APP_STATE.activeType);
        const matchesSearch = (item.drugName.toLowerCase().includes(APP_STATE.activeSearch) || item.barcodeId.toString().includes(APP_STATE.activeSearch));
        return matchesType && matchesSearch;
    });

    const today = new Date();

    filteredMaster.forEach(drug => {
        const drugLots = APP_STATE.lots.filter(l => l.barcodeId && drug.barcodeId && l.barcodeId.toString() === drug.barcodeId.toString());
        
        const currentTotalQty = drugLots.reduce((sum, currentLot) => sum + Number(currentLot.qty || 0), 0);
        const maxStockTarget = Number(drug.stock || 0);

        let highestExpRisk = 0; 
        
        drugLots.forEach(lot => {
            if(!lot.expDate) return;
            const exp = new Date(lot.expDate);
            const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
            
            if(diffMonths <= 3 && diffMonths >= -12) {
                if(highestExpRisk < 1) highestExpRisk = 1; 
            } else if (diffMonths <= 6 && diffMonths > 3) {
                if(highestExpRisk === 0 || highestExpRisk > 2) highestExpRisk = 2;
            } else if (diffMonths <= 9 && diffMonths > 6) {
                if(highestExpRisk === 0) highestExpRisk = 3;
            }
        });

        const totalLotsCount = drugLots.length;
        const inspectedLotsCount = drugLots.filter(l => l.isInspected === true).length;
        
        let checkStatusBadge = "";
        if (totalLotsCount === 0) {
            checkStatusBadge = `<span class="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md font-medium">ไม่มี Lot ในระบบ</span>`;
        } else if (inspectedLotsCount === totalLotsCount) {
            checkStatusBadge = `<span class="text-[11px] px-2 py-0.5 bg-[#E2F2D5] text-[#4A6B32] rounded-md font-bold">✓ ตรวจครบแล้ว</span>`;
        } else {
            checkStatusBadge = `<span class="text-[11px] px-2 py-0.5 bg-[#F9FBBA] text-[#61631F] rounded-md font-bold">⚠️ ค้างตรวจ ${totalLotsCount - inspectedLotsCount}</span>`;
        }

        let stockAlertBadge = "";
        if(currentTotalQty < maxStockTarget) {
            stockAlertBadge = `<span class="text-[11px] px-2 py-0.5 bg-[#FFE3CD] text-[#A0522D] rounded-md font-bold block mt-1 text-center">⚠️ ต่ำกว่า Stock (${currentTotalQty}/${maxStockTarget})</span>`;
        } else {
            stockAlertBadge = `<span class="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md block mt-1 text-center">ปกติ (${currentTotalQty}/${maxStockTarget})</span>`;
        }

        let expAlertBadge = "";
        if(highestExpRisk === 1) {
            expAlertBadge = `<span class="text-[10px] px-2 py-0.5 bg-[#F6C2C2] text-[#7A2E2E] rounded-md font-black block mt-1 text-center animate-pulse">🚨 มี Lot หมดอายุภายใน 3 ด.</span>`;
        } else if (highestExpRisk === 2) {
            expAlertBadge = `<span class="text-[10px] px-2 py-0.5 bg-[#F9FBBA] text-[#52541C] rounded-md font-bold block mt-1 text-center">⏰ มี Lot หมดอายุภายใน 6 ด.</span>`;
        } else if (highestExpRisk === 3) {
            expAlertBadge = `<span class="text-[10px] px-2 py-0.5 bg-[#D4EDF4] text-[#1F3E47] rounded-md font-semibold block mt-1 text-center">ℹ️ มี Lot หมดอายุภายใน 9 ด.</span>`;
        }

        const div = document.createElement("div");
        div.className = "p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-[#D4EDF4] hover:shadow-md transition-all flex justify-between items-start cursor-pointer";
        div.onclick = () => openModal(drug.barcodeId);
        div.innerHTML = `
            <div class="space-y-1 flex-1 pr-2">
                <span class="text-[9px] uppercase px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-500">${drug.type}</span>
                <h4 class="font-bold text-slate-700 text-sm mt-1.5 line-clamp-2">${drug.drugName}</h4>
                <p class="text-xs text-slate-400 font-mono mt-0.5">Barcode: ${drug.barcodeId} | หน่วย: ${drug.unit}</p>
                <p class="text-[11px] text-slate-500">จุดจัดเก็บหลัก: ${drug.storage}</p>
            </div>
            <div class="text-right shrink-0 w-36">
                ${checkStatusBadge}
                ${stockAlertBadge}
                ${expAlertBadge}
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleScanner() {
    const readerDiv = document.getElementById("qr-reader");
    if (!readerDiv) return;
    
    if(readerDiv.classList.contains("hidden")) {
        readerDiv.classList.remove("hidden");
        APP_STATE.scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        APP_STATE.scanner.render((decodedText) => {
            document.getElementById("search-box").value = decodedText;
            APP_STATE.activeSearch = decodedText.toLowerCase();
            renderInspectList();
            toggleScanner(); 
        });
    } else {
        if(APP_STATE.scanner) APP_STATE.scanner.clear();
        readerDiv.classList.add("hidden");
    }
}

function openModal(barcodeId) {
    APP_STATE.selectedBarcode = barcodeId;
    const drug = APP_STATE.master.find(m => m.barcodeId.toString() === barcodeId.toString());
    if (!drug) return;
    
    document.getElementById("modal-drug-name").innerText = drug.drugName;
    document.getElementById("modal-barcode-id").innerText = "รหัสบาร์โค้ด: " + drug.barcodeId + " | Target Stock (Max): " + (drug.stock || 0);
    
    renderModalLots();
    document.getElementById("lot-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("lot-modal").classList.add("hidden");
    document.getElementById("lot-number").value = "";
    document.getElementById("lot-exp").value = "";
    document.getElementById("lot-qty").value = "";
    document.getElementById("lot-storage").value = "";
    document.getElementById("lot-note").value = "";
}

function renderModalLots() {
    const container = document.getElementById("modal-lots-list");
    if (!container) return;
    container.innerHTML = "";
    
    if (!APP_STATE.selectedBarcode) return;
    const drugLots = APP_STATE.lots.filter(l => l.barcodeId && l.barcodeId.toString() === APP_STATE.selectedBarcode.toString());

    if(drugLots.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-3">ไม่พบประวัติล็อตย่อยในขณะนี้</p>`;
        return;
    }

    drugLots.forEach(lot => {
        const div = document.createElement("div");
        div.className = `p-3 rounded-xl border text-xs flex justify-between items-center ${lot.isInspected ? 'bg-[#E2F2D5]/50 border-[#E2F2D5]':'bg-slate-50/50 border-slate-200'}`;
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-700">Lot: ${lot.lotNumber || 'ไม่ระบุ'} | <span class="text-[#A84E4E] font-bold">EXP: ${lot.expDate ? new Date(lot.expDate).toLocaleDateString('th-TH') : '-'}</span></p>
                <p class="text-slate-400 mt-0.5 font-medium">จำนวน: ${lot.qty || 0} | ที่เก็บ: ${lot.storage || '-'} | หมายเหตุ: ${lot.note || '-'}</p>
                ${lot.isInspected ? `<p class="text-[10px] text-[#4A6B32] font-bold mt-0.5">✓ ตรวจแล้วโดย ${lot.inspector || 'เจ้าหน้าที่'}</p>` : ''}
            </div>
            <div class="flex gap-1 shrink-0">
                <button onclick="inspectSpecificLot('${lot.lotNumber}')" class="px-2 py-1 bg-white text-[#2C5282] border border-[#D4EDF4] hover:bg-[#D4EDF4]/30 rounded-lg font-bold transition-colors cursor-pointer">ตรวจล็อตนี้</button>
                <button onclick="deleteSpecificLot('${lot.lotNumber}')" class="px-2 py-1 bg-white text-[#7A2E2E] border border-[#F6C2C2] hover:bg-[#F6C2C2]/40 rounded-lg font-bold transition-colors cursor-pointer">ลบ</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function submitLotForm() {
    const num = document.getElementById("lot-number").value.trim();
    const exp = document.getElementById("lot-exp").value;
    const qty = document.getElementById("lot-qty").value;
    const storage = document.getElementById("lot-storage").value.trim();
    const note = document.getElementById("lot-note").value.trim();

    if(!num || !exp || !qty) return Swal.fire("ข้อมูลไม่ครบ", "โปรดระบุ เลขล็อต, วันหมดอายุ และจำนวนยา", "warning");

    showLoading("กำลังประมวลผลล็อดยา...");

    const lotData = {
        barcodeId: APP_STATE.selectedBarcode, lotNumber: num, expDate: exp, qty: Number(qty),
        storage: storage, note: note, isInspected: false, inspector: "", inspectionTime: ""
    };

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "saveLot", data: lotData })
        });
        const result = await res.json();
        if(result.success) {
            await reloadDataFromServer();
            renderModalLots();
            Swal.fire("สำเร็จ", "บันทึกข้อมูลล็อตเรียบร้อย", "success");
            document.getElementById("lot-number").value = "";
            document.getElementById("lot-exp").value = "";
            document.getElementById("lot-qty").value = "";
        }
    } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถส่งข้อมูลได้", "error"); }
}

async function inspectSpecificLot(lotNumber) {
    showLoading("กำลังยืนยันสถานะล็อต...");
    const currentLot = APP_STATE.lots.find(l => l.barcodeId && APP_STATE.selectedBarcode && l.barcodeId.toString() === APP_STATE.selectedBarcode.toString() && l.lotNumber.toString() === lotNumber.toString());
    if(!currentLot) return;

    currentLot.isInspected = true;
    currentLot.inspector = APP_STATE.user;
    currentLot.inspectionTime = new Date().toISOString();

    try {
        await fetch(API_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "saveLot", data: currentLot }) 
        });
        await reloadDataFromServer();
        renderModalLots();
        Swal.fire("ตรวจแล้ว", `ยืนยันความถูกต้องเรียบร้อย`, "success");
    } catch(e) { Swal.fire("ล้มเหลว", "เกิดข้อผิดพลาดในการตรวจสอบ", "error"); }
}

function deleteSpecificLot(lotNumber) {
    Swal.fire({
        title: 'ยืนยันการลบตัวเลือก?',
        text: `คุณต้องการลบล็อดยาหมายเลข ${lotNumber} หรือไม่`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#F6C2C2',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            showLoading("กำลังทำลายข้อมูลล็อต...");
            try {
                await fetch(API_URL, { 
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "deleteLot", barcodeId: APP_STATE.selectedBarcode, lotNumber: lotNumber }) 
                });
                await reloadDataFromServer();
                renderModalLots();
                Swal.fire("ลบสำเร็จ", "ลบข้อมูลล็อดยาเรียบร้อยแล้ว", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถสั่งลบข้อมูลได้", "error"); }
        }
    });
}

async function submitFinalVerify() {
    showLoading("กำลังส่งบันทึกความสมบูรณ์...");
    try {
        await fetch(API_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "confirmInspection", barcodeId: APP_STATE.selectedBarcode, inspector: APP_STATE.user }) 
        });
        await reloadDataFromServer();
        closeModal();
        renderInspectList();
        Swal.fire("สำเร็จ", "ยืนยันผลการตรวจสอบยาทุกล็อตเรียบร้อย", "success");
    } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถส่งคำยืนยันการตรวจได้", "error"); }
}

function renderAdminList() {
    const container = document.getElementById("admin-drug-list");
    if (!container) return;
    container.innerHTML = "";
    const q = document.getElementById("admin-search").value.toLowerCase();

    const filtered = APP_STATE.master.filter(m => {
        if (!m.drugName || !m.barcodeId) return false;
        return m.drugName.toLowerCase().includes(q) || m.barcodeId.toString().includes(q);
    });
    
    filtered.forEach(drug => {
        const div = document.createElement("div");
        div.className = "p-3 flex justify-between items-center text-xs border-b border-slate-50";
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-700">${drug.drugName}</p>
                <p class="text-slate-400">Barcode: ${drug.barcodeId} | กลุ่ม: ${drug.type || 'ทั่วไป'}</p>
            </div>
            <button onclick="deleteDrugMaster('${drug.barcodeId}')" class="px-2 py-1 bg-[#F6C2C2]/40 hover:bg-[#F6C2C2] text-[#7A2E2E] rounded-lg transition-colors font-bold cursor-pointer">ลบรายการหลัก</button>
        `;
        container.appendChild(div);
    });
}

async function submitNewDrug() {
    const id = document.getElementById("add-barcode").value.trim();
    const name = document.getElementById("add-name").value.trim();
    const unit = document.getElementById("add-unit").value.trim();
    const stock = document.getElementById("add-stock").value;
    const storage = document.getElementById("add-storage").value.trim();
    const type = document.getElementById("add-type").value;

    if(!id || !name || !unit || !type) return Swal.fire("ข้อมูลไม่ครบ", "กรุณาระบุข้อมูลจำเป็นของตัวยาให้ครบถ้วน", "warning");

    showLoading("กำลังประมวลผลรหัสคลังยา...");
    
    const drug = { barcodeId: id, drugName: name, unit: unit, stock: Number(stock || 0), storage: storage, type: type };

    try {
        const res = await fetch(API_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "adminAddDrug", drug: drug }) 
        });
        const result = await res.json();
        if(result.success) {
            await reloadDataFromServer();
            renderAdminList();
            Swal.fire("บันทึกแล้ว", "เพิ่มยาตัวใหม่สำเร็จ", "success");
            document.getElementById("add-barcode").value = "";
            document.getElementById("add-name").value = "";
        } else {
            Swal.fire("ไม่สามารถบันทึกได้", result.message, "error");
        }
    } catch(e) { Swal.fire("ล้มเหลว", "เกิดปัญหาขัดข้องฝั่งเซิร์ฟเวอร์", "error"); }
}

function deleteDrugMaster(barcodeId) {
    Swal.fire({
        title: 'ลบรายการยาถาวร?',
        text: "การลบจะลบข้อมูลทั้งรายการหลักและล็อดย่อยทั้งหมดที่ผูกกับรหัสนี้!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#F6C2C2',
        confirmButtonText: 'ยืนยันลบทั้งหมด',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            showLoading("กำลังทำลายข้อมูลถาวร...");
            try {
                await fetch(API_URL, { 
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "adminDeleteDrug", barcodeId: barcodeId }) 
                });
                await reloadDataFromServer();
                renderAdminList();
                Swal.fire("ลบสำเร็จ", "ลบข้อมูลยาออกจากโครงสร้างคลังหลักสำเร็จ", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถลบข้อมูลได้", "error"); }
        }
    });
}

function generateReport(reportType) {
    const startStr = document.getElementById("report-start").value;
    const endStr = document.getElementById("report-end").value;
    
    if(!startStr || !endStr) return Swal.fire("ระบุเวลา", "โปรดเลือกช่วงวันที่ก่อนดึงรายงาน", "warning");

    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23,59,59,999); 

    const preview = document.getElementById("report-preview-container");
    if (!preview) return;
    preview.classList.remove("hidden");
    preview.innerHTML = "";

    const reportTitle = reportType === 'all' 
        ? '6.1 รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB' 
        : '6.2 รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน';

    let headerHTML = `
        <div class="print-report-wrapper" style="padding: 15px; background: #fff; width: 100%; box-sizing: border-box;">
            <div class="text-center pb-4 mb-4" style="border-bottom: 2px solid #000000; text-align: center; margin-bottom: 20px; padding-bottom: 10px;">
                <h1 style="font-size: 20px; margin: 0 0 5px 0; color: #000; font-weight: bold; font-family: 'Sarabun', sans-serif;">${reportTitle}</h1>
                <p style="font-size: 13px; color: #333; margin: 5px 0 0 0;">ช่วงเวลาประเมินผลคลัง: ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}</p>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #000; margin-top: 15px;">
                    <span><strong>ผู้พิมพ์รายงาน:</strong> <span class="print-by">${APP_STATE.user || '-'}</span></span>
                    <span><strong>วันและเวลาพิมพ์:</strong> <span class="print-at">${new Date().toLocaleString('th-TH')} น.</span></span>
                </div>
            </div>
            <button onclick="printReport('report')" class="no-print mb-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm" style="margin-bottom: 15px; padding: 10px 18px; background-color: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
                🖨️ สั่งพิมพ์รายงานทางการฉบับนี้ (พอดีหน้ากระดาษ A4)
            </button>
    `;

    let tableHTML = "";

    // --- แบบที่ 1: รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB ---
    if(reportType === 'all') {
        tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
                <table class="official-print-table" border="1" style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'Sarabun', Arial, sans-serif; border: 1.5px solid #000000;">
                    <thead>
                        <tr style="background-color: #cbd5e1;">
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 14%;">รหัสบาร์โค้ด</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; color: #000; width: 32%;">ชื่อสินค้า / ตัวยา</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 12%;">Lot Number</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 14%;">วันหมดอายุ (EXP)</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 10%;">จำนวน</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 8%;">หน่วย</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; color: #000; width: 10%;">ที่เก็บ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let hasData = false;

        APP_STATE.master.forEach(drug => {
            const drugLots = APP_STATE.lots.filter(l => l.barcodeId && drug.barcodeId && l.barcodeId.toString() === drug.barcodeId.toString());
            
            if(drugLots.length > 0) {
                drugLots.forEach(lot => {
                    const expDate = lot.expDate ? new Date(lot.expDate) : null;
                    if(expDate && expDate >= start && expDate <= end) {
                        hasData = true;
                        tableHTML += `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-family: monospace;">${drug.barcodeId || ''}</td>
                                <td style="padding: 8px; border: 1px solid #000000; font-weight: bold;">${drug.drugName || ''}</td>
                                <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${lot.lotNumber || '-'}</td>
                                <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${expDate.toLocaleDateString('th-TH')}</td>
                                <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-weight: bold;">${lot.qty || 0}</td>
                                <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${drug.unit || '-'}</td>
                                <td style="padding: 8px; border: 1px solid #000000;">${lot.storage || drug.storage || '-'}</td>
                            </tr>
                        `;
                    }
                });
            }
        });
        
        if (!hasData) {
            tableHTML += `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #555; font-style: italic; border: 1px solid #000000;">ไม่พบข้อมูลล็อตยาในช่วงวันที่เลือก</td></tr>`;
        }
        tableHTML += "</tbody></table></div></div>";

    // --- แบบที่ 2: รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน ---
    } else {
        tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
                <table class="official-print-table" border="1" style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'Sarabun', Arial, sans-serif; border: 1.5px solid #000000;">
                    <thead>
                        <tr style="background-color: #cbd5e1;">
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; color: #000; width: 15%;">รหัสบาร์โค้ด</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; color: #000; width: 30%;">ชื่อสินค้า / ยาหลัก</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; color: #000;">ประวัติบันทึกการตรวจสอบยาประจำเดือน (เรียงวันที่ไปทางขวา ➡️)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let inspectedDrugs = [];
        let pendingDrugs = [];

        APP_STATE.master.forEach(drug => {
            const drugLots = APP_STATE.lots.filter(l => l.barcodeId && drug.barcodeId && l.barcodeId.toString() === drug.barcodeId.toString());
            let checkedLots = drugLots.filter(l => l.isInspected === true);
            
            checkedLots.sort((a, b) => new Date(a.inspectionTime) - new Date(b.inspectionTime));

            const isAllChecked = drugLots.length > 0 && drugLots.every(l => l.isInspected === true);
            const drugData = { drug, checkedLots };

            if (isAllChecked) {
                inspectedDrugs.push(drugData);
            } else {
                pendingDrugs.push(drugData);
            }
        });

        inspectedDrugs.sort((a, b) => {
            const timeA = a.checkedLots[0] ? new Date(a.checkedLots[0].inspectionTime) : 0;
            const timeB = b.checkedLots[0] ? new Date(b.checkedLots[0].inspectionTime) : 0;
            return timeA - timeB;
        });

        const sortedDataset = [...inspectedDrugs, ...pendingDrugs];

        if (sortedDataset.length === 0) {
            tableHTML += `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #555; font-style: italic; border: 1px solid #000000;">ไม่มีรายการข้อมูลยาในฐานข้อมูลคลังขณะนี้</td></tr>`;
        } else {
            sortedDataset.forEach(item => {
                let trackingCellsHTML = "";

                if (item.checkedLots.length === 0) {
                    trackingCellsHTML = `<span style="color: #dc2626; font-weight: bold; font-style: italic;">✕ ค้างการตรวจสอบประจำเดือน</span>`;
                } else {
                    item.checkedLots.forEach(lot => {
                        const d = new Date(lot.inspectionTime);
                        const formattedDate = d.toLocaleDateString('th-TH');
                        const inspectorName = lot.inspector || 'ไม่ระบุชื่อ';
                        
                        trackingCellsHTML += `
                            <div style="display: inline-block; border: 1px solid #94a3b8; padding: 4px 8px; margin: 2px 5px 2px 0; background-color: #f8fafc; border-radius: 4px; font-size: 11px;">
                                📅 <strong>Lot:</strong> ${lot.lotNumber} | <strong>เมื่อ:</strong> ${formattedDate} | <strong>ผู้ตรวจ:</strong> ${inspectorName}
                            </div>
                        `;
                    });

                    const hasUncheckedLot = APP_STATE.lots.some(l => l.barcodeId?.toString() === item.drug.barcodeId?.toString() && !l.isInspected);
                    if (hasUncheckedLot) {
                        trackingCellsHTML += `
                            <div style="display: inline-block; border: 1px solid #fca5a5; padding: 4px 8px; margin: 2px 0; background-color: #fef2f2; border-radius: 4px; font-size: 11px; color: #dc2626; font-weight: bold;">
                                ⚠️ มีบาง Lot ค้างตรวจ
                            </div>
                        `;
                    }
                }

                tableHTML += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-family: monospace;">${item.drug.barcodeId || ''}</td>
                        <td style="padding: 8px; border: 1px solid #000000; font-weight: bold;">${item.drug.drugName || ''}</td>
                        <td style="padding: 8px; border: 1px solid #000000; vertical-align: middle;">
                            ${trackingCellsHTML}
                        </td>
                    </tr>
                `;
            });
        }

        tableHTML += "</tbody></table></div></div>";
    }

    preview.innerHTML = headerHTML + tableHTML;
}

// [แก้ไขหลักสำหรับข้อ 1 และ 2] ฟังก์ชันควบคุมโครงสร้างสไตล์กระดาษเมื่อกดสั่งพิมพ์
function printReport(source = 'report') {
    // บันทึกวันเวลาและผู้จัดพิมพ์ลงในรายงานเสมอ
    document.querySelectorAll(".print-by").forEach(el => el.innerText = APP_STATE.user || '-');
    document.querySelectorAll(".print-at").forEach(el => el.innerText = new Date().toLocaleString('th-TH') + ' น.');
    
    const oldStyle = document.getElementById("dynamic-print-css");
    if(oldStyle) oldStyle.remove();

    const styleEl = document.createElement("style");
    styleEl.id = "dynamic-print-css";

    // แยกการตั้งค่า CSS ตามแหล่งที่มาของปุ่มพิมพ์ เพื่อให้ตารางหน้า Dashboard และหน้า Report ขึ้นตารางครบถ้วนทั้งสองจุด
    if(source === 'dashboard') {
        styleEl.innerHTML = `
            @media print {
                body * {
                    visibility: hidden !important;
                }
                /* ดึงพื้นที่ Container ของ Dashboard หรือตารางหลักของแดชบอร์ดขึ้นมาพิมพ์ */
                #section-dashboard, #section-dashboard * {
                    visibility: visible !important;
                }
                #section-dashboard {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100% !important;
                }
                .no-print, button, .nav-item, aside, header {
                    display: none !important;
                    visibility: hidden !important;
                }
                .official-print-table {
                    width: 100% !important;
                    table-layout: fixed !important;
                    border-collapse: collapse !important;
                    border: 2px solid #000000 !important;
                }
                .official-print-table th, .official-print-table td {
                    border: 1px solid #000000 !important;
                    color: #000000 !important;
                    word-wrap: break-word !important;
                    white-space: normal !important;
                    padding: 6px !important;
                }
            }
        `;
    } else {
        styleEl.innerHTML = `
            @media print {
                body * {
                    visibility: hidden !important;
                }
                #report-preview-container, #report-preview-container * {
                    visibility: visible !important;
                }
                #report-preview-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                }
                .print-report-wrapper {
                    width: 100% !important;
                    padding: 0 !important;
                }
                .official-print-table {
                    width: 100% !important;
                    table-layout: fixed !important;
                    border-collapse: collapse !important;
                    border: 2px solid #000000 !important;
                }
                .official-print-table th, .official-print-table td {
                    border: 1px solid #000000 !important;
                    color: #000000 !important;
                    word-wrap: break-word !important;
                    white-space: normal !important;
                    padding: 6px !important;
                }
                .no-print {
                    display: none !important;
                    visibility: hidden !important;
                }
            }
        `;
    }
    
    document.head.appendChild(styleEl);

    // เปิดเรียกหน้าต่างปริ้นของเบราว์เซอร์
    window.print();

    // ล้าง CSS ชั่วคราวออกเพื่อให้ระบบการแสดงผลบนคอมพิวเตอร์กลับมาปกติหลังพิมพ์เสร็จ
    setTimeout(() => {
        const targetStyle = document.getElementById("dynamic-print-css");
        if(targetStyle) targetStyle.remove();
    }, 1200);
}

function handleLogout() {
    Swal.fire({
        title: 'ออกจากระบบคลังยา?',
        text: "คุณต้องการล็อกเอาท์ออกจากระบบหรือไม่",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#D4EDF4', 
        cancelButtonColor: '#F6C2C2',  
        confirmButtonText: 'ยืนยันล็อกเอาท์',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            location.reload(); 
        }
    });
}
