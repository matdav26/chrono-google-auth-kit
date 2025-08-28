import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, Loader2, ChevronLeft, ChevronRight, Link, Upload, Trash2, Edit3, CheckSquare, Plus, Pencil } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface TimelineItem {
  id: string;
  type: 'event' | 'file' | 'action_item';
  action: string;
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

    // Subscribe to real-time updates for activity logs
    const activityChannel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTimelineItems();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for documents (uploads)
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
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(documentsChannel);
    };
  }, [projectId]);

  const fetchTimelineItems = async () => {
    try {
      // Fetch activity logs for deletions, renames, events etc.
      const { data: activities, error: activitiesError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Fetch documents for uploads (since backend uploads don't trigger activity logs)
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // Convert activities to timeline items
      const activityItems: TimelineItem[] = (activities || []).map(activity => {
        // Determine the type based on resource_type
        let type: 'event' | 'file' | 'action_item';
        if (activity.resource_type === 'event') {
          type = 'event';
        } else if (activity.resource_type === 'action_item') {
          type = 'action_item';
        } else {
          type = 'file';
        }
        
        return {
          id: activity.id,
          type,
          action: activity.action,
          title: activity.resource_name || 'Unknown',
          description: getActivityDescription(activity),
          date: activity.created_at,
          details: activity.details || {},
        };
      });

      // Convert documents to upload timeline items
      const uploadItems: TimelineItem[] = (documents || []).map(doc => ({
        id: `upload-${doc.id}`,
        type: 'file' as const,
        action: 'uploaded',
        title: doc.filename || 'Unknown',
        description: `${doc.doc_type === 'url' ? 'URL' : 'File'} uploaded`,
        date: doc.uploaded_at,
        details: { doc_type: doc.doc_type, raw_text: doc.raw_text },
      }));

      // Combine and sort by date, remove duplicates based on document name and close timestamps
      const allItems = [...activityItems, ...uploadItems];
      const uniqueItems = allItems.filter((item, index, arr) => {
        // For uploads, check if there's a corresponding activity log entry within a short time window
        if (item.action === 'uploaded') {
          const hasActivityLog = arr.some(other => 
            other.action === 'uploaded' && 
            other.title === item.title && 
            other.id !== item.id &&
            Math.abs(new Date(other.date).getTime() - new Date(item.date).getTime()) < 60000 // 1 minute
          );
          return !hasActivityLog;
        }
        return true;
      });

      const sortedItems = uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // If in preview mode, limit to latest 3 items
      setItems(preview ? sortedItems.slice(0, 3) : sortedItems);
    } catch (err) {
      console.error('Error fetching timeline items:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityDescription = (activity: any) => {
    const { action, resource_type, details } = activity;
    
    if (resource_type === 'action_item') {
      switch (action) {
        case 'created':
          return 'Action item created';
        case 'updated':
          return 'Action item updated';
        case 'deleted':
          return 'Action item deleted';
        case 'completed':
          return 'Action item completed';
        default:
          return `Action item ${action}`;
      }
    }
    
    switch (action) {
      case 'uploaded':
        return `${resource_type === 'url' ? 'URL' : 'File'} uploaded`;
      case 'deleted':
        return `${resource_type === 'url' ? 'URL' : 'File'} deleted`;
      case 'renamed':
        return `${resource_type === 'url' ? 'URL' : 'File'} renamed from "${details?.old_name}" to "${details?.new_name}"`;
      case 'created':
        return resource_type === 'event' ? 'Event created' : 'Item created';
      default:
        return `${action} ${resource_type}`;
    }
  };

  const getItemIcon = (item: TimelineItem) => {
    if (item.type === 'event') {
      return <Calendar className="h-5 w-5 text-blue-500" />;
    } else if (item.type === 'action_item') {
      // For action item activities
      switch (item.action) {
        case 'created':
          return <Plus className="h-5 w-5 text-purple-500" />;
        case 'updated':
          return <Pencil className="h-5 w-5 text-yellow-500" />;
        case 'deleted':
          return <Trash2 className="h-5 w-5 text-red-500" />;
        case 'completed':
          return <CheckSquare className="h-5 w-5 text-green-500" />;
        default:
          return <CheckSquare className="h-5 w-5 text-purple-500" />;
      }
    } else {
      // For file/url activities, show icon based on action
      switch (item.action) {
        case 'uploaded':
          return item.details?.doc_type === 'url' ? 
            <Link className="h-5 w-5 text-green-500" /> : 
            <Upload className="h-5 w-5 text-green-500" />;
        case 'deleted':
          return <Trash2 className="h-5 w-5 text-red-500" />;
        case 'renamed':
          return <Edit3 className="h-5 w-5 text-blue-500" />;
        default:
          return item.details?.doc_type === 'url' ? 
            <Link className="h-5 w-5 text-primary" /> : 
            <FileText className="h-5 w-5 text-primary" />;
      }
    }
  };

  const getActivityBadge = (item: TimelineItem) => {
    if (item.type === 'event') {
      return 'Event';
    } else if (item.type === 'action_item') {
      return 'Action Item';
    }
    
    switch (item.action) {
      case 'uploaded':
        return 'Upload';
      case 'deleted':
        return 'Delete';
      case 'renamed':
        return 'Rename';
      case 'created':
        return 'Create';
      case 'updated':
        return 'Update';
      case 'completed':
        return 'Complete';
      default:
        return item.action;
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
                      {getActivityBadge(item)}
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