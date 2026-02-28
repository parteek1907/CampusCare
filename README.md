# 📘 CampusCare

> Academic Tracking Made Simple

CampusCare is a student-focused academic management platform built as part of the **Transforming Ideas to Innovation (TII)** course.
The project follows a complete **Design Thinking process**, moving from empathy research to problem definition and implementation.

CampusCare helps students maintain continuous visibility of their academic standing, reducing last-minute stress caused by unclear attendance and performance tracking.

---

## 🚀 Live Demo

💻 GitHub: [parteek1907/CampusCare](https://github.com/parteek1907/CampusCare)

---

## 📌 Problem Statement

Students often realize academic risks (attendance shortage, performance gaps) too late due to:

* Irregular tracking
* Fragmented academic information
* Lack of clarity in evaluation patterns
* Reactive academic behavior

CampusCare was built to provide structured academic visibility and proactive tracking.

---

## ✨ Features

* 🔐 Secure User Authentication (Auth0)
* 📚 Semester Management
* 🧾 Subject Configuration (Credits, Internal/External marks)
* 📅 Weekly Timetable Builder
* 📊 Attendance Tracking (Theory / Lab / Tutorial)
* 📝 Absence Reason Logging
* 📈 Attendance Analytics Dashboard
* 📊 Absence Insights Visualization
* 🧮 CGPA Calculator (Marks-based & Grade-based)
* 🔄 What-If Attendance Simulation
* ➕ Extra Class Addition
* 📆 Calendar-Based Attendance Overview
* 💾 Persistent Cloud Database Storage
* 📱 Responsive UI Design
* 📄 PDF Report Generation

---

## 🧠 Design Thinking Approach

This project strictly followed the Design Thinking framework:

1. **Empathize** – Conducted surveys & interviews
2. **Define** – Framed root problem using insights
3. **Ideate** – Designed solution structure
4. **Prototype** – Developed working platform
5. **Test** – Iterative refinements & bug fixes

---

## 🏗️ Tech Stack

**Frontend:**
* HTML5 / CSS3 / TypeScript
* Vite (Build Tool)

**Security / Authentication:**
* Auth0 

**Testing:**
* Playwright (E2E Testing)

---

## 📂 Project Structure

```
CampusCare/
│
├── public/                 # Static assets
├── src/
│   ├── features/           # Feature modules (auth, attendance, etc.)
│   ├── ui/                 # Reusable UI components
│   ├── style.css           # Global typography and theme configurations
│   └── main.ts             # Application entry point
│
├── playwright.config.ts    # E2E test configuration
├── package.json            # Dependencies and scripts
└── README.md
```

---

## ⚙️ Installation & Setup

Clone the repository:

```bash
git clone https://github.com/parteek1907/CampusCare.git
cd CampusCare
```

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

---

## 🔒 Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-client-id
```

---

## 📊 Screenshots

*(Add screenshots here)*

* Landing Page
* Dashboard
* Attendance Tracking
* Analytics View

---

## 📈 Future Improvements

* Notification System
* Performance Prediction Model
* AI-based Academic Insights
* Mobile App Version

---

## 📜 License

This project is developed for academic purposes under TII course.
Open-source for learning and demonstration.
