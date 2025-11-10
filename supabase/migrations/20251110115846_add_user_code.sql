-- Add 4-letter code field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Create unique index on code (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_code_unique_idx 
ON public.profiles (UPPER(code)) 
WHERE code IS NOT NULL;

-- Add constraint to ensure code is exactly 4 characters when provided
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_code_length_check 
CHECK (code IS NULL OR LENGTH(code) = 4);

-- Update handle_new_user trigger to include code from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_code TEXT;
BEGIN
  -- Extract and validate code from metadata
  user_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'code', '')));
  IF user_code = '' OR LENGTH(user_code) != 4 THEN
    user_code := NULL;
  END IF;
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, role, code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'planner',
    user_code
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'planner');
  
  RETURN NEW;
END;
$$;

