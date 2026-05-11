![Project Screenshot](./images/demo.png)
# 🚀 DevSecOps Worker Verification & Hiring System

A full-stack backend system for verifying workers, managing documents, and enabling customers to hire trusted workers.

---

# 📦 Tech Stack

* Node.js
* Express.js
* MongoDB (Mongoose)
* REST APIs

---

# ⚙️ Backend Setup (Step-by-Step)

## 1️⃣ Clone the Repository

```bash
git clone YOUR_REPO_URL
cd backend
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Create `.env` File

Create a `.env` file in the root folder:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
```

---

## 4️⃣ Start the Server

```bash
npm run dev
```

👉 Server will run at:

```
http://localhost:5000
```

---

# 📁 Folder Structure

```
backend/
│
├── models/
├── routes/
├── controllers/
├── middleware/
├── uploads/
├── server.js
└── .env
```

---

# 🔗 API Endpoints

## 🔐 Auth APIs

### Register User

```
POST /api/auth/register
```

Body:

```json
{
  "name": "Ravi",
  "email": "ravi@gmail.com",
  "password": "1234",
  "role": "customer"
}
```

---

### Login User

```
POST /api/auth/login
```

Body:

```json
{
  "email": "ravi@gmail.com",
  "password": "1234"
}
```

---

## 👷 Worker APIs

### Create Worker Profile

```
POST /api/workers/create-profile
```

Body:

```json
{
  "userId": "USER_ID",
  "category": "plumber",
  "experience": 5,
  "location": "Bangalore"
}
```

---

### Get Verified Workers

```
GET /api/workers/verified
```

---

### Get Worker by ID

```
GET /api/workers/:id
```

---

## 📄 Document APIs

### Upload Document

```
POST /api/documents/upload
```

Form Data:

* file
* documentType
* userId

---

### Verify Document

```
PATCH /api/documents/verify/:id
```

---

## 💼 Job APIs

### Create Job

```
POST /api/jobs/create
```

Body:

```json
{
  "customerId": "USER_ID",
  "workerId": "USER_ID",
  "description": "Need plumbing work",
  "address": "Bangalore",
  "scheduledTime": "2026-04-10T10:00:00"
}
```

---

### Accept Job

```
PATCH /api/jobs/accept/:jobId
```

---

### Complete Job

```
PATCH /api/jobs/complete/:jobId
```

---

# 🧪 Testing APIs (Postman)

## Example Flow:

1. Register User
2. Login
3. Create Worker Profile
4. Upload Document
5. Verify Document
6. Create Job

---

# 🗄️ Database Check

Open MongoDB shell:

```bash
db.users.find()
db.workerprofiles.find()
db.documents.find()
db.jobs.find()
```

---

# ⚠️ Important Notes

* `userId` = from users collection
* `workerId` = also user._id (NOT workerprofile._id)
* Always login before creating jobs

---

# 💡 Features

* Worker verification system
* Document upload & approval
* Job booking system
* Trust score logic
* Role-based access

---

# 👨‍💻 Author

Built with ❤️ as a full-stack DevSecOps project

---

# 🛡️ DevSecOps & Monitoring

This project includes a comprehensive DevSecOps pipeline with industry-standard tools for security, quality, and observability.

## 🚀 CI/CD Pipeline (GitHub Actions)
The pipeline is automated via GitHub Actions and consists of:
1.  **🔍 Linting**: ESLint for both Frontend and Backend.
2.  **🧪 Testing**: Unit and Integration tests with Jest.
3.  **📊 Coverage**: Code coverage reports uploaded as artifacts.
4.  **🛡️ SAST (CodeQL)**: GitHub's Static Application Security Testing.
5.  **🔍 SonarQube**: Advanced code quality and security hotspot analysis.
6.  **🐳 Docker Build**: Automated containerization.
7.  **🔍 Trivy Scan**: Vulnerability scanning for Docker images and the filesystem.

## 📊 Monitoring & Observability
Real-time monitoring is implemented using the Prometheus stack:
- **Prometheus**: Collects metrics from the backend and system.
- **Grafana**: Visualizes metrics through interactive dashboards.
- **Node Exporter**: Provides hardware and OS-level metrics.

### Accessing Dashboards
When running via Docker Compose, access these services at:
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (User: `admin`, Pass: `admin`)
- **Backend Metrics**: `http://localhost:5001/api/metrics`

### Running the Stack
To start the entire application with monitoring:
```bash
docker compose up -d
```

---

# 🔑 Required Secrets
To enable the full pipeline in GitHub, add the following secrets to your repository:
- `SONAR_TOKEN`: Your SonarQube/SonarCloud token.
- `SONAR_HOST_URL`: The URL of your SonarQube instance.
- `GITHUB_TOKEN`: (Automatically provided by GitHub).
