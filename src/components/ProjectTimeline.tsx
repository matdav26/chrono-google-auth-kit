import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, Upload, Trash2, Edit3, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLog {
  id: string;
  action: string;
  resource_type: string;
  resource_name: string;
  details: any;
  created_at: string;
  user_id: string;
  users?: {
    id: string;
    name?: string;
    email?: string;
  } | null;
}

interface ProjectTimelineProps {
  projectId: string;
}

export const ProjectTimeline = ({ projectId }: ProjectTimelineProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
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
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      // First get activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activityError) throw activityError;

      // Get unique user IDs
      const userIds = [...new Set(activityData?.map(a => a.user_id) || [])];
      
      // Get user info for those IDs
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (userError) throw userError;

      // Combine the data
      const activitiesWithUsers = activityData?.map(activity => ({
        ...activity,
        users: userData?.find(user => user.id === activity.user_id) || null
      })) || [];

      setActivities(activitiesWithUsers);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string, resourceType: string) => {
    switch (action) {
      case 'uploaded':
        return <Upload className="h-4 w-4 text-green-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'renamed':
        return <Edit3 className="h-4 w-4 text-blue-500" />;
      default:
        return resourceType === 'url' ? 
          <ExternalLink className="h-4 w-4 text-gray-500" /> : 
          <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityMessage = (activity: ActivityLog) => {
    const { action, resource_type, resource_name, details, users } = activity;
    const userName = users?.name || users?.email || 'Someone';

    switch (action) {
      case 'uploaded':
        return `${userName} uploaded ${resource_type} "${resource_name}"`;
      case 'deleted':
        return `${userName} deleted ${resource_type} "${resource_name}"`;
      case 'renamed':
        return `${userName} renamed ${resource_type} from "${details?.old_name}" to "${details?.new_name}"`;
      default:
        return `${userName} performed ${action} on ${resource_type} "${resource_name}"`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No activity yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Project Timeline</h3>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.action, activity.resource_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {getActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
                {index < activities.length - 1 && (
                  <div className="absolute left-2 mt-8 h-4 w-px bg-border" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};