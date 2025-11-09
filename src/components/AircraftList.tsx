import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AircraftDialog from "./AircraftDialog";

interface Aircraft {
  id: string;
  registration: string;
  aircraft_type: string;
  status: "active" | "maintenance" | "inactive";
}

const AircraftList = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);

  const fetchAircraft = async () => {
    try {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .order("registration");

      if (error) throw error;
      setAircraft(data || []);
    } catch (error: any) {
      toast.error("Failed to load aircraft");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAircraft();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("aircraft")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Aircraft deleted successfully");
      fetchAircraft();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete aircraft");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/20 text-success border-success/30";
      case "maintenance":
        return "bg-warning/20 text-warning border-warning/30";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading aircraft...</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Aircraft Fleet</h2>
          <p className="text-sm text-muted-foreground">Manage your aircraft inventory</p>
        </div>
        <Button onClick={() => { setSelectedAircraft(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Aircraft
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {aircraft.map((item) => (
          <Card key={item.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{item.registration}</CardTitle>
                  <CardDescription>{item.aircraft_type}</CardDescription>
                </div>
                <Badge className={getStatusColor(item.status)} variant="outline">
                  {item.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => { setSelectedAircraft(item); setDialogOpen(true); }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AircraftDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        aircraft={selectedAircraft}
        onSuccess={fetchAircraft}
      />
    </>
  );
};

export default AircraftList;
