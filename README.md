# WorkFlow Tracker

A comprehensive workflow and production management system built for manufacturing companies to track tasks, manage teams, monitor machine production, and handle employee leave.

**Built by Pragadeesh V**

## Features

### Role-Based Access (4 Roles)
- **Admin** - Full system access, settings, PIN management
- **Manager** - Full access like Admin, created by Admin
- **Supervisor** - Team management, task assignment, QC approval
- **Employee** - View assigned tasks, update status

### Task Management
- Create, edit, delete tasks with priority (High/Medium/Low)
- Assign tasks to supervisors and employees
- Status tracking: Pending, In Progress, Done, Delayed, On Hold, Cancelled
- Task detail view with comments, activity log, and attachments
- Real-time updates via Supabase

### Production Tracking
- **Machine Types** - Create templates with departments and predefined tasks
- **Projects** - Create from templates, auto-populate tasks per department
- **Department-wise Progress** - Per-department and overall completion percentage
- **QC Workflow** - Employee completes task → Supervisor/Manager QC (Pass/Reject)
- **Template Sync** - New tasks added to templates auto-sync to active projects
- Add/delete tasks in existing projects

### Team Management
- Managers, Supervisors, Employees in one page with tabs
- Department-based filtering and grouping
- Supervisor reports to multiple managers
- PIN-based authentication for all roles
- Phone numbers, designations, department tracking

### Leave Management
- Apply for leave (Casual, Sick, Earned, Compensatory, Other)
- Approve/Reject with comments
- This week's leave overview
- Calendar integration showing leaves alongside tasks

### Calendar
- Monthly view with tasks and leaves
- Color-coded dots for status
- Click date to view details
- Role-based filtering

### Analytics
- Tasks per Supervisor (bar chart)
- Completion Rate (donut chart)
- Overdue Trend (7-day line chart)
- Priority Breakdown (pie chart)
- Date range filter

### Data Management
- Export all data as JSON or CSV/Excel (16 tables)
- Import data from JSON backup
- Real-time sync every 60 seconds + Supabase Realtime

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Deployment**: Vercel

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Neverdopraga/workflow-tracker.git
cd workflow-tracker
npm install
```

### 2. Setup Supabase
- Create a project at [supabase.com](https://supabase.com)
- Run the SQL from `supabase-schema.sql` in SQL Editor
- Copy your project URL and anon key

### 3. Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Default Login
- **Admin PIN**: `1234`

## Database Schema

16 tables: `managers`, `supervisors`, `employees`, `tasks`, `leave_requests`, `notifications`, `comments`, `activity_log`, `attachments`, `settings`, `user_roles`, `machine_types`, `machine_type_departments`, `machine_type_tasks`, `projects`, `project_tasks`

See `supabase-schema.sql` for full schema.

## Deployment

Push to `main` branch → Vercel auto-deploys.

## License

Private project. All rights reserved.
