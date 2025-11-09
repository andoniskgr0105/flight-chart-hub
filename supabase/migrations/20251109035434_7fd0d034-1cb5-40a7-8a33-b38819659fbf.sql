-- Step 1: Create user_roles table with proper constraints
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Step 2: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 4: Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for user_roles (admin-only management)
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Step 6: Update aircraft RLS policies to use has_role function
DROP POLICY IF EXISTS "Admins and controllers can insert aircraft" ON public.aircraft;
CREATE POLICY "Admins and controllers can insert aircraft"
  ON public.aircraft
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'controller')
  );

DROP POLICY IF EXISTS "Admins and controllers can update aircraft" ON public.aircraft;
CREATE POLICY "Admins and controllers can update aircraft"
  ON public.aircraft
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'controller')
  );

DROP POLICY IF EXISTS "Admins can delete aircraft" ON public.aircraft;
CREATE POLICY "Admins can delete aircraft"
  ON public.aircraft
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 7: Update flight_routes RLS policies to use has_role function
DROP POLICY IF EXISTS "Admins and controllers can delete routes" ON public.flight_routes;
CREATE POLICY "Admins and controllers can delete routes"
  ON public.flight_routes
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'controller')
  );

-- Step 8: Fix profiles UPDATE policy to prevent role escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from modifying their role column
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = role
  );

-- Step 9: Update handle_new_user trigger to populate user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'planner'
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'planner');
  
  RETURN NEW;
END;
$$;