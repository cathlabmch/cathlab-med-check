// เปลี่ยนข้อความด้านล่างเป็น Web App URL ที่ได้จากการ Deploy Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyCG5h6hCagw0Lh_CAwVuTw-a5yneALPcbSx_f5cwlfRJMvt2JSvQJ4I9V6urtiRqJg/exec";

// สร้าง State เก็บข้อมูลในเว็บเพื่อลดการกดเรียกฐานข้อมูลบ่อยครั้ง
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

// เริ่มต้นระบบเมื่อโหลดหน้าเสร็จสิ้น
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

// ระบบประมวลผลการเข้าสู่ระบบ
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
        } else {
            Swal.fire({
                title: "ไม่สามารถเข้าสู่ระบบได้",
                text: result.message || "รหัสพนักงานไม่ถูกต้อง หรือไม่พบในระบบปฏิบัติการ CATH LAB โปรดติดต่อผู้ดูแลระบบ",
                icon: "error",
                confirmButtonColor: "#10b981",
                confirmButtonText: "ตกลง"
            });
            inputEmp.value = ""; 
            inputEmp.focus();
        }
    } catch (err) {
        console.error("Login Error:", err);
        Swal.fire("เชื่อมต่อล้มเหลว", "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ฐานข้อมูล", "error");
        inputEmp.value = "";
        inputEmp.focus();
    }
}

// ฟังก์ชันโหลดข้อมูลหลัก
async function reloadDataFromServer() {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "fetchAllData" })
        });
        const result = await res.json();
        
        if(result.success && result.data) {
            APP_STATE.master = result.data.master || [];
            APP_STATE.lots = result.data.lots || [];

            renderDashboard();
            renderInspectList();
        }
    } catch(e) {
        console.error("โหลดข้อมูลคลังยาล้มเหลว:", e);
    } finally {
        if (Swal.isVisible()) Swal.close(); 
    }
}

function navigate(menu) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.querySelectorAll(".nav-item").forEach(i => {
        i.className = "nav-item w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 text-slate-600 hover:bg-emerald-50 text-xs sm:text-sm transition-colors cursor-pointer";
    });

    const targetSection = document.getElementById(`section-${menu}`);
    if (targetSection) targetSection.classList.remove("hidden");
    
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.className = "nav-item w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 bg-emerald-600 text-white shadow-lg text-xs sm:text-sm cursor-pointer";
    }
    
    if(menu === 'dashboard') renderDashboard();
    if(menu === 'inspect') renderInspectList();
    if(menu === 'admin') renderAdminList();
}

function renderDashboard() {
    const tbody = document.getElementById("table-dashboard-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const now = new Date();
    // คัดกรองยาที่ใกล้หมดอายุในระยะเวลา 9 เดือน
    const nearExpLots = APP_STATE.lots.filter(lot => {
        if (!lot.expDate) return false;
        const exp = new Date(lot.expDate);
        const diffTime = exp - now;
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
        return diffMonths <= 9;
    });

    // เรียงลำดับตัวที่หมดอายุก่อนขึ้นข้างบนสุด
    nearExpLots.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    if (nearExpLots.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400 font-medium">🎉 ยอดเยี่ยม! ไม่พบรายการยาที่ใกล้หมดอายุภายใน 9 เดือน</td></tr>`;
        return;
    }

    nearExpLots.forEach(lot => {
        const med = APP_STATE.master.find(m => m.barcodeId.toString() === lot.barcodeId.toString());
        const exp = new Date(lot.expDate);
        
        // คำนวณจำนวนเดือนคงเหลือ
        const diffTime = exp - now;
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        
        // กำหนดข้อความ Badge และแถบสีจางๆ (rowBgClass) ตามรหัสสี Pantone ละมุนสายตา
        let monthAlertHTML = "";
        let rowBgClass = "";

        if (diffTime < 0) {
            // 🟥 หมดอายุแล้ว: แถบสีแดงจางๆ
            monthAlertHTML = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F6C2C2] text-[#7A2E2E]">❌ หมดอายุแล้ว</span>`;
            rowBgClass = "bg-[#F6C2C2]/15 hover:bg-[#F6C2C2]/25 transition-colors"; 
        } else if (diffMonths <= 3) {
            // 🟧 เหลือ <= 3 เดือน: แถบสีส้มจางๆ
            monthAlertHTML = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFE3CD] text-[#A04E0E]">⚠️ อีก ${diffMonths} เดือน</span>`;
            rowBgClass = "bg-[#FFE3CD]/20 hover:bg-[#FFE3CD]/35 transition-colors";
        } else if (diffMonths <= 6) {
            // 🟨 เหลือ <= 6 เดือน: แถบสีเหลืองจางๆ
            monthAlertHTML = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F9FBBA] text-[#716B11]">อีก ${diffMonths} เดือน</span>`;
            rowBgClass = "bg-[#F9FBBA]/20 hover:bg-[#F9FBBA]/35 transition-colors";
        } else {
            // 🟩 เหลือ 7-9 เดือน: แถบสีเขียวจางๆ ปลอดภัยใจชื้น
            monthAlertHTML = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E2F2D5] text-[#4A6B32]">อีก ${diffMonths} เดือน</span>`;
            rowBgClass = "bg-[#E2F2D5]/15 hover:bg-[#E2F2D5]/30 transition-colors";
        }

        const tr = document.createElement("tr");
        // ใส่คลาสแถบสีจาง และเส้นคั่นด้านล่างของแต่ละแถวเพื่อความสวยงาม
        tr.className = `${rowBgClass} border-b border-slate-100/70`;
        
        tr.innerHTML = `
            <td class="p-4 font-mono text-xs text-slate-400">${lot.barcodeId}</td>
            <td class="p-4 font-bold text-slate-700">${med ? med.drugName : '<span class="text-red-400">ไม่พบในฐานหลัก</span>'}</td>
            <td class="p-4 font-mono text-xs text-slate-600">${lot.lotNumber || '-'}</td>
            <td class="p-4 font-medium text-slate-600">${exp.toLocaleDateString('th-TH', {year:'numeric', month:'short', day:'numeric'})}</td>
            <td class="p-4 text-center">${monthAlertHTML}</td> <td class="p-4 text-center font-black text-slate-700">${lot.qty}</td>
            <td class="p-4 text-xs text-slate-400">${med ? med.unit : '-'}</td>
            <td class="p-4 text-xs font-medium text-slate-500">${lot.storage || (med ? med.storage : '-')}</td>
            <td class="p-4 text-xs text-slate-400 font-medium">${lot.note || '-'}</td>
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

// 🛠️ แก้ไขคุณสมบัติข้อที่ 1: แสดงจำนวนยารวมทุกล็อตรวมกันไว้ที่การ์ดหน้าตรวจสอบยา
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

    filteredMaster.forEach(drug => {
        const drugLots = APP_STATE.lots.filter(l => l.barcodeId && drug.barcodeId && l.barcodeId.toString() === drug.barcodeId.toString());
        
        const totalLotsCount = drugLots.length;
        const inspectedLotsCount = drugLots.filter(l => l.isInspected === true).length;
        
        // คำนวณหายอดรวมยาทุกล็อตที่มีอยู่จริงในระบบตอนปัจจุบัน
        const sumTotalQty = drugLots.reduce((acc, current) => acc + Number(current.qty || 0), 0);
        
        let statusBadge = "";
        if (totalLotsCount === 0) {
            statusBadge = `<span class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md font-medium">ไม่มีล็อตในคลัง</span>`;
        } else if (inspectedLotsCount === totalLotsCount) {
            statusBadge = `<span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">✓ ตรวจครบแล้ว</span>`;
        } else {
            statusBadge = `<span class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold">⚠️ ค้างตรวจ ${totalLotsCount - inspectedLotsCount} ล็อต</span>`;
        }

        const div = document.createElement("div");
        div.className = "p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all flex justify-between items-center cursor-pointer";
        div.onclick = () => openModal(drug.barcodeId);
        div.innerHTML = `
            <div class="space-y-1">
                <span class="text-[9px] uppercase px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-500">${drug.type}</span>
                <h4 class="font-bold text-slate-700 text-sm mt-1">${drug.drugName}</h4>
                <p class="text-xs text-slate-400 font-mono">Barcode: ${drug.barcodeId} | หน่วย: ${drug.unit}</p>
                <p class="text-xs text-slate-500">ที่เก็บหลัก: ${drug.storage} | เกณฑ์เบิก: ${drug.stock}</p>
            </div>
            <div class="text-right shrink-0 space-y-1.5">
                <div>${statusBadge}</div>
                <div class="text-xs font-semibold text-slate-600">
                    คงคลังรวม: <span class="text-emerald-600 font-black text-sm">${sumTotalQty}</span> ${drug.unit}
                </div>
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

// 🛠️ แก้ไขคุณสมบัติข้อที่ 2: เปลี่ยนช่องพิมพ์สถานที่เก็บย่อยให้ดึงค่าจาก Medicine_Master มาให้เลือก
// ค้นหาฟังก์ชัน openModal ของเดิมใน app.js แล้ววางโค้ดชุดนี้ทับได้เลยครับ
function openModal(barcodeId) {
    APP_STATE.selectedBarcode = barcodeId;
    const drug = APP_STATE.master.find(m => m.barcodeId.toString() === barcodeId.toString());
    if (!drug) return;
    
    document.getElementById("modal-drug-name").innerText = drug.drugName;
    document.getElementById("modal-barcode-id").innerText = "บาร์โค้ด: " + drug.barcodeId + " | หน่วย: " + drug.unit;
    
    // 💡 ส่วนแก้ไขหลัก: ดึงข้อมูลสถานที่จัดเก็บจริงจากคอลัมน์ E ของยาหลักตัวนี้มาสร้างเป็น Dropdown ตัวเลือก
    const selectStorage = document.getElementById("lot-storage");
    if (selectStorage) {
        selectStorage.innerHTML = ""; // เคลียร์ตัวเลือกเก่าที่ค้างอยู่ออกก่อน
        
        // อ่านค่าจากสถานที่จัดเก็บหลัก (คอลัมน์ E)
        const mainStorageValue = drug.storage ? drug.storage.trim() : "";
        
        if (mainStorageValue && mainStorageValue !== "-") {
            // เผื่อกรณีในคอลัมน์ E มีการคั่นด้วยเครื่องหมายจุลภาค เช่น "คลังยา, ตู้เย็น, ชั้นวาง A" จะถูกแยกเป็นตัวเลือกให้เลือกง่ายๆ
            const optionsArray = mainStorageValue.split(/[,，/]/);
            
            optionsArray.forEach(opt => {
                const trimmedOpt = opt.trim();
                if (trimmedOpt) {
                    const optionEl = document.createElement("option");
                    optionEl.value = trimmedOpt;
                    optionEl.innerText = trimmedOpt;
                    selectStorage.appendChild(optionEl);
                }
            });
        } else {
            // ถ้าในคอลัมน์ E ของ Master ไม่ได้ระบุข้อมูลไว้ ให้ขึ้นตัวเลือกพื้นฐาน
            const defaultOpt = document.createElement("option");
            defaultOpt.value = "ไม่ระบุสถานที่";
            defaultOpt.innerText = "ไม่ระบุสถานที่หลัก (คอลัมน์ E ว่าง)";
            selectStorage.appendChild(defaultOpt);
        }
        
        // เพิ่มตัวเลือกเสริม "อื่นๆ" ไว้ท้ายสุดเสมอ เพื่อความยืดหยุ่นในกรณีฉุกเฉิน
        const otherOpt = document.createElement("option");
        otherOpt.value = "-";
        otherOpt.innerText = "อื่นๆ / ไม่ระบุสถานที่ย่อย";
        selectStorage.appendChild(otherOpt);
    }
    
    renderModalLots();
    document.getElementById("lot-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("lot-modal").classList.add("hidden");
    document.getElementById("lot-number").value = "";
    document.getElementById("lot-exp").value = "";
    document.getElementById("lot-qty").value = "";
    document.getElementById("lot-note").value = "";
}

function renderModalLots() {
    const listDiv = document.getElementById("modal-lots-list");
    if (!listDiv) return;
    listDiv.innerHTML = "";

    const currentBarcode = APP_STATE.selectedBarcode;
    const myLots = APP_STATE.lots.filter(l => l.barcodeId.toString() === currentBarcode.toString());
    const now = new Date();

    if (myLots.length === 0) {
        listDiv.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-100">ยังไม่มีข้อมูลล็อตย่อยของยานี้ในระบบ</p>`;
        return;
    }

    myLots.forEach(lot => {
        const exp = new Date(lot.expDate);
        
        // คำนวณจำนวนเดือนคงเหลือสำหรับแสดงในการ์ดหน้าจัดการ Lot
        const diffTime = exp - now;
        const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        
        let expMonthText = "";
        if (diffTime < 0) {
            expMonthText = `<span class="ml-2 text-[10px] font-bold bg-[#F6C2C2] text-[#7A2E2E] px-1.5 py-0.5 rounded-md">หมดอายุแล้ว</span>`;
        } else if (diffMonths <= 3) {
            expMonthText = `<span class="ml-2 text-[10px] font-bold bg-[#FFE3CD] text-[#A04E0E] px-1.5 py-0.5 rounded-md">เหลืออีก ${diffMonths} ด.</span>`;
        } else {
            expMonthText = `<span class="ml-2 text-[10px] font-bold bg-[#E2F2D5] text-[#4A6B32] px-1.5 py-0.5 rounded-md">เหลืออีก ${diffMonths} ด.</span>`;
        }

        const div = document.createElement("div");
        div.className = `p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
            lot.isInspected ? 'bg-[#E2F2D5]/20 border-[#E2F2D5] text-slate-700' : 'bg-white border-slate-100 shadow-xs'
        }`;

        div.innerHTML = `
            <div class="space-y-1">
                <div class="flex items-center flex-wrap gap-1">
                    <span class="font-bold text-slate-700">Lot: ${lot.lotNumber}</span>
                    ${expMonthText} </div>
                <p class="text-[11px] text-slate-400">
                    EXP: <span class="font-medium text-slate-600">${exp.toLocaleDateString('th-TH')}</span> | 
                    คลังย่อย: <span class="font-medium text-slate-600">${lot.storage || '-'}</span>
                </p>
                ${lot.note ? `<p class="text-[10px] text-amber-600 font-medium">📝 หมายเหตุ: ${lot.note}</p>` : ''}
                ${lot.isInspected ? `<p class="text-[10px] text-emerald-600 font-bold">✓ ตรวจแล้วโดย: ${lot.inspector} (${new Date(lot.inspectionTime).toLocaleDateString('th-TH')})</p>` : ''}
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-black text-sm text-slate-600 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100 min-w-[40px] text-center">${lot.qty}</span>
                <button onclick="deleteLotRow('${lot.lotNumber}')" class="p-1.5 text-slate-300 hover:text-[#7A2E2E] hover:bg-red-50 rounded-xl transition-colors cursor-pointer" title="ลบล็อตนี้">&times;</button>
            </div>
        `;
        listDiv.appendChild(div);
    });
}


async function submitLotForm() {
    const num = document.getElementById("lot-number").value.trim();
    const exp = document.getElementById("lot-exp").value;
    const qty = document.getElementById("lot-qty").value;
    const storage = document.getElementById("lot-storage").value; // ดึงค่าที่เลือกจาก Dropdown <select> ตัวใหม่
    const note = document.getElementById("lot-note").value.trim();

    if(!num || !exp || !qty) return Swal.fire("ข้อมูลไม่ครบ", "โปรดระบุ เลขล็อต, วันหมดอายุ และจำนวนยา", "warning");

    showLoading("กำลังส่งบันทึก...");

    const lotData = {
        barcodeId: APP_STATE.selectedBarcode, 
        lotNumber: num, 
        expDate: exp, 
        qty: Number(qty),
        storage: storage, // ส่งค่าสถานที่ที่เลือกจากคอลัมน์ E ไปบันทึกในแผ่นงาน Lot
        note: note, 
        isInspected: false, 
        inspector: "", 
        inspectionTime: ""
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
            Swal.fire("สำเร็จ", "บันทึกข้อมูลล็อตย่อยเรียบร้อย", "success");
            document.getElementById("lot-number").value = "";
            document.getElementById("lot-exp").value = "";
            document.getElementById("lot-qty").value = "";
            document.getElementById("lot-note").value = "";
        }
    } catch(e) { 
        Swal.fire("ล้มเหลว", "ไม่สามารถบันทึกได้", "error"); 
    }
}
async function inspectSpecificLot(lotNumber) {
    showLoading("กำลังยืนยันล็อต...");
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
        Swal.fire("สำเร็จ", `ตรวจเช็คล็อต ${lotNumber} เรียบร้อย`, "success");
    } catch(e) { Swal.fire("ล้มเหลว", "เกิดข้อผิดพลาดในการตรวจสอบ", "error"); }
}

function deleteSpecificLot(lotNumber) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบล็อดยาหมายเลข ${lotNumber} หรือไม่`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            showLoading("กำลังลบ...");
            try {
                await fetch(API_URL, { 
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "deleteLot", barcodeId: APP_STATE.selectedBarcode, lotNumber: lotNumber }) 
                });
                await reloadDataFromServer();
                renderModalLots();
                Swal.fire("สำเร็จ", "ลบล็อดยาเรียบร้อยแล้ว", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถลบได้", "error"); }
        }
    });
}

async function submitFinalVerify() {
    showLoading("กำลังบันทึกคำยืนยัน...");
    try {
        await fetch(API_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "confirmInspection", barcodeId: APP_STATE.selectedBarcode, inspector: APP_STATE.user }) 
        });
        await reloadDataFromServer();
        closeModal();
        renderInspectList();
        Swal.fire("สำเร็จ", "ยืนยันผลการตรวจเช็คยาทุกล็อตเรียบร้อย", "success");
    } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถส่งคำยืนยันได้", "error"); }
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
        div.className = "p-3 flex justify-between items-center text-xs border-b border-slate-100";
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-700">${drug.drugName}</p>
                <p class="text-slate-400">Barcode: ${drug.barcodeId} | ประเภท: ${drug.type || 'ทั่วไป'}</p>
            </div>
            <button onclick="deleteDrugMaster('${drug.barcodeId}')" class="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold hover:bg-rose-100 transition-colors cursor-pointer">ลบ</button>
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

    if(!id || !name || !unit || !type) return Swal.fire("ข้อมูลไม่ครบ", "กรุณาระบุข้อมูลจำเป็นของยาหลักให้ครบถ้วน", "warning");

    showLoading("กำลังเพิ่มรายการยา...");
    
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
            Swal.fire("สำเร็จ", "เพิ่มยาตัวใหม่เข้าระบบสำเร็จ", "success");
            document.getElementById("add-barcode").value = "";
            document.getElementById("add-name").value = "";
        } else {
            Swal.fire("ไม่สามารถบันทึกได้", result.message, "error");
        }
    } catch(e) { Swal.fire("ล้มเหลว", "เกิดข้อผิดพลาดในการบันทึก", "error"); }
}

function deleteDrugMaster(barcodeId) {
    Swal.fire({
        title: 'ลบรายการยาถาวร?',
        text: "ข้อมูลทุกล็อตรวมถึงข้อมูลยาหลักจะหายไปทั้งหมด!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ยืนยันลบ',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            showLoading("กำลังลบข้อมูลยาหลัก...");
            try {
                await fetch(API_URL, { 
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "adminDeleteDrug", barcodeId: barcodeId }) 
                });
                await reloadDataFromServer();
                renderAdminList();
                Swal.fire("สำเร็จ", "ลบข้อมูลยาหลักเรียบร้อยแล้ว", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถลบข้อมูลได้", "error"); }
        }
    });
}

function generateReport(reportType) {
    const startStr = document.getElementById("report-start").value;
    const endStr = document.getElementById("report-end").value;
    
    if(!startStr || !endStr) return Swal.fire("ระบุช่วงเวลา", "โปรดเลือกช่วงวันที่ก่อนดึงรายงาน", "warning");

    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23,59,59,999); 

    const preview = document.getElementById("report-preview-container");
    if (!preview) return;
    preview.classList.remove("hidden");
    preview.innerHTML = "";

    let headerHTML = `
        <div class="print-header text-center mb-4">
            <h1 class="text-base font-bold text-slate-700">${reportType === 'all' ? 'รายงานสรุปรายการคงคลังทุกล็อต CATH LAB':'รายงานความครบถ้วนการตรวจสอบยาประจำเดือน'}</h1>
            <p class="text-xs text-slate-400 mt-0.5">ช่วงเวลา: ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}</p>
        </div>
        <button onclick="printReport('report-preview-container')" class="no-print mb-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer">🖨️ พิมพ์รายงาน</button>
    `;

    let tableHTML = "";

    if(reportType === 'all') {
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse border border-slate-200">
                <thead class="bg-slate-50 font-bold text-slate-500">
                    <tr>
                        <th class="p-2 border">บาร์โค้ด</th><th class="p-2 border">ชื่อสินค้า / ยาหลัก</th>
                        <th class="p-2 border">ล็อต</th><th class="p-2 border">วันหมดอายุ</th>
                        <th class="p-2 border text-center">จำนวนคงคลัง</th><th class="p-2 border">หน่วย</th><th class="p-2 border">สถานที่จัดเก็บ</th>
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
                        <td class="p-2 border font-mono">${lot.barcodeId || ''}</td><td class="p-2 border font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td>
                        <td class="p-2 border">${lot.lotNumber || ''}</td><td class="p-2 border">${exp.toLocaleDateString('th-TH')}</td>
                        <td class="p-2 border text-center font-bold">${lot.qty || 0}</td><td class="p-2 border">${med ? med.unit : '-'}</td>
                        <td class="p-2 border">${lot.storage || '-'}</td>
                    </tr>
                `;
            }
        });
        tableHTML += "</tbody></table>";
    } else {
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse border border-slate-200">
                <thead class="bg-slate-50 font-bold text-slate-500">
                    <tr>
                        <th class="p-2 border">ชื่อสินค้า / ยาหลัก</th><th class="p-2 border">ประเภท</th>
                        <th class="p-2 border">ล็อตที่ตรวจ</th><th class="p-2 border text-center">สถานะ</th>
                        <th class="p-2 border">ผู้ตรวจสอบ</th><th class="p-2 border">วันที่ตรวจสอบล่าสุด</th>
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
                        <td class="p-2 border font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td><td class="p-2 border">${med ? med.type : '-'}</td>
                        <td class="p-2 border font-mono">${lot.lotNumber || ''}</td>
                        <td class="p-2 border text-center text-teal-600 font-bold">${lot.isInspected ? '✓ ตรวจสอบแล้ว':'✕ ค้างตรวจ'}</td>
                        <td class="p-2 border">${lot.inspector || '-'}</td>
                        <td class="p-2 border">${insTime.toLocaleDateString('th-TH')}</td>
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
        text: "คุณต้องการยกเลิกเซสชันและล็อกเอาท์ออกจากระบบ CATH LAB หรือไม่",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#f43f5e',
        confirmButtonText: 'ยืนยันล็อกเอาท์',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            location.reload(); 
        }
    });
}
