// =============================================
// EDU ROUTINE GENERATOR — Main Script
// =============================================

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

// --- NAVBAR SCROLL + MOBILE MENU ---
const navbar = document.getElementById('navbar');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navbarLinks = document.getElementById('navbar-links');

if (mobileMenuBtn && navbarLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        navbarLinks.classList.toggle('open');
    });
}

window.addEventListener('scroll', () => {
    if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
    }
});

// --- CUSTOM SELECT DROPDOWNS ---
class CustomSelect {
    constructor(selectEl) {
        this.selectEl = selectEl;
        this.wrapper = selectEl.closest('.custom-select-wrapper');
        if (!this.wrapper) return;

        this.isOpen = false;
        this.focusedIndex = -1;
        this.options = [];

        this.buildUI();
        this.bindEvents();
    }

    buildUI() {
        // Create trigger button
        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-select-trigger';
        this.trigger.setAttribute('tabindex', '0');
        this.trigger.setAttribute('role', 'combobox');
        this.trigger.setAttribute('aria-haspopup', 'listbox');
        this.trigger.setAttribute('aria-expanded', 'false');

        // Set placeholder text from the disabled option
        const placeholder = this.selectEl.querySelector('option[disabled]');
        this.trigger.textContent = placeholder ? placeholder.textContent : 'Select...';

        // Create dropdown panel
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';
        this.dropdown.setAttribute('role', 'listbox');

        // Populate options (skip disabled placeholder)
        const nativeOptions = this.selectEl.querySelectorAll('option:not([disabled])');
        nativeOptions.forEach((opt, i) => {
            const item = document.createElement('div');
            item.className = 'custom-select-option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-value', opt.value);
            item.textContent = opt.textContent;
            this.dropdown.appendChild(item);
            this.options.push(item);
        });

        this.wrapper.appendChild(this.trigger);
        this.wrapper.appendChild(this.dropdown);
    }

    bindEvents() {
        // Toggle on click
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen ? this.close() : this.open();
        });

        // Option click
        this.dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.custom-select-option');
            if (option) {
                this.selectOption(option);
            }
        });

        // Keyboard nav
        this.trigger.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.isOpen ? this.close() : this.open();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (!this.isOpen) this.open();
                    this.moveFocus(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (!this.isOpen) this.open();
                    this.moveFocus(-1);
                    break;
                case 'Escape':
                    this.close();
                    break;
            }
        });

        this.dropdown.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.focusedIndex >= 0) {
                e.preventDefault();
                this.selectOption(this.options[this.focusedIndex]);
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.wrapper.contains(e.target)) {
                this.close();
            }
        });
    }

    open() {
        this.isOpen = true;
        this.trigger.classList.add('open');
        this.dropdown.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        // Scroll selected item into view
        const selected = this.dropdown.querySelector('.selected');
        if (selected) {
            setTimeout(() => selected.scrollIntoView({ block: 'nearest' }), 50);
        }
    }

    close() {
        this.isOpen = false;
        this.trigger.classList.remove('open');
        this.dropdown.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.focusedIndex = -1;
        this.options.forEach(o => o.classList.remove('focused'));
    }

    moveFocus(dir) {
        this.options.forEach(o => o.classList.remove('focused'));
        this.focusedIndex += dir;
        if (this.focusedIndex < 0) this.focusedIndex = this.options.length - 1;
        if (this.focusedIndex >= this.options.length) this.focusedIndex = 0;
        this.options[this.focusedIndex].classList.add('focused');
        this.options[this.focusedIndex].scrollIntoView({ block: 'nearest' });
    }

    selectOption(optionEl) {
        const value = optionEl.getAttribute('data-value');
        const text = optionEl.textContent;

        // Update trigger text
        this.trigger.textContent = text;
        this.trigger.classList.add('has-value');

        // Update selected class
        this.options.forEach(o => o.classList.remove('selected'));
        optionEl.classList.add('selected');

        // Sync to native select
        this.selectEl.value = value;
        this.selectEl.dispatchEvent(new Event('change', { bubbles: true }));

        this.close();
        this.trigger.focus();
    }
}

// Initialize custom selects
document.querySelectorAll('.custom-select-wrapper .form-select').forEach(sel => {
    new CustomSelect(sel);
});

// --- 4. INITIALIZATION (FIREBASE LOGIC) ---
window.addEventListener('DOMContentLoaded', () => {
    // Show loading state
    if (statusEl) {
        statusEl.className = 'status-badge loading';
        statusEl.innerHTML = `<span class="status-dot"></span><span>Connecting to database...</span>`;
    }
    
    // Fetch Data from Cloud
    fetch(DB_URL)
        .then(response => response.json())
        .then(result => {
            if (result && result.data) {
                // SUCCESS: Data Loaded
                routineData = result.data;
                
                // Read Ramadan status from DB
                const isRamadanActive = result.isRamadan === true;
                window.CURRENT_MODE_RAMADAN = isRamadanActive;

                // Synthesize root courses
                uniqueCourses.clear();
                routineData.forEach(item => {
                    if (item.Course) {
                        uniqueCourses.add(item.Course);
                        if (item.Course.includes('.')) {
                            const rootCourse = item.Course.split('.')[0];
                            uniqueCourses.add(rootCourse);
                        }
                    }
                });

                // Update status
                const dateStr = result.updatedAt ? new Date(result.updatedAt).toLocaleDateString() : 'Unknown';
                
                if (isRamadanActive) {
                    if (statusEl) {
                        statusEl.className = 'status-badge ramadan';
                        statusEl.innerHTML = `<span class="status-dot"></span><span>🌙 Ramadan Routine (Updated: ${dateStr})</span>`;
                    }
                } else {
                    if (statusEl) {
                        statusEl.className = 'status-badge live';
                        statusEl.innerHTML = `<span class="status-dot"></span><span>Live Routine (Updated: ${dateStr})</span>`;
                    }
                }
                
                courseSearchEl.disabled = false;
                courseSearchEl.placeholder = "Type course code (e.g. CSE 317)...";
            } else {
                if (statusEl) {
                    statusEl.className = 'status-badge error';
                    statusEl.innerHTML = `<span class="status-dot"></span><span>No routine uploaded yet. Contact CR.</span>`;
                }
            }
        })
        .catch(err => {
            console.error(err);
            if (statusEl) {
                statusEl.className = 'status-badge error';
                statusEl.innerHTML = `<span class="status-dot"></span><span>Connection Error. Check internet.</span>`;
            }
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
            .map(course => {
                const highlighted = course.replace(
                    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                    '<span class="match-highlight">$1</span>'
                );
                return `<div data-course="${course}">${highlighted}</div>`;
            })
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

    generateBtnEl.disabled = !(coursesReady && semesterReady && departmentReady);
}

// --- MAIN GENERATION LOGIC ---
function generateRoutines() {
    placeholderTextEl.classList.add('hidden');
    linksContainerEl.innerHTML = '';
    loadingIndicatorEl.classList.remove('hidden');
    generateBtnEl.disabled = true;

    setTimeout(() => {
        const semesterText = semesterSelectEl.options[semesterSelectEl.selectedIndex].text;
        const department = departmentSelectEl.value;

        const sectionMap = new Map();   
        let customRoutineData = [];     

        selectedCourses.forEach(courseStr => {
            const exactMatches = routineData.filter(r => r.Course === courseStr);

            if (exactMatches.length > 0) {
                customRoutineData = customRoutineData.concat(exactMatches);
            } 
            else {
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

        // AUTO-MERGE LOGIC
        if (customRoutineData.length > 0) {
            const uniqueCustomRows = [...new Set(customRoutineData)];
            const sectionsFound = new Set();
            
            uniqueCustomRows.forEach(row => {
                if (row.Course.includes('.')) {
                    sectionsFound.add(row.Course.split('.')[1]);
                }
            });

            if (sectionsFound.size === 1) {
                const targetSection = sectionsFound.values().next().value;
                if (!sectionMap.has(targetSection)) {
                    sectionMap.set(targetSection, []);
                }
                sectionMap.get(targetSection).push(...uniqueCustomRows);
                customRoutineData = [];
            }
        }

        let routinesToRender = [];

        if (customRoutineData.length > 0) {
            const uniqueRows = [...new Set(customRoutineData)];
            routinesToRender.push({
                id: "Custom",
                data: uniqueRows,
                count: new Set(uniqueRows.map(r => r.Course)).size,
                type: 'Custom'
            });
        }

        sectionMap.forEach((rows, sectionID) => {
            const uniqueRows = [...new Set(rows)];
            routinesToRender.push({
                id: sectionID,
                data: uniqueRows,
                count: new Set(uniqueRows.map(r => r.Course)).size,
                type: 'Section'
            });
        });

        if (routinesToRender.length > 0) {
            const maxCourseCount = Math.max(...routinesToRender.map(r => r.count));
            const threshold = maxCourseCount > 1 ? (maxCourseCount - 1) : 1;
            
            const primaryRoutines = routinesToRender.filter(r => r.count >= threshold);
            const secondaryRoutines = routinesToRender.filter(r => r.count < threshold);

            primaryRoutines.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            secondaryRoutines.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, undefined, { numeric: true }));

            const isBatchGen = sectionMap.size > 0;
            const hasSplit = secondaryRoutines.length > 0;
            const showHeaders = isBatchGen && hasSplit;

            if (primaryRoutines.length > 0) {
                if (showHeaders) {
                    const mainHeader = document.createElement('div');
                    mainHeader.className = "section-header main";
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
                    separator.className = "section-header partial";
                    separator.innerText = "Partial / Extra Lab Sections";
                    linksContainerEl.appendChild(separator);
                }
                secondaryRoutines.forEach(r => {
                    createAndDisplayPdf(r.data, semesterText, department, r.id);
                });
            }

        } else {
            linksContainerEl.innerHTML = '<p style="color: var(--error); text-align: center; padding-top: 2rem; font-size: 0.875rem;">No matching classes found in data.</p>';
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
    
    const routineTitle = window.CURRENT_MODE_RAMADAN 
        ? `Ramadan Routine - ${session} ${year}` 
        : `Class Routine - ${session} ${year}`;
        
    doc.text(routineTitle, 14, 38);

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
    let fileName = 'Generated_Routine.pdf';
    if (sectionIdentifier !== 'Combined_View' && sectionIdentifier !== 'Custom') {
        fileName = `Routine_Sec_${sectionIdentifier}.pdf`;
    } else {
        fileName = `Combined_Routine.pdf`;
    }

    const url = URL.createObjectURL(pdfBlob);

    const linkEl = document.createElement('a');
    linkEl.href = url;
    linkEl.download = fileName;
    linkEl.className = 'download-link';
    linkEl.innerHTML = `
        <div class="link-inner">
            <span>📄 ${fileName}</span>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
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