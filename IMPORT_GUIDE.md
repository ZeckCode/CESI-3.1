# Enrollment Data Import Guide

## Overview
You have a Django management command to bulk import enrollment data from JSON files.

## Files Created

1. **Management Command**: `BackEnd/enrollment/management/commands/import_enrollments.py`
2. **Sample Data**: `enrollments_sample.json` (26 sample students provided)

## Usage

### Step 1: Prepare Your JSON File
Create a JSON file with enrollment data. Each entry should follow this structure:

```json
[
  {
    "parent_info": {
      "father_name": "Name",
      "father_contact": "09123456789",
      "father_occupation": "Occupation",
      "mother_name": "Name",
      "mother_contact": "09123456789",
      "mother_occupation": "Occupation",
      "guardian_name": "",
      "guardian_contact": "",
      "guardian_relationship": ""
    },
    "website": "",
    "grade_level": "kinder",
    "status": "ACTIVE",
    "academic_year": "2024-2025",
    "student_type": "new",
    "education_level": "preschool",
    "lrn": "101002001",
    "student_number": "KD001",
    "last_name": "Cruz",
    "first_name": "Juan",
    "middle_name": "Santos",
    "birth_date": "2018-09-15",
    "gender": "Male",
    "email": "juan@example.com",
    "address": "123 Main St, Manila",
    "religion": "Catholic",
    "telephone_number": "8123456",
    "mobile_number": "09123456789",
    "parent_facebook": "fb.profile",
    "payment_mode": "cash",
    "remarks": ""
  }
]
```

### Step 2: Run the Import Command

**From PowerShell** in the BackEnd directory:

```powershell
python manage.py import_enrollments path/to/your/enrollments.json
```

**Example:**
```powershell
python manage.py import_enrollments ../enrollments_sample.json
```

### Step 3: Monitor Output

The command will show:
- ✓ Success for each imported student
- ⚠ Warnings for skipped entries
- ✗ Errors with descriptions

**Sample Output:**
```
✓ Entry 1: Juan Santos (kinder)
✓ Entry 2: Maria Gonzalez (kinder)
...
==================================================
Completed: 160 created, 0 skipped, 0 errors
```

## Grade Levels & Student Numbers

Use these prefixes for student numbers by grade level:

| Grade | Prefix | Example |
|-------|--------|---------|
| Pre-Kinder | PRE | PRE001-PRE020 |
| Kinder | KD | KD001-KD020 |
| Grade 1 | G1 | G1001-G1020 |
| Grade 2 | G2 | G2001-G2020 |
| Grade 3 | G3 | G3001-G3020 |
| Grade 4 | G4 | G4001-G4020 |
| Grade 5 | G5 | G5001-G5020 |
| Grade 6 | G6 | G6001-G6020 |

## Field Reference

**Required Fields:**
- `first_name`, `last_name`
- `grade_level` (prek, kinder, grade1-grade6)
- `email` (must be unique)

**Optional/Auto-filled:**
- `status` (default: PENDING)
- `academic_year` (default: 2024-2025)
- `enrolled_at` (auto: current timestamp)
- `student` (auto-created if email is unique)

## Valid Values

**status**: PENDING, ACTIVE, COMPLETED, DROPPED
**payment_mode**: cash, installment
**student_type**: new, old
**education_level**: preschool, elementary
**gender**: Any value (Male, Female, etc.)

## Tips

1. Ensure all mobile numbers follow format: `09XXXXXXXXX` or `+639XXXXXXXXX`
2. Make student_number unique per grade level
3. Use realistic birth dates based on grade level (age-appropriate)
4. Remove `website` field or leave it empty (honeypot check)
5. parent_info is optional - omit if not available

## Troubleshooting

**Error: File not found**
- Check file path is correct and file exists

**Error: Invalid JSON**
- Validate JSON syntax at jsonlint.com

**Error: Missing required field**
- Ensure email and first_name, last_name are provided

**Duplicate student_number**
- Make sure each student_number is unique per import
