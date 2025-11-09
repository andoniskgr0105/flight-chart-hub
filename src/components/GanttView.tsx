import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours, startOfDay, endOfDay, addDays } from "date-fns";
import FlightRouteDialog from "./FlightRouteDialog";

interface Aircraft {
  id: string;
  registration: string;
  aircraft_type: string;
}

interface FlightRoute {
  id: string;
  flight_number: string;
  aircraft_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  status: "scheduled" | "in_flight" | "completed" | "cancelled" | "delayed";
}

const GanttView = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [routes, setRoutes] = useState<FlightRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null);

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(addDays(now, 1));

  const fetchData = async () => {
    try {
      const [aircraftRes, routesRes] = await Promise.all([
        supabase.from("aircraft").select("*").eq("status", "active").order("registration"),
        supabase.from("flight_routes").select("*").order("departure_time")
      ]);

      if (aircraftRes.error) throw aircraftRes.error;
      if (routesRes.error) throw routesRes.error;

      setAircraft(aircraftRes.data || []);
      setRoutes(routesRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-primary/20 text-primary border-primary/30";
      case "in_flight":
        return "bg-success/20 text-success border-success/30";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "delayed":
        return "bg-warning/20 text-warning border-warning/30";
      case "cancelled":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted";
    }
  };

  const getFlightPosition = (departureTime: string, arrivalTime: string) => {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    
    const totalHours = differenceInHours(dayEnd, dayStart);
    const startOffset = differenceInHours(departure, dayStart);
    const duration = differenceInHours(arrival, departure);
    
    const left = (startOffset / totalHours) * 100;
    const width = (duration / totalHours) * 100;
    
    return { left: `${Math.max(0, left)}%`, width: `${Math.max(2, width)}%` };
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading schedule...</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Flight Schedule</h2>
          <p className="text-sm text-muted-foreground">Gantt chart view of all flights</p>
        </div>
        <Button onClick={() => { setSelectedRoute(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Flight
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline View</CardTitle>
          <CardDescription>
            {format(dayStart, "MMM dd, yyyy")} - {format(dayEnd, "MMM dd, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Time Header */}
            <div className="flex border-b border-border pb-2">
              <div className="w-48 font-semibold text-sm">Aircraft</div>
              <div className="flex-1 flex justify-between text-xs text-muted-foreground px-2">
                {Array.from({ length: 25 }, (_, i) => (
                  <span key={i}>{i}:00</span>
                ))}
              </div>
            </div>

            {/* Gantt Rows */}
            {aircraft.map((ac) => {
              const aircraftRoutes = routes.filter((r) => r.aircraft_id === ac.id);
              
              return (
                <div key={ac.id} className="flex items-center border-b border-border/50 pb-4">
                  <div className="w-48 pr-4">
                    <div className="font-semibold text-sm">{ac.registration}</div>
                    <div className="text-xs text-muted-foreground">{ac.aircraft_type}</div>
                  </div>
                  <div className="flex-1 relative h-12 bg-muted/30 rounded">
                    {aircraftRoutes.map((route) => {
                      const { left, width } = getFlightPosition(
                        route.departure_time,
                        route.arrival_time
                      );
                      
                      return (
                        <div
                          key={route.id}
                          className="absolute h-10 top-1 cursor-pointer group"
                          style={{ left, width }}
                          onClick={() => { setSelectedRoute(route); setDialogOpen(true); }}
                        >
                          <Badge
                            className={`${getStatusColor(route.status)} w-full h-full flex flex-col items-center justify-center p-1 text-xs`}
                            variant="outline"
                          >
                            <span className="font-semibold truncate w-full text-center">
                              {route.flight_number}
                            </span>
                            <span className="text-[10px] truncate w-full text-center">
                              {route.origin} → {route.destination}
                            </span>
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <FlightRouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={selectedRoute}
        aircraft={aircraft}
        onSuccess={fetchData}
      />
    </>
  );
};

export default GanttView;
