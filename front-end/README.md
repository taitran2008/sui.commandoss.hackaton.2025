# SUI Task Management System

A modern, responsive task management application built with **Next.js 15**, **TypeScript**, and **Tailwind CSS** for the SUI blockchain ecosystem.

## Features

### ✨ Core Functionality
- **Create Tasks**: Add new tasks with detailed information
- **Manage Tasks**: Mark tasks as complete/incomplete, delete tasks
- **Filter & Sort**: Filter by status (all/active/completed) and sort by date, urgency, or reward
- **Statistics Dashboard**: View task metrics and total rewards
- **UUID Management**: Properly handles backend JSON with `uuid` field names

### 🎯 Task Object Structure
The application correctly handles the task object format you provided:

```json
{
  "uuid": "job-1748762754972-duk1yulf34",
  "task": "translation", 
  "description": "Translate 100 words into French",
  "category": "language",
  "urgency": "standard",
  "submitter": "0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de",
  "timestamp": "2025-06-01T07:25:54.972Z",
  "estimated_duration": "30 minutes",
  "reward_amount": "0.1 SUI"
}
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks (useState, useEffect)
- **Architecture**: Component-based with utility functions

## UUID Handling

### Backend Compatibility
The application correctly parses the `uuid` field from backend responses and handles the invalid JSON key name issue you mentioned.

### Generation
Creates unique UUIDs in format: `job-{timestamp}-{random}`

### Display
Shows truncated UUIDs in cards with full UUID visible

## Key Components

- **TaskList**: Main interface with filtering and sorting
- **TaskForm**: Create new tasks with validation
- **TaskCard**: Individual task display with actions
- **API Layer**: Mock backend functions for development

**Built with ❤️ for the SUI ecosystem**
