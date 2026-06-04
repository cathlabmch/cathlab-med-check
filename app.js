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
            // ปลอดภัยและไม่แสดงรหัสที่มีในระบบตามที่ขอ
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
        if(result.success) {
            APP_STATE.master = result.master || [];
            APP_STATE.lots = result.lots || [];
            renderDashboard();
            renderInspectList();
        }
    } catch(e) {
        console.error("โหลดข้อมูลคลังยาล้มเหลว", e);
    }
}

function navigate(menu) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.querySelectorAll(".nav-item").forEach(i => {
        i.classList.remove("bg-[#D4EDF4]", "text-[#2C5282]", "shadow-xs");
        i.classList.add("text-slate-600", "hover:bg-[#D4EDF4]/30");
    });

    const targetSection = document.getElementById(`section-${menu}`);
    if (targetSection) targetSection.classList.remove("hidden");
    
    const event = window.event;
    if(event && event.currentTarget) {
        event.currentTarget.classList.remove("text-slate-600", "hover:bg-[#D4EDF4]/30");
        event.currentTarget.classList.add("bg-[#D4EDF4]", "text-[#2C5282]", "shadow-xs");
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
                unit: masterItem ? masterItem.unit : "-" 
            });
        }
    });

    filtered.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    filtered.forEach(item => {
        const exp = new Date(item.expDate);
        const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
        
        let colorClass = "";
        if (diffMonths <= 3) colorClass = "bg-[#F6C2C2]/50 border-l-4 border-[#F6C2C2] text-[#632525] font-medium"; 
        else if (diffMonths <= 6) colorClass = "bg-[#F9FBBA]/60 border-l-4 border-[#E2E67A] text-[#52541C]"; 
        else colorClass = "bg-[#D4EDF4]/30 border-l-4 border-[#B0E2F0] text-[#1F3E47]"; 

        const tr = document.createElement("tr");
        tr.className = colorClass;
        tr.innerHTML = `
            <td class="p-4 font-mono text-xs">${item.barcodeId || ''}</td>
            <td class="p-4 font-bold text-xs sm:text-sm">${item.drugName || ''}</td>
            <td class="p-4 text-xs">${item.lotNumber || ''}</td>
            <td class="p-4 text-xs">${new Date(item.expDate).toLocaleDateString('th-TH')}</td>
            <td class="p-4 text-center font-black">${item.qty || 0}</td>
            <td class="p-4 text-xs">${item.unit || ''}</td>
            <td class="p-4 text-xs">${item.storage || '-'}</td>
            <td class="p-4 text-xs italic opacity-75">${item.note || '-'}</td>
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

// แก้ไขฟังก์ชันแสดงผลกล่องยาให้ตรวจสอบเงื่อนไข Stock และวันหมดอายุราย Lot อย่างละเอียด
function renderInspectList() {
    const container = document.getElementById("inspect-list-container");
    if (!container) return;
    container.innerHTML = "";

    // กรองประเภทกลุ่มยาโดยตรวจสอบค่าว่างอย่างถี่ถ้วน
    let filteredMaster = APP_STATE.master.filter(item => {
        if (!item.drugName || !item.barcodeId) return false;
        
        // บังคับให้การเช็คประเภท Type ตรงกันทั้งหมด
        const drugType = item.type ? item.type.trim() : "";
        const matchesType = (APP_STATE.activeType === 'ALL' || drugType === APP_STATE.activeType);
        const matchesSearch = (item.drugName.toLowerCase().includes(APP_STATE.activeSearch) || item.barcodeId.toString().includes(APP_STATE.activeSearch));
        return matchesType && matchesSearch;
    });

    const today = new Date();

    filteredMaster.forEach(drug => {
        // หาชุดล็อตทั้งหมดของยาตัวนี้
        const drugLots = APP_STATE.lots.filter(l => l.barcodeId && drug.barcodeId && l.barcodeId.toString() === drug.barcodeId.toString());
        
        // 1. คำนวณผลรวมจำนวนยาจริงที่มีอยู่ทุก Lot รวมกัน
        const currentTotalQty = drugLots.reduce((sum, currentLot) => sum + Number(currentLot.qty || 0), 0);
        const maxStockTarget = Number(drug.stock || 0);

        // 2. ตรวจสอบสถานะวันหมดอายุที่เสี่ยงที่สุดในกลุ่ม Lot
        let highestExpRisk = 0; // 0=ปกติ, 3=เสี่ยงต่ำ (6-9 ด.), 2=เสี่ยงกลาง (3-6 ด.), 1=เสี่ยงวิกฤต (0-3 ด.)
        
        drugLots.forEach(lot => {
            if(!lot.expDate) return;
            const exp = new Date(lot.expDate);
            const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
            
            if(diffMonths <= 3 && diffMonths >= -12) {
                if(highestExpRisk < 1) highestExpRisk = 1; // ล็อตวิกฤตสูงสุด
            } else if (diffMonths <= 6 && diffMonths > 3) {
                if(highestExpRisk === 0 || highestExpRisk > 2) highestExpRisk = 2;
            } else if (diffMonths <= 9 && diffMonths > 6) {
                if(highestExpRisk === 0) highestExpRisk = 3;
            }
        });

        // 3. ประกอบแถบ Badge ตรวจสอบความถูกต้องรายชิ้น
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

        // 4. สร้าง Badge ตรวจจับยอดขั้นต่ำ (Min Stock)
        let stockAlertBadge = "";
        if(currentTotalQty < maxStockTarget) {
            stockAlertBadge = `<span class="text-[11px] px-2 py-0.5 bg-[#FFE3CD] text-[#A0522D] rounded-md font-bold block mt-1 text-center">⚠️ ต่ำกว่า Stock (มีอยู่ ${currentTotalQty}/${maxStockTarget})</span>`;
        } else {
            stockAlertBadge = `<span class="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md block mt-1 text-center">ปกติ (${currentTotalQty}/${maxStockTarget})</span>`;
        }

        // 5. สร้างแถบสีกรณีพบล็อตใกล้หมดอายุ (EXP Alert Badge)
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
                <span class="text-[9px] uppercase px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-500">${drug.type ? drug.type.trim() : 'ทั่วไป'}</span>
                <h4 class="font-bold text-slate-700 text-sm mt-1.5 line-clamp-2">${drug.drugName}</h4>
                <p class="text-xs text-slate-400 font-mono mt-0.5">Barcode: ${drug.barcodeId} | หน่วย: ${drug.unit || '-'}</p>
                <p class="text-[11px] text-slate-500">จุดเก็บหลัก: ${drug.storage || '-'}</p>
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

    let headerHTML = `
        <div class="print-header text-center mb-4">
            <h1 class="text-base font-bold text-slate-700">${reportType === 'all' ? '6.1 รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB':'6.2 รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน'}</h1>
            <p class="text-xs text-slate-400 mt-0.5">ช่วงเวลาประเมินผล: ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}</p>
            <p class="text-[11px] text-slate-400">ผู้พิมพ์รายงาน: ${APP_STATE.user || '-'} | วันและเวลาพิมพ์: ${new Date().toLocaleString('th-TH')}</p>
        </div>
        <button onclick="printReport('report-preview-container')" class="no-print mb-4 px-4 py-2 bg-[#D4EDF4] text-[#2C5282] border border-[#D4EDF4] rounded-xl text-xs font-bold cursor-pointer">🖨️ สั่งพิมพ์เอกสารนี้</button>
    `;

    let tableHTML = "";

    if(reportType === 'all') {
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse border border-slate-100">
                <thead class="bg-slate-50 font-bold text-slate-500">
                    <tr>
                        <th class="p-2 border border-slate-100">บาร์โค้ด</th><th class="p-2 border border-slate-100">ชื่อสินค้า/ตัวยา</th>
                        <th class="p-2 border border-slate-100">Lot</th><th class="p-2 border border-slate-100">วันหมดอายุ</th>
                        <th class="p-2 border border-slate-100 text-center">จำนวนคลัง</th><th class="p-2 border border-slate-100">หน่วย</th><th class="p-2 border border-slate-100">สถานที่จัดเก็บ</th>
                    </tr>
                </thead><tbody>
        `;
        APP_STATE.lots.forEach(lot => {
            if (!lot.expDate) return;
            const exp = new Date(lot.expDate);
            if(exp >= start && exp <= end) {
                const med = APP_STATE.master.find(m => m.barcodeId && lot.barcodeId && m.barcodeId.toString() === lot.barcodeId.toString());
                tableHTML += `
                    <tr class="text-slate-600">
                        <td class="p-2 border border-slate-100 font-mono">${lot.barcodeId || ''}</td><td class="p-2 border border-slate-100 font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td>
                        <td class="p-2 border border-slate-100">${lot.lotNumber || ''}</td><td class="p-2 border border-slate-100">${exp.toLocaleDateString('th-TH')}</td>
                        <td class="p-2 border border-slate-100 text-center font-bold">${lot.qty || 0}</td><td class="p-2 border border-slate-100">${med ? med.unit : '-'}</td>
                        <td class="p-2 border border-slate-100">${lot.storage || '-'}</td>
                    </tr>
                `;
            }
        });
        tableHTML += "</tbody></table>";
    } else {
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse border border-slate-100">
                <thead class="bg-slate-50 font-bold text-slate-500">
                    <tr>
                        <th class="p-2 border border-slate-100">ชื่อสินค้า / ยาหลัก</th><th class="p-2 border border-slate-100">ประเภท</th>
                        <th class="p-2 border border-slate-100">Lot ที่ตรวจ</th><th class="p-2 border border-slate-100 text-center">สถานะ</th>
                        <th class="p-2 border border-slate-100">ผู้ตรวจสอบ</th><th class="p-2 border border-slate-100">วันที่ตรวจสอบล่าสุด</th>
                    </tr>
                </thead><tbody>
        `;
        APP_STATE.lots.forEach(lot => {
            if (!lot.inspectionTime) return;
            const insTime = new Date(lot.inspectionTime);
            if(insTime >= start && insTime <= end) {
                const med = APP_STATE.master.find(m => m.barcodeId && lot.barcodeId && m.barcodeId.toString() === lot.barcodeId.toString());
                tableHTML += `
                    <tr class="text-slate-600">
                        <td class="p-2 border border-slate-100 font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td><td class="p-2 border border-slate-100">${med ? med.type : '-'}</td>
                        <td class="p-2 border border-slate-100 font-mono">${lot.lotNumber || ''}</td>
                        <td class="p-2 border border-slate-100 text-center text-teal-600 font-bold">${lot.isInspected ? '✓ ตรวจสอบแล้ว':'✕ ค้างตรวจ'}</td>
                        <td class="p-2 border border-slate-100">${lot.inspector || '-'}</td>
                        <td class="p-2 border border-slate-100">${insTime.toLocaleDateString('th-TH')}</td>
                    </tr>
                `;
            }
        });
        tableHTML += "</tbody></table>";
    }

    preview.innerHTML = headerHTML + tableHTML;
}

function printReport(containerId) {
    document.querySelectorAll(".print-by").forEach(el => el.innerText = APP_STATE.user || '-');
    document.querySelectorAll(".print-at").forEach(el => el.innerText = new Date().toLocaleString('th-TH'));
    window.print();
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
