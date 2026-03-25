import React, { useState } from 'react';
import '../IndexWebsiteCSS/Home.css';
import { useNavigate } from "react-router-dom";
import Notebook from './Notebook';
import logo from "../../assets/CESI-logo.jpg";
import backgroundImage from "../../assets/CESI-cover.png";
import EnrollmentForm from './EnrollmentForm';


function App() {
  const navigate = useNavigate();
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);

  return (
    <div className="app" style={{  
      backgroundImage: `linear-gradient(rgba(220, 235, 255, 0.393), rgba(244, 226, 139, 0.502)), url(${backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      {/* Header - Full width */}
      <header className="index-header">
        <div className="index-header-container">
          <div
            className="logo-section"
            onClick={() => {
              setEnrollmentOpen(false);
              setNotebookOpen(false);
            }}
          >
            <div className="logo-circle">
              <img src={logo} alt="CESI Logo" className="logo-image" />
            </div>

            <div className="school-name">
              <h1>Caloocan Evangelical School Inc.</h1>
              <p>Preschool and Elementary Education</p>
            </div>
          </div>
          <div className="header-button">
            <button
              className="apply-btn"
              onClick={() => {
                setEnrollmentOpen(true);
                setNotebookOpen(false); // close notebook automatically
              }}
            >
              Enroll Now!
            </button>

            <button
            className="login-btn"
            onClick={() => {
              // navigate to login page
              navigate("/login");
            }}
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Centered */}
      <main className="main-content">
        {!notebookOpen && !enrollmentOpen ? (
          <div className="book-cover-container">
            <div className="book-cover" onClick={() => setNotebookOpen(true)}>
              <div className="book-spine"></div>
              <div className="book-front">
                <div className="book-title-content">
                  <h2 className="book-main-title">CESI Portal</h2>
                  <p className="book-subtitle">Student Hub</p>
                  <div className="tap-arrow">👇</div>
                  <p className="tap-instruction">Tap the book to open</p>
                  
                </div>
                <div className="book-design">
                  <div className="design-circle"></div>
                  <div className="design-star">⭐</div>
                </div>
              </div>
            </div>
          </div>
        ) : notebookOpen ? (
          <Notebook onClose={() => setNotebookOpen(false)}
          openEnrollment={() => setEnrollmentOpen(true)} />
        ) : (
          <EnrollmentForm onClose={() => setEnrollmentOpen(false)} />

        )}
      </main>


      {/* Footer - Full width */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-logo">
            <div className="footer-logo-circle">
              <img src={logo} alt="CESI Logo" className="footer-logo-image" />
            </div>
            <h3>Caloocan Evangelical School Inc.</h3>
          </div>

          <div className="footer-info">
            <p>📍 #47 P. Zamora St. Caloocan City, Metro Manila</p>
            <p>📞 (02) 8-285-3702 / 0905-299-6303</p>
            <p>📧 caloocanevangelicalschool@gmail.com</p>
          </div>
          <div className="footer-copyright">
            <p>© 2025 CESI. All rights reserved.</p>
            <p className="school-mission">"Quality Christian Education for All"</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;