import os
import re
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from docx import Document
import requests

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# Use /test_routine.json for testing
FIREBASE_URL = "https://edu-routine-generator-default-rtdb.asia-southeast1.firebasedatabase.app/current_routine.json"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

# ==========================================
# --- HELPER FUNCTIONS ---
# ==========================================

def is_time_slot(text):
    clean_text = text.replace(' ', '').replace('\n', '')
    # Regex to catch 8.30-10.00, 8:30-10:00, with hyphens or dashes
    return bool(re.search(r'\d{1,2}[\.:]\d{2}[-–—]\d{1,2}[\.:]\d{2}', clean_text))

def get_faculty_mapping(doc):
    mapping = {}
    for table in doc.tables:
        rows = table.rows
        if not rows: continue
        
        # Scan first few rows for headers
        for i in range(min(3, len(rows))):
            header = [cell.text.strip().lower() for cell in rows[i].cells]
            if 'name' in header and ('short form' in header or 'acronym' in header):
                try:
                    name_idx = header.index('name')
                    acronym_idx = -1
                    for idx, h in enumerate(header):
                        if 'short' in h or 'acronym' in h:
                            acronym_idx = idx
                            break
                    
                    if acronym_idx != -1:
                        for row in rows[i+1:]:
                            cells = row.cells
                            if len(cells) > max(name_idx, acronym_idx):
                                name = cells[name_idx].text.strip()
                                acronym = cells[acronym_idx].text.strip()
                                if acronym and name:
                                    mapping[acronym] = name
                except:
                    continue
                break
    return mapping

def parse_routine_complete(doc):
    data = []
    faculty_map = get_faculty_mapping(doc)
    
    # Regex for Course (e.g. EEE 407 OR CSE 317.1)
    course_pattern = re.compile(r"([A-Z]{2,4}\s*\d{3}(?:\.[0-9A-Za-z]+)?)", re.IGNORECASE)
    # Regex for Faculty
    faculty_pattern = re.compile(r"([A-Z][a-zA-Z\.]+\s?[A-Z]*)$") 
    
    valid_days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    for table in doc.tables:
        rows = table.rows
        if not rows: continue
        
        # --- FIX: DETECT DAY FROM THE VERY TOP ---
        current_day = None
        # Check the first cell of the first row (e.g., "Saturday")
        top_cell = rows[0].cells[0].text.strip()
        if top_cell in valid_days:
            current_day = top_cell
        
        # 3. Find Header Row (Scan first 5 rows)
        header_row_index = -1
        time_slots = []
        
        for i in range(min(5, len(rows))):
            cells = [cell.text.strip() for cell in rows[i].cells]
            found_slots = []
            for idx, text in enumerate(cells):
                if is_time_slot(text):
                    found_slots.append({'index': idx, 'time': text.strip()})
            
            if len(found_slots) >= 1:
                header_row_index = i
                time_slots = found_slots
                break
        
        if header_row_index == -1:
            continue

        # 4. Parse Rows (Start after header)
        for row in rows[header_row_index+1:]:
            cells = row.cells
            if not cells: continue
            
            first_cell_text = cells[0].text.strip()
            
            # Update Day if it appears inside the table rows (rare, but possible)
            if first_cell_text in valid_days:
                current_day = first_cell_text
                continue
            
            # If no day found yet, skip
            if not current_day:
                continue

            # Check for Room Number (starts with digit or 'N')
            if first_cell_text.isdigit() or first_cell_text.startswith('N'):
                room = first_cell_text
                
                for slot in time_slots:
                    if slot['index'] < len(cells):
                        cell_text = cells[slot['index']].text.strip()
                        if not cell_text: continue
                        
                        cell_text = cell_text.replace('\n', ' ')
                        
                        # MATCH COURSE
                        course_match = course_pattern.search(cell_text)
                        
                        if course_match:
                            course_code = course_match.group(1).strip()
                            
                            # MATCH FACULTY
                            remaining_text = cell_text.replace(course_code, '').strip()
                            remaining_text = remaining_text.strip(',').strip()
                            
                            faculty_acronym = ""
                            if 0 < len(remaining_text) < 15:
                                faculty_acronym = remaining_text
                            else:
                                fac_match = faculty_pattern.search(remaining_text)
                                if fac_match:
                                    faculty_acronym = fac_match.group(1)

                            # DETERMINE TYPE
                            header_text_full = " ".join([c.text.lower() for c in rows[header_row_index].cells])
                            prev_row_text = rows[max(0, header_row_index-1)].cells[0].text.lower() if header_row_index > 0 else ""
                            
                            class_type = 'Theory'
                            if 'lab' in header_text_full or 'lab' in prev_row_text:
                                class_type = 'Lab'

                            data.append({
                                "Day": current_day,
                                "Time": slot['time'],
                                "Room": room,
                                "Course": course_code,
                                "FacultyAcronym": faculty_acronym,
                                "FacultyFullName": faculty_map.get(faculty_acronym, ""),
                                "Type": class_type
                            })
    
    if not data:
        return pd.DataFrame(columns=["Day", "Time", "Room", "Course", "FacultyAcronym", "FacultyFullName", "Type"])
        
    return pd.DataFrame(data)

# ==========================================
# --- ROUTES ---
# ==========================================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        user_password = request.form.get('password')
        if ADMIN_PASSWORD and user_password != ADMIN_PASSWORD:
            return jsonify({"error": "Wrong password"}), 403

        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        doc = Document(file.stream)
        df = parse_routine_complete(doc)
        
        routine_json = df.to_dict(orient="records")
        
        response = requests.put(FIREBASE_URL, json={
            "updatedAt": str(pd.Timestamp.now()),
            "data": routine_json
        })

        return jsonify({
            "status": "success", 
            "count": len(routine_json),
            "firebase_status": response.status_code
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)