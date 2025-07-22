import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface TimelineItem {
  id: string;
  type: 'event' | 'file';
  title: string;
  description?: string;
  date: string;
  details?: any;
}

interface HorizontalTimelineProps {
  projectId: string;
}

export const HorizontalTimeline = ({ projectId }: HorizontalTimelineProps) => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTimelineItems();

    // Subscribe to real-time updates for both events and documents
    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTimelineItems();
        }
      )
      .subscribe();

    const documentsChannel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTimelineItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(documentsChannel);
    };
  }, [projectId]);

  const fetchTimelineItems = async () => {
    try {
      // Fetch events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch documents (only uploaded files, not just any activity)
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // Combine and sort by date
      const timelineItems: TimelineItem[] = [
        ...(events || []).map(event => ({
          id: event.id,
          type: 'event' as const,
          title: event.event_name,
          description: event.event_description,
          date: event.created_at,
        })),
        ...(documents || []).map(doc => ({
          id: doc.id,
          type: 'file' as const,
          title: doc.filename,
          description: `${doc.doc_type.toUpperCase()} file uploaded`,
          date: doc.uploaded_at,
          details: { doc_type: doc.doc_type, raw_text: doc.raw_text },
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(timelineItems);
    } catch (err) {
      console.error('Error fetching timeline items:', err);
    } finally {
      setLoading(false);
    }
  };

  const getItemIcon = (item: TimelineItem) => {
    if (item.type === 'event') {
      return <Calendar className="h-4 w-4 text-blue-500" />;
    } else {
      return item.details?.doc_type === 'url' ? 
        <ExternalLink className="h-4 w-4 text-green-500" /> : 
        <FileText className="h-4 w-4 text-green-500" />;
    }
  };

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === 'file' && item.details?.doc_type === 'url' && item.details?.raw_text) {
      window.open(item.details.raw_text, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4 text-center text-muted-foreground">
          No events or file uploads yet. Create an event or upload a document to see timeline items.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-foreground mb-1">Project Timeline</h3>
          <p className="text-xs text-muted-foreground">Major milestones and file uploads</p>
        </div>
        <ScrollArea className="w-full">
          <div className="flex space-x-4 pb-2" style={{ minWidth: `${items.length * 220}px` }}>
            {items.map((item, index) => (
              <div 
                key={item.id} 
                className={`flex-shrink-0 w-52 p-3 border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors ${
                  item.type === 'file' && item.details?.doc_type === 'url' ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getItemIcon(item)}
                  <Badge variant="outline" className="text-xs">
                    {item.type === 'event' ? 'Event' : 'File Upload'}
                  </Badge>
                </div>
                <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                  {item.title}
                </h4>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {format(new Date(item.date), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                  </p>
                </div>
                {index < items.length - 1 && (
                  <div className="absolute right-0 top-1/2 w-4 h-px bg-border transform -translate-y-1/2 translate-x-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};