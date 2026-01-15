-- Migration: 00010_profile_columns.sql
-- Description: Add missing columns to profiles table for admin features

-- Add email column (synced from auth.users for admin queries)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Add last_login column for tracking user activity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Create index on subscription_tier for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- Create index on last_login for activity queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login);

-- Update the handle_new_user function to also copy email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles with email from auth.users
-- This runs once during migration
DO $$
BEGIN
  UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS NULL;
END $$;

-- Function to update last_login on sign in
-- This can be called from client or edge function
CREATE OR REPLACE FUNCTION update_last_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET last_login = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_last_login(UUID) TO authenticated;
