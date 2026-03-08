# 🛠️ Supabase Setup Guide

Follow these steps to set up Supabase as the backend database for CampusCare Premium.

## Step 1: Create a Supabase Project

1. Go to [Supabase.com](https://supabase.com) and sign in or create an account.
2. Click on **New Project** and select your organization.
3. Choose a name for your project (e.g., "CampusCare Database"), set a database password, and choose a region close to you.
4. Click **Create new project**.

## Step 2: Get Environment Variables

1. Once your project is ready, navigate to the **Project Settings** (gear icon on the left sidebar).
2. Go to the **API** tab under "Configuration".
3. Copy the **Project URL** and the **anon** public key.
4. Paste them into your `.env.local` file inside the CampusCare root directory:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

## Step 3: Run Database Schema SQL

1. In the Supabase dashboard sidebar, click on **SQL Editor**.
2. Click on **New query**.
3. Open the `supabase-schema.sql` file located in the root of your CampusCare code repository.
4. Copy the entire content of `supabase-schema.sql` and paste it into the Supabase SQL Editor.
5. Click the **Run** button to execute the query.
   - This script creates all necessary tables (`user_profiles`, `semesters`, `subjects`, `attendance_records`, `timetable_slots`).
   - It also automatically configures cascading deletes and establishes custom Auth0 Row Level Security (RLS) policies.

## Step 4: Finished

**You are done!** 
When you login to the CampusCare application, the local cache will automatically sync data to the Supabase tables in the background.
