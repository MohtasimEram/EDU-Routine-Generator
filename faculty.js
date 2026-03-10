// =============================================
// FACULTY SEARCH — Logic
// =============================================

const DB_URL = "https://edu-routine-generator-default-rtdb.asia-southeast1.firebasedatabase.app/current_routine.json";

// DOM Elements
const searchInput = document.getElementById('faculty-search-input');
const resultsContainer = document.getElementById('faculty-results');
const emptyState = document.getElementById('faculty-empty');
const statusEl = document.getElementById('faculty-status');

// Faculty data map: acronym → full name
let facultyMap = new Map();

// --- Navbar scroll + mobile menu (shared) ---
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

// --- Load Faculty Data ---
window.addEventListener('DOMContentLoaded', () => {
    fetch(DB_URL)
        .then(response => response.json())
        .then(result => {
            if (result && result.data) {
                // Extract unique faculty acronym → full name pairs
                result.data.forEach(item => {
                    if (item.FacultyAcronym && item.FacultyFullName) {
                        facultyMap.set(
                            item.FacultyAcronym.trim(),
                            item.FacultyFullName.trim()
                        );
                    }
                });

                const count = facultyMap.size;
                statusEl.className = 'status-badge live';
                statusEl.innerHTML = `
                    <span class="status-dot"></span>
                    <span>${count} faculty member${count !== 1 ? 's' : ''} loaded</span>
                `;

                searchInput.disabled = false;
                searchInput.focus();

                // Show all faculty by default
                renderAllFaculty();
            } else {
                statusEl.className = 'status-badge error';
                statusEl.innerHTML = `
                    <span class="status-dot"></span>
                    <span>No routine data found</span>
                `;
            }
        })
        .catch(err => {
            console.error(err);
            statusEl.className = 'status-badge error';
            statusEl.innerHTML = `
                <span class="status-dot"></span>
                <span>Connection error. Check your internet.</span>
            `;
        });
});

// --- Search Logic ---
searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        renderAllFaculty();
        return;
    }

    // Find matches (acronym OR full name)
    const matches = [];
    facultyMap.forEach((fullName, acronym) => {
        if (
            acronym.toLowerCase().includes(query) ||
            fullName.toLowerCase().includes(query)
        ) {
            matches.push({ acronym, fullName });
        }
    });

    // Sort: acronym match first, then alphabetical
    matches.sort((a, b) => {
        const aAcronymMatch = a.acronym.toLowerCase().includes(query);
        const bAcronymMatch = b.acronym.toLowerCase().includes(query);
        if (aAcronymMatch && !bAcronymMatch) return -1;
        if (!aAcronymMatch && bAcronymMatch) return 1;
        return a.acronym.localeCompare(b.acronym);
    });

    renderResults(matches, query);
});

// --- Render Functions ---
function renderAllFaculty() {
    const all = [];
    facultyMap.forEach((fullName, acronym) => {
        all.push({ acronym, fullName });
    });
    all.sort((a, b) => a.acronym.localeCompare(b.acronym));

    if (all.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    let html = `<p class="faculty-results-count">Showing all ${all.length} faculty members</p>`;
    html += '<div class="faculty-grid">';
    all.forEach((item, i) => {
        html += createFacultyCard(item.acronym, item.fullName, '', i);
    });
    html += '</div>';
    resultsContainer.innerHTML = html;
}

function renderResults(matches, query) {
    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="faculty-empty">
                <div class="empty-icon">🤷</div>
                <p>No faculty found matching "<strong>${escapeHtml(query)}</strong>"</p>
            </div>
        `;
        return;
    }

    let html = `<p class="faculty-results-count">${matches.length} result${matches.length !== 1 ? 's' : ''} found</p>`;
    html += '<div class="faculty-grid">';
    matches.forEach((item, i) => {
        html += createFacultyCard(item.acronym, item.fullName, query, i);
    });
    html += '</div>';
    resultsContainer.innerHTML = html;
}

function createFacultyCard(acronym, fullName, query, index) {
    const delay = Math.min(index * 0.04, 0.5);
    const highlightedAcronym = query ? highlightMatch(acronym, query) : acronym;
    const highlightedName = query ? highlightMatch(fullName, query) : fullName;

    return `
        <div class="faculty-card" style="animation-delay: ${delay}s">
            <div class="faculty-badge">${highlightedAcronym}</div>
            <div class="faculty-name">${highlightedName}</div>
        </div>
    `;
}

function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);

    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="match-highlight">$1</span>');
}

function escapeHtml(text) {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
}
