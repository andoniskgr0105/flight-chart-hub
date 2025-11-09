-- Create enum for aircraft status
CREATE TYPE aircraft_status AS ENUM ('active', 'maintenance', 'inactive');

-- Create enum for flight status
CREATE TYPE flight_status AS ENUM ('scheduled', 'in_flight', 'completed', 'cancelled', 'delayed');

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('admin', 'controller', 'planner');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role DEFAULT 'planner',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create aircraft table
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  aircraft_type TEXT NOT NULL,
  status aircraft_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on aircraft
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

-- Aircraft policies
CREATE POLICY "Authenticated users can view aircraft"
  ON public.aircraft FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can insert aircraft"
  ON public.aircraft FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'controller')
    )
  );

CREATE POLICY "Admins and controllers can update aircraft"
  ON public.aircraft FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'controller')
    )
  );

CREATE POLICY "Admins can delete aircraft"
  ON public.aircraft FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create flight_routes table
CREATE TABLE public.flight_routes (
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

-- Flight routes policies
CREATE POLICY "Authenticated users can view routes"
  ON public.flight_routes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Planners can insert routes"
  ON public.flight_routes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Planners can update routes"
  ON public.flight_routes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

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

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_aircraft_updated_at
  BEFORE UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample aircraft data
INSERT INTO public.aircraft (registration, aircraft_type, status) VALUES
  ('N123AB', 'Boeing 737-800', 'active'),
  ('N456CD', 'Airbus A320', 'active'),
  ('N789EF', 'Boeing 787-9', 'active'),
  ('N321GH', 'Airbus A350', 'maintenance'),
  ('N654IJ', 'Boeing 777-300ER', 'active');

-- Insert sample flight routes (for the next 2 days)
INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'AA' || (100 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N123AB'),
  'JFK',
  'LAX',
  NOW() + (seq || ' hours')::INTERVAL,
  NOW() + (seq + 5 || ' hours')::INTERVAL,
  'scheduled'
FROM generate_series(1, 3) AS seq;

INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'DL' || (200 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N456CD'),
  'ATL',
  'ORD',
  NOW() + (seq * 6 || ' hours')::INTERVAL,
  NOW() + (seq * 6 + 2 || ' hours')::INTERVAL,
  'scheduled'
FROM generate_series(1, 4) AS seq;

INSERT INTO public.flight_routes (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, status)
SELECT 
  'UA' || (300 + seq),
  (SELECT id FROM public.aircraft WHERE registration = 'N789EF'),
  'SFO',
  'NRT',
  NOW() + (seq * 12 || ' hours')::INTERVAL,
  NOW() + (seq * 12 + 11 || ' hours')::INTERVAL,
  'scheduled'
FROM generate_series(1, 2) AS seq;