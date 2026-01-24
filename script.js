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
const statusEl = document.getElementById('data-status'); // Make sure you added this to index.html

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
                
                // Populate Search
                uniqueCourses.clear();
                routineData.forEach(item => {
                    if (item.Course) uniqueCourses.add(item.Course);
                });

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

function generateRoutines() {
    // UI Loading State
    placeholderTextEl.classList.add('hidden');
    linksContainerEl.innerHTML = '';
    loadingIndicatorEl.classList.remove('hidden');
    generateBtnEl.disabled = true;

    setTimeout(() => {
        const semesterText = semesterSelectEl.options[semesterSelectEl.selectedIndex].text;
        const department = departmentSelectEl.value;

        // Group selected courses
        const specificSelections = []; 
        const generalSelections = [];  

        selectedCourses.forEach(course => {
            if (course.includes('.')) {
                specificSelections.push(course);
            } else {
                generalSelections.push(course);
            }
        });

        // 1. Generate combined PDF for specific selections
        if (specificSelections.length > 0) {
            const sections = new Set(specificSelections.map(c => c.split('.')[1]));
            const sectionIdentifier = sections.size === 1 ? sections.values().next().value : "Custom";
            
            const routineDataSubset = routineData.filter(item => specificSelections.includes(item.Course));
            createAndDisplayPdf(routineDataSubset, semesterText, department, sectionIdentifier);
        }

        // 2. Handle generic selections
        generalSelections.forEach(baseCourse => {
            const matchingItems = routineData.filter(item => item.Course.startsWith(baseCourse + '.'));
            const uniqueSections = [...new Set(matchingItems.map(item => item.Course.split('.')[1]))];

            uniqueSections.forEach(section => {
                const specificCourseName = `${baseCourse}.${section}`;
                const sectionData = routineData.filter(item => item.Course === specificCourseName);
                createAndDisplayPdf(sectionData, semesterText, department, section);
            });
        });

        if (!linksContainerEl.hasChildNodes()) {
            linksContainerEl.innerHTML = '<p class="text-red-400 text-center">No matching classes found in data.</p>';
        }

        loadingIndicatorEl.classList.add('hidden');
        generateBtnEl.disabled = false;
    }, 500); 
}

// --- 7. PDF GENERATION LOGIC (PASTE YOUR LATEST VERSION HERE) ---

function createAndDisplayPdf(data, semester, department, sectionIdentifier) {
    if (data.length === 0) return;

    // --- FIX: SORTING LOGIC UPDATE ---
    const daysOrder = { 'Saturday': 1, 'Sunday': 2, 'Monday': 3, 'Tuesday': 4, 'Wednesday': 5, 'Thursday': 6, 'Friday': 7 };
    
    data.sort((a, b) => {
        // 1. Sort by Day First
        const dayDiff = (daysOrder[a.Day] || 99) - (daysOrder[b.Day] || 99);
        if (dayDiff !== 0) return dayDiff;
        
        // 2. Sort by Time Chronologically (Using the new helper)
        return getStartTimeMinutes(a.Time) - getStartTimeMinutes(b.Time);
    });
    // ---------------------------------

    // 2. Prepare Table Body with Grouping
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
            row.Type            // Hidden Column
        ];
    });

    // 3. Extract Faculty
    const facultyList = new Map();
    data.forEach(item => {
        if (item.FacultyAcronym && item.FacultyFullName) {
            facultyList.set(item.FacultyAcronym, item.FacultyFullName);
        }
    });

    // --- PDF GENERATION ---
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const semesterNumber = semester.split(' ')[0];

    const now = new Date();
    const month = now.getMonth(); 
    let session = (month >= 0 && month <= 3) ? "Spring" : (month >= 4 && month <= 7) ? "Summer" : "Fall";
    const year = now.getFullYear();

    // Title Section
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

    // 4. Generate Table
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
            // Highlight LAB classes
            // Safety check: ensure raw row exists
            if (data.row && data.row.raw && data.row.raw[5]) {
                const rowType = data.row.raw[5]; 
                if (rowType === 'Lab' && data.section === 'body') {
                    data.cell.styles.fillColor = [243, 244, 246]; 
                }
            }
            // Clean borders for empty grouped days
            if (data.column.index === 0 && data.cell.raw === '') {
                data.cell.styles.valign = 'middle';
            }
        }
    });

    // 5. Professional 2-Column Faculty Footer
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

    // 6. Output
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

// Helper: Converts "1.30-3.00" or "1:30-3:00" to minutes (e.g., 810)
function getStartTimeMinutes(timeStr) {
    if (!timeStr) return 9999; // Put empty times at the end
    
    // 1. Get the start time (before the hyphen)
    let startPart = timeStr.split('-')[0].trim(); 
    
    // 2. Normalize separator (replace dot with colon)
    startPart = startPart.replace('.', ':');
    
    // 3. Parse Hours and Minutes
    let parts = startPart.split(':');
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1] || '0', 10);
    
    // 4. University Logic (12-hour format adjustment)
    // Classes usually run from 8:30 AM to 6:00 PM.
    // If hour is 1, 2, 3, 4, 5, 6, 7 -> Add 12 to make it PM.
    // If hour is 8, 9, 10, 11, 12 -> Leave it (AM or 12PM).
    if (hours < 8) {
        hours += 12;
    }
    
    return (hours * 60) + minutes;
}