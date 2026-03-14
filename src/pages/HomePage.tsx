import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { default as dev1, default as dev2, default as dev3 } from "../assets/react.svg";
import logoImg from "../assets/srmist-logo.png";
import "../components/SharedPageStyles.css";
import styles from "../components/HomePage.module.css";
import axios from 'axios';
import { BookOpen, Globe2, Star, Clock, Mail, Building2, Users, FileText, Award, TrendingUp } from 'lucide-react';
import { FaChartBar, FaBullseye, FaHandshake } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";

// Hardcoded H-Index values per department (source: official records)
const DEPT_H_INDEX: Record<string, number> = {
    "C.Tech":  55,
    "CINTEL":  49,
    "DSBS":    39,
    "NWC":     43,
};

interface DepartmentStat {
    department: string;
    faculty_count: number;
    total_papers: number;
    total_citations: number;
    q1_count: number;
    q2_count: number;
}

interface TopCitedFaculty {
    faculty_name: string;
    citations: number;
    department: string;
}

// Animation variants
const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};
const stagger = { visible: { transition: { staggerChildren: 0.18 } } };
const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1.1 } },
};

const slideVariant = {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.6 } },
    exit: { x: -100, opacity: 0, transition: { duration: 0.5 } },
};

// Animated counter hook
const useCountUp = (end: number, duration: number = 1.5): number => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!end || end === 0) {
            setCount(0);
            return;
        }
        let start = 0;
        const increment = end / (duration * 60);
        let rafId: number;
        const update = () => {
            start += increment;
            if (start < end) {
                setCount(Math.floor(start));
                rafId = requestAnimationFrame(update);
            } else {
                setCount(end);
            }
        };
        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, [end, duration]);
    return count;
};

// Developer Data
const developers = [
    {
        name: "Piyush",
        img: dev2,
        role: "Frontend & Backend",
        linkedin: "https://linkedin.com/in/-piyush-raj",
        github: "https://github.com/Piyush7R"
    },
    {
        name: "Santpal",
        img: dev3,
        role: "Frontend & Backend",
        linkedin: "https://linkedin.com/in/santpal",
        github: "https://github.com/Santpal1"
    }
];

// Faculty Mentor Data
const facultyMentors = [
    {
        name: "Dr. Arulalan V",
        img: dev1,
        designation: "Assistant Professor",
        email: "arulalav@srmist.edu.in"
    },
    {
        name: "Dr. Muralidharan C",
        img: dev1,
        designation: "Assistant Professor",
        email: "muralidc@srmist.edu.in"
    }
];


const FacultyLandingPage = () => {
    const navigate = useNavigate();
    const { getAuthHeaders } = useAuth();

    const [totalDepartments, setTotalDepartments] = useState(0);
    const [totalFaculties, setTotalFaculties] = useState(0);
    const [totalPapers, setTotalPapers] = useState(0);
    const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);

    const departments = useCountUp(totalDepartments);
    const faculties = useCountUp(totalFaculties);
    const papers = useCountUp(totalPapers);
    const [carouselStats, setCarouselStats] = useState<{ title: string, description: string }[]>([]);

    useEffect(() => {
        const headers = getAuthHeaders();
        axios.get('https://srm-sp-production.up.railway.app/api/homepage-stats', { headers })
            .then(({ data }) => {
                if (data.departmentStats && data.departmentStats.length > 0) {
                    setDepartmentStats(data.departmentStats);
                    setTotalDepartments(data.departmentStats.length);

                    const totalFac = data.departmentStats.reduce(
                        (sum: number, dept: DepartmentStat) => sum + Number(dept.faculty_count), 0
                    );
                    setTotalFaculties(totalFac);
                }

                setTotalPapers(data.totalPapers || 0);

                const topCited: TopCitedFaculty | null = data.topCitedFaculty || null;

                const stats = [
                    {
                        title: "Total Citations",
                        description: `${Number(data.totalCitations).toLocaleString()} citations received by our faculty publications.${topCited
                                ? ` Top cited: ${topCited.faculty_name} (${Number(topCited.citations).toLocaleString()} citations, ${topCited.department}).`
                                : ''
                            }`,
                    },
                    {
                        title: "Top SDGs",
                        description: data.topSDGs.map((s: any) => `${s.sdg} (${s.count})`).join(', '),
                    },
                    {
                        title: "Top Collaborating Countries",
                        description: data.topCountries.map((c: any) => `${c.country} (${c.count})`).join(', '),
                    },
                    {
                        title: "Q1 Publications (As of 2024)",
                        description: `${data.recentQ1Papers} Q1 rankings achieved by our faculty in 2024.`,
                    },
                    {
                        title: "Recent Publications (Last 1 Year)",
                        description: `${data.recentPublications} papers published in the last year.${data.topRecentFaculty
                                ? ` Top contributor: ${data.topRecentFaculty.faculty_name} (${data.topRecentFaculty.paper_count} papers).`
                                : ''
                            }`,
                    },
                    {
                        title: "Top Journal",
                        description: `${data.topJournal.publication_name} with ${data.topJournal.count} publications.`,
                    },
                ];
                setCarouselStats(stats);
            })
            .catch(err => {
                console.error('Failed to fetch homepage stats:', err);
            });
    }, [getAuthHeaders]);

    // Carousel
    const [carouselIdx, setCarouselIdx] = useState(0);
    const carouselIdxRef = useRef(0);

    const nextCarousel = () => {
        const newIdx = (carouselIdxRef.current + 1) % carouselStats.length;
        carouselIdxRef.current = newIdx;
        setCarouselIdx(newIdx);
    };

    const prevCarousel = () => {
        const newIdx = (carouselIdxRef.current - 1 + carouselStats.length) % carouselStats.length;
        carouselIdxRef.current = newIdx;
        setCarouselIdx(newIdx);
    };

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (carouselStats.length === 0) return;
        intervalRef.current = setInterval(() => { nextCarousel(); }, 3000);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [carouselStats.length]);

    const pauseAutoScroll = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const resumeAutoScroll = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => { nextCarousel(); }, 3000);
    };

    const statIcons = [
        <BookOpen size={28} key="icon-0" />,
        <Globe2 size={28} key="icon-1" />,
        <Star size={28} key="icon-2" />,
        <Clock size={28} key="icon-3" />,
        <BookOpen size={28} key="icon-4" />,
        <Globe2 size={28} key="icon-5" />,
    ];

    return (
        <div className={styles.fullPageContainer}>
            {/* NAVBAR */}
            <motion.div
                className="shared-navbar"
                initial={{ y: -70, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <div className="shared-logo">
                    <img src={logoImg} alt="SRM Logo" className={styles.navbarLogo} />
                    <span>SRM SP</span>
                </div>
                <div className={styles.authButtons}>
                    <motion.button className={styles.login} whileHover={{ scale: 1.05 }} onClick={() => navigate('/login')}>
                        Login
                    </motion.button>
                    <motion.button className={styles.signup} whileHover={{ scale: 1.05 }} onClick={() => navigate('/signup')}>
                        SignUp
                    </motion.button>
                </div>
            </motion.div>

            <div className={styles.mainContent}>
                {/* HERO SECTION */}
                <motion.section
                    className={styles.heroSection}
                    initial={false}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.6 }}
                    variants={stagger}
                >
                    <motion.h1 variants={fadeInUp}>Faculty Research Analytics Dashboard</motion.h1>
                    <motion.p variants={fadeInUp}>
                        Comprehensive research performance tracking powered by Scopus and SciVal data.
                        Monitor publications, citations, collaborations, and impact metrics for academic excellence.
                    </motion.p>
                    <motion.div
                        className={styles.heroFeatures}
                        variants={stagger}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        <motion.div className={styles.featureItem} variants={fadeInUp}>
                            <BookOpen size={24} /><span>Publication Tracking</span>
                        </motion.div>
                        <motion.div className={styles.featureItem} variants={fadeInUp}>
                            <Star size={24} /><span>Citation Analysis</span>
                        </motion.div>
                        <motion.div className={styles.featureItem} variants={fadeInUp}>
                            <Globe2 size={24} /><span>Global Collaboration</span>
                        </motion.div>
                        <motion.div className={styles.featureItem} variants={fadeInUp}>
                            <Clock size={24} /><span>Real-time Metrics</span>
                        </motion.div>
                    </motion.div>
                </motion.section>

                {/* STATS SECTION */}
                <motion.section
                    className={styles.statsSection}
                    initial={false}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.5 }}
                    variants={stagger}
                >
                    <motion.div variants={fadeInUp}>
                        <span>{departments}</span>
                        Departments
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                        <span>{faculties}+</span>
                        Faculties
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                        <span>{papers}+</span>
                        Research Papers
                    </motion.div>
                </motion.section>

                {/* DEPARTMENT STATS SECTION */}
                {departmentStats.length > 0 && (
                    <motion.section
                        className={styles.departmentStatsSection}
                        initial={false}
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={fadeIn}
                    >
                        <motion.h2 className={styles.sectionTitle} variants={fadeInUp}>
                            <Building2 size={32} />
                            Department-wise Research Overview
                        </motion.h2>

                        <motion.div className={styles.departmentGrid} variants={stagger}>
                            {departmentStats.map((dept) => {
                                const hIndex = DEPT_H_INDEX[dept.department] ?? null;
                                return (
                                    <motion.div
                                        key={dept.department}
                                        className={styles.departmentCard}
                                        variants={fadeInUp}
                                        whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0, 119, 204, 0.3)" }}
                                    >
                                        <div className={styles.deptHeader}>
                                            <Building2 size={24} className={styles.deptIcon} />
                                            <h3>{dept.department}</h3>
                                        </div>
                                        <div className={styles.deptStats}>
                                            <div className={styles.deptStatItem}>
                                                <Users size={20} />
                                                <div>
                                                    <span className={styles.deptStatValue}>{dept.faculty_count}</span>
                                                    <span className={styles.deptStatLabel}>Faculty</span>
                                                </div>
                                            </div>
                                            <div className={styles.deptStatItem}>
                                                <FileText size={20} />
                                                <div>
                                                    <span className={styles.deptStatValue}>{Number(dept.total_papers).toLocaleString()}</span>
                                                    <span className={styles.deptStatLabel}>Papers</span>
                                                </div>
                                            </div>
                                            <div className={styles.deptStatItem}>
                                                <Star size={20} />
                                                <div>
                                                    <span className={styles.deptStatValue}>{Number(dept.total_citations).toLocaleString()}</span>
                                                    <span className={styles.deptStatLabel}>Citations</span>
                                                </div>
                                            </div>

                                            {/* H-Index — hardcoded per department, hidden if not in the map */}
                                            {hIndex !== null && (
                                                <div className={styles.deptStatItem}>
                                                    <TrendingUp size={20} style={{ color: '#7c3aed' }} />
                                                    <div>
                                                        <span className={styles.deptStatValue} style={{ color: '#7c3aed' }}>{hIndex}</span>
                                                        <span className={styles.deptStatLabel}>H-Index</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={styles.deptStatItem}>
                                                <Award size={20} style={{ color: '#FFD700' }} />
                                                <div>
                                                    <span className={styles.deptStatValue} style={{ color: '#FFD700' }}>{dept.q1_count}</span>
                                                    <span className={styles.deptStatLabel}>Q1 (2024)</span>
                                                </div>
                                            </div>
                                            <div className={styles.deptStatItem}>
                                                <Award size={20} style={{ color: '#C0C0C0' }} />
                                                <div>
                                                    <span className={styles.deptStatValue} style={{ color: '#C0C0C0' }}>{dept.q2_count}</span>
                                                    <span className={styles.deptStatLabel}>Q2 (2024)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </motion.section>
                )}

                {/* CAROUSEL SECTION */}
                {carouselStats.length > 0 && (
                    <motion.section
                        className={styles.carousel}
                        initial={false}
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={fadeIn}
                        onMouseEnter={pauseAutoScroll}
                        onMouseLeave={resumeAutoScroll}
                    >
                        <motion.button
                            className={styles.carouselBtn}
                            whileHover={{ scale: 1.1, backgroundColor: "#5fd0f3", color: "#ffe066" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={prevCarousel}
                        >
                            ← Previous
                        </motion.button>

                        <div className={styles.carouselContent}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={carouselIdx}
                                    className={styles.carouselQuoteBox}
                                    variants={slideVariant}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                >
                                    <div className={styles.leftAccent}></div>
                                    <div className={styles.carouselQuote}>
                                        <div className={styles.statIcon}>{statIcons[carouselIdx]}</div>
                                        <h3>{carouselStats[carouselIdx].title}</h3>
                                        <hr className={styles.quoteDivider} />
                                        <p>{carouselStats[carouselIdx].description}</p>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <motion.button
                            className={styles.carouselBtn}
                            whileHover={{ scale: 1.1, backgroundColor: "#5fd0f3", color: "#ffe066" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={nextCarousel}
                        >
                            Next →
                        </motion.button>
                    </motion.section>
                )}

                {/* DEVELOPERS SECTION */}
                <motion.section
                    className={styles.developers}
                    initial={false}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={fadeIn}
                >
                    <div className={styles.backgroundElements}>
                        <div className={styles.floatingCircle1}></div>
                        <div className={styles.floatingCircle2}></div>
                        <div className={styles.floatingCircle3}></div>
                        <div className={styles.gridPattern}></div>
                    </div>
                    <div className={styles.devContentWrapper}>
                        <motion.div
                            className={styles.devTitleWrapper}
                            initial={{ y: 50, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <div className={styles.titleContainer}>
                                <motion.div className={styles.titleAccent} initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ duration: 1, delay: 0.3 }}></motion.div>
                                <h2 className={styles.verticalText}>Meet The Developers</h2>
                            </div>
                        </motion.div>

                        <motion.div className={styles.devCards} variants={stagger}>
                            {developers.map((dev, i) => (
                                <motion.div
                                    key={i}
                                    className={styles.devCard}
                                    variants={fadeInUp}
                                    whileHover={{ scale: 1.08, rotateY: 5, transition: { duration: 0.3 } }}
                                    initial={{ rotateX: 0, rotateY: 0 }}
                                >
                                    <div className={styles.cardGlow}></div>
                                    <div className={styles.particles}>
                                        <div className={styles.particle1}></div>
                                        <div className={styles.particle2}></div>
                                        <div className={styles.particle3}></div>
                                    </div>
                                    <div className={styles.devImageWrapper}>
                                        <motion.div className={styles.imageContainer} whileHover={{ rotate: 360 }} transition={{ duration: 0.8, ease: "easeInOut" }}>
                                            <div className={styles.imageBorder}>
                                                <img src={dev.img} alt={dev.name} className={styles.devImage} />
                                            </div>
                                        </motion.div>
                                        <motion.div
                                            className={styles.statusIndicator}
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        ></motion.div>
                                    </div>
                                    <motion.div
                                        className={styles.devCardContent}
                                        initial={{ y: 20, opacity: 0 }}
                                        whileInView={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: i * 0.1 }}
                                    >
                                        <div className={styles.nameContainer}>
                                            <motion.div className={styles.devName} whileHover={{ scale: 1.05 }}>{dev.name}</motion.div>
                                            <motion.div className={styles.nameUnderline} initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ duration: 0.6, delay: 0.8 + i * 0.1 }}></motion.div>
                                        </div>
                                        <motion.div className={styles.devRole} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 1 + i * 0.1 }}>
                                            <span className={styles.roleIcon}>⚡</span>{dev.role}
                                        </motion.div>
                                        <motion.div className={styles.skillBadges} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.2 + i * 0.1 }}>
                                            <span className={styles.skillBadge}>React</span>
                                            <span className={styles.skillBadge}>Node.js</span>
                                            <span className={styles.skillBadge}>TypeScript</span>
                                        </motion.div>
                                        <motion.div className={styles.socialIcons} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.4 + i * 0.1 }}>
                                            <motion.a href={dev.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${dev.name} LinkedIn`} whileHover={{ scale: 1.3, rotate: 15 }} whileTap={{ scale: 0.9 }}>
                                                <i className="fab fa-linkedin"></i>
                                            </motion.a>
                                            <motion.a href={dev.github} target="_blank" rel="noopener noreferrer" aria-label={`${dev.name} GitHub`} whileHover={{ scale: 1.3, rotate: -15 }} whileTap={{ scale: 0.9 }}>
                                                <i className="fab fa-github"></i>
                                            </motion.a>
                                        </motion.div>
                                    </motion.div>
                                    <div className={styles.hoverOverlay}></div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.section>

                {/* FACULTY MENTORS SECTION */}
                <motion.section
                    className={styles.facultyMentors}
                    initial={false}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={fadeIn}
                >
                    <div className={styles.backgroundElements}>
                        <div className={styles.floatingCircle1}></div>
                        <div className={styles.floatingCircle2}></div>
                        <div className={styles.floatingCircle3}></div>
                        <div className={styles.gridPattern}></div>
                    </div>
                    <div className={styles.devContentWrapper}>
                        <motion.div
                            className={styles.devTitleWrapper}
                            initial={{ y: 50, opacity: 0 }}
                            whileInView={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <div className={styles.titleContainer}>
                                <motion.div className={styles.titleAccent} initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ duration: 1, delay: 0.3 }}></motion.div>
                                <h2 className={styles.verticalText}>Faculty Mentors</h2>
                            </div>
                        </motion.div>

                        <motion.div className={styles.devCards} variants={stagger}>
                            {facultyMentors.map((faculty, i) => (
                                <motion.div
                                    key={i}
                                    className={styles.devCard}
                                    variants={fadeInUp}
                                    whileHover={{ scale: 1.08, rotateY: 5, transition: { duration: 0.3 } }}
                                    initial={{ rotateX: 0, rotateY: 0 }}
                                >
                                    <div className={styles.cardGlow}></div>
                                    <div className={styles.particles}>
                                        <div className={styles.particle1}></div>
                                        <div className={styles.particle2}></div>
                                        <div className={styles.particle3}></div>
                                    </div>
                                    <div className={styles.devImageWrapper}>
                                        <motion.div className={styles.imageContainer} whileHover={{ rotate: 360 }} transition={{ duration: 0.8, ease: "easeInOut" }}>
                                            <div className={styles.imageBorder}>
                                                <img src={faculty.img} alt={faculty.name} className={styles.devImage} />
                                            </div>
                                        </motion.div>
                                        <motion.div
                                            className={styles.statusIndicator}
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        ></motion.div>
                                    </div>
                                    <motion.div
                                        className={styles.devCardContent}
                                        initial={{ y: 20, opacity: 0 }}
                                        whileInView={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: i * 0.1 }}
                                    >
                                        <div className={styles.nameContainer}>
                                            <motion.div className={styles.devName} whileHover={{ scale: 1.05 }}>{faculty.name}</motion.div>
                                            <motion.div className={styles.nameUnderline} initial={{ width: 0 }} whileInView={{ width: "100%" }} transition={{ duration: 0.6, delay: 0.8 + i * 0.1 }}></motion.div>
                                        </div>
                                        <motion.div className={styles.devRole} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 1 + i * 0.1 }}>
                                            <span className={styles.roleIcon}>🎓</span>{faculty.designation}
                                        </motion.div>
                                        <motion.div className={styles.facultyEmail} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.2 + i * 0.1 }}>
                                            <Mail size={16} className={styles.emailIcon} />
                                            <a href={`mailto:${faculty.email}`}>{faculty.email}</a>
                                        </motion.div>
                                        <motion.div className={styles.mentorBadge} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.4 + i * 0.1 }}>
                                            <span className={styles.badgeText}>Project Mentor</span>
                                        </motion.div>
                                    </motion.div>
                                    <div className={styles.hoverOverlay}></div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.section>

                {/* DESCRIPTION SECTION */}
                <motion.section
                    className={styles.description}
                    initial={false}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.7 }}
                >
                    <div className={styles.footerContent}>
                        <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            Discover Research Excellence
                        </motion.div>
                        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.p variants={fadeInUp}>
                                Our platform leverages Scopus and SciVal databases to provide comprehensive research analytics.
                                Track publication trends, analyze citation patterns, identify collaboration opportunities, and measure
                                research impact across multiple dimensions including SDG contributions and global partnerships.
                            </motion.p>
                            <motion.p variants={fadeInUp}>
                                Stay ahead in academic research with real-time metrics, competitive benchmarking, and detailed
                                performance insights that help drive strategic decisions for faculty development and institutional growth.
                            </motion.p>
                        </motion.div>
                        <motion.div className={styles.benefitsGrid} variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.div className={styles.benefitCard} variants={fadeInUp}>
                                <div className={styles.benefitIcon}><FaChartBar size={32} color="#0077cc" /></div>
                                <h4>Advanced Analytics</h4>
                                <p>Deep insights into research performance with customizable dashboards and reports</p>
                            </motion.div>
                            <motion.div className={styles.benefitCard} variants={fadeInUp}>
                                <div className={styles.benefitIcon}><FaBullseye size={32} color="#0077cc" /></div>
                                <h4>SDG Mapping</h4>
                                <p>Track contributions to UN Sustainable Development Goals through research impact</p>
                            </motion.div>
                            <motion.div className={styles.benefitCard} variants={fadeInUp}>
                                <div className={styles.benefitIcon}><FaHandshake size={32} color="#0077cc" /></div>
                                <h4>Collaboration Networks</h4>
                                <p>Visualize and expand research partnerships across institutions and countries</p>
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.section>
            </div>

            {/* FOOTER */}
            <motion.footer
                className={styles.footer}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
            >
                <div className={styles.centeredFooterText}>
                    © 2025 SRM SP. All rights reserved.
                </div>
            </motion.footer>
        </div>
    );
};

export default FacultyLandingPage;