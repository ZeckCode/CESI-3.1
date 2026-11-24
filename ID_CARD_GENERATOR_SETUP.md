# ID Card Generator Setup Guide

## Overview
The ID Card Generator feature allows admins to create customizable, downloadable student ID cards directly from the enrollment management interface.

## Installation & Setup

### 1. Automatic Setup (Recommended)
The ID Card Generator dependencies are automatically installed when you run the development server:

```bash
.\start-dev.ps1
```

This script will:
- ✅ Install `html2canvas` package (for PNG export)
- ✅ Verify `jspdf` and `jspdf-autotable` are installed (for PDF export)
- ✅ Set up all other frontend dependencies

### 2. Manual Installation
If you need to install dependencies manually:

```bash
cd FrontEnd\Main
npm install html2canvas --save
npm install jspdf jspdf-autotable --legacy-peer-deps
npm install
```

### 3. Verify Installation
Check that all dependencies are installed:

```bash
cd FrontEnd\Main
npm ls html2canvas
npm ls jspdf
npm ls jspdf-autotable
```

All three should return version information without errors.

---

## File Structure

```
FrontEnd/Main/src/components/AdminWebsite/IdGenerator/
├── IdCardGenerator.jsx          # Main component (modal, settings, export)
└── idGeneratorUtils.js          # Configuration and utilities
```

### IdCardGenerator.jsx
- **Purpose**: Main React component for ID card generation
- **Features**:
  - Modal overlay with settings panel
  - Live preview of student ID card
  - PDF export functionality
  - PNG export functionality
  - Customizable school branding
- **Props**:
  - `isOpen` (boolean): Controls modal visibility
  - `onClose` (function): Called when modal closes
  - `studentData` (object): Student enrollment data
  - `schoolInfo` (object): School configuration

### idGeneratorUtils.js
- **Purpose**: School configuration and data preparation
- **Contents**:
  - `DEFAULT_SCHOOL_INFO`: Customizable school branding
  - `fetchSchoolInfo()`: API function for dynamic school info
  - `prepareIdData()`: Utility to format enrollment data

---

## Configuration

### Customize School Information

Edit `idGeneratorUtils.js` to permanently customize your school's branding:

```javascript
export const DEFAULT_SCHOOL_INFO = {
  name: "YOUR_SCHOOL_NAME",                    // School name on ID
  motto: "YOUR_SCHOOL_MOTTO",                  // School motto
  academicYear: "2024-2025",                   // Default academic year
  colors: {
    primary: "#667eea",                        // Primary card color
    secondary: "#764ba2",                      // Secondary gradient color
  },
  contact: {
    phone: "+1 (555) 000-0000",               // School contact
    email: "info@school.edu",                 // School email
    address: "123 School Street, City, ST",  // School address
  },
  website: "www.school.edu",
};
```

### Dynamic School Info (Optional)
To load school info from your API, update `fetchSchoolInfo()`:

```javascript
export const fetchSchoolInfo = async () => {
  try {
    const response = await fetch("/api/school/info/");
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch school info:", error);
    return DEFAULT_SCHOOL_INFO;
  }
};
```

---

## Usage

### For Administrators

1. **Open Enrollment Management**
   - Navigate to Admin → Enrollment Management
   - Find the student record
   - Click the three-dot menu (⋮) on the enrollment row

2. **Generate ID Card**
   - Select "Generate ID Card" from the menu
   - Modal opens with student info and ID card preview

3. **Customize (Optional)**
   - Adjust school name, motto, academic year in settings panel
   - Changes reflect in real-time preview

4. **Download**
   - Click **"📥 Download PDF"** to save as PDF file
   - Click **"📥 Download PNG"** to save as PNG image

### Availability
ID cards can only be generated for **ACTIVE** enrollments (payment approved).

---

## Dependencies

### Required Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `html2pdf.js` | ^0.10.1 | PDF generation from HTML |
| `html2canvas` | ^1.4.1 | PNG/image export from HTML |
| `jspdf` | ^4.2.1 | PDF document creation (dependency) |
| `jspdf-autotable` | ^5.0.7 | PDF table formatting (optional) |
| `lucide-react` | ^0.562.0 | Icons (Download, X, Settings) |

### Installation Locations

- **Root**: `package.json` (tracks all dependencies)
- **Frontend**: `FrontEnd/Main/package.json` (includes `html2canvas`)
- **Installer**: `start-dev.ps1` (verifies and installs missing packages)

---

## Component Integration

### EnrollmentManagement.jsx
The main enrollment table integrates the ID generator:

```jsx
// State management
const [idGeneratorOpen, setIdGeneratorOpen] = useState(false);
const [selectedStudentForId, setSelectedStudentForId] = useState(null);
const [schoolInfo, setSchoolInfo] = useState(DEFAULT_SCHOOL_INFO);

// Open/Close handlers
const openIdGenerator = (enrollment) => {
  setSelectedStudentForId(enrollment);
  setIdGeneratorOpen(true);
};

const closeIdGenerator = () => {
  setIdGeneratorOpen(false);
  setSelectedStudentForId(null);
};

// Render component
<IdCardGenerator
  isOpen={idGeneratorOpen}
  onClose={closeIdGenerator}
  studentData={selectedStudentForId}
  schoolInfo={schoolInfo}
/>
```

### TableActionMenu.jsx
Action menu includes "Generate ID Card" option:

```jsx
<MenuItem onClick={() => onGenerateId(row)}>
  <CreditCard size={16} /> Generate ID Card
</MenuItem>
```

---

## Troubleshooting

### "html2canvas is not defined" Error
**Cause**: Package not installed or import missing
**Solution**: 
```bash
cd FrontEnd\Main
npm install html2canvas
```

### PDF Download Not Working
**Cause**: html2pdf library not loaded
**Solution**: Check browser console for errors, verify jspdf is installed

### ID Card Not Previewing
**Cause**: studentData not passed or structured incorrectly
**Verify**:
- Student is ACTIVE enrollment
- EnrollmentManagement passes proper studentData object
- All required fields present: first_name, last_name, birth_date, id_image_url

### Memory Issues with PNG Export
**Cause**: Large image resolution or canvas size
**Solution**: Reduce scale parameter in html2canvas call (line ~48):
```javascript
const canvas = await html2canvas(cardRef.current, { scale: 1 }); // Changed from 2
```

---

## Advanced Configuration

### Custom Card Design
To modify the card appearance, edit IdCardGenerator.jsx card rendering section (~line 200):
- Adjust gradient colors
- Change card dimensions (currently 350x550px)
- Modify layout/spacing
- Add/remove fields

### Batch Generation (Future Feature)
Currently generates one ID at a time. For batch generation:
1. Add multi-select to enrollment table
2. Loop through selected students
3. Generate PDFs and ZIP them
4. Return zipped file for download

### QR Code Integration (Future Feature)
Add student QR code to ID card:
```bash
npm install qrcode.react
```

Then add QR component to card design with student ID data.

---

## Performance Notes

- PNG export scales at 2x resolution for print quality
- PDF margins: 5mm on all sides
- Loaded images should be optimized < 500KB per student
- Large batches (50+ cards) may take 30-60 seconds

---

## Support

For issues or enhancements:
1. Check console errors (F12 → Console tab)
2. Verify dependencies installed: `npm ls`
3. Clear node_modules and reinstall: `npm install`
4. Restart development server: `.\start-dev.ps1`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 2, 2026 | Initial release with PDF/PNG export, customizable school info |

