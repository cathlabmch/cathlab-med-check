// =================================================================
// 1. ฟังก์ชัน Render หน้าจอ Dashboard (คงความสวยงามบน UI ไม่ใส่เส้นตารางบนหน้าจอ)
// =================================================================
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
                // เก็บค่าประเภทของยามาใช้งาน
                type: masterItem ? masterItem.type : "-"
            });
        }
    });

    filtered.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    // ตรวจสอบโครงสร้าง Element ตารางบนหน้าจอ Dashboard (ให้คงสไตล์คลีนแบบเดิม)
    const tableEl = tbody.closest("table");
    if (tableEl) {
        tableEl.removeAttribute("border");
        tableEl.style.borderCollapse = "";
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
            <td class="p-4 font-mono text-xs font-semibold">${item.barcodeId || ''}</td>
            <td class="p-4 font-bold text-xs sm:text-sm text-slate-700">${item.drugName || ''}</td>
            <td class="p-4 text-xs font-medium">${item.lotNumber || ''}</td>
            <td class="p-4 text-xs font-medium">${new Date(item.expDate).toLocaleDateString('th-TH')}</td>
            <td class="p-4 text-center">
                ${monthBadge}
            </td>
            <td class="p-4 text-center font-black text-sm text-slate-800">${item.qty || 0}</td>
            <td class="p-4 text-xs font-medium text-slate-500">${item.unit || ''}</td>
            <td class="p-4 text-xs font-medium text-slate-600">${item.storage || '-'}</td>
            <td class="p-4 text-xs italic text-slate-400 font-medium">${item.note || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}


// =================================================================
// 2. ฟังก์ชันหน้าพิมพ์รายงาน (แก้ไขให้ดึงข้อมูลยารวม และจัดรูปแบบตารางสำหรับพิมพ์)
// =================================================================
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

    // ส่วนหัวรายงาน (แสดงสวยงามบนจอ และจัดหน้าเมื่อพิมพ์)
    let headerHTML = `
        <div class="print-report-wrapper" style="padding: 20px; background: #fff;">
            <div class="text-center pb-5 mb-5" style="border-bottom: 2px solid #000000; text-align: center; margin-bottom: 20px; padding-bottom: 10px;">
                <h1 style="font-size: 20px; margin: 0 0 5px 0; color: #000; font-weight: bold; font-family: 'Sarabun', sans-serif;">${reportTitle}</h1>
                <p style="font-size: 13px; color: #333; margin: 5px 0 0 0;">ช่วงเวลาประเมินผลคลัง: ${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}</p>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #444; margin-top: 15px;">
                    <span><strong>ผู้พิมพ์รายงาน:</strong> ${APP_STATE.user || '-'}</span>
                    <span><strong>วันและเวลาพิมพ์:</strong> ${new Date().toLocaleString('th-TH')} น.</span>
                </div>
            </div>
            <button onclick="printReport()" class="no-print mb-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm" style="margin-bottom: 15px; padding: 10px 18px; background-color: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
                🖨️ สั่งพิมพ์รายงานทางการฉบับนี้
            </button>
    `;

    let tableHTML = "";

    // --- แบบที่ 1: รายงานข้อมูลยารวมและสรุปทุกล็อตคลังยา CATH LAB ---
    if(reportType === 'all') {
        tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
                <table border="1" style="width: 100%; border-collapse: collapse; min-width: 700px; font-size: 12px; font-family: 'Sarabun', Arial, sans-serif; border: 1.5px solid #000000;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">รหัสบาร์โค้ด</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000; width: 35%;">ชื่อสินค้า / ตัวยา</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">Lot Number</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">วันหมดอายุ (EXP)</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">จำนวนคงคลัง</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">หน่วย</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">สถานที่จัดเก็บ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let hasData = false;

        // ดึงข้อมูล Master และประกบกับล็อตย่อยแต่ละล็อตเพื่อแจงสิทธิ์ออกรายงาน
        APP_STATE.lots.forEach(lot => {
            const med = APP_STATE.master.find(m => m.barcodeId && lot.barcodeId && m.barcodeId.toString() === lot.barcodeId.toString());
            const expDate = lot.expDate ? new Date(lot.expDate) : null;
            
            // คัดกรองตัวยาให้อยู่ในกรอบเวลาประเมิน
            if(expDate && expDate >= start && expDate <= end) {
                hasData = true;
                tableHTML += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-family: monospace;">${lot.barcodeId || ''}</td>
                        <td style="padding: 8px; border: 1px solid #000000; font-weight: bold;">${med ? med.drugName : 'ไม่ทราบชื่อยา'}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${lot.lotNumber || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${expDate.toLocaleDateString('th-TH')}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-weight: bold;">${lot.qty || 0}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${med ? med.unit : '-'}</td>
                        <td style="padding: 8px; border: 1px solid #000000;">${lot.storage || '-'}</td>
                    </tr>
                `;
            }
        });
        
        if (!hasData) {
            tableHTML += `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #555; font-style: italic; border: 1px solid #000000;">ไม่พบข้อมูลล็อตยาในช่วงวันที่เลือก</td></tr>`;
        }
        tableHTML += "</tbody></table></div></div>";

    // --- แบบที่ 2: รายงานสถานะความครบถ้วนของการตรวจเช็คยาประจำเดือน (เงื่อนไขพิเศษจัดเรียงขวา) ---
    } else {
        tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
                <table border="1" style="width: 100%; border-collapse: collapse; min-width: 700px; font-size: 12px; font-family: 'Sarabun', Arial, sans-serif; border: 1.5px solid #000000;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">รหัสบาร์โค้ด</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000; width: 30%;">ชื่อสินค้า / ยาหลัก</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">Lot ยา</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">สถานะการตรวจ</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">วันที่เข้าตรวจสอบ</th>
                            <th style="padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #cbd5e1; color: #000;">ผู้รับผิดชอบตรวจสอบ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let inspectedList = [];
        let pendingList = [];

        // จำแนกกลุ่มชุดยาที่ผ่านตรวจสอบ และกลุ่มตกค้างค้างตรวจ
        APP_STATE.lots.forEach(lot => {
            const med = APP_STATE.master.find(m => m.barcodeId && lot.barcodeId && m.barcodeId.toString() === lot.barcodeId.toString());
            const dataObj = { lot, med };

            if (lot.isInspected) {
                inspectedList.push(dataObj);
            } else {
                pendingList.push(dataObj);
            }
        });

        // ดึงยาตรวจสอบครบแล้วมาเรียงลำดับเวลา (เก่าไปใหม่)
        inspectedList.sort((a, b) => new Date(a.lot.inspectionTime) - new Date(b.lot.inspectionTime));

        // ผสานอาเรย์รวมกันโดยให้พวกยังไม่ได้ตรวจสอบ (Pending) ไปอยู่ต่อท้ายล่างสุดของตาราง
        const finalDataset = [...inspectedList, ...pendingList];

        if (finalDataset.length === 0) {
            tableHTML += `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #555; font-style: italic; border: 1px solid #000000;">ไม่มีรายการข้อมูลยาหลักในฐานข้อมูลขณะนี้</td></tr>`;
        } else {
            finalDataset.forEach(item => {
                let insDateStr = "-";
                if(item.lot.inspectionTime) {
                    const d = new Date(item.lot.inspectionTime);
                    insDateStr = d.toLocaleDateString('th-TH') + " " + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + " น.";
                }

                tableHTML += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-family: monospace;">${item.lot.barcodeId || ''}</td>
                        <td style="padding: 8px; border: 1px solid #000000; font-weight: bold;">${item.med ? item.med.drugName : 'ไม่ทราบชื่อยา'}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.lot.lotNumber || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center; font-weight: bold; color: ${item.lot.isInspected ? '#16a34a' : '#dc2626'};">
                            ${item.lot.isInspected ? '✓ ตรวจสอบแล้ว' : '✕ ค้างตรวจสอบ'}
                        </td>
                        <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${insDateStr}</td>
                        <td style="padding: 8px; border: 1px solid #000000;">${item.lot.inspector || '-'}</td>
                    </tr>
                `;
            });
        }

        tableHTML += "</tbody></table></div></div>";
    }

    preview.innerHTML = headerHTML + tableHTML;
}

// =================================================================
// 3. ฟังก์ชันจัดหน้าพิมพ์เอกสาร (แก้ปัญหาเมนูและปุ่มควบคุมติดไปกับรายงาน)
// =================================================================
function printReport() {
    // อัปเดตข้อมูลผู้พิมพ์และรอบพิมพ์ปัจจุบันลงในพล็อตข้อมูลหน้ากระดาษ
    document.querySelectorAll(".print-by").forEach(el => el.innerText = APP_STATE.user || '-');
    document.querySelectorAll(".print-at").forEach(el => el.innerText = new Date().toLocaleString('th-TH') + ' น.');
    
    // สร้างสไตล์ CSS ปิดกั้นเฉพาะกิจ บังคับให้เบราว์เซอร์ซ่อนปุ่มและแผงเมนูด้านซ้ายออกไปเวลาพิมพ์ทันที
    const styleEl = document.createElement("style");
    styleEl.id = "dynamic-print-css";
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
                width: 100%;
                margin: 0;
                padding: 0;
            }
            .no-print {
                display: none !important;
                visibility: hidden !important;
            }
        }
    `;
    document.head.appendChild(styleEl);

    // สั่งพิมพ์
    window.print();

    // เคลียร์แท็กสไตล์ทิ้งหลังจากพิมพ์เสร็จ เพื่อให้หน้าจอเว็บกลับมาควบคุมทำรายการได้เหมือนเดิม
    setTimeout(() => {
        const targetStyle = document.getElementById("dynamic-print-css");
        if(targetStyle) targetStyle.remove();
    }, 1000);
}
