import React, { useState, useCallback } from 'react';
import { Users, Edit2, Trash2 } from 'lucide-react';
import Toast from '../Global/Toast';
import '../AdminWebsiteCSS/AssignTeachers.css';

const AssignTeachers = () => {
  // Sample classes data
  const [classes] = useState([
    { id: 1, name: 'Grade 1-A', gradeLevel: 'Grade 1', teacher: 'Mrs. Jennifer Johnson', capacity: 30, enrolled: 28, subjects: ['Math', 'Language Arts', 'Science'], schedule: 'Mon-Fri, 8:00 AM - 3:00 PM' },
    { id: 2, name: 'Grade 1-B', gradeLevel: 'Grade 1', teacher: 'Mr. David Santos', capacity: 30, enrolled: 26, subjects: ['Math', 'Language Arts', 'Social Studies'], schedule: 'Mon-Fri, 8:00 AM - 3:00 PM' },
    { id: 3, name: 'Grade 2-A', gradeLevel: 'Grade 2', teacher: 'Ms. Maria Garcia', capacity: 32, enrolled: 30, subjects: ['Math', 'Science', 'Physical Education'], schedule: 'Mon-Fri, 8:30 AM - 3:30 PM' },
    { id: 4, name: 'Kindergarten-A', gradeLevel: 'Kindergarten', teacher: 'Mrs. Susan Williams', capacity: 25, enrolled: 24, subjects: ['Art', 'Music', 'Science Basics'], schedule: 'Mon-Fri, 9:00 AM - 12:00 PM' },
  ]);

  // Available teachers
  const [availableTeachers] = useState([
    'Mrs. Jennifer Johnson',
    'Mr. David Santos',
    'Ms. Maria Garcia',
    'Mr. Robert Brown',
    'Mrs. Susan Williams',
  ]);

  const [toasts, setToasts] = useState([]);
  const [reassigningClass, setReassigningClass] = useState(null);
  const [selectedNewTeacher, setSelectedNewTeacher] = useState('');

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleReassignTeacher = async (classId, oldTeacher, newTeacher) => {
    if (!newTeacher) {
      addToast('Selection Required', 'Please select a teacher to assign', 'warning');
      return;
    }
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      addToast('Success', `Class reassigned from ${oldTeacher} to ${newTeacher}`, 'success');
      setReassigningClass(null);
      setSelectedNewTeacher('');
    } catch (e) {
      addToast('Error', 'Failed to reassign teacher. Please try again.', 'error');
    }
  };

  const handleRemoveAssignment = async (classId, teacher) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      addToast('Success', `${classId} has been removed from ${teacher}'s assignments`, 'success');
    } catch (e) {
      addToast('Error', 'Failed to remove assignment. Please try again.', 'error');
    }
  };

  return (
    <div className="admin-class-management">
      {/* Header */}
      <div className="admin-class-header">
        <h1>Teacher Assignments</h1>
      </div>

      {/* Statistics */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <h3>Total Teachers</h3>
          <p className="admin-stat-number">{availableTeachers.length}</p>
          <p className="admin-stat-insight">
            {availableTeachers.length < 5 ? 'Understaffed - Consider hiring' : availableTeachers.length < 15 ? 'Adequate staffing' : availableTeachers.length < 30 ? 'Well-staffed' : 'Excellent coverage'}
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Classes Assigned</h3>
          <p className="admin-stat-number">{classes.length}</p>
          <p className="admin-stat-insight">
            {classes.length === 0 ? 'No classes yet' : classes.length < 5 ? 'Few classes offered' : classes.length < 15 ? 'Good variety' : 'Comprehensive program'}
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Total Students</h3>
          <p className="admin-stat-number">{classes.reduce((sum, c) => sum + c.enrolled, 0)}</p>
          <p className="admin-stat-insight">
            {classes.reduce((sum, c) => sum + c.enrolled, 0) === 0 ? 'No enrollments yet' : classes.reduce((sum, c) => sum + c.enrolled, 0) < 30 ? 'Small class' : classes.reduce((sum, c) => sum + c.enrolled, 0) < 100 ? 'Healthy enrollment' : 'Strong student body'}
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Avg. Students/Teacher</h3>
          <p className="admin-stat-number">{Math.round(classes.reduce((sum, c) => sum + c.enrolled, 0) / availableTeachers.length)}</p>
          <p className="admin-stat-insight">
            {availableTeachers.length === 0 ? 'No teachers' : Math.round(classes.reduce((sum, c) => sum + c.enrolled, 0) / availableTeachers.length) < 20 ? 'Good ratio - Low class sizes' : Math.round(classes.reduce((sum, c) => sum + c.enrolled, 0) / availableTeachers.length) < 40 ? 'Balanced workload' : 'High - Consider more teachers'}
          </p>
        </div>
      </div>

      {/* ASSIGN TEACHERS VIEW */}
      <div className="admin-assign-teachers-view">
        <div className="admin-teacher-assignment-table">
          <table className="admin-assignments-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Classes Assigned</th>
                <th>Total Students</th>
                <th>Subjects Teaching</th>
              </tr>
            </thead>
            <tbody>
              {availableTeachers.map((teacher, idx) => {
                const teacherClasses = classes.filter(c => c.teacher === teacher);
                const totalStudents = teacherClasses.reduce((sum, cls) => sum + cls.enrolled, 0);
                const allSubjects = new Set();
                teacherClasses.forEach(cls => {
                  cls.subjects.forEach(s => allSubjects.add(s));
                });
                return (
                  <tr key={idx}>
                    <td><strong>{teacher}</strong></td>
                    <td>
                      <span className="admin-badge">{teacherClasses.length}</span>
                    </td>
                    <td>
                      <span className="admin-badge">{totalStudents}</span>
                    </td>
                    <td>
                      <div className="admin-subjects-list">
                        {Array.from(allSubjects).slice(0, 2).map((s, i) => (
                          <span key={i} className="admin-subject-tag-small">{s}</span>
                        ))}
                        {allSubjects.size > 2 && (
                          <span className="admin-subject-tag-small">+{allSubjects.size - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Details */}
      <div className="admin-teacher-details">
        {availableTeachers.map((teacher, idx) => {
          const teacherClasses = classes.filter(c => c.teacher === teacher);
          if (teacherClasses.length === 0) return null;
          
          return (
            <div key={idx} className="admin-teacher-card">
              <h3>{teacher}</h3>
          <div className="admin-teacher-info">
            <p><strong>Classes:</strong></p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {teacherClasses.map(cls => (
                  <tr key={cls.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', textAlign: 'left' }}>
                      {cls.name} ({cls.gradeLevel}) - {cls.enrolled} Students
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {reassigningClass === cls.id ? (
                          <>
                            <select
                              value={selectedNewTeacher}
                              onChange={(e) => setSelectedNewTeacher(e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
                            >
                              <option value="">Select teacher...</option>
                              {availableTeachers.map((t) => t !== teacher && <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button
                              onClick={() => handleReassignTeacher(cls.id, teacher, selectedNewTeacher)}
                              style={{
                                padding: '4px 8px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => { setReassigningClass(null); setSelectedNewTeacher(''); }}
                              style={{
                                padding: '4px 8px',
                                background: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setReassigningClass(cls.id)}
                              title="Reassign teacher"
                              style={{
                                padding: '4px 8px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px'
                              }}
                            >
                              <Edit2 size={14} /> Reassign
                            </button>
                            <button
                              onClick={() => handleRemoveAssignment(cls.id, teacher)}
                              title="Remove class assignment"
                              style={{
                                padding: '4px 8px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px'
                              }}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </div>
          );
        })}
      </div>

      {/* Developer Notes */}
      <div className="admin-note">
        📌 <strong>Development Notes:</strong> 
        <ul>
          <li>Implement drag-and-drop teacher assignment</li>
          <li>Track teacher qualifications and certifications</li>
          <li>Monitor workload distribution</li>
          <li>Implement substitute teacher management</li>
          <li>Add teacher performance metrics</li>
        </ul>
      </div>
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
};

export default AssignTeachers;
