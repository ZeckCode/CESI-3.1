import React, { useEffect, useRef, useState } from 'react';
import '../IndexWebsiteCSS/Home.css';
import { useNavigate } from "react-router-dom";
import Notebook from './Notebook';
import logo from "../../assets/CESI-logo.jpg";
import backgroundImage from "../../assets/CESI-cover.png";
import EnrollmentForm from './enrollment/EnrollmentForm';

function App() {
  const navigate = useNavigate();
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [notebookTransitioning, setNotebookTransitioning] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const notebookTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (notebookTimerRef.current) {
        window.clearTimeout(notebookTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const cleanupBotpress = () => {
      if (window.botpressWebChat && typeof window.botpressWebChat.destroy === 'function') {
        window.botpressWebChat.destroy();
      }

      const widgetSelectors = [
        '#bp-web-widget-container',
        '#bp-web-widget',
        '.bpWebchat',
        'iframe[src*="botpress"]',
        '[id^="bp-web-widget"]',
      ];

      widgetSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => node.remove());
      });

      document
        .querySelectorAll('script[src*="cdn.botpress.cloud/webchat"], script[src*="files.bpcontent.cloud/2026/03/26/09/20260326092557-6ZV5HUUY.js"]')
        .forEach((node) => node.remove());
    };

    cleanupBotpress();

    const script1 = document.createElement('script');
    script1.src = 'https://cdn.botpress.cloud/webchat/v3.6/inject.js';
    script1.async = true;
    script1.setAttribute('data-botpress-home', 'inject');
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://files.bpcontent.cloud/2026/03/26/09/20260326092557-6ZV5HUUY.js';
    script2.defer = true;
    script2.setAttribute('data-botpress-home', 'config');
    document.body.appendChild(script2);

    return () => {
      cleanupBotpress();
      if (script1.parentNode) document.body.removeChild(script1);
      if (script2.parentNode) document.body.removeChild(script2);
    };
  }, []);

  const handleNotebookOpen = () => {
    if (notebookOpen || notebookTransitioning || enrollmentOpen) return;

    setNotebookTransitioning(true);
    notebookTimerRef.current = window.setTimeout(() => {
      setNotebookTransitioning(false);
      setNotebookOpen(true);
      notebookTimerRef.current = null;
    }, 720);
  };

  const handleNotebookClose = () => {
    setNotebookOpen(false);
    setNotebookTransitioning(false);
    if (notebookTimerRef.current) {
      window.clearTimeout(notebookTimerRef.current);
      notebookTimerRef.current = null;
    }
  };

  return (
    <div
      className="index-home-app"
      style={{
        backgroundImage: `linear-gradient(rgba(220, 235, 255, 0.393), rgba(244, 226, 139, 0.502)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <header className="index-home-header">
        <div className="index-home-header-container">
          <div
            className="index-home-logo-section"
            onClick={() => {
              setEnrollmentOpen(false);
              handleNotebookClose();
            }}
          >
            <div className="index-home-logo-circle">
              <img src={logo} alt="CESI Logo" className="index-home-logo-image" />
            </div>

            <div className="index-home-school-name">
              <h1>Caloocan Evangelical School Inc.</h1>
              <p>Preschool and Elementary Education</p>
            </div>
          </div>

          <div className="index-home-header-button">
            <button
              className="index-home-apply-btn"
              onClick={() => {
                setEnrollmentOpen(true);
                handleNotebookClose();
              }}
            >
              Enroll Now!
            </button>

            <button
              className="index-home-login-btn"
              onClick={() => {
                navigate("/login");
              }}
            >
              Login
            </button>
          </div>
        </div>
      </header>

      <main className="index-home-main-content">
        {!notebookOpen && !notebookTransitioning && !enrollmentOpen ? (
          <div className="index-home-book-cover-container">
            <div
              className={`index-home-book-cover ${notebookTransitioning ? 'is-opening' : ''}`}
              onClick={handleNotebookOpen}
            >
              <div className="index-home-book-spine"></div>
              <div className="index-home-book-front">
                <div className="index-home-book-title-content">
                  <h2 className="index-home-book-main-title">CESI Portal</h2>
                  <p className="index-home-book-subtitle">Student Hub</p>
                  <div className="index-home-tap-arrow">👇</div>
                  <p className="index-home-tap-instruction">Tap the book to open</p>
                </div>
                <div className="index-home-book-design">
                  <div className="index-home-design-circle"></div>
                  <div className="index-home-design-star">⭐</div>
                </div>
              </div>
            </div>
          </div>
        ) : (notebookOpen || notebookTransitioning) ? (
          <div className="index-home-notebook-stage">
            <div className={`index-home-notebook-enter ${notebookTransitioning ? 'is-opening' : ''}`}>
              <Notebook
                onClose={handleNotebookClose}
                openEnrollment={() => setEnrollmentOpen(true)}
              />
            </div>
            {notebookTransitioning && (
              <div className="index-home-book-opening-scene" aria-hidden="true">
                <div className="index-home-book-opening-book">
                  <div className="index-home-book-opening-spine"></div>
                  <div className="index-home-book-opening-left"></div>
                  <div className="index-home-book-opening-right">
                    <div className="index-home-book-opening-paper">
                      <div className="index-home-book-opening-paper-lines"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EnrollmentForm onClose={() => setEnrollmentOpen(false)} />
        )}
      </main>

      <footer
        className={`index-home-footer ${(notebookOpen || enrollmentOpen) ? "index-home-footer--overlay-open" : ""}`}
      >
        <div className="index-home-footer-container">
          <div className="index-home-footer-logo">
            <div className="index-home-footer-logo-circle">
              <img src={logo} alt="CESI Logo" className="index-home-footer-logo-image" />
            </div>
            <h3>Caloocan Evangelical School Inc.</h3>
          </div>

          <div className="index-home-footer-info">
            <p>📍 #47 P. Zamora St. Caloocan City, Metro Manila</p>
            <p>📞 (02) 8-285-3702 / 0905-299-6303</p>
            <p>📧 caloocanevangelicalschool@gmail.com</p>
          </div>

          <div className="index-home-footer-copyright">
            <p>© 2025 CESI. All rights reserved.</p>
            <p className="index-home-school-mission">"Quality Christian Education for All"</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
