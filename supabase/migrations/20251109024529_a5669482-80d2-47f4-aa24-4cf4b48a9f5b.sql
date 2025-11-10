-- Create enum for aircraft status (if not exists)
DO $$ BEGIN
    CREATE TYPE aircraft_status AS ENUM ('active', 'maintenance', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for flight status (if not exists)
DO $$ BEGIN
    CREATE TYPE flight_status AS ENUM ('scheduled', 'in_flight', 'completed', 'cancelled', 'delayed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for user roles (if not exists)
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'controller', 'planner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role DEFAULT 'planner',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies (drop if exists to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create aircraft table (if not exists)
CREATE TABLE IF NOT EXISTS public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  aircraft_type TEXT NOT NULL,
  status aircraft_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on aircraft
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

-- Aircraft policies (drop if exists to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can view aircraft" ON public.aircraft;
CREATE POLICY "Authenticated users can view aircraft"
  ON public.aircraft FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and controllers can insert aircraft" ON public.aircraft;
CREATE POLICY "Admins and controllers can insert aircraft"
  ON public.aircraft FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'controller')
    )
  );

DROP POLICY IF EXISTS "Admins and controllers can update aircraft" ON public.aircraft;
CREATE POLICY "Admins and controllers can update aircraft"
  ON public.aircraft FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'controller')
    )
  );

DROP POLICY IF EXISTS "Admins can delete aircraft" ON public.aircraft;
CREATE POLICY "Admins can delete aircraft"
  ON public.aircraft FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create flight_routes table (if not exists)
CREATE TABLE IF NOT EXISTS public.flight_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number TEXT NOT NULL,
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  status flight_status DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_times CHECK (arrival_time > departure_time)
);

-- Enable RLS on flight_routes
ALTER TABLE public.flight_routes ENABLE ROW LEVEL SECURITY;

-- Flight routes policies (drop if exists to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can view routes" ON public.flight_routes;
CREATE POLICY "Authenticated users can view routes"
  ON public.flight_routes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Planners can insert routes" ON public.flight_routes;
CREATE POLICY "Planners can insert routes"
  ON public.flight_routes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Planners can update routes" ON public.flight_routes;
CREATE POLICY "Planners can update routes"
  ON public.flight_routes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and controllers can delete routes" ON public.flight_routes;
CREATE POLICY "Admins and controllers can delete routes"
  ON public.flight_routes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'controller')
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at (drop if exists to avoid conflicts)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_aircraft_updated_at ON public.aircraft;
CREATE TRIGGER update_aircraft_updated_at
  BEFORE UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_flight_routes_updated_at ON public.flight_routes;
CREATE TRIGGER update_flight_routes_updated_at
  BEFORE UPDATE ON public.flight_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'planner'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample aircraft data (only if not exists)
INSERT INTO public.aircraft (registration, aircraft_type, status) 
SELECT * FROM (VALUES
  ('N123AB', 'Boeing 737-800', 'active'::aircraft_status),
  ('N456CD', 'Airbus A320', 'active'::aircraft_status),
  ('N789EF', 'Boeing 787-9', 'active'::aircraft_status),
  ('N321GH', 'Airbus A350', 'maintenance'::aircraft_status),
  ('N654IJ', 'Boeing 777-300ER', 'active'::aircraft_status)
) AS v(registration, aircraft_type, status)
WHERE NOT EXISTS (SELECT 1 FROM public.aircraft WHERE aircraft.registration = v.registration);

-- Insert sample flight routes (for the next 2 days) - only if not exists
INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'AA' || (100 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N123AB'),
  'JFK',
  'LAX',
  NOW() + (seq || ' hours')::INTERVAL,
  NOW() + (seq + 5 || ' hours')::INTERVAL,
  'scheduled'::flight_status
FROM generate_series(1, 3) AS seq
WHERE NOT EXISTS (SELECT 1 FROM public.flight_routes WHERE flight_number = 'AA' || (100 + seq));

INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'DL' || (200 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N456CD'),
  'ATL',
  'ORD',
  NOW() + (seq * 6 || ' hours')::INTERVAL,
  NOW() + (seq * 6 + 2 || ' hours')::INTERVAL,
  'scheduled'::flight_status
FROM generate_series(1, 4) AS seq
WHERE NOT EXISTS (SELECT 1 FROM public.flight_routes WHERE flight_number = 'DL' || (200 + seq));

INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'UA' || (300 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N789EF'),
  'SFO',
  'NRT',
  NOW() + (seq * 12 || ' hours')::INTERVAL,
  NOW() + (seq * 12 + 11 || ' hours')::INTERVAL,
  'scheduled'::flight_status
FROM generate_series(1, 2) AS seq
WHERE NOT EXISTS (SELECT 1 FROM public.flight_routes WHERE flight_number = 'UA' || (300 + seq));