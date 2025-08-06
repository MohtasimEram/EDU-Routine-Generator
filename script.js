// --- DOM ELEMENTS ---
const routineFileEl = document.getElementById('routine-file');
const courseSearchEl = document.getElementById('course-search');
const courseSuggestionsEl = document.getElementById('course-suggestions');
const selectedCoursesEl = document.getElementById('selected-courses');
const semesterSelectEl = document.getElementById('semester-select');
const departmentSelectEl = document.getElementById('department-select');
const generateBtnEl = document.getElementById('generate-btn');
const resultsContainerEl = document.getElementById('results-container');
const loadingIndicatorEl = document.getElementById('loading-indicator');
const placeholderTextEl = document.getElementById('placeholder-text');
const linksContainerEl = document.getElementById('links-container');

// --- STATE VARIABLES ---
let masterRoutine = [];
let availableCourses = new Set();
let selectedCourses = new Set();

const facultyMap = {
    'IAZ': 'Dr. Ishtiaque Aziz Zahed', 'Dr. MK': 'Dr. K.M. Mohibul Kabir',
    'GMD': 'Mr. Golam Moktader Daiyan', 'TA': 'Mr. Mohammad Toufiq Ahmed',
    'Dr. MSA': 'Dr. Md. Shahidul Alam', 'ASZ': 'Ms. Arifa Sultana Zarna',
    'Dr. MMR': 'Dr. Mohammad Mahbubur Rahman', 'NNR': 'Ms. Nahida Nigar',
    'SAF': 'Ms. Saraf Anika', 'SSA': 'Ms. Sayeda Suaiba Anwar', 'BB': 'Mr. S.M. Baque Billah',
    'TK': 'Ms. Tania Khadem', 'SHA': 'Ms. Sharmin Akter', 'MC': 'Mr. Mashky Chowdhury Surja',
    'KA': 'Mr. Kazi Muhammad Asif Ashrafi', 'AAA': 'Mr. Ahamed- Al- Arifin',
    'JM': 'Mr. Joydwip Mohajon', 'SAH': 'Mr. Md. Sabbir Al Ahsan', 'PRM': 'Ms. Parna Mutsuddy',
    'TAZ': 'Mr. Tanvir Azhar', 'NSC': 'Ms. Nishat Soultana Chy',
    'JHJ': 'Mr. Md. Jahidul Hasan Jahid', 'JUD': 'Mr. Md. Jamil Uddin',
    'TMD': 'Mr. Tahsin Mahmud', 'MRI': 'Mr. Md. Rakibul Islam', 'ARS': 'Ms. Arshiana Shamir',
    'SMI': 'Mr. Md. Siratul Mustakim Ifty', 'MRA': 'Mr. Mohammed Morshed Rana',
    'JIM': 'Mr. Md. Jibon Mia', 'SAZ': 'Ms. Shadika Afroze Ome', 'SAB': 'Mr. Saklain Abdullah',
    'ANB': 'Ms. Anika Bushra', 'SOA': 'Mr. Sourav Adhikary', 'SKD': 'Mr. Sanath Kumar Das',
    'SAK': 'Ms.Shahin Akter', 'MZC': 'Ms. Maliha Zahan Chowdhury',
    'TAS': 'Ms. Tahmina Akter Sumi', 'JNM': 'Ms. Tanjum Motin Mitul',
    'UDD': 'Mr. Udoy Das', 'RHN': 'Mr. Riad Hossain', 'MSR': 'Mr. Md. Sajeed-Ur-Rahman',
    'AKS': 'Mr. Mohammad Akbar Bin Shah', 'RSN': 'Rajarshi Sen', 'LAM': 'Lamiya Anjum', 'IM': 'Ishtiaque Mainuddin'
};

// --- EVENT LISTENERS ---
routineFileEl.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        generateBtnEl.disabled = true;
        generateBtnEl.textContent = 'Parsing CSV...';
        Papa.parse(file, {
            complete: (results) => {
                masterRoutine = results.data.filter(row => row.some(cell => cell.trim()));
                extractAvailableCourses();
                checkInputs();
            },
            error: (error) => {
                console.error('CSV parsing error:', error.message);
                alert(`Error parsing CSV: ${error.message}`);
                generateBtnEl.textContent = 'Generate Routine';
                generateBtnEl.disabled = true;
            }
        });
    }
});

courseSearchEl.addEventListener('input', () => {
    const query = courseSearchEl.value.trim().toUpperCase();
    if (query) {
        const suggestions = Array.from(availableCourses)
            .filter(course => course.toUpperCase().startsWith(query))
            .sort((a, b) => {
                const regex = /([A-Z]{2,4}\s*\d{3,4})\.?(\d+)?/;
                const matchA = a.match(regex);
                const matchB = b.match(regex);
                if (!matchA || !matchB) return a.localeCompare(b);
                const baseA = matchA[1];
                const baseB = matchB[1];
                if (baseA !== baseB) return baseA.localeCompare(baseB);
                const sectionA = parseInt(matchA[2] || '0', 10);
                const sectionB = parseInt(matchB[2] || '0', 10);
                return sectionA - sectionB;
            })
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

generateBtnEl.addEventListener('click', () => {
    if (masterRoutine.length === 0) {
        alert('Please upload the class routine CSV file.');
        return;
    }
    if (selectedCourses.size === 0) {
        alert('Please select at least one course.');
        return;
    }
     if (semesterSelectEl.value === 'Choose a semester') {
        alert('Please select a semester.');
        return;
    }
    if (departmentSelectEl.value === 'Choose a department') {
        alert('Please select a department.');
        return;
    }
    
    // --- Start Loading State ---
    placeholderTextEl.classList.add('hidden');
    linksContainerEl.innerHTML = '';
    loadingIndicatorEl.classList.remove('hidden');
    generateBtnEl.disabled = true;
    
    setTimeout(() => {
        const semesterText = semesterSelectEl.options[semesterSelectEl.selectedIndex].text;
        const department = departmentSelectEl.value;
        
        const specificSelections = [];
        const generalSelections = [];

        selectedCourses.forEach(course => {
            if (course.includes('.')) {
                specificSelections.push(course);
            } else {
                generalSelections.push(course);
            }
        });

        // Generate one combined routine for all specifically selected sections
        if (specificSelections.length > 0) {
            let sectionIdentifier = "Custom";
            const sections = new Set(specificSelections.map(course => course.split('.')[1]));
            if (sections.size === 1) {
                sectionIdentifier = sections.values().next().value;
            }
            generatePdfForSection(specificSelections, semesterText, department, sectionIdentifier);
        }

        // Generate a separate routine for each section of a generally selected course
        generalSelections.forEach(baseCourse => {
            const availableSections = findSectionsForCourse(baseCourse, department);
            if (availableSections.length > 0) {
                availableSections.forEach(section => {
                    generatePdfForSection([`${baseCourse}.${section}`], semesterText, department, section);
                });
            }
        });

        if (!linksContainerEl.hasChildNodes()) {
            linksContainerEl.innerHTML = '<p class="text-red-400 text-center">No matching classes found.</p>';
        }

        // --- End Loading State ---
        loadingIndicatorEl.classList.add('hidden');
        generateBtnEl.disabled = false;
    }, 50);
});

// --- HELPER FUNCTIONS ---
function extractAvailableCourses() {
    availableCourses.clear();
    const tempCourses = new Set();
    const courseSectionPattern = /[A-Z]{2,4}\s*\d{3,4}\.\d+/g;

    masterRoutine.forEach(row => {
        const rowText = row.join(',');
        const matches = rowText.match(courseSectionPattern);
        if (matches) {
            matches.forEach(match => tempCourses.add(match.trim()));
        }
    });
    
    tempCourses.forEach(courseWithSection => {
        availableCourses.add(courseWithSection);
        const baseCourse = courseWithSection.split('.')[0];
        availableCourses.add(baseCourse);
    });
}

function findSectionsForCourse(baseCourse, department) {
    const sections = new Set();
    const sharedCoursePrefixes = ['MATH', 'PHY', 'AA', 'ENG', 'CHEM'];

    masterRoutine.forEach(row => {
        row.forEach(cellContent => {
            if (!cellContent || !cellContent.startsWith(baseCourse)) return;
            const isEeeMarked = cellContent.toUpperCase().includes('(EEE)');
            const cellCoursePrefixMatch = baseCourse.match(/^([A-Z]{2,4})/);
            const cellCoursePrefix = cellCoursePrefixMatch ? cellCoursePrefixMatch[1] : '';
            if (department === 'CSE' && isEeeMarked) return;
            if (department === 'EEE' && sharedCoursePrefixes.includes(cellCoursePrefix) && !isEeeMarked) return;
            const match = cellContent.match(new RegExp(`^${baseCourse.replace(/\s/g, '\\s*')}\\.(\\d+)`));
            if (match) {
                sections.add(match[1]);
            }
        });
    });
    return Array.from(sections).sort((a,b) => a - b);
}

function renderSelectedCourses() {
    selectedCoursesEl.innerHTML = Array.from(selectedCourses)
        .map(course => `<div class="course-chip">${course}<button data-course="${course}" onclick="removeCourse('${course}')">&times;</button></div>`)
        .join('');
}

window.removeCourse = function(course) {
    selectedCourses.delete(course);
    renderSelectedCourses();
    checkInputs();
};

function checkInputs() {
    const csvReady = masterRoutine.length > 0;
    const coursesReady = selectedCourses.size > 0;
    const semesterReady = semesterSelectEl.value !== 'Choose a semester';
    const departmentReady = departmentSelectEl.value !== 'Choose a department';

    if (csvReady && coursesReady && semesterReady && departmentReady) {
        generateBtnEl.disabled = false;
        generateBtnEl.textContent = 'Generate Routine';
    } else {
        generateBtnEl.disabled = true;
        generateBtnEl.textContent = 'Generate Routine';
    }
}

function convertTimeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes('-')) return 0;
    const startTime = timeStr.split('-')[0].trim();
    let [hours, minutes] = startTime.split(':').map(Number);
    if (hours < 8) hours += 12;
    return hours * 60 + (minutes || 0);
}

// --- CORE LOGIC ---
function generatePdfForSection(courses, semester, department, sectionIdentifier) {
    const sectionRoutine = findSectionRoutine(courses, department);
    if (sectionRoutine.length > 0) {
        sectionRoutine.sort((a, b) => {
            const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            if (days.indexOf(a.day) !== days.indexOf(b.day)) return days.indexOf(a.day) - days.indexOf(b.day);
            return convertTimeToMinutes(a.time) - convertTimeToMinutes(b.time);
        });
        
        const uniqueFaculties = [...new Set(sectionRoutine.map(item => item.faculty).filter(f => f))];
        const pdfBlob = createPdf(sectionRoutine, semester, department, uniqueFaculties, sectionIdentifier);
        displayPdfLink(pdfBlob, sectionIdentifier);
    }
}

function findSectionRoutine(courses, department) {
    const routine = [];
    const courseSet = new Set(courses.map(c => c.replace(/\s/g, ''))); 
    const sharedCoursePrefixes = ['MATH', 'PHY', 'AA', 'ENG', 'CHEM'];
    
    let currentDay = '';
    let theoryTimeSlots = [];
    let labTimeSlots = [];
    let inLabSection = false;
    const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    masterRoutine.forEach((row, index) => {
        const firstCell = row[0] ? row[0].trim() : '';
        if (daysOfWeek.includes(firstCell)) {
            currentDay = firstCell;
            theoryTimeSlots = masterRoutine[index + 1] || [];
            labTimeSlots = [];
            inLabSection = false;
            return;
        }
        if (!currentDay) return;
        
        if (firstCell === '' && row[1] && row[1].includes(':')) {
            labTimeSlots = row;
            inLabSection = true;
            return;
        }
        
        if (firstCell) {
            const room = firstCell;
            const relevantTimeSlots = inLabSection ? labTimeSlots : theoryTimeSlots;

            for (let i = 1; i < row.length; i++) {
                const cellContent = row[i];
                if (cellContent) {
                    const isEeeMarked = cellContent.toUpperCase().includes('(EEE)');
                    const coursePrefixMatch = cellContent.match(/^([A-Z]{2,4})/);
                    const coursePrefix = coursePrefixMatch ? coursePrefixMatch[1] : '';

                    if (department === 'CSE' && isEeeMarked) continue; 
                    if (department === 'EEE' && sharedCoursePrefixes.includes(coursePrefix) && !isEeeMarked) continue;
                    
                    const subjectMatch = cellContent.match(/^([A-Z]{2,4}\s*\d{3,4}(?:\.\d+)?)/);
                    if (!subjectMatch) continue; 
                    
                    const subject = subjectMatch[1].trim();
                    if (!courseSet.has(subject.replace(/\s/g, ''))) continue;

                    let faculty = '';
                    const allParentheses = cellContent.match(/\(([^)]+)\)/g);
                    if (allParentheses) {
                        const facultyGroup = allParentheses.find(p => p.toUpperCase() !== '(EEE)');
                        if (facultyGroup) {
                            faculty = facultyGroup.slice(1, -1);
                        }
                    }
                    
                    routine.push({
                        day: currentDay,
                        time: relevantTimeSlots[i] || 'N/A',
                        room: room,
                        faculty: faculty,
                        subject: subject
                    });
                }
            }
        }
    });
    return routine;
}

function createPdf(sectionRoutine, semester, department, uniqueFaculties, section) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const semesterNumber = semester.split(' ')[0];

    doc.setFontSize(18);
    doc.text(`Department of ${department}`, 14, 22);
    doc.setFontSize(14);
    const sectionText = section === 'Custom' ? 'Custom Routine' : `Section ${section}`;
    doc.text(`Semester - ${semesterNumber}, ${sectionText}`, 14, 30);
    doc.setFontSize(12);
    doc.text(`Class Routine - Summer 2025`, 14, 38);
    
    doc.autoTable({
        head: [['DAY', 'TIME', 'ROOM', 'FACULTY', 'SUBJECT']],
        body: sectionRoutine.map(c => [c.day, c.time, c.room, c.faculty, c.subject]),
        startY: 45, theme: 'grid', headStyles: { fillColor: [76, 81, 191] }
    });

    let finalY = doc.lastAutoTable.finalY || 100;
    if (uniqueFaculties.length > 0) {
        doc.setFontSize(14);
        doc.text('Faculty Details', 14, finalY + 15);
        doc.setFontSize(10);
        let facultyY = finalY + 22;
        uniqueFaculties.forEach(initial => {
            const fullName = facultyMap[initial] || 'N/A';
            doc.text(`${initial}: ${fullName}`, 14, facultyY);
            facultyY += 6;
            if (facultyY > 280) { doc.addPage(); facultyY = 20; }
        });
    }
    return doc.output('blob');
}

function displayPdfLink(blob, section) {
    const fileName = section === 'Custom' ? 'Custom_Routine.pdf' : `Routine_Sec_${section}.pdf`;
    const url = URL.createObjectURL(blob);
    const linkEl = document.createElement('a');
    linkEl.href = url;
    linkEl.download = fileName;
    linkEl.className = 'download-link block bg-gray-700 p-3 rounded-lg hover:bg-indigo-500 text-white no-underline';
    linkEl.innerHTML = `<div class="flex justify-between items-center"><span>${fileName}</span><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></div>`;
    linkEl.addEventListener('click', () => { setTimeout(() => URL.revokeObjectURL(url), 100); });
    linksContainerEl.appendChild(linkEl);
}