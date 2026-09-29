# NeuroCal
# NeuroCal AI 🧠⚡

NeuroCal AI is a next-generation bio-feedback and health optimization platform. It bridges the gap between metabolic tracking (calorie/macro logging) and cognitive performance by treating the human body as an interconnected system. 

By analyzing food intake via AI computer vision, tracking circadian rhythms, and monitoring user stress/focus, NeuroCal provides personalized, dynamically generated protocols and product recommendations to optimize peak mental and physical performance.

---

## 🌟 Core Features

- **📸 Calorie & Macro Vision AI:** Frictionless meal logging using OpenAI `gpt-4o` to estimate macros, calories, and flag high glycemic loads from a single photo.
- **🧠 Cognitive & Stress Scoring Engine:** An AI agent that analyzes sleep telemetry, diet, and self-reported stress to generate a daily baseline Focus Score.
- **🌙 Circadian Telemetry:** Correlates late-night screen time and delayed eating with melatonin suppression and weight plateaus.
- **🥗 Dynamic Recipe Routing:** Evaluates daily macro gaps and uses Anthropic's `Claude 3.5 Haiku` to generate optimized search queries, fetching perfectly matched recipes from trusted biohacking domains.
- **🧬 Vector-Based Recommendations:** Uses PostgreSQL `pgvector` (HNSW) to mathematically match user biological failure points (e.g., "poor deep sleep") to specific digital protocols or affiliate hardware (e.g., Eight Sleep, MitoProof supplements).

---

## 🏗️ Architecture & Tech Stack

This project is structured as a **Monorepo** containing three core environments:

- **Backend (`/backend`):** AWS Serverless Node.js API (Lambda, API Gateway) built on Hexagonal / Clean Architecture principles.
- **Database:** Amazon Aurora PostgreSQL Serverless v2 + `pgvector` (Managed via Drizzle ORM).
- **Web App (`/web-poc`):** Next.js & React (Tailwind CSS) for the progressive web app proof of concept.
- **Mobile App (`/mobile-app`):** Flutter application for native iOS and Android deployment.

---

## 📂 Repository Structure

```text
neurocal-workspace/
├── backend/          # Node.js Serverless API (Hexagonal Architecture)
├── web-poc/          # Next.js Web Application
├── mobile-app/       # Flutter Mobile Application
├── ARCHITECTURE.md   # Deep-dive system specs, schemas, and AI prompts
├── CLAUDE.md         # Instructions for AI coding agents
└── README.md         # Project overview and setup guide