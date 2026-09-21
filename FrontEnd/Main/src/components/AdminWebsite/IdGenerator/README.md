# Student ID Card Generator Setup Guide

## Overview
The Student ID Card Generator creates customizable, printable ID cards for enrolled students with school branding and enrollment information.

## Features
✅ Generate printable ID cards (Front design for now)
✅ Customize school name and motto
✅ Display student information (name, grade, age, LRN, section)
✅ Student photo integration
✅ Download as PDF or PNG image
✅ Real-time preview with settings

## Installation Requirements

Make sure these packages are installed in your project's `package.json`:

```bash
npm install html2canvas html2pdf.js
```

If not already installed, run:
```bash
npm install html2canvas
npm install html2pdf.js
```

## How to Use

### 1. Access ID Generator
- Open an enrolled student's enrollment record
- Click the **three-dot menu** (⋮) in the table actions
- Select **"Generate ID Card"**

### 2. Customize ID Settings
In the settings panel, you can modify:
- **School Name** - Your institution's name
- **Motto** - School motto or tagline
- **Academic Year** - Current school year
- **Section** - Student's class/section

### 3. Preview & Download
The ID card shows:
- School branding (name and motto)
- Student photo (circular, from submitted ID image)
- Student name and grade
- Section and age
- LRN (Learner Reference Number)
- Academic year validity

**Download Options:**
- **PDF** - For printing on a4 paper
- **PNG** - For digital distribution via email

## Configuration

### Setting Up School Information

Edit `idGeneratorUtils.js` to customize your school information:

```javascript
export const DEFAULT_SCHOOL_INFO = {
  name: "Your School Name",
  motto: "Your School Motto",
  logo_url: "https://your-school.com/logo.png",
  colors: {
    primary: "#667eea",      // Purple
    secondary: "#764ba2",    // Dark purple
    accent: "#3b82f6",       // Blue
  },
  address: "123 School Street",
  phone: "+63 2 1234 5678",
  email: "info@school.edu.ph",
};
```

### Customizing Card Design

Edit `IdCardGenerator.jsx` to:
- Change colors in the gradient
- Add/remove fields
- Modify card dimensions
- Add school logo

Current card design uses a purple gradient. To change colors:

```javascript
// Line ~285 - Main card background
background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
```

## Troubleshooting

### Issue: "html2canvas is not defined"
**Solution:** Make sure html2canvas is installed:
```bash
npm install html2canvas
npm uninstall html2pdf.js && npm install html2pdf.js
```

### Issue: Photos not showing on ID
**Solution:** 
- Ensure student has uploaded an ID image (`id_image_url` is set)
- Check that image URL is accessible
- Verify CORS settings if using external image URLs

### Issue: Download creates blank PDF
**Solution:**
- Wait a moment for the preview to fully render
- Try the PNG option first
- Check browser console for errors

## Future Enhancements

Possible improvements:
- [ ] Add back of ID card design
- [ ] QR code with student information
- [ ] Batch ID generation for multiple students
- [ ] Custom background image/pattern
- [ ] Different card layouts/templates
- [ ] Print-ready layouts (multiple cards per page)
- [ ] Signature/authorized stamp area
- [ ] Expiration date handling

## Files

- `IdCardGenerator.jsx` - Main component with UI and export functionality
- `idGeneratorUtils.js` - Configuration and utility functions
- `TableActionMenu.jsx` - Integrated with action menu
- `EnrollmentManagement.jsx` - Main integration point

## Notes

- IDs can only be generated for **ACTIVE** enrollments
- Student must have submitted their ID photo
- PDFs work best on desktop for printing
- PNG format recommended for email distribution
