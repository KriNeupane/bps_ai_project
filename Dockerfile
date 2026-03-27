# Stage 1: Build the React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm install
COPY ui/ ./
RUN npm run build

# Stage 2: Setup the Python Backend & Playwright Engine
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy
WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source code
COPY . .

# Copy the built React app from Stage 1 into the backend's static directory
COPY --from=frontend-builder /app/ui/dist /app/ui/dist

# Expose the single web server port
EXPOSE 8000

# Start the unified FastAPI server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
