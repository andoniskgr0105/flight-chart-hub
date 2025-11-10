# AIMS - Aircraft Flight Management System

Aviation Information Management System for managing aircraft flight routes and schedules with Gantt chart visualization.

## Tech Stack

This project is built with:

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React** - UI library
- **Supabase** - Backend as a Service (Database, Auth, Storage)
- **shadcn-ui** - High-quality React components
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing

## Prerequisites

- Node.js 18+ and npm (or use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A Supabase account and project

## Getting Started

### 1. Clone the Repository

```sh
git clone <YOUR_GIT_URL>
cd flight-chart-hub
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon/public key from Project Settings > API
3. Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 4. Run Database Migrations

The project includes Supabase migrations in the `supabase/migrations/` directory. To apply them:

**Option A: Using Supabase CLI (Recommended)**

```sh
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

**Option B: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order:
   - `20251109024529_a5669482-80d2-47f4-aa24-4cf4b48a9f5b.sql`
   - `20251109035434_7fd0d034-1cb5-40a7-8a33-b38819659fbf.sql`
   - `20251110115846_add_user_code.sql`

### 5. Start Development Server

```sh
npm run dev
```

The app will be available at `http://localhost:8080`

## Project Structure

```
flight-chart-hub/
├── src/
│   ├── components/      # React components
│   ├── pages/          # Page components
│   ├── integrations/   # Supabase client and types
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utility functions
├── supabase/
│   ├── migrations/    # Database migrations
│   └── config.toml     # Supabase project config
└── public/             # Static assets
```

## Features

- **User Authentication**: Sign up and login with email/password or 4-letter code
- **Aircraft Management**: Add, edit, and manage aircraft
- **Flight Route Planning**: Create and manage flight routes with Gantt chart visualization
- **Role-Based Access**: Admin, Controller, and Planner roles with different permissions

## Building for Production

```sh
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

You can deploy this application to any static hosting service:

- **Vercel**: Connect your GitHub repo and deploy
- **Netlify**: Connect your GitHub repo and deploy
- **Supabase Hosting**: Use Supabase's built-in hosting
- **Any static host**: Upload the `dist/` folder after building

Make sure to set your environment variables in your hosting platform's settings.

## Environment Variables

Required environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles with email, name, role, and 4-letter code
- `aircraft` - Aircraft information (registration, type, status)
- `flight_routes` - Flight schedules with origin, destination, and times
- `user_roles` - User role assignments

## License

This project is private and proprietary.
