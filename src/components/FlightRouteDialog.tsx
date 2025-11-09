import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Aircraft {
  id: string;
  registration: string;
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

interface FlightRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: FlightRoute | null;
  aircraft: Aircraft[];
  onSuccess: () => void;
}

const FlightRouteDialog = ({ open, onOpenChange, route, aircraft, onSuccess }: FlightRouteDialogProps) => {
  const [formData, setFormData] = useState({
    flight_number: "",
    aircraft_id: "",
    origin: "",
    destination: "",
    departure_time: "",
    arrival_time: "",
    status: "scheduled" as "scheduled" | "in_flight" | "completed" | "cancelled" | "delayed",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (route) {
      setFormData({
        flight_number: route.flight_number,
        aircraft_id: route.aircraft_id,
        origin: route.origin,
        destination: route.destination,
        departure_time: new Date(route.departure_time).toISOString().slice(0, 16),
        arrival_time: new Date(route.arrival_time).toISOString().slice(0, 16),
        status: route.status,
      });
    } else {
      setFormData({
        flight_number: "",
        aircraft_id: aircraft[0]?.id || "",
        origin: "",
        destination: "",
        departure_time: "",
        arrival_time: "",
        status: "scheduled",
      });
    }
  }, [route, aircraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        departure_time: new Date(formData.departure_time).toISOString(),
        arrival_time: new Date(formData.arrival_time).toISOString(),
      };

      if (route) {
        const { error } = await supabase
          .from("flight_routes")
          .update(data)
          .eq("id", route.id);

        if (error) throw error;
        toast.success("Flight updated successfully");
      } else {
        const { error } = await supabase
          .from("flight_routes")
          .insert([data]);

        if (error) throw error;
        toast.success("Flight added successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save flight");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{route ? "Edit Flight" : "Add Flight"}</DialogTitle>
          <DialogDescription>
            {route ? "Update flight route details" : "Schedule a new flight route"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flight_number">Flight Number</Label>
              <Input
                id="flight_number"
                value={formData.flight_number}
                onChange={(e) => setFormData({ ...formData, flight_number: e.target.value })}
                placeholder="AA101"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aircraft">Aircraft</Label>
              <Select 
                value={formData.aircraft_id} 
                onValueChange={(value) => setFormData({ ...formData, aircraft_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="JFK"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="LAX"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departure_time">Departure Time</Label>
              <Input
                id="departure_time"
                type="datetime-local"
                value={formData.departure_time}
                onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrival_time">Arrival Time</Label>
              <Input
                id="arrival_time"
                type="datetime-local"
                value={formData.arrival_time}
                onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_flight">In Flight</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : route ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FlightRouteDialog;
