import os  # <--- NEW IMPORT
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from docx import Document
import requests
import json

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
FIREBASE_URL = "https://edu-routine-generator-default-rtdb.asia-southeast1.firebasedatabase.app/current_routine.json"

# Read the password securely from Vercel
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

def is_time_slot(text):
    # Checks if text looks like "8.30-10.00" 
    return '-' in text and any(char.isdigit() for char in text) and len(text) < 20

def get_faculty_mapping(doc):
    """
    Scans the document for the 'Faculty Members' table and returns a dictionary.
    Format: {'ANJ': 'Mr. Asif Noor Jamee', 'SMI': 'Mr. Md. Siratul Mustakim Ifty'}
    """
    mapping = {}
    print("--- Scanning for Faculty List ---")
    
    for table in doc.tables:
        # Check if this is the Faculty table (look for "Short Form" in header)
        is_faculty_table = False
        if len(table.rows) > 0:
            header_text = " ".join([cell.text for cell in table.rows[0].cells])
            if "Short Form" in header_text or "Faculty Members" in header_text:
                is_faculty_table = True
        
        if is_faculty_table:
            # Iterate through rows (skip header)
            for row in table.rows[1:]:
                cells = row.cells
                if len(cells) >= 3:
                    full_name = cells[1].text.strip()
                    short_form = cells[2].text.strip()
                    
                    if short_form and full_name:
                        mapping[short_form] = full_name
            print(f"Found {len(mapping)} faculty members.")
            break # Stop looking after finding the table
            
    return mapping

def parse_routine_complete(file_path):
    print(f"--- Processing: {file_path} ---")
    doc = Document(file_path)
    
    # STEP 1: Build the Faculty Dictionary
    faculty_map = get_faculty_mapping(doc)
    
    parsed_data = []
    current_day = "Unknown"
    table_type = "Theory" 
    
    DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    # STEP 2: Parse the Routine Tables
    for tbl_idx, table in enumerate(doc.tables):
        # A. Check Context (Day/Type) from the full text of the table
        full_table_text = ""
        for row in table.rows:
            for cell in row.cells:
                full_table_text += " " + cell.text
        
        # Skip the Faculty table itself so we don't try to parse it as classes
        if "Short Form" in full_table_text:
            continue

        for day in DAYS:
            if day in full_table_text:
                current_day = day
        
        if 'Theory' in full_table_text:
            table_type = 'Theory'
        elif 'Lab' in full_table_text:
            table_type = 'Lab'

        # B. Find Header Row
        header_map = {} 
        data_start_row = -1
        
        for r_idx, row in enumerate(table.rows):
            cells = row.cells
            is_header = False
            for c_idx, cell in enumerate(cells):
                txt = cell.text.strip()
                if is_time_slot(txt):
                    header_map[c_idx] = txt
                    is_header = True
            
            if is_header:
                data_start_row = r_idx + 1
                break 
        
        # C. Extract Data
        if header_map:
            print(f"   -> Extracting data from Table {tbl_idx} for {current_day}...")
            
            for r_idx in range(data_start_row, len(table.rows)):
                row = table.rows[r_idx]
                cells = row.cells
                
                if not cells: continue
                room = cells[0].text.strip()
                if not room: continue 
                
                for col_idx, time_val in header_map.items():
                    if col_idx < len(cells):
                        cell_text = cells[col_idx].text.strip()
                        
                        if cell_text:
                            # Split Course / Faculty
                            if '\n' in cell_text:
                                parts = cell_text.rsplit('\n', 1)
                                course = parts[0].strip()
                                faculty_short = parts[1].strip()
                            elif ',' in cell_text:
                                parts = cell_text.rsplit(',', 1)
                                course = parts[0].strip()
                                faculty_short = parts[1].strip()
                            else:
                                course = cell_text.strip()
                                faculty_short = ""

                            course = course.replace('\n', ' ')
                            
                            # LOOKUP FULL NAME
                            # Default to the short code if full name not found
                            faculty_full = faculty_map.get(faculty_short, faculty_short)

                            parsed_data.append({
                                'Day': current_day,
                                'Type': table_type,
                                'Room': room,
                                'Time': time_val,
                                'Course': course,
                                'FacultyAcronym': faculty_short,
                                'FacultyFullName': faculty_full
                            })

    return pd.DataFrame(parsed_data)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        # 1. SECURITY CHECK (The New Part)
        # We expect the password to be sent in the request headers or form data
        user_password = request.form.get('password')
        
        if not user_password:
            return jsonify({"error": "Password required"}), 401
            
        if user_password != ADMIN_PASSWORD:
            return jsonify({"error": "Wrong password"}), 403

        # 2. File Checks (Same as before)
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # 3. Parse & Upload (Same as before)
        df = parse_routine_complete(file.stream)
        routine_json = df.to_dict(orient="records")
        
        requests.put(FIREBASE_URL, json={
            "updatedAt": str(pd.Timestamp.now()),
            "data": routine_json
        })

        return jsonify({"status": "success", "count": len(routine_json)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000, debug=True)