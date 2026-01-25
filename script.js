// --- 1. CONFIGURATION ---
const DB_URL = "https://edu-routine-generator-default-rtdb.asia-southeast1.firebasedatabase.app/current_routine.json";

// --- 2. DOM ELEMENTS ---
const courseSearchEl = document.getElementById('course-search');
const courseSuggestionsEl = document.getElementById('course-suggestions');
const selectedCoursesEl = document.getElementById('selected-courses');
const semesterSelectEl = document.getElementById('semester-select');
const departmentSelectEl = document.getElementById('department-select');
const generateBtnEl = document.getElementById('generate-btn');
const loadingIndicatorEl = document.getElementById('loading-indicator');
const placeholderTextEl = document.getElementById('placeholder-text');
const linksContainerEl = document.getElementById('links-container');
const statusEl = document.getElementById('data-status');

// --- 3. STATE VARIABLES ---
let routineData = []; 
let uniqueCourses = new Set();
let selectedCourses = new Set();

// --- 4. INITIALIZATION (FIREBASE LOGIC) ---
window.addEventListener('DOMContentLoaded', () => {
    // Show loading state
    if(statusEl) statusEl.innerHTML = `<span class="text-yellow-400 animate-pulse text-sm">Connecting to database...</span>`;
    
    // Fetch Data from Cloud
    fetch(DB_URL)
        .then(response => response.json())
        .then(result => {
            if (result && result.data) {
                // SUCCESS: Data Loaded
                routineData = result.data;
                
                // --- UPDATE: SYNTHESIZE ROOT COURSES ---
                uniqueCourses.clear();
                routineData.forEach(item => {
                    if (item.Course) {
                        // 1. Add the specific course (e.g., CSE 317.1)
                        uniqueCourses.add(item.Course);

                        // 2. If it has a section, add the "Root" course (e.g., CSE 317)
                        // This allows searching for the parent course
                        if (item.Course.includes('.')) {
                            const rootCourse = item.Course.split('.')[0];
                            uniqueCourses.add(rootCourse);
                        }
                    }
                });
                // ---------------------------------------

                // Update UI
                const dateStr = result.updatedAt ? new Date(result.updatedAt).toLocaleDateString() : 'Unknown';
                if(statusEl) statusEl.innerHTML = `<span class="text-green-400 text-sm">● Live Routine (Updated: ${dateStr})</span>`;
                
                courseSearchEl.disabled = false;
                courseSearchEl.placeholder = "Type course code (e.g. CSE 317)...";
            } else {
                // FAIL: No Data
                if(statusEl) statusEl.innerHTML = `<span class="text-red-400 text-sm">No routine uploaded yet. Contact CR.</span>`;
            }
        })
        .catch(err => {
            console.error(err);
            if(statusEl) statusEl.innerHTML = `<span class="text-red-500 text-sm">Connection Error. Check internet.</span>`;
        });
});

// --- 5. SEARCH & UI EVENT LISTENERS ---

courseSearchEl.addEventListener('input', () => {
    const query = courseSearchEl.value.trim().toUpperCase();
    if (query) {
        const suggestions = Array.from(uniqueCourses)
            .filter(course => course.toUpperCase().includes(query))
            // Sort: Specific courses first, then logic
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
            .slice(0, 10) 
            .map(course => `<div class="p-2 hover:bg-gray-700 cursor-pointer" data-course="${course}">${course}</div>`)
            .join('');
        
        courseSuggestionsEl.innerHTML = suggestions;
        courseSuggestionsEl.style.display = suggestions ? 'block' : 'none';
    } else {
        courseSuggestionsEl.style.display = 'none';
    }
});

courseSuggestionsEl.addEventListener('click', (event) => {
    const courseElement = event.target.closest('[data-course]');
    if (courseElement) {
        const course = courseElement.getAttribute('data-course');
        if (course && !selectedCourses.has(course)) {
            selectedCourses.add(course);
            renderSelectedCourses();
        }
        courseSearchEl.value = '';
        courseSuggestionsEl.style.display = 'none';
        checkInputs();
    }
});

semesterSelectEl.addEventListener('change', checkInputs);
departmentSelectEl.addEventListener('change', checkInputs);
generateBtnEl.addEventListener('click', generateRoutines);

// --- 6. HELPER FUNCTIONS ---

function renderSelectedCourses() {
    selectedCoursesEl.innerHTML = Array.from(selectedCourses)
        .map(course => `
            <div class="course-chip">
                ${course}
                <button data-course="${course}" onclick="removeCourse('${course}')">&times;</button>
            </div>`)
        .join('');
}

window.removeCourse = function(course) {
    selectedCourses.delete(course);
    renderSelectedCourses();
    checkInputs();
};

function checkInputs() {
    const coursesReady = selectedCourses.size > 0;
    const semesterReady = semesterSelectEl.value !== 'Choose a semester';
    const departmentReady = departmentSelectEl.value !== 'Choose a department';

    if (coursesReady && semesterReady && departmentReady) {
        generateBtnEl.disabled = false;
    } else {
        generateBtnEl.disabled = true;
    }
}

// --- MAIN GENERATION LOGIC ---
// --- MAIN GENERATION LOGIC (GROUP BY SECTION) ---
// --- MAIN GENERATION LOGIC (HYBRID: CUSTOM + BATCH) ---
// --- MAIN GENERATION LOGIC (SMART NAMING) ---
// --- MAIN GENERATION LOGIC (SMART SORTING & GROUPING) ---
// --- MAIN GENERATION LOGIC (SMART HEADERS) ---
// --- MAIN GENERATION LOGIC (AUTO-MERGE & SMART HEADERS) ---
function generateRoutines() {
    // UI Loading State
    placeholderTextEl.classList.add('hidden');
    linksContainerEl.innerHTML = '';
    loadingIndicatorEl.classList.remove('hidden');
    generateBtnEl.disabled = true;

    setTimeout(() => {
        const semesterText = semesterSelectEl.options[semesterSelectEl.selectedIndex].text;
        const department = departmentSelectEl.value;

        // 1. Gather Data into Buckets
        const sectionMap = new Map();   // Key: "1", "2" -> Value: [Rows]
        let customRoutineData = [];     // Mixed/Specific selections

        selectedCourses.forEach(courseStr => {
            // CHECK: Exact Match (Specific Section or EEE 407)
            const exactMatches = routineData.filter(r => r.Course === courseStr);

            if (exactMatches.length > 0) {
                customRoutineData = customRoutineData.concat(exactMatches);
            } 
            else {
                // Root Course (CSE 459) -> Add children to Section Buckets
                const childRows = routineData.filter(r => r.Course.startsWith(courseStr + '.'));
                
                childRows.forEach(row => {
                    const section = row.Course.split('.')[1];
                    if (!sectionMap.has(section)) {
                        sectionMap.set(section, []);
                    }
                    sectionMap.get(section).push(row);
                });
            }
        });

        // --- NEW: AUTO-MERGE LOGIC ---
        // If the 'Custom' data actually belongs to a single section (e.g. all Section 3),
        // move it into the main sectionMap so it merges with the Batch data.
        if (customRoutineData.length > 0) {
            const uniqueCustomRows = [...new Set(customRoutineData)];
            const sectionsFound = new Set();
            
            uniqueCustomRows.forEach(row => {
                if (row.Course.includes('.')) {
                    sectionsFound.add(row.Course.split('.')[1]);
                }
            });

            // If ALL specific selections belong to ONE section (e.g. "3")
            if (sectionsFound.size === 1) {
                const targetSection = sectionsFound.values().next().value;
                
                // Merge into existing bucket or create new one
                if (!sectionMap.has(targetSection)) {
                    sectionMap.set(targetSection, []);
                }
                sectionMap.get(targetSection).push(...uniqueCustomRows);
                
                // Clear custom bucket so it doesn't render twice
                customRoutineData = [];
            }
        }
        // -----------------------------

        // 2. Prepare Render List
        let routinesToRender = [];

        // A. Process Custom Routine (Only if it wasn't merged above)
        if (customRoutineData.length > 0) {
            const uniqueRows = [...new Set(customRoutineData)];
            routinesToRender.push({
                id: "Custom",
                data: uniqueRows,
                count: new Set(uniqueRows.map(r => r.Course)).size,
                type: 'Custom'
            });
        }

        // B. Process Section Routines
        sectionMap.forEach((rows, sectionID) => {
            const uniqueRows = [...new Set(rows)];
            routinesToRender.push({
                id: sectionID,
                data: uniqueRows,
                count: new Set(uniqueRows.map(r => r.Course)).size,
                type: 'Section'
            });
        });

        // 3. Sorting & Grouping
        if (routinesToRender.length > 0) {
            const maxCourseCount = Math.max(...routinesToRender.map(r => r.count));
            const threshold = maxCourseCount > 1 ? (maxCourseCount - 1) : 1;
            
            const primaryRoutines = routinesToRender.filter(r => r.count >= threshold);
            const secondaryRoutines = routinesToRender.filter(r => r.count < threshold);

            // Sort
            primaryRoutines.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            secondaryRoutines.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, undefined, { numeric: true }));

            // Headers Logic
            const isBatchGen = sectionMap.size > 0; // Merged data counts as batch now
            const hasSplit = secondaryRoutines.length > 0;
            const showHeaders = isBatchGen && hasSplit;

            // 4. Render
            if (primaryRoutines.length > 0) {
                if (showHeaders) {
                    const mainHeader = document.createElement('div');
                    mainHeader.className = "w-full text-green-400 text-xs uppercase font-bold tracking-wider mb-2 text-center";
                    mainHeader.innerText = "Main Sections";
                    linksContainerEl.appendChild(mainHeader);
                }
                primaryRoutines.forEach(r => {
                    createAndDisplayPdf(r.data, semesterText, department, r.id);
                });
            }

            if (secondaryRoutines.length > 0) {
                if (showHeaders) {
                    const separator = document.createElement('div');
                    separator.className = "w-full text-gray-400 text-xs uppercase font-bold tracking-wider mt-6 mb-2 text-center border-t border-gray-700 pt-4";
                    separator.innerText = "Partial / Extra Lab Sections";
                    linksContainerEl.appendChild(separator);
                }
                secondaryRoutines.forEach(r => {
                    createAndDisplayPdf(r.data, semesterText, department, r.id);
                });
            }

        } else {
            linksContainerEl.innerHTML = '<p class="text-red-400 text-center">No matching classes found in data.</p>';
        }

        loadingIndicatorEl.classList.add('hidden');
        generateBtnEl.disabled = false;
    }, 500); 
}
// --- 7. PDF GENERATION LOGIC ---

function createAndDisplayPdf(data, semester, department, sectionIdentifier) {
    if (data.length === 0) return;

    const daysOrder = { 'Saturday': 1, 'Sunday': 2, 'Monday': 3, 'Tuesday': 4, 'Wednesday': 5, 'Thursday': 6, 'Friday': 7 };
    
    data.sort((a, b) => {
        const dayDiff = (daysOrder[a.Day] || 99) - (daysOrder[b.Day] || 99);
        if (dayDiff !== 0) return dayDiff;
        return getStartTimeMinutes(a.Time) - getStartTimeMinutes(b.Time);
    });

    let lastDay = null;
    const tableBody = data.map(row => {
        const displayDay = row.Day === lastDay ? '' : row.Day;
        if (row.Day !== lastDay) lastDay = row.Day;

        return [
            displayDay,         
            row.Time,           
            row.Room,           
            row.FacultyAcronym, 
            row.Course,         
            row.Type            
        ];
    });

    const facultyList = new Map();
    data.forEach(item => {
        if (item.FacultyAcronym && item.FacultyFullName) {
            facultyList.set(item.FacultyAcronym, item.FacultyFullName);
        }
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const semesterNumber = semester.split(' ')[0];

    const now = new Date();
    const month = now.getMonth(); 
    let session = (month >= 0 && month <= 3) ? "Spring" : (month >= 4 && month <= 7) ? "Summer" : "Fall";
    const year = now.getFullYear();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(55, 65, 81); 
    doc.text(`Department of ${department}`, 14, 22);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    const sectionText = sectionIdentifier === 'Custom' ? 'Custom Routine' : `Section ${sectionIdentifier}`;
    doc.text(`Semester - ${semesterNumber}, ${sectionText}`, 14, 30);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); 
    doc.text(`Class Routine - ${session} ${year}`, 14, 38);

    doc.autoTable({
        head: [['DAY', 'TIME', 'ROOM', 'FACULTY', 'SUBJECT']],
        body: tableBody,
        startY: 45, 
        theme: 'grid', 
        headStyles: { 
            fillColor: [79, 70, 229], 
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center' 
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 28, halign: 'left', valign: 'middle' }, 
            1: { halign: 'left', cellWidth: 35, valign: 'middle' },
            2: { halign: 'left', cellWidth: 22, valign: 'middle' }, 
            3: { halign: 'left', cellWidth: 28, valign: 'middle' }, 
            4: { halign: 'left', valign: 'middle' } 
        },
        didParseCell: function (data) {
            if (data.row && data.row.raw && data.row.raw[5]) {
                const rowType = data.row.raw[5]; 
                if (rowType === 'Lab' && data.section === 'body') {
                    data.cell.styles.fillColor = [243, 244, 246]; 
                }
            }
            if (data.column.index === 0 && data.cell.raw === '') {
                data.cell.styles.valign = 'middle';
            }
        }
    });

    let finalY = doc.lastAutoTable.finalY || 100;
    
    if (facultyList.size > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 65, 81);
        doc.text('Faculty Members', 14, finalY + 15);
        
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal");
        
        let facultyArray = Array.from(facultyList.entries());
        let col1X = 14;
        let col2X = 105; 
        let currentY = finalY + 22;
        const rowHeight = 7; 
        
        for (let i = 0; i < facultyArray.length; i++) {
            const [acronym, fullName] = facultyArray[i];
            const text = `${acronym} : ${fullName}`;
            
            if (i % 2 === 0) {
                doc.text(text, col1X, currentY);
            } else {
                doc.text(text, col2X, currentY);
                currentY += rowHeight; 
            }

            if (currentY > 280) { 
                doc.addPage(); 
                currentY = 20; 
            }
        }
    }

    const pdfBlob = doc.output('blob');
    const fileName = sectionIdentifier === 'Custom' ? 'Custom_Routine.pdf' : `Routine_Sec_${sectionIdentifier}.pdf`;
    const url = URL.createObjectURL(pdfBlob);

    const linkEl = document.createElement('a');
    linkEl.href = url;
    linkEl.download = fileName;
    linkEl.className = 'download-link block bg-gray-700 p-3 rounded-lg hover:bg-indigo-500 text-white no-underline';
    linkEl.innerHTML = `
        <div class="flex justify-between items-center">
            <span>${fileName}</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
        </div>`;
    
    linksContainerEl.appendChild(linkEl);
}

function getStartTimeMinutes(timeStr) {
    if (!timeStr) return 9999; 
    let startPart = timeStr.split('-')[0].trim(); 
    startPart = startPart.replace('.', ':');
    let parts = startPart.split(':');
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1] || '0', 10);
    if (hours < 8) {
        hours += 12;
    }
    return (hours * 60) + minutes;
}