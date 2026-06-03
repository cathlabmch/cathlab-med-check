// เปลี่ยนข้อความด้านล่างเป็น Web App URL ที่ได้จากการ Deploy Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzHv0xMdwur0PEEiBV-BoP7_1eNZCQiW4btmVMnRanH4ObMVFPsDSTwP35-rRKOIQI_/exec";

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
    // การทำงานปุ่ม Login และสิทธิ์ Enter
    document.getElementById("input-empid").addEventListener("keypress", (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById("btn-login").addEventListener("click", handleLogin);
    document.getElementById("btn-logout").addEventListener("click", handleLogout);
});

// ฟังก์ชันเปิดแจ้งเตือนโหลดข้อมูลแบบมินิมอลสวยงาม
function showLoading(msg = "กำลังบันทึกข้อมูล...") {
    Swal.fire({
        title: msg,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
}

// 1. ตรวจสอบสิทธิ์เข้าใช้งาน
async function handleLogin() {
    const empId = document.getElementById("input-empid").value.trim();
    if(!empId) return Swal.fire("กรุณาระบุข้อมูล", "โปรดระบุรหัสพนักงานก่อนดำเนินการต่อ", "warning");

    showLoading("กำลังตรวจสอบรหัสผู้ใช้งาน...");

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "login", empId: empId })
        });
        const result = await res.json();

        if(result.success) {
            APP_STATE.user = result.name;
            APP_STATE.role = result.role;
            
            document.getElementById("txt-user-name").innerText = result.name;
            document.getElementById("txt-login-time").innerText = "ล็อกอินเมื่อ: " + new Date().toLocaleTimeString('th-TH');
            
            if(result.role === "Admin") {
                document.getElementById("menu-admin").classList.remove("hidden");
            }
            
            document.getElementById("login-screen").classList.add("hidden");
            document.getElementById("app-screen").classList.remove("hidden");
            
            await reloadDataFromServer();
            navigate('dashboard');
            Swal.close();
        } else {
            Swal.fire("ไม่พบผู้ใช้งาน", result.message, "error");
        }
    } catch (err) {
        Swal.fire("เชื่อมต่อล้มเหลว", "เกิดข้อผิดพลาดในการรับส่งข้อมูลกับเซิร์ฟเวอร์", "error");
    }
}

// 2. ดึงข้อมูลครั้งเดียวมาเก็บไว้ในเว็บ (State)
async function reloadDataFromServer() {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "fetchAllData" })
        });
        const result = await res.json();
        if(result.success) {
            APP_STATE.master = result.master;
            APP_STATE.lots = result.lots;
            renderDashboard();
            renderInspectList();
        }
    } catch(e) {
        console.error("โหลดข้อมูลคลังยาล้มเหลว", e);
    }
}

// 3. ควบคุมการเปลี่ยนหน้าแถบนำทาง
function navigate(menu) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.querySelectorAll(".nav-item").forEach(i => {
        i.classList.remove("bg-emerald-600", "text-white");
        i.classList.add("text-slate-600", "hover:bg-slate-50");
    });

    document.getElementById(`section-${menu}`).classList.remove("hidden");
    const event = window.event;
    if(event) {
        event.currentTarget.classList.remove("text-slate-600", "hover:bg-slate-50");
        event.currentTarget.classList.add("bg-emerald-600", "text-white");
    }
    
    if(menu === 'dashboard') renderDashboard();
    if(menu === 'inspect') renderInspectList();
    if(menu === 'admin') renderAdminList();
}

// 4. หน้าจอ DASHBOARD (คำนวณวันอายุ 9 เดือน + แบ่งกลุ่มแถบสี)
function renderDashboard() {
    const tbody = document.getElementById("table-dashboard-body");
    tbody.innerHTML = "";
    const today = new Date();
    const limitDate = new Date();
    limitDate.setMonth(today.getMonth() + 9); // กรองล่วงหน้า 9 เดือน

    let filtered = [];

    APP_STATE.lots.forEach(lot => {
        const exp = new Date(lot.expDate);
        if(exp >= today && exp <= limitDate) {
            const masterItem = APP_STATE.master.find(m => m.barcodeId.toString() === lot.barcodeId.toString());
            filtered.push({ ...lot, drugName: masterItem ? masterItem.drugName : "ไม่ระบุชื่อยา", unit: masterItem ? masterItem.unit : "-" });
        }
    });

    // เรียงวันหมดอายุใกล้สุดขึ้นก่อน
    filtered.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    filtered.forEach(item => {
        const exp = new Date(item.expDate);
        const diffMonths = (exp.getFullYear() - today.getFullYear()) * 12 + (exp.getMonth() - today.getMonth());
        
        let colorClass = "";
        if (diffMonths <= 3) colorClass = "bg-rose-50 border-l-4 border-rose-500 text-rose-900 font-medium"; // แดง (0-3 ด.)
        else if (diffMonths <= 6) colorClass = "bg-amber-50 border-l-4 border-amber-500 text-amber-950"; // ส้ม (3-6 ด.)
        else colorClass = "bg-yellow-50 border-l-4 border-yellow-500 text-slate-800"; // เหลือง (6-9 ด.)

        const tr = document.createElement("tr");
        tr.className = colorClass;
        tr.innerHTML = `
            <td class="p-4 font-mono text-xs">${item.barcodeId}</td>
            <td class="p-4 font-semibold">${item.drugName}</td>
            <td class="p-4">${item.lotNumber}</td>
            <td class="p-4">${new Date(item.expDate).toLocaleDateString('th-TH')}</td>
            <td class="p-4 text-center font-bold">${item.qty}</td>
            <td class="p-4">${item.unit}</td>
            <td class="p-4 text-xs">${item.storage || '-'}</td>
            <td class="p-4 text-xs italic text-slate-400">${item.note || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. ระบบหน้าตรวจสอบยา (Filter + การคำนวณสถานะ 1/2 ล็อต)
function filterByType(type) {
    APP_STATE.activeType = type;
    document.querySelectorAll("#type-pills button").forEach(b => {
        b.className = "text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors pill-inactive";
    });
    window.event.currentTarget.className = "text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors pill-active";
    renderInspectList();
}

function searchMedicines() {
    APP_STATE.activeSearch = document.getElementById("search-box").value.toLowerCase();
    renderInspectList();
}

function renderInspectList() {
    const container = document.getElementById("inspect-list-container");
    container.innerHTML = "";

    let filteredMaster = APP_STATE.master.filter(item => {
        const matchesType = (APP_STATE.activeType === 'ALL' || item.type === APP_STATE.activeType);
        const matchesSearch = (item.drugName.toLowerCase().includes(APP_STATE.activeSearch) || item.barcodeId.toString().includes(APP_STATE.activeSearch));
        return matchesType && matchesSearch;
    });

    filteredMaster.forEach(drug => {
        const drugLots = APP_STATE.lots.filter(l => l.barcodeId.toString() === drug.barcodeId.toString());
        const totalLotsCount = drugLots.length;
        const inspectedLotsCount = drugLots.filter(l => l.isInspected === true).length;
        
        let statusBadge = "";
        if (totalLotsCount === 0) {
            statusBadge = `<span class="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-md">ไม่มีข้อมูล Lot</span>`;
        } else if (inspectedLotsCount === totalLotsCount) {
            statusBadge = `<span class="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold">✅ ตรวจสอบครบแล้ว</span>`;
        } else {
            statusBadge = `<span class="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold">⚠️ ตรวจสอบแล้ว ${inspectedLotsCount}/${totalLotsCount} lot</span>`;
        }

        const div = document.createElement("div");
        div.className = "p-4 bg-white rounded-xl border border-slate-100 shadow-xs hover:border-emerald-300 transition-all flex justify-between items-start cursor-pointer";
        div.onclick = () => openModal(drug.barcodeId);
        div.innerHTML = `
            <div class="space-y-1">
                <span class="text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-bold bg-slate-100 text-slate-600">${drug.type || 'ทั่วไป'}</span>
                <h4 class="font-bold text-slate-800 text-sm mt-1">${drug.drugName}</h4>
                <p class="text-xs text-slate-400 font-mono">Barcode: ${drug.barcodeId} | หน่วย: ${drug.unit}</p>
            </div>
            <div class="text-right shrink-0">${statusBadge}</div>
        `;
        container.appendChild(div);
    });
}

// 6. ระบบเปิดใช้งานกล้องมือถือสแกนบาร์โค้ดด้านหลัง
function toggleScanner() {
    const readerDiv = document.getElementById("qr-reader");
    if(readerDiv.classList.contains("hidden")) {
        readerDiv.classList.remove("hidden");
        APP_STATE.scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        APP_STATE.scanner.render((decodedText) => {
            document.getElementById("search-box").value = decodedText;
            APP_STATE.activeSearch = decodedText.toLowerCase();
            renderInspectList();
            toggleScanner(); // ปิดกล้องหลังเจอ
        });
    } else {
        if(APP_STATE.scanner) APP_STATE.scanner.clear();
        readerDiv.classList.add("hidden");
    }
}

// 7. กล่องบันทึกข้อมูลย่อย (Modal Management)
function openModal(barcodeId) {
    APP_STATE.selectedBarcode = barcodeId;
    const drug = APP_STATE.master.find(m => m.barcodeId.toString() === barcodeId.toString());
    document.getElementById("modal-drug-name").innerText = drug.drugName;
    document.getElementById("modal-barcode-id").innerText = "รหัสบาร์โค้ด: " + drug.barcodeId;
    
    renderModalLots();
    document.getElementById("lot-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("lot-modal").classList.add("hidden");
    // รีเซ็ตค่าช่องกรอกข้อมูลในโมดอล
    document.getElementById("lot-number").value = "";
    document.getElementById("lot-exp").value = "";
    document.getElementById("lot-qty").value = "";
    document.getElementById("lot-storage").value = "";
    document.getElementById("lot-note").value = "";
}

function renderModalLots() {
    const container = document.getElementById("modal-lots-list");
    container.innerHTML = "";
    const drugLots = APP_STATE.lots.filter(l => l.barcodeId.toString() === APP_STATE.selectedBarcode.toString());

    if(drugLots.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">ไม่พบประวัติล็อตย่อยในขณะนี้</p>`;
        return;
    }

    drugLots.forEach(lot => {
        const div = document.createElement("div");
        div.className = `p-3 rounded-lg border text-xs flex justify-between items-center ${lot.isInspected ? 'bg-emerald-50/50 border-emerald-200':'bg-slate-50 border-slate-200'}`;
        div.innerHTML = `
            <div>
                <p class="font-bold">Lot: ${lot.lotNumber} | <span class="text-rose-600 font-semibold">EXP: ${new Date(lot.expDate).toLocaleDateString('th-TH')}</span></p>
                <p class="text-slate-500 mt-0.5">จำนวน: ${lot.qty} | ที่เก็บ: ${lot.storage || '-'} | หมายเหตุ: ${lot.note || '-'}</p>
                ${lot.isInspected ? `<p class="text-[10px] text-emerald-600 font-medium">✓ ตรวจแล้วโดย ${lot.inspector}</p>` : ''}
            </div>
            <div class="flex gap-1">
                <button onclick="inspectSpecificLot('${lot.lotNumber}')" class="px-2 py-1 bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 rounded font-semibold">ตรวจเฉพาะล็อต</button>
                <button onclick="deleteSpecificLot('${lot.lotNumber}')" class="px-2 py-1 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded">ลบ</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 8. การทำงานระดับย่อย: เพิ่ม ตรวจสอบ ลบรายล็อต
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
            body: JSON.stringify({ action: "saveLot", data: lotData })
        });
        const result = await res.json();
        if(result.success) {
            await reloadDataFromServer();
            renderModalLots();
            Swal.fire("สำเร็จ", "บันทึกข้อมูลล็อตเรียบร้อย", "success");
            // ล้างฟอร์ม
            document.getElementById("lot-number").value = "";
            document.getElementById("lot-exp").value = "";
            document.getElementById("lot-qty").value = "";
        }
    } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถส่งข้อมูลไปบันทึกได้", "error"); }
}

async function inspectSpecificLot(lotNumber) {
    showLoading("กำลังยืนยันสถานะล็อต...");
    const currentLot = APP_STATE.lots.find(l => l.barcodeId.toString() === APP_STATE.selectedBarcode.toString() && l.lotNumber.toString() === lotNumber.toString());
    if(!currentLot) return;

    currentLot.isInspected = true;
    currentLot.inspector = APP_STATE.user;
    currentLot.inspectionTime = new Date().toISOString();

    try {
        await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "saveLot", data: currentLot }) });
        await reloadDataFromServer();
        renderModalLots();
        Swal.fire("ตรวจแล้ว", `ยืนยันความถูกต้องเฉพาะ Lot: ${lotNumber} เรียบร้อย`, "success");
    } catch(e) { Swal.fire("ล้มเหลว", "เกิดข้อผิดพลาดในการตรวจสอบระบบ", "error"); }
}

function deleteSpecificLot(lotNumber) {
    Swal.fire({
        title: 'ยืนยันการลบตัวเลือก?',
        text: `คุณต้องการลบล็อดยาหมายเลข ${lotNumber} ออกจากฐานข้อมูลหรือไม่`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            showLoading("กำลังทำลายข้อมูลล็อต...");
            try {
                await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "deleteLot", barcodeId: APP_STATE.selectedBarcode, lotNumber: lotNumber }) });
                await reloadDataFromServer();
                renderModalLots();
                Swal.fire("ลบสำเร็จ", "ลบข้อมูลล็อดยาที่เลือกเรียบร้อยแล้ว", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถสั่งลบข้อมูลได้", "error"); }
        }
    });
}

async function submitFinalVerify() {
    showLoading("กำลังส่งบันทึกความสมบูรณ์...");
    try {
        await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "confirmInspection", barcodeId: APP_STATE.selectedBarcode, inspector: APP_STATE.user }) });
        await reloadDataFromServer();
        closeModal();
        renderInspectList();
        Swal.fire("สำเร็จ", "ยืนยันผลการตรวจสอบยาทุกล็อตเรียบร้อย", "success");
    } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถส่งคำยืนยันการตรวจได้", "error"); }
}

// 9. สิทธิ์ ADMIN (เพิ่ม / ลบ ยาจากผังยาหลักหลัก)
function renderAdminList() {
    const container = document.getElementById("admin-drug-list");
    container.innerHTML = "";
    const q = document.getElementById("admin-search").value.toLowerCase();

    const filtered = APP_STATE.master.filter(m => m.drugName.toLowerCase().includes(q) || m.barcodeId.toString().includes(q));
    
    filtered.forEach(drug => {
        const div = document.createElement("div");
        div.className = "p-3 flex justify-between items-center text-xs";
        div.innerHTML = `
            <div>
                <p class="font-bold">${drug.drugName}</p>
                <p class="text-slate-400">Barcode: ${drug.barcodeId} | กลุ่ม: ${drug.type}</p>
            </div>
            <button onclick="deleteDrugMaster('${drug.barcodeId}')" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded">ลบรายการหลัก</button>
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
        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "adminAddDrug", drug: drug }) });
        const result = await res.json();
        if(result.success) {
            await reloadDataFromServer();
            renderAdminList();
            Swal.fire("บันทึกแล้ว", "เพิ่มยาตัวใหม่เข้าสู่ระบบคลังสำเร็จ", "success");
            // เคลียร์ค่าฟอร์ม
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
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'ยืนยันลบทั้งหมด',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if(result.isConfirmed) {
            showLoading("กำลังทำลายข้อมูลถาวร...");
            try {
                await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "adminDeleteDrug", barcodeId: barcodeId }) });
                await reloadDataFromServer();
                renderAdminList();
                Swal.fire("ลบสำเร็จ", "ลบข้อมูลยาออกจากโครงสร้างคลังหลักสำเร็จ", "success");
            } catch(e) { Swal.fire("ล้มเหลว", "ไม่สามารถลบข้อมูลได้", "error"); }
        }
    });
}

// 10. ระบบพิมพ์และสร้างรายงาน (กรองช่วงเวลาได้)
function generateReport(reportType) {
    const startStr = document.getElementById("report-start").value;
    const endStr = document.getElementById("report-end").value;
    
    if(!startStr || !endStr) return Swal.fire("ระบุเวลา", "โปรดเลือกช่วงวันที่เริ่มต้นและสิ้นสุดก่อนดึงรายงาน", "warning");

    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23,59,59,999); // ปรับครอบคลุมจุดสิ้นสุดของวันนั้นๆ

    const preview = document.getElementById("report-preview-container");
    preview.classList.remove("hidden");
    preview.innerHTML = "";

    // ข้อมูลพาดหัวพิมพ์รายงาน
    let headerHTML = `
        <div class="print-header text-center mb-4">
            <h1 class="text-lg font-bold">${reportType === 'all' ? '6.1 รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB':'6.2 รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน'}</h1>
            <p class="text-xs text-slate-500 mt-0.5">ช่วงเวลาประเมินผล: ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}</p>
            <p class="text-[11px] text-slate-400">ผู้พิมพ์รายงาน: ${APP_STATE.user} | วันและเวลาพิมพ์: ${new Date().toLocaleString('th-TH')}</p>
        </div>
        <button onclick="printReport('report-preview-container')" class="no-print mb-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold">🖨️ สั่งพิมพ์เอกสารนี้ (ประหยัดกระดาษ)</button>
    `;

    let tableHTML = "";

    if(reportType === 'all') {
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse">
                <thead class="bg-slate-100 font-bold">
                    <tr>
                        <th class="p-2 border">บาร์โค้ด</th><th class="p-2 border">ชื่อสินค้า/ตัวยา</th>
                        <th class="p-2 border">Lot</th><th class="p-2 border">วันหมดอายุ</th>
                        <th class="p-2 border text-center">จำนวน</th><th class="p-2 border">หน่วย</th><th class="p-2 border">สถานที่จัดเก็บ</th>
                    </tr>
                </thead><tbody>
        `;
        APP_STATE.lots.forEach(lot => {
            const exp = new Date(lot.expDate);
            if(exp >= start && exp <= end) {
                const med = APP_STATE.master.find(m => m.barcodeId.toString() === lot.barcodeId.toString());
                tableHTML += `
                    <tr>
                        <td class="p-2 border font-mono">${lot.barcodeId}</td><td class="p-2 border font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td>
                        <td class="p-2 border">${lot.lotNumber}</td><td class="p-2 border">${exp.toLocaleDateString('th-TH')}</td>
                        <td class="p-2 border text-center font-bold">${lot.qty}</td><td class="p-2 border">${med ? med.unit : '-'}</td>
                        <td class="p-2 border">${lot.storage || '-'}</td>
                    </tr>
                `;
            }
        });
        tableHTML += "</tbody></table>";
    } else {
        // 6.2 รายงานสถานะการตรวจประจำเดือน
        tableHTML = `
            <table class="w-full text-xs text-left border-collapse">
                <thead class="bg-slate-100 font-bold">
                    <tr>
                        <th class="p-2 border">ชื่อสินค้า / ยาหลัก</th><th class="p-2 border">ประเภท</th>
                        <th class="p-2 border">Lot ที่ตรวจ</th><th class="p-2 border text-center">สถานะ</th>
                        <th class="p-2 border">ผู้ตรวจสอบ</th><th class="p-2 border">วันที่ตรวจสอบล่าสุด</th>
                    </tr>
                </thead><tbody>
        `;
        APP_STATE.lots.forEach(lot => {
            const insTime = lot.inspectionTime ? new Date(lot.inspectionTime) : null;
            if(insTime && insTime >= start && insTime <= end) {
                const med = APP_STATE.master.find(m => m.barcodeId.toString() === lot.barcodeId.toString());
                tableHTML += `
                    <tr>
                        <td class="p-2 border font-bold">${med ? med.drugName : 'ไม่ทราบชื่อ'}</td><td class="p-2 border">${med ? med.type : '-'}</td>
                        <td class="p-2 border font-mono">${lot.lotNumber}</td>
                        <td class="p-2 border text-center text-emerald-600 font-bold">${lot.isInspected ? '✓ ตรวจสอบแล้ว':'✕ ค้างตรวจ'}</td>
                        <td class="p-2 border">${lot.inspector || '-'}</td>
                        <td class="p-2 border">${insTime ? insTime.toLocaleDateString('th-TH') : '-'}</td>
                    </tr>
                `;
            }
        });
        tableHTML += "</tbody></table>";
    }

    preview.innerHTML = headerHTML + tableHTML;
}

function printReport(containerId) {
    // ป้อนข้อมูลผู้ใช้งานเข้าสู่หัวกระดาษพิมพ์จริง
    document.querySelectorAll(".print-by").forEach(el => el.innerText = APP_STATE.user);
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
            location.reload(); // เคลียร์ตัวแปร State ปลอดภัยที่สุด
        }
    });
}