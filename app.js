// 🔗 สัญญาณเชื่อมต่อฐานข้อมูล Google Apps Script (Web App URL)
const API_URL = "https://script.google.com/macros/s/AKfycbyCG5h6hCagw0Lh_CAwVuTw-a5yneALPcbSx_f5cwlfRJMvt2JSvQJ4I9V6urtiRqJg/exec";

// สถาปัตยกรรมการจัดเก็บโครงสร้างสเตตภายในตัวหน้าเว็บแอปหลัก (State Management)
let APP_STATE = {
    user: null,
    role: null,
    master: [],
    lots: [],
    activeType: 'ALL',
    activeSearch: '',
    selectedBarcode: null,
    loginTime: null
};

// เริ่มต้นเปิดระบบประมวลผลเมื่อโครงสร้าง HTML โหลดเสร็จสมบูรณ์
document.addEventListener("DOMContentLoaded", () => {
    const inputEmp = document.getElementById("input-empid");
    if (inputEmp) {
        inputEmp.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) btnLogin.addEventListener("click", handleLogin);

    // ดักจับฟังก์ชั่นพิมพ์รหัสบาร์โค้ดในหน้าแอดมิน เพื่อทำระบบดึงประวัติเติมข้อมูลให้อัตโนมัติ (Auto-fill)
    const adBarcodeInp = document.getElementById("ad-barcode");
    if (adBarcodeInp) {
        adBarcodeInp.addEventListener("input", autoFillAdminForm);
    }

    // ดักจับข้อมูลการพิมพ์ค้นหาช่องตรวจสอบยาประจำตึก เพื่อทำหน้ากรองแสดงผล Realtime
    const searchDrugInp = document.getElementById("search-drug-input");
    if (searchDrugInp) {
        searchDrugInp.addEventListener("input", (e) => {
            APP_STATE.activeSearch = e.target.value.trim().toLowerCase();
            renderInspectSection();
        });
    }
});

// 📌 1. ฟังก์ชันจัดการระบบเข้าใช้งานระบบล็อกอิน (กรณีข้อมูลผิดพลาดจะทำการล้างข้อมูลทันที)
async function handleLogin() {
    const inputEmp = document.getElementById("input-empid");
    const empId = inputEmp.value.trim();

    if (!empId) {
        Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกรหัสพนักงานประเมินตนเองด้วยครับ 🧸' });
        return;
    }

    showLoading("กำลังส่งข้อมูลตรวจสอบสิทธิ์และดึงค่าฐานคลังยาหลัก...");

    try {
        // ดึงสิทธิ์ข้อมูลจากหลังบ้านผ่าน Google Sheet รายชื่อผู้ใช้
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "fetchAllData" })
        });
        const res = await response.json();
        Swal.close();

        if (res.success) {
            APP_STATE.master = res.master || [];
            APP_STATE.lots = res.lots || [];

            // ตรวจสอบจับคู่และดึงรายชื่อล็อกอินตรงในฝั่งสิทธิ์หน้าเว็บบอร์ด
            let matchedUser = null;
            if (empId === "58318173") matchedUser = { name: "นิจชิตา คุณธรรม", role: "Admin" };
            else if (empId === "63387151") matchedUser = { name: "ญาณวัฒนา สุวรรณรัตน์", role: "Admin" };
            else if (empId === "63387208") matchedUser = { name: "ชนกนันท์ นันทะพงษ์", role: "Member" };
            else if (empId === "61387256") matchedUser = { name: "วรรณรดา บรรณากิจ", role: "Member" };
            else if (empId === "69387113") matchedUser = { name: "ศิรสิทธิ์ ภูวุฒิ", role: "Member" };

            if (matchedUser) {
                APP_STATE.user = matchedUser.name;
                APP_STATE.role = matchedUser.role;
                
                // 3.1 ดึงและเก็บข้อมูล วันและเวลาเข้าสิทธิ์ระบบหลัก
                const now = new Date();
                APP_STATE.loginTime = now.toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                }) + " น.";

                // อัปเดตผูกข้อมูลเข้าหน้า Dashboard และแถบโปรไฟล์ผู้ควบคุม
                document.getElementById("user-name").innerText = APP_STATE.user;
                document.getElementById("user-role").innerText = APP_STATE.role;
                document.getElementById("dash-login-time").innerText = APP_STATE.loginTime;

                // ตรวจสอบจัดการสิทธิ์การเข้าถึงเมนูคลังหลัก Admin
                if (APP_STATE.role === "Admin") {
                    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
                } else {
                    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
                }

                // สลับสลับหน้าต่างและเปิดการทำงานอินเตอร์เฟสย่อย
                document.getElementById("login-screen").classList.add("hidden");
                document.getElementById("main-app").classList.remove("hidden");

                // เริ่มต้นสร้างประวัติ Autocomplete และโหลดหน้าหลัก
                buildAllDatalists();
                renderDashboardSection();
                buildTypeFilterPills();

                Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ', text: `สวัสดีครับคุณ ${APP_STATE.user} 🎉`, timer: 1500, showConfirmButton: false });
            } else {
                // 👉 1. ปรับแก้ส่วนที่ขอ: ล้างข้อมูลในช่องกรอกและโฟกัสตัวกระพริบเมื่อพิมพ์รหัสผิด
                Swal.fire({ icon: 'error', title: 'ไม่พบรหัสผู้ใช้', text: 'รหัสพนักงานไม่ถูกต้อง หรือไม่ได้รับสิทธิ์เข้าถึงคลังย่อยประจำเดือนนี้' });
                inputEmp.value = "";
                inputEmp.focus();
            }
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'เชื่อมต่อผิดพลาด', text: 'ระบบล้มเหลวในการส่งข้อมูลหา Google Sheets หรือปัญหาโครงสร้างเครือข่าย' });
        inputEmp.value = "";
        inputEmp.focus();
    }
}

// ฟังก์ชันเปิด Alert แจ้งโหลดข้อมูลมินิมอลสวยงาม
function showLoading(msg) {
    Swal.fire({
        title: msg,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
}

// ควบคุมเปลี่ยนสลับปุ่มหน้ารายงานย่อย
function switchSection(secId) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.getElementById(secId).classList.remove("hidden");

    document.querySelectorAll("aside nav button").forEach(b => {
        b.classList.remove("bg-[#e4f5f5]", "text-[#3d8282]", "font-bold");
        b.classList.add("text-slate-500", "font-semibold");
    });

    const activeBtn = document.getElementById(`nav-${secId}`);
    if (activeBtn) {
        activeBtn.classList.remove("text-slate-500", "font-semibold");
        activeBtn.classList.add("bg-[#e4f5f5]", "text-[#3d8282]", "font-bold");
    }

    if (secId === 'section-dash') renderDashboardSection();
    if (secId === 'section-inspect') renderInspectSection();
    if (secId === 'section-admin') renderAdminSection();
}

// 📌 3.2 ปรับเรนเดอร์ตารางสรุปภาพรวมหน้าแดชบอร์ด (เพิ่มระบบเตือนแถบสีหากยอดขาด)
function renderDashboardSection() {
    const tbody = document.getElementById("dash-summary-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    APP_STATE.master.forEach(drug => {
        const relatedLots = APP_STATE.lots.filter(l => l.barcodeId === drug.barcodeId);
        
        // 4.2 คำนวณยอดผลรวมสต็อกทุกล็อตรวมกัน เพื่อเปรียบเทียบค่าเกณฑ์ Stock (คอลัมน์ D)
        const totalCurrentQty = relatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0);
        const targetStock = Number(drug.stock || 0);
        const isDeficit = totalCurrentQty < targetStock;

        // คำนวณหาตรวจสอบสถานะการเช็คความครอบคลุม
        const totalLots = relatedLots.length;
        const checkedLots = relatedLots.filter(l => l.isInspected).length;
        let inspectStatus = "🟡 รอตรวจสอบ";
        if (totalLots > 0 && checkedLots === totalLots) {
            inspectStatus = "🟢 ตรวจครบแล้ว";
        }

        const tr = document.createElement("tr");
        if (isDeficit) {
            tr.className = "bg-[#ff8b94]/10 hover:bg-[#ff8b94]/20 transition-colors"; // แถบสีพาสเทลแจ้งเตือนหากขาดแคลนยอดคลัง
        } else {
            tr.className = "hover:bg-slate-50 transition-colors";
        }

        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-700">${drug.barcodeId}</td>
            <td class="p-3 font-semibold text-slate-800">${drug.drugName}</td>
            <td class="p-3 text-center text-slate-500">${drug.unit || '-'}</td>
            <td class="p-3 text-center font-bold">
                ${targetStock} ${isDeficit ? `<span class="block text-[9px] bg-[#ff8b94] text-white px-1 py-0.5 rounded-md mt-0.5 font-normal">ขาดประจำแผนก (มีอยู่ ${totalCurrentQty})</span>` : ''}
            </td>
            <td class="p-3 text-slate-600"><i class="fa-solid fa-location-dot text-[#7bc4c4] mr-1"></i>${drug.storage || '-'}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold">${drug.type || 'ทั่วไป'}</span></td>
            <td class="p-3 text-center font-bold">${inspectStatus}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 📌 4.3 สร้างปุ่มแถบเลือกฟิลเตอร์ Type คอลัมน์กรองยา และ 4.1 ฟังก์ชั่น Autocomplete ประวัติ
function buildTypeFilterPills() {
    const pContainer = document.getElementById("inspect-type-pills");
    if (!pContainer) return;
    pContainer.innerHTML = "";

    // ดึงค่ารายการประเภททั้งหมดมาทำการกรองตัดตัวซ้ำออกออก
    const types = ['ALL', ...new Set(APP_STATE.master.map(d => d.type).filter(Boolean))];
    
    types.forEach(t => {
        const btn = document.createElement("button");
        btn.className = `px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
            APP_STATE.activeType === t 
            ? 'bg-[#7bc4c4] text-white border-[#7bc4c4] shadow-xs' 
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`;
        btn.innerText = t === 'ALL' ? 'ทั้งหมด' : t;
        btn.onclick = () => {
            APP_STATE.activeType = t;
            buildTypeFilterPills(); // รีเรนเดอร์เปลี่ยนสถานะปุ่มไฮไลต์
            renderInspectSection();
        };
        pContainer.appendChild(btn);
    });
}

// ฟังก์ชันสร้างฐานข้อมูลคลังสำหรับเก็บไอเทม Autocomplete ดรอปดาวน์ประวัติ (4.1, 5.1, 5.2)
function buildAllDatalists() {
    // รายชื่อยาหน้าตรวจยา
    const dlInspect = document.getElementById("datalist-inspect-drugs");
    if(dlInspect) {
        dlInspect.innerHTML = APP_STATE.master.map(d => `<option value="${d.drugName}">[Barcode: ${d.barcodeId}]</option>`).join("");
    }

    // รายชื่อบาร์โค้ดหน้าแอดมิน
    const dlAdminBar = document.getElementById("datalist-admin-barcodes");
    if(dlAdminBar) {
        dlAdminBar.innerHTML = APP_STATE.master.map(d => `<option value="${d.barcodeId}">${d.drugName}</option>`).join("");
    }

    // ประวัติสถานที่และหน่วยนับในระบบ (5.2)
    const uniqueUnits = [...new Set(APP_STATE.master.map(d => d.unit).filter(Boolean))];
    const uniqueStorages = [...new Set(APP_STATE.master.map(d => d.storage).filter(Boolean))];

    const dlUnits = document.getElementById("datalist-admin-units");
    if(dlUnits) dlUnits.innerHTML = uniqueUnits.map(u => `<option value="${u}">`).join("");

    const dlStorages = document.getElementById("datalist-admin-storages");
    if(dlStorages) dlStorages.innerHTML = uniqueStorages.map(s => `<option value="${s}">`).join("");
}

// 📌 4.1 และ 4.2 ระบบเรนเดอร์แสดงผลตรวจเช็คและเปรียบเทียบยอดคงคลังขาดขาดแคลนไหม
function renderInspectSection() {
    const area = document.getElementById("inspect-results-area");
    if (!area) return;
    area.innerHTML = "";

    // กรองหาตัวยาที่ผ่านเกณฑ์ทั้งคีย์เวิร์ดค้นหา และประเภทหลักกลุ่ม Type (4.3)
    const filtered = APP_STATE.master.filter(drug => {
        const matchesType = APP_STATE.activeType === 'ALL' || drug.type === APP_STATE.activeType;
        const matchesSearch = !APP_STATE.activeSearch || 
                              drug.drugName.toLowerCase().includes(APP_STATE.activeSearch) || 
                              drug.barcodeId.toLowerCase().includes(APP_STATE.activeSearch);
        return matchesType && matchesSearch;
    });

    if (filtered.length === 0) {
        area.innerHTML = `<p class="text-center text-xs text-slate-400 py-6 col-span-full">❌ ไม่พบรายการยาตรงเงื่อนไขการค้นหาในระบบแผนกเลยครับ</p>`;
        return;
    }

    filtered.forEach(drug => {
        const relatedLots = APP_STATE.lots.filter(l => l.barcodeId === drug.barcodeId);
        const totalQty = relatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0);
        const targetStock = Number(drug.stock || 0);
        const isDeficit = totalQty < targetStock;

        const card = document.createElement("div");
        card.className = `p-4 rounded-cute bg-white border theme-card-shadow space-y-3 relative overflow-hidden ${isDeficit ? 'border-[#ff8b94]' : 'border-slate-100'}`;
        
        card.innerHTML = `
            <div>
                <span class="text-[10px] font-bold text-[#4a9696] uppercase tracking-wide block bg-[#e4f5f5] w-fit px-2 py-0.5 rounded-md mb-1">${drug.type || 'ทั่วไป'}</span>
                <h4 class="font-bold text-sm text-slate-800 leading-snug">${drug.drugName}</h4>
                <p class="text-slate-400 font-mono text-[11px] mt-0.5">Barcode: ${drug.barcodeId}</p>
            </div>
            <div class="text-xs bg-slate-50 p-2.5 rounded-xl flex justify-between items-center">
                <div>
                    <span class="text-slate-400 block text-[10px]">สถานที่จัดเก็บหลัก</span>
                    <span class="font-semibold text-slate-700"><i class="fa-solid fa-box text-[#7bc4c4] mr-1"></i>${drug.storage || '-'}</span>
                </div>
                <div class="text-right">
                    <span class="text-slate-400 block text-[10px]">สต็อกที่มี / แผนกต้องการ</span>
                    <span class="font-bold ${isDeficit ? 'text-[#e53e3e]' : 'text-slate-700'}">${totalQty} / ${targetStock} ${drug.unit}</span>
                </div>
            </div>
            ${isDeficit ? `<div class="p-1.5 theme-pastel-orange text-[#c05621] text-[10px] rounded-lg font-bold text-center"><i class="fa-solid fa-triangle-exclamation"></i> ยอดปัจจุบันน้อยกว่าจำนวนขั้นต่ำประจำตึก!</div>` : ''}
            <button onclick="openLotModal('${drug.barcodeId}')" class="w-full py-2 bg-slate-100 hover:bg-[#e4f5f5] hover:text-[#3d8282] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-boxes-stacked"></i> เปิดบันทึก/ตรวจสอบล็อตสินค้า (${relatedLots.length})
            </button>
        `;
        area.appendChild(card);
    });
}

// 📌 5.1 ระบบแอดมิน กรอกบาร์โค้ดแล้วดึงข้อมูลมาเติมให้โดยอัตโนมัติ (Auto-fill)
function autoFillAdminForm() {
    const barcodeInput = document.getElementById("ad-barcode");
    if (!barcodeInput) return;
    const barcode = barcodeInput.value.trim();

    // ค้นหาค้นหายาในลิสต์ฐานข้อมูลหลักที่มีอยู่เดิม
    const matched = APP_STATE.master.find(d => d.barcodeId === barcode);
    const titleForm = document.getElementById("admin-form-title");

    if (matched) {
        document.getElementById("ad-name").value = matched.drugName || "";
        document.getElementById("ad-unit").value = matched.unit || "";
        document.getElementById("ad-stock").value = matched.stock || 0;
        document.getElementById("ad-storage").value = matched.storage || "";
        document.getElementById("ad-type").value = matched.type || "ทั่วไป";
        if(titleForm) titleForm.innerHTML = "📝 แก้ไขอัปเดตข้อมูลยาหลักเดิม";
    } else {
        // หากไม่เจอรหัสเดิม ให้สลับหัวข้อกลับเป็นฟอร์มเพิ่มรายการยาชิ้นใหม่
        if(titleForm) titleForm.innerHTML = "➕ เพิ่มรายการยาหลักเข้าคลัง";
    }
}

// เรนเดอร์ตารางฐานข้อมูลหน้าแอดมินคลังใหญ่
function renderAdminSection() {
    const tbody = document.getElementById("admin-master-tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    APP_STATE.master.forEach(d => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-600">${d.barcodeId}</td>
            <td class="p-3 font-bold text-slate-800">${d.drugName}</td>
            <td class="p-3 text-center">${d.unit || '-'}</td>
            <td class="p-3 text-center font-semibold">${d.stock || 0}</td>
            <td class="p-3 text-slate-600">${d.storage || '-'}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${d.type || 'ทั่วไป'}</span></td>
            <td class="p-3 text-center">
                <button onclick="deleteAdminDrug('${d.barcodeId}')" class="p-1 text-[#e53e3e] hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="ลบรายการยาหลัก"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ส่งบันทึกข้อมูลหน้าแอดมินคลังหลักเข้า Sheet หลังบ้าน
async function handleAdminSubmit(e) {
    e.preventDefault();
    if (APP_STATE.role !== "Admin") return;

    const drugObj = {
        barcodeId: document.getElementById("ad-barcode").value.trim(),
        drugName: document.getElementById("ad-name").value.trim(),
        unit: document.getElementById("ad-unit").value.trim(),
        stock: Number(document.getElementById("ad-stock").value),
        storage: document.getElementById("ad-storage").value.trim(),
        type: document.getElementById("ad-type").value
    };

    showLoading("กำลังส่งคำสั่งบันทึกการเปลี่ยนแปลงยาหลักไปยังระบบเซิร์ฟเวอร์...");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "adminAddDrug", drug: drugObj })
        });
        const res = await response.json();
        Swal.close();

        if (res.success) {
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ปรับปรุงคลังข้อมูลหลักสำเร็จแล้วครับ', timer: 1500 });
            document.getElementById("form-admin-drug").reset();
            
            // รีเฟรชฐานข้อมูลข้อมูลฝั่งเว็บใหม่
            await refreshDataState();
            renderAdminSection();
            buildAllDatalists();
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: res.message || 'เกิดความผิดพลาดในการกรอกค่าข้อมูลซ้ำ' });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'เชื่อมต่อล้มเหลว: ' + err.toString() });
    }
}

// ลบรายชื่อยาหลักออกจากฐานระบบคลังย่อย
async function deleteAdminDrug(barcodeId) {
    if (APP_STATE.role !== "Admin") return;
    
    const confirm = await Swal.fire({
        title: 'ยืนยันการลบตัวยาหลัก?',
        text: "การลบรายการหลักจะส่งผลให้ข้อมูลล็อตย่อยของยานี้ถูกลบทำลายทิ้งทั้งหมดด้วย!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8b94',
        cancelButtonColor: '#cbd5e0',
        confirmButtonText: 'ใช่, ฉันต้องการลบ',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    showLoading("กำลังดำเนินการลบแถวข้อมูลยาหลัก...");
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "adminDeleteDrug", barcodeId: barcodeId })
        });
        const res = await response.json();
        Swal.close();

        if(res.success) {
            Swal.fire({ icon: 'success', title: 'ลบเสร็จสิ้น', text: 'ข้อมูลยาถูกนำออกจากฐานระบบเรียบร้อย', timer: 1500 });
            await refreshDataState();
            renderAdminSection();
            buildAllDatalists();
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'ไม่สามารถติดต่อลบค่าได้: ' + e.toString() });
    }
}

// 📌 6.1 พิมพ์รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB (เพิ่มหมายเหตุ ออกแบบตารางสวยงาม)
function renderReport61() {
    const box = document.getElementById("report-preview-box");
    if (!box) return;

    let html = `
        <div class="text-center pb-4 mb-4 border-b border-slate-200">
            <h2 class="text-lg font-bold text-slate-800">📋 รายงานข้อมูลยารวมและสรุปประเมินทุกล็อตย่อย คลังยา CATH LAB</h2>
            <p class="text-slate-400 text-[11px] mt-0.5">ข้อมูลประมวลสรุปสำหรับใช้ตรวจสอบความโปร่งใสในระบบยาประจำรอบเดือน</p>
        </div>
        <table class="w-full text-left border-collapse border border-slate-300 print-table text-xs">
            <thead>
                <tr class="bg-slate-100">
                    <th class="p-2 border border-slate-300">บาร์โค้ดสินค้า</th>
                    <th class="p-2 border border-slate-300">ชื่อรายการยาในคลัง</th>
                    <th class="p-2 border border-slate-300 text-center">ประเภทกลุ่ม</th>
                    <th class="p-2 border border-slate-300">เลขล็อต (Lot No.)</th>
                    <th class="p-2 border border-slate-300 text-center">วันหมดอายุ (EXP)</th>
                    <th class="p-2 border border-slate-300 text-center">จำนวนที่ตรวจพบ</th>
                    <th class="p-2 border border-slate-300">หมายเหตุ / ข้อมูลบันทึกประวัติเพิ่มเติม</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
    `;

    APP_STATE.master.forEach(drug => {
        const subLots = APP_STATE.lots.filter(l => l.barcodeId === drug.barcodeId);
        
        if (subLots.length === 0) {
            html += `
                <tr class="hover:bg-slate-50">
                    <td class="p-2 border border-slate-300 font-mono">${drug.barcodeId}</td>
                    <td class="p-2 border border-slate-300 font-bold">${drug.drugName}</td>
                    <td class="p-2 border border-slate-300 text-center"><span class="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">${drug.type || '-'}</span></td>
                    <td colspan="3" class="p-2 border border-slate-300 text-center text-slate-400 font-medium italic">- ยังไม่เคยบันทึกรายการล็อตสารคลังย่อยเข้ามา -</td>
                    <td class="p-2 border border-slate-300 text-slate-400">เกณฑ์แผนกขั้นต่ำ: ${drug.stock || 0} ${drug.unit}</td>
                </tr>
            `;
        } else {
            subLots.forEach((lot, index) => {
                const expFormatted = lot.expDate ? new Date(lot.expDate).toLocaleDateString('th-TH') : '-';
                html += `
                    <tr class="hover:bg-slate-50">
                        <td class="p-2 border border-slate-300 font-mono text-slate-600">${index === 0 ? drug.barcodeId : ''}</td>
                        <td class="p-2 border border-slate-300 font-bold text-slate-800">${index === 0 ? drug.drugName : ''}</td>
                        <td class="p-2 border border-slate-300 text-center">${index === 0 ? `<span class="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">${drug.type}</span>` : ''}</td>
                        <td class="p-2 border border-slate-300 font-mono text-blue-600 font-semibold">${lot.lotNumber}</td>
                        <td class="p-2 border border-slate-300 text-center">${expFormatted}</td>
                        <td class="p-2 border border-slate-300 text-center"><b>${lot.qty || 0}</b> ${drug.unit}</td>
                        <td class="p-2 border border-slate-300 text-slate-500">${lot.note || '-'}</td>
                    </tr>
                `;
            });
        }
    });

    html += `</tbody></table>`;
    box.innerHTML = html;
}

// 📌 6.2 รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน (เรียงวันที่ไปขวา / รายการค้างย้ายไว้ล่างสุด)
function renderReport62() {
    const box = document.getElementById("report-preview-box");
    if (!box) return;

    let checkedList = [];
    let uncheckedList = [];

    // จำแนกกลุ่มตัวยาที่ผ่านเกณฑ์เช็คแล้ว และ ค้างการเช็คระบบออกจากกันอย่างรอบคอบ
    APP_STATE.master.forEach(drug => {
        const matchedLots = APP_STATE.lots.filter(l => l.barcodeId === drug.barcodeId);
        const hasCheckLog = matchedLots.length > 0 && matchedLots.some(l => l.isInspected);

        if (hasCheckLog) {
            checkedList.push({ drug: drug, lots: matchedLots.filter(l => l.isInspected) });
        } else {
            uncheckedList.push({ drug: drug, lots: matchedLots });
        }
    });

    let html = `
        <div class="text-center pb-4 mb-4 border-b border-slate-200">
            <h2 class="text-lg font-bold text-slate-800">📆 รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน</h2>
            <p class="text-slate-400 text-[11px] mt-0.5">คัดกรองจัดกลุ่มประวัติ โดยนำตัวยาที่ยังขาดการเดินสำรวจ ย้ายไปกองแสดงผลไว้ล่างสุดของเอกสาร</p>
        </div>
        <table class="w-full text-left border-collapse border border-slate-300 print-table text-xs">
            <thead>
                <tr class="bg-slate-100">
                    <th class="p-2 border border-slate-300">รหัสบาร์โค้ด</th>
                    <th class="p-2 border border-slate-300">ชื่อรายการยา</th>
                    <th class="p-2 border border-slate-300">รุ่นล็อตที่เช็ค</th>
                    <th class="p-2 border border-slate-300 text-center">วันที่ลงบันทึก ➡️</th>
                    <th class="p-2 border border-slate-300">รายชื่อผู้ตรวจสอบ (Inspector) ➡️</th>
                    <th class="p-2 border border-slate-300 text-center">สถานะสิทธิ์</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
    `;

    // 1. นำกลุ่มยาที่มีการตรวจเช็คเรียบร้อยแล้ว เรนเดอร์ขึ้นแสดงก่อนทางด้านบน
    if(checkedList.length > 0) {
        checkedList.forEach(item => {
            item.lots.forEach((lot, i) => {
                const checkTimeStr = lot.inspectionTime ? new Date(lot.inspectionTime).toLocaleDateString('th-TH') : '-';
                html += `
                    <tr class="bg-white">
                        <td class="p-2 border border-slate-300 font-mono text-slate-600">${i === 0 ? item.drug.barcodeId : ''}</td>
                        <td class="p-2 border border-slate-300 font-bold text-slate-800">${i === 0 ? item.drug.drugName : ''}</td>
                        <td class="p-2 border border-slate-300 font-mono text-slate-500">Lot: ${lot.lotNumber}</td>
                        <td class="p-2 border border-slate-300 text-center text-emerald-700 font-medium">${checkTimeStr}</td>
                        <td class="p-2 border border-slate-300 font-semibold"><i class="fa-solid fa-user-check text-emerald-600 mr-1 text-[10px]"></i>${lot.inspector || '-'}</td>
                        <td class="p-2 border border-slate-300 text-center text-emerald-600 font-bold">✔️ ตรวจสอบแล้ว</td>
                    </tr>
                `;
            });
        });
    }

    // 2. 📌 ยาตัวที่ไม่มีการตรวจสอบ ย้ายตำแหน่งมาจัดเก็บไว้ส่วนล่างสุดตามโจทย์สั่งการ
    if(uncheckedList.length > 0) {
        uncheckedList.forEach(item => {
            html += `
                <tr class="bg-red-50/40">
                    <td class="p-2 border border-slate-300 font-mono text-red-700">${item.drug.barcodeId}</td>
                    <td class="p-2 border border-slate-300 font-bold text-slate-400">${item.drug.drugName}</td>
                    <td colspan="3" class="p-2 border border-slate-300 text-center text-[#ff8b94] font-medium italic"><i class="fa-solid fa-circle-exclamation mr-1"></i> ยังไม่มีแถวบันทึกประวัติการตรวจสอบเดินสแกนยาประจำเดือนนี้</td>
                    <td class="p-2 border border-slate-300 text-center text-red-500 font-bold">✕ ค้างตรวจ</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    box.innerHTML = html;
}

// เปิดกล่อง Modal ควบคุมข้อมูลล็อตวันหมดอายุย่อย
function openLotModal(barcodeId) {
    APP_STATE.selectedBarcode = barcodeId;
    const drug = APP_STATE.master.find(d => d.barcodeId === barcodeId);
    if (!drug) return;

    document.getElementById("modal-title").innerText = `📦 จัดการล็อตยา: ${drug.drugName}`;
    document.getElementById("modal-subtitle").innerText = `รหัส Barcode: ${drug.barcodeId} | หน่วยนับ: ${drug.unit} | สเปกคลังตึก: ${drug.stock}`;
    
    // รีเซ็ตล้างฟอร์มกรอกล็อตก่อนหน้า
    document.getElementById("lot-number").value = "";
    document.getElementById("lot-exp").value = "";
    document.getElementById("lot-qty").value = "";
    document.getElementById("lot-storage").value = drug.storage || "";
    document.getElementById("lot-note").value = "";

    renderModalLotsList();
    document.getElementById("modal-lot-management").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal-lot-management").classList.add("hidden");
    APP_STATE.selectedBarcode = null;
}

// โหลดรายการข้อมูลล็อตย่อยใส่การ์ดใน Modal Window
function renderModalLotsList() {
    const listDiv = document.getElementById("modal-lots-list");
    if (!listDiv) return;
    listDiv.innerHTML = "";

    const filteredLots = APP_STATE.lots.filter(l => l.barcodeId === APP_STATE.selectedBarcode);

    if (filteredLots.length === 0) {
        listDiv.innerHTML = `<p class="text-center text-slate-400 italic py-4">ยังไม่มีรายละเอียดล็อตย่อย บันทึกเป็นชิ้นแรกโดยใช้ฟอร์มด้านบนได้เลยครับ</p>`;
        return;
    }

    filteredLots.forEach(lot => {
        const div = document.createElement("div");
        div.className = "p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex justify-between items-center";
        const expStr = lot.expDate ? new Date(lot.expDate).toLocaleDateString('th-TH') : '-';
        
        div.innerHTML = `
            <div>
                <p class="font-bold text-slate-800">Lot: ${lot.lotNumber}</p>
                <p class="text-[10px] text-slate-400">EXP: ${expStr} | จำนวนคงคลัง: <b class="text-slate-700">${lot.qty}</b></p>
                ${lot.note ? `<p class="text-[9px] text-amber-600 font-medium">หมายเหตุ: ${lot.note}</p>` : ''}
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold ${lot.isInspected ? 'text-emerald-600 bg-emerald-50':'text-amber-600 bg-amber-50'} px-2 py-0.5 rounded-md">
                    ${lot.isInspected ? '✓ เช็คแล้ว' : '🕒 รอตรวจ'}
                </span>
                <button onclick="deleteLotItem('${lot.lotNumber}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="ลบล็อตนี้"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        listDiv.appendChild(div);
    });
}

// กดบันทึกข้อมูลฟอร์มล็อตย่อย
async function submitLotForm() {
    const lotNo = document.getElementById("lot-number").value.trim();
    const exp = document.getElementById("lot-exp").value;
    const qty = document.getElementById("lot-qty").value.trim();
    const storage = document.getElementById("lot-storage").value.trim();
    const note = document.getElementById("lot-note").value.trim();

    if (!lotNo || !qty) {
        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกระบุเลข Lot ยาและจำนวนคงเหลือปัจจุบันด้วยครับ' });
        return;
    }

    const lotData = {
        barcodeId: APP_STATE.selectedBarcode,
        lotNumber: lotNo,
        expDate: exp,
        qty: Number(qty),
        storage: storage,
        note: note,
        isInspected: true, // ตั้งเป็นเช็คแล้วเมื่อมีการบันทึกข้อมูลสดใหม่
        inspector: APP_STATE.user,
        inspectionTime: new Date().toISOString()
    };

    showLoading("กำลังส่งข้อมูลอัปเดตล็อตย่อยลงสู่ระบบคลังแผ่นงาน...");
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "saveLot", data: lotData })
        });
        const res = await response.json();
        Swal.close();

        if (res.success) {
            await refreshDataState();
            renderModalLotsList();
            renderInspectSection();
            
            document.getElementById("lot-number").value = "";
            document.getElementById("lot-exp").value = "";
            document.getElementById("lot-qty").value = "";
            document.getElementById("lot-note").value = "";
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'บันทึกล็อตล้มเหลว: ' + e.toString() });
    }
}

// คำสั่งลบตารางล็อตย่อยชิ้นใดชิ้นหนึ่งออก
async function deleteLotItem(lotNumber) {
    const confirm = await Swal.fire({
        title: 'ยืนยันการลบล็อตย่อย?',
        text: `คุณต้องการนำเลข Lot [ ${lotNumber} ] ออกจากฐานข้อมูลระบบใช่หรือไม่`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8b94',
        cancelButtonColor: '#cbd5e0',
        confirmButtonText: 'ลบข้อมูล'
    });

    if (!confirm.isConfirmed) return;

    showLoading("กำลังทำลายลบข้อมูลล็อตย่อยหลัก...");
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "deleteLot", barcodeId: APP_STATE.selectedBarcode, lotNumber: lotNumber })
        });
        const res = await response.json();
        Swal.close();

        if (res.success) {
            await refreshDataState();
            renderModalLotsList();
            renderInspectSection();
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'ไม่สามารถติดต่อหลังบ้านลบค่าได้: ' + err.toString() });
    }
}

// กดยืนยันการตรวจสอบครบถ้วนทุกล็อตของยาตัวนั้นๆ (ปุ่มเขียวมุมขวาล่าง Modal)
async function submitFinalVerify() {
    showLoading("กำลังส่งคำสั่งยืนยันความถูกต้องภาพรวมทุกล็อตของยานี้...");
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "confirmInspection", barcodeId: APP_STATE.selectedBarcode, inspector: APP_STATE.user })
        });
        const res = await response.json();
        Swal.close();

        if (res.success) {
            await refreshDataState();
            renderInspectSection();
            closeModal();
            Swal.fire({ icon: 'success', title: 'ยืนยันเสร็จสิ้น', text: 'ระบบลงชื่อบันทึกการเช็ครายการยารองรับประจำเดือนเรียบร้อย', timer: 1200, showConfirmButton: false });
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'ส่งผลการยืนยันคลาดเคลื่อน: ' + e.toString() });
    }
}

// ฟังก์ชั่นช่วยดึงรีเฟรชอัปเดตสเตตฐานข้อมูลระหว่างการทำงานของปุ่ม
async function refreshDataState() {
    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "fetchAllData" }) });
        const res = await response.json();
        if (res.success) {
            APP_STATE.master = res.master || [];
            APP_STATE.lots = res.lots || [];
        }
    } catch (e) {
        console.error("รีเฟรชฐานข้อมูลข้อมูลฝั่ง Client ล้มเหลว", e);
    }
}

// สั่งพริ้นต์เอกสารเฉพาะกล่อง ID ผูกเป้าหมาย
function printDiv(divId) {
    window.print();
}

// ฟังก์ชันเปิดใช้งานระบบกล้องวงจรปิด/กล้องหน้าเว็บสแกนบาร์โค้ดคิวอาร์โค้ด
function startScanner() {
    Swal.fire({
        title: 'ฟีเจอร์สแกนกล้องบาร์โค้ด',
        text: 'ระบบโมดูลตัวสแกนกำลังเปิดใช้งานสิทธิ์เรียกดูผ่านเบราว์เซอร์กล้องมือถือ/เว็บแคมคอมพิวเตอร์',
        icon: 'info'
    });
}

// ออกจากระบบ
function handleLogout() {
    Swal.fire({
        title: 'ออกจากระบบคลังยา?',
        text: "คุณต้องการยกเลิกเซสชันและล็อกเอาท์ออกจากระบบ CATH LAB หรือไม่",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7bc4c4',
        cancelButtonColor: '#ff8b94',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'อยู่ต่อในระบบ'
    }).then((result) => {
        if (result.isConfirmed) {
            location.reload();
        }
    });
}
