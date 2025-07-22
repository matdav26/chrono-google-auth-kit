import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EventCreationProps {
  projectId: string;
  onEventCreated?: () => void;
}

export const EventCreation = ({ projectId, onEventCreated }: EventCreationProps) => {
  const [open, setOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateEvent = async () => {
    if (!eventName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event name",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase
        .from('events')
        .insert({
          project_id: projectId,
          event_name: eventName.trim(),
          event_description: eventDescription.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      setOpen(false);
      setEventName('');
      setEventDescription('');
      onEventCreated?.();
    } catch (err) {
      console.error('Error creating event:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Project Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eventName">Event Name *</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Meeting with Sandra"
              maxLength={100}
            />
          </div>
          
          <div>
            <Label htmlFor="eventDescription">Description (Optional)</Label>
            <Textarea
              id="eventDescription"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Additional details about the event..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Event
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};