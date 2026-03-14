import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import srmLogo from "../assets/srmist-logo.png";
import srmLogoN from "../assets/srmist-logo.png";
import "../components/SharedPageStyles.css";
import styles from "../components/AgentSignUp.module.css";

const AgentSignUp: React.FC = () => {
  const navigate = useNavigate();

  const [facultyName, setFacultyName] = useState("");
  const [email, setEmail] = useState("");
  const [scopusId, setScopusId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [designation, setDesignation] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [doj, setDoj] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    let newErrors: { [key: string]: string } = {};

    if (!facultyName) newErrors.facultyName = "Faculty name is required";
    if (!email) newErrors.email = "Email is required";
    else if (!email.endsWith("@gmail.com") && !email.endsWith("@srmist.edu.in")) {
      newErrors.email = "Email must be @gmail.com or @srmist.edu.in";
    }
    if (!scopusId) newErrors.scopusId = "Scopus ID is required";
    else if (!/^\d+$/.test(scopusId.trim()) || scopusId.trim().length !== 11) {
      newErrors.scopusId = "Scopus ID should be exactly 11 digits";
    }
    if (!facultyId) newErrors.facultyId = "Faculty ID is required";
    else if (facultyId.trim().length !== 6) {
      newErrors.facultyId = "Faculty ID should be exactly 6 characters";
    }
    if (!designation) newErrors.designation = "Designation is required";
    if (!mobileNo) newErrors.mobileNo = "Mobile number is required";
    else if (!/^\d{10}$/.test(mobileNo.trim())) {
      newErrors.mobileNo = "Mobile number must be exactly 10 digits";
    }
    if (!doj) newErrors.doj = "Date of joining is required";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        const response = await fetch("https://srm-sp-production.up.railway.app/admin/submit-author-for-approval", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            faculty_name: facultyName.trim(),
            email: email.trim(),
            scopus_id: scopusId.trim(),
            faculty_id: facultyId.trim(),
            designation: designation.trim(),
            mobile_no: mobileNo.trim(),
            doj: doj.trim(),
          }),
        });

        const result = await response.json();

        if (response.ok) {
          setSuccessMessage("✓ Request submitted! Your profile is pending admin approval. You will be notified once approved.");
          setFacultyName("");
          setEmail("");
          setScopusId("");
          setFacultyId("");
          setDesignation("");
          setMobileNo("");
          setDoj("");
          setTimeout(() => setSuccessMessage(""), 5000);
        } else {
          setErrors({ form: result.error || "Failed to submit request. Please try again." });
        }
      } catch (error) {
        console.error("Sign up error:", error);
        setErrors({ form: "Network error. Please try again." });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSignUp();
    }
  };

  return (
    <div className={styles.container}>
      <div className="shared-navbar">
        <button className="shared-back-button" onClick={handleBack} title="Go to Home">
          <ArrowLeft size={24} />
        </button>
        <a className="shared-logo">
          <img src={srmLogoN} alt="SRM Logo" className={styles.navLogo} /> 
          <span>SRM SP</span>
        </a>
      </div>

      <div className={styles.mainContainer}>
        <div className={styles.leftSide}>
          <div className={styles.loginBox} onKeyDown={handleKeyDown}>
            <h2 className={styles.loginTitle}>Faculty Sign Up</h2>
            <p className={styles.loginSubtitle}>
              Enter your details to sign in to your account
            </p>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Faculty Name</label>
              <input
                type="text"
                placeholder="Dr. Jane Smith"
                className={styles.inputField}
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.facultyName && (
                <p className={styles.errorText}>{errors.facultyName}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email ID</label>
              <input
                type="email"
                placeholder="username@srmist.edu.in"
                className={styles.inputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className={styles.errorText}>{errors.email}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Scopus ID</label>
              <input
                type="text"
                placeholder="57123456789"
                className={styles.inputField}
                value={scopusId}
                onChange={(e) => setScopusId(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.scopusId && (
                <p className={styles.errorText}>{errors.scopusId}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Faculty ID</label>
              <input
                type="text"
                placeholder="124477"
                className={styles.inputField}
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.facultyId && (
                <p className={styles.errorText}>{errors.facultyId}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Designation</label>
              <input
                type="text"
                placeholder="Associate Professor"
                className={styles.inputField}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.designation && (
                <p className={styles.errorText}>{errors.designation}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Mobile No</label>
              <input
                type="tel"
                placeholder="9876543210"
                className={styles.inputField}
                value={mobileNo}
                onChange={(e) => setMobileNo(e.target.value)}
                disabled={isSubmitting}
                maxLength={10}
              />
              {errors.mobileNo && (
                <p className={styles.errorText}>{errors.mobileNo}</p>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Date of Joining</label>
              <input
                type="date"
                className={styles.inputField}
                value={doj}
                onChange={(e) => setDoj(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.doj && (
                <p className={styles.errorText}>{errors.doj}</p>
              )}
            </div>

            {successMessage && (
              <p className={styles.successText}>{successMessage}</p>
            )}

            {errors.form && (
              <p className={styles.errorText}>{errors.form}</p>
            )}

            <button 
              className={styles.signUpBtn} 
              onClick={handleSignUp}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Sign Up"}
            </button>
          </div>
        </div>

        <div className={styles.rightSide}>
          <h3 className={styles.bannerTitle}>
            Insightful and Real-Time Analysis of Published Research Papers
          </h3>
          <div>
            <img src={srmLogo} alt="Analytics" className={styles.bannerImage} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSignUp;
