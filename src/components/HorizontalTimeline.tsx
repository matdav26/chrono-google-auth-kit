import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, Loader2, ChevronLeft, ChevronRight, Link } from 'lucide-react';
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
  preview?: boolean;
}

export const HorizontalTimeline = ({ projectId, preview = false }: HorizontalTimelineProps) => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

      // If in preview mode, limit to latest 3 items
      setItems(preview ? timelineItems.slice(0, 3) : timelineItems);
    } catch (err) {
      console.error('Error fetching timeline items:', err);
    } finally {
      setLoading(false);
    }
  };

  const getItemIcon = (item: TimelineItem) => {
    if (item.type === 'event') {
      return <Calendar className="h-5 w-5 text-blue-500" />;
    } else {
      return item.details?.doc_type === 'url' ? 
        <Link className="h-5 w-5 text-primary" /> : 
        <FileText className="h-5 w-5 text-green-500" />;
    }
  };

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkScrollButtons);
      return () => scrollElement.removeEventListener('scroll', checkScrollButtons);
    }
  }, [items]);

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
    <Card className={preview ? "mb-0" : "mb-8"}>
      <CardContent className="p-6">
        {!preview && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Project Timeline</h3>
            <p className="text-sm text-muted-foreground">Major milestones and file uploads</p>
          </div>
        )}
        
        <div className="relative">
          {/* Navigation Arrows */}
          {canScrollLeft && (
            <Button
              variant="outline"
              size="sm"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full h-10 w-10 p-0 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-muted"
              onClick={scrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          
          {canScrollRight && (
            <Button
              variant="outline"
              size="sm"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full h-10 w-10 p-0 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-muted"
              onClick={scrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Scrollable Timeline */}
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex space-x-6 pb-4 px-8" style={{ minWidth: `${items.length * 280}px` }}>
              {items.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`flex-shrink-0 w-64 p-4 border border-border rounded-xl bg-card hover:bg-muted/30 transition-all duration-200 hover:shadow-sm ${
                    item.type === 'file' && item.details?.doc_type === 'url' ? 'cursor-pointer hover:border-primary/30' : ''
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-background border border-border">
                      {getItemIcon(item)}
                    </div>
                    <Badge variant="outline" className="text-xs font-medium">
                      {item.type === 'event' ? 'Event' : 'Upload'}
                    </Badge>
                  </div>
                  
                  <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 leading-relaxed">
                    {item.title}
                  </h4>
                  
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(item.date), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                    </p>
                  </div>
                  
                  {/* Connection line */}
                  {index < items.length - 1 && (
                    <div className="absolute right-0 top-1/2 w-6 h-px bg-border/60 transform -translate-y-1/2 translate-x-6" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};